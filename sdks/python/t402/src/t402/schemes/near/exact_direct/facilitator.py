"""NEAR Exact-Direct Scheme - Facilitator Implementation.

This module provides the facilitator-side implementation of the exact-direct
payment scheme for NEAR networks.

The facilitator:
1. Verifies the on-chain transaction by querying the NEAR RPC.
2. Confirms the transaction was a successful ft_transfer with correct parameters.
3. Marks the transaction as settled (already executed in exact-direct).

Replay protection is built-in via an in-memory cache of used transaction hashes.
"""

from __future__ import annotations

import logging
import threading
import time
from typing import Any, Dict, List, Optional, Union

from t402.types import (
    PaymentRequirementsV2,
    PaymentPayloadV2,
    VerifyResponse,
    SettleResponse,
    Network,
)
from t402.schemes.near.constants import (
    SCHEME_EXACT_DIRECT,
    CAIP_FAMILY,
    get_network_config,
)
from t402.schemes.near.types import (
    FacilitatorNearSigner,
    ExactDirectPayload,
    parse_transaction_result,
)


logger = logging.getLogger(__name__)


class ExactDirectNearFacilitatorConfig:
    """Configuration for the ExactDirectNearFacilitatorScheme.

    Attributes:
        max_transaction_age_seconds: Maximum age (in seconds) of a transaction to accept.
            Default: 300 (5 minutes).
        used_tx_cache_duration_seconds: How long (in seconds) to cache used transaction
            hashes for replay protection. Default: 86400 (24 hours).
    """

    def __init__(
        self,
        max_transaction_age_seconds: int = 300,
        used_tx_cache_duration_seconds: int = 86400,
    ) -> None:
        self.max_transaction_age_seconds = max_transaction_age_seconds
        self.used_tx_cache_duration_seconds = used_tx_cache_duration_seconds


class ExactDirectNearFacilitatorScheme:
    """Facilitator scheme for NEAR exact-direct payments.

    Verifies that an on-chain ft_transfer transaction was executed correctly
    and marks it as settled. Since the client already executed the transfer,
    settlement simply confirms the transaction is valid.

    Features:
    - Replay protection via used transaction hash cache.
    - Validates transaction status, recipient, token contract, and amount.

    Example:
        ```python
        class MyNearRPC:
            def get_addresses(self, network: str) -> List[str]:
                return ["facilitator.near"]

            async def query_transaction(
                self, tx_hash, sender_id, network
            ) -> Dict:
                # Query NEAR RPC
                ...

        rpc = MyNearRPC()
        facilitator = ExactDirectNearFacilitatorScheme(rpc)

        result = await facilitator.verify(payload, requirements)
        if result.is_valid:
            settlement = await facilitator.settle(payload, requirements)
        ```
    """

    def __init__(
        self,
        signer: FacilitatorNearSigner,
        config: Optional[ExactDirectNearFacilitatorConfig] = None,
    ) -> None:
        """Initialize the facilitator scheme.

        Args:
            signer: Any object implementing the FacilitatorNearSigner protocol.
            config: Optional configuration. If not provided, defaults are used.
        """
        self._signer = signer
        self._config = config or ExactDirectNearFacilitatorConfig()

        # Used transaction cache for replay protection
        self._used_txs: Dict[str, float] = {}
        self._used_txs_lock = threading.Lock()

        # Start cleanup thread
        self._cleanup_thread = threading.Thread(
            target=self._cleanup_used_txs,
            daemon=True,
            name="near-facilitator-cleanup",
        )
        self._cleanup_thread.start()

    @property
    def scheme(self) -> str:
        """The scheme identifier."""
        return SCHEME_EXACT_DIRECT

    @property
    def caip_family(self) -> str:
        """CAIP-2 family pattern for network matching."""
        return CAIP_FAMILY

    def get_extra(self, network: Network) -> Optional[Dict[str, Any]]:
        """Get mechanism-specific extra data for supported kinds.

        Returns the default token symbol and decimals for the network.

        Args:
            network: The network identifier.

        Returns:
            Dict with assetSymbol and assetDecimals, or None if network unknown.
        """
        config = get_network_config(network)
        if not config:
            return None

        return {
            "assetSymbol": config.default_token.symbol,
            "assetDecimals": config.default_token.decimals,
        }

    def get_signers(self, network: Network) -> List[str]:
        """Get signer addresses for this facilitator.

        Args:
            network: The network identifier.

        Returns:
            List of NEAR account IDs.
        """
        return self._signer.get_addresses(network)

    async def verify(
        self,
        payload: Union[PaymentPayloadV2, Dict[str, Any]],
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> VerifyResponse:
        """Verify a payment payload by checking the on-chain transaction.

        Validates:
        1. Payload has correct structure with txHash and from fields.
        2. Transaction has not been used before (replay protection).
        3. Transaction was successful on-chain.
        4. Transaction was sent to the correct token contract.
        5. The ft_transfer action has the correct recipient.
        6. The transfer amount is >= the required amount.

        Args:
            payload: The payment payload containing txHash and from.
            requirements: The payment requirements to verify against.

        Returns:
            VerifyResponse indicating validity and payer address.
        """
        try:
            payload_data = self._extract_payload(payload)
            req_data = self._extract_requirements(requirements)

            network = req_data.get("network", "")

            # Parse the NEAR payload
            near_payload = ExactDirectPayload.from_map(payload_data)

            # Validate required fields
            if not near_payload.tx_hash:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="Missing transaction hash in payload",
                    payer=None,
                )

            if not near_payload.from_account:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="Missing sender (from) in payload",
                    payer=None,
                )

            # Check for replay attack
            if self._is_tx_used(near_payload.tx_hash):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="Transaction has already been used",
                    payer=near_payload.from_account,
                )

            # Query the transaction from the NEAR RPC
            try:
                tx_result = await self._signer.query_transaction(
                    tx_hash=near_payload.tx_hash,
                    sender_id=near_payload.from_account,
                    network=network,
                )
            except Exception as e:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"Transaction not found: {e}",
                    payer=near_payload.from_account,
                )

            # Parse the transaction result
            try:
                parsed = parse_transaction_result(tx_result)
            except ValueError as e:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"Failed to parse transaction: {e}",
                    payer=near_payload.from_account,
                )

            # Verify transaction succeeded
            status = parsed["status"]
            if not status.is_success():
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="Transaction failed on-chain",
                    payer=near_payload.from_account,
                )

            # Verify the transaction was to the token contract
            tx_receiver = parsed["transaction"]["receiver_id"]
            required_asset = req_data.get("asset", "")
            if tx_receiver != required_asset:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=(
                        f"Wrong token contract: expected {required_asset}, "
                        f"got {tx_receiver}"
                    ),
                    payer=near_payload.from_account,
                )

            # Find and verify ft_transfer action
            ft_transfer_args = parsed["ft_transfer_args"]
            if ft_transfer_args is None:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="No ft_transfer action found in transaction",
                    payer=near_payload.from_account,
                )

            # Verify recipient
            required_pay_to = req_data.get("payTo") or req_data.get("pay_to", "")
            if ft_transfer_args.receiver_id != required_pay_to:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=(
                        f"Wrong recipient: expected {required_pay_to}, "
                        f"got {ft_transfer_args.receiver_id}"
                    ),
                    payer=near_payload.from_account,
                )

            # Verify amount
            try:
                tx_amount = int(ft_transfer_args.amount)
            except (ValueError, TypeError):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"Invalid transaction amount: {ft_transfer_args.amount}",
                    payer=near_payload.from_account,
                )

            required_amount_str = req_data.get("amount", "0")
            try:
                required_amount = int(required_amount_str)
            except (ValueError, TypeError):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"Invalid required amount: {required_amount_str}",
                    payer=near_payload.from_account,
                )

            if tx_amount < required_amount:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=(
                        f"Insufficient amount: expected {required_amount}, "
                        f"got {tx_amount}"
                    ),
                    payer=near_payload.from_account,
                )

            # Mark transaction as used
            self._mark_tx_used(near_payload.tx_hash)

            return VerifyResponse(
                is_valid=True,
                invalid_reason=None,
                payer=near_payload.from_account,
            )

        except Exception as e:
            logger.error(f"NEAR verification failed: {e}")
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

        For exact-direct, the transfer was already executed by the client,
        so settlement simply verifies the transaction and returns the tx hash.

        Args:
            payload: The verified payment payload.
            requirements: The payment requirements.

        Returns:
            SettleResponse with the transaction hash and status.
        """
        try:
            payload_data = self._extract_payload(payload)
            req_data = self._extract_requirements(requirements)

            network = req_data.get("network", "")
            near_payload = ExactDirectPayload.from_map(payload_data)

            # Verify the transaction first
            verify_result = await self.verify(payload, requirements)

            if not verify_result.is_valid:
                return SettleResponse(
                    success=False,
                    error_reason=verify_result.invalid_reason,
                    transaction=None,
                    network=network,
                    payer=verify_result.payer,
                )

            # For exact-direct, settlement is already complete
            return SettleResponse(
                success=True,
                error_reason=None,
                transaction=near_payload.tx_hash,
                network=network,
                payer=verify_result.payer,
            )

        except Exception as e:
            logger.error(f"NEAR settlement failed: {e}")
            return SettleResponse(
                success=False,
                error_reason=f"Settlement error: {str(e)}",
                transaction=None,
                network=None,
                payer=None,
            )

    def _is_tx_used(self, tx_hash: str) -> bool:
        """Check if a transaction has been used (replay protection).

        Args:
            tx_hash: The transaction hash to check.

        Returns:
            True if the transaction has already been used.
        """
        with self._used_txs_lock:
            return tx_hash in self._used_txs

    def _mark_tx_used(self, tx_hash: str) -> None:
        """Mark a transaction as used.

        Args:
            tx_hash: The transaction hash to mark.
        """
        with self._used_txs_lock:
            self._used_txs[tx_hash] = time.time()

    def _cleanup_used_txs(self) -> None:
        """Periodically clean up old used transaction entries.

        Runs in a background daemon thread.
        """
        while True:
            time.sleep(3600)  # Clean up every hour
            cutoff = time.time() - self._config.used_tx_cache_duration_seconds
            with self._used_txs_lock:
                expired = [
                    tx_hash
                    for tx_hash, used_at in self._used_txs.items()
                    if used_at < cutoff
                ]
                for tx_hash in expired:
                    del self._used_txs[tx_hash]

    def _extract_payload(
        self, payload: Union[PaymentPayloadV2, Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Extract payload data as a dict.

        Handles both PaymentPayloadV2 models and plain dicts.

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
