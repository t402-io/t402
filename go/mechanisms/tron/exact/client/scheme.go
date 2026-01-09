package client

import (
	"context"
	"fmt"
	"time"

	"github.com/t402-io/t402/go/mechanisms/tron"
	"github.com/t402-io/t402/go/types"
)

// ExactTronScheme implements the SchemeNetworkClient interface for TRON exact payments (V2)
type ExactTronScheme struct {
	signer tron.ClientTronSigner
	config *tron.ClientConfig // Optional custom configuration
}

// NewExactTronScheme creates a new ExactTronScheme
// Config is optional - if not provided, uses network defaults
func NewExactTronScheme(signer tron.ClientTronSigner, config ...*tron.ClientConfig) *ExactTronScheme {
	var cfg *tron.ClientConfig
	if len(config) > 0 {
		cfg = config[0]
	}
	return &ExactTronScheme{
		signer: signer,
		config: cfg,
	}
}

// Scheme returns the scheme identifier
func (c *ExactTronScheme) Scheme() string {
	return tron.SchemeExact
}

// CreatePaymentPayload creates a V2 payment payload for the Exact scheme
func (c *ExactTronScheme) CreatePaymentPayload(
	ctx context.Context,
	requirements types.PaymentRequirements,
) (types.PaymentPayload, error) {
	// Validate network
	networkStr := string(requirements.Network)
	if !tron.IsValidNetwork(networkStr) {
		return types.PaymentPayload{}, fmt.Errorf("unsupported network: %s", requirements.Network)
	}

	// Validate required fields
	if requirements.Asset == "" {
		return types.PaymentPayload{}, fmt.Errorf("asset (TRC20 contract address) is required")
	}
	if requirements.PayTo == "" {
		return types.PaymentPayload{}, fmt.Errorf("payTo address is required")
	}
	if requirements.Amount == "" {
		return types.PaymentPayload{}, fmt.Errorf("amount is required")
	}

	// Validate addresses
	if !tron.ValidateTronAddress(requirements.Asset) {
		return types.PaymentPayload{}, fmt.Errorf("invalid TRC20 contract address: %s", requirements.Asset)
	}
	if !tron.ValidateTronAddress(requirements.PayTo) {
		return types.PaymentPayload{}, fmt.Errorf("invalid payTo address: %s", requirements.PayTo)
	}
	if !tron.ValidateTronAddress(c.signer.Address()) {
		return types.PaymentPayload{}, fmt.Errorf("invalid signer address: %s", c.signer.Address())
	}

	// Get block info for transaction
	blockInfo, err := c.signer.GetBlockInfo(ctx)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to get block info: %w", err)
	}

	// Get fee limit
	feeLimit := int64(tron.DefaultFeeLimit)
	if c.config != nil && c.config.FeeLimit > 0 {
		feeLimit = c.config.FeeLimit
	}

	// Sign the transaction
	signedTransaction, err := c.signer.SignTransaction(ctx, tron.SignTransactionParams{
		ContractAddress: requirements.Asset,
		To:              requirements.PayTo,
		Amount:          requirements.Amount,
		FeeLimit:        feeLimit,
		Expiration:      blockInfo.Expiration,
	})
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to sign transaction: %w", err)
	}

	// Build authorization metadata
	authorization := tron.ExactTronAuthorization{
		From:            c.signer.Address(),
		To:              requirements.PayTo,
		ContractAddress: requirements.Asset,
		Amount:          requirements.Amount,
		Expiration:      blockInfo.Expiration,
		RefBlockBytes:   blockInfo.RefBlockBytes,
		RefBlockHash:    blockInfo.RefBlockHash,
		Timestamp:       time.Now().UnixMilli(),
	}

	// Create TRON payload
	tronPayload := &tron.ExactTronPayload{
		SignedTransaction: signedTransaction,
		Authorization:     authorization,
	}

	// Return partial V2 payload (core will add accepted, resource, extensions)
	return types.PaymentPayload{
		T402Version: 2,
		Payload:     tronPayload.ToMap(),
	}, nil
}
