package server

import (
	"context"
	"fmt"
	"testing"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/stacks"
	"github.com/t402-io/t402/sdks/go/types"
)

func TestScheme(t *testing.T) {
	scheme := NewExactDirectStacksScheme(nil)

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
				"amount": "5000000",
				"asset":  "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
			},
			network:    stacks.StacksMainnetCAIP2,
			wantAmount: "5000000",
			wantAsset:  "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
		},
		{
			name: "amount without asset uses default",
			price: map[string]interface{}{
				"amount": "3000000",
			},
			network:    stacks.StacksMainnetCAIP2,
			wantAmount: "3000000",
			wantAsset:  "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
		},
		{
			name: "with extra fields",
			price: map[string]interface{}{
				"amount": "2000000",
				"asset":  "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
				"extra": map[string]interface{}{
					"symbol": "sUSDC",
				},
			},
			network:    stacks.StacksMainnetCAIP2,
			wantAmount: "2000000",
			wantAsset:  "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
		},
		{
			name: "Testnet default asset",
			price: map[string]interface{}{
				"amount": "4000000",
			},
			network:    stacks.StacksTestnetCAIP2,
			wantAmount: "4000000",
			wantAsset:  "stacks:2147483648/token:ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.token-susdc",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := NewExactDirectStacksScheme(nil)
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
			network:    stacks.StacksMainnetCAIP2,
			wantAmount: "1500000",
			wantAsset:  "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
		},
		{
			name:       "plain decimal",
			price:      "2.50",
			network:    stacks.StacksMainnetCAIP2,
			wantAmount: "2500000",
			wantAsset:  "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
		},
		{
			name:       "integer amount",
			price:      "10",
			network:    stacks.StacksMainnetCAIP2,
			wantAmount: "10000000",
			wantAsset:  "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
		},
		{
			name:       "dollar with spaces",
			price:      "  $5.00  ",
			network:    stacks.StacksMainnetCAIP2,
			wantAmount: "5000000",
			wantAsset:  "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
		},
		{
			name:       "small amount",
			price:      "0.01",
			network:    stacks.StacksMainnetCAIP2,
			wantAmount: "10000",
			wantAsset:  "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
		},
		{
			name:       "integer string",
			price:      "25",
			network:    stacks.StacksMainnetCAIP2,
			wantAmount: "25000000",
			wantAsset:  "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
		},
		{
			name:       "Testnet network",
			price:      "1.00",
			network:    stacks.StacksTestnetCAIP2,
			wantAmount: "1000000",
			wantAsset:  "stacks:2147483648/token:ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.token-susdc",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := NewExactDirectStacksScheme(nil)
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
			name:       "float64 - 1 dollar",
			price:      float64(1.0),
			wantAmount: "1000000",
		},
		{
			name:       "float64 - 1.50 dollars",
			price:      float64(1.50),
			wantAmount: "1500000",
		},
		{
			name:       "float64 - 10 dollars",
			price:      float64(10.0),
			wantAmount: "10000000",
		},
		{
			name:       "float64 - 0.01 dollars",
			price:      float64(0.01),
			wantAmount: "10000",
		},
		{
			name:       "int - 5",
			price:      int(5),
			wantAmount: "5000000",
		},
		{
			name:       "int64 - 100",
			price:      int64(100),
			wantAmount: "100000000",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := NewExactDirectStacksScheme(nil)
			result, err := scheme.ParsePrice(tt.price, t402.Network(stacks.StacksMainnetCAIP2))
			if err != nil {
				t.Fatalf("ParsePrice() error: %v", err)
			}
			if result.Amount != tt.wantAmount {
				t.Errorf("Amount = %v, want %v", result.Amount, tt.wantAmount)
			}
		})
	}
}

func TestParsePrice_DefaultExtra(t *testing.T) {
	scheme := NewExactDirectStacksScheme(nil)
	result, err := scheme.ParsePrice(float64(1.0), t402.Network(stacks.StacksMainnetCAIP2))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify extra fields are populated
	if result.Extra["symbol"] != "sUSDC" {
		t.Errorf("Extra[symbol] = %v, want sUSDC", result.Extra["symbol"])
	}
	if result.Extra["name"] != "Bridged USDC" {
		t.Errorf("Extra[name] = %v, want Bridged USDC", result.Extra["name"])
	}
	if result.Extra["decimals"] != 6 {
		t.Errorf("Extra[decimals] = %v, want 6", result.Extra["decimals"])
	}
	if result.Extra["contractAddress"] != "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc" {
		t.Errorf("Extra[contractAddress] = %v, want mainnet contract", result.Extra["contractAddress"])
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
			name:       "invalid network (non-stacks)",
			price:      float64(1.0),
			network:    "eip155:1",
			wantErrMsg: "invalid stacks network",
		},
		{
			name:       "unknown stacks network",
			price:      float64(1.0),
			network:    "stacks:99999",
			wantErrMsg: "unknown stacks network",
		},
		{
			name:       "invalid price format",
			price:      []string{"invalid"},
			network:    stacks.StacksMainnetCAIP2,
			wantErrMsg: "invalid price format",
		},
		{
			name:       "unparseable string price",
			price:      "not-a-number",
			network:    stacks.StacksMainnetCAIP2,
			wantErrMsg: "failed to parse price",
		},
		{
			name: "amount not a string in map",
			price: map[string]interface{}{
				"amount": 12345,
			},
			network:    stacks.StacksMainnetCAIP2,
			wantErrMsg: "amount must be a string",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := NewExactDirectStacksScheme(nil)
			_, err := scheme.ParsePrice(tt.price, t402.Network(tt.network))
			if err == nil {
				t.Fatalf("expected error, got nil")
			}
			if tt.wantErrMsg != "" && !containsStr(err.Error(), tt.wantErrMsg) {
				t.Errorf("error = %v, want to contain %v", err.Error(), tt.wantErrMsg)
			}
		})
	}
}

func TestRegisterMoneyParser_SingleCustomParser(t *testing.T) {
	scheme := NewExactDirectStacksScheme(nil)

	// Register custom parser: large amounts use custom asset
	scheme.RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
		if amount > 100 {
			return &t402.AssetAmount{
				Amount: fmt.Sprintf("%.0f", amount*1e6),
				Asset:  "stacks:1/token:SP000000000000000000000000000000000.custom-token",
				Extra: map[string]interface{}{
					"tier": "premium",
				},
			}, nil
		}
		return nil, nil // Use default for small amounts
	})

	// Test large amount - should use custom parser
	result1, err := scheme.ParsePrice(150.0, t402.Network(stacks.StacksMainnetCAIP2))
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result1.Asset != "stacks:1/token:SP000000000000000000000000000000000.custom-token" {
		t.Errorf("expected custom asset, got %s", result1.Asset)
	}
	if result1.Extra["tier"] != "premium" {
		t.Errorf("expected tier='premium', got %v", result1.Extra["tier"])
	}

	// Test small amount - should fall back to default
	result2, err := scheme.ParsePrice(50.0, t402.Network(stacks.StacksMainnetCAIP2))
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result2.Asset != "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc" {
		t.Errorf("expected default sUSDC, got %s", result2.Asset)
	}
}

func TestRegisterMoneyParser_MultipleInChain(t *testing.T) {
	scheme := NewExactDirectStacksScheme(nil)

	// Parser 1: Premium tier (> 1000)
	scheme.RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
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
	scheme.RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
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
	result1, err := scheme.ParsePrice(2000.0, t402.Network(stacks.StacksMainnetCAIP2))
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result1.Extra["tier"] != "premium" {
		t.Errorf("expected tier='premium', got %v", result1.Extra["tier"])
	}

	// Test large tier (second parser)
	result2, err := scheme.ParsePrice(200.0, t402.Network(stacks.StacksMainnetCAIP2))
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result2.Extra["tier"] != "large" {
		t.Errorf("expected tier='large', got %v", result2.Extra["tier"])
	}

	// Test default (no parser matches)
	result3, err := scheme.ParsePrice(50.0, t402.Network(stacks.StacksMainnetCAIP2))
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result3.Asset != "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc" {
		t.Errorf("expected default sUSDC, got %s", result3.Asset)
	}
}

func TestRegisterMoneyParser_ErrorSkipped(t *testing.T) {
	scheme := NewExactDirectStacksScheme(nil)

	// Parser that returns error (should be skipped)
	scheme.RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
		return nil, fmt.Errorf("parser error")
	})

	// Should fall back to default
	result, err := scheme.ParsePrice(10.0, t402.Network(stacks.StacksMainnetCAIP2))
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if result.Asset != "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc" {
		t.Errorf("expected default sUSDC after parser error, got %s", result.Asset)
	}
}

func TestRegisterMoneyParser_Chainability(t *testing.T) {
	scheme := NewExactDirectStacksScheme(nil)

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
}

func TestEnhancePaymentRequirements(t *testing.T) {
	tests := []struct {
		name          string
		requirements  types.PaymentRequirements
		supportedKind types.SupportedKind
		extensions    []string
		config        *ExactDirectStacksServerConfig
		validate      func(t *testing.T, result types.PaymentRequirements)
		wantErr       bool
		errContains   string
	}{
		{
			name: "basic enhancement on Stacks Mainnet",
			requirements: types.PaymentRequirements{
				Scheme:  stacks.SchemeExactDirect,
				Network: stacks.StacksMainnetCAIP2,
				PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
				Amount:  "1000000",
			},
			supportedKind: types.SupportedKind{
				T402Version: 2,
				Scheme:      stacks.SchemeExactDirect,
				Network:     stacks.StacksMainnetCAIP2,
			},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Asset != "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc" {
					t.Errorf("Asset = %v, want CAIP-19 identifier", result.Asset)
				}
				if result.Extra["contractAddress"] != "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc" {
					t.Errorf("Extra[contractAddress] = %v, want mainnet contract", result.Extra["contractAddress"])
				}
				if result.Extra["assetSymbol"] != "sUSDC" {
					t.Errorf("Extra[assetSymbol] = %v, want sUSDC", result.Extra["assetSymbol"])
				}
				if result.Extra["assetDecimals"] != 6 {
					t.Errorf("Extra[assetDecimals] = %v, want 6", result.Extra["assetDecimals"])
				}
				if result.Extra["networkName"] != "Stacks Mainnet" {
					t.Errorf("Extra[networkName] = %v, want Stacks Mainnet", result.Extra["networkName"])
				}
			},
		},
		{
			name: "enhancement on Stacks Testnet",
			requirements: types.PaymentRequirements{
				Scheme:  stacks.SchemeExactDirect,
				Network: stacks.StacksTestnetCAIP2,
				PayTo:   "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
				Amount:  "500000",
			},
			supportedKind: types.SupportedKind{
				T402Version: 2,
				Scheme:      stacks.SchemeExactDirect,
				Network:     stacks.StacksTestnetCAIP2,
			},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Asset != "stacks:2147483648/token:ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.token-susdc" {
					t.Errorf("Asset = %v, want Testnet CAIP-19 identifier", result.Asset)
				}
				if result.Extra["networkName"] != "Stacks Testnet" {
					t.Errorf("Extra[networkName] = %v, want Stacks Testnet", result.Extra["networkName"])
				}
			},
		},
		{
			name: "preserves existing asset if set",
			requirements: types.PaymentRequirements{
				Scheme:  stacks.SchemeExactDirect,
				Network: stacks.StacksMainnetCAIP2,
				Asset:   "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
				PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
				Amount:  "1000000",
			},
			supportedKind: types.SupportedKind{
				T402Version: 2,
				Scheme:      stacks.SchemeExactDirect,
				Network:     stacks.StacksMainnetCAIP2,
			},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Asset != "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc" {
					t.Errorf("Asset should be preserved, got %v", result.Asset)
				}
			},
		},
		{
			name: "converts decimal amount to atomic units",
			requirements: types.PaymentRequirements{
				Scheme:  stacks.SchemeExactDirect,
				Network: stacks.StacksMainnetCAIP2,
				PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
				Amount:  "1.50",
			},
			supportedKind: types.SupportedKind{
				T402Version: 2,
				Scheme:      stacks.SchemeExactDirect,
				Network:     stacks.StacksMainnetCAIP2,
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
				Scheme:  stacks.SchemeExactDirect,
				Network: stacks.StacksMainnetCAIP2,
				PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
				Amount:  "5000000",
			},
			supportedKind: types.SupportedKind{
				T402Version: 2,
				Scheme:      stacks.SchemeExactDirect,
				Network:     stacks.StacksMainnetCAIP2,
			},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Amount != "5000000" {
					t.Errorf("Amount = %v, want 5000000 (unchanged)", result.Amount)
				}
			},
		},
		{
			name: "copies facilitator extra fields (overrides defaults)",
			requirements: types.PaymentRequirements{
				Scheme:  stacks.SchemeExactDirect,
				Network: stacks.StacksMainnetCAIP2,
				PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
				Amount:  "1000000",
			},
			supportedKind: types.SupportedKind{
				T402Version: 2,
				Scheme:      stacks.SchemeExactDirect,
				Network:     stacks.StacksMainnetCAIP2,
				Extra: map[string]interface{}{
					"contractAddress": "SP000000000000000000000000000000000.custom-token",
					"assetSymbol":     "cUSDC",
					"assetDecimals":   float64(6),
					"networkName":     "Custom Name",
				},
			},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				// Facilitator extra should override defaults
				if result.Extra["networkName"] != "Custom Name" {
					t.Errorf("Extra[networkName] = %v, want Custom Name", result.Extra["networkName"])
				}
				if result.Extra["contractAddress"] != "SP000000000000000000000000000000000.custom-token" {
					t.Errorf("Extra[contractAddress] = %v, want custom contract", result.Extra["contractAddress"])
				}
			},
		},
		{
			name: "copies extension keys from supportedKind",
			requirements: types.PaymentRequirements{
				Scheme:  stacks.SchemeExactDirect,
				Network: stacks.StacksMainnetCAIP2,
				PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
				Amount:  "1000000",
			},
			supportedKind: types.SupportedKind{
				T402Version: 2,
				Scheme:      stacks.SchemeExactDirect,
				Network:     stacks.StacksMainnetCAIP2,
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
			name: "nil extra in requirements is initialized",
			requirements: types.PaymentRequirements{
				Scheme:  stacks.SchemeExactDirect,
				Network: stacks.StacksMainnetCAIP2,
				PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
				Amount:  "1000000",
				Extra:   nil,
			},
			supportedKind: types.SupportedKind{
				T402Version: 2,
				Scheme:      stacks.SchemeExactDirect,
				Network:     stacks.StacksMainnetCAIP2,
			},
			validate: func(t *testing.T, result types.PaymentRequirements) {
				if result.Extra == nil {
					t.Error("Extra should be initialized, got nil")
				}
				if result.Extra["contractAddress"] != "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc" {
					t.Errorf("Extra[contractAddress] = %v, want mainnet contract", result.Extra["contractAddress"])
				}
			},
		},
		{
			name: "error - unknown network",
			requirements: types.PaymentRequirements{
				Network: "stacks:99999",
			},
			supportedKind: types.SupportedKind{},
			wantErr:       true,
			errContains:   "unknown stacks network",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var scheme *ExactDirectStacksScheme
			if tt.config != nil {
				scheme = NewExactDirectStacksScheme(tt.config)
			} else {
				scheme = NewExactDirectStacksScheme(nil)
			}

			result, err := scheme.EnhancePaymentRequirements(
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

func TestToAtomicUnits(t *testing.T) {
	tests := []struct {
		name     string
		amount   string
		decimals int
		want     uint64
		wantErr  bool
	}{
		{"simple decimal", "1.50", 6, 1500000, false},
		{"integer", "10.000000", 6, 10000000, false},
		{"small amount", "0.01", 6, 10000, false},
		{"zero", "0.00", 6, 0, false},
		{"large amount", "1000.00", 6, 1000000000, false},
		{"one unit", "0.000001", 6, 1, false},
		{"different decimals (8)", "1.5", 8, 150000000, false},
		{"different decimals (2)", "1.5", 2, 150, false},
		{"negative amount", "-1.00", 6, 0, true},
		{"invalid string", "abc", 6, 0, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := toAtomicUnits(tt.amount, tt.decimals)
			if tt.wantErr {
				if err == nil {
					t.Errorf("toAtomicUnits(%v, %v) expected error, got nil", tt.amount, tt.decimals)
				}
				return
			}
			if err != nil {
				t.Fatalf("toAtomicUnits(%v, %v) unexpected error: %v", tt.amount, tt.decimals, err)
			}
			if result != tt.want {
				t.Errorf("toAtomicUnits(%v, %v) = %v, want %v", tt.amount, tt.decimals, result, tt.want)
			}
		})
	}
}

func TestGetSupportedNetworks(t *testing.T) {
	networks := GetSupportedNetworks()

	if len(networks) != len(stacks.Networks) {
		t.Errorf("GetSupportedNetworks() returned %d networks, want %d", len(networks), len(stacks.Networks))
	}

	// Verify all expected networks are present
	expected := map[string]bool{
		stacks.StacksMainnetCAIP2: false,
		stacks.StacksTestnetCAIP2: false,
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
		{"Stacks Mainnet", stacks.StacksMainnetCAIP2, true},
		{"Stacks Testnet", stacks.StacksTestnetCAIP2, true},
		{"Unknown network", "stacks:99999", false},
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

func TestNewExactDirectStacksScheme_DefaultConfig(t *testing.T) {
	scheme := NewExactDirectStacksScheme(nil)

	if scheme.config.PreferredToken != "" {
		t.Errorf("Default PreferredToken = %v, want empty", scheme.config.PreferredToken)
	}
	if len(scheme.moneyParsers) != 0 {
		t.Errorf("Default moneyParsers length = %v, want 0", len(scheme.moneyParsers))
	}
}

func TestNewExactDirectStacksScheme_CustomConfig(t *testing.T) {
	config := &ExactDirectStacksServerConfig{
		PreferredToken: "sUSDC",
	}
	scheme := NewExactDirectStacksScheme(config)

	if scheme.config.PreferredToken != "sUSDC" {
		t.Errorf("PreferredToken = %v, want sUSDC", scheme.config.PreferredToken)
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
