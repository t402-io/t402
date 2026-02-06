"""NEAR Up-To Scheme Types.

NEAR-specific types for the up-to payment scheme using an escrow pattern.
Since NEAR NEP-141 tokens don't have native approve/transferFrom, the client
ft_transfers maxAmount to the facilitator, who then forwards settleAmount
to the payTo address and refunds the rest.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class UptoNearAuthorization(BaseModel):
    """Authorization metadata for NEAR upto payments.

    Contains the transfer details needed for verification.

    Attributes:
        from_account: Sender's NEAR account ID.
        facilitator: Facilitator's NEAR account ID that receives the transfer.
        token_contract: NEP-141 token contract ID.
        max_amount: Maximum authorized amount in smallest units (as string).
    """

    from_account: str = Field(alias="from", description="Sender's NEAR account ID")
    facilitator: str = Field(description="Facilitator's NEAR account ID")
    token_contract: str = Field(
        alias="tokenContract",
        description="NEP-141 token contract ID",
    )
    max_amount: str = Field(
        alias="maxAmount",
        description="Maximum authorized amount in smallest units",
    )

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class UptoNearPayload(BaseModel):
    """NEAR upto payment payload.

    Contains the transaction hash of the client's transfer to the facilitator,
    along with authorization metadata for verification.

    Attributes:
        tx_hash: NEAR transaction hash of the transfer to facilitator.
        authorization: Authorization metadata for verification.
        payment_nonce: Unique nonce for replay protection (hex string).
    """

    tx_hash: str = Field(
        alias="txHash",
        description="NEAR transaction hash of the transfer to facilitator",
    )
    authorization: UptoNearAuthorization = Field(
        description="Authorization metadata for verification",
    )
    payment_nonce: str = Field(
        alias="paymentNonce",
        description="Unique nonce for replay protection (hex string)",
    )

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization.

        Returns:
            Dict with camelCase keys matching the Go/TypeScript field names.
        """
        return {
            "txHash": self.tx_hash,
            "authorization": {
                "from": self.authorization.from_account,
                "facilitator": self.authorization.facilitator,
                "tokenContract": self.authorization.token_contract,
                "maxAmount": self.authorization.max_amount,
            },
            "paymentNonce": self.payment_nonce,
        }


class UptoNearExtra(BaseModel):
    """NEAR-specific extra fields for the upto scheme.

    Included in the PaymentRequirements.extra field to provide
    additional parameters needed for the upto payment flow.

    Attributes:
        facilitator: Facilitator account ID that will receive the initial transfer.
        max_amount: Maximum payment amount authorized.
        min_amount: Minimum acceptable settlement amount.
        unit: Billing unit (e.g., "token", "request", "second").
        unit_price: Price per unit in smallest denomination.
    """

    facilitator: Optional[str] = Field(
        default=None,
        description="Facilitator account ID that will receive the initial transfer",
    )
    max_amount: Optional[str] = Field(
        default=None,
        alias="maxAmount",
        description="Maximum payment amount authorized",
    )
    min_amount: Optional[str] = Field(
        default=None,
        alias="minAmount",
        description="Minimum acceptable settlement amount",
    )
    unit: Optional[str] = Field(
        default=None,
        description="Billing unit (e.g., 'token', 'request', 'second')",
    )
    unit_price: Optional[str] = Field(
        default=None,
        alias="unitPrice",
        description="Price per unit in smallest denomination",
    )

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class UptoNearUsageDetails(BaseModel):
    """Usage details for NEAR upto settlement.

    Attributes:
        units_consumed: Number of units consumed.
        unit_price: Price per unit used.
        unit_type: Type of unit.
        start_time: Start timestamp.
        end_time: End timestamp.
    """

    units_consumed: Optional[int] = Field(
        default=None,
        alias="unitsConsumed",
        description="Number of units consumed",
    )
    unit_price: Optional[str] = Field(
        default=None,
        alias="unitPrice",
        description="Price per unit used",
    )
    unit_type: Optional[str] = Field(
        default=None,
        alias="unitType",
        description="Type of unit",
    )
    start_time: Optional[int] = Field(
        default=None,
        alias="startTime",
        description="Start timestamp",
    )
    end_time: Optional[int] = Field(
        default=None,
        alias="endTime",
        description="End timestamp",
    )

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class UptoNearSettlement(BaseModel):
    """NEAR-specific settlement request for the upto scheme.

    Attributes:
        settle_amount: Actual amount to settle (must be <= maxAmount).
        usage_details: Optional usage information for auditing.
    """

    settle_amount: str = Field(
        alias="settleAmount",
        description="Actual amount to settle",
    )
    usage_details: Optional[UptoNearUsageDetails] = Field(
        default=None,
        alias="usageDetails",
        description="Optional usage information",
    )

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


def is_upto_near_payload(data: Dict[str, Any]) -> bool:
    """Check if the given data represents a NEAR upto payload.

    Distinguishes upto payloads from exact-direct payloads by checking
    for the authorization structure with facilitator field.

    Args:
        data: Dictionary to check.

    Returns:
        True if data has the correct NEAR upto payload structure.
    """
    if not isinstance(data, dict):
        return False

    tx_hash = data.get("txHash")
    payment_nonce = data.get("paymentNonce")
    auth = data.get("authorization")

    if not tx_hash or not isinstance(tx_hash, str):
        return False
    if not payment_nonce or not isinstance(payment_nonce, str):
        return False
    if not auth or not isinstance(auth, dict):
        return False

    # Check authorization structure
    required_auth_fields = ["from", "facilitator", "tokenContract", "maxAmount"]
    if not all(k in auth for k in required_auth_fields):
        return False

    # Ensure from and facilitator are non-empty strings
    if not auth.get("from") or not isinstance(auth["from"], str):
        return False
    if not auth.get("facilitator") or not isinstance(auth["facilitator"], str):
        return False

    return True


def upto_payload_from_dict(data: Dict[str, Any]) -> UptoNearPayload:
    """Create an UptoNearPayload from a dictionary.

    Args:
        data: Dictionary containing payload data with camelCase keys.

    Returns:
        UptoNearPayload instance.

    Raises:
        ValueError: If required fields are missing or invalid.
    """
    auth_data = data.get("authorization", {})

    return UptoNearPayload(
        tx_hash=data.get("txHash", ""),
        authorization=UptoNearAuthorization(
            from_account=auth_data.get("from", ""),
            facilitator=auth_data.get("facilitator", ""),
            token_contract=auth_data.get("tokenContract", ""),
            max_amount=auth_data.get("maxAmount", ""),
        ),
        payment_nonce=data.get("paymentNonce", ""),
    )
