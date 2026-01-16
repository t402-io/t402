"""Tests for V2 protocol types and encoding/decoding."""

import pytest

from t402 import (
    # Version constants
    T402_VERSION,
    T402_VERSION_V1,
    T402_VERSION_V2,
    # V2 Types
    ResourceInfo,
    PaymentRequirementsV2,
    PaymentRequiredV2,
    PaymentPayloadV2,
    PaymentResponseV2,
    SupportedKind,
    SupportedResponse,
    # V1 Types (for compatibility)
    PaymentRequirements,
    PaymentRequirementsV1,
    PaymentPayload,
    PaymentPayloadV1,
    # Encoding functions
    encode_payment_signature_header,
    decode_payment_signature_header,
    encode_payment_required_header,
    decode_payment_required_header,
    encode_payment_response_header,
    decode_payment_response_header,
    # Header detection
    detect_protocol_version_from_headers,
    extract_payment_from_headers,
    extract_payment_required_from_response,
    get_payment_header_name,
    get_payment_response_header_name,
    # Header constants
    HEADER_PAYMENT_SIGNATURE,
    HEADER_PAYMENT_REQUIRED,
    HEADER_PAYMENT_RESPONSE,
    HEADER_X_PAYMENT,
    HEADER_X_PAYMENT_RESPONSE,
)


class TestVersionConstants:
    """Test protocol version constants."""

    def test_version_constants_exist(self):
        assert T402_VERSION_V1 == 1
        assert T402_VERSION_V2 == 2
        assert T402_VERSION == 2  # V2 is now the default

    def test_header_constants(self):
        assert HEADER_PAYMENT_SIGNATURE == "PAYMENT-SIGNATURE"
        assert HEADER_PAYMENT_REQUIRED == "PAYMENT-REQUIRED"
        assert HEADER_PAYMENT_RESPONSE == "PAYMENT-RESPONSE"
        assert HEADER_X_PAYMENT == "X-PAYMENT"
        assert HEADER_X_PAYMENT_RESPONSE == "X-PAYMENT-RESPONSE"


class TestResourceInfo:
    """Test ResourceInfo V2 type."""

    def test_create_resource_info(self):
        resource = ResourceInfo(
            url="https://example.com/api/data",
            description="Test API endpoint",
            mime_type="application/json",
        )
        assert resource.url == "https://example.com/api/data"
        assert resource.description == "Test API endpoint"
        assert resource.mime_type == "application/json"

    def test_resource_info_serialization(self):
        resource = ResourceInfo(
            url="https://example.com/api",
            description="API",
            mime_type="application/json",
        )
        data = resource.model_dump(by_alias=True)
        assert data["url"] == "https://example.com/api"
        assert data["mimeType"] == "application/json"

    def test_resource_info_defaults(self):
        resource = ResourceInfo(url="https://example.com")
        assert resource.description == ""
        assert resource.mime_type == ""


class TestPaymentRequirementsV2:
    """Test PaymentRequirementsV2 type."""

    def test_create_payment_requirements_v2(self):
        req = PaymentRequirementsV2(
            scheme="exact",
            network="eip155:8453",
            asset="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            amount="1000000",
            pay_to="0x1234567890123456789012345678901234567890",
            max_timeout_seconds=300,
        )
        assert req.scheme == "exact"
        assert req.network == "eip155:8453"
        assert req.amount == "1000000"
        assert req.max_timeout_seconds == 300

    def test_payment_requirements_v2_with_extra(self):
        req = PaymentRequirementsV2(
            scheme="exact",
            network="eip155:8453",
            asset="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
            amount="1000000",
            pay_to="0x1234567890123456789012345678901234567890",
            max_timeout_seconds=300,
            extra={"name": "USDC", "version": "2"},
        )
        assert req.extra["name"] == "USDC"
        assert req.extra["version"] == "2"

    def test_payment_requirements_v2_serialization(self):
        req = PaymentRequirementsV2(
            scheme="exact",
            network="eip155:8453",
            asset="0xUSDC",
            amount="1000000",
            pay_to="0xPayTo",
            max_timeout_seconds=300,
        )
        data = req.model_dump(by_alias=True)
        assert data["payTo"] == "0xPayTo"
        assert data["maxTimeoutSeconds"] == 300

    def test_payment_requirements_v2_invalid_amount(self):
        with pytest.raises(ValueError, match="amount must be an integer"):
            PaymentRequirementsV2(
                scheme="exact",
                network="eip155:8453",
                asset="0xUSDC",
                amount="invalid",
                pay_to="0xPayTo",
                max_timeout_seconds=300,
            )


class TestPaymentRequiredV2:
    """Test PaymentRequiredV2 type."""

    def test_create_payment_required_v2(self):
        resource = ResourceInfo(url="https://example.com/api")
        req = PaymentRequirementsV2(
            scheme="exact",
            network="eip155:8453",
            asset="0xUSDC",
            amount="1000000",
            pay_to="0xPayTo",
            max_timeout_seconds=300,
        )
        payment_required = PaymentRequiredV2(
            resource=resource,
            accepts=[req],
            error="Payment required",
        )
        assert payment_required.t402_version == 2
        assert payment_required.resource.url == "https://example.com/api"
        assert len(payment_required.accepts) == 1
        assert payment_required.error == "Payment required"

    def test_payment_required_v2_with_extensions(self):
        resource = ResourceInfo(url="https://example.com/api")
        req = PaymentRequirementsV2(
            scheme="exact",
            network="eip155:8453",
            asset="0xUSDC",
            amount="1000000",
            pay_to="0xPayTo",
            max_timeout_seconds=300,
        )
        payment_required = PaymentRequiredV2(
            resource=resource,
            accepts=[req],
            extensions={"session": {"token": "abc123"}},
        )
        assert payment_required.extensions["session"]["token"] == "abc123"


class TestPaymentPayloadV2:
    """Test PaymentPayloadV2 type."""

    def test_create_payment_payload_v2(self):
        resource = ResourceInfo(url="https://example.com/api")
        accepted = PaymentRequirementsV2(
            scheme="exact",
            network="eip155:8453",
            asset="0xUSDC",
            amount="1000000",
            pay_to="0xPayTo",
            max_timeout_seconds=300,
        )
        payload = PaymentPayloadV2(
            resource=resource,
            accepted=accepted,
            payload={"signature": "0xabc..."},
        )
        assert payload.t402_version == 2
        assert payload.resource.url == "https://example.com/api"
        assert payload.accepted.scheme == "exact"
        assert payload.payload["signature"] == "0xabc..."


class TestSupportedTypes:
    """Test facilitator supported types."""

    def test_supported_kind(self):
        kind = SupportedKind(
            t402_version=2,
            scheme="exact",
            network="eip155:8453",
            extra={"name": "USDC"},
        )
        assert kind.t402_version == 2
        assert kind.scheme == "exact"
        assert kind.network == "eip155:8453"

    def test_supported_response(self):
        kind = SupportedKind(
            t402_version=2,
            scheme="exact",
            network="eip155:8453",
        )
        response = SupportedResponse(
            kinds=[kind],
            extensions=["session"],
            signers={"eip155:*": ["0x123", "0x456"]},
        )
        assert len(response.kinds) == 1
        assert "session" in response.extensions
        assert "eip155:*" in response.signers


class TestV2Encoding:
    """Test V2 header encoding/decoding."""

    def test_encode_decode_payment_required(self):
        resource = ResourceInfo(url="https://example.com/api")
        req = PaymentRequirementsV2(
            scheme="exact",
            network="eip155:8453",
            asset="0xUSDC",
            amount="1000000",
            pay_to="0xPayTo",
            max_timeout_seconds=300,
        )
        payment_required = PaymentRequiredV2(
            resource=resource,
            accepts=[req],
            error="Payment required",
        )

        # Encode
        encoded = encode_payment_required_header(payment_required)
        assert isinstance(encoded, str)
        assert len(encoded) > 0

        # Decode
        decoded = decode_payment_required_header(encoded)
        assert decoded["t402Version"] == 2
        assert decoded["resource"]["url"] == "https://example.com/api"
        assert decoded["accepts"][0]["scheme"] == "exact"

    def test_encode_decode_payment_signature(self):
        resource = ResourceInfo(url="https://example.com/api")
        accepted = PaymentRequirementsV2(
            scheme="exact",
            network="eip155:8453",
            asset="0xUSDC",
            amount="1000000",
            pay_to="0xPayTo",
            max_timeout_seconds=300,
        )
        payload = PaymentPayloadV2(
            resource=resource,
            accepted=accepted,
            payload={"signature": "0xabc123"},
        )

        # Encode
        encoded = encode_payment_signature_header(payload)
        assert isinstance(encoded, str)

        # Decode
        decoded = decode_payment_signature_header(encoded)
        assert decoded["t402Version"] == 2
        assert decoded["payload"]["signature"] == "0xabc123"

    def test_encode_decode_payment_response(self):
        req = PaymentRequirementsV2(
            scheme="exact",
            network="eip155:8453",
            asset="0xUSDC",
            amount="1000000",
            pay_to="0xPayTo",
            max_timeout_seconds=300,
        )
        response = PaymentResponseV2(
            success=True,
            payer="0xPayer",
            transaction="0xTxHash",
            network="eip155:8453",
            requirements=req,
        )

        # Encode
        encoded = encode_payment_response_header(response)
        assert isinstance(encoded, str)

        # Decode
        decoded = decode_payment_response_header(encoded)
        assert decoded["success"] is True
        assert decoded["transaction"] == "0xTxHash"

    def test_invalid_base64_raises_error(self):
        with pytest.raises(ValueError, match="not valid base64"):
            decode_payment_required_header("not-valid-base64!!!")

        with pytest.raises(ValueError, match="not valid base64"):
            decode_payment_signature_header("invalid!!!")


class TestHeaderDetection:
    """Test header detection utilities."""

    def test_detect_v2_from_payment_signature(self):
        headers = {"PAYMENT-SIGNATURE": "base64data"}
        version = detect_protocol_version_from_headers(headers)
        assert version == T402_VERSION_V2

    def test_detect_v2_from_payment_required(self):
        headers = {"payment-required": "base64data"}
        version = detect_protocol_version_from_headers(headers)
        assert version == T402_VERSION_V2

    def test_detect_v1_from_x_payment(self):
        headers = {"X-PAYMENT": "base64data"}
        version = detect_protocol_version_from_headers(headers)
        assert version == T402_VERSION_V1

    def test_default_to_v2(self):
        headers = {}
        version = detect_protocol_version_from_headers(headers)
        assert version == T402_VERSION_V2

    def test_get_payment_header_name(self):
        assert get_payment_header_name(1) == HEADER_X_PAYMENT
        assert get_payment_header_name(2) == HEADER_PAYMENT_SIGNATURE

    def test_get_payment_response_header_name(self):
        assert get_payment_response_header_name(1) == HEADER_X_PAYMENT_RESPONSE
        assert get_payment_response_header_name(2) == HEADER_PAYMENT_RESPONSE

    def test_extract_payment_from_headers_v2(self):
        headers = {"payment-signature": "abc123"}
        version, value = extract_payment_from_headers(headers)
        assert version == T402_VERSION_V2
        assert value == "abc123"

    def test_extract_payment_from_headers_v1(self):
        headers = {"x-payment": "xyz789"}
        version, value = extract_payment_from_headers(headers)
        assert version == T402_VERSION_V1
        assert value == "xyz789"

    def test_extract_payment_from_headers_none(self):
        headers = {"other-header": "value"}
        version, value = extract_payment_from_headers(headers)
        assert version == T402_VERSION_V2
        assert value is None


class TestBackwardCompatibility:
    """Test backward compatibility with V1 types."""

    def test_v1_types_still_work(self):
        # PaymentRequirements is an alias for PaymentRequirementsV1
        req = PaymentRequirements(
            scheme="exact",
            network="base-sepolia",
            max_amount_required="1000000",
            resource="https://example.com",
            description="Test",
            mime_type="application/json",
            pay_to="0xPayTo",
            max_timeout_seconds=300,
            asset="0xUSDC",
        )
        assert req.scheme == "exact"
        assert req.max_amount_required == "1000000"

    def test_v1_payment_payload_still_works(self):
        from t402.types import ExactPaymentPayload, EIP3009Authorization

        auth = EIP3009Authorization(
            from_="0xFrom",
            to="0xTo",
            value="1000000",
            valid_after="0",
            valid_before="999999999999",
            nonce="0x123",
        )
        exact_payload = ExactPaymentPayload(
            signature="0xsig",
            authorization=auth,
        )
        payload = PaymentPayloadV1(
            scheme="exact",
            network="base-sepolia",
            payload=exact_payload,
        )
        assert payload.t402_version == 1
        assert payload.scheme == "exact"
