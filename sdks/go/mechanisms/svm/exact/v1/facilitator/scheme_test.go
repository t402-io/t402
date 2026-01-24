package facilitator

import (
	"context"
	"encoding/json"
	"testing"

	solana "github.com/gagliardetto/solana-go"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/svm"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockSvmSigner implements FacilitatorSvmSigner for testing
type mockSvmSigner struct {
	addresses   map[string][]solana.PublicKey
	signErr     error
	simulateErr error
	sendSig     solana.Signature
	sendErr     error
	confirmErr  error
}

func (m *mockSvmSigner) GetAddresses(_ context.Context, network string) []solana.PublicKey {
	if addrs, ok := m.addresses[network]; ok {
		return addrs
	}
	return nil
}

func (m *mockSvmSigner) SignTransaction(_ context.Context, _ *solana.Transaction, _ solana.PublicKey, _ string) error {
	return m.signErr
}

func (m *mockSvmSigner) SimulateTransaction(_ context.Context, _ *solana.Transaction, _ string) error {
	return m.simulateErr
}

func (m *mockSvmSigner) SendTransaction(_ context.Context, _ *solana.Transaction, _ string) (solana.Signature, error) {
	return m.sendSig, m.sendErr
}

func (m *mockSvmSigner) ConfirmTransaction(_ context.Context, _ solana.Signature, _ string) error {
	return m.confirmErr
}

func newValidMockSigner() *mockSvmSigner {
	feePayer := solana.NewWallet().PublicKey()
	return &mockSvmSigner{
		addresses: map[string][]solana.PublicKey{
			svm.SolanaMainnetCAIP2: {feePayer},
		},
	}
}

func makeExtraV1(feePayer string) *json.RawMessage {
	data, _ := json.Marshal(map[string]interface{}{
		"feePayer": feePayer,
	})
	raw := json.RawMessage(data)
	return &raw
}

func TestScheme(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewExactSvmSchemeV1(signer)

	if scheme.Scheme() != "exact" {
		t.Errorf("Scheme() = %v, want exact", scheme.Scheme())
	}
}

func TestCaipFamily(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewExactSvmSchemeV1(signer)

	if scheme.CaipFamily() != "solana:*" {
		t.Errorf("CaipFamily() = %v, want solana:*", scheme.CaipFamily())
	}
}

func TestGetSigners(t *testing.T) {
	feePayer1 := solana.NewWallet().PublicKey()
	feePayer2 := solana.NewWallet().PublicKey()
	signer := &mockSvmSigner{
		addresses: map[string][]solana.PublicKey{
			svm.SolanaMainnetCAIP2: {feePayer1, feePayer2},
		},
	}
	scheme := NewExactSvmSchemeV1(signer)

	signers := scheme.GetSigners(t402.Network(svm.SolanaMainnetCAIP2))
	if len(signers) != 2 {
		t.Errorf("GetSigners() returned %d addresses, want 2", len(signers))
	}
}

func TestGetExtra(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewExactSvmSchemeV1(signer)

	extra := scheme.GetExtra(t402.Network(svm.SolanaMainnetCAIP2))
	if extra == nil {
		t.Fatal("GetExtra(mainnet) returned nil")
	}
	if _, ok := extra["feePayer"]; !ok {
		t.Error("GetExtra() should contain feePayer key")
	}
}

func TestVerify_InvalidScheme(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewExactSvmSchemeV1(signer)

	payload := types.PaymentPayloadV1{
		T402Version: 1,
		Scheme:      "wrong-scheme",
		Network:     svm.SolanaMainnetCAIP2,
		Payload:     map[string]interface{}{},
	}

	requirements := types.PaymentRequirementsV1{
		Scheme:  svm.SchemeExact,
		Network: svm.SolanaMainnetCAIP2,
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
	signer := newValidMockSigner()
	scheme := NewExactSvmSchemeV1(signer)

	payload := types.PaymentPayloadV1{
		T402Version: 1,
		Scheme:      svm.SchemeExact,
		Network:     svm.SolanaDevnetCAIP2,
		Payload:     map[string]interface{}{},
	}

	requirements := types.PaymentRequirementsV1{
		Scheme:  svm.SchemeExact,
		Network: svm.SolanaMainnetCAIP2,
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

func TestVerify_MissingFeePayer(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewExactSvmSchemeV1(signer)

	payload := types.PaymentPayloadV1{
		T402Version: 1,
		Scheme:      svm.SchemeExact,
		Network:     svm.SolanaMainnetCAIP2,
		Payload: map[string]interface{}{
			"transaction": "AQAAAA==",
		},
	}

	requirements := types.PaymentRequirementsV1{
		Scheme:  svm.SchemeExact,
		Network: svm.SolanaMainnetCAIP2,
		Extra:   nil, // No extra means no feePayer
	}

	_, err := scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T", err)
	}
	if ve.Reason != "invalid_exact_solana_payload_missing_fee_payer" {
		t.Errorf("Reason = %v, want invalid_exact_solana_payload_missing_fee_payer", ve.Reason)
	}
}

func TestVerify_FeePayerNotManaged(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewExactSvmSchemeV1(signer)

	payload := types.PaymentPayloadV1{
		T402Version: 1,
		Scheme:      svm.SchemeExact,
		Network:     svm.SolanaMainnetCAIP2,
		Payload: map[string]interface{}{
			"transaction": "AQAAAA==",
		},
	}

	requirements := types.PaymentRequirementsV1{
		Scheme:  svm.SchemeExact,
		Network: svm.SolanaMainnetCAIP2,
		Extra:   makeExtraV1("RandomUnmanagedAddress1111111111111111111111111"),
	}

	_, err := scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T", err)
	}
	if ve.Reason != "fee_payer_not_managed_by_facilitator" {
		t.Errorf("Reason = %v, want fee_payer_not_managed_by_facilitator", ve.Reason)
	}
}

func TestVerify_InvalidTransaction(t *testing.T) {
	feePayer := solana.NewWallet().PublicKey()
	signer := &mockSvmSigner{
		addresses: map[string][]solana.PublicKey{
			svm.SolanaMainnetCAIP2: {feePayer},
		},
	}
	scheme := NewExactSvmSchemeV1(signer)

	payload := types.PaymentPayloadV1{
		T402Version: 1,
		Scheme:      svm.SchemeExact,
		Network:     svm.SolanaMainnetCAIP2,
		Payload: map[string]interface{}{
			"transaction": "invalid-base64!!!",
		},
	}

	requirements := types.PaymentRequirementsV1{
		Scheme:  svm.SchemeExact,
		Network: svm.SolanaMainnetCAIP2,
		Extra:   makeExtraV1(feePayer.String()),
	}

	_, err := scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T", err)
	}
	// Should get an error about the transaction
	if ve.Reason == "" {
		t.Error("Reason should not be empty")
	}
}

func TestNewExactSvmSchemeV1(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewExactSvmSchemeV1(signer)

	if scheme == nil {
		t.Fatal("NewExactSvmSchemeV1 returned nil")
	}
	if scheme.signer != signer {
		t.Error("signer not set correctly")
	}
}
