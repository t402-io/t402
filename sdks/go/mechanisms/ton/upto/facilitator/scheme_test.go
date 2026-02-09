package facilitator

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/ton"
	"github.com/t402-io/t402/sdks/go/mechanisms/ton/upto"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockFacilitatorSigner implements upto.UptoFacilitatorTonSigner for testing
type mockFacilitatorSigner struct {
	addresses        []string
	jettonBalance    string
	jettonBalanceErr error
	jettonWallet     string
	jettonWalletErr  error
	verifyResult     *upto.VerifyMessageResult
	verifyErr        error
	sendResult       string
	sendErr          error
	waitResult       *upto.TransactionConfirmation
	waitErr          error
	seqno            int64
	seqnoErr         error
	isDeployed       bool
	isDeployedErr    error
	transferResult   *upto.TransferJettonResult
	transferErr      error
}

func (m *mockFacilitatorSigner) GetAddresses(_ context.Context, _ string) []string {
	return m.addresses
}

func (m *mockFacilitatorSigner) GetJettonBalance(_ context.Context, _ upto.GetJettonBalanceParams) (string, error) {
	return m.jettonBalance, m.jettonBalanceErr
}

func (m *mockFacilitatorSigner) GetJettonWalletAddress(_ context.Context, _ upto.GetJettonWalletParams) (string, error) {
	return m.jettonWallet, m.jettonWalletErr
}

func (m *mockFacilitatorSigner) VerifyMessage(_ context.Context, _ upto.VerifyMessageParams) (*upto.VerifyMessageResult, error) {
	return m.verifyResult, m.verifyErr
}

func (m *mockFacilitatorSigner) SendExternalMessage(_ context.Context, _ string, _ string) (string, error) {
	return m.sendResult, m.sendErr
}

func (m *mockFacilitatorSigner) WaitForTransaction(_ context.Context, _ upto.WaitForTransactionParams) (*upto.TransactionConfirmation, error) {
	return m.waitResult, m.waitErr
}

func (m *mockFacilitatorSigner) GetSeqno(_ context.Context, _ string, _ string) (int64, error) {
	return m.seqno, m.seqnoErr
}

func (m *mockFacilitatorSigner) IsDeployed(_ context.Context, _ string, _ string) (bool, error) {
	return m.isDeployed, m.isDeployedErr
}

func (m *mockFacilitatorSigner) TransferJetton(_ context.Context, _ upto.TransferJettonParams) (*upto.TransferJettonResult, error) {
	return m.transferResult, m.transferErr
}

func newValidMockSigner() *mockFacilitatorSigner {
	return &mockFacilitatorSigner{
		addresses:     []string{"EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe"},
		jettonBalance: "10000000",
		verifyResult:  &upto.VerifyMessageResult{Valid: true},
		sendResult:    "tx_hash_broadcast_123",
		waitResult: &upto.TransactionConfirmation{
			Success: true,
			Hash:    "confirmed_tx_hash",
		},
		seqno:      5,
		isDeployed: true,
		transferResult: &upto.TransferJettonResult{
			Success: true,
			TxHash:  "merchant_tx_hash",
		},
	}
}

func validPayload() types.PaymentPayload {
	return types.PaymentPayload{
		T402Version: 2,
		Accepted: types.PaymentRequirements{
			Scheme:  "upto",
			Network: "ton:mainnet",
		},
		Payload: map[string]interface{}{
			"signedBoc": "te6cckEBAQEADgAAGIAAACAAAAAAAA+PiIgvxA==",
			"authorization": map[string]interface{}{
				"from":         "EQDtFpEwcFAEcRe5mLVh2N6C0x-_hJEM7W61_JLnSF74p4q2",
				"facilitator":  "EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe",
				"jettonMaster": "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
				"maxAmount":    "5000000",
				"tonAmount":    "100000000",
				"validUntil":   float64(time.Now().Unix() + 600),
				"seqno":        float64(5),
				"queryId":      "1234567890",
			},
			"paymentNonce": "0x1234567890abcdef",
		},
	}
}

func validRequirements() types.PaymentRequirements {
	return types.PaymentRequirements{
		Scheme:  "upto",
		Network: ton.TonMainnetCAIP2,
		PayTo:   "EQMerchantAddress1234567890abcdefghijklmnopq",
		Amount:  "1000000",
		Asset:   ton.USDTMainnetAddress,
	}
}

func TestScheme(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewUptoTonScheme(signer)

	if scheme.Scheme() != "upto" {
		t.Errorf("Scheme() = %v, want upto", scheme.Scheme())
	}
}

func TestCaipFamily(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewUptoTonScheme(signer)

	if scheme.CaipFamily() != "ton:*" {
		t.Errorf("CaipFamily() = %v, want ton:*", scheme.CaipFamily())
	}
}

func TestGetSigners(t *testing.T) {
	signer := &mockFacilitatorSigner{
		addresses: []string{"EQFacilitator1", "EQFacilitator2"},
	}
	scheme := NewUptoTonScheme(signer)

	signers := scheme.GetSigners(t402.Network(ton.TonMainnetCAIP2))
	if len(signers) != 2 {
		t.Fatalf("GetSigners() returned %d addresses, want 2", len(signers))
	}
	if signers[0] != "EQFacilitator1" {
		t.Errorf("signers[0] = %v, want EQFacilitator1", signers[0])
	}
	if signers[1] != "EQFacilitator2" {
		t.Errorf("signers[1] = %v, want EQFacilitator2", signers[1])
	}
}

func TestGetExtra(t *testing.T) {
	signer := &mockFacilitatorSigner{
		addresses: []string{"EQFacilitatorAddr"},
	}
	scheme := NewUptoTonScheme(signer)

	extra := scheme.GetExtra(t402.Network(ton.TonMainnetCAIP2))
	if extra == nil {
		t.Fatal("GetExtra(mainnet) returned nil")
	}
	if extra["defaultAsset"] != ton.USDTMainnetAddress {
		t.Errorf("extra.defaultAsset = %v, want %v", extra["defaultAsset"], ton.USDTMainnetAddress)
	}
	if extra["symbol"] != "USDT" {
		t.Errorf("extra.symbol = %v, want USDT", extra["symbol"])
	}
	if extra["decimals"] != 6 {
		t.Errorf("extra.decimals = %v, want 6", extra["decimals"])
	}
	if extra["facilitator"] != "EQFacilitatorAddr" {
		t.Errorf("extra.facilitator = %v, want EQFacilitatorAddr", extra["facilitator"])
	}

	// Unknown network should return nil
	extra = scheme.GetExtra(t402.Network("ton:unknown"))
	if extra != nil {
		t.Errorf("GetExtra(unknown) = %v, want nil", extra)
	}
}

func TestVerify_Success(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoTonScheme(signer)

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
	scheme := NewUptoTonScheme(signer)

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
	scheme := NewUptoTonScheme(signer)

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

func TestVerify_UnsupportedNetwork(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoTonScheme(signer)

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
	scheme := NewUptoTonScheme(signer)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload:     map[string]interface{}{},
		Accepted: types.PaymentRequirements{
			Scheme:  "upto",
			Network: ton.TonMainnetCAIP2,
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

func TestVerify_InvalidBocFormat(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoTonScheme(signer)

	payload := validPayload()
	payload.Payload["signedBoc"] = "not-valid-base64!!!"

	resp, err := scheme.Verify(context.Background(), payload, validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "invalid_boc_format" {
		t.Errorf("InvalidReason = %v, want invalid_boc_format", resp.InvalidReason)
	}
}

func TestVerify_InvalidFacilitatorAddress(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoTonScheme(signer)

	payload := validPayload()
	authMap := payload.Payload["authorization"].(map[string]interface{})
	authMap["facilitator"] = "EQDifferentFacilitatorAddress"
	payload.Payload["authorization"] = authMap

	resp, err := scheme.Verify(context.Background(), payload, validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "invalid_facilitator" {
		t.Errorf("InvalidReason = %v, want invalid_facilitator", resp.InvalidReason)
	}
}

func TestVerify_MessageVerificationFailed(t *testing.T) {
	signer := newValidMockSigner()
	signer.verifyErr = fmt.Errorf("RPC error")
	scheme := NewUptoTonScheme(signer)

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

func TestVerify_MessageVerificationInvalid(t *testing.T) {
	signer := newValidMockSigner()
	signer.verifyResult = &upto.VerifyMessageResult{
		Valid:  false,
		Reason: "invalid_signature",
	}
	scheme := NewUptoTonScheme(signer)

	resp, err := scheme.Verify(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if !strings.Contains(resp.InvalidReason, "message_verification_failed") {
		t.Errorf("InvalidReason = %v, want to contain message_verification_failed", resp.InvalidReason)
	}
}

func TestVerify_ExpiredAuthorization(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoTonScheme(signer)

	payload := validPayload()
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
	signer.jettonBalance = "500000" // Less than required 1000000
	scheme := NewUptoTonScheme(signer)

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

func TestVerify_InsufficientApprovedAmount(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoTonScheme(signer)

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
	scheme := NewUptoTonScheme(signer)

	payload := validPayload()
	authMap := payload.Payload["authorization"].(map[string]interface{})
	authMap["jettonMaster"] = "EQDifferentJettonMasterAddress"
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

func TestVerify_SeqnoAlreadyUsed(t *testing.T) {
	signer := newValidMockSigner()
	signer.seqno = 10 // Higher than payload seqno of 5
	scheme := NewUptoTonScheme(signer)

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

func TestVerify_SeqnoTooHigh(t *testing.T) {
	signer := newValidMockSigner()
	signer.seqno = 3 // Lower than payload seqno of 5
	scheme := NewUptoTonScheme(signer)

	resp, err := scheme.Verify(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "seqno_too_high" {
		t.Errorf("InvalidReason = %v, want seqno_too_high", resp.InvalidReason)
	}
}

func TestVerify_WalletNotDeployed(t *testing.T) {
	signer := newValidMockSigner()
	signer.isDeployed = false
	scheme := NewUptoTonScheme(signer)

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
	scheme := NewUptoTonScheme(signer)

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
	if resp.Network != t402.Network(ton.TonMainnetCAIP2) {
		t.Errorf("Network = %v, want %v", resp.Network, ton.TonMainnetCAIP2)
	}
}

func TestSettle_VerificationFailed(t *testing.T) {
	signer := newValidMockSigner()
	signer.verifyErr = fmt.Errorf("RPC error")
	scheme := NewUptoTonScheme(signer)

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

func TestSettle_BroadcastFailed(t *testing.T) {
	signer := newValidMockSigner()
	signer.sendErr = fmt.Errorf("broadcast error")
	scheme := NewUptoTonScheme(signer)

	_, err := scheme.Settle(context.Background(), validPayload(), validRequirements())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	se, ok := err.(*t402.SettleError)
	if !ok {
		t.Fatalf("expected *t402.SettleError, got %T: %v", err, err)
	}
	if se.Reason != "client_transfer_failed" {
		t.Errorf("Reason = %v, want client_transfer_failed", se.Reason)
	}
}
