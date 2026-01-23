package upto

import (
	"context"
	"fmt"
	"math/big"
	"time"

	"github.com/t402-io/t402/sdks/go/mechanisms/evm"
	"github.com/t402-io/t402/sdks/go/types"
)

// UptoEvmScheme implements the SchemeNetworkClient interface for EVM upto payments (V2).
// It uses EIP-2612 Permit to sign gasless token approvals, allowing the facilitator
// to later call transferFrom to settle the actual usage amount (up to the approved value).
type UptoEvmScheme struct {
	signer evm.ClientEvmSigner
}

// NewUptoEvmScheme creates a new UptoEvmScheme client.
//
// Args:
//
//	signer: The client-side EVM signer for creating EIP-712 permit signatures
//
// Returns:
//
//	Configured UptoEvmScheme instance
func NewUptoEvmScheme(signer evm.ClientEvmSigner) *UptoEvmScheme {
	return &UptoEvmScheme{
		signer: signer,
	}
}

// Scheme returns the scheme identifier.
func (c *UptoEvmScheme) Scheme() string {
	return Scheme
}

// CreatePaymentPayload creates a V2 payment payload for the upto scheme.
// It signs an EIP-2612 Permit approving the facilitator (spender) to spend
// up to the required amount on behalf of the client (owner).
//
// Args:
//
//	ctx: Context for cancellation and timeout control
//	requirements: The V2 payment requirements specifying amount, network, asset, etc.
//
// Returns:
//
//	PaymentPayload containing the EIP-2612 permit signature and authorization data
//	error if signing fails or requirements are invalid
func (c *UptoEvmScheme) CreatePaymentPayload(
	ctx context.Context,
	requirements types.PaymentRequirements,
) (types.PaymentPayload, error) {
	// Get network configuration
	networkStr := string(requirements.Network)
	config, err := evm.GetNetworkConfig(networkStr)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("unsupported network: %s", requirements.Network)
	}

	// Get asset info
	assetInfo, err := evm.GetAssetInfo(networkStr, requirements.Asset)
	if err != nil {
		return types.PaymentPayload{}, err
	}

	// Parse the required amount (already in smallest unit)
	value, ok := new(big.Int).SetString(requirements.Amount, 10)
	if !ok {
		return types.PaymentPayload{}, fmt.Errorf("invalid amount: %s", requirements.Amount)
	}

	// Determine the spender (facilitator/router address)
	spender := requirements.PayTo
	if requirements.Extra != nil {
		if router, ok := requirements.Extra["routerAddress"].(string); ok && router != "" {
			spender = router
		}
	}

	// Get the permit nonce from extra if provided, otherwise default to 0
	permitNonce := 0
	if requirements.Extra != nil {
		if n, ok := requirements.Extra["permitNonce"].(float64); ok {
			permitNonce = int(n)
		}
	}

	// Create deadline (1 hour from now)
	deadline := big.NewInt(time.Now().Unix() + evm.DefaultValidityPeriod)

	// Extract token info for EIP-712 domain
	tokenName := assetInfo.Name
	tokenVersion := assetInfo.Version
	if requirements.Extra != nil {
		if name, ok := requirements.Extra["name"].(string); ok {
			tokenName = name
		}
		if ver, ok := requirements.Extra["version"].(string); ok {
			tokenVersion = ver
		}
	}

	// Create permit authorization
	authorization := PermitAuthorization{
		Owner:    c.signer.Address(),
		Spender:  spender,
		Value:    value.String(),
		Deadline: deadline.String(),
		Nonce:    permitNonce,
	}

	// Sign the permit
	signature, err := c.signPermit(ctx, authorization, config.ChainID, assetInfo.Address, tokenName, tokenVersion)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to sign permit: %w", err)
	}

	// Split signature into v, r, s
	if len(signature) != 65 {
		return types.PaymentPayload{}, fmt.Errorf("invalid signature length: expected 65 bytes, got %d", len(signature))
	}

	r := evm.BytesToHex(signature[0:32])
	s := evm.BytesToHex(signature[32:64])
	v := int(signature[64])

	// Create payment nonce for replay protection
	paymentNonce, err := evm.CreateNonce()
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to create payment nonce: %w", err)
	}

	// Create the EIP-2612 payload
	permitPayload := NewEIP2612Payload(
		NewPermitSignature(v, r, s),
		authorization,
		paymentNonce,
	)

	// Return V2 payload
	return types.PaymentPayload{
		T402Version: 2,
		Payload:     permitPayload.ToMap(),
	}, nil
}

// signPermit signs the EIP-2612 permit using EIP-712 typed data.
func (c *UptoEvmScheme) signPermit(
	ctx context.Context,
	authorization PermitAuthorization,
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

	// Define EIP-712 types for Permit
	typedDataTypes := map[string][]evm.TypedDataField{
		"EIP712Domain": {
			{Name: "name", Type: "string"},
			{Name: "version", Type: "string"},
			{Name: "chainId", Type: "uint256"},
			{Name: "verifyingContract", Type: "address"},
		},
		"Permit": {
			{Name: "owner", Type: "address"},
			{Name: "spender", Type: "address"},
			{Name: "value", Type: "uint256"},
			{Name: "nonce", Type: "uint256"},
			{Name: "deadline", Type: "uint256"},
		},
	}

	// Create message from authorization
	message := CreatePermitMessage(authorization)

	// Sign the typed data
	return c.signer.SignTypedData(ctx, domain, typedDataTypes, "Permit", message)
}
