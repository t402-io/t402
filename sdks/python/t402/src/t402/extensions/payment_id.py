"""Payment ID Extension for the t402 protocol.

Allows servers to attach unique identifiers to payments for
correlation, idempotency, and audit trails.
"""

from typing import Any, Dict, Optional
from uuid import uuid4

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


PAYMENT_ID_EXTENSION_KEY = "paymentId"

PAYMENT_ID_SCHEMA = {
    "type": "object",
    "required": ["id"],
    "properties": {
        "id": {"type": "string", "format": "uuid"},
        "clientId": {"type": "string"},
    },
}


class PaymentIdExtensionInfo(BaseModel):
    """Server-declared payment identifier information."""

    id: str
    idempotency_key: Optional[str] = None
    group_id: Optional[str] = None
    metadata: Optional[Dict[str, str]] = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class PaymentIdExtension(BaseModel):
    """Full payment ID extension structure."""

    info: PaymentIdExtensionInfo
    schema_: dict = {}

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class PaymentIdPayload(BaseModel):
    """Payment ID payload echoed back by the client."""

    id: str
    client_id: Optional[str] = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


def declare_payment_id_extension(
    *,
    id: Optional[str] = None,
    idempotency_key: Optional[str] = None,
    group_id: Optional[str] = None,
    metadata: Optional[Dict[str, str]] = None,
) -> PaymentIdExtension:
    """Declare a payment ID extension for server responses.

    Args:
        id: Custom payment ID. Defaults to a new UUID v4.
        idempotency_key: Optional idempotency key for replay protection.
        group_id: Optional payment group for batching.
        metadata: Optional key-value metadata.

    Returns:
        PaymentIdExtension ready for inclusion in response extensions.
    """
    info = PaymentIdExtensionInfo(
        id=id or str(uuid4()),
        idempotency_key=idempotency_key,
        group_id=group_id,
        metadata=metadata,
    )
    return PaymentIdExtension(info=info, schema_=PAYMENT_ID_SCHEMA)


def parse_payment_id_payload(
    extensions: Optional[Dict[str, Any]],
) -> Optional[PaymentIdPayload]:
    """Parse a payment ID payload from client request extensions.

    Args:
        extensions: Extensions dict from the payment payload.

    Returns:
        Parsed PaymentIdPayload, or None if not present.

    Raises:
        ValueError: If the payload is present but invalid.
    """
    if not extensions or PAYMENT_ID_EXTENSION_KEY not in extensions:
        return None

    raw = extensions[PAYMENT_ID_EXTENSION_KEY]
    if not isinstance(raw, dict):
        raise ValueError("Invalid paymentId extension: expected dict")

    pid = raw.get("id")
    if not isinstance(pid, str) or not pid:
        raise ValueError("Invalid paymentId extension: missing or empty id")

    return PaymentIdPayload(
        id=pid,
        client_id=raw.get("clientId"),
    )


def validate_payment_id(
    payload: PaymentIdPayload,
    expected: PaymentIdExtensionInfo,
) -> bool:
    """Validate that a client's payment ID matches the expected one.

    Args:
        payload: The client's payment ID payload.
        expected: The expected payment ID info from the server extension.

    Returns:
        True if the payment ID matches.
    """
    return payload.id == expected.id
