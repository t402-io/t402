"""Tests for A2APaymentClient."""

from t402.a2a import (
    A2APaymentClient,
    A2AMessage,
    A2AMessagePart,
    A2ATask,
    A2ATaskStatus,
    A2AArtifact,
    META_PAYMENT_STATUS,
    META_PAYMENT_REQUIRED,
    META_PAYMENT_PAYLOAD,
    X402_META_PAYMENT_STATUS,
    X402_META_PAYMENT_REQUIRED,
    X402_META_PAYMENT_PAYLOAD,
    STATUS_PAYMENT_REQUIRED,
    STATUS_PAYMENT_SUBMITTED,
    X402_PAYMENT_METHOD,
    AP2_DATA_KEY_CART_MANDATE,
    AP2_DATA_KEY_PAYMENT_MANDATE,
    PaymentCurrencyAmount,
    PaymentItem,
    AP2PaymentMethodData,
    AP2PaymentDetailsInit,
    AP2PaymentRequest,
    AP2PaymentResponse,
    CartContents,
    PaymentMandateContents,
    create_cart_mandate_with_x402,
    create_cart_mandate_data_part,
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
        {
            "scheme": "upto",
            "network": "solana:mainnet",
            "maxAmount": "2000000",
            "asset": "USDT",
            "payTo": "SolPayTo",
        },
    ],
}


def _make_payment_required_task(
    requirements=None,
):
    reqs = requirements or _REQUIREMENTS
    return A2ATask(
        kind="task",
        id="task-1",
        status=A2ATaskStatus(
            state="input-required",
            message=A2AMessage(
                kind="message",
                role="agent",
                parts=[
                    A2AMessagePart(kind="text", text="Pay up"),
                ],
                metadata={
                    META_PAYMENT_STATUS: STATUS_PAYMENT_REQUIRED,
                    META_PAYMENT_REQUIRED: reqs,
                },
            ),
        ),
    )


def _make_non_payment_task():
    return A2ATask(
        kind="task",
        id="task-2",
        status=A2ATaskStatus(
            state="completed",
            message=A2AMessage(
                kind="message",
                role="agent",
                parts=[
                    A2AMessagePart(kind="text", text="Done"),
                ],
            ),
        ),
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


def _mock_requirements_list():
    return [
        {
            "scheme": "exact",
            "network": "eip155:8453",
            "amount": "1000000",
            "asset": "USDT",
            "payTo": "0xPayTo",
        }
    ]


# ------------------------------------------------------------------
# Tests
# ------------------------------------------------------------------


class TestA2APaymentClient:
    def test_requires_payment_true(self):
        client = A2APaymentClient()
        task = _make_payment_required_task()
        assert client.requires_payment(task) is True

    def test_requires_payment_false(self):
        client = A2APaymentClient()
        task = _make_non_payment_task()
        assert client.requires_payment(task) is False

    def test_requires_payment_callback(self):
        received = []
        client = A2APaymentClient(
            on_payment_required=lambda r: received.append(r),
        )
        task = _make_payment_required_task()
        client.requires_payment(task)
        assert len(received) == 1
        assert received[0]["resource"] == "https://example.com/api"

    def test_requires_payment_callback_not_fired_when_false(self):
        received = []
        client = A2APaymentClient(
            on_payment_required=lambda r: received.append(r),
        )
        task = _make_non_payment_task()
        client.requires_payment(task)
        assert len(received) == 0

    def test_get_requirements(self):
        client = A2APaymentClient()
        task = _make_payment_required_task()
        reqs = client.get_requirements(task)
        assert reqs is not None
        assert reqs["t402Version"] == 2
        assert len(reqs["accepts"]) == 2

    def test_get_requirements_none(self):
        client = A2APaymentClient()
        task = _make_non_payment_task()
        assert client.get_requirements(task) is None

    def test_select_payment_option_default(self):
        client = A2APaymentClient()
        option = client.select_payment_option(_REQUIREMENTS)
        assert option is not None
        assert option["network"] == "eip155:8453"

    def test_select_payment_option_preferred_network(self):
        client = A2APaymentClient()
        option = client.select_payment_option(
            _REQUIREMENTS, preferred_network="solana:mainnet"
        )
        assert option is not None
        assert option["network"] == "solana:mainnet"

    def test_select_payment_option_preferred_scheme(self):
        client = A2APaymentClient()
        option = client.select_payment_option(
            _REQUIREMENTS, preferred_scheme="upto"
        )
        assert option is not None
        assert option["scheme"] == "upto"

    def test_select_payment_option_preferred_both(self):
        client = A2APaymentClient()
        option = client.select_payment_option(
            _REQUIREMENTS,
            preferred_network="solana:mainnet",
            preferred_scheme="upto",
        )
        assert option is not None
        assert option["network"] == "solana:mainnet"
        assert option["scheme"] == "upto"

    def test_select_payment_option_no_accepts(self):
        client = A2APaymentClient()
        option = client.select_payment_option({"t402Version": 2})
        assert option is None

    def test_select_payment_option_empty_accepts(self):
        client = A2APaymentClient()
        option = client.select_payment_option(
            {"t402Version": 2, "accepts": []}
        )
        assert option is None

    def test_create_payment_message(self):
        client = A2APaymentClient()
        payload = {"signature": "0xabc", "from": "0xPayer"}
        msg = client.create_payment_message(payload)
        assert msg.role == "user"
        assert msg.parts[0].text == (
            "Here is the payment authorization."
        )
        assert (
            msg.metadata[META_PAYMENT_STATUS]
            == STATUS_PAYMENT_SUBMITTED
        )
        assert msg.metadata[META_PAYMENT_PAYLOAD] == payload
        # x402 namespace also emitted
        assert (
            msg.metadata[X402_META_PAYMENT_STATUS]
            == STATUS_PAYMENT_SUBMITTED
        )
        assert msg.metadata[X402_META_PAYMENT_PAYLOAD] == payload

    def test_create_payment_message_custom_text(self):
        client = A2APaymentClient()
        msg = client.create_payment_message(
            {"sig": "0x"}, text="Pay now"
        )
        assert msg.parts[0].text == "Pay now"

    def test_create_payment_message_callback(self):
        submitted = []
        client = A2APaymentClient(
            on_payment_submitted=lambda p: submitted.append(p),
        )
        payload = {"signature": "0xabc"}
        client.create_payment_message(payload)
        assert len(submitted) == 1
        assert submitted[0] == payload

    def test_extract_embedded_requirements(self):
        client = A2APaymentClient()
        mandate = create_cart_mandate_with_x402(
            _mock_cart_contents(), _mock_requirements_list()
        )
        part = create_cart_mandate_data_part(mandate)
        task = A2ATask(
            kind="task",
            id="task-1",
            status=A2ATaskStatus(state="input-required"),
            artifacts=[
                A2AArtifact(
                    kind="ap2.cart",
                    name="Cart",
                    parts=[part],
                ),
            ],
        )
        reqs = client.extract_embedded_requirements(task)
        assert reqs is not None
        assert len(reqs) == 1
        assert reqs[0]["network"] == "eip155:8453"

    def test_extract_embedded_requirements_empty(self):
        client = A2APaymentClient()
        task = A2ATask(
            kind="task",
            id="task-1",
            status=A2ATaskStatus(state="input-required"),
        )
        assert client.extract_embedded_requirements(task) is None

    def test_extract_embedded_requirements_no_cart(self):
        client = A2APaymentClient()
        task = A2ATask(
            kind="task",
            id="task-1",
            status=A2ATaskStatus(state="input-required"),
            artifacts=[
                A2AArtifact(
                    kind="generic",
                    parts=[
                        A2AMessagePart(
                            kind="text", text="no cart"
                        ),
                    ],
                ),
            ],
        )
        assert client.extract_embedded_requirements(task) is None

    def test_create_embedded_payment_message(self):
        client = A2APaymentClient()
        payload = {
            "t402Version": 2,
            "payload": {"signature": "0xMock"},
        }
        msg = client.create_embedded_payment_message(
            _mock_mandate_contents(), payload
        )
        assert msg.role == "user"
        assert msg.parts[0].text == "Here is the payment mandate."
        assert (
            msg.metadata[META_PAYMENT_STATUS]
            == STATUS_PAYMENT_SUBMITTED
        )
        assert (
            msg.metadata[X402_META_PAYMENT_STATUS]
            == STATUS_PAYMENT_SUBMITTED
        )
        # Second part is data part with PaymentMandate
        data_part = msg.parts[1]
        assert data_part.kind == "data"
        assert AP2_DATA_KEY_PAYMENT_MANDATE in data_part.data

    def test_create_embedded_payment_message_custom_text(self):
        client = A2APaymentClient()
        msg = client.create_embedded_payment_message(
            _mock_mandate_contents(),
            {"sig": "0x"},
            text="Custom mandate text",
        )
        assert msg.parts[0].text == "Custom mandate text"

    def test_create_embedded_payment_message_with_auth(self):
        client = A2APaymentClient()
        msg = client.create_embedded_payment_message(
            _mock_mandate_contents(),
            {"sig": "0x"},
            user_authorization="vp-jwt-token",
        )
        mandate_data = msg.parts[1].data[
            AP2_DATA_KEY_PAYMENT_MANDATE
        ]
        assert (
            mandate_data["user_authorization"] == "vp-jwt-token"
        )
