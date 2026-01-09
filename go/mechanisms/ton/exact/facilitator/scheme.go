package facilitator

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	t402 "github.com/awesome-doge/t402/go"
	"github.com/awesome-doge/t402/go/mechanisms/ton"
	"github.com/awesome-doge/t402/go/types"
)

// ExactTonScheme implements the SchemeNetworkFacilitator interface for TON exact payments (V2)
type ExactTonScheme struct {
	signer ton.FacilitatorTonSigner
}

// NewExactTonScheme creates a new ExactTonScheme
func NewExactTonScheme(signer ton.FacilitatorTonSigner) *ExactTonScheme {
	return &ExactTonScheme{
		signer: signer,
	}
}

// Scheme returns the scheme identifier
func (f *ExactTonScheme) Scheme() string {
	return ton.SchemeExact
}

// CaipFamily returns the CAIP family pattern this facilitator supports
func (f *ExactTonScheme) CaipFamily() string {
	return "ton:*"
}

// GetExtra returns mechanism-specific extra data for the supported kinds endpoint.
// For TON, this includes asset metadata.
func (f *ExactTonScheme) GetExtra(network t402.Network) map[string]interface{} {
	config, err := ton.GetNetworkConfig(string(network))
	if err != nil {
		return nil
	}

	return map[string]interface{}{
		"defaultAsset": config.DefaultAsset.MasterAddress,
		"symbol":       config.DefaultAsset.Symbol,
		"decimals":     config.DefaultAsset.Decimals,
	}
}

// GetSigners returns signer addresses used by this facilitator.
// For TON, returns all available wallet addresses for the given network.
func (f *ExactTonScheme) GetSigners(network t402.Network) []string {
	return f.signer.GetAddresses(context.Background(), string(network))
}

// Verify verifies a V2 payment payload against requirements
func (f *ExactTonScheme) Verify(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.VerifyResponse, error) {
	network := t402.Network(requirements.Network)

	// Step 1: Validate scheme
	if payload.Accepted.Scheme != ton.SchemeExact || requirements.Scheme != ton.SchemeExact {
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
	tonPayload, err := ton.PayloadFromMap(payload.Payload)
	if err != nil {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_payload",
		}, nil
	}

	authorization := tonPayload.Authorization
	payer := authorization.From

	// Step 4: Validate BOC format
	if err := ton.ValidateBoc(tonPayload.SignedBoc); err != nil {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_boc_format",
			Payer:         payer,
		}, nil
	}

	// Step 5: Verify message structure via signer
	verifyResult, err := f.signer.VerifyMessage(ctx, ton.VerifyMessageParams{
		SignedBoc:    tonPayload.SignedBoc,
		ExpectedFrom: authorization.From,
		ExpectedTransfer: ton.ExpectedTransfer{
			JettonAmount: authorization.JettonAmount,
			Destination:  requirements.PayTo,
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

	// Step 6: Check authorization expiry (with 30-second buffer)
	now := time.Now().Unix()
	if authorization.ValidUntil < now+ton.MinValidityBuffer {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "authorization_expired",
			Payer:         payer,
		}, nil
	}

	// Step 7: Verify Jetton balance
	balance, err := f.signer.GetJettonBalance(ctx, ton.GetJettonBalanceParams{
		OwnerAddress:       authorization.From,
		JettonMasterAddress: requirements.Asset,
		Network:            string(network),
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

	// Step 8: Verify amount sufficiency
	payloadAmount, err := strconv.ParseUint(authorization.JettonAmount, 10, 64)
	if err != nil {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_payload_amount",
			Payer:         payer,
		}, nil
	}

	if payloadAmount < requiredAmount {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "insufficient_amount",
			Payer:         payer,
		}, nil
	}

	// Step 9: Verify recipient matching
	if !ton.AddressesEqual(authorization.To, requirements.PayTo) {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "recipient_mismatch",
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

// Settle settles a payment by broadcasting the signed message (V2)
func (f *ExactTonScheme) Settle(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.SettleResponse, error) {
	network := t402.Network(requirements.Network)

	// First verify the payment
	verifyResp, err := f.Verify(ctx, payload, requirements)
	if err != nil {
		// Convert VerifyError to SettleError
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
			Transaction: "",
			ErrorReason: verifyResp.InvalidReason,
			Payer:       verifyResp.Payer,
		}, nil
	}

	// Parse payload
	tonPayload, err := ton.PayloadFromMap(payload.Payload)
	if err != nil {
		return nil, t402.NewSettleError("invalid_payload", verifyResp.Payer, network, "", err)
	}

	authorization := tonPayload.Authorization

	// Send the pre-signed external message to network
	txHash, err := f.signer.SendExternalMessage(ctx, tonPayload.SignedBoc, string(network))
	if err != nil {
		return nil, t402.NewSettleError("transaction_failed", verifyResp.Payer, network, "", err)
	}

	// Wait for confirmation (monitor seqno increase)
	confirmation, err := f.signer.WaitForTransaction(ctx, ton.WaitForTransactionParams{
		Address: authorization.From,
		Seqno:   authorization.Seqno + 1, // Wait for next seqno
		Timeout: 60000,                   // 60 seconds
		Network: string(network),
	})
	if err != nil {
		return nil, t402.NewSettleError("transaction_confirmation_failed", verifyResp.Payer, network, txHash, err)
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

	finalTxHash := txHash
	if confirmation.Hash != "" {
		finalTxHash = confirmation.Hash
	}

	return &t402.SettleResponse{
		Success:     true,
		Transaction: finalTxHash,
		Network:     network,
		Payer:       verifyResp.Payer,
	}, nil
}
