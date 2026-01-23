"""EVM Exact Scheme - Facilitator Implementation.

This module provides the facilitator-side implementation of the exact payment
scheme for EVM networks using EIP-3009 TransferWithAuthorization.

The facilitator:
1. Verifies EIP-3009 signatures off-chain by checking authorization metadata,
   EIP-712 typed data signature recovery, balance, and nonce usage
2. Settles payments by calling transferWithAuthorization on the token contract
3. Waits for transaction confirmation via receipt polling

EIP-3009 TransferWithAuthorization allows gasless token transfers where:
- The token holder signs an off-chain authorization (EIP-712 typed data)
- A facilitator submits the authorization on-chain
- The token contract verifies the signature and executes the transfer
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional, Protocol, Union, runtime_checkable

from t402.types import (
    PaymentRequirementsV2,
    PaymentPayloadV2,
    VerifyResponse,
    SettleResponse,
    Network,
)
from t402.chains import KNOWN_TOKENS


logger = logging.getLogger(__name__)

# Constants
SCHEME_EXACT = "exact"
CAIP_FAMILY = "eip155:*"

# Minimum time buffer (seconds) before validBefore deadline
MIN_VALIDITY_BUFFER = 30

# Default timeout for transaction confirmation (milliseconds)
DEFAULT_CONFIRMATION_TIMEOUT = 60000


@runtime_checkable
class FacilitatorEvmSigner(Protocol):
    """Protocol for EVM facilitator signer operations.

    Implementations should provide address retrieval, EIP-3009 signature
    verification, token transfer execution, transaction confirmation,
    and balance checking capabilities.

    The signer abstracts all blockchain interactions so the facilitator
    scheme logic remains chain-agnostic within EVM.

    Example implementation:
        ```python
        from web3 import Web3

        class MyEvmFacilitatorSigner:
            def __init__(self, web3: Web3, private_key: str, addresses: dict):
                self._web3 = web3
                self._account = web3.eth.account.from_key(private_key)
                self._addresses = addresses

            def get_addresses(self, network: str) -> List[str]:
                return self._addresses.get(network, [self._account.address])

            async def verify_eip3009_signature(
                self,
                from_address: str,
                to_address: str,
                value: str,
                valid_after: str,
                valid_before: str,
                nonce: str,
                signature: str,
                token_address: str,
                chain_id: int,
                token_name: str,
                token_version: str,
            ) -> EvmVerifyResult:
                # Recover signer from EIP-712 typed data signature
                # and compare with from_address
                ...

            async def execute_transfer(
                self,
                from_address: str,
                to_address: str,
                value: str,
                valid_after: str,
                valid_before: str,
                nonce: str,
                signature: str,
                token_address: str,
                network: str,
            ) -> str:
                # Call transferWithAuthorization on token contract
                ...

            async def wait_for_confirmation(
                self,
                tx_hash: str,
                network: str,
                timeout_ms: int = 60000,
            ) -> EvmTransactionConfirmation:
                # Wait for transaction receipt
                ...

            async def get_balance(
                self,
                owner_address: str,
                token_address: str,
                network: str,
            ) -> str:
                # Get ERC-20 token balance
                ...
        ```
    """

    def get_addresses(self, network: str) -> List[str]:
        """Return all facilitator addresses for the given network.

        Enables multi-address support for load balancing and key rotation.

        Args:
            network: Network identifier (CAIP-2 format, e.g., "eip155:8453")

        Returns:
            List of Ethereum addresses (checksummed or lowercase hex)
        """
        ...

    async def verify_eip3009_signature(
        self,
        from_address: str,
        to_address: str,
        value: str,
        valid_after: str,
        valid_before: str,
        nonce: str,
        signature: str,
        token_address: str,
        chain_id: int,
        token_name: str,
        token_version: str,
    ) -> "EvmVerifyResult":
        """Verify an EIP-3009 TransferWithAuthorization signature.

        Reconstructs the EIP-712 typed data hash and recovers the signer
        address from the signature, comparing it with the expected from_address.

        Supports both EOA (ecrecover) and smart wallet (EIP-1271) signatures.

        Args:
            from_address: Expected signer/payer address
            to_address: Recipient address
            value: Transfer amount in token's smallest unit
            valid_after: Unix timestamp after which authorization is valid
            valid_before: Unix timestamp before which authorization is valid
            nonce: 32-byte nonce as hex string (0x-prefixed)
            signature: ECDSA signature as hex string (0x-prefixed, 65 bytes)
            token_address: ERC-20 token contract address
            chain_id: EVM chain ID
            token_name: Token name for EIP-712 domain (e.g., "TetherToken")
            token_version: Token version for EIP-712 domain (e.g., "1")

        Returns:
            EvmVerifyResult indicating validity and recovered address
        """
        ...

    async def execute_transfer(
        self,
        from_address: str,
        to_address: str,
        value: str,
        valid_after: str,
        valid_before: str,
        nonce: str,
        signature: str,
        token_address: str,
        network: str,
    ) -> str:
        """Execute transferWithAuthorization on the token contract.

        Calls the EIP-3009 transferWithAuthorization function with the
        provided authorization parameters and signature.

        Args:
            from_address: Payer address (token holder)
            to_address: Recipient address
            value: Transfer amount in token's smallest unit
            valid_after: Unix timestamp (as string)
            valid_before: Unix timestamp (as string)
            nonce: 32-byte nonce as hex string (0x-prefixed)
            signature: ECDSA signature as hex string (0x-prefixed)
            token_address: ERC-20 token contract address
            network: Network identifier (CAIP-2 format)

        Returns:
            Transaction hash as hex string (0x-prefixed)

        Raises:
            Exception: If transaction submission fails
        """
        ...

    async def wait_for_confirmation(
        self,
        tx_hash: str,
        network: str,
        timeout_ms: int = 60000,
    ) -> "EvmTransactionConfirmation":
        """Wait for a transaction to be confirmed (mined and successful).

        Polls for the transaction receipt until confirmed or timeout.

        Args:
            tx_hash: Transaction hash to monitor
            network: Network identifier
            timeout_ms: Maximum wait time in milliseconds

        Returns:
            EvmTransactionConfirmation with status, block number, and hash
        """
        ...

    async def get_balance(
        self,
        owner_address: str,
        token_address: str,
        network: str,
    ) -> str:
        """Get the ERC-20 token balance for an address.

        Calls balanceOf on the token contract.

        Args:
            owner_address: Address to check balance for
            token_address: ERC-20 token contract address
            network: Network identifier

        Returns:
            Balance in token's smallest unit as string
        """
        ...


class EvmVerifyResult:
    """Result of EIP-3009 signature verification.

    Attributes:
        valid: Whether the signature is valid
        recovered_address: Address recovered from the signature (if successful)
        reason: Reason for failure (if invalid)
    """

    def __init__(
        self,
        valid: bool,
        recovered_address: Optional[str] = None,
        reason: Optional[str] = None,
    ):
        self.valid = valid
        self.recovered_address = recovered_address
        self.reason = reason


class EvmTransactionConfirmation:
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


class ExactEvmFacilitatorScheme:
    """Facilitator scheme for EVM exact payments using EIP-3009.

    Verifies EIP-3009 TransferWithAuthorization signatures and settles
    payments by calling transferWithAuthorization on the token contract.

    The verification process checks:
    1. Scheme and network validity
    2. Payload structure (signature + authorization fields)
    3. EIP-3009 signature recovery against from_address
    4. Deadline validity (validBefore with 30-second buffer)
    5. Valid-after constraint (validAfter <= current time)
    6. Token balance sufficiency
    7. Amount >= required amount
    8. Recipient matches payTo
    9. Token address matches required asset

    The settlement process:
    1. Re-verifies the payment
    2. Calls transferWithAuthorization on the token contract
    3. Waits for transaction confirmation

    Example:
        ```python
        facilitator = ExactEvmFacilitatorScheme(signer=my_evm_signer)

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

    def __init__(self, signer: FacilitatorEvmSigner):
        """Initialize the EVM facilitator scheme.

        Args:
            signer: EVM facilitator signer for signature verification,
                balance checking, and transaction execution.
        """
        self._signer = signer

    def get_extra(self, network: Network) -> Optional[Dict[str, Any]]:
        """Get mechanism-specific extra data for supported kinds.

        Returns asset metadata (default asset address, name, version, decimals)
        for the specified EVM network.

        Args:
            network: The network identifier (e.g., "eip155:8453")

        Returns:
            Dict with asset metadata if network is supported, else None
        """
        chain_id_str = self._get_chain_id_str(network)
        if chain_id_str is None:
            return None

        tokens = KNOWN_TOKENS.get(chain_id_str)
        if not tokens or len(tokens) == 0:
            return None

        token = tokens[0]
        return {
            "defaultAsset": token["address"],
            "name": token["name"],
            "version": token["version"],
            "decimals": token["decimals"],
        }

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
        """Verify an EVM EIP-3009 payment payload.

        Performs comprehensive validation of the EIP-3009 authorization
        including signature recovery, balance checks, and constraint validation.

        Args:
            payload: The payment payload containing signature and authorization
            requirements: The payment requirements to verify against

        Returns:
            VerifyResponse indicating validity and payer address
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

            # Step 3: Parse EIP-3009 payload
            eip3009_payload = self._parse_eip3009_payload(payload_data)
            if eip3009_payload is None:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_payload",
                    payer=None,
                )

            authorization = eip3009_payload["authorization"]
            signature = eip3009_payload["signature"]
            payer = authorization["from"]

            # Step 4: Get chain ID and token info
            chain_id = self._get_chain_id(network)
            if chain_id is None:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="unsupported_network",
                    payer=payer,
                )

            asset = req_data.get("asset", "")
            token_name, token_version = self._get_token_info(network, asset)

            # Step 5: Verify EIP-3009 signature
            try:
                verify_result = await self._signer.verify_eip3009_signature(
                    from_address=payer,
                    to_address=authorization["to"],
                    value=authorization["value"],
                    valid_after=authorization["validAfter"],
                    valid_before=authorization["validBefore"],
                    nonce=authorization["nonce"],
                    signature=signature,
                    token_address=asset,
                    chain_id=chain_id,
                    token_name=token_name,
                    token_version=token_version,
                )
            except Exception as e:
                logger.error(f"Signature verification error: {e}")
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"signature_verification_error: {str(e)}",
                    payer=payer,
                )

            if not verify_result.valid:
                reason = verify_result.reason or "invalid_signature"
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"invalid_signature: {reason}",
                    payer=payer,
                )

            # Step 6: Check validBefore deadline (with buffer)
            now = int(time.time())
            try:
                valid_before = int(authorization["validBefore"])
            except (ValueError, TypeError):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_valid_before",
                    payer=payer,
                )

            if valid_before < now + MIN_VALIDITY_BUFFER:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="authorization_expired",
                    payer=payer,
                )

            # Step 7: Check validAfter constraint
            try:
                valid_after = int(authorization["validAfter"])
            except (ValueError, TypeError):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_valid_after",
                    payer=payer,
                )

            if valid_after > now:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="authorization_not_yet_valid",
                    payer=payer,
                )

            # Step 8: Verify token balance
            try:
                balance_str = await self._signer.get_balance(
                    owner_address=payer,
                    token_address=asset,
                    network=network,
                )
                balance = int(balance_str)
            except (ValueError, TypeError) as e:
                logger.error(f"Balance check failed: {e}")
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="balance_check_failed",
                    payer=payer,
                )

            required_amount_str = req_data.get("amount", "0")
            try:
                required_amount = int(required_amount_str)
            except (ValueError, TypeError):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_required_amount",
                    payer=payer,
                )

            if balance < required_amount:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="insufficient_balance",
                    payer=payer,
                )

            # Step 9: Verify amount sufficiency
            try:
                payload_value = int(authorization["value"])
            except (ValueError, TypeError):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_payload_amount",
                    payer=payer,
                )

            if payload_value < required_amount:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="insufficient_amount",
                    payer=payer,
                )

            # Step 10: Verify recipient matches payTo
            pay_to = req_data.get("payTo", "")
            auth_to = authorization.get("to", "")
            if not self._addresses_equal(auth_to, pay_to):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="recipient_mismatch",
                    payer=payer,
                )

            # All checks passed
            return VerifyResponse(
                is_valid=True,
                invalid_reason=None,
                payer=payer,
            )

        except Exception as e:
            logger.error(f"EVM verification failed: {e}")
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
        """Settle an EVM EIP-3009 payment on-chain.

        Verifies the payment first, then calls transferWithAuthorization
        on the token contract and waits for transaction confirmation.

        Args:
            payload: The verified payment payload with signature and authorization
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
            eip3009_payload = self._parse_eip3009_payload(payload_data)

            if eip3009_payload is None:
                return SettleResponse(
                    success=False,
                    error_reason="invalid_payload",
                    transaction=None,
                    network=network,
                    payer=verify_result.payer,
                )

            authorization = eip3009_payload["authorization"]
            signature = eip3009_payload["signature"]
            payer = authorization["from"]

        except Exception as e:
            logger.error(f"Payload extraction failed: {e}")
            return SettleResponse(
                success=False,
                error_reason=f"invalid_payload: {str(e)}",
                transaction=None,
                network=network,
                payer=verify_result.payer,
            )

        # Step 3: Execute transferWithAuthorization on-chain
        asset = req_data.get("asset", "")
        try:
            tx_hash = await self._signer.execute_transfer(
                from_address=payer,
                to_address=authorization["to"],
                value=authorization["value"],
                valid_after=authorization["validAfter"],
                valid_before=authorization["validBefore"],
                nonce=authorization["nonce"],
                signature=signature,
                token_address=asset,
                network=network,
            )
        except Exception as e:
            logger.error(f"Transaction execution failed: {e}")
            return SettleResponse(
                success=False,
                error_reason=f"transaction_failed: {str(e)}",
                transaction=None,
                network=network,
                payer=payer,
            )

        # Step 4: Wait for transaction confirmation
        try:
            confirmation = await self._signer.wait_for_confirmation(
                tx_hash=tx_hash,
                network=network,
                timeout_ms=DEFAULT_CONFIRMATION_TIMEOUT,
            )
        except Exception as e:
            logger.error(f"Transaction confirmation failed: {e}")
            return SettleResponse(
                success=False,
                error_reason=f"confirmation_failed: {str(e)}",
                transaction=tx_hash,
                network=network,
                payer=payer,
            )

        if not confirmation.success:
            return SettleResponse(
                success=False,
                error_reason=confirmation.error or "transaction_reverted",
                transaction=tx_hash,
                network=network,
                payer=payer,
            )

        # Use confirmed tx hash if available (should match)
        final_tx_hash = confirmation.tx_hash if confirmation.tx_hash else tx_hash

        return SettleResponse(
            success=True,
            error_reason=None,
            transaction=final_tx_hash,
            network=network,
            payer=payer,
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
            Dict containing signature and authorization data
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

    def _parse_eip3009_payload(
        self, payload_data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Parse and validate EIP-3009 payload fields.

        Extracts signature and authorization from the payload data,
        normalizing field names for internal use.

        The EIP-3009 authorization contains:
        - from: payer address
        - to: recipient address
        - value: amount in token units
        - validAfter: earliest validity timestamp
        - validBefore: latest validity timestamp
        - nonce: random 32-byte nonce (hex)

        Args:
            payload_data: Raw payload dict

        Returns:
            Normalized dict with signature and authorization fields,
            or None if required fields are missing.
        """
        signature = payload_data.get("signature", "")
        if not signature:
            return None

        auth_data = payload_data.get("authorization")
        if not auth_data:
            return None

        # Extract and normalize authorization fields
        from_addr = auth_data.get("from", "")
        to_addr = auth_data.get("to", "")
        value = auth_data.get("value", "0")
        valid_after = auth_data.get("validAfter", auth_data.get("valid_after", "0"))
        valid_before = auth_data.get("validBefore", auth_data.get("valid_before", "0"))
        nonce = auth_data.get("nonce", "")

        if not from_addr:
            return None

        if not signature:
            return None

        return {
            "signature": signature,
            "authorization": {
                "from": from_addr,
                "to": to_addr,
                "value": str(value),
                "validAfter": str(valid_after),
                "validBefore": str(valid_before),
                "nonce": str(nonce),
            },
        }

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

    def _get_chain_id(self, network: str) -> Optional[int]:
        """Get the chain ID from a network identifier.

        Args:
            network: Network identifier (CAIP-2 format, e.g., "eip155:8453")

        Returns:
            Chain ID as integer, or None if invalid
        """
        if not network.startswith("eip155:"):
            return None

        try:
            return int(network.split(":")[1])
        except (IndexError, ValueError):
            return None

    def _get_chain_id_str(self, network: str) -> Optional[str]:
        """Get the chain ID as string for KNOWN_TOKENS lookup.

        Args:
            network: Network identifier (CAIP-2 format)

        Returns:
            Chain ID as string, or None if invalid
        """
        chain_id = self._get_chain_id(network)
        if chain_id is None:
            return None
        return str(chain_id)

    def _get_token_info(self, network: str, asset: str) -> tuple:
        """Get token name and version for EIP-712 domain.

        Looks up the token in KNOWN_TOKENS by chain ID and address.
        Falls back to defaults if not found.

        Args:
            network: Network identifier
            asset: Token contract address

        Returns:
            Tuple of (token_name, token_version)
        """
        chain_id_str = self._get_chain_id_str(network)
        if chain_id_str and chain_id_str in KNOWN_TOKENS:
            for token in KNOWN_TOKENS[chain_id_str]:
                if self._addresses_equal(token["address"], asset):
                    return token["name"], token["version"]

        # Default fallback
        return "TetherToken", "1"

    def _addresses_equal(self, addr1: str, addr2: str) -> bool:
        """Compare two Ethereum addresses case-insensitively.

        Ethereum addresses are hex-encoded and should be compared
        case-insensitively (checksummed vs. lowercase).

        Args:
            addr1: First address
            addr2: Second address

        Returns:
            True if addresses are equal (case-insensitive)
        """
        if not addr1 or not addr2:
            return False
        return addr1.lower() == addr2.lower()
