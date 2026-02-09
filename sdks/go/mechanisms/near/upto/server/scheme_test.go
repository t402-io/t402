package server

import (
	"context"
	"strings"
	"testing"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/near"
	"github.com/t402-io/t402/sdks/go/mechanisms/near/upto"
	"github.com/t402-io/t402/sdks/go/types"
)

func TestScheme(t *testing.T) {
	server := NewUptoNearServer()
	if server.Scheme() != "upto" {
		t.Errorf("Scheme() = %v, want upto", server.Scheme())
	}
}

func TestParsePrice_StringDollar(t *testing.T) {
	server := NewUptoNearServer()
	result, err := server.ParsePrice("$0.01", t402.Network(near.NearMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if result.Amount != "10000" {
		t.Errorf("Amount = %v, want 10000", result.Amount)
	}
	if result.Asset != near.USDCMainnet.ContractID {
		t.Errorf("Asset = %v, want %v", result.Asset, near.USDCMainnet.ContractID)
	}
}

func TestParsePrice_Float64(t *testing.T) {
	server := NewUptoNearServer()
	result, err := server.ParsePrice(float64(0.01), t402.Network(near.NearMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if result.Amount != "10000" {
		t.Errorf("Amount = %v, want 10000", result.Amount)
	}
	if result.Asset != near.USDCMainnet.ContractID {
		t.Errorf("Asset = %v, want %v", result.Asset, near.USDCMainnet.ContractID)
	}
}

func TestParsePrice_Int(t *testing.T) {
	server := NewUptoNearServer()
	result, err := server.ParsePrice(int(1), t402.Network(near.NearMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if result.Amount != "1000000" {
		t.Errorf("Amount = %v, want 1000000", result.Amount)
	}
}

func TestParsePrice_Int64(t *testing.T) {
	server := NewUptoNearServer()
	result, err := server.ParsePrice(int64(2), t402.Network(near.NearMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if result.Amount != "2000000" {
		t.Errorf("Amount = %v, want 2000000", result.Amount)
	}
}

func TestParsePrice_Map(t *testing.T) {
	server := NewUptoNearServer()
	price := map[string]interface{}{
		"amount": "5000",
		"asset":  "custom.token.near",
	}
	result, err := server.ParsePrice(price, t402.Network(near.NearMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if result.Amount != "5000" {
		t.Errorf("Amount = %v, want 5000", result.Amount)
	}
	if result.Asset != "custom.token.near" {
		t.Errorf("Asset = %v, want custom.token.near", result.Asset)
	}
}

func TestParsePrice_MapWithoutAsset(t *testing.T) {
	server := NewUptoNearServer()
	price := map[string]interface{}{
		"amount": "5000",
	}
	result, err := server.ParsePrice(price, t402.Network(near.NearMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if result.Amount != "5000" {
		t.Errorf("Amount = %v, want 5000", result.Amount)
	}
	// Should default to the network's default token
	if result.Asset != near.USDCMainnet.ContractID {
		t.Errorf("Asset = %v, want %v (default)", result.Asset, near.USDCMainnet.ContractID)
	}
}

func TestParsePrice_MapWithExtra(t *testing.T) {
	server := NewUptoNearServer()
	price := map[string]interface{}{
		"amount": "5000",
		"extra": map[string]interface{}{
			"foo": "bar",
		},
	}
	result, err := server.ParsePrice(price, t402.Network(near.NearMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if result.Extra == nil {
		t.Fatal("Extra should not be nil")
	}
	if result.Extra["foo"] != "bar" {
		t.Errorf("Extra.foo = %v, want bar", result.Extra["foo"])
	}
}

func TestParsePrice_InvalidString(t *testing.T) {
	server := NewUptoNearServer()
	_, err := server.ParsePrice("not-a-number", t402.Network(near.NearMainnetCAIP2))
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "failed to parse price string") {
		t.Errorf("error = %v, want to contain 'failed to parse price string'", err)
	}
}

func TestParsePrice_UnsupportedNetwork(t *testing.T) {
	server := NewUptoNearServer()
	_, err := server.ParsePrice(float64(1.0), t402.Network("eip155:1"))
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "unsupported") {
		t.Errorf("error = %v, want to contain 'unsupported'", err)
	}
}

func TestParsePrice_InvalidPriceType(t *testing.T) {
	server := NewUptoNearServer()
	_, err := server.ParsePrice(true, t402.Network(near.NearMainnetCAIP2))
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "invalid price format") {
		t.Errorf("error = %v, want to contain 'invalid price format'", err)
	}
}

func TestEnhancePaymentRequirements_Success(t *testing.T) {
	server := NewUptoNearServer()

	requirements := types.PaymentRequirements{
		Scheme:  upto.SchemeUpto,
		Network: near.NearMainnetCAIP2,
		Amount:  "1000000",
		PayTo:   "bob.near",
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      upto.SchemeUpto,
		Network:     near.NearMainnetCAIP2,
		Extra: map[string]interface{}{
			"facilitator": "facilitator.near",
		},
	}

	result, err := server.EnhancePaymentRequirements(
		context.Background(), requirements, supportedKind, nil,
	)
	if err != nil {
		t.Fatalf("EnhancePaymentRequirements() error: %v", err)
	}

	if result.Scheme != upto.SchemeUpto {
		t.Errorf("Scheme = %v, want %v", result.Scheme, upto.SchemeUpto)
	}
	if result.Asset != near.USDCMainnet.ContractID {
		t.Errorf("Asset = %v, want %v", result.Asset, near.USDCMainnet.ContractID)
	}
	if result.Extra == nil {
		t.Fatal("Extra should not be nil")
	}
	if result.Extra["symbol"] != "USDC" {
		t.Errorf("Extra.symbol = %v, want USDC", result.Extra["symbol"])
	}
	if result.Extra["decimals"] != 6 {
		t.Errorf("Extra.decimals = %v, want 6", result.Extra["decimals"])
	}
	if result.Extra["facilitator"] != "facilitator.near" {
		t.Errorf("Extra.facilitator = %v, want facilitator.near", result.Extra["facilitator"])
	}
	if result.Extra["maxAmount"] != "1000000" {
		t.Errorf("Extra.maxAmount = %v, want 1000000 (from Amount)", result.Extra["maxAmount"])
	}
}

func TestEnhancePaymentRequirements_UnsupportedNetwork(t *testing.T) {
	server := NewUptoNearServer()

	requirements := types.PaymentRequirements{
		Scheme:  upto.SchemeUpto,
		Network: "eip155:1",
		Amount:  "1000000",
		PayTo:   "bob.near",
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      upto.SchemeUpto,
		Network:     "eip155:1",
	}

	_, err := server.EnhancePaymentRequirements(
		context.Background(), requirements, supportedKind, nil,
	)
	if err == nil {
		t.Fatal("expected error for unsupported network, got nil")
	}
}

func TestEnhancePaymentRequirements_PreservesCustomAsset(t *testing.T) {
	server := NewUptoNearServer()

	customAsset := "custom.token.near"
	requirements := types.PaymentRequirements{
		Scheme:  upto.SchemeUpto,
		Network: near.NearMainnetCAIP2,
		Asset:   customAsset,
		Amount:  "1000000",
		PayTo:   "bob.near",
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      upto.SchemeUpto,
		Network:     near.NearMainnetCAIP2,
	}

	result, err := server.EnhancePaymentRequirements(
		context.Background(), requirements, supportedKind, nil,
	)
	if err != nil {
		t.Fatalf("EnhancePaymentRequirements() error: %v", err)
	}

	if result.Asset != customAsset {
		t.Errorf("Asset = %v, want %v (custom asset should be preserved)", result.Asset, customAsset)
	}
}

func TestEnhancePaymentRequirements_WithExtensionKeys(t *testing.T) {
	server := NewUptoNearServer()

	requirements := types.PaymentRequirements{
		Scheme:  upto.SchemeUpto,
		Network: near.NearMainnetCAIP2,
		Amount:  "1000000",
		PayTo:   "bob.near",
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      upto.SchemeUpto,
		Network:     near.NearMainnetCAIP2,
		Extra: map[string]interface{}{
			"facilitator": "facilitator.near",
			"customKey":   "customValue",
			"otherKey":    "otherValue",
		},
	}

	result, err := server.EnhancePaymentRequirements(
		context.Background(), requirements, supportedKind, []string{"customKey"},
	)
	if err != nil {
		t.Fatalf("EnhancePaymentRequirements() error: %v", err)
	}

	if result.Extra["customKey"] != "customValue" {
		t.Errorf("Extra.customKey = %v, want customValue", result.Extra["customKey"])
	}
	// otherKey should not be copied since it's not in extensionKeys
	if _, ok := result.Extra["otherKey"]; ok {
		t.Errorf("Extra.otherKey should not be set, but got %v", result.Extra["otherKey"])
	}
}

func TestEnhancePaymentRequirements_Testnet(t *testing.T) {
	server := NewUptoNearServer()

	requirements := types.PaymentRequirements{
		Scheme:  upto.SchemeUpto,
		Network: near.NearTestnetCAIP2,
		Amount:  "1000000",
		PayTo:   "bob.testnet",
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      upto.SchemeUpto,
		Network:     near.NearTestnetCAIP2,
		Extra: map[string]interface{}{
			"facilitator": "facilitator.testnet",
		},
	}

	result, err := server.EnhancePaymentRequirements(
		context.Background(), requirements, supportedKind, nil,
	)
	if err != nil {
		t.Fatalf("EnhancePaymentRequirements() error: %v", err)
	}

	if result.Asset != near.USDCTestnet.ContractID {
		t.Errorf("Asset = %v, want %v", result.Asset, near.USDCTestnet.ContractID)
	}
	if result.Extra["facilitator"] != "facilitator.testnet" {
		t.Errorf("Extra.facilitator = %v, want facilitator.testnet", result.Extra["facilitator"])
	}
}

func TestRegisterMoneyParser(t *testing.T) {
	server := NewUptoNearServer()

	parserCalled := false
	customParser := func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
		parserCalled = true
		return &t402.AssetAmount{
			Amount: "42",
			Asset:  "custom.asset.near",
		}, nil
	}

	server.RegisterMoneyParser(customParser)

	result, err := server.ParsePrice(float64(1.0), t402.Network(near.NearMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if !parserCalled {
		t.Error("custom parser was not called")
	}
	if result.Amount != "42" {
		t.Errorf("Amount = %v, want 42", result.Amount)
	}
	if result.Asset != "custom.asset.near" {
		t.Errorf("Asset = %v, want custom.asset.near", result.Asset)
	}
}

func TestRegisterMoneyParser_FallsBackOnNil(t *testing.T) {
	server := NewUptoNearServer()

	// Parser returns nil (skip) -- should fall back to default conversion
	customParser := func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
		return nil, nil
	}

	server.RegisterMoneyParser(customParser)

	result, err := server.ParsePrice(float64(1.0), t402.Network(near.NearMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if result.Amount != "1000000" {
		t.Errorf("Amount = %v, want 1000000 (default conversion)", result.Amount)
	}
}

func TestSetMaxAmount(t *testing.T) {
	server := NewUptoNearServer()
	requirements := &types.PaymentRequirements{}

	err := server.SetMaxAmount(requirements, "5000000")
	if err != nil {
		t.Fatalf("SetMaxAmount() error: %v", err)
	}
	if requirements.Extra["maxAmount"] != "5000000" {
		t.Errorf("Extra.maxAmount = %v, want 5000000", requirements.Extra["maxAmount"])
	}
}

func TestSetMaxAmount_InvalidAmount(t *testing.T) {
	server := NewUptoNearServer()
	requirements := &types.PaymentRequirements{}

	err := server.SetMaxAmount(requirements, "not-a-number")
	if err == nil {
		t.Fatal("expected error for invalid maxAmount, got nil")
	}
	if !strings.Contains(err.Error(), "invalid maxAmount") {
		t.Errorf("error = %v, want to contain 'invalid maxAmount'", err)
	}
}

func TestSetMinAmount(t *testing.T) {
	server := NewUptoNearServer()
	requirements := &types.PaymentRequirements{}

	err := server.SetMinAmount(requirements, "100000")
	if err != nil {
		t.Fatalf("SetMinAmount() error: %v", err)
	}
	if requirements.Extra["minAmount"] != "100000" {
		t.Errorf("Extra.minAmount = %v, want 100000", requirements.Extra["minAmount"])
	}
}

func TestSetMinAmount_InvalidAmount(t *testing.T) {
	server := NewUptoNearServer()
	requirements := &types.PaymentRequirements{}

	err := server.SetMinAmount(requirements, "invalid")
	if err == nil {
		t.Fatal("expected error for invalid minAmount, got nil")
	}
	if !strings.Contains(err.Error(), "invalid minAmount") {
		t.Errorf("error = %v, want to contain 'invalid minAmount'", err)
	}
}

func TestSetBillingUnit(t *testing.T) {
	server := NewUptoNearServer()
	requirements := &types.PaymentRequirements{}

	err := server.SetBillingUnit(requirements, "request", "10000")
	if err != nil {
		t.Fatalf("SetBillingUnit() error: %v", err)
	}
	if requirements.Extra["unit"] != "request" {
		t.Errorf("Extra.unit = %v, want request", requirements.Extra["unit"])
	}
	if requirements.Extra["unitPrice"] != "10000" {
		t.Errorf("Extra.unitPrice = %v, want 10000", requirements.Extra["unitPrice"])
	}
}

func TestSetBillingUnit_InvalidUnitPrice(t *testing.T) {
	server := NewUptoNearServer()
	requirements := &types.PaymentRequirements{}

	err := server.SetBillingUnit(requirements, "request", "invalid")
	if err == nil {
		t.Fatal("expected error for invalid unitPrice, got nil")
	}
	if !strings.Contains(err.Error(), "invalid unitPrice") {
		t.Errorf("error = %v, want to contain 'invalid unitPrice'", err)
	}
}

func TestCalculateSettleAmount(t *testing.T) {
	server := NewUptoNearServer()

	requirements := types.PaymentRequirements{
		Extra: map[string]interface{}{
			"unitPrice": "10000",
		},
	}

	result, err := server.CalculateSettleAmount(requirements, 5)
	if err != nil {
		t.Fatalf("CalculateSettleAmount() error: %v", err)
	}
	if result != "50000" {
		t.Errorf("CalculateSettleAmount() = %v, want 50000", result)
	}
}

func TestCalculateSettleAmount_RespectsMinMax(t *testing.T) {
	server := NewUptoNearServer()

	// Test minAmount floor
	requirementsMin := types.PaymentRequirements{
		Extra: map[string]interface{}{
			"unitPrice": "10000",
			"minAmount": "100000",
			"maxAmount": "1000000",
		},
	}

	result, err := server.CalculateSettleAmount(requirementsMin, 1)
	if err != nil {
		t.Fatalf("CalculateSettleAmount() error: %v", err)
	}
	// 1 * 10000 = 10000, but min is 100000
	if result != "100000" {
		t.Errorf("CalculateSettleAmount() = %v, want 100000 (minAmount floor)", result)
	}

	// Test maxAmount cap
	requirementsMax := types.PaymentRequirements{
		Extra: map[string]interface{}{
			"unitPrice": "10000",
			"minAmount": "100000",
			"maxAmount": "200000",
		},
	}

	result, err = server.CalculateSettleAmount(requirementsMax, 100)
	if err != nil {
		t.Fatalf("CalculateSettleAmount() error: %v", err)
	}
	// 100 * 10000 = 1000000, but max is 200000
	if result != "200000" {
		t.Errorf("CalculateSettleAmount() = %v, want 200000 (maxAmount cap)", result)
	}
}

func TestCalculateSettleAmount_NoExtra(t *testing.T) {
	server := NewUptoNearServer()

	requirements := types.PaymentRequirements{}

	_, err := server.CalculateSettleAmount(requirements, 5)
	if err == nil {
		t.Fatal("expected error for nil extra, got nil")
	}
	if !strings.Contains(err.Error(), "no extra data") {
		t.Errorf("error = %v, want to contain 'no extra data'", err)
	}
}

func TestCalculateSettleAmount_NoUnitPrice(t *testing.T) {
	server := NewUptoNearServer()

	requirements := types.PaymentRequirements{
		Extra: map[string]interface{}{},
	}

	_, err := server.CalculateSettleAmount(requirements, 5)
	if err == nil {
		t.Fatal("expected error for missing unitPrice, got nil")
	}
	if !strings.Contains(err.Error(), "unitPrice not found") {
		t.Errorf("error = %v, want to contain 'unitPrice not found'", err)
	}
}

func TestCalculateSettleAmount_InvalidUnitPrice(t *testing.T) {
	server := NewUptoNearServer()

	requirements := types.PaymentRequirements{
		Extra: map[string]interface{}{
			"unitPrice": "not-a-number",
		},
	}

	_, err := server.CalculateSettleAmount(requirements, 5)
	if err == nil {
		t.Fatal("expected error for invalid unitPrice, got nil")
	}
	if !strings.Contains(err.Error(), "invalid unitPrice") {
		t.Errorf("error = %v, want to contain 'invalid unitPrice'", err)
	}
}

func TestValidateSettleAmount_Valid(t *testing.T) {
	server := NewUptoNearServer()

	requirements := types.PaymentRequirements{
		Amount: "1000000",
		Extra: map[string]interface{}{
			"minAmount": "500000",
			"maxAmount": "2000000",
		},
	}

	err := server.ValidateSettleAmount(requirements, "1000000")
	if err != nil {
		t.Errorf("ValidateSettleAmount() unexpected error: %v", err)
	}
}

func TestValidateSettleAmount_BelowMinimum(t *testing.T) {
	server := NewUptoNearServer()

	requirements := types.PaymentRequirements{
		Amount: "100000",
		Extra: map[string]interface{}{
			"minAmount": "500000",
			"maxAmount": "2000000",
		},
	}

	err := server.ValidateSettleAmount(requirements, "100000")
	if err == nil {
		t.Fatal("expected error for amount below minimum, got nil")
	}
	if !strings.Contains(err.Error(), "below minimum") {
		t.Errorf("error = %v, want to contain 'below minimum'", err)
	}
}

func TestValidateSettleAmount_AboveMaximum(t *testing.T) {
	server := NewUptoNearServer()

	requirements := types.PaymentRequirements{
		Amount: "1000000",
		Extra: map[string]interface{}{
			"minAmount": "500000",
			"maxAmount": "2000000",
		},
	}

	err := server.ValidateSettleAmount(requirements, "3000000")
	if err == nil {
		t.Fatal("expected error for amount above maximum, got nil")
	}
	if !strings.Contains(err.Error(), "exceeds maximum") {
		t.Errorf("error = %v, want to contain 'exceeds maximum'", err)
	}
}

func TestValidateSettleAmount_BelowRequired(t *testing.T) {
	server := NewUptoNearServer()

	requirements := types.PaymentRequirements{
		Amount: "1000000",
		Extra:  map[string]interface{}{},
	}

	err := server.ValidateSettleAmount(requirements, "500000")
	if err == nil {
		t.Fatal("expected error for amount below required, got nil")
	}
	if !strings.Contains(err.Error(), "below required amount") {
		t.Errorf("error = %v, want to contain 'below required amount'", err)
	}
}

func TestValidateSettleAmount_InvalidSettleAmount(t *testing.T) {
	server := NewUptoNearServer()

	requirements := types.PaymentRequirements{
		Amount: "1000000",
	}

	err := server.ValidateSettleAmount(requirements, "not-a-number")
	if err == nil {
		t.Fatal("expected error for invalid settle amount, got nil")
	}
	if !strings.Contains(err.Error(), "invalid settle amount") {
		t.Errorf("error = %v, want to contain 'invalid settle amount'", err)
	}
}

func TestValidateSettleAmount_NilExtra(t *testing.T) {
	server := NewUptoNearServer()

	requirements := types.PaymentRequirements{
		Amount: "1000000",
	}

	// With nil Extra, only checks against required amount
	err := server.ValidateSettleAmount(requirements, "1000000")
	if err != nil {
		t.Errorf("ValidateSettleAmount() unexpected error: %v", err)
	}
}

func TestFormatAmount(t *testing.T) {
	server := NewUptoNearServer()

	tests := []struct {
		name     string
		amount   string
		decimals int
		want     string
	}{
		{
			name:     "whole number",
			amount:   "1000000",
			decimals: 6,
			want:     "1",
		},
		{
			name:     "with decimals",
			amount:   "1500000",
			decimals: 6,
			want:     "1.5",
		},
		{
			name:     "small amount",
			amount:   "10000",
			decimals: 6,
			want:     "0.01",
		},
		{
			name:     "zero",
			amount:   "0",
			decimals: 6,
			want:     "0",
		},
		{
			name:     "large amount",
			amount:   "1000000000",
			decimals: 6,
			want:     "1000",
		},
		{
			name:     "invalid amount returns original",
			amount:   "not-a-number",
			decimals: 6,
			want:     "not-a-number",
		},
		{
			name:     "trailing zeros removed",
			amount:   "1100000",
			decimals: 6,
			want:     "1.1",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := server.FormatAmount(tt.amount, tt.decimals)
			if result != tt.want {
				t.Errorf("FormatAmount(%v, %v) = %v, want %v", tt.amount, tt.decimals, result, tt.want)
			}
		})
	}
}

func TestGetTokenDecimals(t *testing.T) {
	server := NewUptoNearServer()

	// USDT on mainnet
	decimals := server.GetTokenDecimals(t402.Network(near.NearMainnetCAIP2), near.USDTMainnet.ContractID)
	if decimals != 6 {
		t.Errorf("GetTokenDecimals(USDT mainnet) = %v, want 6", decimals)
	}

	// USDC on mainnet
	decimals = server.GetTokenDecimals(t402.Network(near.NearMainnetCAIP2), near.USDCMainnet.ContractID)
	if decimals != 6 {
		t.Errorf("GetTokenDecimals(USDC mainnet) = %v, want 6", decimals)
	}

	// Unknown asset on known network defaults to network default token decimals
	decimals = server.GetTokenDecimals(t402.Network(near.NearMainnetCAIP2), "unknown.token.near")
	if decimals != 6 {
		t.Errorf("GetTokenDecimals(unknown asset) = %v, want 6", decimals)
	}

	// Unknown network defaults to 6
	decimals = server.GetTokenDecimals(t402.Network("unknown:network"), "some_asset")
	if decimals != 6 {
		t.Errorf("GetTokenDecimals(unknown network) = %v, want 6", decimals)
	}
}

func TestParsePrice_StringWithSpace(t *testing.T) {
	server := NewUptoNearServer()
	result, err := server.ParsePrice("  1.5  ", t402.Network(near.NearMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if result.Amount != "1500000" {
		t.Errorf("Amount = %v, want 1500000", result.Amount)
	}
}

func TestParsePrice_MapWithNonStringAmount(t *testing.T) {
	server := NewUptoNearServer()
	price := map[string]interface{}{
		"amount": 12345, // not a string
	}
	_, err := server.ParsePrice(price, t402.Network(near.NearMainnetCAIP2))
	if err == nil {
		t.Fatal("expected error for non-string amount in map, got nil")
	}
	if !strings.Contains(err.Error(), "amount must be a string") {
		t.Errorf("error = %v, want to contain 'amount must be a string'", err)
	}
}
