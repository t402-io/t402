"""Tests for WDK hardware wallet signer."""

import pytest
from t402.wdk.hardware import (
    HardwareWalletSigner,
    HardwareWalletConfig,
    HardwareWalletType,
)


class TestHardwareWalletType:
    """Tests for HardwareWalletType enum."""

    def test_ledger_type(self):
        assert HardwareWalletType.LEDGER.value == "ledger"

    def test_trezor_type(self):
        assert HardwareWalletType.TREZOR.value == "trezor"


class TestHardwareWalletConfig:
    """Tests for HardwareWalletConfig."""

    def test_default_config(self):
        config = HardwareWalletConfig(wallet_type=HardwareWalletType.LEDGER)
        assert config.derivation_path == "m/44'/60'/0'/0/0"
        assert config.chain_id == 1

    def test_custom_config(self):
        config = HardwareWalletConfig(
            wallet_type=HardwareWalletType.TREZOR,
            derivation_path="m/44'/60'/0'/0/1",
            chain_id=42161,
        )
        assert config.wallet_type == HardwareWalletType.TREZOR
        assert config.chain_id == 42161


class TestHardwareWalletSigner:
    """Tests for HardwareWalletSigner."""

    def test_create_signer(self):
        config = HardwareWalletConfig(wallet_type=HardwareWalletType.LEDGER)
        signer = HardwareWalletSigner(config)
        assert signer.is_connected is False
        assert signer.wallet_type == HardwareWalletType.LEDGER

    def test_wallet_type_property(self):
        config = HardwareWalletConfig(wallet_type=HardwareWalletType.TREZOR)
        signer = HardwareWalletSigner(config)
        assert signer.wallet_type == HardwareWalletType.TREZOR


@pytest.mark.asyncio
class TestHardwareWalletSignerAsync:
    """Async tests for HardwareWalletSigner."""

    async def test_connect(self):
        config = HardwareWalletConfig(wallet_type=HardwareWalletType.LEDGER)
        signer = HardwareWalletSigner(config)

        result = await signer.connect()
        assert result is True
        assert signer.is_connected is True

    async def test_get_address(self):
        config = HardwareWalletConfig(wallet_type=HardwareWalletType.LEDGER)
        signer = HardwareWalletSigner(config)
        await signer.connect()

        address = await signer.get_address()
        assert address is not None
        assert address.startswith("0x")

    async def test_get_address_not_connected(self):
        config = HardwareWalletConfig(wallet_type=HardwareWalletType.LEDGER)
        signer = HardwareWalletSigner(config)

        with pytest.raises(RuntimeError, match="not connected"):
            await signer.get_address()

    async def test_sign_message(self):
        config = HardwareWalletConfig(wallet_type=HardwareWalletType.LEDGER)
        signer = HardwareWalletSigner(config)
        await signer.connect()

        signature = await signer.sign_message(b"Hello, T402!")
        assert signature is not None
        assert len(signature) == 65

    async def test_sign_message_not_connected(self):
        config = HardwareWalletConfig(wallet_type=HardwareWalletType.LEDGER)
        signer = HardwareWalletSigner(config)

        with pytest.raises(RuntimeError, match="not connected"):
            await signer.sign_message(b"Hello")

    async def test_sign_message_empty(self):
        config = HardwareWalletConfig(wallet_type=HardwareWalletType.LEDGER)
        signer = HardwareWalletSigner(config)
        await signer.connect()

        with pytest.raises(ValueError, match="empty"):
            await signer.sign_message(b"")

    async def test_sign_typed_data(self):
        config = HardwareWalletConfig(wallet_type=HardwareWalletType.LEDGER)
        signer = HardwareWalletSigner(config)
        await signer.connect()

        signature = await signer.sign_typed_data(
            domain={"name": "Test", "version": "1"},
            types={"Message": [{"name": "content", "type": "string"}]},
            value={"content": "Hello"},
        )
        assert signature is not None
        assert len(signature) == 65

    async def test_disconnect(self):
        config = HardwareWalletConfig(wallet_type=HardwareWalletType.LEDGER)
        signer = HardwareWalletSigner(config)
        await signer.connect()
        assert signer.is_connected is True

        await signer.disconnect()
        assert signer.is_connected is False

    async def test_disconnect_clears_address(self):
        config = HardwareWalletConfig(wallet_type=HardwareWalletType.LEDGER)
        signer = HardwareWalletSigner(config)
        await signer.connect()
        await signer.get_address()  # Cache the address
        await signer.disconnect()
        await signer.connect()

        # Address should be re-derived after reconnect
        address = await signer.get_address()
        assert address is not None
