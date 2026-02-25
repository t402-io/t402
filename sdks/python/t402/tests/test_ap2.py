"""Tests for AP2 embedded flow types and bridge functions."""

from t402.a2a import (
    # Constants
    AP2_EXTENSION_URI,
    X402_PAYMENT_METHOD,
    AP2_DATA_KEY_INTENT_MANDATE,
    AP2_DATA_KEY_CART_MANDATE,
    AP2_DATA_KEY_PAYMENT_MANDATE,
    AP2_DATA_KEY_PAYMENT_RECEIPT,
    T402_A2A_EXTENSION_URI,
    X402_A2A_EXTENSION_URI,
    A2A_EXTENSIONS_HEADER,
    # Types
    PaymentCurrencyAmount,
    PaymentItem,
    AP2PaymentMethodData,
    AP2PaymentDetailsInit,
    AP2PaymentRequest,
    AP2PaymentResponse,
    IntentMandate,
    CartContents,
    CartMandate,
    PaymentMandateContents,
    AP2PaymentReceipt,
    # Bridge functions
    create_cart_mandate_with_x402,
    extract_x402_requirements,
    create_payment_mandate_with_x402,
    extract_x402_payload,
    create_ap2_extension,
    # DataPart helpers
    create_cart_mandate_data_part,
    create_payment_mandate_data_part,
    create_intent_mandate_data_part,
    create_payment_receipt_data_part,
    extract_cart_mandate_from_artifact,
    extract_payment_mandate_from_message,
    # Phase 3 AgentCard extension composition & header helpers
    create_payment_extensions,
    get_payment_extension_headers,
    # Core types
    A2AMessagePart,
    A2AMessage,
    A2AArtifact,
)


# ===================================================================
# Fixtures
# ===================================================================


def _mock_requirements():
    return {
        "scheme": "exact",
        "network": "eip155:8453",
        "amount": "1000000",
        "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "payTo": "0xTestPayTo",
        "maxTimeoutSeconds": 3600,
    }


def _mock_payload():
    return {
        "t402Version": 2,
        "accepted": _mock_requirements(),
        "payload": {
            "signature": "0xMockSignature",
            "from": "0xTestPayer",
            "to": "0xTestPayTo",
            "amount": "1000000",
        },
    }


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


# ===================================================================
# Constants
# ===================================================================


def test_ap2_extension_uri():
    assert AP2_EXTENSION_URI == (
        "https://github.com/google-agentic-commerce/"
        "ap2/tree/v0.1"
    )


def test_x402_payment_method():
    assert X402_PAYMENT_METHOD == "https://www.x402.org/"


def test_ap2_data_keys():
    assert (
        AP2_DATA_KEY_INTENT_MANDATE
        == "ap2.mandates.IntentMandate"
    )
    assert (
        AP2_DATA_KEY_CART_MANDATE
        == "ap2.mandates.CartMandate"
    )
    assert (
        AP2_DATA_KEY_PAYMENT_MANDATE
        == "ap2.mandates.PaymentMandate"
    )
    assert AP2_DATA_KEY_PAYMENT_RECEIPT == "ap2.PaymentReceipt"


# ===================================================================
# CartMandate Bridge
# ===================================================================


def test_create_cart_mandate_embeds_x402():
    contents = _mock_cart_contents()
    mandate = create_cart_mandate_with_x402(
        contents, [_mock_requirements()]
    )
    assert mandate.contents.id == "cart-001"
    assert mandate.contents.merchant_name == "Test Merchant"
    x402 = None
    for m in mandate.contents.payment_request.method_data:
        if m.supported_methods == X402_PAYMENT_METHOD:
            x402 = m
    assert x402 is not None
    assert x402.data["requirements"][0] == _mock_requirements()


def test_create_cart_mandate_preserves_non_x402():
    contents = _mock_cart_contents()
    contents.payment_request.method_data.append(
        AP2PaymentMethodData(
            supported_methods="https://pay.google.com/",
            data={"type": "CARD"},
        )
    )
    mandate = create_cart_mandate_with_x402(
        contents, [_mock_requirements()]
    )
    assert len(mandate.contents.payment_request.method_data) == 2
    assert (
        mandate.contents.payment_request.method_data[0]
        .supported_methods
        == "https://pay.google.com/"
    )


def test_create_cart_mandate_includes_merchant_auth():
    mandate = create_cart_mandate_with_x402(
        _mock_cart_contents(),
        [_mock_requirements()],
        "jwt-token-here",
    )
    assert mandate.merchant_authorization == "jwt-token-here"


def test_extract_x402_requirements_round_trip():
    mandate = create_cart_mandate_with_x402(
        _mock_cart_contents(), [_mock_requirements()]
    )
    extracted = extract_x402_requirements(mandate)
    assert extracted is not None
    assert len(extracted) == 1
    assert extracted[0] == _mock_requirements()


def test_extract_x402_requirements_returns_none_for_non_x402():
    mandate = CartMandate(
        contents=CartContents(
            id="cart-001",
            user_cart_confirmation_required=False,
            payment_request=AP2PaymentRequest(
                method_data=[
                    AP2PaymentMethodData(
                        supported_methods="https://pay.google.com/",
                        data={"type": "CARD"},
                    ),
                ],
                details=AP2PaymentDetailsInit(
                    id="order-001",
                    display_items=[],
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
        ),
    )
    assert extract_x402_requirements(mandate) is None


# ===================================================================
# PaymentMandate Bridge
# ===================================================================


def test_create_payment_mandate_embeds_x402():
    mandate = create_payment_mandate_with_x402(
        _mock_mandate_contents(), _mock_payload()
    )
    assert (
        mandate.payment_mandate_contents.payment_mandate_id
        == "mandate-001"
    )
    assert (
        mandate.payment_mandate_contents.payment_response
        .method_name
        == X402_PAYMENT_METHOD
    )
    assert (
        mandate.payment_mandate_contents.payment_response
        .details
        is not None
    )


def test_create_payment_mandate_includes_user_auth():
    mandate = create_payment_mandate_with_x402(
        _mock_mandate_contents(),
        _mock_payload(),
        "verifiable-presentation-jwt",
    )
    assert mandate.user_authorization == (
        "verifiable-presentation-jwt"
    )


def test_extract_x402_payload_round_trip():
    mandate = create_payment_mandate_with_x402(
        _mock_mandate_contents(), _mock_payload()
    )
    extracted = extract_x402_payload(mandate)
    assert extracted is not None
    assert extracted["t402Version"] == 2
    assert extracted["payload"]["signature"] == "0xMockSignature"


def test_extract_x402_payload_returns_none_for_non_x402():
    mandate = create_payment_mandate_with_x402(
        _mock_mandate_contents(), _mock_payload()
    )
    mandate.payment_mandate_contents.payment_response.method_name = (
        "https://pay.google.com/"
    )
    assert extract_x402_payload(mandate) is None


# ===================================================================
# DataPart Helpers
# ===================================================================


def test_cart_mandate_data_part_round_trip():
    mandate = create_cart_mandate_with_x402(
        _mock_cart_contents(), [_mock_requirements()]
    )
    part = create_cart_mandate_data_part(mandate)
    assert part.kind == "data"
    assert AP2_DATA_KEY_CART_MANDATE in part.data

    artifact = A2AArtifact(
        kind="ap2.cart", name="Cart", parts=[part]
    )
    extracted = extract_cart_mandate_from_artifact(artifact)
    assert extracted is not None
    assert extracted["contents"]["id"] == "cart-001"


def test_payment_mandate_data_part():
    mandate = create_payment_mandate_with_x402(
        _mock_mandate_contents(), _mock_payload()
    )
    part = create_payment_mandate_data_part(mandate)
    assert part.kind == "data"
    assert AP2_DATA_KEY_PAYMENT_MANDATE in part.data


def test_extract_payment_mandate_from_message():
    mandate = create_payment_mandate_with_x402(
        _mock_mandate_contents(), _mock_payload()
    )
    message = A2AMessage(
        kind="message",
        role="user",
        parts=[
            A2AMessagePart(kind="text", text="Payment"),
            create_payment_mandate_data_part(mandate),
        ],
    )
    extracted = extract_payment_mandate_from_message(message)
    assert extracted is not None
    assert (
        extracted["payment_mandate_contents"][
            "payment_mandate_id"
        ]
        == "mandate-001"
    )


def test_intent_mandate_data_part():
    intent = IntentMandate(
        natural_language_description="Book a flight to Tokyo",
        user_cart_confirmation_required=True,
        intent_expiry="2026-12-31T23:59:59Z",
    )
    part = create_intent_mandate_data_part(intent)
    assert part.kind == "data"
    assert AP2_DATA_KEY_INTENT_MANDATE in part.data


def test_payment_receipt_data_part():
    receipt = AP2PaymentReceipt(
        payment_mandate_id="mandate-001",
        timestamp="2026-02-25T12:01:00Z",
        payment_id="tx-001",
        amount=PaymentCurrencyAmount(
            currency="USD", value=1.0
        ),
        payment_status={"merchant_confirmation_id": "conf-001"},
    )
    part = create_payment_receipt_data_part(receipt)
    assert part.kind == "data"
    assert AP2_DATA_KEY_PAYMENT_RECEIPT in part.data


def test_extract_cart_mandate_no_parts():
    artifact = A2AArtifact(kind="generic")
    assert extract_cart_mandate_from_artifact(artifact) is None


def test_extract_cart_mandate_non_ap2_parts():
    artifact = A2AArtifact(
        kind="generic",
        parts=[A2AMessagePart(kind="text", text="hello")],
    )
    assert extract_cart_mandate_from_artifact(artifact) is None


def test_extract_payment_mandate_text_only():
    message = A2AMessage(
        kind="message",
        role="user",
        parts=[
            A2AMessagePart(
                kind="text", text="No mandate here"
            ),
        ],
    )
    assert (
        extract_payment_mandate_from_message(message) is None
    )


# ===================================================================
# Extension Helper
# ===================================================================


def test_create_ap2_extension_default():
    ext = create_ap2_extension()
    assert ext["uri"] == AP2_EXTENSION_URI
    assert "merchant" in ext["description"]
    assert ext["required"] is False


def test_create_ap2_extension_multiple_roles():
    ext = create_ap2_extension(
        ["merchant", "payment-processor"], required=True
    )
    assert "merchant" in ext["description"]
    assert "payment-processor" in ext["description"]
    assert ext["required"] is True


# ===================================================================
# Type construction
# ===================================================================


def test_payment_currency_amount():
    amt = PaymentCurrencyAmount(currency="USD", value=1.0)
    assert amt.currency == "USD"
    assert amt.value == 1.0


def test_payment_item_with_pending():
    item = PaymentItem(
        label="Item",
        amount=PaymentCurrencyAmount(
            currency="USD", value=5.0
        ),
        pending=True,
    )
    assert item.pending is True


def test_cart_contents_fields():
    contents = _mock_cart_contents()
    assert contents.id == "cart-001"
    assert contents.user_cart_confirmation_required is False
    assert contents.cart_expiry == "2026-12-31T23:59:59Z"
    assert contents.merchant_name == "Test Merchant"
    assert len(
        contents.payment_request.details.display_items
    ) == 1


# ===================================================================
# Phase 3: AgentCard Extension Composition
# ===================================================================


class TestCreatePaymentExtensions:
    def test_returns_t402_x402_by_default(self):
        exts = create_payment_extensions()
        assert len(exts) == 2
        assert exts[0]["uri"] == T402_A2A_EXTENSION_URI
        assert exts[1]["uri"] == X402_A2A_EXTENSION_URI
        assert exts[0]["required"] is False
        assert exts[1]["required"] is False

    def test_includes_ap2_when_roles_specified(self):
        exts = create_payment_extensions(ap2_roles=["merchant"])
        assert len(exts) == 3
        assert exts[2]["uri"] == AP2_EXTENSION_URI
        assert "merchant" in exts[2]["description"]

    def test_respects_required_flags(self):
        exts = create_payment_extensions(
            t402_required=True,
            x402_required=True,
            ap2_roles=["shopper"],
            ap2_required=True,
        )
        assert exts[0]["required"] is True
        assert exts[1]["required"] is True
        assert exts[2]["required"] is True


# ===================================================================
# Phase 3: Payment Extension Headers
# ===================================================================


class TestGetPaymentExtensionHeaders:
    def test_returns_x402_header_by_default(self):
        headers = get_payment_extension_headers()
        assert (
            headers[A2A_EXTENSIONS_HEADER]
            == X402_A2A_EXTENSION_URI
        )

    def test_includes_ap2_when_requested(self):
        headers = get_payment_extension_headers(include_ap2=True)
        value = headers[A2A_EXTENSIONS_HEADER]
        assert X402_A2A_EXTENSION_URI in value
        assert AP2_EXTENSION_URI in value
        assert value == (
            f"{X402_A2A_EXTENSION_URI}, {AP2_EXTENSION_URI}"
        )
