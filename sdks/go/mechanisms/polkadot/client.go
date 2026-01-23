package polkadot

import (
	"context"
	"fmt"
	"math/big"
	"strconv"

	"github.com/t402-io/t402/sdks/go/types"
)

// ClientPolkadotSigner defines the interface for signing and submitting Polkadot extrinsics
type ClientPolkadotSigner interface {
	// Address returns the SS58-encoded address of the signer
	Address() string

	// SignAndSubmitExtrinsic signs and submits an asset transfer extrinsic
	// Returns the result containing the extrinsic hash, block hash, and extrinsic index
	SignAndSubmitExtrinsic(ctx context.Context, call ExtrinsicCall, network string) (*ClientExtrinsicResult, error)
}

// ExtrinsicCall represents the parameters for an assets.transfer_keep_alive extrinsic
type ExtrinsicCall struct {
	// AssetID is the on-chain asset ID (e.g., 1984 for USDT)
	AssetID int `json:"assetId"`

	// Target is the SS58-encoded recipient address
	Target string `json:"target"`

	// Amount is the atomic amount to transfer (as string for large values)
	Amount string `json:"amount"`
}

// ClientExtrinsicResult represents the result of a submitted extrinsic
type ClientExtrinsicResult struct {
	// ExtrinsicHash is the 0x-prefixed hex hash of the extrinsic
	ExtrinsicHash string `json:"extrinsicHash"`

	// BlockHash is the 0x-prefixed hex hash of the block containing the extrinsic
	BlockHash string `json:"blockHash"`

	// ExtrinsicIndex is the index of the extrinsic within the block
	ExtrinsicIndex int `json:"extrinsicIndex"`
}

// ClientConfig holds optional configuration for the client
type ClientConfig struct {
	// RPCURL overrides the default RPC endpoint for the network
	RPCURL string
}

// ExactDirectPolkadotClient implements the SchemeNetworkClient interface for Polkadot exact-direct payments (V2)
type ExactDirectPolkadotClient struct {
	signer ClientPolkadotSigner
	config *ClientConfig
}

// NewExactDirectPolkadotClient creates a new ExactDirectPolkadotClient
// Config is optional - if not provided, uses network defaults
func NewExactDirectPolkadotClient(signer ClientPolkadotSigner, config ...*ClientConfig) *ExactDirectPolkadotClient {
	var cfg *ClientConfig
	if len(config) > 0 {
		cfg = config[0]
	}
	return &ExactDirectPolkadotClient{
		signer: signer,
		config: cfg,
	}
}

// Scheme returns the scheme identifier
func (c *ExactDirectPolkadotClient) Scheme() string {
	return SchemeExactDirect
}

// CreatePaymentPayload creates a V2 payment payload by executing the transfer directly on-chain
func (c *ExactDirectPolkadotClient) CreatePaymentPayload(
	ctx context.Context,
	requirements types.PaymentRequirements,
) (types.PaymentPayload, error) {
	// Validate network
	networkStr := requirements.Network
	if !IsPolkadotNetwork(networkStr) {
		return types.PaymentPayload{}, fmt.Errorf("unsupported network: %s", networkStr)
	}

	// Verify the network is configured
	_, ok := GetNetworkConfig(networkStr)
	if !ok {
		return types.PaymentPayload{}, fmt.Errorf("unknown polkadot network: %s", networkStr)
	}

	// Validate required fields
	if requirements.PayTo == "" {
		return types.PaymentPayload{}, fmt.Errorf("payTo address is required")
	}
	if requirements.Amount == "" {
		return types.PaymentPayload{}, fmt.Errorf("amount is required")
	}

	// Validate payTo address
	if !IsValidAddress(requirements.PayTo) {
		return types.PaymentPayload{}, fmt.Errorf("invalid payTo address: %s", requirements.PayTo)
	}

	// Validate amount is a positive integer
	amount := new(big.Int)
	if _, ok := amount.SetString(requirements.Amount, 10); !ok {
		return types.PaymentPayload{}, fmt.Errorf("invalid amount format: %s", requirements.Amount)
	}
	if amount.Sign() <= 0 {
		return types.PaymentPayload{}, fmt.Errorf("amount must be positive: %s", requirements.Amount)
	}

	// Determine asset ID from requirements or use default
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
	call := ExtrinsicCall{
		AssetID: assetID,
		Target:  requirements.PayTo,
		Amount:  requirements.Amount,
	}

	// Sign and submit the extrinsic
	result, err := c.signer.SignAndSubmitExtrinsic(ctx, call, networkStr)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to sign and submit extrinsic: %w", err)
	}

	// Validate result
	if result.ExtrinsicHash == "" && result.BlockHash == "" {
		return types.PaymentPayload{}, fmt.Errorf("extrinsic result missing both extrinsic hash and block hash")
	}

	// Build the payload
	polkadotPayload := &ExactDirectPayload{
		ExtrinsicHash:  result.ExtrinsicHash,
		BlockHash:      result.BlockHash,
		ExtrinsicIndex: result.ExtrinsicIndex,
		From:           from,
		To:             requirements.PayTo,
		Amount:         requirements.Amount,
		AssetID:        assetID,
	}

	// Return V2 payload
	return types.PaymentPayload{
		T402Version: 2,
		Payload:     polkadotPayload.ToMap(),
	}, nil
}

// resolveAssetID determines the asset ID from requirements extra fields or network defaults
func (c *ExactDirectPolkadotClient) resolveAssetID(requirements types.PaymentRequirements) (int, error) {
	// Try to get asset ID from extra fields
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
		assetID, err := ParseAssetIdentifier(requirements.Asset)
		if err == nil {
			return assetID, nil
		}
	}

	// Fall back to network default token
	networkConfig, ok := GetNetworkConfig(requirements.Network)
	if !ok {
		return 0, fmt.Errorf("no default asset for network: %s", requirements.Network)
	}

	return networkConfig.DefaultToken.AssetID, nil
}

// ParseAssetIdentifier parses a CAIP-19 asset identifier (e.g., "polkadot:68d.../asset:1984")
// and returns the asset ID
func ParseAssetIdentifier(asset string) (int, error) {
	// Look for "/asset:" pattern
	const prefix = "/asset:"
	for i := 0; i < len(asset); i++ {
		if i+len(prefix) <= len(asset) && asset[i:i+len(prefix)] == prefix {
			idStr := asset[i+len(prefix):]
			id, err := strconv.Atoi(idStr)
			if err != nil {
				return 0, fmt.Errorf("invalid asset ID in identifier: %s", asset)
			}
			return id, nil
		}
	}
	return 0, fmt.Errorf("asset identifier does not contain /asset: prefix: %s", asset)
}
