"""Bitcoin & Lightning Network types for the T402 protocol.

This module defines the data types used by the BTC payment schemes,
including PSBT payload types, Lightning payload types, and signer protocols.
"""

from __future__ import annotations

import base64
import json
from typing import Any, Dict, List, Optional, Protocol, runtime_checkable

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel


# =============================================================================
# Signer Protocols
# =============================================================================


@runtime_checkable
class ClientBtcSigner(Protocol):
    """Protocol for Bitcoin client-side signing operations.

    Implementations should handle key management and PSBT signing
    for Bitcoin on-chain transactions.

    Example:
        ```python
        class MyBtcSigner:
            def get_address(self) -> str:
                return "bc1q..."

            def get_public_key(self) -> str:
                return "02abc..."

            async def sign_psbt(self, psbt: str) -> str:
                # Sign the PSBT and return base64-encoded signed PSBT
                return signed_psbt_base64
        ```
    """

    def get_address(self) -> str:
        """Get the signer's Bitcoin address.

        Returns:
            Bitcoin address string (e.g., "bc1q...", "1...", "3...").
        """
        ...

    def get_public_key(self) -> str:
        """Get the signer's public key (hex-encoded).

        Returns:
            Public key as hex string.
        """
        ...

    async def sign_psbt(self, psbt: str) -> str:
        """Sign a PSBT (Partially Signed Bitcoin Transaction).

        Args:
            psbt: Base64-encoded unsigned PSBT.

        Returns:
            Base64-encoded signed PSBT.
        """
        ...


@runtime_checkable
class ClientLightningSigner(Protocol):
    """Protocol for Lightning Network client-side operations.

    Implementations should handle paying BOLT11 invoices
    via a Lightning node (LND, CLN, WebLN, etc.).

    Example:
        ```python
        class MyLightningSigner:
            def get_node_pub_key(self) -> str:
                return "02abc..."

            async def pay_invoice(self, bolt11: str) -> Dict[str, str]:
                return {"preimage": "...", "payment_hash": "..."}
        ```
    """

    def get_node_pub_key(self) -> str:
        """Get the Lightning node's public key.

        Returns:
            Node public key as hex string.
        """
        ...

    async def pay_invoice(self, bolt11: str) -> Dict[str, str]:
        """Pay a BOLT11 Lightning invoice.

        Args:
            bolt11: BOLT11 invoice string.

        Returns:
            Dict with 'preimage' and 'payment_hash' (both hex-encoded).
        """
        ...


@runtime_checkable
class FacilitatorBtcSigner(Protocol):
    """Protocol for Bitcoin facilitator-side operations.

    Implementations should handle PSBT verification and broadcasting
    for the Bitcoin on-chain exact scheme.

    Example:
        ```python
        class MyBtcFacilitator:
            def get_addresses(self) -> List[str]:
                return ["bc1q..."]

            async def verify_psbt(
                self, signed_psbt, expected_pay_to, expected_amount
            ) -> Dict[str, Any]:
                return {"valid": True, "payer": "bc1q..."}

            async def broadcast_psbt(self, signed_psbt: str) -> str:
                return "txid..."

            async def wait_for_confirmation(
                self, tx_id: str, confirmations: int = 1
            ) -> Dict[str, Any]:
                return {"confirmed": True, "tx_id": "...", "confirmations": 1}
        ```
    """

    def get_addresses(self) -> List[str]:
        """Get all addresses this facilitator can use.

        Returns:
            List of Bitcoin addresses.
        """
        ...

    async def verify_psbt(
        self,
        signed_psbt: str,
        expected_pay_to: str,
        expected_amount: str,
    ) -> Dict[str, Any]:
        """Verify a signed PSBT.

        Checks that outputs match expected values and signatures are valid.

        Args:
            signed_psbt: Base64-encoded signed PSBT.
            expected_pay_to: Expected recipient address.
            expected_amount: Expected amount in satoshis.

        Returns:
            Dict with 'valid' (bool), optional 'reason' (str), optional 'payer' (str).
        """
        ...

    async def broadcast_psbt(self, signed_psbt: str) -> str:
        """Finalize and broadcast a signed PSBT.

        Args:
            signed_psbt: Base64-encoded signed PSBT.

        Returns:
            Transaction ID.
        """
        ...

    async def wait_for_confirmation(
        self,
        tx_id: str,
        confirmations: int = 1,
    ) -> Dict[str, Any]:
        """Wait for a transaction to be confirmed.

        Args:
            tx_id: Transaction ID.
            confirmations: Number of confirmations to wait for.

        Returns:
            Dict with 'confirmed' (bool), 'tx_id' (str),
            optional 'block_hash' (str), 'confirmations' (int).
        """
        ...


@runtime_checkable
class FacilitatorLightningSigner(Protocol):
    """Protocol for Lightning facilitator-side operations.

    Implementations should handle payment verification via
    the Lightning node.

    Example:
        ```python
        class MyLightningFacilitator:
            def get_addresses(self) -> List[str]:
                return ["02abc..."]

            async def lookup_payment(self, payment_hash: str) -> Dict[str, Any]:
                return {"settled": True, "amount_sats": "1000"}
        ```
    """

    def get_addresses(self) -> List[str]:
        """Get all node public keys this facilitator manages.

        Returns:
            List of node public keys (hex-encoded).
        """
        ...

    async def lookup_payment(self, payment_hash: str) -> Dict[str, Any]:
        """Look up a payment by its payment hash.

        Args:
            payment_hash: Hex-encoded payment hash.

        Returns:
            Dict with 'settled' (bool), optional 'amount_sats' (str),
            optional 'preimage' (str).
        """
        ...


# =============================================================================
# Payload Types
# =============================================================================


class BtcOnchainPayload(BaseModel):
    """Bitcoin on-chain payment payload for the exact scheme.

    Contains a signed PSBT (Partially Signed Bitcoin Transaction)
    ready for finalization and broadcast.

    Attributes:
        signed_psbt: Base64-encoded signed PSBT.
        tx_id: Optional transaction ID (available after broadcast).
    """

    signed_psbt: str = Field(alias="signedPsbt")
    tx_id: Optional[str] = Field(default=None, alias="txId")

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )

    @field_validator("signed_psbt")
    @classmethod
    def validate_signed_psbt(cls, v: str) -> str:
        """Validate that signed_psbt is a non-empty string."""
        if not v:
            raise ValueError("signed_psbt must not be empty")
        return v

    def to_map(self) -> Dict[str, Any]:
        """Convert the payload to a plain dict.

        Returns:
            Dict with signedPsbt and optionally txId fields.
        """
        m: Dict[str, Any] = {"signedPsbt": self.signed_psbt}
        if self.tx_id:
            m["txId"] = self.tx_id
        return m

    @classmethod
    def from_map(cls, data: Dict[str, Any]) -> BtcOnchainPayload:
        """Create a BtcOnchainPayload from a plain dict.

        Args:
            data: Dict with signedPsbt and optionally txId fields.

        Returns:
            BtcOnchainPayload instance.
        """
        return cls(
            signed_psbt=data.get("signedPsbt", ""),
            tx_id=data.get("txId"),
        )


class LightningPayload(BaseModel):
    """Lightning Network payment payload.

    Contains proof of payment via preimage.

    Attributes:
        payment_hash: SHA-256 payment hash (hex-encoded).
        preimage: Payment preimage (hex-encoded). SHA-256(preimage) === payment_hash.
        bolt11_invoice: BOLT11 invoice string that was paid.
    """

    payment_hash: str = Field(alias="paymentHash")
    preimage: str
    bolt11_invoice: str = Field(alias="bolt11Invoice")

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )

    def to_map(self) -> Dict[str, Any]:
        """Convert the payload to a plain dict.

        Returns:
            Dict with paymentHash, preimage, and bolt11Invoice fields.
        """
        return {
            "paymentHash": self.payment_hash,
            "preimage": self.preimage,
            "bolt11Invoice": self.bolt11_invoice,
        }

    @classmethod
    def from_map(cls, data: Dict[str, Any]) -> LightningPayload:
        """Create a LightningPayload from a plain dict.

        Args:
            data: Dict with paymentHash, preimage, and bolt11Invoice fields.

        Returns:
            LightningPayload instance.
        """
        return cls(
            payment_hash=data.get("paymentHash", ""),
            preimage=data.get("preimage", ""),
            bolt11_invoice=data.get("bolt11Invoice", ""),
        )
