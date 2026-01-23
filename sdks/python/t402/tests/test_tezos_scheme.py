"""Tests for Tezos exact-direct payment scheme.

Covers:
- Constants and utility functions
- Asset identifier parsing/creation
- Address and operation hash validation
- Client: payload creation, requirement validation
- Server: price parsing, requirement enhancement
- Facilitator: verification and settlement logic
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from typing import Any, Dict

from t402.schemes.tezos import (
    # Constants
    SCHEME_EXACT_DIRECT,
    TEZOS_MAINNET,
    TEZOS_GHOSTNET,
    USDT_MAINNET_CONTRACT,
    USDT_MAINNET_TOKEN_ID,
    USDT_DECIMALS,
    USDT_MAINNET,
    # Utility functions
    is_tezos_network,
    is_valid_address,
    is_valid_operation_hash,
    create_asset_identifier,
    parse_asset_identifier,
    get_network_config,
    get_token_info,
    get_token_by_contract,
    decimal_to_atomic,
    parse_decimal_to_atomic,
    # Types
    ExactDirectPayload,
    ClientTezosSigner,
    FacilitatorTezosSigner,
    # Scheme classes
    ExactDirectTezosClient,
    ExactDirectTezosServer,
    ExactDirectTezosFacilitator,
)


# --- Test fixtures ---


VALID_TZ1_ADDRESS = "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb"
VALID_TZ2_ADDRESS = "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m"
VALID_TZ3_ADDRESS = "tz3WMqdzXqRWXwyvj5Hp2H7QEepaUuS7vd9K"
VALID_KT1_ADDRESS = "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o"
VALID_OP_HASH = "oo7bHfJyPNVT5C6DY2MoEgttRBEaGAi5BLrBUQv2kvkANNHhxCQ"

MAINNET_USDT_ASSET = f"{TEZOS_MAINNET}/fa2:{USDT_MAINNET_CONTRACT}/0"


def make_mock_signer(address: str = VALID_TZ1_ADDRESS) -> MagicMock:
    """Create a mock ClientTezosSigner."""
    signer = MagicMock()
    signer.address = MagicMock(return_value=address)
    signer.transfer_fa2 = AsyncMock(return_value=VALID_OP_HASH)
    return signer


def make_mock_facilitator_signer(
    operation: Dict[str, Any] = None,
) -> MagicMock:
    """Create a mock FacilitatorTezosSigner."""
    signer = MagicMock()
    if operation is None:
        operation = make_valid_operation()
    signer.get_operation = AsyncMock(return_value=operation)
    return signer


def make_valid_operation(
    from_address: str = VALID_TZ1_ADDRESS,
    to_address: str = VALID_TZ2_ADDRESS,
    amount: str = "1000000",
    contract_address: str = USDT_MAINNET_CONTRACT,
    token_id: int = 0,
    status: str = "applied",
    entrypoint: str = "transfer",
) -> Dict[str, Any]:
    """Create a valid operation result for testing."""
    return {
        "hash": VALID_OP_HASH,
        "status": status,
        "entrypoint": entrypoint,
        "sender": {"address": from_address},
        "target": {"address": contract_address},
        "parameter": [
            {
                "from_": from_address,
                "txs": [
                    {
                        "to_": to_address,
                        "token_id": token_id,
                        "amount": amount,
                    }
                ],
            }
        ],
    }


def make_valid_requirements(
    pay_to: str = VALID_TZ2_ADDRESS,
    amount: str = "1000000",
    network: str = TEZOS_MAINNET,
    asset: str = MAINNET_USDT_ASSET,
) -> Dict[str, Any]:
    """Create valid payment requirements for testing."""
    return {
        "scheme": SCHEME_EXACT_DIRECT,
        "network": network,
        "asset": asset,
        "amount": amount,
        "payTo": pay_to,
        "maxTimeoutSeconds": 300,
    }


def make_valid_payload(
    op_hash: str = VALID_OP_HASH,
    from_address: str = VALID_TZ1_ADDRESS,
    to_address: str = VALID_TZ2_ADDRESS,
    amount: str = "1000000",
    contract_address: str = USDT_MAINNET_CONTRACT,
    token_id: int = 0,
) -> Dict[str, Any]:
    """Create a valid payment payload for testing."""
    return {
        "payload": {
            "opHash": op_hash,
            "from": from_address,
            "to": to_address,
            "amount": amount,
            "contractAddress": contract_address,
            "tokenId": token_id,
        }
    }


# =============================================================================
# Constants Tests
# =============================================================================


class TestConstants:
    """Tests for Tezos constants."""

    def test_scheme_identifier(self):
        assert SCHEME_EXACT_DIRECT == "exact-direct"

    def test_mainnet_identifier(self):
        assert TEZOS_MAINNET == "tezos:NetXdQprcVkpaWU"

    def test_ghostnet_identifier(self):
        assert TEZOS_GHOSTNET == "tezos:NetXnHfVqm9iesp"

    def test_usdt_mainnet_contract(self):
        assert USDT_MAINNET_CONTRACT == "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o"

    def test_usdt_mainnet_token_id(self):
        assert USDT_MAINNET_TOKEN_ID == 0

    def test_usdt_decimals(self):
        assert USDT_DECIMALS == 6

    def test_usdt_mainnet_token_info(self):
        assert USDT_MAINNET.symbol == "USDt"
        assert USDT_MAINNET.name == "Tether USD"
        assert USDT_MAINNET.decimals == 6
        assert USDT_MAINNET.contract_address == USDT_MAINNET_CONTRACT
        assert USDT_MAINNET.token_id == 0


# =============================================================================
# Network Utility Tests
# =============================================================================


class TestIsTezosNetwork:
    """Tests for is_tezos_network function."""

    def test_mainnet(self):
        assert is_tezos_network(TEZOS_MAINNET) is True

    def test_ghostnet(self):
        assert is_tezos_network(TEZOS_GHOSTNET) is True

    def test_arbitrary_tezos(self):
        assert is_tezos_network("tezos:something") is True

    def test_evm_network(self):
        assert is_tezos_network("eip155:1") is False

    def test_empty(self):
        assert is_tezos_network("") is False

    def test_partial(self):
        assert is_tezos_network("tezos") is False


class TestGetNetworkConfig:
    """Tests for get_network_config function."""

    def test_mainnet_config(self):
        config = get_network_config(TEZOS_MAINNET)
        assert config is not None
        assert config.name == "Tezos Mainnet"
        assert config.is_testnet is False
        assert config.default_token is not None
        assert config.default_token.symbol == "USDt"

    def test_ghostnet_config(self):
        config = get_network_config(TEZOS_GHOSTNET)
        assert config is not None
        assert config.name == "Tezos Ghostnet"
        assert config.is_testnet is True
        assert config.default_token is None

    def test_unsupported_network(self):
        config = get_network_config("tezos:unsupported")
        assert config is None


class TestGetTokenInfo:
    """Tests for get_token_info function."""

    def test_usdt_mainnet(self):
        token = get_token_info(TEZOS_MAINNET, "USDt")
        assert token is not None
        assert token.contract_address == USDT_MAINNET_CONTRACT
        assert token.token_id == 0
        assert token.decimals == 6

    def test_unknown_token(self):
        token = get_token_info(TEZOS_MAINNET, "UNKNOWN")
        assert token is None

    def test_ghostnet_no_tokens(self):
        token = get_token_info(TEZOS_GHOSTNET, "USDt")
        assert token is None


class TestGetTokenByContract:
    """Tests for get_token_by_contract function."""

    def test_usdt_by_contract(self):
        token = get_token_by_contract(TEZOS_MAINNET, USDT_MAINNET_CONTRACT, 0)
        assert token is not None
        assert token.symbol == "USDt"

    def test_wrong_token_id(self):
        token = get_token_by_contract(TEZOS_MAINNET, USDT_MAINNET_CONTRACT, 1)
        assert token is None

    def test_wrong_contract(self):
        token = get_token_by_contract(
            TEZOS_MAINNET, "KT1PWx2mnDueood7fEmfbBDKx1D9BAnnXitn", 0
        )
        assert token is None


# =============================================================================
# Address Validation Tests
# =============================================================================


class TestIsValidAddress:
    """Tests for is_valid_address function."""

    def test_valid_tz1(self):
        assert is_valid_address(VALID_TZ1_ADDRESS) is True

    def test_valid_tz2(self):
        assert is_valid_address(VALID_TZ2_ADDRESS) is True

    def test_valid_tz3(self):
        assert is_valid_address(VALID_TZ3_ADDRESS) is True

    def test_valid_kt1(self):
        assert is_valid_address(VALID_KT1_ADDRESS) is True

    def test_empty(self):
        assert is_valid_address("") is False

    def test_too_short(self):
        assert is_valid_address("tz1VSUr8wwNhLAze") is False

    def test_too_long(self):
        assert is_valid_address("tz1VSUr8wwNhLAzempoch5d6hLRiTh8CjcjbXXX") is False

    def test_wrong_prefix(self):
        assert is_valid_address("tz4VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb") is False

    def test_invalid_base58_char_zero(self):
        assert is_valid_address("tz10SUr8wwNhLAzempoch5d6hLRiTh8Cjcjb") is False

    def test_invalid_base58_char_O(self):
        assert is_valid_address("tz1OSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb") is False

    def test_invalid_base58_char_I(self):
        assert is_valid_address("tz1ISUr8wwNhLAzempoch5d6hLRiTh8Cjcjb") is False

    def test_invalid_base58_char_l(self):
        assert is_valid_address("tz1lSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb") is False

    def test_evm_address_invalid(self):
        assert is_valid_address("0xC88f67e776f16DcFBf42e6bDda1B82604448899B") is False


# =============================================================================
# Operation Hash Validation Tests
# =============================================================================


class TestIsValidOperationHash:
    """Tests for is_valid_operation_hash function."""

    def test_valid_hash(self):
        assert is_valid_operation_hash(VALID_OP_HASH) is True

    def test_empty(self):
        assert is_valid_operation_hash("") is False

    def test_wrong_prefix(self):
        assert is_valid_operation_hash(
            "x" + VALID_OP_HASH[1:]
        ) is False

    def test_too_short(self):
        assert is_valid_operation_hash("oo7bHf") is False

    def test_too_long(self):
        assert is_valid_operation_hash(VALID_OP_HASH + "X") is False

    def test_invalid_base58_chars(self):
        # Replace a char with '0' (not in base58)
        invalid = "o" + "0" * 50
        assert is_valid_operation_hash(invalid) is False


# =============================================================================
# Asset Identifier Tests
# =============================================================================


class TestCreateAssetIdentifier:
    """Tests for create_asset_identifier function."""

    def test_mainnet_usdt(self):
        result = create_asset_identifier(TEZOS_MAINNET, USDT_MAINNET_CONTRACT, 0)
        assert result == f"tezos:NetXdQprcVkpaWU/fa2:{USDT_MAINNET_CONTRACT}/0"

    def test_with_nonzero_token_id(self):
        result = create_asset_identifier(TEZOS_MAINNET, USDT_MAINNET_CONTRACT, 5)
        assert result == f"tezos:NetXdQprcVkpaWU/fa2:{USDT_MAINNET_CONTRACT}/5"

    def test_ghostnet(self):
        result = create_asset_identifier(
            TEZOS_GHOSTNET, "KT1PWx2mnDueood7fEmfbBDKx1D9BAnnXitn", 0
        )
        assert result == "tezos:NetXnHfVqm9iesp/fa2:KT1PWx2mnDueood7fEmfbBDKx1D9BAnnXitn/0"


class TestParseAssetIdentifier:
    """Tests for parse_asset_identifier function."""

    def test_caip19_format(self):
        asset = f"tezos:NetXdQprcVkpaWU/fa2:{USDT_MAINNET_CONTRACT}/0"
        result = parse_asset_identifier(asset)
        assert result["contract_address"] == USDT_MAINNET_CONTRACT
        assert result["token_id"] == 0

    def test_caip19_nonzero_token_id(self):
        asset = f"tezos:NetXdQprcVkpaWU/fa2:{USDT_MAINNET_CONTRACT}/5"
        result = parse_asset_identifier(asset)
        assert result["token_id"] == 5

    def test_simple_format_with_token_id(self):
        asset = f"{USDT_MAINNET_CONTRACT}/0"
        result = parse_asset_identifier(asset)
        assert result["contract_address"] == USDT_MAINNET_CONTRACT
        assert result["token_id"] == 0

    def test_simple_format_without_token_id(self):
        result = parse_asset_identifier(USDT_MAINNET_CONTRACT)
        assert result["contract_address"] == USDT_MAINNET_CONTRACT
        assert result["token_id"] == 0

    def test_empty_raises(self):
        with pytest.raises(ValueError, match="empty"):
            parse_asset_identifier("")

    def test_invalid_format_raises(self):
        with pytest.raises(ValueError, match="Unrecognized"):
            parse_asset_identifier("invalid:format")

    def test_invalid_contract_in_caip19(self):
        with pytest.raises(ValueError, match="Invalid contract"):
            parse_asset_identifier("tezos:NetXdQprcVkpaWU/fa2:invalid/0")

    def test_invalid_token_id_in_caip19(self):
        with pytest.raises(ValueError, match="Invalid token ID"):
            parse_asset_identifier(
                f"tezos:NetXdQprcVkpaWU/fa2:{USDT_MAINNET_CONTRACT}/abc"
            )


# =============================================================================
# Decimal Conversion Tests
# =============================================================================


class TestDecimalToAtomic:
    """Tests for decimal_to_atomic function."""

    def test_one_dollar(self):
        assert decimal_to_atomic(1.0, 6) == "1000000"

    def test_fractional(self):
        assert decimal_to_atomic(0.5, 6) == "500000"

    def test_small_amount(self):
        assert decimal_to_atomic(0.000001, 6) == "1"

    def test_zero(self):
        assert decimal_to_atomic(0.0, 6) == "0"

    def test_large_amount(self):
        assert decimal_to_atomic(1000.0, 6) == "1000000000"


class TestParseDecimalToAtomic:
    """Tests for parse_decimal_to_atomic function."""

    def test_integer_string(self):
        assert parse_decimal_to_atomic("1", 6) == "1000000"

    def test_decimal_string(self):
        assert parse_decimal_to_atomic("1.5", 6) == "1500000"

    def test_small_decimal(self):
        assert parse_decimal_to_atomic("0.000001", 6) == "1"

    def test_extra_decimals_truncated(self):
        assert parse_decimal_to_atomic("1.1234567", 6) == "1123456"

    def test_zero(self):
        assert parse_decimal_to_atomic("0", 6) == "0"

    def test_invalid_format(self):
        with pytest.raises(ValueError):
            parse_decimal_to_atomic("1.2.3", 6)


# =============================================================================
# ExactDirectPayload Model Tests
# =============================================================================


class TestExactDirectPayload:
    """Tests for ExactDirectPayload Pydantic model."""

    def test_create_payload(self):
        payload = ExactDirectPayload(
            op_hash=VALID_OP_HASH,
            from_=VALID_TZ1_ADDRESS,
            to=VALID_TZ2_ADDRESS,
            amount="1000000",
            contract_address=USDT_MAINNET_CONTRACT,
            token_id=0,
        )
        assert payload.op_hash == VALID_OP_HASH
        assert payload.from_ == VALID_TZ1_ADDRESS
        assert payload.to == VALID_TZ2_ADDRESS
        assert payload.amount == "1000000"
        assert payload.contract_address == USDT_MAINNET_CONTRACT
        assert payload.token_id == 0

    def test_to_map_uses_aliases(self):
        payload = ExactDirectPayload(
            op_hash=VALID_OP_HASH,
            from_=VALID_TZ1_ADDRESS,
            to=VALID_TZ2_ADDRESS,
            amount="1000000",
            contract_address=USDT_MAINNET_CONTRACT,
            token_id=0,
        )
        result = payload.to_map()
        assert "opHash" in result
        assert "from" in result
        assert "contractAddress" in result
        assert "tokenId" in result

    def test_invalid_op_hash_prefix(self):
        with pytest.raises(ValueError, match="start with"):
            ExactDirectPayload(
                op_hash="x" + VALID_OP_HASH[1:],
                from_=VALID_TZ1_ADDRESS,
                to=VALID_TZ2_ADDRESS,
                amount="1000000",
                contract_address=USDT_MAINNET_CONTRACT,
                token_id=0,
            )

    def test_invalid_op_hash_length(self):
        with pytest.raises(ValueError, match="51 characters"):
            ExactDirectPayload(
                op_hash="oshort",
                from_=VALID_TZ1_ADDRESS,
                to=VALID_TZ2_ADDRESS,
                amount="1000000",
                contract_address=USDT_MAINNET_CONTRACT,
                token_id=0,
            )

    def test_invalid_amount_not_integer(self):
        with pytest.raises(ValueError, match="positive integer"):
            ExactDirectPayload(
                op_hash=VALID_OP_HASH,
                from_=VALID_TZ1_ADDRESS,
                to=VALID_TZ2_ADDRESS,
                amount="not-a-number",
                contract_address=USDT_MAINNET_CONTRACT,
                token_id=0,
            )

    def test_invalid_amount_zero(self):
        with pytest.raises(ValueError, match="positive integer"):
            ExactDirectPayload(
                op_hash=VALID_OP_HASH,
                from_=VALID_TZ1_ADDRESS,
                to=VALID_TZ2_ADDRESS,
                amount="0",
                contract_address=USDT_MAINNET_CONTRACT,
                token_id=0,
            )

    def test_from_alias(self):
        """Test creating from camelCase dict (protocol format)."""
        data = {
            "opHash": VALID_OP_HASH,
            "from": VALID_TZ1_ADDRESS,
            "to": VALID_TZ2_ADDRESS,
            "amount": "1000000",
            "contractAddress": USDT_MAINNET_CONTRACT,
            "tokenId": 0,
        }
        payload = ExactDirectPayload.model_validate(data)
        assert payload.op_hash == VALID_OP_HASH
        assert payload.from_ == VALID_TZ1_ADDRESS


# =============================================================================
# Client Tests
# =============================================================================


class TestExactDirectTezosClient:
    """Tests for ExactDirectTezosClient."""

    def test_scheme_identifier(self):
        signer = make_mock_signer()
        client = ExactDirectTezosClient(signer=signer)
        assert client.scheme == "exact-direct"

    def test_caip_family(self):
        signer = make_mock_signer()
        client = ExactDirectTezosClient(signer=signer)
        assert client.caip_family == "tezos:*"

    def test_address_property(self):
        signer = make_mock_signer(address=VALID_TZ1_ADDRESS)
        client = ExactDirectTezosClient(signer=signer)
        assert client.address == VALID_TZ1_ADDRESS

    @pytest.mark.asyncio
    async def test_create_payload_v2(self):
        signer = make_mock_signer()
        client = ExactDirectTezosClient(signer=signer)

        requirements = make_valid_requirements()
        result = await client.create_payment_payload(
            t402_version=2, requirements=requirements
        )

        assert result["t402Version"] == 2
        assert "payload" in result
        assert result["payload"]["opHash"] == VALID_OP_HASH
        assert result["payload"]["from"] == VALID_TZ1_ADDRESS
        assert result["payload"]["to"] == VALID_TZ2_ADDRESS
        assert result["payload"]["amount"] == "1000000"
        assert result["payload"]["contractAddress"] == USDT_MAINNET_CONTRACT
        assert result["payload"]["tokenId"] == 0

    @pytest.mark.asyncio
    async def test_create_payload_v1(self):
        signer = make_mock_signer()
        client = ExactDirectTezosClient(signer=signer)

        requirements = make_valid_requirements()
        result = await client.create_payment_payload(
            t402_version=1, requirements=requirements
        )

        assert result["t402Version"] == 1
        assert result["scheme"] == "exact-direct"
        assert result["network"] == TEZOS_MAINNET
        assert "payload" in result

    @pytest.mark.asyncio
    async def test_create_payload_calls_signer(self):
        signer = make_mock_signer()
        client = ExactDirectTezosClient(signer=signer)

        requirements = make_valid_requirements()
        await client.create_payment_payload(t402_version=2, requirements=requirements)

        signer.transfer_fa2.assert_called_once_with(
            contract=USDT_MAINNET_CONTRACT,
            token_id=0,
            to=VALID_TZ2_ADDRESS,
            amount=1000000,
            network=TEZOS_MAINNET,
        )

    @pytest.mark.asyncio
    async def test_invalid_network_raises(self):
        signer = make_mock_signer()
        client = ExactDirectTezosClient(signer=signer)

        requirements = make_valid_requirements(network="eip155:1")
        with pytest.raises(ValueError, match="Invalid network"):
            await client.create_payment_payload(
                t402_version=2, requirements=requirements
            )

    @pytest.mark.asyncio
    async def test_invalid_pay_to_raises(self):
        signer = make_mock_signer()
        client = ExactDirectTezosClient(signer=signer)

        requirements = make_valid_requirements(pay_to="invalid_address")
        with pytest.raises(ValueError, match="Invalid payTo"):
            await client.create_payment_payload(
                t402_version=2, requirements=requirements
            )

    @pytest.mark.asyncio
    async def test_missing_pay_to_raises(self):
        signer = make_mock_signer()
        client = ExactDirectTezosClient(signer=signer)

        requirements = make_valid_requirements()
        requirements["payTo"] = ""
        with pytest.raises(ValueError, match="PayTo address is required"):
            await client.create_payment_payload(
                t402_version=2, requirements=requirements
            )

    @pytest.mark.asyncio
    async def test_invalid_amount_raises(self):
        signer = make_mock_signer()
        client = ExactDirectTezosClient(signer=signer)

        requirements = make_valid_requirements(amount="0")
        with pytest.raises(ValueError, match="Invalid amount"):
            await client.create_payment_payload(
                t402_version=2, requirements=requirements
            )

    @pytest.mark.asyncio
    async def test_missing_amount_raises(self):
        signer = make_mock_signer()
        client = ExactDirectTezosClient(signer=signer)

        requirements = make_valid_requirements()
        requirements["amount"] = ""
        with pytest.raises(ValueError, match="Amount is required"):
            await client.create_payment_payload(
                t402_version=2, requirements=requirements
            )

    @pytest.mark.asyncio
    async def test_missing_asset_raises(self):
        signer = make_mock_signer()
        client = ExactDirectTezosClient(signer=signer)

        requirements = make_valid_requirements()
        requirements["asset"] = ""
        with pytest.raises(ValueError, match="Asset is required"):
            await client.create_payment_payload(
                t402_version=2, requirements=requirements
            )

    @pytest.mark.asyncio
    async def test_invalid_asset_raises(self):
        signer = make_mock_signer()
        client = ExactDirectTezosClient(signer=signer)

        requirements = make_valid_requirements()
        requirements["asset"] = "invalid_asset_format"
        with pytest.raises(ValueError, match="Unrecognized"):
            await client.create_payment_payload(
                t402_version=2, requirements=requirements
            )

    @pytest.mark.asyncio
    async def test_wrong_scheme_raises(self):
        signer = make_mock_signer()
        client = ExactDirectTezosClient(signer=signer)

        requirements = make_valid_requirements()
        requirements["scheme"] = "exact"
        with pytest.raises(ValueError, match="Invalid scheme"):
            await client.create_payment_payload(
                t402_version=2, requirements=requirements
            )

    @pytest.mark.asyncio
    async def test_signer_failure_propagates(self):
        signer = make_mock_signer()
        signer.transfer_fa2 = AsyncMock(side_effect=Exception("RPC error"))
        client = ExactDirectTezosClient(signer=signer)

        requirements = make_valid_requirements()
        with pytest.raises(Exception, match="RPC error"):
            await client.create_payment_payload(
                t402_version=2, requirements=requirements
            )


# =============================================================================
# Server Tests
# =============================================================================


class TestExactDirectTezosServer:
    """Tests for ExactDirectTezosServer."""

    def test_scheme_identifier(self):
        server = ExactDirectTezosServer()
        assert server.scheme == "exact-direct"

    def test_caip_family(self):
        server = ExactDirectTezosServer()
        assert server.caip_family == "tezos:*"

    @pytest.mark.asyncio
    async def test_parse_price_dollar_string(self):
        server = ExactDirectTezosServer()
        result = await server.parse_price("$1.50", TEZOS_MAINNET)
        assert result["amount"] == "1500000"
        assert "fa2:" in result["asset"]
        assert result["extra"]["symbol"] == "USDt"
        assert result["extra"]["decimals"] == 6

    @pytest.mark.asyncio
    async def test_parse_price_plain_string(self):
        server = ExactDirectTezosServer()
        result = await server.parse_price("0.10", TEZOS_MAINNET)
        assert result["amount"] == "100000"

    @pytest.mark.asyncio
    async def test_parse_price_float(self):
        server = ExactDirectTezosServer()
        result = await server.parse_price(0.5, TEZOS_MAINNET)
        assert result["amount"] == "500000"

    @pytest.mark.asyncio
    async def test_parse_price_integer(self):
        server = ExactDirectTezosServer()
        result = await server.parse_price(2, TEZOS_MAINNET)
        assert result["amount"] == "2000000"

    @pytest.mark.asyncio
    async def test_parse_price_dict_passthrough(self):
        server = ExactDirectTezosServer()
        price = {"amount": "500000", "asset": MAINNET_USDT_ASSET, "extra": {"foo": "bar"}}
        result = await server.parse_price(price, TEZOS_MAINNET)
        assert result["amount"] == "500000"
        assert result["asset"] == MAINNET_USDT_ASSET
        assert result["extra"]["foo"] == "bar"

    @pytest.mark.asyncio
    async def test_parse_price_dict_no_asset_raises(self):
        server = ExactDirectTezosServer()
        price = {"amount": "500000"}
        with pytest.raises(ValueError, match="Asset must be specified"):
            await server.parse_price(price, TEZOS_MAINNET)

    @pytest.mark.asyncio
    async def test_parse_price_invalid_network(self):
        server = ExactDirectTezosServer()
        with pytest.raises(ValueError, match="Invalid Tezos network"):
            await server.parse_price("$1.00", "eip155:1")

    @pytest.mark.asyncio
    async def test_parse_price_no_token_on_network(self):
        server = ExactDirectTezosServer()
        with pytest.raises(ValueError, match="No token configured"):
            await server.parse_price("$1.00", TEZOS_GHOSTNET)

    @pytest.mark.asyncio
    async def test_parse_price_with_suffix(self):
        server = ExactDirectTezosServer()
        result = await server.parse_price("1.00 USDt", TEZOS_MAINNET)
        assert result["amount"] == "1000000"

    @pytest.mark.asyncio
    async def test_parse_price_invalid_string(self):
        server = ExactDirectTezosServer()
        with pytest.raises(ValueError, match="Failed to parse"):
            await server.parse_price("not-a-number", TEZOS_MAINNET)

    @pytest.mark.asyncio
    async def test_parse_price_preferred_token(self):
        server = ExactDirectTezosServer(preferred_token="USDt")
        result = await server.parse_price("$1.00", TEZOS_MAINNET)
        assert result["extra"]["symbol"] == "USDt"

    @pytest.mark.asyncio
    async def test_enhance_requirements_adds_metadata(self):
        server = ExactDirectTezosServer()
        requirements = make_valid_requirements()
        result = await server.enhance_requirements(requirements, {}, [])

        assert result["extra"]["assetSymbol"] == "USDt"
        assert result["extra"]["assetDecimals"] == 6
        assert result["extra"]["assetName"] == "Tether USD"
        assert result["extra"]["networkName"] == "Tezos Mainnet"

    @pytest.mark.asyncio
    async def test_enhance_requirements_sets_asset_if_missing(self):
        server = ExactDirectTezosServer()
        requirements = make_valid_requirements()
        requirements["asset"] = ""
        result = await server.enhance_requirements(requirements, {}, [])
        assert "fa2:" in result["asset"]
        assert USDT_MAINNET_CONTRACT in result["asset"]

    @pytest.mark.asyncio
    async def test_enhance_requirements_converts_decimal_amount(self):
        server = ExactDirectTezosServer()
        requirements = make_valid_requirements(amount="1.5")
        # Override validator by using a raw dict
        result = await server.enhance_requirements(requirements, {}, [])
        assert result["amount"] == "1500000"

    @pytest.mark.asyncio
    async def test_enhance_requirements_copies_supported_kind_extra(self):
        server = ExactDirectTezosServer()
        requirements = make_valid_requirements()
        supported_kind = {"extra": {"customField": "value123"}}
        result = await server.enhance_requirements(requirements, supported_kind, [])
        assert result["extra"]["customField"] == "value123"

    @pytest.mark.asyncio
    async def test_enhance_requirements_does_not_overwrite_existing_extra(self):
        server = ExactDirectTezosServer()
        requirements = make_valid_requirements()
        requirements["extra"] = {"assetSymbol": "CUSTOM"}
        result = await server.enhance_requirements(requirements, {}, [])
        assert result["extra"]["assetSymbol"] == "CUSTOM"

    @pytest.mark.asyncio
    async def test_enhance_requirements_invalid_network(self):
        server = ExactDirectTezosServer()
        requirements = make_valid_requirements(network="eip155:1")
        with pytest.raises(ValueError, match="Invalid Tezos network"):
            await server.enhance_requirements(requirements, {}, [])

    @pytest.mark.asyncio
    async def test_enhance_requirements_unsupported_network(self):
        server = ExactDirectTezosServer()
        requirements = make_valid_requirements(network="tezos:unknown")
        with pytest.raises(ValueError, match="Unsupported Tezos network"):
            await server.enhance_requirements(requirements, {}, [])


# =============================================================================
# Facilitator Tests
# =============================================================================


class TestExactDirectTezosFacilitator:
    """Tests for ExactDirectTezosFacilitator."""

    def test_scheme_identifier(self):
        signer = make_mock_facilitator_signer()
        facilitator = ExactDirectTezosFacilitator(signer=signer)
        assert facilitator.scheme == "exact-direct"

    def test_caip_family(self):
        signer = make_mock_facilitator_signer()
        facilitator = ExactDirectTezosFacilitator(signer=signer)
        assert facilitator.caip_family == "tezos:*"

    def test_get_extra_returns_none(self):
        signer = make_mock_facilitator_signer()
        facilitator = ExactDirectTezosFacilitator(signer=signer)
        assert facilitator.get_extra(TEZOS_MAINNET) is None

    def test_get_signers_with_address(self):
        signer = make_mock_facilitator_signer()
        facilitator = ExactDirectTezosFacilitator(
            signer=signer,
            addresses={TEZOS_MAINNET: VALID_TZ1_ADDRESS},
        )
        signers = facilitator.get_signers(TEZOS_MAINNET)
        assert signers == [VALID_TZ1_ADDRESS]

    def test_get_signers_no_address(self):
        signer = make_mock_facilitator_signer()
        facilitator = ExactDirectTezosFacilitator(signer=signer)
        signers = facilitator.get_signers(TEZOS_MAINNET)
        assert signers == []

    def test_get_signers_wrong_network(self):
        signer = make_mock_facilitator_signer()
        facilitator = ExactDirectTezosFacilitator(
            signer=signer,
            addresses={TEZOS_MAINNET: VALID_TZ1_ADDRESS},
        )
        signers = facilitator.get_signers(TEZOS_GHOSTNET)
        assert signers == []

    # --- Verify tests ---

    @pytest.mark.asyncio
    async def test_verify_success(self):
        operation = make_valid_operation()
        signer = make_mock_facilitator_signer(operation)
        facilitator = ExactDirectTezosFacilitator(signer=signer)

        payload = make_valid_payload()
        requirements = make_valid_requirements()

        result = await facilitator.verify(payload, requirements)
        assert result.is_valid is True
        assert result.payer == VALID_TZ1_ADDRESS
        assert result.invalid_reason is None

    @pytest.mark.asyncio
    async def test_verify_invalid_op_hash(self):
        signer = make_mock_facilitator_signer()
        facilitator = ExactDirectTezosFacilitator(signer=signer)

        payload = make_valid_payload(op_hash="invalid_hash")
        requirements = make_valid_requirements()

        result = await facilitator.verify(payload, requirements)
        assert result.is_valid is False
        assert "Invalid operation hash" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_invalid_sender_address(self):
        signer = make_mock_facilitator_signer()
        facilitator = ExactDirectTezosFacilitator(signer=signer)

        payload = make_valid_payload(from_address="invalid")
        requirements = make_valid_requirements()

        result = await facilitator.verify(payload, requirements)
        assert result.is_valid is False
        assert "Invalid sender address" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_operation_not_found(self):
        signer = make_mock_facilitator_signer()
        signer.get_operation = AsyncMock(return_value=None)
        facilitator = ExactDirectTezosFacilitator(signer=signer)

        payload = make_valid_payload()
        requirements = make_valid_requirements()

        result = await facilitator.verify(payload, requirements)
        assert result.is_valid is False
        assert "not found" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_operation_query_fails(self):
        signer = make_mock_facilitator_signer()
        signer.get_operation = AsyncMock(side_effect=Exception("Network error"))
        facilitator = ExactDirectTezosFacilitator(signer=signer)

        payload = make_valid_payload()
        requirements = make_valid_requirements()

        result = await facilitator.verify(payload, requirements)
        assert result.is_valid is False
        assert "Failed to query" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_operation_failed_status(self):
        operation = make_valid_operation(status="failed")
        signer = make_mock_facilitator_signer(operation)
        facilitator = ExactDirectTezosFacilitator(signer=signer)

        payload = make_valid_payload()
        requirements = make_valid_requirements()

        result = await facilitator.verify(payload, requirements)
        assert result.is_valid is False
        assert "status is 'failed'" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_operation_backtracked_status(self):
        operation = make_valid_operation(status="backtracked")
        signer = make_mock_facilitator_signer(operation)
        facilitator = ExactDirectTezosFacilitator(signer=signer)

        payload = make_valid_payload()
        requirements = make_valid_requirements()

        result = await facilitator.verify(payload, requirements)
        assert result.is_valid is False
        assert "backtracked" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_wrong_entrypoint(self):
        operation = make_valid_operation(entrypoint="approve")
        signer = make_mock_facilitator_signer(operation)
        facilitator = ExactDirectTezosFacilitator(signer=signer)

        payload = make_valid_payload()
        requirements = make_valid_requirements()

        result = await facilitator.verify(payload, requirements)
        assert result.is_valid is False
        assert "entrypoint" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_wrong_contract(self):
        operation = make_valid_operation(
            contract_address="KT1PWx2mnDueood7fEmfbBDKx1D9BAnnXitn"
        )
        signer = make_mock_facilitator_signer(operation)
        facilitator = ExactDirectTezosFacilitator(signer=signer)

        payload = make_valid_payload()
        requirements = make_valid_requirements()

        result = await facilitator.verify(payload, requirements)
        assert result.is_valid is False
        assert "target contract" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_wrong_sender(self):
        operation = make_valid_operation(from_address=VALID_TZ3_ADDRESS)
        signer = make_mock_facilitator_signer(operation)
        facilitator = ExactDirectTezosFacilitator(signer=signer)

        payload = make_valid_payload()
        requirements = make_valid_requirements()

        result = await facilitator.verify(payload, requirements)
        assert result.is_valid is False
        assert "sender" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_wrong_recipient(self):
        operation = make_valid_operation(to_address=VALID_TZ3_ADDRESS)
        signer = make_mock_facilitator_signer(operation)
        facilitator = ExactDirectTezosFacilitator(signer=signer)

        payload = make_valid_payload()
        requirements = make_valid_requirements()

        result = await facilitator.verify(payload, requirements)
        assert result.is_valid is False
        assert "recipient" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_insufficient_amount(self):
        operation = make_valid_operation(amount="500000")
        signer = make_mock_facilitator_signer(operation)
        facilitator = ExactDirectTezosFacilitator(signer=signer)

        payload = make_valid_payload()
        requirements = make_valid_requirements(amount="1000000")

        result = await facilitator.verify(payload, requirements)
        assert result.is_valid is False
        assert "less than" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_exact_amount_passes(self):
        operation = make_valid_operation(amount="1000000")
        signer = make_mock_facilitator_signer(operation)
        facilitator = ExactDirectTezosFacilitator(signer=signer)

        payload = make_valid_payload()
        requirements = make_valid_requirements(amount="1000000")

        result = await facilitator.verify(payload, requirements)
        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_overpayment_passes(self):
        operation = make_valid_operation(amount="2000000")
        signer = make_mock_facilitator_signer(operation)
        facilitator = ExactDirectTezosFacilitator(signer=signer)

        payload = make_valid_payload()
        requirements = make_valid_requirements(amount="1000000")

        result = await facilitator.verify(payload, requirements)
        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_wrong_token_id(self):
        operation = make_valid_operation(token_id=1)
        signer = make_mock_facilitator_signer(operation)
        facilitator = ExactDirectTezosFacilitator(signer=signer)

        payload = make_valid_payload()
        requirements = make_valid_requirements()

        result = await facilitator.verify(payload, requirements)
        assert result.is_valid is False
        assert "Token ID" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_no_transfer_params(self):
        operation = make_valid_operation()
        operation["parameter"] = None
        signer = make_mock_facilitator_signer(operation)
        facilitator = ExactDirectTezosFacilitator(signer=signer)

        payload = make_valid_payload()
        requirements = make_valid_requirements()

        result = await facilitator.verify(payload, requirements)
        assert result.is_valid is False
        assert "parse FA2 transfer" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_empty_txs(self):
        operation = make_valid_operation()
        operation["parameter"] = [{"from_": VALID_TZ1_ADDRESS, "txs": []}]
        signer = make_mock_facilitator_signer(operation)
        facilitator = ExactDirectTezosFacilitator(signer=signer)

        payload = make_valid_payload()
        requirements = make_valid_requirements()

        result = await facilitator.verify(payload, requirements)
        assert result.is_valid is False
        assert "parse FA2 transfer" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_parameter_as_dict(self):
        """Test that single dict parameter (non-list) is handled."""
        operation = make_valid_operation()
        # Wrap parameter as a dict with a value key
        operation["parameter"] = {
            "value": [
                {
                    "from_": VALID_TZ1_ADDRESS,
                    "txs": [
                        {
                            "to_": VALID_TZ2_ADDRESS,
                            "token_id": 0,
                            "amount": "1000000",
                        }
                    ],
                }
            ]
        }
        signer = make_mock_facilitator_signer(operation)
        facilitator = ExactDirectTezosFacilitator(signer=signer)

        payload = make_valid_payload()
        requirements = make_valid_requirements()

        result = await facilitator.verify(payload, requirements)
        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_invalid_asset_in_requirements(self):
        operation = make_valid_operation()
        signer = make_mock_facilitator_signer(operation)
        facilitator = ExactDirectTezosFacilitator(signer=signer)

        payload = make_valid_payload()
        requirements = make_valid_requirements(asset="invalid_asset_format")

        result = await facilitator.verify(payload, requirements)
        assert result.is_valid is False
        assert "Invalid asset in requirements" in result.invalid_reason

    # --- Settle tests ---

    @pytest.mark.asyncio
    async def test_settle_success(self):
        operation = make_valid_operation()
        signer = make_mock_facilitator_signer(operation)
        facilitator = ExactDirectTezosFacilitator(signer=signer)

        payload = make_valid_payload()
        requirements = make_valid_requirements()

        result = await facilitator.settle(payload, requirements)
        assert result.success is True
        assert result.transaction == VALID_OP_HASH
        assert result.network == TEZOS_MAINNET
        assert result.payer == VALID_TZ1_ADDRESS
        assert result.error_reason is None

    @pytest.mark.asyncio
    async def test_settle_verification_fails(self):
        operation = make_valid_operation(status="failed")
        signer = make_mock_facilitator_signer(operation)
        facilitator = ExactDirectTezosFacilitator(signer=signer)

        payload = make_valid_payload()
        requirements = make_valid_requirements()

        result = await facilitator.settle(payload, requirements)
        assert result.success is False
        assert result.transaction is None
        assert "status is 'failed'" in result.error_reason

    @pytest.mark.asyncio
    async def test_settle_exception_handled(self):
        signer = make_mock_facilitator_signer()
        signer.get_operation = AsyncMock(side_effect=Exception("Network error"))
        facilitator = ExactDirectTezosFacilitator(signer=signer)

        payload = make_valid_payload()
        requirements = make_valid_requirements()

        result = await facilitator.settle(payload, requirements)
        assert result.success is False
        assert result.network == TEZOS_MAINNET

    @pytest.mark.asyncio
    async def test_settle_returns_network(self):
        operation = make_valid_operation()
        signer = make_mock_facilitator_signer(operation)
        facilitator = ExactDirectTezosFacilitator(signer=signer)

        payload = make_valid_payload()
        requirements = make_valid_requirements(network=TEZOS_GHOSTNET)
        # Override operation to match the ghostnet asset
        requirements["asset"] = f"{TEZOS_GHOSTNET}/fa2:{USDT_MAINNET_CONTRACT}/0"

        result = await facilitator.settle(payload, requirements)
        # The verify will check contract matching, but network is returned
        assert result.network == TEZOS_GHOSTNET


# =============================================================================
# Protocol Conformance Tests
# =============================================================================


class TestProtocolConformance:
    """Tests that scheme classes conform to the expected protocols."""

    def test_client_has_scheme(self):
        signer = make_mock_signer()
        client = ExactDirectTezosClient(signer=signer)
        assert hasattr(client, "scheme")
        assert client.scheme == SCHEME_EXACT_DIRECT

    def test_server_has_scheme(self):
        server = ExactDirectTezosServer()
        assert hasattr(server, "scheme")
        assert server.scheme == SCHEME_EXACT_DIRECT

    def test_facilitator_has_scheme(self):
        signer = make_mock_facilitator_signer()
        facilitator = ExactDirectTezosFacilitator(signer=signer)
        assert hasattr(facilitator, "scheme")
        assert facilitator.scheme == SCHEME_EXACT_DIRECT

    def test_facilitator_has_caip_family(self):
        signer = make_mock_facilitator_signer()
        facilitator = ExactDirectTezosFacilitator(signer=signer)
        assert hasattr(facilitator, "caip_family")
        assert facilitator.caip_family == "tezos:*"

    def test_client_has_create_payment_payload(self):
        signer = make_mock_signer()
        client = ExactDirectTezosClient(signer=signer)
        assert hasattr(client, "create_payment_payload")
        assert callable(client.create_payment_payload)

    def test_server_has_parse_price(self):
        server = ExactDirectTezosServer()
        assert hasattr(server, "parse_price")
        assert callable(server.parse_price)

    def test_server_has_enhance_requirements(self):
        server = ExactDirectTezosServer()
        assert hasattr(server, "enhance_requirements")
        assert callable(server.enhance_requirements)

    def test_facilitator_has_verify(self):
        signer = make_mock_facilitator_signer()
        facilitator = ExactDirectTezosFacilitator(signer=signer)
        assert hasattr(facilitator, "verify")
        assert callable(facilitator.verify)

    def test_facilitator_has_settle(self):
        signer = make_mock_facilitator_signer()
        facilitator = ExactDirectTezosFacilitator(signer=signer)
        assert hasattr(facilitator, "settle")
        assert callable(facilitator.settle)

    def test_facilitator_has_get_signers(self):
        signer = make_mock_facilitator_signer()
        facilitator = ExactDirectTezosFacilitator(signer=signer)
        assert hasattr(facilitator, "get_signers")
        assert callable(facilitator.get_signers)

    def test_facilitator_has_get_extra(self):
        signer = make_mock_facilitator_signer()
        facilitator = ExactDirectTezosFacilitator(signer=signer)
        assert hasattr(facilitator, "get_extra")
        assert callable(facilitator.get_extra)
