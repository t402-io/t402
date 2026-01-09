package server

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	t402 "github.com/awesome-doge/t402/go"
	"github.com/awesome-doge/t402/go/mechanisms/ton"
	"github.com/awesome-doge/t402/go/types"
)

// ExactTonScheme implements the SchemeNetworkServer interface for TON exact payments (V2)
type ExactTonScheme struct {
	moneyParsers []t402.MoneyParser
}

// NewExactTonScheme creates a new ExactTonScheme
func NewExactTonScheme() *ExactTonScheme {
	return &ExactTonScheme{
		moneyParsers: []t402.MoneyParser{},
	}
}

// Scheme returns the scheme identifier
func (s *ExactTonScheme) Scheme() string {
	return ton.SchemeExact
}

// RegisterMoneyParser registers a custom money parser in the parser chain.
// Multiple parsers can be registered - they will be tried in registration order.
// Each parser receives a decimal amount (e.g., 1.50 for $1.50).
// If a parser returns nil, the next parser in the chain will be tried.
// The default parser is always the final fallback.
func (s *ExactTonScheme) RegisterMoneyParser(parser t402.MoneyParser) *ExactTonScheme {
	s.moneyParsers = append(s.moneyParsers, parser)
	return s
}

// ParsePrice parses a price and converts it to an asset amount (V2)
// If price is already an AssetAmount, returns it directly.
// If price is Money (string | number), parses to decimal and tries custom parsers.
// Falls back to default conversion if all custom parsers return nil.
func (s *ExactTonScheme) ParsePrice(price t402.Price, network t402.Network) (t402.AssetAmount, error) {
	networkStr := string(network)

	// Get network config to determine the default asset
	config, err := ton.GetNetworkConfig(networkStr)
	if err != nil {
		return t402.AssetAmount{}, err
	}

	// Handle pre-parsed price object (with amount and asset)
	if priceMap, ok := price.(map[string]interface{}); ok {
		if amountVal, hasAmount := priceMap["amount"]; hasAmount {
			amountStr, ok := amountVal.(string)
			if !ok {
				return t402.AssetAmount{}, fmt.Errorf("amount must be a string")
			}

			asset := config.DefaultAsset.MasterAddress
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
	return s.defaultMoneyConversion(decimalAmount, config)
}

// parseMoneyToDecimal converts Money (string | number) to decimal amount
func (s *ExactTonScheme) parseMoneyToDecimal(price t402.Price) (float64, error) {
	// Handle string prices
	if priceStr, ok := price.(string); ok {
		// Remove $ sign and currency identifiers
		cleanPrice := strings.TrimSpace(priceStr)
		cleanPrice = strings.TrimPrefix(cleanPrice, "$")
		cleanPrice = strings.TrimSpace(cleanPrice)

		// Check if it contains a currency/asset identifier
		parts := strings.Fields(cleanPrice)
		if len(parts) >= 1 {
			// Use the first part as the amount
			amount, err := strconv.ParseFloat(parts[0], 64)
			if err != nil {
				return 0, fmt.Errorf("failed to parse price string '%s': %w", priceStr, err)
			}
			return amount, nil
		}
	}

	// Handle number input
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

// defaultMoneyConversion converts decimal amount to USDT AssetAmount
func (s *ExactTonScheme) defaultMoneyConversion(amount float64, config *ton.NetworkConfig) (t402.AssetAmount, error) {
	// Convert decimal to smallest unit (e.g., $1.50 -> 1500000 for USDT with 6 decimals)
	amountStr := fmt.Sprintf("%.6f", amount)
	parsedAmount, err := ton.ParseAmount(amountStr, config.DefaultAsset.Decimals)
	if err != nil {
		return t402.AssetAmount{}, fmt.Errorf("failed to convert amount: %w", err)
	}

	return t402.AssetAmount{
		Amount: strconv.FormatUint(parsedAmount, 10),
		Asset:  config.DefaultAsset.MasterAddress,
		Extra: map[string]interface{}{
			"symbol":   config.DefaultAsset.Symbol,
			"name":     config.DefaultAsset.Name,
			"decimals": config.DefaultAsset.Decimals,
		},
	}, nil
}

// EnhancePaymentRequirements adds scheme-specific enhancements to V2 payment requirements
func (s *ExactTonScheme) EnhancePaymentRequirements(
	ctx context.Context,
	requirements types.PaymentRequirements,
	supportedKind types.SupportedKind,
	extensionKeys []string,
) (types.PaymentRequirements, error) {
	// Mark unused parameter
	_ = ctx

	// Get network config
	networkStr := string(requirements.Network)
	config, err := ton.GetNetworkConfig(networkStr)
	if err != nil {
		return requirements, err
	}

	// Get asset info
	var assetInfo *ton.AssetInfo
	if requirements.Asset != "" {
		assetInfo, err = ton.GetAssetInfo(networkStr, requirements.Asset)
		if err != nil {
			return requirements, err
		}
	} else {
		// Use default asset if not specified
		assetInfo = &config.DefaultAsset
		requirements.Asset = assetInfo.MasterAddress
	}

	// Ensure amount is in the correct format (smallest unit)
	if requirements.Amount != "" && strings.Contains(requirements.Amount, ".") {
		// Convert decimal to smallest unit
		amount, err := ton.ParseAmount(requirements.Amount, assetInfo.Decimals)
		if err != nil {
			return requirements, fmt.Errorf("failed to parse amount: %w", err)
		}
		requirements.Amount = strconv.FormatUint(amount, 10)
	}

	// Initialize extra map if needed
	if requirements.Extra == nil {
		requirements.Extra = make(map[string]interface{})
	}

	// Add asset metadata to extra
	requirements.Extra["symbol"] = assetInfo.Symbol
	requirements.Extra["name"] = assetInfo.Name
	requirements.Extra["decimals"] = assetInfo.Decimals

	// Copy extensions from supportedKind if provided
	if supportedKind.Extra != nil {
		for _, key := range extensionKeys {
			if val, ok := supportedKind.Extra[key]; ok {
				requirements.Extra[key] = val
			}
		}
	}

	return requirements, nil
}
