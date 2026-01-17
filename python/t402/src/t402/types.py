from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional, Union, Dict, Literal, List
from typing_extensions import (
    TypedDict,
)  # use `typing_extensions.TypedDict` instead of `typing.TypedDict` on Python < 3.12

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

from t402.networks import SupportedNetworks

# Protocol version constants
T402_VERSION_V1 = 1
T402_VERSION_V2 = 2
T402_VERSION = T402_VERSION_V2  # Current default version

# Network type alias (CAIP-2 format: "namespace:reference")
Network = str  # e.g., "eip155:1", "solana:mainnet", "ton:mainnet"


# Add HTTP request structure types
class HTTPVerbs(str, Enum):
    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    DELETE = "DELETE"
    PATCH = "PATCH"
    OPTIONS = "OPTIONS"
    HEAD = "HEAD"


class HTTPInputSchema(BaseModel):
    """Schema for HTTP request input, excluding spec and method which are handled by the middleware"""

    query_params: Optional[Dict[str, str]] = None
    body_type: Optional[
        Literal["json", "form-data", "multipart-form-data", "text", "binary"]
    ] = None
    body_fields: Optional[Dict[str, Any]] = None
    header_fields: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class HTTPRequestStructure(HTTPInputSchema):
    """Complete HTTP request structure including protocol type and method"""

    type: Literal["http"]
    method: HTTPVerbs


# For now we only support HTTP, but could add MCP and OpenAPI later
RequestStructure = HTTPRequestStructure


class TokenAmount(BaseModel):
    """Represents an amount of tokens in atomic units with asset information"""

    amount: str
    asset: TokenAsset

    @field_validator("amount")
    def validate_amount(cls, v):
        try:
            int(v)
        except ValueError:
            raise ValueError("amount must be an integer encoded as a string")
        return v


class TokenAsset(BaseModel):
    """Represents token asset information including EIP-712 domain data"""

    address: str
    decimals: int
    eip712: EIP712Domain

    @field_validator("decimals")
    def validate_decimals(cls, v):
        if v < 0 or v > 255:
            raise ValueError("decimals must be between 0 and 255")
        return v


class EIP712Domain(BaseModel):
    """EIP-712 domain information for token signing"""

    name: str
    version: str


# Price can be either Money (USD string) or TokenAmount
Money = Union[str, int]  # e.g., "$0.01", 0.01, "0.001"
Price = Union[Money, TokenAmount]


# =============================================================================
# V1 Types (Legacy - for backward compatibility)
# =============================================================================


class PaymentRequirementsV1(BaseModel):
    """V1 Payment Requirements - Legacy format."""

    scheme: str
    network: SupportedNetworks
    max_amount_required: str
    resource: str
    description: str
    mime_type: str
    output_schema: Optional[Any] = None
    pay_to: str
    max_timeout_seconds: int
    asset: str
    extra: Optional[dict[str, Any]] = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )

    @field_validator("max_amount_required")
    def validate_max_amount_required(cls, v):
        try:
            int(v)
        except ValueError:
            raise ValueError(
                "max_amount_required must be an integer encoded as a string"
            )
        return v


# Alias for backward compatibility
PaymentRequirements = PaymentRequirementsV1


class t402PaymentRequiredResponseV1(BaseModel):
    """V1 Payment Required Response - Legacy format (returned in response body)."""

    t402_version: int = Field(default=T402_VERSION_V1, alias="t402Version")
    accepts: list[PaymentRequirementsV1]
    error: str

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


# Alias for backward compatibility
t402PaymentRequiredResponse = t402PaymentRequiredResponseV1


# =============================================================================
# V2 Types (Current Protocol Version)
# =============================================================================


class ResourceInfo(BaseModel):
    """Resource information for V2 protocol.

    Contains metadata about the protected resource.
    """

    url: str
    description: str = ""
    mime_type: str = Field(default="", alias="mimeType")

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class PaymentRequirementsV2(BaseModel):
    """V2 Payment Requirements - Current format.

    Represents a single payment option that a client can use to pay for access.
    """

    scheme: str
    network: Network
    asset: str
    amount: str
    pay_to: str = Field(alias="payTo")
    max_timeout_seconds: int = Field(alias="maxTimeoutSeconds")
    extra: dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )

    @field_validator("amount")
    def validate_amount(cls, v):
        try:
            int(v)
        except ValueError:
            raise ValueError("amount must be an integer encoded as a string")
        return v


class PaymentRequiredV2(BaseModel):
    """V2 Payment Required Response - Current format.

    Returned in the PAYMENT-REQUIRED header as base64-encoded JSON.
    """

    t402_version: int = Field(default=T402_VERSION_V2, alias="t402Version")
    resource: ResourceInfo
    accepts: list[PaymentRequirementsV2]
    error: Optional[str] = None
    extensions: Optional[dict[str, Any]] = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class ExactPaymentPayload(BaseModel):
    signature: str
    authorization: EIP3009Authorization


class EIP3009Authorization(BaseModel):
    from_: str = Field(alias="from")
    to: str
    value: str
    valid_after: str
    valid_before: str
    nonce: str

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )

    @field_validator("value")
    def validate_value(cls, v):
        try:
            int(v)
        except ValueError:
            raise ValueError("value must be an integer encoded as a string")
        return v


class TonAuthorization(BaseModel):
    """TON Jetton transfer authorization metadata."""

    from_: str = Field(alias="from")
    to: str
    jetton_master: str = Field(alias="jettonMaster")
    jetton_amount: str = Field(alias="jettonAmount")
    ton_amount: str = Field(alias="tonAmount")
    valid_until: int = Field(alias="validUntil")
    seqno: int
    query_id: str = Field(alias="queryId")

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )

    @field_validator("jetton_amount", "ton_amount")
    def validate_amount(cls, v):
        try:
            int(v)
        except ValueError:
            raise ValueError("amount must be an integer encoded as a string")
        return v


class TonPaymentPayload(BaseModel):
    """TON payment payload containing signed BOC and authorization."""

    signed_boc: str = Field(alias="signedBoc")
    authorization: TonAuthorization

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class TronAuthorization(BaseModel):
    """TRON TRC20 transfer authorization metadata."""

    from_: str = Field(alias="from")
    to: str
    contract_address: str = Field(alias="contractAddress")
    amount: str
    expiration: int
    ref_block_bytes: str = Field(alias="refBlockBytes")
    ref_block_hash: str = Field(alias="refBlockHash")
    timestamp: int

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )

    @field_validator("amount")
    def validate_amount(cls, v):
        try:
            int(v)
        except ValueError:
            raise ValueError("amount must be an integer encoded as a string")
        return v


class TronPaymentPayload(BaseModel):
    """TRON payment payload containing signed transaction and authorization."""

    signed_transaction: str = Field(alias="signedTransaction")
    authorization: TronAuthorization

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class VerifyResponse(BaseModel):
    is_valid: bool = Field(alias="isValid")
    invalid_reason: Optional[str] = Field(None, alias="invalidReason")
    payer: Optional[str]

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class SettleResponse(BaseModel):
    success: bool
    error_reason: Optional[str] = Field(None, alias="errorReason")
    transaction: Optional[str] = None
    network: Optional[str] = None
    payer: Optional[str] = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class PaymentResponseV2(BaseModel):
    """V2 Payment Response - returned in PAYMENT-RESPONSE header after settlement."""

    success: bool
    error_reason: Optional[str] = Field(None, alias="errorReason")
    payer: Optional[str] = None
    transaction: str
    network: Network
    requirements: PaymentRequirementsV2

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


# =============================================================================
# Facilitator Types
# =============================================================================


class SupportedKind(BaseModel):
    """A single supported scheme/network combination from the facilitator."""

    t402_version: int = Field(alias="t402Version")
    scheme: str
    network: Network
    extra: Optional[dict[str, Any]] = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class SupportedResponse(BaseModel):
    """Response from facilitator's /supported endpoint."""

    kinds: list[SupportedKind]
    extensions: list[str] = Field(default_factory=list)
    signers: dict[str, list[str]] = Field(default_factory=dict)  # CAIP family → addresses

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


# Union of payloads for each scheme
SchemePayloads = Union[ExactPaymentPayload, TonPaymentPayload, TronPaymentPayload]


class PaymentPayloadV1(BaseModel):
    """V1 Payment Payload - Legacy format."""

    t402_version: int = Field(default=T402_VERSION_V1, alias="t402Version")
    scheme: str
    network: str
    payload: SchemePayloads

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


# Alias for backward compatibility
PaymentPayload = PaymentPayloadV1


class PaymentPayloadV2(BaseModel):
    """V2 Payment Payload - Current format.

    Sent in the PAYMENT-SIGNATURE header as base64-encoded JSON.
    """

    t402_version: int = Field(default=T402_VERSION_V2, alias="t402Version")
    resource: Optional[ResourceInfo] = None
    accepted: PaymentRequirementsV2
    payload: dict[str, Any]
    extensions: Optional[dict[str, Any]] = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class T402Headers(BaseModel):
    x_payment: str


class UnsupportedSchemeException(Exception):
    pass


class PaywallConfig(TypedDict, total=False):
    """Configuration for paywall UI customization"""

    app_name: str
    app_logo: str


class DiscoveredResource(BaseModel):
    """A discovery resource represents a discoverable resource in the T402 ecosystem."""

    resource: str
    type: str = Field(..., pattern="^http$")  # Currently only supports 'http'
    t402_version: int = Field(..., alias="t402Version")
    accepts: List["PaymentRequirements"]
    last_updated: datetime = Field(
        ...,
        alias="lastUpdated",
        description="ISO 8601 formatted datetime string with UTC timezone (e.g. 2025-08-09T01:07:04.005Z)",
    )
    metadata: Optional[dict] = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class ListDiscoveryResourcesRequest(BaseModel):
    """Request parameters for listing discovery resources."""

    type: Optional[str] = None
    limit: Optional[int] = None
    offset: Optional[int] = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class DiscoveryResourcesPagination(BaseModel):
    """Pagination information for discovery resources responses."""

    limit: int
    offset: int
    total: int

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class ListDiscoveryResourcesResponse(BaseModel):
    """Response from the discovery resources endpoint."""

    t402_version: int = Field(..., alias="t402Version")
    items: List[DiscoveredResource]
    pagination: DiscoveryResourcesPagination

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )
