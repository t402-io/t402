// Package facilitator implements the facilitator role for NEAR upto payments.
package facilitator

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"sync"
	"time"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/near"
	"github.com/t402-io/t402/sdks/go/mechanisms/near/upto"
	"github.com/t402-io/t402/sdks/go/types"
)

// UptoNearScheme implements the SchemeNetworkFacilitator interface for NEAR upto payments
type UptoNearScheme struct {
	signer upto.UptoFacilitatorNearSigner
	config *UptoNearSchemeConfig

	// Used transaction cache for replay protection
	usedTxMu sync.RWMutex
	usedTxs  map[string]time.Time
}

// UptoNearSchemeConfig contains configuration for the facilitator scheme
type UptoNearSchemeConfig struct {
	// SettleFullAmount if true, settles the full approved amount instead of required amount
	SettleFullAmount bool

	// MaxTransactionAge is the maximum age of a transaction to accept
	MaxTransactionAge time.Duration

	// UsedTxCacheDuration is how long to cache used transaction hashes
	UsedTxCacheDuration time.Duration
}

// NewUptoNearScheme creates a new UptoNearScheme
func NewUptoNearScheme(signer upto.UptoFacilitatorNearSigner, config ...*UptoNearSchemeConfig) *UptoNearScheme {
	cfg := &UptoNearSchemeConfig{
		MaxTransactionAge:   5 * time.Minute,
		UsedTxCacheDuration: 24 * time.Hour,
	}
	if len(config) > 0 && config[0] != nil {
		if config[0].MaxTransactionAge > 0 {
			cfg.MaxTransactionAge = config[0].MaxTransactionAge
		}
		if config[0].UsedTxCacheDuration > 0 {
			cfg.UsedTxCacheDuration = config[0].UsedTxCacheDuration
		}
		cfg.SettleFullAmount = config[0].SettleFullAmount
	}

	scheme := &UptoNearScheme{
		signer:  signer,
		config:  cfg,
		usedTxs: make(map[string]time.Time),
	}

	// Start cleanup goroutine
	go scheme.cleanupUsedTxs()

	return scheme
}

// Scheme returns the scheme identifier
func (f *UptoNearScheme) Scheme() string {
	return upto.SchemeUpto
}

// CaipFamily returns the CAIP family pattern this facilitator supports
func (f *UptoNearScheme) CaipFamily() string {
	return "near:*"
}

// GetExtra returns mechanism-specific extra data for the supported kinds endpoint
func (f *UptoNearScheme) GetExtra(network t402.Network) map[string]interface{} {
	config, ok := near.GetNetworkConfig(string(network))
	if !ok {
		return nil
	}

	addresses := f.signer.GetAddresses(context.Background(), string(network))
	var facilitator string
	if len(addresses) > 0 {
		facilitator = addresses[0]
	}

	return map[string]interface{}{
		"assetSymbol":   config.DefaultToken.Symbol,
		"assetDecimals": config.DefaultToken.Decimals,
		"facilitator":   facilitator,
	}
}

// GetSigners returns signer addresses used by this facilitator
func (f *UptoNearScheme) GetSigners(network t402.Network) []string {
	return f.signer.GetAddresses(context.Background(), string(network))
}

// Verify verifies a upto payment payload against requirements
func (f *UptoNearScheme) Verify(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.VerifyResponse, error) {
	network := t402.Network(requirements.Network)

	// Step 1: Validate scheme
	if payload.Accepted.Scheme != upto.SchemeUpto || requirements.Scheme != upto.SchemeUpto {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "unsupported_scheme",
		}, nil
	}

	// Step 2: Validate network matching
	if string(payload.Accepted.Network) != string(requirements.Network) {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "network_mismatch",
		}, nil
	}

	// Validate network is supported
	_, ok := near.GetNetworkConfig(string(network))
	if !ok {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "unsupported_network",
		}, nil
	}

	// Step 3: Parse payload
	uptoPayload, err := upto.UptoPayloadFromMap(payload.Payload)
	if err != nil {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_payload",
		}, nil
	}

	authorization := uptoPayload.Authorization
	payer := authorization.From

	// Step 4: Check for replay attack
	if f.isTxUsed(uptoPayload.TxHash) {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "transaction_already_used",
			Payer:         payer,
		}, nil
	}

	// Step 5: Verify facilitator is one of our addresses
	facilitatorAddresses := f.signer.GetAddresses(ctx, string(network))
	validFacilitator := false
	for _, addr := range facilitatorAddresses {
		if authorization.Facilitator == addr {
			validFacilitator = true
			break
		}
	}
	if !validFacilitator {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_facilitator",
			Payer:         payer,
		}, nil
	}

	// Step 6: Query transaction
	tx, err := f.signer.QueryTransaction(ctx, uptoPayload.TxHash, authorization.From)
	if err != nil {
		return nil, t402.NewVerifyError("transaction_not_found", payer, network, err)
	}

	// Step 7: Verify transaction succeeded
	if !tx.Status.IsSuccess() {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "transaction_failed",
			Payer:         payer,
		}, nil
	}

	// Step 8: Verify the transaction was to the token contract
	if tx.Transaction.ReceiverID != requirements.Asset {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "wrong_token_contract",
			Payer:         payer,
		}, nil
	}

	// Step 9: Find and verify ft_transfer action
	var ftTransferArgs *upto.FtTransferArgs
	for _, action := range tx.Transaction.Actions {
		if action.FunctionCall != nil && action.FunctionCall.MethodName == near.FunctionFtTransfer {
			// Decode args (base64 encoded JSON)
			argsBytes, err := base64.StdEncoding.DecodeString(string(action.FunctionCall.Args))
			if err != nil {
				// Try raw JSON
				argsBytes = action.FunctionCall.Args
			}

			var args upto.FtTransferArgs
			if err := json.Unmarshal(argsBytes, &args); err != nil {
				continue
			}
			ftTransferArgs = &args
			break
		}
	}

	if ftTransferArgs == nil {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "no_ft_transfer_action",
			Payer:         payer,
		}, nil
	}

	// Step 10: Verify recipient is facilitator
	if ftTransferArgs.ReceiverID != authorization.Facilitator {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "wrong_recipient",
			Payer:         payer,
		}, nil
	}

	// Step 11: Verify amount matches maxAmount in authorization
	if ftTransferArgs.Amount != authorization.MaxAmount {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "amount_mismatch",
			Payer:         payer,
		}, nil
	}

	// Step 12: Verify approved amount is sufficient
	maxAmount, ok := new(big.Int).SetString(authorization.MaxAmount, 10)
	if !ok {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_max_amount",
			Payer:         payer,
		}, nil
	}

	requiredAmount, ok := new(big.Int).SetString(requirements.Amount, 10)
	if !ok {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_required_amount",
			Payer:         payer,
		}, nil
	}

	if maxAmount.Cmp(requiredAmount) < 0 {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "insufficient_amount",
			Payer:         payer,
		}, nil
	}

	// Step 13: Verify token contract matches
	if authorization.TokenContract != requirements.Asset {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "asset_mismatch",
			Payer:         payer,
		}, nil
	}

	return &t402.VerifyResponse{
		IsValid: true,
		Payer:   payer,
	}, nil
}

// Settle settles a upto payment
// For NEAR upto, this involves:
// 1. Verifying the client's transfer to facilitator (already done)
// 2. Sending settleAmount to the merchant (payTo)
// 3. Refunding (maxAmount - settleAmount) back to the client
func (f *UptoNearScheme) Settle(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.SettleResponse, error) {
	network := t402.Network(requirements.Network)

	// First verify the payment
	verifyResp, err := f.Verify(ctx, payload, requirements)
	if err != nil {
		ve := &t402.VerifyError{}
		if errors.As(err, &ve) {
			return nil, t402.NewSettleError(ve.Reason, ve.Payer, ve.Network, "", ve.Err)
		}
		return nil, t402.NewSettleError("verification_failed", "", network, "", err)
	}

	if !verifyResp.IsValid {
		return &t402.SettleResponse{
			Success:     false,
			Network:     network,
			ErrorReason: verifyResp.InvalidReason,
			Payer:       verifyResp.Payer,
		}, nil
	}

	// Parse payload
	uptoPayload, err := upto.UptoPayloadFromMap(payload.Payload)
	if err != nil {
		return nil, t402.NewSettleError("invalid_payload", verifyResp.Payer, network, "", err)
	}

	authorization := uptoPayload.Authorization

	// Mark transaction as used (before settlement to prevent double-spend)
	f.markTxUsed(uptoPayload.TxHash)

	// Determine settlement amount
	settleAmount := requirements.Amount
	if f.config != nil && f.config.SettleFullAmount {
		settleAmount = authorization.MaxAmount
	}

	// Calculate refund amount
	maxAmountBig, _ := new(big.Int).SetString(authorization.MaxAmount, 10)
	settleAmountBig, _ := new(big.Int).SetString(string(settleAmount), 10)
	refundAmount := new(big.Int).Sub(maxAmountBig, settleAmountBig)

	// Step 1: Transfer settleAmount to payTo
	merchantTxHash, err := f.signer.FtTransfer(ctx, upto.FtTransferParams{
		TokenContract: requirements.Asset,
		ReceiverID:    requirements.PayTo,
		Amount:        string(settleAmount),
		Memo:          fmt.Sprintf("t402-settle:%s", uptoPayload.PaymentNonce),
	})
	if err != nil {
		return nil, t402.NewSettleError("merchant_transfer_failed", verifyResp.Payer, network, uptoPayload.TxHash, err)
	}

	// Wait for merchant transfer confirmation
	if err := f.signer.WaitForTransaction(ctx, merchantTxHash, authorization.Facilitator); err != nil {
		return nil, t402.NewSettleError("merchant_transfer_confirmation_failed", verifyResp.Payer, network, merchantTxHash, err)
	}

	// Step 2: Refund difference to client (if any)
	if refundAmount.Sign() > 0 {
		_, err := f.signer.FtTransfer(ctx, upto.FtTransferParams{
			TokenContract: requirements.Asset,
			ReceiverID:    authorization.From,
			Amount:        refundAmount.String(),
			Memo:          fmt.Sprintf("t402-refund:%s", uptoPayload.PaymentNonce),
		})
		if err != nil {
			// Log refund failure but don't fail the settlement
			// The merchant got paid, refund can be retried later
			_ = err
		}
	}

	return &t402.SettleResponse{
		Success:     true,
		Transaction: merchantTxHash,
		Network:     network,
		Payer:       verifyResp.Payer,
	}, nil
}

// isTxUsed checks if a transaction has been used
func (f *UptoNearScheme) isTxUsed(txHash string) bool {
	f.usedTxMu.RLock()
	defer f.usedTxMu.RUnlock()
	_, used := f.usedTxs[txHash]
	return used
}

// markTxUsed marks a transaction as used
func (f *UptoNearScheme) markTxUsed(txHash string) {
	f.usedTxMu.Lock()
	defer f.usedTxMu.Unlock()
	f.usedTxs[txHash] = time.Now()
}

// cleanupUsedTxs periodically cleans up old used transactions
func (f *UptoNearScheme) cleanupUsedTxs() {
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
