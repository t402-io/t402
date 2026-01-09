"""Tests for TRON blockchain support."""

import pytest
from t402.tron import (
    # Constants
    TRON_MAINNET,
    TRON_NILE,
    TRON_SHASTA,
    USDT_MAINNET_ADDRESS,
    USDT_NILE_ADDRESS,
    USDT_SHASTA_ADDRESS,
    DEFAULT_DECIMALS,
    TRON_ADDRESS_LENGTH,
    # Functions
    validate_tron_address,
    addresses_equal,
    is_valid_network,
    normalize_network,
    get_network_config,
    get_default_asset,
    get_asset_info,
    parse_amount,
    format_amount,
    is_valid_hex,
    is_testnet,
    get_usdt_address,
    get_endpoint,
    estimate_transaction_fee,
    # Types
    TronAuthorization,
    TronPaymentPayload,
)


class TestValidateTronAddress:
    """Tests for validate_tron_address function."""

    def test_valid_mainnet_usdt_address(self):
        assert validate_tron_address(USDT_MAINNET_ADDRESS) is True

    def test_valid_nile_usdt_address(self):
        assert validate_tron_address(USDT_NILE_ADDRESS) is True

    def test_valid_shasta_usdt_address(self):
        assert validate_tron_address(USDT_SHASTA_ADDRESS) is True

    def test_valid_random_address(self):
        assert validate_tron_address("TJYPgMHqGBqbjmgcDxBQEL1PPxbRvnLBKY") is True

    def test_invalid_too_short(self):
        assert validate_tron_address("TR7NHqjeKQxGTCi") is False

    def test_invalid_too_long(self):
        assert validate_tron_address("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6tXXXXX") is False

    def test_invalid_empty(self):
        assert validate_tron_address("") is False

    def test_invalid_wrong_prefix(self):
        assert validate_tron_address("0R7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t") is False

    def test_invalid_base58_char_zero(self):
        assert validate_tron_address("T07NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t") is False

    def test_invalid_base58_char_O(self):
        assert validate_tron_address("TOONHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t") is False

    def test_invalid_base58_char_I(self):
        assert validate_tron_address("TI7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t") is False

    def test_invalid_base58_char_l(self):
        assert validate_tron_address("Tl7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t") is False


class TestAddressesEqual:
    """Tests for addresses_equal function."""

    def test_same_address(self):
        assert addresses_equal(USDT_MAINNET_ADDRESS, USDT_MAINNET_ADDRESS) is True

    def test_different_addresses(self):
        assert addresses_equal(USDT_MAINNET_ADDRESS, USDT_NILE_ADDRESS) is False

    def test_empty_first_address(self):
        assert addresses_equal("", USDT_MAINNET_ADDRESS) is False

    def test_empty_second_address(self):
        assert addresses_equal(USDT_MAINNET_ADDRESS, "") is False

    def test_both_empty(self):
        assert addresses_equal("", "") is False


class TestNormalizeNetwork:
    """Tests for normalize_network function."""

    def test_mainnet_caip2(self):
        assert normalize_network(TRON_MAINNET) == TRON_MAINNET

    def test_nile_caip2(self):
        assert normalize_network(TRON_NILE) == TRON_NILE

    def test_shasta_caip2(self):
        assert normalize_network(TRON_SHASTA) == TRON_SHASTA

    def test_shorthand_mainnet(self):
        assert normalize_network("mainnet") == TRON_MAINNET

    def test_shorthand_tron(self):
        assert normalize_network("tron") == TRON_MAINNET

    def test_shorthand_nile(self):
        assert normalize_network("nile") == TRON_NILE

    def test_shorthand_shasta(self):
        assert normalize_network("shasta") == TRON_SHASTA

    def test_unsupported_network(self):
        with pytest.raises(ValueError):
            normalize_network("tron:unsupported")

    def test_empty_network(self):
        with pytest.raises(ValueError):
            normalize_network("")


class TestIsValidNetwork:
    """Tests for is_valid_network function."""

    def test_mainnet_valid(self):
        assert is_valid_network(TRON_MAINNET) is True

    def test_nile_valid(self):
        assert is_valid_network(TRON_NILE) is True

    def test_shasta_valid(self):
        assert is_valid_network(TRON_SHASTA) is True

    def test_unsupported_invalid(self):
        assert is_valid_network("tron:unsupported") is False

    def test_empty_invalid(self):
        assert is_valid_network("") is False


class TestGetNetworkConfig:
    """Tests for get_network_config function."""

    def test_mainnet_config(self):
        config = get_network_config(TRON_MAINNET)
        assert config is not None
        assert config["name"] == "TRON Mainnet"
        assert config["endpoint"] == "https://api.trongrid.io"

    def test_nile_config(self):
        config = get_network_config(TRON_NILE)
        assert config is not None
        assert config["name"] == "TRON Nile Testnet"
        assert config["is_testnet"] is True

    def test_shasta_config(self):
        config = get_network_config(TRON_SHASTA)
        assert config is not None
        assert config["name"] == "TRON Shasta Testnet"
        assert config["is_testnet"] is True

    def test_unsupported_network(self):
        config = get_network_config("tron:unsupported")
        assert config is None


class TestGetAssetInfo:
    """Tests for get_asset_info function."""

    def test_usdt_by_symbol_mainnet(self):
        info = get_asset_info(TRON_MAINNET, "USDT")
        assert info is not None
        assert info["symbol"] == "USDT"
        assert info["contract_address"] == USDT_MAINNET_ADDRESS

    def test_usdt_by_address_mainnet(self):
        info = get_asset_info(TRON_MAINNET, USDT_MAINNET_ADDRESS)
        assert info is not None
        assert info["symbol"] == "USDT"

    def test_usdt_by_symbol_nile(self):
        info = get_asset_info(TRON_NILE, "USDT")
        assert info is not None
        assert info["symbol"] == "USDT"
        assert info["contract_address"] == USDT_NILE_ADDRESS

    def test_unknown_token_by_address(self):
        info = get_asset_info(TRON_MAINNET, "TJYPgMHqGBqbjmgcDxBQEL1PPxbRvnLBKY")
        assert info is not None
        assert info["symbol"] == "UNKNOWN"

    def test_unsupported_network(self):
        info = get_asset_info("tron:unsupported", "USDT")
        assert info is None


class TestParseAmount:
    """Tests for parse_amount function."""

    def test_integer_amount(self):
        assert parse_amount("100", 6) == 100_000_000

    def test_decimal_amount(self):
        assert parse_amount("1.5", 6) == 1_500_000

    def test_small_decimal(self):
        assert parse_amount("0.000001", 6) == 1

    def test_zero_amount(self):
        assert parse_amount("0", 6) == 0

    def test_large_amount(self):
        assert parse_amount("1000000", 6) == 1_000_000_000_000

    def test_extra_decimal_places_truncated(self):
        assert parse_amount("1.1234567", 6) == 1_123_456

    def test_with_whitespace(self):
        assert parse_amount("  100  ", 6) == 100_000_000

    def test_invalid_format(self):
        with pytest.raises(ValueError):
            parse_amount("not-a-number", 6)

    def test_multiple_dots(self):
        with pytest.raises(ValueError):
            parse_amount("1.2.3", 6)


class TestFormatAmount:
    """Tests for format_amount function."""

    def test_integer_result(self):
        assert format_amount(1_000_000, 6) == "1"

    def test_decimal_result(self):
        assert format_amount(1_500_000, 6) == "1.5"

    def test_small_amount(self):
        assert format_amount(1, 6) == "0.000001"

    def test_zero_amount(self):
        assert format_amount(0, 6) == "0"

    def test_large_amount(self):
        assert format_amount(1_000_000_000_000, 6) == "1000000"

    def test_trailing_zeros_removed(self):
        assert format_amount(1_100_000, 6) == "1.1"


class TestIsValidHex:
    """Tests for is_valid_hex function."""

    def test_valid_hex(self):
        assert is_valid_hex("a9059cbb") is True

    def test_valid_hex_with_0x(self):
        assert is_valid_hex("0xa9059cbb") is True

    def test_valid_uppercase_hex(self):
        assert is_valid_hex("A9059CBB") is True

    def test_empty_string(self):
        assert is_valid_hex("") is False

    def test_only_0x_prefix(self):
        assert is_valid_hex("0x") is False

    def test_invalid_characters(self):
        assert is_valid_hex("xyz123") is False


class TestIsTestnet:
    """Tests for is_testnet function."""

    def test_nile_is_testnet(self):
        assert is_testnet(TRON_NILE) is True

    def test_shasta_is_testnet(self):
        assert is_testnet(TRON_SHASTA) is True

    def test_mainnet_is_not_testnet(self):
        assert is_testnet(TRON_MAINNET) is False


class TestGetUsdtAddress:
    """Tests for get_usdt_address function."""

    def test_mainnet_address(self):
        assert get_usdt_address(TRON_MAINNET) == USDT_MAINNET_ADDRESS

    def test_nile_address(self):
        assert get_usdt_address(TRON_NILE) == USDT_NILE_ADDRESS

    def test_shasta_address(self):
        assert get_usdt_address(TRON_SHASTA) == USDT_SHASTA_ADDRESS

    def test_unsupported_network(self):
        with pytest.raises(ValueError):
            get_usdt_address("tron:unsupported")


class TestGetEndpoint:
    """Tests for get_endpoint function."""

    def test_mainnet_endpoint(self):
        assert get_endpoint(TRON_MAINNET) == "https://api.trongrid.io"

    def test_nile_endpoint(self):
        assert get_endpoint(TRON_NILE) == "https://api.nileex.io"

    def test_shasta_endpoint(self):
        assert get_endpoint(TRON_SHASTA) == "https://api.shasta.trongrid.io"

    def test_unsupported_network(self):
        with pytest.raises(ValueError):
            get_endpoint("tron:unsupported")


class TestEstimateTransactionFee:
    """Tests for estimate_transaction_fee function."""

    def test_activated_account(self):
        assert estimate_transaction_fee(True) == 30_000_000

    def test_not_activated_account(self):
        assert estimate_transaction_fee(False) == 31_000_000

    def test_default_is_activated(self):
        assert estimate_transaction_fee() == 30_000_000


class TestTronAuthorization:
    """Tests for TronAuthorization model."""

    def test_create_authorization(self):
        auth = TronAuthorization(
            from_="TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
            to="TJYPgMHqGBqbjmgcDxBQEL1PPxbRvnLBKY",
            contract_address=USDT_MAINNET_ADDRESS,
            amount="1000000",
            expiration=1704067200000,
            ref_block_bytes="abcd",
            ref_block_hash="deadbeef12345678",
            timestamp=1704063600000,
        )
        assert auth.from_ == "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
        assert auth.to == "TJYPgMHqGBqbjmgcDxBQEL1PPxbRvnLBKY"
        assert auth.amount == "1000000"

    def test_create_from_alias(self):
        data = {
            "from": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
            "to": "TJYPgMHqGBqbjmgcDxBQEL1PPxbRvnLBKY",
            "contractAddress": USDT_MAINNET_ADDRESS,
            "amount": "1000000",
            "expiration": 1704067200000,
            "refBlockBytes": "abcd",
            "refBlockHash": "deadbeef12345678",
            "timestamp": 1704063600000,
        }
        auth = TronAuthorization.model_validate(data)
        assert auth.from_ == "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"

    def test_invalid_amount(self):
        with pytest.raises(ValueError):
            TronAuthorization(
                from_="TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
                to="TJYPgMHqGBqbjmgcDxBQEL1PPxbRvnLBKY",
                contract_address=USDT_MAINNET_ADDRESS,
                amount="not-a-number",
                expiration=1704067200000,
                ref_block_bytes="abcd",
                ref_block_hash="deadbeef12345678",
                timestamp=1704063600000,
            )


class TestTronPaymentPayload:
    """Tests for TronPaymentPayload model."""

    def test_create_payload(self):
        auth = TronAuthorization(
            from_="TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
            to="TJYPgMHqGBqbjmgcDxBQEL1PPxbRvnLBKY",
            contract_address=USDT_MAINNET_ADDRESS,
            amount="1000000",
            expiration=1704067200000,
            ref_block_bytes="abcd",
            ref_block_hash="deadbeef12345678",
            timestamp=1704063600000,
        )
        payload = TronPaymentPayload(
            signed_transaction="0a02abcd2208deadbeef12345678",
            authorization=auth,
        )
        assert payload.signed_transaction == "0a02abcd2208deadbeef12345678"
        assert payload.authorization.from_ == "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"

    def test_create_from_alias(self):
        data = {
            "signedTransaction": "0a02abcd2208deadbeef12345678",
            "authorization": {
                "from": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
                "to": "TJYPgMHqGBqbjmgcDxBQEL1PPxbRvnLBKY",
                "contractAddress": USDT_MAINNET_ADDRESS,
                "amount": "1000000",
                "expiration": 1704067200000,
                "refBlockBytes": "abcd",
                "refBlockHash": "deadbeef12345678",
                "timestamp": 1704063600000,
            },
        }
        payload = TronPaymentPayload.model_validate(data)
        assert payload.signed_transaction == "0a02abcd2208deadbeef12345678"

    def test_json_serialization(self):
        auth = TronAuthorization(
            from_="TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
            to="TJYPgMHqGBqbjmgcDxBQEL1PPxbRvnLBKY",
            contract_address=USDT_MAINNET_ADDRESS,
            amount="1000000",
            expiration=1704067200000,
            ref_block_bytes="abcd",
            ref_block_hash="deadbeef12345678",
            timestamp=1704063600000,
        )
        payload = TronPaymentPayload(
            signed_transaction="0a02abcd2208deadbeef12345678",
            authorization=auth,
        )
        json_str = payload.model_dump_json(by_alias=True)
        assert "signedTransaction" in json_str
        assert "contractAddress" in json_str
