package client

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/t402-io/t402/sdks/go/mechanisms/ton"
	"github.com/t402-io/t402/sdks/go/mechanisms/ton/upto"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockClientSigner implements upto.UptoClientTonSigner for testing
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

func (m *mockClientSigner) SignMessage(ctx context.Context, params upto.SignMessageParams) (string, error) {
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

func validRequirements() types.PaymentRequirements {
	return types.PaymentRequirements{
		Scheme:            "upto",
		Network:           "ton:mainnet",
		Asset:             "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
		Amount:            "1000000",
		PayTo:             "EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2",
		MaxTimeoutSeconds: 300,
		Extra: map[string]interface{}{
			"facilitator": "EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe",
			"maxAmount":   "5000000",
		},
	}
}

// errMock is a simple error type for testing
type errMock string

func (e errMock) Error() string {
	return string(e)
}

func TestScheme(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoTonClient(signer)

	if client.Scheme() != "upto" {
		t.Errorf("Scheme() = %v, want upto", client.Scheme())
	}
}

func TestCreatePaymentPayload_Success(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoTonClient(signer)

	requirements := validRequirements()

	payload, err := client.CreatePaymentPayload(context.Background(), requirements)
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

	if payloadMap["signedBoc"] != signer.signBoc {
		t.Errorf("signedBoc = %v, want %v", payloadMap["signedBoc"], signer.signBoc)
	}

	nonce, ok := payloadMap["paymentNonce"].(string)
	if !ok || nonce == "" {
		t.Error("paymentNonce is missing or empty")
	}
	if !strings.HasPrefix(nonce, "0x") {
		t.Errorf("paymentNonce = %v, want 0x prefix", nonce)
	}

	authMap, ok := payloadMap["authorization"].(map[string]interface{})
	if !ok {
		t.Fatalf("authorization is not map[string]interface{}, got %T", payloadMap["authorization"])
	}

	if authMap["from"] != signer.address {
		t.Errorf("authorization.from = %v, want %v", authMap["from"], signer.address)
	}
	if authMap["facilitator"] != "EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe" {
		t.Errorf("authorization.facilitator = %v, want EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe", authMap["facilitator"])
	}
	if authMap["jettonMaster"] != requirements.Asset {
		t.Errorf("authorization.jettonMaster = %v, want %v", authMap["jettonMaster"], requirements.Asset)
	}
	if authMap["maxAmount"] != "5000000" {
		t.Errorf("authorization.maxAmount = %v, want 5000000", authMap["maxAmount"])
	}
}

func TestCreatePaymentPayload_UnsupportedNetwork(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoTonClient(signer)

	requirements := validRequirements()
	requirements.Network = "ethereum:1"

	_, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for unsupported network, got nil")
	}
	if !strings.Contains(err.Error(), "unsupported network") {
		t.Errorf("Error = %v, want to contain 'unsupported network'", err.Error())
	}
}

func TestCreatePaymentPayload_MissingExtraData(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoTonClient(signer)

	requirements := validRequirements()
	requirements.Extra = nil

	_, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for missing extra data, got nil")
	}
	if !strings.Contains(err.Error(), "missing extra data") {
		t.Errorf("Error = %v, want to contain 'missing extra data'", err.Error())
	}
}

func TestCreatePaymentPayload_MissingFacilitator(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoTonClient(signer)

	requirements := validRequirements()
	requirements.Extra = map[string]interface{}{
		"maxAmount": "5000000",
	}

	_, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for missing facilitator, got nil")
	}
	if !strings.Contains(err.Error(), "facilitator") {
		t.Errorf("Error = %v, want to contain 'facilitator'", err.Error())
	}
}

func TestCreatePaymentPayload_SeqnoError(t *testing.T) {
	signer := newMockSigner()
	signer.seqnoErr = errMock("seqno error")
	client := NewUptoTonClient(signer)

	requirements := validRequirements()

	_, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for seqno failure, got nil")
	}
	if !strings.Contains(err.Error(), "failed to get seqno") {
		t.Errorf("Error = %v, want to contain 'failed to get seqno'", err.Error())
	}
}

func TestCreatePaymentPayload_SignError(t *testing.T) {
	signer := newMockSigner()
	signer.signErr = errMock("sign error")
	client := NewUptoTonClient(signer)

	requirements := validRequirements()

	_, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for sign failure, got nil")
	}
	if !strings.Contains(err.Error(), "failed to sign message") {
		t.Errorf("Error = %v, want to contain 'failed to sign message'", err.Error())
	}
}

func TestCreatePaymentPayload_WrongScheme(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoTonClient(signer)

	requirements := validRequirements()
	requirements.Scheme = "exact"

	_, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for wrong scheme, got nil")
	}
	if !strings.Contains(err.Error(), "invalid scheme") {
		t.Errorf("Error = %v, want to contain 'invalid scheme'", err.Error())
	}
}

func TestCreatePaymentPayload_WithCustomConfig(t *testing.T) {
	signer := newMockSigner()
	config := &ClientConfig{
		GasAmount:      200_000_000,
		DefaultTimeout: 600,
	}
	client := NewUptoTonClient(signer, config)

	requirements := validRequirements()
	// Remove maxTimeoutSeconds to use config default
	requirements.MaxTimeoutSeconds = 0

	payload, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err != nil {
		t.Fatalf("CreatePaymentPayload() error: %v", err)
	}

	if payload.T402Version != 2 {
		t.Errorf("T402Version = %v, want 2", payload.T402Version)
	}

	payloadMap := payload.Payload
	authMap, ok := payloadMap["authorization"].(map[string]interface{})
	if !ok {
		t.Fatalf("authorization is not map[string]interface{}, got %T", payloadMap["authorization"])
	}

	if authMap["tonAmount"] != fmt.Sprintf("%d", config.GasAmount) {
		t.Errorf("tonAmount = %v, want %d", authMap["tonAmount"], config.GasAmount)
	}
}

func TestCreatePaymentPayload_MaxAmountFromExtra(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoTonClient(signer)

	requirements := validRequirements()
	// Amount is 1000000 but extra.maxAmount is 5000000
	// maxAmount from extra should override requirements.Amount

	payload, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err != nil {
		t.Fatalf("CreatePaymentPayload() error: %v", err)
	}

	payloadMap := payload.Payload
	authMap, ok := payloadMap["authorization"].(map[string]interface{})
	if !ok {
		t.Fatalf("authorization is not map[string]interface{}, got %T", payloadMap["authorization"])
	}

	if authMap["maxAmount"] != "5000000" {
		t.Errorf("authorization.maxAmount = %v, want 5000000 (from extra)", authMap["maxAmount"])
	}
}

func TestCreatePaymentPayload_MaxAmountFallsBackToAmount(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoTonClient(signer)

	requirements := validRequirements()
	// Remove maxAmount from extra so it falls back to requirements.Amount
	requirements.Extra = map[string]interface{}{
		"facilitator": "EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe",
	}

	payload, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err != nil {
		t.Fatalf("CreatePaymentPayload() error: %v", err)
	}

	payloadMap := payload.Payload
	authMap, ok := payloadMap["authorization"].(map[string]interface{})
	if !ok {
		t.Fatalf("authorization is not map[string]interface{}, got %T", payloadMap["authorization"])
	}

	if authMap["maxAmount"] != "1000000" {
		t.Errorf("authorization.maxAmount = %v, want 1000000 (fallback to Amount)", authMap["maxAmount"])
	}
}

func TestCreatePaymentPayload_VerifyAuthorizationFields(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoTonClient(signer)

	requirements := validRequirements()

	payload, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err != nil {
		t.Fatalf("CreatePaymentPayload() error: %v", err)
	}

	payloadMap := payload.Payload
	authMap, ok := payloadMap["authorization"].(map[string]interface{})
	if !ok {
		t.Fatalf("authorization is not map[string]interface{}, got %T", payloadMap["authorization"])
	}

	// Verify from matches signer address
	if authMap["from"] != signer.address {
		t.Errorf("authorization.from = %v, want %v", authMap["from"], signer.address)
	}

	// Verify facilitator matches extra
	if authMap["facilitator"] != "EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe" {
		t.Errorf("authorization.facilitator = %v, want EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe", authMap["facilitator"])
	}

	// Verify jettonMaster matches asset
	if authMap["jettonMaster"] != requirements.Asset {
		t.Errorf("authorization.jettonMaster = %v, want %v", authMap["jettonMaster"], requirements.Asset)
	}

	// Verify seqno matches signer seqno
	seqno, ok := authMap["seqno"].(int64)
	if !ok {
		// JSON numbers are float64 in maps, but ToMap uses int64 directly
		seqnoFloat, ok := authMap["seqno"].(float64)
		if !ok {
			t.Fatalf("authorization.seqno is not numeric, got %T", authMap["seqno"])
		}
		seqno = int64(seqnoFloat)
	}
	if seqno != signer.seqno {
		t.Errorf("authorization.seqno = %v, want %v", seqno, signer.seqno)
	}

	// Verify tonAmount is the default gas amount
	if authMap["tonAmount"] != fmt.Sprintf("%d", ton.DefaultJettonTransferTon) {
		t.Errorf("authorization.tonAmount = %v, want %d", authMap["tonAmount"], ton.DefaultJettonTransferTon)
	}

	// Verify validUntil is set and in the future
	validUntil, ok := authMap["validUntil"].(int64)
	if !ok {
		validUntilFloat, ok := authMap["validUntil"].(float64)
		if !ok {
			t.Fatalf("authorization.validUntil is not numeric, got %T", authMap["validUntil"])
		}
		validUntil = int64(validUntilFloat)
	}
	if validUntil <= 0 {
		t.Errorf("authorization.validUntil = %v, want positive value", validUntil)
	}

	// Verify queryId is set and non-empty
	queryId, ok := authMap["queryId"].(string)
	if !ok || queryId == "" {
		t.Error("authorization.queryId is missing or empty")
	}
}

func TestNewUptoTonClient(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoTonClient(signer)

	if client == nil {
		t.Fatal("NewUptoTonClient() returned nil")
	}
}

func TestNewUptoTonClient_WithConfig(t *testing.T) {
	signer := newMockSigner()
	config := &ClientConfig{
		Endpoint:       "https://custom.endpoint.com",
		DefaultTimeout: 1800,
		GasAmount:      250_000_000,
	}
	client := NewUptoTonClient(signer, config)

	if client == nil {
		t.Fatal("NewUptoTonClient() with config returned nil")
	}
}

func TestGetAddress(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoTonClient(signer)

	if client.GetAddress() != signer.address {
		t.Errorf("GetAddress() = %v, want %v", client.GetAddress(), signer.address)
	}
}
