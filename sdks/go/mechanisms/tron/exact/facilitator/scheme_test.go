package facilitator

import (
	"context"
	"fmt"
	"testing"
	"time"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/tron"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockFacilitatorSigner implements FacilitatorTronSigner for testing
type mockFacilitatorSigner struct {
	addresses    map[string][]string
	balance      string
	balanceErr   error
	verifyResult *tron.VerifyMessageResult
	verifyErr    error
	broadcastID  string
	broadcastErr error
	waitResult   *tron.TransactionConfirmation
	waitErr      error
	isActivated  bool
	activatedErr error
}

func (m *mockFacilitatorSigner) GetAddresses(_ context.Context, network string) []string {
	if addrs, ok := m.addresses[network]; ok {
		return addrs
	}
	return nil
}

func (m *mockFacilitatorSigner) GetBalance(_ context.Context, _ tron.GetBalanceParams) (string, error) {
	return m.balance, m.balanceErr
}

func (m *mockFacilitatorSigner) VerifyTransaction(_ context.Context, _ tron.VerifyTransactionParams) (*tron.VerifyMessageResult, error) {
	return m.verifyResult, m.verifyErr
}

func (m *mockFacilitatorSigner) BroadcastTransaction(_ context.Context, _ string, _ string) (string, error) {
	return m.broadcastID, m.broadcastErr
}

func (m *mockFacilitatorSigner) WaitForTransaction(_ context.Context, _ tron.WaitForTransactionParams) (*tron.TransactionConfirmation, error) {
	return m.waitResult, m.waitErr
}

func (m *mockFacilitatorSigner) IsActivated(_ context.Context, _ string, _ string) (bool, error) {
	return m.isActivated, m.activatedErr
}

func validPayload() types.PaymentPayload {
	return types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"signedTransaction": "0a02abcdef",
			"authorization": map[string]interface{}{
				"from":            "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
				"to":              "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
				"contractAddress": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
				"amount":          "1000000",
				"expiration":      float64(time.Now().UnixMilli() + 300000),
				"refBlockBytes":   "abcd",
				"refBlockHash":    "1234567890abcdef",
				"timestamp":       float64(time.Now().UnixMilli()),
			},
		},
		Accepted: types.PaymentRequirements{
			Scheme:  tron.SchemeExact,
			Network: tron.TronMainnetCAIP2,
		},
	}
}

func validRequirements() types.PaymentRequirements {
	return types.PaymentRequirements{
		Scheme:  tron.SchemeExact,
		Network: tron.TronMainnetCAIP2,
		PayTo:   "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
		Amount:  "1000000",
		Asset:   "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
	}
}

func newValidMockSigner() *mockFacilitatorSigner {
	return &mockFacilitatorSigner{
		addresses: map[string][]string{
			tron.TronMainnetCAIP2: {"TFacilitator"},
		},
		balance:      "2000000",
		verifyResult: &tron.VerifyMessageResult{Valid: true},
		isActivated:  true,
	}
}

func TestScheme(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewExactTronScheme(signer)

	if scheme.Scheme() != "exact" {
		t.Errorf("Scheme() = %v, want exact", scheme.Scheme())
	}
}

func TestCaipFamily(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewExactTronScheme(signer)

	if scheme.CaipFamily() != "tron:*" {
		t.Errorf("CaipFamily() = %v, want tron:*", scheme.CaipFamily())
	}
}

func TestGetSigners(t *testing.T) {
	signer := &mockFacilitatorSigner{
		addresses: map[string][]string{
			tron.TronMainnetCAIP2: {"TFacilitator1", "TFacilitator2"},
		},
	}
	scheme := NewExactTronScheme(signer)

	signers := scheme.GetSigners(t402.Network(tron.TronMainnetCAIP2))
	if len(signers) != 2 {
		t.Errorf("GetSigners() = %v, want 2 addresses", signers)
	}
}

func TestGetExtra(t *testing.T) {
	signer := &mockFacilitatorSigner{
		addresses: map[string][]string{
			tron.TronMainnetCAIP2: {"TFacilitator"},
		},
	}
	scheme := NewExactTronScheme(signer)

	extra := scheme.GetExtra(t402.Network(tron.TronMainnetCAIP2))
	if extra == nil {
		t.Fatal("GetExtra(mainnet) returned nil")
	}
	if extra["symbol"] != "USDT" {
		t.Errorf("extra.symbol = %v, want USDT", extra["symbol"])
	}

	extra = scheme.GetExtra(t402.Network("tron:unknown"))
	if extra != nil {
		t.Errorf("GetExtra(unknown) = %v, want nil", extra)
	}
}

func TestVerify_Success(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewExactTronScheme(signer)

	resp, err := scheme.Verify(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Verify() error: %v", err)
	}
	if !resp.IsValid {
		t.Errorf("IsValid = false, InvalidReason: %s", resp.InvalidReason)
	}
}

func TestVerify_InvalidScheme(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewExactTronScheme(signer)

	payload := validPayload()
	payload.Accepted.Scheme = "wrong-scheme"

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
	scheme := NewExactTronScheme(signer)

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

func TestVerify_InvalidPayload(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewExactTronScheme(signer)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload:     map[string]interface{}{},
		Accepted: types.PaymentRequirements{
			Scheme:  tron.SchemeExact,
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

func TestVerify_TransactionVerificationError(t *testing.T) {
	signer := newValidMockSigner()
	signer.verifyErr = fmt.Errorf("RPC error")
	scheme := NewExactTronScheme(signer)

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

func TestVerify_TransactionVerificationInvalid(t *testing.T) {
	signer := newValidMockSigner()
	signer.verifyResult = &tron.VerifyMessageResult{
		Valid:  false,
		Reason: "bad_signature",
	}
	scheme := NewExactTronScheme(signer)

	resp, err := scheme.Verify(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
}

func TestVerify_AuthorizationExpired(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewExactTronScheme(signer)

	payload := validPayload()
	authMap := payload.Payload["authorization"].(map[string]interface{})
	authMap["expiration"] = float64(time.Now().UnixMilli() - 100000) // Already expired
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
	signer.balance = "500000"
	scheme := NewExactTronScheme(signer)

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

func TestVerify_InsufficientAmount(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewExactTronScheme(signer)

	payload := validPayload()
	authMap := payload.Payload["authorization"].(map[string]interface{})
	authMap["amount"] = "500000"
	payload.Payload["authorization"] = authMap

	resp, err := scheme.Verify(context.Background(), payload, validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "insufficient_amount" {
		t.Errorf("InvalidReason = %v, want insufficient_amount", resp.InvalidReason)
	}
}

func TestVerify_RecipientMismatch(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewExactTronScheme(signer)

	payload := validPayload()
	authMap := payload.Payload["authorization"].(map[string]interface{})
	authMap["to"] = "THPvaUhoh2Qn2y9THCZML3H4ABSMYUwEG9"
	payload.Payload["authorization"] = authMap

	resp, err := scheme.Verify(context.Background(), payload, validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "recipient_mismatch" {
		t.Errorf("InvalidReason = %v, want recipient_mismatch", resp.InvalidReason)
	}
}

func TestVerify_AccountNotActivated(t *testing.T) {
	signer := newValidMockSigner()
	signer.isActivated = false
	scheme := NewExactTronScheme(signer)

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
	signer.broadcastID = "tx_id_123"
	signer.waitResult = &tron.TransactionConfirmation{
		Success: true,
		TxId:    "final_tx_id",
	}
	scheme := NewExactTronScheme(signer)

	resp, err := scheme.Settle(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Settle() error: %v", err)
	}
	if !resp.Success {
		t.Errorf("Success = false, ErrorReason: %s", resp.ErrorReason)
	}
	if resp.Transaction != "final_tx_id" {
		t.Errorf("Transaction = %v, want final_tx_id", resp.Transaction)
	}
}

func TestSettle_VerificationFails(t *testing.T) {
	signer := newValidMockSigner()
	signer.verifyErr = fmt.Errorf("RPC error")
	scheme := NewExactTronScheme(signer)

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

func TestSettle_VerifyInvalid(t *testing.T) {
	signer := newValidMockSigner()
	signer.isActivated = false
	scheme := NewExactTronScheme(signer)

	resp, err := scheme.Settle(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Settle() unexpected error: %v", err)
	}
	if resp.Success {
		t.Error("expected Success = false")
	}
	if resp.ErrorReason != "account_not_activated" {
		t.Errorf("ErrorReason = %v, want account_not_activated", resp.ErrorReason)
	}
}

func TestSettle_BroadcastFailed(t *testing.T) {
	signer := newValidMockSigner()
	signer.broadcastErr = fmt.Errorf("broadcast error")
	scheme := NewExactTronScheme(signer)

	_, err := scheme.Settle(context.Background(), validPayload(), validRequirements())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	se, ok := err.(*t402.SettleError)
	if !ok {
		t.Fatalf("expected *t402.SettleError, got %T", err)
	}
	if se.Reason != "broadcast_failed" {
		t.Errorf("Reason = %v, want broadcast_failed", se.Reason)
	}
}
