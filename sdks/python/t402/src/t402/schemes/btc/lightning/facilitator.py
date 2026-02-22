"""Lightning Network Exact Scheme - Facilitator Implementation.

This module provides the facilitator-side implementation of the exact payment
scheme for Lightning Network payments.

The facilitator:
1. Verifies payments using preimage verification: SHA-256(preimage) === paymentHash.
2. Optionally confirms with the Lightning node via lookup_payment.
3. Settlement is a no-op since Lightning payments are atomic (settle-on-pay).
"""

from __future__ import annotations

import hashlib
import logging
from typing import Any, Dict, List, Optional, Union

from t402.types import (
    PaymentRequirementsV2,
    PaymentPayloadV2,
    VerifyResponse,
    SettleResponse,
    Network,
)
from t402.schemes.btc.constants import (
    SCHEME_EXACT,
    LIGHTNING_CAIP_FAMILY,
    LIGHTNING_NETWORKS,
    is_valid_hex,
)
from t402.schemes.btc.types import FacilitatorLightningSigner


logger = logging.getLogger(__name__)


def _sha256_hex(preimage_hex: str) -> str:
    """Compute SHA-256 hash of a hex-encoded preimage.

    Args:
        preimage_hex: Hex-encoded preimage.

    Returns:
        Hex-encoded SHA-256 hash.
    """
    preimage_bytes = bytes.fromhex(preimage_hex)
    hash_bytes = hashlib.sha256(preimage_bytes).digest()
    return hash_bytes.hex()


class LightningFacilitatorScheme:
    """Facilitator scheme for Lightning Network exact payments.

    Verification is done by checking that SHA-256(preimage) === paymentHash.
    Lightning payments are atomic, so settle is a confirmation-only operation.

    Example:
        ```python
        class MyLightningNode:
            def get_addresses(self) -> List[str]:
                return ["02abc..."]

            async def lookup_payment(self, payment_hash: str) -> Dict[str, Any]:
                return {"settled": True, "amount_sats": "1000"}

        node = MyLightningNode()
        facilitator = LightningFacilitatorScheme(node)

        result = await facilitator.verify(payload, requirements)
        ```
    """

    def __init__(self, signer: FacilitatorLightningSigner) -> None:
        """Initialize the facilitator scheme.

        Args:
            signer: Any object implementing the FacilitatorLightningSigner protocol.
        """
        self._signer = signer

    @property
    def scheme(self) -> str:
        """The scheme identifier."""
        return SCHEME_EXACT

    @property
    def caip_family(self) -> str:
        """CAIP-2 family pattern for network matching."""
        return LIGHTNING_CAIP_FAMILY

    def get_extra(self, network: Network) -> Optional[Dict[str, Any]]:
        """Get mechanism-specific extra data for supported kinds.

        Lightning has no extra data.

        Args:
            network: The network identifier.

        Returns:
            None.
        """
        return None

    def get_signers(self, network: Network) -> List[str]:
        """Get signer addresses (node public keys) for this facilitator.

        Args:
            network: The network identifier.

        Returns:
            List of node public keys (hex-encoded).
        """
        return list(self._signer.get_addresses())

    async def verify(
        self,
        payload: Union[PaymentPayloadV2, Dict[str, Any]],
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> VerifyResponse:
        """Verify a Lightning payment payload.

        Validates:
        1. Payload structure (paymentHash, preimage, bolt11Invoice).
        2. Preimage verification: SHA-256(preimage) === paymentHash.
        3. Payment lookup on the Lightning node.

        Args:
            payload: The payment payload containing preimage and paymentHash.
            requirements: The payment requirements to verify against.

        Returns:
            VerifyResponse indicating validity.
        """
        try:
            payload_data = self._extract_payload(payload)
            req_data = self._extract_requirements(requirements)

            # Validate payload structure
            payment_hash = payload_data.get("paymentHash", "")
            preimage = payload_data.get("preimage", "")
            bolt11_invoice = payload_data.get("bolt11Invoice", "")

            if not payment_hash or not preimage or not bolt11_invoice:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_payload_structure",
                    payer=None,
                )

            # Verify scheme matches
            req_scheme = req_data.get("scheme", "")
            if req_scheme and req_scheme != SCHEME_EXACT:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="unsupported_scheme",
                    payer=None,
                )

            # Verify network is a valid Lightning network
            network = req_data.get("network", "")
            if network and network not in LIGHTNING_NETWORKS:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="unsupported_network",
                    payer=None,
                )

            # Validate preimage format (32 bytes hex)
            if not is_valid_hex(preimage, 32):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_preimage_format",
                    payer=None,
                )

            # Validate payment hash format (32 bytes hex)
            if not is_valid_hex(payment_hash, 32):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_payment_hash_format",
                    payer=None,
                )

            # Core verification: SHA-256(preimage) must equal paymentHash
            try:
                computed_hash = _sha256_hex(preimage)
                if computed_hash != payment_hash.lower():
                    return VerifyResponse(
                        is_valid=False,
                        invalid_reason="preimage_hash_mismatch",
                        payer=None,
                    )
            except Exception:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="preimage_verification_failed",
                    payer=None,
                )

            # Optionally verify with the Lightning node
            try:
                payment = await self._signer.lookup_payment(payment_hash)

                if not payment.get("settled", False):
                    return VerifyResponse(
                        is_valid=False,
                        invalid_reason="payment_not_settled",
                        payer=None,
                    )

                # Verify amount matches if available
                amount_sats = payment.get("amount_sats", "")
                required_amount = req_data.get("amount", "0")
                if amount_sats and int(amount_sats) < int(required_amount):
                    return VerifyResponse(
                        is_valid=False,
                        invalid_reason="insufficient_amount",
                        payer=None,
                    )
            except Exception as e:
                # If we can't verify with the node, the preimage verification
                # is sufficient
                logger.warning(
                    f"Could not verify payment with Lightning node: {e}"
                )

            return VerifyResponse(
                is_valid=True,
                invalid_reason=None,
                payer=None,
            )

        except Exception as e:
            logger.error(f"Lightning verification failed: {e}")
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
        """Settle a Lightning payment.

        Lightning payments are atomic (settle-on-pay), so this is effectively
        a confirmation that the payment was already completed. The actual
        settlement happened when the client paid the invoice.

        Args:
            payload: The verified payment payload.
            requirements: The payment requirements.

        Returns:
            SettleResponse with the payment hash as transaction ID.
        """
        try:
            payload_data = self._extract_payload(payload)
            req_data = self._extract_requirements(requirements)

            network = req_data.get("network", "")
            payment_hash = payload_data.get("paymentHash", "")
            preimage = payload_data.get("preimage", "")

            if not payment_hash or not preimage:
                return SettleResponse(
                    success=False,
                    error_reason="invalid_payload_structure",
                    transaction=None,
                    network=network,
                    payer=None,
                )

            # Verify the payment
            verify_result = await self.verify(payload, requirements)
            if not verify_result.is_valid:
                return SettleResponse(
                    success=False,
                    error_reason=verify_result.invalid_reason or "verification_failed",
                    transaction=None,
                    network=network,
                    payer=None,
                )

            # Lightning is settle-on-pay: the payment hash serves as the
            # transaction ID
            return SettleResponse(
                success=True,
                error_reason=None,
                transaction=payment_hash,
                network=network,
                payer=None,
            )

        except Exception as e:
            logger.error(f"Lightning settlement failed: {e}")
            return SettleResponse(
                success=False,
                error_reason=f"settlement_error: {str(e)}",
                transaction=None,
                network=None,
                payer=None,
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
