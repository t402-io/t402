"""Tests for EVM Exact Scheme - Facilitator Implementation."""

import time

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from t402.schemes.evm.exact.facilitator import (
    ExactEvmFacilitatorScheme,
    FacilitatorEvmSigner,
    EvmVerifyResult,
    EvmTransactionConfirmation,
    SCHEME_EXACT,
    MIN_VALIDITY_BUFFER,
)
from t402.schemes.interfaces import SchemeNetworkFacilitator
from t402.types import VerifyResponse, SettleResponse


# Test constants
TEST_SENDER = "0x1234567890abcdef1234567890abcdef12345678"
TEST_RECIPIENT = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"
TEST_FACILITATOR_ADDRESS = "0xC88f67e776f16DcFBf42e6bDda1B82604448899B"
TEST_NETWORK = "eip155:8453"  # Base
TEST_ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"  # USDC on Base
TEST_NONCE = "0x" + "ab" * 32  # Random 32-byte nonce
TEST_SIGNATURE = "0x" + "cd" * 65  # 65-byte ECDSA signature
TEST_TX_HASH = "0x" + "ef" * 32  # Transaction hash


def make_mock_signer(
    addresses: list = None,
    balance: str = "10000000",
    verify_valid: bool = True,
    verify_reason: str = None,
    recovered_address: str = None,
    tx_hash: str = TEST_TX_HASH,
    confirmation_success: bool = True,
    confirmation_tx_hash: str = None,
    confirmation_block: int = 12345,
    confirmation_error: str = None,
) -> MagicMock:
    """Create a mock FacilitatorEvmSigner with configurable behavior.

    Args:
        addresses: List of facilitator addresses
        balance: Token balance to return
        verify_valid: Whether signature verification succeeds
        verify_reason: Reason for verification failure
        recovered_address: Address recovered from signature
        tx_hash: Hash returned from execute_transfer
        confirmation_success: Whether transaction confirmation succeeds
        confirmation_tx_hash: Confirmed transaction hash
        confirmation_block: Block number of confirmation
        confirmation_error: Confirmation error message

    Returns:
        Mock signer object
    """
    if addresses is None:
        addresses = [TEST_FACILITATOR_ADDRESS]
    if recovered_address is None:
        recovered_address = TEST_SENDER

    signer = MagicMock()
    signer.get_addresses = MagicMock(return_value=addresses)

    verify_result = EvmVerifyResult(
        valid=verify_valid,
        recovered_address=recovered_address if verify_valid else None,
        reason=verify_reason,
    )
    signer.verify_eip3009_signature = AsyncMock(return_value=verify_result)

    signer.get_balance = AsyncMock(return_value=balance)

    signer.execute_transfer = AsyncMock(return_value=tx_hash)

    confirmation = EvmTransactionConfirmation(
        success=confirmation_success,
        tx_hash=confirmation_tx_hash or tx_hash,
        block_number=confirmation_block,
        error=confirmation_error,
    )
    signer.wait_for_confirmation = AsyncMock(return_value=confirmation)

    return signer


def make_valid_payload(
    from_addr: str = TEST_SENDER,
    to_addr: str = TEST_RECIPIENT,
    value: str = "1000000",
    valid_after: str = None,
    valid_before: str = None,
    nonce: str = TEST_NONCE,
    signature: str = TEST_SIGNATURE,
) -> dict:
    """Create a valid EIP-3009 payment payload for testing.

    Args:
        from_addr: Payer address
        to_addr: Recipient address
        value: Amount in token's smallest unit
        valid_after: Unix timestamp (defaults to 1 hour ago)
        valid_before: Unix timestamp (defaults to 1 hour from now)
        nonce: 32-byte nonce as hex string
        signature: ECDSA signature as hex string

    Returns:
        Dict representing an EIP-3009 payment payload
    """
    now = int(time.time())
    if valid_after is None:
        valid_after = str(now - 3600)  # 1 hour ago
    if valid_before is None:
        valid_before = str(now + 3600)  # 1 hour from now

    return {
        "signature": signature,
        "authorization": {
            "from": from_addr,
            "to": to_addr,
            "value": value,
            "validAfter": valid_after,
            "validBefore": valid_before,
            "nonce": nonce,
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
        network: Network identifier (CAIP-2 format)
        asset: Token contract address
        amount: Required amount in token's smallest unit
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
        "extra": {
            "name": "USD Coin",
            "version": "2",
        },
    }


class TestExactEvmFacilitatorBasic:
    """Test basic properties of ExactEvmFacilitatorScheme."""

    def test_scheme_name(self):
        """Test scheme is 'exact'."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)
        assert facilitator.scheme == "exact"

    def test_caip_family(self):
        """Test CAIP family is eip155:*."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)
        assert facilitator.caip_family == "eip155:*"

    def test_protocol_compliance(self):
        """Test that ExactEvmFacilitatorScheme implements SchemeNetworkFacilitator."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)
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
        facilitator = ExactEvmFacilitatorScheme(signer=signer)
        assert facilitator._signer is signer


class TestExactEvmFacilitatorGetExtra:
    """Test get_extra method."""

    def test_get_extra_base_mainnet(self):
        """Test get_extra returns asset metadata for Base mainnet."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)
        extra = facilitator.get_extra("eip155:8453")

        assert extra is not None
        assert extra["defaultAsset"] == "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
        assert extra["name"] == "USD Coin"
        assert extra["version"] == "2"
        assert extra["decimals"] == 6

    def test_get_extra_ethereum_mainnet(self):
        """Test get_extra returns asset metadata for Ethereum mainnet."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)
        extra = facilitator.get_extra("eip155:1")

        assert extra is not None
        assert extra["defaultAsset"] == "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee"
        assert extra["name"] == "TetherToken"
        assert extra["version"] == "1"
        assert extra["decimals"] == 6

    def test_get_extra_arbitrum(self):
        """Test get_extra returns asset metadata for Arbitrum."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)
        extra = facilitator.get_extra("eip155:42161")

        assert extra is not None
        assert extra["defaultAsset"] == "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"
        assert extra["name"] == "TetherToken"

    def test_get_extra_base_sepolia(self):
        """Test get_extra returns asset metadata for Base Sepolia testnet."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)
        extra = facilitator.get_extra("eip155:84532")

        assert extra is not None
        assert extra["defaultAsset"] == "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
        assert extra["name"] == "USDC"
        assert extra["version"] == "2"

    def test_get_extra_unsupported_chain_id(self):
        """Test get_extra returns None for unknown chain ID."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)
        extra = facilitator.get_extra("eip155:999999")

        assert extra is None

    def test_get_extra_invalid_network_format(self):
        """Test get_extra returns None for non-EVM network."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)
        extra = facilitator.get_extra("solana:mainnet")

        assert extra is None

    def test_get_extra_invalid_network_string(self):
        """Test get_extra returns None for invalid network string."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)
        extra = facilitator.get_extra("invalid")

        assert extra is None


class TestExactEvmFacilitatorGetSigners:
    """Test get_signers method."""

    def test_get_signers_returns_addresses(self):
        """Test get_signers returns addresses from the signer."""
        addresses = [TEST_FACILITATOR_ADDRESS, "0xSecondAddress"]
        signer = make_mock_signer(addresses=addresses)
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        result = facilitator.get_signers(TEST_NETWORK)

        assert result == addresses
        signer.get_addresses.assert_called_once_with(TEST_NETWORK)

    def test_get_signers_empty(self):
        """Test get_signers returns empty list when no addresses."""
        signer = make_mock_signer(addresses=[])
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        result = facilitator.get_signers(TEST_NETWORK)

        assert result == []


class TestExactEvmFacilitatorVerify:
    """Test verify method of ExactEvmFacilitatorScheme."""

    @pytest.mark.asyncio
    async def test_verify_valid_payload(self):
        """Test verification succeeds with valid payload."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True
        assert result.payer == TEST_SENDER
        assert result.invalid_reason is None

    @pytest.mark.asyncio
    async def test_verify_unsupported_scheme(self):
        """Test verification fails with unsupported scheme."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements(scheme="streaming")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "unsupported_scheme"

    @pytest.mark.asyncio
    async def test_verify_unsupported_network_non_evm(self):
        """Test verification fails with non-EVM network."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements(network="solana:mainnet")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "unsupported_network"

    @pytest.mark.asyncio
    async def test_verify_unsupported_network_invalid(self):
        """Test verification fails with malformed network."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements(network="eip155:abc")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "unsupported_network"

    @pytest.mark.asyncio
    async def test_verify_unsupported_network_zero_chain_id(self):
        """Test verification fails with zero chain ID."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements(network="eip155:0")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "unsupported_network"

    @pytest.mark.asyncio
    async def test_verify_missing_signature(self):
        """Test verification fails when signature is missing."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = {
            "authorization": {
                "from": TEST_SENDER,
                "to": TEST_RECIPIENT,
                "value": "1000000",
                "validAfter": str(int(time.time()) - 3600),
                "validBefore": str(int(time.time()) + 3600),
                "nonce": TEST_NONCE,
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
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = {"signature": TEST_SIGNATURE}
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "invalid_payload"

    @pytest.mark.asyncio
    async def test_verify_missing_from_address(self):
        """Test verification fails when from address is missing."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = {
            "signature": TEST_SIGNATURE,
            "authorization": {
                "to": TEST_RECIPIENT,
                "value": "1000000",
                "validAfter": str(int(time.time()) - 3600),
                "validBefore": str(int(time.time()) + 3600),
                "nonce": TEST_NONCE,
            },
        }
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "invalid_payload"

    @pytest.mark.asyncio
    async def test_verify_signature_verification_fails(self):
        """Test verification fails when EIP-3009 signature is invalid."""
        signer = make_mock_signer(
            verify_valid=False,
            verify_reason="ecrecover_mismatch",
        )
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "invalid_signature" in result.invalid_reason
        assert "ecrecover_mismatch" in result.invalid_reason
        assert result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_verify_signature_verification_exception(self):
        """Test verification handles signature verification exception."""
        signer = make_mock_signer()
        signer.verify_eip3009_signature = AsyncMock(
            side_effect=RuntimeError("RPC connection failed")
        )
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "signature_verification_error" in result.invalid_reason
        assert "RPC connection failed" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_authorization_expired(self):
        """Test verification fails when validBefore has passed."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        expired_time = str(int(time.time()) - 100)
        payload = make_valid_payload(valid_before=expired_time)
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "authorization_expired"
        assert result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_verify_authorization_within_buffer(self):
        """Test verification fails when validBefore is within the buffer window."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        near_expiry = str(int(time.time()) + MIN_VALIDITY_BUFFER - 1)
        payload = make_valid_payload(valid_before=near_expiry)
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "authorization_expired"

    @pytest.mark.asyncio
    async def test_verify_authorization_not_yet_valid(self):
        """Test verification fails when validAfter is in the future."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        future_time = str(int(time.time()) + 3600)
        payload = make_valid_payload(
            valid_after=future_time,
            valid_before=str(int(time.time()) + 7200),
        )
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "authorization_not_yet_valid"

    @pytest.mark.asyncio
    async def test_verify_invalid_valid_before(self):
        """Test verification fails with non-numeric validBefore."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload(valid_before="not_a_number")
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "invalid_valid_before"

    @pytest.mark.asyncio
    async def test_verify_invalid_valid_after(self):
        """Test verification fails with non-numeric validAfter."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload(valid_after="not_a_number")
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "invalid_valid_after"

    @pytest.mark.asyncio
    async def test_verify_insufficient_balance(self):
        """Test verification fails when token balance is insufficient."""
        signer = make_mock_signer(balance="500000")  # Less than required
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements(amount="1000000")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "insufficient_balance"
        assert result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_verify_balance_check_failure(self):
        """Test verification fails gracefully when balance check errors."""
        signer = make_mock_signer()
        signer.get_balance = AsyncMock(return_value="not_a_number")
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "balance_check_failed"

    @pytest.mark.asyncio
    async def test_verify_invalid_required_amount(self):
        """Test verification fails with non-numeric required amount."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements(amount="not_a_number")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "invalid_required_amount"

    @pytest.mark.asyncio
    async def test_verify_insufficient_payload_amount(self):
        """Test verification fails when payload value < required."""
        signer = make_mock_signer(balance="5000000")
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload(value="500000")
        requirements = make_requirements(amount="1000000")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "insufficient_amount"
        assert result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_verify_payload_amount_equals_required(self):
        """Test verification passes when payload value equals required."""
        signer = make_mock_signer(balance="1000000")
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload(value="1000000")
        requirements = make_requirements(amount="1000000")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_payload_amount_exceeds_required(self):
        """Test verification passes when payload value exceeds required."""
        signer = make_mock_signer(balance="5000000")
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload(value="2000000")
        requirements = make_requirements(amount="1000000")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_invalid_payload_value(self):
        """Test verification fails with non-numeric payload value."""
        signer = make_mock_signer(balance="5000000")
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload(value="not_a_number")
        requirements = make_requirements(amount="1000000")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "invalid_payload_amount"

    @pytest.mark.asyncio
    async def test_verify_recipient_mismatch(self):
        """Test verification fails when recipient doesn't match payTo."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        wrong_recipient = "0x0000000000000000000000000000000000000000"
        payload = make_valid_payload(to_addr=wrong_recipient)
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "recipient_mismatch"

    @pytest.mark.asyncio
    async def test_verify_recipient_case_insensitive(self):
        """Test recipient comparison is case-insensitive."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload(to_addr=TEST_RECIPIENT.lower())
        requirements = make_requirements(pay_to=TEST_RECIPIENT.upper())

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_handles_nested_payload(self):
        """Test verification handles PaymentPayloadV2-style nested payload."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

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
    async def test_verify_handles_exception_gracefully(self):
        """Test verification handles unexpected exceptions gracefully."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

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

        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = PaymentRequirementsV2(
            scheme="exact",
            network=TEST_NETWORK,
            asset=TEST_ASSET,
            amount="1000000",
            pay_to=TEST_RECIPIENT,
            max_timeout_seconds=300,
            extra={"name": "USD Coin", "version": "2"},
        )

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True
        assert result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_verify_calls_signer_methods_correctly(self):
        """Test that verify calls signer methods with correct parameters."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        now = int(time.time())
        payload = make_valid_payload(
            value="2000000",
            valid_after=str(now - 60),
            valid_before=str(now + 300),
        )
        requirements = make_requirements(amount="1000000")

        await facilitator.verify(payload, requirements)

        # Verify signature verification was called with correct params
        signer.verify_eip3009_signature.assert_called_once()
        call_kwargs = signer.verify_eip3009_signature.call_args[1]
        assert call_kwargs["from_address"] == TEST_SENDER
        assert call_kwargs["to_address"] == TEST_RECIPIENT
        assert call_kwargs["value"] == "2000000"
        assert call_kwargs["nonce"] == TEST_NONCE
        assert call_kwargs["signature"] == TEST_SIGNATURE
        assert call_kwargs["token_address"] == TEST_ASSET
        assert call_kwargs["chain_id"] == 8453

        # Balance check with correct params
        signer.get_balance.assert_called_once_with(
            owner_address=TEST_SENDER,
            token_address=TEST_ASSET,
            network=TEST_NETWORK,
        )

    @pytest.mark.asyncio
    async def test_verify_multiple_evm_networks(self):
        """Test verification works on different EVM networks."""
        networks = [
            ("eip155:1", 1),
            ("eip155:8453", 8453),
            ("eip155:42161", 42161),
            ("eip155:10", 10),
            ("eip155:137", 137),
        ]

        for network, expected_chain_id in networks:
            signer = make_mock_signer()
            facilitator = ExactEvmFacilitatorScheme(signer=signer)

            payload = make_valid_payload()
            requirements = make_requirements(network=network)

            result = await facilitator.verify(payload, requirements)

            assert result.is_valid is True, f"Failed for network {network}"

            # Verify chain_id was passed correctly
            call_kwargs = signer.verify_eip3009_signature.call_args[1]
            assert call_kwargs["chain_id"] == expected_chain_id

    @pytest.mark.asyncio
    async def test_verify_valid_after_exactly_now(self):
        """Test verification passes when validAfter equals current time."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        now = str(int(time.time()))
        payload = make_valid_payload(valid_after=now)
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_valid_after_in_past(self):
        """Test verification passes when validAfter is in the past."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        past = str(int(time.time()) - 86400)  # 1 day ago
        payload = make_valid_payload(valid_after=past)
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_token_info_lookup(self):
        """Test that token name/version are looked up from KNOWN_TOKENS."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        # Use USDT0 on Ethereum mainnet
        eth_usdt0 = "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee"
        payload = make_valid_payload()
        requirements = make_requirements(
            network="eip155:1",
            asset=eth_usdt0,
        )

        await facilitator.verify(payload, requirements)

        call_kwargs = signer.verify_eip3009_signature.call_args[1]
        assert call_kwargs["token_name"] == "TetherToken"
        assert call_kwargs["token_version"] == "1"

    @pytest.mark.asyncio
    async def test_verify_unknown_token_uses_defaults(self):
        """Test that unknown tokens use default name/version."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        unknown_token = "0x0000000000000000000000000000000000000001"
        payload = make_valid_payload()
        requirements = make_requirements(
            network="eip155:8453",
            asset=unknown_token,
        )

        await facilitator.verify(payload, requirements)

        call_kwargs = signer.verify_eip3009_signature.call_args[1]
        assert call_kwargs["token_name"] == "TetherToken"
        assert call_kwargs["token_version"] == "1"


class TestExactEvmFacilitatorSettle:
    """Test settle method of ExactEvmFacilitatorScheme."""

    @pytest.mark.asyncio
    async def test_settle_success(self):
        """Test successful settlement."""
        signer = make_mock_signer(
            tx_hash=TEST_TX_HASH,
            confirmation_success=True,
            confirmation_tx_hash=TEST_TX_HASH,
            confirmation_block=12345,
        )
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is True
        assert result.transaction == TEST_TX_HASH
        assert result.network == TEST_NETWORK
        assert result.payer == TEST_SENDER
        assert result.error_reason is None

    @pytest.mark.asyncio
    async def test_settle_fails_on_verification_failure(self):
        """Test settlement fails when verification fails."""
        signer = make_mock_signer(verify_valid=False, verify_reason="bad_signature")
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert "invalid_signature" in result.error_reason
        assert result.network == TEST_NETWORK

        # execute_transfer should not have been called
        signer.execute_transfer.assert_not_called()

    @pytest.mark.asyncio
    async def test_settle_fails_on_insufficient_amount(self):
        """Test settlement fails when amount is insufficient."""
        signer = make_mock_signer(balance="5000000")
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload(value="500000")
        requirements = make_requirements(amount="1000000")

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert result.error_reason == "insufficient_amount"

        # execute_transfer should not have been called
        signer.execute_transfer.assert_not_called()

    @pytest.mark.asyncio
    async def test_settle_transaction_execution_failure(self):
        """Test settlement handles transaction execution failure."""
        signer = make_mock_signer()
        signer.execute_transfer = AsyncMock(
            side_effect=RuntimeError("Gas estimation failed")
        )
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert "transaction_failed" in result.error_reason
        assert "Gas estimation failed" in result.error_reason
        assert result.payer == TEST_SENDER
        assert result.transaction is None

    @pytest.mark.asyncio
    async def test_settle_confirmation_failure(self):
        """Test settlement handles confirmation failure (reverted tx)."""
        signer = make_mock_signer(
            tx_hash=TEST_TX_HASH,
            confirmation_success=False,
            confirmation_error="execution reverted: authorization already used",
        )
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert "authorization already used" in result.error_reason
        assert result.transaction == TEST_TX_HASH
        assert result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_settle_confirmation_exception(self):
        """Test settlement handles confirmation exception (timeout)."""
        signer = make_mock_signer(tx_hash=TEST_TX_HASH)
        signer.wait_for_confirmation = AsyncMock(
            side_effect=RuntimeError("Connection timeout")
        )
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert "confirmation_failed" in result.error_reason
        assert result.transaction == TEST_TX_HASH

    @pytest.mark.asyncio
    async def test_settle_confirmation_no_error_message(self):
        """Test settlement with failed confirmation but no error message."""
        signer = make_mock_signer(
            tx_hash=TEST_TX_HASH,
            confirmation_success=False,
            confirmation_error=None,
        )
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert result.error_reason == "transaction_reverted"

    @pytest.mark.asyncio
    async def test_settle_calls_execute_transfer_correctly(self):
        """Test settle calls execute_transfer with correct parameters."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        now = int(time.time())
        payload = make_valid_payload(
            value="2000000",
            valid_after=str(now - 60),
            valid_before=str(now + 300),
        )
        requirements = make_requirements(amount="1000000")

        await facilitator.settle(payload, requirements)

        # Verify execute_transfer was called with correct params
        signer.execute_transfer.assert_called_once()
        call_kwargs = signer.execute_transfer.call_args[1]
        assert call_kwargs["from_address"] == TEST_SENDER
        assert call_kwargs["to_address"] == TEST_RECIPIENT
        assert call_kwargs["value"] == "2000000"
        assert call_kwargs["valid_after"] == str(now - 60)
        assert call_kwargs["valid_before"] == str(now + 300)
        assert call_kwargs["nonce"] == TEST_NONCE
        assert call_kwargs["signature"] == TEST_SIGNATURE
        assert call_kwargs["token_address"] == TEST_ASSET
        assert call_kwargs["network"] == TEST_NETWORK

    @pytest.mark.asyncio
    async def test_settle_calls_wait_for_confirmation_correctly(self):
        """Test settle calls wait_for_confirmation with correct parameters."""
        signer = make_mock_signer(tx_hash="0xmyhash")
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        await facilitator.settle(payload, requirements)

        signer.wait_for_confirmation.assert_called_once_with(
            tx_hash="0xmyhash",
            network=TEST_NETWORK,
            timeout_ms=60000,
        )

    @pytest.mark.asyncio
    async def test_settle_with_nested_payload(self):
        """Test settle handles PaymentPayloadV2-style nested payload."""
        signer = make_mock_signer(
            confirmation_success=True,
            confirmation_tx_hash="0xnested_tx",
        )
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        inner_payload = make_valid_payload()
        wrapped_payload = {
            "t402Version": 2,
            "payload": inner_payload,
        }
        requirements = make_requirements()

        result = await facilitator.settle(wrapped_payload, requirements)

        assert result.success is True
        assert result.transaction == "0xnested_tx"

    @pytest.mark.asyncio
    async def test_settle_with_pydantic_model_requirements(self):
        """Test settle with Pydantic model requirements."""
        from t402.types import PaymentRequirementsV2

        signer = make_mock_signer(
            confirmation_success=True,
            confirmation_tx_hash="0xmodel_tx",
        )
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = PaymentRequirementsV2(
            scheme="exact",
            network=TEST_NETWORK,
            asset=TEST_ASSET,
            amount="1000000",
            pay_to=TEST_RECIPIENT,
            max_timeout_seconds=300,
            extra={"name": "USD Coin", "version": "2"},
        )

        result = await facilitator.settle(payload, requirements)

        assert result.success is True
        assert result.transaction == "0xmodel_tx"

    @pytest.mark.asyncio
    async def test_settle_uses_confirmed_hash(self):
        """Test settlement uses confirmed tx hash when different from submitted."""
        signer = make_mock_signer(
            tx_hash="0xsubmitted",
            confirmation_success=True,
            confirmation_tx_hash="0xconfirmed",
        )
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is True
        assert result.transaction == "0xconfirmed"

    @pytest.mark.asyncio
    async def test_settle_uses_submitted_hash_when_no_confirmation_hash(self):
        """Test settlement uses submitted hash when confirmation has no hash."""
        signer = make_mock_signer(
            tx_hash="0xsubmitted",
            confirmation_success=True,
        )
        # Override to have no tx_hash in confirmation
        confirmation = EvmTransactionConfirmation(
            success=True,
            tx_hash=None,
            block_number=12345,
            error=None,
        )
        signer.wait_for_confirmation = AsyncMock(return_value=confirmation)
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is True
        assert result.transaction == "0xsubmitted"


class TestExactEvmFacilitatorExtractHelpers:
    """Test payload and requirements extraction helpers."""

    def test_extract_payload_from_dict(self):
        """Test extracting payload from plain dict."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload_data = make_valid_payload()
        result = facilitator._extract_payload(payload_data)

        assert result["signature"] == TEST_SIGNATURE
        assert result["authorization"]["from"] == TEST_SENDER

    def test_extract_payload_from_wrapped_dict(self):
        """Test extracting payload from wrapped dict (V2 format)."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        inner = make_valid_payload()
        wrapped = {"t402Version": 2, "payload": inner}
        result = facilitator._extract_payload(wrapped)

        assert result["signature"] == TEST_SIGNATURE
        assert result["authorization"]["from"] == TEST_SENDER

    def test_extract_requirements_from_dict(self):
        """Test extracting requirements from plain dict."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        requirements = make_requirements()
        result = facilitator._extract_requirements(requirements)

        assert result["scheme"] == "exact"
        assert result["network"] == TEST_NETWORK
        assert result["amount"] == "1000000"

    def test_extract_requirements_from_model(self):
        """Test extracting requirements from Pydantic model."""
        from t402.types import PaymentRequirementsV2

        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

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


class TestExactEvmFacilitatorParsePayload:
    """Test _parse_eip3009_payload helper."""

    def test_parse_valid_payload(self):
        """Test parsing a valid EIP-3009 payload."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload_data = {
            "signature": TEST_SIGNATURE,
            "authorization": {
                "from": TEST_SENDER,
                "to": TEST_RECIPIENT,
                "value": "1000000",
                "validAfter": "1000000",
                "validBefore": "2000000",
                "nonce": TEST_NONCE,
            },
        }

        result = facilitator._parse_eip3009_payload(payload_data)

        assert result is not None
        assert result["signature"] == TEST_SIGNATURE
        assert result["authorization"]["from"] == TEST_SENDER
        assert result["authorization"]["to"] == TEST_RECIPIENT
        assert result["authorization"]["value"] == "1000000"
        assert result["authorization"]["validAfter"] == "1000000"
        assert result["authorization"]["validBefore"] == "2000000"
        assert result["authorization"]["nonce"] == TEST_NONCE

    def test_parse_snake_case_authorization(self):
        """Test parsing authorization with snake_case fields."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload_data = {
            "signature": TEST_SIGNATURE,
            "authorization": {
                "from": TEST_SENDER,
                "to": TEST_RECIPIENT,
                "value": "2000000",
                "valid_after": "500",
                "valid_before": "9999999",
                "nonce": TEST_NONCE,
            },
        }

        result = facilitator._parse_eip3009_payload(payload_data)

        assert result is not None
        assert result["authorization"]["validAfter"] == "500"
        assert result["authorization"]["validBefore"] == "9999999"

    def test_parse_missing_signature_returns_none(self):
        """Test that missing signature returns None."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        result = facilitator._parse_eip3009_payload({
            "authorization": {"from": TEST_SENDER}
        })
        assert result is None

    def test_parse_empty_signature_returns_none(self):
        """Test that empty signature returns None."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        result = facilitator._parse_eip3009_payload({
            "signature": "",
            "authorization": {"from": TEST_SENDER},
        })
        assert result is None

    def test_parse_missing_authorization_returns_none(self):
        """Test that missing authorization returns None."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        result = facilitator._parse_eip3009_payload({"signature": TEST_SIGNATURE})
        assert result is None

    def test_parse_missing_from_returns_none(self):
        """Test that missing from address returns None."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        result = facilitator._parse_eip3009_payload({
            "signature": TEST_SIGNATURE,
            "authorization": {"to": TEST_RECIPIENT},
        })
        assert result is None

    def test_parse_defaults_for_missing_optional_fields(self):
        """Test that optional fields get defaults when missing."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        result = facilitator._parse_eip3009_payload({
            "signature": TEST_SIGNATURE,
            "authorization": {
                "from": TEST_SENDER,
            },
        })

        assert result is not None
        assert result["authorization"]["to"] == ""
        assert result["authorization"]["value"] == "0"
        assert result["authorization"]["validAfter"] == "0"
        assert result["authorization"]["validBefore"] == "0"
        assert result["authorization"]["nonce"] == ""

    def test_parse_integer_value_converts_to_string(self):
        """Test that integer value is converted to string."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        result = facilitator._parse_eip3009_payload({
            "signature": TEST_SIGNATURE,
            "authorization": {
                "from": TEST_SENDER,
                "to": TEST_RECIPIENT,
                "value": 1000000,
                "validAfter": 0,
                "validBefore": 9999999,
                "nonce": TEST_NONCE,
            },
        })

        assert result is not None
        assert result["authorization"]["value"] == "1000000"
        assert result["authorization"]["validAfter"] == "0"
        assert result["authorization"]["validBefore"] == "9999999"


class TestExactEvmFacilitatorNetworkValidation:
    """Test network validation helper."""

    def test_valid_evm_networks(self):
        """Test valid EVM networks pass validation."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        valid_networks = [
            "eip155:1",
            "eip155:8453",
            "eip155:42161",
            "eip155:10",
            "eip155:137",
            "eip155:84532",
            "eip155:57073",
            "eip155:999999",
        ]

        for network in valid_networks:
            assert facilitator._is_valid_network(network) is True, (
                f"Expected {network} to be valid"
            )

    def test_invalid_networks(self):
        """Test invalid networks fail validation."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        invalid_networks = [
            "solana:mainnet",
            "ton:mainnet",
            "tron:mainnet",
            "eip155:",
            "eip155:abc",
            "eip155:0",
            "eip155:-1",
            "invalid",
            "",
            "eip155",
        ]

        for network in invalid_networks:
            assert facilitator._is_valid_network(network) is False, (
                f"Expected {network} to be invalid"
            )


class TestExactEvmFacilitatorAddressComparison:
    """Test address comparison helper."""

    def test_equal_addresses(self):
        """Test equal addresses return True."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        assert facilitator._addresses_equal(
            "0xabcdef", "0xabcdef"
        ) is True

    def test_case_insensitive_comparison(self):
        """Test case-insensitive address comparison."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        assert facilitator._addresses_equal(
            "0xAbCdEf", "0xabcdef"
        ) is True

    def test_checksummed_vs_lowercase(self):
        """Test checksummed vs lowercase addresses."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        assert facilitator._addresses_equal(
            "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
        ) is True

    def test_different_addresses(self):
        """Test different addresses return False."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        assert facilitator._addresses_equal(
            "0xaaa", "0xbbb"
        ) is False

    def test_empty_address_returns_false(self):
        """Test empty address comparison returns False."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        assert facilitator._addresses_equal("", "0xabc") is False
        assert facilitator._addresses_equal("0xabc", "") is False
        assert facilitator._addresses_equal("", "") is False


class TestExactEvmFacilitatorIntegration:
    """Integration-style tests for verify + settle flow."""

    @pytest.mark.asyncio
    async def test_full_verify_then_settle_flow(self):
        """Test the full verify -> settle flow."""
        signer = make_mock_signer(
            balance="5000000",
            tx_hash="0xbroadcast_hash",
            confirmation_success=True,
            confirmation_tx_hash="0xfinal_hash",
            confirmation_block=54321,
        )
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload(value="2000000")
        requirements = make_requirements(amount="1000000")

        # Step 1: Verify
        verify_result = await facilitator.verify(payload, requirements)
        assert verify_result.is_valid is True
        assert verify_result.payer == TEST_SENDER

        # Step 2: Settle
        settle_result = await facilitator.settle(payload, requirements)
        assert settle_result.success is True
        assert settle_result.transaction == "0xfinal_hash"
        assert settle_result.network == TEST_NETWORK
        assert settle_result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_verify_failure_prevents_settle(self):
        """Test that verification failure prevents settlement."""
        signer = make_mock_signer(
            balance="100",  # Insufficient balance
        )
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements(amount="1000000")

        # Verify fails
        verify_result = await facilitator.verify(payload, requirements)
        assert verify_result.is_valid is False
        assert verify_result.invalid_reason == "insufficient_balance"

        # Settle also fails (calls verify internally)
        settle_result = await facilitator.settle(payload, requirements)
        assert settle_result.success is False
        assert settle_result.error_reason == "insufficient_balance"

        # execute_transfer should not have been called
        signer.execute_transfer.assert_not_called()

    @pytest.mark.asyncio
    async def test_settle_verify_is_called_internally(self):
        """Test that settle calls verify internally before executing transfer."""
        signer = make_mock_signer(
            confirmation_success=True,
            confirmation_tx_hash="0xsettled_hash",
        )
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is True

        # verify_eip3009_signature should have been called (from verify())
        signer.verify_eip3009_signature.assert_called()
        # Balance should have been checked
        signer.get_balance.assert_called()

    @pytest.mark.asyncio
    async def test_expired_authorization_prevents_everything(self):
        """Test that expired authorization prevents both verify and settle."""
        signer = make_mock_signer()
        facilitator = ExactEvmFacilitatorScheme(signer=signer)

        expired = str(int(time.time()) - 100)
        payload = make_valid_payload(valid_before=expired)
        requirements = make_requirements()

        # Verify fails
        verify_result = await facilitator.verify(payload, requirements)
        assert verify_result.is_valid is False
        assert verify_result.invalid_reason == "authorization_expired"

        # Settle also fails
        settle_result = await facilitator.settle(payload, requirements)
        assert settle_result.success is False
        assert settle_result.error_reason == "authorization_expired"

        # No on-chain interaction
        signer.execute_transfer.assert_not_called()
        signer.wait_for_confirmation.assert_not_called()


class TestEvmVerifyResult:
    """Test EvmVerifyResult data class."""

    def test_valid_result(self):
        """Test creating a valid verification result."""
        result = EvmVerifyResult(
            valid=True,
            recovered_address="0xabc",
        )
        assert result.valid is True
        assert result.recovered_address == "0xabc"
        assert result.reason is None

    def test_invalid_result(self):
        """Test creating an invalid verification result."""
        result = EvmVerifyResult(
            valid=False,
            reason="ecrecover_mismatch",
        )
        assert result.valid is False
        assert result.recovered_address is None
        assert result.reason == "ecrecover_mismatch"


class TestEvmTransactionConfirmation:
    """Test EvmTransactionConfirmation data class."""

    def test_successful_confirmation(self):
        """Test creating a successful confirmation."""
        confirmation = EvmTransactionConfirmation(
            success=True,
            tx_hash="0xabc",
            block_number=12345,
        )
        assert confirmation.success is True
        assert confirmation.tx_hash == "0xabc"
        assert confirmation.block_number == 12345
        assert confirmation.error is None

    def test_failed_confirmation(self):
        """Test creating a failed confirmation."""
        confirmation = EvmTransactionConfirmation(
            success=False,
            tx_hash="0xabc",
            error="execution reverted",
        )
        assert confirmation.success is False
        assert confirmation.tx_hash == "0xabc"
        assert confirmation.error == "execution reverted"


class TestFacilitatorEvmSignerProtocol:
    """Test FacilitatorEvmSigner protocol compliance."""

    def test_mock_signer_matches_protocol(self):
        """Test that our mock signer matches the protocol shape."""
        signer = make_mock_signer()
        # Verify it has all required methods
        assert hasattr(signer, "get_addresses")
        assert hasattr(signer, "verify_eip3009_signature")
        assert hasattr(signer, "execute_transfer")
        assert hasattr(signer, "wait_for_confirmation")
        assert hasattr(signer, "get_balance")

    def test_protocol_is_runtime_checkable(self):
        """Test that FacilitatorEvmSigner is runtime checkable."""
        assert hasattr(FacilitatorEvmSigner, "__protocol_attrs__") or hasattr(
            FacilitatorEvmSigner, "__abstractmethods__"
        )
