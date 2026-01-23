package server

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"strings"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/near"
	"github.com/t402-io/t402/sdks/go/types"
)

// ExactDirectNearServerConfig holds optional configuration for the server
type ExactDirectNearServerConfig struct {
	// PreferredToken is the preferred token symbol (e.g., "USDT").
	// Defaults to network's default token if not set.
	PreferredToken string
}

// ExactDirectNearScheme implements the SchemeNetworkServer interface for NEAR exact-direct payments (V2)
type ExactDirectNearScheme struct {
	moneyParsers []t402.MoneyParser
	config       ExactDirectNearServerConfig
}

// NewExactDirectNearScheme creates a new ExactDirectNearScheme server.
//
// Args:
//
//	config: Optional configuration (pass nil for defaults)
func NewExactDirectNearScheme(config *ExactDirectNearServerConfig) *ExactDirectNearScheme {
	cfg := ExactDirectNearServerConfig{}
	if config != nil {
		cfg = *config
	}

	return &ExactDirectNearScheme{
		moneyParsers: []t402.MoneyParser{},
		config:       cfg,
	}
}

// Scheme returns the scheme identifier
func (s *ExactDirectNearScheme) Scheme() string {
	return near.SchemeExactDirect
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
func (s *ExactDirectNearScheme) RegisterMoneyParser(parser t402.MoneyParser) *ExactDirectNearScheme {
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
//	network: The network identifier (e.g., "near:mainnet")
//
// Returns:
//
//	AssetAmount with amount (in atomic units), asset (contract ID), and optional extra fields
func (s *ExactDirectNearScheme) ParsePrice(price t402.Price, network t402.Network) (t402.AssetAmount, error) {
	networkStr := string(network)

	// Validate network
	if _, ok := near.GetNetworkConfig(networkStr); !ok {
		return t402.AssetAmount{}, fmt.Errorf("unsupported network: %s", networkStr)
	}

	// Handle pre-parsed price object (map with "amount" key)
	if priceMap, ok := price.(map[string]interface{}); ok {
		if amountVal, hasAmount := priceMap["amount"]; hasAmount {
			amountStr, ok := amountVal.(string)
			if !ok {
				return t402.AssetAmount{}, fmt.Errorf("amount must be a string")
			}

			// Get asset from map or use default
			asset := s.getDefaultToken(networkStr).ContractID
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
	return s.defaultMoneyConversion(decimalAmount, networkStr)
}

// EnhancePaymentRequirements adds scheme-specific enhancements to V2 payment requirements.
// For NEAR exact-direct, this adds asset symbol and decimals metadata from the facilitator's
// supported kinds response.
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
func (s *ExactDirectNearScheme) EnhancePaymentRequirements(
	ctx context.Context,
	requirements types.PaymentRequirements,
	supportedKind types.SupportedKind,
	extensionKeys []string,
) (types.PaymentRequirements, error) {
	_ = ctx

	networkStr := requirements.Network

	// Validate network
	if _, ok := near.GetNetworkConfig(networkStr); !ok {
		return requirements, fmt.Errorf("unsupported network: %s", networkStr)
	}

	// If asset is not set, use the default token for the network
	if requirements.Asset == "" {
		token := s.getDefaultToken(networkStr)
		requirements.Asset = token.ContractID
	}

	// If amount contains a decimal point, convert to atomic units
	if requirements.Amount != "" && strings.Contains(requirements.Amount, ".") {
		token, ok := near.GetTokenByContract(networkStr, requirements.Asset)
		if !ok {
			// If token not found in registry, default to 6 decimals
			token = near.TokenInfo{Decimals: 6}
		}
		atomicAmount, err := toAtomicUnits(requirements.Amount, token.Decimals)
		if err != nil {
			return requirements, fmt.Errorf("failed to parse amount: %w", err)
		}
		requirements.Amount = atomicAmount
	}

	// Initialize extra map if needed
	if requirements.Extra == nil {
		requirements.Extra = make(map[string]interface{})
	}

	// Add facilitator-provided extra fields (asset metadata)
	if supportedKind.Extra != nil {
		if assetSymbol, ok := supportedKind.Extra["assetSymbol"]; ok {
			requirements.Extra["assetSymbol"] = assetSymbol
		}
		if assetDecimals, ok := supportedKind.Extra["assetDecimals"]; ok {
			requirements.Extra["assetDecimals"] = assetDecimals
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
func (s *ExactDirectNearScheme) parseMoneyToDecimal(price t402.Price) (float64, error) {
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
func (s *ExactDirectNearScheme) defaultMoneyConversion(amount float64, network string) (t402.AssetAmount, error) {
	token := s.getDefaultToken(network)

	// Convert decimal to atomic units
	atomicAmount, err := toAtomicUnits(fmt.Sprintf("%f", amount), token.Decimals)
	if err != nil {
		return t402.AssetAmount{}, fmt.Errorf("failed to convert amount: %w", err)
	}

	return t402.AssetAmount{
		Amount: atomicAmount,
		Asset:  token.ContractID,
		Extra: map[string]interface{}{
			"symbol":   token.Symbol,
			"decimals": token.Decimals,
		},
	}, nil
}

// getDefaultToken returns the default token for a network.
// Priority: configured preferredToken > network default
func (s *ExactDirectNearScheme) getDefaultToken(network string) near.TokenInfo {
	// If a preferred token is configured, try to use it
	if s.config.PreferredToken != "" {
		token, ok := near.GetTokenInfo(network, s.config.PreferredToken)
		if ok {
			return token
		}
	}

	// Fall back to network default
	config, ok := near.GetNetworkConfig(network)
	if ok {
		return config.DefaultToken
	}

	// Final fallback (should not happen for valid networks)
	return near.USDTMainnet
}

// toAtomicUnits converts a decimal string amount to atomic units string.
// For example, with decimals=6: "1.50" -> "1500000"
func toAtomicUnits(amount string, decimals int) (string, error) {
	amount = strings.TrimSpace(amount)

	// Parse as float64
	parsed, err := strconv.ParseFloat(amount, 64)
	if err != nil {
		return "", fmt.Errorf("invalid amount: %w", err)
	}

	if parsed < 0 {
		return "", fmt.Errorf("amount must be non-negative")
	}

	// Convert to atomic units using integer arithmetic where possible
	multiplier := math.Pow(10, float64(decimals))
	atomicFloat := parsed * multiplier

	// Round to avoid floating point issues
	atomicInt := uint64(math.Round(atomicFloat))

	return strconv.FormatUint(atomicInt, 10), nil
}

// GetSupportedNetworks returns a list of supported NEAR network identifiers
func GetSupportedNetworks() []string {
	return []string{
		near.NearMainnetCAIP2,
		near.NearTestnetCAIP2,
	}
}

// IsNetworkSupported checks if a network identifier is supported
func IsNetworkSupported(network string) bool {
	_, ok := near.GetNetworkConfig(network)
	return ok
}
