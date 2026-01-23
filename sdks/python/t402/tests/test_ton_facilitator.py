"""Tests for TON Exact Scheme - Facilitator Implementation."""

import base64
import time

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from t402.schemes.ton.exact.facilitator import (
    ExactTonFacilitatorScheme,
    FacilitatorTonSigner,
)
from t402.schemes.interfaces import SchemeNetworkFacilitator
from t402.types import VerifyResponse, SettleResponse
from t402.ton import (
    TON_MAINNET,
    TON_TESTNET,
    USDT_MAINNET_ADDRESS,
    USDT_TESTNET_ADDRESS,
    MIN_VALIDITY_BUFFER,
    TonVerifyMessageResult,
    TonTransactionConfirmation,
)


# Test constants
TEST_SENDER = "EQDxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_xxx"
TEST_RECIPIENT = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs"
TEST_FACILITATOR_ADDRESS = "EQABcdefghijklmnopqrstuvwxyz0123456789ABCDEFGH"
TEST_NETWORK = TON_MAINNET
TEST_ASSET = USDT_MAINNET_ADDRESS
TEST_VALID_BOC = base64.b64encode(b"valid boc data for testing").decode()
TEST_TX_HASH = "abc123def456789012345678901234567890123456789012345678901234"


def make_mock_signer(
    addresses: list = None,
    balance: str = "10000000",
    verify_valid: bool = True,
    verify_reason: str = None,
    seqno: int = 5,
    is_deployed: bool = True,
    tx_hash: str = TEST_TX_HASH,
    confirmation_success: bool = True,
    confirmation_hash: str = None,
    confirmation_error: str = None,
) -> MagicMock:
    """Create a mock FacilitatorTonSigner with configurable behavior.

    Args:
        addresses: List of facilitator addresses
        balance: Jetton balance to return
        verify_valid: Whether message verification succeeds
        verify_reason: Reason for verification failure
        seqno: Current wallet seqno
        is_deployed: Whether wallet is deployed
        tx_hash: Hash returned from send_external_message
        confirmation_success: Whether transaction confirmation succeeds
        confirmation_hash: Confirmed transaction hash
        confirmation_error: Confirmation error message

    Returns:
        Mock signer object
    """
    if addresses is None:
        addresses = [TEST_FACILITATOR_ADDRESS]

    signer = MagicMock()
    signer.get_addresses = MagicMock(return_value=addresses)

    signer.get_jetton_balance = AsyncMock(return_value=balance)

    verify_result = TonVerifyMessageResult(
        valid=verify_valid,
        reason=verify_reason,
    )
    signer.verify_message = AsyncMock(return_value=verify_result)

    signer.get_seqno = AsyncMock(return_value=seqno)
    signer.is_deployed = AsyncMock(return_value=is_deployed)

    signer.send_external_message = AsyncMock(return_value=tx_hash)

    confirmation = TonTransactionConfirmation(
        success=confirmation_success,
        hash=confirmation_hash,
        error=confirmation_error,
    )
    signer.wait_for_transaction = AsyncMock(return_value=confirmation)

    return signer


def make_valid_payload(
    signed_boc: str = TEST_VALID_BOC,
    from_addr: str = TEST_SENDER,
    to_addr: str = TEST_RECIPIENT,
    jetton_master: str = TEST_ASSET,
    jetton_amount: str = "1000000",
    ton_amount: str = "100000000",
    valid_until: int = None,
    seqno: int = 5,
    query_id: str = "1234567890",
) -> dict:
    """Create a valid TON payment payload for testing.

    Args:
        signed_boc: Base64-encoded BOC
        from_addr: Sender address
        to_addr: Recipient address
        jetton_master: Jetton master contract address
        jetton_amount: Amount in smallest units
        ton_amount: Gas amount in nanoTON
        valid_until: Validity timestamp (defaults to 1 hour from now)
        seqno: Wallet sequence number
        query_id: Unique query ID

    Returns:
        Dict representing a TON payment payload
    """
    if valid_until is None:
        valid_until = int(time.time()) + 3600  # 1 hour from now

    return {
        "signedBoc": signed_boc,
        "authorization": {
            "from": from_addr,
            "to": to_addr,
            "jettonMaster": jetton_master,
            "jettonAmount": jetton_amount,
            "tonAmount": ton_amount,
            "validUntil": valid_until,
            "seqno": seqno,
            "queryId": query_id,
        },
    }


def make_requirements(
    scheme: str = "exact",
    network: str = TEST_NETWORK,
    asset: str = TEST_ASSET,
    amount: str = "1000000",
    pay_to: str = TEST_RECIPIENT,
    max_timeout_seconds: int = 300,
) -> dict:
    """Create payment requirements for testing.

    Args:
        scheme: Payment scheme
        network: Network identifier
        asset: Token asset address
        amount: Required amount in smallest units
        pay_to: Recipient address
        max_timeout_seconds: Maximum timeout

    Returns:
        Dict representing payment requirements
    """
    return {
        "scheme": scheme,
        "network": network,
        "asset": asset,
        "amount": amount,
        "payTo": pay_to,
        "maxTimeoutSeconds": max_timeout_seconds,
        "extra": {},
    }


class TestExactTonFacilitatorBasic:
    """Test basic properties of ExactTonFacilitatorScheme."""

    def test_scheme_name(self):
        """Test scheme is 'exact'."""
        signer = make_mock_signer()
        facilitator = ExactTonFacilitatorScheme(signer=signer)
        assert facilitator.scheme == "exact"

    def test_caip_family(self):
        """Test CAIP family is ton:*."""
        signer = make_mock_signer()
        facilitator = ExactTonFacilitatorScheme(signer=signer)
        assert facilitator.caip_family == "ton:*"

    def test_protocol_compliance(self):
        """Test that ExactTonFacilitatorScheme implements SchemeNetworkFacilitator."""
        signer = make_mock_signer()
        facilitator = ExactTonFacilitatorScheme(signer=signer)
        assert isinstance(facilitator, SchemeNetworkFacilitator)
        assert hasattr(facilitator, "scheme")
        assert hasattr(facilitator, "caip_family")
        assert hasattr(facilitator, "get_signers")
        assert hasattr(facilitator, "get_extra")
        assert hasattr(facilitator, "verify")
        assert hasattr(facilitator, "settle")

    def test_init_stores_signer(self):
        """Test initialization stores the signer."""
        signer = make_mock_signer()
        facilitator = ExactTonFacilitatorScheme(signer=signer)
        assert facilitator._signer is signer


class TestExactTonFacilitatorGetExtra:
    """Test get_extra method."""

    def test_get_extra_mainnet(self):
        """Test get_extra returns asset metadata for mainnet."""
        signer = make_mock_signer()
        facilitator = ExactTonFacilitatorScheme(signer=signer)
        extra = facilitator.get_extra(TON_MAINNET)

        assert extra is not None
        assert extra["defaultAsset"] == USDT_MAINNET_ADDRESS
        assert extra["symbol"] == "USDT"
        assert extra["decimals"] == 6

    def test_get_extra_testnet(self):
        """Test get_extra returns asset metadata for testnet."""
        signer = make_mock_signer()
        facilitator = ExactTonFacilitatorScheme(signer=signer)
        extra = facilitator.get_extra(TON_TESTNET)

        assert extra is not None
        assert extra["defaultAsset"] == USDT_TESTNET_ADDRESS
        assert extra["symbol"] == "USDT"
        assert extra["decimals"] == 6

    def test_get_extra_unsupported_network(self):
        """Test get_extra returns None for unsupported network."""
        signer = make_mock_signer()
        facilitator = ExactTonFacilitatorScheme(signer=signer)
        extra = facilitator.get_extra("invalid:network")

        assert extra is None


class TestExactTonFacilitatorGetSigners:
    """Test get_signers method."""

    def test_get_signers_returns_addresses(self):
        """Test get_signers returns addresses from the signer."""
        addresses = [TEST_FACILITATOR_ADDRESS, "EQSecondAddress"]
        signer = make_mock_signer(addresses=addresses)
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        result = facilitator.get_signers(TON_MAINNET)

        assert result == addresses
        signer.get_addresses.assert_called_once_with(TON_MAINNET)

    def test_get_signers_empty(self):
        """Test get_signers returns empty list when no addresses."""
        signer = make_mock_signer(addresses=[])
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        result = facilitator.get_signers(TON_MAINNET)

        assert result == []


class TestExactTonFacilitatorVerify:
    """Test verify method of ExactTonFacilitatorScheme."""

    @pytest.mark.asyncio
    async def test_verify_valid_payload(self):
        """Test verification succeeds with valid payload."""
        signer = make_mock_signer(seqno=5)
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload(seqno=5)
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True
        assert result.payer == TEST_SENDER
        assert result.invalid_reason is None

    @pytest.mark.asyncio
    async def test_verify_unsupported_scheme(self):
        """Test verification fails with unsupported scheme."""
        signer = make_mock_signer()
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements(scheme="streaming")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "unsupported_scheme"

    @pytest.mark.asyncio
    async def test_verify_unsupported_network(self):
        """Test verification fails with unsupported network."""
        signer = make_mock_signer()
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements(network="invalid:network")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "unsupported_network"

    @pytest.mark.asyncio
    async def test_verify_missing_signed_boc(self):
        """Test verification fails when signedBoc is missing."""
        signer = make_mock_signer()
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = {
            "authorization": {
                "from": TEST_SENDER,
                "to": TEST_RECIPIENT,
                "jettonMaster": TEST_ASSET,
                "jettonAmount": "1000000",
                "tonAmount": "100000000",
                "validUntil": int(time.time()) + 3600,
                "seqno": 5,
                "queryId": "123",
            }
        }
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "invalid_payload"

    @pytest.mark.asyncio
    async def test_verify_missing_authorization(self):
        """Test verification fails when authorization is missing."""
        signer = make_mock_signer()
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = {"signedBoc": TEST_VALID_BOC}
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "invalid_payload"

    @pytest.mark.asyncio
    async def test_verify_missing_from_address(self):
        """Test verification fails when from address is missing."""
        signer = make_mock_signer()
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = {
            "signedBoc": TEST_VALID_BOC,
            "authorization": {
                "to": TEST_RECIPIENT,
                "jettonMaster": TEST_ASSET,
                "jettonAmount": "1000000",
                "tonAmount": "100000000",
                "validUntil": int(time.time()) + 3600,
                "seqno": 5,
                "queryId": "123",
            },
        }
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "invalid_payload"

    @pytest.mark.asyncio
    async def test_verify_invalid_boc_format(self):
        """Test verification fails with invalid BOC format."""
        signer = make_mock_signer()
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload(signed_boc="not-valid-base64!!!")
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "invalid_boc_format"
        assert result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_verify_message_verification_fails(self):
        """Test verification fails when message structure is invalid."""
        signer = make_mock_signer(
            verify_valid=False,
            verify_reason="invalid_transfer_op",
        )
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "message_verification_failed" in result.invalid_reason
        assert "invalid_transfer_op" in result.invalid_reason
        assert result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_verify_authorization_expired(self):
        """Test verification fails when authorization has expired."""
        signer = make_mock_signer()
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        # Set valid_until to a time in the past
        expired_time = int(time.time()) - 100
        payload = make_valid_payload(valid_until=expired_time)
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "authorization_expired"
        assert result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_verify_authorization_within_buffer(self):
        """Test verification fails when validity is within the buffer window."""
        signer = make_mock_signer()
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        # Set valid_until to within the 30-second buffer
        near_expiry = int(time.time()) + MIN_VALIDITY_BUFFER - 1
        payload = make_valid_payload(valid_until=near_expiry)
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "authorization_expired"

    @pytest.mark.asyncio
    async def test_verify_insufficient_balance(self):
        """Test verification fails when Jetton balance is insufficient."""
        signer = make_mock_signer(balance="500000")  # Less than required
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload(seqno=5)
        requirements = make_requirements(amount="1000000")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "insufficient_jetton_balance"
        assert result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_verify_balance_check_failure(self):
        """Test verification fails gracefully when balance check errors."""
        signer = make_mock_signer()
        signer.get_jetton_balance = AsyncMock(return_value="not_a_number")
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload(seqno=5)
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "balance_check_failed"

    @pytest.mark.asyncio
    async def test_verify_invalid_required_amount(self):
        """Test verification fails with non-numeric required amount."""
        signer = make_mock_signer()
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload(seqno=5)
        requirements = make_requirements(amount="not_a_number")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "invalid_required_amount"

    @pytest.mark.asyncio
    async def test_verify_insufficient_payload_amount(self):
        """Test verification fails when payload amount < required."""
        signer = make_mock_signer(balance="5000000", seqno=5)
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload(jetton_amount="500000", seqno=5)
        requirements = make_requirements(amount="1000000")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "insufficient_amount"
        assert result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_verify_payload_amount_equals_required(self):
        """Test verification passes when payload amount equals required."""
        signer = make_mock_signer(balance="1000000", seqno=5)
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload(jetton_amount="1000000", seqno=5)
        requirements = make_requirements(amount="1000000")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_payload_amount_exceeds_required(self):
        """Test verification passes when payload amount exceeds required."""
        signer = make_mock_signer(balance="5000000", seqno=5)
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload(jetton_amount="2000000", seqno=5)
        requirements = make_requirements(amount="1000000")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_recipient_mismatch(self):
        """Test verification fails when recipient doesn't match payTo."""
        signer = make_mock_signer(seqno=5)
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        wrong_recipient = "EQWrongRecipientAddress123456789012345678901234"
        payload = make_valid_payload(to_addr=wrong_recipient, seqno=5)
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "recipient_mismatch"

    @pytest.mark.asyncio
    async def test_verify_asset_mismatch(self):
        """Test verification fails when Jetton master doesn't match asset."""
        signer = make_mock_signer(seqno=5)
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        wrong_asset = "EQWrongAssetAddress1234567890123456789012345678"
        payload = make_valid_payload(jetton_master=wrong_asset, seqno=5)
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "asset_mismatch"

    @pytest.mark.asyncio
    async def test_verify_seqno_already_used(self):
        """Test verification fails when seqno is less than current."""
        signer = make_mock_signer(seqno=10)  # Current seqno is 10
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload(seqno=5)  # Payload seqno is 5 (< 10)
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "seqno_already_used"

    @pytest.mark.asyncio
    async def test_verify_seqno_too_high(self):
        """Test verification fails when seqno is greater than current."""
        signer = make_mock_signer(seqno=5)  # Current seqno is 5
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload(seqno=10)  # Payload seqno is 10 (> 5)
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "seqno_too_high"

    @pytest.mark.asyncio
    async def test_verify_seqno_matches_current(self):
        """Test verification passes when seqno matches current."""
        signer = make_mock_signer(seqno=5)
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload(seqno=5)
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_seqno_check_failure(self):
        """Test verification fails gracefully when seqno check errors."""
        signer = make_mock_signer()
        signer.get_seqno = AsyncMock(side_effect=RuntimeError("RPC error"))
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "seqno_check_failed"

    @pytest.mark.asyncio
    async def test_verify_wallet_not_deployed(self):
        """Test verification fails when wallet is not deployed."""
        signer = make_mock_signer(is_deployed=False, seqno=5)
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload(seqno=5)
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "wallet_not_deployed"

    @pytest.mark.asyncio
    async def test_verify_deployment_check_failure(self):
        """Test verification fails gracefully when deployment check errors."""
        signer = make_mock_signer(seqno=5)
        signer.is_deployed = AsyncMock(side_effect=RuntimeError("RPC error"))
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload(seqno=5)
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "deployment_check_failed"

    @pytest.mark.asyncio
    async def test_verify_handles_nested_payload(self):
        """Test verification handles PaymentPayloadV2-style nested payload."""
        signer = make_mock_signer(seqno=5)
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        inner_payload = make_valid_payload(seqno=5)
        wrapped_payload = {
            "t402Version": 2,
            "payload": inner_payload,
        }
        requirements = make_requirements()

        result = await facilitator.verify(wrapped_payload, requirements)

        assert result.is_valid is True
        assert result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_verify_handles_snake_case_fields(self):
        """Test verification handles snake_case payload fields."""
        signer = make_mock_signer(seqno=5)
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = {
            "signed_boc": TEST_VALID_BOC,
            "authorization": {
                "from": TEST_SENDER,
                "to": TEST_RECIPIENT,
                "jetton_master": TEST_ASSET,
                "jetton_amount": "1000000",
                "ton_amount": "100000000",
                "valid_until": int(time.time()) + 3600,
                "seqno": 5,
                "query_id": "1234567890",
            },
        }
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_recipient_case_insensitive(self):
        """Test recipient comparison is case-insensitive."""
        signer = make_mock_signer(seqno=5)
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload(to_addr=TEST_RECIPIENT.lower(), seqno=5)
        requirements = make_requirements(pay_to=TEST_RECIPIENT.upper())

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_handles_exception_gracefully(self):
        """Test verification handles unexpected exceptions gracefully."""
        signer = make_mock_signer()
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        # Pass a completely broken object that will raise on dict access
        with patch.object(
            facilitator,
            "_extract_payload",
            side_effect=RuntimeError("Unexpected error"),
        ):
            result = await facilitator.verify({}, make_requirements())

        assert result.is_valid is False
        assert "verification_error" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_with_pydantic_model_requirements(self):
        """Test verification with Pydantic model requirements."""
        from t402.types import PaymentRequirementsV2

        signer = make_mock_signer(seqno=5)
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload(seqno=5)
        requirements = PaymentRequirementsV2(
            scheme="exact",
            network=TEST_NETWORK,
            asset=TEST_ASSET,
            amount="1000000",
            pay_to=TEST_RECIPIENT,
            max_timeout_seconds=300,
            extra={},
        )

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True
        assert result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_verify_calls_signer_methods_correctly(self):
        """Test that verify calls signer methods with correct parameters."""
        signer = make_mock_signer(seqno=5)
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload(
            jetton_amount="2000000",
            seqno=5,
        )
        requirements = make_requirements(amount="1000000")

        await facilitator.verify(payload, requirements)

        # Verify message was called with correct params
        signer.verify_message.assert_called_once_with(
            signed_boc=TEST_VALID_BOC,
            expected_from=TEST_SENDER,
            expected_transfer={
                "jetton_amount": "2000000",
                "destination": TEST_RECIPIENT,
                "jetton_master": TEST_ASSET,
            },
            network=TEST_NETWORK,
        )

        # Balance check with correct params
        signer.get_jetton_balance.assert_called_once_with(
            owner_address=TEST_SENDER,
            jetton_master_address=TEST_ASSET,
            network=TEST_NETWORK,
        )

        # Seqno check with correct params
        signer.get_seqno.assert_called_once_with(TEST_SENDER, TEST_NETWORK)

        # Deployment check with correct params
        signer.is_deployed.assert_called_once_with(TEST_SENDER, TEST_NETWORK)

    @pytest.mark.asyncio
    async def test_verify_testnet(self):
        """Test verification works on testnet."""
        signer = make_mock_signer(seqno=0)
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload(
            jetton_master=USDT_TESTNET_ADDRESS,
            seqno=0,
        )
        requirements = make_requirements(
            network=TON_TESTNET,
            asset=USDT_TESTNET_ADDRESS,
        )

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True


class TestExactTonFacilitatorSettle:
    """Test settle method of ExactTonFacilitatorScheme."""

    @pytest.mark.asyncio
    async def test_settle_success(self):
        """Test successful settlement."""
        signer = make_mock_signer(
            seqno=5,
            tx_hash=TEST_TX_HASH,
            confirmation_success=True,
            confirmation_hash="confirmed_hash_123",
        )
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload(seqno=5)
        requirements = make_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is True
        assert result.transaction == "confirmed_hash_123"
        assert result.network == TEST_NETWORK
        assert result.payer == TEST_SENDER
        assert result.error_reason is None

    @pytest.mark.asyncio
    async def test_settle_uses_initial_hash_when_no_confirmation_hash(self):
        """Test settlement uses initial tx hash when confirmation has no hash."""
        signer = make_mock_signer(
            seqno=5,
            tx_hash="initial_hash",
            confirmation_success=True,
            confirmation_hash=None,
        )
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload(seqno=5)
        requirements = make_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is True
        assert result.transaction == "initial_hash"

    @pytest.mark.asyncio
    async def test_settle_fails_on_verification_failure(self):
        """Test settlement fails when verification fails."""
        signer = make_mock_signer(seqno=10)  # Seqno mismatch
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload(seqno=5)  # Wrong seqno
        requirements = make_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert result.error_reason == "seqno_already_used"
        assert result.network == TEST_NETWORK

    @pytest.mark.asyncio
    async def test_settle_broadcast_failure(self):
        """Test settlement handles broadcast failure."""
        signer = make_mock_signer(seqno=5)
        signer.send_external_message = AsyncMock(
            side_effect=RuntimeError("Network timeout")
        )
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload(seqno=5)
        requirements = make_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert "transaction_failed" in result.error_reason
        assert "Network timeout" in result.error_reason
        assert result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_settle_confirmation_timeout(self):
        """Test settlement handles confirmation timeout."""
        signer = make_mock_signer(
            seqno=5,
            tx_hash=TEST_TX_HASH,
            confirmation_success=False,
            confirmation_error="timeout",
        )
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload(seqno=5)
        requirements = make_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert result.error_reason == "timeout"
        assert result.transaction == TEST_TX_HASH
        assert result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_settle_confirmation_exception(self):
        """Test settlement handles confirmation exception."""
        signer = make_mock_signer(seqno=5, tx_hash=TEST_TX_HASH)
        signer.wait_for_transaction = AsyncMock(
            side_effect=RuntimeError("Connection lost")
        )
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload(seqno=5)
        requirements = make_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert "transaction_confirmation_failed" in result.error_reason
        assert result.transaction == TEST_TX_HASH

    @pytest.mark.asyncio
    async def test_settle_calls_send_and_wait_correctly(self):
        """Test settle calls signer methods with correct parameters."""
        signer = make_mock_signer(
            seqno=5,
            tx_hash="msg_hash",
            confirmation_success=True,
            confirmation_hash="tx_hash",
        )
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload(seqno=5)
        requirements = make_requirements()

        await facilitator.settle(payload, requirements)

        # Verify send_external_message was called with correct params
        signer.send_external_message.assert_called_once_with(
            signed_boc=TEST_VALID_BOC,
            network=TEST_NETWORK,
        )

        # Verify wait_for_transaction was called with seqno + 1
        signer.wait_for_transaction.assert_called_once_with(
            address=TEST_SENDER,
            seqno=6,  # 5 + 1
            timeout_ms=60000,
            network=TEST_NETWORK,
        )

    @pytest.mark.asyncio
    async def test_settle_with_nested_payload(self):
        """Test settle handles PaymentPayloadV2-style nested payload."""
        signer = make_mock_signer(
            seqno=5,
            confirmation_success=True,
            confirmation_hash="nested_tx_hash",
        )
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        inner_payload = make_valid_payload(seqno=5)
        wrapped_payload = {
            "t402Version": 2,
            "payload": inner_payload,
        }
        requirements = make_requirements()

        result = await facilitator.settle(wrapped_payload, requirements)

        assert result.success is True
        assert result.transaction == "nested_tx_hash"

    @pytest.mark.asyncio
    async def test_settle_with_pydantic_model_requirements(self):
        """Test settle with Pydantic model requirements."""
        from t402.types import PaymentRequirementsV2

        signer = make_mock_signer(
            seqno=5,
            confirmation_success=True,
            confirmation_hash="model_tx_hash",
        )
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload(seqno=5)
        requirements = PaymentRequirementsV2(
            scheme="exact",
            network=TEST_NETWORK,
            asset=TEST_ASSET,
            amount="1000000",
            pay_to=TEST_RECIPIENT,
            max_timeout_seconds=300,
            extra={},
        )

        result = await facilitator.settle(payload, requirements)

        assert result.success is True


class TestExactTonFacilitatorExtractHelpers:
    """Test payload and requirements extraction helpers."""

    def test_extract_payload_from_dict(self):
        """Test extracting payload from plain dict."""
        signer = make_mock_signer()
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload_data = make_valid_payload()
        result = facilitator._extract_payload(payload_data)

        assert result["signedBoc"] == TEST_VALID_BOC
        assert result["authorization"]["from"] == TEST_SENDER

    def test_extract_payload_from_wrapped_dict(self):
        """Test extracting payload from wrapped dict (V2 format)."""
        signer = make_mock_signer()
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        inner = make_valid_payload()
        wrapped = {"t402Version": 2, "payload": inner}
        result = facilitator._extract_payload(wrapped)

        assert result["signedBoc"] == TEST_VALID_BOC
        assert result["authorization"]["from"] == TEST_SENDER

    def test_extract_requirements_from_dict(self):
        """Test extracting requirements from plain dict."""
        signer = make_mock_signer()
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        requirements = make_requirements()
        result = facilitator._extract_requirements(requirements)

        assert result["scheme"] == "exact"
        assert result["network"] == TEST_NETWORK
        assert result["amount"] == "1000000"

    def test_extract_requirements_from_model(self):
        """Test extracting requirements from Pydantic model."""
        from t402.types import PaymentRequirementsV2

        signer = make_mock_signer()
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        model = PaymentRequirementsV2(
            scheme="exact",
            network=TEST_NETWORK,
            asset=TEST_ASSET,
            amount="1000000",
            pay_to=TEST_RECIPIENT,
            max_timeout_seconds=300,
            extra={},
        )
        result = facilitator._extract_requirements(model)

        assert result["scheme"] == "exact"
        assert result["payTo"] == TEST_RECIPIENT


class TestExactTonFacilitatorParseTonPayload:
    """Test _parse_ton_payload helper."""

    def test_parse_camel_case_payload(self):
        """Test parsing camelCase payload fields."""
        signer = make_mock_signer()
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload_data = {
            "signedBoc": TEST_VALID_BOC,
            "authorization": {
                "from": TEST_SENDER,
                "to": TEST_RECIPIENT,
                "jettonMaster": TEST_ASSET,
                "jettonAmount": "1000000",
                "tonAmount": "100000000",
                "validUntil": 1234567890,
                "seqno": 5,
                "queryId": "123456",
            },
        }

        result = facilitator._parse_ton_payload(payload_data)

        assert result is not None
        assert result["signed_boc"] == TEST_VALID_BOC
        assert result["authorization"]["from"] == TEST_SENDER
        assert result["authorization"]["to"] == TEST_RECIPIENT
        assert result["authorization"]["jetton_master"] == TEST_ASSET
        assert result["authorization"]["jetton_amount"] == "1000000"
        assert result["authorization"]["ton_amount"] == "100000000"
        assert result["authorization"]["valid_until"] == 1234567890
        assert result["authorization"]["seqno"] == 5
        assert result["authorization"]["query_id"] == "123456"

    def test_parse_snake_case_payload(self):
        """Test parsing snake_case payload fields."""
        signer = make_mock_signer()
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload_data = {
            "signed_boc": TEST_VALID_BOC,
            "authorization": {
                "from": TEST_SENDER,
                "to": TEST_RECIPIENT,
                "jetton_master": TEST_ASSET,
                "jetton_amount": "2000000",
                "ton_amount": "200000000",
                "valid_until": 9999999999,
                "seqno": 10,
                "query_id": "654321",
            },
        }

        result = facilitator._parse_ton_payload(payload_data)

        assert result is not None
        assert result["signed_boc"] == TEST_VALID_BOC
        assert result["authorization"]["jetton_amount"] == "2000000"
        assert result["authorization"]["valid_until"] == 9999999999

    def test_parse_missing_boc_returns_none(self):
        """Test that missing BOC returns None."""
        signer = make_mock_signer()
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        result = facilitator._parse_ton_payload({"authorization": {"from": "x"}})
        assert result is None

    def test_parse_missing_authorization_returns_none(self):
        """Test that missing authorization returns None."""
        signer = make_mock_signer()
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        result = facilitator._parse_ton_payload({"signedBoc": TEST_VALID_BOC})
        assert result is None

    def test_parse_missing_from_returns_none(self):
        """Test that missing from address returns None."""
        signer = make_mock_signer()
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        result = facilitator._parse_ton_payload({
            "signedBoc": TEST_VALID_BOC,
            "authorization": {"to": TEST_RECIPIENT},
        })
        assert result is None

    def test_parse_empty_boc_returns_none(self):
        """Test that empty BOC returns None."""
        signer = make_mock_signer()
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        result = facilitator._parse_ton_payload({
            "signedBoc": "",
            "authorization": {"from": TEST_SENDER},
        })
        assert result is None

    def test_parse_defaults_for_missing_optional_fields(self):
        """Test that optional fields get defaults when missing."""
        signer = make_mock_signer()
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        result = facilitator._parse_ton_payload({
            "signedBoc": TEST_VALID_BOC,
            "authorization": {
                "from": TEST_SENDER,
            },
        })

        assert result is not None
        assert result["authorization"]["to"] == ""
        assert result["authorization"]["jetton_master"] == ""
        assert result["authorization"]["jetton_amount"] == "0"
        assert result["authorization"]["ton_amount"] == "0"
        assert result["authorization"]["valid_until"] == 0
        assert result["authorization"]["seqno"] == 0
        assert result["authorization"]["query_id"] == ""


class TestExactTonFacilitatorIntegration:
    """Integration-style tests for verify + settle flow."""

    @pytest.mark.asyncio
    async def test_full_verify_then_settle_flow(self):
        """Test the full verify -> settle flow."""
        signer = make_mock_signer(
            seqno=5,
            balance="5000000",
            tx_hash="broadcast_hash",
            confirmation_success=True,
            confirmation_hash="final_tx_hash",
        )
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload(
            jetton_amount="2000000",
            seqno=5,
        )
        requirements = make_requirements(amount="1000000")

        # Step 1: Verify
        verify_result = await facilitator.verify(payload, requirements)
        assert verify_result.is_valid is True
        assert verify_result.payer == TEST_SENDER

        # Step 2: Settle
        settle_result = await facilitator.settle(payload, requirements)
        assert settle_result.success is True
        assert settle_result.transaction == "final_tx_hash"
        assert settle_result.network == TEST_NETWORK
        assert settle_result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_verify_failure_prevents_settle(self):
        """Test that verification failure prevents settlement."""
        signer = make_mock_signer(
            seqno=5,
            balance="100",  # Insufficient balance
        )
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload(seqno=5)
        requirements = make_requirements(amount="1000000")

        # Verify fails
        verify_result = await facilitator.verify(payload, requirements)
        assert verify_result.is_valid is False
        assert verify_result.invalid_reason == "insufficient_jetton_balance"

        # Settle also fails (calls verify internally)
        settle_result = await facilitator.settle(payload, requirements)
        assert settle_result.success is False
        assert settle_result.error_reason == "insufficient_jetton_balance"

        # send_external_message should not have been called
        signer.send_external_message.assert_not_called()

    @pytest.mark.asyncio
    async def test_settle_verify_is_called_internally(self):
        """Test that settle calls verify internally before broadcasting."""
        signer = make_mock_signer(
            seqno=5,
            confirmation_success=True,
            confirmation_hash="settled_hash",
        )
        facilitator = ExactTonFacilitatorScheme(signer=signer)

        payload = make_valid_payload(seqno=5)
        requirements = make_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is True

        # The signer's verify_message should have been called (from verify())
        signer.verify_message.assert_called()
        # Balance should have been checked
        signer.get_jetton_balance.assert_called()
        # Seqno should have been checked
        signer.get_seqno.assert_called()
        # Deployment should have been checked
        signer.is_deployed.assert_called()


class TestFacilitatorTonSignerProtocol:
    """Test FacilitatorTonSigner protocol compliance."""

    def test_mock_signer_matches_protocol(self):
        """Test that our mock signer matches the protocol shape."""
        signer = make_mock_signer()
        # Verify it has all required methods
        assert hasattr(signer, "get_addresses")
        assert hasattr(signer, "get_jetton_balance")
        assert hasattr(signer, "verify_message")
        assert hasattr(signer, "send_external_message")
        assert hasattr(signer, "wait_for_transaction")
        assert hasattr(signer, "get_seqno")
        assert hasattr(signer, "is_deployed")

    def test_protocol_is_runtime_checkable(self):
        """Test that FacilitatorTonSigner is runtime checkable."""
        assert hasattr(FacilitatorTonSigner, "__protocol_attrs__") or hasattr(
            FacilitatorTonSigner, "__abstractmethods__"
        )
