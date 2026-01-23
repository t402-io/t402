package tezos

import (
	"context"
	"fmt"
	"math/big"
	"regexp"
	"strconv"
	"strings"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/types"
)

// ClientTezosSigner defines the interface for Tezos client-side operations.
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

// ExactDirectTezosClient implements the SchemeNetworkClient interface for Tezos
// exact-direct payments. In this scheme, the client executes the FA2 transfer
// directly on-chain and provides the operation hash as proof of payment.
type ExactDirectTezosClient struct {
	signer ClientTezosSigner
}

// NewExactDirectTezosClient creates a new ExactDirectTezosClient.
//
// Args:
//
//	signer: The client-side Tezos signer for executing FA2 transfers
//
// Returns:
//
//	Configured ExactDirectTezosClient instance
func NewExactDirectTezosClient(signer ClientTezosSigner) *ExactDirectTezosClient {
	return &ExactDirectTezosClient{
		signer: signer,
	}
}

// Scheme returns the scheme identifier.
func (c *ExactDirectTezosClient) Scheme() string {
	return SchemeExactDirect
}

// CreatePaymentPayload executes the FA2 transfer and creates a V2 payment payload.
// It validates the requirements, checks balance, executes the transfer on-chain,
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
func (c *ExactDirectTezosClient) CreatePaymentPayload(
	ctx context.Context,
	requirements types.PaymentRequirements,
) (types.PaymentPayload, error) {
	// Validate requirements
	if err := c.validateRequirements(requirements); err != nil {
		return types.PaymentPayload{}, fmt.Errorf("invalid requirements: %w", err)
	}

	// Parse asset to get contract address and token ID
	assetInfo, err := ParseAssetIdentifier(requirements.Asset)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("invalid asset identifier: %w", err)
	}

	// Parse amount
	amount, ok := new(big.Int).SetString(requirements.Amount, 10)
	if !ok {
		return types.PaymentPayload{}, fmt.Errorf("invalid amount: %s", requirements.Amount)
	}

	// Check balance
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

	// Execute FA2 transfer
	network := t402.Network(requirements.Network)
	opHash, err := c.signer.Transfer(ctx, assetInfo.ContractAddress, assetInfo.TokenID, requirements.PayTo, amount, network)
	if err != nil {
		return types.PaymentPayload{}, fmt.Errorf("failed to execute transfer: %w", err)
	}

	// Create the payload
	payload := &ExactDirectPayload{
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
func (c *ExactDirectTezosClient) validateRequirements(requirements types.PaymentRequirements) error {
	// Check scheme
	if requirements.Scheme != SchemeExactDirect {
		return fmt.Errorf("invalid scheme: expected %s, got %s", SchemeExactDirect, requirements.Scheme)
	}

	// Check network is Tezos
	if !IsTezosNetwork(requirements.Network) {
		return fmt.Errorf("invalid network: %s (expected tezos:*)", requirements.Network)
	}

	// Check payTo address
	if !IsValidAddress(requirements.PayTo) {
		return fmt.Errorf("invalid payTo address: %s", requirements.PayTo)
	}

	// Check amount
	amount, ok := new(big.Int).SetString(requirements.Amount, 10)
	if !ok || amount.Sign() <= 0 {
		return fmt.Errorf("invalid amount: %s (must be a positive integer)", requirements.Amount)
	}

	// Check asset
	if requirements.Asset == "" {
		return fmt.Errorf("asset is required")
	}
	if _, err := ParseAssetIdentifier(requirements.Asset); err != nil {
		return fmt.Errorf("invalid asset: %w", err)
	}

	return nil
}

// AssetInfo contains parsed information from a CAIP-19 asset identifier.
type AssetInfo struct {
	ContractAddress string
	TokenID         int
}

// caipAssetRegex matches CAIP-19 format: tezos:{chainRef}/fa2:{contractAddress}/{tokenId}
var caipAssetRegex = regexp.MustCompile(`^tezos:[^/]+/fa2:([^/]+)/(\d+)$`)

// simpleAssetRegex matches simple format: KT1.../tokenId or just KT1...
var simpleAssetRegex = regexp.MustCompile(`^(KT1[a-zA-Z0-9]{33})(?:/(\d+))?$`)

// ParseAssetIdentifier parses a CAIP-19 asset identifier for Tezos FA2 tokens.
// Supports two formats:
//   - CAIP-19: tezos:{chainRef}/fa2:{contractAddress}/{tokenId}
//   - Simple: {contractAddress}/{tokenId} or {contractAddress} (tokenId defaults to 0)
//
// Args:
//
//	asset: The asset identifier string
//
// Returns:
//
//	AssetInfo with contract address and token ID, or error
func ParseAssetIdentifier(asset string) (*AssetInfo, error) {
	if asset == "" {
		return nil, fmt.Errorf("asset identifier is empty")
	}

	// Try CAIP-19 format
	matches := caipAssetRegex.FindStringSubmatch(asset)
	if matches != nil {
		tokenID, err := strconv.Atoi(matches[2])
		if err != nil {
			return nil, fmt.Errorf("invalid token ID in asset: %s", asset)
		}
		return &AssetInfo{
			ContractAddress: matches[1],
			TokenID:         tokenID,
		}, nil
	}

	// Try simple format
	matches = simpleAssetRegex.FindStringSubmatch(asset)
	if matches != nil {
		tokenID := 0
		if matches[2] != "" {
			var err error
			tokenID, err = strconv.Atoi(matches[2])
			if err != nil {
				return nil, fmt.Errorf("invalid token ID in asset: %s", asset)
			}
		}
		return &AssetInfo{
			ContractAddress: matches[1],
			TokenID:         tokenID,
		}, nil
	}

	return nil, fmt.Errorf("unrecognized asset format: %s (expected tezos:{chainRef}/fa2:{contract}/{tokenId} or KT1...)", asset)
}

// IsTezosNetwork checks if a network identifier belongs to the Tezos namespace.
func IsTezosNetwork(network string) bool {
	return strings.HasPrefix(network, "tezos:")
}

// CreateAssetIdentifier creates a CAIP-19 asset identifier for a Tezos FA2 token.
//
// Args:
//
//	network: The CAIP-2 network identifier (e.g., "tezos:NetXdQprcVkpaWU")
//	contractAddress: The FA2 contract address (e.g., "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o")
//	tokenID: The token ID within the FA2 contract
//
// Returns:
//
//	CAIP-19 asset identifier string
func CreateAssetIdentifier(network, contractAddress string, tokenID int) string {
	return fmt.Sprintf("%s/fa2:%s/%d", network, contractAddress, tokenID)
}
