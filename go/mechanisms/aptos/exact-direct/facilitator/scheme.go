package facilitator

import (
	"context"
	"fmt"
	"math/big"
	"strconv"
	"sync"
	"time"

	t402 "github.com/t402-io/t402/go"
	"github.com/t402-io/t402/go/mechanisms/aptos"
	"github.com/t402-io/t402/go/types"
)

// ExactDirectAptosSchemeConfig holds configuration for the ExactDirectAptosScheme
type ExactDirectAptosSchemeConfig struct {
	// MaxTransactionAge is the maximum age of a transaction to accept (in seconds)
	// Default: 3600 (1 hour)
	MaxTransactionAge int64

	// UsedTxCacheDuration is how long to cache used transaction hashes
	// Default: 24 hours
	UsedTxCacheDuration time.Duration
}

// ExactDirectAptosScheme implements the SchemeNetworkFacilitator for Aptos exact-direct payments
type ExactDirectAptosScheme struct {
	signer aptos.FacilitatorAptosSigner
	config ExactDirectAptosSchemeConfig

	// Used transaction cache for replay protection
	usedTxMu sync.RWMutex
	usedTxs  map[string]time.Time
}

// NewExactDirectAptosScheme creates a new ExactDirectAptosScheme
func NewExactDirectAptosScheme(signer aptos.FacilitatorAptosSigner, config *ExactDirectAptosSchemeConfig) *ExactDirectAptosScheme {
	cfg := ExactDirectAptosSchemeConfig{
		MaxTransactionAge:   3600, // 1 hour
		UsedTxCacheDuration: 24 * time.Hour,
	}
	if config != nil {
		if config.MaxTransactionAge > 0 {
			cfg.MaxTransactionAge = config.MaxTransactionAge
		}
		if config.UsedTxCacheDuration > 0 {
			cfg.UsedTxCacheDuration = config.UsedTxCacheDuration
		}
	}

	scheme := &ExactDirectAptosScheme{
		signer:  signer,
		config:  cfg,
		usedTxs: make(map[string]time.Time),
	}

	// Start cleanup goroutine
	go scheme.cleanupUsedTxs()

	return scheme
}

// Scheme returns the scheme identifier
func (f *ExactDirectAptosScheme) Scheme() string {
	return aptos.SchemeExactDirect
}

// CaipFamily returns the CAIP family pattern
func (f *ExactDirectAptosScheme) CaipFamily() string {
	return "aptos:*"
}

// GetExtra returns mechanism-specific extra data
func (f *ExactDirectAptosScheme) GetExtra(network t402.Network) map[string]interface{} {
	config, ok := aptos.GetNetworkConfig(string(network))
	if !ok {
		return nil
	}

	return map[string]interface{}{
		"assetSymbol":   config.DefaultToken.Symbol,
		"assetDecimals": config.DefaultToken.Decimals,
	}
}

// GetSigners returns signer addresses
func (f *ExactDirectAptosScheme) GetSigners(network t402.Network) []string {
	return f.signer.GetAddresses(context.Background(), string(network))
}

// Verify verifies a payment payload
func (f *ExactDirectAptosScheme) Verify(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.VerifyResponse, error) {
	network := t402.Network(requirements.Network)

	// Validate scheme
	if payload.Accepted.Scheme != aptos.SchemeExactDirect {
		return nil, t402.NewVerifyError("invalid_scheme", "", network, nil)
	}

	// Validate network
	if payload.Accepted.Network != requirements.Network {
		return nil, t402.NewVerifyError("network_mismatch", "", network, nil)
	}

	// Parse payload
	aptosPayload, err := aptos.PayloadFromMap(payload.Payload)
	if err != nil {
		return nil, t402.NewVerifyError("invalid_payload", "", network, err)
	}

	// Validate transaction hash format
	if !aptos.IsValidTxHash(aptosPayload.TxHash) {
		return nil, t402.NewVerifyError("invalid_tx_hash_format", "", network, nil)
	}

	// Validate required fields
	if aptosPayload.From == "" {
		return nil, t402.NewVerifyError("missing_from", "", network, nil)
	}

	// Check for replay attack
	if f.isTxUsed(aptosPayload.TxHash) {
		return nil, t402.NewVerifyError("transaction_already_used", aptosPayload.From, network, nil)
	}

	// Query transaction
	tx, err := f.signer.QueryTransaction(ctx, aptosPayload.TxHash)
	if err != nil {
		return nil, t402.NewVerifyError("transaction_not_found", aptosPayload.From, network, err)
	}

	// Verify transaction succeeded
	if !tx.Success {
		return nil, t402.NewVerifyError("transaction_failed", aptosPayload.From, network,
			fmt.Errorf("vm_status: %s", tx.VMStatus))
	}

	// Check transaction age
	if f.config.MaxTransactionAge > 0 {
		// Timestamp is in microseconds
		txTimestamp, err := strconv.ParseInt(tx.Timestamp, 10, 64)
		if err == nil {
			txTimestampSec := txTimestamp / 1000000
			age := time.Now().Unix() - txTimestampSec
			if age > f.config.MaxTransactionAge {
				return nil, t402.NewVerifyError("transaction_too_old", aptosPayload.From, network,
					fmt.Errorf("age: %d seconds", age))
			}
		}
	}

	// Extract transfer details
	transferDetails := aptos.ExtractTransferDetails(tx)
	if transferDetails == nil {
		return nil, t402.NewVerifyError("could_not_extract_transfer_details", aptosPayload.From, network, nil)
	}

	// Verify recipient
	if !aptos.CompareAddresses(transferDetails.To, requirements.PayTo) {
		return nil, t402.NewVerifyError("recipient_mismatch", aptosPayload.From, network,
			fmt.Errorf("expected %s, got %s", requirements.PayTo, transferDetails.To))
	}

	// Verify amount
	txAmount, ok := new(big.Int).SetString(transferDetails.Amount, 10)
	if !ok {
		return nil, t402.NewVerifyError("invalid_tx_amount", aptosPayload.From, network, nil)
	}

	requiredAmount, ok := new(big.Int).SetString(requirements.Amount, 10)
	if !ok {
		return nil, t402.NewVerifyError("invalid_required_amount", aptosPayload.From, network, nil)
	}

	if txAmount.Cmp(requiredAmount) < 0 {
		return nil, t402.NewVerifyError("insufficient_amount", aptosPayload.From, network,
			fmt.Errorf("expected %s, got %s", requirements.Amount, transferDetails.Amount))
	}

	// Mark transaction as used
	f.markTxUsed(aptosPayload.TxHash)

	return &t402.VerifyResponse{
		IsValid: true,
		Payer:   aptosPayload.From,
	}, nil
}

// Settle settles a payment - for exact-direct, the transfer is already complete
func (f *ExactDirectAptosScheme) Settle(
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

	// Parse payload for txHash
	aptosPayload, _ := aptos.PayloadFromMap(payload.Payload)

	// For exact-direct, settlement is already complete (client executed transfer)
	return &t402.SettleResponse{
		Success:     true,
		Transaction: aptosPayload.TxHash,
		Network:     network,
		Payer:       verifyResp.Payer,
	}, nil
}

// isTxUsed checks if a transaction has been used
func (f *ExactDirectAptosScheme) isTxUsed(txHash string) bool {
	f.usedTxMu.RLock()
	defer f.usedTxMu.RUnlock()
	_, used := f.usedTxs[txHash]
	return used
}

// markTxUsed marks a transaction as used
func (f *ExactDirectAptosScheme) markTxUsed(txHash string) {
	f.usedTxMu.Lock()
	defer f.usedTxMu.Unlock()
	f.usedTxs[txHash] = time.Now()
}

// cleanupUsedTxs periodically cleans up old used transactions
func (f *ExactDirectAptosScheme) cleanupUsedTxs() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		f.usedTxMu.Lock()
		cutoff := time.Now().Add(-f.config.UsedTxCacheDuration)
		for txHash, usedAt := range f.usedTxs {
			if usedAt.Before(cutoff) {
				delete(f.usedTxs, txHash)
			}
		}
		f.usedTxMu.Unlock()
	}
}
