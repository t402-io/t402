// Package facilitator provides the facilitator-side implementation for Cosmos exact-direct payments.
package facilitator

import (
	"context"
	"fmt"
	"math/big"
	"sync"
	"time"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/cosmos"
	"github.com/t402-io/t402/sdks/go/types"
)

// ExactDirectCosmosSchemeConfig holds configuration for the ExactDirectCosmosScheme
type ExactDirectCosmosSchemeConfig struct {
	// MaxTransactionAge is the maximum age of a transaction to accept
	// Default: 5 minutes
	MaxTransactionAge time.Duration

	// UsedTxCacheDuration is how long to cache used transaction hashes
	// Default: 24 hours
	UsedTxCacheDuration time.Duration
}

// ExactDirectCosmosScheme implements the SchemeNetworkFacilitator for Cosmos exact-direct payments
type ExactDirectCosmosScheme struct {
	signer cosmos.FacilitatorCosmosSigner
	config ExactDirectCosmosSchemeConfig

	// Used transaction cache for replay protection
	usedTxMu sync.RWMutex
	usedTxs  map[string]time.Time
}

// NewExactDirectCosmosScheme creates a new ExactDirectCosmosScheme
func NewExactDirectCosmosScheme(signer cosmos.FacilitatorCosmosSigner, config *ExactDirectCosmosSchemeConfig) *ExactDirectCosmosScheme {
	cfg := ExactDirectCosmosSchemeConfig{
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

	scheme := &ExactDirectCosmosScheme{
		signer:  signer,
		config:  cfg,
		usedTxs: make(map[string]time.Time),
	}

	// Start cleanup goroutine
	go scheme.cleanupUsedTxs()

	return scheme
}

// Scheme returns the scheme identifier
func (f *ExactDirectCosmosScheme) Scheme() string {
	return cosmos.SchemeExactDirect
}

// CaipFamily returns the CAIP family pattern
func (f *ExactDirectCosmosScheme) CaipFamily() string {
	return "cosmos:*"
}

// GetExtra returns mechanism-specific extra data
func (f *ExactDirectCosmosScheme) GetExtra(network t402.Network) map[string]interface{} {
	config, ok := cosmos.GetNetworkConfig(string(network))
	if !ok {
		return nil
	}

	return map[string]interface{}{
		"assetSymbol":   config.DefaultToken.Symbol,
		"assetDecimals": config.DefaultToken.Decimals,
		"assetDenom":    config.DefaultToken.Denom,
	}
}

// GetSigners returns signer addresses
func (f *ExactDirectCosmosScheme) GetSigners(network t402.Network) []string {
	return f.signer.GetAddresses(context.Background(), string(network))
}

// Verify verifies a payment payload
func (f *ExactDirectCosmosScheme) Verify(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.VerifyResponse, error) {
	network := t402.Network(requirements.Network)

	// Validate scheme
	if payload.Accepted.Scheme != cosmos.SchemeExactDirect {
		return nil, t402.NewVerifyError("invalid_scheme", "", network, nil)
	}

	// Validate network
	if payload.Accepted.Network != requirements.Network {
		return nil, t402.NewVerifyError("network_mismatch", "", network, nil)
	}

	// Get network config
	networkConfig, ok := cosmos.GetNetworkConfig(requirements.Network)
	if !ok {
		return nil, t402.NewVerifyError("unsupported_network", "", network, nil)
	}

	// Parse payload
	cosmosPayload, err := cosmos.PayloadFromMap(payload.Payload)
	if err != nil {
		return nil, t402.NewVerifyError("invalid_payload", "", network, err)
	}

	// Validate required fields
	if cosmosPayload.TxHash == "" {
		return nil, t402.NewVerifyError("missing_tx_hash", "", network, nil)
	}
	if cosmosPayload.From == "" {
		return nil, t402.NewVerifyError("missing_from", "", network, nil)
	}

	// Validate address format
	if !cosmos.IsValidAddress(cosmosPayload.From, networkConfig.Bech32Prefix) {
		return nil, t402.NewVerifyError("invalid_from_address", cosmosPayload.From, network, nil)
	}

	// Check for replay attack
	if f.isTxUsed(cosmosPayload.TxHash) {
		return nil, t402.NewVerifyError("transaction_already_used", cosmosPayload.From, network, nil)
	}

	// Query transaction
	tx, err := f.signer.QueryTransaction(ctx, requirements.Network, cosmosPayload.TxHash)
	if err != nil {
		return nil, t402.NewVerifyError("transaction_not_found", cosmosPayload.From, network, err)
	}

	// Verify transaction succeeded
	if !tx.IsSuccess() {
		return nil, t402.NewVerifyError("transaction_failed", cosmosPayload.From, network,
			fmt.Errorf("tx code: %d, log: %s", tx.Code, tx.RawLog))
	}

	// Find and verify MsgSend
	var msgSend *cosmos.MsgSend
	for _, rawMsg := range tx.Tx.Body.Messages {
		msg, err := cosmos.ParseMsgSend(rawMsg)
		if err != nil {
			continue
		}
		if msg != nil {
			msgSend = msg
			break
		}
	}

	if msgSend == nil {
		return nil, t402.NewVerifyError("no_bank_send_message", cosmosPayload.From, network, nil)
	}

	// Determine expected denom
	expectedDenom := cosmos.USDCDenom
	if requirements.Asset != "" && requirements.Asset != "USDC" {
		// If asset is specified and not USDC symbol, treat it as denom
		expectedDenom = requirements.Asset
	}

	// Verify recipient
	if msgSend.ToAddress != requirements.PayTo {
		return nil, t402.NewVerifyError("wrong_recipient", cosmosPayload.From, network,
			fmt.Errorf("expected %s, got %s", requirements.PayTo, msgSend.ToAddress))
	}

	// Verify sender
	if msgSend.FromAddress != cosmosPayload.From {
		return nil, t402.NewVerifyError("sender_mismatch", cosmosPayload.From, network,
			fmt.Errorf("expected %s, got %s", cosmosPayload.From, msgSend.FromAddress))
	}

	// Verify amount
	txAmount := msgSend.GetAmountByDenom(expectedDenom)
	if txAmount == "" {
		return nil, t402.NewVerifyError("wrong_denom", cosmosPayload.From, network,
			fmt.Errorf("expected denom %s not found in transaction", expectedDenom))
	}

	txAmountBig, ok := new(big.Int).SetString(txAmount, 10)
	if !ok {
		return nil, t402.NewVerifyError("invalid_tx_amount", cosmosPayload.From, network, nil)
	}

	requiredAmount, ok := new(big.Int).SetString(requirements.Amount, 10)
	if !ok {
		return nil, t402.NewVerifyError("invalid_required_amount", cosmosPayload.From, network, nil)
	}

	if txAmountBig.Cmp(requiredAmount) < 0 {
		return nil, t402.NewVerifyError("insufficient_amount", cosmosPayload.From, network,
			fmt.Errorf("expected %s, got %s", requirements.Amount, txAmount))
	}

	// Mark transaction as used
	f.markTxUsed(cosmosPayload.TxHash)

	return &t402.VerifyResponse{
		IsValid: true,
		Payer:   cosmosPayload.From,
	}, nil
}

// Settle settles a payment - for exact-direct, the transfer is already complete
func (f *ExactDirectCosmosScheme) Settle(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.SettleResponse, error) {
	network := t402.Network(payload.Accepted.Network)

	// Verify first
	verifyResp, err := f.Verify(ctx, payload, requirements)
	if err != nil {
		ve, ok := err.(*t402.VerifyError)
		if ok {
			return nil, t402.NewSettleError(ve.Reason, ve.Payer, ve.Network, "", ve.Err)
		}
		return nil, t402.NewSettleError("verification_failed", "", network, "", err)
	}

	// Parse payload for txHash
	cosmosPayload, _ := cosmos.PayloadFromMap(payload.Payload)

	// For exact-direct, settlement is already complete (client executed transfer)
	return &t402.SettleResponse{
		Success:     true,
		Transaction: cosmosPayload.TxHash,
		Network:     network,
		Payer:       verifyResp.Payer,
	}, nil
}

// isTxUsed checks if a transaction has been used
func (f *ExactDirectCosmosScheme) isTxUsed(txHash string) bool {
	f.usedTxMu.RLock()
	defer f.usedTxMu.RUnlock()
	_, used := f.usedTxs[txHash]
	return used
}

// markTxUsed marks a transaction as used
func (f *ExactDirectCosmosScheme) markTxUsed(txHash string) {
	f.usedTxMu.Lock()
	defer f.usedTxMu.Unlock()
	f.usedTxs[txHash] = time.Now()
}

// cleanupUsedTxs periodically cleans up old used transactions
func (f *ExactDirectCosmosScheme) cleanupUsedTxs() {
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
