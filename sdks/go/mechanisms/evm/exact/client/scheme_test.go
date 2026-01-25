package client

import (
	"context"
	"testing"

	"github.com/t402-io/t402/sdks/go/mechanisms/evm"
	"github.com/t402-io/t402/sdks/go/types"
)

// MockClientEvmSigner implements evm.ClientEvmSigner for testing
type MockClientEvmSigner struct {
	address       string
	signedData    []byte
	signError     error
	signCallCount int
}

func (m *MockClientEvmSigner) Address() string {
	return m.address
}

func (m *MockClientEvmSigner) SignTypedData(
	ctx context.Context,
	domain evm.TypedDataDomain,
	types map[string][]evm.TypedDataField,
	primaryType string,
	message map[string]interface{},
) ([]byte, error) {
	m.signCallCount++
	if m.signError != nil {
		return nil, m.signError
	}
	if m.signedData != nil {
		return m.signedData, nil
	}
	// Return a valid 65-byte signature
	return make([]byte, 65), nil
}

func TestNewExactEvmScheme(t *testing.T) {
	t.Run("creates scheme with valid signer", func(t *testing.T) {
		signer := &MockClientEvmSigner{address: "0x1234567890123456789012345678901234567890"}
		scheme := NewExactEvmScheme(signer)

		if scheme == nil {
			t.Fatal("NewExactEvmScheme returned nil")
		}
		if scheme.signer != signer {
			t.Error("Signer not set correctly")
		}
	})

	t.Run("creates scheme with nil signer", func(t *testing.T) {
		scheme := NewExactEvmScheme(nil)
		if scheme == nil {
			t.Fatal("NewExactEvmScheme returned nil")
		}
	})
}

func TestScheme(t *testing.T) {
	signer := &MockClientEvmSigner{address: "0x1234567890123456789012345678901234567890"}
	scheme := NewExactEvmScheme(signer)

	if scheme.Scheme() != evm.SchemeExact {
		t.Errorf("Scheme() = %s, want %s", scheme.Scheme(), evm.SchemeExact)
	}

	if scheme.Scheme() != "exact" {
		t.Errorf("Scheme() = %s, want exact", scheme.Scheme())
	}
}

func TestCreatePaymentPayload(t *testing.T) {
	ctx := context.Background()

	t.Run("valid payment payload for Base mainnet", func(t *testing.T) {
		signer := &MockClientEvmSigner{
			address:    "0x1234567890123456789012345678901234567890",
			signedData: make([]byte, 65),
		}
		scheme := NewExactEvmScheme(signer)

		requirements := types.PaymentRequirements{
			Network: "eip155:8453",
			Asset:   "USDC",
			Amount:  "1000000", // 1 USDC
			PayTo:   "0xabcdef0123456789012345678901234567890abc",
		}

		payload, err := scheme.CreatePaymentPayload(ctx, requirements)
		if err != nil {
			t.Fatalf("CreatePaymentPayload failed: %v", err)
		}

		if payload.T402Version != 2 {
			t.Errorf("T402Version = %d, want 2", payload.T402Version)
		}

		if payload.Payload == nil {
			t.Fatal("Payload is nil")
		}

		// Check authorization fields exist
		auth, ok := payload.Payload["authorization"].(map[string]interface{})
		if !ok {
			t.Fatal("authorization field not found or wrong type")
		}

		if auth["from"] != signer.address {
			t.Errorf("from = %v, want %s", auth["from"], signer.address)
		}

		if auth["to"] != requirements.PayTo {
			t.Errorf("to = %v, want %s", auth["to"], requirements.PayTo)
		}

		if auth["value"] != requirements.Amount {
			t.Errorf("value = %v, want %s", auth["value"], requirements.Amount)
		}

		// Check signature exists
		sig, ok := payload.Payload["signature"].(string)
		if !ok || sig == "" {
			t.Error("signature field not found or empty")
		}

		// Verify signer was called
		if signer.signCallCount != 1 {
			t.Errorf("SignTypedData called %d times, want 1", signer.signCallCount)
		}
	})

	t.Run("valid payment payload for Ethereum mainnet", func(t *testing.T) {
		signer := &MockClientEvmSigner{
			address:    "0x1234567890123456789012345678901234567890",
			signedData: make([]byte, 65),
		}
		scheme := NewExactEvmScheme(signer)

		requirements := types.PaymentRequirements{
			Network: "eip155:1",
			Asset:   "USDC",
			Amount:  "5000000", // 5 USDC
			PayTo:   "0xabcdef0123456789012345678901234567890abc",
		}

		payload, err := scheme.CreatePaymentPayload(ctx, requirements)
		if err != nil {
			t.Fatalf("CreatePaymentPayload failed: %v", err)
		}

		if payload.T402Version != 2 {
			t.Errorf("T402Version = %d, want 2", payload.T402Version)
		}
	})

	t.Run("valid payment with base alias network", func(t *testing.T) {
		signer := &MockClientEvmSigner{
			address:    "0x1234567890123456789012345678901234567890",
			signedData: make([]byte, 65),
		}
		scheme := NewExactEvmScheme(signer)

		requirements := types.PaymentRequirements{
			Network: "base",
			Asset:   "USDC",
			Amount:  "1000000",
			PayTo:   "0xabcdef0123456789012345678901234567890abc",
		}

		payload, err := scheme.CreatePaymentPayload(ctx, requirements)
		if err != nil {
			t.Fatalf("CreatePaymentPayload failed: %v", err)
		}

		if payload.T402Version != 2 {
			t.Errorf("T402Version = %d, want 2", payload.T402Version)
		}
	})

	t.Run("valid payment payload for Base Sepolia testnet", func(t *testing.T) {
		signer := &MockClientEvmSigner{
			address:    "0x1234567890123456789012345678901234567890",
			signedData: make([]byte, 65),
		}
		scheme := NewExactEvmScheme(signer)

		requirements := types.PaymentRequirements{
			Network: "eip155:84532",
			Asset:   "USDC",
			Amount:  "1000000",
			PayTo:   "0xabcdef0123456789012345678901234567890abc",
		}

		payload, err := scheme.CreatePaymentPayload(ctx, requirements)
		if err != nil {
			t.Fatalf("CreatePaymentPayload failed: %v", err)
		}

		if payload.T402Version != 2 {
			t.Errorf("T402Version = %d, want 2", payload.T402Version)
		}
	})

	t.Run("unsupported network", func(t *testing.T) {
		signer := &MockClientEvmSigner{address: "0x1234567890123456789012345678901234567890"}
		scheme := NewExactEvmScheme(signer)

		requirements := types.PaymentRequirements{
			Network: "eip155:99999",
			Asset:   "USDC",
			Amount:  "1000000",
			PayTo:   "0xabcdef0123456789012345678901234567890abc",
		}

		_, err := scheme.CreatePaymentPayload(ctx, requirements)
		if err == nil {
			t.Error("CreatePaymentPayload should fail for unsupported network")
		}
	})

	t.Run("invalid amount format", func(t *testing.T) {
		signer := &MockClientEvmSigner{
			address:    "0x1234567890123456789012345678901234567890",
			signedData: make([]byte, 65),
		}
		scheme := NewExactEvmScheme(signer)

		requirements := types.PaymentRequirements{
			Network: "eip155:8453",
			Asset:   "USDC",
			Amount:  "not-a-number",
			PayTo:   "0xabcdef0123456789012345678901234567890abc",
		}

		_, err := scheme.CreatePaymentPayload(ctx, requirements)
		if err == nil {
			t.Error("CreatePaymentPayload should fail for invalid amount")
		}
	})

	t.Run("signing error", func(t *testing.T) {
		signer := &MockClientEvmSigner{
			address:   "0x1234567890123456789012345678901234567890",
			signError: context.DeadlineExceeded,
		}
		scheme := NewExactEvmScheme(signer)

		requirements := types.PaymentRequirements{
			Network: "eip155:8453",
			Asset:   "USDC",
			Amount:  "1000000",
			PayTo:   "0xabcdef0123456789012345678901234567890abc",
		}

		_, err := scheme.CreatePaymentPayload(ctx, requirements)
		if err == nil {
			t.Error("CreatePaymentPayload should fail when signing fails")
		}
	})

	t.Run("with custom token name and version in Extra", func(t *testing.T) {
		signer := &MockClientEvmSigner{
			address:    "0x1234567890123456789012345678901234567890",
			signedData: make([]byte, 65),
		}
		scheme := NewExactEvmScheme(signer)

		requirements := types.PaymentRequirements{
			Network: "eip155:8453",
			Asset:   "USDC",
			Amount:  "1000000",
			PayTo:   "0xabcdef0123456789012345678901234567890abc",
			Extra: map[string]interface{}{
				"name":    "Custom Token",
				"version": "3",
			},
		}

		payload, err := scheme.CreatePaymentPayload(ctx, requirements)
		if err != nil {
			t.Fatalf("CreatePaymentPayload failed: %v", err)
		}

		if payload.T402Version != 2 {
			t.Errorf("T402Version = %d, want 2", payload.T402Version)
		}
	})

	t.Run("with asset address instead of symbol", func(t *testing.T) {
		signer := &MockClientEvmSigner{
			address:    "0x1234567890123456789012345678901234567890",
			signedData: make([]byte, 65),
		}
		scheme := NewExactEvmScheme(signer)

		requirements := types.PaymentRequirements{
			Network: "eip155:8453",
			Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
			Amount:  "1000000",
			PayTo:   "0xabcdef0123456789012345678901234567890abc",
		}

		payload, err := scheme.CreatePaymentPayload(ctx, requirements)
		if err != nil {
			t.Fatalf("CreatePaymentPayload failed: %v", err)
		}

		if payload.T402Version != 2 {
			t.Errorf("T402Version = %d, want 2", payload.T402Version)
		}
	})

	t.Run("zero amount", func(t *testing.T) {
		signer := &MockClientEvmSigner{
			address:    "0x1234567890123456789012345678901234567890",
			signedData: make([]byte, 65),
		}
		scheme := NewExactEvmScheme(signer)

		requirements := types.PaymentRequirements{
			Network: "eip155:8453",
			Asset:   "USDC",
			Amount:  "0",
			PayTo:   "0xabcdef0123456789012345678901234567890abc",
		}

		payload, err := scheme.CreatePaymentPayload(ctx, requirements)
		if err != nil {
			t.Fatalf("CreatePaymentPayload failed: %v", err)
		}

		auth := payload.Payload["authorization"].(map[string]interface{})
		if auth["value"] != "0" {
			t.Errorf("value = %v, want 0", auth["value"])
		}
	})

	t.Run("large amount", func(t *testing.T) {
		signer := &MockClientEvmSigner{
			address:    "0x1234567890123456789012345678901234567890",
			signedData: make([]byte, 65),
		}
		scheme := NewExactEvmScheme(signer)

		requirements := types.PaymentRequirements{
			Network: "eip155:8453",
			Asset:   "USDC",
			Amount:  "1000000000000000000", // 1 trillion USDC (in smallest units)
			PayTo:   "0xabcdef0123456789012345678901234567890abc",
		}

		payload, err := scheme.CreatePaymentPayload(ctx, requirements)
		if err != nil {
			t.Fatalf("CreatePaymentPayload failed: %v", err)
		}

		auth := payload.Payload["authorization"].(map[string]interface{})
		if auth["value"] != "1000000000000000000" {
			t.Errorf("value = %v, want 1000000000000000000", auth["value"])
		}
	})
}

func TestAuthorizationFields(t *testing.T) {
	ctx := context.Background()
	signer := &MockClientEvmSigner{
		address:    "0x1234567890123456789012345678901234567890",
		signedData: make([]byte, 65),
	}
	scheme := NewExactEvmScheme(signer)

	requirements := types.PaymentRequirements{
		Network: "eip155:8453",
		Asset:   "USDC",
		Amount:  "1000000",
		PayTo:   "0xabcdef0123456789012345678901234567890abc",
	}

	payload, err := scheme.CreatePaymentPayload(ctx, requirements)
	if err != nil {
		t.Fatalf("CreatePaymentPayload failed: %v", err)
	}

	auth := payload.Payload["authorization"].(map[string]interface{})

	// Check validAfter and validBefore are set
	validAfter, ok := auth["validAfter"].(string)
	if !ok || validAfter == "" {
		t.Error("validAfter not set")
	}

	validBefore, ok := auth["validBefore"].(string)
	if !ok || validBefore == "" {
		t.Error("validBefore not set")
	}

	// Check nonce is set (32 bytes hex string with 0x prefix)
	nonce, ok := auth["nonce"].(string)
	if !ok || nonce == "" {
		t.Error("nonce not set")
	}
	if len(nonce) != 66 { // "0x" + 64 hex chars
		t.Errorf("nonce length = %d, want 66", len(nonce))
	}
}
