package main

import (
	"crypto/ecdsa"
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/crypto"
)

func TestBase58Encode(t *testing.T) {
	tests := []struct {
		name     string
		input    []byte
		expected string
	}{
		{
			name:     "empty",
			input:    []byte{},
			expected: "",
		},
		{
			name:     "single byte",
			input:    []byte{0x01},
			expected: "2",
		},
		{
			name:     "leading zeros",
			input:    []byte{0x00, 0x00, 0x01},
			expected: "112",
		},
		{
			name:     "hello",
			input:    []byte("Hello"),
			expected: "9Ajdvzr",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := base58Encode(tt.input)
			if got != tt.expected {
				t.Errorf("base58Encode(%v) = %s, expected %s", tt.input, got, tt.expected)
			}
		})
	}
}

func TestBase58CheckEncode(t *testing.T) {
	// Test with a known TRON address prefix
	// TRON addresses start with 0x41 + 20-byte address
	input := []byte{0x41}
	input = append(input, make([]byte, 20)...) // 0x41 + 20 zero bytes

	result := base58CheckEncode(input)

	// Should start with 'T' (TRON addresses start with T)
	if len(result) == 0 {
		t.Error("expected non-empty result")
	}
	if result[0] != 'T' {
		t.Errorf("TRON address should start with T, got %c", result[0])
	}

	// Standard TRON address length is 34 characters
	if len(result) != 34 {
		t.Errorf("expected TRON address length 34, got %d", len(result))
	}
}

func TestPublicKeyToTronAddress(t *testing.T) {
	// Generate a test private key
	privateKey, err := crypto.GenerateKey()
	if err != nil {
		t.Fatalf("failed to generate key: %v", err)
	}

	address := publicKeyToTronAddress(&privateKey.PublicKey)

	// TRON addresses should:
	// 1. Start with 'T'
	// 2. Be 34 characters long
	// 3. Only contain base58 characters

	if len(address) != 34 {
		t.Errorf("expected address length 34, got %d", len(address))
	}

	if address[0] != 'T' {
		t.Errorf("TRON address should start with T, got %c", address[0])
	}

	// Check for valid base58 characters (no 0, O, I, l)
	invalidChars := "0OIl"
	for _, c := range address {
		for _, invalid := range invalidChars {
			if c == invalid {
				t.Errorf("address contains invalid base58 character: %c", c)
			}
		}
	}
}

func TestPublicKeyToTronAddress_KnownKey(t *testing.T) {
	// Use a known private key to verify deterministic address generation
	privateKeyHex := "0000000000000000000000000000000000000000000000000000000000000001"
	privateKeyBytes := make([]byte, 32)
	n, _ := new(big.Int).SetString(privateKeyHex, 16)
	n.FillBytes(privateKeyBytes)

	privateKey, err := crypto.ToECDSA(privateKeyBytes)
	if err != nil {
		t.Fatalf("failed to parse private key: %v", err)
	}

	address := publicKeyToTronAddress(&privateKey.PublicKey)

	// The address should be deterministic
	if address == "" {
		t.Error("expected non-empty address")
	}

	// Generate again and verify same result
	address2 := publicKeyToTronAddress(&privateKey.PublicKey)
	if address != address2 {
		t.Errorf("address generation should be deterministic: %s != %s", address, address2)
	}
}

func TestNewFacilitatorTronSigner_EmptyKey(t *testing.T) {
	_, err := newFacilitatorTronSigner("", "")
	if err == nil {
		t.Error("expected error for empty private key")
	}
}

func TestNewFacilitatorTronSigner_InvalidKey(t *testing.T) {
	_, err := newFacilitatorTronSigner("invalid-hex", "")
	if err == nil {
		t.Error("expected error for invalid hex key")
	}
}

func TestNewFacilitatorTronSigner_ValidKey(t *testing.T) {
	// Use a valid 32-byte hex private key
	privateKey := "0000000000000000000000000000000000000000000000000000000000000001"

	signer, err := newFacilitatorTronSigner(privateKey, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if signer == nil {
		t.Fatal("expected non-nil signer")
	}

	// Check that addresses are set for all networks
	if len(signer.addresses) != 3 {
		t.Errorf("expected 3 network addresses, got %d", len(signer.addresses))
	}

	// Check that endpoints are set
	if len(signer.endpoints) != 3 {
		t.Errorf("expected 3 network endpoints, got %d", len(signer.endpoints))
	}
}

func TestNewFacilitatorTronSigner_WithPrefix(t *testing.T) {
	// Test with 0x prefix
	privateKey := "0x0000000000000000000000000000000000000000000000000000000000000001"

	signer, err := newFacilitatorTronSigner(privateKey, "")
	if err != nil {
		t.Fatalf("unexpected error with 0x prefix: %v", err)
	}

	if signer == nil {
		t.Fatal("expected non-nil signer")
	}
}

func TestNewFacilitatorTronSigner_CustomRPC(t *testing.T) {
	privateKey := "0000000000000000000000000000000000000000000000000000000000000001"
	customRPC := "https://custom-tron-rpc.example.com"

	signer, err := newFacilitatorTronSigner(privateKey, customRPC)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Check that custom RPC is used for mainnet
	if signer.endpoints["tron:mainnet"] != customRPC {
		t.Errorf("expected mainnet endpoint=%s, got %s", customRPC, signer.endpoints["tron:mainnet"])
	}
}

func TestFacilitatorTronSigner_GetAddresses(t *testing.T) {
	privateKey := "0000000000000000000000000000000000000000000000000000000000000001"

	signer, err := newFacilitatorTronSigner(privateKey, "")
	if err != nil {
		t.Fatalf("failed to create signer: %v", err)
	}

	// Test getting address for specific network
	addrs := signer.GetAddresses(nil, "tron:mainnet")
	if len(addrs) != 1 {
		t.Errorf("expected 1 address for tron:mainnet, got %d", len(addrs))
	}

	// Test getting addresses for unknown network (should return all)
	addrs = signer.GetAddresses(nil, "unknown:network")
	if len(addrs) != 3 {
		t.Errorf("expected 3 addresses for unknown network, got %d", len(addrs))
	}
}

func TestTronAddressDeterminism(t *testing.T) {
	// Test that same private key always produces same address
	privateKey := "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"

	signer1, err := newFacilitatorTronSigner(privateKey, "")
	if err != nil {
		t.Fatalf("failed to create signer1: %v", err)
	}

	signer2, err := newFacilitatorTronSigner(privateKey, "")
	if err != nil {
		t.Fatalf("failed to create signer2: %v", err)
	}

	addr1 := signer1.GetAddresses(nil, "tron:mainnet")[0]
	addr2 := signer2.GetAddresses(nil, "tron:mainnet")[0]

	if addr1 != addr2 {
		t.Errorf("same private key should produce same address: %s != %s", addr1, addr2)
	}
}

// Helper function to convert ECDSA public key to ensure interface compatibility
func TestPublicKeyType(t *testing.T) {
	privateKey, _ := crypto.GenerateKey()
	var pubKey *ecdsa.PublicKey = &privateKey.PublicKey

	// Should not panic
	_ = publicKeyToTronAddress(pubKey)
}
