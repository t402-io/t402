package server

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"strings"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/aptos"
	"github.com/t402-io/t402/sdks/go/types"
)

// ExactDirectAptosServerConfig holds configuration for the ExactDirectAptosScheme server
type ExactDirectAptosServerConfig struct {
	// PreferredToken is the preferred token symbol (e.g., "USDT").
	// Defaults to the network's default token.
	PreferredToken string
}

// ExactDirectAptosScheme implements the SchemeNetworkServer interface for Aptos exact-direct payments (V2)
type ExactDirectAptosScheme struct {
	moneyParsers []t402.MoneyParser
	config       ExactDirectAptosServerConfig
}

// NewExactDirectAptosScheme creates a new ExactDirectAptosScheme server
func NewExactDirectAptosScheme(config ...*ExactDirectAptosServerConfig) *ExactDirectAptosScheme {
	cfg := ExactDirectAptosServerConfig{}
	if len(config) > 0 && config[0] != nil {
		cfg = *config[0]
	}
	return &ExactDirectAptosScheme{
		moneyParsers: []t402.MoneyParser{},
		config:       cfg,
	}
}

// Scheme returns the scheme identifier
func (s *ExactDirectAptosScheme) Scheme() string {
	return aptos.SchemeExactDirect
}

// RegisterMoneyParser registers a custom money parser in the parser chain.
// Multiple parsers can be registered - they will be tried in registration order.
// Each parser receives a decimal amount (e.g., 1.50 for $1.50).
// If a parser returns nil, the next parser in the chain will be tried.
// The default parser is always the final fallback.
func (s *ExactDirectAptosScheme) RegisterMoneyParser(parser t402.MoneyParser) *ExactDirectAptosScheme {
	s.moneyParsers = append(s.moneyParsers, parser)
	return s
}

// ParsePrice parses a price and converts it to an asset amount (V2).
// If price is already an AssetAmount map, returns it directly.
// If price is Money (string | number), parses to decimal and tries custom parsers.
// Falls back to default conversion if all custom parsers return nil.
func (s *ExactDirectAptosScheme) ParsePrice(price t402.Price, network t402.Network) (t402.AssetAmount, error) {
	networkStr := string(network)

	// Validate network
	config, ok := aptos.GetNetworkConfig(networkStr)
	if !ok {
		return t402.AssetAmount{}, fmt.Errorf("unsupported Aptos network: %s", networkStr)
	}

	// Handle pre-parsed price object (with amount and asset)
	if priceMap, ok := price.(map[string]interface{}); ok {
		if amountVal, hasAmount := priceMap["amount"]; hasAmount {
			amountStr, ok := amountVal.(string)
			if !ok {
				return t402.AssetAmount{}, fmt.Errorf("amount must be a string")
			}

			asset := config.DefaultToken.MetadataAddress
			if assetVal, hasAsset := priceMap["asset"]; hasAsset {
				if assetStr, ok := assetVal.(string); ok {
					asset = assetStr
				}
			}
			if asset == "" {
				return t402.AssetAmount{}, fmt.Errorf("asset address must be specified for AssetAmount on network %s", networkStr)
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

// EnhancePaymentRequirements adds scheme-specific enhancements to V2 payment requirements.
// It sets the asset to the default token if not specified, converts decimal amounts
// to atomic units, and adds token metadata to the extra fields.
func (s *ExactDirectAptosScheme) EnhancePaymentRequirements(
	ctx context.Context,
	requirements types.PaymentRequirements,
	supportedKind types.SupportedKind,
	extensionKeys []string,
) (types.PaymentRequirements, error) {
	_ = ctx

	// Validate network
	networkStr := requirements.Network
	config, ok := aptos.GetNetworkConfig(networkStr)
	if !ok {
		return requirements, fmt.Errorf("unsupported Aptos network: %s", networkStr)
	}

	// Determine asset info
	var tokenInfo aptos.TokenInfo
	if requirements.Asset != "" {
		// Try to find the token by address
		foundToken, found := aptos.GetTokenByAddress(networkStr, requirements.Asset)
		if found {
			tokenInfo = foundToken
		} else {
			// Use a generic token with default decimals
			tokenInfo = aptos.TokenInfo{
				MetadataAddress: requirements.Asset,
				Symbol:          "UNKNOWN",
				Name:            "Unknown Token",
				Decimals:        6,
			}
		}
	} else {
		// Use default token (or preferred token if configured)
		tokenInfo = s.getDefaultToken(networkStr, config)
		requirements.Asset = tokenInfo.MetadataAddress
	}

	// Convert decimal amount to atomic units if needed
	if requirements.Amount != "" && strings.Contains(requirements.Amount, ".") {
		amount, err := parseAmount(requirements.Amount, tokenInfo.Decimals)
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
	requirements.Extra["symbol"] = tokenInfo.Symbol
	requirements.Extra["name"] = tokenInfo.Name
	requirements.Extra["decimals"] = tokenInfo.Decimals

	// Copy facilitator-provided extra fields
	if supportedKind.Extra != nil {
		// Always copy assetSymbol and assetDecimals if present
		if v, ok := supportedKind.Extra["assetSymbol"]; ok {
			requirements.Extra["assetSymbol"] = v
		}
		if v, ok := supportedKind.Extra["assetDecimals"]; ok {
			requirements.Extra["assetDecimals"] = v
		}

		// Copy specific extension keys
		for _, key := range extensionKeys {
			if val, ok := supportedKind.Extra[key]; ok {
				requirements.Extra[key] = val
			}
		}
	}

	return requirements, nil
}

// getDefaultToken returns the default token for a network, considering the preferred token config.
func (s *ExactDirectAptosScheme) getDefaultToken(network string, config aptos.NetworkConfig) aptos.TokenInfo {
	if s.config.PreferredToken != "" {
		token, ok := aptos.GetTokenInfo(network, s.config.PreferredToken)
		if ok {
			return token
		}
	}
	return config.DefaultToken
}

// parseMoneyToDecimal converts Money (string | number) to a decimal amount.
func (s *ExactDirectAptosScheme) parseMoneyToDecimal(price t402.Price) (float64, error) {
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

// defaultMoneyConversion converts a decimal amount to an AssetAmount using the default token.
func (s *ExactDirectAptosScheme) defaultMoneyConversion(amount float64, config aptos.NetworkConfig) (t402.AssetAmount, error) {
	token := config.DefaultToken

	// Convert decimal to smallest unit (e.g., $1.50 -> 1500000 for USDT with 6 decimals)
	amountStr := fmt.Sprintf("%.6f", amount)
	parsedAmount, err := parseAmount(amountStr, token.Decimals)
	if err != nil {
		return t402.AssetAmount{}, fmt.Errorf("failed to convert amount: %w", err)
	}

	return t402.AssetAmount{
		Amount: strconv.FormatUint(parsedAmount, 10),
		Asset:  token.MetadataAddress,
		Extra: map[string]interface{}{
			"symbol":   token.Symbol,
			"name":     token.Name,
			"decimals": token.Decimals,
		},
	}, nil
}

// parseAmount converts a decimal string amount to token smallest units.
func parseAmount(amount string, decimals int) (uint64, error) {
	amount = strings.TrimSpace(amount)

	parts := strings.Split(amount, ".")
	if len(parts) > 2 {
		return 0, fmt.Errorf("invalid amount format: %s", amount)
	}

	// Parse integer part
	intPart, err := strconv.ParseUint(parts[0], 10, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid integer part: %s", parts[0])
	}

	// Handle decimal part
	decPart := uint64(0)
	if len(parts) == 2 && parts[1] != "" {
		decStr := parts[1]
		if len(decStr) > decimals {
			decStr = decStr[:decimals]
		} else {
			decStr += strings.Repeat("0", decimals-len(decStr))
		}

		decPart, err = strconv.ParseUint(decStr, 10, 64)
		if err != nil {
			return 0, fmt.Errorf("invalid decimal part: %s", parts[1])
		}
	}

	// Calculate total in smallest unit
	multiplier := uint64(math.Pow10(decimals))
	result := intPart*multiplier + decPart

	return result, nil
}
