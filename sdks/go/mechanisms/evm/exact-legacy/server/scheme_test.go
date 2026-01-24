package server

import (
	"context"
	"testing"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/types"
)

func TestNewExactLegacyEvmScheme(t *testing.T) {
	scheme := NewExactLegacyEvmScheme()
	if scheme == nil {
		t.Fatal("expected non-nil scheme")
	}
}

func TestScheme(t *testing.T) {
	scheme := NewExactLegacyEvmScheme()
	if scheme.Scheme() != "exact-legacy" {
		t.Errorf("expected scheme 'exact-legacy', got '%s'", scheme.Scheme())
	}
}

func TestParsePrice_String(t *testing.T) {
	scheme := NewExactLegacyEvmScheme()

	tests := []struct {
		name    string
		price   t402.Price
		network t402.Network
		wantErr bool
	}{
		{"dollar sign", "$1.50", "eip155:8453", false},
		{"plain number", "2.00", "eip155:8453", false},
		{"integer", 5, "eip155:8453", false},
		{"float", 1.50, "eip155:8453", false},
		{"with USDT suffix", "10.00 USDT", "eip155:8453", false},
		{"invalid string", "abc", "eip155:8453", true},
		{"invalid network", "$1.00", "invalid:net", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := scheme.ParsePrice(tt.price, tt.network)
			if tt.wantErr {
				if err == nil {
					t.Error("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if result.Amount == "" {
				t.Error("expected non-empty amount")
			}
			if result.Asset == "" {
				t.Error("expected non-empty asset")
			}
		})
	}
}

func TestParsePrice_AssetAmount(t *testing.T) {
	scheme := NewExactLegacyEvmScheme()

	price := map[string]interface{}{
		"amount": "1500000",
		"asset":  "0x1234567890abcdef1234567890abcdef12345678",
	}

	result, err := scheme.ParsePrice(price, "eip155:8453")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Amount != "1500000" {
		t.Errorf("expected amount '1500000', got '%s'", result.Amount)
	}
	if result.Asset != "0x1234567890abcdef1234567890abcdef12345678" {
		t.Errorf("unexpected asset: %s", result.Asset)
	}
}

func TestParsePrice_AssetAmountMissingAsset(t *testing.T) {
	scheme := NewExactLegacyEvmScheme()

	price := map[string]interface{}{
		"amount": "1500000",
	}

	_, err := scheme.ParsePrice(price, "eip155:8453")
	if err == nil {
		t.Error("expected error for missing asset")
	}
}

func TestParsePrice_AssetAmountInvalidAmountType(t *testing.T) {
	scheme := NewExactLegacyEvmScheme()

	price := map[string]interface{}{
		"amount": 1500000, // number, not string
		"asset":  "0x1234567890abcdef1234567890abcdef12345678",
	}

	_, err := scheme.ParsePrice(price, "eip155:8453")
	if err == nil {
		t.Error("expected error for non-string amount")
	}
}

func TestParsePrice_WithExtra(t *testing.T) {
	scheme := NewExactLegacyEvmScheme()

	price := map[string]interface{}{
		"amount": "2000000",
		"asset":  "0x1234567890abcdef1234567890abcdef12345678",
		"extra": map[string]interface{}{
			"token": "USDT",
		},
	}

	result, err := scheme.ParsePrice(price, "eip155:8453")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Extra["token"] != "USDT" {
		t.Errorf("expected extra token 'USDT', got '%v'", result.Extra["token"])
	}
}

func TestParsePrice_UnsupportedType(t *testing.T) {
	scheme := NewExactLegacyEvmScheme()

	_, err := scheme.ParsePrice([]string{"invalid"}, "eip155:8453")
	if err == nil {
		t.Error("expected error for unsupported price type")
	}
}

func TestEnhancePaymentRequirements(t *testing.T) {
	scheme := NewExactLegacyEvmScheme()

	requirements := types.PaymentRequirements{
		Network: "eip155:8453",
		PayTo:   "0x2222222222222222222222222222222222222222",
		Amount:  "1000000",
	}

	supportedKind := types.SupportedKind{
		Extra: map[string]interface{}{
			"spender": "0xfacilitator",
		},
	}

	result, err := scheme.EnhancePaymentRequirements(context.Background(), requirements, supportedKind, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Extra == nil {
		t.Fatal("expected extra to be set")
	}

	if result.Extra["tokenType"] != "legacy" {
		t.Errorf("expected tokenType 'legacy', got '%v'", result.Extra["tokenType"])
	}

	if result.Extra["spender"] != "0xfacilitator" {
		t.Errorf("expected spender from supportedKind, got '%v'", result.Extra["spender"])
	}

	if result.Extra["name"] != "T402LegacyTransfer" {
		t.Errorf("expected name 'T402LegacyTransfer', got '%v'", result.Extra["name"])
	}

	if result.Extra["version"] != "1" {
		t.Errorf("expected version '1', got '%v'", result.Extra["version"])
	}
}

func TestEnhancePaymentRequirements_WithDecimalAmount(t *testing.T) {
	scheme := NewExactLegacyEvmScheme()

	requirements := types.PaymentRequirements{
		Network: "eip155:8453",
		PayTo:   "0x2222222222222222222222222222222222222222",
		Amount:  "1.50",
	}

	supportedKind := types.SupportedKind{
		Extra: map[string]interface{}{
			"spender": "0xfacilitator",
		},
	}

	result, err := scheme.EnhancePaymentRequirements(context.Background(), requirements, supportedKind, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Amount should be converted to smallest unit (1.50 -> 1500000 with 6 decimals)
	if result.Amount != "1500000" {
		t.Errorf("expected amount '1500000', got '%s'", result.Amount)
	}
}

func TestEnhancePaymentRequirements_DefaultAsset(t *testing.T) {
	scheme := NewExactLegacyEvmScheme()

	requirements := types.PaymentRequirements{
		Network: "eip155:8453",
		PayTo:   "0x2222222222222222222222222222222222222222",
		Amount:  "1000000",
		Asset:   "", // No asset specified
	}

	supportedKind := types.SupportedKind{
		Extra: map[string]interface{}{
			"spender": "0xfacilitator",
		},
	}

	result, err := scheme.EnhancePaymentRequirements(context.Background(), requirements, supportedKind, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Should use the default asset for the network
	if result.Asset == "" {
		t.Error("expected asset to be set to default")
	}
}

func TestEnhancePaymentRequirements_PreserveExistingExtra(t *testing.T) {
	scheme := NewExactLegacyEvmScheme()

	requirements := types.PaymentRequirements{
		Network: "eip155:8453",
		PayTo:   "0x2222222222222222222222222222222222222222",
		Amount:  "1000000",
		Extra: map[string]interface{}{
			"name":    "CustomTokenName",
			"version": "3",
		},
	}

	supportedKind := types.SupportedKind{
		Extra: map[string]interface{}{
			"spender": "0xfacilitator",
		},
	}

	result, err := scheme.EnhancePaymentRequirements(context.Background(), requirements, supportedKind, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Custom name and version should be preserved
	if result.Extra["name"] != "CustomTokenName" {
		t.Errorf("expected name 'CustomTokenName' to be preserved, got '%v'", result.Extra["name"])
	}
	if result.Extra["version"] != "3" {
		t.Errorf("expected version '3' to be preserved, got '%v'", result.Extra["version"])
	}

	// tokenType and spender should still be set
	if result.Extra["tokenType"] != "legacy" {
		t.Errorf("expected tokenType 'legacy', got '%v'", result.Extra["tokenType"])
	}
	if result.Extra["spender"] != "0xfacilitator" {
		t.Errorf("expected spender '0xfacilitator', got '%v'", result.Extra["spender"])
	}
}

func TestEnhancePaymentRequirements_ExtensionKeys(t *testing.T) {
	scheme := NewExactLegacyEvmScheme()

	requirements := types.PaymentRequirements{
		Network: "eip155:8453",
		PayTo:   "0x2222222222222222222222222222222222222222",
		Amount:  "1000000",
	}

	supportedKind := types.SupportedKind{
		Extra: map[string]interface{}{
			"spender":      "0xfacilitator",
			"resourceInfo": "https://example.com/resource",
			"customField":  "value",
		},
	}

	extensionKeys := []string{"resourceInfo", "customField"}

	result, err := scheme.EnhancePaymentRequirements(context.Background(), requirements, supportedKind, extensionKeys)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Extra["resourceInfo"] != "https://example.com/resource" {
		t.Errorf("expected resourceInfo extension, got '%v'", result.Extra["resourceInfo"])
	}
	if result.Extra["customField"] != "value" {
		t.Errorf("expected customField extension, got '%v'", result.Extra["customField"])
	}
}

func TestEnhancePaymentRequirements_InvalidNetwork(t *testing.T) {
	scheme := NewExactLegacyEvmScheme()

	requirements := types.PaymentRequirements{
		Network: "invalid:network",
		PayTo:   "0x2222222222222222222222222222222222222222",
		Amount:  "1000000",
	}

	supportedKind := types.SupportedKind{}

	_, err := scheme.EnhancePaymentRequirements(context.Background(), requirements, supportedKind, nil)
	if err == nil {
		t.Error("expected error for invalid network")
	}
}

func TestGetDisplayAmount(t *testing.T) {
	scheme := NewExactLegacyEvmScheme()

	tests := []struct {
		name     string
		amount   string
		network  string
		asset    string
		expected string
		wantErr  bool
	}{
		{"1.5 USDT", "1500000", "eip155:8453", "", "$1.5 USDT", false},
		{"1 USDT", "1000000", "eip155:8453", "", "$1 USDT", false},
		{"invalid amount", "abc", "eip155:8453", "", "", true},
		{"invalid network", "1000000", "invalid:net", "", "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := scheme.GetDisplayAmount(tt.amount, tt.network, tt.asset)
			if tt.wantErr {
				if err == nil {
					t.Error("expected error")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if result != tt.expected {
				t.Errorf("expected '%s', got '%s'", tt.expected, result)
			}
		})
	}
}

func TestValidatePaymentRequirements(t *testing.T) {
	scheme := NewExactLegacyEvmScheme()

	tests := []struct {
		name    string
		req     t402.PaymentRequirements
		wantErr bool
	}{
		{
			"valid",
			t402.PaymentRequirements{
				Network: "eip155:8453",
				PayTo:   "0x2222222222222222222222222222222222222222",
				Amount:  "1000000",
			},
			false,
		},
		{
			"invalid network",
			t402.PaymentRequirements{
				Network: "invalid:net",
				PayTo:   "0x2222222222222222222222222222222222222222",
				Amount:  "1000000",
			},
			true,
		},
		{
			"invalid payTo",
			t402.PaymentRequirements{
				Network: "eip155:8453",
				PayTo:   "not-an-address",
				Amount:  "1000000",
			},
			true,
		},
		{
			"empty amount",
			t402.PaymentRequirements{
				Network: "eip155:8453",
				PayTo:   "0x2222222222222222222222222222222222222222",
				Amount:  "",
			},
			true,
		},
		{
			"invalid amount",
			t402.PaymentRequirements{
				Network: "eip155:8453",
				PayTo:   "0x2222222222222222222222222222222222222222",
				Amount:  "abc",
			},
			true,
		},
		{
			"zero amount",
			t402.PaymentRequirements{
				Network: "eip155:8453",
				PayTo:   "0x2222222222222222222222222222222222222222",
				Amount:  "0",
			},
			true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := scheme.ValidatePaymentRequirements(tt.req)
			if tt.wantErr && err == nil {
				t.Error("expected error")
			}
			if !tt.wantErr && err != nil {
				t.Errorf("unexpected error: %v", err)
			}
		})
	}
}

func TestConvertToTokenAmount(t *testing.T) {
	scheme := NewExactLegacyEvmScheme()

	result, err := scheme.ConvertToTokenAmount("1.50", "eip155:8453")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != "1500000" {
		t.Errorf("expected '1500000', got '%s'", result)
	}
}

func TestConvertFromTokenAmount(t *testing.T) {
	scheme := NewExactLegacyEvmScheme()

	result, err := scheme.ConvertFromTokenAmount("1500000", "eip155:8453")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != "1.5" {
		t.Errorf("expected '1.5', got '%s'", result)
	}
}

func TestRegisterMoneyParser(t *testing.T) {
	scheme := NewExactLegacyEvmScheme()

	// Register custom parser
	result := scheme.RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
		if amount > 100 {
			return &t402.AssetAmount{
				Amount: "100000000000000000000",
				Asset:  "0xCustomToken",
				Extra:  map[string]interface{}{"tier": "large"},
			}, nil
		}
		return nil, nil
	})

	// Check chainability
	if result != scheme {
		t.Error("expected RegisterMoneyParser to return scheme for chaining")
	}

	// Test custom parser handles large amount
	assetAmount, err := scheme.ParsePrice(150.0, "eip155:8453")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if assetAmount.Asset != "0xCustomToken" {
		t.Errorf("expected custom token, got %s", assetAmount.Asset)
	}

	// Test default handles small amount
	assetAmount, err = scheme.ParsePrice(5.0, "eip155:8453")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if assetAmount.Asset == "0xCustomToken" {
		t.Error("expected default asset for small amount, got custom token")
	}
}

func TestGetSupportedNetworks(t *testing.T) {
	scheme := NewExactLegacyEvmScheme()
	networks := scheme.GetSupportedNetworks()
	if len(networks) == 0 {
		t.Error("expected at least one supported network")
	}
}

func TestGetSupportedAssets(t *testing.T) {
	scheme := NewExactLegacyEvmScheme()

	assets, err := scheme.GetSupportedAssets("eip155:8453")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(assets) == 0 {
		t.Error("expected at least one supported asset")
	}
}

func TestGetSupportedAssets_InvalidNetwork(t *testing.T) {
	scheme := NewExactLegacyEvmScheme()

	_, err := scheme.GetSupportedAssets("invalid:net")
	if err == nil {
		t.Error("expected error for invalid network")
	}
}
