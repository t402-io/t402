package server

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/evm"
	"github.com/t402-io/t402/sdks/go/mechanisms/evm/permit2"
	"github.com/t402-io/t402/sdks/go/mechanisms/evm/permit2proxy"
	"github.com/t402-io/t402/sdks/go/types"
)

// Permit2ProxyEvmScheme implements the SchemeNetworkServer interface for EVM Permit2 Proxy payments
type Permit2ProxyEvmScheme struct {
	moneyParsers []t402.MoneyParser
}

// NewPermit2ProxyEvmScheme creates a new Permit2ProxyEvmScheme
func NewPermit2ProxyEvmScheme() *Permit2ProxyEvmScheme {
	return &Permit2ProxyEvmScheme{
		moneyParsers: []t402.MoneyParser{},
	}
}

// Scheme returns the scheme identifier
func (s *Permit2ProxyEvmScheme) Scheme() string {
	return permit2proxy.SchemePermit2Proxy
}

// RegisterMoneyParser registers a custom money parser
func (s *Permit2ProxyEvmScheme) RegisterMoneyParser(parser t402.MoneyParser) *Permit2ProxyEvmScheme {
	s.moneyParsers = append(s.moneyParsers, parser)
	return s
}

// ParsePrice parses a price and converts it to an asset amount
func (s *Permit2ProxyEvmScheme) ParsePrice(price t402.Price, network t402.Network) (t402.AssetAmount, error) {
	// If already an AssetAmount, return it directly
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
				return t402.AssetAmount{}, fmt.Errorf("asset address must be specified for AssetAmount")
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

	// Parse Money to decimal
	decimalAmount, err := s.parseMoneyToDecimal(price)
	if err != nil {
		return t402.AssetAmount{}, err
	}

	// Try custom parsers
	for _, parser := range s.moneyParsers {
		result, err := parser(decimalAmount, network)
		if err != nil {
			continue
		}
		if result != nil {
			return *result, nil
		}
	}

	// Default conversion
	return s.defaultMoneyConversion(decimalAmount, network)
}

func (s *Permit2ProxyEvmScheme) parseMoneyToDecimal(price t402.Price) (float64, error) {
	switch v := price.(type) {
	case string:
		cleanPrice := strings.TrimSpace(v)
		cleanPrice = strings.TrimPrefix(cleanPrice, "$")
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

func (s *Permit2ProxyEvmScheme) defaultMoneyConversion(amount float64, network t402.Network) (t402.AssetAmount, error) {
	networkStr := string(network)
	config, err := evm.GetNetworkConfig(networkStr)
	if err != nil {
		return t402.AssetAmount{}, err
	}

	amountStr := fmt.Sprintf("%.6f", amount)
	parsedAmount, err := evm.ParseAmount(amountStr, config.DefaultAsset.Decimals)
	if err != nil {
		return t402.AssetAmount{}, fmt.Errorf("failed to convert amount: %w", err)
	}

	return t402.AssetAmount{
		Asset:  config.DefaultAsset.Address,
		Amount: parsedAmount.String(),
		Extra: map[string]interface{}{
			"permit2Address":    permit2.Permit2Address,
			"exactProxyAddress": permit2proxy.ExactProxyAddress,
			"uptoProxyAddress":  permit2proxy.UptoProxyAddress,
		},
	}, nil
}

// EnhancePaymentRequirements adds Permit2 Proxy-specific enhancements to payment requirements
func (s *Permit2ProxyEvmScheme) EnhancePaymentRequirements(
	ctx context.Context,
	requirements types.PaymentRequirements,
	supportedKind types.SupportedKind,
	extensionKeys []string,
) (types.PaymentRequirements, error) {
	if requirements.Extra == nil {
		requirements.Extra = make(map[string]interface{})
	}
	requirements.Extra["permit2Address"] = permit2.Permit2Address
	requirements.Extra["exactProxyAddress"] = permit2proxy.ExactProxyAddress
	requirements.Extra["uptoProxyAddress"] = permit2proxy.UptoProxyAddress

	return requirements, nil
}
