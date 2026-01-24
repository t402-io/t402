package client

import (
	"context"
	"fmt"
	"math/big"
	"strings"

	"github.com/t402-io/t402/sdks/go/mechanisms/stacks"
	"github.com/t402-io/t402/sdks/go/types"
)

// ExactDirectStacksClientConfig holds optional configuration for the client
type ExactDirectStacksClientConfig struct {
	// ApiURL overrides the default Hiro API endpoint for the network
	ApiURL string
}

// ExactDirectStacksScheme implements the SchemeNetworkClient interface for Stacks exact-direct payments (V2).
//
// The exact-direct scheme has the client execute the SIP-010 transfer function
// directly on-chain. The transaction ID is then used as proof of payment.
type ExactDirectStacksScheme struct {
	signer stacks.ClientStacksSigner
	config ExactDirectStacksClientConfig
}

// NewExactDirectStacksScheme creates a new ExactDirectStacksScheme client.
//
// Args:
//
//	signer: The Stacks signer for executing transactions
//	config: Optional configuration (pass nil for defaults)
func NewExactDirectStacksScheme(signer stacks.ClientStacksSigner, config *ExactDirectStacksClientConfig) *ExactDirectStacksScheme {
	cfg := ExactDirectStacksClientConfig{}
	if config != nil {
		cfg = *config
	}
	return &ExactDirectStacksScheme{
		signer: signer,
		config: cfg,
	}
}

// Scheme returns the scheme identifier
func (c *ExactDirectStacksScheme) Scheme() string {
	return stacks.SchemeExactDirect
}

// CreatePaymentPayload creates a V2 payment payload by executing the SIP-010 transfer
// on-chain and returning the transaction ID as proof of payment.
//
// Args:
//
//	ctx: Context for cancellation and timeouts
//	requirements: The payment requirements specifying amount, asset, payTo, and network
//
// Returns:
//
//	PaymentPayload with the transaction ID in the payload field
func (c *ExactDirectStacksScheme) CreatePaymentPayload(
	ctx context.Context,
	requirements types.PaymentRequirements,
) (types.PaymentPayload, error) {
	// Validate requirements
	if err := c.validateRequirements(requirements); err != nil {
		return types.PaymentPayload{}, err
	}

	// Resolve contract address from requirements
	contractAddress, err := c.resolveContractAddress(requirements)
	if err != nil {
		return types.PaymentPayload{}, err
	}

	// Get sender address
	from := c.signer.Address()
	if from == "" {
		return types.PaymentPayload{}, fmt.Errorf("signer address is empty")
	}

	// Parse amount to big.Int
	amount := new(big.Int)
	if _, ok := amount.SetString(requirements.Amount, 10); !ok {
		return types.PaymentPayload{}, fmt.Errorf("invalid amount format: %s", requirements.Amount)
	}

	// Execute the transfer
	txId, err := c.signer.TransferToken(ctx, contractAddress, requirements.PayTo, amount)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to execute transfer: %w", err)
	}

	// Validate transaction ID
	if txId == "" {
		return types.PaymentPayload{}, fmt.Errorf("transfer returned empty transaction ID")
	}

	// Build the payload
	stacksPayload := &stacks.ExactDirectPayload{
		TxId:            txId,
		From:            from,
		To:              requirements.PayTo,
		Amount:          requirements.Amount,
		ContractAddress: contractAddress,
	}

	return types.PaymentPayload{
		T402Version: 2,
		Payload:     stacksPayload.ToMap(),
	}, nil
}

// validateRequirements validates the payment requirements for Stacks exact-direct
func (c *ExactDirectStacksScheme) validateRequirements(requirements types.PaymentRequirements) error {
	// Validate scheme
	if requirements.Scheme != "" && requirements.Scheme != stacks.SchemeExactDirect {
		return fmt.Errorf("invalid scheme: expected %s, got %s", stacks.SchemeExactDirect, requirements.Scheme)
	}

	// Validate network prefix
	if !stacks.IsStacksNetwork(requirements.Network) {
		return fmt.Errorf("unsupported network: %s (expected stacks:* format)", requirements.Network)
	}

	// Validate network is known
	if _, err := stacks.GetNetworkConfig(requirements.Network); err != nil {
		return fmt.Errorf("unknown stacks network: %s", requirements.Network)
	}

	// Validate payTo address
	if requirements.PayTo == "" {
		return fmt.Errorf("payTo address is required")
	}
	if !stacks.IsValidPrincipal(requirements.PayTo) {
		return fmt.Errorf("invalid payTo address: %s", requirements.PayTo)
	}

	// Validate amount
	if requirements.Amount == "" {
		return fmt.Errorf("amount is required")
	}
	amount := new(big.Int)
	if _, ok := amount.SetString(requirements.Amount, 10); !ok {
		return fmt.Errorf("invalid amount format: %s", requirements.Amount)
	}
	if amount.Sign() <= 0 {
		return fmt.Errorf("amount must be positive: %s", requirements.Amount)
	}

	return nil
}

// resolveContractAddress determines the contract address from requirements extra fields or network defaults.
// Priority: extra["contractAddress"] > network default token
func (c *ExactDirectStacksScheme) resolveContractAddress(requirements types.PaymentRequirements) (string, error) {
	// Try to get contract address from extra fields (highest priority)
	if requirements.Extra != nil {
		if contractVal, ok := requirements.Extra["contractAddress"]; ok {
			if contractStr, ok := contractVal.(string); ok && contractStr != "" {
				return contractStr, nil
			}
		}
	}

	// Try to extract from asset field (CAIP-19 format: stacks:1/token:contract)
	if requirements.Asset != "" {
		contractAddress := parseAssetContract(requirements.Asset)
		if contractAddress != "" {
			return contractAddress, nil
		}
	}

	// Fall back to network default token
	networkConfig, err := stacks.GetNetworkConfig(requirements.Network)
	if err != nil {
		return "", fmt.Errorf("no default token for network: %s", requirements.Network)
	}

	return networkConfig.DefaultToken.ContractAddress, nil
}

// parseAssetContract extracts a contract address from a CAIP-19-like asset identifier.
// Format: stacks:1/token:{contractAddress}
func parseAssetContract(asset string) string {
	const prefix = "/token:"
	idx := strings.LastIndex(asset, prefix)
	if idx == -1 {
		return ""
	}
	return asset[idx+len(prefix):]
}
