"""Tests for A2APaymentServer and A2APaymentResult."""

import pytest

from t402.a2a import (
    A2APaymentResult,
    A2APaymentServer,
    A2AMessage,
    A2AMessagePart,
    A2ATask,
    A2ATaskStatus,
    META_PAYMENT_STATUS,
    META_PAYMENT_PAYLOAD,
    META_PAYMENT_RECEIPTS,
    META_PAYMENT_ERROR,
    X402_META_PAYMENT_STATUS,
    X402_META_PAYMENT_PAYLOAD,
    STATUS_PAYMENT_REQUIRED,
    STATUS_PAYMENT_SUBMITTED,
    STATUS_PAYMENT_COMPLETED,
    STATUS_PAYMENT_FAILED,
    AP2_DATA_KEY_CART_MANDATE,
    PaymentCurrencyAmount,
    PaymentItem,
    AP2PaymentDetailsInit,
    AP2PaymentRequest,
    AP2PaymentResponse,
    CartContents,
    PaymentMandateContents,
    create_payment_mandate_with_x402,
    create_payment_mandate_data_part,
)


# ------------------------------------------------------------------
# Fixtures
# ------------------------------------------------------------------

_REQUIREMENTS = {
    "t402Version": 2,
    "resource": "https://example.com/api",
    "accepts": [
        {
            "scheme": "exact",
            "network": "eip155:8453",
            "amount": "1000000",
            "asset": "USDT",
            "payTo": "0xPayTo",
        },
    ],
}

_PAYLOAD = {
    "signature": "0xMockSig",
    "from": "0xPayer",
    "amount": "1000000",
}


def _make_payment_message(
    payload=None, use_x402=False
):
    p = payload or _PAYLOAD
    if use_x402:
        metadata = {
            X402_META_PAYMENT_STATUS: STATUS_PAYMENT_SUBMITTED,
            X402_META_PAYMENT_PAYLOAD: p,
        }
    else:
        metadata = {
            META_PAYMENT_STATUS: STATUS_PAYMENT_SUBMITTED,
            META_PAYMENT_PAYLOAD: p,
        }
    return A2AMessage(
        kind="message",
        role="user",
        parts=[
            A2AMessagePart(
                kind="text", text="Here is my payment."
            ),
        ],
        metadata=metadata,
    )


def _make_empty_message():
    return A2AMessage(
        kind="message",
        role="user",
        parts=[
            A2AMessagePart(kind="text", text="Hello"),
        ],
    )


def _make_task(task_id="task-1"):
    return A2ATask(
        kind="task",
        id=task_id,
        status=A2ATaskStatus(state="input-required"),
    )


def _mock_cart_contents():
    return CartContents(
        id="cart-001",
        user_cart_confirmation_required=False,
        payment_request=AP2PaymentRequest(
            method_data=[],
            details=AP2PaymentDetailsInit(
                id="order-001",
                display_items=[
                    PaymentItem(
                        label="AI Translation",
                        amount=PaymentCurrencyAmount(
                            currency="USD", value=1.0
                        ),
                    ),
                ],
                total=PaymentItem(
                    label="Total",
                    amount=PaymentCurrencyAmount(
                        currency="USD", value=1.0
                    ),
                ),
            ),
        ),
        cart_expiry="2026-12-31T23:59:59Z",
        merchant_name="Test Merchant",
    )


def _mock_mandate_contents():
    return PaymentMandateContents(
        payment_mandate_id="mandate-001",
        payment_details_id="cart-001",
        payment_details_total=PaymentItem(
            label="Total",
            amount=PaymentCurrencyAmount(
                currency="USD", value=1.0
            ),
        ),
        payment_response=AP2PaymentResponse(
            request_id="order-001",
            method_name="",
        ),
        merchant_agent="agent://test-merchant/translate",
        timestamp="2026-02-25T12:00:00Z",
    )


class MockFacilitator:
    """Mock facilitator with configurable verify/settle results."""

    def __init__(
        self,
        verify_result=None,
        settle_result=None,
        verify_error=None,
        settle_error=None,
    ):
        self.verify_result = verify_result or {
            "isValid": True,
        }
        self.settle_result = settle_result or {
            "success": True,
            "txHash": "0xabc",
        }
        self.verify_error = verify_error
        self.settle_error = settle_error
        self.verify_calls = []
        self.settle_calls = []

    async def verify(self, payload, requirements):
        self.verify_calls.append((payload, requirements))
        if self.verify_error:
            raise self.verify_error
        return self.verify_result

    async def settle(self, payload, requirements):
        self.settle_calls.append((payload, requirements))
        if self.settle_error:
            raise self.settle_error
        return self.settle_result


# ------------------------------------------------------------------
# Tests
# ------------------------------------------------------------------


class TestA2APaymentResult:
    def test_default_fields(self):
        result = A2APaymentResult(success=True)
        assert result.success is True
        assert result.receipts == []
        assert result.error is None
        assert result.message is None

    def test_with_all_fields(self):
        msg = _make_empty_message()
        result = A2APaymentResult(
            success=False,
            receipts=[{"txHash": "0x"}],
            error="fail",
            message=msg,
        )
        assert result.success is False
        assert len(result.receipts) == 1
        assert result.error == "fail"
        assert result.message is msg


class TestA2APaymentServer:
    def test_create_requirements_merge(self):
        server = A2APaymentServer(
            default_requirements={
                "resource": "agent://default",
            }
        )
        reqs = server.create_requirements(
            {"accepts": [{"scheme": "exact"}]}
        )
        assert reqs["t402Version"] == 2
        assert reqs["resource"] == "agent://default"
        assert reqs["accepts"] == [{"scheme": "exact"}]

    def test_create_requirements_override_defaults(self):
        server = A2APaymentServer(
            default_requirements={
                "resource": "agent://default",
            }
        )
        reqs = server.create_requirements(
            {"resource": "agent://override"}
        )
        assert reqs["resource"] == "agent://override"

    def test_create_requirements_no_defaults(self):
        server = A2APaymentServer()
        reqs = server.create_requirements(
            {"accepts": [{"scheme": "exact"}]}
        )
        assert reqs["t402Version"] == 2
        assert reqs["accepts"] == [{"scheme": "exact"}]

    def test_create_payment_required_task(self):
        server = A2APaymentServer()
        task = server.create_payment_required_task(
            "task-1", _REQUIREMENTS
        )
        assert task.kind == "task"
        assert task.id == "task-1"
        assert task.status.state == "input-required"
        assert task.status.message is not None
        assert (
            task.status.message.metadata[META_PAYMENT_STATUS]
            == STATUS_PAYMENT_REQUIRED
        )
        assert task.status.timestamp is not None

    def test_create_payment_required_task_custom_text(self):
        server = A2APaymentServer()
        task = server.create_payment_required_task(
            "task-1", _REQUIREMENTS, text="Please pay."
        )
        assert task.status.message.parts[0].text == "Please pay."

    def test_extract_payment_payload_t402(self):
        server = A2APaymentServer()
        msg = _make_payment_message()
        payload = server.extract_payment_payload(msg)
        assert payload is not None
        assert payload["signature"] == "0xMockSig"

    def test_extract_payment_payload_x402_fallback(self):
        server = A2APaymentServer()
        msg = _make_payment_message(use_x402=True)
        payload = server.extract_payment_payload(msg)
        assert payload is not None
        assert payload["signature"] == "0xMockSig"

    def test_extract_payment_payload_none(self):
        server = A2APaymentServer()
        msg = _make_empty_message()
        assert server.extract_payment_payload(msg) is None

    def test_has_payment_payload_true(self):
        server = A2APaymentServer()
        msg = _make_payment_message()
        assert server.has_payment_payload(msg) is True

    def test_has_payment_payload_false_no_metadata(self):
        server = A2APaymentServer()
        msg = _make_empty_message()
        assert server.has_payment_payload(msg) is False

    def test_has_payment_payload_false_wrong_status(self):
        server = A2APaymentServer()
        msg = A2AMessage(
            kind="message",
            role="user",
            parts=[],
            metadata={
                META_PAYMENT_STATUS: STATUS_PAYMENT_COMPLETED,
                META_PAYMENT_PAYLOAD: _PAYLOAD,
            },
        )
        assert server.has_payment_payload(msg) is False

    @pytest.mark.asyncio
    async def test_process_payment_success(self):
        facilitator = MockFacilitator()
        server = A2APaymentServer(facilitator=facilitator)
        msg = _make_payment_message()
        result = await server.process_payment(
            msg, _REQUIREMENTS
        )
        assert result.success is True
        assert len(result.receipts) == 1
        assert result.receipts[0]["txHash"] == "0xabc"
        assert result.message is not None
        assert (
            result.message.metadata[META_PAYMENT_STATUS]
            == STATUS_PAYMENT_COMPLETED
        )
        assert len(facilitator.verify_calls) == 1
        assert len(facilitator.settle_calls) == 1

    @pytest.mark.asyncio
    async def test_process_payment_verify_fail(self):
        facilitator = MockFacilitator(
            verify_result={
                "isValid": False,
                "invalidReason": "Bad signature",
            }
        )
        server = A2APaymentServer(facilitator=facilitator)
        msg = _make_payment_message()
        result = await server.process_payment(
            msg, _REQUIREMENTS
        )
        assert result.success is False
        assert result.error == "Bad signature"
        assert result.message is not None
        assert (
            result.message.metadata[META_PAYMENT_ERROR]
            == "T402-2001"
        )

    @pytest.mark.asyncio
    async def test_process_payment_settle_fail(self):
        facilitator = MockFacilitator(
            settle_result={
                "success": False,
                "errorReason": "Insufficient funds",
            }
        )
        server = A2APaymentServer(facilitator=facilitator)
        msg = _make_payment_message()
        result = await server.process_payment(
            msg, _REQUIREMENTS
        )
        assert result.success is False
        assert result.error == "Insufficient funds"
        assert len(result.receipts) == 1
        assert (
            result.message.metadata[META_PAYMENT_ERROR]
            == "T402-3001"
        )

    @pytest.mark.asyncio
    async def test_process_payment_no_payload(self):
        server = A2APaymentServer(
            facilitator=MockFacilitator()
        )
        msg = _make_empty_message()
        result = await server.process_payment(
            msg, _REQUIREMENTS
        )
        assert result.success is False
        assert result.error == "No payment payload in message"
        assert (
            result.message.metadata[META_PAYMENT_ERROR]
            == "T402-1001"
        )

    @pytest.mark.asyncio
    async def test_process_payment_no_facilitator(self):
        server = A2APaymentServer()
        msg = _make_payment_message()
        result = await server.process_payment(
            msg, _REQUIREMENTS
        )
        assert result.success is False
        assert "No facilitator" in result.error
        assert (
            result.message.metadata[META_PAYMENT_ERROR]
            == "T402-5001"
        )

    @pytest.mark.asyncio
    async def test_process_payment_custom_handler(self):
        custom_result = A2APaymentResult(
            success=True,
            receipts=[{"custom": True}],
            message=A2AMessage(
                kind="message",
                role="agent",
                parts=[
                    A2AMessagePart(
                        kind="text", text="Custom OK"
                    ),
                ],
            ),
        )

        async def handler(payload, requirements):
            return custom_result

        server = A2APaymentServer(payment_handler=handler)
        msg = _make_payment_message()
        result = await server.process_payment(
            msg, _REQUIREMENTS
        )
        assert result.success is True
        assert result.receipts[0]["custom"] is True

    @pytest.mark.asyncio
    async def test_process_payment_exception(self):
        facilitator = MockFacilitator(
            verify_error=RuntimeError("Connection timeout")
        )
        server = A2APaymentServer(facilitator=facilitator)
        msg = _make_payment_message()
        result = await server.process_payment(
            msg, _REQUIREMENTS
        )
        assert result.success is False
        assert "Connection timeout" in result.error
        assert (
            result.message.metadata[META_PAYMENT_ERROR]
            == "T402-5002"
        )

    @pytest.mark.asyncio
    async def test_handle_payment(self):
        facilitator = MockFacilitator()
        server = A2APaymentServer(facilitator=facilitator)
        task = _make_task()
        msg = _make_payment_message()
        updated = await server.handle_payment(
            task, msg, _REQUIREMENTS
        )
        assert updated.id == "task-1"
        assert updated.status.state == "completed"
        assert updated.history is not None
        assert len(updated.history) == 1

    @pytest.mark.asyncio
    async def test_handle_payment_failure(self):
        facilitator = MockFacilitator(
            verify_result={"isValid": False}
        )
        server = A2APaymentServer(facilitator=facilitator)
        task = _make_task()
        msg = _make_payment_message()
        updated = await server.handle_payment(
            task, msg, _REQUIREMENTS
        )
        assert updated.status.state == "failed"

    def test_update_task_with_payment_result_success(self):
        server = A2APaymentServer()
        task = _make_task()
        result = A2APaymentResult(
            success=True,
            receipts=[{"txHash": "0xdef"}],
            message=A2AMessage(
                kind="message",
                role="agent",
                parts=[
                    A2AMessagePart(
                        kind="text", text="OK"
                    ),
                ],
            ),
        )
        updated = server.update_task_with_payment_result(
            task, result
        )
        assert updated.status.state == "completed"
        assert updated.history is not None
        assert len(updated.history) == 1
        assert (
            updated.status.message.metadata[
                META_PAYMENT_STATUS
            ]
            == STATUS_PAYMENT_COMPLETED
        )

    def test_update_task_with_payment_result_failure(self):
        server = A2APaymentServer()
        task = _make_task()
        result = A2APaymentResult(
            success=False,
            error="Bad sig",
            message=A2AMessage(
                kind="message",
                role="agent",
                parts=[
                    A2AMessagePart(
                        kind="text", text="Fail"
                    ),
                ],
            ),
        )
        updated = server.update_task_with_payment_result(
            task, result
        )
        assert updated.status.state == "failed"
        assert updated.history is not None
        assert len(updated.history) == 1

    def test_update_task_preserves_existing_history(self):
        server = A2APaymentServer()
        existing_msg = A2AMessage(
            kind="message",
            role="user",
            parts=[A2AMessagePart(kind="text", text="Old")],
        )
        task = A2ATask(
            kind="task",
            id="task-1",
            status=A2ATaskStatus(state="input-required"),
            history=[existing_msg],
        )
        result = A2APaymentResult(
            success=True,
            receipts=[],
            message=A2AMessage(
                kind="message",
                role="agent",
                parts=[
                    A2AMessagePart(
                        kind="text", text="New"
                    ),
                ],
            ),
        )
        updated = server.update_task_with_payment_result(
            task, result
        )
        assert len(updated.history) == 2

    def test_create_payment_completed_status(self):
        server = A2APaymentServer()
        status = server.create_payment_completed_status(
            [{"txHash": "0xabc"}]
        )
        assert status.state == "completed"
        assert (
            status.message.metadata[META_PAYMENT_STATUS]
            == STATUS_PAYMENT_COMPLETED
        )
        assert (
            len(status.message.metadata[META_PAYMENT_RECEIPTS])
            == 1
        )
        assert status.timestamp is not None

    def test_create_payment_failed_status(self):
        server = A2APaymentServer()
        status = server.create_payment_failed_status(
            "Something went wrong", error_code="T402-3001"
        )
        assert status.state == "failed"
        assert (
            status.message.metadata[META_PAYMENT_STATUS]
            == STATUS_PAYMENT_FAILED
        )
        assert (
            status.message.metadata[META_PAYMENT_ERROR]
            == "T402-3001"
        )

    def test_create_embedded_payment_required_task(self):
        server = A2APaymentServer()
        reqs_list = [
            {
                "scheme": "exact",
                "network": "eip155:8453",
                "amount": "1000000",
            }
        ]
        task = server.create_embedded_payment_required_task(
            "task-1",
            _mock_cart_contents(),
            reqs_list,
        )
        assert task.kind == "task"
        assert task.id == "task-1"
        assert task.status.state == "input-required"
        assert (
            task.status.message.metadata[
                X402_META_PAYMENT_STATUS
            ]
            == "payment-required"
        )
        assert task.artifacts is not None
        assert len(task.artifacts) == 1
        assert task.artifacts[0].kind == "ap2.cart"
        # Cart mandate data part present
        data_part = task.artifacts[0].parts[0]
        assert data_part.kind == "data"
        assert AP2_DATA_KEY_CART_MANDATE in data_part.data

    def test_create_embedded_payment_required_task_custom_text(
        self,
    ):
        server = A2APaymentServer()
        task = server.create_embedded_payment_required_task(
            "task-1",
            _mock_cart_contents(),
            [],
            text="Custom embedded text",
        )
        assert (
            task.status.message.parts[0].text
            == "Custom embedded text"
        )

    def test_extract_embedded_payload(self):
        server = A2APaymentServer()
        payload = {
            "t402Version": 2,
            "payload": {"signature": "0xMock"},
        }
        mandate = create_payment_mandate_with_x402(
            _mock_mandate_contents(), payload
        )
        msg = A2AMessage(
            kind="message",
            role="user",
            parts=[
                A2AMessagePart(kind="text", text="Pay"),
                create_payment_mandate_data_part(mandate),
            ],
        )
        extracted = server.extract_embedded_payload(msg)
        assert extracted is not None
        assert extracted["t402Version"] == 2
        assert (
            extracted["payload"]["signature"] == "0xMock"
        )

    def test_extract_embedded_payload_none(self):
        server = A2APaymentServer()
        msg = _make_empty_message()
        assert server.extract_embedded_payload(msg) is None

    @pytest.mark.asyncio
    async def test_callbacks_fired(self):
        received = []
        verified = []
        settled = []
        failed = []

        facilitator = MockFacilitator()
        server = A2APaymentServer(
            facilitator=facilitator,
            on_payment_received=lambda p: received.append(p),
            on_payment_verified=lambda p: verified.append(p),
            on_payment_settled=lambda r: settled.append(r),
            on_payment_failed=lambda *a: failed.append(a),
        )
        msg = _make_payment_message()
        result = await server.process_payment(
            msg, _REQUIREMENTS
        )
        assert result.success is True
        assert len(received) == 1
        assert len(verified) == 1
        assert len(settled) == 1
        assert len(failed) == 0

    @pytest.mark.asyncio
    async def test_callbacks_fired_on_failure(self):
        failed = []
        facilitator = MockFacilitator(
            verify_result={"isValid": False}
        )
        server = A2APaymentServer(
            facilitator=facilitator,
            on_payment_failed=lambda *a: failed.append(a),
        )
        msg = _make_payment_message()
        await server.process_payment(msg, _REQUIREMENTS)
        assert len(failed) == 1
