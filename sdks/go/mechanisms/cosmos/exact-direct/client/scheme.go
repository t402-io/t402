// Package client provides the client-side implementation for Cosmos exact-direct payments.
package client

import (
	"context"
	"fmt"

	"github.com/t402-io/t402/sdks/go/mechanisms/cosmos"
	"github.com/t402-io/t402/sdks/go/types"
)

// CosmosSigner defines the interface for Cosmos client-side signing operations
type CosmosSigner interface {
	// GetAddress returns the signer's Cosmos address
	GetAddress() string

	// SendTokens sends tokens and returns the transaction hash
	// This is a pre-signed direct transfer (exact-direct scheme)
	SendTokens(ctx context.Context, network, to, amount, denom string) (string, error)
}

// ExactDirectCosmosScheme implements the SchemeNetworkClient for Cosmos exact-direct payments
type ExactDirectCosmosScheme struct {
	signer CosmosSigner
}

// NewExactDirectCosmosScheme creates a new ExactDirectCosmosScheme client
func NewExactDirectCosmosScheme(signer CosmosSigner) *ExactDirectCosmosScheme {
	return &ExactDirectCosmosScheme{
		signer: signer,
	}
}

// Scheme returns the scheme identifier
func (c *ExactDirectCosmosScheme) Scheme() string {
	return cosmos.SchemeExactDirect
}

// CreatePaymentPayload creates a payment payload by executing the transfer
func (c *ExactDirectCosmosScheme) CreatePaymentPayload(
	ctx context.Context,
	requirements types.PaymentRequirements,
) (types.PaymentPayload, error) {
	// Get network config
	config, ok := cosmos.GetNetworkConfig(requirements.Network)
	if !ok {
		return types.PaymentPayload{}, fmt.Errorf("unsupported network: %s", requirements.Network)
	}

	// Determine denom
	denom := cosmos.USDCDenom
	if requirements.Asset != "" {
		// Check if asset is a symbol or denom
		token, ok := cosmos.GetTokenInfo(requirements.Network, requirements.Asset)
		if ok {
			denom = token.Denom
		} else {
			// Assume it's already a denom
			denom = requirements.Asset
		}
	}

	// Validate recipient address
	if !cosmos.IsValidAddress(requirements.PayTo, config.Bech32Prefix) {
		return types.PaymentPayload{}, fmt.Errorf("invalid recipient address: %s", requirements.PayTo)
	}

	// Execute the transfer
	txHash, err := c.signer.SendTokens(
		ctx,
		requirements.Network,
		requirements.PayTo,
		requirements.Amount,
		denom,
	)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to send tokens: %w", err)
	}

	// Create payload
	payload := &cosmos.ExactDirectPayload{
		TxHash: txHash,
		From:   c.signer.GetAddress(),
		To:     requirements.PayTo,
		Amount: requirements.Amount,
		Denom:  denom,
	}

	return types.PaymentPayload{
		T402Version: 2,
		Accepted: types.PaymentRequirements{
			Scheme:  cosmos.SchemeExactDirect,
			Network: requirements.Network,
			Asset:   denom,
			Amount:  requirements.Amount,
			PayTo:   requirements.PayTo,
		},
		Payload: payload.ToMap(),
	}, nil
}
