package client

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"time"

	"github.com/t402-io/t402/sdks/go/mechanisms/evm"
	"github.com/t402-io/t402/sdks/go/mechanisms/evm/permit2"
	"github.com/t402-io/t402/sdks/go/types"
)

// Permit2EvmScheme implements the SchemeNetworkClient interface for EVM Permit2 payments
type Permit2EvmScheme struct {
	signer evm.ClientEvmSigner
}

// NewPermit2EvmScheme creates a new Permit2EvmScheme
func NewPermit2EvmScheme(signer evm.ClientEvmSigner) *Permit2EvmScheme {
	return &Permit2EvmScheme{
		signer: signer,
	}
}

// Scheme returns the scheme identifier
func (c *Permit2EvmScheme) Scheme() string {
	return permit2.SchemePermit2
}

// CreatePaymentPayload creates a V2 payment payload for the Permit2 scheme
func (c *Permit2EvmScheme) CreatePaymentPayload(
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

	payload := &permit2.Permit2Payload{
		Permit: permit2.PermitTransferFrom{
			Permitted: permit2.TokenPermissions{
				Token:  requirements.Asset,
				Amount: requirements.Amount,
			},
			Nonce:    nonce.String(),
			Deadline: fmt.Sprintf("%d", deadline),
		},
		TransferDetails: permit2.SignatureTransferDetails{
			To:              requirements.PayTo,
			RequestedAmount: requirements.Amount,
		},
		Owner: c.signer.Address(),
	}

	// Sign the Permit2 typed data
	signature, err := c.signPermit2(ctx, payload, config.ChainID)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to sign permit2: %w", err)
	}
	payload.Signature = evm.BytesToHex(signature)

	return types.PaymentPayload{
		T402Version: 2,
		Payload:     payload.ToMap(),
	}, nil
}

// signPermit2 signs the Permit2 SignatureTransfer using EIP-712
func (c *Permit2EvmScheme) signPermit2(
	ctx context.Context,
	payload *permit2.Permit2Payload,
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
		"PermitTransferFrom": {
			{Name: "permitted", Type: "TokenPermissions"},
			{Name: "spender", Type: "address"},
			{Name: "nonce", Type: "uint256"},
			{Name: "deadline", Type: "uint256"},
		},
		"TokenPermissions": {
			{Name: "token", Type: "address"},
			{Name: "amount", Type: "uint256"},
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

	message := map[string]interface{}{
		"permitted": map[string]interface{}{
			"token":  payload.Permit.Permitted.Token,
			"amount": amount,
		},
		"spender":  payload.TransferDetails.To,
		"nonce":    nonce,
		"deadline": deadline,
	}

	return c.signer.SignTypedData(ctx, domain, typeDefs, "PermitTransferFrom", message)
}
