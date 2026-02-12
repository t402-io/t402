package main

import (
	"context"
	"crypto/ed25519"
	"crypto/hmac"
	"crypto/sha512"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/t402-io/t402/sdks/go/mechanisms/ton"
)

// testHexKey is a deterministic 64-char hex private key for testing.
// This is NOT a real key and should only be used in tests.
const testHexKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

// testMnemonic24 is a deterministic 24-word mnemonic for testing.
// These are NOT real mnemonic words and should only be used in tests.
const testMnemonic24 = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

// --- Constructor Tests ---

func TestNewFacilitatorTonSigner(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		wantErr bool
		errMsg  string
	}{
		{
			name:    "valid 64-char hex key",
			input:   testHexKey,
			wantErr: false,
		},
		{
			name:    "valid 24-word mnemonic",
			input:   testMnemonic24,
			wantErr: false,
		},
		{
			name:    "empty mnemonic",
			input:   "",
			wantErr: true,
			errMsg:  "TON_MNEMONIC is required",
		},
		{
			name:    "invalid hex (not hex chars)",
			input:   "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
			wantErr: true,
			errMsg:  "invalid private key hex",
		},
		{
			name:    "wrong word count (12 words)",
			input:   "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
			wantErr: true,
			errMsg:  "must be 24 words or a 64-character hex private key",
		},
		{
			name:    "wrong word count (3 words)",
			input:   "one two three",
			wantErr: true,
			errMsg:  "must be 24 words or a 64-character hex private key",
		},
		{
			name:    "single word not 64 chars",
			input:   "abcdef",
			wantErr: true,
			errMsg:  "must be 24 words or a 64-character hex private key",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			signer, err := newFacilitatorTonSigner(tt.input, "", "")

			if tt.wantErr {
				if err == nil {
					t.Fatal("Expected error but got nil")
				}
				if tt.errMsg != "" && !strings.Contains(err.Error(), tt.errMsg) {
					t.Errorf("Error %q does not contain %q", err.Error(), tt.errMsg)
				}
				return
			}

			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}
			if signer == nil {
				t.Fatal("Expected non-nil signer")
			}
			if signer.publicKey == nil {
				t.Error("Expected non-nil public key")
			}
			if len(signer.publicKey) != ed25519.PublicKeySize {
				t.Errorf("Public key length = %d, want %d", len(signer.publicKey), ed25519.PublicKeySize)
			}
		})
	}
}

func TestNewFacilitatorTonSigner_Endpoints(t *testing.T) {
	tests := []struct {
		name        string
		mainnetRPC  string
		testnetRPC  string
		wantMainnet bool
		wantTestnet bool
	}{
		{
			name:        "both RPCs set",
			mainnetRPC:  "https://mainnet.example.com",
			testnetRPC:  "https://testnet.example.com",
			wantMainnet: true,
			wantTestnet: true,
		},
		{
			name:        "only mainnet",
			mainnetRPC:  "https://mainnet.example.com",
			testnetRPC:  "",
			wantMainnet: true,
			wantTestnet: false,
		},
		{
			name:        "only testnet",
			mainnetRPC:  "",
			testnetRPC:  "https://testnet.example.com",
			wantMainnet: false,
			wantTestnet: true,
		},
		{
			name:        "no RPCs",
			mainnetRPC:  "",
			testnetRPC:  "",
			wantMainnet: false,
			wantTestnet: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			signer, err := newFacilitatorTonSigner(testHexKey, tt.mainnetRPC, tt.testnetRPC)
			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}

			_, hasMainnet := signer.endpoints[ton.TonMainnetCAIP2]
			_, hasTestnet := signer.endpoints[ton.TonTestnetCAIP2]

			if hasMainnet != tt.wantMainnet {
				t.Errorf("Mainnet endpoint presence = %v, want %v", hasMainnet, tt.wantMainnet)
			}
			if hasTestnet != tt.wantTestnet {
				t.Errorf("Testnet endpoint presence = %v, want %v", hasTestnet, tt.wantTestnet)
			}

			if tt.wantMainnet {
				if signer.endpoints[ton.TonMainnetCAIP2] != tt.mainnetRPC {
					t.Errorf("Mainnet endpoint = %q, want %q", signer.endpoints[ton.TonMainnetCAIP2], tt.mainnetRPC)
				}
			}
			if tt.wantTestnet {
				if signer.endpoints[ton.TonTestnetCAIP2] != tt.testnetRPC {
					t.Errorf("Testnet endpoint = %q, want %q", signer.endpoints[ton.TonTestnetCAIP2], tt.testnetRPC)
				}
			}
		})
	}
}

func TestNewFacilitatorTonSigner_HexKeyDerivation(t *testing.T) {
	// Verify that the same hex key produces the same public key
	signer1, err := newFacilitatorTonSigner(testHexKey, "", "")
	if err != nil {
		t.Fatalf("First signer creation failed: %v", err)
	}

	signer2, err := newFacilitatorTonSigner(testHexKey, "", "")
	if err != nil {
		t.Fatalf("Second signer creation failed: %v", err)
	}

	if !signer1.publicKey.Equal(signer2.publicKey) {
		t.Error("Same hex key should produce the same public key")
	}
}

func TestNewFacilitatorTonSigner_MnemonicDerivation(t *testing.T) {
	// Verify that the same mnemonic produces the same public key
	signer1, err := newFacilitatorTonSigner(testMnemonic24, "", "")
	if err != nil {
		t.Fatalf("First signer creation failed: %v", err)
	}

	signer2, err := newFacilitatorTonSigner(testMnemonic24, "", "")
	if err != nil {
		t.Fatalf("Second signer creation failed: %v", err)
	}

	if !signer1.publicKey.Equal(signer2.publicKey) {
		t.Error("Same mnemonic should produce the same public key")
	}
}

// --- Constructor with Addresses ---

func TestNewFacilitatorTonSignerWithAddresses(t *testing.T) {
	tests := []struct {
		name        string
		mnemonic    string
		mainnetAddr string
		testnetAddr string
		wantErr     bool
		wantAddrs   int
	}{
		{
			name:        "both addresses provided",
			mnemonic:    testHexKey,
			mainnetAddr: "EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe",
			testnetAddr: "kQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkP6U",
			wantErr:     false,
			wantAddrs:   2,
		},
		{
			name:        "only mainnet address",
			mnemonic:    testHexKey,
			mainnetAddr: "EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe",
			testnetAddr: "",
			wantErr:     false,
			wantAddrs:   1,
		},
		{
			name:        "only testnet address",
			mnemonic:    testHexKey,
			mainnetAddr: "",
			testnetAddr: "kQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkP6U",
			wantErr:     false,
			wantAddrs:   1,
		},
		{
			name:        "no addresses",
			mnemonic:    testHexKey,
			mainnetAddr: "",
			testnetAddr: "",
			wantErr:     false,
			wantAddrs:   0,
		},
		{
			name:        "invalid mnemonic",
			mnemonic:    "",
			mainnetAddr: "EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe",
			testnetAddr: "kQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkP6U",
			wantErr:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			signer, err := newFacilitatorTonSignerWithAddresses(
				tt.mnemonic, "https://mainnet.example.com", "https://testnet.example.com",
				tt.mainnetAddr, tt.testnetAddr,
			)

			if tt.wantErr {
				if err == nil {
					t.Fatal("Expected error but got nil")
				}
				return
			}

			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}
			if signer == nil {
				t.Fatal("Expected non-nil signer")
			}
			if len(signer.addresses) != tt.wantAddrs {
				t.Errorf("Address count = %d, want %d", len(signer.addresses), tt.wantAddrs)
			}

			if tt.mainnetAddr != "" {
				if got := signer.addresses[ton.TonMainnetCAIP2]; got != tt.mainnetAddr {
					t.Errorf("Mainnet address = %q, want %q", got, tt.mainnetAddr)
				}
			}
			if tt.testnetAddr != "" {
				if got := signer.addresses[ton.TonTestnetCAIP2]; got != tt.testnetAddr {
					t.Errorf("Testnet address = %q, want %q", got, tt.testnetAddr)
				}
			}
		})
	}
}

// --- deriveTonSeed ---

func TestDeriveTonSeed(t *testing.T) {
	words := strings.Fields(testMnemonic24)

	seed := deriveTonSeed(words)

	if len(seed) != 32 {
		t.Fatalf("Seed length = %d, want 32", len(seed))
	}

	// Seed should not be all zeros
	allZero := true
	for _, b := range seed {
		if b != 0 {
			allZero = false
			break
		}
	}
	if allZero {
		t.Error("Seed should not be all zeros")
	}

	// Same input should produce same output (deterministic)
	words2 := strings.Fields(testMnemonic24)
	seed2 := deriveTonSeed(words2)

	if hex.EncodeToString(seed) != hex.EncodeToString(seed2) {
		t.Error("deriveTonSeed should be deterministic")
	}
}

func TestDeriveTonSeed_DifferentMnemonics(t *testing.T) {
	words1 := strings.Fields(testMnemonic24)
	// Change the last word to produce a different mnemonic
	words2 := make([]string, len(words1))
	copy(words2, words1)
	words2[23] = "zoo"

	seed1 := deriveTonSeed(words1)
	seed2 := deriveTonSeed(words2)

	if hex.EncodeToString(seed1) == hex.EncodeToString(seed2) {
		t.Error("Different mnemonics should produce different seeds")
	}
}

// --- hmacSha512 ---

func TestHmacSha512(t *testing.T) {
	key := []byte("test-key")
	data := []byte("test-data")

	result := hmacSha512(key, data)

	if len(result) != 64 {
		t.Fatalf("HMAC-SHA512 output length = %d, want 64", len(result))
	}

	// Verify deterministic
	result2 := hmacSha512(key, data)
	if hex.EncodeToString(result) != hex.EncodeToString(result2) {
		t.Error("hmacSha512 should be deterministic")
	}

	// Verify against standard library directly
	h := hmac.New(sha512.New, key)
	h.Write(data)
	expected := h.Sum(nil)
	if hex.EncodeToString(result) != hex.EncodeToString(expected) {
		t.Error("hmacSha512 result does not match standard HMAC-SHA512")
	}

	// Different key should produce different result
	result3 := hmacSha512([]byte("other-key"), data)
	if hex.EncodeToString(result) == hex.EncodeToString(result3) {
		t.Error("Different keys should produce different HMAC results")
	}

	// Different data should produce different result
	result4 := hmacSha512(key, []byte("other-data"))
	if hex.EncodeToString(result) == hex.EncodeToString(result4) {
		t.Error("Different data should produce different HMAC results")
	}
}

func TestHmacSha512_EmptyInputs(t *testing.T) {
	// Empty key and data should still produce a valid 64-byte output
	result := hmacSha512([]byte{}, []byte{})
	if len(result) != 64 {
		t.Fatalf("HMAC-SHA512 with empty inputs length = %d, want 64", len(result))
	}
}

// --- clearWords / clearString ---

func TestClearWords(t *testing.T) {
	words := []string{"hello", "world", "test"}
	clearWords(words)

	// After clearing, the original slice elements should not contain their former values.
	// Note: clearString creates a new byte slice from the string (Go strings are immutable),
	// so this tests the function runs without panics and handles the slice correctly.
	for i, w := range words {
		// The function zeros out a copy; the original string may or may not change
		// depending on Go runtime behavior. We just verify no panic.
		_ = w
		_ = i
	}
}

func TestClearWords_Empty(t *testing.T) {
	// Should not panic on empty slice
	clearWords([]string{})
	clearWords(nil)
}

func TestClearString(t *testing.T) {
	// Should not panic on nil
	clearString(nil)

	// Should not panic on empty string
	empty := ""
	clearString(&empty)

	// Should not panic on regular string
	s := "test-string"
	clearString(&s)
}

// --- GetAddresses ---

func TestGetAddresses(t *testing.T) {
	signer, err := newFacilitatorTonSignerWithAddresses(
		testHexKey,
		"https://mainnet.example.com",
		"https://testnet.example.com",
		"EQMainnetAddress",
		"kQTestnetAddress",
	)
	if err != nil {
		t.Fatalf("Failed to create signer: %v", err)
	}

	ctx := context.Background()

	tests := []struct {
		name      string
		network   string
		wantAddrs []string
		wantLen   int
	}{
		{
			name:      "mainnet returns mainnet address",
			network:   ton.TonMainnetCAIP2,
			wantAddrs: []string{"EQMainnetAddress"},
			wantLen:   1,
		},
		{
			name:      "testnet returns testnet address",
			network:   ton.TonTestnetCAIP2,
			wantAddrs: []string{"kQTestnetAddress"},
			wantLen:   1,
		},
		{
			name:    "unknown network returns all addresses",
			network: "unknown:network",
			wantLen: 2, // both mainnet and testnet addresses
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			addrs := signer.GetAddresses(ctx, tt.network)

			if len(addrs) != tt.wantLen {
				t.Errorf("Address count = %d, want %d", len(addrs), tt.wantLen)
			}

			if tt.wantAddrs != nil {
				for i, want := range tt.wantAddrs {
					if i >= len(addrs) {
						t.Errorf("Missing address at index %d", i)
						continue
					}
					if addrs[i] != want {
						t.Errorf("Address[%d] = %q, want %q", i, addrs[i], want)
					}
				}
			}
		})
	}
}

func TestGetAddresses_NoAddresses(t *testing.T) {
	signer, err := newFacilitatorTonSigner(testHexKey, "", "")
	if err != nil {
		t.Fatalf("Failed to create signer: %v", err)
	}

	ctx := context.Background()

	// No addresses configured, mainnet lookup should return empty
	addrs := signer.GetAddresses(ctx, ton.TonMainnetCAIP2)
	if len(addrs) != 0 {
		t.Errorf("Expected 0 addresses, got %d", len(addrs))
	}

	// Unknown network with no addresses should also return empty
	addrs = signer.GetAddresses(ctx, "unknown:net")
	if len(addrs) != 0 {
		t.Errorf("Expected 0 addresses for unknown network, got %d", len(addrs))
	}
}

// --- getEndpoint ---

func TestGetEndpoint(t *testing.T) {
	signer, err := newFacilitatorTonSigner(testHexKey, "https://custom-mainnet.example.com", "")
	if err != nil {
		t.Fatalf("Failed to create signer: %v", err)
	}

	tests := []struct {
		name    string
		network string
		want    string
		wantErr bool
	}{
		{
			name:    "custom mainnet endpoint",
			network: ton.TonMainnetCAIP2,
			want:    "https://custom-mainnet.example.com",
			wantErr: false,
		},
		{
			name:    "testnet falls back to default config",
			network: ton.TonTestnetCAIP2,
			want:    "https://testnet.toncenter.com/api/v2/jsonRPC",
			wantErr: false,
		},
		{
			name:    "unsupported network returns error",
			network: "unsupported:network",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			endpoint, err := signer.getEndpoint(tt.network)

			if tt.wantErr {
				if err == nil {
					t.Fatal("Expected error but got nil")
				}
				return
			}

			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}
			if endpoint != tt.want {
				t.Errorf("Endpoint = %q, want %q", endpoint, tt.want)
			}
		})
	}
}

// --- tonRPCRequest ---

func TestTonRPCRequest(t *testing.T) {
	// Mock RPC server that returns a successful response
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			t.Errorf("Expected POST, got %s", r.Method)
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("Expected Content-Type application/json, got %s", r.Header.Get("Content-Type"))
		}

		var reqBody map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
			t.Errorf("Failed to decode request body: %v", err)
		}

		if reqBody["method"] != "testMethod" {
			t.Errorf("Expected method 'testMethod', got %v", reqBody["method"])
		}

		resp := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"result":  map[string]interface{}{"data": "test-value"},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	signer := &facilitatorTonSigner{
		addresses: make(map[string]string),
		endpoints: map[string]string{
			ton.TonMainnetCAIP2: server.URL,
		},
	}

	ctx := context.Background()
	result, err := signer.tonRPCRequest(ctx, ton.TonMainnetCAIP2, "testMethod", map[string]interface{}{"key": "value"})
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(result, &parsed); err != nil {
		t.Fatalf("Failed to parse result: %v", err)
	}
	if parsed["data"] != "test-value" {
		t.Errorf("Result data = %v, want 'test-value'", parsed["data"])
	}
}

func TestTonRPCRequest_RPCError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"error": map[string]interface{}{
				"code":    -32600,
				"message": "Invalid request",
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	signer := &facilitatorTonSigner{
		addresses: make(map[string]string),
		endpoints: map[string]string{
			ton.TonMainnetCAIP2: server.URL,
		},
	}

	ctx := context.Background()
	_, err := signer.tonRPCRequest(ctx, ton.TonMainnetCAIP2, "badMethod", nil)
	if err == nil {
		t.Fatal("Expected error for RPC error response")
	}
	if !strings.Contains(err.Error(), "RPC error") {
		t.Errorf("Error %q should contain 'RPC error'", err.Error())
	}
	if !strings.Contains(err.Error(), "Invalid request") {
		t.Errorf("Error %q should contain 'Invalid request'", err.Error())
	}
}

func TestTonRPCRequest_InvalidJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("not-json"))
	}))
	defer server.Close()

	signer := &facilitatorTonSigner{
		addresses: make(map[string]string),
		endpoints: map[string]string{
			ton.TonMainnetCAIP2: server.URL,
		},
	}

	ctx := context.Background()
	_, err := signer.tonRPCRequest(ctx, ton.TonMainnetCAIP2, "testMethod", nil)
	if err == nil {
		t.Fatal("Expected error for invalid JSON response")
	}
	if !strings.Contains(err.Error(), "failed to parse response") {
		t.Errorf("Error %q should contain 'failed to parse response'", err.Error())
	}
}

func TestTonRPCRequest_UnsupportedNetwork(t *testing.T) {
	signer := &facilitatorTonSigner{
		addresses: make(map[string]string),
		endpoints: make(map[string]string),
	}

	ctx := context.Background()
	_, err := signer.tonRPCRequest(ctx, "unsupported:network", "testMethod", nil)
	if err == nil {
		t.Fatal("Expected error for unsupported network")
	}
}

// --- GetJettonBalance ---

func TestGetJettonBalance(t *testing.T) {
	callCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var reqBody map[string]interface{}
		json.NewDecoder(r.Body).Decode(&reqBody)

		params, _ := reqBody["params"].(map[string]interface{})
		method, _ := params["method"].(string)

		callCount++

		if method == "get_wallet_address" {
			// First call: return jetton wallet address
			resp := map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      1,
				"result": map[string]interface{}{
					"exit_code": 0,
					"stack": []interface{}{
						[]interface{}{"tvm.Slice", "EQJettonWalletAddress"},
					},
				},
			}
			json.NewEncoder(w).Encode(resp)
			return
		}

		if method == "get_wallet_data" {
			// Second call: return balance as hex
			resp := map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      1,
				"result": map[string]interface{}{
					"exit_code": 0,
					"stack": []interface{}{
						[]interface{}{"num", "0x3e8"}, // 0x3e8 = 1000
					},
				},
			}
			json.NewEncoder(w).Encode(resp)
			return
		}

		// Fallback
		resp := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"result":  map[string]interface{}{},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	signer := &facilitatorTonSigner{
		addresses: make(map[string]string),
		endpoints: map[string]string{
			ton.TonMainnetCAIP2: server.URL,
		},
	}

	ctx := context.Background()
	balance, err := signer.GetJettonBalance(ctx, ton.GetJettonBalanceParams{
		OwnerAddress:        "EQOwnerAddress",
		JettonMasterAddress: "EQJettonMaster",
		Network:             ton.TonMainnetCAIP2,
	})
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if balance != "1000" {
		t.Errorf("Balance = %q, want '1000'", balance)
	}
}

func TestGetJettonBalance_HexWithout0xPrefix(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var reqBody map[string]interface{}
		json.NewDecoder(r.Body).Decode(&reqBody)

		params, _ := reqBody["params"].(map[string]interface{})
		method, _ := params["method"].(string)

		if method == "get_wallet_address" {
			resp := map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      1,
				"result": map[string]interface{}{
					"exit_code": 0,
					"stack":     []interface{}{[]interface{}{"tvm.Slice", "EQWalletAddr"}},
				},
			}
			json.NewEncoder(w).Encode(resp)
			return
		}

		// Return balance without 0x prefix
		resp := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"result": map[string]interface{}{
				"exit_code": 0,
				"stack":     []interface{}{[]interface{}{"num", "ff"}}, // 255
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	signer := &facilitatorTonSigner{
		addresses: make(map[string]string),
		endpoints: map[string]string{ton.TonMainnetCAIP2: server.URL},
	}

	ctx := context.Background()
	balance, err := signer.GetJettonBalance(ctx, ton.GetJettonBalanceParams{
		OwnerAddress:        "EQOwner",
		JettonMasterAddress: "EQMaster",
		Network:             ton.TonMainnetCAIP2,
	})
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if balance != "255" {
		t.Errorf("Balance = %q, want '255'", balance)
	}
}

func TestGetJettonBalance_WalletNotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Return RPC error to simulate wallet not found
		resp := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"error": map[string]interface{}{
				"code":    -32600,
				"message": "contract not found",
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	signer := &facilitatorTonSigner{
		addresses: make(map[string]string),
		endpoints: map[string]string{ton.TonMainnetCAIP2: server.URL},
	}

	ctx := context.Background()
	balance, err := signer.GetJettonBalance(ctx, ton.GetJettonBalanceParams{
		OwnerAddress:        "EQNonExistent",
		JettonMasterAddress: "EQMaster",
		Network:             ton.TonMainnetCAIP2,
	})
	// Should return "0" gracefully, not error
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if balance != "0" {
		t.Errorf("Balance = %q, want '0' for non-existent wallet", balance)
	}
}

func TestGetJettonBalance_EmptyStack(t *testing.T) {
	callNum := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callNum++
		if callNum == 1 {
			// get_wallet_address succeeds
			resp := map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      1,
				"result": map[string]interface{}{
					"exit_code": 0,
					"stack":     []interface{}{[]interface{}{"tvm.Slice", "EQWallet"}},
				},
			}
			json.NewEncoder(w).Encode(resp)
			return
		}
		// get_wallet_data returns empty stack
		resp := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"result": map[string]interface{}{
				"exit_code": 0,
				"stack":     []interface{}{},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	signer := &facilitatorTonSigner{
		addresses: make(map[string]string),
		endpoints: map[string]string{ton.TonMainnetCAIP2: server.URL},
	}

	ctx := context.Background()
	balance, err := signer.GetJettonBalance(ctx, ton.GetJettonBalanceParams{
		OwnerAddress:        "EQOwner",
		JettonMasterAddress: "EQMaster",
		Network:             ton.TonMainnetCAIP2,
	})
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if balance != "0" {
		t.Errorf("Balance = %q, want '0' for empty stack", balance)
	}
}

// --- GetJettonWalletAddress ---

func TestGetJettonWalletAddress(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"result": map[string]interface{}{
				"exit_code": 0,
				"stack": []interface{}{
					[]interface{}{"tvm.Slice", "EQJettonWalletAddress123"},
				},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	signer := &facilitatorTonSigner{
		addresses: make(map[string]string),
		endpoints: map[string]string{ton.TonMainnetCAIP2: server.URL},
	}

	ctx := context.Background()
	addr, err := signer.GetJettonWalletAddress(ctx, ton.GetJettonWalletParams{
		OwnerAddress:        "EQOwner",
		JettonMasterAddress: "EQMaster",
		Network:             ton.TonMainnetCAIP2,
	})
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if addr != "EQJettonWalletAddress123" {
		t.Errorf("Address = %q, want 'EQJettonWalletAddress123'", addr)
	}
}

func TestGetJettonWalletAddress_NonZeroExitCode(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"result": map[string]interface{}{
				"exit_code": 11,
				"stack":     []interface{}{},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	signer := &facilitatorTonSigner{
		addresses: make(map[string]string),
		endpoints: map[string]string{ton.TonMainnetCAIP2: server.URL},
	}

	ctx := context.Background()
	_, err := signer.GetJettonWalletAddress(ctx, ton.GetJettonWalletParams{
		OwnerAddress:        "EQOwner",
		JettonMasterAddress: "EQMaster",
		Network:             ton.TonMainnetCAIP2,
	})
	if err == nil {
		t.Fatal("Expected error for non-zero exit code")
	}
	if !strings.Contains(err.Error(), "exit code") {
		t.Errorf("Error %q should contain 'exit code'", err.Error())
	}
}

func TestGetJettonWalletAddress_EmptyStack(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"result": map[string]interface{}{
				"exit_code": 0,
				"stack":     []interface{}{},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	signer := &facilitatorTonSigner{
		addresses: make(map[string]string),
		endpoints: map[string]string{ton.TonMainnetCAIP2: server.URL},
	}

	ctx := context.Background()
	_, err := signer.GetJettonWalletAddress(ctx, ton.GetJettonWalletParams{
		OwnerAddress:        "EQOwner",
		JettonMasterAddress: "EQMaster",
		Network:             ton.TonMainnetCAIP2,
	})
	if err == nil {
		t.Fatal("Expected error for empty stack")
	}
	if !strings.Contains(err.Error(), "empty stack") {
		t.Errorf("Error %q should contain 'empty stack'", err.Error())
	}
}

// --- VerifyMessage ---

func TestVerifyMessage_ParameterValidation(t *testing.T) {
	signer, err := newFacilitatorTonSigner(testHexKey, "", "")
	if err != nil {
		t.Fatalf("Failed to create signer: %v", err)
	}

	ctx := context.Background()

	tests := []struct {
		name       string
		params     ton.VerifyMessageParams
		wantReason string
	}{
		{
			name:       "missing signed BOC",
			params:     ton.VerifyMessageParams{Network: ton.TonMainnetCAIP2},
			wantReason: "missing_signed_boc",
		},
		{
			name: "missing expected from",
			params: ton.VerifyMessageParams{
				SignedBoc: "dGVzdA==",
				Network:   ton.TonMainnetCAIP2,
			},
			wantReason: "missing_expected_from",
		},
		{
			name: "missing expected destination",
			params: ton.VerifyMessageParams{
				SignedBoc:    "dGVzdA==",
				ExpectedFrom: "EQDtest",
				Network:      ton.TonMainnetCAIP2,
			},
			wantReason: "missing_expected_destination",
		},
		{
			name: "missing expected amount",
			params: ton.VerifyMessageParams{
				SignedBoc:    "dGVzdA==",
				ExpectedFrom: "EQDtest",
				ExpectedTransfer: ton.ExpectedTransfer{
					Destination: "EQDdest",
				},
				Network: ton.TonMainnetCAIP2,
			},
			wantReason: "missing_expected_amount",
		},
		{
			name: "invalid amount (not a number)",
			params: ton.VerifyMessageParams{
				SignedBoc:    "dGVzdA==",
				ExpectedFrom: "EQDtest",
				ExpectedTransfer: ton.ExpectedTransfer{
					Destination:  "EQDdest",
					JettonAmount: "abc",
				},
				Network: ton.TonMainnetCAIP2,
			},
			wantReason: "invalid_expected_amount",
		},
		{
			name: "invalid amount (zero)",
			params: ton.VerifyMessageParams{
				SignedBoc:    "dGVzdA==",
				ExpectedFrom: "EQDtest",
				ExpectedTransfer: ton.ExpectedTransfer{
					Destination:  "EQDdest",
					JettonAmount: "0",
				},
				Network: ton.TonMainnetCAIP2,
			},
			wantReason: "invalid_expected_amount",
		},
		{
			name: "invalid amount (negative)",
			params: ton.VerifyMessageParams{
				SignedBoc:    "dGVzdA==",
				ExpectedFrom: "EQDtest",
				ExpectedTransfer: ton.ExpectedTransfer{
					Destination:  "EQDdest",
					JettonAmount: "-100",
				},
				Network: ton.TonMainnetCAIP2,
			},
			wantReason: "invalid_expected_amount",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := signer.VerifyMessage(ctx, tt.params)
			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}
			if result.Valid {
				t.Error("Expected Valid = false")
			}
			if result.Reason != tt.wantReason {
				t.Errorf("Reason = %q, want %q", result.Reason, tt.wantReason)
			}
		})
	}
}

func TestVerifyMessage_BOCValidation(t *testing.T) {
	// Mock TON RPC server for estimateFee
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var reqBody map[string]interface{}
		json.NewDecoder(r.Body).Decode(&reqBody)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"result": map[string]interface{}{
				"source_fees": map[string]interface{}{
					"in_fwd_fee": 1,
					"storage_fee": 1,
					"gas_fee": 1,
					"fwd_fee": 1,
				},
			},
		})
	}))
	defer mockServer.Close()

	signer, err := newFacilitatorTonSigner(testHexKey, mockServer.URL, "")
	if err != nil {
		t.Fatalf("Failed to create signer: %v", err)
	}

	// Valid params shared by all BOC tests
	validParams := func(boc string) ton.VerifyMessageParams {
		return ton.VerifyMessageParams{
			SignedBoc:    boc,
			ExpectedFrom: "EQDtest_sender_address",
			ExpectedTransfer: ton.ExpectedTransfer{
				Destination:  "EQDtest_dest_address",
				JettonAmount: "1000000",
			},
			Network: ton.TonMainnetCAIP2,
		}
	}

	ctx := context.Background()

	tests := []struct {
		name       string
		signedBoc  string
		wantValid  bool
		wantReason string
	}{
		{
			name:      "valid BOC with magic bytes",
			signedBoc: base64.StdEncoding.EncodeToString([]byte{0xb5, 0xee, 0x9c, 0x72, 0x01, 0x02}),
			wantValid: true,
		},
		{
			name:      "valid BOC exactly 4 bytes",
			signedBoc: base64.StdEncoding.EncodeToString([]byte{0xb5, 0xee, 0x9c, 0x72}),
			wantValid: true,
		},
		{
			name:       "invalid base64",
			signedBoc:  "not-valid-base64!!!",
			wantValid:  false,
			wantReason: "invalid_boc_encoding",
		},
		{
			name:       "BOC too short (2 bytes)",
			signedBoc:  base64.StdEncoding.EncodeToString([]byte{0x01, 0x02}),
			wantValid:  false,
			wantReason: "boc_too_short",
		},
		{
			name:       "BOC 3 bytes (too short)",
			signedBoc:  base64.StdEncoding.EncodeToString([]byte{0xb5, 0xee, 0x9c}),
			wantValid:  false,
			wantReason: "boc_too_short",
		},
		{
			name:       "invalid magic bytes",
			signedBoc:  base64.StdEncoding.EncodeToString([]byte{0x00, 0x00, 0x00, 0x00, 0x01}),
			wantValid:  false,
			wantReason: "invalid_boc_magic",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := signer.VerifyMessage(ctx, validParams(tt.signedBoc))
			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}
			if result == nil {
				t.Fatal("Expected non-nil result")
			}
			if result.Valid != tt.wantValid {
				t.Errorf("Valid = %v, want %v (reason: %s)", result.Valid, tt.wantValid, result.Reason)
			}
			if !tt.wantValid && result.Reason != tt.wantReason {
				t.Errorf("Reason = %q, want %q", result.Reason, tt.wantReason)
			}
		})
	}
}

func TestVerifyMessage_NodeValidationFailure(t *testing.T) {
	// Mock server that returns an RPC error
	mockServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"error": map[string]interface{}{
				"code":    -32600,
				"message": "invalid BOC",
			},
		})
	}))
	defer mockServer.Close()

	signer, err := newFacilitatorTonSigner(testHexKey, mockServer.URL, "")
	if err != nil {
		t.Fatalf("Failed to create signer: %v", err)
	}

	validBoc := base64.StdEncoding.EncodeToString([]byte{0xb5, 0xee, 0x9c, 0x72, 0x01, 0x02})
	result, err := signer.VerifyMessage(context.Background(), ton.VerifyMessageParams{
		SignedBoc:    validBoc,
		ExpectedFrom: "EQDtest",
		ExpectedTransfer: ton.ExpectedTransfer{
			Destination:  "EQDdest",
			JettonAmount: "1000000",
		},
		Network: ton.TonMainnetCAIP2,
	})
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if result.Valid {
		t.Error("Expected Valid = false when node rejects BOC")
	}
	if result.Reason != "node_validation_failed" {
		t.Errorf("Reason = %q, want %q", result.Reason, "node_validation_failed")
	}
}

// --- SendExternalMessage ---

func TestSendExternalMessage(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var reqBody map[string]interface{}
		json.NewDecoder(r.Body).Decode(&reqBody)

		params, _ := reqBody["params"].(map[string]interface{})
		if params["boc"] != "test-boc" {
			t.Errorf("Expected boc = 'test-boc', got %v", params["boc"])
		}

		resp := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"result": map[string]interface{}{
				"hash": "txhash123abc",
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	signer := &facilitatorTonSigner{
		addresses: make(map[string]string),
		endpoints: map[string]string{ton.TonMainnetCAIP2: server.URL},
	}

	ctx := context.Background()
	hash, err := signer.SendExternalMessage(ctx, "test-boc", ton.TonMainnetCAIP2)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if hash != "txhash123abc" {
		t.Errorf("Hash = %q, want 'txhash123abc'", hash)
	}
}

func TestSendExternalMessage_NoHash(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Return success without a hash
		resp := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"result":  map[string]interface{}{},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	signer := &facilitatorTonSigner{
		addresses: make(map[string]string),
		endpoints: map[string]string{ton.TonMainnetCAIP2: server.URL},
	}

	ctx := context.Background()
	hash, err := signer.SendExternalMessage(ctx, "test-boc", ton.TonMainnetCAIP2)
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if hash != "pending" {
		t.Errorf("Hash = %q, want 'pending'", hash)
	}
}

func TestSendExternalMessage_RPCError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"error": map[string]interface{}{
				"code":    -32600,
				"message": "send failed",
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	signer := &facilitatorTonSigner{
		addresses: make(map[string]string),
		endpoints: map[string]string{ton.TonMainnetCAIP2: server.URL},
	}

	ctx := context.Background()
	_, err := signer.SendExternalMessage(ctx, "test-boc", ton.TonMainnetCAIP2)
	if err == nil {
		t.Fatal("Expected error for RPC failure")
	}
	if !strings.Contains(err.Error(), "failed to send message") {
		t.Errorf("Error %q should contain 'failed to send message'", err.Error())
	}
}

// --- GetSeqno ---

func TestGetSeqno(t *testing.T) {
	tests := []struct {
		name     string
		stack    []interface{}
		exitCode int
		want     int64
	}{
		{
			name:     "seqno as hex string",
			stack:    []interface{}{[]interface{}{"num", "0xa"}}, // 10
			exitCode: 0,
			want:     10,
		},
		{
			name:     "seqno as hex string without prefix",
			stack:    []interface{}{[]interface{}{"num", "1f"}}, // 31
			exitCode: 0,
			want:     31,
		},
		{
			name:     "seqno as float64",
			stack:    []interface{}{[]interface{}{"num", float64(42)}},
			exitCode: 0,
			want:     42,
		},
		{
			name:     "non-zero exit code returns 0",
			stack:    []interface{}{},
			exitCode: 11,
			want:     0,
		},
		{
			name:     "empty stack returns 0",
			stack:    []interface{}{},
			exitCode: 0,
			want:     0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				resp := map[string]interface{}{
					"jsonrpc": "2.0",
					"id":      1,
					"result": map[string]interface{}{
						"exit_code": tt.exitCode,
						"stack":     tt.stack,
					},
				}
				json.NewEncoder(w).Encode(resp)
			}))
			defer server.Close()

			signer := &facilitatorTonSigner{
				addresses: make(map[string]string),
				endpoints: map[string]string{ton.TonMainnetCAIP2: server.URL},
			}

			ctx := context.Background()
			seqno, err := signer.GetSeqno(ctx, "EQTestAddress", ton.TonMainnetCAIP2)
			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}
			if seqno != tt.want {
				t.Errorf("Seqno = %d, want %d", seqno, tt.want)
			}
		})
	}
}

func TestGetSeqno_RPCError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"error": map[string]interface{}{
				"code":    -32600,
				"message": "method not found",
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	signer := &facilitatorTonSigner{
		addresses: make(map[string]string),
		endpoints: map[string]string{ton.TonMainnetCAIP2: server.URL},
	}

	ctx := context.Background()
	_, err := signer.GetSeqno(ctx, "EQTestAddress", ton.TonMainnetCAIP2)
	if err == nil {
		t.Fatal("Expected error for RPC failure")
	}
	if !strings.Contains(err.Error(), "failed to get seqno") {
		t.Errorf("Error %q should contain 'failed to get seqno'", err.Error())
	}
}

// --- IsDeployed ---

func TestIsDeployed(t *testing.T) {
	tests := []struct {
		name  string
		state string
		want  bool
	}{
		{
			name:  "active state",
			state: "active",
			want:  true,
		},
		{
			name:  "uninitialized state",
			state: "uninitialized",
			want:  false,
		},
		{
			name:  "frozen state",
			state: "frozen",
			want:  false,
		},
		{
			name:  "empty state",
			state: "",
			want:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				resp := map[string]interface{}{
					"jsonrpc": "2.0",
					"id":      1,
					"result": map[string]interface{}{
						"state": tt.state,
					},
				}
				json.NewEncoder(w).Encode(resp)
			}))
			defer server.Close()

			signer := &facilitatorTonSigner{
				addresses: make(map[string]string),
				endpoints: map[string]string{ton.TonMainnetCAIP2: server.URL},
			}

			ctx := context.Background()
			deployed, err := signer.IsDeployed(ctx, "EQTestAddress", ton.TonMainnetCAIP2)
			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}
			if deployed != tt.want {
				t.Errorf("IsDeployed = %v, want %v", deployed, tt.want)
			}
		})
	}
}

func TestIsDeployed_RPCError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"error": map[string]interface{}{
				"code":    -32600,
				"message": "address not found",
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	signer := &facilitatorTonSigner{
		addresses: make(map[string]string),
		endpoints: map[string]string{ton.TonMainnetCAIP2: server.URL},
	}

	ctx := context.Background()
	deployed, err := signer.IsDeployed(ctx, "EQTestAddress", ton.TonMainnetCAIP2)
	// Should return false gracefully, not error
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if deployed {
		t.Error("Expected false for RPC error")
	}
}

// --- WaitForTransaction ---

func TestWaitForTransaction_ImmediateConfirmation(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Return seqno = 5, which is >= expected seqno 5
		resp := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"result": map[string]interface{}{
				"exit_code": 0,
				"stack":     []interface{}{[]interface{}{"num", float64(5)}},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	signer := &facilitatorTonSigner{
		addresses: make(map[string]string),
		endpoints: map[string]string{ton.TonMainnetCAIP2: server.URL},
	}

	ctx := context.Background()
	result, err := signer.WaitForTransaction(ctx, ton.WaitForTransactionParams{
		Address: "EQTestAddress",
		Seqno:   5,
		Timeout: 5000, // 5 seconds
		Network: ton.TonMainnetCAIP2,
	})
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if result == nil {
		t.Fatal("Expected non-nil result")
	}
	if !result.Success {
		t.Error("Expected Success = true")
	}
}

func TestWaitForTransaction_ContextCancelled(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Always return seqno = 0 (too low)
		resp := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"result": map[string]interface{}{
				"exit_code": 0,
				"stack":     []interface{}{[]interface{}{"num", float64(0)}},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	signer := &facilitatorTonSigner{
		addresses: make(map[string]string),
		endpoints: map[string]string{ton.TonMainnetCAIP2: server.URL},
	}

	ctx, cancel := context.WithCancel(context.Background())
	// Cancel immediately to trigger context cancellation path
	cancel()

	result, err := signer.WaitForTransaction(ctx, ton.WaitForTransactionParams{
		Address: "EQTestAddress",
		Seqno:   10,
		Timeout: 60000,
		Network: ton.TonMainnetCAIP2,
	})
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if result == nil {
		t.Fatal("Expected non-nil result")
	}
	if result.Success {
		t.Error("Expected Success = false for cancelled context")
	}
}

func TestWaitForTransaction_DefaultTimeout(t *testing.T) {
	// Verify that a zero timeout uses the default (no panic, correct behavior)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Return matching seqno immediately
		resp := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"result": map[string]interface{}{
				"exit_code": 0,
				"stack":     []interface{}{[]interface{}{"num", float64(10)}},
			},
		}
		json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	signer := &facilitatorTonSigner{
		addresses: make(map[string]string),
		endpoints: map[string]string{ton.TonMainnetCAIP2: server.URL},
	}

	ctx := context.Background()
	result, err := signer.WaitForTransaction(ctx, ton.WaitForTransactionParams{
		Address: "EQTestAddress",
		Seqno:   10,
		Timeout: 0, // should default to 60000
		Network: ton.TonMainnetCAIP2,
	})
	if err != nil {
		t.Fatalf("Unexpected error: %v", err)
	}
	if !result.Success {
		t.Errorf("Expected Success = true, got error: %s", result.Error)
	}
}

// --- Zeroize ---

func TestZeroize(t *testing.T) {
	signer, err := newFacilitatorTonSignerWithAddresses(
		testHexKey,
		"https://mainnet.example.com",
		"https://testnet.example.com",
		"EQMainnetAddr",
		"kQTestnetAddr",
	)
	if err != nil {
		t.Fatalf("Failed to create signer: %v", err)
	}

	// Verify signer has data before zeroizing
	if signer.publicKey == nil {
		t.Fatal("Expected non-nil public key before Zeroize")
	}
	if len(signer.addresses) == 0 {
		t.Fatal("Expected non-empty addresses before Zeroize")
	}
	if len(signer.endpoints) == 0 {
		t.Fatal("Expected non-empty endpoints before Zeroize")
	}

	signer.Zeroize()

	// Public key should be nil
	if signer.publicKey != nil {
		t.Error("Public key should be nil after Zeroize")
	}

	// Addresses should be nil
	if signer.addresses != nil {
		t.Error("Addresses should be nil after Zeroize")
	}

	// Endpoints should be nil
	if signer.endpoints != nil {
		t.Error("Endpoints should be nil after Zeroize")
	}
}

func TestZeroize_PublicKeyBytesCleared(t *testing.T) {
	signer, err := newFacilitatorTonSigner(testHexKey, "", "")
	if err != nil {
		t.Fatalf("Failed to create signer: %v", err)
	}

	// Keep a reference to the public key bytes
	pubKeyRef := signer.publicKey

	// Verify it is non-zero before zeroize
	hasNonZero := false
	for _, b := range pubKeyRef {
		if b != 0 {
			hasNonZero = true
			break
		}
	}
	if !hasNonZero {
		t.Fatal("Public key should have non-zero bytes before Zeroize")
	}

	signer.Zeroize()

	// The referenced bytes should be zeroed
	for i, b := range pubKeyRef {
		if b != 0 {
			t.Errorf("Public key byte[%d] = %d, want 0 after Zeroize", i, b)
		}
	}
}

func TestZeroize_Nil(t *testing.T) {
	// Should not panic on nil signer
	var signer *facilitatorTonSigner
	signer.Zeroize()
}

func TestZeroize_EmptyPublicKey(t *testing.T) {
	// Should not panic when publicKey is empty/nil
	signer := &facilitatorTonSigner{
		addresses: make(map[string]string),
		endpoints: make(map[string]string),
	}
	signer.Zeroize()

	if signer.publicKey != nil {
		t.Error("Expected nil public key after Zeroize on empty signer")
	}
}

// --- Interface compliance ---

func TestFacilitatorTonSigner_ImplementsInterface(t *testing.T) {
	// Verify that facilitatorTonSigner implements the FacilitatorTonSigner interface
	var _ ton.FacilitatorTonSigner = (*facilitatorTonSigner)(nil)
}

// --- Integration-style tests with full mock server ---

func TestFullRPCFlow_GetBalanceThenIsDeployed(t *testing.T) {
	// Simulates a realistic flow: check if deployed, then get balance
	requestLog := make([]string, 0)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var reqBody map[string]interface{}
		json.NewDecoder(r.Body).Decode(&reqBody)

		rpcMethod := reqBody["method"].(string)
		params, _ := reqBody["params"].(map[string]interface{})
		method, _ := params["method"].(string)

		entry := fmt.Sprintf("%s:%s", rpcMethod, method)
		requestLog = append(requestLog, entry)

		switch rpcMethod {
		case "getAddressInformation":
			resp := map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      1,
				"result": map[string]interface{}{
					"state": "active",
				},
			}
			json.NewEncoder(w).Encode(resp)
		case "runGetMethod":
			switch method {
			case "get_wallet_address":
				resp := map[string]interface{}{
					"jsonrpc": "2.0",
					"id":      1,
					"result": map[string]interface{}{
						"exit_code": 0,
						"stack":     []interface{}{[]interface{}{"tvm.Slice", "EQWallet"}},
					},
				}
				json.NewEncoder(w).Encode(resp)
			case "get_wallet_data":
				resp := map[string]interface{}{
					"jsonrpc": "2.0",
					"id":      1,
					"result": map[string]interface{}{
						"exit_code": 0,
						"stack":     []interface{}{[]interface{}{"num", "0x2710"}}, // 10000
					},
				}
				json.NewEncoder(w).Encode(resp)
			default:
				resp := map[string]interface{}{
					"jsonrpc": "2.0",
					"id":      1,
					"result":  map[string]interface{}{"exit_code": 0, "stack": []interface{}{}},
				}
				json.NewEncoder(w).Encode(resp)
			}
		default:
			resp := map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      1,
				"result":  map[string]interface{}{},
			}
			json.NewEncoder(w).Encode(resp)
		}
	}))
	defer server.Close()

	signer := &facilitatorTonSigner{
		addresses: map[string]string{
			ton.TonMainnetCAIP2: "EQOwner",
		},
		endpoints: map[string]string{
			ton.TonMainnetCAIP2: server.URL,
		},
	}

	ctx := context.Background()

	// Check deployment
	deployed, err := signer.IsDeployed(ctx, "EQOwner", ton.TonMainnetCAIP2)
	if err != nil {
		t.Fatalf("IsDeployed error: %v", err)
	}
	if !deployed {
		t.Error("Expected deployed = true")
	}

	// Get balance
	balance, err := signer.GetJettonBalance(ctx, ton.GetJettonBalanceParams{
		OwnerAddress:        "EQOwner",
		JettonMasterAddress: "EQMaster",
		Network:             ton.TonMainnetCAIP2,
	})
	if err != nil {
		t.Fatalf("GetJettonBalance error: %v", err)
	}
	if balance != "10000" {
		t.Errorf("Balance = %q, want '10000'", balance)
	}

	// Verify we made expected RPC calls
	if len(requestLog) < 3 {
		t.Errorf("Expected at least 3 RPC calls, got %d", len(requestLog))
	}
}
