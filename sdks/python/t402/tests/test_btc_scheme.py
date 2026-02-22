"""Comprehensive tests for the Bitcoin & Lightning Network payment schemes.

Tests cover:
- Constants and validation functions
- BTC on-chain client scheme (PSBT creation)
- BTC on-chain server scheme (price parsing, requirements enhancement)
- BTC on-chain facilitator scheme (verification, settlement)
- Lightning client scheme (invoice payment)
- Lightning server scheme (invoice generation, requirements enhancement)
- Lightning facilitator scheme (preimage verification, settlement)
- End-to-end flows
- Protocol compliance
"""

from __future__ import annotations

import hashlib
from typing import Any, Dict, List, Optional

import pytest

from t402.schemes.btc import (
    # On-chain schemes
    ExactBtcClientScheme,
    ExactBtcServerScheme,
    ExactBtcFacilitatorScheme,
    # Lightning schemes
    LightningClientScheme,
    LightningServerScheme,
    LightningFacilitatorScheme,
    # Configurations
    ExactBtcClientConfig,
    ExactBtcServerConfig,
    ExactBtcFacilitatorConfig,
    LightningServerConfig,
    # Signer protocols
    ClientBtcSigner,
    ClientLightningSigner,
    FacilitatorBtcSigner,
    FacilitatorLightningSigner,
    # Payload types
    BtcOnchainPayload,
    LightningPayload,
    # Constants
    SCHEME_EXACT,
    BTC_MAINNET,
    BTC_TESTNET,
    BTC_SIGNET,
    LIGHTNING_MAINNET,
    LIGHTNING_TESTNET,
    BTC_NETWORKS,
    LIGHTNING_NETWORKS,
    ALL_NETWORKS,
    DUST_LIMIT,
    SATS_PER_BTC,
    BTC_CAIP_FAMILY,
    LIGHTNING_CAIP_FAMILY,
    # Validation functions
    is_valid_btc_network,
    is_valid_lightning_network,
    is_valid_network,
    validate_bitcoin_address,
    is_mainnet_address,
    is_testnet_address,
    validate_bolt11_invoice,
    is_valid_hex,
    satoshis_to_btc,
    btc_to_satoshis,
    get_supported_networks,
)


# =============================================================================
# Test Constants
# =============================================================================

VALID_PREIMAGE = "a" * 64  # 32 bytes hex
VALID_PAYMENT_HASH = hashlib.sha256(bytes.fromhex(VALID_PREIMAGE)).hexdigest()
VALID_BOLT11 = "lnbc10u1p0abc123" + "x" * 40  # Minimum valid format


# =============================================================================
# Mock Signers
# =============================================================================


class MockBtcClientSigner:
    """Mock BTC client signer for testing."""

    def __init__(
        self,
        address: str = "bc1qexampleaddress1234567890",
        public_key: str = "02" + "ab" * 32,
        signed_psbt: str = "signed_psbt_base64_data",
    ):
        self._address = address
        self._public_key = public_key
        self._signed_psbt = signed_psbt

    def get_address(self) -> str:
        return self._address

    def get_public_key(self) -> str:
        return self._public_key

    async def sign_psbt(self, psbt: str) -> str:
        return self._signed_psbt


class MockLightningClientSigner:
    """Mock Lightning client signer for testing."""

    def __init__(
        self,
        node_pub_key: str = "02" + "cd" * 32,
        preimage: str = VALID_PREIMAGE,
        payment_hash: str = VALID_PAYMENT_HASH,
    ):
        self._node_pub_key = node_pub_key
        self._preimage = preimage
        self._payment_hash = payment_hash
        self.last_bolt11: Optional[str] = None

    def get_node_pub_key(self) -> str:
        return self._node_pub_key

    async def pay_invoice(self, bolt11: str) -> Dict[str, str]:
        self.last_bolt11 = bolt11
        return {
            "preimage": self._preimage,
            "payment_hash": self._payment_hash,
        }


class MockBtcFacilitatorSigner:
    """Mock BTC facilitator signer for testing."""

    def __init__(
        self,
        addresses: Optional[List[str]] = None,
        verify_result: Optional[Dict[str, Any]] = None,
        tx_id: str = "txid_abc123",
        confirmed: bool = True,
    ):
        self._addresses = addresses or ["bc1qfacilitator123456"]
        self._verify_result = verify_result or {"valid": True, "payer": "bc1qpayer123"}
        self._tx_id = tx_id
        self._confirmed = confirmed

    def get_addresses(self) -> List[str]:
        return self._addresses

    async def verify_psbt(
        self,
        signed_psbt: str,
        expected_pay_to: str,
        expected_amount: str,
    ) -> Dict[str, Any]:
        return self._verify_result

    async def broadcast_psbt(self, signed_psbt: str) -> str:
        return self._tx_id

    async def wait_for_confirmation(
        self, tx_id: str, confirmations: int = 1
    ) -> Dict[str, Any]:
        return {
            "confirmed": self._confirmed,
            "tx_id": tx_id,
            "confirmations": confirmations if self._confirmed else 0,
        }


class MockLightningFacilitatorSigner:
    """Mock Lightning facilitator signer for testing."""

    def __init__(
        self,
        addresses: Optional[List[str]] = None,
        settled: bool = True,
        amount_sats: str = "10000",
    ):
        self._addresses = addresses or ["02" + "ef" * 32]
        self._settled = settled
        self._amount_sats = amount_sats

    def get_addresses(self) -> List[str]:
        return self._addresses

    async def lookup_payment(self, payment_hash: str) -> Dict[str, Any]:
        return {
            "settled": self._settled,
            "amount_sats": self._amount_sats,
        }


# =============================================================================
# Test Helpers
# =============================================================================


def make_btc_requirements(
    network: str = BTC_MAINNET,
    amount: str = "100000",
    pay_to: str = "bc1qmerchant1234567890abcd",
) -> Dict[str, Any]:
    """Create a mock BTC on-chain payment requirements dict."""
    return {
        "scheme": SCHEME_EXACT,
        "network": network,
        "asset": "BTC",
        "amount": amount,
        "payTo": pay_to,
        "maxTimeoutSeconds": 300,
        "extra": {},
    }


def make_btc_payload(
    signed_psbt: str = "signed_psbt_base64_data",
) -> Dict[str, Any]:
    """Create a mock BTC on-chain payment payload dict."""
    return {
        "payload": {
            "signedPsbt": signed_psbt,
        }
    }


def make_lightning_requirements(
    network: str = LIGHTNING_MAINNET,
    amount: str = "10000",
    bolt11_invoice: str = VALID_BOLT11,
    payment_hash: str = VALID_PAYMENT_HASH,
) -> Dict[str, Any]:
    """Create a mock Lightning payment requirements dict."""
    return {
        "scheme": SCHEME_EXACT,
        "network": network,
        "asset": "BTC",
        "amount": amount,
        "payTo": "",
        "maxTimeoutSeconds": 300,
        "extra": {
            "bolt11Invoice": bolt11_invoice,
            "paymentHash": payment_hash,
        },
    }


def make_lightning_payload(
    payment_hash: str = VALID_PAYMENT_HASH,
    preimage: str = VALID_PREIMAGE,
    bolt11_invoice: str = VALID_BOLT11,
) -> Dict[str, Any]:
    """Create a mock Lightning payment payload dict."""
    return {
        "payload": {
            "paymentHash": payment_hash,
            "preimage": preimage,
            "bolt11Invoice": bolt11_invoice,
        }
    }


# =============================================================================
# Constants Tests
# =============================================================================


class TestConstants:
    """Test BTC/Lightning constants and validation functions."""

    def test_network_identifiers(self):
        assert BTC_MAINNET == "bip122:000000000019d6689c085ae165831e93"
        assert BTC_TESTNET == "bip122:000000000933ea01ad0ee984209779ba"
        assert BTC_SIGNET == "bip122:00000008819873e925422c1ff0f99f7c"
        assert LIGHTNING_MAINNET == "lightning:mainnet"
        assert LIGHTNING_TESTNET == "lightning:testnet"

    def test_btc_networks_list(self):
        assert BTC_MAINNET in BTC_NETWORKS
        assert BTC_TESTNET in BTC_NETWORKS
        assert BTC_SIGNET in BTC_NETWORKS
        assert LIGHTNING_MAINNET not in BTC_NETWORKS

    def test_lightning_networks_list(self):
        assert LIGHTNING_MAINNET in LIGHTNING_NETWORKS
        assert LIGHTNING_TESTNET in LIGHTNING_NETWORKS
        assert BTC_MAINNET not in LIGHTNING_NETWORKS

    def test_all_networks(self):
        for net in BTC_NETWORKS:
            assert net in ALL_NETWORKS
        for net in LIGHTNING_NETWORKS:
            assert net in ALL_NETWORKS

    def test_is_valid_btc_network(self):
        assert is_valid_btc_network(BTC_MAINNET) is True
        assert is_valid_btc_network(BTC_TESTNET) is True
        assert is_valid_btc_network(BTC_SIGNET) is True
        assert is_valid_btc_network(LIGHTNING_MAINNET) is False
        assert is_valid_btc_network("eip155:1") is False

    def test_is_valid_lightning_network(self):
        assert is_valid_lightning_network(LIGHTNING_MAINNET) is True
        assert is_valid_lightning_network(LIGHTNING_TESTNET) is True
        assert is_valid_lightning_network(BTC_MAINNET) is False

    def test_is_valid_network(self):
        assert is_valid_network(BTC_MAINNET) is True
        assert is_valid_network(LIGHTNING_MAINNET) is True
        assert is_valid_network("eip155:1") is False

    def test_validate_bitcoin_address(self):
        # Valid mainnet
        assert validate_bitcoin_address("bc1qexample1234567") is True
        assert validate_bitcoin_address("1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2") is True
        assert validate_bitcoin_address("3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy") is True
        # Valid testnet
        assert validate_bitcoin_address("tb1qexample1234567") is True
        assert validate_bitcoin_address("mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn") is True
        assert validate_bitcoin_address("2MzQwSSnBHWHqSAqtTVQ6v47XtaisrJa1Vc") is True
        # Invalid
        assert validate_bitcoin_address("") is False
        assert validate_bitcoin_address("short") is False
        assert validate_bitcoin_address("xyz1invalidprefix") is False

    def test_is_mainnet_address(self):
        assert is_mainnet_address("bc1qtest1234567890") is True
        assert is_mainnet_address("1ABC1234567890abcdef") is True
        assert is_mainnet_address("tb1qtest1234567890") is False

    def test_is_testnet_address(self):
        assert is_testnet_address("tb1qtest1234567890") is True
        assert is_testnet_address("mtest1234567890abcdef") is True
        assert is_testnet_address("bc1qtest1234567890") is False

    def test_validate_bolt11_invoice(self):
        assert validate_bolt11_invoice("lnbc10u1p0" + "x" * 40) is True
        assert validate_bolt11_invoice("lntb10u1p0" + "x" * 40) is True
        assert validate_bolt11_invoice("lnbcrt10u1p" + "x" * 40) is True
        assert validate_bolt11_invoice("") is False
        assert validate_bolt11_invoice("short") is False
        assert validate_bolt11_invoice("invalid" + "x" * 40) is False

    def test_is_valid_hex(self):
        assert is_valid_hex("abcdef0123456789") is True
        assert is_valid_hex("ABCDEF") is True
        assert is_valid_hex("xyz") is False
        assert is_valid_hex("") is False
        # With expected length
        assert is_valid_hex("aa" * 32, 32) is True
        assert is_valid_hex("aa" * 16, 32) is False

    def test_satoshis_to_btc(self):
        assert satoshis_to_btc(100000000) == "1"
        assert satoshis_to_btc(50000000) == "0.5"
        assert satoshis_to_btc(1) == "0.00000001"
        assert satoshis_to_btc(0) == "0"

    def test_btc_to_satoshis(self):
        assert btc_to_satoshis("1") == 100000000
        assert btc_to_satoshis("0.5") == 50000000
        assert btc_to_satoshis("0.00000001") == 1
        assert btc_to_satoshis("0") == 0

    def test_get_supported_networks(self):
        networks = get_supported_networks()
        assert BTC_MAINNET in networks
        assert LIGHTNING_MAINNET in networks
        assert len(networks) == len(ALL_NETWORKS)

    def test_dust_limit(self):
        assert DUST_LIMIT == 546

    def test_sats_per_btc(self):
        assert SATS_PER_BTC == 100_000_000


# =============================================================================
# BTC On-chain Client Tests
# =============================================================================


class TestExactBtcClientScheme:
    """Test the BTC on-chain client scheme implementation."""

    def test_scheme_identifier(self):
        signer = MockBtcClientSigner()
        scheme = ExactBtcClientScheme(signer)
        assert scheme.scheme == "exact"

    def test_caip_family(self):
        signer = MockBtcClientSigner()
        scheme = ExactBtcClientScheme(signer)
        assert scheme.caip_family == "bip122:*"

    def test_signer_address(self):
        signer = MockBtcClientSigner(address="bc1qmyaddr")
        scheme = ExactBtcClientScheme(signer)
        assert scheme.signer_address == "bc1qmyaddr"

    @pytest.mark.asyncio
    async def test_create_payment_payload_success(self):
        signer = MockBtcClientSigner(signed_psbt="my_signed_psbt")
        scheme = ExactBtcClientScheme(signer)

        requirements = make_btc_requirements()
        result = await scheme.create_payment_payload(2, requirements)

        assert result["t402Version"] == 2
        assert result["payload"]["signedPsbt"] == "my_signed_psbt"

    @pytest.mark.asyncio
    async def test_create_payload_missing_pay_to(self):
        signer = MockBtcClientSigner()
        scheme = ExactBtcClientScheme(signer)

        requirements = make_btc_requirements(pay_to="")
        with pytest.raises(ValueError, match="PayTo address is required"):
            await scheme.create_payment_payload(2, requirements)

    @pytest.mark.asyncio
    async def test_create_payload_missing_amount(self):
        signer = MockBtcClientSigner()
        scheme = ExactBtcClientScheme(signer)

        requirements = make_btc_requirements(amount="")
        with pytest.raises(ValueError, match="Amount is required"):
            await scheme.create_payment_payload(2, requirements)

    @pytest.mark.asyncio
    async def test_create_payload_invalid_address(self):
        signer = MockBtcClientSigner()
        scheme = ExactBtcClientScheme(signer)

        requirements = make_btc_requirements(pay_to="invalid_addr")
        with pytest.raises(ValueError, match="Invalid Bitcoin address"):
            await scheme.create_payment_payload(2, requirements)

    @pytest.mark.asyncio
    async def test_create_payload_below_dust_limit(self):
        signer = MockBtcClientSigner()
        scheme = ExactBtcClientScheme(signer)

        requirements = make_btc_requirements(amount="100")
        with pytest.raises(ValueError, match="below dust limit"):
            await scheme.create_payment_payload(2, requirements)

    @pytest.mark.asyncio
    async def test_create_payload_at_dust_limit(self):
        signer = MockBtcClientSigner()
        scheme = ExactBtcClientScheme(signer)

        requirements = make_btc_requirements(amount=str(DUST_LIMIT))
        result = await scheme.create_payment_payload(2, requirements)

        assert result["t402Version"] == 2
        assert "signedPsbt" in result["payload"]

    @pytest.mark.asyncio
    async def test_create_payload_v1_version(self):
        signer = MockBtcClientSigner()
        scheme = ExactBtcClientScheme(signer)

        requirements = make_btc_requirements()
        result = await scheme.create_payment_payload(1, requirements)

        assert result["t402Version"] == 1

    @pytest.mark.asyncio
    async def test_create_payload_testnet_address(self):
        signer = MockBtcClientSigner(address="tb1qtestaddr123456789")
        scheme = ExactBtcClientScheme(signer)

        requirements = make_btc_requirements(
            network=BTC_TESTNET,
            pay_to="tb1qmerchanttest12345678",
        )
        result = await scheme.create_payment_payload(2, requirements)

        assert result["t402Version"] == 2


# =============================================================================
# BTC On-chain Server Tests
# =============================================================================


class TestExactBtcServerScheme:
    """Test the BTC on-chain server scheme implementation."""

    def test_scheme_identifier(self):
        scheme = ExactBtcServerScheme()
        assert scheme.scheme == "exact"

    def test_caip_family(self):
        scheme = ExactBtcServerScheme()
        assert scheme.caip_family == "bip122:*"

    @pytest.mark.asyncio
    async def test_parse_price_float(self):
        scheme = ExactBtcServerScheme()
        result = await scheme.parse_price(0.001, BTC_MAINNET)

        assert result["amount"] == "100000"
        assert result["asset"] == "BTC"
        assert result["extra"]["symbol"] == "BTC"
        assert result["extra"]["decimals"] == 8

    @pytest.mark.asyncio
    async def test_parse_price_string(self):
        scheme = ExactBtcServerScheme()
        result = await scheme.parse_price("0.5", BTC_MAINNET)

        assert result["amount"] == "50000000"

    @pytest.mark.asyncio
    async def test_parse_price_int(self):
        scheme = ExactBtcServerScheme()
        result = await scheme.parse_price(1, BTC_MAINNET)

        assert result["amount"] == "100000000"

    @pytest.mark.asyncio
    async def test_parse_price_zero(self):
        scheme = ExactBtcServerScheme()
        result = await scheme.parse_price("0", BTC_MAINNET)

        assert result["amount"] == "0"

    @pytest.mark.asyncio
    async def test_parse_price_small_amount(self):
        scheme = ExactBtcServerScheme()
        result = await scheme.parse_price("0.00000001", BTC_MAINNET)

        assert result["amount"] == "1"

    @pytest.mark.asyncio
    async def test_parse_price_dict_format(self):
        scheme = ExactBtcServerScheme()
        result = await scheme.parse_price(
            {"amount": "50000", "asset": "BTC"},
            BTC_MAINNET,
        )

        assert result["amount"] == "50000"
        assert result["asset"] == "BTC"

    @pytest.mark.asyncio
    async def test_parse_price_dict_missing_asset(self):
        scheme = ExactBtcServerScheme()
        with pytest.raises(ValueError, match="Asset must be specified"):
            await scheme.parse_price(
                {"amount": "50000"},
                BTC_MAINNET,
            )

    @pytest.mark.asyncio
    async def test_parse_price_invalid_string(self):
        scheme = ExactBtcServerScheme()
        with pytest.raises(ValueError, match="Invalid money format"):
            await scheme.parse_price("not-a-number", BTC_MAINNET)

    @pytest.mark.asyncio
    async def test_enhance_requirements_sets_pay_to(self):
        config = ExactBtcServerConfig(pay_to="bc1qmerchant")
        scheme = ExactBtcServerScheme(config=config)

        requirements = make_btc_requirements(pay_to="")
        supported_kind = {
            "t402Version": 2,
            "scheme": SCHEME_EXACT,
            "network": BTC_MAINNET,
        }

        result = await scheme.enhance_requirements(requirements, supported_kind, [])

        assert result["payTo"] == "bc1qmerchant"

    @pytest.mark.asyncio
    async def test_enhance_requirements_preserves_pay_to(self):
        config = ExactBtcServerConfig(pay_to="bc1qdefault")
        scheme = ExactBtcServerScheme(config=config)

        requirements = make_btc_requirements(pay_to="bc1qcustom123456789")
        supported_kind = {
            "t402Version": 2,
            "scheme": SCHEME_EXACT,
            "network": BTC_MAINNET,
        }

        result = await scheme.enhance_requirements(requirements, supported_kind, [])

        assert result["payTo"] == "bc1qcustom123456789"

    @pytest.mark.asyncio
    async def test_enhance_requirements_sets_asset(self):
        scheme = ExactBtcServerScheme()

        requirements = {
            "scheme": SCHEME_EXACT,
            "network": BTC_MAINNET,
            "asset": "",
            "amount": "100000",
            "payTo": "bc1qmerchant1234567890abcd",
            "maxTimeoutSeconds": 300,
        }
        supported_kind = {
            "t402Version": 2,
            "scheme": SCHEME_EXACT,
            "network": BTC_MAINNET,
        }

        result = await scheme.enhance_requirements(requirements, supported_kind, [])

        assert result["asset"] == "BTC"


# =============================================================================
# BTC On-chain Facilitator Tests
# =============================================================================


class TestExactBtcFacilitatorScheme:
    """Test the BTC on-chain facilitator scheme implementation."""

    def test_scheme_identifier(self):
        signer = MockBtcFacilitatorSigner()
        facilitator = ExactBtcFacilitatorScheme(signer)
        assert facilitator.scheme == "exact"

    def test_caip_family(self):
        signer = MockBtcFacilitatorSigner()
        facilitator = ExactBtcFacilitatorScheme(signer)
        assert facilitator.caip_family == "bip122:*"

    def test_get_signers(self):
        signer = MockBtcFacilitatorSigner(addresses=["bc1qfac1", "bc1qfac2"])
        facilitator = ExactBtcFacilitatorScheme(signer)

        signers = facilitator.get_signers(BTC_MAINNET)
        assert signers == ["bc1qfac1", "bc1qfac2"]

    def test_get_extra(self):
        signer = MockBtcFacilitatorSigner()
        facilitator = ExactBtcFacilitatorScheme(signer)

        extra = facilitator.get_extra(BTC_MAINNET)
        assert extra is None

    @pytest.mark.asyncio
    async def test_verify_success(self):
        signer = MockBtcFacilitatorSigner(
            verify_result={"valid": True, "payer": "bc1qpayer"}
        )
        facilitator = ExactBtcFacilitatorScheme(signer)

        payload = make_btc_payload()
        requirements = make_btc_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True
        assert result.payer == "bc1qpayer"

    @pytest.mark.asyncio
    async def test_verify_invalid_payload(self):
        signer = MockBtcFacilitatorSigner()
        facilitator = ExactBtcFacilitatorScheme(signer)

        payload = {"payload": {"signedPsbt": ""}}
        requirements = make_btc_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "invalid_payload_structure"

    @pytest.mark.asyncio
    async def test_verify_unsupported_network(self):
        signer = MockBtcFacilitatorSigner()
        facilitator = ExactBtcFacilitatorScheme(signer)

        payload = make_btc_payload()
        requirements = make_btc_requirements(network="eip155:1")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "unsupported_network"

    @pytest.mark.asyncio
    async def test_verify_invalid_pay_to(self):
        signer = MockBtcFacilitatorSigner()
        facilitator = ExactBtcFacilitatorScheme(signer)

        payload = make_btc_payload()
        requirements = make_btc_requirements(pay_to="invalid")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "invalid_pay_to_address"

    @pytest.mark.asyncio
    async def test_verify_amount_below_dust(self):
        signer = MockBtcFacilitatorSigner()
        facilitator = ExactBtcFacilitatorScheme(signer)

        payload = make_btc_payload()
        requirements = make_btc_requirements(amount="100")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "amount_below_dust_limit"

    @pytest.mark.asyncio
    async def test_verify_psbt_failed(self):
        signer = MockBtcFacilitatorSigner(
            verify_result={"valid": False, "reason": "bad_signature"}
        )
        facilitator = ExactBtcFacilitatorScheme(signer)

        payload = make_btc_payload()
        requirements = make_btc_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "bad_signature"

    @pytest.mark.asyncio
    async def test_settle_success(self):
        signer = MockBtcFacilitatorSigner(
            verify_result={"valid": True, "payer": "bc1qpayer"},
            tx_id="txid_confirmed",
            confirmed=True,
        )
        facilitator = ExactBtcFacilitatorScheme(signer)

        payload = make_btc_payload()
        requirements = make_btc_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is True
        assert result.transaction == "txid_confirmed"
        assert result.network == BTC_MAINNET

    @pytest.mark.asyncio
    async def test_settle_not_confirmed(self):
        signer = MockBtcFacilitatorSigner(
            verify_result={"valid": True, "payer": "bc1qpayer"},
            confirmed=False,
        )
        facilitator = ExactBtcFacilitatorScheme(signer)

        payload = make_btc_payload()
        requirements = make_btc_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert result.error_reason == "transaction_not_confirmed"

    @pytest.mark.asyncio
    async def test_settle_verification_failed(self):
        signer = MockBtcFacilitatorSigner(
            verify_result={"valid": False, "reason": "psbt_invalid"}
        )
        facilitator = ExactBtcFacilitatorScheme(signer)

        payload = make_btc_payload()
        requirements = make_btc_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False

    @pytest.mark.asyncio
    async def test_settle_invalid_payload(self):
        signer = MockBtcFacilitatorSigner()
        facilitator = ExactBtcFacilitatorScheme(signer)

        payload = {"payload": {"signedPsbt": ""}}
        requirements = make_btc_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert result.error_reason == "invalid_payload_structure"

    def test_facilitator_config_defaults(self):
        config = ExactBtcFacilitatorConfig()
        assert config.confirmations == 1

    def test_facilitator_custom_config(self):
        config = ExactBtcFacilitatorConfig(confirmations=3)
        signer = MockBtcFacilitatorSigner()
        facilitator = ExactBtcFacilitatorScheme(signer, config=config)
        assert facilitator._config.confirmations == 3


# =============================================================================
# Lightning Client Tests
# =============================================================================


class TestLightningClientScheme:
    """Test the Lightning client scheme implementation."""

    def test_scheme_identifier(self):
        signer = MockLightningClientSigner()
        scheme = LightningClientScheme(signer)
        assert scheme.scheme == "exact"

    def test_caip_family(self):
        signer = MockLightningClientSigner()
        scheme = LightningClientScheme(signer)
        assert scheme.caip_family == "lightning:*"

    @pytest.mark.asyncio
    async def test_create_payload_success(self):
        signer = MockLightningClientSigner()
        scheme = LightningClientScheme(signer)

        requirements = make_lightning_requirements()
        result = await scheme.create_payment_payload(2, requirements)

        assert result["t402Version"] == 2
        assert result["payload"]["paymentHash"] == VALID_PAYMENT_HASH
        assert result["payload"]["preimage"] == VALID_PREIMAGE
        assert result["payload"]["bolt11Invoice"] == VALID_BOLT11

    @pytest.mark.asyncio
    async def test_create_payload_missing_invoice(self):
        signer = MockLightningClientSigner()
        scheme = LightningClientScheme(signer)

        requirements = {
            "scheme": SCHEME_EXACT,
            "network": LIGHTNING_MAINNET,
            "amount": "10000",
            "extra": {},
        }
        with pytest.raises(ValueError, match="BOLT11 invoice is required"):
            await scheme.create_payment_payload(2, requirements)

    @pytest.mark.asyncio
    async def test_create_payload_invalid_invoice(self):
        signer = MockLightningClientSigner()
        scheme = LightningClientScheme(signer)

        requirements = make_lightning_requirements(bolt11_invoice="invalid_invoice")
        with pytest.raises(ValueError, match="Invalid BOLT11"):
            await scheme.create_payment_payload(2, requirements)

    @pytest.mark.asyncio
    async def test_create_payload_passes_invoice_to_signer(self):
        signer = MockLightningClientSigner()
        scheme = LightningClientScheme(signer)

        requirements = make_lightning_requirements()
        await scheme.create_payment_payload(2, requirements)

        assert signer.last_bolt11 == VALID_BOLT11


# =============================================================================
# Lightning Server Tests
# =============================================================================


class TestLightningServerScheme:
    """Test the Lightning server scheme implementation."""

    @staticmethod
    async def mock_invoice_gen(
        amount_sats: str, description: str, expiry: int
    ) -> Dict[str, str]:
        return {
            "bolt11_invoice": "lnbc" + "x" * 100,
            "payment_hash": "ab" * 32,
        }

    def test_scheme_identifier(self):
        config = LightningServerConfig(generate_invoice=self.mock_invoice_gen)
        scheme = LightningServerScheme(config)
        assert scheme.scheme == "exact"

    def test_caip_family(self):
        config = LightningServerConfig(generate_invoice=self.mock_invoice_gen)
        scheme = LightningServerScheme(config)
        assert scheme.caip_family == "lightning:*"

    @pytest.mark.asyncio
    async def test_parse_price_float(self):
        config = LightningServerConfig(generate_invoice=self.mock_invoice_gen)
        scheme = LightningServerScheme(config)
        result = await scheme.parse_price(0.001, LIGHTNING_MAINNET)

        assert result["amount"] == "100000"
        assert result["asset"] == "BTC"

    @pytest.mark.asyncio
    async def test_parse_price_dict(self):
        config = LightningServerConfig(generate_invoice=self.mock_invoice_gen)
        scheme = LightningServerScheme(config)
        result = await scheme.parse_price(
            {"amount": "5000", "asset": "BTC"},
            LIGHTNING_MAINNET,
        )

        assert result["amount"] == "5000"
        assert result["asset"] == "BTC"

    @pytest.mark.asyncio
    async def test_enhance_requirements_generates_invoice(self):
        config = LightningServerConfig(generate_invoice=self.mock_invoice_gen)
        scheme = LightningServerScheme(config)

        requirements = {
            "scheme": SCHEME_EXACT,
            "network": LIGHTNING_MAINNET,
            "amount": "10000",
            "maxTimeoutSeconds": 300,
        }
        supported_kind = {
            "t402Version": 2,
            "scheme": SCHEME_EXACT,
            "network": LIGHTNING_MAINNET,
        }

        result = await scheme.enhance_requirements(requirements, supported_kind, [])

        assert "bolt11Invoice" in result["extra"]
        assert "paymentHash" in result["extra"]
        assert result["asset"] == "BTC"


# =============================================================================
# Lightning Facilitator Tests
# =============================================================================


class TestLightningFacilitatorScheme:
    """Test the Lightning facilitator scheme implementation."""

    def test_scheme_identifier(self):
        signer = MockLightningFacilitatorSigner()
        facilitator = LightningFacilitatorScheme(signer)
        assert facilitator.scheme == "exact"

    def test_caip_family(self):
        signer = MockLightningFacilitatorSigner()
        facilitator = LightningFacilitatorScheme(signer)
        assert facilitator.caip_family == "lightning:*"

    def test_get_signers(self):
        signer = MockLightningFacilitatorSigner(addresses=["02abc", "02def"])
        facilitator = LightningFacilitatorScheme(signer)

        signers = facilitator.get_signers(LIGHTNING_MAINNET)
        assert signers == ["02abc", "02def"]

    def test_get_extra(self):
        signer = MockLightningFacilitatorSigner()
        facilitator = LightningFacilitatorScheme(signer)

        extra = facilitator.get_extra(LIGHTNING_MAINNET)
        assert extra is None

    @pytest.mark.asyncio
    async def test_verify_success(self):
        signer = MockLightningFacilitatorSigner(settled=True, amount_sats="10000")
        facilitator = LightningFacilitatorScheme(signer)

        payload = make_lightning_payload()
        requirements = make_lightning_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_invalid_payload_structure(self):
        signer = MockLightningFacilitatorSigner()
        facilitator = LightningFacilitatorScheme(signer)

        payload = {"payload": {"paymentHash": "", "preimage": "", "bolt11Invoice": ""}}
        requirements = make_lightning_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "invalid_payload_structure"

    @pytest.mark.asyncio
    async def test_verify_unsupported_network(self):
        signer = MockLightningFacilitatorSigner()
        facilitator = LightningFacilitatorScheme(signer)

        payload = make_lightning_payload()
        requirements = make_lightning_requirements(network="eip155:1")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "unsupported_network"

    @pytest.mark.asyncio
    async def test_verify_invalid_preimage_format(self):
        signer = MockLightningFacilitatorSigner()
        facilitator = LightningFacilitatorScheme(signer)

        payload = make_lightning_payload(preimage="tooshort")
        requirements = make_lightning_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "invalid_preimage_format"

    @pytest.mark.asyncio
    async def test_verify_invalid_payment_hash_format(self):
        signer = MockLightningFacilitatorSigner()
        facilitator = LightningFacilitatorScheme(signer)

        payload = make_lightning_payload(payment_hash="xyz")
        requirements = make_lightning_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        # Could be preimage or hash format error depending on order
        assert "invalid" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_preimage_hash_mismatch(self):
        signer = MockLightningFacilitatorSigner()
        facilitator = LightningFacilitatorScheme(signer)

        wrong_hash = "bb" * 32  # Does not match SHA-256(VALID_PREIMAGE)
        payload = make_lightning_payload(payment_hash=wrong_hash)
        requirements = make_lightning_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "preimage_hash_mismatch"

    @pytest.mark.asyncio
    async def test_verify_payment_not_settled(self):
        signer = MockLightningFacilitatorSigner(settled=False)
        facilitator = LightningFacilitatorScheme(signer)

        payload = make_lightning_payload()
        requirements = make_lightning_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "payment_not_settled"

    @pytest.mark.asyncio
    async def test_verify_insufficient_amount(self):
        signer = MockLightningFacilitatorSigner(settled=True, amount_sats="5000")
        facilitator = LightningFacilitatorScheme(signer)

        payload = make_lightning_payload()
        requirements = make_lightning_requirements(amount="10000")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "insufficient_amount"

    @pytest.mark.asyncio
    async def test_settle_success(self):
        signer = MockLightningFacilitatorSigner(settled=True, amount_sats="10000")
        facilitator = LightningFacilitatorScheme(signer)

        payload = make_lightning_payload()
        requirements = make_lightning_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is True
        assert result.transaction == VALID_PAYMENT_HASH
        assert result.network == LIGHTNING_MAINNET

    @pytest.mark.asyncio
    async def test_settle_verification_failed(self):
        signer = MockLightningFacilitatorSigner(settled=False)
        facilitator = LightningFacilitatorScheme(signer)

        payload = make_lightning_payload()
        requirements = make_lightning_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False

    @pytest.mark.asyncio
    async def test_settle_invalid_payload(self):
        signer = MockLightningFacilitatorSigner()
        facilitator = LightningFacilitatorScheme(signer)

        payload = {"payload": {"paymentHash": "", "preimage": ""}}
        requirements = make_lightning_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert result.error_reason == "invalid_payload_structure"


# =============================================================================
# Payload Type Tests
# =============================================================================


class TestBtcOnchainPayload:
    """Test BtcOnchainPayload model."""

    def test_from_map(self):
        data = {"signedPsbt": "test_psbt_data", "txId": "tx123"}
        payload = BtcOnchainPayload.from_map(data)

        assert payload.signed_psbt == "test_psbt_data"
        assert payload.tx_id == "tx123"

    def test_to_map(self):
        payload = BtcOnchainPayload(signed_psbt="test_data", tx_id="tx123")
        m = payload.to_map()

        assert m["signedPsbt"] == "test_data"
        assert m["txId"] == "tx123"

    def test_to_map_without_tx_id(self):
        payload = BtcOnchainPayload(signed_psbt="test_data")
        m = payload.to_map()

        assert m["signedPsbt"] == "test_data"
        assert "txId" not in m

    def test_empty_signed_psbt_raises(self):
        with pytest.raises(Exception):
            BtcOnchainPayload(signed_psbt="")


class TestLightningPayload:
    """Test LightningPayload model."""

    def test_from_map(self):
        data = {
            "paymentHash": "ab" * 32,
            "preimage": "cd" * 32,
            "bolt11Invoice": "lnbc10u1test",
        }
        payload = LightningPayload.from_map(data)

        assert payload.payment_hash == "ab" * 32
        assert payload.preimage == "cd" * 32
        assert payload.bolt11_invoice == "lnbc10u1test"

    def test_to_map(self):
        payload = LightningPayload(
            payment_hash="ab" * 32,
            preimage="cd" * 32,
            bolt11_invoice="lnbc10u1test",
        )
        m = payload.to_map()

        assert m["paymentHash"] == "ab" * 32
        assert m["preimage"] == "cd" * 32
        assert m["bolt11Invoice"] == "lnbc10u1test"


# =============================================================================
# End-to-End Tests
# =============================================================================


class TestEndToEndFlow:
    """Test end-to-end payment flows."""

    @pytest.mark.asyncio
    async def test_btc_onchain_flow(self):
        """Test BTC on-chain: server -> client -> facilitator."""
        # 1. Server parses price
        server = ExactBtcServerScheme(
            config=ExactBtcServerConfig(pay_to="bc1qmerchant1234567890abcd")
        )
        asset_amount = await server.parse_price(0.001, BTC_MAINNET)

        assert asset_amount["amount"] == "100000"
        assert asset_amount["asset"] == "BTC"

        # 2. Server enhances requirements
        requirements = {
            "scheme": SCHEME_EXACT,
            "network": BTC_MAINNET,
            "asset": asset_amount["asset"],
            "amount": asset_amount["amount"],
            "payTo": "",
            "maxTimeoutSeconds": 300,
        }
        supported_kind = {
            "t402Version": 2,
            "scheme": SCHEME_EXACT,
            "network": BTC_MAINNET,
        }
        enhanced = await server.enhance_requirements(requirements, supported_kind, [])

        assert enhanced["payTo"] == "bc1qmerchant1234567890abcd"

        # 3. Client creates payment payload
        client_signer = MockBtcClientSigner(signed_psbt="final_signed_psbt")
        client = ExactBtcClientScheme(client_signer)

        payload_result = await client.create_payment_payload(2, enhanced)

        assert payload_result["t402Version"] == 2
        assert payload_result["payload"]["signedPsbt"] == "final_signed_psbt"

        # 4. Facilitator verifies and settles
        fac_signer = MockBtcFacilitatorSigner(
            verify_result={"valid": True, "payer": "bc1qexampleaddress1234567890"},
            tx_id="txid_final",
            confirmed=True,
        )
        facilitator = ExactBtcFacilitatorScheme(fac_signer)

        verify_result = await facilitator.verify(
            {"payload": payload_result["payload"]},
            enhanced,
        )
        assert verify_result.is_valid is True

        settle_result = await facilitator.settle(
            {"payload": payload_result["payload"]},
            enhanced,
        )
        assert settle_result.success is True
        assert settle_result.transaction == "txid_final"

    @pytest.mark.asyncio
    async def test_lightning_flow(self):
        """Test Lightning: server -> client -> facilitator."""
        # 1. Server parses price and generates invoice
        async def gen_invoice(amount_sats, desc, expiry):
            return {
                "bolt11_invoice": VALID_BOLT11,
                "payment_hash": VALID_PAYMENT_HASH,
            }

        server = LightningServerScheme(
            LightningServerConfig(generate_invoice=gen_invoice)
        )
        asset_amount = await server.parse_price(0.0001, LIGHTNING_MAINNET)

        assert asset_amount["amount"] == "10000"

        # 2. Server enhances requirements
        requirements = {
            "scheme": SCHEME_EXACT,
            "network": LIGHTNING_MAINNET,
            "asset": "BTC",
            "amount": "10000",
            "maxTimeoutSeconds": 300,
        }
        supported_kind = {
            "t402Version": 2,
            "scheme": SCHEME_EXACT,
            "network": LIGHTNING_MAINNET,
        }
        enhanced = await server.enhance_requirements(requirements, supported_kind, [])

        assert enhanced["extra"]["bolt11Invoice"] == VALID_BOLT11

        # 3. Client pays invoice
        client_signer = MockLightningClientSigner()
        client = LightningClientScheme(client_signer)

        payload_result = await client.create_payment_payload(2, enhanced)

        assert payload_result["payload"]["preimage"] == VALID_PREIMAGE

        # 4. Facilitator verifies and settles
        fac_signer = MockLightningFacilitatorSigner(settled=True, amount_sats="10000")
        facilitator = LightningFacilitatorScheme(fac_signer)

        verify_result = await facilitator.verify(
            {"payload": payload_result["payload"]},
            enhanced,
        )
        assert verify_result.is_valid is True

        settle_result = await facilitator.settle(
            {"payload": payload_result["payload"]},
            enhanced,
        )
        assert settle_result.success is True
        assert settle_result.transaction == VALID_PAYMENT_HASH


# =============================================================================
# Protocol Compliance Tests
# =============================================================================


class TestProtocolCompliance:
    """Test that implementations satisfy the Protocol interfaces."""

    def test_btc_client_has_required_attrs(self):
        signer = MockBtcClientSigner()
        client = ExactBtcClientScheme(signer)

        assert hasattr(client, "scheme")
        assert hasattr(client, "create_payment_payload")
        assert client.scheme == SCHEME_EXACT

    def test_btc_server_has_required_attrs(self):
        server = ExactBtcServerScheme()

        assert hasattr(server, "scheme")
        assert hasattr(server, "parse_price")
        assert hasattr(server, "enhance_requirements")
        assert server.scheme == SCHEME_EXACT

    def test_btc_facilitator_has_required_attrs(self):
        signer = MockBtcFacilitatorSigner()
        facilitator = ExactBtcFacilitatorScheme(signer)

        assert hasattr(facilitator, "scheme")
        assert hasattr(facilitator, "caip_family")
        assert hasattr(facilitator, "get_extra")
        assert hasattr(facilitator, "get_signers")
        assert hasattr(facilitator, "verify")
        assert hasattr(facilitator, "settle")
        assert facilitator.scheme == SCHEME_EXACT
        assert facilitator.caip_family == BTC_CAIP_FAMILY

    def test_lightning_client_has_required_attrs(self):
        signer = MockLightningClientSigner()
        client = LightningClientScheme(signer)

        assert hasattr(client, "scheme")
        assert hasattr(client, "create_payment_payload")
        assert client.scheme == SCHEME_EXACT

    def test_lightning_facilitator_has_required_attrs(self):
        signer = MockLightningFacilitatorSigner()
        facilitator = LightningFacilitatorScheme(signer)

        assert hasattr(facilitator, "scheme")
        assert hasattr(facilitator, "caip_family")
        assert hasattr(facilitator, "get_extra")
        assert hasattr(facilitator, "get_signers")
        assert hasattr(facilitator, "verify")
        assert hasattr(facilitator, "settle")
        assert facilitator.scheme == SCHEME_EXACT
        assert facilitator.caip_family == LIGHTNING_CAIP_FAMILY

    def test_mock_btc_client_signer_protocol(self):
        signer = MockBtcClientSigner()
        assert isinstance(signer, ClientBtcSigner)

    def test_mock_lightning_client_signer_protocol(self):
        signer = MockLightningClientSigner()
        assert isinstance(signer, ClientLightningSigner)

    def test_mock_btc_facilitator_signer_protocol(self):
        signer = MockBtcFacilitatorSigner()
        assert isinstance(signer, FacilitatorBtcSigner)

    def test_mock_lightning_facilitator_signer_protocol(self):
        signer = MockLightningFacilitatorSigner()
        assert isinstance(signer, FacilitatorLightningSigner)
