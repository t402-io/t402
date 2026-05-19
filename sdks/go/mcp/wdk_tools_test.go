package mcp

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Uses the same test key as extra_tools_test.go for signer-derived address.
// Consistency across tests lets any handler that derives addresses report
// the same canonical test address.
const wdkTestPrivateKey = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
const wdkTestAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

func callWdkTool(t *testing.T, s *Server, name string, args any) *ToolResult {
	t.Helper()
	raw, err := json.Marshal(args)
	require.NoError(t, err)
	ctx := context.Background()
	switch name {
	case "t402/wdk/getWallet":
		return s.handleWdkGetWallet(ctx, raw)
	case "t402/wdk/getBalances":
		return s.handleWdkGetBalances(ctx, raw)
	case "t402/wdk/transfer":
		return s.handleWdkTransfer(ctx, raw)
	default:
		t.Fatalf("unknown tool: %s", name)
		return nil
	}
}

// ---------------------------------------------------------------------------
// t402/wdk/getWallet
// ---------------------------------------------------------------------------

func TestWdkGetWallet_WithPrivateKey(t *testing.T) {
	server := NewServer(&ServerConfig{PrivateKey: wdkTestPrivateKey})

	result := callWdkTool(t, server, "t402/wdk/getWallet", map[string]any{})

	require.False(t, result.IsError)
	text := result.Content[0].Text
	assert.Contains(t, text, wdkTestAddress)
	assert.Contains(t, text, "ethereum")
}

func TestWdkGetWallet_DemoMode(t *testing.T) {
	server := NewServer(&ServerConfig{DemoMode: true})

	result := callWdkTool(t, server, "t402/wdk/getWallet", map[string]any{})

	require.False(t, result.IsError)
	text := result.Content[0].Text
	assert.Contains(t, text, "0x0000000000000000000000000000000000000000")
	assert.Contains(t, text, "demo")
}

// ---------------------------------------------------------------------------
// t402/wdk/getBalances
// ---------------------------------------------------------------------------

func TestWdkGetBalances_DemoMode(t *testing.T) {
	server := NewServer(&ServerConfig{DemoMode: true})

	result := callWdkTool(t, server, "t402/wdk/getBalances", map[string]any{})

	require.False(t, result.IsError)
	text := result.Content[0].Text
	assert.Contains(t, text, "WDK Balances")
	assert.Contains(t, text, "Totals")
	assert.Contains(t, text, "USDT0")
	assert.Contains(t, text, "Demo mode")
}

func TestWdkGetBalances_WithChainFilter(t *testing.T) {
	server := NewServer(&ServerConfig{DemoMode: true})

	result := callWdkTool(t, server, "t402/wdk/getBalances", map[string]any{
		"chains": []string{"ethereum", "arbitrum"},
	})

	require.False(t, result.IsError)
	text := result.Content[0].Text
	assert.Contains(t, text, "ethereum")
	assert.Contains(t, text, "arbitrum")
	// Base was not requested — should not appear as a per-chain heading.
	assert.NotContains(t, text, "### base")
}

func TestWdkGetBalances_InvalidChain(t *testing.T) {
	server := NewServer(&ServerConfig{DemoMode: true})

	result := callWdkTool(t, server, "t402/wdk/getBalances", map[string]any{
		"chains": []string{"fake-chain"},
	})

	assert.True(t, result.IsError)
	assert.Contains(t, result.Content[0].Text, "Invalid network")
}

// ---------------------------------------------------------------------------
// t402/wdk/transfer
// ---------------------------------------------------------------------------

func TestWdkTransfer_PreviewWhenUnconfirmed(t *testing.T) {
	server := NewServer(&ServerConfig{DemoMode: true})

	result := callWdkTool(t, server, "t402/wdk/transfer", map[string]any{
		"to":     "0x1234567890abcdef1234567890abcdef12345678",
		"amount": "10.5",
		"token":  "USDC",
		"chain":  "ethereum",
	})

	require.False(t, result.IsError)
	text := result.Content[0].Text
	assert.Contains(t, text, "Preview")
	assert.Contains(t, text, "NOT executed")
	assert.Contains(t, text, "10.5 USDC")
	assert.Contains(t, text, "confirmed: true")
}

func TestWdkTransfer_ConfirmedDelegatesToPay(t *testing.T) {
	// In demo mode the underlying pay handler returns a demo receipt
	// instead of hitting an RPC, so this test verifies the delegation
	// wiring without requiring network access.
	server := NewServer(&ServerConfig{DemoMode: true})

	result := callWdkTool(t, server, "t402/wdk/transfer", map[string]any{
		"to":        "0x1234567890abcdef1234567890abcdef12345678",
		"amount":    "10.5",
		"token":     "USDC",
		"chain":     "ethereum",
		"confirmed": true,
	})

	require.False(t, result.IsError)
	text := result.Content[0].Text
	// Demo pay outputs a "Payment Successful" markdown block.
	assert.Contains(t, text, "Demo")
}

func TestWdkTransfer_InvalidChain(t *testing.T) {
	server := NewServer(&ServerConfig{DemoMode: true})

	result := callWdkTool(t, server, "t402/wdk/transfer", map[string]any{
		"to":     "0x1234567890abcdef1234567890abcdef12345678",
		"amount": "1.0",
		"token":  "USDC",
		"chain":  "fake-chain",
	})

	assert.True(t, result.IsError)
	assert.Contains(t, result.Content[0].Text, "Invalid chain")
}

