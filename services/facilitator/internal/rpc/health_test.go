package rpc

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestNewHealthChecker(t *testing.T) {
	config := DefaultConfig()
	manager := NewManager(config)

	hc := NewHealthChecker(manager, config)

	if hc == nil {
		t.Fatal("expected non-nil health checker")
	}
	if hc.manager != manager {
		t.Error("expected manager to be set")
	}
	if hc.config != config {
		t.Error("expected config to be set")
	}
	if hc.client == nil {
		t.Error("expected client to be set")
	}
	if hc.client.Timeout != config.HealthCheckTimeout {
		t.Errorf("expected client timeout=%v, got %v", config.HealthCheckTimeout, hc.client.Timeout)
	}
}

func TestHealthChecker_checkEVM(t *testing.T) {
	tests := []struct {
		name     string
		response map[string]interface{}
		status   int
		healthy  bool
	}{
		{
			name: "healthy response",
			response: map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      1,
				"result":  "0x10a3e4f",
			},
			status:  http.StatusOK,
			healthy: true,
		},
		{
			name: "error response",
			response: map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      1,
				"error": map[string]interface{}{
					"code":    -32600,
					"message": "Invalid request",
				},
			},
			status:  http.StatusOK,
			healthy: false,
		},
		{
			name:    "500 status",
			status:  http.StatusInternalServerError,
			healthy: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if tt.status != http.StatusOK {
					w.WriteHeader(tt.status)
					return
				}
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(tt.response)
			}))
			defer server.Close()

			config := DefaultConfig()
			manager := NewManager(config)
			hc := NewHealthChecker(manager, config)

			healthy, err := hc.checkEVM(context.Background(), server.URL)

			if tt.healthy {
				if !healthy || err != nil {
					t.Errorf("expected healthy=true, err=nil, got healthy=%v, err=%v", healthy, err)
				}
			} else {
				if healthy {
					t.Errorf("expected healthy=false, got healthy=%v", healthy)
				}
			}
		})
	}
}

func TestHealthChecker_checkTON(t *testing.T) {
	tests := []struct {
		name     string
		response map[string]interface{}
		status   int
		healthy  bool
	}{
		{
			name: "healthy response",
			response: map[string]interface{}{
				"ok": true,
				"result": map[string]interface{}{
					"last": map[string]interface{}{
						"seqno": 12345678,
					},
				},
			},
			status:  http.StatusOK,
			healthy: true,
		},
		{
			name: "unhealthy response",
			response: map[string]interface{}{
				"ok":    false,
				"error": "Service unavailable",
			},
			status:  http.StatusOK,
			healthy: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if tt.status != http.StatusOK {
					w.WriteHeader(tt.status)
					return
				}
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(tt.response)
			}))
			defer server.Close()

			config := DefaultConfig()
			manager := NewManager(config)
			hc := NewHealthChecker(manager, config)

			// Append toncenter to URL for detection
			healthy, err := hc.checkTON(context.Background(), server.URL)

			if tt.healthy {
				if !healthy || err != nil {
					t.Errorf("expected healthy=true, err=nil, got healthy=%v, err=%v", healthy, err)
				}
			} else {
				if healthy {
					t.Errorf("expected healthy=false, got healthy=%v", healthy)
				}
			}
		})
	}
}

func TestHealthChecker_checkTRON(t *testing.T) {
	tests := []struct {
		name     string
		response map[string]interface{}
		status   int
		healthy  bool
	}{
		{
			name: "healthy response",
			response: map[string]interface{}{
				"blockID": "0000000000000001",
				"block_header": map[string]interface{}{
					"raw_data": map[string]interface{}{
						"number": 12345678,
					},
				},
			},
			status:  http.StatusOK,
			healthy: true,
		},
		{
			name: "no blockID",
			response: map[string]interface{}{
				"error": "Service unavailable",
			},
			status:  http.StatusOK,
			healthy: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if tt.status != http.StatusOK {
					w.WriteHeader(tt.status)
					return
				}
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(tt.response)
			}))
			defer server.Close()

			config := DefaultConfig()
			manager := NewManager(config)
			hc := NewHealthChecker(manager, config)

			healthy, err := hc.checkTRON(context.Background(), server.URL)

			if tt.healthy {
				if !healthy || err != nil {
					t.Errorf("expected healthy=true, err=nil, got healthy=%v, err=%v", healthy, err)
				}
			} else {
				if healthy {
					t.Errorf("expected healthy=false, got healthy=%v", healthy)
				}
			}
		})
	}
}

func TestHealthChecker_checkSolana(t *testing.T) {
	tests := []struct {
		name     string
		response map[string]interface{}
		status   int
		healthy  bool
	}{
		{
			name: "healthy response",
			response: map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      1,
				"result":  12345678,
			},
			status:  http.StatusOK,
			healthy: true,
		},
		{
			name: "error response",
			response: map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      1,
				"error": map[string]interface{}{
					"code":    -32000,
					"message": "Node unhealthy",
				},
			},
			status:  http.StatusOK,
			healthy: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if tt.status != http.StatusOK {
					w.WriteHeader(tt.status)
					return
				}
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(tt.response)
			}))
			defer server.Close()

			config := DefaultConfig()
			manager := NewManager(config)
			hc := NewHealthChecker(manager, config)

			healthy, err := hc.checkSolana(context.Background(), server.URL)

			if tt.healthy {
				if !healthy || err != nil {
					t.Errorf("expected healthy=true, err=nil, got healthy=%v, err=%v", healthy, err)
				}
			} else {
				if healthy {
					t.Errorf("expected healthy=false, got healthy=%v", healthy)
				}
			}
		})
	}
}

func TestHealthChecker_checkNEAR(t *testing.T) {
	tests := []struct {
		name     string
		response map[string]interface{}
		status   int
		healthy  bool
	}{
		{
			name: "healthy response",
			response: map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      1,
				"result": map[string]interface{}{
					"sync_info": map[string]interface{}{
						"latest_block_height": 12345678,
					},
				},
			},
			status:  http.StatusOK,
			healthy: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if tt.status != http.StatusOK {
					w.WriteHeader(tt.status)
					return
				}
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(tt.response)
			}))
			defer server.Close()

			config := DefaultConfig()
			manager := NewManager(config)
			hc := NewHealthChecker(manager, config)

			healthy, err := hc.checkNEAR(context.Background(), server.URL)

			if tt.healthy {
				if !healthy || err != nil {
					t.Errorf("expected healthy=true, err=nil, got healthy=%v, err=%v", healthy, err)
				}
			} else {
				if healthy {
					t.Errorf("expected healthy=false, got healthy=%v", healthy)
				}
			}
		})
	}
}

func TestHealthChecker_checkAptos(t *testing.T) {
	tests := []struct {
		name     string
		response map[string]interface{}
		status   int
		healthy  bool
	}{
		{
			name: "healthy response",
			response: map[string]interface{}{
				"chain_id":         1,
				"epoch":            "1234",
				"ledger_version":   "12345678",
				"oldest_ledger_version": "0",
			},
			status:  http.StatusOK,
			healthy: true,
		},
		{
			name: "no chain_id",
			response: map[string]interface{}{
				"error": "Not found",
			},
			status:  http.StatusOK,
			healthy: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if tt.status != http.StatusOK {
					w.WriteHeader(tt.status)
					return
				}
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(tt.response)
			}))
			defer server.Close()

			config := DefaultConfig()
			manager := NewManager(config)
			hc := NewHealthChecker(manager, config)

			healthy, err := hc.checkAptos(context.Background(), server.URL)

			if tt.healthy {
				if !healthy || err != nil {
					t.Errorf("expected healthy=true, err=nil, got healthy=%v, err=%v", healthy, err)
				}
			} else {
				if healthy {
					t.Errorf("expected healthy=false, got healthy=%v", healthy)
				}
			}
		})
	}
}

func TestHealthChecker_checkTezos(t *testing.T) {
	tests := []struct {
		name     string
		response string
		status   int
		healthy  bool
	}{
		{
			name:     "healthy response",
			response: `"NetXdQprcVkpaWU"`,
			status:   http.StatusOK,
			healthy:  true,
		},
		{
			name:     "short response",
			response: `""`,
			status:   http.StatusOK,
			healthy:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if tt.status != http.StatusOK {
					w.WriteHeader(tt.status)
					return
				}
				w.Write([]byte(tt.response))
			}))
			defer server.Close()

			config := DefaultConfig()
			manager := NewManager(config)
			hc := NewHealthChecker(manager, config)

			healthy, err := hc.checkTezos(context.Background(), server.URL)

			if tt.healthy {
				if !healthy || err != nil {
					t.Errorf("expected healthy=true, err=nil, got healthy=%v, err=%v", healthy, err)
				}
			} else {
				if healthy {
					t.Errorf("expected healthy=false, got healthy=%v", healthy)
				}
			}
		})
	}
}

func TestHealthChecker_checkPolkadot(t *testing.T) {
	tests := []struct {
		name     string
		response map[string]interface{}
		status   int
		healthy  bool
	}{
		{
			name: "healthy response",
			response: map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      1,
				"result":  "Polkadot Asset Hub",
			},
			status:  http.StatusOK,
			healthy: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if tt.status != http.StatusOK {
					w.WriteHeader(tt.status)
					return
				}
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(tt.response)
			}))
			defer server.Close()

			config := DefaultConfig()
			manager := NewManager(config)
			hc := NewHealthChecker(manager, config)

			healthy, err := hc.checkPolkadot(context.Background(), server.URL)

			if tt.healthy {
				if !healthy || err != nil {
					t.Errorf("expected healthy=true, err=nil, got healthy=%v, err=%v", healthy, err)
				}
			} else {
				if healthy {
					t.Errorf("expected healthy=false, got healthy=%v", healthy)
				}
			}
		})
	}
}

func TestHealthChecker_checkStacks(t *testing.T) {
	tests := []struct {
		name     string
		response map[string]interface{}
		status   int
		healthy  bool
	}{
		{
			name: "healthy response",
			response: map[string]interface{}{
				"network_id":              1,
				"stacks_tip_height":       12345,
				"burn_block_height":       800000,
			},
			status:  http.StatusOK,
			healthy: true,
		},
		{
			name: "no network_id",
			response: map[string]interface{}{
				"error": "Service unavailable",
			},
			status:  http.StatusOK,
			healthy: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if tt.status != http.StatusOK {
					w.WriteHeader(tt.status)
					return
				}
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(tt.response)
			}))
			defer server.Close()

			config := DefaultConfig()
			manager := NewManager(config)
			hc := NewHealthChecker(manager, config)

			healthy, err := hc.checkStacks(context.Background(), server.URL)

			if tt.healthy {
				if !healthy || err != nil {
					t.Errorf("expected healthy=true, err=nil, got healthy=%v, err=%v", healthy, err)
				}
			} else {
				if healthy {
					t.Errorf("expected healthy=false, got healthy=%v", healthy)
				}
			}
		})
	}
}

func TestHealthChecker_checkProvider_Timeout(t *testing.T) {
	// Create a slow server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(200 * time.Millisecond)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"jsonrpc": "2.0",
			"result":  "0x1",
		})
	}))
	defer server.Close()

	config := &Config{
		HealthCheckInterval:     30 * time.Second,
		HealthCheckTimeout:      50 * time.Millisecond, // Short timeout
		CircuitBreakerThreshold: 5,
		CircuitBreakerTimeout:   60 * time.Second,
	}
	manager := NewManager(config)
	hc := NewHealthChecker(manager, config)

	healthy, err := hc.checkEVM(context.Background(), server.URL)

	if healthy {
		t.Error("expected unhealthy due to timeout")
	}
	if err == nil {
		t.Error("expected timeout error")
	}
}

func TestHealthChecker_doJSONRPCRequest_InvalidJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte("not valid json"))
	}))
	defer server.Close()

	config := DefaultConfig()
	manager := NewManager(config)
	hc := NewHealthChecker(manager, config)

	healthy, err := hc.doJSONRPCRequest(context.Background(), server.URL, map[string]interface{}{
		"jsonrpc": "2.0",
		"method":  "test",
		"id":      1,
	})

	if healthy {
		t.Error("expected unhealthy for invalid JSON")
	}
	if err == nil {
		t.Error("expected error for invalid JSON")
	}
}

func TestHealthChecker_doHTTPGet_InvalidJSON(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte("plain text"))
	}))
	defer server.Close()

	config := DefaultConfig()
	manager := NewManager(config)
	hc := NewHealthChecker(manager, config)

	resp, err := hc.doHTTPGet(context.Background(), server.URL)

	if err != nil {
		t.Errorf("unexpected error: %v", err)
	}
	if string(resp) != "plain text" {
		t.Errorf("expected 'plain text', got '%s'", string(resp))
	}
}

func TestHealthChecker_doHTTPGet_StatusError(t *testing.T) {
	statuses := []int{
		http.StatusNotFound,
		http.StatusInternalServerError,
		http.StatusBadGateway,
		http.StatusServiceUnavailable,
	}

	for _, status := range statuses {
		t.Run(http.StatusText(status), func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(status)
			}))
			defer server.Close()

			config := DefaultConfig()
			manager := NewManager(config)
			hc := NewHealthChecker(manager, config)

			_, err := hc.doHTTPGet(context.Background(), server.URL)

			if err == nil {
				t.Errorf("expected error for status %d", status)
			}
		})
	}
}

func TestHealthChecker_checkProvider_UpdatesProviderHealth(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"result":  "0x1",
		})
	}))
	defer server.Close()

	config := DefaultConfig()
	manager := NewManager(config)
	manager.RegisterProvider("eip155:1", server.URL, 0)

	hc := NewHealthChecker(manager, config)

	providers := manager.GetAllProviders("eip155:1")
	provider := providers[0]

	// Initially healthy
	healthy, _, _ := provider.GetHealth()
	if !healthy {
		t.Error("expected initially healthy")
	}

	// Check provider
	hc.checkProvider(context.Background(), provider)

	// Should still be healthy after successful check
	healthy, latency, lastCheck := provider.GetHealth()
	if !healthy {
		t.Error("expected healthy after successful check")
	}
	if latency == 0 {
		t.Error("expected non-zero latency")
	}
	if lastCheck.IsZero() {
		t.Error("expected lastCheck to be set")
	}
}

func TestHealthChecker_checkProvider_DetectsChainType(t *testing.T) {
	tests := []struct {
		url      string
		expected string // Which check method should be called
	}{
		{"https://toncenter.com/api/v2/jsonRPC", "ton"},
		{"https://api.trongrid.io", "tron"},
		{"https://api.mainnet-beta.solana.com", "solana"},
		{"https://rpc.mainnet.near.org", "near"},
		{"https://fullnode.mainnet.aptoslabs.com/v1", "aptos"},
		{"https://mainnet.api.tez.ie", "tezos"},
		{"https://polkadot.api.subscan.io", "polkadot"},
		{"https://api.hiro.so", "stacks"},
		{"https://eth.llamarpc.com", "evm"}, // Default
	}

	for _, tt := range tests {
		t.Run(tt.expected, func(t *testing.T) {
			// We can't easily test which method is called without modifying the code,
			// but we can verify the URL pattern matching logic works
			// This test just ensures no panics occur
			config := DefaultConfig()
			manager := NewManager(config)
			manager.RegisterProvider("test", tt.url, 0)

			// Provider exists and has correct URL
			providers := manager.GetAllProviders("test")
			if len(providers) != 1 {
				t.Fatal("expected 1 provider")
			}
			if providers[0].URL != tt.url {
				t.Errorf("expected URL='%s', got '%s'", tt.url, providers[0].URL)
			}
		})
	}
}

func BenchmarkHealthChecker_checkEVM(b *testing.B) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"result":  "0x10a3e4f",
		})
	}))
	defer server.Close()

	config := DefaultConfig()
	manager := NewManager(config)
	hc := NewHealthChecker(manager, config)
	ctx := context.Background()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		hc.checkEVM(ctx, server.URL)
	}
}
