"""Tests for Phase C cross-SDK parity MCP tools (2026-04-24).

Covers:
- t402/getTokenPrice — demo mode + empty-tokens error
- t402/getGasPrice   — demo mode + invalid-network error
- t402/signMessage   — success + missing-key + empty-message errors
"""

import pytest

from t402.mcp import ServerConfig, T402McpServer
from t402.mcp.price_service import clear_price_cache, get_token_prices_demo


# Known test key — DO NOT USE FOR ANYTHING BUT TESTS.
TEST_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
TEST_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"


@pytest.fixture(autouse=True)
def _clear_cache():
    """Ensure price cache is empty between tests."""
    clear_price_cache()
    yield
    clear_price_cache()


# ---------------------------------------------------------------------------
# t402/getTokenPrice
# ---------------------------------------------------------------------------


class TestGetTokenPrice:
    @pytest.mark.asyncio
    async def test_demo_mode_includes_tokens(self):
        server = T402McpServer(ServerConfig(demo_mode=True))
        result = await server._handle_get_token_price({"tokens": ["ETH", "USDC"]})

        assert result.isError is False
        text = result.content[0].text
        assert "ETH" in text
        assert "USDC" in text
        assert "3250.42" in text
        assert "USD" in text

    @pytest.mark.asyncio
    async def test_custom_currency_uppercased_in_output(self):
        server = T402McpServer(ServerConfig(demo_mode=True))
        result = await server._handle_get_token_price(
            {"tokens": ["ETH"], "currency": "eur"}
        )

        assert result.isError is False
        assert "EUR" in result.content[0].text

    @pytest.mark.asyncio
    async def test_empty_tokens_errors(self):
        server = T402McpServer(ServerConfig(demo_mode=True))
        result = await server._handle_get_token_price({"tokens": []})

        assert result.isError is True
        assert "tokens must not be empty" in result.content[0].text

    def test_demo_prices_table(self):
        out = get_token_prices_demo(["ETH", "UNKNOWN"])
        assert out["ETH"] == pytest.approx(3250.42)
        assert out["UNKNOWN"] == 0.0


# ---------------------------------------------------------------------------
# t402/getGasPrice
# ---------------------------------------------------------------------------


class TestGetGasPrice:
    @pytest.mark.asyncio
    async def test_demo_mode(self):
        server = T402McpServer(ServerConfig(demo_mode=True))
        result = await server._handle_get_gas_price({"network": "ethereum"})

        assert result.isError is False
        text = result.content[0].text
        assert "ethereum" in text
        assert "gwei" in text
        assert "demo" in text

    @pytest.mark.asyncio
    async def test_invalid_network(self):
        server = T402McpServer(ServerConfig(demo_mode=True))
        result = await server._handle_get_gas_price({"network": "fake-chain"})

        assert result.isError is True
        assert "Invalid network" in result.content[0].text


# ---------------------------------------------------------------------------
# t402/signMessage
# ---------------------------------------------------------------------------


class TestSignMessage:
    def test_signs_and_reports_address(self):
        server = T402McpServer(ServerConfig(private_key=TEST_PRIVATE_KEY))
        result = server._handle_sign_message({"message": "hello t402"})

        assert result.isError is False
        text = result.content[0].text
        assert TEST_ADDRESS in text
        assert "hello t402" in text
        assert "Signature:" in text
        # Signature line ends with 130 hex chars after 0x (65 bytes).
        signature_line = [
            line for line in text.split("\n") if line.startswith("- **Signature:**")
        ][0]
        sig_hex = signature_line.replace("- **Signature:**", "").strip()
        assert sig_hex.startswith("0x")
        assert len(sig_hex) == 132

    def test_missing_private_key(self):
        server = T402McpServer(ServerConfig())
        result = server._handle_sign_message({"message": "hello"})

        assert result.isError is True
        assert "Private key not configured" in result.content[0].text

    def test_empty_message(self):
        server = T402McpServer(ServerConfig(private_key=TEST_PRIVATE_KEY))
        result = server._handle_sign_message({"message": ""})

        assert result.isError is True
        assert "message must not be empty" in result.content[0].text


# ---------------------------------------------------------------------------
# Dispatch routes to the new tools from _handle_call_tool
# ---------------------------------------------------------------------------


class TestDispatch:
    @pytest.mark.asyncio
    async def test_dispatch_get_token_price(self):
        server = T402McpServer(ServerConfig(demo_mode=True))
        response = await server._handle_call_tool(
            {"name": "t402/getTokenPrice", "arguments": {"tokens": ["ETH"]}}
        )
        assert response["isError"] is False

    @pytest.mark.asyncio
    async def test_dispatch_get_gas_price(self):
        server = T402McpServer(ServerConfig(demo_mode=True))
        response = await server._handle_call_tool(
            {"name": "t402/getGasPrice", "arguments": {"network": "ethereum"}}
        )
        assert response["isError"] is False

    @pytest.mark.asyncio
    async def test_dispatch_sign_message(self):
        server = T402McpServer(ServerConfig(private_key=TEST_PRIVATE_KEY))
        response = await server._handle_call_tool(
            {"name": "t402/signMessage", "arguments": {"message": "hi"}}
        )
        assert response["isError"] is False
