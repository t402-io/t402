"""ERC-7710 delegation-based facilitator scheme for EVM payments.

This module provides the facilitator-side implementation of the ERC-7710
delegation payment scheme for EVM networks.

ERC-7710 enables payments from smart contract accounts (ERC-4337, ERC-7579
modular accounts) via delegation. The facilitator:

1. Verifies payments by simulating redeemDelegations via eth_call
2. Settles payments by calling redeemDelegations on the DelegationManager
3. Waits for transaction confirmation via receipt polling

The payment flow:
- A delegator (smart account owner) creates a delegation with permissions
- The client submits the delegationManager address, permissionContext, and
  delegator address as the payment payload
- The facilitator simulates the delegation redemption to verify it will succeed
- On settlement, the facilitator calls redeemDelegations on-chain

The permissionContext is opaque to the facilitator but verifiable by simulation.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Protocol, Union, runtime_checkable

from t402.types import (
    PaymentRequirementsV2,
    PaymentPayloadV2,
    VerifyResponse,
    SettleResponse,
    Network,
)


logger = logging.getLogger(__name__)

# Constants
SCHEME_EXACT = "exact"
CAIP_FAMILY = "eip155:*"

# Default timeout for transaction confirmation (milliseconds)
DEFAULT_CONFIRMATION_TIMEOUT = 60000

# ERC-7579 single call mode: 32 zero bytes
# Mode encoding: 1 byte callType (0x00=single) + 1 byte execType (0x00=default)
# + 4 bytes unused + 22 bytes modePayload
SINGLE_CALL_MODE = b"\x00" * 32

# ERC-20 transfer(address,uint256) selector: keccak256("transfer(address,uint256)")[:4]
ERC20_TRANSFER_SELECTOR = bytes.fromhex("a9059cbb")

# redeemDelegations ABI for the DelegationManager contract
REDEEM_DELEGATIONS_ABI = [
    {
        "inputs": [
            {"name": "_permissionContexts", "type": "bytes[]"},
            {"name": "_modes", "type": "bytes32[]"},
            {"name": "_executionCallDatas", "type": "bytes[]"},
        ],
        "name": "redeemDelegations",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    }
]


@runtime_checkable
class ERC7710EvmFacilitatorSigner(Protocol):
    """Protocol for EVM facilitator signer operations for ERC-7710.

    Implementations should provide contract read (simulation), contract write
    (on-chain execution), and transaction confirmation capabilities.

    Example implementation:
        ```python
        from web3 import Web3

        class MyERC7710Signer:
            def __init__(self, web3: Web3, private_key: str):
                self._web3 = web3
                self._account = web3.eth.account.from_key(private_key)

            def get_addresses(self, network: str) -> List[str]:
                return [self._account.address]

            async def read_contract(
                self,
                address: str,
                abi: list,
                function_name: str,
                *args,
            ) -> Any:
                # Simulate via eth_call
                contract = self._web3.eth.contract(
                    address=address, abi=abi,
                )
                return contract.functions[function_name](*args).call()

            async def write_contract(
                self,
                address: str,
                abi: list,
                function_name: str,
                *args,
            ) -> str:
                # Execute on-chain transaction
                contract = self._web3.eth.contract(
                    address=address, abi=abi,
                )
                tx = contract.functions[function_name](*args).build_transaction(...)
                signed = self._account.sign_transaction(tx)
                tx_hash = self._web3.eth.send_raw_transaction(signed.raw_transaction)
                return tx_hash.hex()

            async def wait_for_transaction_receipt(
                self,
                tx_hash: str,
                timeout_ms: int = 60000,
            ) -> ERC7710TransactionConfirmation:
                receipt = self._web3.eth.wait_for_transaction_receipt(tx_hash)
                return ERC7710TransactionConfirmation(
                    success=receipt.status == 1,
                    tx_hash=tx_hash,
                    block_number=receipt.blockNumber,
                )
        ```
    """

    def get_addresses(self, network: str) -> List[str]:
        """Return all facilitator addresses for the given network.

        Args:
            network: Network identifier (CAIP-2 format, e.g., "eip155:8453")

        Returns:
            List of Ethereum addresses (checksummed or lowercase hex)
        """
        ...

    async def read_contract(
        self,
        address: str,
        abi: list,
        function_name: str,
        *args: Any,
    ) -> Any:
        """Simulate a contract call via eth_call.

        Used for verification by simulating redeemDelegations without
        submitting an on-chain transaction.

        Args:
            address: Contract address to call
            abi: Contract ABI (JSON list)
            function_name: Function name to call
            *args: Function arguments

        Returns:
            Call result (may be None for void functions)

        Raises:
            Exception: If the simulation reverts
        """
        ...

    async def write_contract(
        self,
        address: str,
        abi: list,
        function_name: str,
        *args: Any,
    ) -> str:
        """Execute a contract write transaction on-chain.

        Args:
            address: Contract address to call
            abi: Contract ABI (JSON list)
            function_name: Function name to call
            *args: Function arguments

        Returns:
            Transaction hash as hex string (0x-prefixed)

        Raises:
            Exception: If transaction submission fails
        """
        ...

    async def wait_for_transaction_receipt(
        self,
        tx_hash: str,
        timeout_ms: int = 60000,
    ) -> "ERC7710TransactionConfirmation":
        """Wait for a transaction to be confirmed (mined and successful).

        Polls for the transaction receipt until confirmed or timeout.

        Args:
            tx_hash: Transaction hash to monitor
            timeout_ms: Maximum wait time in milliseconds

        Returns:
            ERC7710TransactionConfirmation with status, block number, and hash
        """
        ...


class ERC7710TransactionConfirmation:
    """Result of waiting for transaction confirmation.

    Attributes:
        success: Whether the transaction was successfully confirmed
        tx_hash: The confirmed transaction hash
        block_number: Block number where the transaction was mined
        error: Error message if confirmation failed
    """

    def __init__(
        self,
        success: bool,
        tx_hash: Optional[str] = None,
        block_number: Optional[int] = None,
        error: Optional[str] = None,
    ):
        self.success = success
        self.tx_hash = tx_hash
        self.block_number = block_number
        self.error = error


def encode_erc7579_execution(
    token_address: str,
    recipient: str,
    amount: int,
) -> bytes:
    """Encode an ERC-20 transfer wrapped in ERC-7579 single execution format.

    Format: target (20 bytes) + value (32 bytes, zero) + calldata
    where calldata = transfer(address,uint256) selector + padded args

    Args:
        token_address: ERC-20 token contract address (0x-prefixed hex)
        recipient: Transfer recipient address (0x-prefixed hex)
        amount: Transfer amount in token's smallest unit

    Returns:
        Encoded bytes in ERC-7579 single execution format

    Raises:
        ValueError: If addresses are invalid or amount is negative
    """
    # Validate and parse token address
    token_bytes = _hex_to_address(token_address)

    # Validate and parse recipient address
    recipient_bytes = _hex_to_address(recipient)

    # Validate amount
    if amount < 0:
        raise ValueError(f"amount must be non-negative, got {amount}")

    # Encode ERC-20 transfer(address,uint256) calldata
    # selector (4 bytes) + address (32 bytes padded) + uint256 (32 bytes)
    transfer_calldata = bytearray(4 + 32 + 32)
    transfer_calldata[0:4] = ERC20_TRANSFER_SELECTOR
    # Left-pad recipient address to 32 bytes (address goes in last 20 bytes)
    transfer_calldata[4 + 12:4 + 32] = recipient_bytes
    # Left-pad amount to 32 bytes
    amount_bytes = amount.to_bytes(32, byteorder="big")
    transfer_calldata[4 + 32:4 + 64] = amount_bytes

    # ERC-7579 single execution encoding:
    # target (20 bytes) + value (32 bytes, zero) + callData
    execution_calldata = bytearray(20 + 32 + len(transfer_calldata))
    execution_calldata[0:20] = token_bytes
    # value = 0 (no ETH sent), 32 zero bytes already present
    execution_calldata[20 + 32:] = transfer_calldata

    return bytes(execution_calldata)


def parse_erc7710_payload(
    payload_data: Dict[str, Any],
) -> Optional[Dict[str, str]]:
    """Parse and validate ERC-7710 payload fields.

    Extracts delegationManager, permissionContext, and delegator from
    the payload data.

    Args:
        payload_data: Raw payload dict

    Returns:
        Dict with delegationManager, permissionContext, and delegator,
        or None if required fields are missing.
    """
    delegation_manager = payload_data.get("delegationManager", "")
    permission_context = payload_data.get("permissionContext", "")
    delegator = payload_data.get("delegator", "")

    if not delegation_manager or not permission_context or not delegator:
        return None

    return {
        "delegationManager": delegation_manager,
        "permissionContext": permission_context,
        "delegator": delegator,
    }


class ERC7710EvmFacilitatorScheme:
    """Facilitator for ERC-7710 smart account delegation payments.

    Verification via simulation (eth_call of redeemDelegations).
    Settlement by calling redeemDelegations on-chain.

    The verification process:
    1. Validates scheme and network
    2. Parses ERC-7710 payload (delegationManager, permissionContext, delegator)
    3. Encodes the intended ERC-20 transfer in ERC-7579 format
    4. Simulates redeemDelegations via eth_call to verify delegation validity

    The settlement process:
    1. Re-verifies the payment via simulation
    2. Calls redeemDelegations on the DelegationManager contract
    3. Waits for transaction confirmation

    Example:
        ```python
        facilitator = ERC7710EvmFacilitatorScheme(signer=my_erc7710_signer)

        # Verify a payment
        result = await facilitator.verify(payload, requirements)
        if result.is_valid:
            # Settle the payment on-chain
            settlement = await facilitator.settle(payload, requirements)
            if settlement.success:
                print(f"Settled: {settlement.transaction}")
        ```
    """

    scheme = SCHEME_EXACT
    caip_family = CAIP_FAMILY

    def __init__(self, signer: ERC7710EvmFacilitatorSigner):
        """Initialize the ERC-7710 facilitator scheme.

        Args:
            signer: ERC-7710 facilitator signer for contract simulation,
                on-chain execution, and transaction confirmation.
        """
        self._signer = signer

    def get_signers(self, network: Network) -> List[str]:
        """Get signer addresses for this facilitator on the given network.

        Args:
            network: The network identifier

        Returns:
            List of facilitator Ethereum addresses
        """
        return self._signer.get_addresses(network)

    async def verify(
        self,
        payload: Union[PaymentPayloadV2, Dict[str, Any]],
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> VerifyResponse:
        """Verify an ERC-7710 delegation payment by simulating redeemDelegations.

        Performs validation of the ERC-7710 delegation payload by simulating the
        redeemDelegations call via eth_call. If the simulation succeeds, the
        delegation is valid and the payment can be settled.

        Args:
            payload: The payment payload containing delegation data
            requirements: The payment requirements to verify against

        Returns:
            VerifyResponse indicating validity and payer (delegator) address
        """
        try:
            # Extract data from payload and requirements
            payload_data = self._extract_payload(payload)
            req_data = self._extract_requirements(requirements)

            network = req_data.get("network", "")
            scheme = req_data.get("scheme", "")

            # Step 1: Validate scheme
            if scheme != SCHEME_EXACT:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="unsupported_scheme",
                    payer=None,
                )

            # Step 2: Validate network (must be eip155:*)
            if not self._is_valid_network(network):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="unsupported_network",
                    payer=None,
                )

            # Step 3: Parse ERC-7710 payload
            erc7710_payload = parse_erc7710_payload(payload_data)
            if erc7710_payload is None:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_erc7710_payload",
                    payer=None,
                )

            delegator = erc7710_payload["delegator"]
            delegation_manager = erc7710_payload["delegationManager"]
            permission_context = erc7710_payload["permissionContext"]

            # Step 4: Encode ERC-20 transfer in ERC-7579 format
            asset = req_data.get("asset", "")
            pay_to = req_data.get("payTo", "")
            amount_str = req_data.get("amount", "0")

            try:
                amount = int(amount_str)
            except (ValueError, TypeError):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_required_amount",
                    payer=delegator,
                )

            try:
                execution_calldata = encode_erc7579_execution(
                    token_address=asset,
                    recipient=pay_to,
                    amount=amount,
                )
            except ValueError as e:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"invalid_transfer_encoding: {str(e)}",
                    payer=delegator,
                )

            # Step 5: Decode permission context from hex
            try:
                permission_context_bytes = _hex_to_bytes(permission_context)
            except ValueError as e:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"invalid_permission_context: {str(e)}",
                    payer=delegator,
                )

            # Step 6: Simulate redeemDelegations via eth_call
            try:
                await self._signer.read_contract(
                    delegation_manager,
                    REDEEM_DELEGATIONS_ABI,
                    "redeemDelegations",
                    [permission_context_bytes],    # bytes[] _permissionContexts
                    [SINGLE_CALL_MODE],            # bytes32[] _modes
                    [execution_calldata],           # bytes[] _executionCallDatas
                )
            except Exception as e:
                logger.error(f"Delegation simulation failed: {e}")
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"delegation_simulation_failed: {str(e)}",
                    payer=delegator,
                )

            # Simulation succeeded — delegation is valid
            return VerifyResponse(
                is_valid=True,
                invalid_reason=None,
                payer=delegator,
            )

        except Exception as e:
            logger.error(f"ERC-7710 verification failed: {e}")
            return VerifyResponse(
                is_valid=False,
                invalid_reason=f"verification_error: {str(e)}",
                payer=None,
            )

    async def settle(
        self,
        payload: Union[PaymentPayloadV2, Dict[str, Any]],
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> SettleResponse:
        """Settle an ERC-7710 delegation payment by calling redeemDelegations.

        Verifies the payment first via simulation, then calls redeemDelegations
        on the DelegationManager contract and waits for transaction confirmation.

        Args:
            payload: The verified payment payload with delegation data
            requirements: The payment requirements

        Returns:
            SettleResponse with transaction hash and status
        """
        req_data = self._extract_requirements(requirements)
        network = req_data.get("network", "")

        # Step 1: Verify the payment first
        verify_result = await self.verify(payload, requirements)

        if not verify_result.is_valid:
            return SettleResponse(
                success=False,
                error_reason=verify_result.invalid_reason,
                transaction=None,
                network=network,
                payer=verify_result.payer,
            )

        # Step 2: Extract payload data for on-chain execution
        try:
            payload_data = self._extract_payload(payload)
            erc7710_payload = parse_erc7710_payload(payload_data)

            if erc7710_payload is None:
                return SettleResponse(
                    success=False,
                    error_reason="invalid_erc7710_payload",
                    transaction=None,
                    network=network,
                    payer=verify_result.payer,
                )

            delegator = erc7710_payload["delegator"]
            delegation_manager = erc7710_payload["delegationManager"]
            permission_context = erc7710_payload["permissionContext"]

        except Exception as e:
            logger.error(f"Payload extraction failed: {e}")
            return SettleResponse(
                success=False,
                error_reason=f"invalid_payload: {str(e)}",
                transaction=None,
                network=network,
                payer=verify_result.payer,
            )

        # Step 3: Encode ERC-20 transfer in ERC-7579 format
        asset = req_data.get("asset", "")
        pay_to = req_data.get("payTo", "")
        amount_str = req_data.get("amount", "0")

        try:
            amount = int(amount_str)
        except (ValueError, TypeError):
            return SettleResponse(
                success=False,
                error_reason="invalid_required_amount",
                transaction=None,
                network=network,
                payer=delegator,
            )

        try:
            execution_calldata = encode_erc7579_execution(
                token_address=asset,
                recipient=pay_to,
                amount=amount,
            )
        except ValueError as e:
            return SettleResponse(
                success=False,
                error_reason=f"invalid_transfer_encoding: {str(e)}",
                transaction=None,
                network=network,
                payer=delegator,
            )

        try:
            permission_context_bytes = _hex_to_bytes(permission_context)
        except ValueError as e:
            return SettleResponse(
                success=False,
                error_reason=f"invalid_permission_context: {str(e)}",
                transaction=None,
                network=network,
                payer=delegator,
            )

        # Step 4: Execute redeemDelegations on-chain
        try:
            tx_hash = await self._signer.write_contract(
                delegation_manager,
                REDEEM_DELEGATIONS_ABI,
                "redeemDelegations",
                [permission_context_bytes],    # bytes[] _permissionContexts
                [SINGLE_CALL_MODE],            # bytes32[] _modes
                [execution_calldata],           # bytes[] _executionCallDatas
            )
        except Exception as e:
            logger.error(f"Delegation execution failed: {e}")
            return SettleResponse(
                success=False,
                error_reason=f"delegation_execution_failed: {str(e)}",
                transaction=None,
                network=network,
                payer=delegator,
            )

        # Step 5: Wait for transaction confirmation
        try:
            confirmation = await self._signer.wait_for_transaction_receipt(
                tx_hash=tx_hash,
                timeout_ms=DEFAULT_CONFIRMATION_TIMEOUT,
            )
        except Exception as e:
            logger.error(f"Transaction confirmation failed: {e}")
            return SettleResponse(
                success=False,
                error_reason=f"confirmation_failed: {str(e)}",
                transaction=tx_hash,
                network=network,
                payer=delegator,
            )

        if not confirmation.success:
            return SettleResponse(
                success=False,
                error_reason=confirmation.error or "transaction_reverted",
                transaction=tx_hash,
                network=network,
                payer=delegator,
            )

        # Use confirmed tx hash if available
        final_tx_hash = confirmation.tx_hash if confirmation.tx_hash else tx_hash

        return SettleResponse(
            success=True,
            error_reason=None,
            transaction=final_tx_hash,
            network=network,
            payer=delegator,
        )

    def _extract_payload(
        self, payload: Union[PaymentPayloadV2, Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Extract payload data as a dict.

        Handles both PaymentPayloadV2 models (where the inner payload is
        in the 'payload' field) and plain dicts.

        Args:
            payload: Payment payload (model or dict)

        Returns:
            Dict containing delegation data
        """
        if hasattr(payload, "model_dump"):
            data = payload.model_dump(by_alias=True)
            return data.get("payload", data)
        elif isinstance(payload, dict):
            return payload.get("payload", payload)
        return dict(payload)

    def _extract_requirements(
        self, requirements: Union[PaymentRequirementsV2, Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Extract requirements data as a dict.

        Args:
            requirements: Payment requirements (model or dict)

        Returns:
            Dict containing requirement fields
        """
        if hasattr(requirements, "model_dump"):
            return requirements.model_dump(by_alias=True)
        return dict(requirements)

    def _is_valid_network(self, network: str) -> bool:
        """Check if the network is a valid EVM network.

        Validates that the network follows the eip155:* CAIP-2 format
        and has a valid numeric chain ID.

        Args:
            network: Network identifier

        Returns:
            True if the network is a valid EVM network
        """
        if not network.startswith("eip155:"):
            return False

        try:
            chain_id_str = network.split(":")[1]
            chain_id = int(chain_id_str)
            return chain_id > 0
        except (IndexError, ValueError):
            return False


def _hex_to_bytes(s: str) -> bytes:
    """Convert a hex string (with or without 0x prefix) to bytes.

    Args:
        s: Hex string, optionally 0x-prefixed

    Returns:
        Decoded bytes

    Raises:
        ValueError: If the string is not valid hex
    """
    s = s.removeprefix("0x")
    return bytes.fromhex(s)


def _hex_to_address(s: str) -> bytes:
    """Convert a hex address string to 20 bytes.

    Args:
        s: Ethereum address as hex string (0x-prefixed)

    Returns:
        20-byte address

    Raises:
        ValueError: If the address is not exactly 20 bytes
    """
    b = _hex_to_bytes(s)
    if len(b) != 20:
        raise ValueError(f"address must be 20 bytes, got {len(b)}")
    return b
