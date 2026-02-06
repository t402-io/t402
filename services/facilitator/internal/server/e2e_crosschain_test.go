package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/services/facilitator/internal/config"
)

// ===========================================================================
// Cross-Chain E2E Tests
// ===========================================================================

// TestE2E_EVMExactPaymentFlow tests the EVM exact payment flow with realistic payloads
func TestE2E_EVMExactPaymentFlow(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name         string
		network      string
		asset        string
		expectVerify bool
	}{
		{
			name:         "Ethereum Mainnet USDT0",
			network:      "eip155:1",
			asset:        "usdt0",
			expectVerify: true,
		},
		{
			name:         "Base USDT0",
			network:      "eip155:8453",
			asset:        "usdt0",
			expectVerify: true,
		},
		{
			name:         "Arbitrum USDT0",
			network:      "eip155:42161",
			asset:        "usdt0",
			expectVerify: true,
		},
		{
			name:         "Ink USDT0",
			network:      "eip155:57073",
			asset:        "usdt0",
			expectVerify: true,
		},
		{
			name:         "Berachain USDT0",
			network:      "eip155:80094",
			asset:        "usdt0",
			expectVerify: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mock := createEVMExactMockFacilitator(tt.network, tt.expectVerify)
			server := createFullTestServer(mock, nil)

			// Create V2 payload
			payload := createV2EVMPayload(tt.network, "exact", tt.asset, "1000000")

			body, _ := json.Marshal(map[string]interface{}{
				"paymentPayload":      payload,
				"paymentRequirements": createV2Requirements(tt.network, "exact", tt.asset, "1000000"),
			})

			req := httptest.NewRequest(http.MethodPost, "/verify", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			server.router.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Errorf("expected status 200, got %d, body: %s", w.Code, w.Body.String())
			}

			var resp t402.VerifyResponse
			if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
				t.Fatalf("failed to parse response: %v", err)
			}

			if resp.IsValid != tt.expectVerify {
				t.Errorf("expected IsValid=%v, got %v", tt.expectVerify, resp.IsValid)
			}
		})
	}
}

// TestE2E_EVMLegacyPaymentFlow tests the EVM exact-legacy payment flow
func TestE2E_EVMLegacyPaymentFlow(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name         string
		network      string
		asset        string
		expectVerify bool
	}{
		{
			name:         "BNB Chain Legacy USDT",
			network:      "eip155:56",
			asset:        "usdt",
			expectVerify: true,
		},
		{
			name:         "Avalanche Legacy USDT",
			network:      "eip155:43114",
			asset:        "usdt",
			expectVerify: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mock := createEVMLegacyMockFacilitator(tt.network, tt.expectVerify)
			server := createFullTestServer(mock, nil)

			// Create V2 payload with legacy scheme
			payload := createV2EVMLegacyPayload(tt.network, "exact-legacy", tt.asset, "1000000")

			body, _ := json.Marshal(map[string]interface{}{
				"paymentPayload":      payload,
				"paymentRequirements": createV2Requirements(tt.network, "exact-legacy", tt.asset, "1000000"),
			})

			req := httptest.NewRequest(http.MethodPost, "/verify", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			server.router.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Errorf("expected status 200, got %d, body: %s", w.Code, w.Body.String())
			}
		})
	}
}

// TestE2E_TONPaymentFlow tests TON Jetton payment flow
func TestE2E_TONPaymentFlow(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name         string
		network      string
		expectVerify bool
	}{
		{
			name:         "TON Mainnet USDT",
			network:      "ton:mainnet",
			expectVerify: true,
		},
		{
			name:         "TON Testnet USDT",
			network:      "ton:testnet",
			expectVerify: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mock := createTONMockFacilitator(tt.network, tt.expectVerify)
			server := createFullTestServer(mock, nil)

			payload := createV2TONPayload(tt.network, "exact", "usdt", "1000000")

			body, _ := json.Marshal(map[string]interface{}{
				"paymentPayload":      payload,
				"paymentRequirements": createV2Requirements(tt.network, "exact", "usdt", "1000000"),
			})

			req := httptest.NewRequest(http.MethodPost, "/verify", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			server.router.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Errorf("expected status 200, got %d, body: %s", w.Code, w.Body.String())
			}
		})
	}
}

// TestE2E_TRONPaymentFlow tests TRON TRC-20 payment flow
func TestE2E_TRONPaymentFlow(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name         string
		network      string
		expectVerify bool
	}{
		{
			name:         "TRON Mainnet USDT",
			network:      "tron:mainnet",
			expectVerify: true,
		},
		{
			name:         "TRON Nile Testnet",
			network:      "tron:nile",
			expectVerify: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mock := createTRONMockFacilitator(tt.network, tt.expectVerify)
			server := createFullTestServer(mock, nil)

			payload := createV2TRONPayload(tt.network, "exact", "usdt", "1000000")

			body, _ := json.Marshal(map[string]interface{}{
				"paymentPayload":      payload,
				"paymentRequirements": createV2Requirements(tt.network, "exact", "usdt", "1000000"),
			})

			req := httptest.NewRequest(http.MethodPost, "/verify", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			server.router.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Errorf("expected status 200, got %d, body: %s", w.Code, w.Body.String())
			}
		})
	}
}

// TestE2E_SolanaPaymentFlow tests Solana SPL token payment flow
func TestE2E_SolanaPaymentFlow(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name         string
		network      string
		expectVerify bool
	}{
		{
			name:         "Solana Mainnet USDT",
			network:      "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
			expectVerify: true,
		},
		{
			name:         "Solana Devnet",
			network:      "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
			expectVerify: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mock := createSolanaMockFacilitator(tt.network, tt.expectVerify)
			server := createFullTestServer(mock, nil)

			payload := createV2SolanaPayload(tt.network, "exact", "usdt", "1000000")

			body, _ := json.Marshal(map[string]interface{}{
				"paymentPayload":      payload,
				"paymentRequirements": createV2Requirements(tt.network, "exact", "usdt", "1000000"),
			})

			req := httptest.NewRequest(http.MethodPost, "/verify", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			server.router.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Errorf("expected status 200, got %d, body: %s", w.Code, w.Body.String())
			}
		})
	}
}

// TestE2E_NEARPaymentFlow tests NEAR NEP-141 payment flow
func TestE2E_NEARPaymentFlow(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name         string
		network      string
		expectVerify bool
	}{
		{
			name:         "NEAR Mainnet USDT",
			network:      "near:mainnet",
			expectVerify: true,
		},
		{
			name:         "NEAR Testnet",
			network:      "near:testnet",
			expectVerify: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mock := createNEARMockFacilitator(tt.network, tt.expectVerify)
			server := createFullTestServer(mock, nil)

			payload := createV2NEARPayload(tt.network, "exact-direct", "usdt", "1000000")

			body, _ := json.Marshal(map[string]interface{}{
				"paymentPayload":      payload,
				"paymentRequirements": createV2Requirements(tt.network, "exact-direct", "usdt", "1000000"),
			})

			req := httptest.NewRequest(http.MethodPost, "/verify", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			server.router.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Errorf("expected status 200, got %d, body: %s", w.Code, w.Body.String())
			}
		})
	}
}

// TestE2E_AptosPaymentFlow tests Aptos Fungible Asset payment flow
func TestE2E_AptosPaymentFlow(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name         string
		network      string
		expectVerify bool
	}{
		{
			name:         "Aptos Mainnet USDT",
			network:      "aptos:1",
			expectVerify: true,
		},
		{
			name:         "Aptos Testnet",
			network:      "aptos:2",
			expectVerify: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mock := createAptosMockFacilitator(tt.network, tt.expectVerify)
			server := createFullTestServer(mock, nil)

			payload := createV2AptosPayload(tt.network, "exact-direct", "usdt", "1000000")

			body, _ := json.Marshal(map[string]interface{}{
				"paymentPayload":      payload,
				"paymentRequirements": createV2Requirements(tt.network, "exact-direct", "usdt", "1000000"),
			})

			req := httptest.NewRequest(http.MethodPost, "/verify", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			server.router.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Errorf("expected status 200, got %d, body: %s", w.Code, w.Body.String())
			}
		})
	}
}

// TestE2E_TezosPaymentFlow tests Tezos FA2 payment flow
func TestE2E_TezosPaymentFlow(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name         string
		network      string
		expectVerify bool
	}{
		{
			name:         "Tezos Mainnet USDT",
			network:      "tezos:NetXdQprcVkpaWU",
			expectVerify: true,
		},
		{
			name:         "Tezos Ghostnet",
			network:      "tezos:NetXnHfVqm9iesp",
			expectVerify: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mock := createTezosMockFacilitator(tt.network, tt.expectVerify)
			server := createFullTestServer(mock, nil)

			payload := createV2TezosPayload(tt.network, "exact-direct", "usdt", "1000000")

			body, _ := json.Marshal(map[string]interface{}{
				"paymentPayload":      payload,
				"paymentRequirements": createV2Requirements(tt.network, "exact-direct", "usdt", "1000000"),
			})

			req := httptest.NewRequest(http.MethodPost, "/verify", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			server.router.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Errorf("expected status 200, got %d, body: %s", w.Code, w.Body.String())
			}
		})
	}
}

// TestE2E_PolkadotPaymentFlow tests Polkadot Asset Hub payment flow
func TestE2E_PolkadotPaymentFlow(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name         string
		network      string
		expectVerify bool
	}{
		{
			name:         "Polkadot Asset Hub USDT",
			network:      "polkadot:68d56f15f85d3136970ec16946040bc1",
			expectVerify: true,
		},
		{
			name:         "Westend Asset Hub",
			network:      "polkadot:e143f23803ac50e8f6f8e62695d1ce9e",
			expectVerify: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mock := createPolkadotMockFacilitator(tt.network, tt.expectVerify)
			server := createFullTestServer(mock, nil)

			payload := createV2PolkadotPayload(tt.network, "exact-direct", "usdt", "1000000")

			body, _ := json.Marshal(map[string]interface{}{
				"paymentPayload":      payload,
				"paymentRequirements": createV2Requirements(tt.network, "exact-direct", "usdt", "1000000"),
			})

			req := httptest.NewRequest(http.MethodPost, "/verify", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			server.router.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Errorf("expected status 200, got %d, body: %s", w.Code, w.Body.String())
			}
		})
	}
}

// TestE2E_StacksPaymentFlow tests Stacks SIP-010 payment flow
func TestE2E_StacksPaymentFlow(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name         string
		network      string
		expectVerify bool
	}{
		{
			name:         "Stacks Mainnet USDT",
			network:      "stacks:1",
			expectVerify: true,
		},
		{
			name:         "Stacks Testnet",
			network:      "stacks:2147483648",
			expectVerify: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mock := createStacksMockFacilitator(tt.network, tt.expectVerify)
			server := createFullTestServer(mock, nil)

			payload := createV2StacksPayload(tt.network, "exact-direct", "usdt", "1000000")

			body, _ := json.Marshal(map[string]interface{}{
				"paymentPayload":      payload,
				"paymentRequirements": createV2Requirements(tt.network, "exact-direct", "usdt", "1000000"),
			})

			req := httptest.NewRequest(http.MethodPost, "/verify", bytes.NewBuffer(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			server.router.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Errorf("expected status 200, got %d, body: %s", w.Code, w.Body.String())
			}
		})
	}
}

// TestE2E_SettlementFlow tests full settlement flow for multiple chains
func TestE2E_SettlementFlow(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name     string
		network  string
		scheme   string
		txHash   string
		createFn func(string, bool) *MockFacilitator
	}{
		{
			name:     "EVM Settlement",
			network:  "eip155:8453",
			scheme:   "exact",
			txHash:   "0xabc123def456",
			createFn: createEVMExactMockFacilitator,
		},
		{
			name:     "TON Settlement",
			network:  "ton:mainnet",
			scheme:   "exact",
			txHash:   "abc123def456789",
			createFn: createTONMockFacilitator,
		},
		{
			name:     "TRON Settlement",
			network:  "tron:mainnet",
			scheme:   "exact",
			txHash:   "abc123def456789012345678901234567890",
			createFn: createTRONMockFacilitator,
		},
		{
			name:     "Solana Settlement",
			network:  "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
			scheme:   "exact",
			txHash:   "5xYz...abc",
			createFn: createSolanaMockFacilitator,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mock := tt.createFn(tt.network, true)
			mock.SettleFunc = func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
				return &t402.SettleResponse{
					Success:     true,
					Payer:       "0x1234567890abcdef",
					Transaction: tt.txHash,
					Network:     t402.Network(tt.network),
				}, nil
			}
			server := createFullTestServer(mock, nil)

			// P1-2: Include amount in payload to satisfy amount validation
			body := fmt.Sprintf(`{"paymentPayload":{"t402Version":2,"payload":{"amount":"1000000"},"accepted":{"scheme":"%s","network":"%s"}},"paymentRequirements":{"network":"%s","scheme":"%s","asset":"usdt","amount":"1000000","payTo":"0xrecipient"}}`,
				tt.scheme, tt.network, tt.network, tt.scheme)

			req := httptest.NewRequest(http.MethodPost, "/settle", bytes.NewBufferString(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			server.router.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Errorf("expected status 200, got %d, body: %s", w.Code, w.Body.String())
			}

			var resp t402.SettleResponse
			if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
				t.Fatalf("failed to parse response: %v", err)
			}

			if !resp.Success {
				t.Error("expected Success=true")
			}
			if resp.Transaction != tt.txHash {
				t.Errorf("expected Transaction=%s, got %s", tt.txHash, resp.Transaction)
			}
		})
	}
}

// TestE2E_SupportedNetworks tests the /supported endpoint returns all configured networks
func TestE2E_SupportedNetworks(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mock := &MockFacilitator{
		VerifyFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
			return &t402.VerifyResponse{IsValid: true}, nil
		},
		SettleFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{Success: true}, nil
		},
		GetSupportedFunc: func() t402.SupportedResponse {
			return t402.SupportedResponse{
				Kinds: []t402.SupportedKind{
					// EVM Networks
					{T402Version: 2, Scheme: "exact", Network: "eip155:1"},
					{T402Version: 2, Scheme: "exact", Network: "eip155:8453"},
					{T402Version: 2, Scheme: "exact", Network: "eip155:42161"},
					{T402Version: 2, Scheme: "exact-legacy", Network: "eip155:56"},
					{T402Version: 2, Scheme: "upto", Network: "eip155:1"},
					// TON
					{T402Version: 2, Scheme: "exact", Network: "ton:mainnet"},
					{T402Version: 2, Scheme: "exact", Network: "ton:testnet"},
					// TRON
					{T402Version: 2, Scheme: "exact", Network: "tron:mainnet"},
					// Solana
					{T402Version: 2, Scheme: "exact", Network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"},
					// NEAR
					{T402Version: 2, Scheme: "exact-direct", Network: "near:mainnet"},
					// Aptos
					{T402Version: 2, Scheme: "exact-direct", Network: "aptos:1"},
					// Tezos
					{T402Version: 2, Scheme: "exact-direct", Network: "tezos:NetXdQprcVkpaWU"},
					// Polkadot
					{T402Version: 2, Scheme: "exact-direct", Network: "polkadot:68d56f15f85d3136970ec16946040bc1"},
					// Stacks
					{T402Version: 2, Scheme: "exact-direct", Network: "stacks:1"},
				},
				Signers: map[string][]string{
					"eip155:*":    {"0xC88f67e776f16DcFBf42e6bDda1B82604448899B"},
					"ton:*":       {"EQ5d11d21276ac6b5efdf179e654ff0c6eee34e0abfa263a"},
					"tron:*":      {"TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5"},
					"solana:*":    {"8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL"},
					"near:*":      {},
					"aptos:*":     {},
					"tezos:*":     {},
					"polkadot:*":  {},
					"stacks:*":    {},
				},
				Extensions: []string{"receipts", "preauth"},
			}
		},
	}

	server := createFullTestServer(mock, nil)

	req := httptest.NewRequest(http.MethodGet, "/supported", nil)
	w := httptest.NewRecorder()

	server.router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp t402.SupportedResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	// Verify we have networks from all supported chains
	networkFamilies := map[string]bool{
		"eip155":   false,
		"ton":      false,
		"tron":     false,
		"solana":   false,
		"near":     false,
		"aptos":    false,
		"tezos":    false,
		"polkadot": false,
		"stacks":   false,
	}

	for _, kind := range resp.Kinds {
		for family := range networkFamilies {
			if len(kind.Network) >= len(family) && kind.Network[:len(family)] == family {
				networkFamilies[family] = true
			}
		}
	}

	for family, found := range networkFamilies {
		if !found {
			t.Errorf("expected network family %s to be supported", family)
		}
	}

	// Verify signers are returned
	if len(resp.Signers) == 0 {
		t.Error("expected signers to be returned")
	}

	if _, ok := resp.Signers["eip155:*"]; !ok {
		t.Error("expected EVM signers")
	}
}

// TestE2E_NetworkMismatchErrors tests error handling for network mismatches
func TestE2E_NetworkMismatchErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mock := &MockFacilitator{
		VerifyFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
			// Parse payloads to check network mismatch
			var payload struct {
				Accepted struct {
					Network string `json:"network"`
				} `json:"accepted"`
			}
			var requirements struct {
				Network string `json:"network"`
			}

			json.Unmarshal(payloadBytes, &payload)
			json.Unmarshal(requirementsBytes, &requirements)

			if payload.Accepted.Network != requirements.Network {
				return &t402.VerifyResponse{
					IsValid:       false,
					InvalidReason: "network_mismatch",
				}, nil
			}

			return &t402.VerifyResponse{IsValid: true}, nil
		},
		SettleFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{Success: true}, nil
		},
	}

	server := createFullTestServer(mock, nil)

	// Payload for one network, requirements for another
	body := `{
		"paymentPayload": {
			"t402Version": 2,
			"payload": {},
			"accepted": {
				"scheme": "exact",
				"network": "eip155:1"
			}
		},
		"paymentRequirements": {
			"network": "eip155:8453",
			"scheme": "exact",
			"asset": "usdt0",
			"amount": "1000000",
			"payTo": "0xrecipient"
		}
	}`

	req := httptest.NewRequest(http.MethodPost, "/verify", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	server.router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp t402.VerifyResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if resp.IsValid {
		t.Error("expected IsValid=false for network mismatch")
	}
}

// TestE2E_InsufficientAmount tests error handling for insufficient payment amounts
func TestE2E_InsufficientAmount(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mock := &MockFacilitator{
		VerifyFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
			return &t402.VerifyResponse{
				IsValid:       false,
				InvalidReason: "insufficient_amount",
				Payer:         "0x1234567890abcdef",
			}, nil
		},
		SettleFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{Success: true}, nil
		},
	}

	server := createFullTestServer(mock, nil)

	body := `{
		"paymentPayload": {
			"t402Version": 2,
			"payload": {
				"authorization": {
					"value": "500000"
				}
			},
			"accepted": {
				"scheme": "exact",
				"network": "eip155:8453"
			}
		},
		"paymentRequirements": {
			"network": "eip155:8453",
			"scheme": "exact",
			"asset": "usdt0",
			"amount": "1000000",
			"payTo": "0xrecipient"
		}
	}`

	req := httptest.NewRequest(http.MethodPost, "/verify", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	server.router.ServeHTTP(w, req)

	var resp t402.VerifyResponse
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp.IsValid {
		t.Error("expected IsValid=false for insufficient amount")
	}
	if resp.InvalidReason != "insufficient_amount" {
		t.Errorf("expected InvalidReason=insufficient_amount, got %s", resp.InvalidReason)
	}
}

// TestE2E_ConcurrentRequests tests handling concurrent requests across chains
func TestE2E_ConcurrentRequests(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var requestCount atomic.Int64
	mock := &MockFacilitator{
		VerifyFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
			count := requestCount.Add(1)
			// Simulate some processing time
			time.Sleep(10 * time.Millisecond)
			return &t402.VerifyResponse{
				IsValid: true,
				Payer:   fmt.Sprintf("payer-%d", count),
			}, nil
		},
		SettleFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{Success: true}, nil
		},
	}

	cfg := &config.Config{
		Port:              8080,
		Environment:       "test",
		RateLimitRequests: 1000,
		RateLimitWindow:   60,
	}

	server := createFullTestServer(mock, cfg)

	networks := []string{
		"eip155:1",
		"eip155:8453",
		"ton:mainnet",
		"tron:mainnet",
		"solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
	}

	done := make(chan bool, len(networks))

	for _, network := range networks {
		go func(net string) {
			body := fmt.Sprintf(`{"paymentPayload":{"t402Version":2,"payload":{},"accepted":{"scheme":"exact","network":"%s"}},"paymentRequirements":{"network":"%s","scheme":"exact"}}`, net, net)
			req := httptest.NewRequest(http.MethodPost, "/verify", bytes.NewBufferString(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			server.router.ServeHTTP(w, req)

			if w.Code != http.StatusOK {
				t.Errorf("concurrent request to %s failed: status %d", net, w.Code)
			}
			done <- true
		}(network)
	}

	// Wait for all requests
	for i := 0; i < len(networks); i++ {
		<-done
	}
}

// ===========================================================================
// Helper Functions - Mock Facilitators
// ===========================================================================

func createEVMExactMockFacilitator(network string, expectValid bool) *MockFacilitator {
	return &MockFacilitator{
		VerifyFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
			return &t402.VerifyResponse{
				IsValid: expectValid,
				Payer:   "0x1234567890123456789012345678901234567890",
			}, nil
		},
		SettleFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{
				Success:     true,
				Payer:       "0x1234567890123456789012345678901234567890",
				Transaction: "0x" + "a1b2c3d4e5f6" + "0123456789abcdef",
				Network:     t402.Network(network),
			}, nil
		},
		GetSupportedFunc: func() t402.SupportedResponse {
			return t402.SupportedResponse{
				Kinds: []t402.SupportedKind{
					{T402Version: 2, Scheme: "exact", Network: network},
				},
				Signers: map[string][]string{
					"eip155:*": {"0xC88f67e776f16DcFBf42e6bDda1B82604448899B"},
				},
			}
		},
	}
}

func createEVMLegacyMockFacilitator(network string, expectValid bool) *MockFacilitator {
	return &MockFacilitator{
		VerifyFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
			return &t402.VerifyResponse{
				IsValid: expectValid,
				Payer:   "0x1234567890123456789012345678901234567890",
			}, nil
		},
		SettleFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{Success: true, Network: t402.Network(network)}, nil
		},
		GetSupportedFunc: func() t402.SupportedResponse {
			return t402.SupportedResponse{
				Kinds: []t402.SupportedKind{
					{T402Version: 2, Scheme: "exact-legacy", Network: network},
				},
			}
		},
	}
}

func createTONMockFacilitator(network string, expectValid bool) *MockFacilitator {
	return &MockFacilitator{
		VerifyFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
			return &t402.VerifyResponse{
				IsValid: expectValid,
				Payer:   "EQBIhPuWmjT7fP-VomuTWseE8JNWv2q7QYfsVQ1IZwnMk8wL",
			}, nil
		},
		SettleFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{Success: true, Network: t402.Network(network)}, nil
		},
		GetSupportedFunc: func() t402.SupportedResponse {
			return t402.SupportedResponse{
				Kinds: []t402.SupportedKind{
					{T402Version: 2, Scheme: "exact", Network: network},
				},
				Signers: map[string][]string{
					"ton:*": {"EQ5d11d21276ac6b5efdf179e654ff0c6eee34e0abfa263a"},
				},
			}
		},
	}
}

func createTRONMockFacilitator(network string, expectValid bool) *MockFacilitator {
	return &MockFacilitator{
		VerifyFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
			return &t402.VerifyResponse{
				IsValid: expectValid,
				Payer:   "TYsbwBMBxcT4nbrPYDpzEjvjPSYM8bX5LW",
			}, nil
		},
		SettleFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{Success: true, Network: t402.Network(network)}, nil
		},
		GetSupportedFunc: func() t402.SupportedResponse {
			return t402.SupportedResponse{
				Kinds: []t402.SupportedKind{
					{T402Version: 2, Scheme: "exact", Network: network},
				},
				Signers: map[string][]string{
					"tron:*": {"TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5"},
				},
			}
		},
	}
}

func createSolanaMockFacilitator(network string, expectValid bool) *MockFacilitator {
	return &MockFacilitator{
		VerifyFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
			return &t402.VerifyResponse{
				IsValid: expectValid,
				Payer:   "6Cust2qxLyJYPTWjRLfBbYhPJjCiCJXWXcJXCCNpVH8c",
			}, nil
		},
		SettleFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{Success: true, Network: t402.Network(network)}, nil
		},
		GetSupportedFunc: func() t402.SupportedResponse {
			return t402.SupportedResponse{
				Kinds: []t402.SupportedKind{
					{T402Version: 2, Scheme: "exact", Network: network},
				},
				Signers: map[string][]string{
					"solana:*": {"8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL"},
				},
			}
		},
	}
}

func createNEARMockFacilitator(network string, expectValid bool) *MockFacilitator {
	return &MockFacilitator{
		VerifyFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
			return &t402.VerifyResponse{
				IsValid: expectValid,
				Payer:   "alice.near",
			}, nil
		},
		SettleFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{Success: true, Network: t402.Network(network)}, nil
		},
		GetSupportedFunc: func() t402.SupportedResponse {
			return t402.SupportedResponse{
				Kinds: []t402.SupportedKind{
					{T402Version: 2, Scheme: "exact-direct", Network: network},
				},
			}
		},
	}
}

func createAptosMockFacilitator(network string, expectValid bool) *MockFacilitator {
	return &MockFacilitator{
		VerifyFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
			return &t402.VerifyResponse{
				IsValid: expectValid,
				Payer:   "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			}, nil
		},
		SettleFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{Success: true, Network: t402.Network(network)}, nil
		},
		GetSupportedFunc: func() t402.SupportedResponse {
			return t402.SupportedResponse{
				Kinds: []t402.SupportedKind{
					{T402Version: 2, Scheme: "exact-direct", Network: network},
				},
			}
		},
	}
}

func createTezosMockFacilitator(network string, expectValid bool) *MockFacilitator {
	return &MockFacilitator{
		VerifyFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
			return &t402.VerifyResponse{
				IsValid: expectValid,
				Payer:   "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
			}, nil
		},
		SettleFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{Success: true, Network: t402.Network(network)}, nil
		},
		GetSupportedFunc: func() t402.SupportedResponse {
			return t402.SupportedResponse{
				Kinds: []t402.SupportedKind{
					{T402Version: 2, Scheme: "exact-direct", Network: network},
				},
			}
		},
	}
}

func createPolkadotMockFacilitator(network string, expectValid bool) *MockFacilitator {
	return &MockFacilitator{
		VerifyFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
			return &t402.VerifyResponse{
				IsValid: expectValid,
				Payer:   "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
			}, nil
		},
		SettleFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{Success: true, Network: t402.Network(network)}, nil
		},
		GetSupportedFunc: func() t402.SupportedResponse {
			return t402.SupportedResponse{
				Kinds: []t402.SupportedKind{
					{T402Version: 2, Scheme: "exact-direct", Network: network},
				},
			}
		},
	}
}

func createStacksMockFacilitator(network string, expectValid bool) *MockFacilitator {
	return &MockFacilitator{
		VerifyFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
			return &t402.VerifyResponse{
				IsValid: expectValid,
				Payer:   "SP2J6Y27VSPWMK82VY1GJWPC9NH0T32XRVPG9JJN3",
			}, nil
		},
		SettleFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{Success: true, Network: t402.Network(network)}, nil
		},
		GetSupportedFunc: func() t402.SupportedResponse {
			return t402.SupportedResponse{
				Kinds: []t402.SupportedKind{
					{T402Version: 2, Scheme: "exact-direct", Network: network},
				},
			}
		},
	}
}

// ===========================================================================
// Helper Functions - Payload Creation
// ===========================================================================

func createV2Requirements(network, scheme, asset, amount string) map[string]interface{} {
	return map[string]interface{}{
		"scheme":            scheme,
		"network":           network,
		"asset":             asset,
		"amount":            amount,
		"payTo":             "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
		"maxTimeoutSeconds": 300,
	}
}

func createV2EVMPayload(network, scheme, asset, amount string) map[string]interface{} {
	validAfter := fmt.Sprintf("%d", time.Now().Unix()-3600)
	validBefore := fmt.Sprintf("%d", time.Now().Unix()+3600)

	return map[string]interface{}{
		"t402Version": 2,
		"payload": map[string]interface{}{
			"signature": "0x" + "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b21b",
			"authorization": map[string]interface{}{
				"from":        "0x1234567890123456789012345678901234567890",
				"to":          "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
				"value":       amount,
				"validAfter":  validAfter,
				"validBefore": validBefore,
				"nonce":       "0x" + "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
			},
		},
		"accepted": map[string]interface{}{
			"scheme":  scheme,
			"network": network,
			"asset":   asset,
			"amount":  amount,
			"payTo":   "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
		},
	}
}

func createV2EVMLegacyPayload(network, scheme, asset, amount string) map[string]interface{} {
	validAfter := fmt.Sprintf("%d", time.Now().Unix()-3600)
	validBefore := fmt.Sprintf("%d", time.Now().Unix()+3600)

	return map[string]interface{}{
		"t402Version": 2,
		"payload": map[string]interface{}{
			"signature": "0x" + "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b21b",
			"authorization": map[string]interface{}{
				"from":        "0x1234567890123456789012345678901234567890",
				"to":          "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
				"value":       amount,
				"validAfter":  validAfter,
				"validBefore": validBefore,
				"nonce":       "0x" + "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
				"spender":     "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
			},
		},
		"accepted": map[string]interface{}{
			"scheme":  scheme,
			"network": network,
			"asset":   asset,
			"amount":  amount,
			"payTo":   "0xC88f67e776f16DcFBf42e6bDda1B82604448899B",
		},
	}
}

func createV2TONPayload(network, scheme, asset, amount string) map[string]interface{} {
	return map[string]interface{}{
		"t402Version": 2,
		"payload": map[string]interface{}{
			"signature": "base64signaturehere==",
			"authorization": map[string]interface{}{
				"from":    "EQBIhPuWmjT7fP-VomuTWseE8JNWv2q7QYfsVQ1IZwnMk8wL",
				"to":      "EQ5d11d21276ac6b5efdf179e654ff0c6eee34e0abfa263a",
				"amount":  amount,
				"queryId": "12345678901234567890",
			},
		},
		"accepted": map[string]interface{}{
			"scheme":  scheme,
			"network": network,
			"asset":   asset,
			"amount":  amount,
			"payTo":   "EQ5d11d21276ac6b5efdf179e654ff0c6eee34e0abfa263a",
		},
	}
}

func createV2TRONPayload(network, scheme, asset, amount string) map[string]interface{} {
	return map[string]interface{}{
		"t402Version": 2,
		"payload": map[string]interface{}{
			"signature": "hexsignaturehere",
			"authorization": map[string]interface{}{
				"from":   "TYsbwBMBxcT4nbrPYDpzEjvjPSYM8bX5LW",
				"to":     "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
				"amount": amount,
			},
		},
		"accepted": map[string]interface{}{
			"scheme":  scheme,
			"network": network,
			"asset":   asset,
			"amount":  amount,
			"payTo":   "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
		},
	}
}

func createV2SolanaPayload(network, scheme, asset, amount string) map[string]interface{} {
	return map[string]interface{}{
		"t402Version": 2,
		"payload": map[string]interface{}{
			"signature": "base58signaturehere",
			"authorization": map[string]interface{}{
				"from":   "6Cust2qxLyJYPTWjRLfBbYhPJjCiCJXWXcJXCCNpVH8c",
				"to":     "8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL",
				"amount": amount,
			},
		},
		"accepted": map[string]interface{}{
			"scheme":  scheme,
			"network": network,
			"asset":   asset,
			"amount":  amount,
			"payTo":   "8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL",
		},
	}
}

func createV2NEARPayload(network, scheme, asset, amount string) map[string]interface{} {
	return map[string]interface{}{
		"t402Version": 2,
		"payload": map[string]interface{}{
			"txHash":   "9xYz...abc",
			"senderId": "alice.near",
		},
		"accepted": map[string]interface{}{
			"scheme":  scheme,
			"network": network,
			"asset":   asset,
			"amount":  amount,
			"payTo":   "bob.near",
		},
	}
}

func createV2AptosPayload(network, scheme, asset, amount string) map[string]interface{} {
	return map[string]interface{}{
		"t402Version": 2,
		"payload": map[string]interface{}{
			"txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
		},
		"accepted": map[string]interface{}{
			"scheme":  scheme,
			"network": network,
			"asset":   asset,
			"amount":  amount,
			"payTo":   "0xrecipient",
		},
	}
}

func createV2TezosPayload(network, scheme, asset, amount string) map[string]interface{} {
	return map[string]interface{}{
		"t402Version": 2,
		"payload": map[string]interface{}{
			"opHash": "ooNWy8DzPShk7qMk9PJoXVGNSdP8vfWVVmZPZJDQvPqXfuCFrCZ",
		},
		"accepted": map[string]interface{}{
			"scheme":  scheme,
			"network": network,
			"asset":   asset,
			"amount":  amount,
			"payTo":   "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
		},
	}
}

func createV2PolkadotPayload(network, scheme, asset, amount string) map[string]interface{} {
	return map[string]interface{}{
		"t402Version": 2,
		"payload": map[string]interface{}{
			"extrinsicHash":  "0xabcdef1234567890",
			"blockHash":      "0x1234567890abcdef",
			"extrinsicIndex": 0,
		},
		"accepted": map[string]interface{}{
			"scheme":  scheme,
			"network": network,
			"asset":   asset,
			"amount":  amount,
			"payTo":   "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
		},
	}
}

func createV2StacksPayload(network, scheme, asset, amount string) map[string]interface{} {
	return map[string]interface{}{
		"t402Version": 2,
		"payload": map[string]interface{}{
			"txId": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
		},
		"accepted": map[string]interface{}{
			"scheme":  scheme,
			"network": network,
			"asset":   asset,
			"amount":  amount,
			"payTo":   "SP2J6Y27VSPWMK82VY1GJWPC9NH0T32XRVPG9JJN3",
		},
	}
}
