package polkadot

import (
	"context"
	"fmt"
	"testing"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/types"
)

func TestExactDirectPolkadotServer_Scheme(t *testing.T) {
	server := NewExactDirectPolkadotServer()

	if server.Scheme() != SchemeExactDirect {
		t.Errorf("Scheme() = %v, want %v", server.Scheme(), SchemeExactDirect)
	}
}

func TestExactDirectPolkadotServer_ParsePrice(t *testing.T) {
	tests := []struct {
		name       string
		price      t402.Price
		network    t402.Network
		wantAmount string
		wantAsset  string
		wantErr    bool
		errContains string
	}{
		{
			name:       "float64 price - 1 dollar",
			price:      float64(1.0),
			network:    t402.Network(PolkadotAssetHubCAIP2),
			wantAmount: "1000000",
			wantAsset:  "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984",
		},
		{
			name:       "float64 price - 1.50 dollars",
			price:      float64(1.50),
			network:    t402.Network(PolkadotAssetHubCAIP2),
			wantAmount: "1500000",
			wantAsset:  "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984",
		},
		{
			name:       "float64 price - 10 dollars",
			price:      float64(10.0),
			network:    t402.Network(PolkadotAssetHubCAIP2),
			wantAmount: "10000000",
			wantAsset:  "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984",
		},
		{
			name:       "float64 price - 0.01 dollars",
			price:      float64(0.01),
			network:    t402.Network(PolkadotAssetHubCAIP2),
			wantAmount: "10000",
			wantAsset:  "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984",
		},
		{
			name:       "int price",
			price:      int(5),
			network:    t402.Network(PolkadotAssetHubCAIP2),
			wantAmount: "5000000",
			wantAsset:  "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984",
		},
		{
			name:       "int64 price",
			price:      int64(100),
			network:    t402.Network(PolkadotAssetHubCAIP2),
			wantAmount: "100000000",
			wantAsset:  "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984",
		},
		{
			name:       "string price - plain number",
			price:      "2.50",
			network:    t402.Network(PolkadotAssetHubCAIP2),
			wantAmount: "2500000",
			wantAsset:  "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984",
		},
		{
			name:       "string price - dollar sign",
			price:      "$5.00",
			network:    t402.Network(PolkadotAssetHubCAIP2),
			wantAmount: "5000000",
			wantAsset:  "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984",
		},
		{
			name:       "string price - with spaces",
			price:      "  $10.00  ",
			network:    t402.Network(PolkadotAssetHubCAIP2),
			wantAmount: "10000000",
			wantAsset:  "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984",
		},
		{
			name:       "string price - integer string",
			price:      "25",
			network:    t402.Network(PolkadotAssetHubCAIP2),
			wantAmount: "25000000",
			wantAsset:  "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984",
		},
		{
			name:       "Westend network",
			price:      float64(1.0),
			network:    t402.Network(WestendAssetHubCAIP2),
			wantAmount: "1000000",
			wantAsset:  "polkadot:e143f23803ac50e8f6f8e62695d1ce9e/asset:1984",
		},
		{
			name: "pre-parsed AssetAmount map",
			price: map[string]interface{}{
				"amount": "5000000",
				"asset":  "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984",
			},
			network:    t402.Network(PolkadotAssetHubCAIP2),
			wantAmount: "5000000",
			wantAsset:  "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984",
		},
		{
			name: "pre-parsed AssetAmount map with extra",
			price: map[string]interface{}{
				"amount": "2000000",
				"asset":  "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984",
				"extra": map[string]interface{}{
					"symbol": "USDT",
				},
			},
			network:    t402.Network(PolkadotAssetHubCAIP2),
			wantAmount: "2000000",
			wantAsset:  "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984",
		},
		{
			name: "pre-parsed AssetAmount map without asset uses default",
			price: map[string]interface{}{
				"amount": "3000000",
			},
			network:    t402.Network(PolkadotAssetHubCAIP2),
			wantAmount: "3000000",
			wantAsset:  "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984",
		},
		{
			name:        "error - invalid network (non-polkadot)",
			price:       float64(1.0),
			network:     t402.Network("eip155:1"),
			wantErr:     true,
			errContains: "invalid polkadot network",
		},
		{
			name:        "error - unknown polkadot network",
			price:       float64(1.0),
			network:     t402.Network("polkadot:unknowngenesishash"),
			wantErr:     true,
			errContains: "unknown polkadot network",
		},
		{
			name:        "error - invalid price format",
			price:       []string{"invalid"},
			network:     t402.Network(PolkadotAssetHubCAIP2),
			wantErr:     true,
			errContains: "invalid price format",
		},
		{
			name:        "error - unparseable string price",
			price:       "not-a-number",
			network:     t402.Network(PolkadotAssetHubCAIP2),
			wantErr:     true,
			errContains: "failed to parse price",
		},
		{
			name: "error - amount not a string in map",
			price: map[string]interface{}{
				"amount": 12345,
			},
			network:     t402.Network(PolkadotAssetHubCAIP2),
			wantErr:     true,
			errContains: "amount must be a string",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := NewExactDirectPolkadotServer()
			result, err := server.ParsePrice(tt.price, tt.network)

			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				if tt.errContains != "" && !containsStr(err.Error(), tt.errContains) {
					t.Errorf("error = %v, want to contain %v", err.Error(), tt.errContains)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
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

func TestExactDirectPolkadotServer_ParsePrice_DefaultExtra(t *testing.T) {
	server := NewExactDirectPolkadotServer()
	result, err := server.ParsePrice(float64(1.0), t402.Network(PolkadotAssetHubCAIP2))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify extra fields are populated
	if result.Extra["symbol"] != "USDT" {
		t.Errorf("Extra[symbol] = %v, want USDT", result.Extra["symbol"])
	}
	if result.Extra["name"] != "Tether USD" {
		t.Errorf("Extra[name] = %v, want Tether USD", result.Extra["name"])
	}
	if result.Extra["decimals"] != 6 {
		t.Errorf("Extra[decimals] = %v, want 6", result.Extra["decimals"])
	}
	if result.Extra["assetId"] != 1984 {
		t.Errorf("Extra[assetId] = %v, want 1984", result.Extra["assetId"])
	}
}

func TestExactDirectPolkadotServer_RegisterMoneyParser(t *testing.T) {
	server := NewExactDirectPolkadotServer()

	// Register custom parser: large amounts use custom asset
	server.RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
		if amount > 100 {
			return &t402.AssetAmount{
				Amount: fmt.Sprintf("%.0f", amount*1e6),
				Asset:  "polkadot:68d56f15f85d3136970ec16946040bc1/asset:9999",
				Extra: map[string]interface{}{
					"tier": "premium",
				},
			}, nil
		}
		return nil, nil // Use default for small amounts
	})

	// Test large amount - should use custom parser
	result1, err := server.ParsePrice(150.0, t402.Network(PolkadotAssetHubCAIP2))
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result1.Asset != "polkadot:68d56f15f85d3136970ec16946040bc1/asset:9999" {
		t.Errorf("expected custom asset, got %s", result1.Asset)
	}
	if result1.Extra["tier"] != "premium" {
		t.Errorf("expected tier='premium', got %v", result1.Extra["tier"])
	}

	// Test small amount - should fall back to default
	result2, err := server.ParsePrice(50.0, t402.Network(PolkadotAssetHubCAIP2))
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result2.Asset != "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984" {
		t.Errorf("expected default USDT, got %s", result2.Asset)
	}
}

func TestExactDirectPolkadotServer_RegisterMoneyParser_MultipleInChain(t *testing.T) {
	server := NewExactDirectPolkadotServer()

	// Parser 1: Premium tier (> 1000)
	server.RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
		if amount > 1000 {
			return &t402.AssetAmount{
				Amount: fmt.Sprintf("%.0f", amount*1e6),
				Asset:  "premium-asset",
				Extra:  map[string]interface{}{"tier": "premium"},
			}, nil
		}
		return nil, nil
	})

	// Parser 2: Large tier (> 100)
	server.RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
		if amount > 100 {
			return &t402.AssetAmount{
				Amount: fmt.Sprintf("%.0f", amount*1e6),
				Asset:  "large-asset",
				Extra:  map[string]interface{}{"tier": "large"},
			}, nil
		}
		return nil, nil
	})

	// Test premium tier (first parser)
	result1, err := server.ParsePrice(2000.0, t402.Network(PolkadotAssetHubCAIP2))
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result1.Extra["tier"] != "premium" {
		t.Errorf("expected tier='premium', got %v", result1.Extra["tier"])
	}

	// Test large tier (second parser)
	result2, err := server.ParsePrice(200.0, t402.Network(PolkadotAssetHubCAIP2))
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result2.Extra["tier"] != "large" {
		t.Errorf("expected tier='large', got %v", result2.Extra["tier"])
	}

	// Test default (no parser matches)
	result3, err := server.ParsePrice(50.0, t402.Network(PolkadotAssetHubCAIP2))
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result3.Asset != "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984" {
		t.Errorf("expected default USDT, got %s", result3.Asset)
	}
}

func TestExactDirectPolkadotServer_RegisterMoneyParser_ErrorSkipped(t *testing.T) {
	server := NewExactDirectPolkadotServer()

	// Parser that returns error (should be skipped)
	server.RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
		return nil, fmt.Errorf("parser error")
	})

	// Should fall back to default
	result, err := server.ParsePrice(10.0, t402.Network(PolkadotAssetHubCAIP2))
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result.Asset != "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984" {
		t.Errorf("expected default USDT after parser error, got %s", result.Asset)
	}
}

func TestExactDirectPolkadotServer_RegisterMoneyParser_Chainability(t *testing.T) {
	server := NewExactDirectPolkadotServer()

	result := server.
		RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
			return nil, nil
		}).
		RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
			return nil, nil
		})

	if result != server {
		t.Error("expected RegisterMoneyParser to return server for chaining")
	}
}

func TestExactDirectPolkadotServer_EnhancePaymentRequirements(t *testing.T) {
	tests := []struct {
		name          string
		requirements  types.PaymentRequirements
		supportedKind types.SupportedKind
		extensions    []string
		config        *ServerConfig
		validate      func(t *testing.T, result types.PaymentRequirements)
		wantErr       bool
		errContains   string
	}{
		{
			name: "basic enhancement on Polkadot Asset Hub",
			requirements: types.PaymentRequirements{
				Scheme:  SchemeExactDirect,
				Network: PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "1000000",
			},
			supportedKind: types.SupportedKind{
				T402Version: 2,
				Scheme:      SchemeExactDirect,
				Network:     PolkadotAssetHubCAIP2,
			},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Asset != "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984" {
					t.Errorf("Asset = %v, want CAIP-19 identifier", result.Asset)
				}
				if result.Extra["assetId"] != 1984 {
					t.Errorf("Extra[assetId] = %v, want 1984", result.Extra["assetId"])
				}
				if result.Extra["assetSymbol"] != "USDT" {
					t.Errorf("Extra[assetSymbol] = %v, want USDT", result.Extra["assetSymbol"])
				}
				if result.Extra["assetDecimals"] != 6 {
					t.Errorf("Extra[assetDecimals] = %v, want 6", result.Extra["assetDecimals"])
				}
				if result.Extra["networkName"] != "Polkadot Asset Hub" {
					t.Errorf("Extra[networkName] = %v, want Polkadot Asset Hub", result.Extra["networkName"])
				}
			},
		},
		{
			name: "enhancement on Westend Asset Hub",
			requirements: types.PaymentRequirements{
				Scheme:  SchemeExactDirect,
				Network: WestendAssetHubCAIP2,
				PayTo:   "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
				Amount:  "500000",
			},
			supportedKind: types.SupportedKind{
				T402Version: 2,
				Scheme:      SchemeExactDirect,
				Network:     WestendAssetHubCAIP2,
			},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Asset != "polkadot:e143f23803ac50e8f6f8e62695d1ce9e/asset:1984" {
					t.Errorf("Asset = %v, want Westend CAIP-19 identifier", result.Asset)
				}
				if result.Extra["networkName"] != "Westend Asset Hub" {
					t.Errorf("Extra[networkName] = %v, want Westend Asset Hub", result.Extra["networkName"])
				}
			},
		},
		{
			name: "preserves existing asset if set",
			requirements: types.PaymentRequirements{
				Scheme:  SchemeExactDirect,
				Network: PolkadotAssetHubCAIP2,
				Asset:   "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984",
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "1000000",
			},
			supportedKind: types.SupportedKind{
				T402Version: 2,
				Scheme:      SchemeExactDirect,
				Network:     PolkadotAssetHubCAIP2,
			},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Asset != "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984" {
					t.Errorf("Asset should be preserved, got %v", result.Asset)
				}
			},
		},
		{
			name: "converts decimal amount to atomic units",
			requirements: types.PaymentRequirements{
				Scheme:  SchemeExactDirect,
				Network: PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "1.50",
			},
			supportedKind: types.SupportedKind{
				T402Version: 2,
				Scheme:      SchemeExactDirect,
				Network:     PolkadotAssetHubCAIP2,
			},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Amount != "1500000" {
					t.Errorf("Amount = %v, want 1500000", result.Amount)
				}
			},
		},
		{
			name: "preserves atomic amount (no decimal)",
			requirements: types.PaymentRequirements{
				Scheme:  SchemeExactDirect,
				Network: PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "5000000",
			},
			supportedKind: types.SupportedKind{
				T402Version: 2,
				Scheme:      SchemeExactDirect,
				Network:     PolkadotAssetHubCAIP2,
			},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Amount != "5000000" {
					t.Errorf("Amount = %v, want 5000000 (unchanged)", result.Amount)
				}
			},
		},
		{
			name: "copies facilitator extra fields",
			requirements: types.PaymentRequirements{
				Scheme:  SchemeExactDirect,
				Network: PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "1000000",
			},
			supportedKind: types.SupportedKind{
				T402Version: 2,
				Scheme:      SchemeExactDirect,
				Network:     PolkadotAssetHubCAIP2,
				Extra: map[string]interface{}{
					"assetId":       float64(1984),
					"assetSymbol":   "USDT",
					"assetDecimals": float64(6),
					"networkName":   "Custom Name",
				},
			},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				// Facilitator extra should override defaults
				if result.Extra["networkName"] != "Custom Name" {
					t.Errorf("Extra[networkName] = %v, want Custom Name", result.Extra["networkName"])
				}
			},
		},
		{
			name: "copies extension keys from supportedKind",
			requirements: types.PaymentRequirements{
				Scheme:  SchemeExactDirect,
				Network: PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "1000000",
			},
			supportedKind: types.SupportedKind{
				T402Version: 2,
				Scheme:      SchemeExactDirect,
				Network:     PolkadotAssetHubCAIP2,
				Extra: map[string]interface{}{
					"customExtension": "value123",
					"anotherKey":      "value456",
				},
			},
			extensions: []string{"customExtension"},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Extra["customExtension"] != "value123" {
					t.Errorf("Extra[customExtension] = %v, want value123", result.Extra["customExtension"])
				}
				// anotherKey should NOT be copied since it's not in extensions list
				if _, ok := result.Extra["anotherKey"]; ok {
					t.Errorf("Extra[anotherKey] should not be present")
				}
			},
		},
		{
			name: "preserves existing extra fields",
			requirements: types.PaymentRequirements{
				Scheme:  SchemeExactDirect,
				Network: PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "1000000",
				Extra: map[string]interface{}{
					"existingKey": "existingValue",
				},
			},
			supportedKind: types.SupportedKind{
				T402Version: 2,
				Scheme:      SchemeExactDirect,
				Network:     PolkadotAssetHubCAIP2,
			},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Extra["existingKey"] != "existingValue" {
					t.Errorf("Extra[existingKey] = %v, want existingValue", result.Extra["existingKey"])
				}
			},
		},
		{
			name: "error - unknown network",
			requirements: types.PaymentRequirements{
				Network: "polkadot:unknownhash",
			},
			supportedKind: types.SupportedKind{},
			wantErr:       true,
			errContains:   "unknown polkadot network",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var server *ExactDirectPolkadotServer
			if tt.config != nil {
				server = NewExactDirectPolkadotServer(tt.config)
			} else {
				server = NewExactDirectPolkadotServer()
			}

			result, err := server.EnhancePaymentRequirements(
				context.Background(),
				tt.requirements,
				tt.supportedKind,
				tt.extensions,
			)

			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				if tt.errContains != "" && !containsStr(err.Error(), tt.errContains) {
					t.Errorf("error = %v, want to contain %v", err.Error(), tt.errContains)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if tt.validate != nil {
				tt.validate(t, result)
			}
		})
	}
}

func TestExactDirectPolkadotServer_WithPreferredToken(t *testing.T) {
	server := NewExactDirectPolkadotServer(&ServerConfig{
		PreferredToken: "USDT",
	})

	result, err := server.ParsePrice(float64(1.0), t402.Network(PolkadotAssetHubCAIP2))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Should use USDT (which is also the default)
	if result.Extra["symbol"] != "USDT" {
		t.Errorf("Extra[symbol] = %v, want USDT", result.Extra["symbol"])
	}
}

func TestExactDirectPolkadotServer_EnhanceWithPreferredToken(t *testing.T) {
	server := NewExactDirectPolkadotServer(&ServerConfig{
		PreferredToken: "USDT",
	})

	result, err := server.EnhancePaymentRequirements(
		context.Background(),
		types.PaymentRequirements{
			Scheme:  SchemeExactDirect,
			Network: PolkadotAssetHubCAIP2,
			PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
			Amount:  "1000000",
		},
		types.SupportedKind{
			T402Version: 2,
			Scheme:      SchemeExactDirect,
			Network:     PolkadotAssetHubCAIP2,
		},
		nil,
	)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Extra["assetSymbol"] != "USDT" {
		t.Errorf("Extra[assetSymbol] = %v, want USDT", result.Extra["assetSymbol"])
	}
}

func TestParseAmount(t *testing.T) {
	tests := []struct {
		name     string
		amount   string
		decimals int
		want     uint64
		wantErr  bool
	}{
		{
			name:     "integer amount",
			amount:   "1",
			decimals: 6,
			want:     1000000,
		},
		{
			name:     "decimal amount",
			amount:   "1.50",
			decimals: 6,
			want:     1500000,
		},
		{
			name:     "small decimal",
			amount:   "0.01",
			decimals: 6,
			want:     10000,
		},
		{
			name:     "large amount",
			amount:   "1000",
			decimals: 6,
			want:     1000000000,
		},
		{
			name:     "zero amount",
			amount:   "0",
			decimals: 6,
			want:     0,
		},
		{
			name:     "many decimal places",
			amount:   "1.123456",
			decimals: 6,
			want:     1123456,
		},
		{
			name:     "different decimals (8)",
			amount:   "1.5",
			decimals: 8,
			want:     150000000,
		},
		{
			name:     "different decimals (2)",
			amount:   "1.5",
			decimals: 2,
			want:     150,
		},
		{
			name:    "invalid amount",
			amount:  "abc",
			decimals: 6,
			wantErr: true,
		},
		{
			name:    "negative amount",
			amount:  "-1.0",
			decimals: 6,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseAmount(tt.amount, tt.decimals)
			if tt.wantErr {
				if err == nil {
					t.Errorf("ParseAmount(%v, %v) expected error, got nil", tt.amount, tt.decimals)
				}
				return
			}
			if err != nil {
				t.Fatalf("ParseAmount(%v, %v) unexpected error: %v", tt.amount, tt.decimals, err)
			}
			if got != tt.want {
				t.Errorf("ParseAmount(%v, %v) = %v, want %v", tt.amount, tt.decimals, got, tt.want)
			}
		})
	}
}

func TestGetSupportedNetworks(t *testing.T) {
	networks := GetSupportedNetworks()

	if len(networks) != len(Networks) {
		t.Errorf("GetSupportedNetworks() returned %d networks, want %d", len(networks), len(Networks))
	}

	// Verify all expected networks are present
	expected := map[string]bool{
		PolkadotAssetHubCAIP2: false,
		KusamaAssetHubCAIP2:   false,
		WestendAssetHubCAIP2:  false,
	}

	for _, network := range networks {
		if _, ok := expected[network]; ok {
			expected[network] = true
		}
	}

	for network, found := range expected {
		if !found {
			t.Errorf("GetSupportedNetworks() missing %v", network)
		}
	}
}

func TestIsNetworkSupported(t *testing.T) {
	tests := []struct {
		name    string
		network string
		want    bool
	}{
		{"Polkadot Asset Hub", PolkadotAssetHubCAIP2, true},
		{"Kusama Asset Hub", KusamaAssetHubCAIP2, true},
		{"Westend Asset Hub", WestendAssetHubCAIP2, true},
		{"Unknown network", "polkadot:unknown", false},
		{"EVM network", "eip155:1", false},
		{"Empty", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsNetworkSupported(tt.network)
			if got != tt.want {
				t.Errorf("IsNetworkSupported(%v) = %v, want %v", tt.network, got, tt.want)
			}
		})
	}
}

func TestExactDirectPolkadotServer_NilExtra(t *testing.T) {
	server := NewExactDirectPolkadotServer()

	// Test with nil extra in requirements - should initialize it
	result, err := server.EnhancePaymentRequirements(
		context.Background(),
		types.PaymentRequirements{
			Scheme:  SchemeExactDirect,
			Network: PolkadotAssetHubCAIP2,
			PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
			Amount:  "1000000",
			Extra:   nil,
		},
		types.SupportedKind{
			T402Version: 2,
			Scheme:      SchemeExactDirect,
			Network:     PolkadotAssetHubCAIP2,
		},
		nil,
	)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Extra == nil {
		t.Error("Extra should be initialized, got nil")
	}
	if result.Extra["assetId"] != 1984 {
		t.Errorf("Extra[assetId] = %v, want 1984", result.Extra["assetId"])
	}
}

func TestExactDirectPolkadotServer_NoConfig(t *testing.T) {
	server := NewExactDirectPolkadotServer()

	if server.preferredToken != "" {
		t.Errorf("preferredToken should be empty, got %v", server.preferredToken)
	}
	if len(server.moneyParsers) != 0 {
		t.Errorf("moneyParsers should be empty, got %d", len(server.moneyParsers))
	}
}

// containsStr checks if substr is in s
func containsStr(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
