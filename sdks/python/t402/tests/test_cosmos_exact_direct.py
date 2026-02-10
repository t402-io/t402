"""Comprehensive tests for the Cosmos/Noble exact-direct payment scheme.

Tests cover:
- Client scheme (payload creation, validation)
- Server scheme (price parsing, requirements enhancement)
- Facilitator scheme (verification, settlement, replay protection)
- End-to-end flow
- Protocol compliance
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import pytest

from t402.schemes.cosmos import (
    # Scheme implementations
    ExactDirectCosmosClientScheme,
    ExactDirectCosmosServerScheme,
    ExactDirectCosmosFacilitatorScheme,
    # Configurations
    ExactDirectCosmosFacilitatorConfig,
    # Signer protocols
    ClientCosmosSigner,
    FacilitatorCosmosSigner,
    # Payload types
    TransactionResult,
    SCHEME_EXACT_DIRECT,
    COSMOS_NOBLE_MAINNET,
    COSMOS_NOBLE_TESTNET,
    CAIP_FAMILY,
    MSG_TYPE_SEND,
)


# =============================================================================
# Mock Signers
# =============================================================================


class MockClientSigner:
    """Mock Cosmos client signer for testing."""

    def __init__(
        self,
        addr: str = "noble1sender123abc",
        tx_hash: str = "AABB1122CCDD3344EEFF",
    ):
        self._addr = addr
        self._tx_hash = tx_hash
        self.last_network = None
        self.last_to = None
        self.last_amount = None
        self.last_denom = None

    def address(self) -> str:
        return self._addr

    async def send_tokens(
        self,
        network: str,
        to: str,
        amount: str,
        denom: str,
    ) -> str:
        self.last_network = network
        self.last_to = to
        self.last_amount = amount
        self.last_denom = denom
        return self._tx_hash


class MockFailingSigner:
    """Mock Cosmos client signer that always fails."""

    def address(self) -> str:
        return "noble1sender123abc"

    async def send_tokens(
        self,
        network: str,
        to: str,
        amount: str,
        denom: str,
    ) -> str:
        raise RuntimeError("Transaction submission failed: network error")


class MockFacilitatorSigner:
    """Mock Cosmos facilitator signer for testing."""

    def __init__(
        self,
        addresses: Optional[List[str]] = None,
        tx_result: Optional[TransactionResult] = None,
        balance: str = "0",
    ):
        self._addresses = addresses or ["noble1facilitator123"]
        self._tx_result = tx_result
        self._balance = balance
        self.query_count = 0

    def get_addresses(self, network: str) -> List[str]:
        return self._addresses

    async def query_transaction(
        self,
        network: str,
        tx_hash: str,
    ) -> TransactionResult:
        self.query_count += 1
        if self._tx_result is None:
            raise Exception("Transaction not found")
        return self._tx_result

    async def get_balance(
        self,
        network: str,
        address: str,
        denom: str,
    ) -> str:
        return self._balance


# =============================================================================
# Test Helpers
# =============================================================================


def make_successful_tx_result(
    from_address: str = "noble1sender123abc",
    to_address: str = "noble1merchant456def",
    amount: str = "1000000",
    denom: str = "uusdc",
    tx_hash: str = "AABB1122CCDD3344EEFF",
) -> TransactionResult:
    """Create a mock successful Cosmos transaction result."""
    return TransactionResult(
        tx_hash=tx_hash,
        height="12345",
        code=0,
        raw_log="",
        messages=[
            {
                "@type": MSG_TYPE_SEND,
                "from_address": from_address,
                "to_address": to_address,
                "amount": [{"denom": denom, "amount": amount}],
            }
        ],
        gas_wanted="200000",
        gas_used="150000",
        timestamp="2026-01-01T00:00:00Z",
    )


def make_requirements_dict(
    network: str = COSMOS_NOBLE_MAINNET,
    asset: str = "uusdc",
    amount: str = "1000000",
    pay_to: str = "noble1merchant456def",
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
    tx_hash: str = "AABB1122CCDD3344EEFF",
    from_address: str = "noble1sender123abc",
    to_address: str = "noble1merchant456def",
    amount: str = "1000000",
) -> Dict[str, Any]:
    """Create a mock payment payload dict."""
    return {
        "payload": {
            "txHash": tx_hash,
            "from": from_address,
            "to": to_address,
            "amount": amount,
        }
    }


# =============================================================================
# Client Scheme Tests
# =============================================================================


class TestExactDirectCosmosClientScheme:
    """Test the client scheme implementation."""

    def test_scheme_identifier(self):
        signer = MockClientSigner()
        scheme = ExactDirectCosmosClientScheme(signer)
        assert scheme.scheme == "exact-direct"

    def test_caip_family(self):
        signer = MockClientSigner()
        scheme = ExactDirectCosmosClientScheme(signer)
        assert scheme.caip_family == "cosmos:*"

    def test_signer_address(self):
        signer = MockClientSigner(addr="noble1myaddr")
        scheme = ExactDirectCosmosClientScheme(signer)
        assert scheme.signer_address == "noble1myaddr"

    @pytest.mark.asyncio
    async def test_create_payment_payload_success(self):
        signer = MockClientSigner(tx_hash="TX_HASH_123")
        scheme = ExactDirectCosmosClientScheme(signer)

        requirements = make_requirements_dict()
        result = await scheme.create_payment_payload(2, requirements)

        assert result["t402Version"] == 2
        assert result["payload"]["txHash"] == "TX_HASH_123"
        assert result["payload"]["from"] == "noble1sender123abc"
        assert result["payload"]["to"] == "noble1merchant456def"
        assert result["payload"]["amount"] == "1000000"

    @pytest.mark.asyncio
    async def test_create_payload_sends_correct_params(self):
        signer = MockClientSigner()
        scheme = ExactDirectCosmosClientScheme(signer)

        requirements = make_requirements_dict()
        await scheme.create_payment_payload(2, requirements)

        assert signer.last_network == COSMOS_NOBLE_MAINNET
        assert signer.last_to == "noble1merchant456def"
        assert signer.last_amount == "1000000"
        assert signer.last_denom == "uusdc"

    @pytest.mark.asyncio
    async def test_create_payload_with_symbol_asset(self):
        """When asset is a symbol like 'USDC', it should resolve to denom."""
        signer = MockClientSigner()
        scheme = ExactDirectCosmosClientScheme(signer)

        requirements = make_requirements_dict(asset="USDC")
        await scheme.create_payment_payload(2, requirements)

        assert signer.last_denom == "uusdc"

    @pytest.mark.asyncio
    async def test_create_payload_with_custom_denom(self):
        """When asset is already a denom, use it directly."""
        signer = MockClientSigner()
        scheme = ExactDirectCosmosClientScheme(signer)

        requirements = make_requirements_dict(asset="ibc/abc123")
        await scheme.create_payment_payload(2, requirements)

        assert signer.last_denom == "ibc/abc123"

    @pytest.mark.asyncio
    async def test_create_payload_no_asset_defaults_to_uusdc(self):
        """When no asset specified, default to uusdc."""
        signer = MockClientSigner()
        scheme = ExactDirectCosmosClientScheme(signer)

        requirements = make_requirements_dict(asset="")
        await scheme.create_payment_payload(2, requirements)

        assert signer.last_denom == "uusdc"

    @pytest.mark.asyncio
    async def test_create_payload_testnet(self):
        signer = MockClientSigner(addr="noble1testsender")
        scheme = ExactDirectCosmosClientScheme(signer)

        requirements = make_requirements_dict(
            network=COSMOS_NOBLE_TESTNET,
            pay_to="noble1testmerchant",
        )
        result = await scheme.create_payment_payload(2, requirements)

        assert result["payload"]["from"] == "noble1testsender"
        assert result["payload"]["to"] == "noble1testmerchant"

    @pytest.mark.asyncio
    async def test_create_payload_invalid_network(self):
        signer = MockClientSigner()
        scheme = ExactDirectCosmosClientScheme(signer)

        requirements = make_requirements_dict(network="cosmos:unknown-1")
        with pytest.raises(ValueError, match="Unsupported network"):
            await scheme.create_payment_payload(2, requirements)

    @pytest.mark.asyncio
    async def test_create_payload_missing_pay_to(self):
        signer = MockClientSigner()
        scheme = ExactDirectCosmosClientScheme(signer)

        requirements = make_requirements_dict(pay_to="")
        with pytest.raises(ValueError, match="payTo.*required"):
            await scheme.create_payment_payload(2, requirements)

    @pytest.mark.asyncio
    async def test_create_payload_missing_amount(self):
        signer = MockClientSigner()
        scheme = ExactDirectCosmosClientScheme(signer)

        requirements = make_requirements_dict(amount="")
        with pytest.raises(ValueError, match="Amount.*required"):
            await scheme.create_payment_payload(2, requirements)

    @pytest.mark.asyncio
    async def test_create_payload_invalid_recipient(self):
        signer = MockClientSigner()
        scheme = ExactDirectCosmosClientScheme(signer)

        requirements = make_requirements_dict(pay_to="cosmos1wrong")
        with pytest.raises(ValueError, match="Invalid recipient"):
            await scheme.create_payment_payload(2, requirements)

    @pytest.mark.asyncio
    async def test_create_payload_invalid_sender(self):
        signer = MockClientSigner(addr="cosmos1wrong")
        scheme = ExactDirectCosmosClientScheme(signer)

        requirements = make_requirements_dict()
        with pytest.raises(ValueError, match="Invalid sender"):
            await scheme.create_payment_payload(2, requirements)

    @pytest.mark.asyncio
    async def test_create_payload_transaction_failure(self):
        signer = MockFailingSigner()
        scheme = ExactDirectCosmosClientScheme(signer)

        requirements = make_requirements_dict()
        with pytest.raises(RuntimeError, match="Failed to send tokens"):
            await scheme.create_payment_payload(2, requirements)

    @pytest.mark.asyncio
    async def test_create_payload_v1_version(self):
        signer = MockClientSigner()
        scheme = ExactDirectCosmosClientScheme(signer)

        requirements = make_requirements_dict()
        result = await scheme.create_payment_payload(1, requirements)

        assert result["t402Version"] == 1

    @pytest.mark.asyncio
    async def test_create_payload_includes_denom(self):
        """Payload should include denom field."""
        signer = MockClientSigner()
        scheme = ExactDirectCosmosClientScheme(signer)

        requirements = make_requirements_dict()
        result = await scheme.create_payment_payload(2, requirements)

        assert result["payload"].get("denom") == "uusdc"


# =============================================================================
# Server Scheme Tests
# =============================================================================


class TestExactDirectCosmosServerScheme:
    """Test the server scheme implementation."""

    def test_scheme_identifier(self):
        scheme = ExactDirectCosmosServerScheme()
        assert scheme.scheme == "exact-direct"

    def test_caip_family(self):
        scheme = ExactDirectCosmosServerScheme()
        assert scheme.caip_family == "cosmos:*"

    @pytest.mark.asyncio
    async def test_parse_price_dollar_string(self):
        scheme = ExactDirectCosmosServerScheme()
        result = await scheme.parse_price("$1.50", COSMOS_NOBLE_MAINNET)

        assert result["amount"] == "1500000"
        assert result["asset"] == "uusdc"
        assert result["extra"]["symbol"] == "USDC"
        assert result["extra"]["decimals"] == 6

    @pytest.mark.asyncio
    async def test_parse_price_plain_string(self):
        scheme = ExactDirectCosmosServerScheme()
        result = await scheme.parse_price("0.01", COSMOS_NOBLE_MAINNET)

        assert result["amount"] == "10000"

    @pytest.mark.asyncio
    async def test_parse_price_float(self):
        scheme = ExactDirectCosmosServerScheme()
        result = await scheme.parse_price(2.5, COSMOS_NOBLE_MAINNET)

        assert result["amount"] == "2500000"

    @pytest.mark.asyncio
    async def test_parse_price_int(self):
        scheme = ExactDirectCosmosServerScheme()
        result = await scheme.parse_price(10, COSMOS_NOBLE_MAINNET)

        assert result["amount"] == "10000000"

    @pytest.mark.asyncio
    async def test_parse_price_zero(self):
        scheme = ExactDirectCosmosServerScheme()
        result = await scheme.parse_price("0", COSMOS_NOBLE_MAINNET)

        assert result["amount"] == "0"

    @pytest.mark.asyncio
    async def test_parse_price_small_amount(self):
        scheme = ExactDirectCosmosServerScheme()
        result = await scheme.parse_price("0.000001", COSMOS_NOBLE_MAINNET)

        assert result["amount"] == "1"

    @pytest.mark.asyncio
    async def test_parse_price_large_amount(self):
        scheme = ExactDirectCosmosServerScheme()
        result = await scheme.parse_price("1000000", COSMOS_NOBLE_MAINNET)

        assert result["amount"] == "1000000000000"

    @pytest.mark.asyncio
    async def test_parse_price_dict_format(self):
        scheme = ExactDirectCosmosServerScheme()
        result = await scheme.parse_price(
            {"amount": "500000", "asset": "uusdc"},
            COSMOS_NOBLE_MAINNET,
        )

        assert result["amount"] == "500000"
        assert result["asset"] == "uusdc"

    @pytest.mark.asyncio
    async def test_parse_price_dict_with_extra(self):
        scheme = ExactDirectCosmosServerScheme()
        result = await scheme.parse_price(
            {"amount": "500000", "extra": {"custom": "value"}},
            COSMOS_NOBLE_MAINNET,
        )

        assert result["extra"]["custom"] == "value"

    @pytest.mark.asyncio
    async def test_parse_price_testnet(self):
        scheme = ExactDirectCosmosServerScheme()
        result = await scheme.parse_price("$1.00", COSMOS_NOBLE_TESTNET)

        assert result["amount"] == "1000000"
        assert result["asset"] == "uusdc"

    @pytest.mark.asyncio
    async def test_parse_price_unsupported_network(self):
        scheme = ExactDirectCosmosServerScheme()
        with pytest.raises(ValueError, match="Unsupported network"):
            await scheme.parse_price("$1.00", "cosmos:unknown-1")

    @pytest.mark.asyncio
    async def test_parse_price_invalid_string(self):
        scheme = ExactDirectCosmosServerScheme()
        with pytest.raises(ValueError, match="Failed to parse"):
            await scheme.parse_price("not-a-number", COSMOS_NOBLE_MAINNET)

    @pytest.mark.asyncio
    async def test_enhance_requirements_sets_asset(self):
        scheme = ExactDirectCosmosServerScheme()
        requirements = {
            "scheme": SCHEME_EXACT_DIRECT,
            "network": COSMOS_NOBLE_MAINNET,
            "asset": "",
            "amount": "1000000",
            "payTo": "noble1merchant",
            "maxTimeoutSeconds": 300,
        }
        supported_kind = {
            "t402Version": 2,
            "scheme": SCHEME_EXACT_DIRECT,
            "network": COSMOS_NOBLE_MAINNET,
            "extra": {"assetSymbol": "USDC", "assetDecimals": 6},
        }

        result = await scheme.enhance_requirements(requirements, supported_kind, [])

        assert result["asset"] == "uusdc"
        assert result["extra"]["assetSymbol"] == "USDC"
        assert result["extra"]["assetDecimals"] == 6

    @pytest.mark.asyncio
    async def test_enhance_requirements_adds_cosmos_extras(self):
        """Cosmos-specific extras: chainId, bech32Prefix, denom."""
        scheme = ExactDirectCosmosServerScheme()
        requirements = {
            "scheme": SCHEME_EXACT_DIRECT,
            "network": COSMOS_NOBLE_MAINNET,
            "asset": "uusdc",
            "amount": "1000000",
            "payTo": "noble1merchant",
            "maxTimeoutSeconds": 300,
        }
        supported_kind = {
            "t402Version": 2,
            "scheme": SCHEME_EXACT_DIRECT,
            "network": COSMOS_NOBLE_MAINNET,
        }

        result = await scheme.enhance_requirements(requirements, supported_kind, [])

        assert result["extra"]["chainId"] == "noble-1"
        assert result["extra"]["bech32Prefix"] == "noble"
        assert result["extra"]["denom"] == "uusdc"

    @pytest.mark.asyncio
    async def test_enhance_requirements_preserves_existing_asset(self):
        scheme = ExactDirectCosmosServerScheme()
        requirements = {
            "scheme": SCHEME_EXACT_DIRECT,
            "network": COSMOS_NOBLE_MAINNET,
            "asset": "ibc/custom_token",
            "amount": "1000000",
            "payTo": "noble1merchant",
            "maxTimeoutSeconds": 300,
        }
        supported_kind = {
            "t402Version": 2,
            "scheme": SCHEME_EXACT_DIRECT,
            "network": COSMOS_NOBLE_MAINNET,
        }

        result = await scheme.enhance_requirements(requirements, supported_kind, [])

        assert result["asset"] == "ibc/custom_token"

    @pytest.mark.asyncio
    async def test_enhance_requirements_converts_decimal_amount(self):
        scheme = ExactDirectCosmosServerScheme()
        requirements = {
            "scheme": SCHEME_EXACT_DIRECT,
            "network": COSMOS_NOBLE_MAINNET,
            "asset": "uusdc",
            "amount": "1.50",
            "payTo": "noble1merchant",
            "maxTimeoutSeconds": 300,
        }
        supported_kind = {
            "t402Version": 2,
            "scheme": SCHEME_EXACT_DIRECT,
            "network": COSMOS_NOBLE_MAINNET,
        }

        result = await scheme.enhance_requirements(requirements, supported_kind, [])

        assert result["amount"] == "1500000"

    @pytest.mark.asyncio
    async def test_enhance_requirements_copies_extension_keys(self):
        scheme = ExactDirectCosmosServerScheme()
        requirements = make_requirements_dict()
        supported_kind = {
            "t402Version": 2,
            "scheme": SCHEME_EXACT_DIRECT,
            "network": COSMOS_NOBLE_MAINNET,
            "extra": {"customExtension": "value123"},
        }

        result = await scheme.enhance_requirements(
            requirements, supported_kind, ["customExtension"]
        )

        assert result["extra"]["customExtension"] == "value123"

    @pytest.mark.asyncio
    async def test_enhance_requirements_invalid_network(self):
        scheme = ExactDirectCosmosServerScheme()
        requirements = make_requirements_dict(network="cosmos:unknown-1")
        supported_kind = {
            "t402Version": 2,
            "scheme": SCHEME_EXACT_DIRECT,
            "network": "cosmos:unknown-1",
        }

        with pytest.raises(ValueError, match="Unsupported network"):
            await scheme.enhance_requirements(requirements, supported_kind, [])


# =============================================================================
# Facilitator Scheme Tests
# =============================================================================


class TestExactDirectCosmosFacilitatorScheme:
    """Test the facilitator scheme implementation."""

    def test_scheme_identifier(self):
        signer = MockFacilitatorSigner()
        facilitator = ExactDirectCosmosFacilitatorScheme(signer)
        assert facilitator.scheme == "exact-direct"

    def test_caip_family(self):
        signer = MockFacilitatorSigner()
        facilitator = ExactDirectCosmosFacilitatorScheme(signer)
        assert facilitator.caip_family == "cosmos:*"

    def test_get_signers(self):
        signer = MockFacilitatorSigner(addresses=["noble1fac1", "noble1fac2"])
        facilitator = ExactDirectCosmosFacilitatorScheme(signer)

        signers = facilitator.get_signers(COSMOS_NOBLE_MAINNET)
        assert signers == ["noble1fac1", "noble1fac2"]

    def test_get_extra_mainnet(self):
        signer = MockFacilitatorSigner()
        facilitator = ExactDirectCosmosFacilitatorScheme(signer)

        extra = facilitator.get_extra(COSMOS_NOBLE_MAINNET)
        assert extra is not None
        assert extra["assetSymbol"] == "USDC"
        assert extra["assetDecimals"] == 6
        assert extra["assetDenom"] == "uusdc"

    def test_get_extra_testnet(self):
        signer = MockFacilitatorSigner()
        facilitator = ExactDirectCosmosFacilitatorScheme(signer)

        extra = facilitator.get_extra(COSMOS_NOBLE_TESTNET)
        assert extra is not None
        assert extra["assetSymbol"] == "USDC"

    def test_get_extra_unknown_network(self):
        signer = MockFacilitatorSigner()
        facilitator = ExactDirectCosmosFacilitatorScheme(signer)

        extra = facilitator.get_extra("cosmos:unknown-1")
        assert extra is None

    @pytest.mark.asyncio
    async def test_verify_success(self):
        tx_result = make_successful_tx_result()
        signer = MockFacilitatorSigner(tx_result=tx_result)
        facilitator = ExactDirectCosmosFacilitatorScheme(signer)

        payload = make_payload_dict()
        requirements = make_requirements_dict()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True
        assert result.payer == "noble1sender123abc"
        assert result.invalid_reason is None

    @pytest.mark.asyncio
    async def test_verify_missing_tx_hash(self):
        signer = MockFacilitatorSigner()
        facilitator = ExactDirectCosmosFacilitatorScheme(signer)

        payload = {
            "payload": {
                "txHash": "",
                "from": "noble1sender123abc",
                "to": "noble1merchant456def",
                "amount": "1000000",
            }
        }
        requirements = make_requirements_dict()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "Missing transaction hash" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_missing_from(self):
        signer = MockFacilitatorSigner()
        facilitator = ExactDirectCosmosFacilitatorScheme(signer)

        payload = {
            "payload": {
                "txHash": "abc123",
                "from": "",
                "to": "noble1merchant456def",
                "amount": "1000000",
            }
        }
        requirements = make_requirements_dict()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "Missing sender" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_invalid_address_format(self):
        signer = MockFacilitatorSigner()
        facilitator = ExactDirectCosmosFacilitatorScheme(signer)

        payload = {
            "payload": {
                "txHash": "abc123",
                "from": "cosmos1wrongprefix",
                "to": "noble1merchant456def",
                "amount": "1000000",
            }
        }
        requirements = make_requirements_dict()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "Invalid sender address" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_transaction_not_found(self):
        signer = MockFacilitatorSigner(tx_result=None)
        facilitator = ExactDirectCosmosFacilitatorScheme(signer)

        payload = make_payload_dict()
        requirements = make_requirements_dict()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "Transaction not found" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_transaction_failed(self):
        tx_result = TransactionResult(
            tx_hash="FAILED",
            code=5,
            raw_log="insufficient funds",
        )
        signer = MockFacilitatorSigner(tx_result=tx_result)
        facilitator = ExactDirectCosmosFacilitatorScheme(signer)

        payload = make_payload_dict()
        requirements = make_requirements_dict()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "failed on-chain" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_no_msg_send(self):
        tx_result = TransactionResult(
            code=0,
            messages=[
                {
                    "@type": "/cosmos.staking.v1beta1.MsgDelegate",
                    "delegator_address": "noble1abc",
                }
            ],
        )
        signer = MockFacilitatorSigner(tx_result=tx_result)
        facilitator = ExactDirectCosmosFacilitatorScheme(signer)

        payload = make_payload_dict()
        requirements = make_requirements_dict()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "No bank send message" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_wrong_recipient(self):
        tx_result = make_successful_tx_result(to_address="noble1wrong")
        signer = MockFacilitatorSigner(tx_result=tx_result)
        facilitator = ExactDirectCosmosFacilitatorScheme(signer)

        payload = make_payload_dict()
        requirements = make_requirements_dict()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "Wrong recipient" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_sender_mismatch(self):
        tx_result = make_successful_tx_result(from_address="noble1different")
        signer = MockFacilitatorSigner(tx_result=tx_result)
        facilitator = ExactDirectCosmosFacilitatorScheme(signer)

        payload = make_payload_dict()
        requirements = make_requirements_dict()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "Sender mismatch" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_wrong_denom(self):
        tx_result = make_successful_tx_result(denom="uatom")
        signer = MockFacilitatorSigner(tx_result=tx_result)
        facilitator = ExactDirectCosmosFacilitatorScheme(signer)

        payload = make_payload_dict()
        requirements = make_requirements_dict()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "Wrong denom" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_insufficient_amount(self):
        tx_result = make_successful_tx_result(amount="500000")
        signer = MockFacilitatorSigner(tx_result=tx_result)
        facilitator = ExactDirectCosmosFacilitatorScheme(signer)

        payload = make_payload_dict()
        requirements = make_requirements_dict(amount="1000000")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "Insufficient amount" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_exact_amount(self):
        tx_result = make_successful_tx_result(amount="1000000")
        signer = MockFacilitatorSigner(tx_result=tx_result)
        facilitator = ExactDirectCosmosFacilitatorScheme(signer)

        payload = make_payload_dict()
        requirements = make_requirements_dict(amount="1000000")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_excess_amount_accepted(self):
        tx_result = make_successful_tx_result(amount="2000000")
        signer = MockFacilitatorSigner(tx_result=tx_result)
        facilitator = ExactDirectCosmosFacilitatorScheme(signer)

        payload = make_payload_dict()
        requirements = make_requirements_dict(amount="1000000")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_replay_protection(self):
        """Test that the same transaction cannot be used twice."""
        tx_result = make_successful_tx_result()
        signer = MockFacilitatorSigner(tx_result=tx_result)
        facilitator = ExactDirectCosmosFacilitatorScheme(signer)

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
        tx_result = make_successful_tx_result()
        signer = MockFacilitatorSigner(tx_result=tx_result)
        facilitator = ExactDirectCosmosFacilitatorScheme(signer)

        payload1 = make_payload_dict(tx_hash="hash1")
        payload2 = make_payload_dict(tx_hash="hash2")
        requirements = make_requirements_dict()

        result1 = await facilitator.verify(payload1, requirements)
        assert result1.is_valid is True

        result2 = await facilitator.verify(payload2, requirements)
        assert result2.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_unsupported_network(self):
        signer = MockFacilitatorSigner()
        facilitator = ExactDirectCosmosFacilitatorScheme(signer)

        payload = make_payload_dict()
        requirements = make_requirements_dict(network="cosmos:unknown-1")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "Unsupported network" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_settle_success(self):
        tx_result = make_successful_tx_result()
        signer = MockFacilitatorSigner(tx_result=tx_result)
        facilitator = ExactDirectCosmosFacilitatorScheme(signer)

        payload = make_payload_dict()
        requirements = make_requirements_dict()

        result = await facilitator.settle(payload, requirements)

        assert result.success is True
        assert result.transaction == "AABB1122CCDD3344EEFF"
        assert result.network == COSMOS_NOBLE_MAINNET
        assert result.payer == "noble1sender123abc"
        assert result.error_reason is None

    @pytest.mark.asyncio
    async def test_settle_verify_failure(self):
        signer = MockFacilitatorSigner(tx_result=None)
        facilitator = ExactDirectCosmosFacilitatorScheme(signer)

        payload = make_payload_dict()
        requirements = make_requirements_dict()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert result.error_reason is not None

    @pytest.mark.asyncio
    async def test_settle_testnet(self):
        tx_result = make_successful_tx_result(
            from_address="noble1testsender",
            to_address="noble1testmerchant",
        )
        signer = MockFacilitatorSigner(tx_result=tx_result)
        facilitator = ExactDirectCosmosFacilitatorScheme(signer)

        payload = make_payload_dict(
            from_address="noble1testsender",
            to_address="noble1testmerchant",
        )
        requirements = make_requirements_dict(
            network=COSMOS_NOBLE_TESTNET,
            pay_to="noble1testmerchant",
        )

        result = await facilitator.settle(payload, requirements)

        assert result.success is True
        assert result.network == COSMOS_NOBLE_TESTNET

    def test_facilitator_config_defaults(self):
        config = ExactDirectCosmosFacilitatorConfig()
        assert config.max_transaction_age_seconds == 300
        assert config.used_tx_cache_duration_seconds == 86400

    def test_facilitator_custom_config(self):
        config = ExactDirectCosmosFacilitatorConfig(
            max_transaction_age_seconds=600,
            used_tx_cache_duration_seconds=3600,
        )
        signer = MockFacilitatorSigner()
        facilitator = ExactDirectCosmosFacilitatorScheme(signer, config=config)

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
        server = ExactDirectCosmosServerScheme()
        asset_amount = await server.parse_price("$1.00", COSMOS_NOBLE_MAINNET)

        assert asset_amount["amount"] == "1000000"
        assert asset_amount["asset"] == "uusdc"

        # 2. Server enhances requirements
        requirements = {
            "scheme": SCHEME_EXACT_DIRECT,
            "network": COSMOS_NOBLE_MAINNET,
            "asset": asset_amount["asset"],
            "amount": asset_amount["amount"],
            "payTo": "noble1merchant456def",
            "maxTimeoutSeconds": 300,
        }
        supported_kind = {
            "t402Version": 2,
            "scheme": SCHEME_EXACT_DIRECT,
            "network": COSMOS_NOBLE_MAINNET,
            "extra": {"assetSymbol": "USDC", "assetDecimals": 6},
        }
        enhanced = await server.enhance_requirements(requirements, supported_kind, [])

        assert enhanced["extra"]["assetSymbol"] == "USDC"
        assert enhanced["extra"]["chainId"] == "noble-1"

        # 3. Client creates payment payload
        tx_hash = "AABB1122CCDD3344EEFF"
        client_signer = MockClientSigner(addr="noble1sender123abc", tx_hash=tx_hash)
        client = ExactDirectCosmosClientScheme(client_signer)

        payload_result = await client.create_payment_payload(2, enhanced)

        assert payload_result["t402Version"] == 2
        assert payload_result["payload"]["txHash"] == tx_hash
        assert payload_result["payload"]["from"] == "noble1sender123abc"

        # 4. Facilitator verifies the payment
        tx_result = make_successful_tx_result(
            from_address="noble1sender123abc",
            to_address="noble1merchant456def",
            amount="1000000",
        )
        facilitator_signer = MockFacilitatorSigner(tx_result=tx_result)
        facilitator = ExactDirectCosmosFacilitatorScheme(facilitator_signer)

        verify_result = await facilitator.verify(
            {"payload": payload_result["payload"]},
            enhanced,
        )

        assert verify_result.is_valid is True
        assert verify_result.payer == "noble1sender123abc"

    @pytest.mark.asyncio
    async def test_testnet_flow(self):
        """Test the payment flow on testnet."""
        # Server
        server = ExactDirectCosmosServerScheme()
        asset_amount = await server.parse_price("$0.50", COSMOS_NOBLE_TESTNET)

        assert asset_amount["asset"] == "uusdc"
        assert asset_amount["amount"] == "500000"

        # Client
        client_signer = MockClientSigner(
            addr="noble1testsender",
            tx_hash="testnet_hash_123",
        )
        client = ExactDirectCosmosClientScheme(client_signer)

        requirements = {
            "scheme": SCHEME_EXACT_DIRECT,
            "network": COSMOS_NOBLE_TESTNET,
            "asset": "uusdc",
            "amount": "500000",
            "payTo": "noble1testmerchant",
            "maxTimeoutSeconds": 300,
            "extra": {},
        }

        payload = await client.create_payment_payload(2, requirements)
        assert payload["payload"]["from"] == "noble1testsender"

        # Facilitator
        tx_result = make_successful_tx_result(
            from_address="noble1testsender",
            to_address="noble1testmerchant",
            amount="500000",
        )
        fac_signer = MockFacilitatorSigner(tx_result=tx_result)
        facilitator = ExactDirectCosmosFacilitatorScheme(fac_signer)

        result = await facilitator.settle(
            {"payload": payload["payload"]},
            requirements,
        )

        assert result.success is True
        assert result.transaction == "testnet_hash_123"
        assert result.network == COSMOS_NOBLE_TESTNET


# =============================================================================
# Protocol Compliance Tests
# =============================================================================


class TestProtocolCompliance:
    """Test that implementations satisfy the Protocol interfaces."""

    def test_client_is_protocol_compatible(self):
        """ExactDirectCosmosClientScheme should have scheme and create_payment_payload."""
        signer = MockClientSigner()
        client = ExactDirectCosmosClientScheme(signer)

        assert hasattr(client, "scheme")
        assert hasattr(client, "create_payment_payload")
        assert client.scheme == SCHEME_EXACT_DIRECT

    def test_server_is_protocol_compatible(self):
        """ExactDirectCosmosServerScheme should have scheme, parse_price, enhance_requirements."""
        server = ExactDirectCosmosServerScheme()

        assert hasattr(server, "scheme")
        assert hasattr(server, "parse_price")
        assert hasattr(server, "enhance_requirements")
        assert server.scheme == SCHEME_EXACT_DIRECT

    def test_facilitator_is_protocol_compatible(self):
        """ExactDirectCosmosFacilitatorScheme should have scheme, caip_family, verify, settle."""
        signer = MockFacilitatorSigner()
        facilitator = ExactDirectCosmosFacilitatorScheme(signer)

        assert hasattr(facilitator, "scheme")
        assert hasattr(facilitator, "caip_family")
        assert hasattr(facilitator, "get_extra")
        assert hasattr(facilitator, "get_signers")
        assert hasattr(facilitator, "verify")
        assert hasattr(facilitator, "settle")
        assert facilitator.scheme == SCHEME_EXACT_DIRECT
        assert facilitator.caip_family == CAIP_FAMILY

    def test_mock_client_signer_satisfies_protocol(self):
        """MockClientSigner should satisfy ClientCosmosSigner protocol."""
        signer = MockClientSigner()
        assert isinstance(signer, ClientCosmosSigner)

    def test_mock_facilitator_signer_satisfies_protocol(self):
        """MockFacilitatorSigner should satisfy FacilitatorCosmosSigner protocol."""
        signer = MockFacilitatorSigner()
        assert isinstance(signer, FacilitatorCosmosSigner)
