package client

import (
	"context"
	"testing"

	"github.com/t402-io/t402/sdks/go/mechanisms/ton"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockClientSigner implements ClientTonSigner for testing
type mockClientSigner struct {
	address  string
	seqno    int64
	seqnoErr error
	signBoc  string
	signErr  error
}

func (m *mockClientSigner) Address() string {
	return m.address
}

func (m *mockClientSigner) GetSeqno(ctx context.Context) (int64, error) {
	return m.seqno, m.seqnoErr
}

func (m *mockClientSigner) SignMessage(ctx context.Context, params ton.SignMessageParams) (string, error) {
	if m.signErr != nil {
		return "", m.signErr
	}
	return m.signBoc, nil
}

func newMockSigner() *mockClientSigner {
	return &mockClientSigner{
		address: "EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2",
		seqno:   5,
		signBoc: "te6cckEBAQEADgAAGIAAACAAAAAAAA+PiIgvxA==",
	}
}

func TestScheme(t *testing.T) {
	signer := newMockSigner()
	scheme := NewExactTonScheme(signer)

	if scheme.Scheme() != "exact" {
		t.Errorf("Scheme() = %v, want exact", scheme.Scheme())
	}
}

func TestNewExactTonScheme(t *testing.T) {
	signer := newMockSigner()
	scheme := NewExactTonScheme(signer)

	if scheme == nil {
		t.Fatal("NewExactTonScheme() returned nil")
	}
}

func TestNewExactTonScheme_WithConfig(t *testing.T) {
	signer := newMockSigner()
	config := &ton.ClientConfig{
		Endpoint: "https://custom.endpoint.com",
	}
	scheme := NewExactTonScheme(signer, config)

	if scheme == nil {
		t.Fatal("NewExactTonScheme() returned nil")
	}
}

func TestCreatePaymentPayload_Success(t *testing.T) {
	signer := newMockSigner()
	scheme := NewExactTonScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:            ton.SchemeExact,
		Network:           ton.TonMainnetCAIP2,
		Asset:             ton.USDTMainnetAddress,
		Amount:            "1000000",
		PayTo:             "EQC88f67e776f16dcfbf42e6bdda1b82604448899b",
		MaxTimeoutSeconds: 300,
	}

	payload, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err != nil {
		t.Fatalf("CreatePaymentPayload() error: %v", err)
	}

	if payload.T402Version != 2 {
		t.Errorf("T402Version = %v, want 2", payload.T402Version)
	}

	// Verify payload map contains required fields
	if payload.Payload == nil {
		t.Fatal("Payload is nil")
	}

	payloadMap := payload.Payload

	if payloadMap["signedBoc"] != "te6cckEBAQEADgAAGIAAACAAAAAAAA+PiIgvxA==" {
		t.Errorf("signedBoc = %v, want te6cckEBAQEADgAAGIAAACAAAAAAAA+PiIgvxA==", payloadMap["signedBoc"])
	}

	authMap, ok := payloadMap["authorization"].(map[string]interface{})
	if !ok {
		t.Fatalf("authorization is not map[string]interface{}, got %T", payloadMap["authorization"])
	}

	if authMap["from"] != signer.address {
		t.Errorf("authorization.from = %v, want %v", authMap["from"], signer.address)
	}
	if authMap["to"] != "EQC88f67e776f16dcfbf42e6bdda1b82604448899b" {
		t.Errorf("authorization.to = %v, want EQC88f67e776f16dcfbf42e6bdda1b82604448899b", authMap["to"])
	}
	if authMap["jettonAmount"] != "1000000" {
		t.Errorf("authorization.jettonAmount = %v, want 1000000", authMap["jettonAmount"])
	}
}

func TestCreatePaymentPayload_UnsupportedNetwork(t *testing.T) {
	signer := newMockSigner()
	scheme := NewExactTonScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  ton.SchemeExact,
		Network: "eip155:1", // EVM network
		Asset:   ton.USDTMainnetAddress,
		Amount:  "1000000",
		PayTo:   "EQC88f67e776f16dcfbf42e6bdda1b82604448899b",
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
	scheme := NewExactTonScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  ton.SchemeExact,
		Network: ton.TonMainnetCAIP2,
		Asset:   "", // Missing asset
		Amount:  "1000000",
		PayTo:   "EQC88f67e776f16dcfbf42e6bdda1b82604448899b",
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
	scheme := NewExactTonScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  ton.SchemeExact,
		Network: ton.TonMainnetCAIP2,
		Asset:   ton.USDTMainnetAddress,
		Amount:  "1000000",
		PayTo:   "", // Missing payTo
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
	scheme := NewExactTonScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  ton.SchemeExact,
		Network: ton.TonMainnetCAIP2,
		Asset:   ton.USDTMainnetAddress,
		Amount:  "", // Missing amount
		PayTo:   "EQC88f67e776f16dcfbf42e6bdda1b82604448899b",
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
	scheme := NewExactTonScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  ton.SchemeExact,
		Network: ton.TonMainnetCAIP2,
		Asset:   ton.USDTMainnetAddress,
		Amount:  "not-a-number", // Invalid amount
		PayTo:   "EQC88f67e776f16dcfbf42e6bdda1b82604448899b",
	}

	_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for invalid amount, got nil")
	}
	if !containsStr(err.Error(), "invalid amount") {
		t.Errorf("Error = %v, want to contain 'invalid amount'", err.Error())
	}
}

func TestCreatePaymentPayload_SeqnoError(t *testing.T) {
	signer := newMockSigner()
	signer.seqnoErr = errMock("seqno error")
	scheme := NewExactTonScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  ton.SchemeExact,
		Network: ton.TonMainnetCAIP2,
		Asset:   ton.USDTMainnetAddress,
		Amount:  "1000000",
		PayTo:   "EQC88f67e776f16dcfbf42e6bdda1b82604448899b",
	}

	_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for seqno failure, got nil")
	}
	if !containsStr(err.Error(), "failed to get seqno") {
		t.Errorf("Error = %v, want to contain 'failed to get seqno'", err.Error())
	}
}

func TestCreatePaymentPayload_SignError(t *testing.T) {
	signer := newMockSigner()
	signer.signErr = errMock("sign error")
	scheme := NewExactTonScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  ton.SchemeExact,
		Network: ton.TonMainnetCAIP2,
		Asset:   ton.USDTMainnetAddress,
		Amount:  "1000000",
		PayTo:   "EQC88f67e776f16dcfbf42e6bdda1b82604448899b",
	}

	_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for sign failure, got nil")
	}
	if !containsStr(err.Error(), "failed to sign message") {
		t.Errorf("Error = %v, want to contain 'failed to sign message'", err.Error())
	}
}

func TestCreatePaymentPayload_DefaultTimeout(t *testing.T) {
	signer := newMockSigner()
	scheme := NewExactTonScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:            ton.SchemeExact,
		Network:           ton.TonMainnetCAIP2,
		Asset:             ton.USDTMainnetAddress,
		Amount:            "1000000",
		PayTo:             "EQC88f67e776f16dcfbf42e6bdda1b82604448899b",
		MaxTimeoutSeconds: 0, // No timeout specified - should use default
	}

	payload, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err != nil {
		t.Fatalf("CreatePaymentPayload() error: %v", err)
	}

	// Should succeed with default timeout
	if payload.T402Version != 2 {
		t.Errorf("T402Version = %v, want 2", payload.T402Version)
	}
}

func TestCreatePaymentPayload_CustomTonAmount(t *testing.T) {
	signer := newMockSigner()
	scheme := NewExactTonScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:            ton.SchemeExact,
		Network:           ton.TonMainnetCAIP2,
		Asset:             ton.USDTMainnetAddress,
		Amount:            "1000000",
		PayTo:             "EQC88f67e776f16dcfbf42e6bdda1b82604448899b",
		MaxTimeoutSeconds: 300,
		Extra: map[string]interface{}{
			"tonAmount": "200000000", // Custom TON amount for gas
		},
	}

	payload, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err != nil {
		t.Fatalf("CreatePaymentPayload() error: %v", err)
	}

	payloadMap := payload.Payload
	authMap := payloadMap["authorization"].(map[string]interface{})

	if authMap["tonAmount"] != "200000000" {
		t.Errorf("tonAmount = %v, want 200000000", authMap["tonAmount"])
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
