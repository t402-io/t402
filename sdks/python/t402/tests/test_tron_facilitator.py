"""Tests for TRON Exact Scheme - Facilitator Implementation."""

import time

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from t402.schemes.tron.exact.facilitator import (
    ExactTronFacilitatorScheme,
    ExactTronFacilitatorConfig,
    FacilitatorTronSigner,
    DEFAULT_CONFIRMATION_TIMEOUT,
)
from t402.schemes.interfaces import SchemeNetworkFacilitator
from t402.tron import (
    TRON_MAINNET,
    TRON_NILE,
    USDT_MAINNET_ADDRESS,
    USDT_NILE_ADDRESS,
    MIN_VALIDITY_BUFFER,
    TronVerifyResult,
    TronTransactionConfirmation,
)
from t402.types import VerifyResponse, SettleResponse, PaymentRequirementsV2


# Test constants
TEST_SENDER = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
TEST_RECIPIENT = "TJYPgMHqGBqbjmgcDxBQEL1PPxbRvnLBKY"
TEST_FACILITATOR_ADDR = "TLSiYeFjQCfXosuuJgbnTPyaVz8P6taTzm"
TEST_NETWORK = TRON_MAINNET
TEST_ASSET = USDT_MAINNET_ADDRESS
TEST_AMOUNT = "1000000"
TEST_TX_ID = "abc123def456789012345678901234567890abcdef1234567890abcdef12345678"
TEST_SIGNED_TX = "0a02abcd2208deadbeef123456784090c1f6a5e6315a6a080112640a2d747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e54726967676572536d617274436f6e747261637412330a1541abcdef12345678901234567890abcdef12345678901215411234567890123456789012345678901234567890222461313233"


def make_mock_signer(
    addresses: list = None,
    verify_valid: bool = True,
    verify_reason: str = None,
    balance: str = "10000000",
    is_active: bool = True,
    broadcast_tx_id: str = TEST_TX_ID,
    confirmation_success: bool = True,
    confirmation_tx_id: str = None,
    confirmation_error: str = None,
) -> MagicMock:
    """Create a mock FacilitatorTronSigner with configurable behavior.

    Args:
        addresses: List of addresses to return from get_addresses
        verify_valid: Whether verify_transaction returns valid
        verify_reason: Reason for verification failure
        balance: Balance to return from get_balance
        is_active: Whether account is activated
        broadcast_tx_id: TX ID to return from broadcast
        confirmation_success: Whether confirmation succeeds
        confirmation_tx_id: TX ID from confirmation
        confirmation_error: Error message from confirmation

    Returns:
        Configured mock signer
    """
    if addresses is None:
        addresses = [TEST_FACILITATOR_ADDR]

    signer = MagicMock()
    signer.get_addresses = MagicMock(return_value=addresses)

    verify_result = TronVerifyResult(valid=verify_valid, reason=verify_reason)
    signer.verify_transaction = AsyncMock(return_value=verify_result)

    signer.get_balance = AsyncMock(return_value=balance)
    signer.is_activated = AsyncMock(return_value=is_active)
    signer.broadcast_transaction = AsyncMock(return_value=broadcast_tx_id)

    confirmation = TronTransactionConfirmation(
        success=confirmation_success,
        tx_id=confirmation_tx_id,
        error=confirmation_error,
    )
    signer.wait_for_transaction = AsyncMock(return_value=confirmation)

    return signer


def make_valid_payload(
    signed_transaction: str = TEST_SIGNED_TX,
    from_addr: str = TEST_SENDER,
    to_addr: str = TEST_RECIPIENT,
    contract_address: str = TEST_ASSET,
    amount: str = TEST_AMOUNT,
    expiration: int = None,
    ref_block_bytes: str = "abcd",
    ref_block_hash: str = "deadbeef12345678",
    timestamp: int = None,
) -> dict:
    """Create a valid TRON payment payload for testing.

    Args:
        signed_transaction: Hex-encoded signed transaction
        from_addr: Sender address
        to_addr: Recipient address
        contract_address: TRC-20 contract address
        amount: Transfer amount in atomic units
        expiration: Transaction expiration (ms), defaults to 1 hour from now
        ref_block_bytes: Reference block bytes
        ref_block_hash: Reference block hash
        timestamp: Transaction timestamp (ms), defaults to now

    Returns:
        Dict representing TronPaymentPayload
    """
    now_ms = int(time.time() * 1000)
    if expiration is None:
        expiration = now_ms + 3600000  # 1 hour from now
    if timestamp is None:
        timestamp = now_ms

    return {
        "signedTransaction": signed_transaction,
        "authorization": {
            "from": from_addr,
            "to": to_addr,
            "contractAddress": contract_address,
            "amount": amount,
            "expiration": expiration,
            "refBlockBytes": ref_block_bytes,
            "refBlockHash": ref_block_hash,
            "timestamp": timestamp,
        },
    }


def make_requirements(
    scheme: str = "exact",
    network: str = TEST_NETWORK,
    asset: str = TEST_ASSET,
    amount: str = TEST_AMOUNT,
    pay_to: str = TEST_RECIPIENT,
    max_timeout_seconds: int = 300,
) -> dict:
    """Create payment requirements for testing.

    Args:
        scheme: Payment scheme
        network: Network identifier
        asset: TRC-20 contract address
        amount: Required amount in atomic units
        pay_to: Payment recipient address
        max_timeout_seconds: Maximum timeout

    Returns:
        Dict representing PaymentRequirementsV2
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


class TestExactTronFacilitatorBasic:
    """Test basic properties of ExactTronFacilitatorScheme."""

    def test_scheme_name(self):
        """Test scheme is 'exact'."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)
        assert facilitator.scheme == "exact"

    def test_caip_family(self):
        """Test CAIP family is tron:*."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)
        assert facilitator.caip_family == "tron:*"

    def test_protocol_compliance(self):
        """Test that ExactTronFacilitatorScheme implements SchemeNetworkFacilitator."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)
        assert isinstance(facilitator, SchemeNetworkFacilitator)
        assert hasattr(facilitator, "scheme")
        assert hasattr(facilitator, "caip_family")
        assert hasattr(facilitator, "get_signers")
        assert hasattr(facilitator, "get_extra")
        assert hasattr(facilitator, "verify")
        assert hasattr(facilitator, "settle")

    def test_init_without_config(self):
        """Test initialization without config."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)
        assert facilitator._config is None

    def test_init_with_config(self):
        """Test initialization with config."""
        signer = make_mock_signer()
        config = ExactTronFacilitatorConfig(can_sponsor_gas=True)
        facilitator = ExactTronFacilitatorScheme(signer=signer, config=config)
        assert facilitator._config is not None
        assert facilitator._config.can_sponsor_gas is True


class TestExactTronFacilitatorConfig:
    """Test ExactTronFacilitatorConfig."""

    def test_default_config(self):
        """Test default config has can_sponsor_gas=False."""
        config = ExactTronFacilitatorConfig()
        assert config.can_sponsor_gas is False

    def test_config_with_gas_sponsor(self):
        """Test config with gas sponsorship enabled."""
        config = ExactTronFacilitatorConfig(can_sponsor_gas=True)
        assert config.can_sponsor_gas is True


class TestExactTronFacilitatorGetExtra:
    """Test get_extra method."""

    def test_get_extra_for_mainnet(self):
        """Test get_extra returns mainnet asset info."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)
        extra = facilitator.get_extra(TRON_MAINNET)

        assert extra is not None
        assert extra["defaultAsset"] == USDT_MAINNET_ADDRESS
        assert extra["symbol"] == "USDT"
        assert extra["decimals"] == 6

    def test_get_extra_for_nile(self):
        """Test get_extra returns nile asset info."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)
        extra = facilitator.get_extra(TRON_NILE)

        assert extra is not None
        assert extra["defaultAsset"] == USDT_NILE_ADDRESS
        assert extra["symbol"] == "USDT"

    def test_get_extra_unsupported_network(self):
        """Test get_extra returns None for unsupported network."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)
        extra = facilitator.get_extra("tron:unknown")

        assert extra is None

    def test_get_extra_with_gas_sponsor(self):
        """Test get_extra includes gasSponsor when configured."""
        signer = make_mock_signer(addresses=[TEST_FACILITATOR_ADDR])
        config = ExactTronFacilitatorConfig(can_sponsor_gas=True)
        facilitator = ExactTronFacilitatorScheme(signer=signer, config=config)
        extra = facilitator.get_extra(TRON_MAINNET)

        assert extra is not None
        assert extra["gasSponsor"] == TEST_FACILITATOR_ADDR

    def test_get_extra_without_gas_sponsor(self):
        """Test get_extra does not include gasSponsor by default."""
        signer = make_mock_signer(addresses=[TEST_FACILITATOR_ADDR])
        facilitator = ExactTronFacilitatorScheme(signer=signer)
        extra = facilitator.get_extra(TRON_MAINNET)

        assert extra is not None
        assert "gasSponsor" not in extra

    def test_get_extra_gas_sponsor_no_addresses(self):
        """Test get_extra with gas sponsor but no addresses."""
        signer = make_mock_signer(addresses=[])
        config = ExactTronFacilitatorConfig(can_sponsor_gas=True)
        facilitator = ExactTronFacilitatorScheme(signer=signer, config=config)
        extra = facilitator.get_extra(TRON_MAINNET)

        assert extra is not None
        assert "gasSponsor" not in extra


class TestExactTronFacilitatorGetSigners:
    """Test get_signers method."""

    def test_get_signers_returns_addresses(self):
        """Test get_signers returns signer addresses."""
        signer = make_mock_signer(addresses=[TEST_FACILITATOR_ADDR])
        facilitator = ExactTronFacilitatorScheme(signer=signer)
        signers = facilitator.get_signers(TRON_MAINNET)

        assert len(signers) == 1
        assert signers[0] == TEST_FACILITATOR_ADDR

    def test_get_signers_multiple_addresses(self):
        """Test get_signers with multiple addresses."""
        addresses = [TEST_FACILITATOR_ADDR, TEST_SENDER]
        signer = make_mock_signer(addresses=addresses)
        facilitator = ExactTronFacilitatorScheme(signer=signer)
        signers = facilitator.get_signers(TRON_MAINNET)

        assert len(signers) == 2

    def test_get_signers_empty(self):
        """Test get_signers returns empty when no addresses."""
        signer = make_mock_signer(addresses=[])
        facilitator = ExactTronFacilitatorScheme(signer=signer)
        signers = facilitator.get_signers(TRON_MAINNET)

        assert len(signers) == 0

    def test_get_signers_passes_network(self):
        """Test get_signers passes network to signer."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)
        facilitator.get_signers(TRON_NILE)

        signer.get_addresses.assert_called_with(TRON_NILE)


class TestExactTronFacilitatorVerify:
    """Test verify method of ExactTronFacilitatorScheme."""

    @pytest.mark.asyncio
    async def test_verify_valid_payload(self):
        """Test successful verification of a valid payload."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True
        assert result.payer == TEST_SENDER
        assert result.invalid_reason is None

    @pytest.mark.asyncio
    async def test_verify_unsupported_scheme(self):
        """Test verification fails for unsupported scheme."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements(scheme="upto")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "unsupported_scheme"

    @pytest.mark.asyncio
    async def test_verify_unsupported_network(self):
        """Test verification fails for unsupported network."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements(network="tron:unknown")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "unsupported_network"

    @pytest.mark.asyncio
    async def test_verify_missing_signed_transaction(self):
        """Test verification fails when signedTransaction is missing."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = {
            "authorization": {
                "from": TEST_SENDER,
                "to": TEST_RECIPIENT,
                "contractAddress": TEST_ASSET,
                "amount": TEST_AMOUNT,
                "expiration": int(time.time() * 1000) + 3600000,
                "refBlockBytes": "abcd",
                "refBlockHash": "deadbeef12345678",
                "timestamp": int(time.time() * 1000),
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
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = {"signedTransaction": TEST_SIGNED_TX}
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "invalid_payload"

    @pytest.mark.asyncio
    async def test_verify_missing_authorization_from(self):
        """Test verification fails when authorization.from is missing."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = {
            "signedTransaction": TEST_SIGNED_TX,
            "authorization": {
                "to": TEST_RECIPIENT,
                "contractAddress": TEST_ASSET,
                "amount": TEST_AMOUNT,
                "expiration": int(time.time() * 1000) + 3600000,
                "refBlockBytes": "abcd",
                "refBlockHash": "deadbeef12345678",
                "timestamp": int(time.time() * 1000),
            },
        }
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "invalid_payload"

    @pytest.mark.asyncio
    async def test_verify_invalid_sender_address(self):
        """Test verification fails with invalid sender address."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload(from_addr="InvalidAddress")
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "invalid_sender_address"

    @pytest.mark.asyncio
    async def test_verify_invalid_recipient_address(self):
        """Test verification fails with invalid recipient address."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload(to_addr="BadRecipient")
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "invalid_recipient_address"

    @pytest.mark.asyncio
    async def test_verify_invalid_contract_address(self):
        """Test verification fails with invalid contract address."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload(contract_address="NotAnAddress")
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "invalid_contract_address"

    @pytest.mark.asyncio
    async def test_verify_transaction_verification_fails(self):
        """Test verification fails when signer transaction verification fails."""
        signer = make_mock_signer(verify_valid=False, verify_reason="invalid_signature")
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "transaction_verification_failed" in result.invalid_reason
        assert "invalid_signature" in result.invalid_reason
        assert result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_verify_transaction_verification_fails_unknown_reason(self):
        """Test verification failure with no specific reason."""
        signer = make_mock_signer(verify_valid=False, verify_reason=None)
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "transaction_verification_failed: unknown" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_authorization_expired(self):
        """Test verification fails when authorization is expired."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        # Set expiration to the past
        past_expiration = int(time.time() * 1000) - 60000  # 1 minute ago
        payload = make_valid_payload(expiration=past_expiration)
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "authorization_expired"
        assert result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_verify_authorization_within_buffer(self):
        """Test verification fails when expiration is within the validity buffer."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        # Set expiration just within the buffer period
        now_ms = int(time.time() * 1000)
        expiration = now_ms + (MIN_VALIDITY_BUFFER * 1000) - 1000  # Just under buffer
        payload = make_valid_payload(expiration=expiration)
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "authorization_expired"

    @pytest.mark.asyncio
    async def test_verify_insufficient_balance(self):
        """Test verification fails when balance is insufficient."""
        signer = make_mock_signer(balance="500000")  # Less than required 1000000
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements(amount="1000000")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "insufficient_balance"
        assert result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_verify_exact_balance(self):
        """Test verification passes when balance exactly matches requirement."""
        signer = make_mock_signer(balance="1000000")
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload(amount="1000000")
        requirements = make_requirements(amount="1000000")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_insufficient_amount(self):
        """Test verification fails when payload amount < required."""
        signer = make_mock_signer(balance="10000000")
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload(amount="500000")  # Less than required
        requirements = make_requirements(amount="1000000")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "insufficient_amount"

    @pytest.mark.asyncio
    async def test_verify_amount_equal_to_required(self):
        """Test verification passes when amount equals requirement."""
        signer = make_mock_signer(balance="5000000")
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload(amount="1000000")
        requirements = make_requirements(amount="1000000")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_amount_greater_than_required(self):
        """Test verification passes when amount exceeds requirement."""
        signer = make_mock_signer(balance="10000000")
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload(amount="5000000")
        requirements = make_requirements(amount="1000000")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_recipient_mismatch(self):
        """Test verification fails when recipient doesn't match payTo."""
        signer = make_mock_signer(balance="10000000")
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        # Payload sends to a different address than requirements.payTo
        different_recipient = "TLSiYeFjQCfXosuuJgbnTPyaVz8P6taTzm"
        payload = make_valid_payload(to_addr=different_recipient)
        requirements = make_requirements(pay_to=TEST_RECIPIENT)

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "recipient_mismatch"

    @pytest.mark.asyncio
    async def test_verify_asset_mismatch(self):
        """Test verification fails when contract address doesn't match asset."""
        signer = make_mock_signer(balance="10000000")
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        # Payload uses a different contract than requirements.asset
        different_contract = "TLSiYeFjQCfXosuuJgbnTPyaVz8P6taTzm"
        payload = make_valid_payload(contract_address=different_contract)
        requirements = make_requirements(asset=TEST_ASSET)

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "asset_mismatch"

    @pytest.mark.asyncio
    async def test_verify_account_not_activated(self):
        """Test verification fails when sender account is not activated."""
        signer = make_mock_signer(is_active=False, balance="10000000")
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "account_not_activated"

    @pytest.mark.asyncio
    async def test_verify_invalid_required_amount_format(self):
        """Test verification fails when requirements amount is not parseable."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements(amount="not-a-number")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "invalid_required_amount"

    @pytest.mark.asyncio
    async def test_verify_invalid_balance_format(self):
        """Test verification fails when balance returned is not parseable."""
        signer = make_mock_signer(balance="invalid")
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "invalid_balance_format"

    @pytest.mark.asyncio
    async def test_verify_handles_exception_gracefully(self):
        """Test verification handles unexpected exceptions gracefully."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        with patch.object(
            facilitator,
            "_extract_payload",
            side_effect=RuntimeError("Unexpected error"),
        ):
            result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "verification_error" in result.invalid_reason
        assert "Unexpected error" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_handles_nested_payload(self):
        """Test verification handles PaymentPayloadV2-style nested payload."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        inner_payload = make_valid_payload()
        wrapped_payload = {
            "t402Version": 2,
            "payload": inner_payload,
        }
        requirements = make_requirements()

        result = await facilitator.verify(wrapped_payload, requirements)

        assert result.is_valid is True
        assert result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_verify_with_pydantic_requirements(self):
        """Test verification works with Pydantic model requirements."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = PaymentRequirementsV2(
            scheme="exact",
            network=TRON_MAINNET,
            asset=TEST_ASSET,
            amount=TEST_AMOUNT,
            pay_to=TEST_RECIPIENT,
            max_timeout_seconds=300,
            extra={},
        )

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_calls_signer_with_correct_params(self):
        """Test that verify passes correct parameters to signer."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        await facilitator.verify(payload, requirements)

        signer.verify_transaction.assert_called_once_with(
            signed_transaction=TEST_SIGNED_TX,
            expected_from=TEST_SENDER,
            expected_to=TEST_RECIPIENT,
            expected_contract=TEST_ASSET,
            expected_amount=TEST_AMOUNT,
            network=TRON_MAINNET,
        )

    @pytest.mark.asyncio
    async def test_verify_calls_get_balance_correctly(self):
        """Test that verify checks balance with correct params."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        await facilitator.verify(payload, requirements)

        signer.get_balance.assert_called_once_with(
            owner_address=TEST_SENDER,
            contract_address=TEST_ASSET,
            network=TRON_MAINNET,
        )

    @pytest.mark.asyncio
    async def test_verify_calls_is_activated_correctly(self):
        """Test that verify checks activation with correct params."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        await facilitator.verify(payload, requirements)

        signer.is_activated.assert_called_once_with(TEST_SENDER, TRON_MAINNET)

    @pytest.mark.asyncio
    async def test_verify_empty_scheme_passes(self):
        """Test verification proceeds when scheme field is empty."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements(scheme="")

        result = await facilitator.verify(payload, requirements)

        # Should not fail on scheme validation when empty
        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_with_nile_network(self):
        """Test verification works with nile testnet."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload(contract_address=USDT_NILE_ADDRESS)
        requirements = make_requirements(
            network=TRON_NILE,
            asset=USDT_NILE_ADDRESS,
        )

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True


class TestExactTronFacilitatorSettle:
    """Test settle method of ExactTronFacilitatorScheme."""

    @pytest.mark.asyncio
    async def test_settle_successful(self):
        """Test successful settlement."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is True
        assert result.transaction == TEST_TX_ID
        assert result.network == TRON_MAINNET
        assert result.payer == TEST_SENDER
        assert result.error_reason is None

    @pytest.mark.asyncio
    async def test_settle_fails_on_verification(self):
        """Test settlement fails when verification fails."""
        signer = make_mock_signer(verify_valid=False, verify_reason="invalid_sig")
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert "transaction_verification_failed" in result.error_reason
        assert result.network == TRON_MAINNET

    @pytest.mark.asyncio
    async def test_settle_calls_broadcast(self):
        """Test that settle broadcasts the signed transaction."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        await facilitator.settle(payload, requirements)

        signer.broadcast_transaction.assert_called_once_with(
            signed_transaction=TEST_SIGNED_TX,
            network=TRON_MAINNET,
        )

    @pytest.mark.asyncio
    async def test_settle_calls_wait_for_transaction(self):
        """Test that settle waits for transaction confirmation."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        await facilitator.settle(payload, requirements)

        signer.wait_for_transaction.assert_called_once_with(
            tx_id=TEST_TX_ID,
            network=TRON_MAINNET,
            timeout=DEFAULT_CONFIRMATION_TIMEOUT,
        )

    @pytest.mark.asyncio
    async def test_settle_broadcast_failure(self):
        """Test settlement handles broadcast failure."""
        signer = make_mock_signer()
        signer.broadcast_transaction = AsyncMock(
            side_effect=Exception("Network timeout")
        )
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert "settlement_error" in result.error_reason
        assert "Network timeout" in result.error_reason

    @pytest.mark.asyncio
    async def test_settle_confirmation_failure(self):
        """Test settlement handles confirmation failure."""
        signer = make_mock_signer(
            confirmation_success=False,
            confirmation_error="Transaction reverted",
        )
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert result.error_reason == "Transaction reverted"
        assert result.transaction == TEST_TX_ID  # TX was broadcast

    @pytest.mark.asyncio
    async def test_settle_confirmation_no_error_message(self):
        """Test settlement handles confirmation failure without error message."""
        signer = make_mock_signer(
            confirmation_success=False,
            confirmation_error=None,
        )
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert result.error_reason == "confirmation_failed"

    @pytest.mark.asyncio
    async def test_settle_uses_confirmed_tx_id(self):
        """Test settlement uses the tx_id from confirmation if available."""
        confirmed_tx_id = "confirmed_" + "a" * 60
        signer = make_mock_signer(confirmation_tx_id=confirmed_tx_id)
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is True
        assert result.transaction == confirmed_tx_id

    @pytest.mark.asyncio
    async def test_settle_uses_broadcast_tx_id_when_no_confirmed(self):
        """Test settlement uses broadcast tx_id when confirmation has no tx_id."""
        signer = make_mock_signer(confirmation_tx_id=None)
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is True
        assert result.transaction == TEST_TX_ID

    @pytest.mark.asyncio
    async def test_settle_with_nested_payload(self):
        """Test settlement handles PaymentPayloadV2-style nested payload."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        inner_payload = make_valid_payload()
        wrapped_payload = {
            "t402Version": 2,
            "payload": inner_payload,
        }
        requirements = make_requirements()

        result = await facilitator.settle(wrapped_payload, requirements)

        assert result.success is True
        assert result.transaction == TEST_TX_ID

    @pytest.mark.asyncio
    async def test_settle_with_pydantic_requirements(self):
        """Test settlement works with Pydantic model requirements."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = PaymentRequirementsV2(
            scheme="exact",
            network=TRON_MAINNET,
            asset=TEST_ASSET,
            amount=TEST_AMOUNT,
            pay_to=TEST_RECIPIENT,
            max_timeout_seconds=300,
            extra={},
        )

        result = await facilitator.settle(payload, requirements)

        assert result.success is True

    @pytest.mark.asyncio
    async def test_settle_preserves_payer_on_error(self):
        """Test settlement includes payer info even on broadcast error."""
        signer = make_mock_signer()
        signer.broadcast_transaction = AsyncMock(
            side_effect=Exception("Broadcast failed")
        )
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_settle_expired_authorization(self):
        """Test settlement fails for expired authorization."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        past_expiration = int(time.time() * 1000) - 60000
        payload = make_valid_payload(expiration=past_expiration)
        requirements = make_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert result.error_reason == "authorization_expired"


class TestExactTronFacilitatorExtractHelpers:
    """Test payload and requirements extraction helpers."""

    def test_extract_payload_from_dict(self):
        """Test extracting payload from plain dict."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload_data = make_valid_payload()
        result = facilitator._extract_payload(payload_data)

        assert result["signedTransaction"] == TEST_SIGNED_TX
        assert result["authorization"]["from"] == TEST_SENDER

    def test_extract_payload_from_wrapped_dict(self):
        """Test extracting payload from wrapped dict (V2 format)."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        inner = make_valid_payload()
        wrapped = {"t402Version": 2, "payload": inner}
        result = facilitator._extract_payload(wrapped)

        assert result["signedTransaction"] == TEST_SIGNED_TX

    def test_extract_requirements_from_dict(self):
        """Test extracting requirements from plain dict."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        requirements = make_requirements()
        result = facilitator._extract_requirements(requirements)

        assert result["scheme"] == "exact"
        assert result["network"] == TRON_MAINNET
        assert result["amount"] == TEST_AMOUNT

    def test_extract_requirements_from_model(self):
        """Test extracting requirements from Pydantic model."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        model = PaymentRequirementsV2(
            scheme="exact",
            network=TRON_MAINNET,
            asset=TEST_ASSET,
            amount=TEST_AMOUNT,
            pay_to=TEST_RECIPIENT,
            max_timeout_seconds=300,
            extra={},
        )
        result = facilitator._extract_requirements(model)

        assert result["scheme"] == "exact"
        assert result["payTo"] == TEST_RECIPIENT

    def test_parse_tron_payload_valid(self):
        """Test parsing a valid TRON payload."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload_data = make_valid_payload()
        result = facilitator._parse_tron_payload(payload_data)

        assert result is not None
        assert result.signed_transaction == TEST_SIGNED_TX
        assert result.authorization.from_ == TEST_SENDER
        assert result.authorization.to == TEST_RECIPIENT
        assert result.authorization.contract_address == TEST_ASSET
        assert result.authorization.amount == TEST_AMOUNT

    def test_parse_tron_payload_missing_signed_transaction(self):
        """Test parsing fails without signedTransaction."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload_data = {
            "authorization": {
                "from": TEST_SENDER,
                "to": TEST_RECIPIENT,
                "contractAddress": TEST_ASSET,
                "amount": TEST_AMOUNT,
                "expiration": 1704067200000,
                "refBlockBytes": "abcd",
                "refBlockHash": "deadbeef12345678",
                "timestamp": 1704063600000,
            }
        }
        result = facilitator._parse_tron_payload(payload_data)

        assert result is None

    def test_parse_tron_payload_missing_authorization(self):
        """Test parsing fails without authorization."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload_data = {"signedTransaction": TEST_SIGNED_TX}
        result = facilitator._parse_tron_payload(payload_data)

        assert result is None

    def test_parse_tron_payload_missing_from(self):
        """Test parsing fails when authorization.from is missing."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload_data = {
            "signedTransaction": TEST_SIGNED_TX,
            "authorization": {
                "to": TEST_RECIPIENT,
                "contractAddress": TEST_ASSET,
                "amount": TEST_AMOUNT,
                "expiration": 1704067200000,
                "refBlockBytes": "abcd",
                "refBlockHash": "deadbeef12345678",
                "timestamp": 1704063600000,
            },
        }
        result = facilitator._parse_tron_payload(payload_data)

        assert result is None

    def test_parse_tron_payload_invalid_data(self):
        """Test parsing handles completely invalid data."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload_data = {"garbage": "data"}
        result = facilitator._parse_tron_payload(payload_data)

        assert result is None


class TestExactTronFacilitatorIntegration:
    """Integration-style tests for verify + settle flow."""

    @pytest.mark.asyncio
    async def test_verify_then_settle_flow(self):
        """Test the full verify -> settle flow."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        # Step 1: Verify
        verify_result = await facilitator.verify(payload, requirements)
        assert verify_result.is_valid is True
        assert verify_result.payer == TEST_SENDER

        # Step 2: Settle
        settle_result = await facilitator.settle(payload, requirements)
        assert settle_result.success is True
        assert settle_result.payer == TEST_SENDER
        assert settle_result.network == TRON_MAINNET
        assert settle_result.transaction == TEST_TX_ID

    @pytest.mark.asyncio
    async def test_full_flow_with_config(self):
        """Test the full flow with facilitator config."""
        signer = make_mock_signer()
        config = ExactTronFacilitatorConfig(can_sponsor_gas=True)
        facilitator = ExactTronFacilitatorScheme(signer=signer, config=config)

        # Check supported info
        extra = facilitator.get_extra(TRON_MAINNET)
        assert extra["gasSponsor"] == TEST_FACILITATOR_ADDR

        signers = facilitator.get_signers(TRON_MAINNET)
        assert TEST_FACILITATOR_ADDR in signers

        # Verify and settle
        payload = make_valid_payload()
        requirements = make_requirements()

        verify_result = await facilitator.verify(payload, requirements)
        assert verify_result.is_valid is True

        settle_result = await facilitator.settle(payload, requirements)
        assert settle_result.success is True

    @pytest.mark.asyncio
    async def test_settle_skips_broadcast_on_verify_failure(self):
        """Test that settle does not broadcast when verification fails."""
        signer = make_mock_signer(is_active=False)
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert result.error_reason == "account_not_activated"
        signer.broadcast_transaction.assert_not_called()

    @pytest.mark.asyncio
    async def test_multiple_sequential_settlements(self):
        """Test multiple sequential settlement calls."""
        signer = make_mock_signer()
        facilitator = ExactTronFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        result1 = await facilitator.settle(payload, requirements)
        assert result1.success is True

        result2 = await facilitator.settle(payload, requirements)
        assert result2.success is True

        # Both should have completed broadcast
        assert signer.broadcast_transaction.call_count == 2
