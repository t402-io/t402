package facilitator

import (
	"context"
	"encoding/json"
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

func makeExtra(name, version string) *json.RawMessage {
	data, _ := json.Marshal(map[string]interface{}{
		"name":    name,
		"version": version,
	})
	raw := json.RawMessage(data)
	return &raw
}

func TestScheme(t *testing.T) {
	signer := &mockEvmSigner{}
	scheme := NewExactEvmSchemeV1(signer, nil)

	if scheme.Scheme() != "exact" {
		t.Errorf("Scheme() = %v, want exact", scheme.Scheme())
	}
}

func TestCaipFamily(t *testing.T) {
	signer := &mockEvmSigner{}
	scheme := NewExactEvmSchemeV1(signer, nil)

	if scheme.CaipFamily() != "eip155:*" {
		t.Errorf("CaipFamily() = %v, want eip155:*", scheme.CaipFamily())
	}
}

func TestGetSigners(t *testing.T) {
	signer := &mockEvmSigner{
		addresses: []string{"0xAddr1", "0xAddr2"},
	}
	scheme := NewExactEvmSchemeV1(signer, nil)

	signers := scheme.GetSigners(t402.Network("eip155:8453"))
	if len(signers) != 2 {
		t.Errorf("GetSigners() = %v, want 2 addresses", signers)
	}
}

func TestGetExtra(t *testing.T) {
	signer := &mockEvmSigner{}
	scheme := NewExactEvmSchemeV1(signer, nil)

	extra := scheme.GetExtra(t402.Network("eip155:8453"))
	if extra != nil {
		t.Errorf("GetExtra() = %v, want nil", extra)
	}
}

func TestVerify_InvalidScheme(t *testing.T) {
	signer := &mockEvmSigner{
		addresses: []string{"0xFacilitator"},
	}
	scheme := NewExactEvmSchemeV1(signer, nil)

	payload := types.PaymentPayloadV1{
		T402Version: 1,
		Scheme:      "wrong-scheme",
		Network:     "eip155:8453",
		Payload:     map[string]interface{}{},
	}

	requirements := types.PaymentRequirementsV1{
		Scheme:  evm.SchemeExact,
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
	if ve.Reason != "unsupported_scheme" {
		t.Errorf("Reason = %v, want unsupported_scheme", ve.Reason)
	}
}

func TestVerify_NetworkMismatch(t *testing.T) {
	signer := &mockEvmSigner{
		addresses: []string{"0xFacilitator"},
	}
	scheme := NewExactEvmSchemeV1(signer, nil)

	payload := types.PaymentPayloadV1{
		T402Version: 1,
		Scheme:      evm.SchemeExact,
		Network:     "eip155:1",
		Payload:     map[string]interface{}{},
	}

	requirements := types.PaymentRequirementsV1{
		Scheme:  evm.SchemeExact,
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
	signer := &mockEvmSigner{
		addresses: []string{"0xFacilitator"},
	}
	scheme := NewExactEvmSchemeV1(signer, nil)

	// When Payload is nil, PayloadFromMap returns an empty struct (no error),
	// and the code then hits missing_signature since Signature is empty
	payload := types.PaymentPayloadV1{
		T402Version: 1,
		Scheme:      evm.SchemeExact,
		Network:     "eip155:8453",
		Payload:     nil,
	}

	requirements := types.PaymentRequirementsV1{
		Scheme:  evm.SchemeExact,
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
	signer := &mockEvmSigner{
		addresses: []string{"0xFacilitator"},
	}
	scheme := NewExactEvmSchemeV1(signer, nil)

	payload := types.PaymentPayloadV1{
		T402Version: 1,
		Scheme:      evm.SchemeExact,
		Network:     "eip155:8453",
		Payload: map[string]interface{}{
			"authorization": map[string]interface{}{
				"from":  "0xSender",
				"to":    "0xRecipient",
				"value": "1000000",
			},
		},
	}

	requirements := types.PaymentRequirementsV1{
		Scheme:  evm.SchemeExact,
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
	signer := &mockEvmSigner{
		addresses: []string{"0xFacilitator"},
		balance:   big.NewInt(2000000),
	}
	scheme := NewExactEvmSchemeV1(signer, nil)

	payload := types.PaymentPayloadV1{
		T402Version: 1,
		Scheme:      evm.SchemeExact,
		Network:     "eip155:8453",
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
	}

	requirements := types.PaymentRequirementsV1{
		Scheme:            evm.SchemeExact,
		Network:           "eip155:8453",
		PayTo:             "0xCorrectRecipient",
		MaxAmountRequired: "1000000",
		Asset:             "USDT0",
		Extra:             makeExtra("USDT0", "2"),
	}

	_, err := scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T", err)
	}
	if ve.Reason != "invalid_exact_evm_payload_recipient_mismatch" {
		t.Errorf("Reason = %v, want invalid_exact_evm_payload_recipient_mismatch", ve.Reason)
	}
}

func TestVerify_InsufficientAmount(t *testing.T) {
	signer := &mockEvmSigner{
		addresses: []string{"0xFacilitator"},
		balance:   big.NewInt(2000000),
	}
	scheme := NewExactEvmSchemeV1(signer, nil)

	payload := types.PaymentPayloadV1{
		T402Version: 1,
		Scheme:      evm.SchemeExact,
		Network:     "eip155:8453",
		Payload: map[string]interface{}{
			"signature": "0x1234",
			"authorization": map[string]interface{}{
				"from":        "0xSender",
				"to":          "0xRecipient",
				"value":       "500000",
				"validAfter":  "0",
				"validBefore": "9999999999",
				"nonce":       "0xabc",
			},
		},
	}

	requirements := types.PaymentRequirementsV1{
		Scheme:            evm.SchemeExact,
		Network:           "eip155:8453",
		PayTo:             "0xRecipient",
		MaxAmountRequired: "1000000",
		Asset:             "USDT0",
		Extra:             makeExtra("USDT0", "2"),
	}

	_, err := scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T", err)
	}
	if ve.Reason != "invalid_exact_evm_payload_authorization_value" {
		t.Errorf("Reason = %v, want invalid_exact_evm_payload_authorization_value", ve.Reason)
	}
}

func TestVerify_MissingEIP712Domain(t *testing.T) {
	signer := &mockEvmSigner{
		addresses: []string{"0xFacilitator"},
		balance:   big.NewInt(2000000),
	}
	scheme := NewExactEvmSchemeV1(signer, nil)

	payload := types.PaymentPayloadV1{
		T402Version: 1,
		Scheme:      evm.SchemeExact,
		Network:     "eip155:8453",
		Payload: map[string]interface{}{
			"signature": "0x1234",
			"authorization": map[string]interface{}{
				"from":        "0xSender",
				"to":          "0xRecipient",
				"value":       "1000000",
				"validAfter":  "0",
				"validBefore": "9999999999",
				"nonce":       "0xabc",
			},
		},
	}

	requirements := types.PaymentRequirementsV1{
		Scheme:            evm.SchemeExact,
		Network:           "eip155:8453",
		PayTo:             "0xRecipient",
		MaxAmountRequired: "1000000",
		Asset:             "USDT0",
		Extra:             nil, // No EIP-712 domain
	}

	_, err := scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T", err)
	}
	if ve.Reason != "missing_eip712_domain" {
		t.Errorf("Reason = %v, want missing_eip712_domain", ve.Reason)
	}
}

func TestNewExactEvmSchemeV1_DefaultConfig(t *testing.T) {
	signer := &mockEvmSigner{}
	scheme := NewExactEvmSchemeV1(signer, nil)

	if scheme.config.DeployERC4337WithEIP6492 {
		t.Error("DeployERC4337WithEIP6492 should default to false")
	}
}

func TestNewExactEvmSchemeV1_CustomConfig(t *testing.T) {
	signer := &mockEvmSigner{}
	scheme := NewExactEvmSchemeV1(signer, &ExactEvmSchemeV1Config{
		DeployERC4337WithEIP6492: true,
	})

	if !scheme.config.DeployERC4337WithEIP6492 {
		t.Error("DeployERC4337WithEIP6492 should be true")
	}
}
