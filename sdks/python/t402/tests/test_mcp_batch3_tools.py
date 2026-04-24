"""Tests for Phase C Batch 3 MCP tools (2026-04-24).

Covers verifySignature, estimatePaymentFee, compareNetworkFees,
getHistoricalPrice, quoteBridge, and executeBridgeFromQuote — plus the
quote store primitives they rely on.
"""

import pytest

from t402.mcp import ServerConfig, T402McpServer
from t402.mcp.quote_store import (
    clear_quote_store,
    create_quote,
    delete_quote,
    get_quote,
)


TEST_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
TEST_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"


@pytest.fixture(autouse=True)
def _clear_quote_store():
    clear_quote_store()
    yield
    clear_quote_store()


# ---------------------------------------------------------------------------
# t402/verifySignature
# ---------------------------------------------------------------------------


class TestVerifySignature:
    def test_round_trip_with_sign_message(self):
        server = T402McpServer(ServerConfig(private_key=TEST_PRIVATE_KEY))

        sign = server._handle_sign_message({"message": "round trip"})
        assert sign.isError is False

        # Extract the signature line.
        signature = ""
        for line in sign.content[0].text.split("\n"):
            if line.startswith("- **Signature:**"):
                signature = line.replace("- **Signature:**", "").strip()
                break
        assert signature

        verify = server._handle_verify_signature(
            {
                "chain": "ethereum",
                "message": "round trip",
                "signature": signature,
                "address": TEST_ADDRESS,
            }
        )
        assert verify.isError is False
        assert "Valid:** true" in verify.content[0].text

    def test_wrong_address(self):
        server = T402McpServer(ServerConfig(private_key=TEST_PRIVATE_KEY))

        sign = server._handle_sign_message({"message": "wrong address"})
        signature = ""
        for line in sign.content[0].text.split("\n"):
            if line.startswith("- **Signature:**"):
                signature = line.replace("- **Signature:**", "").strip()
                break

        verify = server._handle_verify_signature(
            {
                "chain": "ethereum",
                "message": "wrong address",
                "signature": signature,
                "address": "0x0000000000000000000000000000000000000001",
            }
        )
        assert verify.isError is False
        assert "Valid:** false" in verify.content[0].text
        assert "Recovered Address:" in verify.content[0].text

    def test_malformed_signature(self):
        server = T402McpServer(ServerConfig(demo_mode=True))
        verify = server._handle_verify_signature(
            {
                "chain": "ethereum",
                "message": "x",
                "signature": "0xdeadbeef",
                "address": "0x1234567890abcdef1234567890abcdef12345678",
            }
        )
        assert verify.isError is False
        assert "Valid:** false" in verify.content[0].text
        assert "Error:" in verify.content[0].text


# ---------------------------------------------------------------------------
# t402/estimatePaymentFee
# ---------------------------------------------------------------------------


class TestEstimatePaymentFee:
    @pytest.mark.asyncio
    async def test_demo_mode(self):
        server = T402McpServer(ServerConfig(demo_mode=True))
        result = await server._handle_estimate_payment_fee(
            {"network": "ethereum", "amount": "100", "token": "USDC"}
        )
        assert result.isError is False
        text = result.content[0].text
        assert "Payment Fee Estimate" in text
        assert "Gas Limit:" in text
        assert "gwei" in text
        assert "USD Cost:" in text

    @pytest.mark.asyncio
    async def test_invalid_network(self):
        server = T402McpServer(ServerConfig(demo_mode=True))
        result = await server._handle_estimate_payment_fee(
            {"network": "fake-chain", "amount": "10", "token": "USDC"}
        )
        assert result.isError is True
        assert "Invalid network" in result.content[0].text


# ---------------------------------------------------------------------------
# t402/compareNetworkFees
# ---------------------------------------------------------------------------


class TestCompareNetworkFees:
    @pytest.mark.asyncio
    async def test_demo_mode_specific_networks(self):
        server = T402McpServer(ServerConfig(demo_mode=True))
        result = await server._handle_compare_network_fees(
            {
                "amount": "100",
                "token": "USDC",
                "networks": ["ethereum", "base", "arbitrum"],
            }
        )
        assert result.isError is False
        text = result.content[0].text
        assert "Network Fee Comparison" in text
        for n in ("ethereum", "base", "arbitrum"):
            assert n in text

    @pytest.mark.asyncio
    async def test_defaults_to_all_networks(self):
        server = T402McpServer(ServerConfig(demo_mode=True))
        result = await server._handle_compare_network_fees(
            {"amount": "50", "token": "USDT"}
        )
        assert result.isError is False
        text = result.content[0].text
        for n in ("ethereum", "base", "polygon", "avalanche"):
            assert n in text


# ---------------------------------------------------------------------------
# t402/getHistoricalPrice
# ---------------------------------------------------------------------------


class TestGetHistoricalPrice:
    @pytest.mark.asyncio
    async def test_demo_mode(self):
        server = T402McpServer(ServerConfig(demo_mode=True))
        result = await server._handle_get_historical_price(
            {"token": "ETH", "days": 7}
        )
        assert result.isError is False
        text = result.content[0].text
        assert "Historical Price" in text
        assert "ETH" in text
        assert "Sample Points" in text
        assert "Demo mode" in text

    @pytest.mark.asyncio
    async def test_invalid_days(self):
        server = T402McpServer(ServerConfig(demo_mode=True))
        result = await server._handle_get_historical_price(
            {"token": "ETH", "days": 1000}
        )
        assert result.isError is True
        assert "1 and 365" in result.content[0].text

    @pytest.mark.asyncio
    async def test_empty_token(self):
        server = T402McpServer(ServerConfig(demo_mode=True))
        result = await server._handle_get_historical_price({"token": ""})
        assert result.isError is True
        assert "token must not be empty" in result.content[0].text


# ---------------------------------------------------------------------------
# t402/quoteBridge + executeBridgeFromQuote
# ---------------------------------------------------------------------------


def _extract_quote_id(text: str) -> str:
    for line in text.split("\n"):
        if "Quote ID:" in line and "`" in line:
            first = line.find("`")
            second = line.find("`", first + 1)
            if second > first:
                return line[first + 1 : second]
    return ""


class TestQuoteBridgeFlow:
    @pytest.mark.asyncio
    async def test_quote_then_unconfirmed_preview(self):
        server = T402McpServer(ServerConfig(demo_mode=True))
        quote = await server._handle_quote_bridge(
            {
                "fromChain": "ethereum",
                "toChain": "arbitrum",
                "amount": "100",
                "recipient": "0x1234567890abcdef1234567890abcdef12345678",
            }
        )
        assert quote.isError is False
        quote_id = _extract_quote_id(quote.content[0].text)
        assert quote_id

        unconfirmed = await server._handle_execute_bridge_from_quote(
            {"quoteId": quote_id}
        )
        assert unconfirmed.isError is False
        assert "Preview" in unconfirmed.content[0].text
        assert "NOT executed" in unconfirmed.content[0].text

    @pytest.mark.asyncio
    async def test_confirmed_consumes_quote(self):
        server = T402McpServer(ServerConfig(demo_mode=True))
        quote = await server._handle_quote_bridge(
            {
                "fromChain": "ethereum",
                "toChain": "arbitrum",
                "amount": "100",
                "recipient": "0x1234567890abcdef1234567890abcdef12345678",
            }
        )
        quote_id = _extract_quote_id(quote.content[0].text)
        assert quote_id

        first = await server._handle_execute_bridge_from_quote(
            {"quoteId": quote_id, "confirmed": True}
        )
        assert first.isError is False
        assert "Demo" in first.content[0].text

        second = await server._handle_execute_bridge_from_quote(
            {"quoteId": quote_id, "confirmed": True}
        )
        assert second.isError is True
        assert "Quote not found" in second.content[0].text

    @pytest.mark.asyncio
    async def test_missing_quote(self):
        server = T402McpServer(ServerConfig(demo_mode=True))
        result = await server._handle_execute_bridge_from_quote(
            {"quoteId": "00000000-0000-0000-0000-000000000000"}
        )
        assert result.isError is True
        assert "Quote not found" in result.content[0].text


# ---------------------------------------------------------------------------
# Quote store primitives
# ---------------------------------------------------------------------------


class TestQuoteStore:
    def test_create_and_get(self):
        qid = create_quote("bridge", {"amount": "10"})
        assert len(qid) == 36  # UUID length
        quote = get_quote(qid)
        assert quote is not None
        assert quote.type == "bridge"
        assert quote.data["amount"] == "10"

    def test_delete_and_get(self):
        qid = create_quote("swap", {})
        delete_quote(qid)
        assert get_quote(qid) is None
