package upto

import (
	"context"
	"math/big"
	"testing"

	"github.com/t402-io/t402/sdks/go/mechanisms/evm"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockClientSigner implements evm.ClientEvmSigner for testing
type mockClientSigner struct {
	address        string
	signedData     []byte
	signErr        error
	lastDomain     evm.TypedDataDomain
	lastTypes      map[string][]evm.TypedDataField
	lastPrimary    string
	lastMessage    map[string]interface{}
	signCallCount  int
}

func (m *mockClientSigner) Address() string {
	return m.address
}

func (m *mockClientSigner) SignTypedData(
	ctx context.Context,
	domain evm.TypedDataDomain,
	types map[string][]evm.TypedDataField,
	primaryType string,
	message map[string]interface{},
) ([]byte, error) {
	m.signCallCount++
	m.lastDomain = domain
	m.lastTypes = types
	m.lastPrimary = primaryType
	m.lastMessage = message
	return m.signedData, m.signErr
}

// create65ByteSignature creates a valid 65-byte signature for testing
func create65ByteSignature() []byte {
	sig := make([]byte, 65)
	// R: 32 bytes
	for i := 0; i < 32; i++ {
		sig[i] = byte(i + 1)
	}
	// S: 32 bytes
	for i := 32; i < 64; i++ {
		sig[i] = byte(i + 1)
	}
	// V: 1 byte
	sig[64] = 28
	return sig
}

func TestUptoEvmScheme_Scheme(t *testing.T) {
	signer := &mockClientSigner{address: "0x1234567890123456789012345678901234567890"}
	scheme := NewUptoEvmScheme(signer)

	if scheme.Scheme() != "upto" {
		t.Errorf("expected scheme 'upto', got '%s'", scheme.Scheme())
	}
}

func TestUptoEvmScheme_CreatePaymentPayload(t *testing.T) {
	t.Run("should create valid payload for supported network", func(t *testing.T) {
		signer := &mockClientSigner{
			address:    "0x1234567890123456789012345678901234567890",
			signedData: create65ByteSignature(),
		}
		scheme := NewUptoEvmScheme(signer)

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			Amount:  "1000000",
			PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
			Extra: map[string]interface{}{
				"name":    "USD Coin",
				"version": "2",
			},
		}

		payload, err := scheme.CreatePaymentPayload(context.Background(), requirements)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if payload.T402Version != 2 {
			t.Errorf("expected t402Version 2, got %d", payload.T402Version)
		}

		if payload.Payload == nil {
			t.Fatal("expected non-nil payload")
		}

		// Check signature structure
		sig, ok := payload.Payload["signature"].(map[string]interface{})
		if !ok {
			t.Fatal("expected signature to be a map")
		}
		if sig["v"] == nil || sig["r"] == nil || sig["s"] == nil {
			t.Error("expected signature to have v, r, s fields")
		}

		// Check authorization structure
		auth, ok := payload.Payload["authorization"].(map[string]interface{})
		if !ok {
			t.Fatal("expected authorization to be a map")
		}
		if auth["owner"] != signer.address {
			t.Errorf("expected owner '%s', got '%v'", signer.address, auth["owner"])
		}
		if auth["spender"] != requirements.PayTo {
			t.Errorf("expected spender '%s', got '%v'", requirements.PayTo, auth["spender"])
		}
		if auth["value"] != "1000000" {
			t.Errorf("expected value '1000000', got '%v'", auth["value"])
		}

		// Check payment nonce exists
		if payload.Payload["paymentNonce"] == nil {
			t.Error("expected paymentNonce to be set")
		}
	})

	t.Run("should use routerAddress as spender when provided", func(t *testing.T) {
		signer := &mockClientSigner{
			address:    "0x1234567890123456789012345678901234567890",
			signedData: create65ByteSignature(),
		}
		scheme := NewUptoEvmScheme(signer)

		routerAddr := "0xrouterrouterrouterrouterrouterrouter1234"
		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			Amount:  "1000000",
			PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
			Extra: map[string]interface{}{
				"name":          "USD Coin",
				"version":       "2",
				"routerAddress": routerAddr,
			},
		}

		payload, err := scheme.CreatePaymentPayload(context.Background(), requirements)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		auth, ok := payload.Payload["authorization"].(map[string]interface{})
		if !ok {
			t.Fatal("expected authorization to be a map")
		}
		if auth["spender"] != routerAddr {
			t.Errorf("expected spender '%s', got '%v'", routerAddr, auth["spender"])
		}
	})

	t.Run("should sign with correct EIP-712 domain", func(t *testing.T) {
		signer := &mockClientSigner{
			address:    "0x1234567890123456789012345678901234567890",
			signedData: create65ByteSignature(),
		}
		scheme := NewUptoEvmScheme(signer)

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			Amount:  "5000000",
			PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
			Extra: map[string]interface{}{
				"name":    "CustomToken",
				"version": "3",
			},
		}

		_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		// Verify domain
		if signer.lastDomain.Name != "CustomToken" {
			t.Errorf("expected domain name 'CustomToken', got '%s'", signer.lastDomain.Name)
		}
		if signer.lastDomain.Version != "3" {
			t.Errorf("expected domain version '3', got '%s'", signer.lastDomain.Version)
		}
		if signer.lastDomain.ChainID.Cmp(big.NewInt(8453)) != 0 {
			t.Errorf("expected chainId 8453, got %s", signer.lastDomain.ChainID.String())
		}
		if signer.lastDomain.VerifyingContract != "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" {
			t.Errorf("expected verifyingContract, got '%s'", signer.lastDomain.VerifyingContract)
		}

		// Verify primary type
		if signer.lastPrimary != "Permit" {
			t.Errorf("expected primaryType 'Permit', got '%s'", signer.lastPrimary)
		}

		// Verify Permit type definition
		permitFields, ok := signer.lastTypes["Permit"]
		if !ok {
			t.Fatal("expected Permit type to be defined")
		}
		if len(permitFields) != 5 {
			t.Errorf("expected 5 Permit fields, got %d", len(permitFields))
		}

		// Verify message fields
		if signer.lastMessage["owner"] != signer.address {
			t.Errorf("expected message owner '%s', got '%v'", signer.address, signer.lastMessage["owner"])
		}
		if signer.lastMessage["spender"] != requirements.PayTo {
			t.Errorf("expected message spender '%s', got '%v'", requirements.PayTo, signer.lastMessage["spender"])
		}
	})

	t.Run("should fail for unsupported network", func(t *testing.T) {
		signer := &mockClientSigner{
			address:    "0x1234567890123456789012345678901234567890",
			signedData: create65ByteSignature(),
		}
		scheme := NewUptoEvmScheme(signer)

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "unsupported:999999",
			Amount:  "1000000",
			PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
		}

		_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
		if err == nil {
			t.Fatal("expected error for unsupported network")
		}
	})

	t.Run("should fail for invalid amount", func(t *testing.T) {
		signer := &mockClientSigner{
			address:    "0x1234567890123456789012345678901234567890",
			signedData: create65ByteSignature(),
		}
		scheme := NewUptoEvmScheme(signer)

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			Amount:  "not-a-number",
			PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
		}

		_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
		if err == nil {
			t.Fatal("expected error for invalid amount")
		}
	})

	t.Run("should fail when signer returns error", func(t *testing.T) {
		signer := &mockClientSigner{
			address: "0x1234567890123456789012345678901234567890",
			signErr: context.DeadlineExceeded,
		}
		scheme := NewUptoEvmScheme(signer)

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			Amount:  "1000000",
			PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
		}

		_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
		if err == nil {
			t.Fatal("expected error when signer fails")
		}
	})

	t.Run("should fail for invalid signature length", func(t *testing.T) {
		signer := &mockClientSigner{
			address:    "0x1234567890123456789012345678901234567890",
			signedData: make([]byte, 32), // Wrong length
		}
		scheme := NewUptoEvmScheme(signer)

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			Amount:  "1000000",
			PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
		}

		_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
		if err == nil {
			t.Fatal("expected error for invalid signature length")
		}
	})

	t.Run("should use permitNonce from extra when provided", func(t *testing.T) {
		signer := &mockClientSigner{
			address:    "0x1234567890123456789012345678901234567890",
			signedData: create65ByteSignature(),
		}
		scheme := NewUptoEvmScheme(signer)

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			Amount:  "1000000",
			PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
			Extra: map[string]interface{}{
				"permitNonce": float64(7),
			},
		}

		payload, err := scheme.CreatePaymentPayload(context.Background(), requirements)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		auth, ok := payload.Payload["authorization"].(map[string]interface{})
		if !ok {
			t.Fatal("expected authorization to be a map")
		}

		// Nonce should be 7 from the extra field
		nonce, ok := auth["nonce"].(int)
		if !ok {
			// Try float64 (JSON numbers)
			nonceFloat, ok := auth["nonce"].(float64)
			if !ok {
				t.Fatalf("expected nonce to be numeric, got %T", auth["nonce"])
			}
			nonce = int(nonceFloat)
		}
		if nonce != 7 {
			t.Errorf("expected nonce 7, got %d", nonce)
		}
	})

	t.Run("should use default token info when extra not provided", func(t *testing.T) {
		signer := &mockClientSigner{
			address:    "0x1234567890123456789012345678901234567890",
			signedData: create65ByteSignature(),
		}
		scheme := NewUptoEvmScheme(signer)

		requirements := types.PaymentRequirements{
			Scheme:  "upto",
			Network: "eip155:8453",
			Asset:   "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			Amount:  "1000000",
			PayTo:   "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
		}

		_, err := scheme.CreatePaymentPayload(context.Background(), requirements)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		// Should use default token info from network config
		if signer.lastDomain.Name != "USD Coin" {
			t.Errorf("expected domain name 'USD Coin', got '%s'", signer.lastDomain.Name)
		}
		if signer.lastDomain.Version != "2" {
			t.Errorf("expected domain version '2', got '%s'", signer.lastDomain.Version)
		}
	})
}
