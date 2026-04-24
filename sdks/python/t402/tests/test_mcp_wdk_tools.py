"""Tests for Phase C Batch 2 WDK MCP tools (2026-04-24).

Covers:
- t402/wdk/getWallet — demo mode + real key path
- t402/wdk/getBalances — demo mode + chain filter + invalid chain
- t402/wdk/transfer — preview + confirmed-delegation + invalid chain
- t402/wdk/{swap,quoteSwap,executeSwap} — honest stubs
"""

import pytest

from t402.mcp import ServerConfig, T402McpServer


# Known test key — DO NOT USE FOR ANYTHING BUT TESTS.
TEST_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
TEST_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"


# ---------------------------------------------------------------------------
# t402/wdk/getWallet
# ---------------------------------------------------------------------------


class TestWdkGetWallet:
    def test_with_private_key(self):
        server = T402McpServer(ServerConfig(private_key=TEST_PRIVATE_KEY))
        result = server._handle_wdk_get_wallet({})

        assert result.isError is False
        text = result.content[0].text
        assert TEST_ADDRESS in text
        assert "ethereum" in text

    def test_demo_mode(self):
        server = T402McpServer(ServerConfig(demo_mode=True))
        result = server._handle_wdk_get_wallet({})

        assert result.isError is False
        text = result.content[0].text
        assert "0x0000000000000000000000000000000000000000" in text
        assert "demo" in text


# ---------------------------------------------------------------------------
# t402/wdk/getBalances
# ---------------------------------------------------------------------------


class TestWdkGetBalances:
    @pytest.mark.asyncio
    async def test_demo_mode(self):
        server = T402McpServer(ServerConfig(demo_mode=True))
        result = await server._handle_wdk_get_balances({})

        assert result.isError is False
        text = result.content[0].text
        assert "WDK Balances" in text
        assert "Totals" in text
        assert "USDT0" in text
        assert "Demo mode" in text

    @pytest.mark.asyncio
    async def test_chain_filter(self):
        server = T402McpServer(ServerConfig(demo_mode=True))
        result = await server._handle_wdk_get_balances(
            {"chains": ["ethereum", "arbitrum"]}
        )

        assert result.isError is False
        text = result.content[0].text
        assert "ethereum" in text
        assert "arbitrum" in text
        assert "### base" not in text

    @pytest.mark.asyncio
    async def test_invalid_chain(self):
        server = T402McpServer(ServerConfig(demo_mode=True))
        result = await server._handle_wdk_get_balances({"chains": ["fake-chain"]})

        assert result.isError is True
        assert "Invalid network" in result.content[0].text


# ---------------------------------------------------------------------------
# t402/wdk/transfer
# ---------------------------------------------------------------------------


class TestWdkTransfer:
    @pytest.mark.asyncio
    async def test_preview_when_unconfirmed(self):
        server = T402McpServer(ServerConfig(demo_mode=True))
        result = await server._handle_wdk_transfer(
            {
                "to": "0x1234567890abcdef1234567890abcdef12345678",
                "amount": "10.5",
                "token": "USDC",
                "chain": "ethereum",
            }
        )

        assert result.isError is False
        text = result.content[0].text
        assert "Preview" in text
        assert "NOT executed" in text
        assert "10.5 USDC" in text
        assert "confirmed: true" in text

    @pytest.mark.asyncio
    async def test_confirmed_delegates_to_pay(self):
        server = T402McpServer(ServerConfig(demo_mode=True))
        result = await server._handle_wdk_transfer(
            {
                "to": "0x1234567890abcdef1234567890abcdef12345678",
                "amount": "10.5",
                "token": "USDC",
                "chain": "ethereum",
                "confirmed": True,
            }
        )

        assert result.isError is False
        text = result.content[0].text
        # _handle_pay demo mode returns a "Payment (Demo Mode)" markdown block.
        assert "Demo" in text

    @pytest.mark.asyncio
    async def test_invalid_chain(self):
        server = T402McpServer(ServerConfig(demo_mode=True))
        result = await server._handle_wdk_transfer(
            {
                "to": "0x1234567890abcdef1234567890abcdef12345678",
                "amount": "1.0",
                "token": "USDC",
                "chain": "fake-chain",
            }
        )

        assert result.isError is True
        assert "Invalid chain" in result.content[0].text


# ---------------------------------------------------------------------------
# t402/wdk/{swap,quoteSwap,executeSwap} — honest stubs
# ---------------------------------------------------------------------------


class TestWdkSwapStubs:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "tool_name",
        ["t402/wdk/swap", "t402/wdk/quoteSwap", "t402/wdk/executeSwap"],
    )
    async def test_swap_returns_honest_stub(self, tool_name: str):
        server = T402McpServer(ServerConfig(demo_mode=True))
        response = await server._handle_call_tool(
            {"name": tool_name, "arguments": {}}
        )

        assert response["isError"] is True
        text = response["content"][0]["text"]
        assert "not supported" in text
        assert "TypeScript SDK" in text
