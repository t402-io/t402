package client

import (
	"context"
	"fmt"
	"testing"

	"github.com/t402-io/t402/sdks/go/mechanisms/cosmos"
	"github.com/t402-io/t402/sdks/go/types"
)

// MockCosmosSigner implements CosmosSigner for testing
type MockCosmosSigner struct {
	address   string
	txHash    string
	sendError error
}

func NewMockCosmosSigner(address, txHash string) *MockCosmosSigner {
	return &MockCosmosSigner{
		address: address,
		txHash:  txHash,
	}
}

func (m *MockCosmosSigner) GetAddress() string {
	return m.address
}

func (m *MockCosmosSigner) SendTokens(ctx context.Context, network, to, amount, denom string) (string, error) {
	if m.sendError != nil {
		return "", m.sendError
	}
	return m.txHash, nil
}

func (m *MockCosmosSigner) SetSendError(err error) {
	m.sendError = err
}

func TestNewExactDirectCosmosScheme(t *testing.T) {
	signer := NewMockCosmosSigner("noble1sender", "tx123")
	scheme := NewExactDirectCosmosScheme(signer)

	if scheme == nil {
		t.Fatal("expected non-nil scheme")
	}
	if scheme.signer != signer {
		t.Error("signer not set correctly")
	}
}

func TestExactDirectCosmosScheme_Scheme(t *testing.T) {
	signer := NewMockCosmosSigner("noble1sender", "tx123")
	scheme := NewExactDirectCosmosScheme(signer)

	if got := scheme.Scheme(); got != cosmos.SchemeExactDirect {
		t.Errorf("Scheme() = %v, want %v", got, cosmos.SchemeExactDirect)
	}
}

func TestExactDirectCosmosScheme_CreatePaymentPayload_Success(t *testing.T) {
	signer := NewMockCosmosSigner("noble1sender123456789012345678901234", "txhash_abc123")
	scheme := NewExactDirectCosmosScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  cosmos.SchemeExactDirect,
		Network: cosmos.NobleMainnetCAIP2,
		Asset:   "USDC",
		Amount:  "1000000",
		PayTo:   "noble1receiver123456789012345678901234",
	}

	payload, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if payload.T402Version != 2 {
		t.Errorf("T402Version = %d, want 2", payload.T402Version)
	}
	if payload.Accepted.Scheme != cosmos.SchemeExactDirect {
		t.Errorf("Accepted.Scheme = %q, want %q", payload.Accepted.Scheme, cosmos.SchemeExactDirect)
	}
	if payload.Accepted.Network != cosmos.NobleMainnetCAIP2 {
		t.Errorf("Accepted.Network = %q, want %q", payload.Accepted.Network, cosmos.NobleMainnetCAIP2)
	}
	if payload.Accepted.Amount != "1000000" {
		t.Errorf("Accepted.Amount = %q, want %q", payload.Accepted.Amount, "1000000")
	}
	if payload.Payload == nil {
		t.Fatal("Payload map is nil")
	}
	if txHash, ok := payload.Payload["txHash"].(string); !ok || txHash != "txhash_abc123" {
		t.Errorf("Payload[txHash] = %v, want %q", payload.Payload["txHash"], "txhash_abc123")
	}
}

func TestExactDirectCosmosScheme_CreatePaymentPayload_UnsupportedNetwork(t *testing.T) {
	signer := NewMockCosmosSigner("noble1sender", "tx123")
	scheme := NewExactDirectCosmosScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  cosmos.SchemeExactDirect,
		Network: "cosmos:unknown",
		Amount:  "1000000",
		PayTo:   "noble1receiver123456789012345678901234",
	}

	_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("expected error for unsupported network, got nil")
	}
	if got := err.Error(); !contains(got, "unsupported network") {
		t.Errorf("error = %q, want it to contain %q", got, "unsupported network")
	}
}

func TestExactDirectCosmosScheme_CreatePaymentPayload_InvalidRecipient(t *testing.T) {
	signer := NewMockCosmosSigner("noble1sender", "tx123")
	scheme := NewExactDirectCosmosScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  cosmos.SchemeExactDirect,
		Network: cosmos.NobleMainnetCAIP2,
		Amount:  "1000000",
		PayTo:   "cosmos1wrong",
	}

	_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("expected error for invalid recipient address, got nil")
	}
	if got := err.Error(); !contains(got, "invalid recipient address") {
		t.Errorf("error = %q, want it to contain %q", got, "invalid recipient address")
	}
}

func TestExactDirectCosmosScheme_CreatePaymentPayload_SendError(t *testing.T) {
	signer := NewMockCosmosSigner("noble1sender", "")
	signer.SetSendError(fmt.Errorf("network timeout"))
	scheme := NewExactDirectCosmosScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  cosmos.SchemeExactDirect,
		Network: cosmos.NobleMainnetCAIP2,
		Amount:  "1000000",
		PayTo:   "noble1receiver123456789012345678901234",
	}

	_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("expected error when signer fails, got nil")
	}
	if got := err.Error(); !contains(got, "failed to send tokens") {
		t.Errorf("error = %q, want it to contain %q", got, "failed to send tokens")
	}
}

func TestExactDirectCosmosScheme_CreatePaymentPayload_DefaultDenom(t *testing.T) {
	signer := NewMockCosmosSigner("noble1sender123456789012345678901234", "txhash_default")
	scheme := NewExactDirectCosmosScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  cosmos.SchemeExactDirect,
		Network: cosmos.NobleMainnetCAIP2,
		Asset:   "",
		Amount:  "500000",
		PayTo:   "noble1receiver123456789012345678901234",
	}

	payload, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if payload.Accepted.Asset != cosmos.USDCDenom {
		t.Errorf("Accepted.Asset = %q, want default denom %q", payload.Accepted.Asset, cosmos.USDCDenom)
	}
	if denom, ok := payload.Payload["denom"].(string); !ok || denom != cosmos.USDCDenom {
		t.Errorf("Payload[denom] = %v, want %q", payload.Payload["denom"], cosmos.USDCDenom)
	}
}

func TestExactDirectCosmosScheme_CreatePaymentPayload_CustomAsset(t *testing.T) {
	signer := NewMockCosmosSigner("noble1sender123456789012345678901234", "txhash_custom")
	scheme := NewExactDirectCosmosScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  cosmos.SchemeExactDirect,
		Network: cosmos.NobleMainnetCAIP2,
		Asset:   "uusdc",
		Amount:  "750000",
		PayTo:   "noble1receiver123456789012345678901234",
	}

	payload, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// "uusdc" matches the USDC token denom via GetTokenInfo lookup, so it should resolve
	if payload.Accepted.Asset != cosmos.USDCDenom {
		t.Errorf("Accepted.Asset = %q, want %q", payload.Accepted.Asset, cosmos.USDCDenom)
	}
}

func TestExactDirectCosmosScheme_CreatePaymentPayload_AssetSymbol(t *testing.T) {
	signer := NewMockCosmosSigner("noble1sender123456789012345678901234", "txhash_symbol")
	scheme := NewExactDirectCosmosScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  cosmos.SchemeExactDirect,
		Network: cosmos.NobleMainnetCAIP2,
		Asset:   "USDC",
		Amount:  "2000000",
		PayTo:   "noble1receiver123456789012345678901234",
	}

	payload, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// "USDC" should resolve via GetTokenInfo to "uusdc"
	if payload.Accepted.Asset != cosmos.USDCDenom {
		t.Errorf("Accepted.Asset = %q, want %q (resolved from USDC symbol)", payload.Accepted.Asset, cosmos.USDCDenom)
	}
}

func TestExactDirectCosmosScheme_CreatePaymentPayload_PayloadFields(t *testing.T) {
	senderAddr := "noble1sender123456789012345678901234"
	receiverAddr := "noble1receiver123456789012345678901234"
	expectedTxHash := "txhash_fields_test"
	expectedAmount := "3000000"

	signer := NewMockCosmosSigner(senderAddr, expectedTxHash)
	scheme := NewExactDirectCosmosScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  cosmos.SchemeExactDirect,
		Network: cosmos.NobleMainnetCAIP2,
		Asset:   "USDC",
		Amount:  expectedAmount,
		PayTo:   receiverAddr,
	}

	payload, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify all expected keys exist and have correct values
	expectedFields := map[string]string{
		"txHash": expectedTxHash,
		"from":   senderAddr,
		"to":     receiverAddr,
		"amount": expectedAmount,
		"denom":  cosmos.USDCDenom,
	}

	for key, want := range expectedFields {
		got, ok := payload.Payload[key].(string)
		if !ok {
			t.Errorf("Payload[%q] missing or not a string, got %v", key, payload.Payload[key])
			continue
		}
		if got != want {
			t.Errorf("Payload[%q] = %q, want %q", key, got, want)
		}
	}
}

// contains checks if s contains substr (avoids importing strings package)
func contains(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
