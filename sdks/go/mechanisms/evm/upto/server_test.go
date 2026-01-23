package upto

import (
	"context"
	"fmt"
	"testing"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/types"
)

func TestUptoEvmServer_Scheme(t *testing.T) {
	server := NewUptoEvmServer()
	if server.Scheme() != "upto" {
		t.Errorf("expected scheme 'upto', got '%s'", server.Scheme())
	}
}

func TestUptoEvmServer_ParsePrice(t *testing.T) {
	t.Run("should parse decimal amount to smallest unit", func(t *testing.T) {
		server := NewUptoEvmServer()

		result, err := server.ParsePrice(1.50, "eip155:8453")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result.Amount != "1500000" {
			t.Errorf("expected amount '1500000', got '%s'", result.Amount)
		}
		if result.Asset != "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" {
			t.Errorf("expected USDC address, got '%s'", result.Asset)
		}
	})

	t.Run("should parse string price with dollar sign", func(t *testing.T) {
		server := NewUptoEvmServer()

		result, err := server.ParsePrice("$10.00", "eip155:8453")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result.Amount != "10000000" {
			t.Errorf("expected amount '10000000', got '%s'", result.Amount)
		}
	})

	t.Run("should parse string price with USD suffix", func(t *testing.T) {
		server := NewUptoEvmServer()

		result, err := server.ParsePrice("5.50 USD", "eip155:8453")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result.Amount != "5500000" {
			t.Errorf("expected amount '5500000', got '%s'", result.Amount)
		}
	})

	t.Run("should parse string price with USDT suffix", func(t *testing.T) {
		server := NewUptoEvmServer()

		result, err := server.ParsePrice("2.50 USDT", "eip155:8453")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result.Amount != "2500000" {
			t.Errorf("expected amount '2500000', got '%s'", result.Amount)
		}
	})

	t.Run("should handle AssetAmount map directly", func(t *testing.T) {
		server := NewUptoEvmServer()

		price := map[string]interface{}{
			"amount": "5000000",
			"asset":  "0xCustomToken",
			"extra": map[string]interface{}{
				"symbol": "CUSTOM",
			},
		}

		result, err := server.ParsePrice(price, "eip155:8453")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result.Amount != "5000000" {
			t.Errorf("expected amount '5000000', got '%s'", result.Amount)
		}
		if result.Asset != "0xCustomToken" {
			t.Errorf("expected asset '0xCustomToken', got '%s'", result.Asset)
		}
		if result.Extra["symbol"] != "CUSTOM" {
			t.Errorf("expected extra symbol 'CUSTOM', got '%v'", result.Extra["symbol"])
		}
	})

	t.Run("should fail for AssetAmount without asset", func(t *testing.T) {
		server := NewUptoEvmServer()

		price := map[string]interface{}{
			"amount": "5000000",
		}

		_, err := server.ParsePrice(price, "eip155:8453")
		if err == nil {
			t.Fatal("expected error for missing asset")
		}
	})

	t.Run("should fail for unsupported network", func(t *testing.T) {
		server := NewUptoEvmServer()

		_, err := server.ParsePrice(10.0, "unsupported:999999")
		if err == nil {
			t.Fatal("expected error for unsupported network")
		}
	})

	t.Run("should fail for unsupported price type", func(t *testing.T) {
		server := NewUptoEvmServer()

		_, err := server.ParsePrice([]int{1, 2, 3}, "eip155:8453")
		if err == nil {
			t.Fatal("expected error for unsupported price type")
		}
	})

	t.Run("should handle integer price", func(t *testing.T) {
		server := NewUptoEvmServer()

		result, err := server.ParsePrice(5, "eip155:8453")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result.Amount != "5000000" {
			t.Errorf("expected amount '5000000', got '%s'", result.Amount)
		}
	})

	t.Run("should detect already-in-smallest-unit amounts", func(t *testing.T) {
		server := NewUptoEvmServer()

		// 1500000 is >= 1e6 and is a whole number, so it should be treated as smallest unit
		result, err := server.ParsePrice(float64(1500000), "eip155:8453")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result.Amount != "1500000" {
			t.Errorf("expected amount '1500000', got '%s'", result.Amount)
		}
	})

	t.Run("should use network-specific asset address", func(t *testing.T) {
		server := NewUptoEvmServer()

		// Test with Ethereum mainnet
		result, err := server.ParsePrice(10.0, "eip155:1")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result.Asset != "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" {
			t.Errorf("expected Ethereum USDC address, got '%s'", result.Asset)
		}
	})
}

func TestUptoEvmServer_RegisterMoneyParser(t *testing.T) {
	t.Run("should use custom parser when it handles", func(t *testing.T) {
		server := NewUptoEvmServer()

		server.RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
			if amount > 100 {
				return &t402.AssetAmount{
					Amount: fmt.Sprintf("%.0f", amount*1e18),
					Asset:  "0xDAI",
					Extra:  map[string]interface{}{"tier": "large"},
				}, nil
			}
			return nil, nil
		})

		// Large amount - custom parser
		result, err := server.ParsePrice(200.0, "eip155:8453")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Asset != "0xDAI" {
			t.Errorf("expected DAI asset, got '%s'", result.Asset)
		}

		// Small amount - default
		result, err = server.ParsePrice(50.0, "eip155:8453")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Asset != "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" {
			t.Errorf("expected default USDC, got '%s'", result.Asset)
		}
	})

	t.Run("should chain multiple parsers", func(t *testing.T) {
		server := NewUptoEvmServer()

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

	t.Run("should skip parser that returns error", func(t *testing.T) {
		server := NewUptoEvmServer()

		// First parser errors
		server.RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
			return nil, fmt.Errorf("parser error")
		})

		// Second parser succeeds
		server.RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
			return &t402.AssetAmount{
				Amount: "999",
				Asset:  "0xFallback",
			}, nil
		})

		result, err := server.ParsePrice(10.0, "eip155:8453")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Asset != "0xFallback" {
			t.Errorf("expected fallback asset, got '%s'", result.Asset)
		}
	})
}

func TestUptoEvmServer_EnhancePaymentRequirements(t *testing.T) {
	t.Run("should add token name and version to extra", func(t *testing.T) {
		server := NewUptoEvmServer()

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			Amount:  "1000000",
			PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
		}

		supportedKind := types.SupportedKind{
			Scheme:  "upto",
			Network: "eip155:8453",
		}

		result, err := server.EnhancePaymentRequirements(
			context.Background(), requirements, supportedKind, nil)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result.Extra == nil {
			t.Fatal("expected extra to be non-nil")
		}
		if result.Extra["name"] != "USD Coin" {
			t.Errorf("expected name 'USD Coin', got '%v'", result.Extra["name"])
		}
		if result.Extra["version"] != "2" {
			t.Errorf("expected version '2', got '%v'", result.Extra["version"])
		}
	})

	t.Run("should not override existing extra values", func(t *testing.T) {
		server := NewUptoEvmServer()

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			Amount:  "1000000",
			PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
			Extra: map[string]interface{}{
				"name":    "CustomName",
				"version": "99",
			},
		}

		supportedKind := types.SupportedKind{
			Scheme:  "upto",
			Network: "eip155:8453",
		}

		result, err := server.EnhancePaymentRequirements(
			context.Background(), requirements, supportedKind, nil)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result.Extra["name"] != "CustomName" {
			t.Errorf("expected name 'CustomName', got '%v'", result.Extra["name"])
		}
		if result.Extra["version"] != "99" {
			t.Errorf("expected version '99', got '%v'", result.Extra["version"])
		}
	})

	t.Run("should use default asset when not specified", func(t *testing.T) {
		server := NewUptoEvmServer()

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Amount:  "1000000",
			PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
		}

		supportedKind := types.SupportedKind{
			Scheme:  "upto",
			Network: "eip155:8453",
		}

		result, err := server.EnhancePaymentRequirements(
			context.Background(), requirements, supportedKind, nil)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result.Asset != "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" {
			t.Errorf("expected default USDC address, got '%s'", result.Asset)
		}
	})

	t.Run("should convert decimal amount to smallest unit", func(t *testing.T) {
		server := NewUptoEvmServer()

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			Amount:  "1.50",
			PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
		}

		supportedKind := types.SupportedKind{
			Scheme:  "upto",
			Network: "eip155:8453",
		}

		result, err := server.EnhancePaymentRequirements(
			context.Background(), requirements, supportedKind, nil)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result.Amount != "1500000" {
			t.Errorf("expected amount '1500000', got '%s'", result.Amount)
		}
	})

	t.Run("should copy extensions from supportedKind", func(t *testing.T) {
		server := NewUptoEvmServer()

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			Amount:  "1000000",
			PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
		}

		supportedKind := types.SupportedKind{
			Scheme:  "upto",
			Network: "eip155:8453",
			Extra: map[string]interface{}{
				"extension1": "value1",
				"extension2": "value2",
				"other":      "ignored",
			},
		}

		result, err := server.EnhancePaymentRequirements(
			context.Background(), requirements, supportedKind, []string{"extension1", "extension2"})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result.Extra["extension1"] != "value1" {
			t.Errorf("expected extension1 'value1', got '%v'", result.Extra["extension1"])
		}
		if result.Extra["extension2"] != "value2" {
			t.Errorf("expected extension2 'value2', got '%v'", result.Extra["extension2"])
		}
		if result.Extra["other"] != nil {
			t.Errorf("expected 'other' to not be copied, got '%v'", result.Extra["other"])
		}
	})

	t.Run("should copy routerAddress from supportedKind", func(t *testing.T) {
		server := NewUptoEvmServer()

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			Amount:  "1000000",
			PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
		}

		supportedKind := types.SupportedKind{
			Scheme:  "upto",
			Network: "eip155:8453",
			Extra: map[string]interface{}{
				"routerAddress": "0xRouterAddr",
			},
		}

		result, err := server.EnhancePaymentRequirements(
			context.Background(), requirements, supportedKind, nil)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result.Extra["routerAddress"] != "0xRouterAddr" {
			t.Errorf("expected routerAddress '0xRouterAddr', got '%v'", result.Extra["routerAddress"])
		}
	})

	t.Run("should fail for unsupported network", func(t *testing.T) {
		server := NewUptoEvmServer()

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "unsupported:999999",
			Amount:  "1000000",
			PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
		}

		_, err := server.EnhancePaymentRequirements(
			context.Background(), requirements, types.SupportedKind{}, nil)
		if err == nil {
			t.Fatal("expected error for unsupported network")
		}
	})
}

func TestUptoEvmServer_ValidatePaymentRequirements(t *testing.T) {
	t.Run("should pass for valid requirements", func(t *testing.T) {
		server := NewUptoEvmServer()

		requirements := t402.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			Amount:  "1000000",
			PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
		}

		err := server.ValidatePaymentRequirements(requirements)
		if err != nil {
			t.Errorf("unexpected error: %v", err)
		}
	})

	t.Run("should fail for invalid PayTo address", func(t *testing.T) {
		server := NewUptoEvmServer()

		requirements := t402.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Amount:  "1000000",
			PayTo:   "invalid-address",
		}

		err := server.ValidatePaymentRequirements(requirements)
		if err == nil {
			t.Fatal("expected error for invalid PayTo")
		}
	})

	t.Run("should fail for empty amount", func(t *testing.T) {
		server := NewUptoEvmServer()

		requirements := t402.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Amount:  "",
			PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
		}

		err := server.ValidatePaymentRequirements(requirements)
		if err == nil {
			t.Fatal("expected error for empty amount")
		}
	})

	t.Run("should fail for zero amount", func(t *testing.T) {
		server := NewUptoEvmServer()

		requirements := t402.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Amount:  "0",
			PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
		}

		err := server.ValidatePaymentRequirements(requirements)
		if err == nil {
			t.Fatal("expected error for zero amount")
		}
	})

	t.Run("should fail for negative amount", func(t *testing.T) {
		server := NewUptoEvmServer()

		requirements := t402.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Amount:  "-1000",
			PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
		}

		err := server.ValidatePaymentRequirements(requirements)
		if err == nil {
			t.Fatal("expected error for negative amount")
		}
	})
}

func TestUptoEvmServer_GetDisplayAmount(t *testing.T) {
	t.Run("should format amount for display", func(t *testing.T) {
		server := NewUptoEvmServer()

		display, err := server.GetDisplayAmount("1500000", "eip155:8453", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if display != "$1.5 (max)" {
			t.Errorf("expected '$1.5 (max)', got '%s'", display)
		}
	})

	t.Run("should handle whole number amounts", func(t *testing.T) {
		server := NewUptoEvmServer()

		display, err := server.GetDisplayAmount("10000000", "eip155:8453", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if display != "$10 (max)" {
			t.Errorf("expected '$10 (max)', got '%s'", display)
		}
	})
}
