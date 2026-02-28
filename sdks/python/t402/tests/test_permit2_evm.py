"""Tests for EVM Permit2 Scheme implementations."""

import time

import pytest
from unittest.mock import AsyncMock, MagicMock

from t402.schemes.evm.permit2.client import (
    Permit2EvmClientScheme,
    SCHEME_PERMIT2,
    PERMIT2_ADDRESS,
)
from t402.schemes.evm.permit2.server import Permit2EvmServerScheme
from t402.schemes.evm.permit2.facilitator import (
    Permit2EvmFacilitatorScheme,
    Permit2TransactionConfirmation,
)
from t402.schemes.interfaces import SchemeNetworkFacilitator


# Test constants
TEST_SENDER = "0x1234567890abcdef1234567890abcdef12345678"
TEST_RECIPIENT = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"
TEST_FACILITATOR_ADDRESS = "0xC88f67e776f16DcFBf42e6bDda1B82604448899B"
TEST_NETWORK = "eip155:8453"
TEST_ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
TEST_SIGNATURE = "0x" + "cd" * 65
TEST_TX_HASH = "0x" + "ef" * 32


def make_mock_permit2_signer(
    addresses=None,
    balance="10000000",
    tx_hash=TEST_TX_HASH,
    confirmation_success=True,
    confirmation_tx_hash=None,
    confirmation_block=12345,
    confirmation_error=None,
):
    """Create a mock FacilitatorPermit2Signer."""
    if addresses is None:
        addresses = [TEST_FACILITATOR_ADDRESS]

    signer = MagicMock()
    signer.get_addresses = MagicMock(return_value=addresses)
    signer.get_balance = AsyncMock(return_value=balance)
    signer.execute_permit2_transfer = AsyncMock(return_value=tx_hash)

    confirmation = Permit2TransactionConfirmation(
        success=confirmation_success,
        tx_hash=confirmation_tx_hash or tx_hash,
        block_number=confirmation_block,
        error=confirmation_error,
    )
    signer.wait_for_confirmation = AsyncMock(return_value=confirmation)

    return signer


def make_permit2_payload(
    owner=TEST_SENDER,
    token=TEST_ASSET,
    amount="1000000",
    nonce="12345",
    deadline=None,
    to=TEST_RECIPIENT,
    requested_amount=None,
    signature=TEST_SIGNATURE,
):
    """Create a valid Permit2 payment payload."""
    if deadline is None:
        deadline = str(int(time.time()) + 3600)
    if requested_amount is None:
        requested_amount = amount

    return {
        "permit": {
            "permitted": {
                "token": token,
                "amount": amount,
            },
            "nonce": nonce,
            "deadline": deadline,
        },
        "transferDetails": {
            "to": to,
            "requestedAmount": requested_amount,
        },
        "signature": signature,
        "owner": owner,
    }


def make_permit2_requirements(
    scheme="permit2",
    network=TEST_NETWORK,
    asset=TEST_ASSET,
    amount="1000000",
    pay_to=TEST_RECIPIENT,
):
    """Create Permit2 payment requirements."""
    return {
        "scheme": scheme,
        "network": network,
        "asset": asset,
        "amount": amount,
        "payTo": pay_to,
        "maxTimeoutSeconds": 300,
        "extra": {
            "permit2Address": PERMIT2_ADDRESS,
        },
    }


# ========== Client Tests ==========


class TestPermit2EvmClientSchemeBasic:
    def test_scheme_name(self):
        signer = MagicMock()
        signer.address = TEST_SENDER
        scheme = Permit2EvmClientScheme(signer)
        assert scheme.scheme == "permit2"

    def test_caip_family(self):
        signer = MagicMock()
        signer.address = TEST_SENDER
        scheme = Permit2EvmClientScheme(signer)
        assert scheme.caip_family == "eip155:*"

    def test_address(self):
        signer = MagicMock()
        signer.address = TEST_SENDER
        scheme = Permit2EvmClientScheme(signer)
        assert scheme.address == TEST_SENDER


class TestPermit2EvmClientSchemePayload:
    @pytest.mark.asyncio
    async def test_create_payment_payload_v2(self):
        signer = MagicMock()
        signer.address = TEST_SENDER
        signed_result = MagicMock()
        signed_result.signature.hex.return_value = "ab" * 65
        signer.sign_typed_data = MagicMock(return_value=signed_result)

        scheme = Permit2EvmClientScheme(signer)
        requirements = make_permit2_requirements()

        payload = await scheme.create_payment_payload(
            t402_version=2,
            requirements=requirements,
        )

        assert payload["t402Version"] == 2
        inner = payload["payload"]
        assert inner["owner"] == TEST_SENDER
        assert inner["permit"]["permitted"]["token"] == TEST_ASSET
        assert inner["permit"]["permitted"]["amount"] == "1000000"
        assert inner["transferDetails"]["to"] == TEST_RECIPIENT
        assert inner["transferDetails"]["requestedAmount"] == "1000000"
        assert inner["signature"].startswith("0x")

    @pytest.mark.asyncio
    async def test_create_payload_signs_with_correct_domain(self):
        signer = MagicMock()
        signer.address = TEST_SENDER
        signed_result = MagicMock()
        signed_result.signature.hex.return_value = "ab" * 65
        signer.sign_typed_data = MagicMock(return_value=signed_result)

        scheme = Permit2EvmClientScheme(signer)
        requirements = make_permit2_requirements()

        await scheme.create_payment_payload(t402_version=2, requirements=requirements)

        call_kwargs = signer.sign_typed_data.call_args[1]
        domain = call_kwargs["domain_data"]
        assert domain["name"] == "Permit2"
        assert domain["chainId"] == 8453
        assert domain["verifyingContract"] == PERMIT2_ADDRESS

    @pytest.mark.asyncio
    async def test_create_payload_invalid_network(self):
        signer = MagicMock()
        signer.address = TEST_SENDER

        scheme = Permit2EvmClientScheme(signer)
        requirements = make_permit2_requirements(network="solana:mainnet")

        with pytest.raises(ValueError, match="Unknown network"):
            await scheme.create_payment_payload(t402_version=2, requirements=requirements)


# ========== Server Tests ==========


class TestPermit2EvmServerSchemeBasic:
    def test_scheme_name(self):
        server = Permit2EvmServerScheme()
        assert server.scheme == "permit2"

    def test_caip_family(self):
        server = Permit2EvmServerScheme()
        assert server.caip_family == "eip155:*"


class TestPermit2EvmServerSchemeParsePrice:
    @pytest.mark.asyncio
    async def test_parse_price_string(self):
        server = Permit2EvmServerScheme()
        result = await server.parse_price("$0.10", "eip155:8453")

        assert result["amount"] == "100000"
        assert result["asset"] != ""
        assert result["extra"]["permit2Address"] == PERMIT2_ADDRESS

    @pytest.mark.asyncio
    async def test_parse_price_dict(self):
        server = Permit2EvmServerScheme()
        result = await server.parse_price(
            {"amount": "500000", "asset": TEST_ASSET},
            "eip155:8453",
        )

        assert result["amount"] == "500000"
        assert result["asset"] == TEST_ASSET

    @pytest.mark.asyncio
    async def test_parse_price_float(self):
        server = Permit2EvmServerScheme()
        result = await server.parse_price(0.10, "eip155:8453")

        assert result["amount"] == "100000"


class TestPermit2EvmServerSchemeEnhance:
    @pytest.mark.asyncio
    async def test_enhance_requirements_adds_permit2_address(self):
        server = Permit2EvmServerScheme()
        req = {
            "network": TEST_NETWORK,
            "asset": TEST_ASSET,
            "amount": "1000000",
        }

        enhanced = await server.enhance_requirements(req, {}, [])

        assert enhanced["extra"]["permit2Address"] == PERMIT2_ADDRESS

    @pytest.mark.asyncio
    async def test_enhance_requirements_preserves_existing_extra(self):
        server = Permit2EvmServerScheme()
        req = {
            "network": TEST_NETWORK,
            "asset": TEST_ASSET,
            "amount": "1000000",
            "extra": {"customKey": "customValue"},
        }

        enhanced = await server.enhance_requirements(req, {}, [])

        assert enhanced["extra"]["customKey"] == "customValue"
        assert enhanced["extra"]["permit2Address"] == PERMIT2_ADDRESS

    @pytest.mark.asyncio
    async def test_enhance_requirements_merges_supported_kind_extra(self):
        server = Permit2EvmServerScheme()
        req = {"network": TEST_NETWORK, "asset": TEST_ASSET}
        supported_kind = {"extra": {"facilitator": TEST_FACILITATOR_ADDRESS}}

        enhanced = await server.enhance_requirements(req, supported_kind, [])

        assert enhanced["extra"]["facilitator"] == TEST_FACILITATOR_ADDRESS


# ========== Facilitator Tests ==========


class TestPermit2EvmFacilitatorBasic:
    def test_scheme_name(self):
        signer = make_mock_permit2_signer()
        facilitator = Permit2EvmFacilitatorScheme(signer=signer)
        assert facilitator.scheme == "permit2"

    def test_caip_family(self):
        signer = make_mock_permit2_signer()
        facilitator = Permit2EvmFacilitatorScheme(signer=signer)
        assert facilitator.caip_family == "eip155:*"

    def test_protocol_compliance(self):
        signer = make_mock_permit2_signer()
        facilitator = Permit2EvmFacilitatorScheme(signer=signer)
        assert isinstance(facilitator, SchemeNetworkFacilitator)

    def test_get_extra(self):
        signer = make_mock_permit2_signer()
        facilitator = Permit2EvmFacilitatorScheme(signer=signer)
        extra = facilitator.get_extra("eip155:8453")

        assert extra is not None
        assert extra["permit2Address"] == PERMIT2_ADDRESS

    def test_get_extra_invalid_network(self):
        signer = make_mock_permit2_signer()
        facilitator = Permit2EvmFacilitatorScheme(signer=signer)
        assert facilitator.get_extra("solana:mainnet") is None

    def test_get_signers(self):
        addresses = [TEST_FACILITATOR_ADDRESS]
        signer = make_mock_permit2_signer(addresses=addresses)
        facilitator = Permit2EvmFacilitatorScheme(signer=signer)
        assert facilitator.get_signers(TEST_NETWORK) == addresses


class TestPermit2EvmFacilitatorVerify:
    @pytest.mark.asyncio
    async def test_verify_valid_payload(self):
        signer = make_mock_permit2_signer()
        facilitator = Permit2EvmFacilitatorScheme(signer=signer)

        payload = make_permit2_payload()
        requirements = make_permit2_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True
        assert result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_verify_unsupported_scheme(self):
        signer = make_mock_permit2_signer()
        facilitator = Permit2EvmFacilitatorScheme(signer=signer)

        payload = make_permit2_payload()
        requirements = make_permit2_requirements(scheme="exact")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "unsupported_scheme"

    @pytest.mark.asyncio
    async def test_verify_unsupported_network(self):
        signer = make_mock_permit2_signer()
        facilitator = Permit2EvmFacilitatorScheme(signer=signer)

        payload = make_permit2_payload()
        requirements = make_permit2_requirements(network="solana:mainnet")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "unsupported_network"

    @pytest.mark.asyncio
    async def test_verify_missing_signature(self):
        signer = make_mock_permit2_signer()
        facilitator = Permit2EvmFacilitatorScheme(signer=signer)

        payload = make_permit2_payload(signature="")
        requirements = make_permit2_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "invalid_payload"

    @pytest.mark.asyncio
    async def test_verify_missing_owner(self):
        signer = make_mock_permit2_signer()
        facilitator = Permit2EvmFacilitatorScheme(signer=signer)

        payload = make_permit2_payload(owner="")
        requirements = make_permit2_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "invalid_payload"

    @pytest.mark.asyncio
    async def test_verify_token_mismatch(self):
        signer = make_mock_permit2_signer()
        facilitator = Permit2EvmFacilitatorScheme(signer=signer)

        payload = make_permit2_payload(
            token="0x0000000000000000000000000000000000000001"
        )
        requirements = make_permit2_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "token_mismatch"
        assert result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_verify_recipient_mismatch(self):
        signer = make_mock_permit2_signer()
        facilitator = Permit2EvmFacilitatorScheme(signer=signer)

        payload = make_permit2_payload(
            to="0x0000000000000000000000000000000000000000"
        )
        requirements = make_permit2_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "recipient_mismatch"

    @pytest.mark.asyncio
    async def test_verify_recipient_case_insensitive(self):
        signer = make_mock_permit2_signer()
        facilitator = Permit2EvmFacilitatorScheme(signer=signer)

        payload = make_permit2_payload(to=TEST_RECIPIENT.lower())
        requirements = make_permit2_requirements(pay_to=TEST_RECIPIENT.upper())

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_insufficient_permitted_amount(self):
        signer = make_mock_permit2_signer()
        facilitator = Permit2EvmFacilitatorScheme(signer=signer)

        payload = make_permit2_payload(amount="500000")
        requirements = make_permit2_requirements(amount="1000000")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "insufficient_permitted_amount"

    @pytest.mark.asyncio
    async def test_verify_insufficient_requested_amount(self):
        signer = make_mock_permit2_signer()
        facilitator = Permit2EvmFacilitatorScheme(signer=signer)

        payload = make_permit2_payload(
            amount="2000000", requested_amount="500000"
        )
        requirements = make_permit2_requirements(amount="1000000")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "insufficient_requested_amount"

    @pytest.mark.asyncio
    async def test_verify_insufficient_balance(self):
        signer = make_mock_permit2_signer(balance="500000")
        facilitator = Permit2EvmFacilitatorScheme(signer=signer)

        payload = make_permit2_payload()
        requirements = make_permit2_requirements(amount="1000000")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "insufficient_balance"

    @pytest.mark.asyncio
    async def test_verify_balance_check_failed(self):
        signer = make_mock_permit2_signer()
        signer.get_balance = AsyncMock(return_value="not_a_number")
        facilitator = Permit2EvmFacilitatorScheme(signer=signer)

        payload = make_permit2_payload()
        requirements = make_permit2_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "balance_check_failed"

    @pytest.mark.asyncio
    async def test_verify_amount_equals_required(self):
        signer = make_mock_permit2_signer(balance="1000000")
        facilitator = Permit2EvmFacilitatorScheme(signer=signer)

        payload = make_permit2_payload(amount="1000000")
        requirements = make_permit2_requirements(amount="1000000")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_amount_exceeds_required(self):
        signer = make_mock_permit2_signer(balance="5000000")
        facilitator = Permit2EvmFacilitatorScheme(signer=signer)

        payload = make_permit2_payload(amount="2000000")
        requirements = make_permit2_requirements(amount="1000000")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_handles_nested_payload(self):
        signer = make_mock_permit2_signer()
        facilitator = Permit2EvmFacilitatorScheme(signer=signer)

        inner = make_permit2_payload()
        wrapped = {"t402Version": 2, "payload": inner}
        requirements = make_permit2_requirements()

        result = await facilitator.verify(wrapped, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_with_pydantic_model(self):
        from t402.types import PaymentRequirementsV2

        signer = make_mock_permit2_signer()
        facilitator = Permit2EvmFacilitatorScheme(signer=signer)

        payload = make_permit2_payload()
        requirements = PaymentRequirementsV2(
            scheme="permit2",
            network=TEST_NETWORK,
            asset=TEST_ASSET,
            amount="1000000",
            pay_to=TEST_RECIPIENT,
            max_timeout_seconds=300,
            extra={"permit2Address": PERMIT2_ADDRESS},
        )

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True


class TestPermit2EvmFacilitatorSettle:
    @pytest.mark.asyncio
    async def test_settle_success(self):
        signer = make_mock_permit2_signer()
        facilitator = Permit2EvmFacilitatorScheme(signer=signer)

        payload = make_permit2_payload()
        requirements = make_permit2_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is True
        assert result.transaction == TEST_TX_HASH
        assert result.network == TEST_NETWORK
        assert result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_settle_fails_on_verification(self):
        signer = make_mock_permit2_signer(balance="100")
        facilitator = Permit2EvmFacilitatorScheme(signer=signer)

        payload = make_permit2_payload()
        requirements = make_permit2_requirements(amount="1000000")

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert result.error_reason == "insufficient_balance"
        signer.execute_permit2_transfer.assert_not_called()

    @pytest.mark.asyncio
    async def test_settle_transaction_failure(self):
        signer = make_mock_permit2_signer()
        signer.execute_permit2_transfer = AsyncMock(
            side_effect=RuntimeError("Gas estimation failed")
        )
        facilitator = Permit2EvmFacilitatorScheme(signer=signer)

        payload = make_permit2_payload()
        requirements = make_permit2_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert "transaction_failed" in result.error_reason
        assert result.transaction is None

    @pytest.mark.asyncio
    async def test_settle_confirmation_failure(self):
        signer = make_mock_permit2_signer(
            confirmation_success=False,
            confirmation_error="execution reverted",
        )
        facilitator = Permit2EvmFacilitatorScheme(signer=signer)

        payload = make_permit2_payload()
        requirements = make_permit2_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert "execution reverted" in result.error_reason
        assert result.transaction == TEST_TX_HASH

    @pytest.mark.asyncio
    async def test_settle_confirmation_timeout(self):
        signer = make_mock_permit2_signer()
        signer.wait_for_confirmation = AsyncMock(
            side_effect=RuntimeError("Connection timeout")
        )
        facilitator = Permit2EvmFacilitatorScheme(signer=signer)

        payload = make_permit2_payload()
        requirements = make_permit2_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert "confirmation_failed" in result.error_reason
        assert result.transaction == TEST_TX_HASH

    @pytest.mark.asyncio
    async def test_settle_calls_execute_correctly(self):
        signer = make_mock_permit2_signer()
        facilitator = Permit2EvmFacilitatorScheme(signer=signer)

        payload = make_permit2_payload(amount="2000000", nonce="99999")
        requirements = make_permit2_requirements(amount="1000000")

        await facilitator.settle(payload, requirements)

        signer.execute_permit2_transfer.assert_called_once()
        call_kwargs = signer.execute_permit2_transfer.call_args[1]
        assert call_kwargs["permit2_address"] == PERMIT2_ADDRESS
        assert call_kwargs["token"] == TEST_ASSET
        assert call_kwargs["amount"] == "2000000"
        assert call_kwargs["nonce"] == "99999"
        assert call_kwargs["to"] == TEST_RECIPIENT
        assert call_kwargs["requested_amount"] == "2000000"
        assert call_kwargs["owner"] == TEST_SENDER
        assert call_kwargs["signature"] == TEST_SIGNATURE
        assert call_kwargs["network"] == TEST_NETWORK


class TestPermit2EvmFacilitatorNetworkValidation:
    def test_valid_networks(self):
        signer = make_mock_permit2_signer()
        facilitator = Permit2EvmFacilitatorScheme(signer=signer)

        for network in ["eip155:1", "eip155:8453", "eip155:42161"]:
            assert facilitator._is_valid_network(network) is True

    def test_invalid_networks(self):
        signer = make_mock_permit2_signer()
        facilitator = Permit2EvmFacilitatorScheme(signer=signer)

        for network in ["solana:mainnet", "eip155:0", "eip155:abc", ""]:
            assert facilitator._is_valid_network(network) is False


class TestPermit2Constants:
    def test_permit2_address(self):
        assert PERMIT2_ADDRESS == "0x000000000022D473030F116dDEE9F6B43aC78BA3"

    def test_scheme_name(self):
        assert SCHEME_PERMIT2 == "permit2"
