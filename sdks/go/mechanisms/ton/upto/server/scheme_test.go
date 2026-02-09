package server

import (
	"context"
	"strings"
	"testing"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/ton"
	"github.com/t402-io/t402/sdks/go/mechanisms/ton/upto"
	"github.com/t402-io/t402/sdks/go/types"
)

func TestScheme(t *testing.T) {
	server := NewUptoTonServer()
	if server.Scheme() != "upto" {
		t.Errorf("Scheme() = %v, want upto", server.Scheme())
	}
}

func TestParsePrice_StringDollar(t *testing.T) {
	server := NewUptoTonServer()
	result, err := server.ParsePrice("$0.01", t402.Network(ton.TonMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if result.Amount != "10000" {
		t.Errorf("Amount = %v, want 10000", result.Amount)
	}
	if result.Asset != ton.USDTMainnetAddress {
		t.Errorf("Asset = %v, want %v", result.Asset, ton.USDTMainnetAddress)
	}
}

func TestParsePrice_Float64(t *testing.T) {
	server := NewUptoTonServer()
	result, err := server.ParsePrice(float64(0.01), t402.Network(ton.TonMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if result.Amount != "10000" {
		t.Errorf("Amount = %v, want 10000", result.Amount)
	}
	if result.Asset != ton.USDTMainnetAddress {
		t.Errorf("Asset = %v, want %v", result.Asset, ton.USDTMainnetAddress)
	}
}

func TestParsePrice_Int(t *testing.T) {
	server := NewUptoTonServer()
	result, err := server.ParsePrice(int(1), t402.Network(ton.TonMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if result.Amount != "1000000" {
		t.Errorf("Amount = %v, want 1000000", result.Amount)
	}
}

func TestParsePrice_Map(t *testing.T) {
	server := NewUptoTonServer()
	price := map[string]interface{}{
		"amount": "5000",
		"asset":  "custom_address",
	}
	result, err := server.ParsePrice(price, t402.Network(ton.TonMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if result.Amount != "5000" {
		t.Errorf("Amount = %v, want 5000", result.Amount)
	}
	if result.Asset != "custom_address" {
		t.Errorf("Asset = %v, want custom_address", result.Asset)
	}
}

func TestParsePrice_InvalidString(t *testing.T) {
	server := NewUptoTonServer()
	_, err := server.ParsePrice("not-a-number", t402.Network(ton.TonMainnetCAIP2))
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "failed to parse price string") {
		t.Errorf("error = %v, want to contain 'failed to parse price string'", err)
	}
}

func TestParsePrice_UnsupportedNetwork(t *testing.T) {
	server := NewUptoTonServer()
	_, err := server.ParsePrice(float64(1.0), t402.Network("eip155:1"))
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "unsupported") {
		t.Errorf("error = %v, want to contain 'unsupported'", err)
	}
}

func TestEnhancePaymentRequirements_Success(t *testing.T) {
	server := NewUptoTonServer()

	requirements := types.PaymentRequirements{
		Scheme:  upto.SchemeUpto,
		Network: ton.TonMainnetCAIP2,
		Amount:  "1000000",
		PayTo:   "EQC88f67e776f16dcfbf42e6bdda1b82604448899b",
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      upto.SchemeUpto,
		Network:     ton.TonMainnetCAIP2,
		Extra: map[string]interface{}{
			"facilitator": "EQFacilitatorAddress",
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
	if result.Asset != ton.USDTMainnetAddress {
		t.Errorf("Asset = %v, want %v", result.Asset, ton.USDTMainnetAddress)
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
	if result.Extra["facilitator"] != "EQFacilitatorAddress" {
		t.Errorf("Extra.facilitator = %v, want EQFacilitatorAddress", result.Extra["facilitator"])
	}
}

func TestEnhancePaymentRequirements_UnsupportedNetwork(t *testing.T) {
	server := NewUptoTonServer()

	requirements := types.PaymentRequirements{
		Scheme:  upto.SchemeUpto,
		Network: "eip155:1",
		Amount:  "1000000",
		PayTo:   "EQC88f67e776f16dcfbf42e6bdda1b82604448899b",
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
	server := NewUptoTonServer()

	customAsset := "EQCustomJettonMasterAddress1234567890abcdefg"
	requirements := types.PaymentRequirements{
		Scheme:  upto.SchemeUpto,
		Network: ton.TonMainnetCAIP2,
		Asset:   customAsset,
		Amount:  "1000000",
		PayTo:   "EQC88f67e776f16dcfbf42e6bdda1b82604448899b",
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      upto.SchemeUpto,
		Network:     ton.TonMainnetCAIP2,
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
	server := NewUptoTonServer()

	parserCalled := false
	customParser := func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
		parserCalled = true
		return &t402.AssetAmount{
			Amount: "42",
			Asset:  "custom_asset",
		}, nil
	}

	server.RegisterMoneyParser(customParser)

	result, err := server.ParsePrice(float64(1.0), t402.Network(ton.TonMainnetCAIP2))
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
	server := NewUptoTonServer()
	requirements := &types.PaymentRequirements{}

	err := server.SetMaxAmount(requirements, "5000000")
	if err != nil {
		t.Fatalf("SetMaxAmount() error: %v", err)
	}
	if requirements.Extra["maxAmount"] != "5000000" {
		t.Errorf("Extra.maxAmount = %v, want 5000000", requirements.Extra["maxAmount"])
	}
}

func TestSetMinAmount(t *testing.T) {
	server := NewUptoTonServer()
	requirements := &types.PaymentRequirements{}

	err := server.SetMinAmount(requirements, "100000")
	if err != nil {
		t.Fatalf("SetMinAmount() error: %v", err)
	}
	if requirements.Extra["minAmount"] != "100000" {
		t.Errorf("Extra.minAmount = %v, want 100000", requirements.Extra["minAmount"])
	}
}

func TestSetBillingUnit(t *testing.T) {
	server := NewUptoTonServer()
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

func TestSetMaxAmount_InvalidAmount(t *testing.T) {
	server := NewUptoTonServer()
	requirements := &types.PaymentRequirements{}

	err := server.SetMaxAmount(requirements, "not-a-number")
	if err == nil {
		t.Fatal("expected error for invalid maxAmount, got nil")
	}
	if !strings.Contains(err.Error(), "invalid maxAmount") {
		t.Errorf("error = %v, want to contain 'invalid maxAmount'", err)
	}
}

func TestCalculateSettleAmount(t *testing.T) {
	server := NewUptoTonServer()

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
	server := NewUptoTonServer()

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
	server := NewUptoTonServer()

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
	server := NewUptoTonServer()

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
	server := NewUptoTonServer()

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
	server := NewUptoTonServer()

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
	server := NewUptoTonServer()

	decimals := server.GetTokenDecimals(t402.Network(ton.TonMainnetCAIP2), ton.USDTMainnetAddress)
	if decimals != 6 {
		t.Errorf("GetTokenDecimals() = %v, want 6", decimals)
	}

	// Unknown network defaults to 6
	decimals = server.GetTokenDecimals(t402.Network("unknown:network"), "some_asset")
	if decimals != 6 {
		t.Errorf("GetTokenDecimals(unknown) = %v, want 6", decimals)
	}
}
