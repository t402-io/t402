package client

import (
	"context"
	"fmt"
	"math/big"
	"strconv"
	"strings"

	"github.com/t402-io/t402/sdks/go/mechanisms/polkadot"
	"github.com/t402-io/t402/sdks/go/types"
)

// ClientPolkadotSigner defines the interface for signing and submitting Polkadot extrinsics
type ClientPolkadotSigner interface {
	// Address returns the SS58-encoded address of the signer
	Address() string

	// SignAndSubmitExtrinsic signs and submits an asset transfer extrinsic.
	// Returns the result containing the extrinsic hash, block hash, and extrinsic index.
	//
	// Args:
	//   ctx: Context for cancellation and timeouts
	//   call: The extrinsic call parameters (assets.transfer_keep_alive)
	//   network: The CAIP-2 network identifier (e.g., "polkadot:68d56f15f85d3136970ec16946040bc1")
	//
	// Returns:
	//   ExtrinsicResult with hash and block info on success, or an error
	SignAndSubmitExtrinsic(ctx context.Context, call polkadot.ExtrinsicCall, network string) (*polkadot.ClientExtrinsicResult, error)
}

// ExactDirectPolkadotClientConfig holds optional configuration for the client
type ExactDirectPolkadotClientConfig struct {
	// RPCURL overrides the default RPC endpoint for the network
	RPCURL string
}

// ExactDirectPolkadotScheme implements the SchemeNetworkClient interface for Polkadot exact-direct payments (V2).
//
// The exact-direct scheme has the client execute the assets.transfer_keep_alive extrinsic
// directly on-chain. The extrinsic hash is then used as proof of payment.
type ExactDirectPolkadotScheme struct {
	signer ClientPolkadotSigner
	config ExactDirectPolkadotClientConfig
}

// NewExactDirectPolkadotScheme creates a new ExactDirectPolkadotScheme client.
//
// Args:
//
//	signer: The Polkadot signer for executing extrinsics
//	config: Optional configuration (pass nil for defaults)
func NewExactDirectPolkadotScheme(signer ClientPolkadotSigner, config *ExactDirectPolkadotClientConfig) *ExactDirectPolkadotScheme {
	cfg := ExactDirectPolkadotClientConfig{}
	if config != nil {
		cfg = *config
	}
	return &ExactDirectPolkadotScheme{
		signer: signer,
		config: cfg,
	}
}

// Scheme returns the scheme identifier
func (c *ExactDirectPolkadotScheme) Scheme() string {
	return polkadot.SchemeExactDirect
}

// CreatePaymentPayload creates a V2 payment payload by executing the assets.transfer_keep_alive
// extrinsic on-chain and returning the extrinsic hash as proof of payment.
//
// Args:
//
//	ctx: Context for cancellation and timeouts
//	requirements: The payment requirements specifying amount, asset, payTo, and network
//
// Returns:
//
//	PaymentPayload with the extrinsic hash, block hash, and index in the payload field
func (c *ExactDirectPolkadotScheme) CreatePaymentPayload(
	ctx context.Context,
	requirements types.PaymentRequirements,
) (types.PaymentPayload, error) {
	// Validate requirements
	if err := c.validateRequirements(requirements); err != nil {
		return types.PaymentPayload{}, err
	}

	// Determine asset ID from requirements
	assetID, err := c.resolveAssetID(requirements)
	if err != nil {
		return types.PaymentPayload{}, err
	}

	// Get sender address
	from := c.signer.Address()
	if from == "" {
		return types.PaymentPayload{}, fmt.Errorf("signer address is empty")
	}

	// Build the extrinsic call (assets.transfer_keep_alive)
	call := polkadot.ExtrinsicCall{
		AssetID: assetID,
		Target:  requirements.PayTo,
		Amount:  requirements.Amount,
	}

	// Sign and submit the extrinsic
	result, err := c.signer.SignAndSubmitExtrinsic(ctx, call, requirements.Network)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to sign and submit extrinsic: %w", err)
	}

	// Validate result - must have at least one identifier
	if result.ExtrinsicHash == "" && result.BlockHash == "" {
		return types.PaymentPayload{}, fmt.Errorf("extrinsic result missing both extrinsic hash and block hash")
	}

	// Build the payload
	polkadotPayload := &polkadot.ExactDirectPayload{
		ExtrinsicHash:  result.ExtrinsicHash,
		BlockHash:      result.BlockHash,
		ExtrinsicIndex: result.ExtrinsicIndex,
		From:           from,
		To:             requirements.PayTo,
		Amount:         requirements.Amount,
		AssetID:        assetID,
	}

	return types.PaymentPayload{
		T402Version: 2,
		Payload:     polkadotPayload.ToMap(),
	}, nil
}

// validateRequirements validates the payment requirements for Polkadot exact-direct
func (c *ExactDirectPolkadotScheme) validateRequirements(requirements types.PaymentRequirements) error {
	// Validate scheme
	if requirements.Scheme != "" && requirements.Scheme != polkadot.SchemeExactDirect {
		return fmt.Errorf("invalid scheme: expected %s, got %s", polkadot.SchemeExactDirect, requirements.Scheme)
	}

	// Validate network prefix
	if !strings.HasPrefix(requirements.Network, "polkadot:") {
		return fmt.Errorf("unsupported network: %s (expected polkadot:* format)", requirements.Network)
	}

	// Validate network is known
	if _, ok := polkadot.GetNetworkConfig(requirements.Network); !ok {
		return fmt.Errorf("unknown polkadot network: %s", requirements.Network)
	}

	// Validate payTo address
	if requirements.PayTo == "" {
		return fmt.Errorf("payTo address is required")
	}
	if !polkadot.IsValidAddress(requirements.PayTo) {
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

// resolveAssetID determines the asset ID from requirements extra fields, asset field, or network defaults.
// Priority: extra["assetId"] > CAIP-19 asset field > network default token
func (c *ExactDirectPolkadotScheme) resolveAssetID(requirements types.PaymentRequirements) (int, error) {
	// Try to get asset ID from extra fields (highest priority)
	if requirements.Extra != nil {
		if assetIDVal, ok := requirements.Extra["assetId"]; ok {
			switch v := assetIDVal.(type) {
			case float64:
				return int(v), nil
			case int:
				return v, nil
			case int64:
				return int(v), nil
			case string:
				id, err := strconv.Atoi(v)
				if err != nil {
					return 0, fmt.Errorf("invalid assetId string: %s", v)
				}
				return id, nil
			}
		}
	}

	// Try to get from asset field (CAIP-19 format: network/asset:id)
	if requirements.Asset != "" {
		assetID, err := parseAssetIdentifier(requirements.Asset)
		if err == nil {
			return assetID, nil
		}
	}

	// Fall back to network default token
	networkConfig, ok := polkadot.GetNetworkConfig(requirements.Network)
	if !ok {
		return 0, fmt.Errorf("no default asset for network: %s", requirements.Network)
	}

	return networkConfig.DefaultToken.AssetID, nil
}

// parseAssetIdentifier parses a CAIP-19 asset identifier (e.g., "polkadot:68d.../asset:1984")
// and returns the asset ID
func parseAssetIdentifier(asset string) (int, error) {
	const prefix = "/asset:"
	idx := strings.LastIndex(asset, prefix)
	if idx == -1 {
		return 0, fmt.Errorf("asset identifier does not contain /asset: prefix: %s", asset)
	}

	idStr := asset[idx+len(prefix):]
	id, err := strconv.Atoi(idStr)
	if err != nil {
		return 0, fmt.Errorf("invalid asset ID in identifier: %s", asset)
	}

	return id, nil
}
