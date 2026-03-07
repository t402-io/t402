package server

import (
	"context"
	"testing"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/stellar"
	"github.com/t402-io/t402/sdks/go/types"
)

func TestScheme(t *testing.T) {
	scheme := NewExactStellarScheme()

	if scheme.Scheme() != "exact" {
		t.Errorf("Scheme() = %v, want exact", scheme.Scheme())
	}
}

func TestParsePrice_AssetAmountMap(t *testing.T) {
	tests := []struct {
		name       string
		price      map[string]interface{}
		network    string
		wantAmount string
		wantAsset  string
	}{
		{
			name: "explicit asset and amount",
			price: map[string]interface{}{
				"amount": "10000000",
				"asset":  stellar.USDCPubnetAddress,
			},
			network:    stellar.StellarPubnetCAIP2,
			wantAmount: "10000000",
			wantAsset:  stellar.USDCPubnetAddress,
		},
		{
			name: "amount without asset uses default",
			price: map[string]interface{}{
				"amount": "50000000",
			},
			network:    stellar.StellarPubnetCAIP2,
			wantAmount: "50000000",
			wantAsset:  stellar.USDCPubnetAddress,
		},
		{
			name: "with extra fields",
			price: map[string]interface{}{
				"amount": "20000000",
				"asset":  stellar.USDCPubnetAddress,
				"extra": map[string]interface{}{
					"memo": "test payment",
				},
			},
			network:    stellar.StellarPubnetCAIP2,
			wantAmount: "20000000",
			wantAsset:  stellar.USDCPubnetAddress,
		},
		{
			name: "testnet uses testnet asset",
			price: map[string]interface{}{
				"amount": "30000000",
			},
			network:    stellar.StellarTestnetCAIP2,
			wantAmount: "30000000",
			wantAsset:  stellar.USDCTestnetAddress,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := NewExactStellarScheme()
			result, err := scheme.ParsePrice(tt.price, t402.Network(tt.network))
			if err != nil {
				t.Fatalf("ParsePrice() error: %v", err)
			}
			if result.Amount != tt.wantAmount {
				t.Errorf("Amount = %v, want %v", result.Amount, tt.wantAmount)
			}
			if result.Asset != tt.wantAsset {
				t.Errorf("Asset = %v, want %v", result.Asset, tt.wantAsset)
			}
		})
	}
}

func TestParsePrice_MoneyString(t *testing.T) {
	tests := []struct {
		name       string
		price      string
		network    string
		wantAmount string
		wantAsset  string
	}{
		{
			name:       "dollar format",
			price:      "$1.50",
			network:    stellar.StellarPubnetCAIP2,
			wantAmount: "15000000",
			wantAsset:  stellar.USDCPubnetAddress,
		},
		{
			name:       "plain decimal",
			price:      "2.50",
			network:    stellar.StellarPubnetCAIP2,
			wantAmount: "25000000",
			wantAsset:  stellar.USDCPubnetAddress,
		},
		{
			name:       "integer amount",
			price:      "10",
			network:    stellar.StellarPubnetCAIP2,
			wantAmount: "100000000",
			wantAsset:  stellar.USDCPubnetAddress,
		},
		{
			name:       "dollar with space",
			price:      "$ 5.00",
			network:    stellar.StellarPubnetCAIP2,
			wantAmount: "50000000",
			wantAsset:  stellar.USDCPubnetAddress,
		},
		{
			name:       "small amount",
			price:      "0.01",
			network:    stellar.StellarPubnetCAIP2,
			wantAmount: "100000",
			wantAsset:  stellar.USDCPubnetAddress,
		},
		{
			name:       "testnet uses testnet asset",
			price:      "1.00",
			network:    stellar.StellarTestnetCAIP2,
			wantAmount: "10000000",
			wantAsset:  stellar.USDCTestnetAddress,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := NewExactStellarScheme()
			result, err := scheme.ParsePrice(tt.price, t402.Network(tt.network))
			if err != nil {
				t.Fatalf("ParsePrice() error: %v", err)
			}
			if result.Amount != tt.wantAmount {
				t.Errorf("Amount = %v, want %v", result.Amount, tt.wantAmount)
			}
			if result.Asset != tt.wantAsset {
				t.Errorf("Asset = %v, want %v", result.Asset, tt.wantAsset)
			}
		})
	}
}

func TestParsePrice_NumberInput(t *testing.T) {
	tests := []struct {
		name       string
		price      interface{}
		wantAmount string
	}{
		{
			name:       "float64",
			price:      1.50,
			wantAmount: "15000000",
		},
		{
			name:       "integer",
			price:      int(5),
			wantAmount: "50000000",
		},
		{
			name:       "int64",
			price:      int64(10),
			wantAmount: "100000000",
		},
		{
			name:       "zero",
			price:      0.0,
			wantAmount: "0",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := NewExactStellarScheme()
			result, err := scheme.ParsePrice(tt.price, stellar.StellarPubnetCAIP2)
			if err != nil {
				t.Fatalf("ParsePrice() error: %v", err)
			}
			if result.Amount != tt.wantAmount {
				t.Errorf("Amount = %v, want %v", result.Amount, tt.wantAmount)
			}
		})
	}
}

func TestParsePrice_InvalidInputs(t *testing.T) {
	tests := []struct {
		name       string
		price      interface{}
		network    string
		wantErrMsg string
	}{
		{
			name:       "unsupported network",
			price:      1.00,
			network:    "eip155:1",
			wantErrMsg: "unsupported",
		},
		{
			name:       "invalid string format",
			price:      "not-a-number",
			network:    stellar.StellarPubnetCAIP2,
			wantErrMsg: "failed to parse price string",
		},
		{
			name:       "boolean type",
			price:      true,
			network:    stellar.StellarPubnetCAIP2,
			wantErrMsg: "invalid price format",
		},
		{
			name: "amount not a string",
			price: map[string]interface{}{
				"amount": 12345,
			},
			network:    stellar.StellarPubnetCAIP2,
			wantErrMsg: "amount must be a string",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := NewExactStellarScheme()
			_, err := scheme.ParsePrice(tt.price, t402.Network(tt.network))
			if err == nil {
				t.Fatal("Expected error, got nil")
			}
			if tt.wantErrMsg != "" && !containsStr(err.Error(), tt.wantErrMsg) {
				t.Errorf("Error = %v, want to contain %v", err.Error(), tt.wantErrMsg)
			}
		})
	}
}

func TestEnhancePaymentRequirements_Basic(t *testing.T) {
	scheme := NewExactStellarScheme()

	requirements := types.PaymentRequirements{
		Scheme:  stellar.SchemeExact,
		Network: stellar.StellarPubnetCAIP2,
		Asset:   stellar.USDCPubnetAddress,
		Amount:  "10000000",
		PayTo:   "GBDEVU63Y6NTHJQQZIKVTC2LSQLMEAIFYRP2XAJDDQVWRDQJLEVLWM36",
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      stellar.SchemeExact,
		Network:     stellar.StellarPubnetCAIP2,
		Extra: map[string]interface{}{
			"symbol":   "USDC",
			"decimals": 7,
		},
	}

	result, err := scheme.EnhancePaymentRequirements(
		context.Background(), requirements, supportedKind, nil,
	)
	if err != nil {
		t.Fatalf("EnhancePaymentRequirements() error: %v", err)
	}

	if result.Extra["symbol"] != "USDC" {
		t.Errorf("Extra.symbol = %v, want USDC", result.Extra["symbol"])
	}
}

func TestEnhancePaymentRequirements_DefaultAsset(t *testing.T) {
	scheme := NewExactStellarScheme()

	requirements := types.PaymentRequirements{
		Scheme:  stellar.SchemeExact,
		Network: stellar.StellarPubnetCAIP2,
		Asset:   "",
		Amount:  "10000000",
		PayTo:   "GBDEVU63Y6NTHJQQZIKVTC2LSQLMEAIFYRP2XAJDDQVWRDQJLEVLWM36",
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      stellar.SchemeExact,
		Network:     stellar.StellarPubnetCAIP2,
	}

	result, err := scheme.EnhancePaymentRequirements(
		context.Background(), requirements, supportedKind, nil,
	)
	if err != nil {
		t.Fatalf("EnhancePaymentRequirements() error: %v", err)
	}

	if result.Asset != stellar.USDCPubnetAddress {
		t.Errorf("Asset = %v, want %v", result.Asset, stellar.USDCPubnetAddress)
	}
}

func TestEnhancePaymentRequirements_DecimalAmount(t *testing.T) {
	scheme := NewExactStellarScheme()

	requirements := types.PaymentRequirements{
		Scheme:  stellar.SchemeExact,
		Network: stellar.StellarPubnetCAIP2,
		Asset:   stellar.USDCPubnetAddress,
		Amount:  "1.50",
		PayTo:   "GBDEVU63Y6NTHJQQZIKVTC2LSQLMEAIFYRP2XAJDDQVWRDQJLEVLWM36",
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      stellar.SchemeExact,
		Network:     stellar.StellarPubnetCAIP2,
	}

	result, err := scheme.EnhancePaymentRequirements(
		context.Background(), requirements, supportedKind, nil,
	)
	if err != nil {
		t.Fatalf("EnhancePaymentRequirements() error: %v", err)
	}

	if result.Amount != "15000000" {
		t.Errorf("Amount = %v, want 15000000", result.Amount)
	}
}

func TestEnhancePaymentRequirements_InvalidNetwork(t *testing.T) {
	scheme := NewExactStellarScheme()

	requirements := types.PaymentRequirements{
		Scheme:  stellar.SchemeExact,
		Network: "eip155:1",
		Asset:   stellar.USDCPubnetAddress,
		Amount:  "10000000",
		PayTo:   "GBDEVU63Y6NTHJQQZIKVTC2LSQLMEAIFYRP2XAJDDQVWRDQJLEVLWM36",
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      stellar.SchemeExact,
		Network:     "eip155:1",
	}

	_, err := scheme.EnhancePaymentRequirements(
		context.Background(), requirements, supportedKind, nil,
	)
	if err == nil {
		t.Fatal("Expected error for unsupported network, got nil")
	}
}

func TestEnhancePaymentRequirements_NilExtra(t *testing.T) {
	scheme := NewExactStellarScheme()

	requirements := types.PaymentRequirements{
		Scheme:  stellar.SchemeExact,
		Network: stellar.StellarPubnetCAIP2,
		Asset:   stellar.USDCPubnetAddress,
		Amount:  "10000000",
		PayTo:   "GBDEVU63Y6NTHJQQZIKVTC2LSQLMEAIFYRP2XAJDDQVWRDQJLEVLWM36",
		Extra:   nil,
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      stellar.SchemeExact,
		Network:     stellar.StellarPubnetCAIP2,
		Extra: map[string]interface{}{
			"symbol": "USDC",
		},
	}

	result, err := scheme.EnhancePaymentRequirements(
		context.Background(), requirements, supportedKind, nil,
	)
	if err != nil {
		t.Fatalf("EnhancePaymentRequirements() error: %v", err)
	}

	if result.Extra == nil {
		t.Fatal("Expected Extra to be initialized")
	}
}

func TestDefaultMoneyConversion_IncludesTokenMetadata(t *testing.T) {
	scheme := NewExactStellarScheme()

	result, err := scheme.ParsePrice(1.00, stellar.StellarPubnetCAIP2)
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}

	if result.Extra["symbol"] != "USDC" {
		t.Errorf("Extra.symbol = %v, want USDC", result.Extra["symbol"])
	}
	if result.Extra["decimals"] != stellar.DefaultDecimals {
		t.Errorf("Extra.decimals = %v, want %d", result.Extra["decimals"], stellar.DefaultDecimals)
	}
}

// containsStr checks if a string contains a substring
func containsStr(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
