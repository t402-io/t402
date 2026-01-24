package server

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"strings"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/stacks"
	"github.com/t402-io/t402/sdks/go/types"
)

// ExactDirectStacksServerConfig holds optional configuration for the server
type ExactDirectStacksServerConfig struct {
	// PreferredToken is the preferred token symbol (e.g., "sUSDC").
	// Defaults to the network's default token if not set.
	PreferredToken string
}

// ExactDirectStacksScheme implements the SchemeNetworkServer interface for Stacks exact-direct payments (V2)
type ExactDirectStacksScheme struct {
	moneyParsers []t402.MoneyParser
	config       ExactDirectStacksServerConfig
}

// NewExactDirectStacksScheme creates a new ExactDirectStacksScheme server.
//
// Args:
//
//	config: Optional configuration (pass nil for defaults)
func NewExactDirectStacksScheme(config *ExactDirectStacksServerConfig) *ExactDirectStacksScheme {
	cfg := ExactDirectStacksServerConfig{}
	if config != nil {
		cfg = *config
	}
	return &ExactDirectStacksScheme{
		moneyParsers: []t402.MoneyParser{},
		config:       cfg,
	}
}

// Scheme returns the scheme identifier
func (s *ExactDirectStacksScheme) Scheme() string {
	return stacks.SchemeExactDirect
}

// RegisterMoneyParser registers a custom money parser in the parser chain.
// Multiple parsers can be registered - they will be tried in registration order.
// Each parser receives a decimal amount (e.g., 1.50 for $1.50).
// If a parser returns nil, the next parser in the chain will be tried.
// The default parser is always the final fallback.
//
// Args:
//
//	parser: Custom function to convert amount to AssetAmount (or nil to skip)
//
// Returns:
//
//	The server instance for chaining
func (s *ExactDirectStacksScheme) RegisterMoneyParser(parser t402.MoneyParser) *ExactDirectStacksScheme {
	s.moneyParsers = append(s.moneyParsers, parser)
	return s
}

// ParsePrice parses a price and converts it to an asset amount (V2).
// If price is already an AssetAmount (map with "amount" key), returns it directly.
// If price is Money (string | number), parses to decimal and tries custom parsers.
// Falls back to default conversion if all custom parsers return nil.
//
// Args:
//
//	price: The price to parse (can be string, float64, int, or map[string]interface{})
//	network: The network identifier (e.g., "stacks:1")
//
// Returns:
//
//	AssetAmount with amount (in atomic units), asset identifier, and optional extra fields
func (s *ExactDirectStacksScheme) ParsePrice(price t402.Price, network t402.Network) (t402.AssetAmount, error) {
	networkStr := string(network)

	// Validate network prefix
	if !stacks.IsStacksNetwork(networkStr) {
		return t402.AssetAmount{}, fmt.Errorf("invalid stacks network: %s", networkStr)
	}

	// Get network config
	networkConfig, err := stacks.GetNetworkConfig(networkStr)
	if err != nil {
		return t402.AssetAmount{}, fmt.Errorf("unknown stacks network: %s", networkStr)
	}

	// Handle pre-parsed price object (map with "amount" key)
	if priceMap, ok := price.(map[string]interface{}); ok {
		if amountVal, hasAmount := priceMap["amount"]; hasAmount {
			amountStr, ok := amountVal.(string)
			if !ok {
				return t402.AssetAmount{}, fmt.Errorf("amount must be a string")
			}

			// Default to network's asset identifier
			asset := s.createAssetIdentifier(networkStr, networkConfig.DefaultToken.ContractAddress)
			if assetVal, hasAsset := priceMap["asset"]; hasAsset {
				if assetStr, ok := assetVal.(string); ok {
					asset = assetStr
				}
			}

			extra := make(map[string]interface{})
			if extraVal, hasExtra := priceMap["extra"]; hasExtra {
				if extraMap, ok := extraVal.(map[string]interface{}); ok {
					extra = extraMap
				}
			}

			return t402.AssetAmount{
				Amount: amountStr,
				Asset:  asset,
				Extra:  extra,
			}, nil
		}
	}

	// Parse Money to decimal number
	decimalAmount, err := s.parseMoneyToDecimal(price)
	if err != nil {
		return t402.AssetAmount{}, err
	}

	// Try each custom money parser in order
	for _, parser := range s.moneyParsers {
		result, err := parser(decimalAmount, network)
		if err != nil {
			// Parser returned an error, skip it
			continue
		}
		if result != nil {
			// Parser handled the conversion
			return *result, nil
		}
		// Parser returned nil, try next one
	}

	// All custom parsers returned nil, use default conversion
	return s.defaultMoneyConversion(decimalAmount, networkStr, networkConfig)
}

// EnhancePaymentRequirements adds Stacks-specific enhancements to V2 payment requirements.
// It sets the asset to the default token if not specified, converts decimal amounts
// to atomic units, and adds asset metadata (contractAddress, symbol, decimals, networkName)
// to the extra fields.
//
// Args:
//
//	ctx: Context (unused, for interface compliance)
//	requirements: Base payment requirements with amount/asset already set
//	supportedKind: The supported kind from facilitator's /supported endpoint
//	extensionKeys: Extensions supported by the facilitator
//
// Returns:
//
//	Enhanced payment requirements ready to be sent to clients
func (s *ExactDirectStacksScheme) EnhancePaymentRequirements(
	ctx context.Context,
	requirements types.PaymentRequirements,
	supportedKind types.SupportedKind,
	extensionKeys []string,
) (types.PaymentRequirements, error) {
	_ = ctx

	// Get network config
	networkStr := requirements.Network
	networkConfig, err := stacks.GetNetworkConfig(networkStr)
	if err != nil {
		return requirements, fmt.Errorf("unknown stacks network: %s", networkStr)
	}

	// Determine token info
	token := s.getDefaultToken(networkConfig)

	// Set asset identifier if not already set
	if requirements.Asset == "" {
		requirements.Asset = s.createAssetIdentifier(networkStr, token.ContractAddress)
	}

	// Convert decimal amount to atomic units if needed
	if requirements.Amount != "" && strings.Contains(requirements.Amount, ".") {
		atomicAmount, err := toAtomicUnits(requirements.Amount, token.Decimals)
		if err != nil {
			return requirements, fmt.Errorf("failed to parse amount: %w", err)
		}
		requirements.Amount = strconv.FormatUint(atomicAmount, 10)
	}

	// Initialize extra map if needed
	if requirements.Extra == nil {
		requirements.Extra = make(map[string]interface{})
	}

	// Add asset metadata to extra
	requirements.Extra["contractAddress"] = token.ContractAddress
	requirements.Extra["assetSymbol"] = token.Symbol
	requirements.Extra["assetDecimals"] = token.Decimals
	requirements.Extra["networkName"] = networkConfig.Name

	// Copy facilitator-provided extra fields from supportedKind (override defaults)
	if supportedKind.Extra != nil {
		if contractAddress, ok := supportedKind.Extra["contractAddress"]; ok {
			requirements.Extra["contractAddress"] = contractAddress
		}
		if assetSymbol, ok := supportedKind.Extra["assetSymbol"]; ok {
			requirements.Extra["assetSymbol"] = assetSymbol
		}
		if assetDecimals, ok := supportedKind.Extra["assetDecimals"]; ok {
			requirements.Extra["assetDecimals"] = assetDecimals
		}
		if networkName, ok := supportedKind.Extra["networkName"]; ok {
			requirements.Extra["networkName"] = networkName
		}
	}

	// Copy extension keys from supportedKind if provided
	if supportedKind.Extra != nil {
		for _, key := range extensionKeys {
			if val, ok := supportedKind.Extra[key]; ok {
				requirements.Extra[key] = val
			}
		}
	}

	return requirements, nil
}

// parseMoneyToDecimal converts Money (string | number) to a decimal amount.
// Handles formats like "$1.50", "1.50", 1.50, etc.
func (s *ExactDirectStacksScheme) parseMoneyToDecimal(price t402.Price) (float64, error) {
	// Handle string prices
	if priceStr, ok := price.(string); ok {
		// Remove $ sign and whitespace
		cleanPrice := strings.TrimSpace(priceStr)
		cleanPrice = strings.TrimPrefix(cleanPrice, "$")
		cleanPrice = strings.TrimSpace(cleanPrice)

		// Use the first space-separated part as the amount
		parts := strings.Fields(cleanPrice)
		if len(parts) >= 1 {
			amount, err := strconv.ParseFloat(parts[0], 64)
			if err != nil {
				return 0, fmt.Errorf("failed to parse price string '%s': %w", priceStr, err)
			}
			return amount, nil
		}
	}

	// Handle numeric input
	switch v := price.(type) {
	case float64:
		return v, nil
	case int:
		return float64(v), nil
	case int64:
		return float64(v), nil
	}

	return 0, fmt.Errorf("invalid price format: %v", price)
}

// defaultMoneyConversion converts decimal amount to the default token's atomic units.
func (s *ExactDirectStacksScheme) defaultMoneyConversion(amount float64, networkStr string, config *stacks.NetworkConfig) (t402.AssetAmount, error) {
	token := config.DefaultToken

	// Convert decimal to smallest unit (e.g., $1.50 -> 1500000 for sUSDC with 6 decimals)
	amountStr := fmt.Sprintf("%.*f", token.Decimals, amount)
	parsedAmount, err := toAtomicUnits(amountStr, token.Decimals)
	if err != nil {
		return t402.AssetAmount{}, fmt.Errorf("failed to convert amount: %w", err)
	}

	return t402.AssetAmount{
		Amount: strconv.FormatUint(parsedAmount, 10),
		Asset:  s.createAssetIdentifier(networkStr, token.ContractAddress),
		Extra: map[string]interface{}{
			"symbol":          token.Symbol,
			"name":            token.Name,
			"decimals":        token.Decimals,
			"contractAddress": token.ContractAddress,
		},
	}, nil
}

// getDefaultToken returns the default token for a network, considering the preferred token config.
func (s *ExactDirectStacksScheme) getDefaultToken(config *stacks.NetworkConfig) stacks.TokenInfo {
	if s.config.PreferredToken != "" {
		if config.DefaultToken.Symbol == s.config.PreferredToken {
			return config.DefaultToken
		}
	}
	return config.DefaultToken
}

// createAssetIdentifier creates an asset identifier for Stacks tokens.
// Format: {network}/token:{contractAddress}
func (s *ExactDirectStacksScheme) createAssetIdentifier(network, contractAddress string) string {
	return fmt.Sprintf("%s/token:%s", network, contractAddress)
}

// toAtomicUnits converts a decimal string amount to atomic units.
// For example, with decimals=6: "1.50" -> 1500000
func toAtomicUnits(amount string, decimals int) (uint64, error) {
	amount = strings.TrimSpace(amount)

	// Parse as float64
	parsed, err := strconv.ParseFloat(amount, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid amount: %w", err)
	}

	if parsed < 0 {
		return 0, fmt.Errorf("amount must be non-negative")
	}

	// Convert to atomic units
	multiplier := math.Pow(10, float64(decimals))
	atomicFloat := parsed * multiplier

	// Round to avoid floating point issues
	atomicInt := uint64(math.Round(atomicFloat))

	return atomicInt, nil
}

// GetSupportedNetworks returns all supported Stacks network identifiers
func GetSupportedNetworks() []string {
	networks := make([]string, 0, len(stacks.Networks))
	for network := range stacks.Networks {
		networks = append(networks, network)
	}
	return networks
}

// IsNetworkSupported checks if a network identifier is supported
func IsNetworkSupported(network string) bool {
	_, err := stacks.GetNetworkConfig(network)
	return err == nil
}
