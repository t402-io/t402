package mcp

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func callBatch4Tool(t *testing.T, s *Server, name string, args any) *ToolResult {
	t.Helper()
	raw, err := json.Marshal(args)
	require.NoError(t, err)
	ctx := context.Background()
	switch name {
	case "t402/searchBazaar":
		return s.handleSearchBazaar(ctx, raw)
	case "t402/payForService":
		return s.handlePayForService(ctx, raw)
	case "t402/autoPay":
		return s.handleAutoPay(ctx, raw)
	case "t402/erc8004/resolveAgent":
		return s.handleErc8004ResolveAgent(ctx, raw)
	case "t402/erc8004/verifyWallet":
		return s.handleErc8004VerifyWallet(ctx, raw)
	case "t402/erc8004/checkReputation":
		return s.handleErc8004CheckReputation(ctx, raw)
	case "t402/getTransferHistory":
		return s.handleGetTransferHistory(ctx, raw)
	default:
		t.Fatalf("unknown tool: %s", name)
		return nil
	}
}

// ---------------------------------------------------------------------------
// t402/searchBazaar — falls back to demo on unreachable bazaar
// ---------------------------------------------------------------------------

func TestSearchBazaar_LiveOrFallback(t *testing.T) {
	// `t402/searchBazaar` either calls the live bazaar API and returns
	// real entries or falls back to the demo set when offline. Either
	// path should produce a non-error response with the expected shape.
	server := NewServer(&ServerConfig{DemoMode: true})

	result := callBatch4Tool(t, server, "t402/searchBazaar", map[string]any{
		"query": "ai",
	})

	require.False(t, result.IsError)
	text := result.Content[0].Text
	assert.Contains(t, text, "Bazaar Results")
}

func TestSearchBazaar_EmptyQuery(t *testing.T) {
	server := NewServer(&ServerConfig{DemoMode: true})

	result := callBatch4Tool(t, server, "t402/searchBazaar", map[string]any{
		"query": "",
	})
	assert.True(t, result.IsError)
	assert.Contains(t, result.Content[0].Text, "query must not be empty")
}

func TestBazaarDemoResults(t *testing.T) {
	// Direct test of the offline demo set to keep the assertions stable
	// regardless of what the live bazaar returns.
	matches := bazaarDemoResults("ai")
	assert.GreaterOrEqual(t, len(matches), 2, "demo set should have ≥2 ai-category entries")

	none := bazaarDemoResults("nonsense-zzz-xxx")
	assert.Empty(t, none, "demo filter should reject unknown queries")
}

// ---------------------------------------------------------------------------
// Honest stubs — payForService, autoPay, erc8004/*
// ---------------------------------------------------------------------------

func TestBatch4Stubs_All(t *testing.T) {
	server := NewServer(&ServerConfig{DemoMode: true})

	for _, tool := range []string{
		"t402/payForService",
		"t402/autoPay",
		"t402/erc8004/resolveAgent",
		"t402/erc8004/verifyWallet",
		"t402/erc8004/checkReputation",
	} {
		t.Run(tool, func(t *testing.T) {
			result := callBatch4Tool(t, server, tool, map[string]any{})
			assert.True(t, result.IsError, "%s should return an error stub", tool)
			text := result.Content[0].Text
			assert.True(t,
				strings.Contains(text, "not implemented") ||
					strings.Contains(text, "TS SDK") ||
					strings.Contains(text, "TypeScript SDK"),
				"stub error should point at the TS SDK; got: %s", text,
			)
		})
	}
}

// ---------------------------------------------------------------------------
// t402/getTransferHistory
// ---------------------------------------------------------------------------

func TestGetTransferHistory_DemoMode(t *testing.T) {
	server := NewServer(&ServerConfig{DemoMode: true})

	result := callBatch4Tool(t, server, "t402/getTransferHistory", map[string]any{
		"network": "ethereum",
		"address": "0x1234567890abcdef1234567890abcdef12345678",
		"limit":   5,
	})

	require.False(t, result.IsError)
	text := result.Content[0].Text
	assert.Contains(t, text, "Transfer History")
	assert.Contains(t, text, "ethereum")
	assert.Contains(t, text, "demo")
}

func TestGetTransferHistory_InvalidNetwork(t *testing.T) {
	server := NewServer(&ServerConfig{DemoMode: true})

	result := callBatch4Tool(t, server, "t402/getTransferHistory", map[string]any{
		"network": "fake-chain",
		"address": "0x1234567890abcdef1234567890abcdef12345678",
	})
	assert.True(t, result.IsError)
	assert.Contains(t, result.Content[0].Text, "Invalid network")
}

func TestGetTransferHistory_EmptyAddress(t *testing.T) {
	server := NewServer(&ServerConfig{DemoMode: true})

	result := callBatch4Tool(t, server, "t402/getTransferHistory", map[string]any{
		"network": "ethereum",
		"address": "",
	})
	assert.True(t, result.IsError)
	assert.Contains(t, result.Content[0].Text, "address must not be empty")
}

func TestSortTransfersDesc(t *testing.T) {
	rs := []transferRecord{
		{BlockNumber: 100, LogIndex: 0, From: "a"},
		{BlockNumber: 200, LogIndex: 5, From: "b"},
		{BlockNumber: 200, LogIndex: 1, From: "c"},
		{BlockNumber: 50, LogIndex: 10, From: "d"},
	}
	sortTransfersDesc(rs)
	assert.Equal(t, uint64(200), rs[0].BlockNumber)
	assert.Equal(t, uint(5), rs[0].LogIndex)
	assert.Equal(t, "b", rs[0].From)
	assert.Equal(t, "c", rs[1].From)
	assert.Equal(t, "a", rs[2].From)
	assert.Equal(t, "d", rs[3].From)
}
