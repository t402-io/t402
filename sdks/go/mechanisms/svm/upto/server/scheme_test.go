package server

import (
	"context"
	"strings"
	"testing"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/svm"
	"github.com/t402-io/t402/sdks/go/mechanisms/svm/upto"
	"github.com/t402-io/t402/sdks/go/types"
)

func TestScheme(t *testing.T) {
	server := NewUptoSvmServer()
	if server.Scheme() != "upto" {
		t.Errorf("Scheme() = %v, want upto", server.Scheme())
	}
}

func TestParsePrice_StringDollar(t *testing.T) {
	server := NewUptoSvmServer()
	result, err := server.ParsePrice("$0.01", t402.Network(svm.SolanaMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if result.Amount != "10000" {
		t.Errorf("Amount = %v, want 10000", result.Amount)
	}
	if result.Asset != svm.USDCMainnetAddress {
		t.Errorf("Asset = %v, want %v", result.Asset, svm.USDCMainnetAddress)
	}
}

func TestParsePrice_Float64(t *testing.T) {
	server := NewUptoSvmServer()
	result, err := server.ParsePrice(float64(0.01), t402.Network(svm.SolanaMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if result.Amount != "10000" {
		t.Errorf("Amount = %v, want 10000", result.Amount)
	}
	if result.Asset != svm.USDCMainnetAddress {
		t.Errorf("Asset = %v, want %v", result.Asset, svm.USDCMainnetAddress)
	}
}

func TestParsePrice_Int(t *testing.T) {
	server := NewUptoSvmServer()
	result, err := server.ParsePrice(int(1), t402.Network(svm.SolanaMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if result.Amount != "1000000" {
		t.Errorf("Amount = %v, want 1000000", result.Amount)
	}
}

func TestParsePrice_Int64(t *testing.T) {
	server := NewUptoSvmServer()
	result, err := server.ParsePrice(int64(2), t402.Network(svm.SolanaMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if result.Amount != "2000000" {
		t.Errorf("Amount = %v, want 2000000", result.Amount)
	}
}

func TestParsePrice_Map(t *testing.T) {
	server := NewUptoSvmServer()
	price := map[string]interface{}{
		"amount": "5000",
		"asset":  "CustomTokenMint111111111111111111111",
	}
	result, err := server.ParsePrice(price, t402.Network(svm.SolanaMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if result.Amount != "5000" {
		t.Errorf("Amount = %v, want 5000", result.Amount)
	}
	if result.Asset != "CustomTokenMint111111111111111111111" {
		t.Errorf("Asset = %v, want CustomTokenMint111111111111111111111", result.Asset)
	}
}

func TestParsePrice_MapWithExtra(t *testing.T) {
	server := NewUptoSvmServer()
	price := map[string]interface{}{
		"amount": "5000",
		"extra": map[string]interface{}{
			"tier": "premium",
		},
	}
	result, err := server.ParsePrice(price, t402.Network(svm.SolanaMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if result.Amount != "5000" {
		t.Errorf("Amount = %v, want 5000", result.Amount)
	}
	if result.Extra == nil {
		t.Fatal("Extra should not be nil")
	}
	if result.Extra["tier"] != "premium" {
		t.Errorf("Extra.tier = %v, want premium", result.Extra["tier"])
	}
}

func TestParsePrice_MapDefaultAsset(t *testing.T) {
	server := NewUptoSvmServer()
	price := map[string]interface{}{
		"amount": "5000",
	}
	result, err := server.ParsePrice(price, t402.Network(svm.SolanaMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	// Should use default asset (USDC) when no asset is specified
	if result.Asset != svm.USDCMainnetAddress {
		t.Errorf("Asset = %v, want %v", result.Asset, svm.USDCMainnetAddress)
	}
}

func TestParsePrice_MapNonStringAmount(t *testing.T) {
	server := NewUptoSvmServer()
	price := map[string]interface{}{
		"amount": 5000, // integer, not string
	}
	_, err := server.ParsePrice(price, t402.Network(svm.SolanaMainnetCAIP2))
	if err == nil {
		t.Fatal("expected error for non-string amount, got nil")
	}
	if !strings.Contains(err.Error(), "amount must be a string") {
		t.Errorf("error = %v, want to contain 'amount must be a string'", err)
	}
}

func TestParsePrice_InvalidString(t *testing.T) {
	server := NewUptoSvmServer()
	_, err := server.ParsePrice("not-a-number", t402.Network(svm.SolanaMainnetCAIP2))
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "failed to parse price string") {
		t.Errorf("error = %v, want to contain 'failed to parse price string'", err)
	}
}

func TestParsePrice_UnsupportedNetwork(t *testing.T) {
	server := NewUptoSvmServer()
	_, err := server.ParsePrice(float64(1.0), t402.Network("eip155:1"))
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if !strings.Contains(err.Error(), "unsupported") {
		t.Errorf("error = %v, want to contain 'unsupported'", err)
	}
}

func TestParsePrice_InvalidPriceType(t *testing.T) {
	server := NewUptoSvmServer()
	_, err := server.ParsePrice(true, t402.Network(svm.SolanaMainnetCAIP2))
	if err == nil {
		t.Fatal("expected error for bool price type, got nil")
	}
	if !strings.Contains(err.Error(), "invalid price format") {
		t.Errorf("error = %v, want to contain 'invalid price format'", err)
	}
}

func TestParsePrice_StringWithCurrency(t *testing.T) {
	server := NewUptoSvmServer()
	result, err := server.ParsePrice("1.50 USDC", t402.Network(svm.SolanaMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if result.Amount != "1500000" {
		t.Errorf("Amount = %v, want 1500000", result.Amount)
	}
}

func TestEnhancePaymentRequirements_Success(t *testing.T) {
	server := NewUptoSvmServer()

	requirements := types.PaymentRequirements{
		Scheme:  upto.SchemeUpto,
		Network: svm.SolanaMainnetCAIP2,
		Amount:  "1000000",
		PayTo:   "11111111111111111111111111111111",
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      upto.SchemeUpto,
		Network:     svm.SolanaMainnetCAIP2,
		Extra: map[string]interface{}{
			"feePayer": "BPFLoaderUpgradeab1e11111111111111111111111",
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
	if result.Asset != svm.USDCMainnetAddress {
		t.Errorf("Asset = %v, want %v", result.Asset, svm.USDCMainnetAddress)
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
	if result.Extra["feePayer"] != "BPFLoaderUpgradeab1e11111111111111111111111" {
		t.Errorf("Extra.feePayer = %v, want BPFLoaderUpgradeab1e11111111111111111111111", result.Extra["feePayer"])
	}
	if result.Extra["maxAmount"] != "1000000" {
		t.Errorf("Extra.maxAmount = %v, want 1000000 (should default to Amount)", result.Extra["maxAmount"])
	}
}

func TestEnhancePaymentRequirements_UnsupportedNetwork(t *testing.T) {
	server := NewUptoSvmServer()

	requirements := types.PaymentRequirements{
		Scheme:  upto.SchemeUpto,
		Network: "eip155:1",
		Amount:  "1000000",
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
	server := NewUptoSvmServer()

	customAsset := "CustomTokenMint111111111111111111111"
	requirements := types.PaymentRequirements{
		Scheme:  upto.SchemeUpto,
		Network: svm.SolanaMainnetCAIP2,
		Asset:   customAsset,
		Amount:  "1000000",
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      upto.SchemeUpto,
		Network:     svm.SolanaMainnetCAIP2,
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
	server := NewUptoSvmServer()

	requirements := types.PaymentRequirements{
		Scheme:  upto.SchemeUpto,
		Network: svm.SolanaMainnetCAIP2,
		Amount:  "1000000",
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      upto.SchemeUpto,
		Network:     svm.SolanaMainnetCAIP2,
		Extra: map[string]interface{}{
			"feePayer":     "BPFLoaderUpgradeab1e11111111111111111111111",
			"customExtKey": "customExtValue",
		},
	}

	extensionKeys := []string{"customExtKey"}

	result, err := server.EnhancePaymentRequirements(
		context.Background(), requirements, supportedKind, extensionKeys,
	)
	if err != nil {
		t.Fatalf("EnhancePaymentRequirements() error: %v", err)
	}

	if result.Extra["customExtKey"] != "customExtValue" {
		t.Errorf("Extra.customExtKey = %v, want customExtValue", result.Extra["customExtKey"])
	}
}

func TestEnhancePaymentRequirements_MaxAmountPreserved(t *testing.T) {
	server := NewUptoSvmServer()

	requirements := types.PaymentRequirements{
		Scheme:  upto.SchemeUpto,
		Network: svm.SolanaMainnetCAIP2,
		Amount:  "1000000",
		Extra: map[string]interface{}{
			"maxAmount": "5000000",
		},
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      upto.SchemeUpto,
		Network:     svm.SolanaMainnetCAIP2,
	}

	result, err := server.EnhancePaymentRequirements(
		context.Background(), requirements, supportedKind, nil,
	)
	if err != nil {
		t.Fatalf("EnhancePaymentRequirements() error: %v", err)
	}

	// maxAmount should be preserved if already set
	if result.Extra["maxAmount"] != "5000000" {
		t.Errorf("Extra.maxAmount = %v, want 5000000 (should be preserved)", result.Extra["maxAmount"])
	}
}

func TestRegisterMoneyParser(t *testing.T) {
	server := NewUptoSvmServer()

	parserCalled := false
	customParser := func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
		parserCalled = true
		return &t402.AssetAmount{
			Amount: "42",
			Asset:  "custom_asset",
		}, nil
	}

	server.RegisterMoneyParser(customParser)

	result, err := server.ParsePrice(float64(1.0), t402.Network(svm.SolanaMainnetCAIP2))
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

func TestRegisterMoneyParser_NilFallsThrough(t *testing.T) {
	server := NewUptoSvmServer()

	// First parser returns nil (skip)
	server.RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
		return nil, nil
	})

	// Second parser handles it
	server.RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
		return &t402.AssetAmount{
			Amount: "99",
			Asset:  "second_parser_asset",
		}, nil
	})

	result, err := server.ParsePrice(float64(1.0), t402.Network(svm.SolanaMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if result.Amount != "99" {
		t.Errorf("Amount = %v, want 99", result.Amount)
	}
	if result.Asset != "second_parser_asset" {
		t.Errorf("Asset = %v, want second_parser_asset", result.Asset)
	}
}

func TestRegisterMoneyParser_Chainability(t *testing.T) {
	server := NewUptoSvmServer().
		RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
			return nil, nil
		}).
		RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
			return nil, nil
		})

	if server == nil {
		t.Error("expected RegisterMoneyParser to return server for chaining")
	}
}

func TestSetMaxAmount(t *testing.T) {
	server := NewUptoSvmServer()
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
	server := NewUptoSvmServer()
	requirements := &types.PaymentRequirements{}

	err := server.SetMaxAmount(requirements, "not-a-number")
	if err == nil {
		t.Fatal("expected error for invalid maxAmount, got nil")
	}
	if !strings.Contains(err.Error(), "invalid maxAmount") {
		t.Errorf("error = %v, want to contain 'invalid maxAmount'", err)
	}
}

func TestSetMaxAmount_NilExtra(t *testing.T) {
	server := NewUptoSvmServer()
	requirements := &types.PaymentRequirements{Extra: nil}

	err := server.SetMaxAmount(requirements, "5000000")
	if err != nil {
		t.Fatalf("SetMaxAmount() error: %v", err)
	}
	if requirements.Extra == nil {
		t.Fatal("Extra should be initialized")
	}
	if requirements.Extra["maxAmount"] != "5000000" {
		t.Errorf("Extra.maxAmount = %v, want 5000000", requirements.Extra["maxAmount"])
	}
}

func TestSetMinAmount(t *testing.T) {
	server := NewUptoSvmServer()
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
	server := NewUptoSvmServer()
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
	server := NewUptoSvmServer()
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
	server := NewUptoSvmServer()
	requirements := &types.PaymentRequirements{}

	err := server.SetBillingUnit(requirements, "token", "not-a-number")
	if err == nil {
		t.Fatal("expected error for invalid unitPrice, got nil")
	}
	if !strings.Contains(err.Error(), "invalid unitPrice") {
		t.Errorf("error = %v, want to contain 'invalid unitPrice'", err)
	}
}

func TestCalculateSettleAmount(t *testing.T) {
	server := NewUptoSvmServer()

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
	server := NewUptoSvmServer()

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

func TestCalculateSettleAmount_MissingExtra(t *testing.T) {
	server := NewUptoSvmServer()

	requirements := types.PaymentRequirements{}

	_, err := server.CalculateSettleAmount(requirements, 5)
	if err == nil {
		t.Fatal("expected error for missing extra, got nil")
	}
	if !strings.Contains(err.Error(), "no extra data") {
		t.Errorf("error = %v, want to contain 'no extra data'", err)
	}
}

func TestCalculateSettleAmount_MissingUnitPrice(t *testing.T) {
	server := NewUptoSvmServer()

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
	server := NewUptoSvmServer()

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
	server := NewUptoSvmServer()

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
	server := NewUptoSvmServer()

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
	server := NewUptoSvmServer()

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

func TestValidateSettleAmount_BelowRequiredAmount(t *testing.T) {
	server := NewUptoSvmServer()

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
	server := NewUptoSvmServer()

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
	server := NewUptoSvmServer()

	requirements := types.PaymentRequirements{
		Amount: "1000000",
	}

	// Should not error when extra is nil (no min/max constraints)
	err := server.ValidateSettleAmount(requirements, "1000000")
	if err != nil {
		t.Errorf("ValidateSettleAmount() unexpected error: %v", err)
	}
}

func TestFormatAmount(t *testing.T) {
	server := NewUptoSvmServer()

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
			amount:   "100000000",
			decimals: 6,
			want:     "100",
		},
		{
			name:     "invalid amount returns original",
			amount:   "not-a-number",
			decimals: 6,
			want:     "not-a-number",
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
	server := NewUptoSvmServer()

	// Known mainnet USDC
	decimals := server.GetTokenDecimals(t402.Network(svm.SolanaMainnetCAIP2), svm.USDCMainnetAddress)
	if decimals != 6 {
		t.Errorf("GetTokenDecimals(mainnet, USDC) = %v, want 6", decimals)
	}

	// Known devnet USDC
	decimals = server.GetTokenDecimals(t402.Network(svm.SolanaDevnetCAIP2), svm.USDCDevnetAddress)
	if decimals != 6 {
		t.Errorf("GetTokenDecimals(devnet, USDC) = %v, want 6", decimals)
	}

	// Unknown network defaults to 6
	decimals = server.GetTokenDecimals(t402.Network("unknown:network"), "some_asset")
	if decimals != 6 {
		t.Errorf("GetTokenDecimals(unknown) = %v, want 6", decimals)
	}

	// Unknown asset defaults to 6
	decimals = server.GetTokenDecimals(t402.Network(svm.SolanaMainnetCAIP2), "unknown_asset")
	if decimals != 6 {
		t.Errorf("GetTokenDecimals(unknown asset) = %v, want 6", decimals)
	}
}
