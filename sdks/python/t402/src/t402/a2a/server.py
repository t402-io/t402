"""A2A Payment Server for handling server-side payment processing."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

from t402.a2a.ap2 import (
    create_cart_mandate_data_part,
    create_cart_mandate_with_x402,
    extract_payment_mandate_from_message,
)
from t402.a2a.helpers import (
    create_payment_completed_message,
    create_payment_failed_message,
    create_payment_required_message,
)
from t402.a2a.types import (
    A2AMessage,
    A2AMessagePart,
    A2ATask,
    A2ATaskStatus,
    META_PAYMENT_PAYLOAD,
    META_PAYMENT_STATUS,
    STATUS_PAYMENT_SUBMITTED,
    X402_META_PAYMENT_PAYLOAD,
    X402_META_PAYMENT_STATUS,
)


@dataclass
class A2APaymentResult:
    """Result of payment processing."""

    success: bool
    receipts: List[Dict[str, Any]] = field(default_factory=list)
    error: Optional[str] = None
    message: Optional[A2AMessage] = None


class A2APaymentServer:
    """A2A Payment Server.

    Provides server-side payment handling for A2A agent endpoints.

    Example::

        server = A2APaymentServer(
            facilitator=facilitator_client,
            default_requirements={
                "t402Version": 2,
                "resource": "agent://my-agent/skill",
            },
        )

        requirements = server.create_requirements(
            {"accepts": [{"scheme": "exact", "network": "eip155:8453", ...}]}
        )
        task = server.create_payment_required_task(task_id, requirements)

        result = await server.process_payment(message, requirements)
        if result.success:
            ...
    """

    def __init__(
        self,
        *,
        facilitator: Any = None,
        payment_handler: Optional[Callable] = None,
        default_requirements: Optional[Dict[str, Any]] = None,
        on_payment_received: Optional[Callable] = None,
        on_payment_verified: Optional[Callable] = None,
        on_payment_settled: Optional[Callable] = None,
        on_payment_failed: Optional[Callable] = None,
    ):
        self._facilitator = facilitator
        self._payment_handler = payment_handler
        self._default_requirements = default_requirements or {}
        self._on_payment_received = on_payment_received
        self._on_payment_verified = on_payment_verified
        self._on_payment_settled = on_payment_settled
        self._on_payment_failed = on_payment_failed

    # ------------------------------------------------------------------
    # Requirement creation
    # ------------------------------------------------------------------

    def create_requirements(
        self, requirements: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Create payment requirements with defaults.

        Args:
            requirements: Partial requirements to merge with defaults.

        Returns:
            Complete payment requirements dict.
        """
        merged: Dict[str, Any] = {"t402Version": 2}
        merged.update(self._default_requirements)
        merged.update(requirements)
        return merged

    # ------------------------------------------------------------------
    # Task / status creation
    # ------------------------------------------------------------------

    def create_payment_required_status(
        self,
        requirements: Dict[str, Any],
        text: Optional[str] = None,
    ) -> A2ATaskStatus:
        """Create a payment-required task status."""
        return A2ATaskStatus(
            state="input-required",
            message=create_payment_required_message(
                requirements, text or "Payment is required to complete this request."
            ),
            timestamp=_now_iso(),
        )

    def create_payment_required_task(
        self,
        task_id: str,
        requirements: Dict[str, Any],
        text: Optional[str] = None,
    ) -> A2ATask:
        """Create a payment-required task.

        Args:
            task_id: Task identifier.
            requirements: Payment requirements.
            text: Optional text message.

        Returns:
            A2A task in ``input-required`` state.
        """
        return A2ATask(
            kind="task",
            id=task_id,
            status=self.create_payment_required_status(
                requirements, text
            ),
        )

    # ------------------------------------------------------------------
    # Payload extraction
    # ------------------------------------------------------------------

    def extract_payment_payload(
        self, message: A2AMessage
    ) -> Optional[Dict[str, Any]]:
        """Extract payment payload from an A2A message.

        Uses dual-namespace fallback (t402 preferred).
        """
        if not message.metadata:
            return None
        return message.metadata.get(
            META_PAYMENT_PAYLOAD
        ) or message.metadata.get(X402_META_PAYMENT_PAYLOAD)

    def has_payment_payload(self, message: A2AMessage) -> bool:
        """Check if a message contains a payment submission."""
        if not message.metadata:
            return False
        status = message.metadata.get(
            META_PAYMENT_STATUS
        ) or message.metadata.get(X402_META_PAYMENT_STATUS)
        payload = message.metadata.get(
            META_PAYMENT_PAYLOAD
        ) or message.metadata.get(X402_META_PAYMENT_PAYLOAD)
        return (
            status == STATUS_PAYMENT_SUBMITTED
            and payload is not None
        )

    # ------------------------------------------------------------------
    # Payment processing
    # ------------------------------------------------------------------

    async def process_payment(
        self,
        message: A2AMessage,
        requirements: Dict[str, Any],
    ) -> A2APaymentResult:
        """Process a payment submission.

        Flow:
        1. Extract payload from message metadata.
        2. If custom ``payment_handler`` is provided, delegate to it.
        3. Otherwise use ``facilitator.verify()`` then
           ``facilitator.settle()``.

        Args:
            message: A2A message containing payment payload.
            requirements: Original payment requirements.

        Returns:
            Payment processing result.
        """
        payload = self.extract_payment_payload(message)

        if payload is None:
            error = "No payment payload in message"
            if self._on_payment_failed:
                self._on_payment_failed(error)
            return A2APaymentResult(
                success=False,
                error=error,
                message=create_payment_failed_message(
                    [], "T402-1001", error
                ),
            )

        if self._on_payment_received:
            self._on_payment_received(payload)

        # Custom handler
        if self._payment_handler:
            return await self._payment_handler(
                payload, requirements
            )

        # Facilitator
        if not self._facilitator:
            error = "No facilitator or payment handler configured"
            if self._on_payment_failed:
                self._on_payment_failed(error, payload)
            return A2APaymentResult(
                success=False,
                error=error,
                message=create_payment_failed_message(
                    [], "T402-5001", error
                ),
            )

        try:
            verify_response = await self._facilitator.verify(
                payload, requirements
            )

            if not verify_response.get("isValid", False):
                error = verify_response.get(
                    "invalidReason", "Payment verification failed"
                )
                if self._on_payment_failed:
                    self._on_payment_failed(error, payload)
                return A2APaymentResult(
                    success=False,
                    error=error,
                    message=create_payment_failed_message(
                        [], "T402-2001", error
                    ),
                )

            if self._on_payment_verified:
                self._on_payment_verified(payload)

            settle_response = await self._facilitator.settle(
                payload, requirements
            )
            receipts = [settle_response]

            if not settle_response.get("success", False):
                error = settle_response.get(
                    "errorReason", "Payment settlement failed"
                )
                if self._on_payment_failed:
                    self._on_payment_failed(error, payload)
                return A2APaymentResult(
                    success=False,
                    receipts=receipts,
                    error=error,
                    message=create_payment_failed_message(
                        receipts, "T402-3001", error
                    ),
                )

            if self._on_payment_settled:
                self._on_payment_settled(receipts)

            return A2APaymentResult(
                success=True,
                receipts=receipts,
                message=create_payment_completed_message(receipts),
            )

        except Exception as exc:
            error = str(exc) or "Payment processing error"
            if self._on_payment_failed:
                self._on_payment_failed(error, payload)
            return A2APaymentResult(
                success=False,
                error=error,
                message=create_payment_failed_message(
                    [], "T402-5002", error
                ),
            )

    async def handle_payment(
        self,
        task: A2ATask,
        message: A2AMessage,
        requirements: Dict[str, Any],
    ) -> A2ATask:
        """Handle a complete payment flow for a task.

        Convenience method that processes a payment submission and
        returns an updated task.

        Args:
            task: The current A2A task.
            message: The message containing payment payload.
            requirements: Payment requirements.

        Returns:
            Updated task with payment result.
        """
        result = await self.process_payment(message, requirements)
        return self.update_task_with_payment_result(task, result)

    # ------------------------------------------------------------------
    # Result helpers
    # ------------------------------------------------------------------

    def update_task_with_payment_result(
        self,
        task: A2ATask,
        result: A2APaymentResult,
    ) -> A2ATask:
        """Update a task with payment completion.

        Args:
            task: Original task.
            result: Payment processing result.

        Returns:
            Updated task.
        """
        history = list(task.history or [])
        if result.message:
            history.append(result.message)

        if result.success:
            return A2ATask(
                kind=task.kind,
                id=task.id,
                status=self.create_payment_completed_status(
                    result.receipts
                ),
                session_id=task.session_id,
                artifacts=task.artifacts,
                history=history,
                metadata=task.metadata,
            )

        return A2ATask(
            kind=task.kind,
            id=task.id,
            status=self.create_payment_failed_status(
                result.error or "Payment failed",
                result.receipts,
            ),
            session_id=task.session_id,
            artifacts=task.artifacts,
            history=history,
            metadata=task.metadata,
        )

    def create_payment_completed_status(
        self,
        receipts: List[Dict[str, Any]],
        text: Optional[str] = None,
    ) -> A2ATaskStatus:
        """Create a completed task status with payment receipts."""
        return A2ATaskStatus(
            state="completed",
            message=create_payment_completed_message(
                receipts, text or "Payment successful."
            ),
            timestamp=_now_iso(),
        )

    def create_payment_failed_status(
        self,
        error: str,
        receipts: Optional[List[Dict[str, Any]]] = None,
        error_code: str = "T402-5000",
    ) -> A2ATaskStatus:
        """Create a failed task status with payment error."""
        return A2ATaskStatus(
            state="failed",
            message=create_payment_failed_message(
                receipts or [], error_code, error
            ),
            timestamp=_now_iso(),
        )

    # ------------------------------------------------------------------
    # Embedded (AP2) flow
    # ------------------------------------------------------------------

    def create_embedded_payment_required_task(
        self,
        task_id: str,
        cart_contents: Any,
        requirements: List[Dict[str, Any]],
        merchant_auth: Optional[str] = None,
        text: Optional[str] = None,
    ) -> A2ATask:
        """Create a payment-required task using the AP2 embedded flow.

        Returns a CartMandate as artifact instead of metadata.

        Args:
            task_id: Task identifier.
            cart_contents: CartContents dataclass.
            requirements: x402 payment requirements to embed.
            merchant_auth: Optional merchant JWT.
            text: Optional text message.

        Returns:
            A2A task with CartMandate artifact and embedded flow
            metadata.
        """
        cart_mandate = create_cart_mandate_with_x402(
            cart_contents, requirements, merchant_auth
        )
        from t402.a2a.types import A2AArtifact

        return A2ATask(
            kind="task",
            id=task_id,
            status=A2ATaskStatus(
                state="input-required",
                message=A2AMessage(
                    kind="message",
                    role="agent",
                    parts=[
                        A2AMessagePart(
                            kind="text",
                            text=text or "Payment is required.",
                        ),
                    ],
                    metadata={
                        X402_META_PAYMENT_STATUS: "payment-required",
                    },
                ),
                timestamp=_now_iso(),
            ),
            artifacts=[
                A2AArtifact(
                    kind="ap2.cart",
                    name="Cart Mandate",
                    parts=[
                        create_cart_mandate_data_part(cart_mandate)
                    ],
                ),
            ],
        )

    def extract_embedded_payload(
        self, message: A2AMessage
    ) -> Optional[Dict[str, Any]]:
        """Extract x402 PaymentPayload from an embedded-flow message.

        Scans message parts for PaymentMandate DataPart.

        Args:
            message: A2A message with PaymentMandate DataPart.

        Returns:
            x402 PaymentPayload dict or ``None``.
        """
        mandate_dict = extract_payment_mandate_from_message(message)
        if mandate_dict is None:
            return None
        return _extract_x402_payload_from_dict(mandate_dict)


# ------------------------------------------------------------------
# Internal helpers
# ------------------------------------------------------------------


def _now_iso() -> str:
    """Return current UTC time as ISO-8601 string."""
    return (
        datetime.now(timezone.utc)
        .isoformat(timespec="milliseconds")
        .replace("+00:00", "Z")
    )


def _extract_x402_payload_from_dict(
    mandate_dict: Dict[str, Any],
) -> Optional[Dict[str, Any]]:
    """Extract x402 payload from a raw PaymentMandate dict."""
    from t402.a2a.ap2 import X402_PAYMENT_METHOD

    contents = mandate_dict.get("payment_mandate_contents")
    if not isinstance(contents, dict):
        return None
    resp = contents.get("payment_response")
    if not isinstance(resp, dict):
        return None
    if resp.get("method_name") != X402_PAYMENT_METHOD:
        return None
    return resp.get("details")
