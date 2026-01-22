package facilitator

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/big"
	"sync"
	"time"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/near"
	"github.com/t402-io/t402/sdks/go/types"
)

// ExactDirectNearSchemeConfig holds configuration for the ExactDirectNearScheme
type ExactDirectNearSchemeConfig struct {
	// MaxTransactionAge is the maximum age of a transaction to accept
	// Default: 5 minutes
	MaxTransactionAge time.Duration

	// UsedTxCacheDuration is how long to cache used transaction hashes
	// Default: 24 hours
	UsedTxCacheDuration time.Duration
}

// ExactDirectNearScheme implements the SchemeNetworkFacilitator for NEAR exact-direct payments
type ExactDirectNearScheme struct {
	signer near.FacilitatorNearSigner
	config ExactDirectNearSchemeConfig

	// Used transaction cache for replay protection
	usedTxMu sync.RWMutex
	usedTxs  map[string]time.Time
}

// NewExactDirectNearScheme creates a new ExactDirectNearScheme
func NewExactDirectNearScheme(signer near.FacilitatorNearSigner, config *ExactDirectNearSchemeConfig) *ExactDirectNearScheme {
	cfg := ExactDirectNearSchemeConfig{
		MaxTransactionAge:   5 * time.Minute,
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

	scheme := &ExactDirectNearScheme{
		signer: signer,
		config: cfg,
		usedTxs: make(map[string]time.Time),
	}

	// Start cleanup goroutine
	go scheme.cleanupUsedTxs()

	return scheme
}

// Scheme returns the scheme identifier
func (f *ExactDirectNearScheme) Scheme() string {
	return near.SchemeExactDirect
}

// CaipFamily returns the CAIP family pattern
func (f *ExactDirectNearScheme) CaipFamily() string {
	return "near:*"
}

// GetExtra returns mechanism-specific extra data
func (f *ExactDirectNearScheme) GetExtra(network t402.Network) map[string]interface{} {
	config, ok := near.GetNetworkConfig(string(network))
	if !ok {
		return nil
	}

	return map[string]interface{}{
		"assetSymbol":   config.DefaultToken.Symbol,
		"assetDecimals": config.DefaultToken.Decimals,
	}
}

// GetSigners returns signer addresses
func (f *ExactDirectNearScheme) GetSigners(network t402.Network) []string {
	return f.signer.GetAddresses(context.Background(), string(network))
}

// Verify verifies a payment payload
func (f *ExactDirectNearScheme) Verify(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.VerifyResponse, error) {
	network := t402.Network(requirements.Network)

	// Validate scheme
	if payload.Accepted.Scheme != near.SchemeExactDirect {
		return nil, t402.NewVerifyError("invalid_scheme", "", network, nil)
	}

	// Validate network
	if payload.Accepted.Network != requirements.Network {
		return nil, t402.NewVerifyError("network_mismatch", "", network, nil)
	}

	// Parse payload
	nearPayload, err := near.PayloadFromMap(payload.Payload)
	if err != nil {
		return nil, t402.NewVerifyError("invalid_payload", "", network, err)
	}

	// Validate required fields
	if nearPayload.TxHash == "" {
		return nil, t402.NewVerifyError("missing_tx_hash", "", network, nil)
	}
	if nearPayload.From == "" {
		return nil, t402.NewVerifyError("missing_from", "", network, nil)
	}

	// Check for replay attack
	if f.isTxUsed(nearPayload.TxHash) {
		return nil, t402.NewVerifyError("transaction_already_used", nearPayload.From, network, nil)
	}

	// Query transaction
	tx, err := f.signer.QueryTransaction(ctx, nearPayload.TxHash, nearPayload.From)
	if err != nil {
		return nil, t402.NewVerifyError("transaction_not_found", nearPayload.From, network, err)
	}

	// Verify transaction succeeded
	if !tx.Status.IsSuccess() {
		return nil, t402.NewVerifyError("transaction_failed", nearPayload.From, network, nil)
	}

	// Verify the transaction was to the token contract
	if tx.Transaction.ReceiverID != requirements.Asset {
		return nil, t402.NewVerifyError("wrong_token_contract", nearPayload.From, network,
			fmt.Errorf("expected %s, got %s", requirements.Asset, tx.Transaction.ReceiverID))
	}

	// Find and verify ft_transfer action
	var ftTransferArgs *near.FtTransferArgs
	for _, action := range tx.Transaction.Actions {
		if action.FunctionCall != nil && action.FunctionCall.MethodName == near.FunctionFtTransfer {
			// Decode args (base64 encoded JSON)
			argsBytes, err := base64.StdEncoding.DecodeString(string(action.FunctionCall.Args))
			if err != nil {
				// Try raw JSON
				argsBytes = action.FunctionCall.Args
			}

			var args near.FtTransferArgs
			if err := json.Unmarshal(argsBytes, &args); err != nil {
				continue
			}
			ftTransferArgs = &args
			break
		}
	}

	if ftTransferArgs == nil {
		return nil, t402.NewVerifyError("no_ft_transfer_action", nearPayload.From, network, nil)
	}

	// Verify recipient
	if ftTransferArgs.ReceiverID != requirements.PayTo {
		return nil, t402.NewVerifyError("wrong_recipient", nearPayload.From, network,
			fmt.Errorf("expected %s, got %s", requirements.PayTo, ftTransferArgs.ReceiverID))
	}

	// Verify amount
	txAmount, ok := new(big.Int).SetString(ftTransferArgs.Amount, 10)
	if !ok {
		return nil, t402.NewVerifyError("invalid_tx_amount", nearPayload.From, network, nil)
	}

	requiredAmount, ok := new(big.Int).SetString(requirements.Amount, 10)
	if !ok {
		return nil, t402.NewVerifyError("invalid_required_amount", nearPayload.From, network, nil)
	}

	if txAmount.Cmp(requiredAmount) < 0 {
		return nil, t402.NewVerifyError("insufficient_amount", nearPayload.From, network,
			fmt.Errorf("expected %s, got %s", requirements.Amount, ftTransferArgs.Amount))
	}

	// Mark transaction as used
	f.markTxUsed(nearPayload.TxHash)

	return &t402.VerifyResponse{
		IsValid: true,
		Payer:   nearPayload.From,
	}, nil
}

// Settle settles a payment - for exact-direct, the transfer is already complete
func (f *ExactDirectNearScheme) Settle(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.SettleResponse, error) {
	network := t402.Network(payload.Accepted.Network)

	// Verify first
	verifyResp, err := f.Verify(ctx, payload, requirements)
	if err != nil {
		ve := &t402.VerifyError{}
		if ok := err.(*t402.VerifyError); ok != nil {
			ve = ok
		}
		return nil, t402.NewSettleError(ve.Reason, ve.Payer, ve.Network, "", ve.Err)
	}

	// Parse payload for txHash
	nearPayload, _ := near.PayloadFromMap(payload.Payload)

	// For exact-direct, settlement is already complete (client executed transfer)
	return &t402.SettleResponse{
		Success:     true,
		Transaction: nearPayload.TxHash,
		Network:     network,
		Payer:       verifyResp.Payer,
	}, nil
}

// isTxUsed checks if a transaction has been used
func (f *ExactDirectNearScheme) isTxUsed(txHash string) bool {
	f.usedTxMu.RLock()
	defer f.usedTxMu.RUnlock()
	_, used := f.usedTxs[txHash]
	return used
}

// markTxUsed marks a transaction as used
func (f *ExactDirectNearScheme) markTxUsed(txHash string) {
	f.usedTxMu.Lock()
	defer f.usedTxMu.Unlock()
	f.usedTxs[txHash] = time.Now()
}

// cleanupUsedTxs periodically cleans up old used transactions
func (f *ExactDirectNearScheme) cleanupUsedTxs() {
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
