package client

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/t402-io/t402/sdks/go/mechanisms/near/upto"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockClientSigner implements upto.UptoClientNearSigner for testing
type mockClientSigner struct {
	accountID     string
	ftTransferTx  string
	ftTransferErr error
}

func (m *mockClientSigner) AccountID() string {
	return m.accountID
}

func (m *mockClientSigner) FtTransfer(ctx context.Context, params upto.FtTransferParams) (string, error) {
	if m.ftTransferErr != nil {
		return "", m.ftTransferErr
	}
	return m.ftTransferTx, nil
}

func newMockSigner() *mockClientSigner {
	return &mockClientSigner{
		accountID:    "alice.near",
		ftTransferTx: "6eFxSCv6TzLbvGBRPaKHcLcfJGHEgH7x5T1aQT4qwZgt",
	}
}

func validRequirements() types.PaymentRequirements {
	return types.PaymentRequirements{
		Scheme:            "upto",
		Network:           "near:mainnet",
		Asset:             "usdt.tether-token.near",
		Amount:            "1000000",
		PayTo:             "bob.near",
		MaxTimeoutSeconds: 300,
		Extra: map[string]interface{}{
			"facilitator": "facilitator.near",
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
	client := NewUptoNearClient(signer)

	if client.Scheme() != "upto" {
		t.Errorf("Scheme() = %v, want upto", client.Scheme())
	}
}

func TestCreatePaymentPayload_Success(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoNearClient(signer)

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

	if payloadMap["txHash"] != signer.ftTransferTx {
		t.Errorf("txHash = %v, want %v", payloadMap["txHash"], signer.ftTransferTx)
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

	if authMap["from"] != signer.accountID {
		t.Errorf("authorization.from = %v, want %v", authMap["from"], signer.accountID)
	}
	if authMap["facilitator"] != "facilitator.near" {
		t.Errorf("authorization.facilitator = %v, want facilitator.near", authMap["facilitator"])
	}
	if authMap["tokenContract"] != requirements.Asset {
		t.Errorf("authorization.tokenContract = %v, want %v", authMap["tokenContract"], requirements.Asset)
	}
	if authMap["maxAmount"] != "5000000" {
		t.Errorf("authorization.maxAmount = %v, want 5000000", authMap["maxAmount"])
	}
}

func TestCreatePaymentPayload_UnsupportedNetwork(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoNearClient(signer)

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
	client := NewUptoNearClient(signer)

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

func TestCreatePaymentPayload_MissingExtraData(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoNearClient(signer)

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
	client := NewUptoNearClient(signer)

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

func TestCreatePaymentPayload_FtTransferError(t *testing.T) {
	signer := newMockSigner()
	signer.ftTransferErr = errMock("transfer failed")
	client := NewUptoNearClient(signer)

	requirements := validRequirements()

	_, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for ft_transfer failure, got nil")
	}
	if !strings.Contains(err.Error(), "failed to execute ft_transfer") {
		t.Errorf("Error = %v, want to contain 'failed to execute ft_transfer'", err.Error())
	}
}

func TestCreatePaymentPayload_MaxAmountFromExtra(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoNearClient(signer)

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
	client := NewUptoNearClient(signer)

	requirements := validRequirements()
	// Remove maxAmount from extra so it falls back to requirements.Amount
	requirements.Extra = map[string]interface{}{
		"facilitator": "facilitator.near",
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
	client := NewUptoNearClient(signer)

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

	// Verify from matches signer account ID
	if authMap["from"] != signer.accountID {
		t.Errorf("authorization.from = %v, want %v", authMap["from"], signer.accountID)
	}

	// Verify facilitator matches extra
	if authMap["facilitator"] != "facilitator.near" {
		t.Errorf("authorization.facilitator = %v, want facilitator.near", authMap["facilitator"])
	}

	// Verify tokenContract matches asset
	if authMap["tokenContract"] != string(requirements.Asset) {
		t.Errorf("authorization.tokenContract = %v, want %v", authMap["tokenContract"], requirements.Asset)
	}

	// Verify maxAmount is set
	maxAmount, ok := authMap["maxAmount"].(string)
	if !ok || maxAmount == "" {
		t.Error("authorization.maxAmount is missing or empty")
	}
}

func TestCreatePaymentPayload_TestnetNetwork(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoNearClient(signer)

	requirements := validRequirements()
	requirements.Network = "near:testnet"
	requirements.Asset = "usdt.fakes.testnet"

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

	if authMap["tokenContract"] != "usdt.fakes.testnet" {
		t.Errorf("authorization.tokenContract = %v, want usdt.fakes.testnet", authMap["tokenContract"])
	}
}

func TestNewUptoNearClient(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoNearClient(signer)

	if client == nil {
		t.Fatal("NewUptoNearClient() returned nil")
	}
}

func TestNewUptoNearClient_WithConfig(t *testing.T) {
	signer := newMockSigner()
	config := &ClientConfig{
		RPCURL: "https://custom-rpc.near.org",
	}
	client := NewUptoNearClient(signer, config)

	if client == nil {
		t.Fatal("NewUptoNearClient() with config returned nil")
	}
}

func TestGetAddress(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoNearClient(signer)

	if client.GetAddress() != signer.accountID {
		t.Errorf("GetAddress() = %v, want %v", client.GetAddress(), signer.accountID)
	}
}

func TestCreatePaymentPayload_EmptyFacilitator(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoNearClient(signer)

	requirements := validRequirements()
	requirements.Extra = map[string]interface{}{
		"facilitator": "",
		"maxAmount":   "5000000",
	}

	_, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for empty facilitator, got nil")
	}
	if !strings.Contains(err.Error(), "facilitator") {
		t.Errorf("Error = %v, want to contain 'facilitator'", err.Error())
	}
}

func TestCreatePaymentPayload_PaymentNonceUniqueness(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoNearClient(signer)

	requirements := validRequirements()

	payload1, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err != nil {
		t.Fatalf("CreatePaymentPayload() first call error: %v", err)
	}

	payload2, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err != nil {
		t.Fatalf("CreatePaymentPayload() second call error: %v", err)
	}

	nonce1 := payload1.Payload["paymentNonce"].(string)
	nonce2 := payload2.Payload["paymentNonce"].(string)

	if nonce1 == nonce2 {
		t.Errorf("Payment nonces should be unique, both are %v", nonce1)
	}
}

func TestCreatePaymentPayload_FtTransferMemo(t *testing.T) {
	// Capture the FtTransfer params to verify the memo format
	var capturedParams upto.FtTransferParams
	signer := &mockClientSigner{
		accountID:    "alice.near",
		ftTransferTx: "tx_hash_123",
	}
	// Override FtTransfer to capture params
	origFtTransfer := signer.ftTransferTx

	capturedSigner := &capturingMockSigner{
		accountID: signer.accountID,
		txHash:    origFtTransfer,
	}

	client := NewUptoNearClient(capturedSigner)
	requirements := validRequirements()

	_, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err != nil {
		t.Fatalf("CreatePaymentPayload() error: %v", err)
	}

	capturedParams = capturedSigner.lastParams

	// Verify the memo starts with t402-upto:
	if !strings.HasPrefix(capturedParams.Memo, "t402-upto:") {
		t.Errorf("FtTransfer memo = %v, want prefix 't402-upto:'", capturedParams.Memo)
	}

	// Verify receiver is the facilitator
	if capturedParams.ReceiverID != "facilitator.near" {
		t.Errorf("FtTransfer receiverID = %v, want facilitator.near", capturedParams.ReceiverID)
	}

	// Verify amount is the maxAmount
	if capturedParams.Amount != "5000000" {
		t.Errorf("FtTransfer amount = %v, want 5000000", capturedParams.Amount)
	}

	// Verify token contract
	if capturedParams.TokenContract != "usdt.tether-token.near" {
		t.Errorf("FtTransfer tokenContract = %v, want usdt.tether-token.near", capturedParams.TokenContract)
	}
}

// capturingMockSigner captures FtTransfer params for verification
type capturingMockSigner struct {
	accountID  string
	txHash     string
	lastParams upto.FtTransferParams
}

func (m *capturingMockSigner) AccountID() string {
	return m.accountID
}

func (m *capturingMockSigner) FtTransfer(_ context.Context, params upto.FtTransferParams) (string, error) {
	m.lastParams = params
	return m.txHash, nil
}

func TestCreatePaymentPayload_NonNumericFacilitator(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoNearClient(signer)

	requirements := validRequirements()
	requirements.Extra = map[string]interface{}{
		"facilitator": 12345, // not a string
		"maxAmount":   "5000000",
	}

	_, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for non-string facilitator, got nil")
	}
	if !strings.Contains(err.Error(), "facilitator") {
		t.Errorf("Error = %v, want to contain 'facilitator'", err.Error())
	}
}

// Verify the mock signer is unused (but validates the interface is correct)
func TestMockSignerImplementsInterface(t *testing.T) {
	var _ upto.UptoClientNearSigner = &mockClientSigner{}
	var _ upto.UptoClientNearSigner = &capturingMockSigner{}

	// Verify basic mock function
	signer := newMockSigner()
	if signer.AccountID() != "alice.near" {
		t.Errorf("AccountID() = %v, want alice.near", signer.AccountID())
	}

	txHash, err := signer.FtTransfer(context.Background(), upto.FtTransferParams{})
	if err != nil {
		t.Fatalf("FtTransfer() unexpected error: %v", err)
	}
	if txHash != "6eFxSCv6TzLbvGBRPaKHcLcfJGHEgH7x5T1aQT4qwZgt" {
		t.Errorf("FtTransfer() = %v, want 6eFxSCv6TzLbvGBRPaKHcLcfJGHEgH7x5T1aQT4qwZgt", txHash)
	}

	// Verify error path
	signer.ftTransferErr = fmt.Errorf("error")
	_, err = signer.FtTransfer(context.Background(), upto.FtTransferParams{})
	if err == nil {
		t.Error("expected error, got nil")
	}
}
