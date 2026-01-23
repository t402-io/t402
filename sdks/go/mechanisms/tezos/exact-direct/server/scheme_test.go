package server

import (
	"context"
	"fmt"
	"testing"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/tezos"
	"github.com/t402-io/t402/sdks/go/types"
)

func TestExactDirectTezosScheme_Scheme(t *testing.T) {
	scheme := NewExactDirectTezosScheme()

	if scheme.Scheme() != "exact-direct" {
		t.Errorf("expected scheme 'exact-direct', got '%s'", scheme.Scheme())
	}
}

func TestExactDirectTezosScheme_ParsePrice(t *testing.T) {
	tests := []struct {
		name       string
		config     *ExactDirectTezosServerConfig
		price      t402.Price
		network    t402.Network
		wantErr    bool
		wantAmount string
		wantAsset  string
	}{
		{
			name:       "decimal amount to atomic units",
			price:      1.50,
			network:    t402.Network(tezos.TezosMainnetCAIP2),
			wantErr:    false,
			wantAmount: "1500000",
			wantAsset:  "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
		},
		{
			name:       "integer amount",
			price:      5,
			network:    t402.Network(tezos.TezosMainnetCAIP2),
			wantErr:    false,
			wantAmount: "5000000",
			wantAsset:  "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
		},
		{
			name:       "string with dollar sign",
			price:      "$10.00",
			network:    t402.Network(tezos.TezosMainnetCAIP2),
			wantErr:    false,
			wantAmount: "10000000",
			wantAsset:  "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
		},
		{
			name:       "string with USDT suffix",
			price:      "2.50 USDT",
			network:    t402.Network(tezos.TezosMainnetCAIP2),
			wantErr:    false,
			wantAmount: "2500000",
			wantAsset:  "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
		},
		{
			name:       "string with USDt suffix",
			price:      "3.25 USDt",
			network:    t402.Network(tezos.TezosMainnetCAIP2),
			wantErr:    false,
			wantAmount: "3250000",
			wantAsset:  "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
		},
		{
			name:       "string with USD suffix",
			price:      "7.99 USD",
			network:    t402.Network(tezos.TezosMainnetCAIP2),
			wantErr:    false,
			wantAmount: "7990000",
			wantAsset:  "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
		},
		{
			name: "AssetAmount map directly",
			price: map[string]interface{}{
				"amount": "5000000",
				"asset":  "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
				"extra": map[string]interface{}{
					"symbol": "USDt",
				},
			},
			network:    t402.Network(tezos.TezosMainnetCAIP2),
			wantErr:    false,
			wantAmount: "5000000",
			wantAsset:  "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
		},
		{
			name: "AssetAmount without asset fails",
			price: map[string]interface{}{
				"amount": "5000000",
			},
			network: t402.Network(tezos.TezosMainnetCAIP2),
			wantErr: true,
		},
		{
			name:    "non-Tezos network fails",
			price:   10.0,
			network: t402.Network("eip155:1"),
			wantErr: true,
		},
		{
			name:    "unsupported price type fails",
			price:   []int{1, 2, 3},
			network: t402.Network(tezos.TezosMainnetCAIP2),
			wantErr: true,
		},
		{
			name:    "invalid string price fails",
			price:   "not-a-number",
			network: t402.Network(tezos.TezosMainnetCAIP2),
			wantErr: true,
		},
		{
			name:    "ghostnet without default token fails",
			price:   1.0,
			network: t402.Network(tezos.TezosGhostnetCAIP2),
			wantErr: true,
		},
		{
			name:       "zero amount",
			price:      0.0,
			network:    t402.Network(tezos.TezosMainnetCAIP2),
			wantErr:    false,
			wantAmount: "0",
			wantAsset:  "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
		},
		{
			name:       "small fractional amount",
			price:      0.01,
			network:    t402.Network(tezos.TezosMainnetCAIP2),
			wantErr:    false,
			wantAmount: "10000",
			wantAsset:  "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
		},
		{
			name:       "int64 price type",
			price:      int64(100),
			network:    t402.Network(tezos.TezosMainnetCAIP2),
			wantErr:    false,
			wantAmount: "100000000",
			wantAsset:  "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
		},
		{
			name: "amount not a string",
			price: map[string]interface{}{
				"amount": 12345,
				"asset":  "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
			},
			network: t402.Network(tezos.TezosMainnetCAIP2),
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var scheme *ExactDirectTezosScheme
			if tt.config != nil {
				scheme = NewExactDirectTezosScheme(tt.config)
			} else {
				scheme = NewExactDirectTezosScheme()
			}

			result, err := scheme.ParsePrice(tt.price, tt.network)
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
			if tt.wantAsset != "" && result.Asset != tt.wantAsset {
				t.Errorf("expected asset '%s', got '%s'", tt.wantAsset, result.Asset)
			}
		})
	}
}

func TestExactDirectTezosScheme_ParsePrice_Extra(t *testing.T) {
	t.Run("default conversion includes extra metadata", func(t *testing.T) {
		scheme := NewExactDirectTezosScheme()

		result, err := scheme.ParsePrice(1.0, t402.Network(tezos.TezosMainnetCAIP2))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result.Extra == nil {
			t.Fatal("expected non-nil extra")
		}
		if result.Extra["symbol"] != "USDt" {
			t.Errorf("expected symbol 'USDt', got '%v'", result.Extra["symbol"])
		}
		if result.Extra["name"] != "Tether USD" {
			t.Errorf("expected name 'Tether USD', got '%v'", result.Extra["name"])
		}
		if result.Extra["decimals"] != 6 {
			t.Errorf("expected decimals 6, got '%v'", result.Extra["decimals"])
		}
		if result.Extra["tokenId"] != 0 {
			t.Errorf("expected tokenId 0, got '%v'", result.Extra["tokenId"])
		}
	})

	t.Run("AssetAmount map preserves extra", func(t *testing.T) {
		scheme := NewExactDirectTezosScheme()

		price := map[string]interface{}{
			"amount": "1000000",
			"asset":  "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
			"extra": map[string]interface{}{
				"custom": "value",
			},
		}

		result, err := scheme.ParsePrice(price, t402.Network(tezos.TezosMainnetCAIP2))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result.Extra["custom"] != "value" {
			t.Errorf("expected custom extra 'value', got '%v'", result.Extra["custom"])
		}
	})
}

func TestExactDirectTezosScheme_RegisterMoneyParser(t *testing.T) {
	t.Run("custom parser handles conversion", func(t *testing.T) {
		scheme := NewExactDirectTezosScheme()

		scheme.RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
			if amount > 100 {
				return &t402.AssetAmount{
					Amount: fmt.Sprintf("%.0f", amount*1e8),
					Asset:  "custom-asset",
					Extra:  map[string]interface{}{"tier": "premium"},
				}, nil
			}
			return nil, nil
		})

		// Large amount - custom parser
		result, err := scheme.ParsePrice(200.0, t402.Network(tezos.TezosMainnetCAIP2))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Asset != "custom-asset" {
			t.Errorf("expected custom asset, got '%s'", result.Asset)
		}
		if result.Extra["tier"] != "premium" {
			t.Errorf("expected tier 'premium', got '%v'", result.Extra["tier"])
		}

		// Small amount - default parser
		result, err = scheme.ParsePrice(50.0, t402.Network(tezos.TezosMainnetCAIP2))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Asset != "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0" {
			t.Errorf("expected default USDt asset, got '%s'", result.Asset)
		}
	})

	t.Run("chaining returns server instance", func(t *testing.T) {
		scheme := NewExactDirectTezosScheme()

		result := scheme.
			RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
				return nil, nil
			}).
			RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
				return nil, nil
			})

		if result != scheme {
			t.Error("expected RegisterMoneyParser to return scheme for chaining")
		}
	})

	t.Run("skips parser that returns error", func(t *testing.T) {
		scheme := NewExactDirectTezosScheme()

		// First parser errors
		scheme.RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
			return nil, fmt.Errorf("parser error")
		})

		// Second parser succeeds
		scheme.RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
			return &t402.AssetAmount{
				Amount: "999",
				Asset:  "fallback-asset",
			}, nil
		})

		result, err := scheme.ParsePrice(10.0, t402.Network(tezos.TezosMainnetCAIP2))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Asset != "fallback-asset" {
			t.Errorf("expected fallback asset, got '%s'", result.Asset)
		}
	})

	t.Run("multiple nil parsers fall through to default", func(t *testing.T) {
		scheme := NewExactDirectTezosScheme()

		scheme.RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
			return nil, nil
		})
		scheme.RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
			return nil, nil
		})

		result, err := scheme.ParsePrice(1.0, t402.Network(tezos.TezosMainnetCAIP2))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Amount != "1000000" {
			t.Errorf("expected default conversion '1000000', got '%s'", result.Amount)
		}
	})
}

func TestExactDirectTezosScheme_EnhancePaymentRequirements(t *testing.T) {
	tests := []struct {
		name          string
		config        *ExactDirectTezosServerConfig
		requirements  types.PaymentRequirements
		supportedKind types.SupportedKind
		extensions    []string
		wantErr       bool
		validate      func(t *testing.T, result types.PaymentRequirements)
	}{
		{
			name: "adds asset and extra metadata",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: tezos.TezosMainnetCAIP2,
				Amount:  "1000000",
				PayTo:   "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
			},
			supportedKind: types.SupportedKind{
				Scheme:  "exact-direct",
				Network: tezos.TezosMainnetCAIP2,
			},
			wantErr: false,
			validate: func(t *testing.T, result types.PaymentRequirements) {
				expectedAsset := "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0"
				if result.Asset != expectedAsset {
					t.Errorf("expected asset '%s', got '%s'", expectedAsset, result.Asset)
				}
				if result.Extra == nil {
					t.Fatal("expected non-nil extra")
				}
				if result.Extra["assetSymbol"] != "USDt" {
					t.Errorf("expected assetSymbol 'USDt', got '%v'", result.Extra["assetSymbol"])
				}
				if result.Extra["assetDecimals"] != 6 {
					t.Errorf("expected assetDecimals 6, got '%v'", result.Extra["assetDecimals"])
				}
				if result.Extra["assetName"] != "Tether USD" {
					t.Errorf("expected assetName 'Tether USD', got '%v'", result.Extra["assetName"])
				}
				if result.Extra["networkName"] != "Tezos Mainnet" {
					t.Errorf("expected networkName 'Tezos Mainnet', got '%v'", result.Extra["networkName"])
				}
			},
		},
		{
			name: "preserves existing asset",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: tezos.TezosMainnetCAIP2,
				Asset:   "tezos:NetXdQprcVkpaWU/fa2:KT1CustomContract00000000000000000000/1",
				Amount:  "1000000",
				PayTo:   "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
			},
			supportedKind: types.SupportedKind{
				Scheme:  "exact-direct",
				Network: tezos.TezosMainnetCAIP2,
			},
			wantErr: false,
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Asset != "tezos:NetXdQprcVkpaWU/fa2:KT1CustomContract00000000000000000000/1" {
					t.Errorf("expected existing asset to be preserved, got '%s'", result.Asset)
				}
			},
		},
		{
			name: "converts decimal amount to atomic",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: tezos.TezosMainnetCAIP2,
				Amount:  "1.50",
				PayTo:   "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
			},
			supportedKind: types.SupportedKind{
				Scheme:  "exact-direct",
				Network: tezos.TezosMainnetCAIP2,
			},
			wantErr: false,
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Amount != "1500000" {
					t.Errorf("expected amount '1500000', got '%s'", result.Amount)
				}
			},
		},
		{
			name: "does not convert already-atomic amount",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: tezos.TezosMainnetCAIP2,
				Amount:  "1500000",
				PayTo:   "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
			},
			supportedKind: types.SupportedKind{
				Scheme:  "exact-direct",
				Network: tezos.TezosMainnetCAIP2,
			},
			wantErr: false,
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Amount != "1500000" {
					t.Errorf("expected amount '1500000', got '%s'", result.Amount)
				}
			},
		},
		{
			name: "does not override existing extra values",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: tezos.TezosMainnetCAIP2,
				Amount:  "1000000",
				PayTo:   "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
				Extra: map[string]interface{}{
					"assetSymbol":   "CustomSymbol",
					"assetDecimals": 8,
				},
			},
			supportedKind: types.SupportedKind{
				Scheme:  "exact-direct",
				Network: tezos.TezosMainnetCAIP2,
			},
			wantErr: false,
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Extra["assetSymbol"] != "CustomSymbol" {
					t.Errorf("expected assetSymbol 'CustomSymbol', got '%v'", result.Extra["assetSymbol"])
				}
				if result.Extra["assetDecimals"] != 8 {
					t.Errorf("expected assetDecimals 8, got '%v'", result.Extra["assetDecimals"])
				}
			},
		},
		{
			name: "copies extension keys from supportedKind",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: tezos.TezosMainnetCAIP2,
				Amount:  "1000000",
				PayTo:   "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
			},
			supportedKind: types.SupportedKind{
				Scheme:  "exact-direct",
				Network: tezos.TezosMainnetCAIP2,
				Extra: map[string]interface{}{
					"ext1":  "value1",
					"ext2":  "value2",
					"other": "ignored",
				},
			},
			extensions: []string{"ext1", "ext2"},
			wantErr:    false,
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Extra["ext1"] != "value1" {
					t.Errorf("expected ext1 'value1', got '%v'", result.Extra["ext1"])
				}
				if result.Extra["ext2"] != "value2" {
					t.Errorf("expected ext2 'value2', got '%v'", result.Extra["ext2"])
				}
				if result.Extra["other"] != nil {
					t.Errorf("expected 'other' to not be copied, got '%v'", result.Extra["other"])
				}
			},
		},
		{
			name: "copies assetSymbol from supportedKind extra",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: tezos.TezosMainnetCAIP2,
				Amount:  "1000000",
				PayTo:   "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
			},
			supportedKind: types.SupportedKind{
				Scheme:  "exact-direct",
				Network: tezos.TezosMainnetCAIP2,
				Extra: map[string]interface{}{
					"assetSymbol":   "CustomUSDt",
					"assetDecimals": 8,
				},
			},
			wantErr: false,
			validate: func(t *testing.T, result types.PaymentRequirements) {
				// supportedKind values should override defaults
				if result.Extra["assetSymbol"] != "CustomUSDt" {
					t.Errorf("expected assetSymbol 'CustomUSDt', got '%v'", result.Extra["assetSymbol"])
				}
				if result.Extra["assetDecimals"] != 8 {
					t.Errorf("expected assetDecimals 8 from supportedKind, got '%v'", result.Extra["assetDecimals"])
				}
			},
		},
		{
			name: "non-Tezos network fails",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "eip155:1",
				Amount:  "1000000",
				PayTo:   "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
			},
			supportedKind: types.SupportedKind{},
			wantErr:       true,
		},
		{
			name: "unknown Tezos network fails",
			requirements: types.PaymentRequirements{
				Scheme:  "exact-direct",
				Network: "tezos:UnknownChainId",
				Amount:  "1000000",
				PayTo:   "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
			},
			supportedKind: types.SupportedKind{},
			wantErr:       true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var scheme *ExactDirectTezosScheme
			if tt.config != nil {
				scheme = NewExactDirectTezosScheme(tt.config)
			} else {
				scheme = NewExactDirectTezosScheme()
			}

			result, err := scheme.EnhancePaymentRequirements(
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

func TestExactDirectTezosScheme_PreferredToken(t *testing.T) {
	t.Run("uses preferred token when available", func(t *testing.T) {
		scheme := NewExactDirectTezosScheme(&ExactDirectTezosServerConfig{
			PreferredToken: "USDt",
		})

		result, err := scheme.ParsePrice(1.0, t402.Network(tezos.TezosMainnetCAIP2))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		expectedAsset := "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0"
		if result.Asset != expectedAsset {
			t.Errorf("expected asset '%s', got '%s'", expectedAsset, result.Asset)
		}
	})

	t.Run("falls back to default when preferred not available", func(t *testing.T) {
		scheme := NewExactDirectTezosScheme(&ExactDirectTezosServerConfig{
			PreferredToken: "NonExistentToken",
		})

		result, err := scheme.ParsePrice(1.0, t402.Network(tezos.TezosMainnetCAIP2))
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		// Should fall back to default USDt
		expectedAsset := "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0"
		if result.Asset != expectedAsset {
			t.Errorf("expected fallback asset '%s', got '%s'", expectedAsset, result.Asset)
		}
	})
}

func TestParseDecimalToAtomic(t *testing.T) {
	tests := []struct {
		name     string
		amount   string
		decimals int
		want     string
		wantErr  bool
	}{
		{
			name:     "whole number",
			amount:   "1",
			decimals: 6,
			want:     "1000000",
		},
		{
			name:     "decimal amount",
			amount:   "1.50",
			decimals: 6,
			want:     "1500000",
		},
		{
			name:     "small decimal",
			amount:   "0.01",
			decimals: 6,
			want:     "10000",
		},
		{
			name:     "very small decimal",
			amount:   "0.000001",
			decimals: 6,
			want:     "1",
		},
		{
			name:     "truncates extra decimals",
			amount:   "1.1234567",
			decimals: 6,
			want:     "1123456",
		},
		{
			name:     "zero",
			amount:   "0",
			decimals: 6,
			want:     "0",
		},
		{
			name:     "large number",
			amount:   "1000.00",
			decimals: 6,
			want:     "1000000000",
		},
		{
			name:     "no fractional part",
			amount:   "100",
			decimals: 6,
			want:     "100000000",
		},
		{
			name:     "8 decimals",
			amount:   "1.5",
			decimals: 8,
			want:     "150000000",
		},
		{
			name:    "invalid format - multiple dots",
			amount:  "1.2.3",
			decimals: 6,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := parseDecimalToAtomic(tt.amount, tt.decimals)
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if result != tt.want {
				t.Errorf("parseDecimalToAtomic(%s, %d) = %s, want %s",
					tt.amount, tt.decimals, result, tt.want)
			}
		})
	}
}

func TestGetSupportedNetworks(t *testing.T) {
	networks := GetSupportedNetworks()

	if len(networks) != 2 {
		t.Errorf("expected 2 supported networks, got %d", len(networks))
	}

	foundMainnet := false
	foundGhostnet := false
	for _, n := range networks {
		if n == tezos.TezosMainnetCAIP2 {
			foundMainnet = true
		}
		if n == tezos.TezosGhostnetCAIP2 {
			foundGhostnet = true
		}
	}

	if !foundMainnet {
		t.Error("expected mainnet in supported networks")
	}
	if !foundGhostnet {
		t.Error("expected ghostnet in supported networks")
	}
}

func TestIsNetworkSupported(t *testing.T) {
	tests := []struct {
		name    string
		network string
		want    bool
	}{
		{"mainnet", tezos.TezosMainnetCAIP2, true},
		{"ghostnet", tezos.TezosGhostnetCAIP2, true},
		{"invalid", "tezos:UnknownChain", false},
		{"empty", "", false},
		{"evm", "eip155:1", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsNetworkSupported(tt.network)
			if got != tt.want {
				t.Errorf("IsNetworkSupported(%s) = %v, want %v", tt.network, got, tt.want)
			}
		})
	}
}

func TestNewExactDirectTezosScheme_Config(t *testing.T) {
	t.Run("default config", func(t *testing.T) {
		scheme := NewExactDirectTezosScheme()

		if scheme.config.PreferredToken != "" {
			t.Errorf("default PreferredToken = '%v', want empty", scheme.config.PreferredToken)
		}
		if len(scheme.moneyParsers) != 0 {
			t.Errorf("default moneyParsers length = %v, want 0", len(scheme.moneyParsers))
		}
	})

	t.Run("custom config", func(t *testing.T) {
		scheme := NewExactDirectTezosScheme(&ExactDirectTezosServerConfig{
			PreferredToken: "USDt",
		})

		if scheme.config.PreferredToken != "USDt" {
			t.Errorf("PreferredToken = '%v', want 'USDt'", scheme.config.PreferredToken)
		}
	})

	t.Run("nil config uses defaults", func(t *testing.T) {
		scheme := NewExactDirectTezosScheme(nil)

		if scheme.config.PreferredToken != "" {
			t.Errorf("default PreferredToken with nil config = '%v', want empty", scheme.config.PreferredToken)
		}
	})
}

func TestDefaultMoneyConversion_IncludesTokenMetadata(t *testing.T) {
	scheme := NewExactDirectTezosScheme()

	result, err := scheme.ParsePrice(1.00, t402.Network(tezos.TezosMainnetCAIP2))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Default conversion should include token metadata in Extra
	if result.Extra["symbol"] != "USDt" {
		t.Errorf("Extra.symbol = '%v', want 'USDt'", result.Extra["symbol"])
	}
	if result.Extra["name"] != "Tether USD" {
		t.Errorf("Extra.name = '%v', want 'Tether USD'", result.Extra["name"])
	}
	if result.Extra["decimals"] != 6 {
		t.Errorf("Extra.decimals = '%v', want 6", result.Extra["decimals"])
	}
	if result.Extra["tokenId"] != 0 {
		t.Errorf("Extra.tokenId = '%v', want 0", result.Extra["tokenId"])
	}
}

func TestEnhancePaymentRequirements_NilExtra(t *testing.T) {
	scheme := NewExactDirectTezosScheme()

	requirements := types.PaymentRequirements{
		Scheme:  "exact-direct",
		Network: tezos.TezosMainnetCAIP2,
		Amount:  "1000000",
		PayTo:   "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
		Extra:   nil, // nil extra map
	}

	supportedKind := types.SupportedKind{
		Scheme:  "exact-direct",
		Network: tezos.TezosMainnetCAIP2,
		Extra: map[string]interface{}{
			"assetSymbol": "USDt",
		},
	}

	result, err := scheme.EnhancePaymentRequirements(
		context.Background(), requirements, supportedKind, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Extra should be initialized and populated
	if result.Extra == nil {
		t.Fatal("expected Extra to be initialized")
	}
	// supportedKind values override defaults
	if result.Extra["assetSymbol"] != "USDt" {
		t.Errorf("Extra.assetSymbol = '%v', want 'USDt'", result.Extra["assetSymbol"])
	}
}
