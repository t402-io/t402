"""Tests for TON blockchain support."""

import base64
import pytest

from t402.ton import (
    # Constants
    TON_MAINNET,
    TON_TESTNET,
    USDT_MAINNET_ADDRESS,
    USDT_TESTNET_ADDRESS,
    DEFAULT_DECIMALS,
    SCHEME_EXACT,
    JETTON_TRANSFER_OP,
    DEFAULT_JETTON_TRANSFER_TON,
    # Functions
    validate_ton_address,
    addresses_equal,
    is_valid_network,
    get_network_config,
    get_default_asset,
    get_asset_info,
    parse_amount,
    format_amount,
    validate_boc,
    is_testnet,
    prepare_ton_payment_header,
    get_usdt_address,
    get_known_jettons,
)
from t402.ton import TonAuthorization, TonPaymentPayload
from t402.types import TonAuthorization as TypesTonAuthorization
from t402.types import TonPaymentPayload as TypesTonPaymentPayload
from t402.networks import is_ton_network, get_network_type


class TestConstants:
    """Test TON constants."""

    def test_network_identifiers(self):
        assert TON_MAINNET == "ton:mainnet"
        assert TON_TESTNET == "ton:testnet"

    def test_usdt_addresses(self):
        # Mainnet USDT address should be valid
        assert validate_ton_address(USDT_MAINNET_ADDRESS)
        # Testnet USDT address should be valid
        assert validate_ton_address(USDT_TESTNET_ADDRESS)

    def test_default_decimals(self):
        assert DEFAULT_DECIMALS == 6

    def test_jetton_opcodes(self):
        assert JETTON_TRANSFER_OP == 0x0F8A7EA5

    def test_scheme_exact(self):
        assert SCHEME_EXACT == "exact"


class TestAddressValidation:
    """Test TON address validation."""

    def test_valid_friendly_address(self):
        # Standard 48-char friendly addresses
        assert validate_ton_address(USDT_MAINNET_ADDRESS)
        assert validate_ton_address(USDT_TESTNET_ADDRESS)
        # 48-char base64url address
        assert validate_ton_address("EQDxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_xxx")

    def test_valid_raw_address(self):
        # Raw format: workchain:hex_hash (64 hex chars)
        assert validate_ton_address(
            "0:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
        )
        assert validate_ton_address(
            "-1:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
        )

    def test_invalid_addresses(self):
        assert not validate_ton_address("")
        assert not validate_ton_address("invalid")
        assert not validate_ton_address("0x1234567890abcdef")  # EVM-style address
        assert not validate_ton_address("abc")  # Too short


class TestAddressComparison:
    """Test TON address comparison."""

    def test_equal_addresses(self):
        assert addresses_equal(USDT_MAINNET_ADDRESS, USDT_MAINNET_ADDRESS)
        assert addresses_equal(
            USDT_MAINNET_ADDRESS.lower(), USDT_MAINNET_ADDRESS.upper()
        )

    def test_unequal_addresses(self):
        assert not addresses_equal(USDT_MAINNET_ADDRESS, USDT_TESTNET_ADDRESS)


class TestNetworkConfig:
    """Test network configuration."""

    def test_is_valid_network(self):
        assert is_valid_network(TON_MAINNET)
        assert is_valid_network(TON_TESTNET)
        assert not is_valid_network("invalid")
        assert not is_valid_network("base-sepolia")

    def test_get_network_config_mainnet(self):
        config = get_network_config(TON_MAINNET)
        assert config is not None
        assert config["name"] == "TON Mainnet"
        assert config["is_testnet"] is False
        assert "endpoint" in config

    def test_get_network_config_testnet(self):
        config = get_network_config(TON_TESTNET)
        assert config is not None
        assert config["name"] == "TON Testnet"
        assert config["is_testnet"] is True
        assert "testnet" in config["endpoint"]

    def test_get_network_config_invalid(self):
        assert get_network_config("invalid") is None


class TestDefaultAsset:
    """Test default asset retrieval."""

    def test_mainnet_default_asset(self):
        asset = get_default_asset(TON_MAINNET)
        assert asset is not None
        assert asset["symbol"] == "USDT"
        assert asset["decimals"] == 6
        assert asset["master_address"] == USDT_MAINNET_ADDRESS

    def test_testnet_default_asset(self):
        asset = get_default_asset(TON_TESTNET)
        assert asset is not None
        assert asset["symbol"] == "USDT"
        assert asset["decimals"] == 6
        assert asset["master_address"] == USDT_TESTNET_ADDRESS

    def test_invalid_network_default_asset(self):
        assert get_default_asset("invalid") is None


class TestAssetInfo:
    """Test asset information retrieval."""

    def test_get_asset_by_symbol(self):
        asset = get_asset_info(TON_MAINNET, "USDT")
        assert asset is not None
        assert asset["symbol"] == "USDT"
        assert asset["master_address"] == USDT_MAINNET_ADDRESS

    def test_get_asset_by_address(self):
        asset = get_asset_info(TON_MAINNET, USDT_MAINNET_ADDRESS)
        assert asset is not None
        assert asset["symbol"] == "USDT"

    def test_unknown_token_by_address(self):
        # Unknown token address returns default config
        asset = get_asset_info(
            TON_MAINNET,
            "EQDxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_xxx",
        )
        assert asset is not None
        assert asset["symbol"] == "UNKNOWN"


class TestAmountParsing:
    """Test amount parsing and formatting."""

    def test_parse_integer_amount(self):
        assert parse_amount("1", 6) == 1000000
        assert parse_amount("100", 6) == 100000000

    def test_parse_decimal_amount(self):
        assert parse_amount("1.5", 6) == 1500000
        assert parse_amount("0.01", 6) == 10000
        assert parse_amount("0.000001", 6) == 1

    def test_parse_amount_with_different_decimals(self):
        assert parse_amount("1", 9) == 1000000000
        assert parse_amount("1.5", 9) == 1500000000

    def test_parse_amount_truncates_excess_decimals(self):
        # More decimals than supported should truncate
        assert parse_amount("1.1234567890", 6) == 1123456

    def test_format_amount(self):
        assert format_amount(1000000, 6) == "1"
        assert format_amount(1500000, 6) == "1.5"
        assert format_amount(10000, 6) == "0.01"
        assert format_amount(1, 6) == "0.000001"

    def test_format_amount_zero(self):
        assert format_amount(0, 6) == "0"


class TestBocValidation:
    """Test BOC validation."""

    def test_valid_boc(self):
        # Valid base64 string
        valid_boc = base64.b64encode(b"test boc data").decode()
        assert validate_boc(valid_boc)

    def test_invalid_boc(self):
        assert not validate_boc("")
        assert not validate_boc("not-valid-base64!!!")


class TestTestnetCheck:
    """Test testnet detection."""

    def test_is_testnet(self):
        assert is_testnet(TON_TESTNET)
        assert not is_testnet(TON_MAINNET)
        assert not is_testnet("invalid")


class TestPreparePaymentHeader:
    """Test payment header preparation."""

    def test_prepare_payment_header(self):
        header = prepare_ton_payment_header(
            sender_address=USDT_MAINNET_ADDRESS,
            t402_version=1,
            network=TON_MAINNET,
            pay_to="EQDxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_xxx",
            asset=USDT_MAINNET_ADDRESS,
            amount="1000000",
        )

        assert header["t402Version"] == 1
        assert header["scheme"] == SCHEME_EXACT
        assert header["network"] == TON_MAINNET
        assert header["payload"]["signedBoc"] is None
        assert header["payload"]["authorization"]["from"] == USDT_MAINNET_ADDRESS
        assert (
            header["payload"]["authorization"]["to"]
            == "EQDxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_xxx"
        )
        assert header["payload"]["authorization"]["jettonMaster"] == USDT_MAINNET_ADDRESS
        assert header["payload"]["authorization"]["jettonAmount"] == "1000000"
        assert header["payload"]["authorization"]["tonAmount"] == str(
            DEFAULT_JETTON_TRANSFER_TON
        )
        assert "validUntil" in header["payload"]["authorization"]
        assert "queryId" in header["payload"]["authorization"]


class TestGetUsdtAddress:
    """Test USDT address retrieval."""

    def test_mainnet_usdt(self):
        assert get_usdt_address(TON_MAINNET) == USDT_MAINNET_ADDRESS

    def test_testnet_usdt(self):
        assert get_usdt_address(TON_TESTNET) == USDT_TESTNET_ADDRESS

    def test_invalid_network(self):
        with pytest.raises(ValueError):
            get_usdt_address("invalid")


class TestGetKnownJettons:
    """Test known Jettons retrieval."""

    def test_mainnet_jettons(self):
        jettons = get_known_jettons(TON_MAINNET)
        assert len(jettons) > 0
        assert any(j["symbol"] == "USDT" for j in jettons)

    def test_testnet_jettons(self):
        jettons = get_known_jettons(TON_TESTNET)
        assert len(jettons) > 0

    def test_invalid_network_jettons(self):
        jettons = get_known_jettons("invalid")
        assert jettons == []


class TestTonAuthorizationModel:
    """Test TonAuthorization Pydantic model."""

    def test_serde(self):
        original = TonAuthorization(
            from_="EQDxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_xxx",
            to="EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
            jetton_master=USDT_MAINNET_ADDRESS,
            jetton_amount="1000000",
            ton_amount="100000000",
            valid_until=1234567890,
            seqno=1,
            query_id="123456789",
        )

        expected = {
            "from": "EQDxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_xxx",
            "to": "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
            "jettonMaster": USDT_MAINNET_ADDRESS,
            "jettonAmount": "1000000",
            "tonAmount": "100000000",
            "validUntil": 1234567890,
            "seqno": 1,
            "queryId": "123456789",
        }

        assert original.model_dump(by_alias=True) == expected
        assert TonAuthorization(**expected) == original

    def test_amount_validation(self):
        with pytest.raises(ValueError):
            TonAuthorization(
                from_="addr",
                to="addr",
                jetton_master="addr",
                jetton_amount="not_a_number",  # Should fail validation
                ton_amount="100000000",
                valid_until=1234567890,
                seqno=1,
                query_id="123",
            )


class TestTonPaymentPayloadModel:
    """Test TonPaymentPayload Pydantic model."""

    def test_serde(self):
        auth = TonAuthorization(
            from_="EQDxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_xxx",
            to="EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
            jetton_master=USDT_MAINNET_ADDRESS,
            jetton_amount="1000000",
            ton_amount="100000000",
            valid_until=1234567890,
            seqno=1,
            query_id="123456789",
        )

        original = TonPaymentPayload(
            signed_boc="te6ccgEBAQEAAgAAAA==", authorization=auth
        )

        expected = {
            "signedBoc": "te6ccgEBAQEAAgAAAA==",
            "authorization": auth.model_dump(by_alias=True),
        }

        assert original.model_dump(by_alias=True) == expected


class TestNetworkUtilities:
    """Test network utility functions."""

    def test_is_ton_network(self):
        assert is_ton_network(TON_MAINNET)
        assert is_ton_network(TON_TESTNET)
        assert not is_ton_network("base-sepolia")
        assert not is_ton_network("ethereum")

    def test_get_network_type(self):
        assert get_network_type(TON_MAINNET) == "ton"
        assert get_network_type(TON_TESTNET) == "ton"
        assert get_network_type("base-sepolia") == "evm"
        assert get_network_type("unknown-network") == "unknown"


class TestTypesModuleModels:
    """Test TonAuthorization and TonPaymentPayload from types module."""

    def test_types_ton_authorization_serde(self):
        original = TypesTonAuthorization(
            from_="EQDxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_xxx",
            to="EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
            jetton_master=USDT_MAINNET_ADDRESS,
            jetton_amount="1000000",
            ton_amount="100000000",
            valid_until=1234567890,
            seqno=1,
            query_id="123456789",
        )

        expected = {
            "from": "EQDxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_xxx",
            "to": "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
            "jettonMaster": USDT_MAINNET_ADDRESS,
            "jettonAmount": "1000000",
            "tonAmount": "100000000",
            "validUntil": 1234567890,
            "seqno": 1,
            "queryId": "123456789",
        }

        assert original.model_dump(by_alias=True) == expected

    def test_types_ton_payment_payload_serde(self):
        auth = TypesTonAuthorization(
            from_="EQDxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_xxx",
            to="EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
            jetton_master=USDT_MAINNET_ADDRESS,
            jetton_amount="1000000",
            ton_amount="100000000",
            valid_until=1234567890,
            seqno=1,
            query_id="123456789",
        )

        original = TypesTonPaymentPayload(
            signed_boc="te6ccgEBAQEAAgAAAA==", authorization=auth
        )

        expected = {
            "signedBoc": "te6ccgEBAQEAAgAAAA==",
            "authorization": auth.model_dump(by_alias=True),
        }

        assert original.model_dump(by_alias=True) == expected
