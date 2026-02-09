package facilitator

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/tron"
	"github.com/t402-io/t402/sdks/go/mechanisms/tron/upto"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockFacilitatorSigner implements upto.UptoFacilitatorTronSigner for testing
type mockFacilitatorSigner struct {
	addresses       []string
	balance         string
	balanceErr      error
	allowance       string
	allowanceErr    error
	verifyResult    *upto.VerifyApproveResult
	verifyErr       error
	broadcastTxId   string
	broadcastErr    error
	transferResult  *upto.TransferFromResult
	transferErr     error
	waitResult      *upto.TransactionConfirmation
	waitErr         error
	isActivated     bool
	isActivatedErr  error
}

func (m *mockFacilitatorSigner) GetAddresses(network string) []string {
	return m.addresses
}

func (m *mockFacilitatorSigner) GetBalance(params upto.GetBalanceParams) (string, error) {
	return m.balance, m.balanceErr
}

func (m *mockFacilitatorSigner) GetAllowance(params upto.GetAllowanceParams) (string, error) {
	return m.allowance, m.allowanceErr
}

func (m *mockFacilitatorSigner) VerifyApproveTransaction(params upto.VerifyApproveParams) (*upto.VerifyApproveResult, error) {
	return m.verifyResult, m.verifyErr
}

func (m *mockFacilitatorSigner) BroadcastTransaction(signedTransaction string, network string) (string, error) {
	return m.broadcastTxId, m.broadcastErr
}

func (m *mockFacilitatorSigner) ExecuteTransferFrom(params upto.TransferFromParams) (*upto.TransferFromResult, error) {
	return m.transferResult, m.transferErr
}

func (m *mockFacilitatorSigner) WaitForTransaction(params upto.WaitForTransactionParams) (*upto.TransactionConfirmation, error) {
	return m.waitResult, m.waitErr
}

func (m *mockFacilitatorSigner) IsActivated(address string, network string) (bool, error) {
	return m.isActivated, m.isActivatedErr
}

func newValidMockSigner() *mockFacilitatorSigner {
	return &mockFacilitatorSigner{
		addresses:    []string{"TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5"},
		balance:      "10000000",
		verifyResult: &upto.VerifyApproveResult{Valid: true},
		broadcastTxId: "approve_tx_hash_123",
		waitResult: &upto.TransactionConfirmation{
			Success: true,
			TxId:    "confirmed_tx_hash",
		},
		transferResult: &upto.TransferFromResult{
			Success: true,
			TxId:    "transfer_tx_hash_456",
		},
		isActivated: true,
	}
}

func validPayload() types.PaymentPayload {
	return types.PaymentPayload{
		T402Version: 2,
		Accepted: types.PaymentRequirements{
			Scheme:  "upto",
			Network: tron.TronMainnetCAIP2,
		},
		Payload: map[string]interface{}{
			"signedTransaction": "0a02abcd2208ef01234567890abc40d0e8c7f0e031",
			"authorization": map[string]interface{}{
				"owner":           "TVjsyZ7fYF3qLF6BQgPmTEZy1xrNNyVAAA",
				"spender":         "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
				"contractAddress": tron.USDTMainnetAddress,
				"maxAmount":       "5000000",
				"expiration":      float64(time.Now().UnixMilli() + 600000),
				"refBlockBytes":   "abcd",
				"refBlockHash":    "ef01234567890abc",
				"timestamp":       float64(time.Now().UnixMilli()),
			},
			"paymentNonce": "0x1234567890abcdef",
		},
	}
}

func validRequirements() types.PaymentRequirements {
	return types.PaymentRequirements{
		Scheme:  "upto",
		Network: tron.TronMainnetCAIP2,
		PayTo:   "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
		Amount:  "1000000",
		Asset:   tron.USDTMainnetAddress,
	}
}

func TestScheme(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewUptoTronScheme(signer)

	if scheme.Scheme() != "upto" {
		t.Errorf("Scheme() = %v, want upto", scheme.Scheme())
	}
}

func TestCaipFamily(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewUptoTronScheme(signer)

	if scheme.CaipFamily() != "tron:*" {
		t.Errorf("CaipFamily() = %v, want tron:*", scheme.CaipFamily())
	}
}

func TestGetSigners(t *testing.T) {
	signer := &mockFacilitatorSigner{
		addresses: []string{"TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5", "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"},
	}
	scheme := NewUptoTronScheme(signer)

	signers := scheme.GetSigners(t402.Network(tron.TronMainnetCAIP2))
	if len(signers) != 2 {
		t.Fatalf("GetSigners() returned %d addresses, want 2", len(signers))
	}
	if signers[0] != "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5" {
		t.Errorf("signers[0] = %v, want TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5", signers[0])
	}
	if signers[1] != "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" {
		t.Errorf("signers[1] = %v, want TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", signers[1])
	}
}

func TestGetExtra(t *testing.T) {
	signer := &mockFacilitatorSigner{
		addresses: []string{"TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5"},
	}
	scheme := NewUptoTronScheme(signer)

	extra := scheme.GetExtra(t402.Network(tron.TronMainnetCAIP2))
	if extra == nil {
		t.Fatal("GetExtra(mainnet) returned nil")
	}
	if extra["defaultAsset"] != tron.USDTMainnetAddress {
		t.Errorf("extra.defaultAsset = %v, want %v", extra["defaultAsset"], tron.USDTMainnetAddress)
	}
	if extra["symbol"] != "USDT" {
		t.Errorf("extra.symbol = %v, want USDT", extra["symbol"])
	}
	if extra["decimals"] != 6 {
		t.Errorf("extra.decimals = %v, want 6", extra["decimals"])
	}
	if extra["spenderAddress"] != "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5" {
		t.Errorf("extra.spenderAddress = %v, want TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5", extra["spenderAddress"])
	}

	// Unknown network should return nil
	extra = scheme.GetExtra(t402.Network("tron:unknown"))
	if extra != nil {
		t.Errorf("GetExtra(unknown) = %v, want nil", extra)
	}
}

func TestVerify_Success(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoTronScheme(signer)

	resp, err := scheme.Verify(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Verify() error: %v", err)
	}
	if !resp.IsValid {
		t.Errorf("IsValid = false, InvalidReason: %s", resp.InvalidReason)
	}
	if resp.Payer == "" {
		t.Error("Payer should not be empty")
	}
}

func TestVerify_WrongScheme(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoTronScheme(signer)

	payload := validPayload()
	payload.Accepted.Scheme = "exact"

	resp, err := scheme.Verify(context.Background(), payload, validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "unsupported_scheme" {
		t.Errorf("InvalidReason = %v, want unsupported_scheme", resp.InvalidReason)
	}
}

func TestVerify_NetworkMismatch(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoTronScheme(signer)

	payload := validPayload()
	payload.Accepted.Network = tron.TronNileCAIP2

	resp, err := scheme.Verify(context.Background(), payload, validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "network_mismatch" {
		t.Errorf("InvalidReason = %v, want network_mismatch", resp.InvalidReason)
	}
}

func TestVerify_UnsupportedNetwork(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoTronScheme(signer)

	payload := validPayload()
	payload.Accepted.Network = "eip155:1"

	requirements := validRequirements()
	requirements.Network = "eip155:1"

	resp, err := scheme.Verify(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "unsupported_network" {
		t.Errorf("InvalidReason = %v, want unsupported_network", resp.InvalidReason)
	}
}

func TestVerify_InvalidPayload(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoTronScheme(signer)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload:     map[string]interface{}{},
		Accepted: types.PaymentRequirements{
			Scheme:  "upto",
			Network: tron.TronMainnetCAIP2,
		},
	}

	resp, err := scheme.Verify(context.Background(), payload, validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "invalid_payload" {
		t.Errorf("InvalidReason = %v, want invalid_payload", resp.InvalidReason)
	}
}

func TestVerify_InvalidOwnerAddress(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoTronScheme(signer)

	payload := validPayload()
	authMap := payload.Payload["authorization"].(map[string]interface{})
	authMap["owner"] = "invalid_address"
	payload.Payload["authorization"] = authMap

	resp, err := scheme.Verify(context.Background(), payload, validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "invalid_owner_address" {
		t.Errorf("InvalidReason = %v, want invalid_owner_address", resp.InvalidReason)
	}
}

func TestVerify_InvalidSpenderAddress(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoTronScheme(signer)

	payload := validPayload()
	authMap := payload.Payload["authorization"].(map[string]interface{})
	authMap["spender"] = "invalid_address"
	payload.Payload["authorization"] = authMap

	resp, err := scheme.Verify(context.Background(), payload, validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "invalid_spender_address" {
		t.Errorf("InvalidReason = %v, want invalid_spender_address", resp.InvalidReason)
	}
}

func TestVerify_InvalidContractAddress(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoTronScheme(signer)

	payload := validPayload()
	authMap := payload.Payload["authorization"].(map[string]interface{})
	authMap["contractAddress"] = "invalid_address"
	payload.Payload["authorization"] = authMap

	resp, err := scheme.Verify(context.Background(), payload, validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "invalid_contract_address" {
		t.Errorf("InvalidReason = %v, want invalid_contract_address", resp.InvalidReason)
	}
}

func TestVerify_InvalidSpender_NotFacilitator(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoTronScheme(signer)

	payload := validPayload()
	authMap := payload.Payload["authorization"].(map[string]interface{})
	// Use a valid TRON address that is not the facilitator
	authMap["spender"] = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
	payload.Payload["authorization"] = authMap

	resp, err := scheme.Verify(context.Background(), payload, validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "invalid_spender" {
		t.Errorf("InvalidReason = %v, want invalid_spender", resp.InvalidReason)
	}
}

func TestVerify_ApproveVerificationError(t *testing.T) {
	signer := newValidMockSigner()
	signer.verifyErr = fmt.Errorf("RPC error")
	scheme := NewUptoTronScheme(signer)

	_, err := scheme.Verify(context.Background(), validPayload(), validRequirements())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T", err)
	}
	if ve.Reason != "transaction_verification_failed" {
		t.Errorf("Reason = %v, want transaction_verification_failed", ve.Reason)
	}
}

func TestVerify_ApproveVerificationInvalid(t *testing.T) {
	signer := newValidMockSigner()
	signer.verifyResult = &upto.VerifyApproveResult{
		Valid:  false,
		Reason: "invalid_signature",
	}
	scheme := NewUptoTronScheme(signer)

	resp, err := scheme.Verify(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if !strings.Contains(resp.InvalidReason, "transaction_verification_failed") {
		t.Errorf("InvalidReason = %v, want to contain transaction_verification_failed", resp.InvalidReason)
	}
}

func TestVerify_AuthorizationExpired(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoTronScheme(signer)

	payload := validPayload()
	authMap := payload.Payload["authorization"].(map[string]interface{})
	// Set expiration to past (milliseconds)
	authMap["expiration"] = float64(time.Now().UnixMilli() - 100000)
	payload.Payload["authorization"] = authMap

	resp, err := scheme.Verify(context.Background(), payload, validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "authorization_expired" {
		t.Errorf("InvalidReason = %v, want authorization_expired", resp.InvalidReason)
	}
}

func TestVerify_InsufficientBalance(t *testing.T) {
	signer := newValidMockSigner()
	signer.balance = "500000" // Less than required 1000000
	scheme := NewUptoTronScheme(signer)

	resp, err := scheme.Verify(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "insufficient_balance" {
		t.Errorf("InvalidReason = %v, want insufficient_balance", resp.InvalidReason)
	}
}

func TestVerify_InsufficientApprovedAmount(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoTronScheme(signer)

	payload := validPayload()
	authMap := payload.Payload["authorization"].(map[string]interface{})
	authMap["maxAmount"] = "500000" // Less than required 1000000
	payload.Payload["authorization"] = authMap

	resp, err := scheme.Verify(context.Background(), payload, validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "insufficient_approved_amount" {
		t.Errorf("InvalidReason = %v, want insufficient_approved_amount", resp.InvalidReason)
	}
}

func TestVerify_AssetMismatch(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoTronScheme(signer)

	payload := validPayload()
	authMap := payload.Payload["authorization"].(map[string]interface{})
	authMap["contractAddress"] = "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf" // Nile address instead of mainnet
	payload.Payload["authorization"] = authMap

	resp, err := scheme.Verify(context.Background(), payload, validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "asset_mismatch" {
		t.Errorf("InvalidReason = %v, want asset_mismatch", resp.InvalidReason)
	}
}

func TestVerify_AccountNotActivated(t *testing.T) {
	signer := newValidMockSigner()
	signer.isActivated = false
	scheme := NewUptoTronScheme(signer)

	resp, err := scheme.Verify(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "account_not_activated" {
		t.Errorf("InvalidReason = %v, want account_not_activated", resp.InvalidReason)
	}
}

func TestSettle_Success(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoTronScheme(signer)

	resp, err := scheme.Settle(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Settle() error: %v", err)
	}
	if !resp.Success {
		t.Errorf("Success = false, ErrorReason: %s", resp.ErrorReason)
	}
	if resp.Transaction == "" {
		t.Error("Transaction should not be empty")
	}
	if resp.Payer == "" {
		t.Error("Payer should not be empty")
	}
	if resp.Network != t402.Network(tron.TronMainnetCAIP2) {
		t.Errorf("Network = %v, want %v", resp.Network, tron.TronMainnetCAIP2)
	}
}

func TestSettle_VerificationFailed(t *testing.T) {
	signer := newValidMockSigner()
	signer.verifyErr = fmt.Errorf("RPC error")
	scheme := NewUptoTronScheme(signer)

	_, err := scheme.Settle(context.Background(), validPayload(), validRequirements())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	se, ok := err.(*t402.SettleError)
	if !ok {
		t.Fatalf("expected *t402.SettleError, got %T: %v", err, err)
	}
	if se.Reason != "transaction_verification_failed" {
		t.Errorf("Reason = %v, want transaction_verification_failed", se.Reason)
	}
}

func TestSettle_ApproveBroadcastFailed(t *testing.T) {
	signer := newValidMockSigner()
	signer.broadcastErr = fmt.Errorf("broadcast error")
	scheme := NewUptoTronScheme(signer)

	_, err := scheme.Settle(context.Background(), validPayload(), validRequirements())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	se, ok := err.(*t402.SettleError)
	if !ok {
		t.Fatalf("expected *t402.SettleError, got %T: %v", err, err)
	}
	if se.Reason != "approve_broadcast_failed" {
		t.Errorf("Reason = %v, want approve_broadcast_failed", se.Reason)
	}
}

func TestSettle_ApproveConfirmationFailed(t *testing.T) {
	signer := newValidMockSigner()
	signer.waitErr = fmt.Errorf("confirmation timeout")
	scheme := NewUptoTronScheme(signer)

	_, err := scheme.Settle(context.Background(), validPayload(), validRequirements())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	se, ok := err.(*t402.SettleError)
	if !ok {
		t.Fatalf("expected *t402.SettleError, got %T: %v", err, err)
	}
	if se.Reason != "approve_confirmation_failed" {
		t.Errorf("Reason = %v, want approve_confirmation_failed", se.Reason)
	}
}

func TestSettle_TransferFromExecutionFailed(t *testing.T) {
	signer := newValidMockSigner()
	signer.transferErr = fmt.Errorf("transfer execution error")
	scheme := NewUptoTronScheme(signer)

	_, err := scheme.Settle(context.Background(), validPayload(), validRequirements())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	se, ok := err.(*t402.SettleError)
	if !ok {
		t.Fatalf("expected *t402.SettleError, got %T: %v", err, err)
	}
	if se.Reason != "transfer_execution_failed" {
		t.Errorf("Reason = %v, want transfer_execution_failed", se.Reason)
	}
}

func TestSettle_TransferConfirmationFailed(t *testing.T) {
	// This test needs the first WaitForTransaction to succeed (for approve)
	// but the second WaitForTransaction to fail (for transfer).
	// Since our mock returns the same result for both calls, we use a counter.
	callCount := 0
	signer := newValidMockSigner()

	// Create a custom mock that fails on second WaitForTransaction call
	customSigner := &waitCountingSigner{
		mockFacilitatorSigner: signer,
		waitCallCount:         &callCount,
		failOnCall:            2, // Fail on second call
	}
	scheme := NewUptoTronScheme(customSigner)

	_, err := scheme.Settle(context.Background(), validPayload(), validRequirements())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	se, ok := err.(*t402.SettleError)
	if !ok {
		t.Fatalf("expected *t402.SettleError, got %T: %v", err, err)
	}
	if se.Reason != "transfer_confirmation_failed" {
		t.Errorf("Reason = %v, want transfer_confirmation_failed", se.Reason)
	}
}

// waitCountingSigner wraps mockFacilitatorSigner and counts WaitForTransaction calls
type waitCountingSigner struct {
	*mockFacilitatorSigner
	waitCallCount *int
	failOnCall    int
}

func (w *waitCountingSigner) WaitForTransaction(params upto.WaitForTransactionParams) (*upto.TransactionConfirmation, error) {
	*w.waitCallCount++
	if *w.waitCallCount >= w.failOnCall {
		return nil, fmt.Errorf("transfer confirmation timeout")
	}
	return w.mockFacilitatorSigner.WaitForTransaction(params)
}
