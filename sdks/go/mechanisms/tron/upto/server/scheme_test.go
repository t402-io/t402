package server

import (
	"context"
	"strings"
	"testing"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/tron"
	"github.com/t402-io/t402/sdks/go/mechanisms/tron/upto"
	"github.com/t402-io/t402/sdks/go/types"
)

func TestScheme(t *testing.T) {
	server := NewUptoTronServer()
	if server.Scheme() != "upto" {
		t.Errorf("Scheme() = %v, want upto", server.Scheme())
	}
}

func TestParsePrice_String(t *testing.T) {
	server := NewUptoTronServer()
	result, err := server.ParsePrice("1.5", t402.Network(tron.TronMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if result.Amount != "1500000" {
		t.Errorf("Amount = %v, want 1500000", result.Amount)
	}
	if result.Asset != tron.USDTMainnetAddress {
		t.Errorf("Asset = %v, want %v", result.Asset, tron.USDTMainnetAddress)
	}
}

func TestParsePrice_Float64(t *testing.T) {
	server := NewUptoTronServer()
	result, err := server.ParsePrice(float64(1.5), t402.Network(tron.TronMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if result.Amount != "1500000" {
		t.Errorf("Amount = %v, want 1500000", result.Amount)
	}
	if result.Asset != tron.USDTMainnetAddress {
		t.Errorf("Asset = %v, want %v", result.Asset, tron.USDTMainnetAddress)
	}
}

func TestParsePrice_Int(t *testing.T) {
	server := NewUptoTronServer()
	result, err := server.ParsePrice(int(1), t402.Network(tron.TronMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if result.Amount != "1000000" {
		t.Errorf("Amount = %v, want 1000000", result.Amount)
	}
}

func TestParsePrice_InvalidString(t *testing.T) {
	server := NewUptoTronServer()
	_, err := server.ParsePrice("not-a-number", t402.Network(tron.TronMainnetCAIP2))
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "invalid price string") {
		t.Errorf("error = %v, want to contain 'invalid price string'", err)
	}
}

func TestParsePrice_UnsupportedType(t *testing.T) {
	server := NewUptoTronServer()
	_, err := server.ParsePrice(struct{}{}, t402.Network(tron.TronMainnetCAIP2))
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "unsupported price type") {
		t.Errorf("error = %v, want to contain 'unsupported price type'", err)
	}
}

func TestEnhancePaymentRequirements_Success(t *testing.T) {
	server := NewUptoTronServer()

	requirements := types.PaymentRequirements{
		Scheme:  upto.SchemeUpto,
		Network: tron.TronMainnetCAIP2,
		Amount:  "1000000",
		PayTo:   "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      upto.SchemeUpto,
		Network:     tron.TronMainnetCAIP2,
		Extra: map[string]interface{}{
			"spenderAddress": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
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
	if result.Asset != tron.USDTMainnetAddress {
		t.Errorf("Asset = %v, want %v", result.Asset, tron.USDTMainnetAddress)
	}
	if result.Extra == nil {
		t.Fatal("Extra should not be nil")
	}
	if result.Extra["symbol"] != "USDT" {
		t.Errorf("Extra.symbol = %v, want USDT", result.Extra["symbol"])
	}
	if result.Extra["decimals"] != 6 {
		t.Errorf("Extra.decimals = %v, want 6", result.Extra["decimals"])
	}
	if result.Extra["spenderAddress"] != "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" {
		t.Errorf("Extra.spenderAddress = %v, want TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", result.Extra["spenderAddress"])
	}
}

func TestEnhancePaymentRequirements_UnsupportedNetwork(t *testing.T) {
	server := NewUptoTronServer()

	requirements := types.PaymentRequirements{
		Scheme:  upto.SchemeUpto,
		Network: "eip155:1",
		Amount:  "1000000",
		PayTo:   "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
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
	server := NewUptoTronServer()

	customAsset := "TCustomTRC20ContractAddressXYZ123456"
	requirements := types.PaymentRequirements{
		Scheme:  upto.SchemeUpto,
		Network: tron.TronMainnetCAIP2,
		Asset:   customAsset,
		Amount:  "1000000",
		PayTo:   "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      upto.SchemeUpto,
		Network:     tron.TronMainnetCAIP2,
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

func TestRegisterMoneyParser(t *testing.T) {
	server := NewUptoTronServer()

	parserCalled := false
	customParser := func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
		parserCalled = true
		return &t402.AssetAmount{
			Amount: "42",
			Asset:  "custom_asset",
		}, nil
	}

	server.RegisterMoneyParser(customParser)

	result, err := server.ParsePrice(float64(1.0), t402.Network(tron.TronMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if !parserCalled {
		t.Error("custom parser was not called")
	}
	if result.Amount != "42" {
		t.Errorf("Amount = %v, want 42", result.Amount)
	}
	if result.Asset != "custom_asset" {
		t.Errorf("Asset = %v, want custom_asset", result.Asset)
	}
}

func TestSetMaxAmount(t *testing.T) {
	server := NewUptoTronServer()
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
	server := NewUptoTronServer()
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
	server := NewUptoTronServer()
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
	server := NewUptoTronServer()
	requirements := &types.PaymentRequirements{}

	err := server.SetMinAmount(requirements, "not-a-number")
	if err == nil {
		t.Fatal("expected error for invalid minAmount, got nil")
	}
	if !strings.Contains(err.Error(), "invalid minAmount") {
		t.Errorf("error = %v, want to contain 'invalid minAmount'", err)
	}
}

func TestSetBillingUnit(t *testing.T) {
	server := NewUptoTronServer()
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
	server := NewUptoTronServer()
	requirements := &types.PaymentRequirements{}

	err := server.SetBillingUnit(requirements, "request", "not-a-number")
	if err == nil {
		t.Fatal("expected error for invalid unitPrice, got nil")
	}
	if !strings.Contains(err.Error(), "invalid unitPrice") {
		t.Errorf("error = %v, want to contain 'invalid unitPrice'", err)
	}
}

func TestCalculateSettleAmount(t *testing.T) {
	server := NewUptoTronServer()

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
	server := NewUptoTronServer()

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

func TestValidateSettleAmount_Valid(t *testing.T) {
	server := NewUptoTronServer()

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
	server := NewUptoTronServer()

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
	server := NewUptoTronServer()

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

func TestFormatAmount(t *testing.T) {
	server := NewUptoTronServer()

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
	server := NewUptoTronServer()

	decimals := server.GetTokenDecimals(t402.Network(tron.TronMainnetCAIP2), tron.USDTMainnetAddress)
	if decimals != 6 {
		t.Errorf("GetTokenDecimals() = %v, want 6", decimals)
	}

	// Unknown network defaults to 6
	decimals = server.GetTokenDecimals(t402.Network("unknown:network"), "some_asset")
	if decimals != 6 {
		t.Errorf("GetTokenDecimals(unknown) = %v, want 6", decimals)
	}
}
