package facilitator

import (
	"context"
	"fmt"
	"testing"
	"time"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/ton"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockFacilitatorSigner implements FacilitatorTonSigner for testing
type mockFacilitatorSigner struct {
	addresses      map[string][]string
	balance        string
	balanceErr     error
	walletAddr     string
	walletAddrErr  error
	verifyResult   *ton.VerifyMessageResult
	verifyErr      error
	sendResult     string
	sendErr        error
	waitResult     *ton.TransactionConfirmation
	waitErr        error
	seqno          int64
	seqnoErr       error
	isDeployed     bool
	isDeployedErr  error
}

func (m *mockFacilitatorSigner) GetAddresses(_ context.Context, network string) []string {
	if addrs, ok := m.addresses[network]; ok {
		return addrs
	}
	return nil
}

func (m *mockFacilitatorSigner) GetJettonBalance(_ context.Context, _ ton.GetJettonBalanceParams) (string, error) {
	return m.balance, m.balanceErr
}

func (m *mockFacilitatorSigner) GetJettonWalletAddress(_ context.Context, _ ton.GetJettonWalletParams) (string, error) {
	return m.walletAddr, m.walletAddrErr
}

func (m *mockFacilitatorSigner) VerifyMessage(_ context.Context, _ ton.VerifyMessageParams) (*ton.VerifyMessageResult, error) {
	return m.verifyResult, m.verifyErr
}

func (m *mockFacilitatorSigner) SendExternalMessage(_ context.Context, _ string, _ string) (string, error) {
	return m.sendResult, m.sendErr
}

func (m *mockFacilitatorSigner) WaitForTransaction(_ context.Context, _ ton.WaitForTransactionParams) (*ton.TransactionConfirmation, error) {
	return m.waitResult, m.waitErr
}

func (m *mockFacilitatorSigner) GetSeqno(_ context.Context, _ string, _ string) (int64, error) {
	return m.seqno, m.seqnoErr
}

func (m *mockFacilitatorSigner) IsDeployed(_ context.Context, _ string, _ string) (bool, error) {
	return m.isDeployed, m.isDeployedErr
}

func validPayload() types.PaymentPayload {
	return types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"signedBoc": "te6cckEBAQEADgAAGIAAACAAAAAAAA+PiIgvxA==",
			"authorization": map[string]interface{}{
				"from":         "EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2",
				"to":           "EQC88f67e776f16dcfbf42e6bdda1b82604448899b",
				"jettonMaster": "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
				"jettonAmount": "1000000",
				"tonAmount":    "100000000",
				"validUntil":   float64(time.Now().Unix() + 300),
				"seqno":        float64(5),
				"queryId":      "123456789",
			},
		},
		Accepted: types.PaymentRequirements{
			Scheme:  ton.SchemeExact,
			Network: ton.TonMainnetCAIP2,
		},
	}
}

func validRequirements() types.PaymentRequirements {
	return types.PaymentRequirements{
		Scheme:  ton.SchemeExact,
		Network: ton.TonMainnetCAIP2,
		PayTo:   "EQC88f67e776f16dcfbf42e6bdda1b82604448899b",
		Amount:  "1000000",
		Asset:   "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
	}
}

func newValidMockSigner() *mockFacilitatorSigner {
	return &mockFacilitatorSigner{
		addresses: map[string][]string{
			ton.TonMainnetCAIP2: {"EQFacilitator"},
		},
		balance:    "2000000",
		verifyResult: &ton.VerifyMessageResult{Valid: true},
		seqno:      5,
		isDeployed: true,
	}
}

func TestScheme(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewExactTonScheme(signer)

	if scheme.Scheme() != "exact" {
		t.Errorf("Scheme() = %v, want exact", scheme.Scheme())
	}
}

func TestCaipFamily(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewExactTonScheme(signer)

	if scheme.CaipFamily() != "ton:*" {
		t.Errorf("CaipFamily() = %v, want ton:*", scheme.CaipFamily())
	}
}

func TestGetSigners(t *testing.T) {
	signer := &mockFacilitatorSigner{
		addresses: map[string][]string{
			ton.TonMainnetCAIP2: {"EQFacilitator1", "EQFacilitator2"},
		},
	}
	scheme := NewExactTonScheme(signer)

	signers := scheme.GetSigners(t402.Network(ton.TonMainnetCAIP2))
	if len(signers) != 2 {
		t.Errorf("GetSigners() = %v, want 2 addresses", signers)
	}
}

func TestGetExtra(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewExactTonScheme(signer)

	extra := scheme.GetExtra(t402.Network(ton.TonMainnetCAIP2))
	if extra == nil {
		t.Fatal("GetExtra(mainnet) returned nil")
	}
	if extra["symbol"] != "USDT" {
		t.Errorf("extra.symbol = %v, want USDT", extra["symbol"])
	}

	extra = scheme.GetExtra(t402.Network("ton:unknown"))
	if extra != nil {
		t.Errorf("GetExtra(unknown) = %v, want nil", extra)
	}
}

func TestVerify_Success(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewExactTonScheme(signer)

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
	scheme := NewExactTonScheme(signer)

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
	scheme := NewExactTonScheme(signer)

	payload := validPayload()
	payload.Accepted.Network = ton.TonTestnetCAIP2

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
	scheme := NewExactTonScheme(signer)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			// Missing required fields
		},
		Accepted: types.PaymentRequirements{
			Scheme:  ton.SchemeExact,
			Network: ton.TonMainnetCAIP2,
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

func TestVerify_MessageVerificationFailed(t *testing.T) {
	signer := newValidMockSigner()
	signer.verifyResult = &ton.VerifyMessageResult{
		Valid:  false,
		Reason: "invalid_signature",
	}
	scheme := NewExactTonScheme(signer)

	resp, err := scheme.Verify(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
}

func TestVerify_MessageVerificationError(t *testing.T) {
	signer := newValidMockSigner()
	signer.verifyErr = fmt.Errorf("RPC error")
	scheme := NewExactTonScheme(signer)

	_, err := scheme.Verify(context.Background(), validPayload(), validRequirements())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T", err)
	}
	if ve.Reason != "message_verification_failed" {
		t.Errorf("Reason = %v, want message_verification_failed", ve.Reason)
	}
}

func TestVerify_AuthorizationExpired(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewExactTonScheme(signer)

	payload := validPayload()
	// Set validUntil to past
	authMap := payload.Payload["authorization"].(map[string]interface{})
	authMap["validUntil"] = float64(time.Now().Unix() - 100)
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
	scheme := NewExactTonScheme(signer)

	resp, err := scheme.Verify(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "insufficient_jetton_balance" {
		t.Errorf("InvalidReason = %v, want insufficient_jetton_balance", resp.InvalidReason)
	}
}

func TestVerify_InsufficientAmount(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewExactTonScheme(signer)

	payload := validPayload()
	authMap := payload.Payload["authorization"].(map[string]interface{})
	authMap["jettonAmount"] = "500000" // Less than required 1000000
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
	scheme := NewExactTonScheme(signer)

	payload := validPayload()
	authMap := payload.Payload["authorization"].(map[string]interface{})
	authMap["to"] = "EQDifferentAddress"
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

func TestVerify_SeqnoAlreadyUsed(t *testing.T) {
	signer := newValidMockSigner()
	signer.seqno = 10 // Higher than payload seqno of 5
	scheme := NewExactTonScheme(signer)

	resp, err := scheme.Verify(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "seqno_already_used" {
		t.Errorf("InvalidReason = %v, want seqno_already_used", resp.InvalidReason)
	}
}

func TestVerify_WalletNotDeployed(t *testing.T) {
	signer := newValidMockSigner()
	signer.isDeployed = false
	scheme := NewExactTonScheme(signer)

	resp, err := scheme.Verify(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "wallet_not_deployed" {
		t.Errorf("InvalidReason = %v, want wallet_not_deployed", resp.InvalidReason)
	}
}

func TestSettle_Success(t *testing.T) {
	signer := newValidMockSigner()
	signer.sendResult = "tx_hash_123"
	signer.waitResult = &ton.TransactionConfirmation{
		Success: true,
		Hash:    "final_tx_hash",
	}
	scheme := NewExactTonScheme(signer)

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
	scheme := NewExactTonScheme(signer)

	_, err := scheme.Settle(context.Background(), validPayload(), validRequirements())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	se, ok := err.(*t402.SettleError)
	if !ok {
		t.Fatalf("expected *t402.SettleError, got %T: %v", err, err)
	}
	if se.Reason != "message_verification_failed" {
		t.Errorf("Reason = %v, want message_verification_failed", se.Reason)
	}
}

func TestSettle_VerifyInvalid(t *testing.T) {
	signer := newValidMockSigner()
	signer.isDeployed = false
	scheme := NewExactTonScheme(signer)

	resp, err := scheme.Settle(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Settle() unexpected error: %v", err)
	}
	if resp.Success {
		t.Error("expected Success = false")
	}
	if resp.ErrorReason != "wallet_not_deployed" {
		t.Errorf("ErrorReason = %v, want wallet_not_deployed", resp.ErrorReason)
	}
}

func TestSettle_BroadcastFailed(t *testing.T) {
	signer := newValidMockSigner()
	signer.sendErr = fmt.Errorf("broadcast error")
	scheme := NewExactTonScheme(signer)

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

// mockFacilitatorSignerWithStatus implements both FacilitatorTonSigner and TransactionStatusChecker
type mockFacilitatorSignerWithStatus struct {
	mockFacilitatorSigner
	txStatus    ton.TransactionStatus
	txStatusErr error
}

func (m *mockFacilitatorSignerWithStatus) GetTransactionStatus(_ context.Context, _ string, _ string) (ton.TransactionStatus, error) {
	return m.txStatus, m.txStatusErr
}

func TestSettle_WithStatusChecker_Confirmed(t *testing.T) {
	signer := &mockFacilitatorSignerWithStatus{
		mockFacilitatorSigner: *newValidMockSigner(),
		txStatus:              ton.TransactionStatusConfirmed,
	}
	signer.sendResult = "tx_hash_123"
	signer.waitResult = &ton.TransactionConfirmation{
		Success: true,
		Hash:    "final_tx_hash",
	}
	scheme := NewExactTonScheme(signer)

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
		txStatus:              ton.TransactionStatusFailed,
	}
	signer.sendResult = "tx_hash_123"
	signer.waitResult = &ton.TransactionConfirmation{
		Success: true,
		Hash:    "final_tx_hash",
	}
	scheme := NewExactTonScheme(signer)

	resp, err := scheme.Settle(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Settle() unexpected error: %v", err)
	}
	if resp.Success {
		t.Error("expected Success = false for failed Jetton transfer")
	}
	if resp.ErrorReason != "jetton_transfer_failed" {
		t.Errorf("ErrorReason = %v, want jetton_transfer_failed", resp.ErrorReason)
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
	signer.sendResult = "tx_hash_123"
	signer.waitResult = &ton.TransactionConfirmation{
		Success: true,
		Hash:    "final_tx_hash",
	}
	scheme := NewExactTonScheme(signer)

	resp, err := scheme.Settle(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Settle() error: %v", err)
	}
	if !resp.Success {
		t.Errorf("Success should be true when status check errors (best-effort), got ErrorReason: %s", resp.ErrorReason)
	}
}

func TestTransactionStatus_Constants(t *testing.T) {
	if ton.TransactionStatusPending != "pending" {
		t.Errorf("TransactionStatusPending = %v, want pending", ton.TransactionStatusPending)
	}
	if ton.TransactionStatusConfirmed != "confirmed" {
		t.Errorf("TransactionStatusConfirmed = %v, want confirmed", ton.TransactionStatusConfirmed)
	}
	if ton.TransactionStatusFailed != "failed" {
		t.Errorf("TransactionStatusFailed = %v, want failed", ton.TransactionStatusFailed)
	}
}
