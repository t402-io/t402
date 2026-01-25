package client

import (
	"context"
	"testing"

	"github.com/t402-io/t402/sdks/go/mechanisms/tron"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockClientSigner implements ClientTronSigner for testing
type mockClientSigner struct {
	address      string
	blockInfo    *tron.BlockInfo
	blockInfoErr error
	signedTx     string
	signErr      error
}

func (m *mockClientSigner) Address() string {
	return m.address
}

func (m *mockClientSigner) GetBlockInfo(ctx context.Context) (*tron.BlockInfo, error) {
	if m.blockInfoErr != nil {
		return nil, m.blockInfoErr
	}
	return m.blockInfo, nil
}

func (m *mockClientSigner) SignTransaction(ctx context.Context, params tron.SignTransactionParams) (string, error) {
	if m.signErr != nil {
		return "", m.signErr
	}
	return m.signedTx, nil
}

func newMockSigner() *mockClientSigner {
	return &mockClientSigner{
		address: "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
		blockInfo: &tron.BlockInfo{
			RefBlockBytes: "f828",
			RefBlockHash:  "b1c7e92b8f2e1c09",
			Expiration:    1700000060000,
			Timestamp:     1700000000000,
		},
		signedTx: "0a02f8282208b1c7e92b8f2e1c0940c8d8e0fae8315a68080112640a2d747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472616e73666572436f6e747261637412330a1541c88f67e776f16dcfbf42e6bdda1b82604448899b121541e9aa8e1c8f7d70d1cfa6f9dd1a0c7e9f5a9c95701880897a70f0a5d8fae831",
	}
}

func TestScheme(t *testing.T) {
	signer := newMockSigner()
	scheme := NewExactTronScheme(signer)

	if scheme.Scheme() != "exact" {
		t.Errorf("Scheme() = %v, want exact", scheme.Scheme())
	}
}

func TestNewExactTronScheme(t *testing.T) {
	signer := newMockSigner()
	scheme := NewExactTronScheme(signer)

	if scheme == nil {
		t.Fatal("NewExactTronScheme() returned nil")
	}
}

func TestNewExactTronScheme_WithConfig(t *testing.T) {
	signer := newMockSigner()
	config := &tron.ClientConfig{
		Endpoint: "https://custom.endpoint.com",
	}
	scheme := NewExactTronScheme(signer, config)

	if scheme == nil {
		t.Fatal("NewExactTronScheme() returned nil")
	}
}

func TestCreatePaymentPayload_Success(t *testing.T) {
	signer := newMockSigner()
	scheme := NewExactTronScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:            tron.SchemeExact,
		Network:           tron.TronMainnetCAIP2,
		Asset:             tron.USDTMainnetAddress,
		Amount:            "1000000",
		PayTo:             "TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7",
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

	if payloadMap["signedTransaction"] == nil {
		t.Error("signedTransaction should not be nil")
	}

	authMap, ok := payloadMap["authorization"].(map[string]interface{})
	if !ok {
		t.Fatalf("authorization is not map[string]interface{}, got %T", payloadMap["authorization"])
	}

	if authMap["from"] != signer.address {
		t.Errorf("authorization.from = %v, want %v", authMap["from"], signer.address)
	}
	if authMap["to"] != "TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7" {
		t.Errorf("authorization.to = %v, want TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7", authMap["to"])
	}
	if authMap["amount"] != "1000000" {
		t.Errorf("authorization.amount = %v, want 1000000", authMap["amount"])
	}
}

func TestCreatePaymentPayload_UnsupportedNetwork(t *testing.T) {
	signer := newMockSigner()
	scheme := NewExactTronScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  tron.SchemeExact,
		Network: "eip155:1", // EVM network
		Asset:   tron.USDTMainnetAddress,
		Amount:  "1000000",
		PayTo:   "TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7",
	}

	_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for unsupported network, got nil")
	}
	if !containsStr(err.Error(), "unsupported") {
		t.Errorf("Error = %v, want to contain 'unsupported'", err.Error())
	}
}

func TestCreatePaymentPayload_MissingAsset(t *testing.T) {
	signer := newMockSigner()
	scheme := NewExactTronScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  tron.SchemeExact,
		Network: tron.TronMainnetCAIP2,
		Asset:   "", // Missing asset
		Amount:  "1000000",
		PayTo:   "TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7",
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
	scheme := NewExactTronScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  tron.SchemeExact,
		Network: tron.TronMainnetCAIP2,
		Asset:   tron.USDTMainnetAddress,
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
	scheme := NewExactTronScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  tron.SchemeExact,
		Network: tron.TronMainnetCAIP2,
		Asset:   tron.USDTMainnetAddress,
		Amount:  "", // Missing amount
		PayTo:   "TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7",
	}

	_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for missing amount, got nil")
	}
	if !containsStr(err.Error(), "amount") {
		t.Errorf("Error = %v, want to contain 'amount'", err.Error())
	}
}

func TestCreatePaymentPayload_InvalidAddress(t *testing.T) {
	signer := newMockSigner()
	scheme := NewExactTronScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  tron.SchemeExact,
		Network: tron.TronMainnetCAIP2,
		Asset:   "invalid-address", // Invalid TRC20 contract address
		Amount:  "1000000",
		PayTo:   "TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7",
	}

	_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for invalid address, got nil")
	}
	if !containsStr(err.Error(), "invalid") {
		t.Errorf("Error = %v, want to contain 'invalid'", err.Error())
	}
}

func TestCreatePaymentPayload_BlockInfoError(t *testing.T) {
	signer := newMockSigner()
	signer.blockInfoErr = errMock("block info error")
	scheme := NewExactTronScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  tron.SchemeExact,
		Network: tron.TronMainnetCAIP2,
		Asset:   tron.USDTMainnetAddress,
		Amount:  "1000000",
		PayTo:   "TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7",
	}

	_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for block info failure, got nil")
	}
	if !containsStr(err.Error(), "failed to get block info") {
		t.Errorf("Error = %v, want to contain 'failed to get block info'", err.Error())
	}
}

func TestCreatePaymentPayload_SignError(t *testing.T) {
	signer := newMockSigner()
	signer.signErr = errMock("sign error")
	scheme := NewExactTronScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:  tron.SchemeExact,
		Network: tron.TronMainnetCAIP2,
		Asset:   tron.USDTMainnetAddress,
		Amount:  "1000000",
		PayTo:   "TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7",
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
	scheme := NewExactTronScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:            tron.SchemeExact,
		Network:           tron.TronMainnetCAIP2,
		Asset:             tron.USDTMainnetAddress,
		Amount:            "1000000",
		PayTo:             "TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7",
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

func TestCreatePaymentPayload_NileTestnet(t *testing.T) {
	signer := newMockSigner()
	scheme := NewExactTronScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:            tron.SchemeExact,
		Network:           tron.TronNileCAIP2,
		Asset:             tron.USDTNileAddress,
		Amount:            "1000000",
		PayTo:             "TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7",
		MaxTimeoutSeconds: 300,
	}

	payload, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err != nil {
		t.Fatalf("CreatePaymentPayload() error: %v", err)
	}

	// Client scheme returns partial payload, core layer adds Accepted
	if payload.T402Version != 2 {
		t.Errorf("T402Version = %v, want 2", payload.T402Version)
	}
	if payload.Payload == nil {
		t.Error("Payload should not be nil")
	}
}

func TestCreatePaymentPayload_ShastaTestnet(t *testing.T) {
	signer := newMockSigner()
	scheme := NewExactTronScheme(signer)

	requirements := types.PaymentRequirements{
		Scheme:            tron.SchemeExact,
		Network:           tron.TronShastaCAIP2,
		Asset:             tron.USDTShastaAddress,
		Amount:            "1000000",
		PayTo:             "TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7",
		MaxTimeoutSeconds: 300,
	}

	payload, err := scheme.CreatePaymentPayload(context.Background(), requirements)
	if err != nil {
		t.Fatalf("CreatePaymentPayload() error: %v", err)
	}

	// Client scheme returns partial payload, core layer adds Accepted
	if payload.T402Version != 2 {
		t.Errorf("T402Version = %v, want 2", payload.T402Version)
	}
	if payload.Payload == nil {
		t.Error("Payload should not be nil")
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
