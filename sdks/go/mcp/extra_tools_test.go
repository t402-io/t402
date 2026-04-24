package mcp

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// handleCallTool wrapper for test convenience.
func callTool(t *testing.T, s *Server, name string, args any) *ToolResult {
	t.Helper()
	raw, err := json.Marshal(args)
	require.NoError(t, err)
	// Directly dispatch via the handler map in server.go handleCallTool
	// Use an explicit call per tool to keep the test independent of the
	// private switch.
	ctx := context.Background()
	switch name {
	case "t402/getTokenPrice":
		return s.handleGetTokenPrice(ctx, raw)
	case "t402/getGasPrice":
		return s.handleGetGasPrice(ctx, raw)
	case "t402/signMessage":
		return s.handleSignMessage(ctx, raw)
	default:
		t.Fatalf("unknown tool: %s", name)
		return nil
	}
}

// ---------------------------------------------------------------------------
// t402/getTokenPrice
// ---------------------------------------------------------------------------

func TestGetTokenPrice_Demo(t *testing.T) {
	server := NewServer(&ServerConfig{DemoMode: true})

	result := callTool(t, server, "t402/getTokenPrice", map[string]any{
		"tokens": []string{"ETH", "USDC"},
	})

	require.False(t, result.IsError, "unexpected error: %v", result.Content)
	text := result.Content[0].Text
	assert.Contains(t, text, "ETH")
	assert.Contains(t, text, "USDC")
	assert.Contains(t, text, "3250.42")
	assert.Contains(t, text, "USD")
}

func TestGetTokenPrice_CustomCurrency(t *testing.T) {
	server := NewServer(&ServerConfig{DemoMode: true})

	result := callTool(t, server, "t402/getTokenPrice", map[string]any{
		"tokens":   []string{"ETH"},
		"currency": "eur",
	})

	require.False(t, result.IsError)
	// Demo prices are always USD-denominated, but the output should echo
	// the requested currency code (uppercased).
	assert.Contains(t, result.Content[0].Text, "EUR")
}

func TestGetTokenPrice_EmptyTokens(t *testing.T) {
	server := NewServer(&ServerConfig{DemoMode: true})

	result := callTool(t, server, "t402/getTokenPrice", map[string]any{
		"tokens": []string{},
	})

	assert.True(t, result.IsError)
	assert.Contains(t, result.Content[0].Text, "tokens must not be empty")
}

func TestGetTokenPricesDemo_UnknownToken(t *testing.T) {
	out := getTokenPricesDemo([]string{"ETH", "UNKNOWN"})
	assert.Equal(t, 3250.42, out["ETH"])
	assert.Equal(t, 0.0, out["UNKNOWN"], "unknown token should fall back to 0")
}

// ---------------------------------------------------------------------------
// t402/getGasPrice
// ---------------------------------------------------------------------------

func TestGetGasPrice_Demo(t *testing.T) {
	server := NewServer(&ServerConfig{DemoMode: true})

	result := callTool(t, server, "t402/getGasPrice", map[string]any{
		"network": "ethereum",
	})

	require.False(t, result.IsError)
	text := result.Content[0].Text
	assert.Contains(t, text, "ethereum")
	assert.Contains(t, text, "gwei")
	assert.Contains(t, text, "demo")
}

func TestGetGasPrice_InvalidNetwork(t *testing.T) {
	server := NewServer(&ServerConfig{DemoMode: true})

	result := callTool(t, server, "t402/getGasPrice", map[string]any{
		"network": "fake-chain",
	})

	assert.True(t, result.IsError)
	assert.Contains(t, result.Content[0].Text, "Invalid network")
}

// ---------------------------------------------------------------------------
// t402/signMessage
// ---------------------------------------------------------------------------

// Known test key — DO NOT USE FOR ANYTHING BUT TESTS.
const testPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
const testAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

func TestSignMessage_Success(t *testing.T) {
	server := NewServer(&ServerConfig{PrivateKey: testPrivateKey})

	result := callTool(t, server, "t402/signMessage", map[string]any{
		"message": "hello t402",
	})

	require.False(t, result.IsError, "unexpected error: %v", result.Content)
	text := result.Content[0].Text
	assert.Contains(t, text, testAddress, "output should include signer address")
	assert.Contains(t, text, "hello t402")
	assert.Contains(t, text, "Signature:")
	// Signature should be 65 bytes = 132 hex chars after 0x
	sigLineParts := extractSignature(t, text)
	assert.True(t, strings.HasPrefix(sigLineParts, "0x"), "signature should start with 0x")
	assert.Len(t, sigLineParts, 132, "signature should be 130 hex chars + 0x prefix")
}

func TestSignMessage_MissingKey(t *testing.T) {
	server := NewServer(&ServerConfig{})

	result := callTool(t, server, "t402/signMessage", map[string]any{
		"message": "hello",
	})

	assert.True(t, result.IsError)
	assert.Contains(t, result.Content[0].Text, "Private key not configured")
}

func TestSignMessage_EmptyMessage(t *testing.T) {
	server := NewServer(&ServerConfig{PrivateKey: testPrivateKey})

	result := callTool(t, server, "t402/signMessage", map[string]any{
		"message": "",
	})

	assert.True(t, result.IsError)
	assert.Contains(t, result.Content[0].Text, "message must not be empty")
}

// extractSignature pulls the signature hex out of the markdown output.
func extractSignature(t *testing.T, text string) string {
	t.Helper()
	for _, line := range strings.Split(text, "\n") {
		if strings.HasPrefix(line, "- **Signature:**") {
			return strings.TrimSpace(strings.TrimPrefix(line, "- **Signature:**"))
		}
	}
	t.Fatalf("no signature line in output:\n%s", text)
	return ""
}

// ---------------------------------------------------------------------------
// Cache behavior for getTokenPrices
// ---------------------------------------------------------------------------

func TestPriceCache_Clear(t *testing.T) {
	// Smoke test that clearPriceCache doesn't panic on empty cache.
	clearPriceCache()
	clearPriceCache()
}

func TestSortStrings_StableAndCorrect(t *testing.T) {
	out := sortStrings([]string{"USDC", "ETH", "USDT"})
	assert.Equal(t, []string{"ETH", "USDC", "USDT"}, out)

	// Input should not be mutated.
	in := []string{"b", "a", "c"}
	sortStrings(in)
	assert.Equal(t, []string{"b", "a", "c"}, in)
}
