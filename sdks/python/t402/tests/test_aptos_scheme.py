"""Tests for Aptos exact-direct payment scheme.

Covers constants, types, client, server, and facilitator implementations.
"""

from __future__ import annotations

import time
import pytest
from typing import Any, Dict, List
from unittest.mock import AsyncMock, MagicMock, patch

from t402.schemes.aptos import (
    # Scheme classes
    ExactDirectAptosClientScheme,
    ExactDirectAptosServerScheme,
    ExactDirectAptosFacilitatorScheme,
    # Types
    ExactDirectPayload,
    ClientAptosSigner,
    FacilitatorAptosSigner,
    # Constants
    SCHEME_EXACT_DIRECT,
    APTOS_MAINNET,
    APTOS_TESTNET,
    APTOS_DEVNET,
    CAIP_FAMILY,
    USDT_MAINNET_METADATA,
    USDC_MAINNET_METADATA,
    FA_TRANSFER_FUNCTION,
    DEFAULT_DECIMALS,
    # Utility functions
    is_valid_address,
    is_valid_tx_hash,
    is_valid_network,
    compare_addresses,
    normalize_address,
    parse_amount,
    format_amount,
    get_network_config,
    get_token_info,
    get_token_by_address,
)
from t402.schemes.aptos.types import extract_transfer_details


# ============================================================
# Test Data
# ============================================================

VALID_TX_HASH = "0x" + "a1b2c3d4" * 8  # 64 hex chars
VALID_ADDRESS = "0x" + "1234abcd" * 8  # 64 hex chars
VALID_PAY_TO = "0x" + "5678ef01" * 8
VALID_SENDER = "0x" + "abcdef12" * 8
SHORT_ADDRESS = "0x1"  # Valid short address (1 hex char)

SAMPLE_REQUIREMENTS = {
    "scheme": SCHEME_EXACT_DIRECT,
    "network": APTOS_MAINNET,
    "asset": USDT_MAINNET_METADATA,
    "amount": "1000000",
    "payTo": VALID_PAY_TO,
}

SAMPLE_TX_RESULT = {
    "hash": VALID_TX_HASH,
    "version": "12345",
    "success": True,
    "vm_status": "Executed successfully",
    "sender": VALID_SENDER,
    "sequence_number": "1",
    "gas_used": "100",
    "timestamp": str(int(time.time() * 1_000_000)),  # Current time in microseconds
    "payload": {
        "type": "entry_function_payload",
        "function": "0x1::primary_fungible_store::transfer",
        "type_arguments": [],
        "arguments": [
            USDT_MAINNET_METADATA,  # metadata address
            VALID_PAY_TO,           # recipient
            "1000000",              # amount
        ],
    },
    "events": [],
}


# ============================================================
# Mock Signers
# ============================================================

class MockClientAptosSigner:
    """Mock client signer for testing."""

    def __init__(
        self,
        address: str = VALID_SENDER,
        tx_hash: str = VALID_TX_HASH,
        should_fail: bool = False,
    ):
        self._address = address
        self._tx_hash = tx_hash
        self._should_fail = should_fail
        self.last_payload = None
        self.last_network = None

    def address(self) -> str:
        return self._address

    async def sign_and_submit(self, payload: Dict[str, Any], network: str) -> str:
        self.last_payload = payload
        self.last_network = network
        if self._should_fail:
            raise RuntimeError("Signing failed")
        return self._tx_hash


class MockFacilitatorAptosSigner:
    """Mock facilitator signer for testing."""

    def __init__(
        self,
        addresses: List[str] = None,
        tx_result: Dict[str, Any] = None,
        should_fail: bool = False,
    ):
        self._addresses = addresses or []
        self._tx_result = tx_result
        self._should_fail = should_fail

    def get_addresses(self, network: str) -> List[str]:
        return self._addresses

    async def get_transaction(self, tx_hash: str, network: str) -> Dict[str, Any]:
        if self._should_fail:
            raise RuntimeError("Transaction query failed")
        if self._tx_result is None:
            raise RuntimeError("Transaction not found")
        return self._tx_result


# ============================================================
# Tests: Constants
# ============================================================

class TestConstants:
    """Tests for Aptos constants."""

    def test_scheme_identifier(self):
        assert SCHEME_EXACT_DIRECT == "exact-direct"

    def test_caip_family(self):
        assert CAIP_FAMILY == "aptos:*"

    def test_mainnet_network(self):
        assert APTOS_MAINNET == "aptos:1"

    def test_testnet_network(self):
        assert APTOS_TESTNET == "aptos:2"

    def test_devnet_network(self):
        assert APTOS_DEVNET == "aptos:149"

    def test_fa_transfer_function(self):
        assert FA_TRANSFER_FUNCTION == "0x1::primary_fungible_store::transfer"

    def test_default_decimals(self):
        assert DEFAULT_DECIMALS == 6

    def test_usdt_metadata_address(self):
        assert USDT_MAINNET_METADATA.startswith("0x")
        assert len(USDT_MAINNET_METADATA) == 66  # 0x + 64 hex chars

    def test_usdc_metadata_address(self):
        assert USDC_MAINNET_METADATA.startswith("0x")
        assert len(USDC_MAINNET_METADATA) == 66


# ============================================================
# Tests: Address Validation
# ============================================================

class TestIsValidAddress:
    """Tests for is_valid_address function."""

    def test_valid_full_address(self):
        assert is_valid_address(VALID_ADDRESS) is True

    def test_valid_short_address(self):
        assert is_valid_address("0x1") is True

    def test_valid_usdt_metadata(self):
        assert is_valid_address(USDT_MAINNET_METADATA) is True

    def test_valid_mixed_case(self):
        assert is_valid_address("0x" + "AbCdEf12" * 8) is True

    def test_invalid_empty(self):
        assert is_valid_address("") is False

    def test_invalid_no_prefix(self):
        assert is_valid_address("1234abcd" * 8) is False

    def test_invalid_too_long(self):
        assert is_valid_address("0x" + "a" * 65) is False

    def test_invalid_no_hex_after_prefix(self):
        assert is_valid_address("0x") is False

    def test_invalid_non_hex_chars(self):
        assert is_valid_address("0xGHIJKL") is False

    def test_invalid_special_chars(self):
        assert is_valid_address("0x123!@#") is False


# ============================================================
# Tests: Transaction Hash Validation
# ============================================================

class TestIsValidTxHash:
    """Tests for is_valid_tx_hash function."""

    def test_valid_hash(self):
        assert is_valid_tx_hash(VALID_TX_HASH) is True

    def test_valid_all_zeros(self):
        assert is_valid_tx_hash("0x" + "0" * 64) is True

    def test_valid_all_f(self):
        assert is_valid_tx_hash("0x" + "f" * 64) is True

    def test_invalid_empty(self):
        assert is_valid_tx_hash("") is False

    def test_invalid_no_prefix(self):
        assert is_valid_tx_hash("a" * 64) is False

    def test_invalid_too_short(self):
        assert is_valid_tx_hash("0x" + "a" * 63) is False

    def test_invalid_too_long(self):
        assert is_valid_tx_hash("0x" + "a" * 65) is False

    def test_invalid_non_hex(self):
        assert is_valid_tx_hash("0x" + "g" * 64) is False


# ============================================================
# Tests: Network Validation
# ============================================================

class TestIsValidNetwork:
    """Tests for is_valid_network function."""

    def test_mainnet_valid(self):
        assert is_valid_network(APTOS_MAINNET) is True

    def test_testnet_valid(self):
        assert is_valid_network(APTOS_TESTNET) is True

    def test_devnet_valid(self):
        assert is_valid_network(APTOS_DEVNET) is True

    def test_unsupported_invalid(self):
        assert is_valid_network("aptos:999") is False

    def test_empty_invalid(self):
        assert is_valid_network("") is False

    def test_wrong_prefix(self):
        assert is_valid_network("eip155:1") is False


# ============================================================
# Tests: Address Comparison
# ============================================================

class TestCompareAddresses:
    """Tests for compare_addresses function."""

    def test_same_address(self):
        assert compare_addresses(VALID_ADDRESS, VALID_ADDRESS) is True

    def test_case_insensitive(self):
        addr_lower = "0x" + "abcdef12" * 8
        addr_upper = "0x" + "ABCDEF12" * 8
        assert compare_addresses(addr_lower, addr_upper) is True

    def test_different_addresses(self):
        assert compare_addresses(VALID_ADDRESS, VALID_PAY_TO) is False

    def test_empty_first(self):
        assert compare_addresses("", VALID_ADDRESS) is False

    def test_empty_second(self):
        assert compare_addresses(VALID_ADDRESS, "") is False

    def test_both_empty(self):
        assert compare_addresses("", "") is False


# ============================================================
# Tests: Normalize Address
# ============================================================

class TestNormalizeAddress:
    """Tests for normalize_address function."""

    def test_lowercase_unchanged(self):
        assert normalize_address("0xabcdef") == "0xabcdef"

    def test_uppercase_to_lower(self):
        assert normalize_address("0xABCDEF") == "0xabcdef"

    def test_mixed_case(self):
        assert normalize_address("0xAbCdEf") == "0xabcdef"

    def test_without_prefix(self):
        assert normalize_address("abcdef") == "0xabcdef"

    def test_empty_string(self):
        assert normalize_address("") == ""


# ============================================================
# Tests: Parse Amount
# ============================================================

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

    def test_extra_decimals_truncated(self):
        assert parse_amount("1.1234567", 6) == 1_123_456

    def test_fewer_decimals_padded(self):
        assert parse_amount("1.1", 6) == 1_100_000

    def test_with_whitespace(self):
        assert parse_amount("  100  ", 6) == 100_000_000

    def test_invalid_format(self):
        with pytest.raises(ValueError):
            parse_amount("not-a-number", 6)

    def test_multiple_dots(self):
        with pytest.raises(ValueError):
            parse_amount("1.2.3", 6)


# ============================================================
# Tests: Format Amount
# ============================================================

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


# ============================================================
# Tests: Network Config
# ============================================================

class TestGetNetworkConfig:
    """Tests for get_network_config function."""

    def test_mainnet_config(self):
        config = get_network_config(APTOS_MAINNET)
        assert config is not None
        assert config.chain_id == 1
        assert "mainnet" in config.rpc_url
        assert config.default_token.symbol == "USDT"

    def test_testnet_config(self):
        config = get_network_config(APTOS_TESTNET)
        assert config is not None
        assert config.chain_id == 2
        assert "testnet" in config.rpc_url

    def test_devnet_config(self):
        config = get_network_config(APTOS_DEVNET)
        assert config is not None
        assert config.chain_id == 149

    def test_unsupported_network(self):
        config = get_network_config("aptos:999")
        assert config is None


# ============================================================
# Tests: Token Info
# ============================================================

class TestGetTokenInfo:
    """Tests for get_token_info function."""

    def test_usdt_mainnet(self):
        token = get_token_info(APTOS_MAINNET, "USDT")
        assert token is not None
        assert token.symbol == "USDT"
        assert token.name == "Tether USD"
        assert token.decimals == 6
        assert token.metadata_address == USDT_MAINNET_METADATA

    def test_usdc_mainnet(self):
        token = get_token_info(APTOS_MAINNET, "USDC")
        assert token is not None
        assert token.symbol == "USDC"
        assert token.decimals == 6

    def test_usdt_testnet(self):
        token = get_token_info(APTOS_TESTNET, "USDT")
        assert token is not None
        assert token.symbol == "USDT"

    def test_unknown_symbol(self):
        token = get_token_info(APTOS_MAINNET, "UNKNOWN")
        assert token is None

    def test_unknown_network(self):
        token = get_token_info("aptos:999", "USDT")
        assert token is None


# ============================================================
# Tests: Get Token By Address
# ============================================================

class TestGetTokenByAddress:
    """Tests for get_token_by_address function."""

    def test_usdt_by_address(self):
        token = get_token_by_address(APTOS_MAINNET, USDT_MAINNET_METADATA)
        assert token is not None
        assert token.symbol == "USDT"

    def test_usdc_by_address(self):
        token = get_token_by_address(APTOS_MAINNET, USDC_MAINNET_METADATA)
        assert token is not None
        assert token.symbol == "USDC"

    def test_unknown_address(self):
        token = get_token_by_address(APTOS_MAINNET, "0x" + "ff" * 32)
        assert token is None

    def test_case_insensitive(self):
        upper = USDT_MAINNET_METADATA.upper().replace("0X", "0x")
        token = get_token_by_address(APTOS_MAINNET, upper)
        assert token is not None
        assert token.symbol == "USDT"


# ============================================================
# Tests: ExactDirectPayload
# ============================================================

class TestExactDirectPayload:
    """Tests for ExactDirectPayload type."""

    def test_create_payload(self):
        payload = ExactDirectPayload(
            tx_hash=VALID_TX_HASH,
            from_address=VALID_SENDER,
            to_address=VALID_PAY_TO,
            amount="1000000",
            metadata_address=USDT_MAINNET_METADATA,
        )
        assert payload.tx_hash == VALID_TX_HASH
        assert payload.from_address == VALID_SENDER
        assert payload.to_address == VALID_PAY_TO
        assert payload.amount == "1000000"
        assert payload.metadata_address == USDT_MAINNET_METADATA

    def test_to_dict(self):
        payload = ExactDirectPayload(
            tx_hash=VALID_TX_HASH,
            from_address=VALID_SENDER,
            to_address=VALID_PAY_TO,
            amount="1000000",
            metadata_address=USDT_MAINNET_METADATA,
        )
        d = payload.to_dict()
        assert d["txHash"] == VALID_TX_HASH
        assert d["from"] == VALID_SENDER
        assert d["to"] == VALID_PAY_TO
        assert d["amount"] == "1000000"
        assert d["metadataAddress"] == USDT_MAINNET_METADATA

    def test_from_dict_camel_case(self):
        data = {
            "txHash": VALID_TX_HASH,
            "from": VALID_SENDER,
            "to": VALID_PAY_TO,
            "amount": "1000000",
            "metadataAddress": USDT_MAINNET_METADATA,
        }
        payload = ExactDirectPayload.from_dict(data)
        assert payload.tx_hash == VALID_TX_HASH
        assert payload.from_address == VALID_SENDER
        assert payload.to_address == VALID_PAY_TO

    def test_from_dict_snake_case(self):
        data = {
            "tx_hash": VALID_TX_HASH,
            "from_address": VALID_SENDER,
            "to_address": VALID_PAY_TO,
            "amount": "1000000",
            "metadata_address": USDT_MAINNET_METADATA,
        }
        payload = ExactDirectPayload.from_dict(data)
        assert payload.tx_hash == VALID_TX_HASH
        assert payload.from_address == VALID_SENDER

    def test_roundtrip(self):
        original = ExactDirectPayload(
            tx_hash=VALID_TX_HASH,
            from_address=VALID_SENDER,
            to_address=VALID_PAY_TO,
            amount="1000000",
            metadata_address=USDT_MAINNET_METADATA,
        )
        restored = ExactDirectPayload.from_dict(original.to_dict())
        assert restored.tx_hash == original.tx_hash
        assert restored.from_address == original.from_address
        assert restored.to_address == original.to_address
        assert restored.amount == original.amount
        assert restored.metadata_address == original.metadata_address


# ============================================================
# Tests: Extract Transfer Details
# ============================================================

class TestExtractTransferDetails:
    """Tests for extract_transfer_details function."""

    def test_valid_transfer(self):
        result = extract_transfer_details(SAMPLE_TX_RESULT)
        assert result is not None
        assert result["from"] == VALID_SENDER
        assert result["to"] == VALID_PAY_TO
        assert result["amount"] == "1000000"
        assert result["metadata_address"] == USDT_MAINNET_METADATA

    def test_failed_transaction(self):
        tx = {**SAMPLE_TX_RESULT, "success": False}
        assert extract_transfer_details(tx) is None

    def test_none_input(self):
        assert extract_transfer_details(None) is None

    def test_empty_dict(self):
        assert extract_transfer_details({}) is None

    def test_wrong_payload_type(self):
        tx = {
            **SAMPLE_TX_RESULT,
            "payload": {
                "type": "script_payload",
                "function": "something",
            },
        }
        assert extract_transfer_details(tx) is None

    def test_wrong_function(self):
        tx = {
            **SAMPLE_TX_RESULT,
            "payload": {
                "type": "entry_function_payload",
                "function": "0x1::coin::transfer",
                "arguments": ["0x1", "0x2", "100"],
            },
        }
        assert extract_transfer_details(tx) is None

    def test_insufficient_arguments(self):
        tx = {
            **SAMPLE_TX_RESULT,
            "payload": {
                "type": "entry_function_payload",
                "function": "0x1::primary_fungible_store::transfer",
                "arguments": [USDT_MAINNET_METADATA, VALID_PAY_TO],
            },
        }
        assert extract_transfer_details(tx) is None

    def test_no_payload(self):
        tx = {**SAMPLE_TX_RESULT}
        del tx["payload"]
        assert extract_transfer_details(tx) is None


# ============================================================
# Tests: Client Scheme
# ============================================================

class TestExactDirectAptosClientScheme:
    """Tests for ExactDirectAptosClientScheme."""

    def test_scheme_property(self):
        signer = MockClientAptosSigner()
        scheme = ExactDirectAptosClientScheme(signer=signer)
        assert scheme.scheme == SCHEME_EXACT_DIRECT

    def test_caip_family_property(self):
        signer = MockClientAptosSigner()
        scheme = ExactDirectAptosClientScheme(signer=signer)
        assert scheme.caip_family == CAIP_FAMILY

    def test_address_property(self):
        signer = MockClientAptosSigner(address=VALID_SENDER)
        scheme = ExactDirectAptosClientScheme(signer=signer)
        assert scheme.address == VALID_SENDER

    @pytest.mark.asyncio
    async def test_create_payment_payload_v2(self):
        signer = MockClientAptosSigner()
        scheme = ExactDirectAptosClientScheme(signer=signer)

        result = await scheme.create_payment_payload(
            t402_version=2,
            requirements=SAMPLE_REQUIREMENTS,
        )

        assert result["t402Version"] == 2
        assert "payload" in result
        assert result["payload"]["txHash"] == VALID_TX_HASH
        assert result["payload"]["from"] == VALID_SENDER
        assert result["payload"]["to"] == VALID_PAY_TO
        assert result["payload"]["amount"] == "1000000"
        assert result["payload"]["metadataAddress"] == USDT_MAINNET_METADATA

    @pytest.mark.asyncio
    async def test_create_payment_payload_v1(self):
        signer = MockClientAptosSigner()
        scheme = ExactDirectAptosClientScheme(signer=signer)

        result = await scheme.create_payment_payload(
            t402_version=1,
            requirements=SAMPLE_REQUIREMENTS,
        )

        assert result["t402Version"] == 1
        assert result["scheme"] == SCHEME_EXACT_DIRECT
        assert result["network"] == APTOS_MAINNET
        assert "payload" in result

    @pytest.mark.asyncio
    async def test_create_payload_builds_correct_tx_payload(self):
        signer = MockClientAptosSigner()
        scheme = ExactDirectAptosClientScheme(signer=signer)

        await scheme.create_payment_payload(
            t402_version=2,
            requirements=SAMPLE_REQUIREMENTS,
        )

        assert signer.last_payload is not None
        assert signer.last_payload["type"] == "entry_function_payload"
        assert signer.last_payload["function"] == FA_TRANSFER_FUNCTION
        assert signer.last_payload["type_arguments"] == []
        assert signer.last_payload["arguments"] == [
            USDT_MAINNET_METADATA,
            VALID_PAY_TO,
            "1000000",
        ]
        assert signer.last_network == APTOS_MAINNET

    @pytest.mark.asyncio
    async def test_invalid_network(self):
        signer = MockClientAptosSigner()
        scheme = ExactDirectAptosClientScheme(signer=signer)

        with pytest.raises(ValueError, match="Invalid network"):
            await scheme.create_payment_payload(
                t402_version=2,
                requirements={**SAMPLE_REQUIREMENTS, "network": "eip155:1"},
            )

    @pytest.mark.asyncio
    async def test_unsupported_network(self):
        signer = MockClientAptosSigner()
        scheme = ExactDirectAptosClientScheme(signer=signer)

        with pytest.raises(ValueError, match="Unsupported network"):
            await scheme.create_payment_payload(
                t402_version=2,
                requirements={**SAMPLE_REQUIREMENTS, "network": "aptos:999"},
            )

    @pytest.mark.asyncio
    async def test_missing_pay_to(self):
        signer = MockClientAptosSigner()
        scheme = ExactDirectAptosClientScheme(signer=signer)

        with pytest.raises(ValueError, match="PayTo address is required"):
            await scheme.create_payment_payload(
                t402_version=2,
                requirements={**SAMPLE_REQUIREMENTS, "payTo": ""},
            )

    @pytest.mark.asyncio
    async def test_invalid_pay_to(self):
        signer = MockClientAptosSigner()
        scheme = ExactDirectAptosClientScheme(signer=signer)

        with pytest.raises(ValueError, match="Invalid payTo address"):
            await scheme.create_payment_payload(
                t402_version=2,
                requirements={**SAMPLE_REQUIREMENTS, "payTo": "invalid"},
            )

    @pytest.mark.asyncio
    async def test_missing_asset(self):
        signer = MockClientAptosSigner()
        scheme = ExactDirectAptosClientScheme(signer=signer)

        with pytest.raises(ValueError, match="Asset.*is required"):
            await scheme.create_payment_payload(
                t402_version=2,
                requirements={**SAMPLE_REQUIREMENTS, "asset": ""},
            )

    @pytest.mark.asyncio
    async def test_invalid_asset(self):
        signer = MockClientAptosSigner()
        scheme = ExactDirectAptosClientScheme(signer=signer)

        with pytest.raises(ValueError, match="Invalid asset address"):
            await scheme.create_payment_payload(
                t402_version=2,
                requirements={**SAMPLE_REQUIREMENTS, "asset": "not_an_address"},
            )

    @pytest.mark.asyncio
    async def test_missing_amount(self):
        signer = MockClientAptosSigner()
        scheme = ExactDirectAptosClientScheme(signer=signer)

        with pytest.raises(ValueError, match="Amount is required"):
            await scheme.create_payment_payload(
                t402_version=2,
                requirements={**SAMPLE_REQUIREMENTS, "amount": ""},
            )

    @pytest.mark.asyncio
    async def test_invalid_amount(self):
        signer = MockClientAptosSigner()
        scheme = ExactDirectAptosClientScheme(signer=signer)

        with pytest.raises(ValueError, match="Invalid amount"):
            await scheme.create_payment_payload(
                t402_version=2,
                requirements={**SAMPLE_REQUIREMENTS, "amount": "abc"},
            )

    @pytest.mark.asyncio
    async def test_zero_amount(self):
        signer = MockClientAptosSigner()
        scheme = ExactDirectAptosClientScheme(signer=signer)

        with pytest.raises(ValueError, match="Amount must be positive"):
            await scheme.create_payment_payload(
                t402_version=2,
                requirements={**SAMPLE_REQUIREMENTS, "amount": "0"},
            )

    @pytest.mark.asyncio
    async def test_negative_amount(self):
        signer = MockClientAptosSigner()
        scheme = ExactDirectAptosClientScheme(signer=signer)

        with pytest.raises(ValueError, match="Amount must be positive"):
            await scheme.create_payment_payload(
                t402_version=2,
                requirements={**SAMPLE_REQUIREMENTS, "amount": "-100"},
            )

    @pytest.mark.asyncio
    async def test_invalid_signer_address(self):
        signer = MockClientAptosSigner(address="invalid_address")
        scheme = ExactDirectAptosClientScheme(signer=signer)

        with pytest.raises(ValueError, match="Invalid signer address"):
            await scheme.create_payment_payload(
                t402_version=2,
                requirements=SAMPLE_REQUIREMENTS,
            )

    @pytest.mark.asyncio
    async def test_signer_failure(self):
        signer = MockClientAptosSigner(should_fail=True)
        scheme = ExactDirectAptosClientScheme(signer=signer)

        with pytest.raises(RuntimeError, match="Signing failed"):
            await scheme.create_payment_payload(
                t402_version=2,
                requirements=SAMPLE_REQUIREMENTS,
            )

    @pytest.mark.asyncio
    async def test_invalid_tx_hash_from_signer(self):
        signer = MockClientAptosSigner(tx_hash="bad_hash")
        scheme = ExactDirectAptosClientScheme(signer=signer)

        with pytest.raises(ValueError, match="invalid transaction hash"):
            await scheme.create_payment_payload(
                t402_version=2,
                requirements=SAMPLE_REQUIREMENTS,
            )

    @pytest.mark.asyncio
    async def test_wrong_scheme(self):
        signer = MockClientAptosSigner()
        scheme = ExactDirectAptosClientScheme(signer=signer)

        with pytest.raises(ValueError, match="Invalid scheme"):
            await scheme.create_payment_payload(
                t402_version=2,
                requirements={**SAMPLE_REQUIREMENTS, "scheme": "upto"},
            )


# ============================================================
# Tests: Server Scheme
# ============================================================

class TestExactDirectAptosServerScheme:
    """Tests for ExactDirectAptosServerScheme."""

    def test_scheme_property(self):
        scheme = ExactDirectAptosServerScheme()
        assert scheme.scheme == SCHEME_EXACT_DIRECT

    def test_caip_family_property(self):
        scheme = ExactDirectAptosServerScheme()
        assert scheme.caip_family == CAIP_FAMILY

    @pytest.mark.asyncio
    async def test_parse_price_string_dollar(self):
        scheme = ExactDirectAptosServerScheme()
        result = await scheme.parse_price("$0.10", APTOS_MAINNET)

        assert result["amount"] == "100000"
        assert result["asset"] == USDT_MAINNET_METADATA
        assert result["extra"]["symbol"] == "USDT"
        assert result["extra"]["decimals"] == 6

    @pytest.mark.asyncio
    async def test_parse_price_string_no_prefix(self):
        scheme = ExactDirectAptosServerScheme()
        result = await scheme.parse_price("1.50", APTOS_MAINNET)

        assert result["amount"] == "1500000"
        assert result["asset"] == USDT_MAINNET_METADATA

    @pytest.mark.asyncio
    async def test_parse_price_float(self):
        scheme = ExactDirectAptosServerScheme()
        result = await scheme.parse_price(0.10, APTOS_MAINNET)

        assert result["amount"] == "100000"

    @pytest.mark.asyncio
    async def test_parse_price_integer(self):
        scheme = ExactDirectAptosServerScheme()
        result = await scheme.parse_price(1, APTOS_MAINNET)

        assert result["amount"] == "1000000"

    @pytest.mark.asyncio
    async def test_parse_price_dict(self):
        scheme = ExactDirectAptosServerScheme()
        result = await scheme.parse_price(
            {"amount": "500000", "asset": USDT_MAINNET_METADATA},
            APTOS_MAINNET,
        )

        assert result["amount"] == "500000"
        assert result["asset"] == USDT_MAINNET_METADATA

    @pytest.mark.asyncio
    async def test_parse_price_dict_default_asset(self):
        scheme = ExactDirectAptosServerScheme()
        result = await scheme.parse_price(
            {"amount": "500000"},
            APTOS_MAINNET,
        )

        assert result["amount"] == "500000"
        assert result["asset"] == USDT_MAINNET_METADATA

    @pytest.mark.asyncio
    async def test_parse_price_unsupported_network(self):
        scheme = ExactDirectAptosServerScheme()

        with pytest.raises(ValueError, match="Unsupported Aptos network"):
            await scheme.parse_price("$1.00", "aptos:999")

    @pytest.mark.asyncio
    async def test_parse_price_invalid_string(self):
        scheme = ExactDirectAptosServerScheme()

        with pytest.raises(ValueError, match="Failed to parse"):
            await scheme.parse_price("not_a_number", APTOS_MAINNET)

    @pytest.mark.asyncio
    async def test_parse_price_preferred_token(self):
        scheme = ExactDirectAptosServerScheme(preferred_token="USDC")
        result = await scheme.parse_price("$1.00", APTOS_MAINNET)

        assert result["asset"] == USDC_MAINNET_METADATA
        assert result["extra"]["symbol"] == "USDC"

    @pytest.mark.asyncio
    async def test_enhance_requirements_basic(self):
        scheme = ExactDirectAptosServerScheme()
        requirements = {
            "network": APTOS_MAINNET,
            "asset": USDT_MAINNET_METADATA,
            "amount": "1000000",
            "payTo": VALID_PAY_TO,
        }

        result = await scheme.enhance_requirements(
            requirements,
            supported_kind={},
            facilitator_extensions=[],
        )

        assert result["extra"]["symbol"] == "USDT"
        assert result["extra"]["name"] == "Tether USD"
        assert result["extra"]["decimals"] == 6

    @pytest.mark.asyncio
    async def test_enhance_requirements_sets_default_asset(self):
        scheme = ExactDirectAptosServerScheme()
        requirements = {
            "network": APTOS_MAINNET,
            "asset": "",
            "amount": "1000000",
            "payTo": VALID_PAY_TO,
        }

        result = await scheme.enhance_requirements(
            requirements,
            supported_kind={},
            facilitator_extensions=[],
        )

        assert result["asset"] == USDT_MAINNET_METADATA

    @pytest.mark.asyncio
    async def test_enhance_requirements_decimal_conversion(self):
        scheme = ExactDirectAptosServerScheme()
        requirements = {
            "network": APTOS_MAINNET,
            "asset": USDT_MAINNET_METADATA,
            "amount": "1.5",
            "payTo": VALID_PAY_TO,
        }

        result = await scheme.enhance_requirements(
            requirements,
            supported_kind={},
            facilitator_extensions=[],
        )

        assert result["amount"] == "1500000"

    @pytest.mark.asyncio
    async def test_enhance_requirements_copies_kind_extra(self):
        scheme = ExactDirectAptosServerScheme()
        requirements = {
            "network": APTOS_MAINNET,
            "asset": USDT_MAINNET_METADATA,
            "amount": "1000000",
            "payTo": VALID_PAY_TO,
        }

        result = await scheme.enhance_requirements(
            requirements,
            supported_kind={"extra": {"assetSymbol": "USDT", "assetDecimals": 6}},
            facilitator_extensions=[],
        )

        assert result["extra"]["assetSymbol"] == "USDT"
        assert result["extra"]["assetDecimals"] == 6

    @pytest.mark.asyncio
    async def test_enhance_requirements_copies_extension_keys(self):
        scheme = ExactDirectAptosServerScheme()
        requirements = {
            "network": APTOS_MAINNET,
            "asset": USDT_MAINNET_METADATA,
            "amount": "1000000",
            "payTo": VALID_PAY_TO,
        }

        result = await scheme.enhance_requirements(
            requirements,
            supported_kind={"extra": {"customField": "value123"}},
            facilitator_extensions=["customField"],
        )

        assert result["extra"]["customField"] == "value123"

    @pytest.mark.asyncio
    async def test_enhance_requirements_unknown_asset(self):
        scheme = ExactDirectAptosServerScheme()
        unknown_asset = "0x" + "ab" * 32
        requirements = {
            "network": APTOS_MAINNET,
            "asset": unknown_asset,
            "amount": "1000000",
            "payTo": VALID_PAY_TO,
        }

        result = await scheme.enhance_requirements(
            requirements,
            supported_kind={},
            facilitator_extensions=[],
        )

        assert result["extra"]["symbol"] == "UNKNOWN"
        assert result["extra"]["decimals"] == 6

    @pytest.mark.asyncio
    async def test_enhance_requirements_unsupported_network(self):
        scheme = ExactDirectAptosServerScheme()
        requirements = {
            "network": "aptos:999",
            "asset": USDT_MAINNET_METADATA,
            "amount": "1000000",
        }

        with pytest.raises(ValueError, match="Unsupported Aptos network"):
            await scheme.enhance_requirements(
                requirements,
                supported_kind={},
                facilitator_extensions=[],
            )


# ============================================================
# Tests: Facilitator Scheme
# ============================================================

class TestExactDirectAptosFacilitatorScheme:
    """Tests for ExactDirectAptosFacilitatorScheme."""

    def test_scheme_property(self):
        signer = MockFacilitatorAptosSigner()
        facilitator = ExactDirectAptosFacilitatorScheme(signer=signer)
        assert facilitator.scheme == SCHEME_EXACT_DIRECT

    def test_caip_family_property(self):
        signer = MockFacilitatorAptosSigner()
        facilitator = ExactDirectAptosFacilitatorScheme(signer=signer)
        assert facilitator.caip_family == CAIP_FAMILY

    def test_get_extra_mainnet(self):
        signer = MockFacilitatorAptosSigner()
        facilitator = ExactDirectAptosFacilitatorScheme(signer=signer)
        extra = facilitator.get_extra(APTOS_MAINNET)

        assert extra is not None
        assert extra["assetSymbol"] == "USDT"
        assert extra["assetDecimals"] == 6

    def test_get_extra_unsupported_network(self):
        signer = MockFacilitatorAptosSigner()
        facilitator = ExactDirectAptosFacilitatorScheme(signer=signer)
        extra = facilitator.get_extra("aptos:999")

        assert extra is None

    def test_get_signers(self):
        addresses = [VALID_ADDRESS]
        signer = MockFacilitatorAptosSigner(addresses=addresses)
        facilitator = ExactDirectAptosFacilitatorScheme(signer=signer)

        assert facilitator.get_signers(APTOS_MAINNET) == addresses

    def test_get_signers_empty(self):
        signer = MockFacilitatorAptosSigner(addresses=[])
        facilitator = ExactDirectAptosFacilitatorScheme(signer=signer)

        assert facilitator.get_signers(APTOS_MAINNET) == []

    @pytest.mark.asyncio
    async def test_verify_success(self):
        signer = MockFacilitatorAptosSigner(tx_result=SAMPLE_TX_RESULT)
        facilitator = ExactDirectAptosFacilitatorScheme(signer=signer)

        payload = {
            "payload": {
                "txHash": VALID_TX_HASH,
                "from": VALID_SENDER,
                "to": VALID_PAY_TO,
                "amount": "1000000",
                "metadataAddress": USDT_MAINNET_METADATA,
            }
        }

        result = await facilitator.verify(payload, SAMPLE_REQUIREMENTS)

        assert result.is_valid is True
        assert result.payer == VALID_SENDER

    @pytest.mark.asyncio
    async def test_verify_invalid_tx_hash(self):
        signer = MockFacilitatorAptosSigner()
        facilitator = ExactDirectAptosFacilitatorScheme(signer=signer)

        payload = {
            "payload": {
                "txHash": "bad_hash",
                "from": VALID_SENDER,
            }
        }

        result = await facilitator.verify(payload, SAMPLE_REQUIREMENTS)

        assert result.is_valid is False
        assert "Invalid transaction hash" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_missing_from(self):
        signer = MockFacilitatorAptosSigner()
        facilitator = ExactDirectAptosFacilitatorScheme(signer=signer)

        payload = {
            "payload": {
                "txHash": VALID_TX_HASH,
                "from": "",
            }
        }

        result = await facilitator.verify(payload, SAMPLE_REQUIREMENTS)

        assert result.is_valid is False
        assert "Missing 'from' address" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_replay_attack(self):
        signer = MockFacilitatorAptosSigner(tx_result=SAMPLE_TX_RESULT)
        facilitator = ExactDirectAptosFacilitatorScheme(signer=signer)

        payload = {
            "payload": {
                "txHash": VALID_TX_HASH,
                "from": VALID_SENDER,
                "to": VALID_PAY_TO,
                "amount": "1000000",
                "metadataAddress": USDT_MAINNET_METADATA,
            }
        }

        # First verification succeeds
        result1 = await facilitator.verify(payload, SAMPLE_REQUIREMENTS)
        assert result1.is_valid is True

        # Second verification fails (replay)
        result2 = await facilitator.verify(payload, SAMPLE_REQUIREMENTS)
        assert result2.is_valid is False
        assert "already been used" in result2.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_transaction_not_found(self):
        signer = MockFacilitatorAptosSigner(should_fail=True)
        facilitator = ExactDirectAptosFacilitatorScheme(signer=signer)

        payload = {
            "payload": {
                "txHash": VALID_TX_HASH,
                "from": VALID_SENDER,
            }
        }

        result = await facilitator.verify(payload, SAMPLE_REQUIREMENTS)

        assert result.is_valid is False
        assert "not found" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_transaction_failed(self):
        failed_tx = {**SAMPLE_TX_RESULT, "success": False, "vm_status": "ABORT"}
        signer = MockFacilitatorAptosSigner(tx_result=failed_tx)
        facilitator = ExactDirectAptosFacilitatorScheme(signer=signer)

        payload = {
            "payload": {
                "txHash": VALID_TX_HASH,
                "from": VALID_SENDER,
            }
        }

        result = await facilitator.verify(payload, SAMPLE_REQUIREMENTS)

        assert result.is_valid is False
        assert "failed" in result.invalid_reason
        assert "ABORT" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_transaction_too_old(self):
        old_timestamp = str(int((time.time() - 7200) * 1_000_000))  # 2 hours ago
        old_tx = {**SAMPLE_TX_RESULT, "timestamp": old_timestamp}
        signer = MockFacilitatorAptosSigner(tx_result=old_tx)
        facilitator = ExactDirectAptosFacilitatorScheme(
            signer=signer,
            max_transaction_age=3600,
        )

        payload = {
            "payload": {
                "txHash": VALID_TX_HASH,
                "from": VALID_SENDER,
            }
        }

        result = await facilitator.verify(payload, SAMPLE_REQUIREMENTS)

        assert result.is_valid is False
        assert "too old" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_transaction_age_disabled(self):
        old_timestamp = str(int((time.time() - 7200) * 1_000_000))  # 2 hours ago
        old_tx = {**SAMPLE_TX_RESULT, "timestamp": old_timestamp}
        signer = MockFacilitatorAptosSigner(tx_result=old_tx)
        facilitator = ExactDirectAptosFacilitatorScheme(
            signer=signer,
            max_transaction_age=0,  # Disabled
        )

        payload = {
            "payload": {
                "txHash": VALID_TX_HASH,
                "from": VALID_SENDER,
                "to": VALID_PAY_TO,
                "amount": "1000000",
                "metadataAddress": USDT_MAINNET_METADATA,
            }
        }

        result = await facilitator.verify(payload, SAMPLE_REQUIREMENTS)
        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_recipient_mismatch(self):
        wrong_recipient_tx = {
            **SAMPLE_TX_RESULT,
            "payload": {
                **SAMPLE_TX_RESULT["payload"],
                "arguments": [
                    USDT_MAINNET_METADATA,
                    "0x" + "ff" * 32,  # Wrong recipient
                    "1000000",
                ],
            },
        }
        signer = MockFacilitatorAptosSigner(tx_result=wrong_recipient_tx)
        facilitator = ExactDirectAptosFacilitatorScheme(signer=signer)

        payload = {
            "payload": {
                "txHash": VALID_TX_HASH,
                "from": VALID_SENDER,
            }
        }

        result = await facilitator.verify(payload, SAMPLE_REQUIREMENTS)

        assert result.is_valid is False
        assert "Recipient mismatch" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_insufficient_amount(self):
        low_amount_tx = {
            **SAMPLE_TX_RESULT,
            "payload": {
                **SAMPLE_TX_RESULT["payload"],
                "arguments": [
                    USDT_MAINNET_METADATA,
                    VALID_PAY_TO,
                    "500000",  # Less than required 1000000
                ],
            },
        }
        signer = MockFacilitatorAptosSigner(tx_result=low_amount_tx)
        facilitator = ExactDirectAptosFacilitatorScheme(signer=signer)

        payload = {
            "payload": {
                "txHash": VALID_TX_HASH,
                "from": VALID_SENDER,
            }
        }

        result = await facilitator.verify(payload, SAMPLE_REQUIREMENTS)

        assert result.is_valid is False
        assert "Insufficient amount" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_excess_amount_accepted(self):
        excess_amount_tx = {
            **SAMPLE_TX_RESULT,
            "payload": {
                **SAMPLE_TX_RESULT["payload"],
                "arguments": [
                    USDT_MAINNET_METADATA,
                    VALID_PAY_TO,
                    "2000000",  # More than required 1000000
                ],
            },
        }
        signer = MockFacilitatorAptosSigner(tx_result=excess_amount_tx)
        facilitator = ExactDirectAptosFacilitatorScheme(signer=signer)

        payload = {
            "payload": {
                "txHash": VALID_TX_HASH,
                "from": VALID_SENDER,
            }
        }

        result = await facilitator.verify(payload, SAMPLE_REQUIREMENTS)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_settle_success(self):
        signer = MockFacilitatorAptosSigner(tx_result=SAMPLE_TX_RESULT)
        facilitator = ExactDirectAptosFacilitatorScheme(signer=signer)

        payload = {
            "payload": {
                "txHash": VALID_TX_HASH,
                "from": VALID_SENDER,
                "to": VALID_PAY_TO,
                "amount": "1000000",
                "metadataAddress": USDT_MAINNET_METADATA,
            }
        }

        result = await facilitator.settle(payload, SAMPLE_REQUIREMENTS)

        assert result.success is True
        assert result.transaction == VALID_TX_HASH
        assert result.network == APTOS_MAINNET
        assert result.payer == VALID_SENDER

    @pytest.mark.asyncio
    async def test_settle_verification_failure(self):
        signer = MockFacilitatorAptosSigner(should_fail=True)
        facilitator = ExactDirectAptosFacilitatorScheme(signer=signer)

        payload = {
            "payload": {
                "txHash": VALID_TX_HASH,
                "from": VALID_SENDER,
            }
        }

        result = await facilitator.settle(payload, SAMPLE_REQUIREMENTS)

        assert result.success is False
        assert result.error_reason is not None

    def test_cleanup_used_txs(self):
        signer = MockFacilitatorAptosSigner()
        facilitator = ExactDirectAptosFacilitatorScheme(
            signer=signer,
            used_tx_cache_duration=1,  # 1 second
        )

        # Mark some transactions
        facilitator._mark_tx_used("0x" + "aa" * 32)
        facilitator._mark_tx_used("0x" + "bb" * 32)

        assert facilitator._is_tx_used("0x" + "aa" * 32) is True

        # Wait for expiry
        import time as t
        t.sleep(1.1)

        # Cleanup
        removed = facilitator.cleanup_used_txs()
        assert removed == 2
        assert facilitator._is_tx_used("0x" + "aa" * 32) is False

    @pytest.mark.asyncio
    async def test_verify_with_nested_payload(self):
        """Test that verify correctly extracts nested payload data."""
        signer = MockFacilitatorAptosSigner(tx_result=SAMPLE_TX_RESULT)
        facilitator = ExactDirectAptosFacilitatorScheme(signer=signer)

        # Payload wrapped in outer dict (as it comes from HTTP parsing)
        payload = {
            "t402Version": 2,
            "payload": {
                "txHash": VALID_TX_HASH,
                "from": VALID_SENDER,
                "to": VALID_PAY_TO,
                "amount": "1000000",
                "metadataAddress": USDT_MAINNET_METADATA,
            }
        }

        result = await facilitator.verify(payload, SAMPLE_REQUIREMENTS)
        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_with_flat_payload(self):
        """Test that verify works with flat payload (no nesting)."""
        signer = MockFacilitatorAptosSigner(tx_result=SAMPLE_TX_RESULT)
        facilitator = ExactDirectAptosFacilitatorScheme(signer=signer)

        # Flat payload without outer wrapper
        payload = {
            "txHash": VALID_TX_HASH,
            "from": VALID_SENDER,
            "to": VALID_PAY_TO,
            "amount": "1000000",
            "metadataAddress": USDT_MAINNET_METADATA,
        }

        result = await facilitator.verify(payload, SAMPLE_REQUIREMENTS)
        assert result.is_valid is True


# ============================================================
# Tests: Protocol Conformance
# ============================================================

class TestProtocolConformance:
    """Tests that schemes conform to the expected protocols."""

    def test_client_has_scheme(self):
        signer = MockClientAptosSigner()
        scheme = ExactDirectAptosClientScheme(signer=signer)
        assert hasattr(scheme, "scheme")
        assert scheme.scheme == SCHEME_EXACT_DIRECT

    def test_client_has_create_payment_payload(self):
        signer = MockClientAptosSigner()
        scheme = ExactDirectAptosClientScheme(signer=signer)
        assert hasattr(scheme, "create_payment_payload")
        assert callable(scheme.create_payment_payload)

    def test_server_has_scheme(self):
        scheme = ExactDirectAptosServerScheme()
        assert hasattr(scheme, "scheme")
        assert scheme.scheme == SCHEME_EXACT_DIRECT

    def test_server_has_parse_price(self):
        scheme = ExactDirectAptosServerScheme()
        assert hasattr(scheme, "parse_price")
        assert callable(scheme.parse_price)

    def test_server_has_enhance_requirements(self):
        scheme = ExactDirectAptosServerScheme()
        assert hasattr(scheme, "enhance_requirements")
        assert callable(scheme.enhance_requirements)

    def test_facilitator_has_scheme(self):
        signer = MockFacilitatorAptosSigner()
        facilitator = ExactDirectAptosFacilitatorScheme(signer=signer)
        assert hasattr(facilitator, "scheme")
        assert facilitator.scheme == SCHEME_EXACT_DIRECT

    def test_facilitator_has_caip_family(self):
        signer = MockFacilitatorAptosSigner()
        facilitator = ExactDirectAptosFacilitatorScheme(signer=signer)
        assert hasattr(facilitator, "caip_family")
        assert facilitator.caip_family == CAIP_FAMILY

    def test_facilitator_has_get_extra(self):
        signer = MockFacilitatorAptosSigner()
        facilitator = ExactDirectAptosFacilitatorScheme(signer=signer)
        assert hasattr(facilitator, "get_extra")
        assert callable(facilitator.get_extra)

    def test_facilitator_has_get_signers(self):
        signer = MockFacilitatorAptosSigner()
        facilitator = ExactDirectAptosFacilitatorScheme(signer=signer)
        assert hasattr(facilitator, "get_signers")
        assert callable(facilitator.get_signers)

    def test_facilitator_has_verify(self):
        signer = MockFacilitatorAptosSigner()
        facilitator = ExactDirectAptosFacilitatorScheme(signer=signer)
        assert hasattr(facilitator, "verify")
        assert callable(facilitator.verify)

    def test_facilitator_has_settle(self):
        signer = MockFacilitatorAptosSigner()
        facilitator = ExactDirectAptosFacilitatorScheme(signer=signer)
        assert hasattr(facilitator, "settle")
        assert callable(facilitator.settle)


# ============================================================
# Tests: Integration (Client + Server + Facilitator)
# ============================================================

class TestIntegration:
    """Integration tests combining client, server, and facilitator."""

    @pytest.mark.asyncio
    async def test_full_payment_flow(self):
        """Test the complete payment flow: server -> client -> facilitator."""
        # 1. Server parses price and enhances requirements
        server = ExactDirectAptosServerScheme()
        asset_amount = await server.parse_price("$1.00", APTOS_MAINNET)

        requirements = {
            "scheme": SCHEME_EXACT_DIRECT,
            "network": APTOS_MAINNET,
            "asset": asset_amount["asset"],
            "amount": asset_amount["amount"],
            "payTo": VALID_PAY_TO,
        }

        enhanced = await server.enhance_requirements(
            requirements,
            supported_kind={"extra": {"assetSymbol": "USDT", "assetDecimals": 6}},
            facilitator_extensions=[],
        )

        # 2. Client creates payment payload
        client_signer = MockClientAptosSigner()
        client = ExactDirectAptosClientScheme(signer=client_signer)

        client_payload = await client.create_payment_payload(
            t402_version=2,
            requirements=enhanced,
        )

        # 3. Facilitator verifies the payment
        tx_result = {
            **SAMPLE_TX_RESULT,
            "sender": VALID_SENDER,
            "payload": {
                "type": "entry_function_payload",
                "function": FA_TRANSFER_FUNCTION,
                "type_arguments": [],
                "arguments": [
                    USDT_MAINNET_METADATA,
                    VALID_PAY_TO,
                    "1000000",
                ],
            },
        }
        facilitator_signer = MockFacilitatorAptosSigner(tx_result=tx_result)
        facilitator = ExactDirectAptosFacilitatorScheme(signer=facilitator_signer)

        verify_result = await facilitator.verify(client_payload, enhanced)
        assert verify_result.is_valid is True
        assert verify_result.payer == VALID_SENDER

    @pytest.mark.asyncio
    async def test_full_settlement_flow(self):
        """Test full settlement: verify then settle."""
        tx_result = {
            **SAMPLE_TX_RESULT,
            "sender": VALID_SENDER,
        }
        signer = MockFacilitatorAptosSigner(tx_result=tx_result)
        facilitator = ExactDirectAptosFacilitatorScheme(signer=signer)

        payload = {
            "payload": {
                "txHash": VALID_TX_HASH,
                "from": VALID_SENDER,
                "to": VALID_PAY_TO,
                "amount": "1000000",
                "metadataAddress": USDT_MAINNET_METADATA,
            }
        }

        # Settlement includes verification
        settle_result = await facilitator.settle(payload, SAMPLE_REQUIREMENTS)
        assert settle_result.success is True
        assert settle_result.transaction == VALID_TX_HASH
        assert settle_result.payer == VALID_SENDER
        assert settle_result.network == APTOS_MAINNET

    @pytest.mark.asyncio
    async def test_server_with_testnet(self):
        """Test server scheme works with testnet."""
        server = ExactDirectAptosServerScheme()
        result = await server.parse_price("$0.50", APTOS_TESTNET)

        assert result["amount"] == "500000"
        # Testnet uses same USDT address as mainnet in the registry
        assert result["asset"] == USDT_MAINNET_METADATA
