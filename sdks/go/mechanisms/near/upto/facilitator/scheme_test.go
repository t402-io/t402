package facilitator

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/near"
	"github.com/t402-io/t402/sdks/go/mechanisms/near/upto"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockFacilitatorSigner implements upto.UptoFacilitatorNearSigner for testing
type mockFacilitatorSigner struct {
	addresses      []string
	queryTxResult  *upto.TransactionResult
	queryTxErr     error
	balance        string
	balanceErr     error
	ftTransferTx   string
	ftTransferErr  error
	waitErr        error
}

func (m *mockFacilitatorSigner) GetAddresses(_ context.Context, _ string) []string {
	return m.addresses
}

func (m *mockFacilitatorSigner) QueryTransaction(_ context.Context, _ string, _ string) (*upto.TransactionResult, error) {
	return m.queryTxResult, m.queryTxErr
}

func (m *mockFacilitatorSigner) GetBalance(_ context.Context, _ string, _ string) (string, error) {
	return m.balance, m.balanceErr
}

func (m *mockFacilitatorSigner) FtTransfer(_ context.Context, _ upto.FtTransferParams) (string, error) {
	if m.ftTransferErr != nil {
		return "", m.ftTransferErr
	}
	return m.ftTransferTx, nil
}

func (m *mockFacilitatorSigner) WaitForTransaction(_ context.Context, _ string, _ string) error {
	return m.waitErr
}

// makeFtTransferArgsB64 creates base64-encoded ft_transfer args as json.RawMessage.
// The facilitator code first tries base64 decoding string(Args), then falls back to raw JSON.
// NEAR RPC returns args as a base64-encoded string, so we store the raw base64 bytes
// (without JSON quotes) so that string(Args) is a valid base64 string.
func makeFtTransferArgsB64(receiverID, amount string) json.RawMessage {
	args := upto.FtTransferArgs{
		ReceiverID: receiverID,
		Amount:     amount,
	}
	jsonBytes, _ := json.Marshal(args)
	b64 := base64.StdEncoding.EncodeToString(jsonBytes)
	return json.RawMessage(b64)
}

// makeFtTransferArgsRaw creates raw JSON ft_transfer args as json.RawMessage (fallback path).
func makeFtTransferArgsRaw(receiverID, amount string) json.RawMessage {
	args := upto.FtTransferArgs{
		ReceiverID: receiverID,
		Amount:     amount,
	}
	jsonBytes, _ := json.Marshal(args)
	return jsonBytes
}

func newValidMockSigner() *mockFacilitatorSigner {
	successVal := ""

	return &mockFacilitatorSigner{
		addresses: []string{"facilitator.near"},
		queryTxResult: &upto.TransactionResult{
			Status: upto.TransactionStatus{
				SuccessValue: &successVal,
			},
			Transaction: upto.Transaction{
				Hash:       "6eFxSCv6TzLbvGBRPaKHcLcfJGHEgH7x5T1aQT4qwZgt",
				SignerID:   "alice.near",
				ReceiverID: "usdt.tether-token.near",
				Actions: []upto.Action{
					{
						FunctionCall: &upto.FunctionCallAction{
							MethodName: near.FunctionFtTransfer,
							Args:       makeFtTransferArgsRaw("facilitator.near", "5000000"),
							Gas:        30000000000000,
							Deposit:    "1",
						},
					},
				},
			},
		},
		balance:      "10000000",
		ftTransferTx: "merchant_tx_hash_456",
	}
}

func validPayload() types.PaymentPayload {
	return types.PaymentPayload{
		T402Version: 2,
		Accepted: types.PaymentRequirements{
			Scheme:  "upto",
			Network: "near:mainnet",
		},
		Payload: map[string]interface{}{
			"txHash": "6eFxSCv6TzLbvGBRPaKHcLcfJGHEgH7x5T1aQT4qwZgt",
			"authorization": map[string]interface{}{
				"from":          "alice.near",
				"facilitator":   "facilitator.near",
				"tokenContract": "usdt.tether-token.near",
				"maxAmount":     "5000000",
			},
			"paymentNonce": "0x1234567890abcdef",
		},
	}
}

func validRequirements() types.PaymentRequirements {
	return types.PaymentRequirements{
		Scheme:  "upto",
		Network: near.NearMainnetCAIP2,
		PayTo:   "bob.near",
		Amount:  "1000000",
		Asset:   "usdt.tether-token.near",
	}
}

func TestScheme(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewUptoNearScheme(signer)

	if scheme.Scheme() != "upto" {
		t.Errorf("Scheme() = %v, want upto", scheme.Scheme())
	}
}

func TestCaipFamily(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewUptoNearScheme(signer)

	if scheme.CaipFamily() != "near:*" {
		t.Errorf("CaipFamily() = %v, want near:*", scheme.CaipFamily())
	}
}

func TestGetSigners(t *testing.T) {
	signer := &mockFacilitatorSigner{
		addresses: []string{"facilitator1.near", "facilitator2.near"},
	}
	scheme := NewUptoNearScheme(signer)

	signers := scheme.GetSigners(t402.Network(near.NearMainnetCAIP2))
	if len(signers) != 2 {
		t.Fatalf("GetSigners() returned %d addresses, want 2", len(signers))
	}
	if signers[0] != "facilitator1.near" {
		t.Errorf("signers[0] = %v, want facilitator1.near", signers[0])
	}
	if signers[1] != "facilitator2.near" {
		t.Errorf("signers[1] = %v, want facilitator2.near", signers[1])
	}
}

func TestGetExtra(t *testing.T) {
	signer := &mockFacilitatorSigner{
		addresses: []string{"facilitator.near"},
	}
	scheme := NewUptoNearScheme(signer)

	extra := scheme.GetExtra(t402.Network(near.NearMainnetCAIP2))
	if extra == nil {
		t.Fatal("GetExtra(mainnet) returned nil")
	}
	if extra["assetSymbol"] != "USDC" {
		t.Errorf("extra.assetSymbol = %v, want USDC", extra["assetSymbol"])
	}
	if extra["assetDecimals"] != 6 {
		t.Errorf("extra.assetDecimals = %v, want 6", extra["assetDecimals"])
	}
	if extra["facilitator"] != "facilitator.near" {
		t.Errorf("extra.facilitator = %v, want facilitator.near", extra["facilitator"])
	}

	// Unknown network should return nil
	extra = scheme.GetExtra(t402.Network("near:unknown"))
	if extra != nil {
		t.Errorf("GetExtra(unknown) = %v, want nil", extra)
	}
}

func TestVerify_Success(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoNearScheme(signer)

	resp, err := scheme.Verify(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Verify() error: %v", err)
	}
	if !resp.IsValid {
		t.Errorf("IsValid = false, InvalidReason: %s", resp.InvalidReason)
	}
	if resp.Payer != "alice.near" {
		t.Errorf("Payer = %v, want alice.near", resp.Payer)
	}
}

func TestVerify_WrongScheme(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoNearScheme(signer)

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
	scheme := NewUptoNearScheme(signer)

	payload := validPayload()
	payload.Accepted.Network = near.NearTestnetCAIP2

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
	scheme := NewUptoNearScheme(signer)

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
	scheme := NewUptoNearScheme(signer)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload:     map[string]interface{}{},
		Accepted: types.PaymentRequirements{
			Scheme:  "upto",
			Network: near.NearMainnetCAIP2,
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

func TestVerify_TransactionAlreadyUsed(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoNearScheme(signer)

	// Verify once to mark the tx as used
	resp, err := scheme.Settle(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Settle() error: %v", err)
	}
	if !resp.Success {
		t.Fatalf("Settle() not successful: %s", resp.ErrorReason)
	}

	// Second verify should fail with transaction_already_used
	resp2, err := scheme.Verify(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp2.IsValid {
		t.Error("expected IsValid = false for already used transaction")
	}
	if resp2.InvalidReason != "transaction_already_used" {
		t.Errorf("InvalidReason = %v, want transaction_already_used", resp2.InvalidReason)
	}
}

func TestVerify_InvalidFacilitator(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoNearScheme(signer)

	payload := validPayload()
	authMap := payload.Payload["authorization"].(map[string]interface{})
	authMap["facilitator"] = "different.facilitator.near"
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

func TestVerify_TransactionNotFound(t *testing.T) {
	signer := newValidMockSigner()
	signer.queryTxErr = fmt.Errorf("transaction not found")
	scheme := NewUptoNearScheme(signer)

	_, err := scheme.Verify(context.Background(), validPayload(), validRequirements())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T", err)
	}
	if ve.Reason != "transaction_not_found" {
		t.Errorf("Reason = %v, want transaction_not_found", ve.Reason)
	}
}

func TestVerify_TransactionFailed(t *testing.T) {
	signer := newValidMockSigner()
	signer.queryTxResult.Status = upto.TransactionStatus{
		SuccessValue: nil,
		Failure:      json.RawMessage(`{"ActionError":"something"}`),
	}
	scheme := NewUptoNearScheme(signer)

	resp, err := scheme.Verify(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "transaction_failed" {
		t.Errorf("InvalidReason = %v, want transaction_failed", resp.InvalidReason)
	}
}

func TestVerify_WrongTokenContract(t *testing.T) {
	signer := newValidMockSigner()
	// Transaction was sent to wrong token contract
	signer.queryTxResult.Transaction.ReceiverID = "wrong.token.near"
	scheme := NewUptoNearScheme(signer)

	resp, err := scheme.Verify(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "wrong_token_contract" {
		t.Errorf("InvalidReason = %v, want wrong_token_contract", resp.InvalidReason)
	}
}

func TestVerify_NoFtTransferAction(t *testing.T) {
	signer := newValidMockSigner()
	// Remove all actions
	signer.queryTxResult.Transaction.Actions = []upto.Action{}
	scheme := NewUptoNearScheme(signer)

	resp, err := scheme.Verify(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "no_ft_transfer_action" {
		t.Errorf("InvalidReason = %v, want no_ft_transfer_action", resp.InvalidReason)
	}
}

func TestVerify_WrongRecipient(t *testing.T) {
	signer := newValidMockSigner()
	// Change the ft_transfer args to have a different recipient
	signer.queryTxResult.Transaction.Actions = []upto.Action{
		{
			FunctionCall: &upto.FunctionCallAction{
				MethodName: near.FunctionFtTransfer,
				Args:       makeFtTransferArgsRaw("wrong.recipient.near", "5000000"),
				Gas:        30000000000000,
				Deposit:    "1",
			},
		},
	}
	scheme := NewUptoNearScheme(signer)

	resp, err := scheme.Verify(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "wrong_recipient" {
		t.Errorf("InvalidReason = %v, want wrong_recipient", resp.InvalidReason)
	}
}

func TestVerify_AmountMismatch(t *testing.T) {
	signer := newValidMockSigner()
	// Change ft_transfer args to have a different amount than maxAmount in authorization
	signer.queryTxResult.Transaction.Actions = []upto.Action{
		{
			FunctionCall: &upto.FunctionCallAction{
				MethodName: near.FunctionFtTransfer,
				Args:       makeFtTransferArgsRaw("facilitator.near", "3000000"), // different from 5000000 in authorization
				Gas:        30000000000000,
				Deposit:    "1",
			},
		},
	}
	scheme := NewUptoNearScheme(signer)

	resp, err := scheme.Verify(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "amount_mismatch" {
		t.Errorf("InvalidReason = %v, want amount_mismatch", resp.InvalidReason)
	}
}

func TestVerify_InsufficientAmount(t *testing.T) {
	signer := newValidMockSigner()
	// Set maxAmount less than required amount
	signer.queryTxResult.Transaction.Actions = []upto.Action{
		{
			FunctionCall: &upto.FunctionCallAction{
				MethodName: near.FunctionFtTransfer,
				Args:       makeFtTransferArgsRaw("facilitator.near", "500000"), // less than required 1000000
				Gas:        30000000000000,
				Deposit:    "1",
			},
		},
	}
	scheme := NewUptoNearScheme(signer)

	payload := validPayload()
	authMap := payload.Payload["authorization"].(map[string]interface{})
	authMap["maxAmount"] = "500000"
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

func TestVerify_AssetMismatch(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoNearScheme(signer)

	payload := validPayload()
	authMap := payload.Payload["authorization"].(map[string]interface{})
	authMap["tokenContract"] = "wrong.token.near"
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

func TestVerify_InvalidMaxAmount(t *testing.T) {
	signer := newValidMockSigner()
	// Set the ft_transfer args to have matching but invalid maxAmount
	signer.queryTxResult.Transaction.Actions = []upto.Action{
		{
			FunctionCall: &upto.FunctionCallAction{
				MethodName: near.FunctionFtTransfer,
				Args:       makeFtTransferArgsRaw("facilitator.near", "not-a-number"),
				Gas:        30000000000000,
				Deposit:    "1",
			},
		},
	}
	scheme := NewUptoNearScheme(signer)

	payload := validPayload()
	authMap := payload.Payload["authorization"].(map[string]interface{})
	authMap["maxAmount"] = "not-a-number"
	payload.Payload["authorization"] = authMap

	resp, err := scheme.Verify(context.Background(), payload, validRequirements())
	if err != nil {
		t.Fatalf("Verify() unexpected error: %v", err)
	}
	if resp.IsValid {
		t.Error("expected IsValid = false")
	}
	if resp.InvalidReason != "invalid_max_amount" {
		t.Errorf("InvalidReason = %v, want invalid_max_amount", resp.InvalidReason)
	}
}

func TestVerify_WrongSchemeInRequirements(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoNearScheme(signer)

	requirements := validRequirements()
	requirements.Scheme = "exact"

	resp, err := scheme.Verify(context.Background(), validPayload(), requirements)
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

func TestSettle_Success(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewUptoNearScheme(signer)

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
	if resp.Transaction != "merchant_tx_hash_456" {
		t.Errorf("Transaction = %v, want merchant_tx_hash_456", resp.Transaction)
	}
	if resp.Payer != "alice.near" {
		t.Errorf("Payer = %v, want alice.near", resp.Payer)
	}
	if resp.Network != t402.Network(near.NearMainnetCAIP2) {
		t.Errorf("Network = %v, want %v", resp.Network, near.NearMainnetCAIP2)
	}
}

func TestSettle_VerificationFailed(t *testing.T) {
	signer := newValidMockSigner()
	signer.queryTxErr = fmt.Errorf("RPC error")
	scheme := NewUptoNearScheme(signer)

	_, err := scheme.Settle(context.Background(), validPayload(), validRequirements())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	se, ok := err.(*t402.SettleError)
	if !ok {
		t.Fatalf("expected *t402.SettleError, got %T: %v", err, err)
	}
	if se.Reason != "transaction_not_found" {
		t.Errorf("Reason = %v, want transaction_not_found", se.Reason)
	}
}

func TestSettle_VerifyReturnsInvalid(t *testing.T) {
	signer := newValidMockSigner()
	// Change transaction status to failure
	signer.queryTxResult.Status = upto.TransactionStatus{
		SuccessValue: nil,
		Failure:      json.RawMessage(`{"ActionError":"something"}`),
	}
	scheme := NewUptoNearScheme(signer)

	resp, err := scheme.Settle(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Settle() unexpected error: %v", err)
	}
	if resp.Success {
		t.Error("expected Success = false")
	}
	if resp.ErrorReason != "transaction_failed" {
		t.Errorf("ErrorReason = %v, want transaction_failed", resp.ErrorReason)
	}
}

func TestSettle_MerchantTransferFailed(t *testing.T) {
	signer := newValidMockSigner()
	signer.ftTransferErr = fmt.Errorf("transfer to merchant failed")
	scheme := NewUptoNearScheme(signer)

	_, err := scheme.Settle(context.Background(), validPayload(), validRequirements())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	se, ok := err.(*t402.SettleError)
	if !ok {
		t.Fatalf("expected *t402.SettleError, got %T: %v", err, err)
	}
	if se.Reason != "merchant_transfer_failed" {
		t.Errorf("Reason = %v, want merchant_transfer_failed", se.Reason)
	}
}

func TestSettle_MerchantTransferConfirmationFailed(t *testing.T) {
	signer := newValidMockSigner()
	signer.waitErr = fmt.Errorf("confirmation timeout")
	scheme := NewUptoNearScheme(signer)

	_, err := scheme.Settle(context.Background(), validPayload(), validRequirements())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	se, ok := err.(*t402.SettleError)
	if !ok {
		t.Fatalf("expected *t402.SettleError, got %T: %v", err, err)
	}
	if se.Reason != "merchant_transfer_confirmation_failed" {
		t.Errorf("Reason = %v, want merchant_transfer_confirmation_failed", se.Reason)
	}
}

func TestSettle_SettleFullAmount(t *testing.T) {
	signer := newValidMockSigner()
	// Track the ft_transfer params
	var capturedParams []upto.FtTransferParams
	originalFtTransfer := signer.ftTransferTx

	capturingSigner := &capturingFacilitatorSigner{
		mockFacilitatorSigner: *signer,
		capturedParams:        &capturedParams,
	}
	capturingSigner.ftTransferTx = originalFtTransfer

	scheme := NewUptoNearScheme(capturingSigner, &UptoNearSchemeConfig{
		SettleFullAmount: true,
	})

	resp, err := scheme.Settle(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Settle() error: %v", err)
	}
	if !resp.Success {
		t.Errorf("Success = false, ErrorReason: %s", resp.ErrorReason)
	}

	// When SettleFullAmount is true, the merchant should receive maxAmount (5000000)
	// and there should be no refund
	if len(capturedParams) < 1 {
		t.Fatal("expected at least 1 ft_transfer call")
	}
	// Merchant transfer should use maxAmount
	if capturedParams[0].Amount != "5000000" {
		t.Errorf("merchant transfer amount = %v, want 5000000 (maxAmount)", capturedParams[0].Amount)
	}
}

func TestSettle_WithRefund(t *testing.T) {
	signer := newValidMockSigner()
	var capturedParams []upto.FtTransferParams

	capturingSigner := &capturingFacilitatorSigner{
		mockFacilitatorSigner: *signer,
		capturedParams:        &capturedParams,
	}
	capturingSigner.ftTransferTx = signer.ftTransferTx

	scheme := NewUptoNearScheme(capturingSigner)

	resp, err := scheme.Settle(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Settle() error: %v", err)
	}
	if !resp.Success {
		t.Errorf("Success = false, ErrorReason: %s", resp.ErrorReason)
	}

	// maxAmount = 5000000, settleAmount = 1000000, refund = 4000000
	if len(capturedParams) < 2 {
		t.Fatalf("expected at least 2 ft_transfer calls (merchant + refund), got %d", len(capturedParams))
	}

	// First call: merchant transfer
	if capturedParams[0].Amount != "1000000" {
		t.Errorf("merchant transfer amount = %v, want 1000000", capturedParams[0].Amount)
	}
	if capturedParams[0].ReceiverID != "bob.near" {
		t.Errorf("merchant transfer receiverID = %v, want bob.near", capturedParams[0].ReceiverID)
	}

	// Second call: refund to client
	if capturedParams[1].Amount != "4000000" {
		t.Errorf("refund amount = %v, want 4000000", capturedParams[1].Amount)
	}
	if capturedParams[1].ReceiverID != "alice.near" {
		t.Errorf("refund receiverID = %v, want alice.near", capturedParams[1].ReceiverID)
	}
}

func TestSettle_NoRefundWhenAmountsEqual(t *testing.T) {
	signer := newValidMockSigner()
	var capturedParams []upto.FtTransferParams

	capturingSigner := &capturingFacilitatorSigner{
		mockFacilitatorSigner: *signer,
		capturedParams:        &capturedParams,
	}
	capturingSigner.ftTransferTx = signer.ftTransferTx

	scheme := NewUptoNearScheme(capturingSigner)

	// Set amount equal to maxAmount so no refund is needed
	requirements := validRequirements()
	requirements.Amount = "5000000" // same as maxAmount

	resp, err := scheme.Settle(context.Background(), validPayload(), requirements)
	if err != nil {
		t.Fatalf("Settle() error: %v", err)
	}
	if !resp.Success {
		t.Errorf("Success = false, ErrorReason: %s", resp.ErrorReason)
	}

	// Only 1 ft_transfer: merchant transfer (no refund needed)
	if len(capturedParams) != 1 {
		t.Errorf("expected 1 ft_transfer call (merchant only), got %d", len(capturedParams))
	}
}

func TestSettle_MemoFormat(t *testing.T) {
	signer := newValidMockSigner()
	var capturedParams []upto.FtTransferParams

	capturingSigner := &capturingFacilitatorSigner{
		mockFacilitatorSigner: *signer,
		capturedParams:        &capturedParams,
	}
	capturingSigner.ftTransferTx = signer.ftTransferTx

	scheme := NewUptoNearScheme(capturingSigner)

	resp, err := scheme.Settle(context.Background(), validPayload(), validRequirements())
	if err != nil {
		t.Fatalf("Settle() error: %v", err)
	}
	if !resp.Success {
		t.Fatalf("Settle() not successful: %s", resp.ErrorReason)
	}

	// Verify merchant transfer memo
	if len(capturedParams) < 1 {
		t.Fatal("expected at least 1 ft_transfer call")
	}
	if !strings.HasPrefix(capturedParams[0].Memo, "t402-settle:") {
		t.Errorf("merchant transfer memo = %v, want prefix 't402-settle:'", capturedParams[0].Memo)
	}

	// Verify refund memo
	if len(capturedParams) >= 2 {
		if !strings.HasPrefix(capturedParams[1].Memo, "t402-refund:") {
			t.Errorf("refund memo = %v, want prefix 't402-refund:'", capturedParams[1].Memo)
		}
	}
}

func TestNewUptoNearScheme_DefaultConfig(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewUptoNearScheme(signer)

	if scheme == nil {
		t.Fatal("NewUptoNearScheme() returned nil")
	}
	if scheme.config == nil {
		t.Fatal("config should not be nil")
	}
}

func TestNewUptoNearScheme_WithConfig(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewUptoNearScheme(signer, &UptoNearSchemeConfig{
		SettleFullAmount: true,
	})

	if scheme == nil {
		t.Fatal("NewUptoNearScheme() returned nil")
	}
	if !scheme.config.SettleFullAmount {
		t.Error("SettleFullAmount should be true")
	}
}

func TestMockSignerImplementsInterface(t *testing.T) {
	var _ upto.UptoFacilitatorNearSigner = &mockFacilitatorSigner{}
	var _ upto.UptoFacilitatorNearSigner = &capturingFacilitatorSigner{}
}

// capturingFacilitatorSigner wraps mockFacilitatorSigner to capture FtTransfer calls
type capturingFacilitatorSigner struct {
	mockFacilitatorSigner
	capturedParams *[]upto.FtTransferParams
}

func (m *capturingFacilitatorSigner) FtTransfer(ctx context.Context, params upto.FtTransferParams) (string, error) {
	*m.capturedParams = append(*m.capturedParams, params)
	return m.mockFacilitatorSigner.FtTransfer(ctx, params)
}
