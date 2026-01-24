package facilitator

import (
	"context"
	"math/big"
	"testing"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/evm"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockEvmSigner implements FacilitatorEvmSigner for testing
type mockEvmSigner struct {
	addresses  []string
	readResult interface{}
	readErr    error
	writeHash  string
	writeErr   error
	verifyOK   bool
	verifyErr  error
	receipt    *evm.TransactionReceipt
	receiptErr error
	balance    *big.Int
	balanceErr error
	chainID    *big.Int
	chainIDErr error
	code       []byte
	codeErr    error
	sendHash   string
	sendErr    error
}

func (m *mockEvmSigner) GetAddresses() []string                    { return m.addresses }
func (m *mockEvmSigner) GetChainID(_ context.Context) (*big.Int, error) { return m.chainID, m.chainIDErr }
func (m *mockEvmSigner) GetCode(_ context.Context, _ string) ([]byte, error) { return m.code, m.codeErr }
func (m *mockEvmSigner) SendTransaction(_ context.Context, _ string, _ []byte) (string, error) {
	return m.sendHash, m.sendErr
}

func (m *mockEvmSigner) ReadContract(_ context.Context, _ string, _ []byte, _ string, _ ...interface{}) (interface{}, error) {
	return m.readResult, m.readErr
}

func (m *mockEvmSigner) VerifyTypedData(_ context.Context, _ string, _ evm.TypedDataDomain, _ map[string][]evm.TypedDataField, _ string, _ map[string]interface{}, _ []byte) (bool, error) {
	return m.verifyOK, m.verifyErr
}

func (m *mockEvmSigner) WriteContract(_ context.Context, _ string, _ []byte, _ string, _ ...interface{}) (string, error) {
	return m.writeHash, m.writeErr
}

func (m *mockEvmSigner) WaitForTransactionReceipt(_ context.Context, _ string) (*evm.TransactionReceipt, error) {
	return m.receipt, m.receiptErr
}

func (m *mockEvmSigner) GetBalance(_ context.Context, _ string, _ string) (*big.Int, error) {
	return m.balance, m.balanceErr
}

func newValidMockSigner() *mockEvmSigner {
	return &mockEvmSigner{
		addresses:  []string{"0xC88f67e776f16DcFBf42e6bDda1B82604448899B"},
		balance:    big.NewInt(2000000),
		readResult: false, // nonce not used
		verifyOK:   true,
		writeHash:  "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
		receipt:    &evm.TransactionReceipt{Status: evm.TxStatusSuccess},
		chainID:    big.NewInt(8453),
		code:       nil,
	}
}

func TestScheme(t *testing.T) {
	signer := &mockEvmSigner{}
	scheme := NewExactEvmScheme(signer, nil)

	if scheme.Scheme() != "exact" {
		t.Errorf("Scheme() = %v, want exact", scheme.Scheme())
	}
}

func TestCaipFamily(t *testing.T) {
	signer := &mockEvmSigner{}
	scheme := NewExactEvmScheme(signer, nil)

	if scheme.CaipFamily() != "eip155:*" {
		t.Errorf("CaipFamily() = %v, want eip155:*", scheme.CaipFamily())
	}
}

func TestGetSigners(t *testing.T) {
	signer := &mockEvmSigner{
		addresses: []string{"0xAddr1", "0xAddr2"},
	}
	scheme := NewExactEvmScheme(signer, nil)

	signers := scheme.GetSigners(t402.Network("eip155:8453"))
	if len(signers) != 2 {
		t.Errorf("GetSigners() = %v, want 2 addresses", signers)
	}
}

func TestGetExtra(t *testing.T) {
	signer := &mockEvmSigner{}
	scheme := NewExactEvmScheme(signer, nil)

	// EVM GetExtra always returns nil
	extra := scheme.GetExtra(t402.Network("eip155:8453"))
	if extra != nil {
		t.Errorf("GetExtra() = %v, want nil", extra)
	}
}

func TestVerify_InvalidScheme(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewExactEvmScheme(signer, nil)

	payload := types.PaymentPayload{
		Payload: map[string]interface{}{},
		Accepted: types.PaymentRequirements{
			Scheme:  "wrong-scheme",
			Network: "eip155:8453",
		},
	}

	requirements := types.PaymentRequirements{
		Network: "eip155:8453",
	}

	_, err := scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T", err)
	}
	if ve.Reason != "invalid_scheme" {
		t.Errorf("Reason = %v, want invalid_scheme", ve.Reason)
	}
}

func TestVerify_NetworkMismatch(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewExactEvmScheme(signer, nil)

	payload := types.PaymentPayload{
		Payload: map[string]interface{}{},
		Accepted: types.PaymentRequirements{
			Scheme:  evm.SchemeExact,
			Network: "eip155:1",
		},
	}

	requirements := types.PaymentRequirements{
		Network: "eip155:8453",
	}

	_, err := scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T", err)
	}
	if ve.Reason != "network_mismatch" {
		t.Errorf("Reason = %v, want network_mismatch", ve.Reason)
	}
}

func TestVerify_InvalidPayload(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewExactEvmScheme(signer, nil)

	// When Payload is nil, PayloadFromMap returns an empty struct (no error),
	// and the code then hits missing_signature since Signature is empty
	payload := types.PaymentPayload{
		Payload: nil,
		Accepted: types.PaymentRequirements{
			Scheme:  evm.SchemeExact,
			Network: "eip155:8453",
		},
	}

	requirements := types.PaymentRequirements{
		Network: "eip155:8453",
	}

	_, err := scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T", err)
	}
	if ve.Reason != "missing_signature" {
		t.Errorf("Reason = %v, want missing_signature", ve.Reason)
	}
}

func TestVerify_MissingSignature(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewExactEvmScheme(signer, nil)

	payload := types.PaymentPayload{
		Payload: map[string]interface{}{
			"authorization": map[string]interface{}{
				"from":        "0xSender",
				"to":          "0xRecipient",
				"value":       "1000000",
				"validAfter":  "0",
				"validBefore": "9999999999",
				"nonce":       "0xabc",
			},
			// No signature
		},
		Accepted: types.PaymentRequirements{
			Scheme:  evm.SchemeExact,
			Network: "eip155:8453",
		},
	}

	requirements := types.PaymentRequirements{
		Network: "eip155:8453",
		Asset:   "USDT0",
	}

	_, err := scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T", err)
	}
	if ve.Reason != "missing_signature" {
		t.Errorf("Reason = %v, want missing_signature", ve.Reason)
	}
}

func TestVerify_RecipientMismatch(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewExactEvmScheme(signer, nil)

	payload := types.PaymentPayload{
		Payload: map[string]interface{}{
			"signature": "0x1234",
			"authorization": map[string]interface{}{
				"from":        "0xSender",
				"to":          "0xWrongRecipient",
				"value":       "1000000",
				"validAfter":  "0",
				"validBefore": "9999999999",
				"nonce":       "0xabc",
			},
		},
		Accepted: types.PaymentRequirements{
			Scheme:  evm.SchemeExact,
			Network: "eip155:8453",
		},
	}

	requirements := types.PaymentRequirements{
		Network: "eip155:8453",
		PayTo:   "0xCorrectRecipient",
		Amount:  "1000000",
		Asset:   "USDT0",
	}

	_, err := scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T", err)
	}
	if ve.Reason != "recipient_mismatch" {
		t.Errorf("Reason = %v, want recipient_mismatch", ve.Reason)
	}
}

func TestVerify_InsufficientAmount(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewExactEvmScheme(signer, nil)

	payload := types.PaymentPayload{
		Payload: map[string]interface{}{
			"signature": "0x1234",
			"authorization": map[string]interface{}{
				"from":        "0xSender",
				"to":          "0xRecipient",
				"value":       "500000", // Less than required
				"validAfter":  "0",
				"validBefore": "9999999999",
				"nonce":       "0xabc",
			},
		},
		Accepted: types.PaymentRequirements{
			Scheme:  evm.SchemeExact,
			Network: "eip155:8453",
		},
	}

	requirements := types.PaymentRequirements{
		Network: "eip155:8453",
		PayTo:   "0xRecipient",
		Amount:  "1000000",
		Asset:   "USDT0",
	}

	_, err := scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T", err)
	}
	if ve.Reason != "insufficient_amount" {
		t.Errorf("Reason = %v, want insufficient_amount", ve.Reason)
	}
}

func TestVerify_NonceAlreadyUsed(t *testing.T) {
	signer := newValidMockSigner()
	signer.readResult = true // Nonce already used
	scheme := NewExactEvmScheme(signer, nil)

	payload := types.PaymentPayload{
		Payload: map[string]interface{}{
			"signature": "0x1234",
			"authorization": map[string]interface{}{
				"from":        "0xSender",
				"to":          "0xRecipient",
				"value":       "1000000",
				"validAfter":  "0",
				"validBefore": "9999999999",
				"nonce":       "0x0000000000000000000000000000000000000000000000000000000000000001",
			},
		},
		Accepted: types.PaymentRequirements{
			Scheme:  evm.SchemeExact,
			Network: "eip155:8453",
		},
	}

	requirements := types.PaymentRequirements{
		Network: "eip155:8453",
		PayTo:   "0xRecipient",
		Amount:  "1000000",
		Asset:   "USDT0",
	}

	_, err := scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T: %v", err, err)
	}
	if ve.Reason != "nonce_already_used" {
		t.Errorf("Reason = %v, want nonce_already_used", ve.Reason)
	}
}

func TestVerify_InsufficientBalance(t *testing.T) {
	signer := newValidMockSigner()
	signer.balance = big.NewInt(100) // Much less than required
	scheme := NewExactEvmScheme(signer, nil)

	payload := types.PaymentPayload{
		Payload: map[string]interface{}{
			"signature": "0x1234",
			"authorization": map[string]interface{}{
				"from":        "0xSender",
				"to":          "0xRecipient",
				"value":       "1000000",
				"validAfter":  "0",
				"validBefore": "9999999999",
				"nonce":       "0x0000000000000000000000000000000000000000000000000000000000000001",
			},
		},
		Accepted: types.PaymentRequirements{
			Scheme:  evm.SchemeExact,
			Network: "eip155:8453",
		},
	}

	requirements := types.PaymentRequirements{
		Network: "eip155:8453",
		PayTo:   "0xRecipient",
		Amount:  "1000000",
		Asset:   "USDT0",
	}

	_, err := scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T: %v", err, err)
	}
	if ve.Reason != "insufficient_balance" {
		t.Errorf("Reason = %v, want insufficient_balance", ve.Reason)
	}
}

func TestSettle_VerifyFails(t *testing.T) {
	// Settle will fail because Verify fails first (invalid scheme)
	signer := newValidMockSigner()
	scheme := NewExactEvmScheme(signer, nil)

	payload := types.PaymentPayload{
		Payload: map[string]interface{}{},
		Accepted: types.PaymentRequirements{
			Scheme:  "wrong-scheme",
			Network: "eip155:8453",
		},
	}

	requirements := types.PaymentRequirements{
		Network: "eip155:8453",
		PayTo:   "0xRecipient",
		Amount:  "1000000",
		Asset:   "USDT0",
	}

	_, err := scheme.Settle(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("Settle() expected error, got nil")
	}

	se, ok := err.(*t402.SettleError)
	if !ok {
		t.Fatalf("expected *t402.SettleError, got %T: %v", err, err)
	}
	if se.Reason != "invalid_scheme" {
		t.Errorf("Reason = %v, want invalid_scheme", se.Reason)
	}
}

func TestNewExactEvmScheme_DefaultConfig(t *testing.T) {
	signer := &mockEvmSigner{}
	scheme := NewExactEvmScheme(signer, nil)

	if scheme.config.DeployERC4337WithEIP6492 {
		t.Error("DeployERC4337WithEIP6492 should default to false")
	}
}

func TestNewExactEvmScheme_CustomConfig(t *testing.T) {
	signer := &mockEvmSigner{}
	scheme := NewExactEvmScheme(signer, &ExactEvmSchemeConfig{
		DeployERC4337WithEIP6492: true,
	})

	if !scheme.config.DeployERC4337WithEIP6492 {
		t.Error("DeployERC4337WithEIP6492 should be true")
	}
}
