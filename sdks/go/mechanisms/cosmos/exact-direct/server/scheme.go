// Package server provides the server-side implementation for Cosmos exact-direct payments.
package server

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"strings"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/cosmos"
	"github.com/t402-io/t402/sdks/go/types"
)

// ExactDirectCosmosScheme implements the SchemeNetworkServer for Cosmos exact-direct payments
type ExactDirectCosmosScheme struct {
	// customParsers allows registering custom price parsers
	customParsers []t402.MoneyParser
}

// NewExactDirectCosmosScheme creates a new ExactDirectCosmosScheme server
func NewExactDirectCosmosScheme() *ExactDirectCosmosScheme {
	return &ExactDirectCosmosScheme{
		customParsers: make([]t402.MoneyParser, 0),
	}
}

// Scheme returns the scheme identifier
func (s *ExactDirectCosmosScheme) Scheme() string {
	return cosmos.SchemeExactDirect
}

// RegisterMoneyParser registers a custom money parser
func (s *ExactDirectCosmosScheme) RegisterMoneyParser(parser t402.MoneyParser) {
	s.customParsers = append(s.customParsers, parser)
}

// ParsePrice converts a price to an AssetAmount for the given network
func (s *ExactDirectCosmosScheme) ParsePrice(price t402.Price, network t402.Network) (t402.AssetAmount, error) {
	networkStr := string(network)

	// Get network config
	config, ok := cosmos.GetNetworkConfig(networkStr)
	if !ok {
		return t402.AssetAmount{}, fmt.Errorf("unsupported network: %s", network)
	}

	// Handle pre-parsed price object (map with "amount" key)
	if priceMap, ok := price.(map[string]interface{}); ok {
		if amountVal, hasAmount := priceMap["amount"]; hasAmount {
			amountStr, ok := amountVal.(string)
			if !ok {
				return t402.AssetAmount{}, fmt.Errorf("amount must be a string")
			}

			// Get asset from map or use default
			asset := config.DefaultToken.Denom
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

	// Try custom parsers first
	for _, parser := range s.customParsers {
		result, err := parser(decimalAmount, network)
		if err != nil {
			continue
		}
		if result != nil {
			return *result, nil
		}
	}

	// Default: use USDC with 6 decimals
	// Convert from decimal amount (e.g., 1.50) to base units (e.g., 1500000)
	decimals := config.DefaultToken.Decimals
	atomicAmount, err := toAtomicUnits(fmt.Sprintf("%f", decimalAmount), decimals)
	if err != nil {
		return t402.AssetAmount{}, fmt.Errorf("failed to convert amount: %w", err)
	}

	return t402.AssetAmount{
		Amount: atomicAmount,
		Asset:  config.DefaultToken.Denom,
		Extra: map[string]interface{}{
			"symbol":   config.DefaultToken.Symbol,
			"decimals": decimals,
		},
	}, nil
}

// EnhancePaymentRequirements enhances payment requirements with Cosmos-specific data
func (s *ExactDirectCosmosScheme) EnhancePaymentRequirements(
	ctx context.Context,
	requirements types.PaymentRequirements,
	supportedKind types.SupportedKind,
	extensions []string,
) (types.PaymentRequirements, error) {
	_ = ctx

	// Get network config
	config, ok := cosmos.GetNetworkConfig(requirements.Network)
	if !ok {
		return requirements, fmt.Errorf("unsupported network: %s", requirements.Network)
	}

	// If asset not specified, use default USDC denom
	if requirements.Asset == "" {
		requirements.Asset = config.DefaultToken.Denom
	}

	// If amount contains a decimal point, convert to atomic units
	if requirements.Amount != "" && strings.Contains(requirements.Amount, ".") {
		token, ok := cosmos.GetTokenByDenom(requirements.Network, requirements.Asset)
		if !ok {
			// If token not found in registry, default to 6 decimals
			token = cosmos.TokenInfo{Decimals: 6}
		}
		atomicAmount, err := toAtomicUnits(requirements.Amount, token.Decimals)
		if err != nil {
			return requirements, fmt.Errorf("failed to parse amount: %w", err)
		}
		requirements.Amount = atomicAmount
	}

	// Add extra info if not present
	if requirements.Extra == nil {
		requirements.Extra = make(map[string]interface{})
	}

	// Add Cosmos-specific extra data
	if _, ok := requirements.Extra["chainId"]; !ok {
		requirements.Extra["chainId"] = config.ChainID
	}
	if _, ok := requirements.Extra["bech32Prefix"]; !ok {
		requirements.Extra["bech32Prefix"] = config.Bech32Prefix
	}
	if _, ok := requirements.Extra["denom"]; !ok {
		requirements.Extra["denom"] = requirements.Asset
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
		for _, key := range extensions {
			if val, ok := supportedKind.Extra[key]; ok {
				requirements.Extra[key] = val
			}
		}
	}

	return requirements, nil
}

// parseMoneyToDecimal converts Money (string | number) to a decimal amount.
func (s *ExactDirectCosmosScheme) parseMoneyToDecimal(price t402.Price) (float64, error) {
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
