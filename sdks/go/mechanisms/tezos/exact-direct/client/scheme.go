package client

import (
	"context"
	"fmt"
	"math/big"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/tezos"
	"github.com/t402-io/t402/sdks/go/types"
)

// ClientTezosSigner defines the interface for Tezos client-side signing operations.
// Implementations are responsible for managing private keys, constructing
// FA2 transfer operations, signing them, and injecting them into the Tezos network.
type ClientTezosSigner interface {
	// Address returns the Tezos address (tz1/tz2/tz3) of the signer.
	Address() string

	// GetBalance retrieves the FA2 token balance for the signer's address.
	//
	// Args:
	//   ctx: Context for cancellation and timeout
	//   contractAddress: The FA2 contract address (KT1...)
	//   tokenID: The token ID within the FA2 contract
	//
	// Returns:
	//   The balance as a string in atomic units, or error
	GetBalance(ctx context.Context, contractAddress string, tokenID int) (string, error)

	// Transfer executes an FA2 transfer operation on-chain.
	// It constructs, signs, and injects the operation, returning the operation hash.
	//
	// Args:
	//   ctx: Context for cancellation and timeout
	//   contractAddress: The FA2 contract address (KT1...)
	//   tokenID: The token ID within the FA2 contract
	//   to: The recipient Tezos address
	//   amount: The amount to transfer in atomic units
	//   network: The network identifier (CAIP-2 format)
	//
	// Returns:
	//   The operation hash (starts with 'o', 51 characters), or error
	Transfer(ctx context.Context, contractAddress string, tokenID int, to string, amount *big.Int, network t402.Network) (string, error)
}

// ExactDirectTezosClientConfig holds optional configuration for the client.
type ExactDirectTezosClientConfig struct {
	// CheckBalance determines whether to check the signer's balance
	// before attempting the transfer. Default: true.
	CheckBalance bool
}

// ExactDirectTezosScheme implements the SchemeNetworkClient interface for Tezos
// exact-direct payments (V2). In this scheme, the client executes the FA2 transfer
// directly on-chain and provides the operation hash as proof of payment.
type ExactDirectTezosScheme struct {
	signer ClientTezosSigner
	config ExactDirectTezosClientConfig
}

// NewExactDirectTezosScheme creates a new ExactDirectTezosScheme client.
//
// Args:
//
//	signer: The client-side Tezos signer for executing FA2 transfers
//	config: Optional configuration (variadic, first value used if provided)
//
// Returns:
//
//	Configured ExactDirectTezosScheme instance
func NewExactDirectTezosScheme(signer ClientTezosSigner, config ...*ExactDirectTezosClientConfig) *ExactDirectTezosScheme {
	cfg := ExactDirectTezosClientConfig{
		CheckBalance: true,
	}
	if len(config) > 0 && config[0] != nil {
		cfg = *config[0]
	}

	return &ExactDirectTezosScheme{
		signer: signer,
		config: cfg,
	}
}

// Scheme returns the scheme identifier.
func (c *ExactDirectTezosScheme) Scheme() string {
	return tezos.SchemeExactDirect
}

// CreatePaymentPayload executes the FA2 transfer and creates a V2 payment payload.
// It validates the requirements, optionally checks balance, executes the transfer on-chain,
// and returns a payload containing the operation hash as proof.
//
// Args:
//
//	ctx: Context for cancellation and timeout control
//	requirements: The V2 payment requirements specifying amount, network, asset, payTo, etc.
//
// Returns:
//
//	PaymentPayload containing the operation hash and transfer details
//	error if validation fails, balance is insufficient, or the transfer fails
func (c *ExactDirectTezosScheme) CreatePaymentPayload(
	ctx context.Context,
	requirements types.PaymentRequirements,
) (types.PaymentPayload, error) {
	// Validate requirements
	if err := c.validateRequirements(requirements); err != nil {
		return types.PaymentPayload{}, fmt.Errorf("invalid requirements: %w", err)
	}

	// Parse asset to get contract address and token ID
	assetInfo, err := tezos.ParseAssetIdentifier(requirements.Asset)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("invalid asset identifier: %w", err)
	}

	// Parse amount
	amount, ok := new(big.Int).SetString(requirements.Amount, 10)
	if !ok {
		return types.PaymentPayload{}, fmt.Errorf("invalid amount: %s", requirements.Amount)
	}

	// Optionally check balance before transfer
	if c.config.CheckBalance {
		balanceStr, err := c.signer.GetBalance(ctx, assetInfo.ContractAddress, assetInfo.TokenID)
		if err != nil {
			return types.PaymentPayload{}, fmt.Errorf("failed to get balance: %w", err)
		}
		balance, ok := new(big.Int).SetString(balanceStr, 10)
		if !ok {
			return types.PaymentPayload{}, fmt.Errorf("invalid balance: %s", balanceStr)
		}
		if balance.Cmp(amount) < 0 {
			return types.PaymentPayload{}, fmt.Errorf("insufficient balance: have %s, need %s", balanceStr, requirements.Amount)
		}
	}

	// Execute FA2 transfer
	network := t402.Network(requirements.Network)
	opHash, err := c.signer.Transfer(ctx, assetInfo.ContractAddress, assetInfo.TokenID, requirements.PayTo, amount, network)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to execute transfer: %w", err)
	}

	// Validate operation hash format
	if !tezos.IsValidOperationHash(opHash) {
		return types.PaymentPayload{}, fmt.Errorf("signer returned invalid operation hash: %s", opHash)
	}

	// Create the payload
	payload := &tezos.ExactDirectPayload{
		OpHash:          opHash,
		From:            c.signer.Address(),
		To:              requirements.PayTo,
		Amount:          requirements.Amount,
		ContractAddress: assetInfo.ContractAddress,
		TokenID:         assetInfo.TokenID,
	}

	return types.PaymentPayload{
		T402Version: 2,
		Payload:     payload.ToMap(),
	}, nil
}

// validateRequirements validates the payment requirements for the exact-direct scheme.
func (c *ExactDirectTezosScheme) validateRequirements(requirements types.PaymentRequirements) error {
	// Check scheme
	if requirements.Scheme != tezos.SchemeExactDirect {
		return fmt.Errorf("invalid scheme: expected %s, got %s", tezos.SchemeExactDirect, requirements.Scheme)
	}

	// Check network is Tezos
	if !tezos.IsTezosNetwork(requirements.Network) {
		return fmt.Errorf("invalid network: %s (expected tezos:*)", requirements.Network)
	}

	// Check payTo address
	if !tezos.IsValidAddress(requirements.PayTo) {
		return fmt.Errorf("invalid payTo address: %s", requirements.PayTo)
	}

	// Check amount
	if requirements.Amount == "" {
		return fmt.Errorf("amount is required")
	}
	amount, ok := new(big.Int).SetString(requirements.Amount, 10)
	if !ok || amount.Sign() <= 0 {
		return fmt.Errorf("invalid amount: %s (must be a positive integer)", requirements.Amount)
	}

	// Check asset
	if requirements.Asset == "" {
		return fmt.Errorf("asset is required")
	}
	if _, err := tezos.ParseAssetIdentifier(requirements.Asset); err != nil {
		return fmt.Errorf("invalid asset: %w", err)
	}

	// Check signer address
	if !tezos.IsValidAddress(c.signer.Address()) {
		return fmt.Errorf("invalid signer address: %s", c.signer.Address())
	}

	return nil
}
