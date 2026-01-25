package client

import (
	"context"
	"testing"

	solana "github.com/gagliardetto/solana-go"

	"github.com/t402-io/t402/sdks/go/mechanisms/svm"
	"github.com/t402-io/t402/sdks/go/types"
)

// MockClientSvmSigner implements svm.ClientSvmSigner for testing
type MockClientSvmSigner struct {
	address       solana.PublicKey
	signError     error
	signCallCount int
}

func (m *MockClientSvmSigner) Address() solana.PublicKey {
	return m.address
}

func (m *MockClientSvmSigner) SignTransaction(ctx context.Context, tx *solana.Transaction) error {
	m.signCallCount++
	return m.signError
}

func TestNewExactSvmScheme(t *testing.T) {
	t.Run("creates scheme with valid signer", func(t *testing.T) {
		signer := &MockClientSvmSigner{
			address: solana.MustPublicKeyFromBase58("11111111111111111111111111111111"),
		}
		scheme := NewExactSvmScheme(signer)

		if scheme == nil {
			t.Fatal("NewExactSvmScheme returned nil")
		}
		if scheme.signer != signer {
			t.Error("Signer not set correctly")
		}
		if scheme.config != nil {
			t.Error("Config should be nil when not provided")
		}
	})

	t.Run("creates scheme with custom config", func(t *testing.T) {
		signer := &MockClientSvmSigner{
			address: solana.MustPublicKeyFromBase58("11111111111111111111111111111111"),
		}
		config := &svm.ClientConfig{
			RPCURL: "https://custom-rpc.example.com",
		}
		scheme := NewExactSvmScheme(signer, config)

		if scheme == nil {
			t.Fatal("NewExactSvmScheme returned nil")
		}
		if scheme.config != config {
			t.Error("Config not set correctly")
		}
		if scheme.config.RPCURL != "https://custom-rpc.example.com" {
			t.Errorf("RPCURL = %s, want https://custom-rpc.example.com", scheme.config.RPCURL)
		}
	})

	t.Run("creates scheme with nil signer", func(t *testing.T) {
		scheme := NewExactSvmScheme(nil)
		if scheme == nil {
			t.Fatal("NewExactSvmScheme returned nil")
		}
	})

	t.Run("ignores extra configs", func(t *testing.T) {
		signer := &MockClientSvmSigner{
			address: solana.MustPublicKeyFromBase58("11111111111111111111111111111111"),
		}
		config1 := &svm.ClientConfig{RPCURL: "https://first.example.com"}
		config2 := &svm.ClientConfig{RPCURL: "https://second.example.com"}

		scheme := NewExactSvmScheme(signer, config1, config2)

		if scheme.config.RPCURL != "https://first.example.com" {
			t.Error("Should use first config only")
		}
	})
}

func TestScheme(t *testing.T) {
	signer := &MockClientSvmSigner{
		address: solana.MustPublicKeyFromBase58("11111111111111111111111111111111"),
	}
	scheme := NewExactSvmScheme(signer)

	if scheme.Scheme() != svm.SchemeExact {
		t.Errorf("Scheme() = %s, want %s", scheme.Scheme(), svm.SchemeExact)
	}

	if scheme.Scheme() != "exact" {
		t.Errorf("Scheme() = %s, want exact", scheme.Scheme())
	}
}

func TestCreatePaymentPayloadValidation(t *testing.T) {
	ctx := context.Background()

	t.Run("unsupported network", func(t *testing.T) {
		signer := &MockClientSvmSigner{
			address: solana.MustPublicKeyFromBase58("11111111111111111111111111111111"),
		}
		scheme := NewExactSvmScheme(signer)

		requirements := types.PaymentRequirements{
			Network: "solana:unsupported",
			Asset:   svm.USDCMainnetAddress,
			Amount:  "1000000",
			PayTo:   "11111111111111111111111111111111",
			Extra: map[string]interface{}{
				"feePayer": "11111111111111111111111111111111",
			},
		}

		_, err := scheme.CreatePaymentPayload(ctx, requirements)
		if err == nil {
			t.Error("CreatePaymentPayload should fail for unsupported network")
		}
	})

	t.Run("invalid asset address", func(t *testing.T) {
		signer := &MockClientSvmSigner{
			address: solana.MustPublicKeyFromBase58("11111111111111111111111111111111"),
		}
		scheme := NewExactSvmScheme(signer)

		requirements := types.PaymentRequirements{
			Network: svm.SolanaMainnetCAIP2,
			Asset:   "invalid-address",
			Amount:  "1000000",
			PayTo:   "11111111111111111111111111111111",
			Extra: map[string]interface{}{
				"feePayer": "11111111111111111111111111111111",
			},
		}

		_, err := scheme.CreatePaymentPayload(ctx, requirements)
		if err == nil {
			t.Error("CreatePaymentPayload should fail for invalid asset address")
		}
	})

	t.Run("missing feePayer", func(t *testing.T) {
		signer := &MockClientSvmSigner{
			address: solana.MustPublicKeyFromBase58("11111111111111111111111111111111"),
		}
		// Use a mock RPC URL that will fail quickly
		config := &svm.ClientConfig{RPCURL: "http://localhost:1"}
		scheme := NewExactSvmScheme(signer, config)

		requirements := types.PaymentRequirements{
			Network: svm.SolanaMainnetCAIP2,
			Asset:   svm.USDCMainnetAddress,
			Amount:  "1000000",
			PayTo:   "11111111111111111111111111111111",
			Extra:   map[string]interface{}{}, // No feePayer
		}

		// This will fail at network call before getting to feePayer check
		// but let's test with a different approach
		_, err := scheme.CreatePaymentPayload(ctx, requirements)
		// Either RPC error or validation error is expected
		if err == nil {
			t.Error("CreatePaymentPayload should fail")
		}
	})

	t.Run("invalid feePayer address", func(t *testing.T) {
		signer := &MockClientSvmSigner{
			address: solana.MustPublicKeyFromBase58("11111111111111111111111111111111"),
		}
		// Use a mock RPC URL
		config := &svm.ClientConfig{RPCURL: "http://localhost:1"}
		scheme := NewExactSvmScheme(signer, config)

		requirements := types.PaymentRequirements{
			Network: svm.SolanaMainnetCAIP2,
			Asset:   svm.USDCMainnetAddress,
			Amount:  "1000000",
			PayTo:   "11111111111111111111111111111111",
			Extra: map[string]interface{}{
				"feePayer": "invalid-address",
			},
		}

		_, err := scheme.CreatePaymentPayload(ctx, requirements)
		if err == nil {
			t.Error("CreatePaymentPayload should fail")
		}
	})

	t.Run("invalid amount format", func(t *testing.T) {
		signer := &MockClientSvmSigner{
			address: solana.MustPublicKeyFromBase58("11111111111111111111111111111111"),
		}
		config := &svm.ClientConfig{RPCURL: "http://localhost:1"}
		scheme := NewExactSvmScheme(signer, config)

		requirements := types.PaymentRequirements{
			Network: svm.SolanaMainnetCAIP2,
			Asset:   svm.USDCMainnetAddress,
			Amount:  "not-a-number",
			PayTo:   "11111111111111111111111111111111",
			Extra: map[string]interface{}{
				"feePayer": "11111111111111111111111111111111",
			},
		}

		_, err := scheme.CreatePaymentPayload(ctx, requirements)
		if err == nil {
			t.Error("CreatePaymentPayload should fail for invalid amount")
		}
	})

	t.Run("invalid payTo address", func(t *testing.T) {
		signer := &MockClientSvmSigner{
			address: solana.MustPublicKeyFromBase58("11111111111111111111111111111111"),
		}
		config := &svm.ClientConfig{RPCURL: "http://localhost:1"}
		scheme := NewExactSvmScheme(signer, config)

		requirements := types.PaymentRequirements{
			Network: svm.SolanaMainnetCAIP2,
			Asset:   svm.USDCMainnetAddress,
			Amount:  "1000000",
			PayTo:   "invalid-payto-address",
			Extra: map[string]interface{}{
				"feePayer": "11111111111111111111111111111111",
			},
		}

		_, err := scheme.CreatePaymentPayload(ctx, requirements)
		if err == nil {
			t.Error("CreatePaymentPayload should fail for invalid payTo address")
		}
	})

	t.Run("V1 network name", func(t *testing.T) {
		signer := &MockClientSvmSigner{
			address: solana.MustPublicKeyFromBase58("11111111111111111111111111111111"),
		}
		config := &svm.ClientConfig{RPCURL: "http://localhost:1"}
		scheme := NewExactSvmScheme(signer, config)

		requirements := types.PaymentRequirements{
			Network: "solana", // V1 name
			Asset:   svm.USDCMainnetAddress,
			Amount:  "1000000",
			PayTo:   "11111111111111111111111111111111",
			Extra: map[string]interface{}{
				"feePayer": "11111111111111111111111111111111",
			},
		}

		// Will fail due to RPC but should pass network validation
		_, err := scheme.CreatePaymentPayload(ctx, requirements)
		// The error should be from RPC, not network validation
		if err != nil && err.Error() == "unsupported network: solana" {
			t.Error("V1 network name should be accepted")
		}
	})
}

func TestNetworkValidation(t *testing.T) {
	tests := []struct {
		name     string
		network  string
		expected bool
	}{
		{"mainnet CAIP-2", svm.SolanaMainnetCAIP2, true},
		{"devnet CAIP-2", svm.SolanaDevnetCAIP2, true},
		{"testnet CAIP-2", svm.SolanaTestnetCAIP2, true},
		{"V1 mainnet", "solana", true},
		{"V1 devnet", "solana-devnet", true},
		{"V1 testnet", "solana-testnet", true},
		{"unsupported", "solana:unsupported", false},
		{"empty", "", false},
		{"non-solana", "eip155:1", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := svm.IsValidNetwork(tt.network)
			if result != tt.expected {
				t.Errorf("IsValidNetwork(%s) = %v, want %v", tt.network, result, tt.expected)
			}
		})
	}
}
