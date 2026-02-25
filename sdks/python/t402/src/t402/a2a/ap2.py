"""AP2 embedded flow types and bridge functions for t402 payments."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional

from t402.a2a.types import A2AArtifact, A2AMessage, A2AMessagePart

from .helpers import (
    create_t402_extension,
    create_x402_extension,
)
from .types import (
    A2A_EXTENSIONS_HEADER,
    X402_A2A_EXTENSION_URI,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

AP2_EXTENSION_URI = (
    "https://github.com/google-agentic-commerce/ap2/tree/v0.1"
)
X402_PAYMENT_METHOD = "https://www.x402.org/"

AP2_DATA_KEY_INTENT_MANDATE = "ap2.mandates.IntentMandate"
AP2_DATA_KEY_CART_MANDATE = "ap2.mandates.CartMandate"
AP2_DATA_KEY_PAYMENT_MANDATE = "ap2.mandates.PaymentMandate"
AP2_DATA_KEY_PAYMENT_RECEIPT = "ap2.PaymentReceipt"

# ---------------------------------------------------------------------------
# AP2 Types
# ---------------------------------------------------------------------------


@dataclass
class PaymentCurrencyAmount:
    """W3C PaymentCurrencyAmount."""

    currency: str
    value: float


@dataclass
class PaymentItem:
    """W3C PaymentItem."""

    label: str
    amount: PaymentCurrencyAmount
    pending: Optional[bool] = None


@dataclass
class AP2PaymentMethodData:
    """AP2 payment method entry."""

    supported_methods: str
    data: Optional[Dict[str, Any]] = None


@dataclass
class AP2PaymentDetailsInit:
    """AP2 payment details."""

    id: str
    display_items: List[PaymentItem]
    total: PaymentItem


@dataclass
class AP2PaymentRequest:
    """AP2 payment request."""

    method_data: List[AP2PaymentMethodData]
    details: AP2PaymentDetailsInit


@dataclass
class AP2PaymentResponse:
    """AP2 payment response."""

    request_id: str
    method_name: str
    details: Optional[Dict[str, Any]] = None


@dataclass
class IntentMandate:
    """AP2 intent mandate (pre-cart)."""

    natural_language_description: str
    user_cart_confirmation_required: bool
    intent_expiry: str
    merchants: Optional[List[str]] = None
    skus: Optional[List[str]] = None
    requires_refundability: Optional[bool] = None


@dataclass
class CartContents:
    """AP2 cart contents."""

    id: str
    user_cart_confirmation_required: bool
    payment_request: AP2PaymentRequest
    cart_expiry: str
    merchant_name: str


@dataclass
class CartMandate:
    """AP2 cart mandate."""

    contents: CartContents
    merchant_authorization: Optional[str] = None


@dataclass
class PaymentMandateContents:
    """AP2 payment mandate contents."""

    payment_mandate_id: str
    payment_details_id: str
    payment_details_total: PaymentItem
    payment_response: AP2PaymentResponse
    merchant_agent: str
    timestamp: str


@dataclass
class PaymentMandate:
    """AP2 payment mandate."""

    payment_mandate_contents: PaymentMandateContents
    user_authorization: Optional[str] = None


@dataclass
class AP2PaymentReceipt:
    """AP2 payment receipt."""

    payment_mandate_id: str
    timestamp: str
    payment_id: str
    amount: PaymentCurrencyAmount
    payment_status: Dict[str, Any]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _to_dict(obj: Any) -> Any:
    """Convert a dataclass to a plain dict."""
    return asdict(obj)


# ---------------------------------------------------------------------------
# Bridge functions
# ---------------------------------------------------------------------------


def create_cart_mandate_with_x402(
    contents: CartContents,
    requirements: List[Dict[str, Any]],
    merchant_authorization: Optional[str] = None,
) -> CartMandate:
    """Create a CartMandate with x402 requirements embedded."""
    methods = [
        m
        for m in contents.payment_request.method_data
        if m.supported_methods != X402_PAYMENT_METHOD
    ]
    methods.append(
        AP2PaymentMethodData(
            supported_methods=X402_PAYMENT_METHOD,
            data={"requirements": requirements},
        )
    )
    updated = CartContents(
        id=contents.id,
        user_cart_confirmation_required=(
            contents.user_cart_confirmation_required
        ),
        payment_request=AP2PaymentRequest(
            method_data=methods,
            details=contents.payment_request.details,
        ),
        cart_expiry=contents.cart_expiry,
        merchant_name=contents.merchant_name,
    )
    return CartMandate(
        contents=updated,
        merchant_authorization=merchant_authorization,
    )


def extract_x402_requirements(
    mandate: CartMandate,
) -> Optional[List[Dict[str, Any]]]:
    """Extract x402 requirements from a CartMandate."""
    for m in mandate.contents.payment_request.method_data:
        if (
            m.supported_methods == X402_PAYMENT_METHOD
            and m.data
        ):
            reqs = m.data.get("requirements")
            if isinstance(reqs, list):
                return reqs
    return None


def create_payment_mandate_with_x402(
    contents: PaymentMandateContents,
    payload: Dict[str, Any],
    user_authorization: Optional[str] = None,
) -> PaymentMandate:
    """Create a PaymentMandate with x402 payload."""
    updated = PaymentMandateContents(
        payment_mandate_id=contents.payment_mandate_id,
        payment_details_id=contents.payment_details_id,
        payment_details_total=contents.payment_details_total,
        payment_response=AP2PaymentResponse(
            request_id=contents.payment_response.request_id,
            method_name=X402_PAYMENT_METHOD,
            details=payload,
        ),
        merchant_agent=contents.merchant_agent,
        timestamp=contents.timestamp,
    )
    return PaymentMandate(
        payment_mandate_contents=updated,
        user_authorization=user_authorization,
    )


def extract_x402_payload(
    mandate: PaymentMandate,
) -> Optional[Dict[str, Any]]:
    """Extract x402 payload from a PaymentMandate."""
    resp = mandate.payment_mandate_contents.payment_response
    if resp.method_name != X402_PAYMENT_METHOD:
        return None
    return resp.details


def create_ap2_extension(
    roles: Optional[List[str]] = None,
    required: bool = False,
) -> Dict[str, Any]:
    """Create an AP2 extension declaration."""
    if roles is None:
        roles = ["merchant"]
    return {
        "uri": AP2_EXTENSION_URI,
        "description": (
            f"AP2 payment agent (roles: {', '.join(roles)})."
        ),
        "required": required,
    }


# ---------------------------------------------------------------------------
# DataPart helpers
# ---------------------------------------------------------------------------


def create_cart_mandate_data_part(
    mandate: CartMandate,
) -> A2AMessagePart:
    """Create a DataPart containing a CartMandate."""
    return A2AMessagePart(
        kind="data",
        data={AP2_DATA_KEY_CART_MANDATE: _to_dict(mandate)},
    )


def create_payment_mandate_data_part(
    mandate: PaymentMandate,
) -> A2AMessagePart:
    """Create a DataPart containing a PaymentMandate."""
    return A2AMessagePart(
        kind="data",
        data={
            AP2_DATA_KEY_PAYMENT_MANDATE: _to_dict(mandate)
        },
    )


def create_intent_mandate_data_part(
    mandate: IntentMandate,
) -> A2AMessagePart:
    """Create a DataPart containing an IntentMandate."""
    return A2AMessagePart(
        kind="data",
        data={
            AP2_DATA_KEY_INTENT_MANDATE: _to_dict(mandate)
        },
    )


def create_payment_receipt_data_part(
    receipt: AP2PaymentReceipt,
) -> A2AMessagePart:
    """Create a DataPart containing a PaymentReceipt."""
    return A2AMessagePart(
        kind="data",
        data={AP2_DATA_KEY_PAYMENT_RECEIPT: _to_dict(receipt)},
    )


def extract_cart_mandate_from_artifact(
    artifact: A2AArtifact,
) -> Optional[Dict[str, Any]]:
    """Extract a CartMandate dict from an A2AArtifact."""
    if not artifact.parts:
        return None
    for part in artifact.parts:
        if (
            part.kind == "data"
            and part.data
            and AP2_DATA_KEY_CART_MANDATE in part.data
        ):
            return part.data[AP2_DATA_KEY_CART_MANDATE]
    return None


def extract_payment_mandate_from_message(
    message: A2AMessage,
) -> Optional[Dict[str, Any]]:
    """Extract a PaymentMandate dict from an A2AMessage."""
    for part in message.parts:
        if (
            part.kind == "data"
            and part.data
            and AP2_DATA_KEY_PAYMENT_MANDATE in part.data
        ):
            return part.data[AP2_DATA_KEY_PAYMENT_MANDATE]
    return None


# ---------------------------------------------------------------------------
# AgentCard extension composition & header helpers
# ---------------------------------------------------------------------------


def create_payment_extensions(
    *,
    ap2_roles: Optional[List[str]] = None,
    t402_required: bool = False,
    x402_required: bool = False,
    ap2_required: bool = False,
) -> List[Dict[str, Any]]:
    """Create payment extensions array for an AgentCard."""
    extensions: List[Dict[str, Any]] = [
        asdict(create_t402_extension(t402_required)),
        asdict(create_x402_extension(x402_required)),
    ]
    if ap2_roles:
        extensions.append(
            create_ap2_extension(ap2_roles, ap2_required)
        )
    return extensions


def get_payment_extension_headers(
    include_ap2: bool = False,
) -> Dict[str, str]:
    """Get HTTP headers for A2A payment extension activation."""
    uris = [X402_A2A_EXTENSION_URI]
    if include_ap2:
        uris.append(AP2_EXTENSION_URI)
    return {A2A_EXTENSIONS_HEADER: ", ".join(uris)}
