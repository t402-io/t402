package facilitator

import (
	"context"
	"fmt"
	"math/big"
	"sync"
	"time"

	t402 "github.com/t402-io/t402/go"
	"github.com/t402-io/t402/go/mechanisms/tezos"
	"github.com/t402-io/t402/go/types"
)

// ExactDirectTezosSchemeConfig holds configuration for the ExactDirectTezosScheme
type ExactDirectTezosSchemeConfig struct {
	// MaxOperationAge is the maximum age of an operation to accept (in seconds)
	// Default: 3600 (1 hour)
	MaxOperationAge int64

	// UsedOpCacheDuration is how long to cache used operation hashes
	// Default: 24 hours
	UsedOpCacheDuration time.Duration
}

// ExactDirectTezosScheme implements the SchemeNetworkFacilitator for Tezos exact-direct payments
type ExactDirectTezosScheme struct {
	signer tezos.FacilitatorTezosSigner
	config ExactDirectTezosSchemeConfig

	// Used operation cache for replay protection
	usedOpMu sync.RWMutex
	usedOps  map[string]time.Time
}

// NewExactDirectTezosScheme creates a new ExactDirectTezosScheme
func NewExactDirectTezosScheme(signer tezos.FacilitatorTezosSigner, config *ExactDirectTezosSchemeConfig) *ExactDirectTezosScheme {
	cfg := ExactDirectTezosSchemeConfig{
		MaxOperationAge:     3600, // 1 hour
		UsedOpCacheDuration: 24 * time.Hour,
	}
	if config != nil {
		if config.MaxOperationAge > 0 {
			cfg.MaxOperationAge = config.MaxOperationAge
		}
		if config.UsedOpCacheDuration > 0 {
			cfg.UsedOpCacheDuration = config.UsedOpCacheDuration
		}
	}

	scheme := &ExactDirectTezosScheme{
		signer:  signer,
		config:  cfg,
		usedOps: make(map[string]time.Time),
	}

	// Start cleanup goroutine
	go scheme.cleanupUsedOps()

	return scheme
}

// Scheme returns the scheme identifier
func (f *ExactDirectTezosScheme) Scheme() string {
	return tezos.SchemeExactDirect
}

// CaipFamily returns the CAIP family pattern
func (f *ExactDirectTezosScheme) CaipFamily() string {
	return "tezos:*"
}

// GetExtra returns mechanism-specific extra data
func (f *ExactDirectTezosScheme) GetExtra(network t402.Network) map[string]interface{} {
	config, ok := tezos.GetNetworkConfig(string(network))
	if !ok {
		return nil
	}

	return map[string]interface{}{
		"assetSymbol":   config.DefaultToken.Symbol,
		"assetDecimals": config.DefaultToken.Decimals,
	}
}

// GetSigners returns signer addresses
func (f *ExactDirectTezosScheme) GetSigners(network t402.Network) []string {
	return f.signer.GetAddresses(context.Background(), string(network))
}

// Verify verifies a payment payload
func (f *ExactDirectTezosScheme) Verify(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.VerifyResponse, error) {
	network := t402.Network(requirements.Network)

	// Validate scheme
	if payload.Accepted.Scheme != tezos.SchemeExactDirect {
		return nil, t402.NewVerifyError("invalid_scheme", "", network, nil)
	}

	// Validate network
	if payload.Accepted.Network != requirements.Network {
		return nil, t402.NewVerifyError("network_mismatch", "", network, nil)
	}

	// Parse payload
	tezosPayload, err := tezos.PayloadFromMap(payload.Payload)
	if err != nil {
		return nil, t402.NewVerifyError("invalid_payload", "", network, err)
	}

	// Validate operation hash format
	if !tezos.IsValidOperationHash(tezosPayload.OpHash) {
		return nil, t402.NewVerifyError("invalid_operation_hash_format", "", network, nil)
	}

	// Validate required fields
	if tezosPayload.From == "" {
		return nil, t402.NewVerifyError("missing_from", "", network, nil)
	}

	// Check for replay attack
	if f.isOpUsed(tezosPayload.OpHash) {
		return nil, t402.NewVerifyError("operation_already_used", tezosPayload.From, network, nil)
	}

	// Query operation
	op, err := f.signer.QueryOperation(ctx, tezosPayload.OpHash)
	if err != nil {
		return nil, t402.NewVerifyError("operation_not_found", tezosPayload.From, network, err)
	}

	// Verify operation was applied
	if op.Status != "applied" {
		return nil, t402.NewVerifyError("operation_not_applied", tezosPayload.From, network,
			fmt.Errorf("status: %s", op.Status))
	}

	// Check operation age
	if f.config.MaxOperationAge > 0 {
		opTime, err := time.Parse(time.RFC3339, op.Timestamp)
		if err == nil {
			age := time.Since(opTime).Seconds()
			if int64(age) > f.config.MaxOperationAge {
				return nil, t402.NewVerifyError("operation_too_old", tezosPayload.From, network,
					fmt.Errorf("age: %.0f seconds", age))
			}
		}
	}

	// Extract transfer details
	transferDetails := tezos.ExtractTransferDetails(op)
	if transferDetails == nil {
		return nil, t402.NewVerifyError("could_not_extract_transfer_details", tezosPayload.From, network, nil)
	}

	// Verify contract address
	if !tezos.CompareAddresses(transferDetails.ContractAddress, tezosPayload.ContractAddress) {
		return nil, t402.NewVerifyError("contract_mismatch", tezosPayload.From, network,
			fmt.Errorf("expected %s, got %s", tezosPayload.ContractAddress, transferDetails.ContractAddress))
	}

	// Verify token ID
	if transferDetails.TokenID != tezosPayload.TokenID {
		return nil, t402.NewVerifyError("token_id_mismatch", tezosPayload.From, network,
			fmt.Errorf("expected %d, got %d", tezosPayload.TokenID, transferDetails.TokenID))
	}

	// Verify recipient
	if !tezos.CompareAddresses(transferDetails.To, requirements.PayTo) {
		return nil, t402.NewVerifyError("recipient_mismatch", tezosPayload.From, network,
			fmt.Errorf("expected %s, got %s", requirements.PayTo, transferDetails.To))
	}

	// Verify amount
	txAmount, ok := new(big.Int).SetString(transferDetails.Amount, 10)
	if !ok {
		return nil, t402.NewVerifyError("invalid_tx_amount", tezosPayload.From, network, nil)
	}

	requiredAmount, ok := new(big.Int).SetString(requirements.Amount, 10)
	if !ok {
		return nil, t402.NewVerifyError("invalid_required_amount", tezosPayload.From, network, nil)
	}

	if txAmount.Cmp(requiredAmount) < 0 {
		return nil, t402.NewVerifyError("insufficient_amount", tezosPayload.From, network,
			fmt.Errorf("expected %s, got %s", requirements.Amount, transferDetails.Amount))
	}

	// Mark operation as used
	f.markOpUsed(tezosPayload.OpHash)

	return &t402.VerifyResponse{
		IsValid: true,
		Payer:   tezosPayload.From,
	}, nil
}

// Settle settles a payment - for exact-direct, the transfer is already complete
func (f *ExactDirectTezosScheme) Settle(
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

	// Parse payload for opHash
	tezosPayload, _ := tezos.PayloadFromMap(payload.Payload)

	// For exact-direct, settlement is already complete (client executed transfer)
	return &t402.SettleResponse{
		Success:     true,
		Transaction: tezosPayload.OpHash,
		Network:     network,
		Payer:       verifyResp.Payer,
	}, nil
}

// isOpUsed checks if an operation has been used
func (f *ExactDirectTezosScheme) isOpUsed(opHash string) bool {
	f.usedOpMu.RLock()
	defer f.usedOpMu.RUnlock()
	_, used := f.usedOps[opHash]
	return used
}

// markOpUsed marks an operation as used
func (f *ExactDirectTezosScheme) markOpUsed(opHash string) {
	f.usedOpMu.Lock()
	defer f.usedOpMu.Unlock()
	f.usedOps[opHash] = time.Now()
}

// cleanupUsedOps periodically cleans up old used operations
func (f *ExactDirectTezosScheme) cleanupUsedOps() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		f.usedOpMu.Lock()
		cutoff := time.Now().Add(-f.config.UsedOpCacheDuration)
		for opHash, usedAt := range f.usedOps {
			if usedAt.Before(cutoff) {
				delete(f.usedOps, opHash)
			}
		}
		f.usedOpMu.Unlock()
	}
}
