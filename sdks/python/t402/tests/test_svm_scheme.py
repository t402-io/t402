"""Tests for Solana SVM Exact Scheme - Client, Server, and Facilitator."""

import base64
import time

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from t402.schemes.svm.exact.client import (
    ExactSvmClientScheme,
    ClientSvmSigner,
    SCHEME_EXACT,
)
from t402.schemes.svm.exact.server import (
    ExactSvmServerScheme,
)
from t402.schemes.svm.exact.facilitator import (
    ExactSvmFacilitatorScheme,
    FacilitatorSvmSigner,
)
from t402.schemes.interfaces import SchemeNetworkFacilitator
from t402.types import VerifyResponse, SettleResponse, PaymentRequirementsV2
from t402.svm import (
    SOLANA_MAINNET,
    SOLANA_DEVNET,
    USDC_MAINNET_ADDRESS,
    USDC_DEVNET_ADDRESS,
    DEFAULT_DECIMALS,
)


# Test constants
TEST_SENDER = "8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL"
TEST_RECIPIENT = "4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zXqRULiLhwoBC"
TEST_FEE_PAYER = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d"
TEST_NETWORK = SOLANA_MAINNET
TEST_ASSET = USDC_MAINNET_ADDRESS
# A base64 string that decodes to >= 100 bytes (valid transaction size)
TEST_VALID_TX = base64.b64encode(b"x" * 200).decode()
TEST_TX_SIGNATURE = "5wBWVkHqH8RQJwNjKuFPfhxr1M3LgYMYKp6pYBr2V8ZK"


def make_mock_client_signer(
    address: str = TEST_SENDER,
    signed_tx: str = TEST_VALID_TX,
) -> MagicMock:
    """Create a mock ClientSvmSigner.

    Args:
        address: Signer address
        signed_tx: Transaction to return from sign_transaction

    Returns:
        Mock client signer
    """
    signer = MagicMock()
    signer.get_address = MagicMock(return_value=address)
    signer.sign_transaction = AsyncMock(return_value=signed_tx)
    return signer


def make_mock_facilitator_signer(
    addresses: list = None,
    signed_tx: str = TEST_VALID_TX,
    simulate_success: bool = True,
    send_result: str = TEST_TX_SIGNATURE,
    confirm_result: bool = True,
) -> MagicMock:
    """Create a mock FacilitatorSvmSigner.

    Args:
        addresses: List of fee payer addresses
        signed_tx: Transaction to return from sign_transaction
        simulate_success: Whether simulation succeeds
        send_result: Signature returned from send_transaction
        confirm_result: Whether confirmation succeeds

    Returns:
        Mock facilitator signer
    """
    if addresses is None:
        addresses = [TEST_FEE_PAYER]

    signer = MagicMock()
    signer.get_addresses = MagicMock(return_value=addresses)
    signer.sign_transaction = AsyncMock(return_value=signed_tx)

    if simulate_success:
        signer.simulate_transaction = AsyncMock(return_value=True)
    else:
        signer.simulate_transaction = AsyncMock(
            side_effect=Exception("Simulation failed: insufficient funds")
        )

    signer.send_transaction = AsyncMock(return_value=send_result)
    signer.confirm_transaction = AsyncMock(return_value=confirm_result)

    return signer


def make_requirements(
    scheme: str = "exact",
    network: str = TEST_NETWORK,
    asset: str = TEST_ASSET,
    amount: str = "1000000",
    pay_to: str = TEST_RECIPIENT,
    fee_payer: str = TEST_FEE_PAYER,
    max_timeout_seconds: int = 300,
) -> dict:
    """Create payment requirements for testing.

    Args:
        scheme: Payment scheme
        network: Network identifier
        asset: Token asset address
        amount: Required amount in atomic units
        pay_to: Recipient address
        fee_payer: Fee payer address
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
        "extra": {"feePayer": fee_payer} if fee_payer else {},
    }


def make_valid_payload(
    transaction: str = TEST_VALID_TX,
    from_addr: str = TEST_SENDER,
    to_addr: str = TEST_RECIPIENT,
    mint: str = TEST_ASSET,
    amount: str = "1000000",
    fee_payer: str = TEST_FEE_PAYER,
    valid_until: int = None,
) -> dict:
    """Create a valid SVM payment payload for testing.

    Args:
        transaction: Base64-encoded signed transaction
        from_addr: Sender address
        to_addr: Recipient address
        mint: Token mint address
        amount: Amount in atomic units
        fee_payer: Fee payer address
        valid_until: Validity timestamp

    Returns:
        Dict representing an SVM payment payload
    """
    if valid_until is None:
        valid_until = int(time.time()) + 3600

    return {
        "transaction": transaction,
        "authorization": {
            "from": from_addr,
            "to": to_addr,
            "mint": mint,
            "amount": amount,
            "validUntil": valid_until,
            "feePayer": fee_payer,
        },
    }


# =============================================================================
# Client Tests
# =============================================================================


class TestExactSvmClientSchemeBasic:
    """Test basic properties of ExactSvmClientScheme."""

    def test_scheme_name(self):
        """Test scheme is 'exact'."""
        signer = make_mock_client_signer()
        client = ExactSvmClientScheme(signer=signer)
        assert client.scheme == "exact"

    def test_caip_family(self):
        """Test CAIP family is solana:*."""
        signer = make_mock_client_signer()
        client = ExactSvmClientScheme(signer=signer)
        assert client.caip_family == "solana:*"

    def test_address_property(self):
        """Test address property returns signer address."""
        signer = make_mock_client_signer(address="MyAddress123")
        client = ExactSvmClientScheme(signer=signer)
        assert client.address == "MyAddress123"


class TestExactSvmClientSchemeCreatePayload:
    """Test create_payment_payload method."""

    @pytest.mark.asyncio
    async def test_create_payload_basic(self):
        """Test creating a basic payment payload."""
        signer = make_mock_client_signer()
        client = ExactSvmClientScheme(signer=signer)

        async def build_tx():
            return TEST_VALID_TX

        requirements = make_requirements()

        # Mock parse_transfer_checked_instruction to return None (no solana deps)
        with patch(
            "t402.schemes.svm.exact.client.parse_transfer_checked_instruction",
            return_value=None,
        ):
            payload = await client.create_payment_payload(
                t402_version=2,
                requirements=requirements,
                build_transaction=build_tx,
            )

        assert payload["t402Version"] == 2
        assert payload["payload"]["transaction"] == TEST_VALID_TX
        assert payload["payload"]["authorization"]["from"] == TEST_SENDER
        assert payload["payload"]["authorization"]["to"] == TEST_RECIPIENT
        assert payload["payload"]["authorization"]["mint"] == TEST_ASSET
        assert payload["payload"]["authorization"]["amount"] == "1000000"

    @pytest.mark.asyncio
    async def test_create_payload_v1_format(self):
        """Test creating a V1 format payment payload."""
        signer = make_mock_client_signer()
        client = ExactSvmClientScheme(signer=signer)

        async def build_tx():
            return TEST_VALID_TX

        requirements = make_requirements()

        with patch(
            "t402.schemes.svm.exact.client.parse_transfer_checked_instruction",
            return_value=None,
        ):
            payload = await client.create_payment_payload(
                t402_version=1,
                requirements=requirements,
                build_transaction=build_tx,
            )

        assert payload["t402Version"] == 1
        assert payload["scheme"] == "exact"
        assert payload["network"] == SOLANA_MAINNET

    @pytest.mark.asyncio
    async def test_create_payload_with_transfer_details(self):
        """Test payload uses transfer details from parsed instruction."""
        signer = make_mock_client_signer()
        client = ExactSvmClientScheme(signer=signer)

        async def build_tx():
            return TEST_VALID_TX

        requirements = make_requirements()

        mock_transfer = {
            "source": "source_ata",
            "mint": USDC_MAINNET_ADDRESS,
            "destination": "dest_ata",
            "authority": TEST_SENDER,
            "amount": 2000000,
            "decimals": 6,
        }

        with patch(
            "t402.schemes.svm.exact.client.parse_transfer_checked_instruction",
            return_value=mock_transfer,
        ):
            payload = await client.create_payment_payload(
                t402_version=2,
                requirements=requirements,
                build_transaction=build_tx,
            )

        assert payload["payload"]["authorization"]["mint"] == USDC_MAINNET_ADDRESS
        assert payload["payload"]["authorization"]["amount"] == "2000000"

    @pytest.mark.asyncio
    async def test_create_payload_missing_asset(self):
        """Test error when asset is missing."""
        signer = make_mock_client_signer()
        client = ExactSvmClientScheme(signer=signer)

        async def build_tx():
            return TEST_VALID_TX

        requirements = {"network": SOLANA_MAINNET, "payTo": TEST_RECIPIENT}

        with pytest.raises(ValueError, match="Asset"):
            await client.create_payment_payload(
                t402_version=2,
                requirements=requirements,
                build_transaction=build_tx,
            )

    @pytest.mark.asyncio
    async def test_create_payload_missing_pay_to(self):
        """Test error when payTo is missing."""
        signer = make_mock_client_signer()
        client = ExactSvmClientScheme(signer=signer)

        async def build_tx():
            return TEST_VALID_TX

        requirements = {"network": SOLANA_MAINNET, "asset": TEST_ASSET}

        with pytest.raises(ValueError, match="PayTo"):
            await client.create_payment_payload(
                t402_version=2,
                requirements=requirements,
                build_transaction=build_tx,
            )

    @pytest.mark.asyncio
    async def test_create_payload_invalid_pay_to(self):
        """Test error when payTo is invalid."""
        signer = make_mock_client_signer()
        client = ExactSvmClientScheme(signer=signer)

        async def build_tx():
            return TEST_VALID_TX

        requirements = {
            "network": SOLANA_MAINNET,
            "asset": TEST_ASSET,
            "amount": "1000000",
            "payTo": "invalid!!!address",
        }

        with pytest.raises(ValueError, match="Invalid payTo"):
            await client.create_payment_payload(
                t402_version=2,
                requirements=requirements,
                build_transaction=build_tx,
            )

    @pytest.mark.asyncio
    async def test_create_payload_no_builder(self):
        """Test error when no build_transaction is provided."""
        signer = make_mock_client_signer()
        client = ExactSvmClientScheme(signer=signer)

        requirements = make_requirements()

        with pytest.raises(ValueError, match="build_transaction"):
            await client.create_payment_payload(
                t402_version=2,
                requirements=requirements,
            )

    @pytest.mark.asyncio
    async def test_create_payload_calls_signer(self):
        """Test that sign_transaction is called with correct params."""
        signer = make_mock_client_signer()
        client = ExactSvmClientScheme(signer=signer)

        async def build_tx():
            return "unsigned_tx_base64"

        requirements = make_requirements()

        with patch(
            "t402.schemes.svm.exact.client.parse_transfer_checked_instruction",
            return_value=None,
        ):
            await client.create_payment_payload(
                t402_version=2,
                requirements=requirements,
                build_transaction=build_tx,
            )

        signer.sign_transaction.assert_called_once_with(
            "unsigned_tx_base64",
            SOLANA_MAINNET,
        )


# =============================================================================
# Server Tests
# =============================================================================


class TestExactSvmServerSchemeBasic:
    """Test basic properties of ExactSvmServerScheme."""

    def test_scheme_name(self):
        """Test scheme is 'exact'."""
        server = ExactSvmServerScheme()
        assert server.scheme == "exact"

    def test_caip_family(self):
        """Test CAIP family is solana:*."""
        server = ExactSvmServerScheme()
        assert server.caip_family == "solana:*"


class TestExactSvmServerSchemeParsePrice:
    """Test parse_price method."""

    @pytest.mark.asyncio
    async def test_parse_dollar_string(self):
        """Test parsing '$1.00' format."""
        server = ExactSvmServerScheme()
        result = await server.parse_price("$1.00", SOLANA_MAINNET)

        assert result["amount"] == "1000000"
        assert result["asset"] == USDC_MAINNET_ADDRESS
        assert result["extra"]["symbol"] == "USDC"
        assert result["extra"]["decimals"] == 6

    @pytest.mark.asyncio
    async def test_parse_plain_string(self):
        """Test parsing '0.50' format."""
        server = ExactSvmServerScheme()
        result = await server.parse_price("0.50", SOLANA_MAINNET)

        assert result["amount"] == "500000"
        assert result["asset"] == USDC_MAINNET_ADDRESS

    @pytest.mark.asyncio
    async def test_parse_float(self):
        """Test parsing float price."""
        server = ExactSvmServerScheme()
        result = await server.parse_price(0.25, SOLANA_MAINNET)

        assert result["amount"] == "250000"

    @pytest.mark.asyncio
    async def test_parse_integer(self):
        """Test parsing integer price."""
        server = ExactSvmServerScheme()
        result = await server.parse_price(2, SOLANA_MAINNET)

        assert result["amount"] == "2000000"

    @pytest.mark.asyncio
    async def test_parse_dict_format(self):
        """Test parsing dict (TokenAmount) format."""
        server = ExactSvmServerScheme()
        result = await server.parse_price(
            {"amount": "500000", "asset": "CustomMint"},
            SOLANA_MAINNET,
        )

        assert result["amount"] == "500000"
        assert result["asset"] == "CustomMint"

    @pytest.mark.asyncio
    async def test_parse_devnet(self):
        """Test parsing price on devnet."""
        server = ExactSvmServerScheme()
        result = await server.parse_price("$1.00", SOLANA_DEVNET)

        assert result["amount"] == "1000000"
        assert result["asset"] == USDC_DEVNET_ADDRESS

    @pytest.mark.asyncio
    async def test_parse_unsupported_network(self):
        """Test error for unsupported network."""
        server = ExactSvmServerScheme()

        with pytest.raises(ValueError, match="Not a Solana network"):
            await server.parse_price("$1.00", "eip155:1")

    @pytest.mark.asyncio
    async def test_parse_legacy_network(self):
        """Test parsing with legacy network format."""
        server = ExactSvmServerScheme()
        result = await server.parse_price("$1.00", "solana")

        assert result["amount"] == "1000000"
        assert result["asset"] == USDC_MAINNET_ADDRESS


class TestExactSvmServerSchemeEnhanceRequirements:
    """Test enhance_requirements method."""

    @pytest.mark.asyncio
    async def test_enhance_adds_metadata(self):
        """Test that enhance adds token metadata."""
        server = ExactSvmServerScheme()

        requirements = {
            "network": SOLANA_MAINNET,
            "asset": USDC_MAINNET_ADDRESS,
            "amount": "1000000",
            "payTo": TEST_RECIPIENT,
        }
        supported_kind = {"extra": {"feePayer": TEST_FEE_PAYER}}

        result = await server.enhance_requirements(
            requirements, supported_kind, []
        )

        assert result["extra"]["symbol"] == "USDC"
        assert result["extra"]["feePayer"] == TEST_FEE_PAYER

    @pytest.mark.asyncio
    async def test_enhance_normalizes_network(self):
        """Test that enhance normalizes legacy network format."""
        server = ExactSvmServerScheme()

        requirements = {
            "network": "solana",
            "asset": USDC_MAINNET_ADDRESS,
            "amount": "1000000",
        }

        result = await server.enhance_requirements(requirements, {}, [])

        assert result["network"] == SOLANA_MAINNET

    @pytest.mark.asyncio
    async def test_enhance_preserves_existing_extra(self):
        """Test that enhance does not overwrite existing extra fields."""
        server = ExactSvmServerScheme()

        requirements = {
            "network": SOLANA_MAINNET,
            "asset": USDC_MAINNET_ADDRESS,
            "extra": {"symbol": "CUSTOM", "myField": "preserved"},
        }

        result = await server.enhance_requirements(requirements, {}, [])

        assert result["extra"]["symbol"] == "CUSTOM"
        assert result["extra"]["myField"] == "preserved"

    @pytest.mark.asyncio
    async def test_enhance_with_pydantic_model(self):
        """Test enhance_requirements with Pydantic model."""
        server = ExactSvmServerScheme()

        requirements = PaymentRequirementsV2(
            scheme="exact",
            network=SOLANA_MAINNET,
            asset=USDC_MAINNET_ADDRESS,
            amount="1000000",
            pay_to=TEST_RECIPIENT,
            max_timeout_seconds=300,
        )

        result = await server.enhance_requirements(requirements, {}, [])

        assert result["network"] == SOLANA_MAINNET
        assert "symbol" in result["extra"]


# =============================================================================
# Facilitator Tests
# =============================================================================


class TestExactSvmFacilitatorSchemeBasic:
    """Test basic properties of ExactSvmFacilitatorScheme."""

    def test_scheme_name(self):
        """Test scheme is 'exact'."""
        signer = make_mock_facilitator_signer()
        facilitator = ExactSvmFacilitatorScheme(signer=signer)
        assert facilitator.scheme == "exact"

    def test_caip_family(self):
        """Test CAIP family is solana:*."""
        signer = make_mock_facilitator_signer()
        facilitator = ExactSvmFacilitatorScheme(signer=signer)
        assert facilitator.caip_family == "solana:*"

    def test_protocol_compliance(self):
        """Test that ExactSvmFacilitatorScheme implements SchemeNetworkFacilitator."""
        signer = make_mock_facilitator_signer()
        facilitator = ExactSvmFacilitatorScheme(signer=signer)
        assert isinstance(facilitator, SchemeNetworkFacilitator)
        assert hasattr(facilitator, "scheme")
        assert hasattr(facilitator, "caip_family")
        assert hasattr(facilitator, "get_signers")
        assert hasattr(facilitator, "get_extra")
        assert hasattr(facilitator, "verify")
        assert hasattr(facilitator, "settle")

    def test_init_stores_signer(self):
        """Test initialization stores the signer."""
        signer = make_mock_facilitator_signer()
        facilitator = ExactSvmFacilitatorScheme(signer=signer)
        assert facilitator._signer is signer


class TestExactSvmFacilitatorGetExtra:
    """Test get_extra method."""

    def test_get_extra_returns_fee_payer(self):
        """Test get_extra returns a fee payer address."""
        signer = make_mock_facilitator_signer(addresses=[TEST_FEE_PAYER])
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        extra = facilitator.get_extra(SOLANA_MAINNET)

        assert extra is not None
        assert extra["feePayer"] == TEST_FEE_PAYER

    def test_get_extra_no_addresses(self):
        """Test get_extra returns None when no addresses available."""
        signer = make_mock_facilitator_signer(addresses=[])
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        extra = facilitator.get_extra(SOLANA_MAINNET)

        assert extra is None


class TestExactSvmFacilitatorGetSigners:
    """Test get_signers method."""

    def test_get_signers_returns_addresses(self):
        """Test get_signers returns addresses from the signer."""
        addresses = [TEST_FEE_PAYER, "SecondFeePayer"]
        signer = make_mock_facilitator_signer(addresses=addresses)
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        result = facilitator.get_signers(SOLANA_MAINNET)

        assert result == addresses

    def test_get_signers_empty(self):
        """Test get_signers returns empty list when no addresses."""
        signer = make_mock_facilitator_signer(addresses=[])
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        result = facilitator.get_signers(SOLANA_MAINNET)

        assert result == []


class TestExactSvmFacilitatorVerify:
    """Test verify method of ExactSvmFacilitatorScheme."""

    @pytest.mark.asyncio
    async def test_verify_valid_payload(self):
        """Test verification succeeds with valid payload."""
        signer = make_mock_facilitator_signer()
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        with patch(
            "t402.schemes.svm.exact.facilitator.get_token_payer_from_transaction",
            return_value=TEST_SENDER,
        ), patch(
            "t402.schemes.svm.exact.facilitator.parse_transfer_checked_instruction",
            return_value={
                "source": "source_ata",
                "mint": TEST_ASSET,
                "destination": "dest_ata",
                "authority": TEST_SENDER,
                "amount": 1000000,
                "decimals": 6,
            },
        ):
            result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True
        assert result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_verify_unsupported_scheme(self):
        """Test verification fails with unsupported scheme."""
        signer = make_mock_facilitator_signer()
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements(scheme="streaming")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "unsupported_scheme"

    @pytest.mark.asyncio
    async def test_verify_unsupported_network(self):
        """Test verification fails with unsupported network."""
        signer = make_mock_facilitator_signer()
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements(network="eip155:1")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "unsupported_network"

    @pytest.mark.asyncio
    async def test_verify_missing_transaction(self):
        """Test verification fails when transaction is missing."""
        signer = make_mock_facilitator_signer()
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        payload = {"authorization": {"from": TEST_SENDER}}
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "invalid_payload_structure"

    @pytest.mark.asyncio
    async def test_verify_invalid_transaction_format(self):
        """Test verification fails with invalid transaction format."""
        signer = make_mock_facilitator_signer()
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        # A short base64 string (< 100 bytes when decoded)
        payload = {"transaction": base64.b64encode(b"short").decode()}
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "invalid_transaction_format"

    @pytest.mark.asyncio
    async def test_verify_missing_fee_payer(self):
        """Test verification fails when fee payer is missing."""
        signer = make_mock_facilitator_signer()
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements(fee_payer=None)

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "missing_fee_payer"

    @pytest.mark.asyncio
    async def test_verify_fee_payer_not_managed(self):
        """Test verification fails when fee payer is not managed."""
        signer = make_mock_facilitator_signer(addresses=["OtherAddress"])
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements(fee_payer=TEST_FEE_PAYER)

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "fee_payer_not_managed"

    @pytest.mark.asyncio
    async def test_verify_no_transfer_instruction(self):
        """Test verification fails when no transfer instruction found."""
        signer = make_mock_facilitator_signer()
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        with patch(
            "t402.schemes.svm.exact.facilitator.get_token_payer_from_transaction",
            return_value=None,
        ):
            result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "no_transfer_instruction"

    @pytest.mark.asyncio
    async def test_verify_facilitator_funds_blocked(self):
        """Test verification fails when facilitator authority tries to transfer."""
        signer = make_mock_facilitator_signer(addresses=[TEST_FEE_PAYER])
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        with patch(
            "t402.schemes.svm.exact.facilitator.get_token_payer_from_transaction",
            return_value=TEST_FEE_PAYER,
        ), patch(
            "t402.schemes.svm.exact.facilitator.parse_transfer_checked_instruction",
            return_value={
                "source": "source_ata",
                "mint": TEST_ASSET,
                "destination": "dest_ata",
                "authority": TEST_FEE_PAYER,  # Facilitator is authority!
                "amount": 1000000,
                "decimals": 6,
            },
        ):
            result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "facilitator_funds_transfer_blocked"

    @pytest.mark.asyncio
    async def test_verify_asset_mismatch(self):
        """Test verification fails when mint doesn't match asset."""
        signer = make_mock_facilitator_signer()
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        with patch(
            "t402.schemes.svm.exact.facilitator.get_token_payer_from_transaction",
            return_value=TEST_SENDER,
        ), patch(
            "t402.schemes.svm.exact.facilitator.parse_transfer_checked_instruction",
            return_value={
                "source": "source_ata",
                "mint": "WrongMintAddress123456789012345678901234567",
                "destination": "dest_ata",
                "authority": TEST_SENDER,
                "amount": 1000000,
                "decimals": 6,
            },
        ):
            result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "asset_mismatch"

    @pytest.mark.asyncio
    async def test_verify_insufficient_amount(self):
        """Test verification fails when amount is insufficient."""
        signer = make_mock_facilitator_signer()
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements(amount="2000000")

        with patch(
            "t402.schemes.svm.exact.facilitator.get_token_payer_from_transaction",
            return_value=TEST_SENDER,
        ), patch(
            "t402.schemes.svm.exact.facilitator.parse_transfer_checked_instruction",
            return_value={
                "source": "source_ata",
                "mint": TEST_ASSET,
                "destination": "dest_ata",
                "authority": TEST_SENDER,
                "amount": 1000000,  # Less than 2000000
                "decimals": 6,
            },
        ):
            result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "insufficient_amount"

    @pytest.mark.asyncio
    async def test_verify_amount_equals_required(self):
        """Test verification passes when amount equals required."""
        signer = make_mock_facilitator_signer()
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements(amount="1000000")

        with patch(
            "t402.schemes.svm.exact.facilitator.get_token_payer_from_transaction",
            return_value=TEST_SENDER,
        ), patch(
            "t402.schemes.svm.exact.facilitator.parse_transfer_checked_instruction",
            return_value={
                "source": "source_ata",
                "mint": TEST_ASSET,
                "destination": "dest_ata",
                "authority": TEST_SENDER,
                "amount": 1000000,
                "decimals": 6,
            },
        ):
            result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_amount_exceeds_required(self):
        """Test verification passes when amount exceeds required."""
        signer = make_mock_facilitator_signer()
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements(amount="500000")

        with patch(
            "t402.schemes.svm.exact.facilitator.get_token_payer_from_transaction",
            return_value=TEST_SENDER,
        ), patch(
            "t402.schemes.svm.exact.facilitator.parse_transfer_checked_instruction",
            return_value={
                "source": "source_ata",
                "mint": TEST_ASSET,
                "destination": "dest_ata",
                "authority": TEST_SENDER,
                "amount": 1000000,
                "decimals": 6,
            },
        ):
            result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_simulation_failure(self):
        """Test verification fails when simulation fails."""
        signer = make_mock_facilitator_signer(simulate_success=False)
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        with patch(
            "t402.schemes.svm.exact.facilitator.get_token_payer_from_transaction",
            return_value=TEST_SENDER,
        ), patch(
            "t402.schemes.svm.exact.facilitator.parse_transfer_checked_instruction",
            return_value={
                "source": "source_ata",
                "mint": TEST_ASSET,
                "destination": "dest_ata",
                "authority": TEST_SENDER,
                "amount": 1000000,
                "decimals": 6,
            },
        ):
            result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "simulation_failed" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_handles_nested_payload(self):
        """Test verification handles PaymentPayloadV2-style nested payload."""
        signer = make_mock_facilitator_signer()
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        inner_payload = make_valid_payload()
        wrapped_payload = {
            "t402Version": 2,
            "payload": inner_payload,
        }
        requirements = make_requirements()

        with patch(
            "t402.schemes.svm.exact.facilitator.get_token_payer_from_transaction",
            return_value=TEST_SENDER,
        ), patch(
            "t402.schemes.svm.exact.facilitator.parse_transfer_checked_instruction",
            return_value={
                "source": "source_ata",
                "mint": TEST_ASSET,
                "destination": "dest_ata",
                "authority": TEST_SENDER,
                "amount": 1000000,
                "decimals": 6,
            },
        ):
            result = await facilitator.verify(wrapped_payload, requirements)

        assert result.is_valid is True
        assert result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_verify_invalid_required_amount(self):
        """Test verification fails with non-numeric required amount."""
        signer = make_mock_facilitator_signer()
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements(amount="not_a_number")

        with patch(
            "t402.schemes.svm.exact.facilitator.get_token_payer_from_transaction",
            return_value=TEST_SENDER,
        ), patch(
            "t402.schemes.svm.exact.facilitator.parse_transfer_checked_instruction",
            return_value={
                "source": "source_ata",
                "mint": TEST_ASSET,
                "destination": "dest_ata",
                "authority": TEST_SENDER,
                "amount": 1000000,
                "decimals": 6,
            },
        ):
            result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert result.invalid_reason == "invalid_required_amount"

    @pytest.mark.asyncio
    async def test_verify_handles_exception_gracefully(self):
        """Test verification handles unexpected exceptions gracefully."""
        signer = make_mock_facilitator_signer()
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

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
        signer = make_mock_facilitator_signer()
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = PaymentRequirementsV2(
            scheme="exact",
            network=TEST_NETWORK,
            asset=TEST_ASSET,
            amount="1000000",
            pay_to=TEST_RECIPIENT,
            max_timeout_seconds=300,
            extra={"feePayer": TEST_FEE_PAYER},
        )

        with patch(
            "t402.schemes.svm.exact.facilitator.get_token_payer_from_transaction",
            return_value=TEST_SENDER,
        ), patch(
            "t402.schemes.svm.exact.facilitator.parse_transfer_checked_instruction",
            return_value={
                "source": "source_ata",
                "mint": TEST_ASSET,
                "destination": "dest_ata",
                "authority": TEST_SENDER,
                "amount": 1000000,
                "decimals": 6,
            },
        ):
            result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True
        assert result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_verify_calls_signer_methods_correctly(self):
        """Test that verify calls signer methods with correct parameters."""
        signer = make_mock_facilitator_signer()
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        with patch(
            "t402.schemes.svm.exact.facilitator.get_token_payer_from_transaction",
            return_value=TEST_SENDER,
        ), patch(
            "t402.schemes.svm.exact.facilitator.parse_transfer_checked_instruction",
            return_value={
                "source": "source_ata",
                "mint": TEST_ASSET,
                "destination": "dest_ata",
                "authority": TEST_SENDER,
                "amount": 1000000,
                "decimals": 6,
            },
        ):
            await facilitator.verify(payload, requirements)

        # Verify sign_transaction was called
        signer.sign_transaction.assert_called_once_with(
            TEST_VALID_TX,
            TEST_FEE_PAYER,
            SOLANA_MAINNET,
        )

        # Verify simulate_transaction was called with signed tx
        signer.simulate_transaction.assert_called_once_with(
            TEST_VALID_TX,  # The mock returns TEST_VALID_TX from sign_transaction
            SOLANA_MAINNET,
        )


class TestExactSvmFacilitatorSettle:
    """Test settle method of ExactSvmFacilitatorScheme."""

    @pytest.mark.asyncio
    async def test_settle_success(self):
        """Test successful settlement."""
        signer = make_mock_facilitator_signer(
            send_result=TEST_TX_SIGNATURE,
            confirm_result=True,
        )
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        with patch(
            "t402.schemes.svm.exact.facilitator.get_token_payer_from_transaction",
            return_value=TEST_SENDER,
        ), patch(
            "t402.schemes.svm.exact.facilitator.parse_transfer_checked_instruction",
            return_value={
                "source": "source_ata",
                "mint": TEST_ASSET,
                "destination": "dest_ata",
                "authority": TEST_SENDER,
                "amount": 1000000,
                "decimals": 6,
            },
        ):
            result = await facilitator.settle(payload, requirements)

        assert result.success is True
        assert result.transaction == TEST_TX_SIGNATURE
        assert result.network == TEST_NETWORK
        assert result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_settle_fails_on_verification_failure(self):
        """Test settlement fails when verification fails."""
        signer = make_mock_facilitator_signer()
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements(scheme="streaming")

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert result.error_reason == "unsupported_scheme"

    @pytest.mark.asyncio
    async def test_settle_confirmation_timeout(self):
        """Test settlement handles confirmation timeout."""
        signer = make_mock_facilitator_signer(
            send_result=TEST_TX_SIGNATURE,
            confirm_result=False,  # Confirmation fails
        )
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        with patch(
            "t402.schemes.svm.exact.facilitator.get_token_payer_from_transaction",
            return_value=TEST_SENDER,
        ), patch(
            "t402.schemes.svm.exact.facilitator.parse_transfer_checked_instruction",
            return_value={
                "source": "source_ata",
                "mint": TEST_ASSET,
                "destination": "dest_ata",
                "authority": TEST_SENDER,
                "amount": 1000000,
                "decimals": 6,
            },
        ):
            result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert result.error_reason == "confirmation_timeout"
        assert result.transaction == TEST_TX_SIGNATURE

    @pytest.mark.asyncio
    async def test_settle_send_failure(self):
        """Test settlement handles send failure."""
        signer = make_mock_facilitator_signer()
        signer.send_transaction = AsyncMock(
            side_effect=RuntimeError("Network error")
        )
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        with patch(
            "t402.schemes.svm.exact.facilitator.get_token_payer_from_transaction",
            return_value=TEST_SENDER,
        ), patch(
            "t402.schemes.svm.exact.facilitator.parse_transfer_checked_instruction",
            return_value={
                "source": "source_ata",
                "mint": TEST_ASSET,
                "destination": "dest_ata",
                "authority": TEST_SENDER,
                "amount": 1000000,
                "decimals": 6,
            },
        ):
            result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert "settlement_error" in result.error_reason
        assert "Network error" in result.error_reason

    @pytest.mark.asyncio
    async def test_settle_calls_correct_methods(self):
        """Test settle calls signer methods with correct parameters."""
        signer = make_mock_facilitator_signer(
            send_result="tx_sig_123",
            confirm_result=True,
        )
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements()

        with patch(
            "t402.schemes.svm.exact.facilitator.get_token_payer_from_transaction",
            return_value=TEST_SENDER,
        ), patch(
            "t402.schemes.svm.exact.facilitator.parse_transfer_checked_instruction",
            return_value={
                "source": "source_ata",
                "mint": TEST_ASSET,
                "destination": "dest_ata",
                "authority": TEST_SENDER,
                "amount": 1000000,
                "decimals": 6,
            },
        ):
            await facilitator.settle(payload, requirements)

        # sign_transaction called twice: once in verify, once in settle
        assert signer.sign_transaction.call_count == 2

        # send_transaction called with signed tx
        signer.send_transaction.assert_called_once()

        # confirm_transaction called with signature
        signer.confirm_transaction.assert_called_once_with(
            "tx_sig_123",
            SOLANA_MAINNET,
        )

    @pytest.mark.asyncio
    async def test_settle_with_nested_payload(self):
        """Test settle handles PaymentPayloadV2-style nested payload."""
        signer = make_mock_facilitator_signer(
            send_result=TEST_TX_SIGNATURE,
            confirm_result=True,
        )
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        inner_payload = make_valid_payload()
        wrapped_payload = {
            "t402Version": 2,
            "payload": inner_payload,
        }
        requirements = make_requirements()

        with patch(
            "t402.schemes.svm.exact.facilitator.get_token_payer_from_transaction",
            return_value=TEST_SENDER,
        ), patch(
            "t402.schemes.svm.exact.facilitator.parse_transfer_checked_instruction",
            return_value={
                "source": "source_ata",
                "mint": TEST_ASSET,
                "destination": "dest_ata",
                "authority": TEST_SENDER,
                "amount": 1000000,
                "decimals": 6,
            },
        ):
            result = await facilitator.settle(wrapped_payload, requirements)

        assert result.success is True


class TestExactSvmFacilitatorExtractHelpers:
    """Test payload and requirements extraction helpers."""

    def test_extract_payload_from_dict(self):
        """Test extracting payload from plain dict."""
        signer = make_mock_facilitator_signer()
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        payload_data = make_valid_payload()
        result = facilitator._extract_payload(payload_data)

        assert result["transaction"] == TEST_VALID_TX
        assert result["authorization"]["from"] == TEST_SENDER

    def test_extract_payload_from_wrapped_dict(self):
        """Test extracting payload from wrapped dict (V2 format)."""
        signer = make_mock_facilitator_signer()
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        inner = make_valid_payload()
        wrapped = {"t402Version": 2, "payload": inner}
        result = facilitator._extract_payload(wrapped)

        assert result["transaction"] == TEST_VALID_TX

    def test_extract_requirements_from_dict(self):
        """Test extracting requirements from plain dict."""
        signer = make_mock_facilitator_signer()
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        requirements = make_requirements()
        result = facilitator._extract_requirements(requirements)

        assert result["scheme"] == "exact"
        assert result["network"] == TEST_NETWORK
        assert result["amount"] == "1000000"

    def test_extract_requirements_from_model(self):
        """Test extracting requirements from Pydantic model."""
        signer = make_mock_facilitator_signer()
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        model = PaymentRequirementsV2(
            scheme="exact",
            network=TEST_NETWORK,
            asset=TEST_ASSET,
            amount="1000000",
            pay_to=TEST_RECIPIENT,
            max_timeout_seconds=300,
            extra={"feePayer": TEST_FEE_PAYER},
        )
        result = facilitator._extract_requirements(model)

        assert result["scheme"] == "exact"
        assert result["payTo"] == TEST_RECIPIENT


class TestExactSvmFacilitatorIntegration:
    """Integration-style tests for verify + settle flow."""

    @pytest.mark.asyncio
    async def test_full_verify_then_settle_flow(self):
        """Test the full verify -> settle flow."""
        signer = make_mock_facilitator_signer(
            send_result="final_signature",
            confirm_result=True,
        )
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements(amount="500000")

        with patch(
            "t402.schemes.svm.exact.facilitator.get_token_payer_from_transaction",
            return_value=TEST_SENDER,
        ), patch(
            "t402.schemes.svm.exact.facilitator.parse_transfer_checked_instruction",
            return_value={
                "source": "source_ata",
                "mint": TEST_ASSET,
                "destination": "dest_ata",
                "authority": TEST_SENDER,
                "amount": 1000000,
                "decimals": 6,
            },
        ):
            # Step 1: Verify
            verify_result = await facilitator.verify(payload, requirements)
            assert verify_result.is_valid is True
            assert verify_result.payer == TEST_SENDER

            # Step 2: Settle
            settle_result = await facilitator.settle(payload, requirements)
            assert settle_result.success is True
            assert settle_result.transaction == "final_signature"
            assert settle_result.network == TEST_NETWORK
            assert settle_result.payer == TEST_SENDER

    @pytest.mark.asyncio
    async def test_verify_failure_prevents_settle(self):
        """Test that verification failure prevents settlement."""
        signer = make_mock_facilitator_signer()
        facilitator = ExactSvmFacilitatorScheme(signer=signer)

        payload = make_valid_payload()
        requirements = make_requirements(amount="2000000")

        with patch(
            "t402.schemes.svm.exact.facilitator.get_token_payer_from_transaction",
            return_value=TEST_SENDER,
        ), patch(
            "t402.schemes.svm.exact.facilitator.parse_transfer_checked_instruction",
            return_value={
                "source": "source_ata",
                "mint": TEST_ASSET,
                "destination": "dest_ata",
                "authority": TEST_SENDER,
                "amount": 1000000,  # Less than required 2000000
                "decimals": 6,
            },
        ):
            # Settle fails (calls verify internally)
            settle_result = await facilitator.settle(payload, requirements)
            assert settle_result.success is False
            assert settle_result.error_reason == "insufficient_amount"

            # send_transaction should not have been called
            signer.send_transaction.assert_not_called()


# =============================================================================
# Import Tests
# =============================================================================


class TestSvmSchemeImports:
    """Test that all SVM scheme classes can be imported from the package."""

    def test_import_from_svm_package(self):
        """Test importing from t402.schemes.svm."""
        from t402.schemes.svm import (
            ExactSvmClientScheme,
            ExactSvmServerScheme,
            ExactSvmFacilitatorScheme,
            ClientSvmSigner,
            FacilitatorSvmSigner,
            SCHEME_EXACT,
        )

        assert SCHEME_EXACT == "exact"

    def test_import_from_schemes_package(self):
        """Test importing from t402.schemes (top-level)."""
        from t402.schemes import (
            ExactSvmClientScheme,
            ExactSvmServerScheme,
            ExactSvmFacilitatorScheme,
            SvmClientSigner,
            SvmFacilitatorSigner,
            SVM_SCHEME_EXACT,
        )

        assert SVM_SCHEME_EXACT == "exact"


class TestTonTronFacilitatorImports:
    """Test that TON/TRON facilitator classes are properly exported."""

    def test_ton_facilitator_import(self):
        """Test importing TON facilitator from t402.schemes."""
        from t402.schemes import (
            ExactTonFacilitatorScheme,
            FacilitatorTonSigner,
        )

    def test_tron_facilitator_import(self):
        """Test importing TRON facilitator from t402.schemes."""
        from t402.schemes import (
            ExactTronFacilitatorScheme,
            ExactTronFacilitatorConfig,
            FacilitatorTronSigner,
        )

    def test_evm_upto_server_facilitator_import(self):
        """Test importing EVM upto server and facilitator from t402.schemes."""
        from t402.schemes import (
            UptoEvmServerScheme,
            UptoEvmFacilitatorScheme,
        )

    def test_ton_facilitator_from_ton_package(self):
        """Test importing from t402.schemes.ton."""
        from t402.schemes.ton import (
            ExactTonFacilitatorScheme,
            FacilitatorTonSigner,
        )

    def test_tron_facilitator_from_tron_package(self):
        """Test importing from t402.schemes.tron."""
        from t402.schemes.tron import (
            ExactTronFacilitatorScheme,
            ExactTronFacilitatorConfig,
            FacilitatorTronSigner,
        )

    def test_evm_upto_from_evm_package(self):
        """Test importing upto server/facilitator from t402.schemes.evm."""
        from t402.schemes.evm import (
            UptoEvmServerScheme,
            UptoEvmFacilitatorScheme,
        )
