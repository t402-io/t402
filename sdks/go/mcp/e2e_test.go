package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// startMockFacilitator starts a mock facilitator HTTP server for E2E tests.
func startMockFacilitator(t *testing.T) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		switch {
		case r.URL.Path == "/supported" && r.Method == "GET":
			json.NewEncoder(w).Encode(map[string]any{
				"networks": []map[string]any{
					{"network": "eip155:8453", "name": "base", "schemes": []string{"exact"}},
					{"network": "eip155:1", "name": "ethereum", "schemes": []string{"exact"}},
					{"network": "eip155:42161", "name": "arbitrum", "schemes": []string{"exact"}},
				},
			})
		case r.URL.Path == "/verify" && r.Method == "POST":
			json.NewEncoder(w).Encode(map[string]any{
				"isValid":       true,
				"invalidReason": nil,
				"payer":         "0x1234567890abcdef1234567890abcdef12345678",
				"network":       "eip155:8453",
				"scheme":        "exact",
				"amount":        "1000000",
			})
		case r.URL.Path == "/settle" && r.Method == "POST":
			json.NewEncoder(w).Encode(map[string]any{
				"success":     true,
				"transaction": "0x" + strings.Repeat("0", 64),
				"network":     "eip155:8453",
				"payer":       "0x1234567890abcdef1234567890abcdef12345678",
			})
		default:
			w.WriteHeader(http.StatusNotFound)
			json.NewEncoder(w).Encode(map[string]string{"error": "Not found"})
		}
	}))
}

// sendRequest is a helper that sends a JSON-RPC request to the MCP server and returns the response.
func sendRequest(t *testing.T, config *ServerConfig, request string) JSONRPCResponse {
	t.Helper()

	pr, pw := io.Pipe()
	go func() {
		pw.Write([]byte(request + "\n"))
		pw.Close()
	}()

	output := &bytes.Buffer{}
	server := NewServerWithIO(config, pr, output)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_ = server.Run(ctx)

	var response JSONRPCResponse
	err := json.Unmarshal(output.Bytes(), &response)
	require.NoError(t, err)

	return response
}

// ========================
// E2E: Server Lifecycle
// ========================

func TestE2E_ServerInitialize(t *testing.T) {
	facilitator := startMockFacilitator(t)
	defer facilitator.Close()

	config := &ServerConfig{DemoMode: true}
	response := sendRequest(t, config, `{"jsonrpc":"2.0","id":1,"method":"initialize"}`)

	assert.Equal(t, "2.0", response.JSONRPC)
	assert.Nil(t, response.Error)

	result, ok := response.Result.(map[string]any)
	require.True(t, ok)

	serverInfo, ok := result["serverInfo"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "t402", serverInfo["name"])
	assert.Equal(t, "1.0.0", serverInfo["version"])

	capabilities, ok := result["capabilities"].(map[string]any)
	require.True(t, ok)
	assert.Contains(t, capabilities, "tools")
}

func TestE2E_ServerListTools(t *testing.T) {
	facilitator := startMockFacilitator(t)
	defer facilitator.Close()

	config := &ServerConfig{DemoMode: true}
	response := sendRequest(t, config, `{"jsonrpc":"2.0","id":2,"method":"tools/list"}`)

	assert.Nil(t, response.Error)

	result, ok := response.Result.(map[string]any)
	require.True(t, ok)

	tools, ok := result["tools"].([]any)
	require.True(t, ok)
	assert.Len(t, tools, 25)

	// Verify all expected tools are listed
	toolNames := make(map[string]bool)
	for _, tool := range tools {
		toolMap, ok := tool.(map[string]any)
		require.True(t, ok)
		name, ok := toolMap["name"].(string)
		require.True(t, ok)
		toolNames[name] = true
	}

	expectedTools := []string{
		// Original 6 (pre-Phase C)
		"t402/getBalance", "t402/getAllBalances", "t402/pay",
		"t402/payGasless", "t402/getBridgeFee", "t402/bridge",
		// Phase C Batch 1 (2026-04-24)
		"t402/getTokenPrice", "t402/getGasPrice", "t402/signMessage",
		// Phase C Batch 2 — WDK tools (2026-04-24)
		"t402/wdk/getWallet", "t402/wdk/getBalances", "t402/wdk/transfer",
		// Phase C Batch 3 (2026-04-24)
		"t402/verifySignature", "t402/estimatePaymentFee", "t402/compareNetworkFees",
		"t402/getHistoricalPrice", "t402/quoteBridge", "t402/executeBridgeFromQuote",
		// Phase C Batch 4 (2026-04-25)
		"t402/searchBazaar", "t402/payForService", "t402/autoPay",
		"t402/erc8004/resolveAgent", "t402/erc8004/verifyWallet", "t402/erc8004/checkReputation",
		"t402/getTransferHistory",
	}
	for _, expected := range expectedTools {
		assert.True(t, toolNames[expected], "Missing tool: %s", expected)
	}
}

// ========================
// E2E: Tool Calls (Demo Mode)
// ========================

func TestE2E_Tools(t *testing.T) {
	facilitator := startMockFacilitator(t)
	defer facilitator.Close()

	config := &ServerConfig{DemoMode: true}

	tests := []struct {
		name       string
		toolName   string
		arguments  map[string]any
		wantError  bool
		wantInText string
	}{
		{
			name:     "getBalance on ethereum",
			toolName: "t402/getBalance",
			arguments: map[string]any{
				"address": "0x1234567890abcdef1234567890abcdef12345678",
				"network": "ethereum",
			},
			wantError:  false,
			wantInText: "Balance on ethereum",
		},
		{
			name:     "getBalance on invalid network",
			toolName: "t402/getBalance",
			arguments: map[string]any{
				"address": "0x1234567890abcdef1234567890abcdef12345678",
				"network": "invalid",
			},
			wantError:  true,
			wantInText: "Invalid network",
		},
		{
			name:     "getAllBalances",
			toolName: "t402/getAllBalances",
			arguments: map[string]any{
				"address": "0x1234567890abcdef1234567890abcdef12345678",
			},
			wantError:  false,
			wantInText: "Balances Across All Networks",
		},
		{
			name:     "pay in demo mode",
			toolName: "t402/pay",
			arguments: map[string]any{
				"to":      "0x1234567890abcdef1234567890abcdef12345678",
				"amount":  "100",
				"token":   "USDC",
				"network": "ethereum",
			},
			wantError:  false,
			wantInText: "Demo Mode",
		},
		{
			name:     "pay with invalid network",
			toolName: "t402/pay",
			arguments: map[string]any{
				"to":      "0x1234567890abcdef1234567890abcdef12345678",
				"amount":  "100",
				"token":   "USDC",
				"network": "invalid",
			},
			wantError:  true,
			wantInText: "Invalid network",
		},
		{
			name:     "pay with unsupported token on network",
			toolName: "t402/pay",
			arguments: map[string]any{
				"to":      "0x1234567890abcdef1234567890abcdef12345678",
				"amount":  "100",
				"token":   "USDT",
				"network": "base",
			},
			wantError:  true,
			wantInText: "not supported",
		},
		{
			name:     "payGasless in demo mode",
			toolName: "t402/payGasless",
			arguments: map[string]any{
				"to":      "0x1234567890abcdef1234567890abcdef12345678",
				"amount":  "50",
				"token":   "USDC",
				"network": "base",
			},
			wantError:  false,
			wantInText: "Demo Mode",
		},
		{
			name:     "payGasless on non-gasless network",
			toolName: "t402/payGasless",
			arguments: map[string]any{
				"to":      "0x1234567890abcdef1234567890abcdef12345678",
				"amount":  "50",
				"token":   "USDC",
				"network": "ink",
			},
			wantError:  true,
			wantInText: "does not support gasless",
		},
		{
			name:     "getBridgeFee in demo mode",
			toolName: "t402/getBridgeFee",
			arguments: map[string]any{
				"fromChain": "arbitrum",
				"toChain":   "ethereum",
				"amount":    "100",
				"recipient": "0x1234567890abcdef1234567890abcdef12345678",
			},
			wantError:  false,
			wantInText: "Bridge Fee Quote",
		},
		{
			name:     "getBridgeFee same chain error",
			toolName: "t402/getBridgeFee",
			arguments: map[string]any{
				"fromChain": "arbitrum",
				"toChain":   "arbitrum",
				"amount":    "100",
				"recipient": "0x1234567890abcdef1234567890abcdef12345678",
			},
			wantError:  true,
			wantInText: "different",
		},
		{
			name:     "getBridgeFee non-bridgeable chain",
			toolName: "t402/getBridgeFee",
			arguments: map[string]any{
				"fromChain": "base",
				"toChain":   "ethereum",
				"amount":    "100",
				"recipient": "0x1234567890abcdef1234567890abcdef12345678",
			},
			wantError:  true,
			wantInText: "does not support",
		},
		{
			name:     "bridge in demo mode",
			toolName: "t402/bridge",
			arguments: map[string]any{
				"fromChain": "ethereum",
				"toChain":   "arbitrum",
				"amount":    "500",
				"recipient": "0x1234567890abcdef1234567890abcdef12345678",
			},
			wantError:  false,
			wantInText: "Demo Mode",
		},
		{
			name:     "bridge same chain error",
			toolName: "t402/bridge",
			arguments: map[string]any{
				"fromChain": "ethereum",
				"toChain":   "ethereum",
				"amount":    "500",
				"recipient": "0x1234567890abcdef1234567890abcdef12345678",
			},
			wantError:  true,
			wantInText: "different",
		},
		{
			name:       "unknown tool",
			toolName:   "t402/doesNotExist",
			arguments:  map[string]any{},
			wantError:  true,
			wantInText: "Unknown tool",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			argsJSON, err := json.Marshal(tt.arguments)
			require.NoError(t, err)

			params := fmt.Sprintf(`{"name":"%s","arguments":%s}`, tt.toolName, string(argsJSON))
			request := fmt.Sprintf(`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":%s}`, params)

			response := sendRequest(t, config, request)

			resultMap, ok := response.Result.(map[string]any)
			require.True(t, ok, "Expected result to be a map")

			isError, _ := resultMap["isError"].(bool)

			// Tests that hit real RPCs may timeout in CI — skip assertions if we got
			// a network error when we expected success
			if !tt.wantError && isError {
				content, cOk := resultMap["content"].([]any)
				if cOk && len(content) > 0 {
					if fb, fbOk := content[0].(map[string]any); fbOk {
						if txt, tOk := fb["text"].(string); tOk {
							if strings.Contains(txt, "deadline exceeded") || strings.Contains(txt, "timeout") || strings.Contains(txt, "connection refused") || strings.Contains(txt, "403 Forbidden") {
								t.Skipf("Skipping due to RPC network issue: %s", txt)
							}
						}
					}
				}
			}

			assert.Equal(t, tt.wantError, isError, "isError mismatch for %s", tt.name)

			content, ok := resultMap["content"].([]any)
			require.True(t, ok, "Expected content to be an array")
			require.NotEmpty(t, content)

			firstBlock, ok := content[0].(map[string]any)
			require.True(t, ok)
			text, ok := firstBlock["text"].(string)
			require.True(t, ok)
			assert.Contains(t, text, tt.wantInText)
		})
	}
}

// ========================
// E2E: Protocol Errors
// ========================

func TestE2E_ProtocolErrors(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	t.Run("parse error", func(t *testing.T) {
		response := sendRequest(t, config, `not valid json`)
		assert.NotNil(t, response.Error)
		assert.Equal(t, -32700, response.Error.Code)
		assert.Contains(t, response.Error.Message, "Parse error")
	})

	t.Run("method not found", func(t *testing.T) {
		response := sendRequest(t, config, `{"jsonrpc":"2.0","id":1,"method":"nonexistent/method"}`)
		assert.NotNil(t, response.Error)
		assert.Equal(t, -32601, response.Error.Code)
		assert.Contains(t, response.Error.Message, "Method not found")
	})

	t.Run("notifications/initialized", func(t *testing.T) {
		response := sendRequest(t, config, `{"jsonrpc":"2.0","id":1,"method":"notifications/initialized"}`)
		assert.Nil(t, response.Error)
		assert.NotNil(t, response.Result)
	})
}

// ========================
// E2E: Mock Facilitator
// ========================

func TestE2E_MockFacilitator(t *testing.T) {
	facilitator := startMockFacilitator(t)
	defer facilitator.Close()

	t.Run("GET /supported", func(t *testing.T) {
		resp, err := http.Get(facilitator.URL + "/supported")
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var data map[string]any
		err = json.NewDecoder(resp.Body).Decode(&data)
		require.NoError(t, err)

		networks, ok := data["networks"].([]any)
		require.True(t, ok)
		assert.Len(t, networks, 3)
	})

	t.Run("POST /verify", func(t *testing.T) {
		body := strings.NewReader(`{"payload":"test"}`)
		resp, err := http.Post(facilitator.URL+"/verify", "application/json", body)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var data map[string]any
		err = json.NewDecoder(resp.Body).Decode(&data)
		require.NoError(t, err)
		assert.Equal(t, true, data["isValid"])
	})

	t.Run("POST /settle", func(t *testing.T) {
		body := strings.NewReader(`{"payload":"test"}`)
		resp, err := http.Post(facilitator.URL+"/settle", "application/json", body)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var data map[string]any
		err = json.NewDecoder(resp.Body).Decode(&data)
		require.NoError(t, err)
		assert.Equal(t, true, data["success"])
	})

	t.Run("unknown endpoint returns 404", func(t *testing.T) {
		resp, err := http.Get(facilitator.URL + "/unknown")
		require.NoError(t, err)
		defer resp.Body.Close()
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})
}

// ========================
// E2E: Multi-request sequence
// ========================

func TestE2E_MultiRequestSequence(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	// Build a sequence of requests: initialize, tools/list, tools/call
	requests := []string{
		`{"jsonrpc":"2.0","id":1,"method":"initialize"}`,
		`{"jsonrpc":"2.0","id":2,"method":"tools/list"}`,
		`{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"t402/getBalance","arguments":{"address":"0x1234567890abcdef1234567890abcdef12345678","network":"base"}}}`,
	}

	allInput := strings.Join(requests, "\n") + "\n"

	pr, pw := io.Pipe()
	go func() {
		pw.Write([]byte(allInput))
		pw.Close()
	}()

	output := &bytes.Buffer{}
	server := NewServerWithIO(config, pr, output)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_ = server.Run(ctx)

	// Parse multiple JSON responses from output
	lines := strings.Split(strings.TrimSpace(output.String()), "\n")
	require.Len(t, lines, 3, "Expected 3 responses, got %d", len(lines))

	// Verify initialize response
	var initResp JSONRPCResponse
	require.NoError(t, json.Unmarshal([]byte(lines[0]), &initResp))
	assert.Nil(t, initResp.Error)

	// Verify tools/list response
	var listResp JSONRPCResponse
	require.NoError(t, json.Unmarshal([]byte(lines[1]), &listResp))
	assert.Nil(t, listResp.Error)

	// Verify tools/call response
	var callResp JSONRPCResponse
	require.NoError(t, json.Unmarshal([]byte(lines[2]), &callResp))
	assert.Nil(t, callResp.Error)

	resultMap, ok := callResp.Result.(map[string]any)
	require.True(t, ok)
	isError, _ := resultMap["isError"].(bool)
	assert.False(t, isError)
}
