"""Tests for Django Middleware."""

import json
import os

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

# Configure Django settings before importing any Django modules
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "tests.django_settings")

import django
from django.conf import settings

if not settings.configured:
    settings.configure(
        DEBUG=True,
        DATABASES={},
        INSTALLED_APPS=[
            "django.contrib.contenttypes",
        ],
        MIDDLEWARE=[],
        ROOT_URLCONF="tests.django_urls",
        SECRET_KEY="test-secret-key-for-t402-testing",
        ALLOWED_HOSTS=["*"],
    )
    django.setup()

from django.http import HttpRequest, HttpResponse, JsonResponse
from django.test import RequestFactory

from t402.django import (
    PaymentMiddleware,
    PaymentConfig,
    PaymentDetails,
)
from t402.types import (
    T402_VERSION_V1,
    T402_VERSION_V2,
    VerifyResponse,
    SettleResponse,
)
from t402.encoding import (
    HEADER_PAYMENT_REQUIRED,
    HEADER_PAYMENT_RESPONSE,
    HEADER_X_PAYMENT_RESPONSE,
    safe_base64_encode,
)


# ============================================================================
# Test PaymentConfig
# ============================================================================


class TestPaymentConfig:
    """Test PaymentConfig validation."""

    def test_valid_config(self):
        config = PaymentConfig(
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            network="base-sepolia",
        )
        assert config.price == "$0.10"
        assert config.pay_to_address == "0x1234567890123456789012345678901234567890"
        assert config.max_amount_required is not None

    def test_invalid_network(self):
        with pytest.raises(ValueError, match="Unsupported network"):
            PaymentConfig(
                price="$0.10",
                pay_to_address="0x1234",
                network="invalid-network",
            )

    def test_default_values(self):
        config = PaymentConfig(
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            network="base-sepolia",
        )
        assert config.path == "*"
        assert config.description == ""
        assert config.max_timeout_seconds == 60
        assert config.discoverable is True
        assert config.protocol_version == T402_VERSION_V2


# ============================================================================
# Test PaymentDetails
# ============================================================================


class TestPaymentDetails:
    """Test PaymentDetails class."""

    def test_payment_details_creation(self):
        mock_requirements = MagicMock()
        mock_verify = MagicMock(spec=VerifyResponse)
        mock_verify.is_valid = True

        details = PaymentDetails(
            requirements=mock_requirements,
            verify_response=mock_verify,
            protocol_version=T402_VERSION_V2,
        )

        assert details.requirements == mock_requirements
        assert details.verify_response == mock_verify
        assert details.protocol_version == T402_VERSION_V2
        assert details.is_verified is True

    def test_payment_details_not_verified(self):
        mock_verify = MagicMock(spec=VerifyResponse)
        mock_verify.is_valid = False

        details = PaymentDetails(
            requirements=MagicMock(),
            verify_response=mock_verify,
            protocol_version=T402_VERSION_V2,
        )

        assert details.is_verified is False

    def test_payer_address(self):
        mock_verify = MagicMock(spec=VerifyResponse)
        mock_verify.is_valid = True
        mock_verify.payer = "0xABCD"

        details = PaymentDetails(
            requirements=MagicMock(),
            verify_response=mock_verify,
            protocol_version=T402_VERSION_V2,
        )

        assert details.payer_address == "0xABCD"


# ============================================================================
# Test PaymentMiddleware
# ============================================================================


class TestPaymentMiddleware:
    """Test PaymentMiddleware class."""

    def setup_method(self):
        """Reset middleware configs before each test."""
        PaymentMiddleware.reset()

    def test_add_config(self):
        PaymentMiddleware.add(
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            path="/api/*",
            network="base-sepolia",
        )

        assert len(PaymentMiddleware._configs) == 1

    def test_add_multiple_configs(self):
        PaymentMiddleware.add(
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            path="/api/*",
            network="base-sepolia",
        )
        PaymentMiddleware.add(
            price="$0.50",
            pay_to_address="0x1234567890123456789012345678901234567890",
            path="/premium/*",
            network="base-sepolia",
        )

        assert len(PaymentMiddleware._configs) == 2

    def test_configure_replaces_configs(self):
        PaymentMiddleware.add(
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            path="/api/*",
            network="base-sepolia",
        )

        new_config = PaymentConfig(
            price="$0.50",
            pay_to_address="0x1234567890123456789012345678901234567890",
            path="/new/*",
            network="base-sepolia",
        )
        PaymentMiddleware.configure([new_config])

        assert len(PaymentMiddleware._configs) == 1
        assert PaymentMiddleware._configs[0].price == "$0.50"

    def test_reset_clears_configs(self):
        PaymentMiddleware.add(
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            path="/api/*",
            network="base-sepolia",
        )
        PaymentMiddleware.reset()

        assert len(PaymentMiddleware._configs) == 0


# ============================================================================
# Test Django Middleware Integration
# ============================================================================


class TestDjangoMiddlewareIntegration:
    """Integration tests for Django middleware."""

    def setup_method(self):
        """Reset middleware configs before each test."""
        PaymentMiddleware.reset()

    def _make_request(self, path="/protected/data", method="GET", headers=None):
        """Create a Django request using RequestFactory.

        Args:
            path: Request path
            method: HTTP method
            headers: Additional HTTP headers

        Returns:
            HttpRequest object
        """
        factory = RequestFactory()
        extra = {}
        if headers:
            for key, value in headers.items():
                # Convert header name to Django META format
                meta_key = "HTTP_" + key.upper().replace("-", "_")
                extra[meta_key] = value
        if method == "GET":
            return factory.get(path, **extra)
        elif method == "POST":
            return factory.post(path, **extra)
        return factory.get(path, **extra)

    def test_free_endpoint_accessible(self):
        """Free endpoints should pass through without payment check."""
        PaymentMiddleware.add(
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            path="/protected/*",
            network="base-sepolia",
        )

        def get_response(request):
            return JsonResponse({"message": "free"})

        middleware = PaymentMiddleware(get_response)
        request = self._make_request(path="/free/data")
        response = middleware(request)

        assert response.status_code == 200
        assert json.loads(response.content) == {"message": "free"}

    def test_protected_endpoint_returns_402_without_payment(self):
        """Protected endpoints should return 402 without payment header."""
        PaymentMiddleware.add(
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            path="/protected/*",
            network="base-sepolia",
        )

        def get_response(request):
            return JsonResponse({"message": "success"})

        middleware = PaymentMiddleware(get_response)
        request = self._make_request(path="/protected/data")
        response = middleware(request)

        assert response.status_code == 402

    def test_402_response_contains_v2_structure(self):
        """V2 402 response should have correct structure."""
        PaymentMiddleware.add(
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            path="/api/*",
            network="base-sepolia",
            description="Test resource",
            protocol_version=T402_VERSION_V2,
        )

        def get_response(request):
            return JsonResponse({"status": "ok"})

        middleware = PaymentMiddleware(get_response)
        request = self._make_request(path="/api/test")
        response = middleware(request)

        assert response.status_code == 402
        data = json.loads(response.content)

        assert "t402Version" in data
        assert data["t402Version"] == 2
        assert "resource" in data
        assert "accepts" in data
        assert "error" in data

    def test_402_response_has_payment_required_header(self):
        """V2 response should include PAYMENT-REQUIRED header."""
        PaymentMiddleware.add(
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            path="/api/*",
            network="base-sepolia",
        )

        def get_response(request):
            return JsonResponse({"status": "ok"})

        middleware = PaymentMiddleware(get_response)
        request = self._make_request(path="/api/test")
        response = middleware(request)

        assert response.status_code == 402
        assert HEADER_PAYMENT_REQUIRED in response

    def test_402_accepts_structure(self):
        """V2 accepts should have correct fields."""
        PaymentMiddleware.add(
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            path="/api/*",
            network="base-sepolia",
        )

        def get_response(request):
            return JsonResponse({"status": "ok"})

        middleware = PaymentMiddleware(get_response)
        request = self._make_request(path="/api/test")
        response = middleware(request)

        data = json.loads(response.content)
        accepts = data["accepts"]

        assert len(accepts) > 0
        accept = accepts[0]

        assert "scheme" in accept
        assert "network" in accept
        assert "asset" in accept
        assert "amount" in accept
        assert "payTo" in accept
        assert "maxTimeoutSeconds" in accept

    def test_invalid_payment_header_returns_402(self):
        """Invalid payment header format should return 402."""
        PaymentMiddleware.add(
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            path="/api/*",
            network="base-sepolia",
        )

        def get_response(request):
            return JsonResponse({"status": "ok"})

        middleware = PaymentMiddleware(get_response)
        request = self._make_request(
            path="/api/test",
            headers={"PAYMENT-SIGNATURE": "not-valid-base64!!!"},
        )
        response = middleware(request)

        assert response.status_code == 402
        data = json.loads(response.content)
        assert "error" in data

    def test_browser_request_returns_html(self):
        """Browser requests should receive HTML paywall."""
        PaymentMiddleware.add(
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            path="/api/*",
            network="base-sepolia",
        )

        def get_response(request):
            return JsonResponse({"status": "ok"})

        middleware = PaymentMiddleware(get_response)
        request = self._make_request(
            path="/api/test",
            headers={
                "Accept": "text/html,application/xhtml+xml",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0",
            },
        )
        response = middleware(request)

        assert response.status_code == 402
        assert "text/html" in response["Content-Type"]

    @patch("t402.django.middleware.FacilitatorClient")
    def test_valid_payment_flow(self, mock_facilitator_cls):
        """Test complete payment verification and settlement flow."""
        PaymentMiddleware.add(
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            path="/api/*",
            network="base-sepolia",
        )

        # Mock verify response
        mock_verify_response = VerifyResponse(
            is_valid=True,
            invalid_reason=None,
            payer="0xPayerAddress",
        )

        # Mock settle response
        mock_settle_response = SettleResponse(
            success=True,
            error_reason=None,
            transaction="0xTxHash",
            network="base-sepolia",
            payer="0xPayerAddress",
        )

        # Setup facilitator mock
        mock_facilitator = MagicMock()
        mock_facilitator.verify = AsyncMock(return_value=mock_verify_response)
        mock_facilitator.settle = AsyncMock(return_value=mock_settle_response)
        mock_facilitator_cls.return_value = mock_facilitator

        def get_response(request):
            return JsonResponse({"message": "success"})

        middleware = PaymentMiddleware(get_response)

        # Create a valid payment header
        payment_data = {
            "t402Version": 1,
            "scheme": "exact",
            "network": "base-sepolia",
            "payload": {
                "signature": "0xSig",
                "authorization": {
                    "from": "0xFrom",
                    "to": "0xTo",
                    "value": "100000",
                    "validAfter": "0",
                    "validBefore": "9999999999",
                    "nonce": "0x1234",
                },
            },
        }
        payment_header = safe_base64_encode(json.dumps(payment_data))

        request = self._make_request(
            path="/api/test",
            headers={"PAYMENT-SIGNATURE": payment_header},
        )
        response = middleware(request)

        assert response.status_code == 200
        assert json.loads(response.content) == {"message": "success"}
        assert HEADER_PAYMENT_RESPONSE in response

        # Verify facilitator was called
        mock_facilitator.verify.assert_called_once()
        mock_facilitator.settle.assert_called_once()

    @patch("t402.django.middleware.FacilitatorClient")
    def test_invalid_payment_verification(self, mock_facilitator_cls):
        """Test that invalid payment verification returns 402."""
        PaymentMiddleware.add(
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            path="/api/*",
            network="base-sepolia",
        )

        # Mock verify response as invalid
        mock_verify_response = VerifyResponse(
            is_valid=False,
            invalid_reason="Insufficient balance",
            payer=None,
        )

        mock_facilitator = MagicMock()
        mock_facilitator.verify = AsyncMock(return_value=mock_verify_response)
        mock_facilitator_cls.return_value = mock_facilitator

        def get_response(request):
            return JsonResponse({"message": "success"})

        middleware = PaymentMiddleware(get_response)

        payment_data = {
            "t402Version": 1,
            "scheme": "exact",
            "network": "base-sepolia",
            "payload": {
                "signature": "0xSig",
                "authorization": {
                    "from": "0xFrom",
                    "to": "0xTo",
                    "value": "100000",
                    "validAfter": "0",
                    "validBefore": "9999999999",
                    "nonce": "0x1234",
                },
            },
        }
        payment_header = safe_base64_encode(json.dumps(payment_data))

        request = self._make_request(
            path="/api/test",
            headers={"PAYMENT-SIGNATURE": payment_header},
        )
        response = middleware(request)

        assert response.status_code == 402
        data = json.loads(response.content)
        assert "Insufficient balance" in data["error"]

    @patch("t402.django.middleware.FacilitatorClient")
    def test_settlement_failure_returns_402(self, mock_facilitator_cls):
        """Test that settlement failure returns 402."""
        PaymentMiddleware.add(
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            path="/api/*",
            network="base-sepolia",
        )

        # Mock verify as valid
        mock_verify_response = VerifyResponse(
            is_valid=True,
            invalid_reason=None,
            payer="0xPayerAddress",
        )

        # Mock settle as failed
        mock_settle_response = SettleResponse(
            success=False,
            error_reason="Network congestion",
            transaction="",
            network="base-sepolia",
        )

        mock_facilitator = MagicMock()
        mock_facilitator.verify = AsyncMock(return_value=mock_verify_response)
        mock_facilitator.settle = AsyncMock(return_value=mock_settle_response)
        mock_facilitator_cls.return_value = mock_facilitator

        def get_response(request):
            return JsonResponse({"message": "success"})

        middleware = PaymentMiddleware(get_response)

        payment_data = {
            "t402Version": 1,
            "scheme": "exact",
            "network": "base-sepolia",
            "payload": {
                "signature": "0xSig",
                "authorization": {
                    "from": "0xFrom",
                    "to": "0xTo",
                    "value": "100000",
                    "validAfter": "0",
                    "validBefore": "9999999999",
                    "nonce": "0x1234",
                },
            },
        }
        payment_header = safe_base64_encode(json.dumps(payment_data))

        request = self._make_request(
            path="/api/test",
            headers={"PAYMENT-SIGNATURE": payment_header},
        )
        response = middleware(request)

        assert response.status_code == 402
        data = json.loads(response.content)
        assert "Settlement failed" in data["error"]

    @patch("t402.django.middleware.FacilitatorClient")
    def test_non_2xx_response_skips_settlement(self, mock_facilitator_cls):
        """Test that non-2xx view responses skip settlement."""
        PaymentMiddleware.add(
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            path="/api/*",
            network="base-sepolia",
        )

        mock_verify_response = VerifyResponse(
            is_valid=True,
            invalid_reason=None,
            payer="0xPayerAddress",
        )

        mock_facilitator = MagicMock()
        mock_facilitator.verify = AsyncMock(return_value=mock_verify_response)
        mock_facilitator.settle = AsyncMock()
        mock_facilitator_cls.return_value = mock_facilitator

        def get_response(request):
            return JsonResponse({"error": "not found"}, status=404)

        middleware = PaymentMiddleware(get_response)

        payment_data = {
            "t402Version": 1,
            "scheme": "exact",
            "network": "base-sepolia",
            "payload": {
                "signature": "0xSig",
                "authorization": {
                    "from": "0xFrom",
                    "to": "0xTo",
                    "value": "100000",
                    "validAfter": "0",
                    "validBefore": "9999999999",
                    "nonce": "0x1234",
                },
            },
        }
        payment_header = safe_base64_encode(json.dumps(payment_data))

        request = self._make_request(
            path="/api/test",
            headers={"PAYMENT-SIGNATURE": payment_header},
        )
        response = middleware(request)

        assert response.status_code == 404
        # Settlement should NOT have been called
        mock_facilitator.settle.assert_not_called()

    @patch("t402.django.middleware.FacilitatorClient")
    def test_v1_payment_header_flow(self, mock_facilitator_cls):
        """Test V1 protocol with X-PAYMENT header."""
        PaymentMiddleware.add(
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            path="/api/*",
            network="base-sepolia",
        )

        mock_verify_response = VerifyResponse(
            is_valid=True,
            invalid_reason=None,
            payer="0xPayerAddress",
        )

        mock_settle_response = SettleResponse(
            success=True,
            error_reason=None,
            transaction="0xTxHash",
            network="base-sepolia",
            payer="0xPayerAddress",
        )

        mock_facilitator = MagicMock()
        mock_facilitator.verify = AsyncMock(return_value=mock_verify_response)
        mock_facilitator.settle = AsyncMock(return_value=mock_settle_response)
        mock_facilitator_cls.return_value = mock_facilitator

        def get_response(request):
            return JsonResponse({"message": "success"})

        middleware = PaymentMiddleware(get_response)

        payment_data = {
            "t402Version": 1,
            "scheme": "exact",
            "network": "base-sepolia",
            "payload": {
                "signature": "0xSig",
                "authorization": {
                    "from": "0xFrom",
                    "to": "0xTo",
                    "value": "100000",
                    "validAfter": "0",
                    "validBefore": "9999999999",
                    "nonce": "0x1234",
                },
            },
        }
        payment_header = safe_base64_encode(json.dumps(payment_data))

        # Use X-PAYMENT (V1) header
        request = self._make_request(
            path="/api/test",
            headers={"X-PAYMENT": payment_header},
        )
        response = middleware(request)

        assert response.status_code == 200
        # V1 should get X-PAYMENT-RESPONSE header
        assert HEADER_X_PAYMENT_RESPONSE in response

    @patch("t402.django.middleware.FacilitatorClient")
    def test_payment_details_stored_on_request(self, mock_facilitator_cls):
        """Test that payment details are stored on the request object."""
        PaymentMiddleware.add(
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            path="/api/*",
            network="base-sepolia",
        )

        mock_verify_response = VerifyResponse(
            is_valid=True,
            invalid_reason=None,
            payer="0xPayerAddress",
        )

        mock_settle_response = SettleResponse(
            success=True,
            error_reason=None,
            transaction="0xTxHash",
            network="base-sepolia",
        )

        mock_facilitator = MagicMock()
        mock_facilitator.verify = AsyncMock(return_value=mock_verify_response)
        mock_facilitator.settle = AsyncMock(return_value=mock_settle_response)
        mock_facilitator_cls.return_value = mock_facilitator

        captured_request = {}

        def get_response(request):
            # Capture the request to check payment_details was set
            captured_request["payment_details"] = getattr(
                request, "payment_details", None
            )
            captured_request["verify_response"] = getattr(
                request, "verify_response", None
            )
            return JsonResponse({"message": "success"})

        middleware = PaymentMiddleware(get_response)

        payment_data = {
            "t402Version": 1,
            "scheme": "exact",
            "network": "base-sepolia",
            "payload": {
                "signature": "0xSig",
                "authorization": {
                    "from": "0xFrom",
                    "to": "0xTo",
                    "value": "100000",
                    "validAfter": "0",
                    "validBefore": "9999999999",
                    "nonce": "0x1234",
                },
            },
        }
        payment_header = safe_base64_encode(json.dumps(payment_data))

        request = self._make_request(
            path="/api/test",
            headers={"PAYMENT-SIGNATURE": payment_header},
        )
        response = middleware(request)

        assert response.status_code == 200
        assert captured_request["payment_details"] is not None
        assert isinstance(captured_request["payment_details"], PaymentDetails)
        assert captured_request["payment_details"].is_verified is True
        assert captured_request["verify_response"] is not None

    def test_no_matching_requirements(self):
        """Test mismatched payment network returns 402."""
        PaymentMiddleware.add(
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            path="/api/*",
            network="base-sepolia",
        )

        def get_response(request):
            return JsonResponse({"message": "success"})

        middleware = PaymentMiddleware(get_response)

        # Create payment for wrong network
        payment_data = {
            "t402Version": 1,
            "scheme": "exact",
            "network": "eip155:1",
            "payload": {
                "signature": "0xSig",
                "authorization": {
                    "from": "0xFrom",
                    "to": "0xTo",
                    "value": "100000",
                    "validAfter": "0",
                    "validBefore": "9999999999",
                    "nonce": "0x1234",
                },
            },
        }
        payment_header = safe_base64_encode(json.dumps(payment_data))

        request = self._make_request(
            path="/api/test",
            headers={"PAYMENT-SIGNATURE": payment_header},
        )
        response = middleware(request)

        assert response.status_code == 402
        data = json.loads(response.content)
        assert "No matching payment requirements" in data["error"]

    @patch("t402.django.middleware.FacilitatorClient")
    def test_verification_exception_returns_402(self, mock_facilitator_cls):
        """Test that facilitator verify exception returns 402."""
        PaymentMiddleware.add(
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            path="/api/*",
            network="base-sepolia",
        )

        mock_facilitator = MagicMock()
        mock_facilitator.verify = AsyncMock(
            side_effect=Exception("Connection refused")
        )
        mock_facilitator_cls.return_value = mock_facilitator

        def get_response(request):
            return JsonResponse({"message": "success"})

        middleware = PaymentMiddleware(get_response)

        payment_data = {
            "t402Version": 1,
            "scheme": "exact",
            "network": "base-sepolia",
            "payload": {
                "signature": "0xSig",
                "authorization": {
                    "from": "0xFrom",
                    "to": "0xTo",
                    "value": "100000",
                    "validAfter": "0",
                    "validBefore": "9999999999",
                    "nonce": "0x1234",
                },
            },
        }
        payment_header = safe_base64_encode(json.dumps(payment_data))

        request = self._make_request(
            path="/api/test",
            headers={"PAYMENT-SIGNATURE": payment_header},
        )
        response = middleware(request)

        assert response.status_code == 402
        data = json.loads(response.content)
        assert "Payment verification failed" in data["error"]


# ============================================================================
# Test Header Extraction
# ============================================================================


class TestDjangoHeaderExtraction:
    """Test that Django headers are correctly converted."""

    def setup_method(self):
        PaymentMiddleware.reset()

    def test_headers_dict_extraction(self):
        """Test that _get_headers_dict correctly converts Django META headers."""
        PaymentMiddleware.add(
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            path="/never-match",
            network="base-sepolia",
        )

        def get_response(request):
            return JsonResponse({"ok": True})

        middleware = PaymentMiddleware(get_response)

        factory = RequestFactory()
        request = factory.get(
            "/test",
            HTTP_PAYMENT_SIGNATURE="test_value",
            HTTP_ACCEPT="application/json",
            HTTP_USER_AGENT="TestAgent",
            CONTENT_TYPE="application/json",
        )

        headers = middleware._get_headers_dict(request)

        assert headers["payment-signature"] == "test_value"
        assert headers["accept"] == "application/json"
        assert headers["user-agent"] == "TestAgent"
        assert headers["content-type"] == "application/json"
