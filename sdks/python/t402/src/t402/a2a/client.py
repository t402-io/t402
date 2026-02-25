"""A2A Payment Client for handling payment flows in A2A client agents."""

from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional

from t402.a2a.ap2 import (
    create_payment_mandate_data_part,
    create_payment_mandate_with_x402,
    extract_cart_mandate_from_artifact,
)
from t402.a2a.helpers import (
    create_payment_submission_message,
    get_payment_required,
    is_payment_required,
)
from t402.a2a.types import (
    A2AMessage,
    A2AMessagePart,
    A2ATask,
    META_PAYMENT_STATUS,
    STATUS_PAYMENT_SUBMITTED,
    X402_META_PAYMENT_STATUS,
)


class A2APaymentClient:
    """A2A Payment Client.

    Provides methods for handling t402 payments in A2A client agents.

    Example::

        client = A2APaymentClient(
            on_payment_required=lambda req: print("Payment required:", req),
        )

        if client.requires_payment(task):
            requirements = client.get_requirements(task)
            option = client.select_payment_option(requirements)
            # ... sign with mechanism ...
            message = client.create_payment_message(payload)
    """

    def __init__(
        self,
        *,
        on_payment_required: Optional[Callable] = None,
        on_payment_submitted: Optional[Callable] = None,
        on_payment_completed: Optional[Callable] = None,
        on_payment_failed: Optional[Callable] = None,
    ):
        self._on_payment_required = on_payment_required
        self._on_payment_submitted = on_payment_submitted
        self._on_payment_completed = on_payment_completed
        self._on_payment_failed = on_payment_failed

    def requires_payment(self, task: A2ATask) -> bool:
        """Check if a task requires payment."""
        requires = is_payment_required(task)
        if requires:
            requirements = get_payment_required(task)
            if requirements and self._on_payment_required:
                self._on_payment_required(requirements)
        return requires

    def get_requirements(
        self, task: A2ATask
    ) -> Optional[Dict[str, Any]]:
        """Get payment requirements from a task."""
        return get_payment_required(task)

    def select_payment_option(
        self,
        requirements: Dict[str, Any],
        preferred_network: Optional[str] = None,
        preferred_scheme: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        """Select the best payment option from requirements.

        Args:
            requirements: Payment requirements dict with ``accepts`` array.
            preferred_network: Preferred network (CAIP-2 format).
            preferred_scheme: Preferred scheme (e.g. ``"exact"``).

        Returns:
            The best matching payment option or ``None``.
        """
        accepts = requirements.get("accepts")
        if not accepts or not isinstance(accepts, list):
            return None

        # Try exact match for both network and scheme
        if preferred_network and preferred_scheme:
            for a in accepts:
                if (
                    a.get("network") == preferred_network
                    and a.get("scheme") == preferred_scheme
                ):
                    return a

        # Try match for network only
        if preferred_network:
            for a in accepts:
                if a.get("network") == preferred_network:
                    return a

        # Try match for scheme only
        if preferred_scheme:
            for a in accepts:
                if a.get("scheme") == preferred_scheme:
                    return a

        # Return first option
        return accepts[0]

    def create_payment_message(
        self,
        payload: Dict[str, Any],
        text: str = "Here is the payment authorization.",
    ) -> A2AMessage:
        """Create a payment submission message.

        Args:
            payload: The payment payload to submit.
            text: Optional text message.

        Returns:
            A2A message with payment metadata.
        """
        if self._on_payment_submitted:
            self._on_payment_submitted(payload)
        return create_payment_submission_message(payload, text)

    def extract_embedded_requirements(
        self, task: A2ATask
    ) -> Optional[List[Dict[str, Any]]]:
        """Extract payment requirements from an embedded-flow task.

        Scans task artifacts for CartMandate DataPart with x402
        method data.

        Args:
            task: The A2A task with CartMandate artifacts.

        Returns:
            x402 payment requirements list or ``None``.
        """
        if not task.artifacts:
            return None
        for artifact in task.artifacts:
            cart_dict = extract_cart_mandate_from_artifact(artifact)
            if cart_dict is not None:
                return _extract_x402_from_dict(cart_dict)
        return None

    def create_embedded_payment_message(
        self,
        mandate_contents: Any,
        payload: Dict[str, Any],
        user_authorization: Optional[str] = None,
        text: str = "Here is the payment mandate.",
    ) -> A2AMessage:
        """Create a payment message for the AP2 embedded flow.

        Wraps the PaymentPayload inside a PaymentMandate DataPart.

        Args:
            mandate_contents: PaymentMandateContents dataclass.
            payload: The x402 payment payload.
            user_authorization: Optional user authorization (VP).
            text: Optional text message.

        Returns:
            A2A message with PaymentMandate DataPart.
        """
        mandate = create_payment_mandate_with_x402(
            mandate_contents,
            payload,
            user_authorization,
        )
        return A2AMessage(
            kind="message",
            role="user",
            parts=[
                A2AMessagePart(kind="text", text=text),
                create_payment_mandate_data_part(mandate),
            ],
            metadata={
                META_PAYMENT_STATUS: STATUS_PAYMENT_SUBMITTED,
                X402_META_PAYMENT_STATUS: STATUS_PAYMENT_SUBMITTED,
            },
        )


def _extract_x402_from_dict(
    cart_dict: Dict[str, Any],
) -> Optional[List[Dict[str, Any]]]:
    """Extract x402 requirements from a raw CartMandate dict."""
    contents = cart_dict.get("contents")
    if not isinstance(contents, dict):
        return None
    payment_request = contents.get("payment_request")
    if not isinstance(payment_request, dict):
        return None
    method_data = payment_request.get("method_data")
    if not isinstance(method_data, list):
        return None
    from t402.a2a.ap2 import X402_PAYMENT_METHOD

    for m in method_data:
        if not isinstance(m, dict):
            continue
        if m.get("supported_methods") == X402_PAYMENT_METHOD:
            data = m.get("data")
            if isinstance(data, dict):
                reqs = data.get("requirements")
                if isinstance(reqs, list):
                    return reqs
    return None
