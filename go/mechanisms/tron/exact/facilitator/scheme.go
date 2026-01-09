package facilitator

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	t402 "github.com/t402-io/t402/go"
	"github.com/t402-io/t402/go/mechanisms/tron"
	"github.com/t402-io/t402/go/types"
)

// ExactTronScheme implements the SchemeNetworkFacilitator interface for TRON exact payments
type ExactTronScheme struct {
	signer tron.FacilitatorTronSigner
	config *ExactTronSchemeConfig
}

// ExactTronSchemeConfig contains configuration for the facilitator scheme
type ExactTronSchemeConfig struct {
	// CanSponsorGas indicates if this facilitator can sponsor gas for transactions
	CanSponsorGas bool
}

// NewExactTronScheme creates a new ExactTronScheme
func NewExactTronScheme(signer tron.FacilitatorTronSigner, config ...*ExactTronSchemeConfig) *ExactTronScheme {
	var cfg *ExactTronSchemeConfig
	if len(config) > 0 {
		cfg = config[0]
	}
	return &ExactTronScheme{
		signer: signer,
		config: cfg,
	}
}

// Scheme returns the scheme identifier
func (f *ExactTronScheme) Scheme() string {
	return tron.SchemeExact
}

// CaipFamily returns the CAIP family pattern this facilitator supports
func (f *ExactTronScheme) CaipFamily() string {
	return "tron:*"
}

// GetExtra returns extra data for the supported kinds endpoint
func (f *ExactTronScheme) GetExtra(network t402.Network) map[string]interface{} {
	config, err := tron.GetNetworkConfig(string(network))
	if err != nil {
		return nil
	}

	result := map[string]interface{}{
		"defaultAsset": config.DefaultAsset.ContractAddress,
		"symbol":       config.DefaultAsset.Symbol,
		"decimals":     config.DefaultAsset.Decimals,
	}

	if f.config != nil && f.config.CanSponsorGas {
		addresses := f.signer.GetAddresses(context.Background(), string(network))
		if len(addresses) > 0 {
			result["gasSponsor"] = addresses[0]
		}
	}

	return result
}

// GetSigners returns the facilitator addresses
func (f *ExactTronScheme) GetSigners(network t402.Network) []string {
	return f.signer.GetAddresses(context.Background(), string(network))
}

// Verify verifies a V2 payment payload against requirements
func (f *ExactTronScheme) Verify(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.VerifyResponse, error) {
	network := t402.Network(requirements.Network)

	// Step 1: Validate scheme
	if payload.Accepted.Scheme != tron.SchemeExact || requirements.Scheme != tron.SchemeExact {
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
	if !tron.IsValidNetwork(string(network)) {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "unsupported_network",
		}, nil
	}

	// Step 3: Parse payload
	tronPayload, err := tron.PayloadFromMap(payload.Payload)
	if err != nil {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_payload",
		}, nil
	}

	authorization := tronPayload.Authorization
	payer := authorization.From

	// Step 4: Validate addresses
	if !tron.ValidateTronAddress(authorization.From) {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_sender_address",
			Payer:         payer,
		}, nil
	}
	if !tron.ValidateTronAddress(authorization.To) {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_recipient_address",
			Payer:         payer,
		}, nil
	}
	if !tron.ValidateTronAddress(authorization.ContractAddress) {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_contract_address",
			Payer:         payer,
		}, nil
	}

	// Step 5: Verify transaction signature via signer
	verifyResult, err := f.signer.VerifyTransaction(ctx, tron.VerifyTransactionParams{
		SignedTransaction: tronPayload.SignedTransaction,
		ExpectedFrom:      authorization.From,
		ExpectedTransfer: tron.ExpectedTransfer{
			To:              requirements.PayTo,
			ContractAddress: requirements.Asset,
			Amount:          authorization.Amount,
		},
		Network: string(network),
	})
	if err != nil {
		return nil, t402.NewVerifyError("transaction_verification_failed", payer, network, err)
	}
	if !verifyResult.Valid {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: fmt.Sprintf("transaction_verification_failed: %s", verifyResult.Reason),
			Payer:         payer,
		}, nil
	}

	// Step 6: Check authorization expiry (with 30-second buffer)
	now := time.Now().UnixMilli()
	expirationWithBuffer := authorization.Expiration - int64(tron.MinValidityBuffer*1000)
	if now >= expirationWithBuffer {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "authorization_expired",
			Payer:         payer,
		}, nil
	}

	// Step 7: Verify TRC20 balance
	balance, err := f.signer.GetBalance(ctx, tron.GetBalanceParams{
		OwnerAddress:    authorization.From,
		ContractAddress: requirements.Asset,
		Network:         string(network),
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
			InvalidReason: "insufficient_balance",
			Payer:         payer,
		}, nil
	}

	// Step 8: Verify amount sufficiency
	payloadAmount, err := strconv.ParseUint(authorization.Amount, 10, 64)
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
	if !tron.AddressesEqual(authorization.To, requirements.PayTo) {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "recipient_mismatch",
			Payer:         payer,
		}, nil
	}

	// Step 10: Verify contract address matching
	if !tron.AddressesEqual(authorization.ContractAddress, requirements.Asset) {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "asset_mismatch",
			Payer:         payer,
		}, nil
	}

	// Step 11: Verify account is activated
	isActivated, err := f.signer.IsActivated(ctx, authorization.From, string(network))
	if err != nil {
		return nil, t402.NewVerifyError("activation_check_failed", payer, network, err)
	}

	if !isActivated {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "account_not_activated",
			Payer:         payer,
		}, nil
	}

	return &t402.VerifyResponse{
		IsValid: true,
		Payer:   payer,
	}, nil
}

// Settle settles a payment by broadcasting the signed transaction
func (f *ExactTronScheme) Settle(
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
	tronPayload, err := tron.PayloadFromMap(payload.Payload)
	if err != nil {
		return nil, t402.NewSettleError("invalid_payload", verifyResp.Payer, network, "", err)
	}

	// Broadcast the transaction
	txId, err := f.signer.BroadcastTransaction(ctx, tronPayload.SignedTransaction, string(network))
	if err != nil {
		return nil, t402.NewSettleError("broadcast_failed", verifyResp.Payer, network, "", err)
	}

	// Wait for confirmation
	confirmation, err := f.signer.WaitForTransaction(ctx, tron.WaitForTransactionParams{
		TxId:    txId,
		Network: string(network),
		Timeout: 60000, // 60 seconds
	})
	if err != nil {
		return nil, t402.NewSettleError("confirmation_failed", verifyResp.Payer, network, txId, err)
	}

	if !confirmation.Success {
		return &t402.SettleResponse{
			Success:     false,
			ErrorReason: confirmation.Error,
			Transaction: txId,
			Network:     network,
			Payer:       verifyResp.Payer,
		}, nil
	}

	finalTxId := txId
	if confirmation.TxId != "" {
		finalTxId = confirmation.TxId
	}

	return &t402.SettleResponse{
		Success:     true,
		Transaction: finalTxId,
		Network:     network,
		Payer:       verifyResp.Payer,
	}, nil
}
