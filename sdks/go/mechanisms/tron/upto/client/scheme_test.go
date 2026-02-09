package client

import (
	"context"
	"strings"
	"testing"

	"github.com/t402-io/t402/sdks/go/mechanisms/tron/upto"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockClientSigner implements upto.UptoClientTronSigner for testing
type mockClientSigner struct {
	address      string
	blockInfo    *upto.BlockInfo
	blockInfoErr error
	signedTx     string
	signErr      error
}

func (m *mockClientSigner) Address() string {
	return m.address
}

func (m *mockClientSigner) GetBlockInfo() (*upto.BlockInfo, error) {
	return m.blockInfo, m.blockInfoErr
}

func (m *mockClientSigner) SignApproveTransaction(params upto.SignApproveParams) (string, error) {
	if m.signErr != nil {
		return "", m.signErr
	}
	return m.signedTx, nil
}

func newMockSigner() *mockClientSigner {
	return &mockClientSigner{
		address: "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
		blockInfo: &upto.BlockInfo{
			RefBlockBytes: "abcd",
			RefBlockHash:  "ef01234567890abc",
			Expiration:    1704067200000,
			Timestamp:     1704067100000,
		},
		signedTx: "0a02abcd2208ef01234567890abc40d0e8c7f0e0315a65080112610a2d747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5472696767657253",
	}
}

func validRequirements() types.PaymentRequirements {
	return types.PaymentRequirements{
		Scheme:            "upto",
		Network:           "tron:mainnet",
		Asset:             "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
		Amount:            "1000000",
		PayTo:             "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
		MaxTimeoutSeconds: 300,
		Extra: map[string]interface{}{
			"spenderAddress": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
			"maxAmount":      "5000000",
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
	client := NewUptoTronClient(signer)

	if client.Scheme() != "upto" {
		t.Errorf("Scheme() = %v, want upto", client.Scheme())
	}
}

func TestCreatePaymentPayload_Success(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoTronClient(signer)

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

	if payloadMap["signedTransaction"] != signer.signedTx {
		t.Errorf("signedTransaction = %v, want %v", payloadMap["signedTransaction"], signer.signedTx)
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

	if authMap["owner"] != signer.address {
		t.Errorf("authorization.owner = %v, want %v", authMap["owner"], signer.address)
	}
	if authMap["spender"] != "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" {
		t.Errorf("authorization.spender = %v, want TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", authMap["spender"])
	}
	if authMap["contractAddress"] != requirements.Asset {
		t.Errorf("authorization.contractAddress = %v, want %v", authMap["contractAddress"], requirements.Asset)
	}
	if authMap["maxAmount"] != "5000000" {
		t.Errorf("authorization.maxAmount = %v, want 5000000", authMap["maxAmount"])
	}
}

func TestCreatePaymentPayload_UnsupportedNetwork(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoTronClient(signer)

	requirements := validRequirements()
	requirements.Network = "eip155:1"

	_, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for unsupported network, got nil")
	}
	if !strings.Contains(err.Error(), "unsupported network") {
		t.Errorf("Error = %v, want to contain 'unsupported network'", err.Error())
	}
}

func TestCreatePaymentPayload_WrongScheme(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoTronClient(signer)

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

func TestCreatePaymentPayload_MissingExtra(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoTronClient(signer)

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

func TestCreatePaymentPayload_MissingSpenderAddress(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoTronClient(signer)

	requirements := validRequirements()
	requirements.Extra = map[string]interface{}{
		"maxAmount": "5000000",
	}

	_, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for missing spenderAddress, got nil")
	}
	if !strings.Contains(err.Error(), "spenderAddress") {
		t.Errorf("Error = %v, want to contain 'spenderAddress'", err.Error())
	}
}

func TestCreatePaymentPayload_BlockInfoError(t *testing.T) {
	signer := newMockSigner()
	signer.blockInfoErr = errMock("block info error")
	client := NewUptoTronClient(signer)

	requirements := validRequirements()

	_, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for block info failure, got nil")
	}
	if !strings.Contains(err.Error(), "failed to get block info") {
		t.Errorf("Error = %v, want to contain 'failed to get block info'", err.Error())
	}
}

func TestCreatePaymentPayload_SignError(t *testing.T) {
	signer := newMockSigner()
	signer.signErr = errMock("sign error")
	client := NewUptoTronClient(signer)

	requirements := validRequirements()

	_, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for sign failure, got nil")
	}
	if !strings.Contains(err.Error(), "failed to sign approve transaction") {
		t.Errorf("Error = %v, want to contain 'failed to sign approve transaction'", err.Error())
	}
}

func TestCreatePaymentPayload_CustomConfig(t *testing.T) {
	signer := newMockSigner()
	config := &ClientConfig{
		FeeLimit: 200000000, // 200 TRX
	}
	client := NewUptoTronClient(signer, config)

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
}

func TestCreatePaymentPayload_MaxAmountFromExtra(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoTronClient(signer)

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
	client := NewUptoTronClient(signer)

	requirements := validRequirements()
	// Remove maxAmount from extra so it falls back to requirements.Amount
	requirements.Extra = map[string]interface{}{
		"spenderAddress": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
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
	client := NewUptoTronClient(signer)

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

	// Verify owner matches signer address
	if authMap["owner"] != signer.address {
		t.Errorf("authorization.owner = %v, want %v", authMap["owner"], signer.address)
	}

	// Verify spender matches extra
	if authMap["spender"] != "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" {
		t.Errorf("authorization.spender = %v, want TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", authMap["spender"])
	}

	// Verify contractAddress matches asset
	if authMap["contractAddress"] != requirements.Asset {
		t.Errorf("authorization.contractAddress = %v, want %v", authMap["contractAddress"], requirements.Asset)
	}

	// Verify refBlockBytes is set
	refBlockBytes, ok := authMap["refBlockBytes"].(string)
	if !ok || refBlockBytes == "" {
		t.Error("authorization.refBlockBytes is missing or empty")
	}

	// Verify refBlockHash is set
	refBlockHash, ok := authMap["refBlockHash"].(string)
	if !ok || refBlockHash == "" {
		t.Error("authorization.refBlockHash is missing or empty")
	}

	// Verify expiration is set and positive (milliseconds)
	expiration, ok := authMap["expiration"].(int64)
	if !ok {
		expirationFloat, ok := authMap["expiration"].(float64)
		if !ok {
			t.Fatalf("authorization.expiration is not numeric, got %T", authMap["expiration"])
		}
		expiration = int64(expirationFloat)
	}
	if expiration <= 0 {
		t.Errorf("authorization.expiration = %v, want positive value", expiration)
	}

	// Verify timestamp is set and positive (milliseconds)
	timestamp, ok := authMap["timestamp"].(int64)
	if !ok {
		timestampFloat, ok := authMap["timestamp"].(float64)
		if !ok {
			t.Fatalf("authorization.timestamp is not numeric, got %T", authMap["timestamp"])
		}
		timestamp = int64(timestampFloat)
	}
	if timestamp <= 0 {
		t.Errorf("authorization.timestamp = %v, want positive value", timestamp)
	}
}

func TestGetAddress(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoTronClient(signer)

	if client.GetAddress() != signer.address {
		t.Errorf("GetAddress() = %v, want %v", client.GetAddress(), signer.address)
	}
}

func TestNewUptoTronClient(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoTronClient(signer)

	if client == nil {
		t.Fatal("NewUptoTronClient() returned nil")
	}
}

func TestNewUptoTronClient_WithConfig(t *testing.T) {
	signer := newMockSigner()
	config := &ClientConfig{
		FeeLimit: 500000000,
	}
	client := NewUptoTronClient(signer, config)

	if client == nil {
		t.Fatal("NewUptoTronClient() with config returned nil")
	}
}
