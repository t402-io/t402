package facilitator

import (
	"context"
	"fmt"
	"math/big"
	"sync"
	"time"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/stacks"
	"github.com/t402-io/t402/sdks/go/types"
)

// ExactDirectStacksSchemeConfig holds configuration for the facilitator
type ExactDirectStacksSchemeConfig struct {
	// MaxTransactionAge is the maximum age of a transaction to accept (in seconds)
	// Default: 3600 (1 hour)
	MaxTransactionAge int64

	// UsedTxCacheDuration is how long to cache used transaction IDs
	// Default: 24 hours
	UsedTxCacheDuration time.Duration
}

// ExactDirectStacksScheme implements the SchemeNetworkFacilitator for Stacks
type ExactDirectStacksScheme struct {
	signer stacks.FacilitatorStacksSigner
	config ExactDirectStacksSchemeConfig

	// Used transaction cache for replay protection
	usedTxMu sync.RWMutex
	usedTxs  map[string]time.Time
}

// NewExactDirectStacksScheme creates a new ExactDirectStacksScheme
func NewExactDirectStacksScheme(signer stacks.FacilitatorStacksSigner, config *ExactDirectStacksSchemeConfig) *ExactDirectStacksScheme {
	cfg := ExactDirectStacksSchemeConfig{
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

	scheme := &ExactDirectStacksScheme{
		signer:  signer,
		config:  cfg,
		usedTxs: make(map[string]time.Time),
	}

	// Start cleanup goroutine
	go scheme.cleanupUsedTransactions()

	return scheme
}

// Scheme returns the scheme identifier
func (f *ExactDirectStacksScheme) Scheme() string {
	return stacks.SchemeExactDirect
}

// CaipFamily returns the CAIP family pattern
func (f *ExactDirectStacksScheme) CaipFamily() string {
	return "stacks:*"
}

// GetExtra returns mechanism-specific extra data
func (f *ExactDirectStacksScheme) GetExtra(network t402.Network) map[string]interface{} {
	config, err := stacks.GetNetworkConfig(string(network))
	if err != nil {
		return nil
	}

	return map[string]interface{}{
		"contractAddress": config.DefaultToken.ContractAddress,
		"assetSymbol":     config.DefaultToken.Symbol,
		"assetDecimals":   config.DefaultToken.Decimals,
		"networkName":     config.Name,
	}
}

// GetSigners returns signer addresses
func (f *ExactDirectStacksScheme) GetSigners(network t402.Network) []string {
	return f.signer.GetAddresses(string(network))
}

// Verify verifies a payment payload
func (f *ExactDirectStacksScheme) Verify(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.VerifyResponse, error) {
	network := t402.Network(requirements.Network)

	// Validate scheme
	if payload.Accepted.Scheme != stacks.SchemeExactDirect {
		return nil, t402.NewVerifyError("invalid_scheme", "", network, nil)
	}

	// Validate network
	if payload.Accepted.Network != requirements.Network {
		return nil, t402.NewVerifyError("network_mismatch", "", network, nil)
	}

	// Parse payload
	stacksPayload, err := stacks.PayloadFromMap(payload.Payload)
	if err != nil {
		return nil, t402.NewVerifyError("invalid_payload", "", network, err)
	}

	// Validate required fields
	if stacksPayload.TxId == "" {
		return nil, t402.NewVerifyError("missing_tx_id", "", network, nil)
	}

	// Validate tx ID format
	if !stacks.IsValidTxId(stacksPayload.TxId) {
		return nil, t402.NewVerifyError("invalid_tx_id_format", "", network, nil)
	}

	if stacksPayload.From == "" {
		return nil, t402.NewVerifyError("missing_from", "", network, nil)
	}

	// Check for replay attack
	if f.isTxUsed(stacksPayload.TxId) {
		return nil, t402.NewVerifyError("tx_already_used", stacksPayload.From, network, nil)
	}

	// Query transaction
	result, err := f.signer.QueryTransaction(ctx, stacksPayload.TxId)
	if err != nil {
		return nil, t402.NewVerifyError("tx_not_found", stacksPayload.From, network, err)
	}

	// Verify transaction was successful
	if result.TxStatus != "success" {
		return nil, t402.NewVerifyError("tx_not_successful", stacksPayload.From, network,
			fmt.Errorf("tx_status: %s", result.TxStatus))
	}

	// Verify transaction type
	if result.TxType != "contract_call" {
		return nil, t402.NewVerifyError("not_contract_call", stacksPayload.From, network,
			fmt.Errorf("tx_type: %s", result.TxType))
	}

	// Check transaction age
	if f.config.MaxTransactionAge > 0 && result.BurnBlockTime > 0 {
		txTime := time.Unix(result.BurnBlockTime, 0)
		age := time.Since(txTime).Seconds()
		if int64(age) > f.config.MaxTransactionAge {
			return nil, t402.NewVerifyError("tx_too_old", stacksPayload.From, network,
				fmt.Errorf("age: %.0f seconds", age))
		}
	}

	// Extract transfer details
	transfer := stacks.ExtractTransfer(result)
	if transfer == nil {
		return nil, t402.NewVerifyError("not_token_transfer", stacksPayload.From, network, nil)
	}

	// Verify contract address
	expectedContract := stacksPayload.ContractAddress
	if extra, ok := requirements.Extra["contractAddress"]; ok {
		if contractStr, ok := extra.(string); ok && contractStr != "" {
			expectedContract = contractStr
		}
	}
	if expectedContract != "" && transfer.ContractAddress != expectedContract {
		return nil, t402.NewVerifyError("contract_mismatch", stacksPayload.From, network,
			fmt.Errorf("expected %s, got %s", expectedContract, transfer.ContractAddress))
	}

	// Verify recipient
	if !stacks.CompareAddresses(transfer.To, requirements.PayTo) {
		return nil, t402.NewVerifyError("recipient_mismatch", stacksPayload.From, network,
			fmt.Errorf("expected %s, got %s", requirements.PayTo, transfer.To))
	}

	// Verify amount
	txAmount, ok := new(big.Int).SetString(transfer.Amount, 10)
	if !ok {
		return nil, t402.NewVerifyError("invalid_tx_amount", stacksPayload.From, network, nil)
	}

	requiredAmount, ok := new(big.Int).SetString(requirements.Amount, 10)
	if !ok {
		return nil, t402.NewVerifyError("invalid_required_amount", stacksPayload.From, network, nil)
	}

	if txAmount.Cmp(requiredAmount) < 0 {
		return nil, t402.NewVerifyError("insufficient_amount", stacksPayload.From, network,
			fmt.Errorf("expected %s, got %s", requirements.Amount, transfer.Amount))
	}

	// Mark transaction as used
	f.markTxUsed(stacksPayload.TxId)

	return &t402.VerifyResponse{
		IsValid: true,
		Payer:   stacksPayload.From,
	}, nil
}

// Settle settles a payment - for exact-direct, the transfer is already complete
func (f *ExactDirectStacksScheme) Settle(
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

	// Parse payload for tx ID
	stacksPayload, _ := stacks.PayloadFromMap(payload.Payload)

	// For exact-direct, settlement is already complete
	return &t402.SettleResponse{
		Success:     true,
		Transaction: stacksPayload.TxId,
		Network:     network,
		Payer:       verifyResp.Payer,
	}, nil
}

// isTxUsed checks if a transaction has been used
func (f *ExactDirectStacksScheme) isTxUsed(txId string) bool {
	f.usedTxMu.RLock()
	defer f.usedTxMu.RUnlock()
	_, used := f.usedTxs[txId]
	return used
}

// markTxUsed marks a transaction as used
func (f *ExactDirectStacksScheme) markTxUsed(txId string) {
	f.usedTxMu.Lock()
	defer f.usedTxMu.Unlock()
	f.usedTxs[txId] = time.Now()
}

// cleanupUsedTransactions periodically cleans up old used transactions
func (f *ExactDirectStacksScheme) cleanupUsedTransactions() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for range ticker.C {
		f.usedTxMu.Lock()
		cutoff := time.Now().Add(-f.config.UsedTxCacheDuration)
		for txId, usedAt := range f.usedTxs {
			if usedAt.Before(cutoff) {
				delete(f.usedTxs, txId)
			}
		}
		f.usedTxMu.Unlock()
	}
}
