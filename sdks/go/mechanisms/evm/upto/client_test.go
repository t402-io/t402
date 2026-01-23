package upto

import (
	"context"
	"errors"
	"math/big"
	"strings"
	"testing"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/evm"
	"github.com/t402-io/t402/sdks/go/types"
)

// Compile-time interface compliance assertion
var _ t402.SchemeNetworkClient = (*UptoEvmScheme)(nil)

// mockClientSigner implements evm.ClientEvmSigner for testing
type mockClientSigner struct {
	address       string
	signedData    []byte
	signErr       error
	lastDomain    evm.TypedDataDomain
	lastTypes     map[string][]evm.TypedDataField
	lastPrimary   string
	lastMessage   map[string]interface{}
	signCallCount int
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
	// V: 1 byte (recovery id 28)
	sig[64] = 28
	return sig
}

func TestUptoEvmScheme_Scheme(t *testing.T) {
	signer := &mockClientSigner{address: "0x1234567890123456789012345678901234567890"}
	scheme := NewUptoEvmScheme(signer)

	if got := scheme.Scheme(); got != "upto" {
		t.Errorf("Scheme() = %q, want %q", got, "upto")
	}
}

func TestUptoEvmScheme_CreatePaymentPayload(t *testing.T) {
	const (
		testOwner  = "0x1234567890123456789012345678901234567890"
		testPayTo  = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"
		testRouter = "0xrouterrouterrouterrouterrouterrouter1234"
		baseUSDC   = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
	)

	tests := []struct {
		name         string
		signer       *mockClientSigner
		requirements types.PaymentRequirements
		wantErr      bool
		errContains  string
		validate     func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner)
	}{
		{
			name: "success with supported network and explicit extra",
			signer: &mockClientSigner{
				address:    testOwner,
				signedData: create65ByteSignature(),
			},
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Asset:   baseUSDC,
				Amount:  "1000000",
				PayTo:   testPayTo,
				Extra: map[string]interface{}{
					"name":    "USD Coin",
					"version": "2",
				},
			},
			wantErr: false,
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				if payload.T402Version != 2 {
					t.Errorf("T402Version = %d, want 2", payload.T402Version)
				}
				if payload.Payload == nil {
					t.Fatal("Payload is nil")
				}

				// Check signature structure
				sig, ok := payload.Payload["signature"].(map[string]interface{})
				if !ok {
					t.Fatal("signature is not a map")
				}
				if sig["v"] == nil || sig["r"] == nil || sig["s"] == nil {
					t.Error("signature missing v, r, or s")
				}
				if v, ok := sig["v"].(int); ok && v != 28 {
					t.Errorf("v = %d, want 28", v)
				}

				// Check authorization
				auth, ok := payload.Payload["authorization"].(map[string]interface{})
				if !ok {
					t.Fatal("authorization is not a map")
				}
				if auth["owner"] != testOwner {
					t.Errorf("owner = %v, want %s", auth["owner"], testOwner)
				}
				if auth["spender"] != testPayTo {
					t.Errorf("spender = %v, want %s", auth["spender"], testPayTo)
				}
				if auth["value"] != "1000000" {
					t.Errorf("value = %v, want 1000000", auth["value"])
				}

				// Deadline should be set
				deadline, ok := auth["deadline"].(string)
				if !ok || deadline == "" {
					t.Error("deadline not set")
				}

				// Payment nonce should exist
				nonce, ok := payload.Payload["paymentNonce"].(string)
				if !ok || nonce == "" {
					t.Error("paymentNonce not set")
				}
			},
		},
		{
			name: "uses routerAddress as spender when provided in extra",
			signer: &mockClientSigner{
				address:    testOwner,
				signedData: create65ByteSignature(),
			},
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Asset:   baseUSDC,
				Amount:  "1000000",
				PayTo:   testPayTo,
				Extra: map[string]interface{}{
					"name":          "USD Coin",
					"version":       "2",
					"routerAddress": testRouter,
				},
			},
			wantErr: false,
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				auth := payload.Payload["authorization"].(map[string]interface{})
				if auth["spender"] != testRouter {
					t.Errorf("spender = %v, want %s (routerAddress)", auth["spender"], testRouter)
				}
			},
		},
		{
			name: "uses permitNonce from extra field",
			signer: &mockClientSigner{
				address:    testOwner,
				signedData: create65ByteSignature(),
			},
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Asset:   baseUSDC,
				Amount:  "1000000",
				PayTo:   testPayTo,
				Extra: map[string]interface{}{
					"permitNonce": float64(7),
				},
			},
			wantErr: false,
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				auth := payload.Payload["authorization"].(map[string]interface{})
				nonce, ok := auth["nonce"].(int)
				if !ok {
					t.Fatalf("nonce is not an int, got %T", auth["nonce"])
				}
				if nonce != 7 {
					t.Errorf("nonce = %d, want 7", nonce)
				}
			},
		},
		{
			name: "uses default token info when extra not provided",
			signer: &mockClientSigner{
				address:    testOwner,
				signedData: create65ByteSignature(),
			},
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Asset:   baseUSDC,
				Amount:  "1000000",
				PayTo:   testPayTo,
			},
			wantErr: false,
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				if signer.lastDomain.Name != "USD Coin" {
					t.Errorf("domain.Name = %q, want %q", signer.lastDomain.Name, "USD Coin")
				}
				if signer.lastDomain.Version != "2" {
					t.Errorf("domain.Version = %q, want %q", signer.lastDomain.Version, "2")
				}
			},
		},
		{
			name: "signs with correct EIP-712 domain from extra overrides",
			signer: &mockClientSigner{
				address:    testOwner,
				signedData: create65ByteSignature(),
			},
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Asset:   baseUSDC,
				Amount:  "5000000",
				PayTo:   testPayTo,
				Extra: map[string]interface{}{
					"name":    "CustomToken",
					"version": "3",
				},
			},
			wantErr: false,
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				if signer.lastDomain.Name != "CustomToken" {
					t.Errorf("domain.Name = %q, want %q", signer.lastDomain.Name, "CustomToken")
				}
				if signer.lastDomain.Version != "3" {
					t.Errorf("domain.Version = %q, want %q", signer.lastDomain.Version, "3")
				}
				if signer.lastDomain.ChainID.Cmp(big.NewInt(8453)) != 0 {
					t.Errorf("domain.ChainID = %s, want 8453", signer.lastDomain.ChainID)
				}
				if signer.lastDomain.VerifyingContract != baseUSDC {
					t.Errorf("domain.VerifyingContract = %q, want %q", signer.lastDomain.VerifyingContract, baseUSDC)
				}
				if signer.lastPrimary != "Permit" {
					t.Errorf("primaryType = %q, want %q", signer.lastPrimary, "Permit")
				}
				permitFields, ok := signer.lastTypes["Permit"]
				if !ok {
					t.Fatal("Permit type not defined")
				}
				if len(permitFields) != 5 {
					t.Errorf("Permit fields count = %d, want 5", len(permitFields))
				}
			},
		},
		{
			name: "signs message with correct owner and spender",
			signer: &mockClientSigner{
				address:    testOwner,
				signedData: create65ByteSignature(),
			},
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Asset:   baseUSDC,
				Amount:  "2000000",
				PayTo:   testPayTo,
			},
			wantErr: false,
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				if signer.lastMessage["owner"] != testOwner {
					t.Errorf("message.owner = %v, want %s", signer.lastMessage["owner"], testOwner)
				}
				if signer.lastMessage["spender"] != testPayTo {
					t.Errorf("message.spender = %v, want %s", signer.lastMessage["spender"], testPayTo)
				}
				// value should be a *big.Int
				val, ok := signer.lastMessage["value"].(*big.Int)
				if !ok {
					t.Fatalf("message.value is not *big.Int, got %T", signer.lastMessage["value"])
				}
				if val.Cmp(big.NewInt(2000000)) != 0 {
					t.Errorf("message.value = %s, want 2000000", val)
				}
				// nonce should be a *big.Int (default 0)
				nonce, ok := signer.lastMessage["nonce"].(*big.Int)
				if !ok {
					t.Fatalf("message.nonce is not *big.Int, got %T", signer.lastMessage["nonce"])
				}
				if nonce.Cmp(big.NewInt(0)) != 0 {
					t.Errorf("message.nonce = %s, want 0", nonce)
				}
			},
		},
		{
			name: "works with Ethereum mainnet (eip155:1)",
			signer: &mockClientSigner{
				address:    testOwner,
				signedData: create65ByteSignature(),
			},
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:1",
				Asset:   "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
				Amount:  "500000",
				PayTo:   testPayTo,
			},
			wantErr: false,
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				if signer.lastDomain.ChainID.Cmp(big.NewInt(1)) != 0 {
					t.Errorf("domain.ChainID = %s, want 1", signer.lastDomain.ChainID)
				}
			},
		},
		{
			name: "works with Arbitrum (eip155:42161)",
			signer: &mockClientSigner{
				address:    testOwner,
				signedData: create65ByteSignature(),
			},
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:42161",
				Asset:   "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
				Amount:  "3000000",
				PayTo:   testPayTo,
			},
			wantErr: false,
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				if signer.lastDomain.ChainID.Cmp(big.NewInt(42161)) != 0 {
					t.Errorf("domain.ChainID = %s, want 42161", signer.lastDomain.ChainID)
				}
			},
		},
		{
			name: "large amount value is correctly encoded",
			signer: &mockClientSigner{
				address:    testOwner,
				signedData: create65ByteSignature(),
			},
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Asset:   baseUSDC,
				Amount:  "999999999999",
				PayTo:   testPayTo,
			},
			wantErr: false,
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				auth := payload.Payload["authorization"].(map[string]interface{})
				if auth["value"] != "999999999999" {
					t.Errorf("value = %v, want 999999999999", auth["value"])
				}
			},
		},
		{
			name: "error: unsupported network",
			signer: &mockClientSigner{
				address:    testOwner,
				signedData: create65ByteSignature(),
			},
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "unsupported:999999",
				Amount:  "1000000",
				PayTo:   testPayTo,
			},
			wantErr:     true,
			errContains: "unsupported network",
		},
		{
			name: "error: invalid amount (not a number)",
			signer: &mockClientSigner{
				address:    testOwner,
				signedData: create65ByteSignature(),
			},
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Asset:   baseUSDC,
				Amount:  "not-a-number",
				PayTo:   testPayTo,
			},
			wantErr:     true,
			errContains: "invalid amount",
		},
		{
			name: "error: empty amount",
			signer: &mockClientSigner{
				address:    testOwner,
				signedData: create65ByteSignature(),
			},
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Asset:   baseUSDC,
				Amount:  "",
				PayTo:   testPayTo,
			},
			wantErr: true,
		},
		{
			name: "error: signer returns error",
			signer: &mockClientSigner{
				address: testOwner,
				signErr: errors.New("signing failed"),
			},
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Asset:   baseUSDC,
				Amount:  "1000000",
				PayTo:   testPayTo,
			},
			wantErr:     true,
			errContains: "failed to sign permit",
		},
		{
			name: "error: signer returns context deadline exceeded",
			signer: &mockClientSigner{
				address: testOwner,
				signErr: context.DeadlineExceeded,
			},
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Asset:   baseUSDC,
				Amount:  "1000000",
				PayTo:   testPayTo,
			},
			wantErr: true,
		},
		{
			name: "error: invalid signature length (too short)",
			signer: &mockClientSigner{
				address:    testOwner,
				signedData: make([]byte, 32),
			},
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Asset:   baseUSDC,
				Amount:  "1000000",
				PayTo:   testPayTo,
			},
			wantErr:     true,
			errContains: "invalid signature length",
		},
		{
			name: "error: invalid signature length (too long)",
			signer: &mockClientSigner{
				address:    testOwner,
				signedData: make([]byte, 100),
			},
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Asset:   baseUSDC,
				Amount:  "1000000",
				PayTo:   testPayTo,
			},
			wantErr:     true,
			errContains: "invalid signature length",
		},
		{
			name: "error: empty signature from signer",
			signer: &mockClientSigner{
				address:    testOwner,
				signedData: make([]byte, 0),
			},
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Asset:   baseUSDC,
				Amount:  "1000000",
				PayTo:   testPayTo,
			},
			wantErr: true,
		},
		{
			name: "empty routerAddress in extra uses PayTo as spender",
			signer: &mockClientSigner{
				address:    testOwner,
				signedData: create65ByteSignature(),
			},
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Asset:   baseUSDC,
				Amount:  "1000000",
				PayTo:   testPayTo,
				Extra: map[string]interface{}{
					"routerAddress": "",
				},
			},
			wantErr: false,
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				auth := payload.Payload["authorization"].(map[string]interface{})
				if auth["spender"] != testPayTo {
					t.Errorf("spender = %v, want %s (PayTo, since routerAddress is empty)", auth["spender"], testPayTo)
				}
			},
		},
		{
			name: "default permitNonce is 0 when not in extra",
			signer: &mockClientSigner{
				address:    testOwner,
				signedData: create65ByteSignature(),
			},
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Asset:   baseUSDC,
				Amount:  "1000000",
				PayTo:   testPayTo,
			},
			wantErr: false,
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				auth := payload.Payload["authorization"].(map[string]interface{})
				nonce, ok := auth["nonce"].(int)
				if !ok {
					t.Fatalf("nonce is not an int, got %T", auth["nonce"])
				}
				if nonce != 0 {
					t.Errorf("nonce = %d, want 0", nonce)
				}
			},
		},
		{
			name: "each call generates unique payment nonce",
			signer: &mockClientSigner{
				address:    testOwner,
				signedData: create65ByteSignature(),
			},
			requirements: types.PaymentRequirements{
				Scheme:  "upto",
				Network: "eip155:8453",
				Asset:   baseUSDC,
				Amount:  "1000000",
				PayTo:   testPayTo,
			},
			wantErr: false,
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				nonce1, ok := payload.Payload["paymentNonce"].(string)
				if !ok || nonce1 == "" {
					t.Fatal("paymentNonce not set on first call")
				}
				// Payment nonce should start with 0x (hex encoded)
				if !strings.HasPrefix(nonce1, "0x") {
					t.Errorf("paymentNonce = %q, want 0x prefix", nonce1)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := NewUptoEvmScheme(tt.signer)
			payload, err := scheme.CreatePaymentPayload(context.Background(), tt.requirements)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				if tt.errContains != "" && !strings.Contains(err.Error(), tt.errContains) {
					t.Errorf("error = %q, want it to contain %q", err.Error(), tt.errContains)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if tt.validate != nil {
				tt.validate(t, payload, tt.signer)
			}
		})
	}
}

func TestUptoEvmScheme_CreatePaymentPayload_UniqueNonces(t *testing.T) {
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

	nonces := make(map[string]bool)
	for i := 0; i < 10; i++ {
		payload, err := scheme.CreatePaymentPayload(context.Background(), requirements)
		if err != nil {
			t.Fatalf("iteration %d: unexpected error: %v", i, err)
		}
		nonce := payload.Payload["paymentNonce"].(string)
		if nonces[nonce] {
			t.Fatalf("iteration %d: duplicate payment nonce %s", i, nonce)
		}
		nonces[nonce] = true
	}
}

func TestUptoEvmScheme_EIP712Types(t *testing.T) {
	// Verify that the EIP-712 types sent to the signer have the correct structure
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

	// Verify EIP712Domain type fields
	domainFields, ok := signer.lastTypes["EIP712Domain"]
	if !ok {
		t.Fatal("EIP712Domain type not defined")
	}

	expectedDomainFields := []struct {
		name     string
		typeName string
	}{
		{"name", "string"},
		{"version", "string"},
		{"chainId", "uint256"},
		{"verifyingContract", "address"},
	}

	if len(domainFields) != len(expectedDomainFields) {
		t.Fatalf("EIP712Domain fields count = %d, want %d", len(domainFields), len(expectedDomainFields))
	}

	for i, expected := range expectedDomainFields {
		if domainFields[i].Name != expected.name {
			t.Errorf("EIP712Domain[%d].Name = %q, want %q", i, domainFields[i].Name, expected.name)
		}
		if domainFields[i].Type != expected.typeName {
			t.Errorf("EIP712Domain[%d].Type = %q, want %q", i, domainFields[i].Type, expected.typeName)
		}
	}

	// Verify Permit type fields
	permitFields := signer.lastTypes["Permit"]
	expectedPermitFields := []struct {
		name     string
		typeName string
	}{
		{"owner", "address"},
		{"spender", "address"},
		{"value", "uint256"},
		{"nonce", "uint256"},
		{"deadline", "uint256"},
	}

	if len(permitFields) != len(expectedPermitFields) {
		t.Fatalf("Permit fields count = %d, want %d", len(permitFields), len(expectedPermitFields))
	}

	for i, expected := range expectedPermitFields {
		if permitFields[i].Name != expected.name {
			t.Errorf("Permit[%d].Name = %q, want %q", i, permitFields[i].Name, expected.name)
		}
		if permitFields[i].Type != expected.typeName {
			t.Errorf("Permit[%d].Type = %q, want %q", i, permitFields[i].Type, expected.typeName)
		}
	}
}
