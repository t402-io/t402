package facilitator

import (
	"context"
	"fmt"
	"testing"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/stellar"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockFacilitatorSigner implements FacilitatorStellarSigner for testing
type mockFacilitatorSigner struct {
	addresses     map[string][]string
	balance       string
	balanceErr    error
	verifyResult  *stellar.VerifyTransactionResult
	verifyErr     error
	submitResult  string
	submitErr     error
	waitResult    *stellar.TransactionConfirmation
	waitErr       error
	currentLedger int64
	ledgerErr     error
	accountExists bool
	accountErr    error
}

func (m *mockFacilitatorSigner) GetAddresses(_ context.Context, network string) []string {
	if addrs, ok := m.addresses[network]; ok {
		return addrs
	}
	return nil
}

func (m *mockFacilitatorSigner) GetTokenBalance(_ context.Context, _ stellar.GetTokenBalanceParams) (string, error) {
	return m.balance, m.balanceErr
}

func (m *mockFacilitatorSigner) VerifyTransaction(_ context.Context, _ stellar.VerifyTransactionParams) (*stellar.VerifyTransactionResult, error) {
	return m.verifyResult, m.verifyErr
}

func (m *mockFacilitatorSigner) SubmitTransaction(_ context.Context, _ string, _ string) (string, error) {
	return m.submitResult, m.submitErr
}

func (m *mockFacilitatorSigner) WaitForTransaction(_ context.Context, _ stellar.WaitForTransactionParams) (*stellar.TransactionConfirmation, error) {
	return m.waitResult, m.waitErr
}

func (m *mockFacilitatorSigner) GetCurrentLedger(_ context.Context, _ string) (int64, error) {
	return m.currentLedger, m.ledgerErr
}

func (m *mockFacilitatorSigner) AccountExists(_ context.Context, _ string, _ string) (bool, error) {
	return m.accountExists, m.accountErr
}

func validPayload() types.PaymentPayload {
	return types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"signedXdr": "AAAAAQAAAAA=",
			"authorization": map[string]interface{}{
				"from":          "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAEANBER24HLOOMVHPZ5GYK",
				"to":            "GBDEVU63Y6NTHJQQZIKVTC2LSQLMEAIFYRP2XAJDDQVWRDQJLEVLWM36",
				"tokenContract": "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI",
				"amount":        "10000000",
				"maxLedger":     float64(50000100),
				"network":       stellar.StellarPubnetCAIP2,
			},
		},
		Accepted: types.PaymentRequirements{
			Scheme:  stellar.SchemeExact,
			Network: stellar.StellarPubnetCAIP2,
		},
	}
}

func validRequirements() types.PaymentRequirements {
	return types.PaymentRequirements{
		Scheme:  stellar.SchemeExact,
		Network: stellar.StellarPubnetCAIP2,
		PayTo:   "GBDEVU63Y6NTHJQQZIKVTC2LSQLMEAIFYRP2XAJDDQVWRDQJLEVLWM36",
		Amount:  "10000000",
		Asset:   "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI",
	}
}

func newValidMockSigner() *mockFacilitatorSigner {
	return &mockFacilitatorSigner{
		addresses: map[string][]string{
			stellar.StellarPubnetCAIP2: {"GFacilitator"},
		},
		balance:       "20000000",
		verifyResult:  &stellar.VerifyTransactionResult{Valid: true},
		currentLedger: 50000000,
		accountExists: true,
	}
}

func TestScheme(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewExactStellarScheme(signer)

	if scheme.Scheme() != "exact" {
		t.Errorf("Scheme() = %v, want exact", scheme.Scheme())
	}
}

func TestCaipFamily(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewExactStellarScheme(signer)

	if scheme.CaipFamily() != "stellar:*" {
		t.Errorf("CaipFamily() = %v, want stellar:*", scheme.CaipFamily())
	}
}

func TestGetSigners(t *testing.T) {
	signer := &mockFacilitatorSigner{
		addresses: map[string][]string{
			stellar.StellarPubnetCAIP2: {"GFacilitator1", "GFacilitator2"},
		},
	}
	scheme := NewExactStellarScheme(signer)

	signers := scheme.GetSigners(t402.Network(stellar.StellarPubnetCAIP2))
	if len(signers) != 2 {
		t.Errorf("GetSigners() = %v, want 2 addresses", signers)
	}
}

func TestGetExtra(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewExactStellarScheme(signer)

	extra := scheme.GetExtra(t402.Network(stellar.StellarPubnetCAIP2))
	if extra == nil {
		t.Fatal("GetExtra(pubnet) returned nil")
	}
	if extra["symbol"] != "USDC" {
		t.Errorf("extra.symbol = %v, want USDC", extra["symbol"])
	}

	extra = scheme.GetExtra(t402.Network("stellar:unknown"))
	if extra != nil {
		t.Errorf("GetExtra(unknown) = %v, want nil", extra)
	}
}

func TestVerify_Success(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewExactStellarScheme(signer)

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

func TestVerify_InvalidScheme(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewExactStellarScheme(signer)

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
	scheme := NewExactStellarScheme(signer)

	payload := validPayload()
	payload.Accepted.Network = stellar.StellarTestnetCAIP2

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
	scheme := NewExactStellarScheme(signer)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload:     map[string]interface{}{},
		Accepted: types.PaymentRequirements{
			Scheme:  stellar.SchemeExact,
			Network: stellar.StellarPubnetCAIP2,
		},
	}

	requirements := validRequirements()
	resp, err := scheme.Verify(context.Background(), payload, requirements)
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

func TestVerify_TransactionVerificationFailed(t *testing.T) {
	signer := newValidMockSigner()
	signer.verifyResult = &stellar.VerifyTransactionResult{
		Valid:  false,
		Reason: "invalid_signature",
	}
	scheme := NewExactStellarScheme(signer)

	resp, err := scheme.Verify(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
}

func TestVerify_TransactionVerificationError(t *testing.T) {
	signer := newValidMockSigner()
	signer.verifyErr = fmt.Errorf("RPC error")
	scheme := NewExactStellarScheme(signer)

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

func TestVerify_TransactionExpired(t *testing.T) {
	signer := newValidMockSigner()
	signer.currentLedger = 50000200 // Higher than maxLedger of 50000100
	scheme := NewExactStellarScheme(signer)

	resp, err := scheme.Verify(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "transaction_expired" {
		t.Errorf("InvalidReason = %v, want transaction_expired", resp.InvalidReason)
	}
}

func TestVerify_InsufficientBalance(t *testing.T) {
	signer := newValidMockSigner()
	signer.balance = "5000000" // Less than required 10000000
	scheme := NewExactStellarScheme(signer)

	resp, err := scheme.Verify(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "insufficient_token_balance" {
		t.Errorf("InvalidReason = %v, want insufficient_token_balance", resp.InvalidReason)
	}
}

func TestVerify_InsufficientAmount(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewExactStellarScheme(signer)

	payload := validPayload()
	authMap := payload.Payload["authorization"].(map[string]interface{})
	authMap["amount"] = "5000000" // Less than required 10000000
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
	scheme := NewExactStellarScheme(signer)

	payload := validPayload()
	authMap := payload.Payload["authorization"].(map[string]interface{})
	authMap["to"] = "GDIFFERENTADDRESSDIFFERENTADDRESSDIFFERENTADDRESSDIFFERE"
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

func TestVerify_AccountNotFound(t *testing.T) {
	signer := newValidMockSigner()
	signer.accountExists = false
	scheme := NewExactStellarScheme(signer)

	resp, err := scheme.Verify(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "account_not_found" {
		t.Errorf("InvalidReason = %v, want account_not_found", resp.InvalidReason)
	}
}

func TestSettle_Success(t *testing.T) {
	signer := newValidMockSigner()
	signer.submitResult = "tx_hash_123"
	signer.waitResult = &stellar.TransactionConfirmation{
		Success: true,
		Hash:    "final_tx_hash",
	}
	scheme := NewExactStellarScheme(signer)

	resp, err := scheme.Settle(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Settle() error: %v", err)
	}
	if !resp.Success {
		t.Errorf("Success = false, ErrorReason: %s", resp.ErrorReason)
	}
	if resp.Transaction != "final_tx_hash" {
		t.Errorf("Transaction = %v, want final_tx_hash", resp.Transaction)
	}
}

func TestSettle_VerificationFails(t *testing.T) {
	signer := newValidMockSigner()
	signer.verifyErr = fmt.Errorf("RPC error")
	scheme := NewExactStellarScheme(signer)

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
	signer.accountExists = false
	scheme := NewExactStellarScheme(signer)

	resp, err := scheme.Settle(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Settle() unexpected error: %v", err)
	}
	if resp.Success {
		t.Error("expected Success = false")
	}
	if resp.ErrorReason != "account_not_found" {
		t.Errorf("ErrorReason = %v, want account_not_found", resp.ErrorReason)
	}
}

func TestSettle_SubmitFailed(t *testing.T) {
	signer := newValidMockSigner()
	signer.submitErr = fmt.Errorf("submit error")
	scheme := NewExactStellarScheme(signer)

	_, err := scheme.Settle(context.Background(), validPayload(), validRequirements())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	se, ok := err.(*t402.SettleError)
	if !ok {
		t.Fatalf("expected *t402.SettleError, got %T", err)
	}
	if se.Reason != "transaction_failed" {
		t.Errorf("Reason = %v, want transaction_failed", se.Reason)
	}
}

// mockFacilitatorSignerWithStatus implements both FacilitatorStellarSigner and TransactionStatusChecker
type mockFacilitatorSignerWithStatus struct {
	mockFacilitatorSigner
	txStatus    stellar.TransactionStatus
	txStatusErr error
}

func (m *mockFacilitatorSignerWithStatus) GetTransactionStatus(_ context.Context, _ string, _ string) (stellar.TransactionStatus, error) {
	return m.txStatus, m.txStatusErr
}

func TestSettle_WithStatusChecker_Confirmed(t *testing.T) {
	signer := &mockFacilitatorSignerWithStatus{
		mockFacilitatorSigner: *newValidMockSigner(),
		txStatus:              stellar.TransactionStatusConfirmed,
	}
	signer.submitResult = "tx_hash_123"
	signer.waitResult = &stellar.TransactionConfirmation{
		Success: true,
		Hash:    "final_tx_hash",
	}
	scheme := NewExactStellarScheme(signer)

	resp, err := scheme.Settle(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Settle() error: %v", err)
	}
	if !resp.Success {
		t.Errorf("Success = false, ErrorReason: %s", resp.ErrorReason)
	}
	if resp.Transaction != "final_tx_hash" {
		t.Errorf("Transaction = %v, want final_tx_hash", resp.Transaction)
	}
}

func TestSettle_WithStatusChecker_Failed(t *testing.T) {
	signer := &mockFacilitatorSignerWithStatus{
		mockFacilitatorSigner: *newValidMockSigner(),
		txStatus:              stellar.TransactionStatusFailed,
	}
	signer.submitResult = "tx_hash_123"
	signer.waitResult = &stellar.TransactionConfirmation{
		Success: true,
		Hash:    "final_tx_hash",
	}
	scheme := NewExactStellarScheme(signer)

	resp, err := scheme.Settle(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Settle() unexpected error: %v", err)
	}
	if resp.Success {
		t.Error("expected Success = false for failed token transfer")
	}
	if resp.ErrorReason != "token_transfer_failed" {
		t.Errorf("ErrorReason = %v, want token_transfer_failed", resp.ErrorReason)
	}
	if resp.Transaction != "final_tx_hash" {
		t.Errorf("Transaction = %v, want final_tx_hash", resp.Transaction)
	}
}

func TestSettle_WithStatusChecker_Error_FallsBack(t *testing.T) {
	signer := &mockFacilitatorSignerWithStatus{
		mockFacilitatorSigner: *newValidMockSigner(),
		txStatusErr:           fmt.Errorf("status check failed"),
	}
	signer.submitResult = "tx_hash_123"
	signer.waitResult = &stellar.TransactionConfirmation{
		Success: true,
		Hash:    "final_tx_hash",
	}
	scheme := NewExactStellarScheme(signer)

	resp, err := scheme.Settle(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Settle() error: %v", err)
	}
	if !resp.Success {
		t.Errorf("Success should be true when status check errors (best-effort), got ErrorReason: %s", resp.ErrorReason)
	}
}

func TestTransactionStatus_Constants(t *testing.T) {
	if stellar.TransactionStatusPending != "pending" {
		t.Errorf("TransactionStatusPending = %v, want pending", stellar.TransactionStatusPending)
	}
	if stellar.TransactionStatusConfirmed != "confirmed" {
		t.Errorf("TransactionStatusConfirmed = %v, want confirmed", stellar.TransactionStatusConfirmed)
	}
	if stellar.TransactionStatusFailed != "failed" {
		t.Errorf("TransactionStatusFailed = %v, want failed", stellar.TransactionStatusFailed)
	}
}
