package server

import (
	"context"
	"testing"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/btc"
	"github.com/t402-io/t402/sdks/go/types"
)

func TestExactBtcScheme_Scheme(t *testing.T) {
	scheme := NewExactBtcScheme(ExactBtcSchemeConfig{PayTo: "bc1test"})
	if scheme.Scheme() != "exact" {
		t.Errorf("Scheme() = %v, want exact", scheme.Scheme())
	}
}

func TestExactBtcScheme_ParsePrice_AssetAmount(t *testing.T) {
	scheme := NewExactBtcScheme(ExactBtcSchemeConfig{})
	result, err := scheme.ParsePrice(
		map[string]interface{}{
			"amount": "100000",
			"asset":  "BTC",
		},
		t402.Network(btc.BtcMainnetCAIP2),
	)

	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if result.Amount != "100000" {
		t.Errorf("Amount = %v, want 100000", result.Amount)
	}
	if result.Asset != "BTC" {
		t.Errorf("Asset = %v, want BTC", result.Asset)
	}
}

func TestExactBtcScheme_ParsePrice_NumberAsBTC(t *testing.T) {
	scheme := NewExactBtcScheme(ExactBtcSchemeConfig{})
	result, err := scheme.ParsePrice(float64(0.001), t402.Network(btc.BtcMainnetCAIP2))

	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if result.Amount != "100000" {
		t.Errorf("Amount = %v, want 100000 (0.001 BTC in sats)", result.Amount)
	}
	if result.Asset != "BTC" {
		t.Errorf("Asset = %v, want BTC", result.Asset)
	}
}

func TestExactBtcScheme_ParsePrice_StringPrice(t *testing.T) {
	scheme := NewExactBtcScheme(ExactBtcSchemeConfig{})
	result, err := scheme.ParsePrice("0.5", t402.Network(btc.BtcMainnetCAIP2))

	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if result.Amount != "50000000" {
		t.Errorf("Amount = %v, want 50000000 (0.5 BTC in sats)", result.Amount)
	}
}

func TestExactBtcScheme_ParsePrice_CustomParser(t *testing.T) {
	scheme := NewExactBtcScheme(ExactBtcSchemeConfig{})
	scheme.RegisterMoneyParser(func(amount float64, network t402.Network) (*t402.AssetAmount, error) {
		return &t402.AssetAmount{
			Amount: "42",
			Asset:  "BTC",
		}, nil
	})

	result, err := scheme.ParsePrice(float64(1.0), t402.Network(btc.BtcMainnetCAIP2))
	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if result.Amount != "42" {
		t.Errorf("Amount = %v, want 42 (from custom parser)", result.Amount)
	}
}

func TestExactBtcScheme_ParsePrice_InvalidFormat(t *testing.T) {
	scheme := NewExactBtcScheme(ExactBtcSchemeConfig{})
	_, err := scheme.ParsePrice(struct{}{}, t402.Network(btc.BtcMainnetCAIP2))
	if err == nil {
		t.Fatal("expected error for invalid price format")
	}
}

func TestExactBtcScheme_EnhancePaymentRequirements(t *testing.T) {
	scheme := NewExactBtcScheme(ExactBtcSchemeConfig{PayTo: "bc1qdefaultaddress"})
	reqs, err := scheme.EnhancePaymentRequirements(
		context.Background(),
		types.PaymentRequirements{
			Network: btc.BtcMainnetCAIP2,
			Amount:  "100000",
		},
		types.SupportedKind{
			T402Version: 2,
			Scheme:      btc.SchemeExact,
			Network:     btc.BtcMainnetCAIP2,
		},
		nil,
	)

	if err != nil {
		t.Fatalf("EnhancePaymentRequirements() error: %v", err)
	}
	if reqs.PayTo != "bc1qdefaultaddress" {
		t.Errorf("PayTo = %v, want bc1qdefaultaddress", reqs.PayTo)
	}
	if reqs.Asset != "BTC" {
		t.Errorf("Asset = %v, want BTC", reqs.Asset)
	}
}

func TestExactBtcScheme_EnhancePaymentRequirements_PreservesExisting(t *testing.T) {
	scheme := NewExactBtcScheme(ExactBtcSchemeConfig{PayTo: "bc1qdefault"})
	reqs, err := scheme.EnhancePaymentRequirements(
		context.Background(),
		types.PaymentRequirements{
			Network: btc.BtcMainnetCAIP2,
			Amount:  "100000",
			PayTo:   "bc1qcustom",
			Asset:   "WBTC",
		},
		types.SupportedKind{},
		nil,
	)

	if err != nil {
		t.Fatalf("EnhancePaymentRequirements() error: %v", err)
	}
	// Should preserve existing values
	if reqs.PayTo != "bc1qcustom" {
		t.Errorf("PayTo = %v, want bc1qcustom (preserved)", reqs.PayTo)
	}
	if reqs.Asset != "WBTC" {
		t.Errorf("Asset = %v, want WBTC (preserved)", reqs.Asset)
	}
}

func TestLightningScheme_Scheme(t *testing.T) {
	scheme := NewLightningScheme(LightningSchemeConfig{})
	if scheme.Scheme() != "exact" {
		t.Errorf("Scheme() = %v, want exact", scheme.Scheme())
	}
}

func TestLightningScheme_ParsePrice_Number(t *testing.T) {
	scheme := NewLightningScheme(LightningSchemeConfig{})
	result, err := scheme.ParsePrice(float64(0.001), t402.Network(btc.LightningMainnetCAIP2))

	if err != nil {
		t.Fatalf("ParsePrice() error: %v", err)
	}
	if result.Amount != "100000" {
		t.Errorf("Amount = %v, want 100000", result.Amount)
	}
}

func TestLightningScheme_EnhancePaymentRequirements_GeneratesInvoice(t *testing.T) {
	scheme := NewLightningScheme(LightningSchemeConfig{
		GenerateInvoice: func(amountSats, description string, expiry int) (string, string, error) {
			return "lnbc100n1p...", "abc123hash", nil
		},
	})

	reqs, err := scheme.EnhancePaymentRequirements(
		context.Background(),
		types.PaymentRequirements{
			Network:           btc.LightningMainnetCAIP2,
			Amount:            "10000",
			MaxTimeoutSeconds: 3600,
		},
		types.SupportedKind{
			T402Version: 2,
			Scheme:      btc.SchemeExact,
			Network:     btc.LightningMainnetCAIP2,
		},
		nil,
	)

	if err != nil {
		t.Fatalf("EnhancePaymentRequirements() error: %v", err)
	}
	if reqs.Asset != "BTC" {
		t.Errorf("Asset = %v, want BTC", reqs.Asset)
	}
	if reqs.Extra["bolt11Invoice"] != "lnbc100n1p..." {
		t.Errorf("bolt11Invoice = %v, want lnbc100n1p...", reqs.Extra["bolt11Invoice"])
	}
	if reqs.Extra["paymentHash"] != "abc123hash" {
		t.Errorf("paymentHash = %v, want abc123hash", reqs.Extra["paymentHash"])
	}
}

func TestLightningScheme_EnhancePaymentRequirements_NoGenerator(t *testing.T) {
	scheme := NewLightningScheme(LightningSchemeConfig{})

	reqs, err := scheme.EnhancePaymentRequirements(
		context.Background(),
		types.PaymentRequirements{
			Network: btc.LightningMainnetCAIP2,
			Amount:  "10000",
		},
		types.SupportedKind{},
		nil,
	)

	if err != nil {
		t.Fatalf("EnhancePaymentRequirements() error: %v", err)
	}
	if reqs.Asset != "BTC" {
		t.Errorf("Asset = %v, want BTC", reqs.Asset)
	}
	// No bolt11Invoice should be set without generator
	if _, ok := reqs.Extra["bolt11Invoice"]; ok {
		t.Error("bolt11Invoice should not be set without generator")
	}
}
