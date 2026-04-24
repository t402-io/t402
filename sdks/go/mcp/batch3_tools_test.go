package mcp

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Uses the test key shared across extra_tools_test.go and wdk_tools_test.go.
const batch3TestPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
const batch3TestAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

func callBatch3Tool(t *testing.T, s *Server, name string, args any) *ToolResult {
	t.Helper()
	raw, err := json.Marshal(args)
	require.NoError(t, err)
	ctx := context.Background()
	switch name {
	case "t402/verifySignature":
		return s.handleVerifySignature(ctx, raw)
	case "t402/estimatePaymentFee":
		return s.handleEstimatePaymentFee(ctx, raw)
	case "t402/compareNetworkFees":
		return s.handleCompareNetworkFees(ctx, raw)
	case "t402/getHistoricalPrice":
		return s.handleGetHistoricalPrice(ctx, raw)
	case "t402/quoteBridge":
		return s.handleQuoteBridge(ctx, raw)
	case "t402/executeBridgeFromQuote":
		return s.handleExecuteBridgeFromQuote(ctx, raw)
	default:
		t.Fatalf("unknown tool: %s", name)
		return nil
	}
}

// ---------------------------------------------------------------------------
// t402/verifySignature — round-trip with signMessage
// ---------------------------------------------------------------------------

func TestVerifySignature_RoundTrip(t *testing.T) {
	server := NewServer(&ServerConfig{PrivateKey: batch3TestPrivateKey})

	// Sign a message first.
	signResult := server.handleSignMessage(context.Background(), mustJSON(t, map[string]any{
		"message": "round-trip check",
	}))
	require.False(t, signResult.IsError)

	// Extract the signature line.
	var sig string
	for _, line := range strings.Split(signResult.Content[0].Text, "\n") {
		if strings.HasPrefix(line, "- **Signature:**") {
			sig = strings.TrimSpace(strings.TrimPrefix(line, "- **Signature:**"))
			break
		}
	}
	require.NotEmpty(t, sig)

	// Verify it.
	result := callBatch3Tool(t, server, "t402/verifySignature", map[string]any{
		"chain":     "ethereum",
		"message":   "round-trip check",
		"signature": sig,
		"address":   batch3TestAddress,
	})

	require.False(t, result.IsError)
	assert.Contains(t, result.Content[0].Text, "Valid:** true")
}

func TestVerifySignature_WrongAddress(t *testing.T) {
	server := NewServer(&ServerConfig{PrivateKey: batch3TestPrivateKey})

	// Sign with test key, but claim a different signer.
	signResult := server.handleSignMessage(context.Background(), mustJSON(t, map[string]any{
		"message": "wrong address test",
	}))
	require.False(t, signResult.IsError)

	var sig string
	for _, line := range strings.Split(signResult.Content[0].Text, "\n") {
		if strings.HasPrefix(line, "- **Signature:**") {
			sig = strings.TrimSpace(strings.TrimPrefix(line, "- **Signature:**"))
		}
	}

	result := callBatch3Tool(t, server, "t402/verifySignature", map[string]any{
		"chain":     "ethereum",
		"message":   "wrong address test",
		"signature": sig,
		"address":   "0x0000000000000000000000000000000000000001",
	})

	require.False(t, result.IsError)
	assert.Contains(t, result.Content[0].Text, "Valid:** false")
	assert.Contains(t, result.Content[0].Text, "Recovered Address:")
}

func TestVerifySignature_MalformedSignature(t *testing.T) {
	server := NewServer(&ServerConfig{DemoMode: true})

	result := callBatch3Tool(t, server, "t402/verifySignature", map[string]any{
		"chain":     "ethereum",
		"message":   "x",
		"signature": "0xdeadbeef", // too short
		"address":   "0x1234567890abcdef1234567890abcdef12345678",
	})

	require.False(t, result.IsError)
	assert.Contains(t, result.Content[0].Text, "Valid:** false")
	assert.Contains(t, result.Content[0].Text, "Error:")
}

// ---------------------------------------------------------------------------
// t402/estimatePaymentFee
// ---------------------------------------------------------------------------

func TestEstimatePaymentFee_DemoMode(t *testing.T) {
	server := NewServer(&ServerConfig{DemoMode: true})

	result := callBatch3Tool(t, server, "t402/estimatePaymentFee", map[string]any{
		"network": "ethereum",
		"amount":  "100",
		"token":   "USDC",
	})

	require.False(t, result.IsError)
	text := result.Content[0].Text
	assert.Contains(t, text, "Payment Fee Estimate")
	assert.Contains(t, text, "Gas Limit:")
	assert.Contains(t, text, "gwei")
	assert.Contains(t, text, "USD Cost:")
}

func TestEstimatePaymentFee_InvalidNetwork(t *testing.T) {
	server := NewServer(&ServerConfig{DemoMode: true})

	result := callBatch3Tool(t, server, "t402/estimatePaymentFee", map[string]any{
		"network": "fake-chain",
		"amount":  "10",
		"token":   "USDC",
	})

	assert.True(t, result.IsError)
	assert.Contains(t, result.Content[0].Text, "Invalid network")
}

// ---------------------------------------------------------------------------
// t402/compareNetworkFees
// ---------------------------------------------------------------------------

func TestCompareNetworkFees_DemoMode(t *testing.T) {
	server := NewServer(&ServerConfig{DemoMode: true})

	result := callBatch3Tool(t, server, "t402/compareNetworkFees", map[string]any{
		"amount":   "100",
		"token":    "USDC",
		"networks": []string{"ethereum", "base", "arbitrum"},
	})

	require.False(t, result.IsError)
	text := result.Content[0].Text
	assert.Contains(t, text, "Network Fee Comparison")
	assert.Contains(t, text, "ethereum")
	assert.Contains(t, text, "base")
	assert.Contains(t, text, "arbitrum")
}

func TestCompareNetworkFees_DefaultsToAllNetworks(t *testing.T) {
	server := NewServer(&ServerConfig{DemoMode: true})

	result := callBatch3Tool(t, server, "t402/compareNetworkFees", map[string]any{
		"amount": "50",
		"token":  "USDT",
	})

	require.False(t, result.IsError)
	// Should include at least the 9 mainnet networks.
	text := result.Content[0].Text
	for _, n := range []string{"ethereum", "base", "polygon", "avalanche"} {
		assert.Contains(t, text, n)
	}
}

// ---------------------------------------------------------------------------
// t402/getHistoricalPrice
// ---------------------------------------------------------------------------

func TestGetHistoricalPrice_DemoMode(t *testing.T) {
	server := NewServer(&ServerConfig{DemoMode: true})

	result := callBatch3Tool(t, server, "t402/getHistoricalPrice", map[string]any{
		"token": "ETH",
		"days":  7,
	})

	require.False(t, result.IsError)
	text := result.Content[0].Text
	assert.Contains(t, text, "Historical Price")
	assert.Contains(t, text, "ETH")
	assert.Contains(t, text, "Sample Points")
	assert.Contains(t, text, "Demo mode")
}

func TestGetHistoricalPrice_InvalidDays(t *testing.T) {
	server := NewServer(&ServerConfig{DemoMode: true})

	result := callBatch3Tool(t, server, "t402/getHistoricalPrice", map[string]any{
		"token": "ETH",
		"days":  1000,
	})

	assert.True(t, result.IsError)
	assert.Contains(t, result.Content[0].Text, "1 and 365")
}

func TestGetHistoricalPrice_EmptyToken(t *testing.T) {
	server := NewServer(&ServerConfig{DemoMode: true})

	result := callBatch3Tool(t, server, "t402/getHistoricalPrice", map[string]any{
		"token": "",
	})

	assert.True(t, result.IsError)
	assert.Contains(t, result.Content[0].Text, "token must not be empty")
}

// ---------------------------------------------------------------------------
// t402/quoteBridge + executeBridgeFromQuote
// ---------------------------------------------------------------------------

func TestQuoteBridge_AndExecuteUnconfirmed(t *testing.T) {
	ClearQuoteStore()
	server := NewServer(&ServerConfig{DemoMode: true})

	quoteResult := callBatch3Tool(t, server, "t402/quoteBridge", map[string]any{
		"fromChain": "ethereum",
		"toChain":   "arbitrum",
		"amount":    "100",
		"recipient": "0x1234567890abcdef1234567890abcdef12345678",
	})
	require.False(t, quoteResult.IsError)
	assert.Contains(t, quoteResult.Content[0].Text, "Quote ID:")

	// Extract the quoteId from the markdown.
	quoteID := extractQuoteID(t, quoteResult.Content[0].Text)
	require.NotEmpty(t, quoteID)

	// Unconfirmed execute returns a preview.
	execResult := callBatch3Tool(t, server, "t402/executeBridgeFromQuote", map[string]any{
		"quoteId": quoteID,
	})
	require.False(t, execResult.IsError)
	assert.Contains(t, execResult.Content[0].Text, "Preview")
	assert.Contains(t, execResult.Content[0].Text, "NOT executed")
}

func TestExecuteBridgeFromQuote_ConfirmedConsumesQuote(t *testing.T) {
	ClearQuoteStore()
	server := NewServer(&ServerConfig{DemoMode: true})

	quoteResult := callBatch3Tool(t, server, "t402/quoteBridge", map[string]any{
		"fromChain": "ethereum",
		"toChain":   "arbitrum",
		"amount":    "100",
		"recipient": "0x1234567890abcdef1234567890abcdef12345678",
	})
	require.False(t, quoteResult.IsError)
	quoteID := extractQuoteID(t, quoteResult.Content[0].Text)
	require.NotEmpty(t, quoteID)

	// Confirmed: demo mode bridge returns a demo receipt and the quote
	// is consumed (deleted) so a second attempt fails.
	first := callBatch3Tool(t, server, "t402/executeBridgeFromQuote", map[string]any{
		"quoteId":   quoteID,
		"confirmed": true,
	})
	require.False(t, first.IsError)
	assert.Contains(t, first.Content[0].Text, "Demo")

	second := callBatch3Tool(t, server, "t402/executeBridgeFromQuote", map[string]any{
		"quoteId":   quoteID,
		"confirmed": true,
	})
	assert.True(t, second.IsError)
	assert.Contains(t, second.Content[0].Text, "Quote not found")
}

func TestExecuteBridgeFromQuote_MissingQuote(t *testing.T) {
	ClearQuoteStore()
	server := NewServer(&ServerConfig{DemoMode: true})

	result := callBatch3Tool(t, server, "t402/executeBridgeFromQuote", map[string]any{
		"quoteId": "00000000-0000-0000-0000-000000000000",
	})

	assert.True(t, result.IsError)
	assert.Contains(t, result.Content[0].Text, "Quote not found")
}

// ---------------------------------------------------------------------------
// Quote store
// ---------------------------------------------------------------------------

func TestQuoteStore_CreateAndGet(t *testing.T) {
	ClearQuoteStore()
	id := CreateQuote(QuoteTypeBridge, map[string]any{"amount": "10"})
	assert.NotEmpty(t, id)
	// UUID shape: 8-4-4-4-12 = 36 chars incl. hyphens.
	assert.Len(t, id, 36)

	quote, ok := GetQuote(id)
	require.True(t, ok)
	assert.Equal(t, QuoteTypeBridge, quote.Type)
	assert.Equal(t, "10", quote.Data["amount"])
}

func TestQuoteStore_DeleteAndGet(t *testing.T) {
	ClearQuoteStore()
	id := CreateQuote(QuoteTypeSwap, map[string]any{})
	DeleteQuote(id)
	_, ok := GetQuote(id)
	assert.False(t, ok)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func mustJSON(t *testing.T, v any) []byte {
	t.Helper()
	b, err := json.Marshal(v)
	require.NoError(t, err)
	return b
}

func extractQuoteID(t *testing.T, text string) string {
	t.Helper()
	for _, line := range strings.Split(text, "\n") {
		if strings.Contains(line, "Quote ID:") {
			// line looks like "- **Quote ID:** `abc-def-...`"
			l := strings.TrimSpace(line)
			if i := strings.Index(l, "`"); i >= 0 {
				rest := l[i+1:]
				if j := strings.Index(rest, "`"); j >= 0 {
					return rest[:j]
				}
			}
		}
	}
	return ""
}
