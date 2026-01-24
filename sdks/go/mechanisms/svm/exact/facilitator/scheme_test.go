package facilitator

import (
	"context"
	"testing"

	solana "github.com/gagliardetto/solana-go"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/svm"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockSvmSigner implements FacilitatorSvmSigner for testing
type mockSvmSigner struct {
	addresses    map[string][]solana.PublicKey
	signErr      error
	simulateErr  error
	sendSig      solana.Signature
	sendErr      error
	confirmErr   error
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

func TestScheme(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewExactSvmScheme(signer)

	if scheme.Scheme() != "exact" {
		t.Errorf("Scheme() = %v, want exact", scheme.Scheme())
	}
}

func TestCaipFamily(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewExactSvmScheme(signer)

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
	scheme := NewExactSvmScheme(signer)

	signers := scheme.GetSigners(t402.Network(svm.SolanaMainnetCAIP2))
	if len(signers) != 2 {
		t.Errorf("GetSigners() returned %d addresses, want 2", len(signers))
	}
	if signers[0] != feePayer1.String() || signers[1] != feePayer2.String() {
		t.Errorf("GetSigners() returned wrong addresses")
	}
}

func TestGetExtra(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewExactSvmScheme(signer)

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
	scheme := NewExactSvmScheme(signer)

	payload := types.PaymentPayload{
		Payload: map[string]interface{}{},
		Accepted: types.PaymentRequirements{
			Scheme:  "wrong-scheme",
			Network: svm.SolanaMainnetCAIP2,
		},
	}

	requirements := types.PaymentRequirements{
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
	scheme := NewExactSvmScheme(signer)

	payload := types.PaymentPayload{
		Payload: map[string]interface{}{},
		Accepted: types.PaymentRequirements{
			Scheme:  svm.SchemeExact,
			Network: svm.SolanaDevnetCAIP2,
		},
	}

	requirements := types.PaymentRequirements{
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
	scheme := NewExactSvmScheme(signer)

	payload := types.PaymentPayload{
		Payload: map[string]interface{}{
			"transaction": "AQAAAA==",
		},
		Accepted: types.PaymentRequirements{
			Scheme:  svm.SchemeExact,
			Network: svm.SolanaMainnetCAIP2,
		},
	}

	requirements := types.PaymentRequirements{
		Scheme:  svm.SchemeExact,
		Network: svm.SolanaMainnetCAIP2,
		Extra:   map[string]interface{}{}, // No feePayer
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
	scheme := NewExactSvmScheme(signer)

	payload := types.PaymentPayload{
		Payload: map[string]interface{}{
			"transaction": "AQAAAA==",
		},
		Accepted: types.PaymentRequirements{
			Scheme:  svm.SchemeExact,
			Network: svm.SolanaMainnetCAIP2,
		},
	}

	requirements := types.PaymentRequirements{
		Scheme:  svm.SchemeExact,
		Network: svm.SolanaMainnetCAIP2,
		Extra: map[string]interface{}{
			"feePayer": "RandomUnmanagedAddress1111111111111111111111111",
		},
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
	scheme := NewExactSvmScheme(signer)

	payload := types.PaymentPayload{
		Payload: map[string]interface{}{
			"transaction": "invalid-base64-data!!!",
		},
		Accepted: types.PaymentRequirements{
			Scheme:  svm.SchemeExact,
			Network: svm.SolanaMainnetCAIP2,
		},
	}

	requirements := types.PaymentRequirements{
		Scheme:  svm.SchemeExact,
		Network: svm.SolanaMainnetCAIP2,
		Extra: map[string]interface{}{
			"feePayer": feePayer.String(),
		},
	}

	_, err := scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	// Should get an error about decoding the transaction
	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T", err)
	}
	// The error reason will be about invalid transaction
	if ve.Reason == "" {
		t.Error("Reason should not be empty")
	}
}

func TestNewExactSvmScheme(t *testing.T) {
	signer := newValidMockSigner()
	scheme := NewExactSvmScheme(signer)

	if scheme == nil {
		t.Fatal("NewExactSvmScheme returned nil")
	}
	if scheme.signer != signer {
		t.Error("signer not set correctly")
	}
}
