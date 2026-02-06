"""A2A helper functions for t402 payment message handling."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from t402.a2a.types import (
    A2AMessage,
    A2AMessagePart,
    A2ATask,
    A2AExtension,
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
)


def is_payment_required(task: A2ATask) -> bool:
    """Check if a task is in a payment-required state."""
    if task.status.state != STATE_INPUT_REQUIRED:
        return False
    if task.status.message is None or task.status.message.metadata is None:
        return False
    return task.status.message.metadata.get(META_PAYMENT_STATUS) == STATUS_PAYMENT_REQUIRED


def is_payment_completed(task: A2ATask) -> bool:
    """Check if a task has completed payment."""
    if task.status.state != STATE_COMPLETED:
        return False
    if task.status.message is None or task.status.message.metadata is None:
        return False
    return task.status.message.metadata.get(META_PAYMENT_STATUS) == STATUS_PAYMENT_COMPLETED


def is_payment_failed(task: A2ATask) -> bool:
    """Check if a task has failed payment."""
    if task.status.state != STATE_FAILED:
        return False
    if task.status.message is None or task.status.message.metadata is None:
        return False
    return task.status.message.metadata.get(META_PAYMENT_STATUS) == STATUS_PAYMENT_FAILED


def get_payment_required(task: A2ATask) -> Optional[Dict[str, Any]]:
    """Extract payment requirements from a task."""
    if not is_payment_required(task):
        return None
    return task.status.message.metadata.get(META_PAYMENT_REQUIRED)


def get_payment_receipts(task: A2ATask) -> Optional[List[Any]]:
    """Extract payment receipts from a task."""
    if task.status.message is None or task.status.message.metadata is None:
        return None
    return task.status.message.metadata.get(META_PAYMENT_RECEIPTS)


def has_payment_payload(msg: A2AMessage) -> bool:
    """Check if a message contains a payment submission."""
    if msg.metadata is None:
        return False
    return (
        msg.metadata.get(META_PAYMENT_STATUS) == STATUS_PAYMENT_SUBMITTED
        and META_PAYMENT_PAYLOAD in msg.metadata
    )


def extract_payment_payload(msg: A2AMessage) -> Optional[Dict[str, Any]]:
    """Extract a payment payload from a message."""
    if msg.metadata is None:
        return None
    return msg.metadata.get(META_PAYMENT_PAYLOAD)


def create_payment_required_message(
    payment_required: Any,
    text: str = "Payment is required to complete this request.",
) -> A2AMessage:
    """Create an agent message requesting payment."""
    return A2AMessage(
        kind="message",
        role="agent",
        parts=[A2AMessagePart(kind="text", text=text)],
        metadata={
            META_PAYMENT_STATUS: STATUS_PAYMENT_REQUIRED,
            META_PAYMENT_REQUIRED: payment_required,
        },
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
        },
    )


def create_payment_failed_message(
    receipts: Any,
    error_code: str,
    text: str = "Payment failed.",
) -> A2AMessage:
    """Create an agent message reporting payment failure."""
    return A2AMessage(
        kind="message",
        role="agent",
        parts=[A2AMessagePart(kind="text", text=text)],
        metadata={
            META_PAYMENT_STATUS: STATUS_PAYMENT_FAILED,
            META_PAYMENT_ERROR: error_code,
            META_PAYMENT_RECEIPTS: receipts,
        },
    )


def create_t402_extension(required: bool = False) -> A2AExtension:
    """Create a T402 extension declaration for agent cards."""
    return A2AExtension(
        uri=T402_A2A_EXTENSION_URI,
        description="Supports payments using the t402 protocol for on-chain settlement.",
        required=required,
    )
