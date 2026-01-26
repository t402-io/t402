package server

import (
	"context"
	"testing"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/cosmos"
	"github.com/t402-io/t402/sdks/go/types"
)

func TestNewExactDirectCosmosScheme(t *testing.T) {
	scheme := NewExactDirectCosmosScheme()
	if scheme == nil {
		t.Fatal("expected non-nil scheme")
	}
}

func TestExactDirectCosmosScheme_Scheme(t *testing.T) {
	scheme := NewExactDirectCosmosScheme()
	if got := scheme.Scheme(); got != cosmos.SchemeExactDirect {
		t.Errorf("Scheme() = %v, want %v", got, cosmos.SchemeExactDirect)
	}
}

func TestExactDirectCosmosScheme_ParsePrice_Float(t *testing.T) {
	scheme := NewExactDirectCosmosScheme()

	result, err := scheme.ParsePrice(1.50, t402.Network(cosmos.NobleMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error = %v", err)
	}

	if result.Asset != "uusdc" {
		t.Errorf("Asset = %v, want uusdc", result.Asset)
	}
	if result.Amount != "1500000" {
		t.Errorf("Amount = %v, want 1500000", result.Amount)
	}
}

func TestExactDirectCosmosScheme_ParsePrice_String(t *testing.T) {
	scheme := NewExactDirectCosmosScheme()

	result, err := scheme.ParsePrice("$2.50", t402.Network(cosmos.NobleMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error = %v", err)
	}

	if result.Amount != "2500000" {
		t.Errorf("Amount = %v, want 2500000", result.Amount)
	}
}

func TestExactDirectCosmosScheme_ParsePrice_Int(t *testing.T) {
	scheme := NewExactDirectCosmosScheme()

	result, err := scheme.ParsePrice(3, t402.Network(cosmos.NobleMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error = %v", err)
	}

	if result.Amount != "3000000" {
		t.Errorf("Amount = %v, want 3000000", result.Amount)
	}
}

func TestExactDirectCosmosScheme_ParsePrice_Map(t *testing.T) {
	scheme := NewExactDirectCosmosScheme()

	priceMap := map[string]interface{}{
		"amount": "5000000",
		"asset":  "uusdc",
	}

	result, err := scheme.ParsePrice(priceMap, t402.Network(cosmos.NobleMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error = %v", err)
	}

	if result.Amount != "5000000" {
		t.Errorf("Amount = %v, want 5000000", result.Amount)
	}
	if result.Asset != "uusdc" {
		t.Errorf("Asset = %v, want uusdc", result.Asset)
	}
}

func TestExactDirectCosmosScheme_ParsePrice_UnsupportedNetwork(t *testing.T) {
	scheme := NewExactDirectCosmosScheme()

	_, err := scheme.ParsePrice(1.0, t402.Network("cosmos:unknown"))
	if err == nil {
		t.Error("expected error for unsupported network")
	}
}

func TestExactDirectCosmosScheme_EnhancePaymentRequirements(t *testing.T) {
	scheme := NewExactDirectCosmosScheme()

	requirements := types.PaymentRequirements{
		Scheme:  cosmos.SchemeExactDirect,
		Network: cosmos.NobleMainnetCAIP2,
		Amount:  "1000000",
		PayTo:   "noble1receiver",
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      cosmos.SchemeExactDirect,
		Network:     cosmos.NobleMainnetCAIP2,
		Extra: map[string]interface{}{
			"assetSymbol":   "USDC",
			"assetDecimals": 6,
		},
	}

	result, err := scheme.EnhancePaymentRequirements(context.Background(), requirements, supportedKind, nil)
	if err != nil {
		t.Fatalf("EnhancePaymentRequirements() error = %v", err)
	}

	// Should set default asset
	if result.Asset != "uusdc" {
		t.Errorf("Asset = %v, want uusdc", result.Asset)
	}

	// Should add extra fields
	if result.Extra["chainId"] != "noble-1" {
		t.Errorf("Extra[chainId] = %v, want noble-1", result.Extra["chainId"])
	}
	if result.Extra["bech32Prefix"] != "noble" {
		t.Errorf("Extra[bech32Prefix] = %v, want noble", result.Extra["bech32Prefix"])
	}
	if result.Extra["denom"] != "uusdc" {
		t.Errorf("Extra[denom] = %v, want uusdc", result.Extra["denom"])
	}
	if result.Extra["assetSymbol"] != "USDC" {
		t.Errorf("Extra[assetSymbol] = %v, want USDC", result.Extra["assetSymbol"])
	}
}

func TestExactDirectCosmosScheme_EnhancePaymentRequirements_DecimalAmount(t *testing.T) {
	scheme := NewExactDirectCosmosScheme()

	requirements := types.PaymentRequirements{
		Scheme:  cosmos.SchemeExactDirect,
		Network: cosmos.NobleMainnetCAIP2,
		Amount:  "1.50",
		PayTo:   "noble1receiver",
		Asset:   "uusdc",
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      cosmos.SchemeExactDirect,
		Network:     cosmos.NobleMainnetCAIP2,
	}

	result, err := scheme.EnhancePaymentRequirements(context.Background(), requirements, supportedKind, nil)
	if err != nil {
		t.Fatalf("EnhancePaymentRequirements() error = %v", err)
	}

	// Should convert decimal to atomic units
	if result.Amount != "1500000" {
		t.Errorf("Amount = %v, want 1500000", result.Amount)
	}
}

func TestExactDirectCosmosScheme_EnhancePaymentRequirements_UnsupportedNetwork(t *testing.T) {
	scheme := NewExactDirectCosmosScheme()

	requirements := types.PaymentRequirements{
		Network: "cosmos:unknown",
	}

	supportedKind := types.SupportedKind{}

	_, err := scheme.EnhancePaymentRequirements(context.Background(), requirements, supportedKind, nil)
	if err == nil {
		t.Error("expected error for unsupported network")
	}
}

func TestExactDirectCosmosScheme_RegisterMoneyParser(t *testing.T) {
	scheme := NewExactDirectCosmosScheme()

	customParser := func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
		return &t402.AssetAmount{
			Amount: "custom",
			Asset:  "custom",
		}, nil
	}

	scheme.RegisterMoneyParser(customParser)

	result, err := scheme.ParsePrice(1.0, t402.Network(cosmos.NobleMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error = %v", err)
	}

	if result.Amount != "custom" {
		t.Errorf("Amount = %v, want custom", result.Amount)
	}
}

func TestToAtomicUnits(t *testing.T) {
	tests := []struct {
		name     string
		amount   string
		decimals int
		want     string
		wantErr  bool
	}{
		{
			name:     "Integer amount",
			amount:   "1",
			decimals: 6,
			want:     "1000000",
		},
		{
			name:     "Decimal amount",
			amount:   "1.50",
			decimals: 6,
			want:     "1500000",
		},
		{
			name:     "Small decimal",
			amount:   "0.000001",
			decimals: 6,
			want:     "1",
		},
		{
			name:     "Large amount",
			amount:   "1000.00",
			decimals: 6,
			want:     "1000000000",
		},
		{
			name:     "Negative amount",
			amount:   "-1.00",
			decimals: 6,
			wantErr:  true,
		},
		{
			name:     "Invalid amount",
			amount:   "invalid",
			decimals: 6,
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := toAtomicUnits(tt.amount, tt.decimals)
			if (err != nil) != tt.wantErr {
				t.Errorf("toAtomicUnits() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("toAtomicUnits() = %v, want %v", got, tt.want)
			}
		})
	}
}
