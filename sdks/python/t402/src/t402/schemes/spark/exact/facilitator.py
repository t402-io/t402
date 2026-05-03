"""Spark Exact Scheme - Facilitator Implementation.

This module provides the facilitator-side implementation of the exact payment
scheme for Spark (Bitcoin L2) payments.

Verification:
- SPARK: Lookup transfer_id via SparkSigner, confirm amount/recipient/status
- LIGHTNING: Verify SHA256(preimage) == payment_hash

Settlement:
- Spark transfers have instant finality -- settle is a confirmation no-op.
"""

from __future__ import annotations

import hashlib
import logging
import threading
from typing import Any, Dict, Union

from t402.types import (
    PaymentRequirementsV2,
    PaymentPayloadV2,
    VerifyResponse,
    SettleResponse,
)
from t402.schemes.spark.types import (
    SCHEME_EXACT,
    SPARK_CAIP_FAMILY,
    PAYMENT_TYPE_SPARK,
    PAYMENT_TYPE_LIGHTNING,
    TransferStatus,
    SparkPayload,
    SparkSigner,
)


logger = logging.getLogger(__name__)


class SparkFacilitatorScheme:
    """Facilitator scheme for Spark exact payments.

    Verifies Spark transfers and Lightning preimage proofs.

    Example:
        ```python
        class MySparkNode:
            def get_transfer(self, transfer_id: str) -> TransferInfo:
                return TransferInfo(...)

            def get_address(self) -> str:
                return "spark:server123"

        node = MySparkNode()
        facilitator = SparkFacilitatorScheme(node)

        result = await facilitator.verify(payload, requirements)
        ```
    """

    def __init__(self, signer: SparkSigner) -> None:
        """Initialize the facilitator scheme.

        Args:
            signer: Any object implementing the SparkSigner protocol.
        """
        self._signer = signer
        self._lock = threading.Lock()
        self._verified: set[str] = set()

    @property
    def scheme(self) -> str:
        """The scheme identifier."""
        return SCHEME_EXACT

    @property
    def caip_family(self) -> str:
        """CAIP-2 family pattern for network matching."""
        return SPARK_CAIP_FAMILY

    async def verify(
        self,
        payload: Union[PaymentPayloadV2, Dict[str, Any]],
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> VerifyResponse:
        """Verify a Spark payment payload.

        Routes to spark or lightning verification based on paymentType.

        Args:
            payload: The payment payload containing spark proof.
            requirements: The payment requirements to verify against.

        Returns:
            VerifyResponse indicating validity and payer address.
        """
        try:
            payload_data = self._extract_payload(payload)
            req_data = self._extract_requirements(requirements)

            spark_payload = SparkPayload.from_map(payload_data)

            if spark_payload.payment_type == PAYMENT_TYPE_SPARK:
                return self._verify_spark(spark_payload, req_data)
            elif spark_payload.payment_type == PAYMENT_TYPE_LIGHTNING:
                return self._verify_lightning(spark_payload, req_data)
            else:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"unsupported_payment_type: {spark_payload.payment_type}",
                    payer=None,
                )

        except Exception as e:
            logger.error(f"Spark verification failed: {e}")
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
        """Settle a Spark payment.

        Spark has instant finality, so settlement verifies and confirms.

        Args:
            payload: The verified payment payload.
            requirements: The payment requirements.

        Returns:
            SettleResponse with transaction hash and status.
        """
        try:
            req_data = self._extract_requirements(requirements)
            network = req_data.get("network", "")

            # Verify first
            verify_result = await self.verify(payload, requirements)
            if not verify_result.is_valid:
                return SettleResponse(
                    success=False,
                    error_reason=verify_result.invalid_reason or "verification_failed",
                    transaction=None,
                    network=network,
                    payer=verify_result.payer,
                )

            # Determine transaction ID
            payload_data = self._extract_payload(payload)
            spark_payload = SparkPayload.from_map(payload_data)

            tx_id = spark_payload.transfer_id or spark_payload.payment_hash or ""

            return SettleResponse(
                success=True,
                error_reason=None,
                transaction=tx_id,
                network=network,
                payer=verify_result.payer,
            )

        except Exception as e:
            logger.error(f"Spark settlement failed: {e}")
            return SettleResponse(
                success=False,
                error_reason=f"settlement_error: {str(e)}",
                transaction=None,
                network=None,
                payer=None,
            )

    def _verify_spark(
        self,
        payload: SparkPayload,
        requirements: Dict[str, Any],
    ) -> VerifyResponse:
        """Verify a direct Spark transfer.

        Checks:
        1. Transfer ID present
        2. Replay protection
        3. Transfer exists and is completed
        4. Amount >= required
        5. Receiver matches server address

        Args:
            payload: The Spark payload with transfer_id.
            requirements: The payment requirements dict.

        Returns:
            VerifyResponse indicating validity.
        """
        if not payload.transfer_id:
            return VerifyResponse(
                is_valid=False,
                invalid_reason="missing_transfer_id",
                payer=None,
            )

        # Replay protection
        with self._lock:
            if payload.transfer_id in self._verified:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="replay_detected",
                    payer=None,
                )
            self._verified.add(payload.transfer_id)

        # Lookup transfer
        try:
            transfer = self._signer.get_transfer(payload.transfer_id)
        except Exception:
            return VerifyResponse(
                is_valid=False,
                invalid_reason="transfer_not_found",
                payer=None,
            )

        # Check status
        if transfer.status != TransferStatus.COMPLETED:
            return VerifyResponse(
                is_valid=False,
                invalid_reason="transfer_not_completed",
                payer=None,
            )

        # Check amount (requirements amount is in satoshis)
        required_amount_str = requirements.get("amount", "0")
        try:
            required_amount = int(required_amount_str)
        except (ValueError, TypeError):
            return VerifyResponse(
                is_valid=False,
                invalid_reason="invalid_amount",
                payer=None,
            )

        if transfer.amount < required_amount:
            return VerifyResponse(
                is_valid=False,
                invalid_reason="insufficient_amount",
                payer=None,
            )

        # Check recipient
        server_addr = self._signer.get_address()
        if transfer.receiver.lower() != server_addr.lower():
            return VerifyResponse(
                is_valid=False,
                invalid_reason="wrong_recipient",
                payer=None,
            )

        return VerifyResponse(
            is_valid=True,
            invalid_reason=None,
            payer=transfer.sender,
        )

    def _verify_lightning(
        self,
        payload: SparkPayload,
        requirements: Dict[str, Any],
    ) -> VerifyResponse:
        """Verify a Lightning payment via preimage.

        Checks that SHA-256(preimage) == payment_hash.

        Args:
            payload: The Spark payload with preimage and payment_hash.
            requirements: The payment requirements dict.

        Returns:
            VerifyResponse indicating validity.
        """
        if not payload.preimage or not payload.payment_hash:
            return VerifyResponse(
                is_valid=False,
                invalid_reason="missing_lightning_proof",
                payer=None,
            )

        # Decode preimage (strip optional 0x prefix)
        preimage_hex = payload.preimage
        if preimage_hex.startswith("0x"):
            preimage_hex = preimage_hex[2:]

        try:
            preimage_bytes = bytes.fromhex(preimage_hex)
        except ValueError:
            return VerifyResponse(
                is_valid=False,
                invalid_reason="invalid_preimage",
                payer=None,
            )

        # Compute SHA-256 hash
        computed_hash = hashlib.sha256(preimage_bytes).hexdigest()

        # Compare with expected hash (strip optional 0x prefix)
        expected_hash = payload.payment_hash
        if expected_hash.startswith("0x"):
            expected_hash = expected_hash[2:]

        if computed_hash != expected_hash:
            return VerifyResponse(
                is_valid=False,
                invalid_reason="preimage_mismatch",
                payer=None,
            )

        return VerifyResponse(
            is_valid=True,
            invalid_reason=None,
            payer=f"lightning:{payload.payment_hash[:16]}",
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
