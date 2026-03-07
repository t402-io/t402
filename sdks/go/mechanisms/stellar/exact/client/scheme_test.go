package client

import (
	"context"
	"testing"

	"github.com/t402-io/t402/sdks/go/mechanisms/stellar"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockClientSigner implements ClientStellarSigner for testing
type mockClientSigner struct {
	address    string
	ledger     int64
	ledgerErr  error
	signedXDR  string
	signErr    error
}

func (m *mockClientSigner) Address() string {
	return m.address
}

func (m *mockClientSigner) GetCurrentLedger(ctx context.Context) (int64, error) {
	return m.ledger, m.ledgerErr
}

func (m *mockClientSigner) SignTransaction(ctx context.Context, params stellar.SignTransactionParams) (string, error) {
	if m.signErr != nil {
		return "", m.signErr
	}
	return m.signedXDR, nil
}

func newMockSigner() *mockClientSigner {
	return &mockClientSigner{
		address:   "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAEANBER24HLOOMVHPZ5GYK",
		ledger:    50000000,
		signedXDR: "AAAAAQAAAAA=",
	}
}

func TestScheme(t *testing.T) {
	signer := newMockSigner()
	scheme := NewExactStellarScheme(signer)

	if scheme.Scheme() != "exact" {
		t.Errorf("Scheme() = %v, want exact", scheme.Scheme())
	}
}

func TestNewExactStellarScheme(t *testing.T) {
	signer := newMockSigner()
	scheme := NewExactStellarScheme(signer)

	if scheme == nil {
		t.Fatal("NewExactStellarScheme() returned nil")
	}
}

func TestNewExactStellarScheme_WithConfig(t *testing.T) {
	signer := newMockSigner()
	config := &stellar.ClientConfig{
		HorizonURL:    "https://custom.horizon.org",
		SorobanRPCURL: "https://custom.soroban.org",
	}
	scheme := NewExactStellarScheme(signer, config)

	if scheme == nil {
		t.Fatal("NewExactStellarScheme() returned nil")
	}
}

func TestCreatePaymentPayload_Success(t *testing.T) {
	signer := newMockSigner()
	scheme := NewExactStellarScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:            stellar.SchemeExact,
		Network:           stellar.StellarPubnetCAIP2,
		Asset:             stellar.USDCPubnetAddress,
		Amount:            "10000000",
		PayTo:             "GBDEVU63Y6NTHJQQZIKVTC2LSQLMEAIFYRP2XAJDDQVWRDQJLEVLWM36",
		MaxTimeoutSeconds: 300,
	}

	payload, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err != nil {
		t.Fatalf("CreatePaymentPayload() error: %v", err)
	}

	if payload.T402Version != 2 {
		t.Errorf("T402Version = %v, want 2", payload.T402Version)
	}

	if payload.Payload == nil {
		t.Fatal("Payload is nil")
	}

	payloadMap := payload.Payload

	if payloadMap["signedXdr"] != "AAAAAQAAAAA=" {
		t.Errorf("signedXdr = %v, want AAAAAQAAAAA=", payloadMap["signedXdr"])
	}

	authMap, ok := payloadMap["authorization"].(map[string]interface{})
	if !ok {
		t.Fatalf("authorization is not map[string]interface{}, got %T", payloadMap["authorization"])
	}

	if authMap["from"] != signer.address {
		t.Errorf("authorization.from = %v, want %v", authMap["from"], signer.address)
	}
	if authMap["to"] != "GBDEVU63Y6NTHJQQZIKVTC2LSQLMEAIFYRP2XAJDDQVWRDQJLEVLWM36" {
		t.Errorf("authorization.to = %v, want GBDEVU63...", authMap["to"])
	}
	if authMap["amount"] != "10000000" {
		t.Errorf("authorization.amount = %v, want 10000000", authMap["amount"])
	}
}

func TestCreatePaymentPayload_UnsupportedNetwork(t *testing.T) {
	signer := newMockSigner()
	scheme := NewExactStellarScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  stellar.SchemeExact,
		Network: "eip155:1",
		Asset:   stellar.USDCPubnetAddress,
		Amount:  "10000000",
		PayTo:   "GBDEVU63Y6NTHJQQZIKVTC2LSQLMEAIFYRP2XAJDDQVWRDQJLEVLWM36",
	}

	_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for unsupported network, got nil")
	}
	if !containsStr(err.Error(), "unsupported network") {
		t.Errorf("Error = %v, want to contain 'unsupported network'", err.Error())
	}
}

func TestCreatePaymentPayload_MissingAsset(t *testing.T) {
	signer := newMockSigner()
	scheme := NewExactStellarScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  stellar.SchemeExact,
		Network: stellar.StellarPubnetCAIP2,
		Asset:   "",
		Amount:  "10000000",
		PayTo:   "GBDEVU63Y6NTHJQQZIKVTC2LSQLMEAIFYRP2XAJDDQVWRDQJLEVLWM36",
	}

	_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for missing asset, got nil")
	}
	if !containsStr(err.Error(), "asset") {
		t.Errorf("Error = %v, want to contain 'asset'", err.Error())
	}
}

func TestCreatePaymentPayload_MissingPayTo(t *testing.T) {
	signer := newMockSigner()
	scheme := NewExactStellarScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  stellar.SchemeExact,
		Network: stellar.StellarPubnetCAIP2,
		Asset:   stellar.USDCPubnetAddress,
		Amount:  "10000000",
		PayTo:   "",
	}

	_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for missing payTo, got nil")
	}
	if !containsStr(err.Error(), "payTo") {
		t.Errorf("Error = %v, want to contain 'payTo'", err.Error())
	}
}

func TestCreatePaymentPayload_MissingAmount(t *testing.T) {
	signer := newMockSigner()
	scheme := NewExactStellarScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  stellar.SchemeExact,
		Network: stellar.StellarPubnetCAIP2,
		Asset:   stellar.USDCPubnetAddress,
		Amount:  "",
		PayTo:   "GBDEVU63Y6NTHJQQZIKVTC2LSQLMEAIFYRP2XAJDDQVWRDQJLEVLWM36",
	}

	_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for missing amount, got nil")
	}
	if !containsStr(err.Error(), "amount") {
		t.Errorf("Error = %v, want to contain 'amount'", err.Error())
	}
}

func TestCreatePaymentPayload_InvalidAmount(t *testing.T) {
	signer := newMockSigner()
	scheme := NewExactStellarScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  stellar.SchemeExact,
		Network: stellar.StellarPubnetCAIP2,
		Asset:   stellar.USDCPubnetAddress,
		Amount:  "not-a-number",
		PayTo:   "GBDEVU63Y6NTHJQQZIKVTC2LSQLMEAIFYRP2XAJDDQVWRDQJLEVLWM36",
	}

	_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for invalid amount, got nil")
	}
	if !containsStr(err.Error(), "invalid amount") {
		t.Errorf("Error = %v, want to contain 'invalid amount'", err.Error())
	}
}

func TestCreatePaymentPayload_LedgerError(t *testing.T) {
	signer := newMockSigner()
	signer.ledgerErr = errMock("ledger error")
	scheme := NewExactStellarScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  stellar.SchemeExact,
		Network: stellar.StellarPubnetCAIP2,
		Asset:   stellar.USDCPubnetAddress,
		Amount:  "10000000",
		PayTo:   "GBDEVU63Y6NTHJQQZIKVTC2LSQLMEAIFYRP2XAJDDQVWRDQJLEVLWM36",
	}

	_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for ledger failure, got nil")
	}
	if !containsStr(err.Error(), "failed to get current ledger") {
		t.Errorf("Error = %v, want to contain 'failed to get current ledger'", err.Error())
	}
}

func TestCreatePaymentPayload_SignError(t *testing.T) {
	signer := newMockSigner()
	signer.signErr = errMock("sign error")
	scheme := NewExactStellarScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  stellar.SchemeExact,
		Network: stellar.StellarPubnetCAIP2,
		Asset:   stellar.USDCPubnetAddress,
		Amount:  "10000000",
		PayTo:   "GBDEVU63Y6NTHJQQZIKVTC2LSQLMEAIFYRP2XAJDDQVWRDQJLEVLWM36",
	}

	_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for sign failure, got nil")
	}
	if !containsStr(err.Error(), "failed to sign transaction") {
		t.Errorf("Error = %v, want to contain 'failed to sign transaction'", err.Error())
	}
}

func TestCreatePaymentPayload_DefaultTimeout(t *testing.T) {
	signer := newMockSigner()
	scheme := NewExactStellarScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:            stellar.SchemeExact,
		Network:           stellar.StellarPubnetCAIP2,
		Asset:             stellar.USDCPubnetAddress,
		Amount:            "10000000",
		PayTo:             "GBDEVU63Y6NTHJQQZIKVTC2LSQLMEAIFYRP2XAJDDQVWRDQJLEVLWM36",
		MaxTimeoutSeconds: 0, // No timeout specified - should use default
	}

	payload, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err != nil {
		t.Fatalf("CreatePaymentPayload() error: %v", err)
	}

	if payload.T402Version != 2 {
		t.Errorf("T402Version = %v, want 2", payload.T402Version)
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

// errMock is a simple error type for testing
type errMock string

func (e errMock) Error() string {
	return string(e)
}
