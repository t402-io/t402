// Package facilitator implements the facilitator role for TON upto payments.
package facilitator

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"strconv"
	"time"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/ton"
	"github.com/t402-io/t402/sdks/go/mechanisms/ton/upto"
	"github.com/t402-io/t402/sdks/go/types"
)

// UptoTonScheme implements the SchemeNetworkFacilitator interface for TON upto payments
type UptoTonScheme struct {
	signer upto.UptoFacilitatorTonSigner
	config *UptoTonSchemeConfig
}

// UptoTonSchemeConfig contains configuration for the facilitator scheme
type UptoTonSchemeConfig struct {
	// SettleFullAmount if true, settles the full approved amount instead of required amount
	SettleFullAmount bool
}

// NewUptoTonScheme creates a new UptoTonScheme
func NewUptoTonScheme(signer upto.UptoFacilitatorTonSigner, config ...*UptoTonSchemeConfig) *UptoTonScheme {
	var cfg *UptoTonSchemeConfig
	if len(config) > 0 {
		cfg = config[0]
	}
	return &UptoTonScheme{
		signer: signer,
		config: cfg,
	}
}

// Scheme returns the scheme identifier
func (f *UptoTonScheme) Scheme() string {
	return upto.SchemeUpto
}

// CaipFamily returns the CAIP family pattern this facilitator supports
func (f *UptoTonScheme) CaipFamily() string {
	return "ton:*"
}

// GetExtra returns mechanism-specific extra data for the supported kinds endpoint
func (f *UptoTonScheme) GetExtra(network t402.Network) map[string]interface{} {
	config, err := ton.GetNetworkConfig(string(network))
	if err != nil {
		return nil
	}

	addresses := f.signer.GetAddresses(context.Background(), string(network))
	var facilitator string
	if len(addresses) > 0 {
		facilitator = addresses[0]
	}

	return map[string]interface{}{
		"defaultAsset": config.DefaultAsset.MasterAddress,
		"symbol":       config.DefaultAsset.Symbol,
		"decimals":     config.DefaultAsset.Decimals,
		"facilitator":  facilitator,
	}
}

// GetSigners returns signer addresses used by this facilitator
func (f *UptoTonScheme) GetSigners(network t402.Network) []string {
	return f.signer.GetAddresses(context.Background(), string(network))
}

// Verify verifies a upto payment payload against requirements
func (f *UptoTonScheme) Verify(
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
	if !ton.IsValidNetwork(string(network)) {
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

	// Step 4: Validate BOC format
	if err := ton.ValidateBoc(uptoPayload.SignedBoc); err != nil {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_boc_format",
			Payer:         payer,
		}, nil
	}

	// Step 5: Verify facilitator is one of our addresses
	facilitatorAddresses := f.signer.GetAddresses(ctx, string(network))
	validFacilitator := false
	for _, addr := range facilitatorAddresses {
		if ton.AddressesEqual(authorization.Facilitator, addr) {
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

	// Step 6: Verify message structure via signer
	verifyResult, err := f.signer.VerifyMessage(ctx, upto.VerifyMessageParams{
		SignedBoc:    uptoPayload.SignedBoc,
		ExpectedFrom: authorization.From,
		ExpectedTransfer: upto.ExpectedTransfer{
			JettonAmount: authorization.MaxAmount,
			Destination:  authorization.Facilitator,
			JettonMaster: requirements.Asset,
		},
		Network: string(network),
	})
	if err != nil {
		return nil, t402.NewVerifyError("message_verification_failed", payer, network, err)
	}
	if !verifyResult.Valid {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: fmt.Sprintf("message_verification_failed: %s", verifyResult.Reason),
			Payer:         payer,
		}, nil
	}

	// Step 7: Check authorization expiry (with buffer)
	now := time.Now().Unix()
	if authorization.ValidUntil < now+ton.MinValidityBuffer {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "authorization_expired",
			Payer:         payer,
		}, nil
	}

	// Step 8: Verify Jetton balance
	balance, err := f.signer.GetJettonBalance(ctx, upto.GetJettonBalanceParams{
		OwnerAddress:        authorization.From,
		JettonMasterAddress: requirements.Asset,
		Network:             string(network),
	})
	if err != nil {
		return nil, t402.NewVerifyError("balance_check_failed", payer, network, err)
	}

	requiredAmount, err := strconv.ParseUint(requirements.Amount, 10, 64)
	if err != nil {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_required_amount",
			Payer:         payer,
		}, nil
	}

	balanceUint, err := strconv.ParseUint(balance, 10, 64)
	if err != nil {
		return nil, t402.NewVerifyError("invalid_balance_format", payer, network, err)
	}

	if balanceUint < requiredAmount {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "insufficient_jetton_balance",
			Payer:         payer,
		}, nil
	}

	// Step 9: Verify approved amount is sufficient
	maxAmount, ok := new(big.Int).SetString(authorization.MaxAmount, 10)
	if !ok {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_max_amount",
			Payer:         payer,
		}, nil
	}

	requiredBig := new(big.Int).SetUint64(requiredAmount)
	if maxAmount.Cmp(requiredBig) < 0 {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "insufficient_approved_amount",
			Payer:         payer,
		}, nil
	}

	// Step 10: Verify Jetton master matching
	if !ton.AddressesEqual(authorization.JettonMaster, requirements.Asset) {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "asset_mismatch",
			Payer:         payer,
		}, nil
	}

	// Step 11: Verify seqno (replay protection)
	currentSeqno, err := f.signer.GetSeqno(ctx, authorization.From, string(network))
	if err != nil {
		return nil, t402.NewVerifyError("seqno_check_failed", payer, network, err)
	}

	if authorization.Seqno < currentSeqno {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "seqno_already_used",
			Payer:         payer,
		}, nil
	}

	if authorization.Seqno > currentSeqno {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "seqno_too_high",
			Payer:         payer,
		}, nil
	}

	// Step 12: Verify wallet is deployed
	isDeployed, err := f.signer.IsDeployed(ctx, authorization.From, string(network))
	if err != nil {
		return nil, t402.NewVerifyError("deployment_check_failed", payer, network, err)
	}

	if !isDeployed {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "wallet_not_deployed",
			Payer:         payer,
		}, nil
	}

	return &t402.VerifyResponse{
		IsValid: true,
		Payer:   payer,
	}, nil
}

// Settle settles a upto payment
// For TON upto, this involves:
// 1. Broadcasting the client's transfer (receives maxAmount from client to facilitator)
// 2. Sending settleAmount to the merchant (payTo)
// 3. Refunding (maxAmount - settleAmount) back to the client
func (f *UptoTonScheme) Settle(
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

	// Step 1: Broadcast client's transfer to facilitator
	txHash, err := f.signer.SendExternalMessage(ctx, uptoPayload.SignedBoc, string(network))
	if err != nil {
		return nil, t402.NewSettleError("client_transfer_failed", verifyResp.Payer, network, "", err)
	}

	// Wait for client transfer confirmation
	confirmation, err := f.signer.WaitForTransaction(ctx, upto.WaitForTransactionParams{
		Address: authorization.From,
		Seqno:   authorization.Seqno + 1,
		Timeout: 60000,
		Network: string(network),
	})
	if err != nil {
		return nil, t402.NewSettleError("client_transfer_confirmation_failed", verifyResp.Payer, network, txHash, err)
	}

	if !confirmation.Success {
		return &t402.SettleResponse{
			Success:     false,
			ErrorReason: confirmation.Error,
			Transaction: txHash,
			Network:     network,
			Payer:       verifyResp.Payer,
		}, nil
	}

	// Determine settlement amount
	settleAmount := requirements.Amount
	if f.config != nil && f.config.SettleFullAmount {
		settleAmount = authorization.MaxAmount
	}

	// Calculate refund amount
	maxAmountBig, _ := new(big.Int).SetString(authorization.MaxAmount, 10)
	settleAmountBig, _ := new(big.Int).SetString(string(settleAmount), 10)
	refundAmount := new(big.Int).Sub(maxAmountBig, settleAmountBig)

	// Step 2: Transfer settleAmount to payTo
	transferResult, err := f.signer.TransferJetton(ctx, upto.TransferJettonParams{
		JettonMaster:        requirements.Asset,
		Destination:         requirements.PayTo,
		Amount:              string(settleAmount),
		Network:             string(network),
		ResponseDestination: authorization.Facilitator,
		ForwardTonAmount:    "1", // Minimal forward
	})
	if err != nil {
		return nil, t402.NewSettleError("merchant_transfer_failed", verifyResp.Payer, network, txHash, err)
	}

	if !transferResult.Success {
		return &t402.SettleResponse{
			Success:     false,
			ErrorReason: fmt.Sprintf("merchant_transfer_failed: %s", transferResult.Error),
			Transaction: txHash,
			Network:     network,
			Payer:       verifyResp.Payer,
		}, nil
	}

	// Step 3: Refund difference to client (if any)
	if refundAmount.Sign() > 0 {
		refundResult, err := f.signer.TransferJetton(ctx, upto.TransferJettonParams{
			JettonMaster:        requirements.Asset,
			Destination:         authorization.From,
			Amount:              refundAmount.String(),
			Network:             string(network),
			ResponseDestination: authorization.Facilitator,
			ForwardTonAmount:    "1",
		})
		if err != nil {
			// Log refund failure but don't fail the settlement
			// The merchant got paid, refund can be retried later
			_ = refundResult
		}
	}

	// Return merchant transfer as the final transaction
	finalTxHash := transferResult.TxHash
	if finalTxHash == "" {
		finalTxHash = txHash
	}

	return &t402.SettleResponse{
		Success:     true,
		Transaction: finalTxHash,
		Network:     network,
		Payer:       verifyResp.Payer,
	}, nil
}
