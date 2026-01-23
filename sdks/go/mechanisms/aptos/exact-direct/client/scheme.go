package client

import (
	"context"
	"fmt"
	"math/big"
	"strings"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/aptos"
	"github.com/t402-io/t402/sdks/go/types"
)

// ClientAptosSigner defines the interface for Aptos client-side signing operations
type ClientAptosSigner interface {
	// Address returns the signer's Aptos address
	Address() string

	// SignAndSubmitTransaction signs and submits a transaction to the Aptos network.
	// Returns the transaction hash on success.
	SignAndSubmitTransaction(ctx context.Context, payload aptos.TransactionPayload, network t402.Network) (string, error)
}

// ExactDirectAptosClientConfig holds configuration for the ExactDirectAptosScheme client
type ExactDirectAptosClientConfig struct {
	// VerifyTransfer controls whether to verify the transfer was successful.
	// Reserved for future use.
	VerifyTransfer bool
}

// ExactDirectAptosScheme implements the SchemeNetworkClient interface for Aptos exact-direct payments (V2)
type ExactDirectAptosScheme struct {
	signer ClientAptosSigner
	config ExactDirectAptosClientConfig
}

// NewExactDirectAptosScheme creates a new ExactDirectAptosScheme client
// Config is optional - if not provided, uses defaults.
func NewExactDirectAptosScheme(signer ClientAptosSigner, config ...*ExactDirectAptosClientConfig) *ExactDirectAptosScheme {
	cfg := ExactDirectAptosClientConfig{
		VerifyTransfer: true,
	}
	if len(config) > 0 && config[0] != nil {
		cfg = *config[0]
	}
	return &ExactDirectAptosScheme{
		signer: signer,
		config: cfg,
	}
}

// Scheme returns the scheme identifier
func (c *ExactDirectAptosScheme) Scheme() string {
	return aptos.SchemeExactDirect
}

// CreatePaymentPayload creates a V2 payment payload by executing the FA transfer on-chain
// and returning the transaction hash as proof of payment.
func (c *ExactDirectAptosScheme) CreatePaymentPayload(
	ctx context.Context,
	requirements types.PaymentRequirements,
) (types.PaymentPayload, error) {
	// Validate requirements
	if err := c.validateRequirements(requirements); err != nil {
		return types.PaymentPayload{}, err
	}

	// Parse amount to validate it
	amount, ok := new(big.Int).SetString(requirements.Amount, 10)
	if !ok {
		return types.PaymentPayload{}, fmt.Errorf("invalid amount: %s", requirements.Amount)
	}
	if amount.Sign() <= 0 {
		return types.PaymentPayload{}, fmt.Errorf("amount must be positive, got: %s", requirements.Amount)
	}

	// Build the FA transfer transaction payload
	txPayload := aptos.TransactionPayload{
		Type:          "entry_function_payload",
		Function:      aptos.FATransferFunction,
		TypeArguments: []string{},
		Arguments: []interface{}{
			requirements.Asset,        // FA metadata address
			requirements.PayTo,        // recipient address
			requirements.Amount,       // amount (u64 as string)
		},
	}

	// Sign and submit the transaction
	txHash, err := c.signer.SignAndSubmitTransaction(ctx, txPayload, t402.Network(requirements.Network))
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to sign and submit transaction: %w", err)
	}

	// Validate returned transaction hash
	if !aptos.IsValidTxHash(txHash) {
		return types.PaymentPayload{}, fmt.Errorf("signer returned invalid transaction hash: %s", txHash)
	}

	// Build the exact-direct payload
	aptosPayload := &aptos.ExactDirectPayload{
		TxHash:          txHash,
		From:            c.signer.Address(),
		To:              requirements.PayTo,
		Amount:          requirements.Amount,
		MetadataAddress: requirements.Asset,
	}

	return types.PaymentPayload{
		T402Version: 2,
		Payload:     aptosPayload.ToMap(),
	}, nil
}

// validateRequirements validates the payment requirements for Aptos exact-direct
func (c *ExactDirectAptosScheme) validateRequirements(requirements types.PaymentRequirements) error {
	// Validate scheme
	if requirements.Scheme != aptos.SchemeExactDirect {
		return fmt.Errorf("invalid scheme: expected %s, got %s", aptos.SchemeExactDirect, requirements.Scheme)
	}

	// Validate network (must start with "aptos:")
	if !strings.HasPrefix(requirements.Network, "aptos:") {
		return fmt.Errorf("invalid network: %s (expected aptos:* format)", requirements.Network)
	}

	// Validate network is known
	if _, ok := aptos.GetNetworkConfig(requirements.Network); !ok {
		return fmt.Errorf("unsupported network: %s", requirements.Network)
	}

	// Validate payTo address
	if !aptos.IsValidAddress(requirements.PayTo) {
		return fmt.Errorf("invalid payTo address: %s", requirements.PayTo)
	}

	// Validate asset (FA metadata address)
	if requirements.Asset == "" {
		return fmt.Errorf("asset (FA metadata address) is required")
	}
	if !aptos.IsValidAddress(requirements.Asset) {
		return fmt.Errorf("invalid asset address: %s", requirements.Asset)
	}

	// Validate amount
	if requirements.Amount == "" {
		return fmt.Errorf("amount is required")
	}
	amount, ok := new(big.Int).SetString(requirements.Amount, 10)
	if !ok {
		return fmt.Errorf("invalid amount: %s", requirements.Amount)
	}
	if amount.Sign() <= 0 {
		return fmt.Errorf("amount must be positive, got: %s", requirements.Amount)
	}

	// Validate signer address
	if !aptos.IsValidAddress(c.signer.Address()) {
		return fmt.Errorf("invalid signer address: %s", c.signer.Address())
	}

	return nil
}
