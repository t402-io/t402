"""Tests for Stacks Scheme Package - Verify imports, re-exports, and basic functionality.

This test file validates that:
1. The new schemes/stacks/ package correctly exports client, server, facilitator
2. Constants and types are properly exported
3. Basic class properties are correct
4. Validation utilities work correctly
5. Facilitator verify/settle work with mock data
"""

import pytest


class TestStacksSchemeImports:
    """Test that Stacks scheme classes can be imported from the scheme package."""

    def test_import_client_from_scheme_package(self):
        """Test importing ExactDirectStacksClientScheme from t402.schemes.stacks."""
        from t402.schemes.stacks import ExactDirectStacksClientScheme

        assert ExactDirectStacksClientScheme is not None

    def test_import_server_from_scheme_package(self):
        """Test importing ExactDirectStacksServerScheme from t402.schemes.stacks."""
        from t402.schemes.stacks import ExactDirectStacksServerScheme

        assert ExactDirectStacksServerScheme is not None

    def test_import_facilitator_from_scheme_package(self):
        """Test importing ExactDirectStacksFacilitatorScheme from t402.schemes.stacks."""
        from t402.schemes.stacks import ExactDirectStacksFacilitatorScheme

        assert ExactDirectStacksFacilitatorScheme is not None

    def test_import_client_signer(self):
        """Test importing ClientStacksSigner from t402.schemes.stacks."""
        from t402.schemes.stacks import ClientStacksSigner

        assert ClientStacksSigner is not None

    def test_import_facilitator_signer(self):
        """Test importing FacilitatorStacksSigner from t402.schemes.stacks."""
        from t402.schemes.stacks import FacilitatorStacksSigner

        assert FacilitatorStacksSigner is not None

    def test_import_scheme_constant(self):
        """Test importing SCHEME_EXACT_DIRECT from t402.schemes.stacks."""
        from t402.schemes.stacks import SCHEME_EXACT_DIRECT

        assert SCHEME_EXACT_DIRECT == "exact-direct"

    def test_import_from_exact_direct_subpackage(self):
        """Test importing from t402.schemes.stacks.exact_direct directly."""
        from t402.schemes.stacks.exact_direct import (
            ExactDirectStacksClientScheme,
            ExactDirectStacksServerScheme,
            ExactDirectStacksFacilitatorScheme,
            ClientStacksSigner,
            FacilitatorStacksSigner,
            SCHEME_EXACT_DIRECT,
        )

        assert SCHEME_EXACT_DIRECT == "exact-direct"

    def test_import_from_individual_modules(self):
        """Test importing from individual module files."""
        from t402.schemes.stacks.exact_direct.client import (
            ExactDirectStacksClientScheme,
        )
        from t402.schemes.stacks.exact_direct.server import (
            ExactDirectStacksServerScheme,
        )
        from t402.schemes.stacks.exact_direct.facilitator import (
            ExactDirectStacksFacilitatorScheme,
        )

        assert ExactDirectStacksClientScheme is not None
        assert ExactDirectStacksServerScheme is not None
        assert ExactDirectStacksFacilitatorScheme is not None

    def test_import_from_top_level_schemes(self):
        """Test importing Stacks classes from t402.schemes (top-level)."""
        from t402.schemes import (
            ExactDirectStacksClientScheme,
            ExactDirectStacksServerScheme,
            ExactDirectStacksFacilitatorScheme,
            ClientStacksSigner,
            FacilitatorStacksSigner,
            STACKS_SCHEME_EXACT_DIRECT,
        )

        assert STACKS_SCHEME_EXACT_DIRECT == "exact-direct"


class TestStacksSchemeClientProperties:
    """Test basic properties of the Stacks client scheme."""

    def test_client_scheme_attribute(self):
        """Test that ExactDirectStacksClientScheme has scheme='exact-direct'."""
        from t402.schemes.stacks import ExactDirectStacksClientScheme

        assert ExactDirectStacksClientScheme.scheme == "exact-direct"

    def test_client_caip_family(self):
        """Test that ExactDirectStacksClientScheme has caip_family='stacks:*'."""
        from t402.schemes.stacks import ExactDirectStacksClientScheme

        assert ExactDirectStacksClientScheme.caip_family == "stacks:*"


class TestStacksSchemeServerProperties:
    """Test basic properties of the Stacks server scheme."""

    def test_server_scheme_attribute(self):
        """Test that ExactDirectStacksServerScheme has scheme='exact-direct'."""
        from t402.schemes.stacks import ExactDirectStacksServerScheme

        assert ExactDirectStacksServerScheme.scheme == "exact-direct"

    def test_server_caip_family(self):
        """Test that ExactDirectStacksServerScheme has caip_family='stacks:*'."""
        from t402.schemes.stacks import ExactDirectStacksServerScheme

        assert ExactDirectStacksServerScheme.caip_family == "stacks:*"


class TestStacksSchemeFacilitatorProperties:
    """Test basic properties of the Stacks facilitator scheme."""

    def test_facilitator_scheme_attribute(self):
        """Test that ExactDirectStacksFacilitatorScheme has scheme='exact-direct'."""
        from t402.schemes.stacks import ExactDirectStacksFacilitatorScheme

        assert ExactDirectStacksFacilitatorScheme.scheme == "exact-direct"

    def test_facilitator_caip_family(self):
        """Test that ExactDirectStacksFacilitatorScheme has caip_family='stacks:*'."""
        from t402.schemes.stacks import ExactDirectStacksFacilitatorScheme

        assert ExactDirectStacksFacilitatorScheme.caip_family == "stacks:*"


class TestStacksConstants:
    """Test Stacks constants are properly defined."""

    def test_mainnet_caip2(self):
        """Test mainnet CAIP-2 identifier."""
        from t402.schemes.stacks.constants import STACKS_MAINNET_CAIP2

        assert STACKS_MAINNET_CAIP2 == "stacks:1"

    def test_testnet_caip2(self):
        """Test testnet CAIP-2 identifier."""
        from t402.schemes.stacks.constants import STACKS_TESTNET_CAIP2

        assert STACKS_TESTNET_CAIP2 == "stacks:2147483648"

    def test_susdc_decimals(self):
        """Test sUSDC decimals."""
        from t402.schemes.stacks.constants import SUSDC_DECIMALS

        assert SUSDC_DECIMALS == 6

    def test_networks_dict(self):
        """Test networks dict contains both mainnet and testnet."""
        from t402.schemes.stacks.constants import NETWORKS

        assert "stacks:1" in NETWORKS
        assert "stacks:2147483648" in NETWORKS

    def test_mainnet_config(self):
        """Test mainnet config values."""
        from t402.schemes.stacks.constants import get_network_config

        config = get_network_config("stacks:1")
        assert config.name == "Stacks Mainnet"
        assert config.is_testnet is False
        assert config.chain_id == 1
        assert config.default_token.symbol == "sUSDC"
        assert config.default_token.decimals == 6
        assert "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K" in config.default_token.contract_address

    def test_testnet_config(self):
        """Test testnet config values."""
        from t402.schemes.stacks.constants import get_network_config

        config = get_network_config("stacks:2147483648")
        assert config.name == "Stacks Testnet"
        assert config.is_testnet is True
        assert config.chain_id == 2147483648
        assert config.default_token.symbol == "sUSDC"
        assert "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM" in config.default_token.contract_address

    def test_unsupported_network_raises(self):
        """Test that unsupported network raises ValueError."""
        from t402.schemes.stacks.constants import get_network_config

        with pytest.raises(ValueError, match="Unsupported Stacks network"):
            get_network_config("stacks:999")

    def test_is_stacks_network(self):
        """Test is_stacks_network function."""
        from t402.schemes.stacks.constants import is_stacks_network

        assert is_stacks_network("stacks:1") is True
        assert is_stacks_network("stacks:2147483648") is True
        assert is_stacks_network("eip155:1") is False
        assert is_stacks_network("solana:mainnet") is False

    def test_get_supported_networks(self):
        """Test get_supported_networks returns both networks."""
        from t402.schemes.stacks.constants import get_supported_networks

        networks = get_supported_networks()
        assert "stacks:1" in networks
        assert "stacks:2147483648" in networks
        assert len(networks) == 2


class TestStacksTypes:
    """Test Stacks type utilities."""

    def test_valid_stacks_address_mainnet(self):
        """Test valid mainnet Stacks address."""
        from t402.schemes.stacks.types import is_valid_stacks_address

        assert is_valid_stacks_address("SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K") is True

    def test_valid_stacks_address_testnet(self):
        """Test valid testnet Stacks address."""
        from t402.schemes.stacks.types import is_valid_stacks_address

        assert is_valid_stacks_address("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM") is True

    def test_invalid_stacks_address_empty(self):
        """Test empty address is invalid."""
        from t402.schemes.stacks.types import is_valid_stacks_address

        assert is_valid_stacks_address("") is False

    def test_invalid_stacks_address_wrong_prefix(self):
        """Test address with wrong prefix is invalid."""
        from t402.schemes.stacks.types import is_valid_stacks_address

        assert is_valid_stacks_address("0x1234567890abcdef") is False

    def test_valid_tx_id(self):
        """Test valid transaction ID."""
        from t402.schemes.stacks.types import is_valid_tx_id

        tx_id = "0x" + "a" * 64
        assert is_valid_tx_id(tx_id) is True

    def test_invalid_tx_id_no_prefix(self):
        """Test transaction ID without 0x prefix is invalid."""
        from t402.schemes.stacks.types import is_valid_tx_id

        tx_id = "a" * 64
        assert is_valid_tx_id(tx_id) is False

    def test_invalid_tx_id_short(self):
        """Test short transaction ID is invalid."""
        from t402.schemes.stacks.types import is_valid_tx_id

        assert is_valid_tx_id("0xabc") is False

    def test_invalid_tx_id_empty(self):
        """Test empty transaction ID is invalid."""
        from t402.schemes.stacks.types import is_valid_tx_id

        assert is_valid_tx_id("") is False

    def test_parse_contract_identifier(self):
        """Test parsing CAIP-19 asset identifier to contract ID."""
        from t402.schemes.stacks.types import parse_contract_identifier

        asset = "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc"
        result = parse_contract_identifier(asset)
        assert result == "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc"

    def test_parse_contract_identifier_no_token(self):
        """Test parsing asset identifier without token prefix returns None."""
        from t402.schemes.stacks.types import parse_contract_identifier

        assert parse_contract_identifier("stacks:1/asset:1984") is None

    def test_create_asset_identifier(self):
        """Test creating CAIP-19 asset identifier."""
        from t402.schemes.stacks.types import create_asset_identifier

        result = create_asset_identifier(
            "stacks:1", "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc"
        )
        assert result == "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc"

    def test_exact_direct_payload_to_dict(self):
        """Test ExactDirectPayload serialization."""
        from t402.schemes.stacks.types import ExactDirectPayload

        payload = ExactDirectPayload(
            tx_id="0x" + "ab" * 32,
            from_address="SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
            to_address="ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
            amount="1000000",
            contract_address="SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
        )
        d = payload.to_dict()
        assert d["txId"] == "0x" + "ab" * 32
        assert d["from"] == "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K"
        assert d["to"] == "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
        assert d["amount"] == "1000000"
        assert d["contractAddress"] == "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc"

    def test_exact_direct_payload_from_dict(self):
        """Test ExactDirectPayload deserialization."""
        from t402.schemes.stacks.types import ExactDirectPayload

        data = {
            "txId": "0x" + "cd" * 32,
            "from": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
            "to": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
            "amount": "500000",
            "contractAddress": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
        }
        payload = ExactDirectPayload.from_dict(data)
        assert payload.tx_id == "0x" + "cd" * 32
        assert payload.from_address == "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K"
        assert payload.to_address == "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
        assert payload.amount == "500000"
        assert payload.contract_address == "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc"

    def test_extract_token_transfer_success(self):
        """Test extracting token transfer from a successful transaction."""
        from t402.schemes.stacks.types import TransactionResult, extract_token_transfer

        result = TransactionResult(
            tx_id="0x" + "ab" * 32,
            tx_status="success",
            sender_address="SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
            contract_call={
                "contract_id": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
                "function_name": "transfer",
                "function_args": [
                    {"name": "amount", "repr": "u1000000"},
                    {"name": "recipient", "repr": "'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"},
                ],
            },
            block_height=12345,
            block_hash="0x" + "ee" * 32,
        )
        transfer = extract_token_transfer(result)
        assert transfer is not None
        assert transfer.contract_address == "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc"
        assert transfer.from_address == "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K"
        assert transfer.to_address == "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"
        assert transfer.amount == "1000000"
        assert transfer.success is True

    def test_extract_token_transfer_failed_tx(self):
        """Test extracting transfer from a failed transaction returns None."""
        from t402.schemes.stacks.types import TransactionResult, extract_token_transfer

        result = TransactionResult(
            tx_id="0x" + "ab" * 32,
            tx_status="abort_by_response",
            sender_address="SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
            contract_call=None,
            block_height=12345,
            block_hash="0x" + "ee" * 32,
        )
        assert extract_token_transfer(result) is None

    def test_extract_token_transfer_wrong_function(self):
        """Test extracting transfer from a non-transfer call returns None."""
        from t402.schemes.stacks.types import TransactionResult, extract_token_transfer

        result = TransactionResult(
            tx_id="0x" + "ab" * 32,
            tx_status="success",
            sender_address="SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
            contract_call={
                "contract_id": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
                "function_name": "mint",
                "function_args": [],
            },
            block_height=12345,
            block_hash="0x" + "ee" * 32,
        )
        assert extract_token_transfer(result) is None


class TestStacksServerScheme:
    """Test Stacks server scheme functionality."""

    @pytest.mark.asyncio
    async def test_parse_price_dollar_string(self):
        """Test parsing dollar string price."""
        from t402.schemes.stacks import ExactDirectStacksServerScheme

        scheme = ExactDirectStacksServerScheme()
        result = await scheme.parse_price("$0.10", "stacks:1")

        assert result["amount"] == "100000"
        assert "token:" in result["asset"]
        assert result["extra"]["symbol"] == "sUSDC"
        assert result["extra"]["decimals"] == 6

    @pytest.mark.asyncio
    async def test_parse_price_numeric(self):
        """Test parsing numeric price."""
        from t402.schemes.stacks import ExactDirectStacksServerScheme

        scheme = ExactDirectStacksServerScheme()
        result = await scheme.parse_price(1.5, "stacks:1")

        assert result["amount"] == "1500000"

    @pytest.mark.asyncio
    async def test_parse_price_dict(self):
        """Test parsing pre-parsed dict price."""
        from t402.schemes.stacks import ExactDirectStacksServerScheme

        scheme = ExactDirectStacksServerScheme()
        result = await scheme.parse_price(
            {"amount": "2000000", "asset": "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc"},
            "stacks:1",
        )

        assert result["amount"] == "2000000"

    @pytest.mark.asyncio
    async def test_parse_price_invalid_network(self):
        """Test parsing price with invalid network raises ValueError."""
        from t402.schemes.stacks import ExactDirectStacksServerScheme

        scheme = ExactDirectStacksServerScheme()
        with pytest.raises(ValueError, match="Invalid Stacks network"):
            await scheme.parse_price("$1.00", "eip155:1")

    @pytest.mark.asyncio
    async def test_enhance_requirements(self):
        """Test enhancing requirements with Stacks metadata."""
        from t402.schemes.stacks import ExactDirectStacksServerScheme

        scheme = ExactDirectStacksServerScheme()
        requirements = {
            "scheme": "exact-direct",
            "network": "stacks:1",
            "amount": "1000000",
            "payTo": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
            "maxTimeoutSeconds": 300,
        }
        result = await scheme.enhance_requirements(requirements, {}, [])

        assert "asset" in result
        assert "token:" in result["asset"]
        assert result["extra"]["assetSymbol"] == "sUSDC"
        assert result["extra"]["assetDecimals"] == 6
        assert result["extra"]["networkName"] == "Stacks Mainnet"
        assert "contractAddress" in result["extra"]


class TestStacksClientScheme:
    """Test Stacks client scheme functionality."""

    @pytest.mark.asyncio
    async def test_create_payment_payload_success(self):
        """Test successful payment payload creation."""
        from t402.schemes.stacks import ExactDirectStacksClientScheme

        tx_id = "0x" + "ab" * 32

        class MockSigner:
            @property
            def address(self) -> str:
                return "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K"

            async def transfer_token(self, contract_address: str, to: str, amount: int) -> str:
                return tx_id

        scheme = ExactDirectStacksClientScheme(signer=MockSigner())
        result = await scheme.create_payment_payload(
            t402_version=2,
            requirements={
                "scheme": "exact-direct",
                "network": "stacks:1",
                "asset": "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
                "amount": "1000000",
                "payTo": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
                "maxTimeoutSeconds": 300,
            },
        )

        assert result["t402Version"] == 2
        assert result["payload"]["txId"] == tx_id
        assert result["payload"]["from"] == "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K"
        assert result["payload"]["amount"] == "1000000"

    @pytest.mark.asyncio
    async def test_create_payment_payload_v1(self):
        """Test V1 format payment payload creation."""
        from t402.schemes.stacks import ExactDirectStacksClientScheme

        tx_id = "0x" + "cd" * 32

        class MockSigner:
            @property
            def address(self) -> str:
                return "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K"

            async def transfer_token(self, contract_address: str, to: str, amount: int) -> str:
                return tx_id

        scheme = ExactDirectStacksClientScheme(signer=MockSigner())
        result = await scheme.create_payment_payload(
            t402_version=1,
            requirements={
                "scheme": "exact-direct",
                "network": "stacks:1",
                "asset": "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
                "amount": "500000",
                "payTo": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
                "maxTimeoutSeconds": 300,
            },
        )

        assert result["t402Version"] == 1
        assert result["scheme"] == "exact-direct"
        assert result["network"] == "stacks:1"
        assert result["payload"]["txId"] == tx_id

    @pytest.mark.asyncio
    async def test_create_payment_payload_invalid_network(self):
        """Test payload creation with invalid network raises ValueError."""
        from t402.schemes.stacks import ExactDirectStacksClientScheme

        class MockSigner:
            @property
            def address(self) -> str:
                return "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K"

            async def transfer_token(self, contract_address: str, to: str, amount: int) -> str:
                return "0x" + "00" * 32

        scheme = ExactDirectStacksClientScheme(signer=MockSigner())
        with pytest.raises(ValueError, match="Unsupported network"):
            await scheme.create_payment_payload(
                t402_version=2,
                requirements={
                    "scheme": "exact-direct",
                    "network": "eip155:1",
                    "amount": "1000000",
                    "payTo": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
                    "maxTimeoutSeconds": 300,
                },
            )

    @pytest.mark.asyncio
    async def test_create_payment_payload_invalid_amount(self):
        """Test payload creation with invalid amount raises ValueError."""
        from t402.schemes.stacks import ExactDirectStacksClientScheme

        class MockSigner:
            @property
            def address(self) -> str:
                return "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K"

            async def transfer_token(self, contract_address: str, to: str, amount: int) -> str:
                return "0x" + "00" * 32

        scheme = ExactDirectStacksClientScheme(signer=MockSigner())
        with pytest.raises(ValueError, match="Amount must be positive"):
            await scheme.create_payment_payload(
                t402_version=2,
                requirements={
                    "scheme": "exact-direct",
                    "network": "stacks:1",
                    "amount": "0",
                    "payTo": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
                    "maxTimeoutSeconds": 300,
                },
            )

    @pytest.mark.asyncio
    async def test_create_payment_payload_missing_payto(self):
        """Test payload creation with missing payTo raises ValueError."""
        from t402.schemes.stacks import ExactDirectStacksClientScheme

        class MockSigner:
            @property
            def address(self) -> str:
                return "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K"

            async def transfer_token(self, contract_address: str, to: str, amount: int) -> str:
                return "0x" + "00" * 32

        scheme = ExactDirectStacksClientScheme(signer=MockSigner())
        with pytest.raises(ValueError, match="payTo address is required"):
            await scheme.create_payment_payload(
                t402_version=2,
                requirements={
                    "scheme": "exact-direct",
                    "network": "stacks:1",
                    "amount": "1000000",
                    "payTo": "",
                    "maxTimeoutSeconds": 300,
                },
            )


class TestStacksFacilitatorScheme:
    """Test Stacks facilitator scheme functionality."""

    def _make_facilitator(self, tx_data=None):
        """Create a facilitator with a mock signer."""
        from t402.schemes.stacks import ExactDirectStacksFacilitatorScheme

        class MockFacilitatorSigner:
            def get_addresses(self, network: str) -> list:
                return ["SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K"]

            async def query_transaction(self, tx_id: str):
                return tx_data

        return ExactDirectStacksFacilitatorScheme(signer=MockFacilitatorSigner())

    def test_get_extra_mainnet(self):
        """Test get_extra returns correct data for mainnet."""
        facilitator = self._make_facilitator()
        extra = facilitator.get_extra("stacks:1")

        assert extra is not None
        assert extra["assetSymbol"] == "sUSDC"
        assert extra["assetDecimals"] == 6
        assert extra["networkName"] == "Stacks Mainnet"
        assert "contractAddress" in extra

    def test_get_extra_unsupported(self):
        """Test get_extra returns None for unsupported network."""
        facilitator = self._make_facilitator()
        assert facilitator.get_extra("eip155:1") is None

    def test_get_signers(self):
        """Test get_signers returns addresses from signer."""
        facilitator = self._make_facilitator()
        signers = facilitator.get_signers("stacks:1")
        assert "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K" in signers

    @pytest.mark.asyncio
    async def test_verify_success(self):
        """Test successful verification."""
        tx_id = "0x" + "ab" * 32
        tx_data = {
            "tx_id": tx_id,
            "tx_status": "success",
            "sender_address": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
            "contract_call": {
                "contract_id": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
                "function_name": "transfer",
                "function_args": [
                    {"name": "amount", "repr": "u1000000"},
                    {"name": "recipient", "repr": "'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"},
                ],
            },
            "block_height": 12345,
            "block_hash": "0x" + "ee" * 32,
        }
        facilitator = self._make_facilitator(tx_data)

        payload = {
            "payload": {
                "txId": tx_id,
                "from": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
                "to": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
                "amount": "1000000",
                "contractAddress": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
            }
        }
        requirements = {
            "scheme": "exact-direct",
            "network": "stacks:1",
            "asset": "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
            "amount": "1000000",
            "payTo": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
            "maxTimeoutSeconds": 300,
        }

        result = await facilitator.verify(payload, requirements)
        assert result.is_valid is True
        assert result.payer == "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K"

    @pytest.mark.asyncio
    async def test_verify_tx_not_found(self):
        """Test verification when transaction is not found."""
        facilitator = self._make_facilitator(tx_data=None)

        tx_id = "0x" + "ab" * 32
        payload = {
            "payload": {
                "txId": tx_id,
                "from": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
                "to": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
                "amount": "1000000",
                "contractAddress": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
            }
        }
        requirements = {
            "scheme": "exact-direct",
            "network": "stacks:1",
            "amount": "1000000",
            "payTo": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
            "maxTimeoutSeconds": 300,
        }

        result = await facilitator.verify(payload, requirements)
        assert result.is_valid is False
        assert "not found" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_insufficient_amount(self):
        """Test verification with insufficient transfer amount."""
        tx_id = "0x" + "ab" * 32
        tx_data = {
            "tx_id": tx_id,
            "tx_status": "success",
            "sender_address": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
            "contract_call": {
                "contract_id": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
                "function_name": "transfer",
                "function_args": [
                    {"name": "amount", "repr": "u500000"},
                    {"name": "recipient", "repr": "'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"},
                ],
            },
            "block_height": 12345,
            "block_hash": "0x" + "ee" * 32,
        }
        facilitator = self._make_facilitator(tx_data)

        payload = {
            "payload": {
                "txId": tx_id,
                "from": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
                "to": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
                "amount": "500000",
                "contractAddress": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
            }
        }
        requirements = {
            "scheme": "exact-direct",
            "network": "stacks:1",
            "asset": "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
            "amount": "1000000",
            "payTo": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
            "maxTimeoutSeconds": 300,
        }

        result = await facilitator.verify(payload, requirements)
        assert result.is_valid is False
        assert "less than" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_wrong_recipient(self):
        """Test verification with wrong recipient address."""
        tx_id = "0x" + "ab" * 32
        tx_data = {
            "tx_id": tx_id,
            "tx_status": "success",
            "sender_address": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
            "contract_call": {
                "contract_id": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
                "function_name": "transfer",
                "function_args": [
                    {"name": "amount", "repr": "u1000000"},
                    {"name": "recipient", "repr": "'SP000000000000000000002Q6VF78"},
                ],
            },
            "block_height": 12345,
            "block_hash": "0x" + "ee" * 32,
        }
        facilitator = self._make_facilitator(tx_data)

        payload = {
            "payload": {
                "txId": tx_id,
                "from": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
                "to": "SP000000000000000000002Q6VF78",
                "amount": "1000000",
                "contractAddress": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
            }
        }
        requirements = {
            "scheme": "exact-direct",
            "network": "stacks:1",
            "amount": "1000000",
            "payTo": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
            "maxTimeoutSeconds": 300,
        }

        result = await facilitator.verify(payload, requirements)
        assert result.is_valid is False
        assert "does not match" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_replay_protection(self):
        """Test that the same txId cannot be used twice."""
        tx_id = "0x" + "ab" * 32
        tx_data = {
            "tx_id": tx_id,
            "tx_status": "success",
            "sender_address": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
            "contract_call": {
                "contract_id": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
                "function_name": "transfer",
                "function_args": [
                    {"name": "amount", "repr": "u1000000"},
                    {"name": "recipient", "repr": "'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"},
                ],
            },
            "block_height": 12345,
            "block_hash": "0x" + "ee" * 32,
        }
        facilitator = self._make_facilitator(tx_data)

        payload = {
            "payload": {
                "txId": tx_id,
                "from": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
                "to": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
                "amount": "1000000",
                "contractAddress": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
            }
        }
        requirements = {
            "scheme": "exact-direct",
            "network": "stacks:1",
            "asset": "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
            "amount": "1000000",
            "payTo": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
            "maxTimeoutSeconds": 300,
        }

        # First verification should succeed
        result1 = await facilitator.verify(payload, requirements)
        assert result1.is_valid is True

        # Second verification with same txId should fail (replay protection)
        result2 = await facilitator.verify(payload, requirements)
        assert result2.is_valid is False
        assert "already used" in result2.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_invalid_tx_id_format(self):
        """Test verification with invalid transaction ID format."""
        facilitator = self._make_facilitator()

        payload = {
            "payload": {
                "txId": "invalid-tx-id",
                "from": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
                "to": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
                "amount": "1000000",
                "contractAddress": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
            }
        }
        requirements = {
            "scheme": "exact-direct",
            "network": "stacks:1",
            "amount": "1000000",
            "payTo": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
            "maxTimeoutSeconds": 300,
        }

        result = await facilitator.verify(payload, requirements)
        assert result.is_valid is False
        assert "Invalid transaction ID" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_unsupported_network(self):
        """Test verification with unsupported network."""
        facilitator = self._make_facilitator()

        payload = {
            "payload": {
                "txId": "0x" + "ab" * 32,
                "from": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
                "to": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
                "amount": "1000000",
                "contractAddress": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
            }
        }
        requirements = {
            "scheme": "exact-direct",
            "network": "eip155:1",
            "amount": "1000000",
            "payTo": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
            "maxTimeoutSeconds": 300,
        }

        result = await facilitator.verify(payload, requirements)
        assert result.is_valid is False
        assert "Unsupported network" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_settle_success(self):
        """Test successful settlement."""
        tx_id = "0x" + "ab" * 32
        tx_data = {
            "tx_id": tx_id,
            "tx_status": "success",
            "sender_address": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
            "contract_call": {
                "contract_id": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
                "function_name": "transfer",
                "function_args": [
                    {"name": "amount", "repr": "u1000000"},
                    {"name": "recipient", "repr": "'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"},
                ],
            },
            "block_height": 12345,
            "block_hash": "0x" + "ee" * 32,
        }
        facilitator = self._make_facilitator(tx_data)

        payload = {
            "payload": {
                "txId": tx_id,
                "from": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
                "to": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
                "amount": "1000000",
                "contractAddress": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
            }
        }
        requirements = {
            "scheme": "exact-direct",
            "network": "stacks:1",
            "asset": "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
            "amount": "1000000",
            "payTo": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
            "maxTimeoutSeconds": 300,
        }

        result = await facilitator.settle(payload, requirements)
        assert result.success is True
        assert result.transaction == tx_id
        assert result.network == "stacks:1"
        assert result.payer == "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K"

    @pytest.mark.asyncio
    async def test_settle_verify_failure(self):
        """Test settlement when verification fails."""
        facilitator = self._make_facilitator(tx_data=None)

        tx_id = "0x" + "ab" * 32
        payload = {
            "payload": {
                "txId": tx_id,
                "from": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
                "to": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
                "amount": "1000000",
                "contractAddress": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
            }
        }
        requirements = {
            "scheme": "exact-direct",
            "network": "stacks:1",
            "amount": "1000000",
            "payTo": "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
            "maxTimeoutSeconds": 300,
        }

        result = await facilitator.settle(payload, requirements)
        assert result.success is False
        assert result.error_reason is not None


class TestAllSchemeCoverageWithStacks:
    """Test that Stacks is included in all-chains coverage."""

    def test_stacks_client_in_schemes(self):
        """Test Stacks client is importable from top-level schemes."""
        from t402.schemes import ExactDirectStacksClientScheme

        assert ExactDirectStacksClientScheme.scheme == "exact-direct"
        assert ExactDirectStacksClientScheme.caip_family == "stacks:*"

    def test_stacks_server_in_schemes(self):
        """Test Stacks server is importable from top-level schemes."""
        from t402.schemes import ExactDirectStacksServerScheme

        assert ExactDirectStacksServerScheme.scheme == "exact-direct"
        assert ExactDirectStacksServerScheme.caip_family == "stacks:*"

    def test_stacks_facilitator_in_schemes(self):
        """Test Stacks facilitator is importable from top-level schemes."""
        from t402.schemes import ExactDirectStacksFacilitatorScheme

        assert ExactDirectStacksFacilitatorScheme.scheme == "exact-direct"
        assert ExactDirectStacksFacilitatorScheme.caip_family == "stacks:*"

    def test_stacks_scheme_constant_aliased(self):
        """Test STACKS_SCHEME_EXACT_DIRECT is available from top-level."""
        from t402.schemes import STACKS_SCHEME_EXACT_DIRECT

        assert STACKS_SCHEME_EXACT_DIRECT == "exact-direct"
