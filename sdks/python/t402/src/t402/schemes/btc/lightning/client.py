"""Lightning Network Exact Scheme - Client Implementation.

This module provides the client-side implementation of the exact payment
scheme for Lightning Network payments.

The client:
1. Extracts the BOLT11 invoice from requirements.extra.bolt11Invoice.
2. Pays the invoice using the Lightning signer.
3. Returns the preimage and payment hash as proof of payment.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Union

from t402.types import PaymentRequirementsV2
from t402.schemes.btc.constants import (
    SCHEME_EXACT,
    LIGHTNING_CAIP_FAMILY,
    validate_bolt11_invoice,
)
from t402.schemes.btc.types import ClientLightningSigner, LightningPayload


logger = logging.getLogger(__name__)


class LightningClientScheme:
    """Client scheme for Lightning Network exact payments.

    Pays BOLT11 invoices using a Lightning node and returns the
    payment preimage as proof of payment.

    Note: The scheme is 'exact' because Lightning payments are always
    for the exact invoice amount.

    Example:
        ```python
        class MyLightningNode:
            def get_node_pub_key(self) -> str:
                return "02abc..."

            async def pay_invoice(self, bolt11: str) -> Dict[str, str]:
                return {"preimage": "...", "payment_hash": "..."}

        signer = MyLightningNode()
        scheme = LightningClientScheme(signer)

        payload = await scheme.create_payment_payload(2, requirements)
        ```
    """

    def __init__(self, signer: ClientLightningSigner) -> None:
        """Initialize with a Lightning signer.

        Args:
            signer: Any object implementing the ClientLightningSigner protocol.
        """
        self._signer = signer

    @property
    def scheme(self) -> str:
        """The scheme identifier."""
        return SCHEME_EXACT

    @property
    def caip_family(self) -> str:
        """The CAIP-2 family pattern for Lightning networks."""
        return LIGHTNING_CAIP_FAMILY

    async def create_payment_payload(
        self,
        t402_version: int,
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Create a payment payload by paying a BOLT11 invoice.

        1. Extracts the BOLT11 invoice from requirements.extra.bolt11Invoice.
        2. Pays the invoice using the Lightning signer.
        3. Returns the preimage and payment hash as proof of payment.

        Args:
            t402_version: The T402 protocol version.
            requirements: Payment requirements with extra.bolt11Invoice.

        Returns:
            Dict with t402Version and payload containing paymentHash, preimage, bolt11Invoice.

        Raises:
            ValueError: If BOLT11 invoice is missing or invalid.
        """
        # Extract requirements as dict
        if hasattr(requirements, "model_dump"):
            req = requirements.model_dump(by_alias=True)
        else:
            req = dict(requirements)

        extra = req.get("extra", {}) or {}
        bolt11_invoice = extra.get("bolt11Invoice", "")

        if not bolt11_invoice:
            raise ValueError(
                "BOLT11 invoice is required in requirements.extra.bolt11Invoice"
            )

        # Validate invoice format
        if not validate_bolt11_invoice(bolt11_invoice):
            raise ValueError(
                f"Invalid BOLT11 invoice format: {bolt11_invoice[:20]}..."
            )

        # Pay the invoice
        result = await self._signer.pay_invoice(bolt11_invoice)
        preimage = result.get("preimage", "")
        payment_hash = result.get("payment_hash", "")

        # Create payload with proof of payment
        payload = LightningPayload(
            payment_hash=payment_hash,
            preimage=preimage,
            bolt11_invoice=bolt11_invoice,
        )

        return {
            "t402Version": t402_version,
            "payload": payload.to_map(),
        }
