package upto

import (
	"context"
	"fmt"
	"strings"
	"testing"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/types"
)

// Compile-time interface compliance assertion
var _ t402.SchemeNetworkServer = (*UptoEvmServer)(nil)

func TestUptoEvmServer_Scheme(t *testing.T) {
	server := NewUptoEvmServer()
	if got := server.Scheme(); got != "upto" {
		t.Errorf("Scheme() = %q, want %q", got, "upto")
	}
}

func TestUptoEvmServer_ParsePrice(t *testing.T) {
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
			name:       "decimal float to smallest unit (1.50 USD -> 1500000)",
			price:      1.50,
			network:    "eip155:8453",
			wantAmount: "1500000",
			wantAsset:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
		},
		{
			name:       "decimal float to smallest unit (10.00 USD -> 10000000)",
			price:      10.0,
			network:    "eip155:8453",
			wantAmount: "10000000",
			wantAsset:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
		},
		{
			name:       "small decimal amount (0.01 USD -> 10000)",
			price:      0.01,
			network:    "eip155:8453",
			wantAmount: "10000",
			wantAsset:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
		},
		{
			name:       "string price with dollar sign",
			price:      "$10.00",
			network:    "eip155:8453",
			wantAmount: "10000000",
			wantAsset:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
		},
		{
			name:       "string price with USD suffix",
			price:      "5.50 USD",
			network:    "eip155:8453",
			wantAmount: "5500000",
			wantAsset:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
		},
		{
			name:       "string price with USDT suffix",
			price:      "2.50 USDT",
			network:    "eip155:8453",
			wantAmount: "2500000",
			wantAsset:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
		},
		{
			name:       "string price with USDC suffix",
			price:      "3.00 USDC",
			network:    "eip155:8453",
			wantAmount: "3000000",
			wantAsset:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
		},
		{
			name:       "integer price",
			price:      5,
			network:    "eip155:8453",
			wantAmount: "5000000",
			wantAsset:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
		},
		{
			name:       "int64 price",
			price:      int64(7),
			network:    "eip155:8453",
			wantAmount: "7000000",
			wantAsset:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
		},
		{
			name:       "already in smallest unit (whole number >= 1e6)",
			price:      float64(1500000),
			network:    "eip155:8453",
			wantAmount: "1500000",
			wantAsset:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
		},
		{
			name:       "network-specific asset address (Ethereum mainnet)",
			price:      10.0,
			network:    "eip155:1",
			wantAmount: "10000000",
			wantAsset:  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
		},
		{
			name:       "network-specific asset address (Arbitrum)",
			price:      10.0,
			network:    "eip155:42161",
			wantAmount: "10000000",
			wantAsset:  "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
		},
		{
			name:    "AssetAmount map with all fields",
			price: map[string]interface{}{
				"amount": "5000000",
				"asset":  "0xCustomToken",
				"extra": map[string]interface{}{
					"symbol": "CUSTOM",
				},
			},
			network:    "eip155:8453",
			wantAmount: "5000000",
			wantAsset:  "0xCustomToken",
		},
		{
			name: "AssetAmount map without extra",
			price: map[string]interface{}{
				"amount": "7000000",
				"asset":  "0xMyToken",
			},
			network:    "eip155:8453",
			wantAmount: "7000000",
			wantAsset:  "0xMyToken",
		},
		{
			name: "error: AssetAmount without asset",
			price: map[string]interface{}{
				"amount": "5000000",
			},
			network:     "eip155:8453",
			wantErr:     true,
			errContains: "asset address must be specified",
		},
		{
			name: "error: AssetAmount with empty asset",
			price: map[string]interface{}{
				"amount": "5000000",
				"asset":  "",
			},
			network:     "eip155:8453",
			wantErr:     true,
			errContains: "asset address must be specified",
		},
		{
			name: "error: AssetAmount with non-string amount",
			price: map[string]interface{}{
				"amount": 5000000,
				"asset":  "0xToken",
			},
			network:     "eip155:8453",
			wantErr:     true,
			errContains: "amount must be a string",
		},
		{
			name:        "error: unsupported network",
			price:       10.0,
			network:     "unsupported:999999",
			wantErr:     true,
			errContains: "unsupported network",
		},
		{
			name:    "error: unsupported price type (slice)",
			price:   []int{1, 2, 3},
			network: "eip155:8453",
			wantErr: true,
			errContains: "unsupported price type",
		},
		{
			name:    "error: unsupported price type (bool)",
			price:   true,
			network: "eip155:8453",
			wantErr: true,
		},
		{
			name:        "error: unparseable string price",
			price:       "not-a-number",
			network:     "eip155:8453",
			wantErr:     true,
			errContains: "failed to parse price string",
		},
		{
			name:       "string price with leading/trailing whitespace",
			price:      "  $5.00  ",
			network:    "eip155:8453",
			wantAmount: "5000000",
			wantAsset:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := NewUptoEvmServer()
			result, err := server.ParsePrice(tt.price, tt.network)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				if tt.errContains != "" && !strings.Contains(err.Error(), tt.errContains) {
					t.Errorf("error = %q, want it to contain %q", err.Error(), tt.errContains)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if result.Amount != tt.wantAmount {
				t.Errorf("Amount = %q, want %q", result.Amount, tt.wantAmount)
			}
			if tt.wantAsset != "" && result.Asset != tt.wantAsset {
				t.Errorf("Asset = %q, want %q", result.Asset, tt.wantAsset)
			}
		})
	}
}

func TestUptoEvmServer_ParsePrice_AssetAmountExtra(t *testing.T) {
	server := NewUptoEvmServer()

	price := map[string]interface{}{
		"amount": "5000000",
		"asset":  "0xCustomToken",
		"extra": map[string]interface{}{
			"symbol":   "CUSTOM",
			"decimals": float64(18),
		},
	}

	result, err := server.ParsePrice(price, "eip155:8453")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Extra["symbol"] != "CUSTOM" {
		t.Errorf("Extra[symbol] = %v, want CUSTOM", result.Extra["symbol"])
	}
	if result.Extra["decimals"] != float64(18) {
		t.Errorf("Extra[decimals] = %v, want 18", result.Extra["decimals"])
	}
}

func TestUptoEvmServer_RegisterMoneyParser(t *testing.T) {
	tests := []struct {
		name       string
		parsers    []t402.MoneyParser
		price      t402.Price
		network    t402.Network
		wantAmount string
		wantAsset  string
		wantErr    bool
	}{
		{
			name: "custom parser handles large amounts",
			parsers: []t402.MoneyParser{
				func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
					if amount > 100 {
						return &t402.AssetAmount{
							Amount: fmt.Sprintf("%.0f", amount*1e18),
							Asset:  "0xDAI",
							Extra:  map[string]interface{}{"tier": "large"},
						}, nil
					}
					return nil, nil
				},
			},
			price:      200.0,
			network:    "eip155:8453",
			wantAmount: "200000000000000000000",
			wantAsset:  "0xDAI",
		},
		{
			name: "falls through to default when parser returns nil",
			parsers: []t402.MoneyParser{
				func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
					if amount > 100 {
						return &t402.AssetAmount{Amount: "999", Asset: "0xDAI"}, nil
					}
					return nil, nil
				},
			},
			price:      50.0,
			network:    "eip155:8453",
			wantAmount: "50000000",
			wantAsset:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
		},
		{
			name: "skips parser that returns error, uses next",
			parsers: []t402.MoneyParser{
				func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
					return nil, fmt.Errorf("parser error")
				},
				func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
					return &t402.AssetAmount{Amount: "999", Asset: "0xFallback"}, nil
				},
			},
			price:      10.0,
			network:    "eip155:8453",
			wantAmount: "999",
			wantAsset:  "0xFallback",
		},
		{
			name: "multiple parsers, first matching wins",
			parsers: []t402.MoneyParser{
				func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
					return &t402.AssetAmount{Amount: "first", Asset: "0xFirst"}, nil
				},
				func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
					return &t402.AssetAmount{Amount: "second", Asset: "0xSecond"}, nil
				},
			},
			price:      10.0,
			network:    "eip155:8453",
			wantAmount: "first",
			wantAsset:  "0xFirst",
		},
		{
			name: "all parsers return nil, falls to default",
			parsers: []t402.MoneyParser{
				func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
					return nil, nil
				},
				func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
					return nil, nil
				},
			},
			price:      1.0,
			network:    "eip155:8453",
			wantAmount: "1000000",
			wantAsset:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := NewUptoEvmServer()
			for _, p := range tt.parsers {
				server.RegisterMoneyParser(p)
			}

			result, err := server.ParsePrice(tt.price, tt.network)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if result.Amount != tt.wantAmount {
				t.Errorf("Amount = %q, want %q", result.Amount, tt.wantAmount)
			}
			if result.Asset != tt.wantAsset {
				t.Errorf("Asset = %q, want %q", result.Asset, tt.wantAsset)
			}
		})
	}
}

func TestUptoEvmServer_RegisterMoneyParser_Chaining(t *testing.T) {
	server := NewUptoEvmServer()
	result := server.
		RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
			return nil, nil
		}).
		RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
			return nil, nil
		})

	if result != server {
		t.Error("RegisterMoneyParser should return the server instance for chaining")
	}
}

func TestUptoEvmServer_EnhancePaymentRequirements(t *testing.T) {
	tests := []struct {
		name          string
		requirements  types.PaymentRequirements
		supportedKind types.SupportedKind
		extensions    []string
		wantErr       bool
		errContains   string
		validate      func(t *testing.T, result types.PaymentRequirements)
	}{
		{
			name: "adds token name and version to extra",
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				Amount:  "1000000",
				PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
			},
			supportedKind: types.SupportedKind{Scheme: "upto", Network: "eip155:8453"},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Extra["name"] != "USD Coin" {
					t.Errorf("Extra[name] = %v, want %q", result.Extra["name"], "USD Coin")
				}
				if result.Extra["version"] != "2" {
					t.Errorf("Extra[version] = %v, want %q", result.Extra["version"], "2")
				}
			},
		},
		{
			name: "does not override existing extra values",
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				Amount:  "1000000",
				PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
				Extra: map[string]interface{}{
					"name":    "CustomName",
					"version": "99",
				},
			},
			supportedKind: types.SupportedKind{Scheme: "upto", Network: "eip155:8453"},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Extra["name"] != "CustomName" {
					t.Errorf("Extra[name] = %v, want %q (should not override)", result.Extra["name"], "CustomName")
				}
				if result.Extra["version"] != "99" {
					t.Errorf("Extra[version] = %v, want %q (should not override)", result.Extra["version"], "99")
				}
			},
		},
		{
			name: "uses default asset when not specified",
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Amount:  "1000000",
				PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
			},
			supportedKind: types.SupportedKind{Scheme: "upto", Network: "eip155:8453"},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Asset != "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" {
					t.Errorf("Asset = %q, want Base USDC address", result.Asset)
				}
			},
		},
		{
			name: "converts decimal amount to smallest unit",
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				Amount:  "1.50",
				PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
			},
			supportedKind: types.SupportedKind{Scheme: "upto", Network: "eip155:8453"},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Amount != "1500000" {
					t.Errorf("Amount = %q, want %q", result.Amount, "1500000")
				}
			},
		},
		{
			name: "keeps integer amount unchanged",
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				Amount:  "5000000",
				PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
			},
			supportedKind: types.SupportedKind{Scheme: "upto", Network: "eip155:8453"},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Amount != "5000000" {
					t.Errorf("Amount = %q, want %q (should remain unchanged)", result.Amount, "5000000")
				}
			},
		},
		{
			name: "copies specified extensions from supportedKind",
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				Amount:  "1000000",
				PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
			},
			supportedKind: types.SupportedKind{
				Scheme:  "upto",
				Network: "eip155:8453",
				Extra: map[string]interface{}{
					"extension1": "value1",
					"extension2": "value2",
					"other":      "ignored",
				},
			},
			extensions: []string{"extension1", "extension2"},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Extra["extension1"] != "value1" {
					t.Errorf("Extra[extension1] = %v, want %q", result.Extra["extension1"], "value1")
				}
				if result.Extra["extension2"] != "value2" {
					t.Errorf("Extra[extension2] = %v, want %q", result.Extra["extension2"], "value2")
				}
				if result.Extra["other"] != nil {
					t.Errorf("Extra[other] = %v, want nil (should not be copied)", result.Extra["other"])
				}
			},
		},
		{
			name: "copies routerAddress from supportedKind extra",
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				Amount:  "1000000",
				PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
			},
			supportedKind: types.SupportedKind{
				Scheme:  "upto",
				Network: "eip155:8453",
				Extra: map[string]interface{}{
					"routerAddress": "0xRouterAddr",
				},
			},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Extra["routerAddress"] != "0xRouterAddr" {
					t.Errorf("Extra[routerAddress] = %v, want %q", result.Extra["routerAddress"], "0xRouterAddr")
				}
			},
		},
		{
			name: "does not override existing routerAddress",
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				Amount:  "1000000",
				PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
				Extra: map[string]interface{}{
					"routerAddress": "0xExistingRouter",
				},
			},
			supportedKind: types.SupportedKind{
				Scheme:  "upto",
				Network: "eip155:8453",
				Extra: map[string]interface{}{
					"routerAddress": "0xNewRouter",
				},
			},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Extra["routerAddress"] != "0xExistingRouter" {
					t.Errorf("Extra[routerAddress] = %v, want %q (should not override)", result.Extra["routerAddress"], "0xExistingRouter")
				}
			},
		},
		{
			name: "nil extensions list does not crash",
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				Amount:  "1000000",
				PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
			},
			supportedKind: types.SupportedKind{
				Scheme:  "upto",
				Network: "eip155:8453",
				Extra: map[string]interface{}{
					"something": "value",
				},
			},
			extensions: nil,
			validate: func(t *testing.T, result types.PaymentRequirements) {
				// Should not copy "something" since extensions is nil
				if result.Extra["something"] != nil {
					t.Errorf("Extra[something] = %v, should not be copied with nil extensions", result.Extra["something"])
				}
			},
		},
		{
			name: "works with Ethereum mainnet network",
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:1",
				Amount:  "1000000",
				PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
			},
			supportedKind: types.SupportedKind{Scheme: "upto", Network: "eip155:1"},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Asset != "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" {
					t.Errorf("Asset = %q, want Ethereum USDC address", result.Asset)
				}
				if result.Extra["name"] != "USD Coin" {
					t.Errorf("Extra[name] = %v, want %q", result.Extra["name"], "USD Coin")
				}
			},
		},
		{
			name: "error: unsupported network",
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "unsupported:999999",
				Amount:  "1000000",
				PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
			},
			supportedKind: types.SupportedKind{},
			wantErr:       true,
			errContains:   "unsupported network",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := NewUptoEvmServer()
			result, err := server.EnhancePaymentRequirements(
				context.Background(), tt.requirements, tt.supportedKind, tt.extensions)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				if tt.errContains != "" && !strings.Contains(err.Error(), tt.errContains) {
					t.Errorf("error = %q, want it to contain %q", err.Error(), tt.errContains)
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

func TestUptoEvmServer_ValidatePaymentRequirements(t *testing.T) {
	tests := []struct {
		name         string
		requirements t402.PaymentRequirements
		wantErr      bool
		errContains  string
	}{
		{
			name: "valid requirements",
			requirements: t402.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				Amount:  "1000000",
				PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
			},
			wantErr: false,
		},
		{
			name: "valid requirements without asset",
			requirements: t402.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Amount:  "1000000",
				PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
			},
			wantErr: false,
		},
		{
			name: "valid requirements with large amount",
			requirements: t402.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Amount:  "999999999999999",
				PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
			},
			wantErr: false,
		},
		{
			name: "error: invalid PayTo address (too short)",
			requirements: t402.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Amount:  "1000000",
				PayTo:   "0x1234",
			},
			wantErr:     true,
			errContains: "invalid PayTo address",
		},
		{
			name: "error: invalid PayTo address (not hex)",
			requirements: t402.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Amount:  "1000000",
				PayTo:   "invalid-address",
			},
			wantErr:     true,
			errContains: "invalid PayTo address",
		},
		{
			name: "error: empty PayTo address",
			requirements: t402.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Amount:  "1000000",
				PayTo:   "",
			},
			wantErr:     true,
			errContains: "invalid PayTo address",
		},
		{
			name: "error: empty amount",
			requirements: t402.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Amount:  "",
				PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
			},
			wantErr:     true,
			errContains: "amount is required",
		},
		{
			name: "error: zero amount",
			requirements: t402.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Amount:  "0",
				PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
			},
			wantErr:     true,
			errContains: "invalid amount",
		},
		{
			name: "error: negative amount",
			requirements: t402.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Amount:  "-1000",
				PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
			},
			wantErr:     true,
			errContains: "invalid amount",
		},
		{
			name: "error: non-numeric amount",
			requirements: t402.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Amount:  "abc",
				PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
			},
			wantErr:     true,
			errContains: "invalid amount",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := NewUptoEvmServer()
			err := server.ValidatePaymentRequirements(tt.requirements)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				if tt.errContains != "" && !strings.Contains(err.Error(), tt.errContains) {
					t.Errorf("error = %q, want it to contain %q", err.Error(), tt.errContains)
				}
				return
			}

			if err != nil {
				t.Errorf("unexpected error: %v", err)
			}
		})
	}
}

func TestUptoEvmServer_GetDisplayAmount(t *testing.T) {
	tests := []struct {
		name        string
		amount      string
		network     string
		asset       string
		wantDisplay string
		wantErr     bool
	}{
		{
			name:        "formats fractional amount",
			amount:      "1500000",
			network:     "eip155:8453",
			asset:       "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			wantDisplay: "$1.5 (max)",
		},
		{
			name:        "formats whole number amount",
			amount:      "10000000",
			network:     "eip155:8453",
			asset:       "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			wantDisplay: "$10 (max)",
		},
		{
			name:        "formats small amount",
			amount:      "10000",
			network:     "eip155:8453",
			asset:       "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			wantDisplay: "$0.01 (max)",
		},
		{
			name:        "formats zero amount",
			amount:      "0",
			network:     "eip155:8453",
			asset:       "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			wantDisplay: "$0 (max)",
		},
		{
			name:    "error: invalid amount string",
			amount:  "not-a-number",
			network: "eip155:8453",
			asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			wantErr: true,
		},
		{
			name:    "error: unsupported network",
			amount:  "1000000",
			network: "unsupported:999",
			asset:   "0xToken",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := NewUptoEvmServer()
			display, err := server.GetDisplayAmount(tt.amount, tt.network, tt.asset)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if display != tt.wantDisplay {
				t.Errorf("GetDisplayAmount() = %q, want %q", display, tt.wantDisplay)
			}
		})
	}
}
