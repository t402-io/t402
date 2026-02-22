// Package facilitator provides the facilitator-side implementation for Bitcoin exact payments.
package facilitator

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math/big"
	"sync"
	"time"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/btc"
	"github.com/t402-io/t402/sdks/go/types"
)

// ExactBtcSchemeConfig holds configuration for the Bitcoin on-chain facilitator
type ExactBtcSchemeConfig struct {
	// UsedTxCacheDuration is how long to cache used transaction/PSBT hashes
	// Default: 24 hours
	UsedTxCacheDuration time.Duration
}

// ExactBtcScheme implements the SchemeNetworkFacilitator for Bitcoin on-chain PSBT payments.
type ExactBtcScheme struct {
	signer btc.FacilitatorBtcSigner
	config ExactBtcSchemeConfig

	usedTxMu sync.RWMutex
	usedTxs  map[string]time.Time
}

// NewExactBtcScheme creates a new ExactBtcScheme facilitator.
func NewExactBtcScheme(signer btc.FacilitatorBtcSigner, config *ExactBtcSchemeConfig) *ExactBtcScheme {
	cfg := ExactBtcSchemeConfig{
		UsedTxCacheDuration: 24 * time.Hour,
	}
	if config != nil {
		if config.UsedTxCacheDuration > 0 {
			cfg.UsedTxCacheDuration = config.UsedTxCacheDuration
		}
	}

	scheme := &ExactBtcScheme{
		signer:  signer,
		config:  cfg,
		usedTxs: make(map[string]time.Time),
	}

	go scheme.cleanupUsedTxs()

	return scheme
}

// Scheme returns the scheme identifier
func (f *ExactBtcScheme) Scheme() string {
	return btc.SchemeExact
}

// CaipFamily returns the CAIP family pattern
func (f *ExactBtcScheme) CaipFamily() string {
	return "bip122:*"
}

// GetExtra returns mechanism-specific extra data (none for BTC on-chain)
func (f *ExactBtcScheme) GetExtra(network t402.Network) map[string]interface{} {
	return nil
}

// GetSigners returns signer addresses
func (f *ExactBtcScheme) GetSigners(network t402.Network) []string {
	return f.signer.GetAddresses()
}

// Verify verifies a Bitcoin on-chain payment payload.
func (f *ExactBtcScheme) Verify(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.VerifyResponse, error) {
	network := t402.Network(requirements.Network)

	// Validate scheme
	if payload.Accepted.Scheme != btc.SchemeExact {
		return nil, t402.NewVerifyError("invalid_scheme", "", network, nil)
	}

	// Validate network matches
	if payload.Accepted.Network != requirements.Network {
		return nil, t402.NewVerifyError("network_mismatch", "", network, nil)
	}

	// Validate network is a valid BTC network
	if !btc.IsSupportedBtcNetwork(requirements.Network) {
		return nil, t402.NewVerifyError("unsupported_network", "", network, nil)
	}

	// Parse payload
	psbtPayload := btc.PayloadFromMap(payload.Payload)
	if psbtPayload.SignedPsbt == "" {
		return nil, t402.NewVerifyError("invalid_payload_structure", "", network, nil)
	}

	// Validate payTo address
	if !btc.ValidateBitcoinAddress(requirements.PayTo) {
		return nil, t402.NewVerifyError("invalid_pay_to_address", "", network, nil)
	}

	// Validate amount above dust limit
	amount := new(big.Int)
	if _, ok := amount.SetString(requirements.Amount, 10); !ok {
		return nil, t402.NewVerifyError("invalid_required_amount", "", network, nil)
	}
	if amount.Int64() < btc.DustLimit {
		return nil, t402.NewVerifyError("amount_below_dust_limit", "", network, nil)
	}

	// Check for replay attack using PSBT hash
	psbtHash := hashPsbt(psbtPayload.SignedPsbt)
	if f.isTxUsed(psbtHash) {
		return nil, t402.NewVerifyError("psbt_already_used", "", network, nil)
	}

	// Verify the PSBT via signer
	valid, reason, payer, err := f.signer.VerifyPsbt(ctx, psbtPayload.SignedPsbt, requirements.PayTo, requirements.Amount)
	if err != nil {
		return nil, t402.NewVerifyError("psbt_verification_error", "", network, err)
	}
	if !valid {
		verifyReason := "psbt_verification_failed"
		if reason != "" {
			verifyReason = reason
		}
		return nil, t402.NewVerifyError(verifyReason, payer, network, nil)
	}

	// Mark PSBT as used
	f.markTxUsed(psbtHash)

	return &t402.VerifyResponse{
		IsValid: true,
		Payer:   payer,
	}, nil
}

// Settle settles a Bitcoin on-chain payment by broadcasting the PSBT.
func (f *ExactBtcScheme) Settle(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.SettleResponse, error) {
	network := t402.Network(payload.Accepted.Network)

	// Verify first
	verifyResp, err := f.Verify(ctx, payload, requirements)
	if err != nil {
		ve, ok := err.(*t402.VerifyError)
		if !ok {
			ve = &t402.VerifyError{
				Reason:  "verification_failed",
				Network: network,
				Err:     err,
			}
		}
		return nil, t402.NewSettleError(ve.Reason, ve.Payer, ve.Network, "", ve.Err)
	}

	psbtPayload := btc.PayloadFromMap(payload.Payload)

	// Broadcast the signed transaction
	txID, err := f.signer.BroadcastPsbt(ctx, psbtPayload.SignedPsbt)
	if err != nil {
		return nil, t402.NewSettleError("broadcast_failed", verifyResp.Payer, network, "", err)
	}

	// Wait for at least 1 confirmation
	confirmed, _, _, err := f.signer.WaitForConfirmation(ctx, txID, 1)
	if err != nil {
		return nil, t402.NewSettleError("confirmation_error", verifyResp.Payer, network, txID, err)
	}

	if !confirmed {
		return nil, t402.NewSettleError("transaction_not_confirmed", verifyResp.Payer, network, txID, nil)
	}

	return &t402.SettleResponse{
		Success:     true,
		Transaction: txID,
		Network:     network,
		Payer:       verifyResp.Payer,
	}, nil
}

// LightningScheme implements the SchemeNetworkFacilitator for Lightning Network payments.
//
// Verification is done by checking that SHA-256(preimage) === paymentHash.
// Lightning payments are atomic (settle-on-pay), so settle is a confirmation-only operation.
type LightningScheme struct {
	signer btc.FacilitatorLightningSigner

	usedHashMu sync.RWMutex
	usedHashes map[string]time.Time
}

// NewLightningScheme creates a new LightningScheme facilitator.
func NewLightningScheme(signer btc.FacilitatorLightningSigner) *LightningScheme {
	scheme := &LightningScheme{
		signer:     signer,
		usedHashes: make(map[string]time.Time),
	}

	go scheme.cleanupUsedHashes()

	return scheme
}

// Scheme returns the scheme identifier
func (f *LightningScheme) Scheme() string {
	return btc.SchemeExact
}

// CaipFamily returns the CAIP family pattern
func (f *LightningScheme) CaipFamily() string {
	return "lightning:*"
}

// GetExtra returns mechanism-specific extra data (none for Lightning)
func (f *LightningScheme) GetExtra(network t402.Network) map[string]interface{} {
	return nil
}

// GetSigners returns Lightning node public keys
func (f *LightningScheme) GetSigners(network t402.Network) []string {
	return f.signer.GetAddresses()
}

// Verify verifies a Lightning payment payload.
func (f *LightningScheme) Verify(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.VerifyResponse, error) {
	network := t402.Network(requirements.Network)

	// Validate scheme
	if payload.Accepted.Scheme != btc.SchemeExact {
		return nil, t402.NewVerifyError("invalid_scheme", "", network, nil)
	}

	// Validate network
	if payload.Accepted.Network != requirements.Network {
		return nil, t402.NewVerifyError("network_mismatch", "", network, nil)
	}

	// Validate network is a valid Lightning network
	if !btc.IsSupportedLightningNetwork(requirements.Network) {
		return nil, t402.NewVerifyError("unsupported_network", "", network, nil)
	}

	// Parse payload
	lnPayload := btc.LightningPayloadFromMap(payload.Payload)
	if lnPayload.PaymentHash == "" || lnPayload.Preimage == "" || lnPayload.Bolt11Invoice == "" {
		return nil, t402.NewVerifyError("invalid_payload_structure", "", network, nil)
	}

	// Validate preimage format (32 bytes hex)
	if !btc.IsValidHex(lnPayload.Preimage, 32) {
		return nil, t402.NewVerifyError("invalid_preimage_format", "", network, nil)
	}

	// Validate payment hash format (32 bytes hex)
	if !btc.IsValidHex(lnPayload.PaymentHash, 32) {
		return nil, t402.NewVerifyError("invalid_payment_hash_format", "", network, nil)
	}

	// Check replay
	if f.isHashUsed(lnPayload.PaymentHash) {
		return nil, t402.NewVerifyError("payment_hash_already_used", "", network, nil)
	}

	// Core verification: SHA-256(preimage) must equal paymentHash
	preimageBytes, err := hex.DecodeString(lnPayload.Preimage)
	if err != nil {
		return nil, t402.NewVerifyError("invalid_preimage_encoding", "", network, err)
	}

	computedHash := sha256.Sum256(preimageBytes)
	computedHashHex := hex.EncodeToString(computedHash[:])

	if computedHashHex != lnPayload.PaymentHash {
		return nil, t402.NewVerifyError("preimage_hash_mismatch", "", network, nil)
	}

	// Optionally verify with the Lightning node
	settled, amountSats, _, err := f.signer.LookupPayment(ctx, lnPayload.PaymentHash)
	if err == nil {
		if !settled {
			return nil, t402.NewVerifyError("payment_not_settled", "", network, nil)
		}

		// Verify amount matches if available
		if amountSats != "" && requirements.Amount != "" {
			paidAmount := new(big.Int)
			requiredAmount := new(big.Int)
			if _, ok := paidAmount.SetString(amountSats, 10); ok {
				if _, ok := requiredAmount.SetString(requirements.Amount, 10); ok {
					if paidAmount.Cmp(requiredAmount) < 0 {
						return nil, t402.NewVerifyError("insufficient_amount", "", network,
							fmt.Errorf("expected %s, got %s", requirements.Amount, amountSats))
					}
				}
			}
		}
	}
	// If lookup fails, preimage verification is sufficient

	// Mark payment hash as used
	f.markHashUsed(lnPayload.PaymentHash)

	return &t402.VerifyResponse{
		IsValid: true,
	}, nil
}

// Settle settles a Lightning payment.
// Lightning payments are atomic (settle-on-pay), so this confirms the payment.
func (f *LightningScheme) Settle(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.SettleResponse, error) {
	network := t402.Network(payload.Accepted.Network)

	// Verify the payment
	_, err := f.Verify(ctx, payload, requirements)
	if err != nil {
		ve, ok := err.(*t402.VerifyError)
		if !ok {
			ve = &t402.VerifyError{
				Reason:  "verification_failed",
				Network: network,
				Err:     err,
			}
		}
		return nil, t402.NewSettleError(ve.Reason, ve.Payer, ve.Network, "", ve.Err)
	}

	lnPayload := btc.LightningPayloadFromMap(payload.Payload)

	// Lightning is settle-on-pay: the payment hash serves as the transaction ID
	return &t402.SettleResponse{
		Success:     true,
		Transaction: lnPayload.PaymentHash,
		Network:     network,
	}, nil
}

// hashPsbt creates a hash of the PSBT for replay protection
func hashPsbt(signedPsbt string) string {
	h := sha256.Sum256([]byte(signedPsbt))
	return hex.EncodeToString(h[:])
}

// BTC on-chain replay protection helpers
func (f *ExactBtcScheme) isTxUsed(hash string) bool {
	f.usedTxMu.RLock()
	defer f.usedTxMu.RUnlock()
	_, used := f.usedTxs[hash]
	return used
}

func (f *ExactBtcScheme) markTxUsed(hash string) {
	f.usedTxMu.Lock()
	defer f.usedTxMu.Unlock()
	f.usedTxs[hash] = time.Now()
}

func (f *ExactBtcScheme) cleanupUsedTxs() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		f.usedTxMu.Lock()
		cutoff := time.Now().Add(-f.config.UsedTxCacheDuration)
		for hash, usedAt := range f.usedTxs {
			if usedAt.Before(cutoff) {
				delete(f.usedTxs, hash)
			}
		}
		f.usedTxMu.Unlock()
	}
}

// Lightning replay protection helpers
func (f *LightningScheme) isHashUsed(hash string) bool {
	f.usedHashMu.RLock()
	defer f.usedHashMu.RUnlock()
	_, used := f.usedHashes[hash]
	return used
}

func (f *LightningScheme) markHashUsed(hash string) {
	f.usedHashMu.Lock()
	defer f.usedHashMu.Unlock()
	f.usedHashes[hash] = time.Now()
}

func (f *LightningScheme) cleanupUsedHashes() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		f.usedHashMu.Lock()
		cutoff := time.Now().Add(-24 * time.Hour)
		for hash, usedAt := range f.usedHashes {
			if usedAt.Before(cutoff) {
				delete(f.usedHashes, hash)
			}
		}
		f.usedHashMu.Unlock()
	}
}
