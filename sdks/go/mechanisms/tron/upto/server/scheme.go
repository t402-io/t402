// Package server implements the server role for TRON upto payments.
package server

import (
	"context"
	"fmt"
	"math/big"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/tron"
	"github.com/t402-io/t402/sdks/go/mechanisms/tron/upto"
	"github.com/t402-io/t402/sdks/go/types"
)

// UptoTronServer implements the SchemeNetworkServer interface for TRON upto payments
type UptoTronServer struct {
	moneyParsers []t402.MoneyParser
}

// NewUptoTronServer creates a new UptoTronServer
func NewUptoTronServer() *UptoTronServer {
	return &UptoTronServer{
		moneyParsers: []t402.MoneyParser{},
	}
}

// Scheme returns the scheme identifier
func (s *UptoTronServer) Scheme() string {
	return upto.SchemeUpto
}

// RegisterMoneyParser registers a custom money parser
func (s *UptoTronServer) RegisterMoneyParser(parser t402.MoneyParser) {
	s.moneyParsers = append(s.moneyParsers, parser)
}

// ParsePrice converts a Price value to an AssetAmount for TRON
func (s *UptoTronServer) ParsePrice(price t402.Price, network t402.Network) (t402.AssetAmount, error) {
	// Try custom parsers first
	for _, parser := range s.moneyParsers {
		// Convert price to float64 for the parser
		priceFloat, err := toFloat64(price)
		if err != nil {
			continue
		}
		amount, err := parser(priceFloat, network)
		if err == nil && amount != nil {
			return *amount, nil
		}
	}

	// Default parser: assume price is in USD cents or smallest denomination
	var decimalValue *big.Float

	switch v := price.(type) {
	case string:
		var ok bool
		decimalValue, ok = new(big.Float).SetString(v)
		if !ok {
			return t402.AssetAmount{}, fmt.Errorf("invalid price string: %s", v)
		}
	case int:
		decimalValue = new(big.Float).SetInt64(int64(v))
	case int64:
		decimalValue = new(big.Float).SetInt64(v)
	case float64:
		decimalValue = new(big.Float).SetFloat64(v)
	default:
		return t402.AssetAmount{}, fmt.Errorf("unsupported price type: %T", price)
	}

	// Get token decimals (default to 6 for USDT)
	decimals := 6
	config, err := tron.GetNetworkConfig(string(network))
	if err == nil {
		decimals = config.DefaultAsset.Decimals
	}

	// Convert to smallest denomination
	multiplier := new(big.Float).SetInt(new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil))
	result := new(big.Float).Mul(decimalValue, multiplier)

	// Convert to integer (truncate)
	intResult, _ := result.Int(nil)

	return t402.AssetAmount{
		Asset:  config.DefaultAsset.ContractAddress,
		Amount: intResult.String(),
	}, nil
}

// EnhancePaymentRequirements adds TRON-specific upto fields to payment requirements
func (s *UptoTronServer) EnhancePaymentRequirements(
	ctx context.Context,
	requirements types.PaymentRequirements,
	supportedKind types.SupportedKind,
	extensionKeys []string,
) (types.PaymentRequirements, error) {
	// Validate network
	if !tron.IsValidNetwork(string(requirements.Network)) {
		return requirements, fmt.Errorf("unsupported network: %s", requirements.Network)
	}

	// Get network config
	config, err := tron.GetNetworkConfig(string(requirements.Network))
	if err != nil {
		return requirements, fmt.Errorf("failed to get network config: %w", err)
	}

	// Set scheme
	requirements.Scheme = upto.SchemeUpto

	// Set default asset if not specified
	if requirements.Asset == "" {
		requirements.Asset = config.DefaultAsset.ContractAddress
	}

	// Initialize extra if nil
	if requirements.Extra == nil {
		requirements.Extra = make(map[string]interface{})
	}

	// Add token info
	requirements.Extra["symbol"] = config.DefaultAsset.Symbol
	requirements.Extra["decimals"] = config.DefaultAsset.Decimals

	// Copy spender address from supported kind if available
	if supportedKind.Extra != nil {
		if spender, ok := supportedKind.Extra["spenderAddress"].(string); ok {
			requirements.Extra["spenderAddress"] = spender
		}
	}

	// Set maxAmount to the required amount if not already set
	// The server can override this for usage-based billing
	if _, ok := requirements.Extra["maxAmount"]; !ok {
		requirements.Extra["maxAmount"] = string(requirements.Amount)
	}

	return requirements, nil
}

// SetMaxAmount sets the maximum authorized amount for the payment
func (s *UptoTronServer) SetMaxAmount(requirements *types.PaymentRequirements, maxAmount string) error {
	if requirements.Extra == nil {
		requirements.Extra = make(map[string]interface{})
	}

	// Validate maxAmount is a valid number
	_, ok := new(big.Int).SetString(maxAmount, 10)
	if !ok {
		return fmt.Errorf("invalid maxAmount: %s", maxAmount)
	}

	requirements.Extra["maxAmount"] = maxAmount
	return nil
}

// SetMinAmount sets the minimum acceptable settlement amount
func (s *UptoTronServer) SetMinAmount(requirements *types.PaymentRequirements, minAmount string) error {
	if requirements.Extra == nil {
		requirements.Extra = make(map[string]interface{})
	}

	// Validate minAmount is a valid number
	_, ok := new(big.Int).SetString(minAmount, 10)
	if !ok {
		return fmt.Errorf("invalid minAmount: %s", minAmount)
	}

	requirements.Extra["minAmount"] = minAmount
	return nil
}

// SetBillingUnit sets the billing unit and price per unit
func (s *UptoTronServer) SetBillingUnit(requirements *types.PaymentRequirements, unit string, unitPrice string) error {
	if requirements.Extra == nil {
		requirements.Extra = make(map[string]interface{})
	}

	// Validate unitPrice is a valid number
	_, ok := new(big.Int).SetString(unitPrice, 10)
	if !ok {
		return fmt.Errorf("invalid unitPrice: %s", unitPrice)
	}

	requirements.Extra["unit"] = unit
	requirements.Extra["unitPrice"] = unitPrice
	return nil
}

// CalculateSettleAmount calculates the settlement amount based on usage
func (s *UptoTronServer) CalculateSettleAmount(requirements types.PaymentRequirements, units int64) (string, error) {
	extra := requirements.Extra
	if extra == nil {
		return "", fmt.Errorf("no extra data in requirements")
	}

	// Get unit price
	unitPriceStr, ok := extra["unitPrice"].(string)
	if !ok {
		return "", fmt.Errorf("unitPrice not found in requirements")
	}

	unitPrice, ok := new(big.Int).SetString(unitPriceStr, 10)
	if !ok {
		return "", fmt.Errorf("invalid unitPrice: %s", unitPriceStr)
	}

	// Calculate total
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
func (s *UptoTronServer) FormatAmount(amount string, decimals int) string {
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

	// Format with decimal places
	remainderStr := remainder.String()
	// Pad with leading zeros
	for len(remainderStr) < decimals {
		remainderStr = "0" + remainderStr
	}
	// Trim trailing zeros
	for len(remainderStr) > 1 && remainderStr[len(remainderStr)-1] == '0' {
		remainderStr = remainderStr[:len(remainderStr)-1]
	}

	return quotient.String() + "." + remainderStr
}

// ValidateSettleAmount validates that the settle amount is within bounds
func (s *UptoTronServer) ValidateSettleAmount(requirements types.PaymentRequirements, settleAmount string) error {
	settleBig, ok := new(big.Int).SetString(settleAmount, 10)
	if !ok {
		return fmt.Errorf("invalid settle amount: %s", settleAmount)
	}

	extra := requirements.Extra
	if extra == nil {
		return nil
	}

	// Check minimum
	if minStr, ok := extra["minAmount"].(string); ok {
		min, _ := new(big.Int).SetString(minStr, 10)
		if min != nil && settleBig.Cmp(min) < 0 {
			return fmt.Errorf("settle amount %s is below minimum %s", settleAmount, minStr)
		}
	}

	// Check maximum
	if maxStr, ok := extra["maxAmount"].(string); ok {
		max, _ := new(big.Int).SetString(maxStr, 10)
		if max != nil && settleBig.Cmp(max) > 0 {
			return fmt.Errorf("settle amount %s exceeds maximum %s", settleAmount, maxStr)
		}
	}

	// Check required amount (should be at least the required amount)
	requiredBig, ok := new(big.Int).SetString(string(requirements.Amount), 10)
	if ok && settleBig.Cmp(requiredBig) < 0 {
		return fmt.Errorf("settle amount %s is below required amount %s", settleAmount, requirements.Amount)
	}

	return nil
}

// GetTokenDecimals returns the decimals for a token on a network
func (s *UptoTronServer) GetTokenDecimals(network t402.Network, asset string) int {
	config, err := tron.GetNetworkConfig(string(network))
	if err != nil {
		return 6 // Default to USDT decimals
	}

	if assetInfo, ok := config.SupportedAssets[asset]; ok {
		return assetInfo.Decimals
	}
	if asset == config.DefaultAsset.ContractAddress {
		return config.DefaultAsset.Decimals
	}

	return 6
}

// Helper to convert Price to float64
func toFloat64(price t402.Price) (float64, error) {
	switch v := price.(type) {
	case float64:
		return v, nil
	case int:
		return float64(v), nil
	case int64:
		return float64(v), nil
	case string:
		f, ok := new(big.Float).SetString(v)
		if !ok {
			return 0, fmt.Errorf("invalid price string: %s", v)
		}
		result, _ := f.Float64()
		return result, nil
	default:
		return 0, fmt.Errorf("unsupported price type: %T", price)
	}
}
