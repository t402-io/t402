package server

import (
	"context"
	"fmt"
	"testing"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/near"
	"github.com/t402-io/t402/sdks/go/types"
)

func TestScheme(t *testing.T) {
	scheme := NewExactDirectNearScheme(nil)

	if scheme.Scheme() != "exact-direct" {
		t.Errorf("Scheme() = %v, want exact-direct", scheme.Scheme())
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
				"asset":  "usdt.tether-token.near",
			},
			network:    "near:mainnet",
			wantAmount: "1000000",
			wantAsset:  "usdt.tether-token.near",
		},
		{
			name: "amount without asset uses default",
			price: map[string]interface{}{
				"amount": "5000000",
			},
			network:    "near:mainnet",
			wantAmount: "5000000",
			wantAsset:  near.USDTMainnet.ContractID, // default for mainnet
		},
		{
			name: "with extra fields",
			price: map[string]interface{}{
				"amount": "2000000",
				"asset":  "usdt.tether-token.near",
				"extra": map[string]interface{}{
					"memo": "test payment",
				},
			},
			network:    "near:mainnet",
			wantAmount: "2000000",
			wantAsset:  "usdt.tether-token.near",
		},
		{
			name: "testnet default asset",
			price: map[string]interface{}{
				"amount": "3000000",
			},
			network:    "near:testnet",
			wantAmount: "3000000",
			wantAsset:  near.USDTTestnet.ContractID,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := NewExactDirectNearScheme(nil)
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
			network:    "near:mainnet",
			wantAmount: "1500000",
			wantAsset:  near.USDTMainnet.ContractID,
		},
		{
			name:       "plain decimal",
			price:      "2.50",
			network:    "near:mainnet",
			wantAmount: "2500000",
			wantAsset:  near.USDTMainnet.ContractID,
		},
		{
			name:       "integer amount",
			price:      "10",
			network:    "near:mainnet",
			wantAmount: "10000000",
			wantAsset:  near.USDTMainnet.ContractID,
		},
		{
			name:       "dollar with space",
			price:      "$ 5.00",
			network:    "near:mainnet",
			wantAmount: "5000000",
			wantAsset:  near.USDTMainnet.ContractID,
		},
		{
			name:       "small amount",
			price:      "0.01",
			network:    "near:mainnet",
			wantAmount: "10000",
			wantAsset:  near.USDTMainnet.ContractID,
		},
		{
			name:       "testnet uses default token",
			price:      "1.00",
			network:    "near:testnet",
			wantAmount: "1000000",
			wantAsset:  near.USDTTestnet.ContractID,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := NewExactDirectNearScheme(nil)
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
			scheme := NewExactDirectNearScheme(nil)
			result, err := scheme.ParsePrice(tt.price, "near:mainnet")
			if err != nil {
				t.Fatalf("ParsePrice() error: %v", err)
			}
			if result.Amount != tt.wantAmount {
				t.Errorf("Amount = %v, want %v", result.Amount, tt.wantAmount)
			}
		})
	}
}

func TestParsePrice_PreferredToken(t *testing.T) {
	config := &ExactDirectNearServerConfig{
		PreferredToken: "USDT",
	}
	scheme := NewExactDirectNearScheme(config)

	result, err := scheme.ParsePrice(1.00, "near:mainnet")
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if result.Asset != near.USDTMainnet.ContractID {
		t.Errorf("Asset = %v, want %v", result.Asset, near.USDTMainnet.ContractID)
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
			wantErrMsg: "unsupported network",
		},
		{
			name:       "invalid string format",
			price:      "not-a-number",
			network:    "near:mainnet",
			wantErrMsg: "failed to parse price string",
		},
		{
			name:       "boolean type",
			price:      true,
			network:    "near:mainnet",
			wantErrMsg: "invalid price format",
		},
		{
			name: "amount not a string",
			price: map[string]interface{}{
				"amount": 12345,
			},
			network:    "near:mainnet",
			wantErrMsg: "amount must be a string",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := NewExactDirectNearScheme(nil)
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

func TestRegisterMoneyParser_SingleCustomParser(t *testing.T) {
	scheme := NewExactDirectNearScheme(nil)

	// Register custom parser: large amounts use USDT
	scheme.RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
		if amount > 100 {
			return &t402.AssetAmount{
				Amount: fmt.Sprintf("%.0f", amount*1e6),
				Asset:  near.USDTMainnet.ContractID,
				Extra:  map[string]interface{}{"tier": "large"},
			}, nil
		}
		return nil, nil // Use default for small amounts
	})

	// Test large amount - should use custom parser
	result1, err := scheme.ParsePrice(150.0, "near:mainnet")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if result1.Asset != near.USDTMainnet.ContractID {
		t.Errorf("Expected USDT for large amount, got %s", result1.Asset)
	}
	if result1.Extra["tier"] != "large" {
		t.Errorf("Expected tier='large', got %v", result1.Extra["tier"])
	}

	// Test small amount - should fall back to default (USDT)
	result2, err := scheme.ParsePrice(50.0, "near:mainnet")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if result2.Asset != near.USDTMainnet.ContractID {
		t.Errorf("Expected USDC for small amount, got %s", result2.Asset)
	}
}

func TestRegisterMoneyParser_MultipleInChain(t *testing.T) {
	scheme := NewExactDirectNearScheme(nil)

	// Parser 1: Premium tier (> 1000)
	scheme.RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
		if amount > 1000 {
			return &t402.AssetAmount{
				Amount: fmt.Sprintf("%.0f", amount*1e6),
				Asset:  near.USDTMainnet.ContractID,
				Extra:  map[string]interface{}{"tier": "premium"},
			}, nil
		}
		return nil, nil
	})

	// Parser 2: Large tier (> 100)
	scheme.RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
		if amount > 100 {
			return &t402.AssetAmount{
				Amount: fmt.Sprintf("%.0f", amount*1e6),
				Asset:  near.USDTMainnet.ContractID,
				Extra:  map[string]interface{}{"tier": "large"},
			}, nil
		}
		return nil, nil
	})

	// Test premium tier (first parser)
	result1, err := scheme.ParsePrice(2000.0, "near:mainnet")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if result1.Extra["tier"] != "premium" {
		t.Errorf("Expected tier='premium', got %v", result1.Extra["tier"])
	}

	// Test large tier (second parser)
	result2, err := scheme.ParsePrice(200.0, "near:mainnet")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if result2.Extra["tier"] != "large" {
		t.Errorf("Expected tier='large', got %v", result2.Extra["tier"])
	}

	// Test default (no parser matches)
	result3, err := scheme.ParsePrice(50.0, "near:mainnet")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	// Should use default USDT
	if result3.Asset != near.USDTMainnet.ContractID {
		t.Errorf("Expected USDT, got %s", result3.Asset)
	}
}

func TestRegisterMoneyParser_Chainability(t *testing.T) {
	scheme := NewExactDirectNearScheme(nil)

	result := scheme.
		RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
			return nil, nil
		}).
		RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
			return nil, nil
		})

	if result != scheme {
		t.Error("Expected RegisterMoneyParser to return scheme for chaining")
	}
}

func TestRegisterMoneyParser_ErrorSkipsParser(t *testing.T) {
	scheme := NewExactDirectNearScheme(nil)

	// Parser that always returns error - should be skipped
	scheme.RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
		return nil, fmt.Errorf("parser error")
	})

	// Default should be used
	result, err := scheme.ParsePrice(10.0, "near:mainnet")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	if result.Asset != near.USDTMainnet.ContractID {
		t.Errorf("Expected default USDT, got %s", result.Asset)
	}
}

func TestEnhancePaymentRequirements_Basic(t *testing.T) {
	scheme := NewExactDirectNearScheme(nil)

	requirements := types.PaymentRequirements{
		Scheme:  "exact-direct",
		Network: "near:mainnet",
		Asset:   "usdt.tether-token.near",
		Amount:  "1000000",
		PayTo:   "merchant.near",
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      "exact-direct",
		Network:     "near:mainnet",
		Extra: map[string]interface{}{
			"assetSymbol":   "USDT",
			"assetDecimals": 6,
		},
	}

	result, err := scheme.EnhancePaymentRequirements(
		context.Background(), requirements, supportedKind, nil,
	)
	if err != nil {
		t.Fatalf("EnhancePaymentRequirements() error: %v", err)
	}

	// Verify extra fields were added
	if result.Extra["assetSymbol"] != "USDT" {
		t.Errorf("Extra.assetSymbol = %v, want USDT", result.Extra["assetSymbol"])
	}
	if result.Extra["assetDecimals"] != 6 {
		t.Errorf("Extra.assetDecimals = %v, want 6", result.Extra["assetDecimals"])
	}
}

func TestEnhancePaymentRequirements_DefaultAsset(t *testing.T) {
	scheme := NewExactDirectNearScheme(nil)

	requirements := types.PaymentRequirements{
		Scheme:  "exact-direct",
		Network: "near:mainnet",
		Asset:   "", // No asset specified
		Amount:  "1000000",
		PayTo:   "merchant.near",
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      "exact-direct",
		Network:     "near:mainnet",
	}

	result, err := scheme.EnhancePaymentRequirements(
		context.Background(), requirements, supportedKind, nil,
	)
	if err != nil {
		t.Fatalf("EnhancePaymentRequirements() error: %v", err)
	}

	// Default asset should be set
	if result.Asset != near.USDTMainnet.ContractID {
		t.Errorf("Asset = %v, want %v", result.Asset, near.USDTMainnet.ContractID)
	}
}

func TestEnhancePaymentRequirements_PreferredToken(t *testing.T) {
	config := &ExactDirectNearServerConfig{
		PreferredToken: "USDT",
	}
	scheme := NewExactDirectNearScheme(config)

	requirements := types.PaymentRequirements{
		Scheme:  "exact-direct",
		Network: "near:mainnet",
		Asset:   "", // No asset specified
		Amount:  "1000000",
		PayTo:   "merchant.near",
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      "exact-direct",
		Network:     "near:mainnet",
	}

	result, err := scheme.EnhancePaymentRequirements(
		context.Background(), requirements, supportedKind, nil,
	)
	if err != nil {
		t.Fatalf("EnhancePaymentRequirements() error: %v", err)
	}

	// Preferred token should be set
	if result.Asset != near.USDTMainnet.ContractID {
		t.Errorf("Asset = %v, want %v", result.Asset, near.USDTMainnet.ContractID)
	}
}

func TestEnhancePaymentRequirements_DecimalAmount(t *testing.T) {
	scheme := NewExactDirectNearScheme(nil)

	requirements := types.PaymentRequirements{
		Scheme:  "exact-direct",
		Network: "near:mainnet",
		Asset:   "usdt.tether-token.near",
		Amount:  "1.50", // Decimal amount
		PayTo:   "merchant.near",
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      "exact-direct",
		Network:     "near:mainnet",
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

func TestEnhancePaymentRequirements_AtomicAmount(t *testing.T) {
	scheme := NewExactDirectNearScheme(nil)

	requirements := types.PaymentRequirements{
		Scheme:  "exact-direct",
		Network: "near:mainnet",
		Asset:   "usdt.tether-token.near",
		Amount:  "1500000", // Already atomic
		PayTo:   "merchant.near",
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      "exact-direct",
		Network:     "near:mainnet",
	}

	result, err := scheme.EnhancePaymentRequirements(
		context.Background(), requirements, supportedKind, nil,
	)
	if err != nil {
		t.Fatalf("EnhancePaymentRequirements() error: %v", err)
	}

	// Amount should remain unchanged (no decimal point)
	if result.Amount != "1500000" {
		t.Errorf("Amount = %v, want 1500000", result.Amount)
	}
}

func TestEnhancePaymentRequirements_ExtensionKeys(t *testing.T) {
	scheme := NewExactDirectNearScheme(nil)

	requirements := types.PaymentRequirements{
		Scheme:  "exact-direct",
		Network: "near:mainnet",
		Asset:   "usdt.tether-token.near",
		Amount:  "1000000",
		PayTo:   "merchant.near",
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      "exact-direct",
		Network:     "near:mainnet",
		Extra: map[string]interface{}{
			"customExt1": "value1",
			"customExt2": "value2",
			"other":      "not-included",
		},
	}

	extensionKeys := []string{"customExt1", "customExt2"}

	result, err := scheme.EnhancePaymentRequirements(
		context.Background(), requirements, supportedKind, extensionKeys,
	)
	if err != nil {
		t.Fatalf("EnhancePaymentRequirements() error: %v", err)
	}

	if result.Extra["customExt1"] != "value1" {
		t.Errorf("Extra.customExt1 = %v, want value1", result.Extra["customExt1"])
	}
	if result.Extra["customExt2"] != "value2" {
		t.Errorf("Extra.customExt2 = %v, want value2", result.Extra["customExt2"])
	}
}

func TestEnhancePaymentRequirements_InvalidNetwork(t *testing.T) {
	scheme := NewExactDirectNearScheme(nil)

	requirements := types.PaymentRequirements{
		Scheme:  "exact-direct",
		Network: "eip155:1",
		Asset:   "usdt.tether-token.near",
		Amount:  "1000000",
		PayTo:   "merchant.near",
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      "exact-direct",
		Network:     "eip155:1",
	}

	_, err := scheme.EnhancePaymentRequirements(
		context.Background(), requirements, supportedKind, nil,
	)
	if err == nil {
		t.Fatal("Expected error for unsupported network, got nil")
	}
	if !containsStr(err.Error(), "unsupported network") {
		t.Errorf("Error = %v, want to contain 'unsupported network'", err.Error())
	}
}

func TestEnhancePaymentRequirements_NilExtra(t *testing.T) {
	scheme := NewExactDirectNearScheme(nil)

	requirements := types.PaymentRequirements{
		Scheme:  "exact-direct",
		Network: "near:mainnet",
		Asset:   "usdt.tether-token.near",
		Amount:  "1000000",
		PayTo:   "merchant.near",
		Extra:   nil, // nil extra map
	}

	supportedKind := types.SupportedKind{
		T402Version: 2,
		Scheme:      "exact-direct",
		Network:     "near:mainnet",
		Extra: map[string]interface{}{
			"assetSymbol": "USDT",
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
	if result.Extra["assetSymbol"] != "USDT" {
		t.Errorf("Extra.assetSymbol = %v, want USDT", result.Extra["assetSymbol"])
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
		{"simple decimal", "1.50", 6, "1500000", false},
		{"integer", "10.000000", 6, "10000000", false},
		{"small amount", "0.01", 6, "10000", false},
		{"zero", "0.00", 6, "0", false},
		{"large amount", "1000.00", 6, "1000000000", false},
		{"one cent", "0.000001", 6, "1", false},
		{"different decimals", "1.50", 8, "150000000", false},
		{"negative amount", "-1.00", 6, "", true},
		{"invalid string", "abc", 6, "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := toAtomicUnits(tt.amount, tt.decimals)
			if (err != nil) != tt.wantErr {
				t.Fatalf("toAtomicUnits(%v, %v) error = %v, wantErr %v", tt.amount, tt.decimals, err, tt.wantErr)
			}
			if !tt.wantErr && result != tt.want {
				t.Errorf("toAtomicUnits(%v, %v) = %v, want %v", tt.amount, tt.decimals, result, tt.want)
			}
		})
	}
}

func TestGetSupportedNetworks(t *testing.T) {
	networks := GetSupportedNetworks()

	if len(networks) != 2 {
		t.Errorf("GetSupportedNetworks() returned %d networks, want 2", len(networks))
	}

	found := map[string]bool{}
	for _, n := range networks {
		found[n] = true
	}

	if !found["near:mainnet"] {
		t.Error("GetSupportedNetworks() missing near:mainnet")
	}
	if !found["near:testnet"] {
		t.Error("GetSupportedNetworks() missing near:testnet")
	}
}

func TestIsNetworkSupported(t *testing.T) {
	tests := []struct {
		name    string
		network string
		want    bool
	}{
		{"mainnet", "near:mainnet", true},
		{"testnet", "near:testnet", true},
		{"evm", "eip155:1", false},
		{"empty", "", false},
		{"invalid", "near:devnet", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsNetworkSupported(tt.network); got != tt.want {
				t.Errorf("IsNetworkSupported(%v) = %v, want %v", tt.network, got, tt.want)
			}
		})
	}
}

func TestNewExactDirectNearScheme_DefaultConfig(t *testing.T) {
	scheme := NewExactDirectNearScheme(nil)

	if scheme.config.PreferredToken != "" {
		t.Errorf("Default PreferredToken = %v, want empty", scheme.config.PreferredToken)
	}
	if len(scheme.moneyParsers) != 0 {
		t.Errorf("Default moneyParsers length = %v, want 0", len(scheme.moneyParsers))
	}
}

func TestNewExactDirectNearScheme_CustomConfig(t *testing.T) {
	config := &ExactDirectNearServerConfig{
		PreferredToken: "USDT",
	}
	scheme := NewExactDirectNearScheme(config)

	if scheme.config.PreferredToken != "USDT" {
		t.Errorf("PreferredToken = %v, want USDT", scheme.config.PreferredToken)
	}
}

func TestParsePrice_ExtraFieldsPreserved(t *testing.T) {
	scheme := NewExactDirectNearScheme(nil)

	price := map[string]interface{}{
		"amount": "1000000",
		"asset":  "usdt.tether-token.near",
		"extra": map[string]interface{}{
			"memo":      "payment for goods",
			"reference": "order-123",
		},
	}

	result, err := scheme.ParsePrice(price, "near:mainnet")
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}

	if result.Extra["memo"] != "payment for goods" {
		t.Errorf("Extra.memo = %v, want 'payment for goods'", result.Extra["memo"])
	}
	if result.Extra["reference"] != "order-123" {
		t.Errorf("Extra.reference = %v, want 'order-123'", result.Extra["reference"])
	}
}

func TestDefaultMoneyConversion_IncludesTokenMetadata(t *testing.T) {
	scheme := NewExactDirectNearScheme(nil)

	result, err := scheme.ParsePrice(1.00, "near:mainnet")
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}

	// Default conversion should include token metadata in Extra
	if result.Extra["symbol"] != "USDT" {
		t.Errorf("Extra.symbol = %v, want USDT", result.Extra["symbol"])
	}
	if result.Extra["decimals"] != 6 {
		t.Errorf("Extra.decimals = %v, want 6", result.Extra["decimals"])
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
