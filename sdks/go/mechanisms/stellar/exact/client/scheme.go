package client

import (
	"context"
	"fmt"
	"strconv"

	"github.com/t402-io/t402/sdks/go/mechanisms/stellar"
	"github.com/t402-io/t402/sdks/go/types"
)

// ExactStellarScheme implements the SchemeNetworkClient interface for Stellar exact payments (V2)
type ExactStellarScheme struct {
	signer stellar.ClientStellarSigner
	config *stellar.ClientConfig // Optional custom configuration
}

// NewExactStellarScheme creates a new ExactStellarScheme
// Config is optional - if not provided, uses network defaults
func NewExactStellarScheme(signer stellar.ClientStellarSigner, config ...*stellar.ClientConfig) *ExactStellarScheme {
	var cfg *stellar.ClientConfig
	if len(config) > 0 {
		cfg = config[0]
	}
	return &ExactStellarScheme{
		signer: signer,
		config: cfg,
	}
}

// Scheme returns the scheme identifier
func (c *ExactStellarScheme) Scheme() string {
	return stellar.SchemeExact
}

// CreatePaymentPayload creates a V2 payment payload for the Exact scheme
func (c *ExactStellarScheme) CreatePaymentPayload(
	ctx context.Context,
	requirements types.PaymentRequirements,
) (types.PaymentPayload, error) {
	// Validate network
	networkStr := string(requirements.Network)
	if !stellar.IsValidNetwork(networkStr) {
		return types.PaymentPayload{}, fmt.Errorf("unsupported network: %s", requirements.Network)
	}

	// Validate required fields
	if requirements.Asset == "" {
		return types.PaymentPayload{}, fmt.Errorf("asset (token contract address) is required")
	}
	if requirements.PayTo == "" {
		return types.PaymentPayload{}, fmt.Errorf("payTo address is required")
	}
	if requirements.Amount == "" {
		return types.PaymentPayload{}, fmt.Errorf("amount is required")
	}

	// Validate amount is numeric
	if _, err := strconv.ParseUint(requirements.Amount, 10, 64); err != nil {
		return types.PaymentPayload{}, fmt.Errorf("invalid amount: %w", err)
	}

	// Get current ledger for expiration calculation
	currentLedger, err := c.signer.GetCurrentLedger(ctx)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to get current ledger: %w", err)
	}

	// Calculate max ledger for transaction validity
	timeoutSeconds := int(requirements.MaxTimeoutSeconds)
	if timeoutSeconds == 0 {
		timeoutSeconds = stellar.DefaultTimeoutSeconds
	}
	maxLedger := stellar.CalculateMaxLedger(currentLedger, timeoutSeconds)

	// Get network passphrase
	networkPassphrase, err := stellar.GetNetworkPassphrase(networkStr)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to get network passphrase: %w", err)
	}

	// Sign the Soroban transfer transaction
	signedXDR, err := c.signer.SignTransaction(ctx, stellar.SignTransactionParams{
		To:                requirements.PayTo,
		TokenContract:     requirements.Asset,
		Amount:            requirements.Amount,
		MaxLedger:         maxLedger,
		NetworkPassphrase: networkPassphrase,
	})
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to sign transaction: %w", err)
	}

	// Build authorization metadata
	authorization := stellar.ExactStellarAuthorization{
		From:          c.signer.Address(),
		To:            requirements.PayTo,
		TokenContract: requirements.Asset,
		Amount:        requirements.Amount,
		MaxLedger:     maxLedger,
		Network:       networkStr,
	}

	// Create Stellar payload
	stellarPayload := &stellar.ExactStellarPayload{
		SignedXDR:     signedXDR,
		Authorization: authorization,
	}

	// Return partial V2 payload (core will add accepted, resource, extensions)
	return types.PaymentPayload{
		T402Version: 2,
		Payload:     stellarPayload.ToMap(),
	}, nil
}
