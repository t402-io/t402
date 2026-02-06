"""Solana SVM Up-To Scheme Types.

SVM-specific types for the up-to payment scheme using SPL ApproveChecked.
The client signs an approve transaction that authorizes the facilitator
to transfer up to maxAmount tokens from the client's ATA.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class UptoSvmAuthorization(BaseModel):
    """SPL ApproveChecked authorization metadata.

    Contains the details of the delegate approval including the owner,
    delegate (facilitator), token mint, maximum amount, and source ATA.
    """

    owner: str = Field(description="Token owner address (base58)")
    delegate: str = Field(description="Approved delegate address - facilitator (base58)")
    mint: str = Field(description="SPL token mint address (base58)")
    max_amount: str = Field(
        alias="maxAmount",
        description="Maximum approved amount in smallest units (as string)",
    )
    source_ata: str = Field(
        alias="sourceATA",
        description="Owner's associated token account (base58)",
    )

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "owner": self.owner,
            "delegate": self.delegate,
            "mint": self.mint,
            "maxAmount": self.max_amount,
            "sourceATA": self.source_ata,
        }


class UptoSvmPayload(BaseModel):
    """Up-to SVM payment payload containing a signed approve transaction.

    The facilitator uses the delegated authority to transfer tokens
    up to the approved maxAmount.
    """

    transaction: str = Field(description="Base64 encoded signed approve transaction")
    authorization: UptoSvmAuthorization = Field(
        description="Approval authorization metadata"
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
        """Convert to dictionary for JSON serialization."""
        return {
            "transaction": self.transaction,
            "authorization": self.authorization.to_dict(),
            "paymentNonce": self.payment_nonce,
        }


class UptoSvmExtra(BaseModel):
    """SVM-specific extra fields for the upto scheme.

    Included in the PaymentRequirements.extra field to provide
    billing configuration for upto payments.
    """

    fee_payer: Optional[str] = Field(
        default=None,
        alias="feePayer",
        description="Facilitator address that will pay transaction fees (base58)",
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


def upto_payload_from_dict(data: Dict[str, Any]) -> UptoSvmPayload:
    """Create an UptoSvmPayload from a dictionary.

    Args:
        data: Dictionary containing payload data with keys:
            - transaction: base64 encoded transaction
            - authorization: dict with owner, delegate, mint, maxAmount, sourceATA
            - paymentNonce: hex string nonce

    Returns:
        UptoSvmPayload instance

    Raises:
        ValueError: If required fields are missing
    """
    auth_data = data.get("authorization", {})
    if not isinstance(auth_data, dict):
        raise ValueError("authorization must be a dictionary")

    transaction = data.get("transaction")
    if not isinstance(transaction, str) or not transaction:
        raise ValueError("missing or invalid transaction field")

    payment_nonce = data.get("paymentNonce")
    if not isinstance(payment_nonce, str) or not payment_nonce:
        raise ValueError("missing or invalid paymentNonce field")

    owner = auth_data.get("owner")
    if not isinstance(owner, str) or not owner:
        raise ValueError("missing or invalid authorization.owner field")

    delegate = auth_data.get("delegate")
    if not isinstance(delegate, str) or not delegate:
        raise ValueError("missing or invalid authorization.delegate field")

    return UptoSvmPayload(
        transaction=transaction,
        authorization=UptoSvmAuthorization(
            owner=owner,
            delegate=delegate,
            mint=auth_data.get("mint", ""),
            max_amount=auth_data.get("maxAmount", ""),
            source_ata=auth_data.get("sourceATA", ""),
        ),
        payment_nonce=payment_nonce,
    )


def is_upto_svm_payload(data: Any) -> bool:
    """Check if the given data represents an SVM upto payload.

    Args:
        data: Data to check

    Returns:
        True if data has the correct SVM upto payload structure
    """
    if not isinstance(data, dict):
        return False

    if not isinstance(data.get("transaction"), str):
        return False

    if not isinstance(data.get("paymentNonce"), str):
        return False

    auth = data.get("authorization")
    if not isinstance(auth, dict):
        return False

    required_fields = ["owner", "delegate", "mint", "maxAmount", "sourceATA"]
    return all(isinstance(auth.get(f), str) for f in required_fields)
