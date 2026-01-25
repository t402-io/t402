"""Aptos Exact-Direct Scheme - Facilitator Implementation.

This module provides the facilitator-side implementation of the exact-direct
payment scheme for Aptos.

The facilitator:
1. Verifies that the transaction hash in the payload corresponds to a successful
   FA transfer on the Aptos network.
2. Validates that sender, recipient, amount, and asset match the requirements.
3. For settlement, the transfer is already complete (client executed it directly).
"""

from __future__ import annotations

import time
import logging
import threading
from typing import Any, Dict, List, Optional, Union

from t402.types import (
    PaymentRequirementsV2,
    PaymentPayloadV2,
    VerifyResponse,
    SettleResponse,
    Network,
)
from t402.schemes.aptos.constants import (
    SCHEME_EXACT_DIRECT,
    CAIP_FAMILY,
    get_network_config,
    is_valid_tx_hash,
    compare_addresses,
)
from t402.schemes.aptos.types import (
    FacilitatorAptosSigner,
    ExactDirectPayload,
    extract_transfer_details,
)


logger = logging.getLogger(__name__)

# Default configuration values
DEFAULT_MAX_TRANSACTION_AGE = 3600  # 1 hour in seconds
DEFAULT_USED_TX_CACHE_DURATION = 86400  # 24 hours in seconds


class ExactDirectAptosFacilitatorScheme:
    """Facilitator scheme for Aptos exact-direct payments.

    Verifies FA transfer transactions on-chain and confirms that the payment
    details (sender, recipient, amount, asset) match the requirements.

    For exact-direct, settlement is a no-op since the client already executed
    the transfer. The facilitator simply verifies and returns the transaction hash.

    Example:
        ```python
        facilitator = ExactDirectAptosFacilitatorScheme(
            signer=my_aptos_querier,
            max_transaction_age=3600,
        )

        # Verify a payment
        result = await facilitator.verify(payload, requirements)
        if result.is_valid:
            print(f"Payment verified from {result.payer}")

        # Settle (returns existing tx hash since transfer is complete)
        settlement = await facilitator.settle(payload, requirements)
        print(f"Tx: {settlement.transaction}")
        ```

    Attributes:
        scheme: The scheme identifier ("exact-direct").
        caip_family: The CAIP-2 family pattern ("aptos:*").
    """

    scheme = SCHEME_EXACT_DIRECT
    caip_family = CAIP_FAMILY

    def __init__(
        self,
        signer: FacilitatorAptosSigner,
        max_transaction_age: int = DEFAULT_MAX_TRANSACTION_AGE,
        used_tx_cache_duration: int = DEFAULT_USED_TX_CACHE_DURATION,
    ) -> None:
        """Initialize the Aptos exact-direct facilitator scheme.

        Args:
            signer: An implementation of FacilitatorAptosSigner for querying
                transactions from the Aptos network.
            max_transaction_age: Maximum age of a transaction to accept, in seconds.
                Default: 3600 (1 hour).
            used_tx_cache_duration: How long to cache used transaction hashes
                for replay protection, in seconds. Default: 86400 (24 hours).
        """
        self._signer = signer
        self._max_transaction_age = max_transaction_age
        self._used_tx_cache_duration = used_tx_cache_duration

        # Used transaction cache for replay protection
        self._used_txs: Dict[str, float] = {}
        self._used_txs_lock = threading.Lock()

    def get_extra(self, network: Network) -> Optional[Dict[str, Any]]:
        """Get mechanism-specific extra data for supported kinds.

        Returns the default token symbol and decimals for the network,
        which clients use when building payment requirements.

        Args:
            network: The CAIP-2 network identifier.

        Returns:
            Dict with assetSymbol and assetDecimals, or None if network
            is not supported.
        """
        config = get_network_config(str(network))
        if not config:
            return None
        return {
            "assetSymbol": config.default_token.symbol,
            "assetDecimals": config.default_token.decimals,
        }

    def get_signers(self, network: Network) -> List[str]:
        """Get signer addresses for this facilitator.

        Args:
            network: The CAIP-2 network identifier.

        Returns:
            List of facilitator addresses for the given network.
        """
        return self._signer.get_addresses(str(network))

    async def verify(
        self,
        payload: Union[PaymentPayloadV2, Dict[str, Any]],
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> VerifyResponse:
        """Verify a payment payload by checking the on-chain transaction.

        Validates:
        1. Payload has the correct structure with a valid transaction hash.
        2. Transaction exists on-chain and was successful.
        3. Transaction is not too old.
        4. Transaction has not been used before (replay protection).
        5. Recipient matches the payTo in requirements.
        6. Amount is greater than or equal to the required amount.

        Args:
            payload: The payment payload containing the transaction hash.
            requirements: The payment requirements to verify against.

        Returns:
            VerifyResponse indicating validity and payer address.
        """
        try:
            # Extract payload and requirements data
            payload_data = self._extract_payload(payload)
            req_data = self._extract_requirements(requirements)

            network = req_data.get("network", "")

            # Parse the exact-direct payload
            aptos_payload = ExactDirectPayload.from_dict(payload_data)

            # Validate transaction hash format
            if not is_valid_tx_hash(aptos_payload.tx_hash):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="Invalid transaction hash format",
                    payer=None,
                )

            # Validate from address
            if not aptos_payload.from_address:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="Missing 'from' address in payload",
                    payer=None,
                )

            # Check for replay attack
            if self._is_tx_used(aptos_payload.tx_hash):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="Transaction has already been used",
                    payer=aptos_payload.from_address,
                )

            # Query the transaction from on-chain
            try:
                tx = await self._signer.get_transaction(
                    aptos_payload.tx_hash, network
                )
            except Exception as e:
                logger.error(f"Failed to query transaction: {e}")
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"Transaction not found: {str(e)}",
                    payer=aptos_payload.from_address,
                )

            # Verify transaction succeeded
            if not tx.get("success"):
                vm_status = tx.get("vm_status", "unknown")
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"Transaction failed: vm_status={vm_status}",
                    payer=aptos_payload.from_address,
                )

            # Check transaction age
            if self._max_transaction_age > 0:
                timestamp_str = tx.get("timestamp", "")
                if timestamp_str:
                    try:
                        # Aptos timestamps are in microseconds
                        tx_timestamp_sec = int(timestamp_str) / 1_000_000
                        age = time.time() - tx_timestamp_sec
                        if age > self._max_transaction_age:
                            return VerifyResponse(
                                is_valid=False,
                                invalid_reason=(
                                    f"Transaction too old: {int(age)} seconds "
                                    f"(max {self._max_transaction_age})"
                                ),
                                payer=aptos_payload.from_address,
                            )
                    except (ValueError, TypeError):
                        pass  # Skip age check if timestamp parsing fails

            # Extract transfer details from transaction
            transfer = extract_transfer_details(tx)
            if not transfer:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="Could not extract transfer details from transaction",
                    payer=aptos_payload.from_address,
                )

            # Verify recipient matches payTo
            pay_to = req_data.get("payTo", "")
            if not compare_addresses(transfer["to"], pay_to):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=(
                        f"Recipient mismatch: expected {pay_to}, "
                        f"got {transfer['to']}"
                    ),
                    payer=aptos_payload.from_address,
                )

            # Verify amount
            try:
                tx_amount = int(transfer["amount"])
            except (ValueError, TypeError):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"Invalid transaction amount: {transfer['amount']}",
                    payer=aptos_payload.from_address,
                )

            required_amount_str = req_data.get("amount", "0")
            try:
                required_amount = int(required_amount_str)
            except (ValueError, TypeError):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"Invalid required amount: {required_amount_str}",
                    payer=aptos_payload.from_address,
                )

            if tx_amount < required_amount:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=(
                        f"Insufficient amount: got {tx_amount}, "
                        f"required {required_amount}"
                    ),
                    payer=aptos_payload.from_address,
                )

            # Mark transaction as used
            self._mark_tx_used(aptos_payload.tx_hash)

            return VerifyResponse(
                is_valid=True,
                invalid_reason=None,
                payer=aptos_payload.from_address,
            )

        except Exception as e:
            logger.error(f"Aptos exact-direct verification failed: {e}")
            return VerifyResponse(
                is_valid=False,
                invalid_reason=f"Verification error: {str(e)}",
                payer=None,
            )

    async def settle(
        self,
        payload: Union[PaymentPayloadV2, Dict[str, Any]],
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> SettleResponse:
        """Settle a verified payment.

        For exact-direct, the transfer is already complete since the client
        executed it directly on-chain. Settlement simply verifies the transaction
        and returns the existing transaction hash.

        Args:
            payload: The verified payment payload.
            requirements: The payment requirements.

        Returns:
            SettleResponse with the transaction hash and status.
        """
        req_data = self._extract_requirements(requirements)
        network = req_data.get("network", "")

        # Verify first
        verify_result = await self.verify(payload, requirements)

        if not verify_result.is_valid:
            return SettleResponse(
                success=False,
                error_reason=verify_result.invalid_reason or "Verification failed",
                transaction=None,
                network=network,
                payer=verify_result.payer,
            )

        # Extract tx hash from payload
        payload_data = self._extract_payload(payload)
        aptos_payload = ExactDirectPayload.from_dict(payload_data)

        # For exact-direct, settlement is already complete
        return SettleResponse(
            success=True,
            error_reason=None,
            transaction=aptos_payload.tx_hash,
            network=network,
            payer=verify_result.payer,
        )

    def cleanup_used_txs(self) -> int:
        """Clean up expired entries from the used transaction cache.

        Removes entries older than ``used_tx_cache_duration``.

        Returns:
            Number of entries removed.
        """
        cutoff = time.time() - self._used_tx_cache_duration
        removed = 0
        with self._used_txs_lock:
            expired = [
                tx_hash
                for tx_hash, used_at in self._used_txs.items()
                if used_at < cutoff
            ]
            for tx_hash in expired:
                del self._used_txs[tx_hash]
                removed += 1
        return removed

    def _is_tx_used(self, tx_hash: str) -> bool:
        """Check if a transaction has been used.

        Args:
            tx_hash: Transaction hash to check.

        Returns:
            True if the transaction has been seen before.
        """
        with self._used_txs_lock:
            return tx_hash in self._used_txs

    def _mark_tx_used(self, tx_hash: str) -> None:
        """Mark a transaction as used.

        Args:
            tx_hash: Transaction hash to mark.
        """
        with self._used_txs_lock:
            self._used_txs[tx_hash] = time.time()

    def _extract_payload(
        self, payload: Union[PaymentPayloadV2, Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Extract payload data as a dict.

        Handles both PaymentPayloadV2 models and plain dicts. For models,
        extracts the inner 'payload' field.

        Args:
            payload: Payment payload (model or dict).

        Returns:
            Dict containing the inner payload data.
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
            requirements: Payment requirements (model or dict).

        Returns:
            Dict containing requirement fields.
        """
        if hasattr(requirements, "model_dump"):
            return requirements.model_dump(by_alias=True)
        return dict(requirements)
