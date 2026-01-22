package facilitator

import (
	"context"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/evm"
	"github.com/t402-io/t402/sdks/go/types"
)

// ExactLegacyEvmSchemeConfig holds configuration for the ExactLegacyEvmScheme facilitator
type ExactLegacyEvmSchemeConfig struct {
	// MinAllowanceRatio specifies the minimum allowance ratio required (0.0 to 1.0)
	// If the allowance is less than this ratio of the payment amount,
	// verification will fail.
	// Default: 1.0 (exact allowance required)
	MinAllowanceRatio float64
}

// ExactLegacyEvmScheme implements the SchemeNetworkFacilitator interface for EVM exact-legacy payments
// Uses the approve + transferFrom pattern for legacy tokens without EIP-3009 support
type ExactLegacyEvmScheme struct {
	signer evm.FacilitatorEvmSigner
	config ExactLegacyEvmSchemeConfig
}

// NewExactLegacyEvmScheme creates a new ExactLegacyEvmScheme
// Args:
//
//	signer: The EVM signer for facilitator operations
//	config: Optional configuration (nil uses defaults)
//
// Returns:
//
//	Configured ExactLegacyEvmScheme instance
func NewExactLegacyEvmScheme(signer evm.FacilitatorEvmSigner, config *ExactLegacyEvmSchemeConfig) *ExactLegacyEvmScheme {
	cfg := ExactLegacyEvmSchemeConfig{
		MinAllowanceRatio: 1.0,
	}
	if config != nil {
		if config.MinAllowanceRatio > 0 {
			cfg.MinAllowanceRatio = config.MinAllowanceRatio
		}
	}
	return &ExactLegacyEvmScheme{
		signer: signer,
		config: cfg,
	}
}

// Scheme returns the scheme identifier
func (f *ExactLegacyEvmScheme) Scheme() string {
	return evm.SchemeExactLegacy
}

// CaipFamily returns the CAIP family pattern this facilitator supports
func (f *ExactLegacyEvmScheme) CaipFamily() string {
	return "eip155:*"
}

// GetExtra returns mechanism-specific extra data for the supported kinds endpoint.
// For exact-legacy, returns the spender (facilitator) addresses.
func (f *ExactLegacyEvmScheme) GetExtra(_ t402.Network) map[string]interface{} {
	addresses := f.signer.GetAddresses()
	if len(addresses) > 0 {
		return map[string]interface{}{
			"spender":   addresses[0],
			"tokenType": "legacy",
		}
	}
	return map[string]interface{}{
		"tokenType": "legacy",
	}
}

// GetSigners returns signer addresses used by this facilitator.
// Returns all addresses this facilitator can use for signing/settling transactions.
func (f *ExactLegacyEvmScheme) GetSigners(_ t402.Network) []string {
	return f.signer.GetAddresses()
}

// Verify verifies a payment payload against requirements
func (f *ExactLegacyEvmScheme) Verify(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.VerifyResponse, error) {
	network := t402.Network(requirements.Network)

	// Validate scheme
	if payload.Accepted.Scheme != evm.SchemeExactLegacy {
		return nil, t402.NewVerifyError("invalid_scheme", "", network, nil)
	}

	// Validate network matches
	if payload.Accepted.Network != requirements.Network {
		return nil, t402.NewVerifyError("network_mismatch", "", network, nil)
	}

	// Parse legacy payload
	legacyPayload, err := evm.LegacyPayloadFromMap(payload.Payload)
	if err != nil {
		return nil, t402.NewVerifyError("invalid_payload", "", network, err)
	}

	// Validate signature exists
	if legacyPayload.Signature == "" {
		return nil, t402.NewVerifyError("missing_signature", "", network, nil)
	}

	// Verify the spender is one of our addresses
	spenderAddr := strings.ToLower(legacyPayload.Authorization.Spender)
	facilitatorAddresses := f.signer.GetAddresses()
	isValidSpender := false
	for _, addr := range facilitatorAddresses {
		if strings.EqualFold(addr, spenderAddr) {
			isValidSpender = true
			break
		}
	}
	if !isValidSpender {
		return nil, t402.NewVerifyError("invalid_spender", legacyPayload.Authorization.From, network, nil)
	}

	// Get network configuration
	networkStr := string(requirements.Network)
	config, err := evm.GetNetworkConfig(networkStr)
	if err != nil {
		return nil, t402.NewVerifyError("failed_to_get_network_config", "", network, err)
	}

	// Get asset info
	assetInfo, err := evm.GetAssetInfo(networkStr, requirements.Asset)
	if err != nil {
		return nil, t402.NewVerifyError("failed_to_get_asset_info", "", network, err)
	}

	// Extract token info from requirements
	tokenName := "T402LegacyTransfer"
	tokenVersion := "1"
	if requirements.Extra != nil {
		if name, ok := requirements.Extra["name"].(string); ok {
			tokenName = name
		}
		if version, ok := requirements.Extra["version"].(string); ok {
			tokenVersion = version
		}
	}

	// Build domain for signature verification
	domain := evm.TypedDataDomain{
		Name:              tokenName,
		Version:           tokenVersion,
		ChainID:           config.ChainID,
		VerifyingContract: assetInfo.Address,
	}

	// Build message
	message := map[string]interface{}{
		"from":        legacyPayload.Authorization.From,
		"to":          legacyPayload.Authorization.To,
		"value":       legacyPayload.Authorization.Value,
		"validAfter":  legacyPayload.Authorization.ValidAfter,
		"validBefore": legacyPayload.Authorization.ValidBefore,
		"nonce":       legacyPayload.Authorization.Nonce,
		"spender":     legacyPayload.Authorization.Spender,
	}

	// Verify signature
	signatureBytes, err := evm.HexToBytes(legacyPayload.Signature)
	if err != nil {
		return nil, t402.NewVerifyError("invalid_signature_format", legacyPayload.Authorization.From, network, err)
	}

	legacyTypes := map[string][]evm.TypedDataField{
		"LegacyTransferAuthorization": {
			{Name: "from", Type: "address"},
			{Name: "to", Type: "address"},
			{Name: "value", Type: "uint256"},
			{Name: "validAfter", Type: "uint256"},
			{Name: "validBefore", Type: "uint256"},
			{Name: "nonce", Type: "bytes32"},
			{Name: "spender", Type: "address"},
		},
	}

	valid, err := f.signer.VerifyTypedData(
		ctx,
		legacyPayload.Authorization.From,
		domain,
		legacyTypes,
		"LegacyTransferAuthorization",
		message,
		signatureBytes,
	)
	if err != nil {
		return nil, t402.NewVerifyError("signature_verification_failed", legacyPayload.Authorization.From, network, err)
	}
	if !valid {
		return nil, t402.NewVerifyError("invalid_signature", legacyPayload.Authorization.From, network, nil)
	}

	// Verify payment recipient matches
	if !strings.EqualFold(legacyPayload.Authorization.To, requirements.PayTo) {
		return nil, t402.NewVerifyError("recipient_mismatch", legacyPayload.Authorization.From, network, nil)
	}

	// Verify validBefore is in the future
	now := time.Now().Unix()
	validBefore, ok := new(big.Int).SetString(legacyPayload.Authorization.ValidBefore, 10)
	if !ok {
		return nil, t402.NewVerifyError("invalid_valid_before", legacyPayload.Authorization.From, network, nil)
	}
	if validBefore.Int64() < now+6 {
		return nil, t402.NewVerifyError("authorization_expired", legacyPayload.Authorization.From, network, nil)
	}

	// Verify validAfter is not in the future
	validAfter, ok := new(big.Int).SetString(legacyPayload.Authorization.ValidAfter, 10)
	if !ok {
		return nil, t402.NewVerifyError("invalid_valid_after", legacyPayload.Authorization.From, network, nil)
	}
	if validAfter.Int64() > now {
		return nil, t402.NewVerifyError("authorization_not_yet_valid", legacyPayload.Authorization.From, network, nil)
	}

	// Check balance
	balance, err := f.signer.GetBalance(ctx, legacyPayload.Authorization.From, assetInfo.Address)
	if err != nil {
		return nil, t402.NewVerifyError("failed_to_get_balance", legacyPayload.Authorization.From, network, err)
	}
	requiredAmount, ok := new(big.Int).SetString(requirements.Amount, 10)
	if !ok {
		return nil, t402.NewVerifyError("invalid_required_amount", legacyPayload.Authorization.From, network, nil)
	}
	if balance.Cmp(requiredAmount) < 0 {
		return nil, t402.NewVerifyError("insufficient_balance", legacyPayload.Authorization.From, network, nil)
	}

	// Check allowance
	allowance, err := f.checkAllowance(ctx, legacyPayload.Authorization.From, spenderAddr, assetInfo.Address)
	if err != nil {
		return nil, t402.NewVerifyError("allowance_check_failed", legacyPayload.Authorization.From, network, err)
	}

	// Calculate required allowance based on minAllowanceRatio
	requiredAllowanceFloat := float64(requiredAmount.Int64()) * f.config.MinAllowanceRatio
	requiredAllowance := big.NewInt(int64(requiredAllowanceFloat))
	if allowance.Cmp(requiredAllowance) < 0 {
		return nil, t402.NewVerifyError("insufficient_allowance", legacyPayload.Authorization.From, network, nil)
	}

	// Verify amount is sufficient
	authValue, ok := new(big.Int).SetString(legacyPayload.Authorization.Value, 10)
	if !ok {
		return nil, t402.NewVerifyError("invalid_authorization_value", legacyPayload.Authorization.From, network, nil)
	}
	if authValue.Cmp(requiredAmount) < 0 {
		return nil, t402.NewVerifyError("insufficient_amount", legacyPayload.Authorization.From, network, nil)
	}

	return &t402.VerifyResponse{
		IsValid: true,
		Payer:   legacyPayload.Authorization.From,
	}, nil
}

// Settle settles a payment on-chain using transferFrom
func (f *ExactLegacyEvmScheme) Settle(
	ctx context.Context,
	payload types.PaymentPayload,
	requirements types.PaymentRequirements,
) (*t402.SettleResponse, error) {
	network := t402.Network(payload.Accepted.Network)

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

	// Parse legacy payload
	legacyPayload, err := evm.LegacyPayloadFromMap(payload.Payload)
	if err != nil {
		return nil, t402.NewSettleError("invalid_payload", verifyResp.Payer, network, "", err)
	}

	// Get asset info
	networkStr := string(requirements.Network)
	assetInfo, err := evm.GetAssetInfo(networkStr, requirements.Asset)
	if err != nil {
		return nil, t402.NewSettleError("failed_to_get_asset_info", verifyResp.Payer, network, "", err)
	}

	// Parse transfer amount
	value, ok := new(big.Int).SetString(legacyPayload.Authorization.Value, 10)
	if !ok {
		return nil, t402.NewSettleError("invalid_value", verifyResp.Payer, network, "", nil)
	}

	// Execute transferFrom
	txHash, err := f.signer.WriteContract(
		ctx,
		assetInfo.Address,
		evm.ERC20LegacyABI,
		evm.FunctionTransferFrom,
		common.HexToAddress(legacyPayload.Authorization.From),
		common.HexToAddress(legacyPayload.Authorization.To),
		value,
	)
	if err != nil {
		return nil, t402.NewSettleError("failed_to_execute_transfer", verifyResp.Payer, network, "", err)
	}

	// Wait for transaction confirmation
	receipt, err := f.signer.WaitForTransactionReceipt(ctx, txHash)
	if err != nil {
		return nil, t402.NewSettleError("failed_to_get_receipt", verifyResp.Payer, network, txHash, err)
	}

	if receipt.Status != evm.TxStatusSuccess {
		return nil, t402.NewSettleError("transaction_failed", verifyResp.Payer, network, txHash, nil)
	}

	return &t402.SettleResponse{
		Success:     true,
		Transaction: txHash,
		Network:     network,
		Payer:       verifyResp.Payer,
	}, nil
}

// checkAllowance checks the allowance of a token
func (f *ExactLegacyEvmScheme) checkAllowance(ctx context.Context, owner string, spender string, tokenAddress string) (*big.Int, error) {
	result, err := f.signer.ReadContract(
		ctx,
		tokenAddress,
		evm.ERC20LegacyABI,
		evm.FunctionAllowance,
		common.HexToAddress(owner),
		common.HexToAddress(spender),
	)
	if err != nil {
		return nil, err
	}

	allowance, ok := result.(*big.Int)
	if !ok {
		return nil, fmt.Errorf("unexpected result type from allowance")
	}

	return allowance, nil
}
