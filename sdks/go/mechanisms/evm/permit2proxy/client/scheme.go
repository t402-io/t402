package client

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"time"

	"github.com/t402-io/t402/sdks/go/mechanisms/evm"
	"github.com/t402-io/t402/sdks/go/mechanisms/evm/permit2"
	"github.com/t402-io/t402/sdks/go/mechanisms/evm/permit2proxy"
	"github.com/t402-io/t402/sdks/go/types"
)

// Permit2ProxyEvmScheme implements the SchemeNetworkClient interface for EVM Permit2 Proxy payments
type Permit2ProxyEvmScheme struct {
	signer evm.ClientEvmSigner
}

// NewPermit2ProxyEvmScheme creates a new Permit2ProxyEvmScheme
func NewPermit2ProxyEvmScheme(signer evm.ClientEvmSigner) *Permit2ProxyEvmScheme {
	return &Permit2ProxyEvmScheme{
		signer: signer,
	}
}

// Scheme returns the scheme identifier
func (c *Permit2ProxyEvmScheme) Scheme() string {
	return permit2proxy.SchemePermit2Proxy
}

// CreatePaymentPayload creates a V2 payment payload for the Permit2 Proxy scheme
func (c *Permit2ProxyEvmScheme) CreatePaymentPayload(
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

	// Generate random nonce
	nonceBytes := make([]byte, 32)
	if _, err := rand.Read(nonceBytes); err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to generate nonce: %w", err)
	}
	nonce := new(big.Int).SetBytes(nonceBytes)

	// Calculate deadline
	deadline := time.Now().Add(time.Hour).Unix()

	// Extract facilitator address from requirements extra
	facilitator := ""
	if requirements.Extra != nil {
		if f, ok := requirements.Extra["facilitator"].(string); ok {
			facilitator = f
		}
	}
	if facilitator == "" {
		return types.PaymentPayload{}, fmt.Errorf("facilitator address required in requirements extra")
	}

	// Calculate validAfter (30 seconds before now to account for clock skew)
	validAfter := time.Now().Add(-30 * time.Second).Unix()

	payload := &permit2proxy.Permit2ProxyPayload{
		Permit: permit2.PermitTransferFrom{
			Permitted: permit2.TokenPermissions{
				Token:  requirements.Asset,
				Amount: requirements.Amount,
			},
			Nonce:    nonce.String(),
			Deadline: fmt.Sprintf("%d", deadline),
		},
		Witness: permit2proxy.T402Witness{
			To:          requirements.PayTo,
			Facilitator: facilitator,
			ValidAfter:  fmt.Sprintf("%d", validAfter),
		},
		Owner: c.signer.Address(),
	}

	// Sign the PermitWitnessTransferFrom typed data
	signature, err := c.signPermitWitnessTransferFrom(ctx, payload, config.ChainID)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to sign permit2 proxy: %w", err)
	}
	payload.Signature = evm.BytesToHex(signature)

	return types.PaymentPayload{
		T402Version: 2,
		Payload:     payload.ToMap(),
	}, nil
}

// signPermitWitnessTransferFrom signs the Permit2 PermitWitnessTransferFrom using EIP-712
func (c *Permit2ProxyEvmScheme) signPermitWitnessTransferFrom(
	ctx context.Context,
	payload *permit2proxy.Permit2ProxyPayload,
	chainID *big.Int,
) ([]byte, error) {
	domain := evm.TypedDataDomain{
		Name:              "Permit2",
		Version:           "",
		ChainID:           chainID,
		VerifyingContract: permit2.Permit2Address,
	}

	typeDefs := map[string][]evm.TypedDataField{
		"EIP712Domain": {
			{Name: "name", Type: "string"},
			{Name: "chainId", Type: "uint256"},
			{Name: "verifyingContract", Type: "address"},
		},
		"PermitWitnessTransferFrom": {
			{Name: "permitted", Type: "TokenPermissions"},
			{Name: "spender", Type: "address"},
			{Name: "nonce", Type: "uint256"},
			{Name: "deadline", Type: "uint256"},
			{Name: "witness", Type: "Witness"},
		},
		"TokenPermissions": {
			{Name: "token", Type: "address"},
			{Name: "amount", Type: "uint256"},
		},
		"Witness": {
			{Name: "to", Type: "address"},
			{Name: "facilitator", Type: "address"},
			{Name: "validAfter", Type: "uint256"},
		},
	}

	amount, ok := new(big.Int).SetString(payload.Permit.Permitted.Amount, 10)
	if !ok {
		return nil, fmt.Errorf("invalid permit amount: %q", payload.Permit.Permitted.Amount)
	}
	nonce, ok := new(big.Int).SetString(payload.Permit.Nonce, 10)
	if !ok {
		return nil, fmt.Errorf("invalid nonce: %q", payload.Permit.Nonce)
	}
	deadline, ok := new(big.Int).SetString(payload.Permit.Deadline, 10)
	if !ok {
		return nil, fmt.Errorf("invalid deadline: %q", payload.Permit.Deadline)
	}
	validAfter, ok := new(big.Int).SetString(payload.Witness.ValidAfter, 10)
	if !ok {
		return nil, fmt.Errorf("invalid validAfter: %q", payload.Witness.ValidAfter)
	}

	// Determine spender (the proxy contract address)
	// For exact scheme, use ExactProxyAddress; this can be extended per-scheme
	spender := permit2proxy.ExactProxyAddress
	if extra := payload.Witness.Facilitator; extra != "" {
		// The spender for Permit2 is the proxy contract, not the facilitator
		// Use proxy address from requirements extra if available
	}

	message := map[string]interface{}{
		"permitted": map[string]interface{}{
			"token":  payload.Permit.Permitted.Token,
			"amount": amount,
		},
		"spender":  spender,
		"nonce":    nonce,
		"deadline": deadline,
		"witness": map[string]interface{}{
			"to":          payload.Witness.To,
			"facilitator": payload.Witness.Facilitator,
			"validAfter":  validAfter,
		},
	}

	return c.signer.SignTypedData(ctx, domain, typeDefs, "PermitWitnessTransferFrom", message)
}
