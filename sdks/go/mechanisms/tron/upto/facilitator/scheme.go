// Package facilitator implements the facilitator role for TRON upto payments.
package facilitator

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"strconv"
	"time"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/tron"
	"github.com/t402-io/t402/sdks/go/mechanisms/tron/upto"
	"github.com/t402-io/t402/sdks/go/types"
)

// MinValidityBuffer is the minimum seconds before expiration for validity
const MinValidityBuffer = 30

// UptoTronScheme implements the SchemeNetworkFacilitator interface for TRON upto payments
type UptoTronScheme struct {
	signer upto.UptoFacilitatorTronSigner
	config *UptoTronSchemeConfig
}

// UptoTronSchemeConfig contains configuration for the facilitator scheme
type UptoTronSchemeConfig struct {
	// SettleFullAmount if true, settles the full approved amount instead of required amount
	SettleFullAmount bool
}

// NewUptoTronScheme creates a new UptoTronScheme
func NewUptoTronScheme(signer upto.UptoFacilitatorTronSigner, config ...*UptoTronSchemeConfig) *UptoTronScheme {
	var cfg *UptoTronSchemeConfig
	if len(config) > 0 {
		cfg = config[0]
	}
	return &UptoTronScheme{
		signer: signer,
		config: cfg,
	}
}

// Scheme returns the scheme identifier
func (f *UptoTronScheme) Scheme() string {
	return upto.SchemeUpto
}

// CaipFamily returns the CAIP family pattern this facilitator supports
func (f *UptoTronScheme) CaipFamily() string {
	return "tron:*"
}

// GetExtra returns extra data for the supported kinds endpoint
func (f *UptoTronScheme) GetExtra(network t402.Network) map[string]interface{} {
	config, err := tron.GetNetworkConfig(string(network))
	if err != nil {
		return nil
	}

	addresses := f.signer.GetAddresses(string(network))
	var spenderAddress string
	if len(addresses) > 0 {
		spenderAddress = addresses[0]
	}

	return map[string]interface{}{
		"defaultAsset":   config.DefaultAsset.ContractAddress,
		"symbol":         config.DefaultAsset.Symbol,
		"decimals":       config.DefaultAsset.Decimals,
		"spenderAddress": spenderAddress,
	}
}

// GetSigners returns the facilitator addresses
func (f *UptoTronScheme) GetSigners(network t402.Network) []string {
	return f.signer.GetAddresses(string(network))
}

// Verify verifies a upto payment payload against requirements
func (f *UptoTronScheme) Verify(
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
	if !tron.IsValidNetwork(string(network)) {
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
	payer := authorization.Owner

	// Step 4: Validate addresses
	if !tron.ValidateTronAddress(authorization.Owner) {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_owner_address",
			Payer:         payer,
		}, nil
	}
	if !tron.ValidateTronAddress(authorization.Spender) {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_spender_address",
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

	// Step 5: Verify spender is one of our addresses
	validSpender := false
	facilitatorAddresses := f.signer.GetAddresses(string(network))
	for _, addr := range facilitatorAddresses {
		if tron.AddressesEqual(authorization.Spender, addr) {
			validSpender = true
			break
		}
	}
	if !validSpender {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "invalid_spender",
			Payer:         payer,
		}, nil
	}

	// Step 6: Verify the approve transaction
	verifyResult, err := f.signer.VerifyApproveTransaction(upto.VerifyApproveParams{
		SignedTransaction: uptoPayload.SignedTransaction,
		ExpectedOwner:     authorization.Owner,
		ExpectedSpender:   authorization.Spender,
		ContractAddress:   requirements.Asset,
		Network:           string(network),
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

	// Step 7: Check authorization expiry (with buffer)
	now := time.Now().UnixMilli()
	expirationWithBuffer := authorization.Expiration - int64(MinValidityBuffer*1000)
	if now >= expirationWithBuffer {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "authorization_expired",
			Payer:         payer,
		}, nil
	}

	// Step 8: Verify TRC20 balance
	balance, err := f.signer.GetBalance(upto.GetBalanceParams{
		OwnerAddress:    authorization.Owner,
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

	// Step 9: Verify approved amount is sufficient
	maxAmount := new(big.Int)
	_, ok := maxAmount.SetString(authorization.MaxAmount, 10)
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

	// Step 10: Verify contract address matching
	if !tron.AddressesEqual(authorization.ContractAddress, requirements.Asset) {
		return &t402.VerifyResponse{
			IsValid:       false,
			InvalidReason: "asset_mismatch",
			Payer:         payer,
		}, nil
	}

	// Step 11: Verify account is activated
	isActivated, err := f.signer.IsActivated(authorization.Owner, string(network))
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

// Settle settles a upto payment by broadcasting approve and executing transferFrom
func (f *UptoTronScheme) Settle(
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
	uptoPayload, err := upto.UptoPayloadFromMap(payload.Payload)
	if err != nil {
		return nil, t402.NewSettleError("invalid_payload", verifyResp.Payer, network, "", err)
	}

	// Step 1: Broadcast the approve transaction
	approveTxId, err := f.signer.BroadcastTransaction(uptoPayload.SignedTransaction, string(network))
	if err != nil {
		return nil, t402.NewSettleError("approve_broadcast_failed", verifyResp.Payer, network, "", err)
	}

	// Wait for approve confirmation
	approveConfirm, err := f.signer.WaitForTransaction(upto.WaitForTransactionParams{
		TxId:    approveTxId,
		Network: string(network),
		Timeout: 60000, // 60 seconds
	})
	if err != nil {
		return nil, t402.NewSettleError("approve_confirmation_failed", verifyResp.Payer, network, approveTxId, err)
	}

	if !approveConfirm.Success {
		return &t402.SettleResponse{
			Success:     false,
			ErrorReason: fmt.Sprintf("approve_failed: %s", approveConfirm.Error),
			Transaction: approveTxId,
			Network:     network,
			Payer:       verifyResp.Payer,
		}, nil
	}

	// Step 2: Execute transferFrom for the settlement amount
	settleAmount := requirements.Amount
	if f.config != nil && f.config.SettleFullAmount {
		settleAmount = uptoPayload.Authorization.MaxAmount
	}

	transferResult, err := f.signer.ExecuteTransferFrom(upto.TransferFromParams{
		ContractAddress: requirements.Asset,
		From:            uptoPayload.Authorization.Owner,
		To:              requirements.PayTo,
		Amount:          settleAmount,
		Network:         string(network),
	})
	if err != nil {
		return nil, t402.NewSettleError("transfer_execution_failed", verifyResp.Payer, network, approveTxId, err)
	}

	if !transferResult.Success {
		return &t402.SettleResponse{
			Success:     false,
			ErrorReason: fmt.Sprintf("transfer_failed: %s", transferResult.Error),
			Transaction: approveTxId, // Return approve tx as reference
			Network:     network,
			Payer:       verifyResp.Payer,
		}, nil
	}

	// Wait for transfer confirmation
	transferConfirm, err := f.signer.WaitForTransaction(upto.WaitForTransactionParams{
		TxId:    transferResult.TxId,
		Network: string(network),
		Timeout: 60000,
	})
	if err != nil {
		return nil, t402.NewSettleError("transfer_confirmation_failed", verifyResp.Payer, network, transferResult.TxId, err)
	}

	if !transferConfirm.Success {
		return &t402.SettleResponse{
			Success:     false,
			ErrorReason: fmt.Sprintf("transfer_failed: %s", transferConfirm.Error),
			Transaction: transferResult.TxId,
			Network:     network,
			Payer:       verifyResp.Payer,
		}, nil
	}

	return &t402.SettleResponse{
		Success:     true,
		Transaction: transferResult.TxId,
		Network:     network,
		Payer:       verifyResp.Payer,
	}, nil
}
