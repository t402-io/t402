"""Tests for USDT0 Bridge module."""

import pytest
from unittest.mock import patch, MagicMock, AsyncMock

from t402.bridge import (
    # Client
    Usdt0Bridge,
    create_usdt0_bridge,
    # Scan
    LayerZeroScanClient,
    create_layerzero_scan_client,
    # Router
    CrossChainPaymentRouter,
    create_cross_chain_payment_router,
    # Constants
    LAYERZERO_ENDPOINT_IDS,
    USDT0_OFT_ADDRESSES,
    LAYERZERO_SCAN_BASE_URL,
    NETWORK_TO_CHAIN,
    CHAIN_TO_NETWORK,
    get_endpoint_id,
    get_endpoint_id_from_network,
    get_usdt0_oft_address,
    supports_bridging,
    get_bridgeable_chains,
    address_to_bytes32,
    bytes32_to_address,
    # Types
    BridgeQuoteParams,
    BridgeQuote,
    BridgeExecuteParams,
    BridgeResult,
    BridgeStatus,
    SendParam,
    MessagingFee,
    TransactionLog,
    BridgeTransactionReceipt,
    LayerZeroMessage,
    LayerZeroMessageStatus,
    WaitForDeliveryOptions,
    CrossChainPaymentParams,
    CrossChainPaymentResult,
)


# =============================================================================
# Constants Tests
# =============================================================================


class TestConstants:
    """Tests for bridge constants."""

    def test_layerzero_endpoint_ids(self):
        """Test LayerZero endpoint IDs are defined."""
        assert "ethereum" in LAYERZERO_ENDPOINT_IDS
        assert "arbitrum" in LAYERZERO_ENDPOINT_IDS
        assert LAYERZERO_ENDPOINT_IDS["ethereum"] == 30101
        assert LAYERZERO_ENDPOINT_IDS["arbitrum"] == 30110

    def test_usdt0_oft_addresses(self):
        """Test USDT0 OFT addresses are defined."""
        assert "ethereum" in USDT0_OFT_ADDRESSES
        assert "arbitrum" in USDT0_OFT_ADDRESSES
        assert USDT0_OFT_ADDRESSES["ethereum"].startswith("0x")
        assert len(USDT0_OFT_ADDRESSES["ethereum"]) == 42

    def test_network_to_chain_mapping(self):
        """Test network to chain mapping."""
        assert NETWORK_TO_CHAIN["eip155:1"] == "ethereum"
        assert NETWORK_TO_CHAIN["eip155:42161"] == "arbitrum"

    def test_chain_to_network_mapping(self):
        """Test chain to network mapping."""
        assert CHAIN_TO_NETWORK["ethereum"] == "eip155:1"
        assert CHAIN_TO_NETWORK["arbitrum"] == "eip155:42161"

    def test_layerzero_scan_base_url(self):
        """Test LayerZero Scan base URL."""
        assert LAYERZERO_SCAN_BASE_URL == "https://scan.layerzero-api.com/v1"


class TestConstantFunctions:
    """Tests for constant utility functions."""

    def test_get_endpoint_id(self):
        """Test get_endpoint_id function."""
        assert get_endpoint_id("ethereum") == 30101
        assert get_endpoint_id("arbitrum") == 30110
        assert get_endpoint_id("ETHEREUM") == 30101  # case insensitive
        assert get_endpoint_id("nonexistent") is None

    def test_get_endpoint_id_from_network(self):
        """Test get_endpoint_id_from_network function."""
        assert get_endpoint_id_from_network("eip155:1") == 30101
        assert get_endpoint_id_from_network("eip155:42161") == 30110
        assert get_endpoint_id_from_network("eip155:99999") is None

    def test_get_usdt0_oft_address(self):
        """Test get_usdt0_oft_address function."""
        assert get_usdt0_oft_address("ethereum") is not None
        assert get_usdt0_oft_address("arbitrum") is not None
        assert get_usdt0_oft_address("ETHEREUM") is not None  # case insensitive
        assert get_usdt0_oft_address("nonexistent") is None

    def test_supports_bridging(self):
        """Test supports_bridging function."""
        assert supports_bridging("ethereum") is True
        assert supports_bridging("arbitrum") is True
        assert supports_bridging("ETHEREUM") is True  # case insensitive
        assert supports_bridging("nonexistent") is False

    def test_get_bridgeable_chains(self):
        """Test get_bridgeable_chains function."""
        chains = get_bridgeable_chains()
        assert isinstance(chains, list)
        assert "ethereum" in chains
        assert "arbitrum" in chains
        assert len(chains) >= 2

    def test_address_to_bytes32(self):
        """Test address_to_bytes32 function."""
        address = "0x1234567890abcdef1234567890abcdef12345678"
        result = address_to_bytes32(address)
        assert len(result) == 32
        assert result[:12] == b"\x00" * 12  # left-padded with zeros
        assert result[12:].hex() == address[2:].lower()

    def test_address_to_bytes32_without_prefix(self):
        """Test address_to_bytes32 without 0x prefix."""
        address = "1234567890abcdef1234567890abcdef12345678"
        result = address_to_bytes32(address)
        assert len(result) == 32
        assert result[12:].hex() == address.lower()

    def test_address_to_bytes32_invalid(self):
        """Test address_to_bytes32 with invalid address."""
        with pytest.raises(ValueError, match="Invalid address length"):
            address_to_bytes32("0x1234")  # too short

        with pytest.raises(ValueError, match="Invalid address hex"):
            address_to_bytes32("0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG")

    def test_bytes32_to_address(self):
        """Test bytes32_to_address function."""
        addr_bytes = bytes.fromhex("1234567890abcdef1234567890abcdef12345678")
        padded = b"\x00" * 12 + addr_bytes
        result = bytes32_to_address(padded)
        assert result == "0x1234567890abcdef1234567890abcdef12345678"


# =============================================================================
# Types Tests
# =============================================================================


class TestBridgeTypes:
    """Tests for bridge data types."""

    def test_bridge_status_enum(self):
        """Test BridgeStatus enum values."""
        assert BridgeStatus.PENDING.value == "pending"
        assert BridgeStatus.INFLIGHT.value == "inflight"
        assert BridgeStatus.DELIVERED.value == "delivered"
        assert BridgeStatus.COMPLETED.value == "completed"
        assert BridgeStatus.FAILED.value == "failed"

    def test_layerzero_message_status_enum(self):
        """Test LayerZeroMessageStatus enum values."""
        assert LayerZeroMessageStatus.INFLIGHT.value == "INFLIGHT"
        assert LayerZeroMessageStatus.CONFIRMING.value == "CONFIRMING"
        assert LayerZeroMessageStatus.DELIVERED.value == "DELIVERED"
        assert LayerZeroMessageStatus.FAILED.value == "FAILED"
        assert LayerZeroMessageStatus.BLOCKED.value == "BLOCKED"

    def test_bridge_quote_params(self):
        """Test BridgeQuoteParams dataclass."""
        params = BridgeQuoteParams(
            from_chain="arbitrum",
            to_chain="ethereum",
            amount=100_000000,
            recipient="0x1234567890abcdef1234567890abcdef12345678",
        )
        assert params.from_chain == "arbitrum"
        assert params.to_chain == "ethereum"
        assert params.amount == 100_000000
        assert params.recipient.startswith("0x")

    def test_bridge_quote(self):
        """Test BridgeQuote dataclass."""
        quote = BridgeQuote(
            native_fee=1000000000000000,
            amount_to_send=100_000000,
            min_amount_to_receive=99_500000,
            estimated_time=300,
            from_chain="arbitrum",
            to_chain="ethereum",
        )
        assert quote.native_fee == 1000000000000000
        assert quote.min_amount_to_receive == 99_500000
        assert quote.estimated_time == 300

    def test_bridge_execute_params(self):
        """Test BridgeExecuteParams dataclass with defaults."""
        params = BridgeExecuteParams(
            from_chain="arbitrum",
            to_chain="ethereum",
            amount=100_000000,
            recipient="0x1234567890abcdef1234567890abcdef12345678",
        )
        assert params.slippage_tolerance == 0.5
        assert params.dst_gas_limit is None
        assert params.refund_address is None

    def test_bridge_result(self):
        """Test BridgeResult dataclass."""
        result = BridgeResult(
            tx_hash="0xabc123",
            message_guid="0xdef456",
            amount_sent=100_000000,
            amount_to_receive=99_500000,
            from_chain="arbitrum",
            to_chain="ethereum",
            estimated_time=300,
        )
        assert result.tx_hash == "0xabc123"
        assert result.message_guid == "0xdef456"

    def test_send_param(self):
        """Test SendParam dataclass."""
        param = SendParam(
            dst_eid=30101,
            to=b"\x00" * 32,
            amount_ld=100_000000,
            min_amount_ld=99_500000,
        )
        assert param.dst_eid == 30101
        assert len(param.to) == 32
        assert param.extra_options == b""

    def test_messaging_fee(self):
        """Test MessagingFee dataclass."""
        fee = MessagingFee(native_fee=1000000000000000)
        assert fee.native_fee == 1000000000000000
        assert fee.lz_token_fee == 0

    def test_transaction_log(self):
        """Test TransactionLog dataclass."""
        log = TransactionLog(
            address="0x1234",
            topics=["0xabc", "0xdef"],
            data="0x",
        )
        assert log.address == "0x1234"
        assert len(log.topics) == 2

    def test_bridge_transaction_receipt(self):
        """Test BridgeTransactionReceipt dataclass."""
        receipt = BridgeTransactionReceipt(
            status=1,
            transaction_hash="0xabc",
            logs=[],
        )
        assert receipt.status == 1

    def test_layerzero_message(self):
        """Test LayerZeroMessage dataclass."""
        msg = LayerZeroMessage(
            guid="0xabc",
            src_eid=30110,
            dst_eid=30101,
            src_ua_address="0x1234",
            dst_ua_address="0x5678",
            src_tx_hash="0xdef",
            status=LayerZeroMessageStatus.INFLIGHT,
            src_block_number=12345,
            created="2024-01-01T00:00:00Z",
            updated="2024-01-01T00:01:00Z",
        )
        assert msg.guid == "0xabc"
        assert msg.status == LayerZeroMessageStatus.INFLIGHT
        assert msg.dst_tx_hash is None

    def test_wait_for_delivery_options(self):
        """Test WaitForDeliveryOptions defaults."""
        options = WaitForDeliveryOptions()
        assert options.timeout == 600_000
        assert options.poll_interval == 10_000
        assert options.on_status_change is None

    def test_cross_chain_payment_params(self):
        """Test CrossChainPaymentParams dataclass."""
        params = CrossChainPaymentParams(
            source_chain="arbitrum",
            destination_chain="ethereum",
            amount=100_000000,
            pay_to="0x1234",
            payer="0x5678",
        )
        assert params.slippage_tolerance == 0.5

    def test_cross_chain_payment_result(self):
        """Test CrossChainPaymentResult dataclass."""
        result = CrossChainPaymentResult(
            bridge_tx_hash="0xabc",
            message_guid="0xdef",
            amount_bridged=100_000000,
            estimated_receive_amount=99_500000,
            source_chain="arbitrum",
            destination_chain="ethereum",
            estimated_delivery_time=300,
        )
        assert result.bridge_tx_hash == "0xabc"


# =============================================================================
# Mock Signer for Testing
# =============================================================================


class MockBridgeSigner:
    """Mock signer for bridge tests."""

    def __init__(self, address: str = "0x1234567890abcdef1234567890abcdef12345678"):
        self._address = address

    @property
    def address(self) -> str:
        return self._address

    async def read_contract(self, address, abi, function_name, *args):
        if function_name == "quoteSend":
            return (1000000000000000, 0)  # native fee, lz token fee
        if function_name == "allowance":
            return 0
        return None

    async def write_contract(self, address, abi, function_name, *args, value=0):
        return "0xtxhash123"

    async def wait_for_transaction_receipt(self, tx_hash):
        return BridgeTransactionReceipt(
            status=1,
            transaction_hash=tx_hash,
            logs=[
                TransactionLog(
                    address="0x1234",
                    topics=[
                        "0x85496b760a4b7f8d66384b9df21b381f5d1b1e79f229a47aaf4c232edc2fe59a",
                        "0xmessageguid123",
                    ],
                    data="0x",
                )
            ],
        )


# =============================================================================
# Bridge Client Tests
# =============================================================================


class TestUsdt0Bridge:
    """Tests for Usdt0Bridge client."""

    def test_create_bridge(self):
        """Test creating bridge client."""
        signer = MockBridgeSigner()
        bridge = Usdt0Bridge(signer, "arbitrum")
        assert bridge is not None

    def test_create_bridge_invalid_chain(self):
        """Test creating bridge with invalid chain."""
        signer = MockBridgeSigner()
        with pytest.raises(ValueError, match="does not support"):
            Usdt0Bridge(signer, "nonexistent")

    def test_create_usdt0_bridge_factory(self):
        """Test create_usdt0_bridge factory function."""
        signer = MockBridgeSigner()
        bridge = create_usdt0_bridge(signer, "arbitrum")
        assert isinstance(bridge, Usdt0Bridge)

    def test_get_supported_destinations(self):
        """Test get_supported_destinations method."""
        signer = MockBridgeSigner()
        bridge = Usdt0Bridge(signer, "arbitrum")
        destinations = bridge.get_supported_destinations()
        assert "ethereum" in destinations
        assert "arbitrum" not in destinations  # source chain excluded

    def test_supports_destination(self):
        """Test supports_destination method."""
        signer = MockBridgeSigner()
        bridge = Usdt0Bridge(signer, "arbitrum")
        assert bridge.supports_destination("ethereum") is True
        assert bridge.supports_destination("arbitrum") is False  # same as source
        assert bridge.supports_destination("nonexistent") is False

    @pytest.mark.asyncio
    async def test_quote(self):
        """Test quote method."""
        signer = MockBridgeSigner()
        bridge = Usdt0Bridge(signer, "arbitrum")

        quote = await bridge.quote(
            BridgeQuoteParams(
                from_chain="arbitrum",
                to_chain="ethereum",
                amount=100_000000,
                recipient="0x1234567890abcdef1234567890abcdef12345678",
            )
        )

        assert quote.native_fee > 0
        assert quote.amount_to_send == 100_000000
        assert quote.from_chain == "arbitrum"
        assert quote.to_chain == "ethereum"

    @pytest.mark.asyncio
    async def test_quote_invalid_source_chain(self):
        """Test quote with wrong source chain."""
        signer = MockBridgeSigner()
        bridge = Usdt0Bridge(signer, "arbitrum")

        with pytest.raises(ValueError, match="Source chain mismatch"):
            await bridge.quote(
                BridgeQuoteParams(
                    from_chain="ethereum",  # wrong source
                    to_chain="ink",
                    amount=100_000000,
                    recipient="0x1234567890abcdef1234567890abcdef12345678",
                )
            )

    @pytest.mark.asyncio
    async def test_quote_same_chain(self):
        """Test quote with same source and destination."""
        signer = MockBridgeSigner()
        bridge = Usdt0Bridge(signer, "arbitrum")

        with pytest.raises(ValueError, match="must be different"):
            await bridge.quote(
                BridgeQuoteParams(
                    from_chain="arbitrum",
                    to_chain="arbitrum",
                    amount=100_000000,
                    recipient="0x1234567890abcdef1234567890abcdef12345678",
                )
            )

    @pytest.mark.asyncio
    async def test_quote_zero_amount(self):
        """Test quote with zero amount."""
        signer = MockBridgeSigner()
        bridge = Usdt0Bridge(signer, "arbitrum")

        with pytest.raises(ValueError, match="greater than 0"):
            await bridge.quote(
                BridgeQuoteParams(
                    from_chain="arbitrum",
                    to_chain="ethereum",
                    amount=0,
                    recipient="0x1234567890abcdef1234567890abcdef12345678",
                )
            )

    @pytest.mark.asyncio
    async def test_send(self):
        """Test send method."""
        signer = MockBridgeSigner()
        bridge = Usdt0Bridge(signer, "arbitrum")

        result = await bridge.send(
            BridgeExecuteParams(
                from_chain="arbitrum",
                to_chain="ethereum",
                amount=100_000000,
                recipient="0x1234567890abcdef1234567890abcdef12345678",
            )
        )

        assert result.tx_hash is not None
        assert result.message_guid is not None
        assert result.amount_sent == 100_000000


# =============================================================================
# LayerZero Scan Client Tests
# =============================================================================


class TestLayerZeroScanClient:
    """Tests for LayerZeroScanClient."""

    def test_create_client(self):
        """Test creating scan client."""
        client = LayerZeroScanClient()
        assert client.base_url == LAYERZERO_SCAN_BASE_URL

    def test_create_client_custom_url(self):
        """Test creating scan client with custom URL."""
        client = LayerZeroScanClient(base_url="https://custom.api.com")
        assert client.base_url == "https://custom.api.com"

    def test_create_layerzero_scan_client_factory(self):
        """Test create_layerzero_scan_client factory function."""
        client = create_layerzero_scan_client()
        assert isinstance(client, LayerZeroScanClient)

    @pytest.mark.asyncio
    async def test_close(self):
        """Test close method."""
        client = LayerZeroScanClient()
        await client.close()  # Should not raise

    @pytest.mark.asyncio
    async def test_is_delivered_not_found(self):
        """Test is_delivered returns False for unknown message."""
        client = LayerZeroScanClient()

        with patch.object(client, "get_message", side_effect=ValueError("not found")):
            result = await client.is_delivered("0xunknown")
            assert result is False

    @pytest.mark.asyncio
    async def test_get_client_creates_httpx_client(self):
        """Test _get_client creates and caches an httpx.AsyncClient."""
        client = LayerZeroScanClient()
        assert client._client is None

        http_client = await client._get_client()
        assert http_client is not None
        assert client._client is http_client

        # Should return cached client
        http_client2 = await client._get_client()
        assert http_client is http_client2

        await client.close()

    @pytest.mark.asyncio
    async def test_close_with_existing_client(self):
        """Test close properly closes the HTTP client."""
        client = LayerZeroScanClient()

        # Create the client
        await client._get_client()
        assert client._client is not None

        # Close it
        await client.close()
        assert client._client is None

    @pytest.mark.asyncio
    async def test_get_message_success(self):
        """Test get_message with successful response."""
        client = LayerZeroScanClient()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "guid": "0x1234567890abcdef",
            "srcEid": 30101,
            "dstEid": 30110,
            "srcUaAddress": "0xabc",
            "dstUaAddress": "0xdef",
            "srcTxHash": "0xtx123",
            "dstTxHash": "0xtx456",
            "status": "DELIVERED",
            "srcBlockNumber": 100,
            "dstBlockNumber": 200,
            "created": "2026-01-01T00:00:00Z",
            "updated": "2026-01-01T01:00:00Z",
        }
        mock_response.raise_for_status = MagicMock()

        mock_http_client = AsyncMock()
        mock_http_client.get = AsyncMock(return_value=mock_response)

        with patch.object(client, "_get_client", return_value=mock_http_client):
            message = await client.get_message("0x1234567890abcdef")

        assert message.guid == "0x1234567890abcdef"
        assert message.src_eid == 30101
        assert message.dst_eid == 30110
        assert message.status == LayerZeroMessageStatus.DELIVERED
        assert message.dst_tx_hash == "0xtx456"

    @pytest.mark.asyncio
    async def test_get_message_not_found(self):
        """Test get_message raises ValueError for 404."""
        client = LayerZeroScanClient()

        mock_response = MagicMock()
        mock_response.status_code = 404

        mock_http_client = AsyncMock()
        mock_http_client.get = AsyncMock(return_value=mock_response)

        with patch.object(client, "_get_client", return_value=mock_http_client):
            with pytest.raises(ValueError) as exc_info:
                await client.get_message("0xnonexistent")
            assert "not found" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_get_messages_by_wallet(self):
        """Test get_messages_by_wallet returns list of messages."""
        client = LayerZeroScanClient()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "messages": [
                {
                    "guid": "0xmsg1",
                    "srcEid": 30101,
                    "dstEid": 30110,
                    "srcUaAddress": "0xabc",
                    "dstUaAddress": "0xdef",
                    "srcTxHash": "0xtx1",
                    "status": "DELIVERED",
                    "srcBlockNumber": 100,
                    "created": "2026-01-01T00:00:00Z",
                    "updated": "2026-01-01T01:00:00Z",
                },
                {
                    "guid": "0xmsg2",
                    "srcEid": 30110,
                    "dstEid": 30101,
                    "srcUaAddress": "0xabc",
                    "dstUaAddress": "0xdef",
                    "srcTxHash": "0xtx2",
                    "status": "INFLIGHT",
                    "srcBlockNumber": 200,
                    "created": "2026-01-02T00:00:00Z",
                    "updated": "2026-01-02T01:00:00Z",
                },
            ]
        }
        mock_response.raise_for_status = MagicMock()

        mock_http_client = AsyncMock()
        mock_http_client.get = AsyncMock(return_value=mock_response)

        with patch.object(client, "_get_client", return_value=mock_http_client):
            messages = await client.get_messages_by_wallet("0xabc")

        assert len(messages) == 2
        assert messages[0].guid == "0xmsg1"
        assert messages[0].status == LayerZeroMessageStatus.DELIVERED
        assert messages[1].guid == "0xmsg2"
        assert messages[1].status == LayerZeroMessageStatus.INFLIGHT

    @pytest.mark.asyncio
    async def test_get_messages_by_wallet_with_data_key(self):
        """Test get_messages_by_wallet handles 'data' key in response."""
        client = LayerZeroScanClient()

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "data": [
                {
                    "guid": "0xmsg1",
                    "srcEid": 30101,
                    "dstEid": 30110,
                    "srcUaAddress": "0xabc",
                    "dstUaAddress": "0xdef",
                    "srcTxHash": "0xtx1",
                    "status": "DELIVERED",
                    "srcBlockNumber": 100,
                    "created": "2026-01-01T00:00:00Z",
                    "updated": "2026-01-01T01:00:00Z",
                }
            ]
        }
        mock_response.raise_for_status = MagicMock()

        mock_http_client = AsyncMock()
        mock_http_client.get = AsyncMock(return_value=mock_response)

        with patch.object(client, "_get_client", return_value=mock_http_client):
            messages = await client.get_messages_by_wallet("0xabc")

        assert len(messages) == 1

    @pytest.mark.asyncio
    async def test_wait_for_delivery_success(self):
        """Test wait_for_delivery returns when message is delivered."""
        client = LayerZeroScanClient()

        delivered_message = LayerZeroMessage(
            guid="0xtest",
            src_eid=30101,
            dst_eid=30110,
            src_ua_address="0xabc",
            dst_ua_address="0xdef",
            src_tx_hash="0xtx",
            dst_tx_hash="0xdst",
            status=LayerZeroMessageStatus.DELIVERED,
            src_block_number=100,
            dst_block_number=200,
            created="2026-01-01",
            updated="2026-01-01",
        )

        with patch.object(client, "get_message", return_value=delivered_message):
            result = await client.wait_for_delivery("0xtest")

        assert result.status == LayerZeroMessageStatus.DELIVERED

    @pytest.mark.asyncio
    async def test_wait_for_delivery_with_options(self):
        """Test wait_for_delivery with custom options."""
        client = LayerZeroScanClient()

        delivered_message = LayerZeroMessage(
            guid="0xtest",
            src_eid=30101,
            dst_eid=30110,
            src_ua_address="0xabc",
            dst_ua_address="0xdef",
            src_tx_hash="0xtx",
            status=LayerZeroMessageStatus.DELIVERED,
            src_block_number=100,
            created="2026-01-01",
            updated="2026-01-01",
        )

        status_changes = []
        options = WaitForDeliveryOptions(
            timeout=5000,
            poll_interval=100,
            on_status_change=lambda s: status_changes.append(s),
        )

        with patch.object(client, "get_message", return_value=delivered_message):
            result = await client.wait_for_delivery("0xtest", options)

        assert result.status == LayerZeroMessageStatus.DELIVERED
        assert LayerZeroMessageStatus.DELIVERED in status_changes

    @pytest.mark.asyncio
    async def test_wait_for_delivery_failed(self):
        """Test wait_for_delivery raises when message fails."""
        client = LayerZeroScanClient()

        failed_message = LayerZeroMessage(
            guid="0xtest",
            src_eid=30101,
            dst_eid=30110,
            src_ua_address="0xabc",
            dst_ua_address="0xdef",
            src_tx_hash="0xtx",
            status=LayerZeroMessageStatus.FAILED,
            src_block_number=100,
            created="2026-01-01",
            updated="2026-01-01",
        )

        with patch.object(client, "get_message", return_value=failed_message):
            with pytest.raises(ValueError) as exc_info:
                await client.wait_for_delivery("0xtest")
            assert "failed" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_wait_for_delivery_blocked(self):
        """Test wait_for_delivery raises when message is blocked."""
        client = LayerZeroScanClient()

        blocked_message = LayerZeroMessage(
            guid="0xtest",
            src_eid=30101,
            dst_eid=30110,
            src_ua_address="0xabc",
            dst_ua_address="0xdef",
            src_tx_hash="0xtx",
            status=LayerZeroMessageStatus.BLOCKED,
            src_block_number=100,
            created="2026-01-01",
            updated="2026-01-01",
        )

        with patch.object(client, "get_message", return_value=blocked_message):
            with pytest.raises(ValueError) as exc_info:
                await client.wait_for_delivery("0xtest")
            assert "blocked" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_wait_for_delivery_timeout(self):
        """Test wait_for_delivery raises on timeout."""
        client = LayerZeroScanClient()

        inflight_message = LayerZeroMessage(
            guid="0xtest",
            src_eid=30101,
            dst_eid=30110,
            src_ua_address="0xabc",
            dst_ua_address="0xdef",
            src_tx_hash="0xtx",
            status=LayerZeroMessageStatus.INFLIGHT,
            src_block_number=100,
            created="2026-01-01",
            updated="2026-01-01",
        )

        options = WaitForDeliveryOptions(timeout=100, poll_interval=50)

        with patch.object(client, "get_message", return_value=inflight_message):
            with pytest.raises(ValueError) as exc_info:
                await client.wait_for_delivery("0xtest", options)
            assert "timeout" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_wait_for_delivery_retries_on_not_found(self):
        """Test wait_for_delivery retries when message not yet indexed."""
        client = LayerZeroScanClient()

        delivered_message = LayerZeroMessage(
            guid="0xtest",
            src_eid=30101,
            dst_eid=30110,
            src_ua_address="0xabc",
            dst_ua_address="0xdef",
            src_tx_hash="0xtx",
            status=LayerZeroMessageStatus.DELIVERED,
            src_block_number=100,
            created="2026-01-01",
            updated="2026-01-01",
        )

        call_count = 0

        async def mock_get_message(guid):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise ValueError("Message not found: 0xtest")
            return delivered_message

        options = WaitForDeliveryOptions(timeout=5000, poll_interval=10)

        with patch.object(client, "get_message", side_effect=mock_get_message):
            result = await client.wait_for_delivery("0xtest", options)

        assert result.status == LayerZeroMessageStatus.DELIVERED
        assert call_count >= 3

    @pytest.mark.asyncio
    async def test_is_delivered_true(self):
        """Test is_delivered returns True when message is delivered."""
        client = LayerZeroScanClient()

        delivered_message = LayerZeroMessage(
            guid="0xtest",
            src_eid=30101,
            dst_eid=30110,
            src_ua_address="0xabc",
            dst_ua_address="0xdef",
            src_tx_hash="0xtx",
            status=LayerZeroMessageStatus.DELIVERED,
            src_block_number=100,
            created="2026-01-01",
            updated="2026-01-01",
        )

        with patch.object(client, "get_message", return_value=delivered_message):
            result = await client.is_delivered("0xtest")
            assert result is True

    @pytest.mark.asyncio
    async def test_is_delivered_false_when_inflight(self):
        """Test is_delivered returns False when message is inflight."""
        client = LayerZeroScanClient()

        inflight_message = LayerZeroMessage(
            guid="0xtest",
            src_eid=30101,
            dst_eid=30110,
            src_ua_address="0xabc",
            dst_ua_address="0xdef",
            src_tx_hash="0xtx",
            status=LayerZeroMessageStatus.INFLIGHT,
            src_block_number=100,
            created="2026-01-01",
            updated="2026-01-01",
        )

        with patch.object(client, "get_message", return_value=inflight_message):
            result = await client.is_delivered("0xtest")
            assert result is False

    def test_map_api_response_full(self):
        """Test _map_api_response with full data."""
        client = LayerZeroScanClient()

        data = {
            "guid": "0xtest",
            "srcEid": 30101,
            "dstEid": 30110,
            "srcUaAddress": "0xabc",
            "dstUaAddress": "0xdef",
            "srcTxHash": "0xtx1",
            "dstTxHash": "0xtx2",
            "status": "CONFIRMING",
            "srcBlockNumber": 100,
            "dstBlockNumber": 200,
            "created": "2026-01-01",
            "updated": "2026-01-02",
        }

        message = client._map_api_response(data)

        assert message.guid == "0xtest"
        assert message.src_eid == 30101
        assert message.dst_eid == 30110
        assert message.src_ua_address == "0xabc"
        assert message.dst_ua_address == "0xdef"
        assert message.src_tx_hash == "0xtx1"
        assert message.dst_tx_hash == "0xtx2"
        assert message.status == LayerZeroMessageStatus.CONFIRMING
        assert message.src_block_number == 100
        assert message.dst_block_number == 200

    def test_map_api_response_alternative_keys(self):
        """Test _map_api_response with alternative key names."""
        client = LayerZeroScanClient()

        data = {
            "messageGuid": "0xalt",
            "srcChainId": 30101,
            "dstChainId": 30110,
            "srcAddress": "0xsrc",
            "dstAddress": "0xdst",
            "srcTxHash": "0xtx",
            "status": "DELIVERED",
            "srcBlockNumber": 100,
            "createdAt": "2026-01-01",
            "updatedAt": "2026-01-02",
        }

        message = client._map_api_response(data)

        assert message.guid == "0xalt"
        assert message.src_eid == 30101
        assert message.dst_eid == 30110
        assert message.src_ua_address == "0xsrc"
        assert message.dst_ua_address == "0xdst"

    def test_map_api_response_minimal(self):
        """Test _map_api_response with minimal data."""
        client = LayerZeroScanClient()

        data = {"status": "INFLIGHT"}

        message = client._map_api_response(data)

        assert message.guid == ""
        assert message.src_eid == 0
        assert message.dst_eid == 0
        assert message.status == LayerZeroMessageStatus.INFLIGHT


# =============================================================================
# CrossChainPaymentRouter Tests
# =============================================================================


class TestCrossChainPaymentRouter:
    """Tests for CrossChainPaymentRouter."""

    def test_create_router(self):
        """Test creating router."""
        signer = MockBridgeSigner()
        router = CrossChainPaymentRouter(signer, "arbitrum")
        assert router is not None

    def test_create_router_factory(self):
        """Test create_cross_chain_payment_router factory."""
        signer = MockBridgeSigner()
        router = create_cross_chain_payment_router(signer, "arbitrum")
        assert isinstance(router, CrossChainPaymentRouter)

    def test_can_route(self):
        """Test can_route method."""
        signer = MockBridgeSigner()
        router = CrossChainPaymentRouter(signer, "arbitrum")

        assert router.can_route("arbitrum", "ethereum") is True
        assert router.can_route("arbitrum", "arbitrum") is False
        assert router.can_route("arbitrum", "nonexistent") is False

    def test_get_supported_destinations(self):
        """Test get_supported_destinations method."""
        signer = MockBridgeSigner()
        router = CrossChainPaymentRouter(signer, "arbitrum")
        destinations = router.get_supported_destinations()
        assert "ethereum" in destinations
        assert "arbitrum" not in destinations

    def test_get_bridgeable_chains_static(self):
        """Test static get_bridgeable_chains method."""
        chains = CrossChainPaymentRouter.get_bridgeable_chains()
        assert "ethereum" in chains
        assert "arbitrum" in chains

    @pytest.mark.asyncio
    async def test_route_payment(self):
        """Test route_payment method."""
        signer = MockBridgeSigner()
        router = CrossChainPaymentRouter(signer, "arbitrum")

        result = await router.route_payment(
            CrossChainPaymentParams(
                source_chain="arbitrum",
                destination_chain="ethereum",
                amount=100_000000,
                pay_to="0x1234567890abcdef1234567890abcdef12345678",
                payer="0x5678567856785678567856785678567856785678",
            )
        )

        assert result.bridge_tx_hash is not None
        assert result.message_guid is not None
        assert result.source_chain == "arbitrum"
        assert result.destination_chain == "ethereum"

    @pytest.mark.asyncio
    async def test_route_payment_wrong_source(self):
        """Test route_payment with wrong source chain."""
        signer = MockBridgeSigner()
        router = CrossChainPaymentRouter(signer, "arbitrum")

        with pytest.raises(ValueError, match="Source chain mismatch"):
            await router.route_payment(
                CrossChainPaymentParams(
                    source_chain="ethereum",  # wrong
                    destination_chain="arbitrum",
                    amount=100_000000,
                    pay_to="0x1234567890abcdef1234567890abcdef12345678",
                    payer="0x5678567856785678567856785678567856785678",
                )
            )

    @pytest.mark.asyncio
    async def test_route_payment_invalid_route(self):
        """Test route_payment with invalid route."""
        signer = MockBridgeSigner()
        router = CrossChainPaymentRouter(signer, "arbitrum")

        with pytest.raises(ValueError, match="Cannot route"):
            await router.route_payment(
                CrossChainPaymentParams(
                    source_chain="arbitrum",
                    destination_chain="nonexistent",
                    amount=100_000000,
                    pay_to="0x1234",
                    payer="0x5678",
                )
            )

    @pytest.mark.asyncio
    async def test_estimate_fees(self):
        """Test estimate_fees method."""
        signer = MockBridgeSigner()
        router = CrossChainPaymentRouter(signer, "arbitrum")

        quote = await router.estimate_fees(
            CrossChainPaymentParams(
                source_chain="arbitrum",
                destination_chain="ethereum",
                amount=100_000000,
                pay_to="0x1234567890abcdef1234567890abcdef12345678",
                payer="0x5678567856785678567856785678567856785678",
            )
        )

        assert quote.native_fee > 0
        assert quote.from_chain == "arbitrum"

    @pytest.mark.asyncio
    async def test_close(self):
        """Test close method."""
        signer = MockBridgeSigner()
        router = CrossChainPaymentRouter(signer, "arbitrum")
        await router.close()  # Should not raise


# =============================================================================
# Integration Tests (Mock-based)
# =============================================================================


class TestBridgeIntegration:
    """Integration tests for bridge workflow."""

    @pytest.mark.asyncio
    async def test_full_bridge_workflow(self):
        """Test complete bridge workflow."""
        signer = MockBridgeSigner()

        # Step 1: Create bridge
        bridge = Usdt0Bridge(signer, "arbitrum")

        # Step 2: Check destinations
        destinations = bridge.get_supported_destinations()
        assert "ethereum" in destinations

        # Step 3: Get quote
        quote = await bridge.quote(
            BridgeQuoteParams(
                from_chain="arbitrum",
                to_chain="ethereum",
                amount=100_000000,
                recipient="0x1234567890abcdef1234567890abcdef12345678",
            )
        )
        assert quote.native_fee > 0

        # Step 4: Execute bridge
        result = await bridge.send(
            BridgeExecuteParams(
                from_chain="arbitrum",
                to_chain="ethereum",
                amount=100_000000,
                recipient="0x1234567890abcdef1234567890abcdef12345678",
            )
        )
        assert result.message_guid is not None

    @pytest.mark.asyncio
    async def test_full_router_workflow(self):
        """Test complete router workflow."""
        signer = MockBridgeSigner()

        # Create router
        router = CrossChainPaymentRouter(signer, "arbitrum")

        # Check route availability
        assert router.can_route("arbitrum", "ethereum")

        # Get fee estimate
        quote = await router.estimate_fees(
            CrossChainPaymentParams(
                source_chain="arbitrum",
                destination_chain="ethereum",
                amount=100_000000,
                pay_to="0x1234567890abcdef1234567890abcdef12345678",
                payer="0x5678567856785678567856785678567856785678",
            )
        )
        assert quote.native_fee > 0

        # Route payment
        result = await router.route_payment(
            CrossChainPaymentParams(
                source_chain="arbitrum",
                destination_chain="ethereum",
                amount=100_000000,
                pay_to="0x1234567890abcdef1234567890abcdef12345678",
                payer="0x5678567856785678567856785678567856785678",
            )
        )
        assert result.message_guid is not None

        # Cleanup
        await router.close()
