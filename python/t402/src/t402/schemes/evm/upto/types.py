"""EVM Up-To Scheme Types.

EVM-specific types for the up-to payment scheme using EIP-2612 Permit.
The Permit standard allows gasless token approvals via signature.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


# EIP-712 Permit type definitions
PERMIT_TYPES: Dict[str, List[Dict[str, str]]] = {
    "Permit": [
        {"name": "owner", "type": "address"},
        {"name": "spender", "type": "address"},
        {"name": "value", "type": "uint256"},
        {"name": "nonce", "type": "uint256"},
        {"name": "deadline", "type": "uint256"},
    ]
}

PERMIT_DOMAIN_TYPES: List[Dict[str, str]] = [
    {"name": "name", "type": "string"},
    {"name": "version", "type": "string"},
    {"name": "chainId", "type": "uint256"},
    {"name": "verifyingContract", "type": "address"},
]


class PermitSignature(BaseModel):
    """EIP-2612 permit signature components."""

    v: int = Field(description="Recovery id")
    r: str = Field(description="First 32 bytes of signature")
    s: str = Field(description="Second 32 bytes of signature")

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class PermitAuthorization(BaseModel):
    """EIP-2612 permit authorization parameters."""

    owner: str = Field(description="Token owner address")
    spender: str = Field(description="Address authorized to spend (router contract)")
    value: str = Field(description="Maximum authorized value")
    deadline: str = Field(description="Permit deadline (unix timestamp)")
    nonce: int = Field(description="Permit nonce from token contract")

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class UptoEIP2612Payload(BaseModel):
    """Up-to payment payload using EIP-2612 Permit."""

    signature: PermitSignature = Field(description="Permit signature components")
    authorization: PermitAuthorization = Field(description="Permit parameters")
    payment_nonce: str = Field(
        alias="paymentNonce",
        description="Unique nonce to prevent replay attacks",
    )

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "signature": {
                "v": self.signature.v,
                "r": self.signature.r,
                "s": self.signature.s,
            },
            "authorization": {
                "owner": self.authorization.owner,
                "spender": self.authorization.spender,
                "value": self.authorization.value,
                "deadline": self.authorization.deadline,
                "nonce": self.authorization.nonce,
            },
            "paymentNonce": self.payment_nonce,
        }


class UptoCompactPayload(BaseModel):
    """Alternative payload with combined signature."""

    signature: str = Field(description="Combined EIP-2612 permit signature (65 bytes hex)")
    authorization: PermitAuthorization = Field(description="Permit parameters")
    payment_nonce: str = Field(
        alias="paymentNonce",
        description="Unique nonce to prevent replay attacks",
    )

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class UptoEvmExtra(BaseModel):
    """EVM-specific extra fields for the upto scheme."""

    name: str = Field(description="EIP-712 domain name (token name)")
    version: str = Field(description="EIP-712 domain version")
    router_address: Optional[str] = Field(
        default=None,
        alias="routerAddress",
        description="Upto router contract address",
    )
    unit: Optional[str] = Field(
        default=None,
        description="Billing unit (e.g., 'token', 'request')",
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


class UptoEvmSettlement(BaseModel):
    """EVM-specific settlement request."""

    settle_amount: str = Field(
        alias="settleAmount",
        description="Actual amount to settle",
    )
    usage_details: Optional["UptoEvmUsageDetails"] = Field(
        default=None,
        alias="usageDetails",
        description="Optional usage information",
    )

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class UptoEvmUsageDetails(BaseModel):
    """Usage details for EVM settlement."""

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


# Update forward reference
UptoEvmSettlement.model_rebuild()


def is_eip2612_payload(data: Dict[str, Any]) -> bool:
    """Check if the given data represents an EIP-2612 permit payload.

    Args:
        data: Dictionary to check

    Returns:
        True if data has the correct EIP-2612 structure
    """
    if not isinstance(data, dict):
        return False

    sig = data.get("signature")
    auth = data.get("authorization")

    if not sig or not auth:
        return False

    # Check signature structure (should be object with v, r, s)
    if not isinstance(sig, dict):
        return False
    if not all(k in sig for k in ["v", "r", "s"]):
        return False

    # Check authorization structure
    if not isinstance(auth, dict):
        return False
    required_auth_fields = ["owner", "spender", "value", "deadline"]
    if not all(k in auth for k in required_auth_fields):
        return False

    return True


def create_permit_domain(
    name: str,
    version: str,
    chain_id: int,
    token_address: str,
) -> Dict[str, Any]:
    """Create an EIP-712 domain for permit signing.

    Args:
        name: Token name
        version: Token version
        chain_id: Chain ID
        token_address: Token contract address

    Returns:
        EIP-712 domain dictionary
    """
    return {
        "name": name,
        "version": version,
        "chainId": chain_id,
        "verifyingContract": token_address,
    }


def create_permit_message(authorization: PermitAuthorization) -> Dict[str, Any]:
    """Create an EIP-712 message for permit signing.

    Args:
        authorization: Permit authorization parameters

    Returns:
        EIP-712 message dictionary
    """
    return {
        "owner": authorization.owner,
        "spender": authorization.spender,
        "value": int(authorization.value),
        "nonce": authorization.nonce,
        "deadline": int(authorization.deadline),
    }


def payload_from_dict(data: Dict[str, Any]) -> UptoEIP2612Payload:
    """Create an UptoEIP2612Payload from a dictionary.

    Args:
        data: Dictionary containing payload data

    Returns:
        UptoEIP2612Payload instance
    """
    sig_data = data.get("signature", {})
    auth_data = data.get("authorization", {})

    return UptoEIP2612Payload(
        signature=PermitSignature(
            v=sig_data.get("v", 0),
            r=sig_data.get("r", ""),
            s=sig_data.get("s", ""),
        ),
        authorization=PermitAuthorization(
            owner=auth_data.get("owner", ""),
            spender=auth_data.get("spender", ""),
            value=auth_data.get("value", ""),
            deadline=auth_data.get("deadline", ""),
            nonce=auth_data.get("nonce", 0),
        ),
        payment_nonce=data.get("paymentNonce", ""),
    )
