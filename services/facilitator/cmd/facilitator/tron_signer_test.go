package main

import (
	"context"
	"crypto/ecdsa"
	"crypto/sha256"
	"encoding/hex"
	"math/big"
	"strings"
	"testing"

	"github.com/ethereum/go-ethereum/crypto"
	"github.com/t402-io/t402/sdks/go/mechanisms/tron"
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

// --- Protobuf parsing tests ---

func TestDecodeVarint(t *testing.T) {
	tests := []struct {
		name      string
		data      []byte
		wantValue uint64
		wantN     int
	}{
		{"single byte 0", []byte{0x00}, 0, 1},
		{"single byte 1", []byte{0x01}, 1, 1},
		{"single byte 127", []byte{0x7f}, 127, 1},
		{"two bytes 128", []byte{0x80, 0x01}, 128, 2},
		{"two bytes 300", []byte{0xac, 0x02}, 300, 2},
		{"empty", []byte{}, 0, 0},
		{"unterminated", []byte{0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80}, 0, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			value, n := decodeVarint(tt.data)
			if value != tt.wantValue {
				t.Errorf("value = %d, want %d", value, tt.wantValue)
			}
			if n != tt.wantN {
				t.Errorf("n = %d, want %d", n, tt.wantN)
			}
		})
	}
}

func TestExtractTronTxFields(t *testing.T) {
	// Build a valid protobuf: field 1 (raw_data) + field 2 (signature)
	rawData := []byte("test raw data for transaction processing")
	sig := make([]byte, 65)
	for i := range sig {
		sig[i] = byte(i)
	}

	// Encode: tag=0x0a (field 1, wire type 2), length, data
	var buf []byte
	buf = append(buf, 0x0a)                  // field 1, wire type 2
	buf = append(buf, byte(len(rawData)))     // length (< 128)
	buf = append(buf, rawData...)
	buf = append(buf, 0x12)                   // field 2, wire type 2
	buf = append(buf, byte(len(sig)))         // length = 65
	buf = append(buf, sig...)

	gotRaw, gotSig, err := extractTronTxFields(buf)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(gotRaw) != string(rawData) {
		t.Errorf("rawData mismatch")
	}
	if len(gotSig) != 65 {
		t.Errorf("signature length = %d, want 65", len(gotSig))
	}

	t.Run("missing raw_data", func(t *testing.T) {
		// Only field 2
		var buf2 []byte
		buf2 = append(buf2, 0x12, byte(len(sig)))
		buf2 = append(buf2, sig...)
		_, _, err := extractTronTxFields(buf2)
		if err == nil || !strings.Contains(err.Error(), "raw_data") {
			t.Errorf("expected raw_data error, got %v", err)
		}
	})

	t.Run("missing signature", func(t *testing.T) {
		// Only field 1
		var buf3 []byte
		buf3 = append(buf3, 0x0a, byte(len(rawData)))
		buf3 = append(buf3, rawData...)
		_, _, err := extractTronTxFields(buf3)
		if err == nil || !strings.Contains(err.Error(), "signature") {
			t.Errorf("expected signature error, got %v", err)
		}
	})

	t.Run("truncated data", func(t *testing.T) {
		_, _, err := extractTronTxFields([]byte{0x0a, 0x50}) // claims 80 bytes, has 0
		if err == nil {
			t.Error("expected error for truncated data")
		}
	})
}

// --- VerifyTransaction tests ---

// buildSignedTronTx creates a protobuf-encoded TRON transaction signed by the given key.
func buildSignedTronTx(t *testing.T, privateKey *ecdsa.PrivateKey) []byte {
	t.Helper()

	// Create raw_data large enough (>= 100 bytes total)
	rawData := make([]byte, 120)
	for i := range rawData {
		rawData[i] = byte(i % 256)
	}

	// SHA256 hash the raw_data
	txHash := sha256.Sum256(rawData)

	// Sign with secp256k1 (65-byte signature)
	sig, err := crypto.Sign(txHash[:], privateKey)
	if err != nil {
		t.Fatalf("failed to sign: %v", err)
	}

	// Encode as protobuf: field 1 = raw_data, field 2 = signature
	var buf []byte
	// Field 1 (tag 0x0a), varint length, data
	buf = append(buf, 0x0a)
	buf = appendVarint(buf, uint64(len(rawData)))
	buf = append(buf, rawData...)
	// Field 2 (tag 0x12), varint length, data
	buf = append(buf, 0x12)
	buf = appendVarint(buf, uint64(len(sig)))
	buf = append(buf, sig...)

	return buf
}

// appendVarint encodes a uint64 as a protobuf varint
func appendVarint(buf []byte, v uint64) []byte {
	for v >= 0x80 {
		buf = append(buf, byte(v)|0x80)
		v >>= 7
	}
	buf = append(buf, byte(v))
	return buf
}

func TestVerifyTransaction_ValidSignature(t *testing.T) {
	privateKeyHex := "0000000000000000000000000000000000000000000000000000000000000001"
	privateKeyBytes := make([]byte, 32)
	n, _ := new(big.Int).SetString(privateKeyHex, 16)
	n.FillBytes(privateKeyBytes)

	privateKey, err := crypto.ToECDSA(privateKeyBytes)
	if err != nil {
		t.Fatalf("failed to parse key: %v", err)
	}

	expectedAddr := publicKeyToTronAddress(&privateKey.PublicKey)
	txBytes := buildSignedTronTx(t, privateKey)
	txHex := hex.EncodeToString(txBytes)

	signer, err := newFacilitatorTronSigner(privateKeyHex, "")
	if err != nil {
		t.Fatalf("failed to create signer: %v", err)
	}

	result, err := signer.VerifyTransaction(context.Background(), tron.VerifyTransactionParams{
		SignedTransaction: txHex,
		ExpectedFrom:      expectedAddr,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Valid {
		t.Errorf("expected Valid=true, got reason=%q", result.Reason)
	}
}

func TestVerifyTransaction_SignerMismatch(t *testing.T) {
	privateKeyHex := "0000000000000000000000000000000000000000000000000000000000000001"
	privateKeyBytes := make([]byte, 32)
	n, _ := new(big.Int).SetString(privateKeyHex, 16)
	n.FillBytes(privateKeyBytes)

	privateKey, err := crypto.ToECDSA(privateKeyBytes)
	if err != nil {
		t.Fatalf("failed to parse key: %v", err)
	}

	txBytes := buildSignedTronTx(t, privateKey)
	txHex := hex.EncodeToString(txBytes)

	signer, err := newFacilitatorTronSigner(privateKeyHex, "")
	if err != nil {
		t.Fatalf("failed to create signer: %v", err)
	}

	result, err := signer.VerifyTransaction(context.Background(), tron.VerifyTransactionParams{
		SignedTransaction: txHex,
		ExpectedFrom:      "TWrongAddressXYZ1234567890abcde",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Valid {
		t.Error("expected Valid=false for signer mismatch")
	}
	if !strings.Contains(result.Reason, "signer_mismatch") {
		t.Errorf("expected signer_mismatch reason, got %q", result.Reason)
	}
}

func TestVerifyTransaction_InvalidInputs(t *testing.T) {
	signer, err := newFacilitatorTronSigner("0000000000000000000000000000000000000000000000000000000000000001", "")
	if err != nil {
		t.Fatalf("failed to create signer: %v", err)
	}
	ctx := context.Background()

	tests := []struct {
		name       string
		signedTx   string
		wantReason string
	}{
		{
			name:       "invalid hex",
			signedTx:   "not-valid-hex!!!",
			wantReason: "invalid_hex_encoding",
		},
		{
			name:       "too short",
			signedTx:   hex.EncodeToString(make([]byte, 50)),
			wantReason: "transaction_too_short",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := signer.VerifyTransaction(ctx, tron.VerifyTransactionParams{
				SignedTransaction: tt.signedTx,
			})
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if result.Valid {
				t.Error("expected Valid=false")
			}
			if result.Reason != tt.wantReason {
				t.Errorf("Reason = %q, want %q", result.Reason, tt.wantReason)
			}
		})
	}
}

func TestVerifyTransaction_NoExpectedFrom(t *testing.T) {
	// When ExpectedFrom is empty, verification should pass if signature is valid
	privateKeyHex := "0000000000000000000000000000000000000000000000000000000000000001"
	privateKeyBytes := make([]byte, 32)
	n, _ := new(big.Int).SetString(privateKeyHex, 16)
	n.FillBytes(privateKeyBytes)

	privateKey, err := crypto.ToECDSA(privateKeyBytes)
	if err != nil {
		t.Fatalf("failed to parse key: %v", err)
	}

	txBytes := buildSignedTronTx(t, privateKey)
	txHex := hex.EncodeToString(txBytes)

	signer, err := newFacilitatorTronSigner(privateKeyHex, "")
	if err != nil {
		t.Fatalf("failed to create signer: %v", err)
	}

	result, err := signer.VerifyTransaction(context.Background(), tron.VerifyTransactionParams{
		SignedTransaction: txHex,
		// ExpectedFrom is empty — should still pass
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !result.Valid {
		t.Errorf("expected Valid=true with empty ExpectedFrom, got reason=%q", result.Reason)
	}
}
