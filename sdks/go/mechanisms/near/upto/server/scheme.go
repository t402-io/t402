// Package server implements the server role for NEAR upto payments.
package server

import (
	"context"
	"fmt"
	"math/big"
	"strconv"
	"strings"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/near"
	"github.com/t402-io/t402/sdks/go/mechanisms/near/upto"
	"github.com/t402-io/t402/sdks/go/types"
)

// UptoNearServer implements the SchemeNetworkServer interface for NEAR upto payments
type UptoNearServer struct {
	moneyParsers []t402.MoneyParser
}

// NewUptoNearServer creates a new UptoNearServer
func NewUptoNearServer() *UptoNearServer {
	return &UptoNearServer{
		moneyParsers: []t402.MoneyParser{},
	}
}

// Scheme returns the scheme identifier
func (s *UptoNearServer) Scheme() string {
	return upto.SchemeUpto
}

// RegisterMoneyParser registers a custom money parser
func (s *UptoNearServer) RegisterMoneyParser(parser t402.MoneyParser) *UptoNearServer {
	s.moneyParsers = append(s.moneyParsers, parser)
	return s
}

// ParsePrice converts a Price value to an AssetAmount for NEAR
func (s *UptoNearServer) ParsePrice(price t402.Price, network t402.Network) (t402.AssetAmount, error) {
	networkStr := string(network)

	// Get network config
	config, ok := near.GetNetworkConfig(networkStr)
	if !ok {
		return t402.AssetAmount{}, fmt.Errorf("unsupported network: %s", networkStr)
	}

	// Handle pre-parsed price object (with amount and asset)
	if priceMap, ok := price.(map[string]interface{}); ok {
		if amountVal, hasAmount := priceMap["amount"]; hasAmount {
			amountStr, ok := amountVal.(string)
			if !ok {
				return t402.AssetAmount{}, fmt.Errorf("amount must be a string")
			}

			asset := config.DefaultToken.ContractID
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
			continue
		}
		if result != nil {
			return *result, nil
		}
	}

	// All custom parsers returned nil, use default conversion
	return s.defaultMoneyConversion(decimalAmount, config)
}

// parseMoneyToDecimal converts Money (string | number) to decimal amount
func (s *UptoNearServer) parseMoneyToDecimal(price t402.Price) (float64, error) {
	if priceStr, ok := price.(string); ok {
		cleanPrice := strings.TrimSpace(priceStr)
		cleanPrice = strings.TrimPrefix(cleanPrice, "$")
		cleanPrice = strings.TrimSpace(cleanPrice)

		parts := strings.Fields(cleanPrice)
		if len(parts) >= 1 {
			amount, err := strconv.ParseFloat(parts[0], 64)
			if err != nil {
				return 0, fmt.Errorf("failed to parse price string '%s': %w", priceStr, err)
			}
			return amount, nil
		}
	}

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

// defaultMoneyConversion converts decimal amount to AssetAmount
func (s *UptoNearServer) defaultMoneyConversion(amount float64, config near.NetworkConfig) (t402.AssetAmount, error) {
	decimals := config.DefaultToken.Decimals

	// Convert to smallest units
	multiplier := new(big.Float).SetInt(new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil))
	result := new(big.Float).Mul(new(big.Float).SetFloat64(amount), multiplier)

	// Convert to integer
	intResult, _ := result.Int(nil)

	return t402.AssetAmount{
		Amount: intResult.String(),
		Asset:  config.DefaultToken.ContractID,
		Extra:  make(map[string]interface{}),
	}, nil
}

// EnhancePaymentRequirements adds NEAR-specific upto fields to payment requirements
func (s *UptoNearServer) EnhancePaymentRequirements(
	ctx context.Context,
	requirements types.PaymentRequirements,
	supportedKind types.SupportedKind,
	extensionKeys []string,
) (types.PaymentRequirements, error) {
	_ = ctx

	// Validate network
	config, ok := near.GetNetworkConfig(string(requirements.Network))
	if !ok {
		return requirements, fmt.Errorf("unsupported network: %s", requirements.Network)
	}

	// Set scheme
	requirements.Scheme = upto.SchemeUpto

	// Set default asset if not specified
	if requirements.Asset == "" {
		requirements.Asset = config.DefaultToken.ContractID
	}

	// Initialize extra if nil
	if requirements.Extra == nil {
		requirements.Extra = make(map[string]interface{})
	}

	// Add token info
	requirements.Extra["symbol"] = config.DefaultToken.Symbol
	requirements.Extra["decimals"] = config.DefaultToken.Decimals

	// Copy facilitator address from supportedKind if available
	if supportedKind.Extra != nil {
		if facilitator, ok := supportedKind.Extra["facilitator"].(string); ok {
			requirements.Extra["facilitator"] = facilitator
		}
	}

	// Set maxAmount to the required amount if not already set
	if _, ok := requirements.Extra["maxAmount"]; !ok {
		requirements.Extra["maxAmount"] = string(requirements.Amount)
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

// SetMaxAmount sets the maximum authorized amount for the payment
func (s *UptoNearServer) SetMaxAmount(requirements *types.PaymentRequirements, maxAmount string) error {
	if requirements.Extra == nil {
		requirements.Extra = make(map[string]interface{})
	}

	_, ok := new(big.Int).SetString(maxAmount, 10)
	if !ok {
		return fmt.Errorf("invalid maxAmount: %s", maxAmount)
	}

	requirements.Extra["maxAmount"] = maxAmount
	return nil
}

// SetMinAmount sets the minimum acceptable settlement amount
func (s *UptoNearServer) SetMinAmount(requirements *types.PaymentRequirements, minAmount string) error {
	if requirements.Extra == nil {
		requirements.Extra = make(map[string]interface{})
	}

	_, ok := new(big.Int).SetString(minAmount, 10)
	if !ok {
		return fmt.Errorf("invalid minAmount: %s", minAmount)
	}

	requirements.Extra["minAmount"] = minAmount
	return nil
}

// SetBillingUnit sets the billing unit and price per unit
func (s *UptoNearServer) SetBillingUnit(requirements *types.PaymentRequirements, unit string, unitPrice string) error {
	if requirements.Extra == nil {
		requirements.Extra = make(map[string]interface{})
	}

	_, ok := new(big.Int).SetString(unitPrice, 10)
	if !ok {
		return fmt.Errorf("invalid unitPrice: %s", unitPrice)
	}

	requirements.Extra["unit"] = unit
	requirements.Extra["unitPrice"] = unitPrice
	return nil
}

// CalculateSettleAmount calculates the settlement amount based on usage
func (s *UptoNearServer) CalculateSettleAmount(requirements types.PaymentRequirements, units int64) (string, error) {
	extra := requirements.Extra
	if extra == nil {
		return "", fmt.Errorf("no extra data in requirements")
	}

	unitPriceStr, ok := extra["unitPrice"].(string)
	if !ok {
		return "", fmt.Errorf("unitPrice not found in requirements")
	}

	unitPrice, ok := new(big.Int).SetString(unitPriceStr, 10)
	if !ok {
		return "", fmt.Errorf("invalid unitPrice: %s", unitPriceStr)
	}

	total := new(big.Int).Mul(unitPrice, big.NewInt(units))

	// Check against min/max
	if minStr, ok := extra["minAmount"].(string); ok {
		if min, ok := new(big.Int).SetString(minStr, 10); ok {
			if total.Cmp(min) < 0 {
				total = min
			}
		}
	}

	if maxStr, ok := extra["maxAmount"].(string); ok {
		if max, ok := new(big.Int).SetString(maxStr, 10); ok {
			if total.Cmp(max) > 0 {
				total = max
			}
		}
	}

	return total.String(), nil
}

// FormatAmount formats an amount in smallest units to a human-readable string
func (s *UptoNearServer) FormatAmount(amount string, decimals int) string {
	amountBig, ok := new(big.Int).SetString(amount, 10)
	if !ok {
		return amount
	}

	divisor := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil)
	quotient := new(big.Int).Div(amountBig, divisor)
	remainder := new(big.Int).Mod(amountBig, divisor)

	if remainder.Sign() == 0 {
		return quotient.String()
	}

	remainderStr := remainder.String()
	for len(remainderStr) < decimals {
		remainderStr = "0" + remainderStr
	}
	for len(remainderStr) > 1 && remainderStr[len(remainderStr)-1] == '0' {
		remainderStr = remainderStr[:len(remainderStr)-1]
	}

	return quotient.String() + "." + remainderStr
}

// ValidateSettleAmount validates that the settle amount is within bounds
func (s *UptoNearServer) ValidateSettleAmount(requirements types.PaymentRequirements, settleAmount string) error {
	settleBig, ok := new(big.Int).SetString(settleAmount, 10)
	if !ok {
		return fmt.Errorf("invalid settle amount: %s", settleAmount)
	}

	extra := requirements.Extra
	if extra == nil {
		return nil
	}

	if minStr, ok := extra["minAmount"].(string); ok {
		min, _ := new(big.Int).SetString(minStr, 10)
		if min != nil && settleBig.Cmp(min) < 0 {
			return fmt.Errorf("settle amount %s is below minimum %s", settleAmount, minStr)
		}
	}

	if maxStr, ok := extra["maxAmount"].(string); ok {
		max, _ := new(big.Int).SetString(maxStr, 10)
		if max != nil && settleBig.Cmp(max) > 0 {
			return fmt.Errorf("settle amount %s exceeds maximum %s", settleAmount, maxStr)
		}
	}

	requiredBig, ok := new(big.Int).SetString(string(requirements.Amount), 10)
	if ok && settleBig.Cmp(requiredBig) < 0 {
		return fmt.Errorf("settle amount %s is below required amount %s", settleAmount, requirements.Amount)
	}

	return nil
}

// GetTokenDecimals returns the decimals for a token on a network
func (s *UptoNearServer) GetTokenDecimals(network t402.Network, asset string) int {
	if tokenInfo, ok := near.GetTokenByContract(string(network), asset); ok {
		return tokenInfo.Decimals
	}

	config, ok := near.GetNetworkConfig(string(network))
	if !ok {
		return 6 // Default to USDC decimals
	}

	return config.DefaultToken.Decimals
}
