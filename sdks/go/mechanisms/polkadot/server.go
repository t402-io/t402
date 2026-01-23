package polkadot

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"strings"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/types"
)

// ExactDirectPolkadotServer implements the SchemeNetworkServer interface for Polkadot exact-direct payments (V2)
type ExactDirectPolkadotServer struct {
	moneyParsers   []t402.MoneyParser
	preferredToken string
}

// ServerConfig holds optional configuration for the server
type ServerConfig struct {
	// PreferredToken overrides the default token symbol (e.g., "USDT")
	PreferredToken string
}

// NewExactDirectPolkadotServer creates a new ExactDirectPolkadotServer
func NewExactDirectPolkadotServer(config ...*ServerConfig) *ExactDirectPolkadotServer {
	s := &ExactDirectPolkadotServer{
		moneyParsers: []t402.MoneyParser{},
	}
	if len(config) > 0 && config[0] != nil {
		s.preferredToken = config[0].PreferredToken
	}
	return s
}

// Scheme returns the scheme identifier
func (s *ExactDirectPolkadotServer) Scheme() string {
	return SchemeExactDirect
}

// RegisterMoneyParser registers a custom money parser in the parser chain.
// Multiple parsers can be registered - they will be tried in registration order.
// Each parser receives a decimal amount (e.g., 1.50 for $1.50).
// If a parser returns nil, the next parser in the chain will be tried.
// The default parser is always the final fallback.
func (s *ExactDirectPolkadotServer) RegisterMoneyParser(parser t402.MoneyParser) *ExactDirectPolkadotServer {
	s.moneyParsers = append(s.moneyParsers, parser)
	return s
}

// ParsePrice parses a price and converts it to an asset amount (V2)
// If price is already an AssetAmount, returns it directly.
// If price is Money (string | number), parses to decimal and tries custom parsers.
// Falls back to default conversion if all custom parsers return nil.
func (s *ExactDirectPolkadotServer) ParsePrice(price t402.Price, network t402.Network) (t402.AssetAmount, error) {
	networkStr := string(network)

	// Validate network
	if !IsPolkadotNetwork(networkStr) {
		return t402.AssetAmount{}, fmt.Errorf("invalid polkadot network: %s", networkStr)
	}

	// Get network config
	networkConfig, ok := GetNetworkConfig(networkStr)
	if !ok {
		return t402.AssetAmount{}, fmt.Errorf("unknown polkadot network: %s", networkStr)
	}

	// Handle pre-parsed price object (with amount and asset)
	if priceMap, ok := price.(map[string]interface{}); ok {
		if amountVal, hasAmount := priceMap["amount"]; hasAmount {
			amountStr, ok := amountVal.(string)
			if !ok {
				return t402.AssetAmount{}, fmt.Errorf("amount must be a string")
			}

			// Default to network's CAIP-19 asset identifier
			asset := s.createAssetIdentifier(networkStr, networkConfig.DefaultToken.AssetID)
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

// EnhancePaymentRequirements adds Polkadot-specific enhancements to V2 payment requirements
func (s *ExactDirectPolkadotServer) EnhancePaymentRequirements(
	ctx context.Context,
	requirements types.PaymentRequirements,
	supportedKind types.SupportedKind,
	extensionKeys []string,
) (types.PaymentRequirements, error) {
	// Mark unused parameter
	_ = ctx

	// Get network config
	networkStr := requirements.Network
	networkConfig, ok := GetNetworkConfig(networkStr)
	if !ok {
		return requirements, fmt.Errorf("unknown polkadot network: %s", networkStr)
	}

	// Determine asset info
	token := networkConfig.DefaultToken
	if s.preferredToken != "" {
		// Try to find preferred token in registry
		if preferredInfo, found := s.findToken(networkStr, s.preferredToken); found {
			token = preferredInfo
		}
	}

	// Set asset identifier if not already set
	if requirements.Asset == "" {
		requirements.Asset = s.createAssetIdentifier(networkStr, token.AssetID)
	}

	// Ensure amount is in atomic units (no decimals)
	if requirements.Amount != "" && strings.Contains(requirements.Amount, ".") {
		atomicAmount, err := ParseAmount(requirements.Amount, token.Decimals)
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
	requirements.Extra["assetId"] = token.AssetID
	requirements.Extra["assetSymbol"] = token.Symbol
	requirements.Extra["assetDecimals"] = token.Decimals
	requirements.Extra["networkName"] = networkConfig.Name

	// Add any facilitator-provided extra fields from supportedKind
	if supportedKind.Extra != nil {
		if assetID, ok := supportedKind.Extra["assetId"]; ok {
			requirements.Extra["assetId"] = assetID
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

// parseMoneyToDecimal converts Money (string | number) to decimal amount
func (s *ExactDirectPolkadotServer) parseMoneyToDecimal(price t402.Price) (float64, error) {
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

// defaultMoneyConversion converts decimal amount to USDT AssetAmount using network defaults
func (s *ExactDirectPolkadotServer) defaultMoneyConversion(amount float64, networkStr string, config NetworkConfig) (t402.AssetAmount, error) {
	token := config.DefaultToken

	// Convert decimal to smallest unit (e.g., $1.50 -> 1500000 for USDT with 6 decimals)
	amountStr := fmt.Sprintf("%.*f", token.Decimals, amount)
	parsedAmount, err := ParseAmount(amountStr, token.Decimals)
	if err != nil {
		return t402.AssetAmount{}, fmt.Errorf("failed to convert amount: %w", err)
	}

	return t402.AssetAmount{
		Amount: strconv.FormatUint(parsedAmount, 10),
		Asset:  s.createAssetIdentifier(networkStr, token.AssetID),
		Extra: map[string]interface{}{
			"symbol":   token.Symbol,
			"name":     token.Name,
			"decimals": token.Decimals,
			"assetId":  token.AssetID,
		},
	}, nil
}

// createAssetIdentifier creates a CAIP-19 asset identifier for Polkadot assets
// Format: {network}/asset:{assetId}
func (s *ExactDirectPolkadotServer) createAssetIdentifier(network string, assetID int) string {
	return fmt.Sprintf("%s/asset:%d", network, assetID)
}

// findToken looks up a token by symbol for a given network
func (s *ExactDirectPolkadotServer) findToken(network, symbol string) (TokenInfo, bool) {
	// Check all configured networks for the token
	config, ok := GetNetworkConfig(network)
	if !ok {
		return TokenInfo{}, false
	}

	// Check if the default token matches the requested symbol
	if config.DefaultToken.Symbol == symbol {
		return config.DefaultToken, true
	}

	return TokenInfo{}, false
}

// ParseAmount converts a decimal string to atomic units
// e.g., "1.50" with 6 decimals -> 1500000
func ParseAmount(amountStr string, decimals int) (uint64, error) {
	// Parse the amount as float64
	amount, err := strconv.ParseFloat(amountStr, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid amount: %w", err)
	}

	if amount < 0 {
		return 0, fmt.Errorf("amount must be non-negative: %s", amountStr)
	}

	// Convert to atomic units
	multiplier := math.Pow(10, float64(decimals))
	atomicAmount := uint64(math.Round(amount * multiplier))

	return atomicAmount, nil
}

// GetSupportedNetworks returns all supported Polkadot network identifiers
func GetSupportedNetworks() []string {
	networks := make([]string, 0, len(Networks))
	for network := range Networks {
		networks = append(networks, network)
	}
	return networks
}

// IsNetworkSupported checks if a network is supported
func IsNetworkSupported(network string) bool {
	_, ok := Networks[network]
	return ok
}
