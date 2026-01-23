package server

import (
	"context"
	"fmt"
	"testing"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/aptos"
	"github.com/t402-io/t402/sdks/go/types"
)

const (
	validAddress = "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb"
	validPayTo   = "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b"
)

func TestExactDirectAptosScheme_Scheme(t *testing.T) {
	server := NewExactDirectAptosScheme()
	if server.Scheme() != "exact-direct" {
		t.Errorf("expected scheme 'exact-direct', got '%s'", server.Scheme())
	}
}

func TestExactDirectAptosScheme_ParsePrice(t *testing.T) {
	tests := []struct {
		name       string
		price      t402.Price
		network    t402.Network
		wantErr    bool
		wantAmount string
		wantAsset  string
	}{
		{
			name:       "decimal amount to smallest unit on mainnet",
			price:      1.50,
			network:    "aptos:1",
			wantAmount: "1500000",
			wantAsset:  aptos.USDTMainnet.MetadataAddress,
		},
		{
			name:       "whole number amount",
			price:      10.0,
			network:    "aptos:1",
			wantAmount: "10000000",
			wantAsset:  aptos.USDTMainnet.MetadataAddress,
		},
		{
			name:       "integer price",
			price:      5,
			network:    "aptos:1",
			wantAmount: "5000000",
			wantAsset:  aptos.USDTMainnet.MetadataAddress,
		},
		{
			name:       "int64 price",
			price:      int64(3),
			network:    "aptos:1",
			wantAmount: "3000000",
			wantAsset:  aptos.USDTMainnet.MetadataAddress,
		},
		{
			name:       "string price with dollar sign",
			price:      "$10.00",
			network:    "aptos:1",
			wantAmount: "10000000",
			wantAsset:  aptos.USDTMainnet.MetadataAddress,
		},
		{
			name:       "string price with USD suffix",
			price:      "5.50 USD",
			network:    "aptos:1",
			wantAmount: "5500000",
			wantAsset:  aptos.USDTMainnet.MetadataAddress,
		},
		{
			name:       "string price with USDT suffix",
			price:      "2.50 USDT",
			network:    "aptos:1",
			wantAmount: "2500000",
			wantAsset:  aptos.USDTMainnet.MetadataAddress,
		},
		{
			name:       "string price without currency",
			price:      "7.25",
			network:    "aptos:1",
			wantAmount: "7250000",
			wantAsset:  aptos.USDTMainnet.MetadataAddress,
		},
		{
			name:       "testnet network",
			price:      1.0,
			network:    "aptos:2",
			wantAmount: "1000000",
			wantAsset:  aptos.USDTMainnet.MetadataAddress, // same default token
		},
		{
			name:    "AssetAmount map with asset",
			price:   map[string]interface{}{"amount": "5000000", "asset": "0xcustom_token_address_padded_to_valid_length_1234567890abcdef"},
			network: "aptos:1",
			wantAmount: "5000000",
			wantAsset:  "0xcustom_token_address_padded_to_valid_length_1234567890abcdef",
		},
		{
			name:    "AssetAmount map with extra",
			price:   map[string]interface{}{"amount": "2000000", "asset": validAddress, "extra": map[string]interface{}{"symbol": "CUSTOM"}},
			network: "aptos:1",
			wantAmount: "2000000",
			wantAsset:  validAddress,
		},
		{
			name:    "AssetAmount map uses default asset when not specified",
			price:   map[string]interface{}{"amount": "3000000"},
			network: "aptos:1",
			wantAmount: "3000000",
			wantAsset:  aptos.USDTMainnet.MetadataAddress,
		},
		{
			name:    "unsupported network",
			price:   10.0,
			network: "eip155:1",
			wantErr: true,
		},
		{
			name:    "invalid network",
			price:   10.0,
			network: "unsupported:999",
			wantErr: true,
		},
		{
			name:    "invalid price string",
			price:   "not-a-number",
			network: "aptos:1",
			wantErr: true,
		},
		{
			name:    "unsupported price type",
			price:   []int{1, 2, 3},
			network: "aptos:1",
			wantErr: true,
		},
		{
			name:    "AssetAmount map with non-string amount",
			price:   map[string]interface{}{"amount": 12345},
			network: "aptos:1",
			wantErr: true,
		},
		{
			name:       "small fractional amount",
			price:      0.01,
			network:    "aptos:1",
			wantAmount: "10000",
			wantAsset:  aptos.USDTMainnet.MetadataAddress,
		},
		{
			name:       "very small fractional amount",
			price:      0.000001,
			network:    "aptos:1",
			wantAmount: "1",
			wantAsset:  aptos.USDTMainnet.MetadataAddress,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := NewExactDirectAptosScheme()

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
				t.Errorf("expected amount '%s', got '%s'", tt.wantAmount, result.Amount)
			}
			if result.Asset != tt.wantAsset {
				t.Errorf("expected asset '%s', got '%s'", tt.wantAsset, result.Asset)
			}
		})
	}
}

func TestExactDirectAptosScheme_ParsePrice_Extra(t *testing.T) {
	t.Run("AssetAmount map preserves extra fields", func(t *testing.T) {
		server := NewExactDirectAptosScheme()

		price := map[string]interface{}{
			"amount": "5000000",
			"asset":  validAddress,
			"extra": map[string]interface{}{
				"symbol": "CUSTOM",
				"tier":   "premium",
			},
		}

		result, err := server.ParsePrice(price, "aptos:1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result.Extra["symbol"] != "CUSTOM" {
			t.Errorf("expected extra symbol 'CUSTOM', got '%v'", result.Extra["symbol"])
		}
		if result.Extra["tier"] != "premium" {
			t.Errorf("expected extra tier 'premium', got '%v'", result.Extra["tier"])
		}
	})

	t.Run("default conversion includes token metadata in extra", func(t *testing.T) {
		server := NewExactDirectAptosScheme()

		result, err := server.ParsePrice(1.0, "aptos:1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result.Extra["symbol"] != "USDT" {
			t.Errorf("expected extra symbol 'USDT', got '%v'", result.Extra["symbol"])
		}
		if result.Extra["name"] != "Tether USD" {
			t.Errorf("expected extra name 'Tether USD', got '%v'", result.Extra["name"])
		}
		if result.Extra["decimals"] != 6 {
			t.Errorf("expected extra decimals 6, got '%v'", result.Extra["decimals"])
		}
	})
}

func TestExactDirectAptosScheme_RegisterMoneyParser(t *testing.T) {
	t.Run("custom parser handles conversion", func(t *testing.T) {
		server := NewExactDirectAptosScheme()

		server.RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
			if amount > 100 {
				return &t402.AssetAmount{
					Amount: fmt.Sprintf("%.0f", amount*1000000),
					Asset:  "0xcustom_large_amount_token",
					Extra:  map[string]interface{}{"tier": "large"},
				}, nil
			}
			return nil, nil
		})

		// Large amount - custom parser
		result, err := server.ParsePrice(200.0, "aptos:1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Asset != "0xcustom_large_amount_token" {
			t.Errorf("expected custom asset, got '%s'", result.Asset)
		}
		if result.Extra["tier"] != "large" {
			t.Errorf("expected tier 'large', got '%v'", result.Extra["tier"])
		}

		// Small amount - falls back to default
		result, err = server.ParsePrice(50.0, "aptos:1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Asset != aptos.USDTMainnet.MetadataAddress {
			t.Errorf("expected default USDT address, got '%s'", result.Asset)
		}
	})

	t.Run("parser chain respects order", func(t *testing.T) {
		server := NewExactDirectAptosScheme()

		server.RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
			return &t402.AssetAmount{
				Amount: "first",
				Asset:  "0xfirst_parser_token",
			}, nil
		})
		server.RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
			return &t402.AssetAmount{
				Amount: "second",
				Asset:  "0xsecond_parser_token",
			}, nil
		})

		result, err := server.ParsePrice(10.0, "aptos:1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Amount != "first" {
			t.Errorf("expected first parser to win, got amount '%s'", result.Amount)
		}
	})

	t.Run("chaining returns server for fluent API", func(t *testing.T) {
		server := NewExactDirectAptosScheme()

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
	})

	t.Run("parser error is skipped", func(t *testing.T) {
		server := NewExactDirectAptosScheme()

		// First parser errors
		server.RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
			return nil, fmt.Errorf("parser error")
		})

		// Second parser succeeds
		server.RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
			return &t402.AssetAmount{
				Amount: "999",
				Asset:  "0xfallback_token",
			}, nil
		})

		result, err := server.ParsePrice(10.0, "aptos:1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Asset != "0xfallback_token" {
			t.Errorf("expected fallback asset, got '%s'", result.Asset)
		}
	})

	t.Run("all parsers return nil falls back to default", func(t *testing.T) {
		server := NewExactDirectAptosScheme()

		server.RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
			return nil, nil
		})

		result, err := server.ParsePrice(5.0, "aptos:1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Asset != aptos.USDTMainnet.MetadataAddress {
			t.Errorf("expected default USDT address, got '%s'", result.Asset)
		}
		if result.Amount != "5000000" {
			t.Errorf("expected amount '5000000', got '%s'", result.Amount)
		}
	})
}

func TestExactDirectAptosScheme_EnhancePaymentRequirements(t *testing.T) {
	tests := []struct {
		name          string
		requirements  types.PaymentRequirements
		supportedKind types.SupportedKind
		extensions    []string
		config        *ExactDirectAptosServerConfig
		wantErr       bool
		validate      func(t *testing.T, result types.PaymentRequirements)
	}{
		{
			name: "adds token metadata to extra",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "aptos:1",
				Asset:   aptos.USDTMainnet.MetadataAddress,
				Amount:  "1000000",
				PayTo:   validPayTo,
			},
			supportedKind: types.SupportedKind{
				Scheme:  "exact-direct",
				Network: "aptos:1",
			},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Extra == nil {
					t.Fatal("expected extra to be non-nil")
				}
				if result.Extra["symbol"] != "USDT" {
					t.Errorf("expected symbol 'USDT', got '%v'", result.Extra["symbol"])
				}
				if result.Extra["name"] != "Tether USD" {
					t.Errorf("expected name 'Tether USD', got '%v'", result.Extra["name"])
				}
				if result.Extra["decimals"] != 6 {
					t.Errorf("expected decimals 6, got '%v'", result.Extra["decimals"])
				}
			},
		},
		{
			name: "uses default asset when not specified",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "aptos:1",
				Amount:  "1000000",
				PayTo:   validPayTo,
			},
			supportedKind: types.SupportedKind{
				Scheme:  "exact-direct",
				Network: "aptos:1",
			},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Asset != aptos.USDTMainnet.MetadataAddress {
					t.Errorf("expected default USDT address, got '%s'", result.Asset)
				}
			},
		},
		{
			name: "converts decimal amount to atomic units",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "aptos:1",
				Asset:   aptos.USDTMainnet.MetadataAddress,
				Amount:  "1.50",
				PayTo:   validPayTo,
			},
			supportedKind: types.SupportedKind{
				Scheme:  "exact-direct",
				Network: "aptos:1",
			},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Amount != "1500000" {
					t.Errorf("expected amount '1500000', got '%s'", result.Amount)
				}
			},
		},
		{
			name: "leaves atomic amount unchanged",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "aptos:1",
				Asset:   aptos.USDTMainnet.MetadataAddress,
				Amount:  "5000000",
				PayTo:   validPayTo,
			},
			supportedKind: types.SupportedKind{
				Scheme:  "exact-direct",
				Network: "aptos:1",
			},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Amount != "5000000" {
					t.Errorf("expected amount '5000000', got '%s'", result.Amount)
				}
			},
		},
		{
			name: "copies assetSymbol from supportedKind",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "aptos:1",
				Asset:   aptos.USDTMainnet.MetadataAddress,
				Amount:  "1000000",
				PayTo:   validPayTo,
			},
			supportedKind: types.SupportedKind{
				Scheme:  "exact-direct",
				Network: "aptos:1",
				Extra: map[string]interface{}{
					"assetSymbol":   "USDT",
					"assetDecimals": 6,
				},
			},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Extra["assetSymbol"] != "USDT" {
					t.Errorf("expected assetSymbol 'USDT', got '%v'", result.Extra["assetSymbol"])
				}
				if result.Extra["assetDecimals"] != 6 {
					t.Errorf("expected assetDecimals 6, got '%v'", result.Extra["assetDecimals"])
				}
			},
		},
		{
			name: "copies extension keys from supportedKind",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "aptos:1",
				Asset:   aptos.USDTMainnet.MetadataAddress,
				Amount:  "1000000",
				PayTo:   validPayTo,
			},
			supportedKind: types.SupportedKind{
				Scheme:  "exact-direct",
				Network: "aptos:1",
				Extra: map[string]interface{}{
					"ext1":  "value1",
					"ext2":  "value2",
					"other": "ignored",
				},
			},
			extensions: []string{"ext1", "ext2"},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Extra["ext1"] != "value1" {
					t.Errorf("expected ext1 'value1', got '%v'", result.Extra["ext1"])
				}
				if result.Extra["ext2"] != "value2" {
					t.Errorf("expected ext2 'value2', got '%v'", result.Extra["ext2"])
				}
				if result.Extra["other"] != nil {
					t.Errorf("expected 'other' not to be copied, got '%v'", result.Extra["other"])
				}
			},
		},
		{
			name: "unknown asset uses generic token info",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "aptos:1",
				Asset:   "0x0000000000000000000000000000000000000000000000000000000000000001",
				Amount:  "1000000",
				PayTo:   validPayTo,
			},
			supportedKind: types.SupportedKind{
				Scheme:  "exact-direct",
				Network: "aptos:1",
			},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Extra["symbol"] != "UNKNOWN" {
					t.Errorf("expected symbol 'UNKNOWN', got '%v'", result.Extra["symbol"])
				}
				if result.Extra["decimals"] != 6 {
					t.Errorf("expected decimals 6 for unknown token, got '%v'", result.Extra["decimals"])
				}
			},
		},
		{
			name: "unsupported network",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "eip155:1",
				Amount:  "1000000",
				PayTo:   validPayTo,
			},
			supportedKind: types.SupportedKind{},
			wantErr:       true,
		},
		{
			name: "testnet network",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "aptos:2",
				Asset:   aptos.USDTMainnet.MetadataAddress,
				Amount:  "1000000",
				PayTo:   validPayTo,
			},
			supportedKind: types.SupportedKind{
				Scheme:  "exact-direct",
				Network: "aptos:2",
			},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Extra["symbol"] != "USDT" {
					t.Errorf("expected symbol 'USDT', got '%v'", result.Extra["symbol"])
				}
			},
		},
		{
			name: "preserves existing extra fields",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "aptos:1",
				Asset:   aptos.USDTMainnet.MetadataAddress,
				Amount:  "1000000",
				PayTo:   validPayTo,
				Extra: map[string]interface{}{
					"customField": "customValue",
				},
			},
			supportedKind: types.SupportedKind{
				Scheme:  "exact-direct",
				Network: "aptos:1",
			},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Extra["customField"] != "customValue" {
					t.Errorf("expected customField 'customValue', got '%v'", result.Extra["customField"])
				}
				// Also has token metadata
				if result.Extra["symbol"] != "USDT" {
					t.Errorf("expected symbol 'USDT', got '%v'", result.Extra["symbol"])
				}
			},
		},
		{
			name: "nil extensions list",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "aptos:1",
				Asset:   aptos.USDTMainnet.MetadataAddress,
				Amount:  "1000000",
				PayTo:   validPayTo,
			},
			supportedKind: types.SupportedKind{
				Scheme:  "exact-direct",
				Network: "aptos:1",
				Extra: map[string]interface{}{
					"someKey": "someValue",
				},
			},
			extensions: nil,
			validate: func(t *testing.T, result types.PaymentRequirements) {
				// someKey should not be copied since it's not in extension keys
				if result.Extra["someKey"] != nil {
					t.Errorf("expected 'someKey' not to be copied without extension key, got '%v'", result.Extra["someKey"])
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var server *ExactDirectAptosScheme
			if tt.config != nil {
				server = NewExactDirectAptosScheme(tt.config)
			} else {
				server = NewExactDirectAptosScheme()
			}

			result, err := server.EnhancePaymentRequirements(
				context.Background(), tt.requirements, tt.supportedKind, tt.extensions)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
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

func TestExactDirectAptosScheme_PreferredToken(t *testing.T) {
	t.Run("uses USDC when configured as preferred", func(t *testing.T) {
		server := NewExactDirectAptosScheme(&ExactDirectAptosServerConfig{
			PreferredToken: "USDC",
		})

		requirements := types.PaymentRequirements{
			Scheme:  "exact-direct",
			Network: "aptos:1",
			Amount:  "1000000",
			PayTo:   validPayTo,
		}

		result, err := server.EnhancePaymentRequirements(
			context.Background(), requirements, types.SupportedKind{
				Scheme:  "exact-direct",
				Network: "aptos:1",
			}, nil)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result.Asset != aptos.USDCMainnet.MetadataAddress {
			t.Errorf("expected USDC address '%s', got '%s'", aptos.USDCMainnet.MetadataAddress, result.Asset)
		}
		if result.Extra["symbol"] != "USDC" {
			t.Errorf("expected symbol 'USDC', got '%v'", result.Extra["symbol"])
		}
	})

	t.Run("falls back to default when preferred token not found", func(t *testing.T) {
		server := NewExactDirectAptosScheme(&ExactDirectAptosServerConfig{
			PreferredToken: "NONEXISTENT",
		})

		requirements := types.PaymentRequirements{
			Scheme:  "exact-direct",
			Network: "aptos:1",
			Amount:  "1000000",
			PayTo:   validPayTo,
		}

		result, err := server.EnhancePaymentRequirements(
			context.Background(), requirements, types.SupportedKind{
				Scheme:  "exact-direct",
				Network: "aptos:1",
			}, nil)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result.Asset != aptos.USDTMainnet.MetadataAddress {
			t.Errorf("expected fallback to USDT address, got '%s'", result.Asset)
		}
	})

	t.Run("preferred token used in ParsePrice", func(t *testing.T) {
		server := NewExactDirectAptosScheme(&ExactDirectAptosServerConfig{
			PreferredToken: "USDC",
		})

		// ParsePrice uses the network's default token (from config.DefaultToken),
		// not the preferred token. The preferred token is for EnhancePaymentRequirements.
		result, err := server.ParsePrice(1.0, "aptos:1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		// ParsePrice always uses the network config's DefaultToken
		if result.Asset != aptos.USDTMainnet.MetadataAddress {
			t.Errorf("expected default USDT for ParsePrice, got '%s'", result.Asset)
		}
	})
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
			name:     "whole number",
			amount:   "10",
			decimals: 6,
			want:     10000000,
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
			name:     "smallest unit",
			amount:   "0.000001",
			decimals: 6,
			want:     1,
		},
		{
			name:     "truncates extra decimals",
			amount:   "1.1234567",
			decimals: 6,
			want:     1123456,
		},
		{
			name:     "zero amount",
			amount:   "0",
			decimals: 6,
			want:     0,
		},
		{
			name:     "trailing zeros in decimal",
			amount:   "1.100000",
			decimals: 6,
			want:     1100000,
		},
		{
			name:     "different decimals (8)",
			amount:   "1.50",
			decimals: 8,
			want:     150000000,
		},
		{
			name:     "invalid integer part",
			amount:   "abc",
			decimals: 6,
			wantErr:  true,
		},
		{
			name:     "multiple dots",
			amount:   "1.2.3",
			decimals: 6,
			wantErr:  true,
		},
		{
			name:     "whitespace is trimmed",
			amount:   "  10  ",
			decimals: 6,
			want:     10000000,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := parseAmount(tt.amount, tt.decimals)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Errorf("parseAmount(%s, %d) = %d, want %d", tt.amount, tt.decimals, got, tt.want)
			}
		})
	}
}

func TestNewExactDirectAptosScheme_Config(t *testing.T) {
	t.Run("default config", func(t *testing.T) {
		server := NewExactDirectAptosScheme()
		if server.config.PreferredToken != "" {
			t.Errorf("expected empty PreferredToken, got '%s'", server.config.PreferredToken)
		}
	})

	t.Run("custom config", func(t *testing.T) {
		server := NewExactDirectAptosScheme(&ExactDirectAptosServerConfig{
			PreferredToken: "USDC",
		})
		if server.config.PreferredToken != "USDC" {
			t.Errorf("expected PreferredToken 'USDC', got '%s'", server.config.PreferredToken)
		}
	})

	t.Run("nil config uses defaults", func(t *testing.T) {
		server := NewExactDirectAptosScheme(nil)
		if server.config.PreferredToken != "" {
			t.Errorf("expected empty PreferredToken with nil config, got '%s'", server.config.PreferredToken)
		}
	})
}
