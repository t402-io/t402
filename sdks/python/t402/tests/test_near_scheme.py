"""Comprehensive tests for the NEAR exact-direct payment scheme.

Tests cover:
- Constants and configuration
- Account ID validation
- Token lookups and network configs
- Client scheme (payload creation, validation)
- Server scheme (price parsing, requirements enhancement)
- Facilitator scheme (verification, settlement, replay protection)
- Payload types
"""

from __future__ import annotations

import base64
import json
import time
from typing import Any, Dict, List
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from t402.schemes.near import (
    # Scheme implementations
    ExactDirectNearClientScheme,
    ExactDirectNearServerScheme,
    ExactDirectNearFacilitatorScheme,
    # Configurations
    ExactDirectNearClientConfig,
    ExactDirectNearServerConfig,
    ExactDirectNearFacilitatorConfig,
    # Signer protocols
    ClientNearSigner,
    FacilitatorNearSigner,
    # Payload types
    ExactDirectPayload,
    FtTransferArgs,
    # Validation
    is_valid_account_id,
    is_valid_network,
    # Constants
    SCHEME_EXACT_DIRECT,
    NEAR_MAINNET,
    NEAR_TESTNET,
    NEAR_MAINNET_RPC,
    NEAR_TESTNET_RPC,
    CAIP_FAMILY,
    DEFAULT_GAS,
    DEFAULT_GAS_INT,
    STORAGE_DEPOSIT,
    FUNCTION_FT_TRANSFER,
    # Token definitions
    USDT_MAINNET,
    USDT_TESTNET,
    USDC_MAINNET,
    USDC_TESTNET,
    # Data classes
    TokenInfo,
    NetworkConfig,
    # Lookup functions
    get_network_config,
    get_token_info,
    get_token_by_contract,
    get_supported_networks,
)
from t402.schemes.near.types import (
    TransactionStatus,
    parse_transaction_result,
)


# =============================================================================
# Mock Signers
# =============================================================================


class MockClientSigner:
    """Mock NEAR client signer for testing."""

    def __init__(
        self,
        account: str = "alice.near",
        tx_hash: str = "9FbCbRxfsCNvLh5tGU3wPnGxQqUn2KRrq5S9oZjHQa4d",
    ):
        self._account = account
        self._tx_hash = tx_hash
        self.last_receiver_id = None
        self.last_actions = None
        self.last_network = None

    def account_id(self) -> str:
        return self._account

    async def sign_and_send_transaction(
        self,
        receiver_id: str,
        actions: List[Dict[str, Any]],
        network: str,
    ) -> str:
        self.last_receiver_id = receiver_id
        self.last_actions = actions
        self.last_network = network
        return self._tx_hash


class MockFailingSigner:
    """Mock NEAR client signer that always fails."""

    def account_id(self) -> str:
        return "alice.near"

    async def sign_and_send_transaction(
        self,
        receiver_id: str,
        actions: List[Dict[str, Any]],
        network: str,
    ) -> str:
        raise RuntimeError("Transaction submission failed: network error")


class MockFacilitatorSigner:
    """Mock NEAR facilitator signer for testing."""

    def __init__(
        self,
        addresses: Optional[List[str]] = None,
        tx_result: Optional[Dict[str, Any]] = None,
    ):
        self._addresses = addresses or ["facilitator.near"]
        self._tx_result = tx_result
        self.query_count = 0

    def get_addresses(self, network: str) -> List[str]:
        return self._addresses

    async def query_transaction(
        self,
        tx_hash: str,
        sender_id: str,
        network: str,
    ) -> Dict[str, Any]:
        self.query_count += 1
        if self._tx_result is None:
            raise Exception("Transaction not found")
        return self._tx_result


# We need Optional imported for MockFacilitatorSigner
from typing import Optional


# =============================================================================
# Test Helpers
# =============================================================================


def make_successful_tx_result(
    receiver_id: str = "usdt.tether-token.near",
    signer_id: str = "alice.near",
    pay_to: str = "merchant.near",
    amount: str = "1000000",
) -> Dict[str, Any]:
    """Create a mock successful NEAR transaction result."""
    ft_transfer_args = json.dumps({
        "receiver_id": pay_to,
        "amount": amount,
    })
    args_b64 = base64.b64encode(ft_transfer_args.encode()).decode()

    return {
        "status": {"SuccessValue": ""},
        "transaction": {
            "hash": "9FbCbRxfsCNvLh5tGU3wPnGxQqUn2KRrq5S9oZjHQa4d",
            "signer_id": signer_id,
            "receiver_id": receiver_id,
            "actions": [
                {
                    "FunctionCall": {
                        "method_name": "ft_transfer",
                        "args": args_b64,
                        "gas": 30000000000000,
                        "deposit": "1",
                    }
                }
            ],
        },
    }


def make_requirements_dict(
    network: str = NEAR_MAINNET,
    asset: str = "usdt.tether-token.near",
    amount: str = "1000000",
    pay_to: str = "merchant.near",
) -> Dict[str, Any]:
    """Create a mock payment requirements dict."""
    return {
        "scheme": SCHEME_EXACT_DIRECT,
        "network": network,
        "asset": asset,
        "amount": amount,
        "payTo": pay_to,
        "maxTimeoutSeconds": 300,
        "extra": {},
    }


def make_payload_dict(
    tx_hash: str = "9FbCbRxfsCNvLh5tGU3wPnGxQqUn2KRrq5S9oZjHQa4d",
    from_account: str = "alice.near",
    to_account: str = "merchant.near",
    amount: str = "1000000",
) -> Dict[str, Any]:
    """Create a mock payment payload dict."""
    return {
        "payload": {
            "txHash": tx_hash,
            "from": from_account,
            "to": to_account,
            "amount": amount,
        }
    }


# =============================================================================
# Constants Tests
# =============================================================================


class TestConstants:
    """Test NEAR constants and identifiers."""

    def test_scheme_identifier(self):
        assert SCHEME_EXACT_DIRECT == "exact-direct"

    def test_network_identifiers(self):
        assert NEAR_MAINNET == "near:mainnet"
        assert NEAR_TESTNET == "near:testnet"

    def test_rpc_endpoints(self):
        assert NEAR_MAINNET_RPC == "https://rpc.mainnet.near.org"
        assert NEAR_TESTNET_RPC == "https://rpc.testnet.near.org"

    def test_caip_family(self):
        assert CAIP_FAMILY == "near:*"

    def test_default_gas(self):
        assert DEFAULT_GAS == "30000000000000"
        assert DEFAULT_GAS_INT == 30_000_000_000_000

    def test_storage_deposit(self):
        assert STORAGE_DEPOSIT == "1"

    def test_function_names(self):
        assert FUNCTION_FT_TRANSFER == "ft_transfer"


class TestTokenInfo:
    """Test TokenInfo data class."""

    def test_usdt_mainnet(self):
        assert USDT_MAINNET.contract_id == "usdt.tether-token.near"
        assert USDT_MAINNET.symbol == "USDT"
        assert USDT_MAINNET.decimals == 6

    def test_usdt_testnet(self):
        assert USDT_TESTNET.contract_id == "usdt.fakes.testnet"
        assert USDT_TESTNET.symbol == "USDT"
        assert USDT_TESTNET.decimals == 6

    def test_usdc_mainnet(self):
        assert USDC_MAINNET.contract_id == "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1"
        assert USDC_MAINNET.symbol == "USDC"
        assert USDC_MAINNET.decimals == 6

    def test_usdc_testnet(self):
        assert USDC_TESTNET.contract_id == "usdc.fakes.testnet"
        assert USDC_TESTNET.symbol == "USDC"
        assert USDC_TESTNET.decimals == 6

    def test_repr(self):
        repr_str = repr(USDT_MAINNET)
        assert "usdt.tether-token.near" in repr_str
        assert "USDT" in repr_str
        assert "6" in repr_str


class TestNetworkConfig:
    """Test network configuration lookups."""

    def test_mainnet_config(self):
        config = get_network_config(NEAR_MAINNET)
        assert config is not None
        assert config.network_id == "mainnet"
        assert config.rpc_url == NEAR_MAINNET_RPC
        assert config.default_token.symbol == "USDT"

    def test_testnet_config(self):
        config = get_network_config(NEAR_TESTNET)
        assert config is not None
        assert config.network_id == "testnet"
        assert config.rpc_url == NEAR_TESTNET_RPC
        assert config.default_token.symbol == "USDT"

    def test_unsupported_network(self):
        config = get_network_config("near:devnet")
        assert config is None

    def test_non_near_network(self):
        config = get_network_config("eip155:1")
        assert config is None


class TestNetworkValidation:
    """Test network validation."""

    def test_mainnet_valid(self):
        assert is_valid_network(NEAR_MAINNET) is True

    def test_testnet_valid(self):
        assert is_valid_network(NEAR_TESTNET) is True

    def test_devnet_invalid(self):
        assert is_valid_network("near:devnet") is False

    def test_empty_invalid(self):
        assert is_valid_network("") is False

    def test_evm_network_invalid(self):
        assert is_valid_network("eip155:1") is False


class TestTokenLookups:
    """Test token registry lookups."""

    def test_get_token_info_usdt_mainnet(self):
        token = get_token_info(NEAR_MAINNET, "USDT")
        assert token is not None
        assert token.contract_id == "usdt.tether-token.near"

    def test_get_token_info_usdc_mainnet(self):
        token = get_token_info(NEAR_MAINNET, "USDC")
        assert token is not None
        assert token.contract_id == "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1"

    def test_get_token_info_usdt_testnet(self):
        token = get_token_info(NEAR_TESTNET, "USDT")
        assert token is not None
        assert token.contract_id == "usdt.fakes.testnet"

    def test_get_token_info_unknown_symbol(self):
        token = get_token_info(NEAR_MAINNET, "DAI")
        assert token is None

    def test_get_token_info_unknown_network(self):
        token = get_token_info("near:devnet", "USDT")
        assert token is None

    def test_get_token_by_contract_mainnet(self):
        token = get_token_by_contract(NEAR_MAINNET, "usdt.tether-token.near")
        assert token is not None
        assert token.symbol == "USDT"

    def test_get_token_by_contract_unknown(self):
        token = get_token_by_contract(NEAR_MAINNET, "unknown.near")
        assert token is None

    def test_get_token_by_contract_unknown_network(self):
        token = get_token_by_contract("near:devnet", "usdt.tether-token.near")
        assert token is None

    def test_get_supported_networks(self):
        networks = get_supported_networks()
        assert NEAR_MAINNET in networks
        assert NEAR_TESTNET in networks
        assert len(networks) == 2


# =============================================================================
# Account ID Validation Tests
# =============================================================================


class TestAccountIdValidation:
    """Test NEAR account ID validation."""

    def test_valid_named_account(self):
        assert is_valid_account_id("alice.near") is True

    def test_valid_sub_account(self):
        assert is_valid_account_id("sub.alice.near") is True

    def test_valid_hyphenated_account(self):
        assert is_valid_account_id("usdt.tether-token.near") is True

    def test_valid_underscore_account(self):
        assert is_valid_account_id("my_account.testnet") is True

    def test_valid_testnet_account(self):
        assert is_valid_account_id("merchant.testnet") is True

    def test_valid_implicit_account(self):
        # 64 hex chars
        assert is_valid_account_id("a" * 64) is True

    def test_valid_implicit_hex(self):
        assert is_valid_account_id("17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1") is True

    def test_invalid_empty(self):
        assert is_valid_account_id("") is False

    def test_invalid_too_short(self):
        assert is_valid_account_id("a") is False

    def test_invalid_too_long(self):
        assert is_valid_account_id("a" * 65) is False

    def test_invalid_single_segment(self):
        # Named accounts need at least two dot-separated segments
        assert is_valid_account_id("alice") is False

    def test_invalid_uppercase(self):
        assert is_valid_account_id("Alice.near") is False

    def test_invalid_special_chars(self):
        assert is_valid_account_id("alice@.near") is False

    def test_invalid_spaces(self):
        assert is_valid_account_id("alice .near") is False


# =============================================================================
# Payload Types Tests
# =============================================================================


class TestExactDirectPayload:
    """Test ExactDirectPayload model."""

    def test_create_payload(self):
        payload = ExactDirectPayload(
            tx_hash="abc123hash",
            from_account="alice.near",
            to_account="merchant.near",
            amount="1000000",
        )
        assert payload.tx_hash == "abc123hash"
        assert payload.from_account == "alice.near"
        assert payload.to_account == "merchant.near"
        assert payload.amount == "1000000"

    def test_create_from_alias(self):
        data = {
            "txHash": "abc123hash",
            "from": "alice.near",
            "to": "merchant.near",
            "amount": "1000000",
        }
        payload = ExactDirectPayload.model_validate(data)
        assert payload.tx_hash == "abc123hash"
        assert payload.from_account == "alice.near"

    def test_to_map(self):
        payload = ExactDirectPayload(
            tx_hash="abc123hash",
            from_account="alice.near",
            to_account="merchant.near",
            amount="1000000",
        )
        result = payload.to_map()
        assert result["txHash"] == "abc123hash"
        assert result["from"] == "alice.near"
        assert result["to"] == "merchant.near"
        assert result["amount"] == "1000000"

    def test_from_map(self):
        data = {
            "txHash": "abc123hash",
            "from": "alice.near",
            "to": "merchant.near",
            "amount": "1000000",
        }
        payload = ExactDirectPayload.from_map(data)
        assert payload.tx_hash == "abc123hash"
        assert payload.from_account == "alice.near"

    def test_invalid_amount(self):
        with pytest.raises(ValueError):
            ExactDirectPayload(
                tx_hash="abc",
                from_account="alice.near",
                to_account="merchant.near",
                amount="not-a-number",
            )

    def test_zero_amount(self):
        payload = ExactDirectPayload(
            tx_hash="abc",
            from_account="alice.near",
            to_account="merchant.near",
            amount="0",
        )
        assert payload.amount == "0"


class TestFtTransferArgs:
    """Test FtTransferArgs model."""

    def test_basic_transfer(self):
        args = FtTransferArgs(
            receiver_id="merchant.near",
            amount="1000000",
        )
        assert args.receiver_id == "merchant.near"
        assert args.amount == "1000000"
        assert args.memo is None

    def test_transfer_with_memo(self):
        args = FtTransferArgs(
            receiver_id="merchant.near",
            amount="1000000",
            memo="Payment for API access",
        )
        assert args.memo == "Payment for API access"


class TestTransactionStatus:
    """Test TransactionStatus parsing."""

    def test_success(self):
        status = TransactionStatus.from_dict({"SuccessValue": ""})
        assert status.is_success() is True

    def test_failure(self):
        status = TransactionStatus.from_dict({"Failure": {"error": "some error"}})
        assert status.is_success() is False

    def test_empty(self):
        status = TransactionStatus.from_dict({})
        assert status.is_success() is False

    def test_success_with_value(self):
        status = TransactionStatus.from_dict({"SuccessValue": "dGVzdA=="})
        assert status.is_success() is True


class TestParseTransactionResult:
    """Test parse_transaction_result function."""

    def test_successful_ft_transfer(self):
        tx_result = make_successful_tx_result()
        parsed = parse_transaction_result(tx_result)

        assert parsed["status"].is_success() is True
        assert parsed["transaction"]["receiver_id"] == "usdt.tether-token.near"
        assert parsed["transaction"]["signer_id"] == "alice.near"
        assert parsed["ft_transfer_args"] is not None
        assert parsed["ft_transfer_args"].receiver_id == "merchant.near"
        assert parsed["ft_transfer_args"].amount == "1000000"

    def test_no_ft_transfer_action(self):
        tx_result = {
            "status": {"SuccessValue": ""},
            "transaction": {
                "hash": "abc",
                "signer_id": "alice.near",
                "receiver_id": "contract.near",
                "actions": [
                    {
                        "FunctionCall": {
                            "method_name": "some_other_method",
                            "args": base64.b64encode(b"{}").decode(),
                            "gas": 30000000000000,
                            "deposit": "0",
                        }
                    }
                ],
            },
        }
        parsed = parse_transaction_result(tx_result)
        assert parsed["ft_transfer_args"] is None

    def test_empty_data_raises(self):
        with pytest.raises(ValueError, match="Empty transaction data"):
            parse_transaction_result({})

    def test_missing_transaction_raises(self):
        with pytest.raises(ValueError, match="Missing transaction field"):
            parse_transaction_result({"status": {"SuccessValue": ""}})


# =============================================================================
# Client Scheme Tests
# =============================================================================


class TestExactDirectNearClientScheme:
    """Test the client scheme implementation."""

    def test_scheme_identifier(self):
        signer = MockClientSigner()
        scheme = ExactDirectNearClientScheme(signer)
        assert scheme.scheme == "exact-direct"

    def test_caip_family(self):
        signer = MockClientSigner()
        scheme = ExactDirectNearClientScheme(signer)
        assert scheme.caip_family == "near:*"

    def test_account_id(self):
        signer = MockClientSigner(account="bob.near")
        scheme = ExactDirectNearClientScheme(signer)
        assert scheme.account_id == "bob.near"

    @pytest.mark.asyncio
    async def test_create_payment_payload_success(self):
        signer = MockClientSigner(tx_hash="tx123hash")
        scheme = ExactDirectNearClientScheme(signer)

        requirements = make_requirements_dict()
        result = await scheme.create_payment_payload(2, requirements)

        assert result["t402Version"] == 2
        assert result["payload"]["txHash"] == "tx123hash"
        assert result["payload"]["from"] == "alice.near"
        assert result["payload"]["to"] == "merchant.near"
        assert result["payload"]["amount"] == "1000000"

    @pytest.mark.asyncio
    async def test_create_payload_sends_correct_action(self):
        signer = MockClientSigner()
        scheme = ExactDirectNearClientScheme(signer)

        requirements = make_requirements_dict()
        await scheme.create_payment_payload(2, requirements)

        # Verify the signer received correct parameters
        assert signer.last_receiver_id == "usdt.tether-token.near"
        assert signer.last_network == NEAR_MAINNET
        assert len(signer.last_actions) == 1

        action = signer.last_actions[0]["FunctionCall"]
        assert action["method_name"] == "ft_transfer"
        assert action["gas"] == DEFAULT_GAS_INT
        assert action["deposit"] == STORAGE_DEPOSIT

        # Verify ft_transfer args
        args = json.loads(action["args"])
        assert args["receiver_id"] == "merchant.near"
        assert args["amount"] == "1000000"

    @pytest.mark.asyncio
    async def test_create_payload_with_memo(self):
        signer = MockClientSigner()
        config = ExactDirectNearClientConfig(memo="T402 payment")
        scheme = ExactDirectNearClientScheme(signer, config=config)

        requirements = make_requirements_dict()
        await scheme.create_payment_payload(2, requirements)

        action = signer.last_actions[0]["FunctionCall"]
        args = json.loads(action["args"])
        assert args["memo"] == "T402 payment"

    @pytest.mark.asyncio
    async def test_create_payload_with_custom_gas(self):
        signer = MockClientSigner()
        config = ExactDirectNearClientConfig(gas_amount=50_000_000_000_000)
        scheme = ExactDirectNearClientScheme(signer, config=config)

        requirements = make_requirements_dict()
        await scheme.create_payment_payload(2, requirements)

        action = signer.last_actions[0]["FunctionCall"]
        assert action["gas"] == 50_000_000_000_000

    @pytest.mark.asyncio
    async def test_create_payload_testnet(self):
        signer = MockClientSigner(account="alice.testnet")
        scheme = ExactDirectNearClientScheme(signer)

        requirements = make_requirements_dict(
            network=NEAR_TESTNET,
            asset="usdt.fakes.testnet",
            pay_to="merchant.testnet",
        )
        result = await scheme.create_payment_payload(2, requirements)

        assert result["payload"]["from"] == "alice.testnet"
        assert result["payload"]["to"] == "merchant.testnet"

    @pytest.mark.asyncio
    async def test_create_payload_invalid_network(self):
        signer = MockClientSigner()
        scheme = ExactDirectNearClientScheme(signer)

        requirements = make_requirements_dict(network="near:devnet")
        with pytest.raises(ValueError, match="Unsupported network"):
            await scheme.create_payment_payload(2, requirements)

    @pytest.mark.asyncio
    async def test_create_payload_missing_asset(self):
        signer = MockClientSigner()
        scheme = ExactDirectNearClientScheme(signer)

        requirements = make_requirements_dict(asset="")
        with pytest.raises(ValueError, match="Asset.*required"):
            await scheme.create_payment_payload(2, requirements)

    @pytest.mark.asyncio
    async def test_create_payload_missing_pay_to(self):
        signer = MockClientSigner()
        scheme = ExactDirectNearClientScheme(signer)

        requirements = make_requirements_dict(pay_to="")
        with pytest.raises(ValueError, match="payTo.*required"):
            await scheme.create_payment_payload(2, requirements)

    @pytest.mark.asyncio
    async def test_create_payload_missing_amount(self):
        signer = MockClientSigner()
        scheme = ExactDirectNearClientScheme(signer)

        requirements = make_requirements_dict(amount="")
        with pytest.raises(ValueError, match="Amount.*required"):
            await scheme.create_payment_payload(2, requirements)

    @pytest.mark.asyncio
    async def test_create_payload_invalid_recipient(self):
        signer = MockClientSigner()
        scheme = ExactDirectNearClientScheme(signer)

        requirements = make_requirements_dict(pay_to="X")
        with pytest.raises(ValueError, match="Invalid recipient"):
            await scheme.create_payment_payload(2, requirements)

    @pytest.mark.asyncio
    async def test_create_payload_invalid_sender(self):
        signer = MockClientSigner(account="X")
        scheme = ExactDirectNearClientScheme(signer)

        requirements = make_requirements_dict()
        with pytest.raises(ValueError, match="Invalid sender"):
            await scheme.create_payment_payload(2, requirements)

    @pytest.mark.asyncio
    async def test_create_payload_transaction_failure(self):
        signer = MockFailingSigner()
        scheme = ExactDirectNearClientScheme(signer)

        requirements = make_requirements_dict()
        with pytest.raises(RuntimeError, match="Failed to execute ft_transfer"):
            await scheme.create_payment_payload(2, requirements)

    @pytest.mark.asyncio
    async def test_create_payload_v1_version(self):
        signer = MockClientSigner()
        scheme = ExactDirectNearClientScheme(signer)

        requirements = make_requirements_dict()
        result = await scheme.create_payment_payload(1, requirements)

        assert result["t402Version"] == 1


# =============================================================================
# Server Scheme Tests
# =============================================================================


class TestExactDirectNearServerScheme:
    """Test the server scheme implementation."""

    def test_scheme_identifier(self):
        scheme = ExactDirectNearServerScheme()
        assert scheme.scheme == "exact-direct"

    def test_caip_family(self):
        scheme = ExactDirectNearServerScheme()
        assert scheme.caip_family == "near:*"

    @pytest.mark.asyncio
    async def test_parse_price_dollar_string(self):
        scheme = ExactDirectNearServerScheme()
        result = await scheme.parse_price("$1.50", NEAR_MAINNET)

        assert result["amount"] == "1500000"
        assert result["asset"] == "usdt.tether-token.near"
        assert result["extra"]["symbol"] == "USDT"
        assert result["extra"]["decimals"] == 6

    @pytest.mark.asyncio
    async def test_parse_price_plain_string(self):
        scheme = ExactDirectNearServerScheme()
        result = await scheme.parse_price("0.01", NEAR_MAINNET)

        assert result["amount"] == "10000"

    @pytest.mark.asyncio
    async def test_parse_price_float(self):
        scheme = ExactDirectNearServerScheme()
        result = await scheme.parse_price(2.5, NEAR_MAINNET)

        assert result["amount"] == "2500000"

    @pytest.mark.asyncio
    async def test_parse_price_int(self):
        scheme = ExactDirectNearServerScheme()
        result = await scheme.parse_price(10, NEAR_MAINNET)

        assert result["amount"] == "10000000"

    @pytest.mark.asyncio
    async def test_parse_price_zero(self):
        scheme = ExactDirectNearServerScheme()
        result = await scheme.parse_price("0", NEAR_MAINNET)

        assert result["amount"] == "0"

    @pytest.mark.asyncio
    async def test_parse_price_small_amount(self):
        scheme = ExactDirectNearServerScheme()
        result = await scheme.parse_price("0.000001", NEAR_MAINNET)

        assert result["amount"] == "1"

    @pytest.mark.asyncio
    async def test_parse_price_large_amount(self):
        scheme = ExactDirectNearServerScheme()
        result = await scheme.parse_price("1000000", NEAR_MAINNET)

        assert result["amount"] == "1000000000000"

    @pytest.mark.asyncio
    async def test_parse_price_dict_format(self):
        scheme = ExactDirectNearServerScheme()
        result = await scheme.parse_price(
            {"amount": "500000", "asset": "usdt.tether-token.near"},
            NEAR_MAINNET,
        )

        assert result["amount"] == "500000"
        assert result["asset"] == "usdt.tether-token.near"

    @pytest.mark.asyncio
    async def test_parse_price_dict_with_extra(self):
        scheme = ExactDirectNearServerScheme()
        result = await scheme.parse_price(
            {"amount": "500000", "extra": {"custom": "value"}},
            NEAR_MAINNET,
        )

        assert result["extra"]["custom"] == "value"

    @pytest.mark.asyncio
    async def test_parse_price_testnet(self):
        scheme = ExactDirectNearServerScheme()
        result = await scheme.parse_price("$1.00", NEAR_TESTNET)

        assert result["amount"] == "1000000"
        assert result["asset"] == "usdt.fakes.testnet"

    @pytest.mark.asyncio
    async def test_parse_price_unsupported_network(self):
        scheme = ExactDirectNearServerScheme()
        with pytest.raises(ValueError, match="Unsupported network"):
            await scheme.parse_price("$1.00", "near:devnet")

    @pytest.mark.asyncio
    async def test_parse_price_invalid_string(self):
        scheme = ExactDirectNearServerScheme()
        with pytest.raises(ValueError, match="Failed to parse"):
            await scheme.parse_price("not-a-number", NEAR_MAINNET)

    @pytest.mark.asyncio
    async def test_parse_price_preferred_token_usdc(self):
        config = ExactDirectNearServerConfig(preferred_token="USDC")
        scheme = ExactDirectNearServerScheme(config=config)
        result = await scheme.parse_price("$1.00", NEAR_MAINNET)

        assert result["asset"] == "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1"
        assert result["extra"]["symbol"] == "USDC"

    @pytest.mark.asyncio
    async def test_enhance_requirements_sets_asset(self):
        scheme = ExactDirectNearServerScheme()
        requirements = {
            "scheme": SCHEME_EXACT_DIRECT,
            "network": NEAR_MAINNET,
            "asset": "",
            "amount": "1000000",
            "payTo": "merchant.near",
            "maxTimeoutSeconds": 300,
        }
        supported_kind = {
            "t402Version": 2,
            "scheme": SCHEME_EXACT_DIRECT,
            "network": NEAR_MAINNET,
            "extra": {"assetSymbol": "USDT", "assetDecimals": 6},
        }

        result = await scheme.enhance_requirements(requirements, supported_kind, [])

        assert result["asset"] == "usdt.tether-token.near"
        assert result["extra"]["assetSymbol"] == "USDT"
        assert result["extra"]["assetDecimals"] == 6

    @pytest.mark.asyncio
    async def test_enhance_requirements_preserves_existing_asset(self):
        scheme = ExactDirectNearServerScheme()
        requirements = {
            "scheme": SCHEME_EXACT_DIRECT,
            "network": NEAR_MAINNET,
            "asset": "custom-token.near",
            "amount": "1000000",
            "payTo": "merchant.near",
            "maxTimeoutSeconds": 300,
        }
        supported_kind = {"t402Version": 2, "scheme": SCHEME_EXACT_DIRECT, "network": NEAR_MAINNET}

        result = await scheme.enhance_requirements(requirements, supported_kind, [])

        assert result["asset"] == "custom-token.near"

    @pytest.mark.asyncio
    async def test_enhance_requirements_converts_decimal_amount(self):
        scheme = ExactDirectNearServerScheme()
        requirements = {
            "scheme": SCHEME_EXACT_DIRECT,
            "network": NEAR_MAINNET,
            "asset": "usdt.tether-token.near",
            "amount": "1.50",
            "payTo": "merchant.near",
            "maxTimeoutSeconds": 300,
        }
        supported_kind = {"t402Version": 2, "scheme": SCHEME_EXACT_DIRECT, "network": NEAR_MAINNET}

        result = await scheme.enhance_requirements(requirements, supported_kind, [])

        assert result["amount"] == "1500000"

    @pytest.mark.asyncio
    async def test_enhance_requirements_copies_extension_keys(self):
        scheme = ExactDirectNearServerScheme()
        requirements = make_requirements_dict()
        supported_kind = {
            "t402Version": 2,
            "scheme": SCHEME_EXACT_DIRECT,
            "network": NEAR_MAINNET,
            "extra": {"customExtension": "value123"},
        }

        result = await scheme.enhance_requirements(
            requirements, supported_kind, ["customExtension"]
        )

        assert result["extra"]["customExtension"] == "value123"

    @pytest.mark.asyncio
    async def test_enhance_requirements_invalid_network(self):
        scheme = ExactDirectNearServerScheme()
        requirements = make_requirements_dict(network="near:devnet")
        supported_kind = {"t402Version": 2, "scheme": SCHEME_EXACT_DIRECT, "network": "near:devnet"}

        with pytest.raises(ValueError, match="Unsupported network"):
            await scheme.enhance_requirements(requirements, supported_kind, [])


# =============================================================================
# Facilitator Scheme Tests
# =============================================================================


class TestExactDirectNearFacilitatorScheme:
    """Test the facilitator scheme implementation."""

    def test_scheme_identifier(self):
        signer = MockFacilitatorSigner()
        facilitator = ExactDirectNearFacilitatorScheme(signer)
        assert facilitator.scheme == "exact-direct"

    def test_caip_family(self):
        signer = MockFacilitatorSigner()
        facilitator = ExactDirectNearFacilitatorScheme(signer)
        assert facilitator.caip_family == "near:*"

    def test_get_signers(self):
        signer = MockFacilitatorSigner(addresses=["facilitator.near", "backup.near"])
        facilitator = ExactDirectNearFacilitatorScheme(signer)

        signers = facilitator.get_signers(NEAR_MAINNET)
        assert signers == ["facilitator.near", "backup.near"]

    def test_get_extra_mainnet(self):
        signer = MockFacilitatorSigner()
        facilitator = ExactDirectNearFacilitatorScheme(signer)

        extra = facilitator.get_extra(NEAR_MAINNET)
        assert extra is not None
        assert extra["assetSymbol"] == "USDT"
        assert extra["assetDecimals"] == 6

    def test_get_extra_testnet(self):
        signer = MockFacilitatorSigner()
        facilitator = ExactDirectNearFacilitatorScheme(signer)

        extra = facilitator.get_extra(NEAR_TESTNET)
        assert extra is not None
        assert extra["assetSymbol"] == "USDT"
        assert extra["assetDecimals"] == 6

    def test_get_extra_unknown_network(self):
        signer = MockFacilitatorSigner()
        facilitator = ExactDirectNearFacilitatorScheme(signer)

        extra = facilitator.get_extra("near:devnet")
        assert extra is None

    @pytest.mark.asyncio
    async def test_verify_success(self):
        tx_result = make_successful_tx_result()
        signer = MockFacilitatorSigner(tx_result=tx_result)
        facilitator = ExactDirectNearFacilitatorScheme(signer)

        payload = make_payload_dict()
        requirements = make_requirements_dict()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True
        assert result.payer == "alice.near"
        assert result.invalid_reason is None

    @pytest.mark.asyncio
    async def test_verify_missing_tx_hash(self):
        signer = MockFacilitatorSigner()
        facilitator = ExactDirectNearFacilitatorScheme(signer)

        payload = {"payload": {"txHash": "", "from": "alice.near", "to": "merchant.near", "amount": "1000000"}}
        requirements = make_requirements_dict()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "Missing transaction hash" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_missing_from(self):
        signer = MockFacilitatorSigner()
        facilitator = ExactDirectNearFacilitatorScheme(signer)

        payload = {"payload": {"txHash": "abc123", "from": "", "to": "merchant.near", "amount": "1000000"}}
        requirements = make_requirements_dict()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "Missing sender" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_transaction_not_found(self):
        signer = MockFacilitatorSigner(tx_result=None)  # Will raise exception
        facilitator = ExactDirectNearFacilitatorScheme(signer)

        payload = make_payload_dict()
        requirements = make_requirements_dict()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "Transaction not found" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_transaction_failed(self):
        tx_result = {
            "status": {"Failure": {"error": "some error"}},
            "transaction": {
                "hash": "abc",
                "signer_id": "alice.near",
                "receiver_id": "usdt.tether-token.near",
                "actions": [],
            },
        }
        signer = MockFacilitatorSigner(tx_result=tx_result)
        facilitator = ExactDirectNearFacilitatorScheme(signer)

        payload = make_payload_dict()
        requirements = make_requirements_dict()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "failed on-chain" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_wrong_token_contract(self):
        tx_result = make_successful_tx_result(receiver_id="wrong-token.near")
        signer = MockFacilitatorSigner(tx_result=tx_result)
        facilitator = ExactDirectNearFacilitatorScheme(signer)

        payload = make_payload_dict()
        requirements = make_requirements_dict()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "Wrong token contract" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_wrong_recipient(self):
        tx_result = make_successful_tx_result(pay_to="wrong-recipient.near")
        signer = MockFacilitatorSigner(tx_result=tx_result)
        facilitator = ExactDirectNearFacilitatorScheme(signer)

        payload = make_payload_dict()
        requirements = make_requirements_dict()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "Wrong recipient" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_insufficient_amount(self):
        tx_result = make_successful_tx_result(amount="500000")  # Less than required
        signer = MockFacilitatorSigner(tx_result=tx_result)
        facilitator = ExactDirectNearFacilitatorScheme(signer)

        payload = make_payload_dict()
        requirements = make_requirements_dict(amount="1000000")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "Insufficient amount" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_exact_amount(self):
        tx_result = make_successful_tx_result(amount="1000000")
        signer = MockFacilitatorSigner(tx_result=tx_result)
        facilitator = ExactDirectNearFacilitatorScheme(signer)

        payload = make_payload_dict()
        requirements = make_requirements_dict(amount="1000000")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_excess_amount_accepted(self):
        tx_result = make_successful_tx_result(amount="2000000")  # More than required
        signer = MockFacilitatorSigner(tx_result=tx_result)
        facilitator = ExactDirectNearFacilitatorScheme(signer)

        payload = make_payload_dict()
        requirements = make_requirements_dict(amount="1000000")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_no_ft_transfer_action(self):
        tx_result = {
            "status": {"SuccessValue": ""},
            "transaction": {
                "hash": "abc",
                "signer_id": "alice.near",
                "receiver_id": "usdt.tether-token.near",
                "actions": [
                    {
                        "FunctionCall": {
                            "method_name": "other_method",
                            "args": base64.b64encode(b"{}").decode(),
                            "gas": 30000000000000,
                            "deposit": "0",
                        }
                    }
                ],
            },
        }
        signer = MockFacilitatorSigner(tx_result=tx_result)
        facilitator = ExactDirectNearFacilitatorScheme(signer)

        payload = make_payload_dict()
        requirements = make_requirements_dict()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "No ft_transfer action" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_replay_protection(self):
        """Test that the same transaction cannot be used twice."""
        tx_result = make_successful_tx_result()
        signer = MockFacilitatorSigner(tx_result=tx_result)
        facilitator = ExactDirectNearFacilitatorScheme(signer)

        payload = make_payload_dict()
        requirements = make_requirements_dict()

        # First verification should succeed
        result1 = await facilitator.verify(payload, requirements)
        assert result1.is_valid is True

        # Second verification with same tx should fail
        result2 = await facilitator.verify(payload, requirements)
        assert result2.is_valid is False
        assert "already been used" in result2.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_different_transactions_allowed(self):
        """Test that different transactions can be verified."""
        tx_result1 = make_successful_tx_result()
        signer = MockFacilitatorSigner(tx_result=tx_result1)
        facilitator = ExactDirectNearFacilitatorScheme(signer)

        payload1 = make_payload_dict(tx_hash="hash1")
        payload2 = make_payload_dict(tx_hash="hash2")
        requirements = make_requirements_dict()

        result1 = await facilitator.verify(payload1, requirements)
        assert result1.is_valid is True

        result2 = await facilitator.verify(payload2, requirements)
        assert result2.is_valid is True

    @pytest.mark.asyncio
    async def test_settle_success(self):
        tx_result = make_successful_tx_result()
        signer = MockFacilitatorSigner(tx_result=tx_result)
        facilitator = ExactDirectNearFacilitatorScheme(signer)

        payload = make_payload_dict()
        requirements = make_requirements_dict()

        result = await facilitator.settle(payload, requirements)

        assert result.success is True
        assert result.transaction == "9FbCbRxfsCNvLh5tGU3wPnGxQqUn2KRrq5S9oZjHQa4d"
        assert result.network == NEAR_MAINNET
        assert result.payer == "alice.near"
        assert result.error_reason is None

    @pytest.mark.asyncio
    async def test_settle_verify_failure(self):
        signer = MockFacilitatorSigner(tx_result=None)  # Will cause verify to fail
        facilitator = ExactDirectNearFacilitatorScheme(signer)

        payload = make_payload_dict()
        requirements = make_requirements_dict()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert result.error_reason is not None

    @pytest.mark.asyncio
    async def test_settle_testnet(self):
        tx_result = make_successful_tx_result(
            receiver_id="usdt.fakes.testnet",
            pay_to="merchant.testnet",
        )
        signer = MockFacilitatorSigner(tx_result=tx_result)
        facilitator = ExactDirectNearFacilitatorScheme(signer)

        payload = make_payload_dict(to_account="merchant.testnet")
        requirements = make_requirements_dict(
            network=NEAR_TESTNET,
            asset="usdt.fakes.testnet",
            pay_to="merchant.testnet",
        )

        result = await facilitator.settle(payload, requirements)

        assert result.success is True
        assert result.network == NEAR_TESTNET

    @pytest.mark.asyncio
    async def test_facilitator_config_defaults(self):
        config = ExactDirectNearFacilitatorConfig()
        assert config.max_transaction_age_seconds == 300
        assert config.used_tx_cache_duration_seconds == 86400

    @pytest.mark.asyncio
    async def test_facilitator_custom_config(self):
        config = ExactDirectNearFacilitatorConfig(
            max_transaction_age_seconds=600,
            used_tx_cache_duration_seconds=3600,
        )
        signer = MockFacilitatorSigner()
        facilitator = ExactDirectNearFacilitatorScheme(signer, config=config)

        assert facilitator._config.max_transaction_age_seconds == 600
        assert facilitator._config.used_tx_cache_duration_seconds == 3600


# =============================================================================
# Integration-Style Tests
# =============================================================================


class TestEndToEndFlow:
    """Test the full client -> server -> facilitator flow."""

    @pytest.mark.asyncio
    async def test_full_payment_flow(self):
        """Test the complete payment flow from price parsing to settlement."""
        # 1. Server parses the price
        server = ExactDirectNearServerScheme()
        asset_amount = await server.parse_price("$1.00", NEAR_MAINNET)

        assert asset_amount["amount"] == "1000000"
        assert asset_amount["asset"] == "usdt.tether-token.near"

        # 2. Server enhances requirements
        requirements = {
            "scheme": SCHEME_EXACT_DIRECT,
            "network": NEAR_MAINNET,
            "asset": asset_amount["asset"],
            "amount": asset_amount["amount"],
            "payTo": "merchant.near",
            "maxTimeoutSeconds": 300,
        }
        supported_kind = {
            "t402Version": 2,
            "scheme": SCHEME_EXACT_DIRECT,
            "network": NEAR_MAINNET,
            "extra": {"assetSymbol": "USDT", "assetDecimals": 6},
        }
        enhanced = await server.enhance_requirements(requirements, supported_kind, [])

        assert enhanced["extra"]["assetSymbol"] == "USDT"

        # 3. Client creates payment payload
        tx_hash = "9FbCbRxfsCNvLh5tGU3wPnGxQqUn2KRrq5S9oZjHQa4d"
        client_signer = MockClientSigner(account="alice.near", tx_hash=tx_hash)
        client = ExactDirectNearClientScheme(client_signer)

        payload_result = await client.create_payment_payload(2, enhanced)

        assert payload_result["t402Version"] == 2
        assert payload_result["payload"]["txHash"] == tx_hash
        assert payload_result["payload"]["from"] == "alice.near"

        # 4. Facilitator verifies the payment
        tx_result = make_successful_tx_result(
            receiver_id="usdt.tether-token.near",
            signer_id="alice.near",
            pay_to="merchant.near",
            amount="1000000",
        )
        facilitator_signer = MockFacilitatorSigner(tx_result=tx_result)
        facilitator = ExactDirectNearFacilitatorScheme(facilitator_signer)

        verify_result = await facilitator.verify(
            {"payload": payload_result["payload"]},
            enhanced,
        )

        assert verify_result.is_valid is True
        assert verify_result.payer == "alice.near"

    @pytest.mark.asyncio
    async def test_testnet_flow(self):
        """Test the payment flow on testnet."""
        # Server
        server = ExactDirectNearServerScheme()
        asset_amount = await server.parse_price("$0.50", NEAR_TESTNET)

        assert asset_amount["asset"] == "usdt.fakes.testnet"
        assert asset_amount["amount"] == "500000"

        # Client
        client_signer = MockClientSigner(
            account="alice.testnet",
            tx_hash="testnet_hash_123",
        )
        client = ExactDirectNearClientScheme(client_signer)

        requirements = {
            "scheme": SCHEME_EXACT_DIRECT,
            "network": NEAR_TESTNET,
            "asset": "usdt.fakes.testnet",
            "amount": "500000",
            "payTo": "merchant.testnet",
            "maxTimeoutSeconds": 300,
            "extra": {},
        }

        payload = await client.create_payment_payload(2, requirements)
        assert payload["payload"]["from"] == "alice.testnet"

        # Facilitator
        tx_result = make_successful_tx_result(
            receiver_id="usdt.fakes.testnet",
            signer_id="alice.testnet",
            pay_to="merchant.testnet",
            amount="500000",
        )
        fac_signer = MockFacilitatorSigner(tx_result=tx_result)
        facilitator = ExactDirectNearFacilitatorScheme(fac_signer)

        result = await facilitator.settle(
            {"payload": payload["payload"]},
            requirements,
        )

        assert result.success is True
        assert result.transaction == "testnet_hash_123"
        assert result.network == NEAR_TESTNET


# =============================================================================
# Protocol Compliance Tests
# =============================================================================


class TestProtocolCompliance:
    """Test that implementations satisfy the Protocol interfaces."""

    def test_client_is_protocol_compatible(self):
        """ExactDirectNearClientScheme should have scheme and create_payment_payload."""
        signer = MockClientSigner()
        client = ExactDirectNearClientScheme(signer)

        assert hasattr(client, "scheme")
        assert hasattr(client, "create_payment_payload")
        assert client.scheme == SCHEME_EXACT_DIRECT

    def test_server_is_protocol_compatible(self):
        """ExactDirectNearServerScheme should have scheme, parse_price, enhance_requirements."""
        server = ExactDirectNearServerScheme()

        assert hasattr(server, "scheme")
        assert hasattr(server, "parse_price")
        assert hasattr(server, "enhance_requirements")
        assert server.scheme == SCHEME_EXACT_DIRECT

    def test_facilitator_is_protocol_compatible(self):
        """ExactDirectNearFacilitatorScheme should have scheme, caip_family, verify, settle, etc."""
        signer = MockFacilitatorSigner()
        facilitator = ExactDirectNearFacilitatorScheme(signer)

        assert hasattr(facilitator, "scheme")
        assert hasattr(facilitator, "caip_family")
        assert hasattr(facilitator, "get_extra")
        assert hasattr(facilitator, "get_signers")
        assert hasattr(facilitator, "verify")
        assert hasattr(facilitator, "settle")
        assert facilitator.scheme == SCHEME_EXACT_DIRECT
        assert facilitator.caip_family == CAIP_FAMILY

    def test_mock_client_signer_satisfies_protocol(self):
        """MockClientSigner should satisfy ClientNearSigner protocol."""
        signer = MockClientSigner()
        assert isinstance(signer, ClientNearSigner)

    def test_mock_facilitator_signer_satisfies_protocol(self):
        """MockFacilitatorSigner should satisfy FacilitatorNearSigner protocol."""
        signer = MockFacilitatorSigner()
        assert isinstance(signer, FacilitatorNearSigner)
