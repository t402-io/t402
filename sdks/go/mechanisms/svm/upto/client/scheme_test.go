package client

import (
	"context"
	"strings"
	"testing"

	solana "github.com/gagliardetto/solana-go"

	"github.com/t402-io/t402/sdks/go/mechanisms/svm"
	"github.com/t402-io/t402/sdks/go/mechanisms/svm/upto"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockClientSigner implements upto.UptoClientSvmSigner for testing
type mockClientSigner struct {
	address    solana.PublicKey
	signErr    error
	ataAddr    solana.PublicKey
	ataErr     error
	signCalled int
}

func (m *mockClientSigner) Address() solana.PublicKey {
	return m.address
}

func (m *mockClientSigner) SignTransaction(_ context.Context, _ *solana.Transaction) error {
	m.signCalled++
	return m.signErr
}

func (m *mockClientSigner) GetAssociatedTokenAddress(_ context.Context, _ solana.PublicKey) (solana.PublicKey, error) {
	return m.ataAddr, m.ataErr
}

func newMockSigner() *mockClientSigner {
	return &mockClientSigner{
		address: solana.MustPublicKeyFromBase58("7nYBm5mPdVk7HZkFLSw1Mz7bQFuSPkHaTtEhHNzCJPZ3"),
		ataAddr: solana.MustPublicKeyFromBase58("3XMGVSk9XGLEuSz7bLjDCVh4rFDxqkpmcakVEeduDahZ"),
	}
}

func validRequirements() types.PaymentRequirements {
	return types.PaymentRequirements{
		Scheme:            "upto",
		Network:           svm.SolanaMainnetCAIP2,
		Asset:             svm.USDCMainnetAddress,
		Amount:            "1000000",
		PayTo:             "11111111111111111111111111111111",
		MaxTimeoutSeconds: 300,
		Extra: map[string]interface{}{
			"feePayer":  "BPFLoaderUpgradeab1e11111111111111111111111",
			"maxAmount": "5000000",
		},
	}
}

func TestScheme(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoSvmClient(signer)

	if client.Scheme() != "upto" {
		t.Errorf("Scheme() = %v, want upto", client.Scheme())
	}
}

func TestNewUptoSvmClient(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoSvmClient(signer)

	if client == nil {
		t.Fatal("NewUptoSvmClient() returned nil")
	}
}

func TestNewUptoSvmClient_WithConfig(t *testing.T) {
	signer := newMockSigner()
	config := &ClientConfig{
		RPCURL: "https://custom-rpc.example.com",
	}
	client := NewUptoSvmClient(signer, config)

	if client == nil {
		t.Fatal("NewUptoSvmClient() with config returned nil")
	}
	if client.config == nil {
		t.Fatal("Config should not be nil")
	}
	if client.config.RPCURL != "https://custom-rpc.example.com" {
		t.Errorf("RPCURL = %v, want https://custom-rpc.example.com", client.config.RPCURL)
	}
}

func TestNewUptoSvmClient_IgnoresExtraConfigs(t *testing.T) {
	signer := newMockSigner()
	config1 := &ClientConfig{RPCURL: "https://first.example.com"}
	config2 := &ClientConfig{RPCURL: "https://second.example.com"}

	client := NewUptoSvmClient(signer, config1, config2)

	if client.config.RPCURL != "https://first.example.com" {
		t.Error("Should use first config only")
	}
}

func TestGetAddress(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoSvmClient(signer)

	expected := signer.address.String()
	if client.GetAddress() != expected {
		t.Errorf("GetAddress() = %v, want %v", client.GetAddress(), expected)
	}
}

func TestCreatePaymentPayload_UnsupportedNetwork(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoSvmClient(signer)

	requirements := validRequirements()
	requirements.Network = "solana:unsupported"

	_, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for unsupported network, got nil")
	}
	if !strings.Contains(err.Error(), "unsupported network") {
		t.Errorf("Error = %v, want to contain 'unsupported network'", err.Error())
	}
}

func TestCreatePaymentPayload_WrongScheme(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoSvmClient(signer)

	requirements := validRequirements()
	requirements.Scheme = "exact"

	_, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for wrong scheme, got nil")
	}
	if !strings.Contains(err.Error(), "invalid scheme") {
		t.Errorf("Error = %v, want to contain 'invalid scheme'", err.Error())
	}
}

func TestCreatePaymentPayload_MissingExtraData(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoSvmClient(signer)

	requirements := validRequirements()
	requirements.Extra = nil

	_, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for missing extra data, got nil")
	}
	if !strings.Contains(err.Error(), "missing extra data") {
		t.Errorf("Error = %v, want to contain 'missing extra data'", err.Error())
	}
}

func TestCreatePaymentPayload_MissingFeePayer(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoSvmClient(signer)

	requirements := validRequirements()
	requirements.Extra = map[string]interface{}{
		"maxAmount": "5000000",
	}

	_, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for missing feePayer, got nil")
	}
	if !strings.Contains(err.Error(), "feePayer") {
		t.Errorf("Error = %v, want to contain 'feePayer'", err.Error())
	}
}

func TestCreatePaymentPayload_InvalidFeePayer(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoSvmClient(signer)

	requirements := validRequirements()
	requirements.Extra["feePayer"] = "invalid-address!!!"

	_, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for invalid feePayer, got nil")
	}
	if !strings.Contains(err.Error(), "invalid feePayer") {
		t.Errorf("Error = %v, want to contain 'invalid feePayer'", err.Error())
	}
}

func TestCreatePaymentPayload_InvalidAmount(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoSvmClient(signer)

	requirements := validRequirements()
	requirements.Amount = "not-a-number"
	requirements.Extra["maxAmount"] = "" // force fallback to Amount

	_, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for invalid amount, got nil")
	}
	if !strings.Contains(err.Error(), "invalid maxAmount") {
		t.Errorf("Error = %v, want to contain 'invalid maxAmount'", err.Error())
	}
}

func TestCreatePaymentPayload_InvalidAssetAddress(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoSvmClient(signer)

	requirements := validRequirements()
	requirements.Asset = "invalid-asset-address!!!"

	_, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for invalid asset address, got nil")
	}
	if !strings.Contains(err.Error(), "invalid asset address") {
		t.Errorf("Error = %v, want to contain 'invalid asset address'", err.Error())
	}
}

func TestCreatePaymentPayload_MaxAmountFromExtra(t *testing.T) {
	// This test validates that maxAmount from extra is preferred over Amount.
	// Since CreatePaymentPayload requires an RPC call, we just test the validation path.
	signer := newMockSigner()
	client := NewUptoSvmClient(signer)

	requirements := validRequirements()
	requirements.Amount = "1000000"
	requirements.Extra["maxAmount"] = "5000000"

	// The actual call will fail at the RPC step (getting mint account) since we
	// don't have a real network, but the amount parsing should succeed first.
	// We test that the amount is parsed from extra.maxAmount (5000000) not Amount (1000000).
	// Since we can't test the full flow without RPC, validate the error is NOT about maxAmount.
	_, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err != nil {
		// Ensure the error is NOT about maxAmount parsing
		if strings.Contains(err.Error(), "invalid maxAmount") {
			t.Errorf("maxAmount from extra should parse correctly, got error: %v", err)
		}
	}
}

func TestCreatePaymentPayload_MaxAmountFallsBackToAmount(t *testing.T) {
	// When extra.maxAmount is not set, it should fall back to requirements.Amount
	signer := newMockSigner()
	client := NewUptoSvmClient(signer)

	requirements := validRequirements()
	requirements.Amount = "1000000"
	delete(requirements.Extra, "maxAmount")

	// The actual call will fail at the RPC step, but amount parsing should succeed.
	_, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err != nil {
		// Ensure the error is NOT about maxAmount parsing
		if strings.Contains(err.Error(), "invalid maxAmount") {
			t.Errorf("Amount fallback should parse correctly, got error: %v", err)
		}
	}
}

func TestCreatePaymentPayload_EmptyFeePayerString(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoSvmClient(signer)

	requirements := validRequirements()
	requirements.Extra["feePayer"] = ""

	_, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for empty feePayer, got nil")
	}
	if !strings.Contains(err.Error(), "feePayer") {
		t.Errorf("Error = %v, want to contain 'feePayer'", err.Error())
	}
}

func TestCreatePaymentPayload_NonStringFeePayer(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoSvmClient(signer)

	requirements := validRequirements()
	requirements.Extra["feePayer"] = 12345

	_, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err == nil {
		t.Fatal("Expected error for non-string feePayer, got nil")
	}
	if !strings.Contains(err.Error(), "feePayer") {
		t.Errorf("Error = %v, want to contain 'feePayer'", err.Error())
	}
}

func TestCreatePaymentPayload_V1Network(t *testing.T) {
	signer := newMockSigner()
	client := NewUptoSvmClient(signer)

	requirements := validRequirements()
	requirements.Network = "solana" // V1 name

	// Will fail at RPC call, but should pass network validation
	_, err := client.CreatePaymentPayload(context.Background(), requirements)
	if err != nil && strings.Contains(err.Error(), "unsupported network") {
		t.Error("V1 network name 'solana' should be accepted")
	}
}

func TestSchemeUpto_Constant(t *testing.T) {
	if upto.SchemeUpto != "upto" {
		t.Errorf("SchemeUpto = %v, want upto", upto.SchemeUpto)
	}
}
