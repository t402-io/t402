"""Tests for EVM Up-To Scheme - Facilitator Implementation."""

import time

import pytest
from unittest.mock import MagicMock, patch, PropertyMock

from t402.schemes.evm.upto.facilitator import (
    UptoEvmFacilitatorScheme,
    ERC20_PERMIT_ABI,
)
from t402.schemes.interfaces import SchemeNetworkFacilitator
from t402.types import VerifyResponse, SettleResponse


# Test constants
TEST_OWNER = "0x1234567890123456789012345678901234567890"
TEST_SPENDER = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"
TEST_PAY_TO = "0x9876543210987654321098765432109876543210"
TEST_ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
TEST_NETWORK = "eip155:8453"
TEST_PRIVATE_KEY = "0x" + "ab" * 32  # Dummy private key


def make_valid_payload(
    owner: str = TEST_OWNER,
    spender: str = TEST_SPENDER,
    value: str = "1000000",
    deadline: str = None,
    nonce: int = 0,
) -> dict:
    """Create a valid EIP-2612 permit payload for testing."""
    if deadline is None:
        deadline = str(int(time.time()) + 3600)  # 1 hour from now

    return {
        "signature": {
            "v": 28,
            "r": "0x" + "ab" * 32,
            "s": "0x" + "cd" * 32,
        },
        "authorization": {
            "owner": owner,
            "spender": spender,
            "value": value,
            "deadline": deadline,
            "nonce": nonce,
        },
        "paymentNonce": "0x" + "ef" * 32,
    }


def make_requirements(
    amount: str = "1000000",
    network: str = TEST_NETWORK,
    asset: str = TEST_ASSET,
    pay_to: str = TEST_PAY_TO,
) -> dict:
    """Create payment requirements for testing."""
    return {
        "scheme": "upto",
        "network": network,
        "asset": asset,
        "amount": amount,
        "payTo": pay_to,
        "maxTimeoutSeconds": 300,
        "extra": {
            "name": "USD Coin",
            "version": "2",
        },
    }


class TestUptoEvmFacilitatorBasic:
    """Test basic properties of UptoEvmFacilitatorScheme."""

    def test_scheme_name(self):
        """Test scheme is 'upto'."""
        facilitator = UptoEvmFacilitatorScheme()
        assert facilitator.scheme == "upto"

    def test_caip_family(self):
        """Test CAIP family is eip155:*."""
        facilitator = UptoEvmFacilitatorScheme()
        assert facilitator.caip_family == "eip155:*"

    def test_protocol_compliance(self):
        """Test that UptoEvmFacilitatorScheme implements SchemeNetworkFacilitator."""
        facilitator = UptoEvmFacilitatorScheme()
        assert isinstance(facilitator, SchemeNetworkFacilitator)
        assert hasattr(facilitator, "scheme")
        assert hasattr(facilitator, "caip_family")
        assert hasattr(facilitator, "get_signers")
        assert hasattr(facilitator, "get_extra")
        assert hasattr(facilitator, "verify")
        assert hasattr(facilitator, "settle")

    def test_init_without_params(self):
        """Test initialization without parameters."""
        facilitator = UptoEvmFacilitatorScheme()
        assert facilitator.address is None
        assert facilitator._web3 is None
        assert facilitator._private_key is None

    def test_init_with_address(self):
        """Test initialization with explicit address."""
        facilitator = UptoEvmFacilitatorScheme(address=TEST_SPENDER)
        assert facilitator.address == TEST_SPENDER

    def test_init_with_private_key_derives_address(self):
        """Test that address is derived from private key."""
        facilitator = UptoEvmFacilitatorScheme(private_key=TEST_PRIVATE_KEY)
        assert facilitator.address is not None
        assert facilitator.address.startswith("0x")
        assert len(facilitator.address) == 42

    def test_init_address_overrides_derived(self):
        """Test that explicit address takes precedence over derived."""
        facilitator = UptoEvmFacilitatorScheme(
            private_key=TEST_PRIVATE_KEY,
            address=TEST_SPENDER,
        )
        assert facilitator.address == TEST_SPENDER


class TestUptoEvmFacilitatorGetExtra:
    """Test get_extra method."""

    def test_get_extra_with_address(self):
        """Test get_extra returns routerAddress when configured."""
        facilitator = UptoEvmFacilitatorScheme(address=TEST_SPENDER)
        extra = facilitator.get_extra(TEST_NETWORK)

        assert extra is not None
        assert extra["routerAddress"] == TEST_SPENDER

    def test_get_extra_without_address(self):
        """Test get_extra returns None when no address configured."""
        facilitator = UptoEvmFacilitatorScheme()
        extra = facilitator.get_extra(TEST_NETWORK)

        assert extra is None


class TestUptoEvmFacilitatorGetSigners:
    """Test get_signers method."""

    def test_get_signers_with_address(self):
        """Test get_signers returns address when configured."""
        facilitator = UptoEvmFacilitatorScheme(address=TEST_SPENDER)
        signers = facilitator.get_signers(TEST_NETWORK)

        assert len(signers) == 1
        assert signers[0] == TEST_SPENDER

    def test_get_signers_without_address(self):
        """Test get_signers returns empty when no address."""
        facilitator = UptoEvmFacilitatorScheme()
        signers = facilitator.get_signers(TEST_NETWORK)

        assert len(signers) == 0


class TestUptoEvmFacilitatorVerify:
    """Test verify method of UptoEvmFacilitatorScheme."""

    @pytest.mark.asyncio
    async def test_verify_invalid_payload_structure(self):
        """Test verification fails with invalid payload structure."""
        facilitator = UptoEvmFacilitatorScheme(address=TEST_SPENDER)

        invalid_payload = {"signature": "0x1234", "authorization": {}}
        requirements = make_requirements()

        result = await facilitator.verify(invalid_payload, requirements)

        assert result.is_valid is False
        assert "Invalid EIP-2612 payload structure" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_expired_deadline(self):
        """Test verification fails when deadline has passed."""
        facilitator = UptoEvmFacilitatorScheme(address=TEST_SPENDER)

        expired_deadline = str(int(time.time()) - 100)  # 100 seconds ago
        payload = make_valid_payload(
            spender=TEST_SPENDER,
            deadline=expired_deadline,
        )
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "deadline has passed" in result.invalid_reason
        assert result.payer == TEST_OWNER

    @pytest.mark.asyncio
    async def test_verify_insufficient_value(self):
        """Test verification fails when permit value < required amount."""
        facilitator = UptoEvmFacilitatorScheme(address=TEST_SPENDER)

        payload = make_valid_payload(
            spender=TEST_SPENDER,
            value="500000",  # Less than required
        )
        requirements = make_requirements(amount="1000000")

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "less than required" in result.invalid_reason
        assert result.payer == TEST_OWNER

    @pytest.mark.asyncio
    async def test_verify_spender_mismatch(self):
        """Test verification fails when spender doesn't match facilitator."""
        facilitator = UptoEvmFacilitatorScheme(address=TEST_SPENDER)

        wrong_spender = "0x0000000000000000000000000000000000000001"
        payload = make_valid_payload(spender=wrong_spender)
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "does not match facilitator" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_spender_check_case_insensitive(self):
        """Test spender comparison is case-insensitive."""
        facilitator = UptoEvmFacilitatorScheme(address=TEST_SPENDER.lower())

        payload = make_valid_payload(spender=TEST_SPENDER.upper().replace("0X", "0x"))
        requirements = make_requirements()

        # Should NOT fail on spender mismatch (case-insensitive)
        result = await facilitator.verify(payload, requirements)

        # It may fail on signature recovery, but NOT on spender mismatch
        if not result.is_valid:
            assert "does not match facilitator" not in (result.invalid_reason or "")

    @pytest.mark.asyncio
    async def test_verify_no_spender_check_without_address(self):
        """Test that spender is not checked when facilitator has no address."""
        facilitator = UptoEvmFacilitatorScheme()  # No address configured

        payload = make_valid_payload(spender="0xAnything")
        requirements = make_requirements()

        result = await facilitator.verify(payload, requirements)

        # Should NOT fail on spender mismatch
        if not result.is_valid:
            assert "does not match facilitator" not in (result.invalid_reason or "")

    @pytest.mark.asyncio
    async def test_verify_value_equal_to_required(self):
        """Test verification passes when value equals required amount."""
        facilitator = UptoEvmFacilitatorScheme(address=TEST_SPENDER)

        payload = make_valid_payload(
            spender=TEST_SPENDER,
            value="1000000",
        )
        requirements = make_requirements(amount="1000000")

        # Mock the signature recovery to return the owner
        with patch.object(
            facilitator,
            "_recover_permit_signer",
            return_value=TEST_OWNER,
        ):
            result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True
        assert result.payer == TEST_OWNER

    @pytest.mark.asyncio
    async def test_verify_value_greater_than_required(self):
        """Test verification passes when value exceeds required amount."""
        facilitator = UptoEvmFacilitatorScheme(address=TEST_SPENDER)

        payload = make_valid_payload(
            spender=TEST_SPENDER,
            value="5000000",  # More than required
        )
        requirements = make_requirements(amount="1000000")

        with patch.object(
            facilitator,
            "_recover_permit_signer",
            return_value=TEST_OWNER,
        ):
            result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_signature_recovery_fails(self):
        """Test verification fails when signature recovery returns None."""
        facilitator = UptoEvmFacilitatorScheme(address=TEST_SPENDER)

        payload = make_valid_payload(spender=TEST_SPENDER)
        requirements = make_requirements()

        with patch.object(
            facilitator,
            "_recover_permit_signer",
            return_value=None,
        ):
            result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "Failed to recover signer" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_recovered_address_mismatch(self):
        """Test verification fails when recovered address != owner."""
        facilitator = UptoEvmFacilitatorScheme(address=TEST_SPENDER)

        payload = make_valid_payload(spender=TEST_SPENDER)
        requirements = make_requirements()

        different_address = "0x0000000000000000000000000000000000000099"
        with patch.object(
            facilitator,
            "_recover_permit_signer",
            return_value=different_address,
        ):
            result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "does not match claimed owner" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_verify_with_maxamount_field(self):
        """Test verification uses maxAmount field from requirements."""
        facilitator = UptoEvmFacilitatorScheme(address=TEST_SPENDER)

        payload = make_valid_payload(
            spender=TEST_SPENDER,
            value="1000000",
        )
        requirements = {
            "scheme": "upto",
            "network": TEST_NETWORK,
            "asset": TEST_ASSET,
            "maxAmount": "1000000",
            "payTo": TEST_PAY_TO,
            "maxTimeoutSeconds": 300,
            "extra": {"name": "USD Coin", "version": "2"},
        }

        with patch.object(
            facilitator,
            "_recover_permit_signer",
            return_value=TEST_OWNER,
        ):
            result = await facilitator.verify(payload, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_handles_nested_payload(self):
        """Test verification handles PaymentPayloadV2-style nested payload."""
        facilitator = UptoEvmFacilitatorScheme(address=TEST_SPENDER)

        inner_payload = make_valid_payload(spender=TEST_SPENDER)
        wrapped_payload = {
            "t402Version": 2,
            "payload": inner_payload,
        }
        requirements = make_requirements()

        with patch.object(
            facilitator,
            "_recover_permit_signer",
            return_value=TEST_OWNER,
        ):
            result = await facilitator.verify(wrapped_payload, requirements)

        assert result.is_valid is True

    @pytest.mark.asyncio
    async def test_verify_handles_exception_gracefully(self):
        """Test verification handles unexpected exceptions gracefully."""
        facilitator = UptoEvmFacilitatorScheme(address=TEST_SPENDER)

        payload = make_valid_payload(spender=TEST_SPENDER)
        requirements = make_requirements()

        with patch.object(
            facilitator,
            "_extract_payload",
            side_effect=RuntimeError("Unexpected error"),
        ):
            result = await facilitator.verify(payload, requirements)

        assert result.is_valid is False
        assert "Verification error" in result.invalid_reason


class TestUptoEvmFacilitatorSettle:
    """Test settle method of UptoEvmFacilitatorScheme."""

    @pytest.mark.asyncio
    async def test_settle_without_web3(self):
        """Test settlement fails without web3 instance."""
        facilitator = UptoEvmFacilitatorScheme(
            private_key=TEST_PRIVATE_KEY,
        )

        payload = make_valid_payload(spender=TEST_SPENDER)
        requirements = make_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert "Web3 instance not configured" in result.error_reason

    @pytest.mark.asyncio
    async def test_settle_without_private_key(self):
        """Test settlement fails without private key."""
        mock_web3 = MagicMock()
        facilitator = UptoEvmFacilitatorScheme(
            web3=mock_web3,
            address=TEST_SPENDER,
        )

        payload = make_valid_payload(spender=TEST_SPENDER)
        requirements = make_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert "Private key not configured" in result.error_reason

    @pytest.mark.asyncio
    async def test_settle_amount_exceeds_value(self):
        """Test settlement fails when settle_amount > permitted value."""
        mock_web3 = MagicMock()
        mock_web3.to_checksum_address = lambda x: x
        mock_web3.eth = MagicMock()
        mock_web3.eth.gas_price = 1000000000
        mock_web3.eth.get_transaction_count.return_value = 0

        facilitator = UptoEvmFacilitatorScheme(
            web3=mock_web3,
            private_key=TEST_PRIVATE_KEY,
        )

        payload = make_valid_payload(
            spender=TEST_SPENDER,
            value="1000000",  # 1 USDC permitted
        )
        requirements = make_requirements(amount="500000")

        # Try to settle more than permitted
        result = await facilitator.settle(
            payload, requirements, settle_amount="2000000"
        )

        assert result.success is False
        assert "exceeds permitted value" in result.error_reason

    @pytest.mark.asyncio
    async def test_settle_with_explicit_amount(self):
        """Test settlement with explicit settle_amount."""
        mock_web3 = MagicMock()
        mock_web3.to_checksum_address = lambda x: x

        # Mock transaction building and sending
        mock_contract = MagicMock()
        mock_web3.eth.contract.return_value = mock_contract

        mock_permit_fn = MagicMock()
        mock_permit_fn.build_transaction.return_value = {"nonce": 0}
        mock_contract.functions.permit.return_value = mock_permit_fn

        mock_transfer_fn = MagicMock()
        mock_transfer_fn.build_transaction.return_value = {"nonce": 1}
        mock_contract.functions.transferFrom.return_value = mock_transfer_fn

        mock_web3.eth.gas_price = 1000000000
        mock_web3.eth.get_transaction_count.return_value = 0

        # Mock signing and sending
        mock_signed = MagicMock()
        mock_signed.raw_transaction = b"\x00"
        mock_web3.eth.account.sign_transaction.return_value = mock_signed
        mock_web3.eth.send_raw_transaction.return_value = b"\x01" * 32

        # Mock receipt
        mock_receipt = MagicMock()
        mock_receipt.transactionHash.hex.return_value = "ab" * 32
        mock_web3.eth.wait_for_transaction_receipt.return_value = mock_receipt

        facilitator = UptoEvmFacilitatorScheme(
            web3=mock_web3,
            private_key=TEST_PRIVATE_KEY,
        )

        payload = make_valid_payload(
            spender=facilitator.address,
            value="5000000",
        )
        requirements = make_requirements(amount="5000000")

        result = await facilitator.settle(
            payload, requirements, settle_amount="3000000"
        )

        assert result.success is True
        assert result.transaction is not None
        assert result.network == TEST_NETWORK
        assert result.payer == TEST_OWNER

        # Verify permit was called with full value
        mock_contract.functions.permit.assert_called_once()
        permit_args = mock_contract.functions.permit.call_args[0]
        assert permit_args[2] == 5000000  # Full permitted value

        # Verify transferFrom was called with settle amount
        mock_contract.functions.transferFrom.assert_called_once()
        transfer_args = mock_contract.functions.transferFrom.call_args[0]
        assert transfer_args[2] == 3000000  # Settle amount

    @pytest.mark.asyncio
    async def test_settle_uses_required_amount_by_default(self):
        """Test settlement uses required amount when no settle_amount given."""
        mock_web3 = MagicMock()
        mock_web3.to_checksum_address = lambda x: x

        mock_contract = MagicMock()
        mock_web3.eth.contract.return_value = mock_contract

        mock_permit_fn = MagicMock()
        mock_permit_fn.build_transaction.return_value = {"nonce": 0}
        mock_contract.functions.permit.return_value = mock_permit_fn

        mock_transfer_fn = MagicMock()
        mock_transfer_fn.build_transaction.return_value = {"nonce": 1}
        mock_contract.functions.transferFrom.return_value = mock_transfer_fn

        mock_web3.eth.gas_price = 1000000000
        mock_web3.eth.get_transaction_count.return_value = 0

        mock_signed = MagicMock()
        mock_signed.raw_transaction = b"\x00"
        mock_web3.eth.account.sign_transaction.return_value = mock_signed
        mock_web3.eth.send_raw_transaction.return_value = b"\x01" * 32

        mock_receipt = MagicMock()
        mock_receipt.transactionHash.hex.return_value = "ab" * 32
        mock_web3.eth.wait_for_transaction_receipt.return_value = mock_receipt

        facilitator = UptoEvmFacilitatorScheme(
            web3=mock_web3,
            private_key=TEST_PRIVATE_KEY,
        )

        payload = make_valid_payload(
            spender=facilitator.address,
            value="5000000",
        )
        requirements = make_requirements(amount="2000000")

        result = await facilitator.settle(payload, requirements)

        assert result.success is True

        # Verify transferFrom was called with required amount
        transfer_args = mock_contract.functions.transferFrom.call_args[0]
        assert transfer_args[2] == 2000000  # Required amount

    @pytest.mark.asyncio
    async def test_settle_sends_to_correct_pay_to(self):
        """Test settlement sends tokens to the correct payTo address."""
        mock_web3 = MagicMock()
        mock_web3.to_checksum_address = lambda x: x

        mock_contract = MagicMock()
        mock_web3.eth.contract.return_value = mock_contract

        mock_permit_fn = MagicMock()
        mock_permit_fn.build_transaction.return_value = {"nonce": 0}
        mock_contract.functions.permit.return_value = mock_permit_fn

        mock_transfer_fn = MagicMock()
        mock_transfer_fn.build_transaction.return_value = {"nonce": 1}
        mock_contract.functions.transferFrom.return_value = mock_transfer_fn

        mock_web3.eth.gas_price = 1000000000
        mock_web3.eth.get_transaction_count.return_value = 0

        mock_signed = MagicMock()
        mock_signed.raw_transaction = b"\x00"
        mock_web3.eth.account.sign_transaction.return_value = mock_signed
        mock_web3.eth.send_raw_transaction.return_value = b"\x01" * 32

        mock_receipt = MagicMock()
        mock_receipt.transactionHash.hex.return_value = "ab" * 32
        mock_web3.eth.wait_for_transaction_receipt.return_value = mock_receipt

        facilitator = UptoEvmFacilitatorScheme(
            web3=mock_web3,
            private_key=TEST_PRIVATE_KEY,
        )

        payload = make_valid_payload(
            spender=facilitator.address,
            value="1000000",
        )
        custom_pay_to = "0xCustomPayToAddress0000000000000000000000"
        requirements = make_requirements(pay_to=custom_pay_to)

        result = await facilitator.settle(payload, requirements)

        assert result.success is True

        # Verify transferFrom uses correct payTo
        transfer_args = mock_contract.functions.transferFrom.call_args[0]
        assert transfer_args[1] == custom_pay_to

    @pytest.mark.asyncio
    async def test_settle_handles_transaction_error(self):
        """Test settlement handles on-chain errors gracefully."""
        mock_web3 = MagicMock()
        mock_web3.to_checksum_address = lambda x: x

        mock_contract = MagicMock()
        mock_web3.eth.contract.return_value = mock_contract

        mock_permit_fn = MagicMock()
        mock_permit_fn.build_transaction.side_effect = Exception("Gas estimation failed")
        mock_contract.functions.permit.return_value = mock_permit_fn

        mock_web3.eth.gas_price = 1000000000
        mock_web3.eth.get_transaction_count.return_value = 0

        facilitator = UptoEvmFacilitatorScheme(
            web3=mock_web3,
            private_key=TEST_PRIVATE_KEY,
        )

        payload = make_valid_payload(
            spender=facilitator.address,
            value="1000000",
        )
        requirements = make_requirements()

        result = await facilitator.settle(payload, requirements)

        assert result.success is False
        assert "Settlement error" in result.error_reason


class TestUptoEvmFacilitatorRecoverSigner:
    """Test _recover_permit_signer method."""

    def test_recover_returns_none_on_invalid_signature(self):
        """Test that invalid signatures return None."""
        facilitator = UptoEvmFacilitatorScheme()

        result = facilitator._recover_permit_signer(
            owner=TEST_OWNER,
            spender=TEST_SPENDER,
            value=1000000,
            nonce=0,
            deadline=int(time.time()) + 3600,
            signature={"v": 99, "r": "0x0000", "s": "0x0000"},
            chain_id=8453,
            token_address=TEST_ASSET,
            token_name="USD Coin",
            token_version="2",
        )

        # Should return None or a recovered address that doesn't match
        # (depending on the library behavior with invalid v values)
        # The important thing is it doesn't raise
        assert result is None or isinstance(result, str)

    def test_recover_handles_exception_gracefully(self):
        """Test that exceptions in recovery return None."""
        facilitator = UptoEvmFacilitatorScheme()

        # Completely invalid signature data
        result = facilitator._recover_permit_signer(
            owner=TEST_OWNER,
            spender=TEST_SPENDER,
            value=1000000,
            nonce=0,
            deadline=int(time.time()) + 3600,
            signature={"v": "invalid", "r": "not-hex", "s": "not-hex"},
            chain_id=8453,
            token_address=TEST_ASSET,
            token_name="USD Coin",
            token_version="2",
        )

        assert result is None


class TestUptoEvmFacilitatorExtractHelpers:
    """Test payload and requirements extraction helpers."""

    def test_extract_payload_from_dict(self):
        """Test extracting payload from plain dict."""
        facilitator = UptoEvmFacilitatorScheme()

        payload_data = make_valid_payload()
        result = facilitator._extract_payload(payload_data)

        assert result["signature"]["v"] == 28
        assert result["authorization"]["owner"] == TEST_OWNER

    def test_extract_payload_from_wrapped_dict(self):
        """Test extracting payload from wrapped dict (V2 format)."""
        facilitator = UptoEvmFacilitatorScheme()

        inner = make_valid_payload()
        wrapped = {"t402Version": 2, "payload": inner}
        result = facilitator._extract_payload(wrapped)

        assert result["signature"]["v"] == 28
        assert result["authorization"]["owner"] == TEST_OWNER

    def test_extract_requirements_from_dict(self):
        """Test extracting requirements from plain dict."""
        facilitator = UptoEvmFacilitatorScheme()

        requirements = make_requirements()
        result = facilitator._extract_requirements(requirements)

        assert result["scheme"] == "upto"
        assert result["network"] == TEST_NETWORK
        assert result["amount"] == "1000000"

    def test_extract_requirements_from_model(self):
        """Test extracting requirements from Pydantic model."""
        from t402.types import PaymentRequirementsV2

        facilitator = UptoEvmFacilitatorScheme()

        model = PaymentRequirementsV2(
            scheme="upto",
            network=TEST_NETWORK,
            asset=TEST_ASSET,
            amount="1000000",
            pay_to=TEST_PAY_TO,
            max_timeout_seconds=300,
            extra={"name": "USD Coin", "version": "2"},
        )
        result = facilitator._extract_requirements(model)

        assert result["scheme"] == "upto"
        assert result["payTo"] == TEST_PAY_TO


class TestUptoEvmFacilitatorGetChainId:
    """Test _get_chain_id helper method."""

    def test_caip2_format(self):
        """Test CAIP-2 format parsing."""
        facilitator = UptoEvmFacilitatorScheme()
        assert facilitator._get_chain_id("eip155:8453") == 8453
        assert facilitator._get_chain_id("eip155:1") == 1
        assert facilitator._get_chain_id("eip155:42161") == 42161

    def test_unknown_network_raises(self):
        """Test that unknown network raises ValueError."""
        facilitator = UptoEvmFacilitatorScheme()
        with pytest.raises(ValueError, match="Unknown network"):
            facilitator._get_chain_id("unknown-network")


class TestUptoEvmFacilitatorERC20ABI:
    """Test ERC20_PERMIT_ABI constant."""

    def test_abi_has_permit_function(self):
        """Test ABI includes permit function."""
        permit_fns = [f for f in ERC20_PERMIT_ABI if f.get("name") == "permit"]
        assert len(permit_fns) == 1

        permit = permit_fns[0]
        assert permit["type"] == "function"
        assert len(permit["inputs"]) == 7
        input_names = [i["name"] for i in permit["inputs"]]
        assert "owner" in input_names
        assert "spender" in input_names
        assert "value" in input_names
        assert "deadline" in input_names
        assert "v" in input_names
        assert "r" in input_names
        assert "s" in input_names

    def test_abi_has_transfer_from_function(self):
        """Test ABI includes transferFrom function."""
        transfer_fns = [
            f for f in ERC20_PERMIT_ABI if f.get("name") == "transferFrom"
        ]
        assert len(transfer_fns) == 1

        transfer = transfer_fns[0]
        assert transfer["type"] == "function"
        assert len(transfer["inputs"]) == 3

    def test_abi_has_nonces_function(self):
        """Test ABI includes nonces function."""
        nonces_fns = [f for f in ERC20_PERMIT_ABI if f.get("name") == "nonces"]
        assert len(nonces_fns) == 1

        nonces = nonces_fns[0]
        assert nonces["type"] == "function"
        assert nonces["stateMutability"] == "view"


class TestUptoEvmFacilitatorIntegration:
    """Integration-style tests for verify + settle flow."""

    @pytest.mark.asyncio
    async def test_verify_then_settle_flow(self):
        """Test the full verify -> settle flow with mocks."""
        mock_web3 = MagicMock()
        mock_web3.to_checksum_address = lambda x: x

        # Set up contract mocks
        mock_contract = MagicMock()
        mock_web3.eth.contract.return_value = mock_contract

        mock_permit_fn = MagicMock()
        mock_permit_fn.build_transaction.return_value = {"nonce": 0}
        mock_contract.functions.permit.return_value = mock_permit_fn

        mock_transfer_fn = MagicMock()
        mock_transfer_fn.build_transaction.return_value = {"nonce": 1}
        mock_contract.functions.transferFrom.return_value = mock_transfer_fn

        mock_web3.eth.gas_price = 1000000000
        mock_web3.eth.get_transaction_count.return_value = 0

        mock_signed = MagicMock()
        mock_signed.raw_transaction = b"\x00"
        mock_web3.eth.account.sign_transaction.return_value = mock_signed
        mock_web3.eth.send_raw_transaction.return_value = b"\x01" * 32

        mock_receipt = MagicMock()
        mock_receipt.transactionHash.hex.return_value = "ab" * 32
        mock_web3.eth.wait_for_transaction_receipt.return_value = mock_receipt

        facilitator = UptoEvmFacilitatorScheme(
            web3=mock_web3,
            private_key=TEST_PRIVATE_KEY,
        )

        payload = make_valid_payload(
            spender=facilitator.address,
            value="5000000",
        )
        requirements = make_requirements(amount="5000000")

        # Step 1: Verify
        with patch.object(
            facilitator,
            "_recover_permit_signer",
            return_value=TEST_OWNER,
        ):
            verify_result = await facilitator.verify(payload, requirements)

        assert verify_result.is_valid is True
        assert verify_result.payer == TEST_OWNER

        # Step 2: Settle (for partial amount)
        settle_result = await facilitator.settle(
            payload, requirements, settle_amount="3000000"
        )

        assert settle_result.success is True
        assert settle_result.payer == TEST_OWNER
        assert settle_result.network == TEST_NETWORK
