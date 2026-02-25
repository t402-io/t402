"""A2A helper functions for t402 payment message handling."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from t402.a2a.types import (
    A2AExtension,
    A2AMessage,
    A2AMessagePart,
    A2ATask,
    CAIP2_TO_FLAT_NAME,
    META_PAYMENT_ERROR,
    META_PAYMENT_PAYLOAD,
    META_PAYMENT_RECEIPTS,
    META_PAYMENT_REQUIRED,
    META_PAYMENT_STATUS,
    STATUS_PAYMENT_COMPLETED,
    STATUS_PAYMENT_FAILED,
    STATUS_PAYMENT_REQUIRED,
    STATUS_PAYMENT_SUBMITTED,
    STATE_COMPLETED,
    STATE_FAILED,
    STATE_INPUT_REQUIRED,
    T402_A2A_EXTENSION_URI,
    T402_TO_X402_ERROR_MAP,
    X402_A2A_EXTENSION_URI,
    X402_META_PAYMENT_ERROR,
    X402_META_PAYMENT_PAYLOAD,
    X402_META_PAYMENT_RECEIPTS,
    X402_META_PAYMENT_REQUIRED,
    X402_META_PAYMENT_STATUS,
)


def _get_meta(
    metadata: Optional[Dict[str, Any]],
    t402_key: str,
    x402_key: str,
) -> Any:
    """Read a value from metadata with t402/x402 dual-namespace fallback."""
    if metadata is None:
        return None
    val = metadata.get(t402_key)
    if val is not None:
        return val
    return metadata.get(x402_key)


def is_payment_required(task: A2ATask) -> bool:
    """Check if a task is in a payment-required state."""
    if task.status.state != STATE_INPUT_REQUIRED:
        return False
    if (
        task.status.message is None
        or task.status.message.metadata is None
    ):
        return False
    return (
        _get_meta(
            task.status.message.metadata,
            META_PAYMENT_STATUS,
            X402_META_PAYMENT_STATUS,
        )
        == STATUS_PAYMENT_REQUIRED
    )


def is_payment_completed(task: A2ATask) -> bool:
    """Check if a task has completed payment."""
    if task.status.state != STATE_COMPLETED:
        return False
    if (
        task.status.message is None
        or task.status.message.metadata is None
    ):
        return False
    return (
        _get_meta(
            task.status.message.metadata,
            META_PAYMENT_STATUS,
            X402_META_PAYMENT_STATUS,
        )
        == STATUS_PAYMENT_COMPLETED
    )


def is_payment_failed(task: A2ATask) -> bool:
    """Check if a task has failed payment."""
    if task.status.state != STATE_FAILED:
        return False
    if (
        task.status.message is None
        or task.status.message.metadata is None
    ):
        return False
    return (
        _get_meta(
            task.status.message.metadata,
            META_PAYMENT_STATUS,
            X402_META_PAYMENT_STATUS,
        )
        == STATUS_PAYMENT_FAILED
    )


def get_payment_required(task: A2ATask) -> Optional[Dict[str, Any]]:
    """Extract payment requirements from a task."""
    if not is_payment_required(task):
        return None
    return _get_meta(
        task.status.message.metadata,
        META_PAYMENT_REQUIRED,
        X402_META_PAYMENT_REQUIRED,
    )


def get_payment_receipts(task: A2ATask) -> Optional[List[Any]]:
    """Extract payment receipts from a task."""
    if (
        task.status.message is None
        or task.status.message.metadata is None
    ):
        return None
    return _get_meta(
        task.status.message.metadata,
        META_PAYMENT_RECEIPTS,
        X402_META_PAYMENT_RECEIPTS,
    )


def has_payment_payload(msg: A2AMessage) -> bool:
    """Check if a message contains a payment submission."""
    if msg.metadata is None:
        return False
    status = _get_meta(
        msg.metadata,
        META_PAYMENT_STATUS,
        X402_META_PAYMENT_STATUS,
    )
    has_payload = (
        META_PAYMENT_PAYLOAD in msg.metadata
        or X402_META_PAYMENT_PAYLOAD in msg.metadata
    )
    return status == STATUS_PAYMENT_SUBMITTED and has_payload


def extract_payment_payload(msg: A2AMessage) -> Optional[Dict[str, Any]]:
    """Extract a payment payload from a message."""
    if msg.metadata is None:
        return None
    return _get_meta(
        msg.metadata,
        META_PAYMENT_PAYLOAD,
        X402_META_PAYMENT_PAYLOAD,
    )


def map_t402_error_to_x402(code: str) -> str:
    """Map a T402 error code to an x402 v0.2 error code."""
    return T402_TO_X402_ERROR_MAP.get(code, "SETTLEMENT_FAILED")


def downgrade_requirements_to_x402(
    requirements: Any,
) -> Optional[Dict[str, Any]]:
    """Downgrade T402 V2 requirements to x402 V1 format.

    Filters to EVM + exact scheme only and converts CAIP-2 network
    identifiers to flat names. Returns None if no EVM+exact accepts
    remain after filtering.
    """
    if not isinstance(requirements, dict):
        return None
    accepts = requirements.get("accepts")
    if not isinstance(accepts, list):
        return None
    x402_accepts: List[Dict[str, Any]] = []
    for accept in accepts:
        if not isinstance(accept, dict):
            continue
        scheme = accept.get("scheme")
        network = accept.get("network")
        if scheme != "exact":
            continue
        if not isinstance(network, str):
            continue
        flat_name = CAIP2_TO_FLAT_NAME.get(network)
        if flat_name is None:
            continue
        entry: Dict[str, Any] = {}
        for key, value in accept.items():
            if key == "network":
                entry["network"] = flat_name
            else:
                entry[key] = value
        x402_accepts.append(entry)
    if not x402_accepts:
        return None
    return {"x402Version": 1, "accepts": x402_accepts}


def is_standalone_flow(task: A2ATask) -> bool:
    """Check if the task uses x402 standalone flow.

    Standalone: x402.payment.status AND x402.payment.required both present.
    """
    if (
        task.status.message is None
        or task.status.message.metadata is None
    ):
        return False
    meta = task.status.message.metadata
    return (
        X402_META_PAYMENT_STATUS in meta
        and X402_META_PAYMENT_REQUIRED in meta
    )


def is_embedded_flow(task: A2ATask) -> bool:
    """Check if the task uses x402 embedded flow.

    Embedded: x402.payment.status present but NO x402.payment.required.
    """
    if (
        task.status.message is None
        or task.status.message.metadata is None
    ):
        return False
    meta = task.status.message.metadata
    return (
        X402_META_PAYMENT_STATUS in meta
        and X402_META_PAYMENT_REQUIRED not in meta
    )


def create_payment_required_message(
    payment_required: Any,
    text: str = "Payment is required to complete this request.",
) -> A2AMessage:
    """Create an agent message requesting payment."""
    x402_downgraded = downgrade_requirements_to_x402(payment_required)
    metadata: Dict[str, Any] = {
        META_PAYMENT_STATUS: STATUS_PAYMENT_REQUIRED,
        META_PAYMENT_REQUIRED: payment_required,
        X402_META_PAYMENT_STATUS: STATUS_PAYMENT_REQUIRED,
    }
    if x402_downgraded is not None:
        metadata[X402_META_PAYMENT_REQUIRED] = x402_downgraded
    return A2AMessage(
        kind="message",
        role="agent",
        parts=[A2AMessagePart(kind="text", text=text)],
        metadata=metadata,
    )


def create_payment_submission_message(
    payment_payload: Any,
    text: str = "Here is the payment authorization.",
) -> A2AMessage:
    """Create a user message submitting payment."""
    return A2AMessage(
        kind="message",
        role="user",
        parts=[A2AMessagePart(kind="text", text=text)],
        metadata={
            META_PAYMENT_STATUS: STATUS_PAYMENT_SUBMITTED,
            META_PAYMENT_PAYLOAD: payment_payload,
            X402_META_PAYMENT_STATUS: STATUS_PAYMENT_SUBMITTED,
            X402_META_PAYMENT_PAYLOAD: payment_payload,
        },
    )


def create_payment_completed_message(
    receipts: Any,
    text: str = "Payment successful.",
) -> A2AMessage:
    """Create an agent message confirming payment."""
    return A2AMessage(
        kind="message",
        role="agent",
        parts=[A2AMessagePart(kind="text", text=text)],
        metadata={
            META_PAYMENT_STATUS: STATUS_PAYMENT_COMPLETED,
            META_PAYMENT_RECEIPTS: receipts,
            X402_META_PAYMENT_STATUS: STATUS_PAYMENT_COMPLETED,
            X402_META_PAYMENT_RECEIPTS: receipts,
        },
    )


def create_payment_failed_message(
    receipts: Any,
    error_code: str,
    text: str = "Payment failed.",
) -> A2AMessage:
    """Create an agent message reporting payment failure."""
    x402_error = map_t402_error_to_x402(error_code)
    return A2AMessage(
        kind="message",
        role="agent",
        parts=[A2AMessagePart(kind="text", text=text)],
        metadata={
            META_PAYMENT_STATUS: STATUS_PAYMENT_FAILED,
            META_PAYMENT_ERROR: error_code,
            META_PAYMENT_RECEIPTS: receipts,
            X402_META_PAYMENT_STATUS: STATUS_PAYMENT_FAILED,
            X402_META_PAYMENT_ERROR: x402_error,
            X402_META_PAYMENT_RECEIPTS: receipts,
        },
    )


def create_t402_extension(required: bool = False) -> A2AExtension:
    """Create a T402 extension declaration for agent cards."""
    return A2AExtension(
        uri=T402_A2A_EXTENSION_URI,
        description=(
            "T402 multi-chain payment protocol"
            " (12 mechanisms, 44 networks)."
        ),
        required=required,
    )


def create_x402_extension(required: bool = False) -> A2AExtension:
    """Create an x402 extension declaration for agent cards."""
    return A2AExtension(
        uri=X402_A2A_EXTENSION_URI,
        description=(
            "x402 compatibility layer for EVM payments."
        ),
        required=required,
    )
