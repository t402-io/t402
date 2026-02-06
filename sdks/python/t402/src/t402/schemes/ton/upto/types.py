"""TON Up-To Scheme Types.

TON-specific types for the up-to payment scheme using an escrow pattern.
The client transfers maxAmount to the facilitator's holding address,
and the facilitator forwards settleAmount to payTo and refunds the rest.
"""

from __future__ import annotations

from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class UptoTonAuthorization(BaseModel):
    """TON upto authorization metadata.

    Contains all parameters for verifying the signed transfer message.
    """

    from_address: str = Field(
        alias="from",
        description="Sender wallet address (friendly format, bounceable)",
    )
    facilitator: str = Field(
        description="Facilitator holding address that receives the initial transfer",
    )
    jetton_master: str = Field(
        alias="jettonMaster",
        description="Jetton master contract address",
    )
    max_amount: str = Field(
        alias="maxAmount",
        description="Maximum authorized amount in smallest units",
    )
    ton_amount: str = Field(
        alias="tonAmount",
        description="Gas amount in nanoTON",
    )
    valid_until: int = Field(
        alias="validUntil",
        description="Unix timestamp (seconds) until which the message is valid",
    )
    seqno: int = Field(
        description="Wallet sequence number for replay protection",
    )
    query_id: str = Field(
        alias="queryId",
        description="Unique message ID (as string for large numbers)",
    )

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class UptoTonPayload(BaseModel):
    """TON upto payment payload.

    Contains a signed transfer message to the facilitator's holding address.
    The facilitator broadcasts the transfer, then forwards settleAmount to payTo
    and refunds (maxAmount - settleAmount) back to the client.
    """

    signed_boc: str = Field(
        alias="signedBoc",
        description="Base64 encoded signed external message (BOC format)",
    )
    authorization: UptoTonAuthorization = Field(
        description="Transfer authorization metadata for verification",
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
            Dictionary with camelCase keys matching the wire format.
        """
        return {
            "signedBoc": self.signed_boc,
            "authorization": {
                "from": self.authorization.from_address,
                "facilitator": self.authorization.facilitator,
                "jettonMaster": self.authorization.jetton_master,
                "maxAmount": self.authorization.max_amount,
                "tonAmount": self.authorization.ton_amount,
                "validUntil": self.authorization.valid_until,
                "seqno": self.authorization.seqno,
                "queryId": self.authorization.query_id,
            },
            "paymentNonce": self.payment_nonce,
        }


class UptoTonExtra(BaseModel):
    """TON-specific extra fields for the upto scheme.

    Included in PaymentRequirements.extra to provide upto-specific parameters.
    """

    facilitator: Optional[str] = Field(
        default=None,
        description="Facilitator address that will receive the initial transfer",
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


def is_upto_ton_payload(data: Any) -> bool:
    """Check if the given data represents a TON upto payload.

    Validates the presence and types of required fields including signedBoc,
    authorization (with from, facilitator, jettonMaster, maxAmount), and paymentNonce.

    Args:
        data: Dictionary or object to check.

    Returns:
        True if data has the correct TON upto payload structure.
    """
    if not isinstance(data, dict):
        return False

    signed_boc = data.get("signedBoc")
    payment_nonce = data.get("paymentNonce")
    auth = data.get("authorization")

    if not signed_boc or not isinstance(signed_boc, str):
        return False
    if not payment_nonce or not isinstance(payment_nonce, str):
        return False

    if not auth or not isinstance(auth, dict):
        return False

    # Check required authorization fields
    required_str_fields = ["from", "facilitator", "jettonMaster", "maxAmount", "tonAmount", "queryId"]
    for field in required_str_fields:
        val = auth.get(field)
        if not isinstance(val, str):
            return False

    # from and facilitator must not be empty
    if not auth.get("from") or not auth.get("facilitator"):
        return False

    # Check numeric fields
    if not isinstance(auth.get("validUntil"), (int, float)):
        return False
    if not isinstance(auth.get("seqno"), (int, float)):
        return False

    return True


def upto_payload_from_dict(data: Dict[str, Any]) -> UptoTonPayload:
    """Create an UptoTonPayload from a dictionary.

    Args:
        data: Dictionary containing payload data with camelCase keys.

    Returns:
        UptoTonPayload instance.
    """
    auth_data = data.get("authorization", {})

    return UptoTonPayload(
        signed_boc=data.get("signedBoc", ""),
        authorization=UptoTonAuthorization(
            from_address=auth_data.get("from", ""),
            facilitator=auth_data.get("facilitator", ""),
            jetton_master=auth_data.get("jettonMaster", ""),
            max_amount=auth_data.get("maxAmount", ""),
            ton_amount=auth_data.get("tonAmount", ""),
            valid_until=auth_data.get("validUntil", 0),
            seqno=auth_data.get("seqno", 0),
            query_id=auth_data.get("queryId", ""),
        ),
        payment_nonce=data.get("paymentNonce", ""),
    )
