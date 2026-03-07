package facilitator

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/stellar"
	"github.com/t402-io/t402/sdks/go/types"
)

// ExactStellarScheme implements the SchemeNetworkFacilitator interface for Stellar exact payments (V2)
type ExactStellarScheme struct {
	signer stellar.FacilitatorStellarSigner
}

// NewExactStellarScheme creates a new ExactStellarScheme
func NewExactStellarScheme(signer stellar.FacilitatorStellarSigner) *ExactStellarScheme {
	return &ExactStellarScheme{
		signer: signer,
	}
}

// Scheme returns the scheme identifier
func (f *ExactStellarScheme) Scheme() string {
	return stellar.SchemeExact
}

// CaipFamily returns the CAIP family pattern this facilitator supports
func (f *ExactStellarScheme) CaipFamily() string {
	return "stellar:*"
}

// GetExtra returns mechanism-specific extra data for the supported kinds endpoint.
// For Stellar, this includes asset metadata.
func (f *ExactStellarScheme) GetExtra(network t402.Network) map[string]interface{} {
	config, err := stellar.GetNetworkConfig(string(network))
	if err != nil {
		return nil
	}

	return map[string]interface{}{
		"defaultAsset": config.DefaultAsset.ContractAddress,
		"symbol":       config.DefaultAsset.Symbol,
		"decimals":     config.DefaultAsset.Decimals,
	}
}

// GetSigners returns signer addresses used by this facilitator.
// For Stellar, returns all available G-account addresses for the given network.
func (f *ExactStellarScheme) GetSigners(network t402.Network) []string {
	return f.signer.GetAddresses(context.Background(), string(network))
}

// Verify verifies a V2 payment payload against requirements
func (f *ExactStellarScheme) Verify(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.VerifyResponse, error) {
	network := t402.Network(requirements.Network)

	// Step 1: Validate scheme
	if payload.Accepted.Scheme != stellar.SchemeExact || requirements.Scheme != stellar.SchemeExact {
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
	if !stellar.IsValidNetwork(string(network)) {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "unsupported_network",
		}, nil
	}

	// Step 3: Parse payload
	stellarPayload, err := stellar.PayloadFromMap(payload.Payload)
	if err != nil {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_payload",
		}, nil
	}

	authorization := stellarPayload.Authorization
	payer := authorization.From

	// Step 4: Validate XDR format
	if err := stellar.ValidateXDR(stellarPayload.SignedXDR); err != nil {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_xdr_format",
			Payer:         payer,
		}, nil
	}

	// Step 5: Verify transaction structure via signer
	verifyResult, err := f.signer.VerifyTransaction(ctx, stellar.VerifyTransactionParams{
		SignedXDR:    stellarPayload.SignedXDR,
		ExpectedFrom: authorization.From,
		ExpectedTransfer: stellar.ExpectedTransfer{
			Amount:        authorization.Amount,
			Destination:   requirements.PayTo,
			TokenContract: requirements.Asset,
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

	// Step 6: Check ledger expiry
	currentLedger, err := f.signer.GetCurrentLedger(ctx, string(network))
	if err != nil {
		return nil, t402.NewVerifyError("ledger_check_failed", payer, network, err)
	}

	if authorization.MaxLedger <= currentLedger {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "transaction_expired",
			Payer:         payer,
		}, nil
	}

	// Step 7: Verify token balance
	balance, err := f.signer.GetTokenBalance(ctx, stellar.GetTokenBalanceParams{
		OwnerAddress:  authorization.From,
		TokenContract: requirements.Asset,
		Network:       string(network),
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
			InvalidReason: "insufficient_token_balance",
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
	if !stellar.AddressesEqual(authorization.To, requirements.PayTo) {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "recipient_mismatch",
			Payer:         payer,
		}, nil
	}

	// Step 10: Verify token contract matching
	if !stellar.AddressesEqual(authorization.TokenContract, requirements.Asset) {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "asset_mismatch",
			Payer:         payer,
		}, nil
	}

	// Step 11: Verify account exists (is funded)
	exists, err := f.signer.AccountExists(ctx, authorization.From, string(network))
	if err != nil {
		return nil, t402.NewVerifyError("account_check_failed", payer, network, err)
	}

	if !exists {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "account_not_found",
			Payer:         payer,
		}, nil
	}

	return &t402.VerifyResponse{
		IsValid: true,
		Payer:   payer,
	}, nil
}

// Settle settles a payment by submitting the signed transaction (V2)
func (f *ExactStellarScheme) Settle(
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
			Transaction: "",
			ErrorReason: verifyResp.InvalidReason,
			Payer:       verifyResp.Payer,
		}, nil
	}

	// Parse payload
	stellarPayload, err := stellar.PayloadFromMap(payload.Payload)
	if err != nil {
		return nil, t402.NewSettleError("invalid_payload", verifyResp.Payer, network, "", err)
	}

	// Submit the signed transaction to network
	txHash, err := f.signer.SubmitTransaction(ctx, stellarPayload.SignedXDR, string(network))
	if err != nil {
		return nil, t402.NewSettleError("transaction_failed", verifyResp.Payer, network, "", err)
	}

	// Wait for confirmation
	confirmation, err := f.signer.WaitForTransaction(ctx, stellar.WaitForTransactionParams{
		TxHash:  txHash,
		Timeout: 60000, // 60 seconds
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

	// Post-confirmation failure detection
	if checker, ok := f.signer.(stellar.TransactionStatusChecker); ok && finalTxHash != "" {
		status, err := checker.GetTransactionStatus(ctx, finalTxHash, string(network))
		if err == nil && status == stellar.TransactionStatusFailed {
			return &t402.SettleResponse{
				Success:     false,
				ErrorReason: "token_transfer_failed",
				Transaction: finalTxHash,
				Network:     network,
				Payer:       verifyResp.Payer,
			}, nil
		}
	}

	return &t402.SettleResponse{
		Success:     true,
		Transaction: finalTxHash,
		Network:     network,
		Payer:       verifyResp.Payer,
	}, nil
}
