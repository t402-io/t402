"""EVM Exact-Legacy Scheme - Facilitator Implementation.

This module provides the facilitator-side implementation of the exact-legacy payment
scheme for EVM networks using the approve + transferFrom pattern.

This scheme is for legacy USDT and other tokens without EIP-3009 support.

.. deprecated:: 2.3.0
    The exact-legacy scheme is deprecated in favor of using USDT0 with the "exact" scheme.
    USDT0 supports EIP-3009 for gasless transfers on 19+ chains via LayerZero.

    See server.py docstring for full deprecation details and migration guide.

The facilitator:
1. Verifies LegacyTransferAuthorization signatures off-chain
2. Checks that the user has approved the facilitator to spend their tokens
3. Settles payments by calling transferFrom on the token contract
4. Waits for transaction confirmation
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
SCHEME_EXACT_LEGACY = "exact-legacy"
CAIP_FAMILY = "eip155:*"

# Minimum time buffer (seconds) before validBefore deadline
MIN_VALIDITY_BUFFER = 30

# Default timeout for transaction confirmation (milliseconds)
DEFAULT_CONFIRMATION_TIMEOUT = 60000


@runtime_checkable
class FacilitatorLegacyEvmSigner(Protocol):
    """Protocol for EVM legacy facilitator signer operations.

    Implementations should provide address retrieval, legacy authorization
    signature verification, allowance checking, transferFrom execution,
    transaction confirmation, and balance checking capabilities.
    """

    def get_addresses(self, network: str) -> List[str]:
        """Return all facilitator addresses for the given network.

        Args:
            network: Network identifier (CAIP-2 format, e.g., "eip155:1")

        Returns:
            List of Ethereum addresses (checksummed or lowercase hex)
        """
        ...

    async def verify_legacy_authorization(
        self,
        from_address: str,
        to_address: str,
        value: str,
        valid_after: str,
        valid_before: str,
        nonce: str,
        spender: str,
        signature: str,
        token_address: str,
        chain_id: int,
        token_name: str,
        token_version: str,
    ) -> "LegacyVerifyResult":
        """Verify a LegacyTransferAuthorization signature.

        Reconstructs the EIP-712 typed data hash and recovers the signer
        address from the signature, comparing it with the expected from_address.

        Args:
            from_address: Expected signer/payer address
            to_address: Recipient address
            value: Transfer amount in token's smallest unit
            valid_after: Unix timestamp after which authorization is valid
            valid_before: Unix timestamp before which authorization is valid
            nonce: 32-byte nonce as hex string (0x-prefixed)
            spender: Authorized spender address (facilitator)
            signature: ECDSA signature as hex string (0x-prefixed, 65 bytes)
            token_address: ERC-20 token contract address
            chain_id: EVM chain ID
            token_name: Token name for EIP-712 domain
            token_version: Token version for EIP-712 domain

        Returns:
            LegacyVerifyResult indicating validity and recovered address
        """
        ...

    async def get_allowance(
        self,
        owner_address: str,
        spender_address: str,
        token_address: str,
        network: str,
    ) -> str:
        """Get the ERC-20 allowance for a spender.

        Args:
            owner_address: Token owner address
            spender_address: Spender address (facilitator)
            token_address: ERC-20 token contract address
            network: Network identifier

        Returns:
            Allowance amount as string
        """
        ...

    async def execute_transfer_from(
        self,
        from_address: str,
        to_address: str,
        value: str,
        token_address: str,
        network: str,
    ) -> str:
        """Execute transferFrom on the token contract.

        Calls the ERC-20 transferFrom function to transfer tokens
        from the payer to the recipient.

        Args:
            from_address: Payer address (token holder who approved)
            to_address: Recipient address
            value: Transfer amount in token's smallest unit
            token_address: ERC-20 token contract address
            network: Network identifier (CAIP-2 format)

        Returns:
            Transaction hash as hex string (0x-prefixed)
        """
        ...

    async def wait_for_confirmation(
        self,
        tx_hash: str,
        network: str,
        timeout_ms: int = 60000,
    ) -> "LegacyTransactionConfirmation":
        """Wait for a transaction to be confirmed (mined and successful).

        Args:
            tx_hash: Transaction hash to monitor
            network: Network identifier
            timeout_ms: Maximum wait time in milliseconds

        Returns:
            LegacyTransactionConfirmation with status and details
        """
        ...

    async def get_balance(
        self,
        owner_address: str,
        token_address: str,
        network: str,
    ) -> str:
        """Get the ERC-20 token balance for an address.

        Args:
            owner_address: Address to check balance for
            token_address: ERC-20 token contract address
            network: Network identifier

        Returns:
            Balance in token's smallest unit as string
        """
        ...


class LegacyVerifyResult:
    """Result of legacy authorization signature verification.

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


class LegacyTransactionConfirmation:
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


class ExactLegacyEvmFacilitatorScheme:
    """Facilitator scheme for EVM exact-legacy payments.

    Verifies LegacyTransferAuthorization signatures and settles payments
    by calling transferFrom on the token contract.

    The verification process checks:
    1. Scheme and network validity
    2. Payload structure (signature + authorization fields)
    3. LegacyTransferAuthorization signature recovery
    4. Deadline validity (validBefore with 30-second buffer)
    5. Valid-after constraint
    6. Spender matches facilitator address
    7. Token allowance sufficiency
    8. Token balance sufficiency
    9. Amount >= required amount
    10. Recipient matches payTo

    Example:
        ```python
        facilitator = ExactLegacyEvmFacilitatorScheme(signer=my_legacy_signer)

        # Verify a payment
        result = await facilitator.verify(payload, requirements)
        if result.is_valid:
            # Settle the payment on-chain
            settlement = await facilitator.settle(payload, requirements)
            if settlement.success:
                print(f"Settled: {settlement.transaction}")
        ```
    """

    scheme = SCHEME_EXACT_LEGACY
    caip_family = CAIP_FAMILY

    def __init__(self, signer: FacilitatorLegacyEvmSigner):
        """Initialize the EVM legacy facilitator scheme.

        Args:
            signer: EVM legacy facilitator signer for signature verification,
                allowance/balance checking, and transaction execution.
        """
        self._signer = signer

    def get_extra(self, network: Network) -> Optional[Dict[str, Any]]:
        """Get mechanism-specific extra data for supported kinds.

        Returns asset metadata and spender address for the specified network.

        Args:
            network: The network identifier (e.g., "eip155:1")

        Returns:
            Dict with asset metadata and spender address if supported, else None
        """
        chain_id_str = self._get_chain_id_str(network)
        if chain_id_str is None:
            return None

        tokens = KNOWN_TOKENS.get(chain_id_str)
        if not tokens or len(tokens) == 0:
            return None

        token = tokens[0]
        signers = self._signer.get_addresses(network)
        spender = signers[0] if signers else ""

        return {
            "defaultAsset": token["address"],
            "name": token.get("name", "T402LegacyTransfer"),
            "version": token.get("version", "1"),
            "decimals": token["decimals"],
            "spender": spender,
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
        """Verify an EVM legacy authorization payment payload.

        Performs comprehensive validation including signature recovery,
        allowance checks, balance checks, and constraint validation.

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
            if scheme != SCHEME_EXACT_LEGACY:
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

            # Step 3: Parse legacy payload
            legacy_payload = self._parse_legacy_payload(payload_data)
            if legacy_payload is None:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_payload",
                    payer=None,
                )

            authorization = legacy_payload["authorization"]
            signature = legacy_payload["signature"]
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
            extra = req_data.get("extra", {})
            token_name = extra.get("name", "T402LegacyTransfer")
            token_version = extra.get("version", "1")

            # Step 5: Verify spender is a facilitator address
            spender = authorization.get("spender", "")
            facilitator_addresses = self._signer.get_addresses(network)
            if not any(self._addresses_equal(spender, addr) for addr in facilitator_addresses):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_spender",
                    payer=payer,
                )

            # Step 6: Verify legacy authorization signature
            try:
                verify_result = await self._signer.verify_legacy_authorization(
                    from_address=payer,
                    to_address=authorization["to"],
                    value=authorization["value"],
                    valid_after=authorization["validAfter"],
                    valid_before=authorization["validBefore"],
                    nonce=authorization["nonce"],
                    spender=spender,
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

            # Step 7: Check validBefore deadline (with buffer)
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

            # Step 8: Check validAfter constraint
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

            # Step 9: Check allowance
            required_amount_str = req_data.get("amount", "0")
            try:
                required_amount = int(required_amount_str)
            except (ValueError, TypeError):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_required_amount",
                    payer=payer,
                )

            try:
                allowance_str = await self._signer.get_allowance(
                    owner_address=payer,
                    spender_address=spender,
                    token_address=asset,
                    network=network,
                )
                allowance = int(allowance_str)
            except (ValueError, TypeError) as e:
                logger.error(f"Allowance check failed: {e}")
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="allowance_check_failed",
                    payer=payer,
                )

            if allowance < required_amount:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="insufficient_allowance",
                    payer=payer,
                )

            # Step 10: Verify token balance
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

            if balance < required_amount:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="insufficient_balance",
                    payer=payer,
                )

            # Step 11: Verify amount sufficiency
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

            # Step 12: Verify recipient matches payTo
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
            logger.error(f"EVM legacy verification failed: {e}")
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
        """Settle an EVM legacy payment on-chain.

        Verifies the payment first, then calls transferFrom on the token
        contract and waits for transaction confirmation.

        Args:
            payload: The verified payment payload
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
            legacy_payload = self._parse_legacy_payload(payload_data)

            if legacy_payload is None:
                return SettleResponse(
                    success=False,
                    error_reason="invalid_payload",
                    transaction=None,
                    network=network,
                    payer=verify_result.payer,
                )

            authorization = legacy_payload["authorization"]
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

        # Step 3: Execute transferFrom on-chain
        asset = req_data.get("asset", "")
        try:
            tx_hash = await self._signer.execute_transfer_from(
                from_address=payer,
                to_address=authorization["to"],
                value=authorization["value"],
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
        """Extract payload data as a dict."""
        if hasattr(payload, "model_dump"):
            data = payload.model_dump(by_alias=True)
            return data.get("payload", data)
        elif isinstance(payload, dict):
            return payload.get("payload", payload)
        return dict(payload)

    def _extract_requirements(
        self, requirements: Union[PaymentRequirementsV2, Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Extract requirements data as a dict."""
        if hasattr(requirements, "model_dump"):
            return requirements.model_dump(by_alias=True)
        return dict(requirements)

    def _parse_legacy_payload(
        self, payload_data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Parse and validate legacy payload fields.

        The LegacyTransferAuthorization contains:
        - from: payer address
        - to: recipient address
        - value: amount in token units
        - validAfter: earliest validity timestamp
        - validBefore: latest validity timestamp
        - nonce: random 32-byte nonce (hex)
        - spender: authorized spender address
        """
        signature = payload_data.get("signature", "")
        if not signature:
            return None

        auth_data = payload_data.get("authorization")
        if not auth_data:
            return None

        from_addr = auth_data.get("from", "")
        to_addr = auth_data.get("to", "")
        value = auth_data.get("value", "0")
        valid_after = auth_data.get("validAfter", auth_data.get("valid_after", "0"))
        valid_before = auth_data.get("validBefore", auth_data.get("valid_before", "0"))
        nonce = auth_data.get("nonce", "")
        spender = auth_data.get("spender", "")

        if not from_addr or not spender:
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
                "spender": spender,
            },
        }

    def _is_valid_network(self, network: str) -> bool:
        """Check if the network is a valid EVM network."""
        if not network.startswith("eip155:"):
            return False

        try:
            chain_id_str = network.split(":")[1]
            chain_id = int(chain_id_str)
            return chain_id > 0
        except (IndexError, ValueError):
            return False

    def _get_chain_id(self, network: str) -> Optional[int]:
        """Get the chain ID from a network identifier."""
        if not network.startswith("eip155:"):
            return None

        try:
            return int(network.split(":")[1])
        except (IndexError, ValueError):
            return None

    def _get_chain_id_str(self, network: str) -> Optional[str]:
        """Get the chain ID as string for KNOWN_TOKENS lookup."""
        chain_id = self._get_chain_id(network)
        if chain_id is None:
            return None
        return str(chain_id)

    def _addresses_equal(self, addr1: str, addr2: str) -> bool:
        """Compare two Ethereum addresses case-insensitively."""
        if not addr1 or not addr2:
            return False
        return addr1.lower() == addr2.lower()
