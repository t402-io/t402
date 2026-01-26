package client

import (
	"context"
	"fmt"
	"math/big"
	"time"

	"github.com/t402-io/t402/sdks/go/mechanisms/evm"
	"github.com/t402-io/t402/sdks/go/types"
)

// ExactLegacyEvmScheme implements the SchemeNetworkClient interface for EVM exact-legacy payments.
// Uses the approve + transferFrom pattern for legacy tokens without EIP-3009 support.
// Signs a LegacyTransferAuthorization message using EIP-712 typed data.
type ExactLegacyEvmScheme struct {
	signer evm.ClientEvmSigner
}

// NewExactLegacyEvmScheme creates a new ExactLegacyEvmScheme
func NewExactLegacyEvmScheme(signer evm.ClientEvmSigner) *ExactLegacyEvmScheme {
	return &ExactLegacyEvmScheme{
		signer: signer,
	}
}

// Scheme returns the scheme identifier
func (c *ExactLegacyEvmScheme) Scheme() string {
	return evm.SchemeExactLegacy
}

// CreatePaymentPayload creates a V2 payment payload for the exact-legacy scheme.
// The client signs a LegacyTransferAuthorization that authorizes the facilitator (spender)
// to call transferFrom on behalf of the payer.
func (c *ExactLegacyEvmScheme) CreatePaymentPayload(
	ctx context.Context,
	requirements types.PaymentRequirements,
) (types.PaymentPayload, error) {
	// Validate network
	networkStr := string(requirements.Network)
	if !evm.IsValidNetwork(networkStr) {
		return types.PaymentPayload{}, fmt.Errorf("unsupported network: %s", requirements.Network)
	}

	// Get network configuration
	config, err := evm.GetNetworkConfig(networkStr)
	if err != nil {
		return types.PaymentPayload{}, err
	}

	// Get asset info
	assetInfo, err := evm.GetAssetInfo(networkStr, requirements.Asset)
	if err != nil {
		return types.PaymentPayload{}, err
	}

	// Requirements.Amount is already in the smallest unit
	value, ok := new(big.Int).SetString(requirements.Amount, 10)
	if !ok {
		return types.PaymentPayload{}, fmt.Errorf("invalid amount: %s", requirements.Amount)
	}

	// Get spender address from extra (facilitator address that will call transferFrom)
	spender := ""
	if requirements.Extra != nil {
		if s, ok := requirements.Extra["spender"].(string); ok {
			spender = s
		}
	}
	if spender == "" {
		return types.PaymentPayload{}, fmt.Errorf("spender address is required in extra for exact-legacy scheme")
	}

	// Create nonce
	nonce, err := evm.CreateNonce()
	if err != nil {
		return types.PaymentPayload{}, err
	}

	// Create validity window
	validAfter, validBefore := evm.CreateValidityWindow(time.Hour)

	// Extract token name/version for EIP-712 domain
	tokenName := "T402LegacyTransfer"
	tokenVersion := "1"
	if requirements.Extra != nil {
		if name, ok := requirements.Extra["name"].(string); ok {
			tokenName = name
		}
		if ver, ok := requirements.Extra["version"].(string); ok {
			tokenVersion = ver
		}
	}

	// Create legacy authorization
	authorization := evm.ExactLegacyAuthorization{
		From:        c.signer.Address(),
		To:          requirements.PayTo,
		Value:       value.String(),
		ValidAfter:  validAfter.String(),
		ValidBefore: validBefore.String(),
		Nonce:       nonce,
		Spender:     spender,
	}

	// Sign the authorization
	signature, err := c.signLegacyAuthorization(ctx, authorization, config.ChainID, assetInfo.Address, tokenName, tokenVersion)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to sign authorization: %w", err)
	}

	// Create legacy payload
	legacyPayload := &evm.ExactLegacyPayload{
		Signature:     evm.BytesToHex(signature),
		Authorization: authorization,
	}

	// Return partial V2 payload (core will add accepted, resource, extensions)
	return types.PaymentPayload{
		T402Version: 2,
		Payload:     legacyPayload.ToMap(),
	}, nil
}

// signLegacyAuthorization signs the LegacyTransferAuthorization using EIP-712
func (c *ExactLegacyEvmScheme) signLegacyAuthorization(
	ctx context.Context,
	authorization evm.ExactLegacyAuthorization,
	chainID *big.Int,
	verifyingContract string,
	tokenName string,
	tokenVersion string,
) ([]byte, error) {
	// Create EIP-712 domain
	domain := evm.TypedDataDomain{
		Name:              tokenName,
		Version:           tokenVersion,
		ChainID:           chainID,
		VerifyingContract: verifyingContract,
	}

	// Define EIP-712 types for LegacyTransferAuthorization
	types := map[string][]evm.TypedDataField{
		"EIP712Domain": {
			{Name: "name", Type: "string"},
			{Name: "version", Type: "string"},
			{Name: "chainId", Type: "uint256"},
			{Name: "verifyingContract", Type: "address"},
		},
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

	// Parse values for message with explicit error checking
	value, ok := new(big.Int).SetString(authorization.Value, 10)
	if !ok {
		return nil, fmt.Errorf("invalid authorization value: %q", authorization.Value)
	}
	validAfter, ok := new(big.Int).SetString(authorization.ValidAfter, 10)
	if !ok {
		return nil, fmt.Errorf("invalid validAfter: %q", authorization.ValidAfter)
	}
	validBefore, ok := new(big.Int).SetString(authorization.ValidBefore, 10)
	if !ok {
		return nil, fmt.Errorf("invalid validBefore: %q", authorization.ValidBefore)
	}
	nonceBytes, err := evm.HexToBytes(authorization.Nonce)
	if err != nil {
		return nil, fmt.Errorf("invalid nonce: %w", err)
	}

	// Create message
	message := map[string]interface{}{
		"from":        authorization.From,
		"to":          authorization.To,
		"value":       value,
		"validAfter":  validAfter,
		"validBefore": validBefore,
		"nonce":       nonceBytes,
		"spender":     authorization.Spender,
	}

	// Sign the typed data
	return c.signer.SignTypedData(ctx, domain, types, "LegacyTransferAuthorization", message)
}
