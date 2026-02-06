"""TRON Up-To Scheme Types.

TRON-specific types for the up-to payment scheme using TRC-20 approve + transferFrom.
The approve pattern allows the facilitator to execute a transferFrom up to the
authorized maximum amount on behalf of the payer.
"""

from __future__ import annotations

from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class UptoTronAuthorization(BaseModel):
    """TRC-20 approve authorization metadata.

    Contains all information needed to verify the approve transaction
    without parsing the signed transaction.
    """

    owner: str = Field(description="Token owner address (T-prefix base58check)")
    spender: str = Field(description="Approved spender address - facilitator (T-prefix base58check)")
    contract_address: str = Field(
        alias="contractAddress",
        description="TRC-20 contract address (T-prefix base58check)",
    )
    max_amount: str = Field(
        alias="maxAmount",
        description="Maximum approved amount in smallest units (as string)",
    )
    expiration: int = Field(
        description="Transaction expiration timestamp (milliseconds since epoch)",
    )
    ref_block_bytes: str = Field(
        alias="refBlockBytes",
        description="Reference block bytes (hex string)",
    )
    ref_block_hash: str = Field(
        alias="refBlockHash",
        description="Reference block hash (hex string)",
    )
    timestamp: int = Field(
        description="Transaction timestamp (milliseconds since epoch)",
    )

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class UptoTronPayload(BaseModel):
    """TRON upto payment payload.

    Contains a signed TRC-20 approve transaction that authorizes the
    facilitator to transfer up to maxAmount of tokens on behalf of the payer.
    """

    signed_transaction: str = Field(
        alias="signedTransaction",
        description="Hex-encoded signed approve transaction",
    )
    authorization: UptoTronAuthorization = Field(
        description="Approve transaction authorization metadata",
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
            Dictionary with camelCase keys matching the Go/TypeScript wire format.
        """
        return {
            "signedTransaction": self.signed_transaction,
            "authorization": {
                "owner": self.authorization.owner,
                "spender": self.authorization.spender,
                "contractAddress": self.authorization.contract_address,
                "maxAmount": self.authorization.max_amount,
                "expiration": self.authorization.expiration,
                "refBlockBytes": self.authorization.ref_block_bytes,
                "refBlockHash": self.authorization.ref_block_hash,
                "timestamp": self.authorization.timestamp,
            },
            "paymentNonce": self.payment_nonce,
        }


class UptoTronExtra(BaseModel):
    """TRON-specific extra fields for upto payment requirements.

    Included in the PaymentRequirements.extra field to communicate
    upto-specific parameters to the client.
    """

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
    spender_address: Optional[str] = Field(
        default=None,
        alias="spenderAddress",
        description="Facilitator address that will be approved as spender",
    )

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


def is_upto_tron_payload(data: Dict[str, Any]) -> bool:
    """Check if the given data represents an upto TRON payload.

    Validates that the data has the correct structure for a TRON upto
    approve payload, including nested authorization fields.

    Args:
        data: Dictionary to check

    Returns:
        True if data has the correct upto TRON payload structure
    """
    if not isinstance(data, dict):
        return False

    # Check top-level fields
    if not isinstance(data.get("signedTransaction"), str) or not data["signedTransaction"]:
        return False

    if not isinstance(data.get("paymentNonce"), str) or not data["paymentNonce"]:
        return False

    auth = data.get("authorization")
    if not isinstance(auth, dict):
        return False

    # Check required authorization fields
    required_string_fields = ["owner", "spender", "contractAddress", "maxAmount"]
    for field in required_string_fields:
        if not isinstance(auth.get(field), str) or not auth[field]:
            return False

    # Check numeric authorization fields
    if not isinstance(auth.get("expiration"), (int, float)):
        return False

    if not isinstance(auth.get("timestamp"), (int, float)):
        return False

    # refBlockBytes and refBlockHash should be strings
    if not isinstance(auth.get("refBlockBytes"), str):
        return False

    if not isinstance(auth.get("refBlockHash"), str):
        return False

    return True


def upto_payload_from_dict(data: Dict[str, Any]) -> UptoTronPayload:
    """Create an UptoTronPayload from a dictionary.

    Args:
        data: Dictionary containing payload data with camelCase keys

    Returns:
        UptoTronPayload instance
    """
    auth_data = data.get("authorization", {})

    return UptoTronPayload(
        signed_transaction=data.get("signedTransaction", ""),
        authorization=UptoTronAuthorization(
            owner=auth_data.get("owner", ""),
            spender=auth_data.get("spender", ""),
            contract_address=auth_data.get("contractAddress", ""),
            max_amount=auth_data.get("maxAmount", ""),
            expiration=auth_data.get("expiration", 0),
            ref_block_bytes=auth_data.get("refBlockBytes", ""),
            ref_block_hash=auth_data.get("refBlockHash", ""),
            timestamp=auth_data.get("timestamp", 0),
        ),
        payment_nonce=data.get("paymentNonce", ""),
    )
