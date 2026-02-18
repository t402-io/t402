"""Tests for WDK bridge client."""

import pytest
from t402.wdk.bridge import (
    WDKBridgeClient,
    BridgeConfig,
    BridgeParams,
    BridgeResult,
    BridgeRoute,
)


class TestBridgeConfig:
    """Tests for BridgeConfig."""

    def test_default_config(self):
        config = BridgeConfig()
        assert config.rpc_urls == {}
        assert config.default_slippage == 0.5
        assert config.timeout == 600

    def test_custom_config(self):
        config = BridgeConfig(
            rpc_urls={"arbitrum": "https://arb1.arbitrum.io/rpc"},
            default_slippage=1.0,
            timeout=300,
        )
        assert "arbitrum" in config.rpc_urls
        assert config.default_slippage == 1.0


class TestBridgeParams:
    """Tests for BridgeParams."""

    def test_create_params(self):
        params = BridgeParams(
            from_network="eip155:42161",
            to_network="eip155:1",
            amount=100_000000,
            recipient="0x" + "1" * 40,
        )
        assert params.from_network == "eip155:42161"
        assert params.to_network == "eip155:1"
        assert params.amount == 100_000000


class TestBridgeResult:
    """Tests for BridgeResult."""

    def test_default_result(self):
        result = BridgeResult(tx_hash="0xabc")
        assert result.tx_hash == "0xabc"
        assert result.message_guid is None
        assert result.estimated_time == 300

    def test_full_result(self):
        result = BridgeResult(
            tx_hash="0xabc",
            message_guid="guid-123",
            estimated_time=120,
            from_network="eip155:42161",
            to_network="eip155:1",
            amount_sent=100_000000,
        )
        assert result.message_guid == "guid-123"
        assert result.amount_sent == 100_000000


class TestBridgeRoute:
    """Tests for BridgeRoute."""

    def test_default_route(self):
        route = BridgeRoute(from_chain="arbitrum", to_chain="ethereum")
        assert route.available is True
        assert route.native_fee == 0

    def test_unavailable_route(self):
        route = BridgeRoute(
            from_chain="arbitrum",
            to_chain="ethereum",
            available=False,
            unavailable_reason="Insufficient balance",
        )
        assert route.available is False
        assert "Insufficient" in route.unavailable_reason


class TestWDKBridgeClient:
    """Tests for WDKBridgeClient."""

    def test_create_client(self):
        config = BridgeConfig(
            rpc_urls={"arbitrum": "https://arb1.arbitrum.io/rpc"},
        )
        client = WDKBridgeClient(config)
        assert client.config == config
        assert client.signer is None

    def test_get_supported_chains(self):
        config = BridgeConfig()
        client = WDKBridgeClient(config)
        chains = client.get_supported_chains()
        assert isinstance(chains, list)
        assert len(chains) > 0


@pytest.mark.asyncio
class TestWDKBridgeClientAsync:
    """Async tests for WDKBridgeClient."""

    async def test_bridge_requires_signer(self):
        config = BridgeConfig()
        client = WDKBridgeClient(config)
        params = BridgeParams(
            from_network="eip155:42161",
            to_network="eip155:1",
            amount=100_000000,
            recipient="0x" + "1" * 40,
        )
        with pytest.raises(RuntimeError, match="No signer configured"):
            await client.bridge(params)

    async def test_bridge_validates_same_network(self):
        config = BridgeConfig()
        client = WDKBridgeClient(config, signer=object())
        params = BridgeParams(
            from_network="eip155:42161",
            to_network="eip155:42161",
            amount=100_000000,
            recipient="0x" + "1" * 40,
        )
        with pytest.raises(ValueError, match="must be different"):
            await client.bridge(params)

    async def test_bridge_validates_zero_amount(self):
        config = BridgeConfig()
        client = WDKBridgeClient(config, signer=object())
        params = BridgeParams(
            from_network="eip155:42161",
            to_network="eip155:1",
            amount=0,
            recipient="0x" + "1" * 40,
        )
        with pytest.raises(ValueError, match="greater than zero"):
            await client.bridge(params)

    async def test_bridge_validates_zero_address(self):
        config = BridgeConfig()
        client = WDKBridgeClient(config, signer=object())
        params = BridgeParams(
            from_network="eip155:42161",
            to_network="eip155:1",
            amount=100_000000,
            recipient="0x" + "0" * 40,
        )
        with pytest.raises(ValueError, match="zero address"):
            await client.bridge(params)

    async def test_bridge_validates_empty_recipient(self):
        config = BridgeConfig()
        client = WDKBridgeClient(config, signer=object())
        params = BridgeParams(
            from_network="eip155:42161",
            to_network="eip155:1",
            amount=100_000000,
            recipient="",
        )
        with pytest.raises(ValueError, match="Recipient"):
            await client.bridge(params)

    async def test_get_bridge_fee(self):
        config = BridgeConfig()
        client = WDKBridgeClient(config)
        params = BridgeParams(
            from_network="eip155:42161",
            to_network="eip155:1",
            amount=100_000000,
            recipient="0x" + "1" * 40,
        )
        fee = await client.get_bridge_fee(params)
        assert isinstance(fee, int)
        assert fee >= 0

    async def test_get_bridge_status_requires_guid(self):
        config = BridgeConfig()
        client = WDKBridgeClient(config)
        with pytest.raises(ValueError, match="GUID is required"):
            await client.get_bridge_status("")

    async def test_get_bridge_status(self):
        config = BridgeConfig()
        client = WDKBridgeClient(config)
        status = await client.get_bridge_status("some-guid")
        assert status == "UNKNOWN"

    async def test_get_routes(self):
        config = BridgeConfig()
        client = WDKBridgeClient(config)
        routes = await client.get_routes("eip155:1", 100_000000)
        assert isinstance(routes, list)
