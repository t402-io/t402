package tezos

import (
	"context"
	"fmt"
	"math"
	"math/big"
	"strconv"
	"strings"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/types"
)

// ExactDirectTezosServerConfig contains configuration for the ExactDirectTezosServer.
type ExactDirectTezosServerConfig struct {
	// PreferredToken specifies the preferred token symbol (e.g., "USDt").
	// If set, this token will be used for price conversions when available on the network.
	// Defaults to the network's default token.
	PreferredToken string
}

// ExactDirectTezosServer implements the SchemeNetworkServer interface for Tezos
// exact-direct payments. It handles price parsing and enhancement of payment
// requirements with Tezos-specific FA2 asset information.
type ExactDirectTezosServer struct {
	config       ExactDirectTezosServerConfig
	moneyParsers []t402.MoneyParser
}

// NewExactDirectTezosServer creates a new ExactDirectTezosServer with the given configuration.
//
// Args:
//
//	config: Server configuration (can pass empty struct for defaults)
//
// Returns:
//
//	Configured ExactDirectTezosServer instance
func NewExactDirectTezosServer(config ExactDirectTezosServerConfig) *ExactDirectTezosServer {
	return &ExactDirectTezosServer{
		config:       config,
		moneyParsers: []t402.MoneyParser{},
	}
}

// Scheme returns the scheme identifier.
func (s *ExactDirectTezosServer) Scheme() string {
	return SchemeExactDirect
}

// RegisterMoneyParser registers a custom money parser in the parser chain.
// Multiple parsers can be registered - they will be tried in registration order.
// Each parser receives a decimal amount (e.g., 1.50 for $1.50) and a network.
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
func (s *ExactDirectTezosServer) RegisterMoneyParser(parser t402.MoneyParser) *ExactDirectTezosServer {
	s.moneyParsers = append(s.moneyParsers, parser)
	return s
}

// ParsePrice parses a price and converts it to an asset amount for Tezos.
// If price is already an AssetAmount (map with "amount" and "asset"), returns it directly.
// If price is Money (string | number), parses to decimal and tries custom parsers.
// Falls back to default conversion (USDt with 6 decimals) if all custom parsers return nil.
//
// Args:
//
//	price: The price to parse (can be string, number, or AssetAmount map)
//	network: The network identifier (must be a Tezos network)
//
// Returns:
//
//	AssetAmount with amount in atomic units, CAIP-19 asset identifier, and optional extra fields
func (s *ExactDirectTezosServer) ParsePrice(price t402.Price, network t402.Network) (t402.AssetAmount, error) {
	networkStr := string(network)

	// Validate network
	if !IsTezosNetwork(networkStr) {
		return t402.AssetAmount{}, fmt.Errorf("invalid Tezos network: %s", networkStr)
	}

	// If already an AssetAmount (map with "amount" and "asset"), return it directly
	if priceMap, ok := price.(map[string]interface{}); ok {
		if amountVal, hasAmount := priceMap["amount"]; hasAmount {
			amountStr, ok := amountVal.(string)
			if !ok {
				return t402.AssetAmount{}, fmt.Errorf("amount must be a string")
			}

			asset := ""
			if assetVal, hasAsset := priceMap["asset"]; hasAsset {
				if assetStr, ok := assetVal.(string); ok {
					asset = assetStr
				}
			}

			if asset == "" {
				return t402.AssetAmount{}, fmt.Errorf("asset must be specified for AssetAmount on network %s", networkStr)
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
	return s.defaultMoneyConversion(decimalAmount, network)
}

// EnhancePaymentRequirements adds Tezos-specific enhancements to V2 payment requirements.
// It resolves the asset identifier to a CAIP-19 format if not already set,
// converts decimal amounts to atomic units, and copies relevant extensions
// from the supportedKind.
//
// Args:
//
//	ctx: Context for cancellation
//	requirements: The base payment requirements to enhance
//	supportedKind: The supported kind from the facilitator
//	extensionKeys: Extension keys to copy from supportedKind
//
// Returns:
//
//	Enhanced payment requirements with Tezos-specific asset info
func (s *ExactDirectTezosServer) EnhancePaymentRequirements(
	ctx context.Context,
	requirements types.PaymentRequirements,
	supportedKind types.SupportedKind,
	extensionKeys []string,
) (types.PaymentRequirements, error) {
	networkStr := requirements.Network

	// Validate network
	if !IsTezosNetwork(networkStr) {
		return requirements, fmt.Errorf("invalid Tezos network: %s", networkStr)
	}

	// Get network config
	networkConfig, ok := GetNetworkConfig(networkStr)
	if !ok {
		return requirements, fmt.Errorf("unsupported Tezos network: %s", networkStr)
	}

	// Resolve token info
	token := s.getDefaultToken(networkStr)
	if token == nil {
		return requirements, fmt.Errorf("no token configured for network %s", networkStr)
	}

	// Ensure asset is in CAIP-19 format
	if requirements.Asset == "" {
		requirements.Asset = CreateAssetIdentifier(networkStr, token.ContractAddress, token.TokenID)
	}

	// Convert decimal amount to atomic units if needed
	if requirements.Amount != "" && strings.Contains(requirements.Amount, ".") {
		atomicAmount, err := ParseDecimalToAtomic(requirements.Amount, token.Decimals)
		if err != nil {
			return requirements, fmt.Errorf("failed to parse amount: %w", err)
		}
		requirements.Amount = atomicAmount
	}

	// Initialize extra if nil
	if requirements.Extra == nil {
		requirements.Extra = make(map[string]interface{})
	}

	// Add token metadata to extra
	if _, ok := requirements.Extra["assetSymbol"]; !ok {
		requirements.Extra["assetSymbol"] = token.Symbol
	}
	if _, ok := requirements.Extra["assetDecimals"]; !ok {
		requirements.Extra["assetDecimals"] = token.Decimals
	}
	if _, ok := requirements.Extra["assetName"]; !ok {
		requirements.Extra["assetName"] = token.Name
	}

	// Add network name for convenience
	if _, ok := requirements.Extra["networkName"]; !ok {
		requirements.Extra["networkName"] = networkConfig.Name
	}

	// Copy extensions from supportedKind if provided
	if supportedKind.Extra != nil {
		for _, key := range extensionKeys {
			if val, ok := supportedKind.Extra[key]; ok {
				requirements.Extra[key] = val
			}
		}

		// Copy standard fields from supportedKind
		if assetSymbol, ok := supportedKind.Extra["assetSymbol"]; ok {
			requirements.Extra["assetSymbol"] = assetSymbol
		}
		if assetDecimals, ok := supportedKind.Extra["assetDecimals"]; ok {
			requirements.Extra["assetDecimals"] = assetDecimals
		}
	}

	return requirements, nil
}

// ValidatePaymentRequirements validates that requirements are valid for the exact-direct scheme on Tezos.
func (s *ExactDirectTezosServer) ValidatePaymentRequirements(requirements t402.PaymentRequirements) error {
	// Check network
	if !IsTezosNetwork(requirements.Network) {
		return fmt.Errorf("invalid Tezos network: %s", requirements.Network)
	}

	// Check PayTo address
	if !IsValidAddress(requirements.PayTo) {
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

	// Check asset if specified
	if requirements.Asset != "" {
		if _, err := ParseAssetIdentifier(requirements.Asset); err != nil {
			return fmt.Errorf("invalid asset: %w", err)
		}
	}

	return nil
}

// GetSupportedNetworks returns all supported Tezos networks.
func GetSupportedNetworks() []string {
	networks := make([]string, 0, len(NetworkConfigs))
	for network := range NetworkConfigs {
		networks = append(networks, network)
	}
	return networks
}

// IsNetworkSupported checks if a network is supported.
func IsNetworkSupported(network string) bool {
	_, ok := NetworkConfigs[network]
	return ok
}

// parseMoneyToDecimal converts Money (string | number) to a decimal amount.
func (s *ExactDirectTezosServer) parseMoneyToDecimal(price t402.Price) (float64, error) {
	switch v := price.(type) {
	case string:
		// Remove currency symbols and whitespace
		cleanPrice := strings.TrimSpace(v)
		cleanPrice = strings.TrimPrefix(cleanPrice, "$")
		cleanPrice = strings.TrimSuffix(cleanPrice, " USD")
		cleanPrice = strings.TrimSuffix(cleanPrice, " USDT")
		cleanPrice = strings.TrimSuffix(cleanPrice, " USDt")
		cleanPrice = strings.TrimSpace(cleanPrice)

		amount, err := strconv.ParseFloat(cleanPrice, 64)
		if err != nil {
			return 0, fmt.Errorf("failed to parse price string '%s': %w", v, err)
		}
		return amount, nil

	case float64:
		return v, nil

	case int:
		return float64(v), nil

	case int64:
		return float64(v), nil

	default:
		return 0, fmt.Errorf("unsupported price type: %T", price)
	}
}

// defaultMoneyConversion converts a decimal amount to the default asset for the network.
func (s *ExactDirectTezosServer) defaultMoneyConversion(amount float64, network t402.Network) (t402.AssetAmount, error) {
	networkStr := string(network)

	token := s.getDefaultToken(networkStr)
	if token == nil {
		return t402.AssetAmount{}, fmt.Errorf("no token configured for network %s", networkStr)
	}

	// Convert decimal amount to atomic units
	atomicAmount := decimalToAtomic(amount, token.Decimals)

	return t402.AssetAmount{
		Amount: atomicAmount,
		Asset:  CreateAssetIdentifier(networkStr, token.ContractAddress, token.TokenID),
		Extra: map[string]interface{}{
			"symbol":   token.Symbol,
			"name":     token.Name,
			"decimals": token.Decimals,
			"tokenId":  token.TokenID,
		},
	}, nil
}

// getDefaultToken returns the token info to use for price conversion on a given network.
func (s *ExactDirectTezosServer) getDefaultToken(network string) *TokenInfo {
	// If a preferred token is configured, try to use it
	if s.config.PreferredToken != "" {
		token, ok := GetTokenInfo(network, s.config.PreferredToken)
		if ok {
			return &token
		}
	}

	// Use the network's default token
	config, ok := GetNetworkConfig(network)
	if !ok {
		return nil
	}
	if config.DefaultToken.ContractAddress == "" {
		return nil
	}
	return &config.DefaultToken
}

// decimalToAtomic converts a decimal amount to atomic units string.
func decimalToAtomic(amount float64, decimals int) string {
	multiplier := math.Pow(10, float64(decimals))
	atomic := new(big.Int).SetInt64(int64(math.Round(amount * multiplier)))
	return atomic.String()
}

// ParseDecimalToAtomic converts a decimal string amount to atomic units.
//
// Args:
//
//	amount: Decimal string (e.g., "1.50")
//	decimals: Number of decimal places for the token
//
// Returns:
//
//	Atomic amount string (e.g., "1500000" for 6 decimals)
func ParseDecimalToAtomic(amount string, decimals int) (string, error) {
	// Split on decimal point
	parts := strings.Split(amount, ".")

	integerPart := parts[0]
	fractionalPart := ""
	if len(parts) == 2 {
		fractionalPart = parts[1]
	} else if len(parts) > 2 {
		return "", fmt.Errorf("invalid amount format: %s", amount)
	}

	// Pad or truncate fractional part to match decimals
	if len(fractionalPart) > decimals {
		fractionalPart = fractionalPart[:decimals]
	} else {
		fractionalPart = fractionalPart + strings.Repeat("0", decimals-len(fractionalPart))
	}

	// Combine and parse as big.Int
	combined := integerPart + fractionalPart

	// Remove leading zeros but keep at least one digit
	combined = strings.TrimLeft(combined, "0")
	if combined == "" {
		combined = "0"
	}

	result, ok := new(big.Int).SetString(combined, 10)
	if !ok {
		return "", fmt.Errorf("failed to parse amount: %s", amount)
	}

	return result.String(), nil
}
