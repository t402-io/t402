"""Tests for Polkadot Exact-Direct Payment Scheme.

Comprehensive tests for the Client, Server, and Facilitator implementations
of the Polkadot exact-direct scheme on Asset Hub networks.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from t402.schemes.polkadot import (
    # Schemes
    ExactDirectPolkadotClientScheme,
    ExactDirectPolkadotServerScheme,
    ExactDirectPolkadotFacilitatorScheme,
    # Signer protocols
    ClientPolkadotSigner,
    FacilitatorPolkadotSigner,
    # Constants
    SCHEME_EXACT_DIRECT,
    POLKADOT_ASSET_HUB_CAIP2,
    WESTEND_ASSET_HUB_CAIP2,
    KUSAMA_ASSET_HUB_CAIP2,
    USDT_ASSET_ID,
    USDT_DECIMALS,
    # Functions
    get_network_config,
    get_supported_networks,
    is_polkadot_network,
    is_valid_ss58_address,
    is_valid_hash,
    parse_asset_identifier,
    create_asset_identifier,
    extract_asset_transfer,
    # Types
    ExactDirectPayload,
    ExtrinsicResult,
    ParsedAssetTransfer,
)
from t402.schemes.interfaces import (
    SchemeNetworkClient,
    SchemeNetworkServer,
    SchemeNetworkFacilitator,
)
from t402.types import T402_VERSION_V1, T402_VERSION_V2


# =============================================================================
# Test Fixtures and Helpers
# =============================================================================

VALID_SS58_ADDRESS = "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
VALID_SS58_ADDRESS_2 = "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty"
VALID_EXTRINSIC_HASH = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
VALID_BLOCK_HASH = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"


def create_mock_client_signer(
    address: str = VALID_SS58_ADDRESS,
) -> MagicMock:
    """Create a mock ClientPolkadotSigner."""
    signer = MagicMock()
    signer.address = MagicMock(return_value=address)
    signer.sign_and_submit = AsyncMock(
        return_value={
            "extrinsicHash": VALID_EXTRINSIC_HASH,
            "blockHash": VALID_BLOCK_HASH,
            "extrinsicIndex": 2,
        }
    )
    return signer


def create_mock_facilitator_signer(
    extrinsic_data: dict = None,
) -> MagicMock:
    """Create a mock FacilitatorPolkadotSigner."""
    signer = MagicMock()

    if extrinsic_data is None:
        extrinsic_data = {
            "extrinsic_hash": VALID_EXTRINSIC_HASH,
            "block_hash": VALID_BLOCK_HASH,
            "block_num": 12345,
            "extrinsic_index": 2,
            "success": True,
            "account_id": VALID_SS58_ADDRESS,
            "call_module": "Assets",
            "call_module_function": "transfer_keep_alive",
            "params": [
                {"name": "id", "value": USDT_ASSET_ID},
                {"name": "target", "value": VALID_SS58_ADDRESS_2},
                {"name": "amount", "value": "1000000"},
            ],
        }

    signer.get_extrinsic = AsyncMock(return_value=extrinsic_data)
    return signer


def create_base_requirements(
    network: str = POLKADOT_ASSET_HUB_CAIP2,
    amount: str = "1000000",
    pay_to: str = VALID_SS58_ADDRESS_2,
) -> dict:
    """Create base payment requirements for testing."""
    return {
        "scheme": SCHEME_EXACT_DIRECT,
        "network": network,
        "asset": f"{network}/asset:{USDT_ASSET_ID}",
        "amount": amount,
        "payTo": pay_to,
        "maxTimeoutSeconds": 300,
        "extra": {
            "assetId": USDT_ASSET_ID,
            "assetDecimals": USDT_DECIMALS,
        },
    }


# =============================================================================
# Constants Tests
# =============================================================================


class TestConstants:
    """Test Polkadot scheme constants."""

    def test_scheme_name(self):
        assert SCHEME_EXACT_DIRECT == "exact-direct"

    def test_polkadot_asset_hub_caip2(self):
        assert POLKADOT_ASSET_HUB_CAIP2 == "polkadot:68d56f15f85d3136970ec16946040bc1"

    def test_westend_asset_hub_caip2(self):
        assert WESTEND_ASSET_HUB_CAIP2 == "polkadot:e143f23803ac50e8f6f8e62695d1ce9e"

    def test_usdt_asset_id(self):
        assert USDT_ASSET_ID == 1984

    def test_usdt_decimals(self):
        assert USDT_DECIMALS == 6

    def test_is_polkadot_network(self):
        assert is_polkadot_network(POLKADOT_ASSET_HUB_CAIP2) is True
        assert is_polkadot_network(WESTEND_ASSET_HUB_CAIP2) is True
        assert is_polkadot_network("polkadot:anything") is True
        assert is_polkadot_network("eip155:1") is False
        assert is_polkadot_network("ton:mainnet") is False

    def test_get_network_config_polkadot(self):
        config = get_network_config(POLKADOT_ASSET_HUB_CAIP2)
        assert config.name == "Polkadot Asset Hub"
        assert config.is_testnet is False
        assert config.default_token.asset_id == USDT_ASSET_ID
        assert config.default_token.decimals == USDT_DECIMALS
        assert config.default_token.symbol == "USDT"
        assert config.ss58_prefix == 0

    def test_get_network_config_westend(self):
        config = get_network_config(WESTEND_ASSET_HUB_CAIP2)
        assert config.name == "Westend Asset Hub"
        assert config.is_testnet is True
        assert config.ss58_prefix == 42

    def test_get_network_config_unsupported(self):
        with pytest.raises(ValueError, match="Unsupported Polkadot network"):
            get_network_config("polkadot:unknown")

    def test_get_supported_networks(self):
        networks = get_supported_networks()
        assert POLKADOT_ASSET_HUB_CAIP2 in networks
        assert WESTEND_ASSET_HUB_CAIP2 in networks
        assert KUSAMA_ASSET_HUB_CAIP2 in networks
        assert len(networks) == 3


# =============================================================================
# Types Tests
# =============================================================================


class TestValidation:
    """Test address and hash validation utilities."""

    def test_valid_ss58_address(self):
        assert is_valid_ss58_address(VALID_SS58_ADDRESS) is True
        assert is_valid_ss58_address(VALID_SS58_ADDRESS_2) is True

    def test_invalid_ss58_address_empty(self):
        assert is_valid_ss58_address("") is False

    def test_invalid_ss58_address_too_short(self):
        assert is_valid_ss58_address("5Grwva") is False

    def test_invalid_ss58_address_bad_chars(self):
        # 0, O, I, l are not in base58
        assert is_valid_ss58_address("0" * 48) is False

    def test_valid_hash(self):
        assert is_valid_hash(VALID_EXTRINSIC_HASH) is True
        assert is_valid_hash(VALID_BLOCK_HASH) is True

    def test_invalid_hash_empty(self):
        assert is_valid_hash("") is False

    def test_invalid_hash_no_prefix(self):
        assert is_valid_hash("abcdef" * 11) is False  # Missing 0x

    def test_invalid_hash_wrong_length(self):
        assert is_valid_hash("0xabcdef") is False  # Too short

    def test_invalid_hash_bad_chars(self):
        assert is_valid_hash("0x" + "g" * 64) is False  # Invalid hex


class TestAssetIdentifier:
    """Test CAIP-19 asset identifier parsing and creation."""

    def test_parse_asset_identifier(self):
        asset = f"{POLKADOT_ASSET_HUB_CAIP2}/asset:1984"
        assert parse_asset_identifier(asset) == 1984

    def test_parse_asset_identifier_different_id(self):
        asset = "polkadot:abc123/asset:42"
        assert parse_asset_identifier(asset) == 42

    def test_parse_asset_identifier_no_prefix(self):
        assert parse_asset_identifier("invalid-identifier") is None

    def test_parse_asset_identifier_non_numeric(self):
        assert parse_asset_identifier("polkadot:abc/asset:notanumber") is None

    def test_create_asset_identifier(self):
        result = create_asset_identifier(POLKADOT_ASSET_HUB_CAIP2, 1984)
        assert result == f"{POLKADOT_ASSET_HUB_CAIP2}/asset:1984"


class TestExactDirectPayload:
    """Test ExactDirectPayload dataclass."""

    def test_to_dict(self):
        payload = ExactDirectPayload(
            extrinsic_hash=VALID_EXTRINSIC_HASH,
            block_hash=VALID_BLOCK_HASH,
            extrinsic_index=2,
            from_address=VALID_SS58_ADDRESS,
            to_address=VALID_SS58_ADDRESS_2,
            amount="1000000",
            asset_id=1984,
        )
        d = payload.to_dict()
        assert d["extrinsicHash"] == VALID_EXTRINSIC_HASH
        assert d["blockHash"] == VALID_BLOCK_HASH
        assert d["extrinsicIndex"] == 2
        assert d["from"] == VALID_SS58_ADDRESS
        assert d["to"] == VALID_SS58_ADDRESS_2
        assert d["amount"] == "1000000"
        assert d["assetId"] == 1984

    def test_from_dict_camel_case(self):
        data = {
            "extrinsicHash": VALID_EXTRINSIC_HASH,
            "blockHash": VALID_BLOCK_HASH,
            "extrinsicIndex": 2,
            "from": VALID_SS58_ADDRESS,
            "to": VALID_SS58_ADDRESS_2,
            "amount": "1000000",
            "assetId": 1984,
        }
        payload = ExactDirectPayload.from_dict(data)
        assert payload.extrinsic_hash == VALID_EXTRINSIC_HASH
        assert payload.block_hash == VALID_BLOCK_HASH
        assert payload.extrinsic_index == 2
        assert payload.from_address == VALID_SS58_ADDRESS
        assert payload.to_address == VALID_SS58_ADDRESS_2
        assert payload.amount == "1000000"
        assert payload.asset_id == 1984

    def test_from_dict_float_values(self):
        data = {
            "extrinsicHash": VALID_EXTRINSIC_HASH,
            "blockHash": VALID_BLOCK_HASH,
            "extrinsicIndex": 2.0,
            "from": VALID_SS58_ADDRESS,
            "to": VALID_SS58_ADDRESS_2,
            "amount": "1000000",
            "assetId": 1984.0,
        }
        payload = ExactDirectPayload.from_dict(data)
        assert payload.extrinsic_index == 2
        assert payload.asset_id == 1984

    def test_roundtrip(self):
        original = ExactDirectPayload(
            extrinsic_hash=VALID_EXTRINSIC_HASH,
            block_hash=VALID_BLOCK_HASH,
            extrinsic_index=5,
            from_address=VALID_SS58_ADDRESS,
            to_address=VALID_SS58_ADDRESS_2,
            amount="2000000",
            asset_id=1984,
        )
        restored = ExactDirectPayload.from_dict(original.to_dict())
        assert restored.extrinsic_hash == original.extrinsic_hash
        assert restored.block_hash == original.block_hash
        assert restored.extrinsic_index == original.extrinsic_index
        assert restored.from_address == original.from_address
        assert restored.to_address == original.to_address
        assert restored.amount == original.amount
        assert restored.asset_id == original.asset_id


class TestExtractAssetTransfer:
    """Test extract_asset_transfer utility."""

    def test_valid_transfer(self):
        result = ExtrinsicResult(
            extrinsic_hash=VALID_EXTRINSIC_HASH,
            block_hash=VALID_BLOCK_HASH,
            block_number=12345,
            extrinsic_index=2,
            success=True,
            signer=VALID_SS58_ADDRESS,
            module="Assets",
            call="transfer_keep_alive",
            params=[
                {"name": "id", "value": 1984},
                {"name": "target", "value": VALID_SS58_ADDRESS_2},
                {"name": "amount", "value": "1000000"},
            ],
        )
        transfer = extract_asset_transfer(result)
        assert transfer is not None
        assert transfer.asset_id == 1984
        assert transfer.from_address == VALID_SS58_ADDRESS
        assert transfer.to_address == VALID_SS58_ADDRESS_2
        assert transfer.amount == "1000000"
        assert transfer.success is True

    def test_failed_extrinsic(self):
        result = ExtrinsicResult(
            extrinsic_hash=VALID_EXTRINSIC_HASH,
            block_hash=VALID_BLOCK_HASH,
            block_number=12345,
            extrinsic_index=2,
            success=False,
            signer=VALID_SS58_ADDRESS,
            module="Assets",
            call="transfer_keep_alive",
            params=[],
        )
        assert extract_asset_transfer(result) is None

    def test_wrong_module(self):
        result = ExtrinsicResult(
            extrinsic_hash=VALID_EXTRINSIC_HASH,
            block_hash=VALID_BLOCK_HASH,
            block_number=12345,
            extrinsic_index=2,
            success=True,
            signer=VALID_SS58_ADDRESS,
            module="Balances",
            call="transfer",
            params=[],
        )
        assert extract_asset_transfer(result) is None

    def test_wrong_call(self):
        result = ExtrinsicResult(
            extrinsic_hash=VALID_EXTRINSIC_HASH,
            block_hash=VALID_BLOCK_HASH,
            block_number=12345,
            extrinsic_index=2,
            success=True,
            signer=VALID_SS58_ADDRESS,
            module="Assets",
            call="approve_transfer",
            params=[],
        )
        assert extract_asset_transfer(result) is None

    def test_multi_address_target(self):
        """Test extraction when target is in MultiAddress format."""
        result = ExtrinsicResult(
            extrinsic_hash=VALID_EXTRINSIC_HASH,
            block_hash=VALID_BLOCK_HASH,
            block_number=12345,
            extrinsic_index=2,
            success=True,
            signer=VALID_SS58_ADDRESS,
            module="Assets",
            call="transfer_keep_alive",
            params=[
                {"name": "id", "value": 1984},
                {"name": "target", "value": {"Id": VALID_SS58_ADDRESS_2}},
                {"name": "amount", "value": "500000"},
            ],
        )
        transfer = extract_asset_transfer(result)
        assert transfer is not None
        assert transfer.to_address == VALID_SS58_ADDRESS_2
        assert transfer.amount == "500000"

    def test_case_insensitive_module(self):
        """Test that module name matching is case-insensitive."""
        result = ExtrinsicResult(
            extrinsic_hash=VALID_EXTRINSIC_HASH,
            block_hash=VALID_BLOCK_HASH,
            block_number=12345,
            extrinsic_index=2,
            success=True,
            signer=VALID_SS58_ADDRESS,
            module="assets",
            call="transfer",
            params=[
                {"name": "id", "value": 1984},
                {"name": "target", "value": VALID_SS58_ADDRESS_2},
                {"name": "amount", "value": "1000000"},
            ],
        )
        transfer = extract_asset_transfer(result)
        assert transfer is not None

    def test_missing_params(self):
        """Test that extraction fails when required params are missing."""
        result = ExtrinsicResult(
            extrinsic_hash=VALID_EXTRINSIC_HASH,
            block_hash=VALID_BLOCK_HASH,
            block_number=12345,
            extrinsic_index=2,
            success=True,
            signer=VALID_SS58_ADDRESS,
            module="Assets",
            call="transfer_keep_alive",
            params=[
                {"name": "id", "value": 1984},
                # Missing target and amount
            ],
        )
        assert extract_asset_transfer(result) is None


# =============================================================================
# Client Tests
# =============================================================================


class TestExactDirectPolkadotClientScheme:
    """Test ExactDirectPolkadotClientScheme."""

    def test_scheme_name(self):
        signer = create_mock_client_signer()
        scheme = ExactDirectPolkadotClientScheme(signer)
        assert scheme.scheme == "exact-direct"

    def test_caip_family(self):
        signer = create_mock_client_signer()
        scheme = ExactDirectPolkadotClientScheme(signer)
        assert scheme.caip_family == "polkadot:*"

    def test_address_property(self):
        signer = create_mock_client_signer(VALID_SS58_ADDRESS)
        scheme = ExactDirectPolkadotClientScheme(signer)
        assert scheme.address == VALID_SS58_ADDRESS

    @pytest.mark.asyncio
    async def test_create_payment_payload_v2(self):
        signer = create_mock_client_signer()
        scheme = ExactDirectPolkadotClientScheme(signer)
        requirements = create_base_requirements()

        payload = await scheme.create_payment_payload(
            t402_version=T402_VERSION_V2,
            requirements=requirements,
        )

        assert payload["t402Version"] == 2
        assert "payload" in payload
        assert payload["payload"]["extrinsicHash"] == VALID_EXTRINSIC_HASH
        assert payload["payload"]["blockHash"] == VALID_BLOCK_HASH
        assert payload["payload"]["extrinsicIndex"] == 2
        assert payload["payload"]["from"] == VALID_SS58_ADDRESS
        assert payload["payload"]["to"] == VALID_SS58_ADDRESS_2
        assert payload["payload"]["amount"] == "1000000"
        assert payload["payload"]["assetId"] == USDT_ASSET_ID

    @pytest.mark.asyncio
    async def test_create_payment_payload_v1(self):
        signer = create_mock_client_signer()
        scheme = ExactDirectPolkadotClientScheme(signer)
        requirements = create_base_requirements()

        payload = await scheme.create_payment_payload(
            t402_version=T402_VERSION_V1,
            requirements=requirements,
        )

        assert payload["t402Version"] == 1
        assert payload["scheme"] == "exact-direct"
        assert payload["network"] == POLKADOT_ASSET_HUB_CAIP2
        assert "payload" in payload

    @pytest.mark.asyncio
    async def test_create_payment_payload_calls_signer(self):
        signer = create_mock_client_signer()
        scheme = ExactDirectPolkadotClientScheme(signer)
        requirements = create_base_requirements()

        await scheme.create_payment_payload(
            t402_version=T402_VERSION_V2,
            requirements=requirements,
        )

        signer.sign_and_submit.assert_called_once()
        call_args = signer.sign_and_submit.call_args
        extrinsic_call = call_args[0][0]
        network = call_args[0][1]

        assert extrinsic_call["assetId"] == USDT_ASSET_ID
        assert extrinsic_call["target"] == VALID_SS58_ADDRESS_2
        assert extrinsic_call["amount"] == "1000000"
        assert network == POLKADOT_ASSET_HUB_CAIP2

    @pytest.mark.asyncio
    async def test_create_payment_payload_unsupported_network(self):
        signer = create_mock_client_signer()
        scheme = ExactDirectPolkadotClientScheme(signer)
        requirements = create_base_requirements(network="eip155:1")

        with pytest.raises(ValueError, match="Unsupported network"):
            await scheme.create_payment_payload(
                t402_version=T402_VERSION_V2,
                requirements=requirements,
            )

    @pytest.mark.asyncio
    async def test_create_payment_payload_missing_pay_to(self):
        signer = create_mock_client_signer()
        scheme = ExactDirectPolkadotClientScheme(signer)
        requirements = create_base_requirements(pay_to="")

        with pytest.raises(ValueError, match="payTo address is required"):
            await scheme.create_payment_payload(
                t402_version=T402_VERSION_V2,
                requirements=requirements,
            )

    @pytest.mark.asyncio
    async def test_create_payment_payload_invalid_pay_to(self):
        signer = create_mock_client_signer()
        scheme = ExactDirectPolkadotClientScheme(signer)
        requirements = create_base_requirements(pay_to="invalid-address")

        with pytest.raises(ValueError, match="Invalid payTo address"):
            await scheme.create_payment_payload(
                t402_version=T402_VERSION_V2,
                requirements=requirements,
            )

    @pytest.mark.asyncio
    async def test_create_payment_payload_missing_amount(self):
        signer = create_mock_client_signer()
        scheme = ExactDirectPolkadotClientScheme(signer)
        requirements = create_base_requirements(amount="")

        with pytest.raises(ValueError, match="Amount is required"):
            await scheme.create_payment_payload(
                t402_version=T402_VERSION_V2,
                requirements=requirements,
            )

    @pytest.mark.asyncio
    async def test_create_payment_payload_invalid_amount(self):
        signer = create_mock_client_signer()
        scheme = ExactDirectPolkadotClientScheme(signer)
        requirements = create_base_requirements(amount="not-a-number")

        with pytest.raises(ValueError, match="Invalid amount format"):
            await scheme.create_payment_payload(
                t402_version=T402_VERSION_V2,
                requirements=requirements,
            )

    @pytest.mark.asyncio
    async def test_create_payment_payload_negative_amount(self):
        signer = create_mock_client_signer()
        scheme = ExactDirectPolkadotClientScheme(signer)
        requirements = create_base_requirements(amount="-100")

        with pytest.raises(ValueError, match="Amount must be positive"):
            await scheme.create_payment_payload(
                t402_version=T402_VERSION_V2,
                requirements=requirements,
            )

    @pytest.mark.asyncio
    async def test_create_payment_payload_zero_amount(self):
        signer = create_mock_client_signer()
        scheme = ExactDirectPolkadotClientScheme(signer)
        requirements = create_base_requirements(amount="0")

        with pytest.raises(ValueError, match="Amount must be positive"):
            await scheme.create_payment_payload(
                t402_version=T402_VERSION_V2,
                requirements=requirements,
            )

    @pytest.mark.asyncio
    async def test_create_payment_payload_resolves_asset_from_caip19(self):
        signer = create_mock_client_signer()
        scheme = ExactDirectPolkadotClientScheme(signer)
        requirements = create_base_requirements()
        requirements["asset"] = f"{POLKADOT_ASSET_HUB_CAIP2}/asset:1984"
        requirements.pop("extra", None)

        payload = await scheme.create_payment_payload(
            t402_version=T402_VERSION_V2,
            requirements=requirements,
        )

        assert payload["payload"]["assetId"] == 1984

    @pytest.mark.asyncio
    async def test_create_payment_payload_resolves_asset_from_extra(self):
        signer = create_mock_client_signer()
        scheme = ExactDirectPolkadotClientScheme(signer)
        requirements = create_base_requirements()
        requirements["asset"] = ""  # No CAIP-19
        requirements["extra"] = {"assetId": 42}

        payload = await scheme.create_payment_payload(
            t402_version=T402_VERSION_V2,
            requirements=requirements,
        )

        assert payload["payload"]["assetId"] == 42

    @pytest.mark.asyncio
    async def test_create_payment_payload_falls_back_to_default_asset(self):
        signer = create_mock_client_signer()
        scheme = ExactDirectPolkadotClientScheme(signer)
        requirements = create_base_requirements()
        requirements["asset"] = ""  # No CAIP-19
        requirements["extra"] = {}  # No assetId

        payload = await scheme.create_payment_payload(
            t402_version=T402_VERSION_V2,
            requirements=requirements,
        )

        assert payload["payload"]["assetId"] == USDT_ASSET_ID

    @pytest.mark.asyncio
    async def test_create_payment_payload_westend(self):
        signer = create_mock_client_signer()
        scheme = ExactDirectPolkadotClientScheme(signer)
        requirements = create_base_requirements(network=WESTEND_ASSET_HUB_CAIP2)

        payload = await scheme.create_payment_payload(
            t402_version=T402_VERSION_V2,
            requirements=requirements,
        )

        assert payload["t402Version"] == 2
        assert payload["payload"]["assetId"] == USDT_ASSET_ID

    @pytest.mark.asyncio
    async def test_create_payment_payload_empty_signer_address(self):
        signer = create_mock_client_signer("")
        scheme = ExactDirectPolkadotClientScheme(signer)
        requirements = create_base_requirements()

        with pytest.raises(ValueError, match="Signer address is empty"):
            await scheme.create_payment_payload(
                t402_version=T402_VERSION_V2,
                requirements=requirements,
            )

    @pytest.mark.asyncio
    async def test_create_payment_payload_signer_failure(self):
        signer = create_mock_client_signer()
        signer.sign_and_submit = AsyncMock(side_effect=RuntimeError("RPC timeout"))
        scheme = ExactDirectPolkadotClientScheme(signer)
        requirements = create_base_requirements()

        with pytest.raises(RuntimeError, match="RPC timeout"):
            await scheme.create_payment_payload(
                t402_version=T402_VERSION_V2,
                requirements=requirements,
            )


# =============================================================================
# Server Tests
# =============================================================================


class TestExactDirectPolkadotServerScheme:
    """Test ExactDirectPolkadotServerScheme."""

    def test_scheme_name(self):
        scheme = ExactDirectPolkadotServerScheme()
        assert scheme.scheme == "exact-direct"

    def test_caip_family(self):
        scheme = ExactDirectPolkadotServerScheme()
        assert scheme.caip_family == "polkadot:*"

    @pytest.mark.asyncio
    async def test_parse_price_dollar_string(self):
        scheme = ExactDirectPolkadotServerScheme()
        result = await scheme.parse_price("$0.10", POLKADOT_ASSET_HUB_CAIP2)

        assert result["amount"] == "100000"
        assert "asset" in result
        assert "/asset:1984" in result["asset"]

    @pytest.mark.asyncio
    async def test_parse_price_plain_string(self):
        scheme = ExactDirectPolkadotServerScheme()
        result = await scheme.parse_price("0.50", POLKADOT_ASSET_HUB_CAIP2)

        assert result["amount"] == "500000"

    @pytest.mark.asyncio
    async def test_parse_price_float(self):
        scheme = ExactDirectPolkadotServerScheme()
        result = await scheme.parse_price(0.10, POLKADOT_ASSET_HUB_CAIP2)

        assert result["amount"] == "100000"

    @pytest.mark.asyncio
    async def test_parse_price_integer(self):
        scheme = ExactDirectPolkadotServerScheme()
        result = await scheme.parse_price(1, POLKADOT_ASSET_HUB_CAIP2)

        assert result["amount"] == "1000000"

    @pytest.mark.asyncio
    async def test_parse_price_with_currency_suffix(self):
        scheme = ExactDirectPolkadotServerScheme()
        result = await scheme.parse_price("1.50 USDT", POLKADOT_ASSET_HUB_CAIP2)

        assert result["amount"] == "1500000"

    @pytest.mark.asyncio
    async def test_parse_price_dict_passthrough(self):
        scheme = ExactDirectPolkadotServerScheme()
        result = await scheme.parse_price(
            {"amount": "750000", "asset": "custom-asset"},
            POLKADOT_ASSET_HUB_CAIP2,
        )

        assert result["amount"] == "750000"
        assert result["asset"] == "custom-asset"

    @pytest.mark.asyncio
    async def test_parse_price_dict_without_asset(self):
        scheme = ExactDirectPolkadotServerScheme()
        result = await scheme.parse_price(
            {"amount": "750000"},
            POLKADOT_ASSET_HUB_CAIP2,
        )

        assert result["amount"] == "750000"
        assert "/asset:1984" in result["asset"]

    @pytest.mark.asyncio
    async def test_parse_price_returns_extra_metadata(self):
        scheme = ExactDirectPolkadotServerScheme()
        result = await scheme.parse_price("$1.00", POLKADOT_ASSET_HUB_CAIP2)

        assert result["extra"]["symbol"] == "USDT"
        assert result["extra"]["name"] == "Tether USD"
        assert result["extra"]["decimals"] == 6
        assert result["extra"]["assetId"] == 1984

    @pytest.mark.asyncio
    async def test_parse_price_invalid_network(self):
        scheme = ExactDirectPolkadotServerScheme()

        with pytest.raises(ValueError, match="Invalid Polkadot network"):
            await scheme.parse_price("$0.10", "eip155:1")

    @pytest.mark.asyncio
    async def test_parse_price_unknown_polkadot_network(self):
        scheme = ExactDirectPolkadotServerScheme()

        with pytest.raises(ValueError, match="Unsupported Polkadot network"):
            await scheme.parse_price("$0.10", "polkadot:unknown")

    @pytest.mark.asyncio
    async def test_parse_price_invalid_string(self):
        scheme = ExactDirectPolkadotServerScheme()

        with pytest.raises(ValueError, match="Failed to parse price"):
            await scheme.parse_price("not-a-number", POLKADOT_ASSET_HUB_CAIP2)

    @pytest.mark.asyncio
    async def test_parse_price_westend(self):
        scheme = ExactDirectPolkadotServerScheme()
        result = await scheme.parse_price("$0.10", WESTEND_ASSET_HUB_CAIP2)

        assert result["amount"] == "100000"
        assert WESTEND_ASSET_HUB_CAIP2 in result["asset"]
        assert result["extra"]["name"] == "Test Tether USD"

    @pytest.mark.asyncio
    async def test_enhance_requirements_adds_metadata(self):
        scheme = ExactDirectPolkadotServerScheme()
        requirements = {
            "scheme": SCHEME_EXACT_DIRECT,
            "network": POLKADOT_ASSET_HUB_CAIP2,
            "asset": "",
            "amount": "1000000",
            "payTo": VALID_SS58_ADDRESS_2,
            "maxTimeoutSeconds": 300,
        }
        supported_kind = {
            "t402Version": 2,
            "scheme": SCHEME_EXACT_DIRECT,
            "network": POLKADOT_ASSET_HUB_CAIP2,
        }

        enhanced = await scheme.enhance_requirements(
            requirements, supported_kind, []
        )

        assert enhanced["extra"]["assetId"] == USDT_ASSET_ID
        assert enhanced["extra"]["assetSymbol"] == "USDT"
        assert enhanced["extra"]["assetDecimals"] == USDT_DECIMALS
        assert enhanced["extra"]["networkName"] == "Polkadot Asset Hub"

    @pytest.mark.asyncio
    async def test_enhance_requirements_sets_asset(self):
        scheme = ExactDirectPolkadotServerScheme()
        requirements = {
            "scheme": SCHEME_EXACT_DIRECT,
            "network": POLKADOT_ASSET_HUB_CAIP2,
            "asset": "",
            "amount": "1000000",
            "payTo": VALID_SS58_ADDRESS_2,
            "maxTimeoutSeconds": 300,
        }
        supported_kind = {
            "t402Version": 2,
            "scheme": SCHEME_EXACT_DIRECT,
            "network": POLKADOT_ASSET_HUB_CAIP2,
        }

        enhanced = await scheme.enhance_requirements(
            requirements, supported_kind, []
        )

        expected_asset = f"{POLKADOT_ASSET_HUB_CAIP2}/asset:1984"
        assert enhanced["asset"] == expected_asset

    @pytest.mark.asyncio
    async def test_enhance_requirements_preserves_existing_asset(self):
        scheme = ExactDirectPolkadotServerScheme()
        existing_asset = f"{POLKADOT_ASSET_HUB_CAIP2}/asset:42"
        requirements = {
            "scheme": SCHEME_EXACT_DIRECT,
            "network": POLKADOT_ASSET_HUB_CAIP2,
            "asset": existing_asset,
            "amount": "1000000",
            "payTo": VALID_SS58_ADDRESS_2,
            "maxTimeoutSeconds": 300,
        }
        supported_kind = {
            "t402Version": 2,
            "scheme": SCHEME_EXACT_DIRECT,
            "network": POLKADOT_ASSET_HUB_CAIP2,
        }

        enhanced = await scheme.enhance_requirements(
            requirements, supported_kind, []
        )

        assert enhanced["asset"] == existing_asset

    @pytest.mark.asyncio
    async def test_enhance_requirements_converts_decimal_amount(self):
        scheme = ExactDirectPolkadotServerScheme()
        requirements = {
            "scheme": SCHEME_EXACT_DIRECT,
            "network": POLKADOT_ASSET_HUB_CAIP2,
            "asset": f"{POLKADOT_ASSET_HUB_CAIP2}/asset:1984",
            "amount": "1.50",  # Decimal amount
            "payTo": VALID_SS58_ADDRESS_2,
            "maxTimeoutSeconds": 300,
        }
        supported_kind = {
            "t402Version": 2,
            "scheme": SCHEME_EXACT_DIRECT,
            "network": POLKADOT_ASSET_HUB_CAIP2,
        }

        enhanced = await scheme.enhance_requirements(
            requirements, supported_kind, []
        )

        assert enhanced["amount"] == "1500000"

    @pytest.mark.asyncio
    async def test_enhance_requirements_copies_facilitator_extra(self):
        scheme = ExactDirectPolkadotServerScheme()
        requirements = {
            "scheme": SCHEME_EXACT_DIRECT,
            "network": POLKADOT_ASSET_HUB_CAIP2,
            "asset": f"{POLKADOT_ASSET_HUB_CAIP2}/asset:1984",
            "amount": "1000000",
            "payTo": VALID_SS58_ADDRESS_2,
            "maxTimeoutSeconds": 300,
        }
        supported_kind = {
            "t402Version": 2,
            "scheme": SCHEME_EXACT_DIRECT,
            "network": POLKADOT_ASSET_HUB_CAIP2,
            "extra": {"assetId": 42, "customField": "value"},
        }

        enhanced = await scheme.enhance_requirements(
            requirements, supported_kind, ["customField"]
        )

        # assetId from supported_kind overrides
        assert enhanced["extra"]["assetId"] == 42
        assert enhanced["extra"]["customField"] == "value"

    @pytest.mark.asyncio
    async def test_enhance_requirements_with_preferred_token(self):
        scheme = ExactDirectPolkadotServerScheme(preferred_token="USDT")
        requirements = {
            "scheme": SCHEME_EXACT_DIRECT,
            "network": POLKADOT_ASSET_HUB_CAIP2,
            "asset": "",
            "amount": "1000000",
            "payTo": VALID_SS58_ADDRESS_2,
            "maxTimeoutSeconds": 300,
        }
        supported_kind = {
            "t402Version": 2,
            "scheme": SCHEME_EXACT_DIRECT,
            "network": POLKADOT_ASSET_HUB_CAIP2,
        }

        enhanced = await scheme.enhance_requirements(
            requirements, supported_kind, []
        )

        assert enhanced["extra"]["assetSymbol"] == "USDT"


# =============================================================================
# Facilitator Tests
# =============================================================================


class TestExactDirectPolkadotFacilitatorScheme:
    """Test ExactDirectPolkadotFacilitatorScheme."""

    def test_scheme_name(self):
        signer = create_mock_facilitator_signer()
        facilitator = ExactDirectPolkadotFacilitatorScheme(signer)
        assert facilitator.scheme == "exact-direct"

    def test_caip_family(self):
        signer = create_mock_facilitator_signer()
        facilitator = ExactDirectPolkadotFacilitatorScheme(signer)
        assert facilitator.caip_family == "polkadot:*"

    def test_get_signers(self):
        signer = create_mock_facilitator_signer()
        addresses = {
            POLKADOT_ASSET_HUB_CAIP2: [VALID_SS58_ADDRESS],
        }
        facilitator = ExactDirectPolkadotFacilitatorScheme(signer, addresses=addresses)

        signers = facilitator.get_signers(POLKADOT_ASSET_HUB_CAIP2)
        assert signers == [VALID_SS58_ADDRESS]

    def test_get_signers_unknown_network(self):
        signer = create_mock_facilitator_signer()
        facilitator = ExactDirectPolkadotFacilitatorScheme(signer)

        signers = facilitator.get_signers("polkadot:unknown")
        assert signers == []

    def test_get_extra(self):
        signer = create_mock_facilitator_signer()
        facilitator = ExactDirectPolkadotFacilitatorScheme(signer)

        extra = facilitator.get_extra(POLKADOT_ASSET_HUB_CAIP2)
        assert extra is not None
        assert extra["assetId"] == USDT_ASSET_ID
        assert extra["assetSymbol"] == "USDT"
        assert extra["assetDecimals"] == USDT_DECIMALS
        assert extra["networkName"] == "Polkadot Asset Hub"

    def test_get_extra_unsupported_network(self):
        signer = create_mock_facilitator_signer()
        facilitator = ExactDirectPolkadotFacilitatorScheme(signer)

        extra = facilitator.get_extra("polkadot:unknown")
        assert extra is None

    @pytest.mark.asyncio
    async def test_verify_valid_payment(self):
        signer = create_mock_facilitator_signer()
        facilitator = ExactDirectPolkadotFacilitatorScheme(signer)
        requirements = create_base_requirements()

        payload = {
            "payload": {
                "extrinsicHash": VALID_EXTRINSIC_HASH,
                "blockHash": VALID_BLOCK_HASH,
                "extrinsicIndex": 2,
                "from": VALID_SS58_ADDRESS,
                "to": VALID_SS58_ADDRESS_2,
                "amount": "1000000",
                "assetId": USDT_ASSET_ID,
            }
        }

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True
        assert result.payer == VALID_SS58_ADDRESS
        assert result.invalid_reason is None

    @pytest.mark.asyncio
    async def test_verify_invalid_network(self):
        signer = create_mock_facilitator_signer()
        facilitator = ExactDirectPolkadotFacilitatorScheme(signer)
        requirements = create_base_requirements(network="eip155:1")

        payload = {
            "payload": {
                "extrinsicHash": VALID_EXTRINSIC_HASH,
                "blockHash": VALID_BLOCK_HASH,
                "extrinsicIndex": 2,
                "from": VALID_SS58_ADDRESS,
                "to": VALID_SS58_ADDRESS_2,
                "amount": "1000000",
                "assetId": USDT_ASSET_ID,
            }
        }

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "Unsupported network" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_missing_extrinsic_hash(self):
        signer = create_mock_facilitator_signer()
        facilitator = ExactDirectPolkadotFacilitatorScheme(signer)
        requirements = create_base_requirements()

        payload = {
            "payload": {
                "extrinsicHash": "",
                "blockHash": VALID_BLOCK_HASH,
                "extrinsicIndex": 2,
                "from": VALID_SS58_ADDRESS,
                "to": VALID_SS58_ADDRESS_2,
                "amount": "1000000",
                "assetId": USDT_ASSET_ID,
            }
        }

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "Missing extrinsic hash" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_invalid_extrinsic_hash_format(self):
        signer = create_mock_facilitator_signer()
        facilitator = ExactDirectPolkadotFacilitatorScheme(signer)
        requirements = create_base_requirements()

        payload = {
            "payload": {
                "extrinsicHash": "not-a-valid-hash",
                "blockHash": VALID_BLOCK_HASH,
                "extrinsicIndex": 2,
                "from": VALID_SS58_ADDRESS,
                "to": VALID_SS58_ADDRESS_2,
                "amount": "1000000",
                "assetId": USDT_ASSET_ID,
            }
        }

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "Invalid extrinsic hash format" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_extrinsic_not_found(self):
        signer = create_mock_facilitator_signer()
        signer.get_extrinsic = AsyncMock(return_value=None)
        facilitator = ExactDirectPolkadotFacilitatorScheme(signer)
        requirements = create_base_requirements()

        payload = {
            "payload": {
                "extrinsicHash": VALID_EXTRINSIC_HASH,
                "blockHash": VALID_BLOCK_HASH,
                "extrinsicIndex": 2,
                "from": VALID_SS58_ADDRESS,
                "to": VALID_SS58_ADDRESS_2,
                "amount": "1000000",
                "assetId": USDT_ASSET_ID,
            }
        }

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "not found" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_failed_extrinsic(self):
        extrinsic_data = {
            "extrinsic_hash": VALID_EXTRINSIC_HASH,
            "block_hash": VALID_BLOCK_HASH,
            "block_num": 12345,
            "extrinsic_index": 2,
            "success": False,
            "account_id": VALID_SS58_ADDRESS,
            "call_module": "Assets",
            "call_module_function": "transfer_keep_alive",
            "params": [],
        }
        signer = create_mock_facilitator_signer(extrinsic_data)
        facilitator = ExactDirectPolkadotFacilitatorScheme(signer)
        requirements = create_base_requirements()

        payload = {
            "payload": {
                "extrinsicHash": VALID_EXTRINSIC_HASH,
                "blockHash": VALID_BLOCK_HASH,
                "extrinsicIndex": 2,
                "from": VALID_SS58_ADDRESS,
                "to": VALID_SS58_ADDRESS_2,
                "amount": "1000000",
                "assetId": USDT_ASSET_ID,
            }
        }

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "failed on-chain" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_wrong_module(self):
        extrinsic_data = {
            "extrinsic_hash": VALID_EXTRINSIC_HASH,
            "block_hash": VALID_BLOCK_HASH,
            "block_num": 12345,
            "extrinsic_index": 2,
            "success": True,
            "account_id": VALID_SS58_ADDRESS,
            "call_module": "Balances",
            "call_module_function": "transfer",
            "params": [],
        }
        signer = create_mock_facilitator_signer(extrinsic_data)
        facilitator = ExactDirectPolkadotFacilitatorScheme(signer)
        requirements = create_base_requirements()

        payload = {
            "payload": {
                "extrinsicHash": VALID_EXTRINSIC_HASH,
                "blockHash": VALID_BLOCK_HASH,
                "extrinsicIndex": 2,
                "from": VALID_SS58_ADDRESS,
                "to": VALID_SS58_ADDRESS_2,
                "amount": "1000000",
                "assetId": USDT_ASSET_ID,
            }
        }

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "not a valid asset transfer" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_wrong_recipient(self):
        wrong_recipient = "5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy"
        extrinsic_data = {
            "extrinsic_hash": VALID_EXTRINSIC_HASH,
            "block_hash": VALID_BLOCK_HASH,
            "block_num": 12345,
            "extrinsic_index": 2,
            "success": True,
            "account_id": VALID_SS58_ADDRESS,
            "call_module": "Assets",
            "call_module_function": "transfer_keep_alive",
            "params": [
                {"name": "id", "value": USDT_ASSET_ID},
                {"name": "target", "value": wrong_recipient},
                {"name": "amount", "value": "1000000"},
            ],
        }
        signer = create_mock_facilitator_signer(extrinsic_data)
        facilitator = ExactDirectPolkadotFacilitatorScheme(signer)
        requirements = create_base_requirements()

        payload = {
            "payload": {
                "extrinsicHash": VALID_EXTRINSIC_HASH,
                "blockHash": VALID_BLOCK_HASH,
                "extrinsicIndex": 2,
                "from": VALID_SS58_ADDRESS,
                "to": wrong_recipient,
                "amount": "1000000",
                "assetId": USDT_ASSET_ID,
            }
        }

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "does not match" in result.invalid_reason
        assert "payTo" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_insufficient_amount(self):
        extrinsic_data = {
            "extrinsic_hash": VALID_EXTRINSIC_HASH,
            "block_hash": VALID_BLOCK_HASH,
            "block_num": 12345,
            "extrinsic_index": 2,
            "success": True,
            "account_id": VALID_SS58_ADDRESS,
            "call_module": "Assets",
            "call_module_function": "transfer_keep_alive",
            "params": [
                {"name": "id", "value": USDT_ASSET_ID},
                {"name": "target", "value": VALID_SS58_ADDRESS_2},
                {"name": "amount", "value": "500000"},  # Less than required
            ],
        }
        signer = create_mock_facilitator_signer(extrinsic_data)
        facilitator = ExactDirectPolkadotFacilitatorScheme(signer)
        requirements = create_base_requirements(amount="1000000")

        payload = {
            "payload": {
                "extrinsicHash": VALID_EXTRINSIC_HASH,
                "blockHash": VALID_BLOCK_HASH,
                "extrinsicIndex": 2,
                "from": VALID_SS58_ADDRESS,
                "to": VALID_SS58_ADDRESS_2,
                "amount": "500000",
                "assetId": USDT_ASSET_ID,
            }
        }

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "less than" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_excess_amount_is_valid(self):
        """Verify passes when transfer amount exceeds required amount."""
        extrinsic_data = {
            "extrinsic_hash": VALID_EXTRINSIC_HASH,
            "block_hash": VALID_BLOCK_HASH,
            "block_num": 12345,
            "extrinsic_index": 2,
            "success": True,
            "account_id": VALID_SS58_ADDRESS,
            "call_module": "Assets",
            "call_module_function": "transfer_keep_alive",
            "params": [
                {"name": "id", "value": USDT_ASSET_ID},
                {"name": "target", "value": VALID_SS58_ADDRESS_2},
                {"name": "amount", "value": "2000000"},  # More than required
            ],
        }
        signer = create_mock_facilitator_signer(extrinsic_data)
        facilitator = ExactDirectPolkadotFacilitatorScheme(signer)
        requirements = create_base_requirements(amount="1000000")

        payload = {
            "payload": {
                "extrinsicHash": VALID_EXTRINSIC_HASH,
                "blockHash": VALID_BLOCK_HASH,
                "extrinsicIndex": 2,
                "from": VALID_SS58_ADDRESS,
                "to": VALID_SS58_ADDRESS_2,
                "amount": "2000000",
                "assetId": USDT_ASSET_ID,
            }
        }

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_wrong_asset_id(self):
        extrinsic_data = {
            "extrinsic_hash": VALID_EXTRINSIC_HASH,
            "block_hash": VALID_BLOCK_HASH,
            "block_num": 12345,
            "extrinsic_index": 2,
            "success": True,
            "account_id": VALID_SS58_ADDRESS,
            "call_module": "Assets",
            "call_module_function": "transfer_keep_alive",
            "params": [
                {"name": "id", "value": 999},  # Wrong asset ID
                {"name": "target", "value": VALID_SS58_ADDRESS_2},
                {"name": "amount", "value": "1000000"},
            ],
        }
        signer = create_mock_facilitator_signer(extrinsic_data)
        facilitator = ExactDirectPolkadotFacilitatorScheme(signer)
        requirements = create_base_requirements()

        payload = {
            "payload": {
                "extrinsicHash": VALID_EXTRINSIC_HASH,
                "blockHash": VALID_BLOCK_HASH,
                "extrinsicIndex": 2,
                "from": VALID_SS58_ADDRESS,
                "to": VALID_SS58_ADDRESS_2,
                "amount": "1000000",
                "assetId": 999,
            }
        }

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "asset ID" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_signer_exception(self):
        signer = create_mock_facilitator_signer()
        signer.get_extrinsic = AsyncMock(side_effect=RuntimeError("Indexer timeout"))
        facilitator = ExactDirectPolkadotFacilitatorScheme(signer)
        requirements = create_base_requirements()

        payload = {
            "payload": {
                "extrinsicHash": VALID_EXTRINSIC_HASH,
                "blockHash": VALID_BLOCK_HASH,
                "extrinsicIndex": 2,
                "from": VALID_SS58_ADDRESS,
                "to": VALID_SS58_ADDRESS_2,
                "amount": "1000000",
                "assetId": USDT_ASSET_ID,
            }
        }

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "Verification error" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_with_nested_payload(self):
        """Test verify handles PaymentPayloadV2 format with nested payload."""
        signer = create_mock_facilitator_signer()
        facilitator = ExactDirectPolkadotFacilitatorScheme(signer)
        requirements = create_base_requirements()

        # V2 payload has payload nested inside
        payload = {
            "t402Version": 2,
            "payload": {
                "extrinsicHash": VALID_EXTRINSIC_HASH,
                "blockHash": VALID_BLOCK_HASH,
                "extrinsicIndex": 2,
                "from": VALID_SS58_ADDRESS,
                "to": VALID_SS58_ADDRESS_2,
                "amount": "1000000",
                "assetId": USDT_ASSET_ID,
            },
        }

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True
        assert result.payer == VALID_SS58_ADDRESS

    @pytest.mark.asyncio
    async def test_settle_valid_payment(self):
        signer = create_mock_facilitator_signer()
        facilitator = ExactDirectPolkadotFacilitatorScheme(signer)
        requirements = create_base_requirements()

        payload = {
            "payload": {
                "extrinsicHash": VALID_EXTRINSIC_HASH,
                "blockHash": VALID_BLOCK_HASH,
                "extrinsicIndex": 2,
                "from": VALID_SS58_ADDRESS,
                "to": VALID_SS58_ADDRESS_2,
                "amount": "1000000",
                "assetId": USDT_ASSET_ID,
            }
        }

        result = await facilitator.settle(payload, requirements)

        assert result.success is True
        assert result.transaction == VALID_EXTRINSIC_HASH
        assert result.network == POLKADOT_ASSET_HUB_CAIP2
        assert result.payer == VALID_SS58_ADDRESS
        assert result.error_reason is None

    @pytest.mark.asyncio
    async def test_settle_invalid_payment(self):
        """Settle should fail if verification fails."""
        signer = create_mock_facilitator_signer()
        signer.get_extrinsic = AsyncMock(return_value=None)
        facilitator = ExactDirectPolkadotFacilitatorScheme(signer)
        requirements = create_base_requirements()

        payload = {
            "payload": {
                "extrinsicHash": VALID_EXTRINSIC_HASH,
                "blockHash": VALID_BLOCK_HASH,
                "extrinsicIndex": 2,
                "from": VALID_SS58_ADDRESS,
                "to": VALID_SS58_ADDRESS_2,
                "amount": "1000000",
                "assetId": USDT_ASSET_ID,
            }
        }

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert result.error_reason is not None
        assert result.network == POLKADOT_ASSET_HUB_CAIP2

    @pytest.mark.asyncio
    async def test_settle_exception(self):
        """Settle should fail gracefully when the signer raises an exception."""
        signer = create_mock_facilitator_signer()
        signer.get_extrinsic = AsyncMock(side_effect=RuntimeError("Network error"))
        facilitator = ExactDirectPolkadotFacilitatorScheme(signer)
        requirements = create_base_requirements()

        payload = {
            "payload": {
                "extrinsicHash": VALID_EXTRINSIC_HASH,
                "blockHash": VALID_BLOCK_HASH,
                "extrinsicIndex": 2,
                "from": VALID_SS58_ADDRESS,
                "to": VALID_SS58_ADDRESS_2,
                "amount": "1000000",
                "assetId": USDT_ASSET_ID,
            }
        }

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert result.error_reason is not None
        assert "Network error" in result.error_reason


# =============================================================================
# Protocol Compliance Tests
# =============================================================================


class TestProtocolCompliance:
    """Test that Polkadot schemes implement the Protocol interfaces correctly."""

    def test_client_scheme_is_protocol_compliant(self):
        signer = create_mock_client_signer()
        scheme = ExactDirectPolkadotClientScheme(signer)

        assert isinstance(scheme, SchemeNetworkClient)
        assert hasattr(scheme, "scheme")
        assert hasattr(scheme, "create_payment_payload")

    def test_server_scheme_is_protocol_compliant(self):
        scheme = ExactDirectPolkadotServerScheme()

        assert isinstance(scheme, SchemeNetworkServer)
        assert hasattr(scheme, "scheme")
        assert hasattr(scheme, "parse_price")
        assert hasattr(scheme, "enhance_requirements")

    def test_facilitator_scheme_is_protocol_compliant(self):
        signer = create_mock_facilitator_signer()
        facilitator = ExactDirectPolkadotFacilitatorScheme(signer)

        assert isinstance(facilitator, SchemeNetworkFacilitator)
        assert hasattr(facilitator, "scheme")
        assert hasattr(facilitator, "caip_family")
        assert hasattr(facilitator, "get_extra")
        assert hasattr(facilitator, "get_signers")
        assert hasattr(facilitator, "verify")
        assert hasattr(facilitator, "settle")


# =============================================================================
# Registry Integration Tests
# =============================================================================


class TestPolkadotSchemeRegistry:
    """Test Polkadot scheme registration in registry."""

    def test_register_polkadot_client_scheme(self):
        from t402.schemes.registry import ClientSchemeRegistry

        registry = ClientSchemeRegistry()
        signer = create_mock_client_signer()
        scheme = ExactDirectPolkadotClientScheme(signer)
        registry.register("polkadot:*", scheme)

        # Should match Polkadot networks
        assert registry.get(POLKADOT_ASSET_HUB_CAIP2, SCHEME_EXACT_DIRECT) is scheme
        assert registry.get(WESTEND_ASSET_HUB_CAIP2, SCHEME_EXACT_DIRECT) is scheme

        # Should NOT match other networks
        assert registry.get("eip155:8453", SCHEME_EXACT_DIRECT) is None
        assert registry.get("ton:mainnet", SCHEME_EXACT_DIRECT) is None

    def test_register_polkadot_server_scheme(self):
        from t402.schemes.registry import ServerSchemeRegistry

        registry = ServerSchemeRegistry()
        scheme = ExactDirectPolkadotServerScheme()
        registry.register("polkadot:*", scheme)

        assert registry.get(POLKADOT_ASSET_HUB_CAIP2, SCHEME_EXACT_DIRECT) is scheme
        assert registry.get(WESTEND_ASSET_HUB_CAIP2, SCHEME_EXACT_DIRECT) is scheme

    def test_register_polkadot_facilitator_scheme(self):
        from t402.schemes.registry import FacilitatorSchemeRegistry

        registry = FacilitatorSchemeRegistry()
        signer = create_mock_facilitator_signer()
        facilitator = ExactDirectPolkadotFacilitatorScheme(
            signer,
            addresses={POLKADOT_ASSET_HUB_CAIP2: [VALID_SS58_ADDRESS]},
        )
        registry.register(POLKADOT_ASSET_HUB_CAIP2, facilitator)

        found = registry.get(POLKADOT_ASSET_HUB_CAIP2, SCHEME_EXACT_DIRECT)
        assert found is facilitator

        kinds = registry.get_supported_kinds()
        assert len(kinds) == 1
        assert kinds[0]["scheme"] == SCHEME_EXACT_DIRECT
        assert kinds[0]["network"] == POLKADOT_ASSET_HUB_CAIP2

    def test_facilitator_signers_by_family(self):
        from t402.schemes.registry import FacilitatorSchemeRegistry

        registry = FacilitatorSchemeRegistry()
        signer = create_mock_facilitator_signer()
        facilitator = ExactDirectPolkadotFacilitatorScheme(
            signer,
            addresses={POLKADOT_ASSET_HUB_CAIP2: [VALID_SS58_ADDRESS]},
        )
        registry.register(POLKADOT_ASSET_HUB_CAIP2, facilitator)

        signers = registry.get_signers_by_family()
        assert "polkadot:*" in signers
        assert VALID_SS58_ADDRESS in signers["polkadot:*"]


# =============================================================================
# End-to-End Flow Tests
# =============================================================================


class TestEndToEndFlow:
    """Test the complete payment flow: server -> client -> facilitator."""

    @pytest.mark.asyncio
    async def test_full_payment_flow(self):
        """Test the complete exact-direct payment flow."""
        # 1. Server parses price and creates requirements
        server = ExactDirectPolkadotServerScheme()
        asset_amount = await server.parse_price("$1.00", POLKADOT_ASSET_HUB_CAIP2)

        requirements = {
            "scheme": SCHEME_EXACT_DIRECT,
            "network": POLKADOT_ASSET_HUB_CAIP2,
            "asset": asset_amount["asset"],
            "amount": asset_amount["amount"],
            "payTo": VALID_SS58_ADDRESS_2,
            "maxTimeoutSeconds": 300,
        }

        supported_kind = {
            "t402Version": 2,
            "scheme": SCHEME_EXACT_DIRECT,
            "network": POLKADOT_ASSET_HUB_CAIP2,
        }

        enhanced = await server.enhance_requirements(
            requirements, supported_kind, []
        )

        # 2. Client creates payment payload
        client_signer = create_mock_client_signer()
        client = ExactDirectPolkadotClientScheme(client_signer)
        payload = await client.create_payment_payload(
            t402_version=T402_VERSION_V2,
            requirements=enhanced,
        )

        assert payload["t402Version"] == 2
        assert payload["payload"]["amount"] == "1000000"

        # 3. Facilitator verifies the payment
        facilitator_signer = create_mock_facilitator_signer()
        facilitator = ExactDirectPolkadotFacilitatorScheme(facilitator_signer)

        verify_result = await facilitator.verify(payload, enhanced)
        assert verify_result.is_valid is True
        assert verify_result.payer == VALID_SS58_ADDRESS

        # 4. Facilitator settles the payment
        settle_result = await facilitator.settle(payload, enhanced)
        assert settle_result.success is True
        assert settle_result.transaction == VALID_EXTRINSIC_HASH

    @pytest.mark.asyncio
    async def test_full_payment_flow_westend(self):
        """Test the complete flow on Westend testnet."""
        server = ExactDirectPolkadotServerScheme()
        asset_amount = await server.parse_price("$0.50", WESTEND_ASSET_HUB_CAIP2)

        assert asset_amount["amount"] == "500000"
        assert WESTEND_ASSET_HUB_CAIP2 in asset_amount["asset"]

        requirements = {
            "scheme": SCHEME_EXACT_DIRECT,
            "network": WESTEND_ASSET_HUB_CAIP2,
            "asset": asset_amount["asset"],
            "amount": asset_amount["amount"],
            "payTo": VALID_SS58_ADDRESS_2,
            "maxTimeoutSeconds": 300,
        }

        supported_kind = {
            "t402Version": 2,
            "scheme": SCHEME_EXACT_DIRECT,
            "network": WESTEND_ASSET_HUB_CAIP2,
        }

        enhanced = await server.enhance_requirements(
            requirements, supported_kind, []
        )
        assert enhanced["extra"]["networkName"] == "Westend Asset Hub"

        client_signer = create_mock_client_signer()
        client = ExactDirectPolkadotClientScheme(client_signer)
        payload = await client.create_payment_payload(
            t402_version=T402_VERSION_V2,
            requirements=enhanced,
        )

        assert payload["t402Version"] == 2
