package server

import (
	"context"
	"testing"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/tron"
	"github.com/t402-io/t402/sdks/go/types"
)

func TestScheme(t *testing.T) {
	scheme := NewExactTronScheme()

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
				"amount": "1000000",
				"asset":  tron.USDTMainnetAddress,
			},
			network:    tron.TronMainnetCAIP2,
			wantAmount: "1000000",
			wantAsset:  tron.USDTMainnetAddress,
		},
		{
			name: "amount without asset uses default",
			price: map[string]interface{}{
				"amount": "5000000",
			},
			network:    tron.TronMainnetCAIP2,
			wantAmount: "5000000",
			wantAsset:  tron.USDTMainnetAddress,
		},
		{
			name: "with extra fields",
			price: map[string]interface{}{
				"amount": "2000000",
				"asset":  tron.USDTMainnetAddress,
				"extra": map[string]interface{}{
					"memo": "test payment",
				},
			},
			network:    tron.TronMainnetCAIP2,
			wantAmount: "2000000",
			wantAsset:  tron.USDTMainnetAddress,
		},
		{
			name: "nile testnet uses nile asset",
			price: map[string]interface{}{
				"amount": "3000000",
			},
			network:    tron.TronNileCAIP2,
			wantAmount: "3000000",
			wantAsset:  tron.USDTNileAddress,
		},
		{
			name: "shasta testnet uses shasta asset",
			price: map[string]interface{}{
				"amount": "4000000",
			},
			network:    tron.TronShastaCAIP2,
			wantAmount: "4000000",
			wantAsset:  tron.USDTShastaAddress,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := NewExactTronScheme()
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
			network:    tron.TronMainnetCAIP2,
			wantAmount: "1500000",
			wantAsset:  tron.USDTMainnetAddress,
		},
		{
			name:       "plain decimal",
			price:      "2.50",
			network:    tron.TronMainnetCAIP2,
			wantAmount: "2500000",
			wantAsset:  tron.USDTMainnetAddress,
		},
		{
			name:       "integer amount",
			price:      "10",
			network:    tron.TronMainnetCAIP2,
			wantAmount: "10000000",
			wantAsset:  tron.USDTMainnetAddress,
		},
		{
			name:       "dollar with space",
			price:      "$ 5.00",
			network:    tron.TronMainnetCAIP2,
			wantAmount: "5000000",
			wantAsset:  tron.USDTMainnetAddress,
		},
		{
			name:       "small amount",
			price:      "0.01",
			network:    tron.TronMainnetCAIP2,
			wantAmount: "10000",
			wantAsset:  tron.USDTMainnetAddress,
		},
		{
			name:       "nile testnet uses nile asset",
			price:      "1.00",
			network:    tron.TronNileCAIP2,
			wantAmount: "1000000",
			wantAsset:  tron.USDTNileAddress,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := NewExactTronScheme()
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
			wantAmount: "1500000",
		},
		{
			name:       "integer",
			price:      int(5),
			wantAmount: "5000000",
		},
		{
			name:       "int64",
			price:      int64(10),
			wantAmount: "10000000",
		},
		{
			name:       "zero",
			price:      0.0,
			wantAmount: "0",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := NewExactTronScheme()
			result, err := scheme.ParsePrice(tt.price, tron.TronMainnetCAIP2)
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
			network:    tron.TronMainnetCAIP2,
			wantErrMsg: "failed to parse price string",
		},
		{
			name:       "boolean type",
			price:      true,
			network:    tron.TronMainnetCAIP2,
			wantErrMsg: "invalid price format",
		},
		{
			name: "amount not a string",
			price: map[string]interface{}{
				"amount": 12345,
			},
			network:    tron.TronMainnetCAIP2,
			wantErrMsg: "amount must be a string",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := NewExactTronScheme()
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
	scheme := NewExactTronScheme()

	requirements := types.PaymentRequirements{
		Scheme:  tron.SchemeExact,
		Network: tron.TronMainnetCAIP2,
		Asset:   tron.USDTMainnetAddress,
		Amount:  "1000000",
		PayTo:   "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      tron.SchemeExact,
		Network:     tron.TronMainnetCAIP2,
		Extra: map[string]interface{}{
			"symbol":   "USDT",
			"decimals": 6,
		},
	}

	result, err := scheme.EnhancePaymentRequirements(
		context.Background(), requirements, supportedKind, nil,
	)
	if err != nil {
		t.Fatalf("EnhancePaymentRequirements() error: %v", err)
	}

	// Verify extra fields were added
	if result.Extra["symbol"] != "USDT" {
		t.Errorf("Extra.symbol = %v, want USDT", result.Extra["symbol"])
	}
}

func TestEnhancePaymentRequirements_DefaultAsset(t *testing.T) {
	scheme := NewExactTronScheme()

	requirements := types.PaymentRequirements{
		Scheme:  tron.SchemeExact,
		Network: tron.TronMainnetCAIP2,
		Asset:   "", // No asset specified
		Amount:  "1000000",
		PayTo:   "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      tron.SchemeExact,
		Network:     tron.TronMainnetCAIP2,
	}

	result, err := scheme.EnhancePaymentRequirements(
		context.Background(), requirements, supportedKind, nil,
	)
	if err != nil {
		t.Fatalf("EnhancePaymentRequirements() error: %v", err)
	}

	// Default asset should be set
	if result.Asset != tron.USDTMainnetAddress {
		t.Errorf("Asset = %v, want %v", result.Asset, tron.USDTMainnetAddress)
	}
}

func TestEnhancePaymentRequirements_DecimalAmount(t *testing.T) {
	scheme := NewExactTronScheme()

	requirements := types.PaymentRequirements{
		Scheme:  tron.SchemeExact,
		Network: tron.TronMainnetCAIP2,
		Asset:   tron.USDTMainnetAddress,
		Amount:  "1.50", // Decimal amount
		PayTo:   "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      tron.SchemeExact,
		Network:     tron.TronMainnetCAIP2,
	}

	result, err := scheme.EnhancePaymentRequirements(
		context.Background(), requirements, supportedKind, nil,
	)
	if err != nil {
		t.Fatalf("EnhancePaymentRequirements() error: %v", err)
	}

	// Amount should be converted to atomic units
	if result.Amount != "1500000" {
		t.Errorf("Amount = %v, want 1500000", result.Amount)
	}
}

func TestEnhancePaymentRequirements_InvalidNetwork(t *testing.T) {
	scheme := NewExactTronScheme()

	requirements := types.PaymentRequirements{
		Scheme:  tron.SchemeExact,
		Network: "eip155:1",
		Asset:   tron.USDTMainnetAddress,
		Amount:  "1000000",
		PayTo:   "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      tron.SchemeExact,
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
	scheme := NewExactTronScheme()

	requirements := types.PaymentRequirements{
		Scheme:  tron.SchemeExact,
		Network: tron.TronMainnetCAIP2,
		Asset:   tron.USDTMainnetAddress,
		Amount:  "1000000",
		PayTo:   "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
		Extra:   nil, // nil extra map
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      tron.SchemeExact,
		Network:     tron.TronMainnetCAIP2,
		Extra: map[string]interface{}{
			"symbol": "USDT",
		},
	}

	result, err := scheme.EnhancePaymentRequirements(
		context.Background(), requirements, supportedKind, nil,
	)
	if err != nil {
		t.Fatalf("EnhancePaymentRequirements() error: %v", err)
	}

	// Extra should be initialized and populated
	if result.Extra == nil {
		t.Fatal("Expected Extra to be initialized")
	}
}

func TestDefaultMoneyConversion_IncludesTokenMetadata(t *testing.T) {
	scheme := NewExactTronScheme()

	result, err := scheme.ParsePrice(1.00, tron.TronMainnetCAIP2)
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}

	// Default conversion should include token metadata in Extra
	if result.Extra["symbol"] != "USDT" {
		t.Errorf("Extra.symbol = %v, want USDT", result.Extra["symbol"])
	}
	if result.Extra["decimals"] != tron.DefaultDecimals {
		t.Errorf("Extra.decimals = %v, want %d", result.Extra["decimals"], tron.DefaultDecimals)
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
