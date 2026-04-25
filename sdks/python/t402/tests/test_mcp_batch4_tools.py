"""Tests for Phase C Batch 4 MCP tools (2026-04-25).

Covers searchBazaar (full + demo fallback), getTransferHistory (demo +
input validation), and the five honest stubs (payForService, autoPay,
and the three erc8004 tools).
"""

import pytest

from t402.mcp import ServerConfig, T402McpServer


# ---------------------------------------------------------------------------
# searchBazaar
# ---------------------------------------------------------------------------


class TestSearchBazaar:
    @pytest.mark.asyncio
    async def test_live_or_fallback(self):
        """Either path (live API or demo fallback) should produce a
        non-error markdown response with the expected shape."""
        server = T402McpServer(ServerConfig(demo_mode=True))
        result = await server._handle_search_bazaar({"query": "ai"})
        assert result.isError is False
        assert "Bazaar Results" in result.content[0].text

    @pytest.mark.asyncio
    async def test_empty_query(self):
        server = T402McpServer(ServerConfig(demo_mode=True))
        result = await server._handle_search_bazaar({"query": ""})
        assert result.isError is True
        assert "query must not be empty" in result.content[0].text

    def test_demo_filter(self):
        """Direct test of the offline demo set so assertions don't
        depend on the live bazaar contents."""
        server = T402McpServer(ServerConfig(demo_mode=True))
        ai_results = server._bazaar_demo_results("ai")
        assert len(ai_results) >= 2
        none = server._bazaar_demo_results("nonsense-zzz-xxx")
        assert none == []


# ---------------------------------------------------------------------------
# getTransferHistory
# ---------------------------------------------------------------------------


class TestGetTransferHistory:
    @pytest.mark.asyncio
    async def test_demo_mode(self):
        server = T402McpServer(ServerConfig(demo_mode=True))
        result = await server._handle_get_transfer_history(
            {
                "network": "ethereum",
                "address": "0x1234567890abcdef1234567890abcdef12345678",
                "limit": 5,
            }
        )
        assert result.isError is False
        text = result.content[0].text
        assert "Transfer History" in text
        assert "ethereum" in text
        assert "demo" in text

    @pytest.mark.asyncio
    async def test_invalid_network(self):
        server = T402McpServer(ServerConfig(demo_mode=True))
        result = await server._handle_get_transfer_history(
            {
                "network": "fake-chain",
                "address": "0x1234567890abcdef1234567890abcdef12345678",
            }
        )
        assert result.isError is True
        assert "Invalid network" in result.content[0].text

    @pytest.mark.asyncio
    async def test_empty_address(self):
        server = T402McpServer(ServerConfig(demo_mode=True))
        result = await server._handle_get_transfer_history(
            {"network": "ethereum", "address": ""}
        )
        assert result.isError is True
        assert "address must not be empty" in result.content[0].text


# ---------------------------------------------------------------------------
# Honest stubs — payForService, autoPay, erc8004/*
# ---------------------------------------------------------------------------


class TestBatch4Stubs:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "tool_name",
        [
            "t402/payForService",
            "t402/autoPay",
            "t402/erc8004/resolveAgent",
            "t402/erc8004/verifyWallet",
            "t402/erc8004/checkReputation",
        ],
    )
    async def test_returns_honest_stub(self, tool_name: str):
        server = T402McpServer(ServerConfig(demo_mode=True))
        response = await server._handle_call_tool(
            {"name": tool_name, "arguments": {}}
        )
        assert response["isError"] is True
        text = response["content"][0]["text"]
        assert (
            "not implemented" in text
            or "TS SDK" in text
            or "TypeScript SDK" in text
        )
