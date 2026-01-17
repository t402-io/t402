"""Up-To Scheme Core Types.

The upto scheme authorizes transfer of up to a maximum amount,
enabling usage-based billing where the final settlement amount
is determined by actual usage.

Example:
    ```python
    from t402.schemes.upto import (
        UptoPaymentRequirements,
        UptoSettlement,
        UptoUsageDetails,
    )

    # Server specifies requirements
    requirements = UptoPaymentRequirements(
        scheme="upto",
        network="eip155:8453",
        max_amount="1000000",  # $1.00 in USDC
        min_amount="10000",    # $0.01 minimum
        asset="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        pay_to="0x...",
        max_timeout_seconds=300,
        extra=UptoExtra(unit="token", unit_price="100"),
    )

    # Server settles for actual usage
    settlement = UptoSettlement(
        settle_amount="150000",  # $0.15
        usage_details=UptoUsageDetails(
            units_consumed=1500,
            unit_price="100",
            unit_type="token",
        ),
    )
    ```
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel


# Constants
SCHEME_UPTO = "upto"
DEFAULT_MIN_AMOUNT = "1000"
DEFAULT_MAX_TIMEOUT_SECONDS = 300

# Supported billing units
SUPPORTED_UNITS: List[str] = [
    "token",
    "request",
    "second",
    "minute",
    "byte",
    "kb",
    "mb",
]


class UptoExtra(BaseModel):
    """Extra fields specific to the upto scheme."""

    unit: Optional[str] = Field(
        default=None,
        description="Billing unit (e.g., 'token', 'request', 'second', 'byte')",
    )
    unit_price: Optional[str] = Field(
        default=None,
        alias="unitPrice",
        description="Price per unit in smallest denomination",
    )
    name: Optional[str] = Field(
        default=None,
        description="EIP-712 domain name (for EVM)",
    )
    version: Optional[str] = Field(
        default=None,
        description="EIP-712 domain version (for EVM)",
    )
    router_address: Optional[str] = Field(
        default=None,
        alias="routerAddress",
        description="Router contract address (for EVM)",
    )

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
        extra="allow",  # Allow additional fields
    )


class UptoPaymentRequirements(BaseModel):
    """Extended payment requirements for the upto scheme.

    Uses maxAmount instead of amount to indicate a maximum authorization.
    """

    scheme: Literal["upto"] = Field(default="upto")
    network: str = Field(description="Network identifier (CAIP-2 format)")
    max_amount: str = Field(
        alias="maxAmount",
        description="Maximum amount the client authorizes (in smallest denomination)",
    )
    min_amount: Optional[str] = Field(
        default=None,
        alias="minAmount",
        description="Minimum settlement amount (prevents dust payments)",
    )
    asset: str = Field(description="Asset contract address or identifier")
    pay_to: str = Field(alias="payTo", description="Recipient address")
    max_timeout_seconds: int = Field(
        alias="maxTimeoutSeconds",
        description="Maximum time in seconds before payment expires",
    )
    extra: UptoExtra = Field(default_factory=UptoExtra)

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )

    @field_validator("max_amount", "min_amount")
    @classmethod
    def validate_amount(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            try:
                int(v)
            except ValueError:
                raise ValueError("Amount must be an integer encoded as a string")
        return v


class UptoUsageDetails(BaseModel):
    """Usage details for settlement auditing."""

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
        description="Start timestamp of usage period",
    )
    end_time: Optional[int] = Field(
        default=None,
        alias="endTime",
        description="End timestamp of usage period",
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Additional metadata",
    )

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class UptoSettlement(BaseModel):
    """Settlement request for the upto scheme."""

    settle_amount: str = Field(
        alias="settleAmount",
        description="Actual amount to settle (must be <= maxAmount)",
    )
    usage_details: Optional[UptoUsageDetails] = Field(
        default=None,
        alias="usageDetails",
        description="Optional usage details for auditing",
    )

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )

    @field_validator("settle_amount")
    @classmethod
    def validate_settle_amount(cls, v: str) -> str:
        try:
            int(v)
        except ValueError:
            raise ValueError("settle_amount must be an integer encoded as a string")
        return v


class UptoSettlementResponse(BaseModel):
    """Settlement response for the upto scheme."""

    success: bool = Field(description="Whether settlement was successful")
    transaction_hash: Optional[str] = Field(
        default=None,
        alias="transactionHash",
        description="Transaction hash (if on-chain)",
    )
    settled_amount: str = Field(
        alias="settledAmount",
        description="Actual amount settled",
    )
    max_amount: str = Field(
        alias="maxAmount",
        description="Maximum amount that was authorized",
    )
    block_number: Optional[int] = Field(
        default=None,
        alias="blockNumber",
        description="Block number (if on-chain)",
    )
    gas_used: Optional[str] = Field(
        default=None,
        alias="gasUsed",
        description="Gas used (if on-chain)",
    )
    error: Optional[str] = Field(
        default=None,
        description="Error message if failed",
    )

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class UptoValidationResult(BaseModel):
    """Validation result for upto payment."""

    is_valid: bool = Field(alias="isValid", description="Whether the payment is valid")
    invalid_reason: Optional[str] = Field(
        default=None,
        alias="invalidReason",
        description="Reason if invalid",
    )
    validated_max_amount: Optional[str] = Field(
        default=None,
        alias="validatedMaxAmount",
        description="Validated maximum amount",
    )
    payer: Optional[str] = Field(
        default=None,
        description="Payer address",
    )
    expires_at: Optional[int] = Field(
        default=None,
        alias="expiresAt",
        description="Expiration timestamp",
    )

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


def is_upto_payment_requirements(data: Dict[str, Any]) -> bool:
    """Check if the given data represents upto payment requirements.

    Args:
        data: Dictionary to check

    Returns:
        True if data has scheme="upto" and maxAmount field
    """
    scheme = data.get("scheme")
    has_max_amount = "maxAmount" in data or "max_amount" in data
    return scheme == SCHEME_UPTO and has_max_amount


def is_valid_unit(unit: str) -> bool:
    """Check if the given unit is a supported billing unit.

    Args:
        unit: Unit string to check

    Returns:
        True if unit is in SUPPORTED_UNITS
    """
    return unit in SUPPORTED_UNITS


def create_payment_requirements(
    network: str,
    max_amount: str,
    asset: str,
    pay_to: str,
    min_amount: Optional[str] = None,
    max_timeout_seconds: int = DEFAULT_MAX_TIMEOUT_SECONDS,
    extra: Optional[UptoExtra] = None,
) -> UptoPaymentRequirements:
    """Create a new UptoPaymentRequirements with default values.

    Args:
        network: Network identifier (CAIP-2 format)
        max_amount: Maximum authorization amount
        asset: Asset contract address
        pay_to: Recipient address
        min_amount: Minimum settlement amount (defaults to DEFAULT_MIN_AMOUNT)
        max_timeout_seconds: Timeout in seconds
        extra: Additional scheme-specific data

    Returns:
        UptoPaymentRequirements instance
    """
    return UptoPaymentRequirements(
        scheme="upto",
        network=network,
        max_amount=max_amount,
        min_amount=min_amount or DEFAULT_MIN_AMOUNT,
        asset=asset,
        pay_to=pay_to,
        max_timeout_seconds=max_timeout_seconds,
        extra=extra or UptoExtra(),
    )


def create_settlement(
    settle_amount: str,
    units_consumed: Optional[int] = None,
    unit_price: Optional[str] = None,
    unit_type: Optional[str] = None,
    start_time: Optional[int] = None,
    end_time: Optional[int] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> UptoSettlement:
    """Create a settlement with optional usage details.

    Args:
        settle_amount: Amount to settle
        units_consumed: Number of units consumed
        unit_price: Price per unit
        unit_type: Type of unit
        start_time: Start timestamp
        end_time: End timestamp
        metadata: Additional metadata

    Returns:
        UptoSettlement instance
    """
    usage_details = None
    if any([units_consumed, unit_price, unit_type, start_time, end_time, metadata]):
        usage_details = UptoUsageDetails(
            units_consumed=units_consumed,
            unit_price=unit_price,
            unit_type=unit_type,
            start_time=start_time,
            end_time=end_time,
            metadata=metadata,
        )

    return UptoSettlement(
        settle_amount=settle_amount,
        usage_details=usage_details,
    )
