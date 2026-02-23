"""Tests for EVM Permit2 Proxy Scheme implementations."""

import time

import pytest
from unittest.mock import AsyncMock, MagicMock

from t402.schemes.evm.permit2.client import PERMIT2_ADDRESS
from t402.schemes.evm.permit2_proxy.client import (
    Permit2ProxyEvmClientScheme,
    SCHEME_PERMIT2_PROXY,
    EXACT_PROXY_ADDRESS,
    UPTO_PROXY_ADDRESS,
    WITNESS_TYPE_HASH,
)
from t402.schemes.evm.permit2_proxy.server import Permit2ProxyEvmServerScheme
from t402.schemes.evm.permit2_proxy.facilitator import (
    Permit2ProxyEvmFacilitatorScheme,
    Permit2ProxyTransactionConfirmation,
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


def make_mock_proxy_signer(
    addresses=None,
    balance="10000000",
    tx_hash=TEST_TX_HASH,
    confirmation_success=True,
    confirmation_tx_hash=None,
    confirmation_block=12345,
    confirmation_error=None,
):
    """Create a mock FacilitatorPermit2ProxySigner."""
    if addresses is None:
        addresses = [TEST_FACILITATOR_ADDRESS]

    signer = MagicMock()
    signer.get_addresses = MagicMock(return_value=addresses)
    signer.get_balance = AsyncMock(return_value=balance)
    signer.execute_proxy_settle = AsyncMock(return_value=tx_hash)

    confirmation = Permit2ProxyTransactionConfirmation(
        success=confirmation_success,
        tx_hash=confirmation_tx_hash or tx_hash,
        block_number=confirmation_block,
        error=confirmation_error,
    )
    signer.wait_for_confirmation = AsyncMock(return_value=confirmation)

    return signer


def make_proxy_payload(
    owner=TEST_SENDER,
    token=TEST_ASSET,
    amount="1000000",
    nonce="12345",
    deadline=None,
    witness_to=TEST_RECIPIENT,
    witness_facilitator=TEST_FACILITATOR_ADDRESS,
    witness_valid_after=None,
    signature=TEST_SIGNATURE,
):
    """Create a valid Permit2 Proxy payment payload."""
    if deadline is None:
        deadline = str(int(time.time()) + 3600)
    if witness_valid_after is None:
        witness_valid_after = str(int(time.time()) - 30)

    return {
        "permit": {
            "permitted": {
                "token": token,
                "amount": amount,
            },
            "nonce": nonce,
            "deadline": deadline,
        },
        "witness": {
            "to": witness_to,
            "facilitator": witness_facilitator,
            "validAfter": witness_valid_after,
        },
        "signature": signature,
        "owner": owner,
    }


def make_proxy_requirements(
    scheme="permit2-proxy",
    network=TEST_NETWORK,
    asset=TEST_ASSET,
    amount="1000000",
    pay_to=TEST_RECIPIENT,
):
    """Create Permit2 Proxy payment requirements."""
    return {
        "scheme": scheme,
        "network": network,
        "asset": asset,
        "amount": amount,
        "payTo": pay_to,
        "maxTimeoutSeconds": 300,
        "extra": {
            "permit2Address": PERMIT2_ADDRESS,
            "exactProxyAddress": EXACT_PROXY_ADDRESS,
            "uptoProxyAddress": UPTO_PROXY_ADDRESS,
            "facilitator": TEST_FACILITATOR_ADDRESS,
        },
    }


# ========== Client Tests ==========


class TestPermit2ProxyEvmClientBasic:
    def test_scheme_name(self):
        signer = MagicMock()
        signer.address = TEST_SENDER
        scheme = Permit2ProxyEvmClientScheme(signer)
        assert scheme.scheme == "permit2-proxy"

    def test_caip_family(self):
        signer = MagicMock()
        signer.address = TEST_SENDER
        scheme = Permit2ProxyEvmClientScheme(signer)
        assert scheme.caip_family == "eip155:*"


class TestPermit2ProxyEvmClientPayload:
    @pytest.mark.asyncio
    async def test_create_payment_payload(self):
        signer = MagicMock()
        signer.address = TEST_SENDER
        signed_result = MagicMock()
        signed_result.signature.hex.return_value = "ab" * 65
        signer.sign_typed_data = MagicMock(return_value=signed_result)

        scheme = Permit2ProxyEvmClientScheme(signer)
        requirements = make_proxy_requirements()

        payload = await scheme.create_payment_payload(
            t402_version=2, requirements=requirements,
        )

        assert payload["t402Version"] == 2
        inner = payload["payload"]
        assert inner["owner"] == TEST_SENDER
        assert inner["permit"]["permitted"]["token"] == TEST_ASSET
        assert inner["witness"]["to"] == TEST_RECIPIENT
        assert inner["witness"]["facilitator"] == TEST_FACILITATOR_ADDRESS
        assert inner["signature"].startswith("0x")

    @pytest.mark.asyncio
    async def test_create_payload_requires_facilitator(self):
        signer = MagicMock()
        signer.address = TEST_SENDER

        scheme = Permit2ProxyEvmClientScheme(signer)
        requirements = {
            "scheme": "permit2-proxy",
            "network": TEST_NETWORK,
            "asset": TEST_ASSET,
            "amount": "1000000",
            "payTo": TEST_RECIPIENT,
            "extra": {},
        }

        with pytest.raises(ValueError, match="facilitator address required"):
            await scheme.create_payment_payload(
                t402_version=2, requirements=requirements,
            )

    @pytest.mark.asyncio
    async def test_create_payload_signs_with_witness_types(self):
        signer = MagicMock()
        signer.address = TEST_SENDER
        signed_result = MagicMock()
        signed_result.signature.hex.return_value = "ab" * 65
        signer.sign_typed_data = MagicMock(return_value=signed_result)

        scheme = Permit2ProxyEvmClientScheme(signer)
        requirements = make_proxy_requirements()

        await scheme.create_payment_payload(
            t402_version=2, requirements=requirements,
        )

        call_kwargs = signer.sign_typed_data.call_args[1]
        types = call_kwargs["message_types"]
        assert "PermitWitnessTransferFrom" in types
        assert "Witness" in types
        assert "TokenPermissions" in types

        message = call_kwargs["message_data"]
        assert "witness" in message
        assert message["witness"]["to"] == TEST_RECIPIENT
        assert message["witness"]["facilitator"] == TEST_FACILITATOR_ADDRESS


# ========== Server Tests ==========


class TestPermit2ProxyEvmServerBasic:
    def test_scheme_name(self):
        server = Permit2ProxyEvmServerScheme()
        assert server.scheme == "permit2-proxy"


class TestPermit2ProxyEvmServerParsePrice:
    @pytest.mark.asyncio
    async def test_parse_price_includes_proxy_addresses(self):
        server = Permit2ProxyEvmServerScheme()
        result = await server.parse_price("$0.10", "eip155:8453")

        assert result["extra"]["permit2Address"] == PERMIT2_ADDRESS
        assert result["extra"]["exactProxyAddress"] == EXACT_PROXY_ADDRESS
        assert result["extra"]["uptoProxyAddress"] == UPTO_PROXY_ADDRESS


class TestPermit2ProxyEvmServerEnhance:
    @pytest.mark.asyncio
    async def test_enhance_adds_proxy_addresses(self):
        server = Permit2ProxyEvmServerScheme()
        req = {"network": TEST_NETWORK, "asset": TEST_ASSET}

        enhanced = await server.enhance_requirements(req, {}, [])

        assert enhanced["extra"]["permit2Address"] == PERMIT2_ADDRESS
        assert enhanced["extra"]["exactProxyAddress"] == EXACT_PROXY_ADDRESS
        assert enhanced["extra"]["uptoProxyAddress"] == UPTO_PROXY_ADDRESS


# ========== Facilitator Tests ==========


class TestPermit2ProxyEvmFacilitatorBasic:
    def test_scheme_name(self):
        signer = make_mock_proxy_signer()
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=signer)
        assert facilitator.scheme == "permit2-proxy"

    def test_caip_family(self):
        signer = make_mock_proxy_signer()
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=signer)
        assert facilitator.caip_family == "eip155:*"

    def test_protocol_compliance(self):
        signer = make_mock_proxy_signer()
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=signer)
        assert isinstance(facilitator, SchemeNetworkFacilitator)

    def test_get_extra(self):
        signer = make_mock_proxy_signer()
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=signer)
        extra = facilitator.get_extra("eip155:8453")

        assert extra is not None
        assert extra["permit2Address"] == PERMIT2_ADDRESS
        assert extra["exactProxyAddress"] == EXACT_PROXY_ADDRESS
        assert extra["uptoProxyAddress"] == UPTO_PROXY_ADDRESS

    def test_get_extra_invalid_network(self):
        signer = make_mock_proxy_signer()
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=signer)
        assert facilitator.get_extra("solana:mainnet") is None

    def test_get_signers(self):
        signer = make_mock_proxy_signer()
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=signer)
        assert facilitator.get_signers(TEST_NETWORK) == [TEST_FACILITATOR_ADDRESS]


class TestPermit2ProxyEvmFacilitatorVerify:
    @pytest.mark.asyncio
    async def test_verify_valid_payload(self):
        signer = make_mock_proxy_signer()
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=signer)

        payload = make_proxy_payload()
        requirements = make_proxy_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True
        assert result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_verify_unsupported_scheme(self):
        signer = make_mock_proxy_signer()
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=signer)

        payload = make_proxy_payload()
        requirements = make_proxy_requirements(scheme="exact")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "unsupported_scheme"

    @pytest.mark.asyncio
    async def test_verify_unsupported_network(self):
        signer = make_mock_proxy_signer()
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=signer)

        payload = make_proxy_payload()
        requirements = make_proxy_requirements(network="solana:mainnet")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "unsupported_network"

    @pytest.mark.asyncio
    async def test_verify_missing_signature(self):
        signer = make_mock_proxy_signer()
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=signer)

        payload = make_proxy_payload(signature="")
        requirements = make_proxy_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "invalid_payload"

    @pytest.mark.asyncio
    async def test_verify_missing_witness(self):
        signer = make_mock_proxy_signer()
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=signer)

        payload = make_proxy_payload()
        del payload["witness"]
        requirements = make_proxy_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "invalid_payload"

    @pytest.mark.asyncio
    async def test_verify_token_mismatch(self):
        signer = make_mock_proxy_signer()
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=signer)

        payload = make_proxy_payload(
            token="0x0000000000000000000000000000000000000001"
        )
        requirements = make_proxy_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "token_mismatch"

    @pytest.mark.asyncio
    async def test_verify_recipient_mismatch(self):
        signer = make_mock_proxy_signer()
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=signer)

        payload = make_proxy_payload(
            witness_to="0x0000000000000000000000000000000000000000"
        )
        requirements = make_proxy_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "recipient_mismatch"

    @pytest.mark.asyncio
    async def test_verify_unauthorized_facilitator(self):
        signer = make_mock_proxy_signer()
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=signer)

        payload = make_proxy_payload(
            witness_facilitator="0x0000000000000000000000000000000000000099"
        )
        requirements = make_proxy_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "unauthorized_facilitator"

    @pytest.mark.asyncio
    async def test_verify_facilitator_case_insensitive(self):
        signer = make_mock_proxy_signer(
            addresses=[TEST_FACILITATOR_ADDRESS.lower()]
        )
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=signer)

        payload = make_proxy_payload(
            witness_facilitator=TEST_FACILITATOR_ADDRESS.upper()
        )
        requirements = make_proxy_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_insufficient_permitted_amount(self):
        signer = make_mock_proxy_signer()
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=signer)

        payload = make_proxy_payload(amount="500000")
        requirements = make_proxy_requirements(amount="1000000")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "insufficient_permitted_amount"

    @pytest.mark.asyncio
    async def test_verify_payment_too_early(self):
        signer = make_mock_proxy_signer()
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=signer)

        future = str(int(time.time()) + 3600)
        payload = make_proxy_payload(witness_valid_after=future)
        requirements = make_proxy_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "payment_too_early"

    @pytest.mark.asyncio
    async def test_verify_valid_after_in_past(self):
        signer = make_mock_proxy_signer()
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=signer)

        past = str(int(time.time()) - 3600)
        payload = make_proxy_payload(witness_valid_after=past)
        requirements = make_proxy_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_insufficient_balance(self):
        signer = make_mock_proxy_signer(balance="500000")
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=signer)

        payload = make_proxy_payload()
        requirements = make_proxy_requirements(amount="1000000")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "insufficient_balance"

    @pytest.mark.asyncio
    async def test_verify_handles_nested_payload(self):
        signer = make_mock_proxy_signer()
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=signer)

        inner = make_proxy_payload()
        wrapped = {"t402Version": 2, "payload": inner}
        requirements = make_proxy_requirements()

        result = await facilitator.verify(wrapped, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_with_pydantic_model(self):
        from t402.types import PaymentRequirementsV2

        signer = make_mock_proxy_signer()
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=signer)

        payload = make_proxy_payload()
        requirements = PaymentRequirementsV2(
            scheme="permit2-proxy",
            network=TEST_NETWORK,
            asset=TEST_ASSET,
            amount="1000000",
            pay_to=TEST_RECIPIENT,
            max_timeout_seconds=300,
            extra={
                "facilitator": TEST_FACILITATOR_ADDRESS,
            },
        )

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True


class TestPermit2ProxyEvmFacilitatorSettle:
    @pytest.mark.asyncio
    async def test_settle_success(self):
        signer = make_mock_proxy_signer()
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=signer)

        payload = make_proxy_payload()
        requirements = make_proxy_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is True
        assert result.transaction == TEST_TX_HASH
        assert result.network == TEST_NETWORK
        assert result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_settle_fails_on_verification(self):
        signer = make_mock_proxy_signer(balance="100")
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=signer)

        payload = make_proxy_payload()
        requirements = make_proxy_requirements(amount="1000000")

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert result.error_reason == "insufficient_balance"
        signer.execute_proxy_settle.assert_not_called()

    @pytest.mark.asyncio
    async def test_settle_exact_proxy(self):
        """Test settlement uses exact proxy when amounts match."""
        signer = make_mock_proxy_signer()
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=signer)

        payload = make_proxy_payload(amount="1000000")
        requirements = make_proxy_requirements(amount="1000000")

        await facilitator.settle(payload, requirements)

        call_kwargs = signer.execute_proxy_settle.call_args[1]
        assert call_kwargs["proxy_address"] == EXACT_PROXY_ADDRESS
        assert call_kwargs["settlement_amount"] is None

    @pytest.mark.asyncio
    async def test_settle_upto_proxy(self):
        """Test settlement uses upto proxy when permitted > required."""
        signer = make_mock_proxy_signer(balance="5000000")
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=signer)

        payload = make_proxy_payload(amount="2000000")
        requirements = make_proxy_requirements(amount="1000000")

        await facilitator.settle(payload, requirements)

        call_kwargs = signer.execute_proxy_settle.call_args[1]
        assert call_kwargs["proxy_address"] == UPTO_PROXY_ADDRESS
        assert call_kwargs["settlement_amount"] == "1000000"

    @pytest.mark.asyncio
    async def test_settle_transaction_failure(self):
        signer = make_mock_proxy_signer()
        signer.execute_proxy_settle = AsyncMock(
            side_effect=RuntimeError("Gas estimation failed")
        )
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=signer)

        payload = make_proxy_payload()
        requirements = make_proxy_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert "transaction_failed" in result.error_reason

    @pytest.mark.asyncio
    async def test_settle_confirmation_failure(self):
        signer = make_mock_proxy_signer(
            confirmation_success=False,
            confirmation_error="execution reverted",
        )
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=signer)

        payload = make_proxy_payload()
        requirements = make_proxy_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert "execution reverted" in result.error_reason

    @pytest.mark.asyncio
    async def test_settle_calls_signer_correctly(self):
        signer = make_mock_proxy_signer()
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=signer)

        now = int(time.time())
        payload = make_proxy_payload(
            amount="1000000",
            nonce="99999",
            witness_valid_after=str(now - 30),
        )
        requirements = make_proxy_requirements(amount="1000000")

        await facilitator.settle(payload, requirements)

        call_kwargs = signer.execute_proxy_settle.call_args[1]
        assert call_kwargs["token"] == TEST_ASSET
        assert call_kwargs["amount"] == "1000000"
        assert call_kwargs["nonce"] == "99999"
        assert call_kwargs["owner"] == TEST_SENDER
        assert call_kwargs["witness_to"] == TEST_RECIPIENT
        assert call_kwargs["witness_facilitator"] == TEST_FACILITATOR_ADDRESS
        assert call_kwargs["signature"] == TEST_SIGNATURE
        assert call_kwargs["network"] == TEST_NETWORK


class TestPermit2ProxyEvmFacilitatorIntegration:
    @pytest.mark.asyncio
    async def test_full_verify_then_settle(self):
        signer = make_mock_proxy_signer(
            balance="5000000",
            tx_hash="0xbroadcast",
            confirmation_success=True,
            confirmation_tx_hash="0xfinal",
        )
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=signer)

        payload = make_proxy_payload()
        requirements = make_proxy_requirements()

        verify_result = await facilitator.verify(payload, requirements)
        assert verify_result.is_valid is True

        settle_result = await facilitator.settle(payload, requirements)
        assert settle_result.success is True
        assert settle_result.transaction == "0xfinal"

    @pytest.mark.asyncio
    async def test_verify_failure_prevents_settle(self):
        signer = make_mock_proxy_signer(balance="100")
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=signer)

        payload = make_proxy_payload()
        requirements = make_proxy_requirements(amount="1000000")

        verify_result = await facilitator.verify(payload, requirements)
        assert verify_result.is_valid is False

        settle_result = await facilitator.settle(payload, requirements)
        assert settle_result.success is False
        signer.execute_proxy_settle.assert_not_called()


class TestPermit2ProxyConstants:
    def test_scheme_name(self):
        assert SCHEME_PERMIT2_PROXY == "permit2-proxy"

    def test_witness_type_hash(self):
        assert WITNESS_TYPE_HASH == (
            "Witness(address to,address facilitator,uint256 validAfter)"
        )

    def test_proxy_addresses(self):
        assert EXACT_PROXY_ADDRESS == "0x0000000000000000000000000000000000000000"
        assert UPTO_PROXY_ADDRESS == "0x0000000000000000000000000000000000000000"

    def test_permit2_address(self):
        assert PERMIT2_ADDRESS == "0x000000000022D473030F116dDEE9F6B43aC78BA3"
