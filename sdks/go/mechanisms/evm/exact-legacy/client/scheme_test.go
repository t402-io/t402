package client

import (
	"context"
	"math/big"
	"testing"

	"github.com/t402-io/t402/sdks/go/mechanisms/evm"
	"github.com/t402-io/t402/sdks/go/types"
)

type mockClientSigner struct {
	address string
}

func (m *mockClientSigner) Address() string {
	return m.address
}

func (m *mockClientSigner) SignTypedData(ctx context.Context, domain evm.TypedDataDomain, types map[string][]evm.TypedDataField, primaryType string, message map[string]interface{}) ([]byte, error) {
	return make([]byte, 65), nil
}

func TestNewExactLegacyEvmScheme(t *testing.T) {
	signer := &mockClientSigner{address: "0x1234567890abcdef1234567890abcdef12345678"}
	scheme := NewExactLegacyEvmScheme(signer)
	if scheme == nil {
		t.Fatal("expected non-nil scheme")
	}
}

func TestScheme(t *testing.T) {
	signer := &mockClientSigner{address: "0x1234"}
	scheme := NewExactLegacyEvmScheme(signer)
	if scheme.Scheme() != "exact-legacy" {
		t.Errorf("expected scheme 'exact-legacy', got '%s'", scheme.Scheme())
	}
}

func TestCreatePaymentPayload_InvalidNetwork(t *testing.T) {
	signer := &mockClientSigner{address: "0x1234567890abcdef1234567890abcdef12345678"}
	scheme := NewExactLegacyEvmScheme(signer)

	requirements := types.PaymentRequirements{
		Network: "invalid:network",
		PayTo:   "0xrecipient",
		Amount:  "1000000",
		Asset:   "0xtoken",
		Extra: map[string]interface{}{
			"spender": "0xfacilitator",
		},
	}

	_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Error("expected error for invalid network")
	}
}

func TestCreatePaymentPayload_MissingSpender(t *testing.T) {
	signer := &mockClientSigner{address: "0x1234567890abcdef1234567890abcdef12345678"}
	scheme := NewExactLegacyEvmScheme(signer)

	requirements := types.PaymentRequirements{
		Network: "eip155:8453",
		PayTo:   "0xrecipient",
		Amount:  "1000000",
		Asset:   "",
	}

	_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Error("expected error for missing spender")
	}
}

func TestCreatePaymentPayload_MissingSpenderNilExtra(t *testing.T) {
	signer := &mockClientSigner{address: "0x1234567890abcdef1234567890abcdef12345678"}
	scheme := NewExactLegacyEvmScheme(signer)

	requirements := types.PaymentRequirements{
		Network: "eip155:8453",
		PayTo:   "0x2222222222222222222222222222222222222222",
		Amount:  "1000000",
		Extra:   nil,
	}

	_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Error("expected error for nil extra (missing spender)")
	}
}

func TestCreatePaymentPayload_InvalidAmount(t *testing.T) {
	signer := &mockClientSigner{address: "0x1234567890abcdef1234567890abcdef12345678"}
	scheme := NewExactLegacyEvmScheme(signer)

	requirements := types.PaymentRequirements{
		Network: "eip155:8453",
		PayTo:   "0x2222222222222222222222222222222222222222",
		Amount:  "not_a_number",
		Extra: map[string]interface{}{
			"spender": "0x3333333333333333333333333333333333333333",
		},
	}

	_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Error("expected error for invalid amount")
	}
}

func TestCreatePaymentPayload_Success(t *testing.T) {
	signer := &mockClientSigner{address: "0x1234567890abcdef1234567890abcdef12345678"}
	scheme := NewExactLegacyEvmScheme(signer)

	requirements := types.PaymentRequirements{
		Network: "eip155:8453",
		PayTo:   "0x2222222222222222222222222222222222222222",
		Amount:  "1000000",
		Extra: map[string]interface{}{
			"spender": "0x3333333333333333333333333333333333333333",
		},
	}

	payload, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if payload.T402Version != 2 {
		t.Errorf("expected t402Version 2, got %d", payload.T402Version)
	}

	if payload.Payload == nil {
		t.Fatal("expected non-nil payload")
	}

	// Check signature exists
	sig, ok := payload.Payload["signature"].(string)
	if !ok || sig == "" {
		t.Error("expected non-empty signature in payload")
	}

	// Check authorization fields
	auth, ok := payload.Payload["authorization"].(map[string]interface{})
	if !ok {
		t.Fatal("expected authorization in payload")
	}

	if auth["from"] != signer.address {
		t.Errorf("expected from %s, got %s", signer.address, auth["from"])
	}
	if auth["to"] != requirements.PayTo {
		t.Errorf("expected to %s, got %s", requirements.PayTo, auth["to"])
	}
	if auth["spender"] != "0x3333333333333333333333333333333333333333" {
		t.Errorf("expected spender in authorization, got %v", auth["spender"])
	}

	value, ok := new(big.Int).SetString(auth["value"].(string), 10)
	if !ok || value.Cmp(big.NewInt(1000000)) != 0 {
		t.Errorf("expected value 1000000, got %v", auth["value"])
	}

	// Check nonce is present
	if auth["nonce"] == nil || auth["nonce"] == "" {
		t.Error("expected non-empty nonce")
	}

	// Check validity timestamps are present
	if auth["validAfter"] == nil || auth["validAfter"] == "" {
		t.Error("expected non-empty validAfter")
	}
	if auth["validBefore"] == nil || auth["validBefore"] == "" {
		t.Error("expected non-empty validBefore")
	}
}

func TestCreatePaymentPayload_CustomNameVersion(t *testing.T) {
	signer := &mockClientSigner{address: "0x1234567890abcdef1234567890abcdef12345678"}
	scheme := NewExactLegacyEvmScheme(signer)

	requirements := types.PaymentRequirements{
		Network: "eip155:8453",
		PayTo:   "0x2222222222222222222222222222222222222222",
		Amount:  "500000",
		Extra: map[string]interface{}{
			"spender": "0x3333333333333333333333333333333333333333",
			"name":    "CustomToken",
			"version": "2",
		},
	}

	payload, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if payload.T402Version != 2 {
		t.Errorf("expected t402Version 2, got %d", payload.T402Version)
	}

	// Verify the payload was created successfully (the custom name/version
	// are used in the EIP-712 domain but don't appear in the output payload)
	auth, ok := payload.Payload["authorization"].(map[string]interface{})
	if !ok {
		t.Fatal("expected authorization in payload")
	}

	value, ok := new(big.Int).SetString(auth["value"].(string), 10)
	if !ok || value.Cmp(big.NewInt(500000)) != 0 {
		t.Errorf("expected value 500000, got %v", auth["value"])
	}
}
