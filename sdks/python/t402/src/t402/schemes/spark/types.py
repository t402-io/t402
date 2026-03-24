"""Spark (Bitcoin L2) types for the T402 protocol.

This module defines the data types used by the Spark payment schemes,
including transfer info, payload types, and signer protocols.

Spark supports two payment types:
- spark: Direct Spark transfer, verified by transfer_id lookup
- lightning: Lightning Network payment routed through Spark,
  verified by SHA256(preimage) == payment_hash
"""

from __future__ import annotations

from enum import IntEnum
from typing import Any, Dict, Optional, Protocol, runtime_checkable

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


# =============================================================================
# Constants
# =============================================================================

# CAIP-2 Network Identifiers
SPARK_MAINNET = "spark:mainnet"
SPARK_TESTNET = "spark:testnet"

# Scheme identifier
SCHEME_EXACT = "exact"

# Payment types
PAYMENT_TYPE_SPARK = "spark"
PAYMENT_TYPE_LIGHTNING = "lightning"

# CAIP family pattern
SPARK_CAIP_FAMILY = "spark:*"

# All supported Spark networks
SPARK_NETWORKS = [SPARK_MAINNET, SPARK_TESTNET]


# =============================================================================
# Transfer Types
# =============================================================================


class TransferStatus(IntEnum):
    """Status of a Spark transfer."""

    PENDING = 0
    COMPLETED = 5
    FAILED = 9


class TransferInfo(BaseModel):
    """Details of a Spark transfer.

    Attributes:
        id: Unique transfer identifier.
        amount: Transfer amount in satoshis.
        sender: Sender's Spark address.
        receiver: Receiver's Spark address.
        status: Current transfer status.
    """

    id: str
    amount: int
    sender: str
    receiver: str
    status: TransferStatus

    model_config = ConfigDict(from_attributes=True)


# =============================================================================
# Payload Types
# =============================================================================


class SparkPayload(BaseModel):
    """Spark payment payload.

    Contains proof of payment via either a Spark transfer ID
    or a Lightning preimage + payment hash.

    Attributes:
        payment_type: Type of payment ("spark" or "lightning").
        transfer_id: Transfer ID (for Spark transfers).
        preimage: Lightning preimage hex (for Lightning payments).
        payment_hash: Lightning payment hash hex (for verification).
    """

    payment_type: str = Field(alias="paymentType")
    transfer_id: Optional[str] = Field(default=None, alias="transferId")
    preimage: Optional[str] = None
    payment_hash: Optional[str] = Field(default=None, alias="paymentHash")

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )

    def to_map(self) -> Dict[str, Any]:
        """Convert the payload to a plain dict.

        Returns:
            Dict with paymentType and optional transferId/preimage/paymentHash.
        """
        m: Dict[str, Any] = {"paymentType": self.payment_type}
        if self.transfer_id:
            m["transferId"] = self.transfer_id
        if self.preimage:
            m["preimage"] = self.preimage
        if self.payment_hash:
            m["paymentHash"] = self.payment_hash
        return m

    @classmethod
    def from_map(cls, data: Dict[str, Any]) -> SparkPayload:
        """Create a SparkPayload from a plain dict.

        Args:
            data: Dict with paymentType and optional fields.

        Returns:
            SparkPayload instance.
        """
        return cls(
            payment_type=data.get("paymentType", ""),
            transfer_id=data.get("transferId"),
            preimage=data.get("preimage"),
            payment_hash=data.get("paymentHash"),
        )


# =============================================================================
# Extra Requirements
# =============================================================================


class SparkRequirementsExtra(BaseModel):
    """Spark-specific extra fields for payment requirements.

    Attributes:
        spark_address: Server's Spark address.
        lightning_invoice: Optional BOLT11 Lightning invoice.
        payment_id: Unique payment ID for correlation.
    """

    spark_address: str = Field(alias="sparkAddress")
    lightning_invoice: Optional[str] = Field(default=None, alias="lightningInvoice")
    payment_id: str = Field(alias="paymentId")

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


# =============================================================================
# Signer Protocols
# =============================================================================


@runtime_checkable
class SparkSigner(Protocol):
    """Protocol for Spark facilitator-side operations.

    Implementations should handle transfer lookups and address
    management for the Spark exact scheme.

    Example:
        ```python
        class MySparkNode:
            def get_transfer(self, transfer_id: str) -> TransferInfo:
                # Look up transfer by ID
                return TransferInfo(...)

            def get_address(self) -> str:
                return "spark:server123"
        ```
    """

    def get_transfer(self, transfer_id: str) -> TransferInfo:
        """Look up a Spark transfer by ID.

        Args:
            transfer_id: The transfer identifier.

        Returns:
            TransferInfo with transfer details.

        Raises:
            Exception: If transfer not found.
        """
        ...

    def get_address(self) -> str:
        """Get the facilitator's Spark address.

        Returns:
            Spark address string.
        """
        ...
