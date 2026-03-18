"""Tests for EVM ERC-7710 Delegation Facilitator Scheme."""

import pytest
from unittest.mock import AsyncMock, MagicMock

from t402.schemes.evm.erc7710.facilitator import (
    ERC7710EvmFacilitatorScheme,
    ERC7710TransactionConfirmation,
    encode_erc7579_execution,
    parse_erc7710_payload,
    SCHEME_EXACT,
    SINGLE_CALL_MODE,
    REDEEM_DELEGATIONS_ABI,
    ERC20_TRANSFER_SELECTOR,
)
from t402.schemes.interfaces import SchemeNetworkFacilitator


# Test constants
TEST_DELEGATOR = "0x857b06519E91e3A54538791bDbb0E22373e36b66"
TEST_DELEGATION_MANAGER = "0xD263E5b654143379F4bAa55c867cF1e0A475c910"
TEST_PERMISSION_CONTEXT = "0xabcdef0123456789"
TEST_TOKEN = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
TEST_RECIPIENT = "0x209693Bc6afc0C5328bA36FaF03C514EF312287C"
TEST_FACILITATOR_ADDRESS = "0xC88f67e776f16DcFBf42e6bDda1B82604448899B"
TEST_NETWORK = "eip155:8453"
TEST_TX_HASH = "0x" + "ef" * 32


def make_mock_signer(
    addresses=None,
    tx_hash=TEST_TX_HASH,
    confirmation_success=True,
    confirmation_tx_hash=None,
    confirmation_block=12345,
    confirmation_error=None,
    simulate_error=None,
    write_error=None,
):
    """Create a mock ERC7710EvmFacilitatorSigner."""
    if addresses is None:
        addresses = [TEST_FACILITATOR_ADDRESS]

    signer = MagicMock()
    signer.get_addresses = MagicMock(return_value=addresses)

    if simulate_error:
        signer.read_contract = AsyncMock(side_effect=simulate_error)
    else:
        signer.read_contract = AsyncMock(return_value=None)

    if write_error:
        signer.write_contract = AsyncMock(side_effect=write_error)
    else:
        signer.write_contract = AsyncMock(return_value=tx_hash)

    confirmation = ERC7710TransactionConfirmation(
        success=confirmation_success,
        tx_hash=confirmation_tx_hash or tx_hash,
        block_number=confirmation_block,
        error=confirmation_error,
    )
    signer.wait_for_transaction_receipt = AsyncMock(return_value=confirmation)

    return signer


def make_erc7710_payload(
    delegator=TEST_DELEGATOR,
    delegation_manager=TEST_DELEGATION_MANAGER,
    permission_context=TEST_PERMISSION_CONTEXT,
):
    """Create a valid ERC-7710 payment payload."""
    return {
        "payload": {
            "delegationManager": delegation_manager,
            "permissionContext": permission_context,
            "delegator": delegator,
        }
    }


def make_requirements(
    network=TEST_NETWORK,
    scheme="exact",
    asset=TEST_TOKEN,
    amount="1000000",
    pay_to=TEST_RECIPIENT,
):
    """Create valid payment requirements."""
    return {
        "network": network,
        "scheme": scheme,
        "asset": asset,
        "amount": amount,
        "payTo": pay_to,
    }


# ---------------------------------------------------------------------------
# Tests for encode_erc7579_execution
# ---------------------------------------------------------------------------


class TestEncodeERC7579Execution:
    """Tests for the ERC-7579 execution encoding helper."""

    def test_basic_encoding(self):
        """Verify encoding matches expected structure: 20B target + 32B value + calldata."""
        result = encode_erc7579_execution(
            token_address=TEST_TOKEN,
            recipient=TEST_RECIPIENT,
            amount=10000,
        )

        # Total length: 20 (target) + 32 (value) + 4 (selector) + 32 (address) + 32 (amount)
        expected_len = 20 + 32 + 68
        assert len(result) == expected_len

        # First 20 bytes: token address
        token_hex = result[0:20].hex()
        assert token_hex == "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"

        # Next 32 bytes: value (zero, no ETH)
        assert result[20:52] == b"\x00" * 32

        # Transfer selector at offset 52
        assert result[52:56] == ERC20_TRANSFER_SELECTOR

        # Recipient address padded to 32 bytes at offset 56
        recipient_padded = result[56:88].hex()
        assert recipient_padded == "000000000000000000000000209693bc6afc0c5328ba36faf03c514ef312287c"

        # Amount at offset 88: 10000 = 0x2710
        amount_int = int.from_bytes(result[88:120], byteorder="big")
        assert amount_int == 10000

    def test_large_amount(self):
        """Verify encoding with a large uint256 amount."""
        # 1 billion USDC (6 decimals) = 1_000_000_000_000_000
        large_amount = 1_000_000_000_000_000
        result = encode_erc7579_execution(
            token_address=TEST_TOKEN,
            recipient=TEST_RECIPIENT,
            amount=large_amount,
        )

        assert len(result) == 120
        amount_int = int.from_bytes(result[88:120], byteorder="big")
        assert amount_int == large_amount

    def test_zero_amount(self):
        """Verify encoding with zero amount."""
        result = encode_erc7579_execution(
            token_address=TEST_TOKEN,
            recipient=TEST_RECIPIENT,
            amount=0,
        )

        assert len(result) == 120
        amount_int = int.from_bytes(result[88:120], byteorder="big")
        assert amount_int == 0

    def test_invalid_token_address(self):
        """Raise ValueError for invalid token address."""
        with pytest.raises(ValueError, match="address must be 20 bytes"):
            encode_erc7579_execution(
                token_address="0xabcd",
                recipient=TEST_RECIPIENT,
                amount=10000,
            )

    def test_invalid_recipient_address(self):
        """Raise ValueError for invalid recipient address."""
        with pytest.raises(ValueError):
            encode_erc7579_execution(
                token_address=TEST_TOKEN,
                recipient="0xinvalid",
                amount=10000,
            )

    def test_negative_amount(self):
        """Raise ValueError for negative amount."""
        with pytest.raises(ValueError, match="non-negative"):
            encode_erc7579_execution(
                token_address=TEST_TOKEN,
                recipient=TEST_RECIPIENT,
                amount=-1,
            )

    def test_max_uint256(self):
        """Verify encoding with maximum uint256 value."""
        max_uint256 = (2**256) - 1
        result = encode_erc7579_execution(
            token_address=TEST_TOKEN,
            recipient=TEST_RECIPIENT,
            amount=max_uint256,
        )

        assert len(result) == 120
        amount_int = int.from_bytes(result[88:120], byteorder="big")
        assert amount_int == max_uint256


# ---------------------------------------------------------------------------
# Tests for parse_erc7710_payload
# ---------------------------------------------------------------------------


class TestParseERC7710Payload:
    """Tests for the ERC-7710 payload parsing helper."""

    def test_valid_payload(self):
        """Parse a complete valid payload."""
        data = {
            "delegationManager": TEST_DELEGATION_MANAGER,
            "permissionContext": TEST_PERMISSION_CONTEXT,
            "delegator": TEST_DELEGATOR,
        }
        result = parse_erc7710_payload(data)
        assert result is not None
        assert result["delegationManager"] == TEST_DELEGATION_MANAGER
        assert result["permissionContext"] == TEST_PERMISSION_CONTEXT
        assert result["delegator"] == TEST_DELEGATOR

    def test_missing_delegation_manager(self):
        """Return None when delegationManager is missing."""
        data = {
            "permissionContext": TEST_PERMISSION_CONTEXT,
            "delegator": TEST_DELEGATOR,
        }
        assert parse_erc7710_payload(data) is None

    def test_missing_permission_context(self):
        """Return None when permissionContext is missing."""
        data = {
            "delegationManager": TEST_DELEGATION_MANAGER,
            "delegator": TEST_DELEGATOR,
        }
        assert parse_erc7710_payload(data) is None

    def test_missing_delegator(self):
        """Return None when delegator is missing."""
        data = {
            "delegationManager": TEST_DELEGATION_MANAGER,
            "permissionContext": TEST_PERMISSION_CONTEXT,
        }
        assert parse_erc7710_payload(data) is None

    def test_empty_fields(self):
        """Return None when fields are empty strings."""
        data = {
            "delegationManager": "",
            "permissionContext": TEST_PERMISSION_CONTEXT,
            "delegator": TEST_DELEGATOR,
        }
        assert parse_erc7710_payload(data) is None

    def test_empty_dict(self):
        """Return None for empty dict."""
        assert parse_erc7710_payload({}) is None


# ---------------------------------------------------------------------------
# Tests for ERC7710EvmFacilitatorScheme
# ---------------------------------------------------------------------------


class TestERC7710EvmFacilitatorScheme:
    """Tests for the ERC-7710 facilitator scheme."""

    def test_scheme_attributes(self):
        """Verify scheme and caip_family class attributes."""
        signer = make_mock_signer()
        scheme = ERC7710EvmFacilitatorScheme(signer)
        assert scheme.scheme == "exact"
        assert scheme.caip_family == "eip155:*"

    def test_get_signers(self):
        """Return signer addresses for a network."""
        signer = make_mock_signer(
            addresses=["0xaddr1", "0xaddr2"],
        )
        scheme = ERC7710EvmFacilitatorScheme(signer)
        result = scheme.get_signers(TEST_NETWORK)
        assert result == ["0xaddr1", "0xaddr2"]

    @pytest.mark.asyncio
    async def test_verify_success(self):
        """Successful verification via simulation."""
        signer = make_mock_signer()
        scheme = ERC7710EvmFacilitatorScheme(signer)

        payload = make_erc7710_payload()
        requirements = make_requirements()

        result = await scheme.verify(payload, requirements)

        assert result.is_valid is True
        assert result.payer == TEST_DELEGATOR
        assert result.invalid_reason is None

        # Verify read_contract was called with correct args
        signer.read_contract.assert_awaited_once()
        call_args = signer.read_contract.call_args
        assert call_args[0][0] == TEST_DELEGATION_MANAGER
        assert call_args[0][1] == REDEEM_DELEGATIONS_ABI
        assert call_args[0][2] == "redeemDelegations"

    @pytest.mark.asyncio
    async def test_verify_unsupported_scheme(self):
        """Reject unsupported scheme."""
        signer = make_mock_signer()
        scheme = ERC7710EvmFacilitatorScheme(signer)

        payload = make_erc7710_payload()
        requirements = make_requirements(scheme="upto")

        result = await scheme.verify(payload, requirements)
        assert result.is_valid is False
        assert result.invalid_reason == "unsupported_scheme"

    @pytest.mark.asyncio
    async def test_verify_unsupported_network(self):
        """Reject non-EVM networks."""
        signer = make_mock_signer()
        scheme = ERC7710EvmFacilitatorScheme(signer)

        payload = make_erc7710_payload()
        requirements = make_requirements(network="solana:mainnet")

        result = await scheme.verify(payload, requirements)
        assert result.is_valid is False
        assert result.invalid_reason == "unsupported_network"

    @pytest.mark.asyncio
    async def test_verify_invalid_payload_missing_fields(self):
        """Reject payload with missing ERC-7710 fields."""
        signer = make_mock_signer()
        scheme = ERC7710EvmFacilitatorScheme(signer)

        payload = {"payload": {"delegationManager": TEST_DELEGATION_MANAGER}}
        requirements = make_requirements()

        result = await scheme.verify(payload, requirements)
        assert result.is_valid is False
        assert result.invalid_reason == "invalid_erc7710_payload"

    @pytest.mark.asyncio
    async def test_verify_simulation_failure(self):
        """Return invalid when simulation reverts."""
        signer = make_mock_signer(
            simulate_error=Exception("execution reverted: InvalidDelegation"),
        )
        scheme = ERC7710EvmFacilitatorScheme(signer)

        payload = make_erc7710_payload()
        requirements = make_requirements()

        result = await scheme.verify(payload, requirements)
        assert result.is_valid is False
        assert "delegation_simulation_failed" in result.invalid_reason
        assert result.payer == TEST_DELEGATOR

    @pytest.mark.asyncio
    async def test_verify_invalid_amount(self):
        """Reject non-numeric amount in requirements."""
        signer = make_mock_signer()
        scheme = ERC7710EvmFacilitatorScheme(signer)

        payload = make_erc7710_payload()
        requirements = make_requirements(amount="not-a-number")

        result = await scheme.verify(payload, requirements)
        assert result.is_valid is False
        assert result.invalid_reason == "invalid_required_amount"

    @pytest.mark.asyncio
    async def test_verify_invalid_permission_context_hex(self):
        """Reject invalid hex in permissionContext."""
        signer = make_mock_signer()
        scheme = ERC7710EvmFacilitatorScheme(signer)

        payload = make_erc7710_payload(permission_context="0xNOTHEX")
        requirements = make_requirements()

        result = await scheme.verify(payload, requirements)
        assert result.is_valid is False
        assert "invalid_permission_context" in result.invalid_reason

    @pytest.mark.asyncio
    async def test_settle_success(self):
        """Successful settlement via redeemDelegations."""
        signer = make_mock_signer()
        scheme = ERC7710EvmFacilitatorScheme(signer)

        payload = make_erc7710_payload()
        requirements = make_requirements()

        result = await scheme.settle(payload, requirements)

        assert result.success is True
        assert result.transaction == TEST_TX_HASH
        assert result.network == TEST_NETWORK
        assert result.payer == TEST_DELEGATOR
        assert result.error_reason is None

        # Verify both read_contract (simulation) and write_contract were called
        signer.read_contract.assert_awaited_once()
        signer.write_contract.assert_awaited_once()
        signer.wait_for_transaction_receipt.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_settle_verify_fails(self):
        """Settlement fails when verification fails."""
        signer = make_mock_signer(
            simulate_error=Exception("simulation reverted"),
        )
        scheme = ERC7710EvmFacilitatorScheme(signer)

        payload = make_erc7710_payload()
        requirements = make_requirements()

        result = await scheme.settle(payload, requirements)

        assert result.success is False
        assert "delegation_simulation_failed" in result.error_reason
        # write_contract should NOT be called
        signer.write_contract.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_settle_write_contract_fails(self):
        """Settlement fails when on-chain execution fails."""
        signer = make_mock_signer(
            write_error=Exception("gas estimation failed"),
        )
        scheme = ERC7710EvmFacilitatorScheme(signer)

        payload = make_erc7710_payload()
        requirements = make_requirements()

        result = await scheme.settle(payload, requirements)

        assert result.success is False
        assert "delegation_execution_failed" in result.error_reason

    @pytest.mark.asyncio
    async def test_settle_transaction_reverted(self):
        """Settlement fails when transaction reverts."""
        signer = make_mock_signer(
            confirmation_success=False,
            confirmation_error="transaction_reverted",
        )
        scheme = ERC7710EvmFacilitatorScheme(signer)

        payload = make_erc7710_payload()
        requirements = make_requirements()

        result = await scheme.settle(payload, requirements)

        assert result.success is False
        assert result.error_reason == "transaction_reverted"
        assert result.transaction == TEST_TX_HASH

    @pytest.mark.asyncio
    async def test_settle_confirmation_timeout(self):
        """Settlement fails when confirmation times out."""
        signer = make_mock_signer()
        signer.wait_for_transaction_receipt = AsyncMock(
            side_effect=Exception("timeout waiting for receipt"),
        )
        scheme = ERC7710EvmFacilitatorScheme(signer)

        payload = make_erc7710_payload()
        requirements = make_requirements()

        result = await scheme.settle(payload, requirements)

        assert result.success is False
        assert "confirmation_failed" in result.error_reason
        assert result.transaction == TEST_TX_HASH


# ---------------------------------------------------------------------------
# Tests for constants
# ---------------------------------------------------------------------------


class TestConstants:
    """Tests for module-level constants."""

    def test_single_call_mode_is_32_zero_bytes(self):
        """ERC-7579 single call mode must be 32 zero bytes."""
        assert len(SINGLE_CALL_MODE) == 32
        assert SINGLE_CALL_MODE == b"\x00" * 32

    def test_erc20_transfer_selector(self):
        """ERC-20 transfer selector must be 0xa9059cbb."""
        assert ERC20_TRANSFER_SELECTOR == bytes.fromhex("a9059cbb")

    def test_redeem_delegations_abi_structure(self):
        """ABI must have correct function name and inputs."""
        assert len(REDEEM_DELEGATIONS_ABI) == 1
        fn = REDEEM_DELEGATIONS_ABI[0]
        assert fn["name"] == "redeemDelegations"
        assert fn["type"] == "function"
        assert len(fn["inputs"]) == 3
        assert fn["inputs"][0]["type"] == "bytes[]"
        assert fn["inputs"][1]["type"] == "bytes32[]"
        assert fn["inputs"][2]["type"] == "bytes[]"

    def test_scheme_exact_value(self):
        """Scheme constant must be 'exact'."""
        assert SCHEME_EXACT == "exact"
