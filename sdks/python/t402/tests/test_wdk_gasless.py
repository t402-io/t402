"""Tests for WDK gasless payment client."""

import pytest
from t402.wdk.gasless import (
    GaslessClient,
    GaslessConfig,
    GaslessPaymentParams,
    GaslessPaymentResult,
    ENTRYPOINT_V07_ADDRESS,
)


class TestGaslessConfig:
    """Tests for GaslessConfig."""

    def test_default_config(self):
        config = GaslessConfig(
            bundler_url="https://bundler.example.com",
            paymaster_url="https://paymaster.example.com",
        )
        assert config.entry_point == ENTRYPOINT_V07_ADDRESS
        assert config.chain_id == 42161
        assert config.timeout == 30

    def test_custom_config(self):
        config = GaslessConfig(
            bundler_url="https://bundler.example.com",
            paymaster_url="https://paymaster.example.com",
            entry_point="0x1234",
            chain_id=8453,
            timeout=60,
        )
        assert config.chain_id == 8453
        assert config.timeout == 60


class TestGaslessPaymentParams:
    """Tests for GaslessPaymentParams."""

    def test_create_params(self):
        params = GaslessPaymentParams(
            to="0x" + "1" * 40,
            amount=1000000,
            token="0x" + "2" * 40,
            network="eip155:42161",
        )
        assert params.amount == 1000000
        assert params.network == "eip155:42161"


class TestGaslessPaymentResult:
    """Tests for GaslessPaymentResult."""

    def test_default_result(self):
        result = GaslessPaymentResult(user_op_hash="0xabc")
        assert result.user_op_hash == "0xabc"
        assert result.tx_hash is None
        assert result.success is False
        assert result.sponsored is True

    def test_full_result(self):
        result = GaslessPaymentResult(
            user_op_hash="0xabc",
            tx_hash="0xdef",
            success=True,
            gas_used=150000,
            gas_cost=100,
        )
        assert result.success is True
        assert result.gas_used == 150000


class TestGaslessClient:
    """Tests for GaslessClient."""

    def test_create_client(self):
        config = GaslessConfig(
            bundler_url="https://bundler.example.com",
            paymaster_url="https://paymaster.example.com",
        )
        client = GaslessClient(config)
        assert client.config == config
        assert client.signer is None

    def test_create_client_requires_bundler_url(self):
        config = GaslessConfig(
            bundler_url="",
            paymaster_url="https://paymaster.example.com",
        )
        with pytest.raises(ValueError, match="Bundler URL is required"):
            GaslessClient(config)

    def test_create_client_with_signer(self):
        config = GaslessConfig(
            bundler_url="https://bundler.example.com",
            paymaster_url="https://paymaster.example.com",
        )
        mock_signer = object()
        client = GaslessClient(config, signer=mock_signer)
        assert client.signer is mock_signer


@pytest.mark.asyncio
class TestGaslessClientAsync:
    """Async tests for GaslessClient."""

    async def test_pay_requires_signer(self):
        config = GaslessConfig(
            bundler_url="https://bundler.example.com",
            paymaster_url="https://paymaster.example.com",
        )
        client = GaslessClient(config)
        params = GaslessPaymentParams(
            to="0x" + "1" * 40,
            amount=1000000,
            token="0x" + "2" * 40,
            network="eip155:42161",
        )
        with pytest.raises(RuntimeError, match="No signer configured"):
            await client.pay(params)

    async def test_pay_validates_zero_address(self):
        config = GaslessConfig(
            bundler_url="https://bundler.example.com",
            paymaster_url="https://paymaster.example.com",
        )
        client = GaslessClient(config, signer=object())
        params = GaslessPaymentParams(
            to="0x" + "0" * 40,
            amount=1000000,
            token="0x" + "2" * 40,
            network="eip155:42161",
        )
        with pytest.raises(ValueError, match="zero address"):
            await client.pay(params)

    async def test_pay_validates_zero_amount(self):
        config = GaslessConfig(
            bundler_url="https://bundler.example.com",
            paymaster_url="https://paymaster.example.com",
        )
        client = GaslessClient(config, signer=object())
        params = GaslessPaymentParams(
            to="0x" + "1" * 40,
            amount=0,
            token="0x" + "2" * 40,
            network="eip155:42161",
        )
        with pytest.raises(ValueError, match="greater than zero"):
            await client.pay(params)

    async def test_estimate_gas(self):
        config = GaslessConfig(
            bundler_url="https://bundler.example.com",
            paymaster_url="https://paymaster.example.com",
        )
        client = GaslessClient(config)
        params = GaslessPaymentParams(
            to="0x" + "1" * 40,
            amount=1000000,
            token="0x" + "2" * 40,
            network="eip155:42161",
        )
        gas = await client.estimate_gas(params)
        assert gas > 0
        assert gas == 300_000

    async def test_get_account_address_requires_signer(self):
        config = GaslessConfig(
            bundler_url="https://bundler.example.com",
            paymaster_url="https://paymaster.example.com",
        )
        client = GaslessClient(config)
        with pytest.raises(RuntimeError, match="No signer configured"):
            await client.get_account_address()

    async def test_can_sponsor_no_paymaster(self):
        config = GaslessConfig(
            bundler_url="https://bundler.example.com",
            paymaster_url="",
        )
        client = GaslessClient(config)
        params = GaslessPaymentParams(
            to="0x" + "1" * 40,
            amount=1000000,
            token="0x" + "2" * 40,
            network="eip155:42161",
        )
        info = await client.can_sponsor(params)
        assert info.can_sponsor is False
        assert "No paymaster" in info.reason

    async def test_can_sponsor_with_paymaster(self):
        config = GaslessConfig(
            bundler_url="https://bundler.example.com",
            paymaster_url="https://paymaster.example.com",
        )
        client = GaslessClient(config)
        params = GaslessPaymentParams(
            to="0x" + "1" * 40,
            amount=1000000,
            token="0x" + "2" * 40,
            network="eip155:42161",
        )
        info = await client.can_sponsor(params)
        assert info.can_sponsor is True
