// Package server provides the server-side implementation for Bitcoin exact payments.
package server

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"strings"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/btc"
	"github.com/t402-io/t402/sdks/go/types"
)

// ExactBtcSchemeConfig holds configuration for the Bitcoin on-chain server scheme
type ExactBtcSchemeConfig struct {
	// PayTo is the Bitcoin address to receive payments
	PayTo string
}

// ExactBtcScheme implements the SchemeNetworkServer for Bitcoin on-chain payments.
// Amounts are in satoshis and the asset is always "BTC".
type ExactBtcScheme struct {
	moneyParsers []t402.MoneyParser
	config       ExactBtcSchemeConfig
}

// NewExactBtcScheme creates a new ExactBtcScheme server.
func NewExactBtcScheme(config ExactBtcSchemeConfig) *ExactBtcScheme {
	return &ExactBtcScheme{
		moneyParsers: []t402.MoneyParser{},
		config:       config,
	}
}

// Scheme returns the scheme identifier
func (s *ExactBtcScheme) Scheme() string {
	return btc.SchemeExact
}

// RegisterMoneyParser registers a custom money parser.
func (s *ExactBtcScheme) RegisterMoneyParser(parser t402.MoneyParser) *ExactBtcScheme {
	s.moneyParsers = append(s.moneyParsers, parser)
	return s
}

// ParsePrice converts a price to an AssetAmount in satoshis.
func (s *ExactBtcScheme) ParsePrice(price t402.Price, network t402.Network) (t402.AssetAmount, error) {
	// Handle pre-parsed AssetAmount (map with "amount" key)
	if priceMap, ok := price.(map[string]interface{}); ok {
		if amountVal, hasAmount := priceMap["amount"]; hasAmount {
			amountStr, ok := amountVal.(string)
			if !ok {
				return t402.AssetAmount{}, fmt.Errorf("amount must be a string")
			}

			asset := "BTC"
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

	// Parse Money to decimal
	decimalAmount, err := parseMoneyToDecimal(price)
	if err != nil {
		return t402.AssetAmount{}, err
	}

	// Try custom parsers first
	for _, parser := range s.moneyParsers {
		result, err := parser(decimalAmount, network)
		if err != nil {
			continue
		}
		if result != nil {
			return *result, nil
		}
	}

	// Default: treat amount as BTC, convert to satoshis
	sats := int64(math.Floor(decimalAmount * float64(btc.SatsPerBTC)))

	return t402.AssetAmount{
		Amount: strconv.FormatInt(sats, 10),
		Asset:  "BTC",
		Extra: map[string]interface{}{
			"symbol":   "BTC",
			"decimals": 8,
		},
	}, nil
}

// EnhancePaymentRequirements enhances payment requirements with BTC-specific data.
func (s *ExactBtcScheme) EnhancePaymentRequirements(
	ctx context.Context,
	requirements types.PaymentRequirements,
	supportedKind types.SupportedKind,
	extensionKeys []string,
) (types.PaymentRequirements, error) {
	_ = ctx

	if requirements.PayTo == "" {
		requirements.PayTo = s.config.PayTo
	}
	if requirements.Asset == "" {
		requirements.Asset = "BTC"
	}

	// Copy extension keys from supportedKind if provided
	if supportedKind.Extra != nil && len(extensionKeys) > 0 {
		if requirements.Extra == nil {
			requirements.Extra = make(map[string]interface{})
		}
		for _, key := range extensionKeys {
			if val, ok := supportedKind.Extra[key]; ok {
				requirements.Extra[key] = val
			}
		}
	}

	return requirements, nil
}

// InvoiceGenerator is a function that creates BOLT11 invoices for Lightning payments
type InvoiceGenerator func(amountSats, description string, expiry int) (bolt11Invoice, paymentHash string, err error)

// LightningSchemeConfig holds configuration for the Lightning server scheme
type LightningSchemeConfig struct {
	// GenerateInvoice creates BOLT11 invoices for payment requirements
	GenerateInvoice InvoiceGenerator
}

// LightningScheme implements the SchemeNetworkServer for Lightning Network payments.
type LightningScheme struct {
	moneyParsers []t402.MoneyParser
	config       LightningSchemeConfig
}

// NewLightningScheme creates a new LightningScheme server.
func NewLightningScheme(config LightningSchemeConfig) *LightningScheme {
	return &LightningScheme{
		moneyParsers: []t402.MoneyParser{},
		config:       config,
	}
}

// Scheme returns the scheme identifier
func (s *LightningScheme) Scheme() string {
	return btc.SchemeExact
}

// RegisterMoneyParser registers a custom money parser.
func (s *LightningScheme) RegisterMoneyParser(parser t402.MoneyParser) *LightningScheme {
	s.moneyParsers = append(s.moneyParsers, parser)
	return s
}

// ParsePrice converts a price to an AssetAmount in satoshis.
func (s *LightningScheme) ParsePrice(price t402.Price, network t402.Network) (t402.AssetAmount, error) {
	// Handle pre-parsed AssetAmount (map with "amount" key)
	if priceMap, ok := price.(map[string]interface{}); ok {
		if amountVal, hasAmount := priceMap["amount"]; hasAmount {
			amountStr, ok := amountVal.(string)
			if !ok {
				return t402.AssetAmount{}, fmt.Errorf("amount must be a string")
			}

			asset := "BTC"
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

	// Parse Money to decimal
	decimalAmount, err := parseMoneyToDecimal(price)
	if err != nil {
		return t402.AssetAmount{}, err
	}

	// Try custom parsers first
	for _, parser := range s.moneyParsers {
		result, err := parser(decimalAmount, network)
		if err != nil {
			continue
		}
		if result != nil {
			return *result, nil
		}
	}

	// Default: treat amount as BTC, convert to satoshis
	sats := int64(math.Floor(decimalAmount * float64(btc.SatsPerBTC)))

	return t402.AssetAmount{
		Amount: strconv.FormatInt(sats, 10),
		Asset:  "BTC",
		Extra: map[string]interface{}{
			"symbol":   "BTC",
			"decimals": 8,
		},
	}, nil
}

// EnhancePaymentRequirements generates a BOLT11 invoice and adds it to the extra field.
func (s *LightningScheme) EnhancePaymentRequirements(
	ctx context.Context,
	requirements types.PaymentRequirements,
	supportedKind types.SupportedKind,
	extensionKeys []string,
) (types.PaymentRequirements, error) {
	_ = ctx

	if requirements.Extra == nil {
		requirements.Extra = make(map[string]interface{})
	}

	if requirements.Asset == "" {
		requirements.Asset = "BTC"
	}

	// Generate a BOLT11 invoice for the payment
	if s.config.GenerateInvoice != nil {
		description := fmt.Sprintf("t402 payment on %s", supportedKind.Network)
		bolt11Invoice, paymentHash, err := s.config.GenerateInvoice(
			requirements.Amount,
			description,
			requirements.MaxTimeoutSeconds,
		)
		if err != nil {
			return requirements, fmt.Errorf("failed to generate invoice: %w", err)
		}

		requirements.Extra["bolt11Invoice"] = bolt11Invoice
		requirements.Extra["paymentHash"] = paymentHash
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
func parseMoneyToDecimal(price t402.Price) (float64, error) {
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
