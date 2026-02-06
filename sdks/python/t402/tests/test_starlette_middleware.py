"""Tests for Starlette Middleware."""

import json

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from t402.starlette import (
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

    def test_middleware_initialization(self):
        app = Starlette()
        middleware = PaymentMiddleware(app)

        assert middleware.app == app
        assert middleware.configs == []
        assert middleware._middleware_added is False

    def test_add_returns_self(self):
        app = Starlette()
        middleware = PaymentMiddleware(app)

        result = middleware.add(
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            path="/api/*",
            network="base-sepolia",
        )

        assert result is middleware

    def test_add_multiple_configs(self):
        app = Starlette()
        middleware = PaymentMiddleware(app)

        middleware.add(
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            path="/api/*",
            network="base-sepolia",
        ).add(
            price="$0.50",
            pay_to_address="0x1234567890123456789012345678901234567890",
            path="/premium/*",
            network="base-sepolia",
        )

        assert len(middleware.configs) == 2

    def test_find_matching_config(self):
        app = Starlette()
        middleware = PaymentMiddleware(app)

        middleware.add(
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            path="/api/*",
            network="base-sepolia",
        )

        config = middleware._find_matching_config("/api/data")
        assert config is not None
        assert config.price == "$0.10"

        config = middleware._find_matching_config("/other/path")
        assert config is None


# ============================================================================
# Helpers
# ============================================================================


def _create_app_with_middleware(
    path="/protected/*",
    price="$0.10",
    network="base-sepolia",
    pay_to="0x1234567890123456789012345678901234567890",
    description="",
    protocol_version=T402_VERSION_V2,
):
    """Create a Starlette app with payment middleware configured."""

    async def protected_endpoint(request: Request):
        return JSONResponse({"message": "success"})

    async def free_endpoint(request: Request):
        return JSONResponse({"message": "free"})

    app = Starlette(
        routes=[
            Route("/protected/data", protected_endpoint),
            Route("/api/test", protected_endpoint),
            Route("/free/data", free_endpoint),
        ],
    )

    payment = PaymentMiddleware(app)
    payment.add(
        path=path,
        price=price,
        pay_to_address=pay_to,
        network=network,
        description=description,
        protocol_version=protocol_version,
    )

    return app


def _make_payment_header(
    scheme="exact",
    network="base-sepolia",
    version=1,
):
    """Create a valid base64-encoded payment header."""
    payment_data = {
        "t402Version": version,
        "scheme": scheme,
        "network": network,
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
    return safe_base64_encode(json.dumps(payment_data))


# ============================================================================
# Test Starlette Middleware Integration
# ============================================================================


class TestStarletteMiddlewareIntegration:
    """Integration tests for Starlette middleware."""

    def test_free_endpoint_accessible(self):
        """Free endpoints should be accessible without payment."""
        app = _create_app_with_middleware()
        client = TestClient(app)
        response = client.get("/free/data")

        assert response.status_code == 200
        assert response.json() == {"message": "free"}

    def test_protected_endpoint_returns_402_without_payment(self):
        """Protected endpoints should return 402 without payment header."""
        app = _create_app_with_middleware()
        client = TestClient(app)
        response = client.get("/protected/data")

        assert response.status_code == 402

    def test_402_response_contains_v2_structure(self):
        """V2 402 response should have correct structure."""
        app = _create_app_with_middleware(
            path="/api/*",
            description="Test resource",
            protocol_version=T402_VERSION_V2,
        )
        client = TestClient(app)
        response = client.get("/api/test")

        assert response.status_code == 402
        data = response.json()

        assert "t402Version" in data
        assert data["t402Version"] == 2
        assert "resource" in data
        assert "accepts" in data
        assert "error" in data

    def test_402_response_has_payment_required_header(self):
        """V2 response should include PAYMENT-REQUIRED header."""
        app = _create_app_with_middleware(path="/api/*")
        client = TestClient(app)
        response = client.get("/api/test")

        assert response.status_code == 402
        assert HEADER_PAYMENT_REQUIRED in response.headers

    def test_402_accepts_structure(self):
        """V2 accepts should have correct fields."""
        app = _create_app_with_middleware(path="/api/*")
        client = TestClient(app)
        response = client.get("/api/test")

        data = response.json()
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
        app = _create_app_with_middleware(path="/api/*")
        client = TestClient(app)
        response = client.get(
            "/api/test",
            headers={"PAYMENT-SIGNATURE": "not-valid-base64!!!"},
        )

        assert response.status_code == 402
        data = response.json()
        assert "error" in data

    def test_browser_request_returns_html(self):
        """Browser requests should receive HTML paywall."""
        app = _create_app_with_middleware(path="/api/*")
        client = TestClient(app)
        response = client.get(
            "/api/test",
            headers={
                "Accept": "text/html,application/xhtml+xml",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0",
            },
        )

        assert response.status_code == 402
        assert "text/html" in response.headers.get("content-type", "")

    def test_no_matching_requirements(self):
        """Test mismatched payment network returns 402."""
        app = _create_app_with_middleware(path="/api/*")
        client = TestClient(app)

        # Create payment for wrong network
        payment_header = _make_payment_header(network="eip155:1")

        response = client.get(
            "/api/test",
            headers={"PAYMENT-SIGNATURE": payment_header},
        )

        assert response.status_code == 402
        data = response.json()
        assert "No matching payment requirements" in data["error"]

    @patch("t402.starlette.middleware.FacilitatorClient")
    def test_valid_payment_flow(self, mock_facilitator_cls):
        """Test complete payment verification and settlement flow."""
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

        mock_facilitator = MagicMock()
        mock_facilitator.verify = AsyncMock(return_value=mock_verify_response)
        mock_facilitator.settle = AsyncMock(return_value=mock_settle_response)
        mock_facilitator_cls.return_value = mock_facilitator

        app = _create_app_with_middleware(path="/api/*")
        client = TestClient(app)

        payment_header = _make_payment_header()

        response = client.get(
            "/api/test",
            headers={"PAYMENT-SIGNATURE": payment_header},
        )

        assert response.status_code == 200
        assert response.json() == {"message": "success"}
        assert HEADER_PAYMENT_RESPONSE in response.headers

        # Verify facilitator was called
        mock_facilitator.verify.assert_called_once()
        mock_facilitator.settle.assert_called_once()

    @patch("t402.starlette.middleware.FacilitatorClient")
    def test_invalid_payment_verification(self, mock_facilitator_cls):
        """Test that invalid payment verification returns 402."""
        mock_verify_response = VerifyResponse(
            is_valid=False,
            invalid_reason="Insufficient balance",
            payer=None,
        )

        mock_facilitator = MagicMock()
        mock_facilitator.verify = AsyncMock(return_value=mock_verify_response)
        mock_facilitator_cls.return_value = mock_facilitator

        app = _create_app_with_middleware(path="/api/*")
        client = TestClient(app)

        payment_header = _make_payment_header()

        response = client.get(
            "/api/test",
            headers={"PAYMENT-SIGNATURE": payment_header},
        )

        assert response.status_code == 402
        data = response.json()
        assert "Insufficient balance" in data["error"]

    @patch("t402.starlette.middleware.FacilitatorClient")
    def test_settlement_failure_returns_402(self, mock_facilitator_cls):
        """Test that settlement failure returns 402."""
        mock_verify_response = VerifyResponse(
            is_valid=True,
            invalid_reason=None,
            payer="0xPayerAddress",
        )

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

        app = _create_app_with_middleware(path="/api/*")
        client = TestClient(app)

        payment_header = _make_payment_header()

        response = client.get(
            "/api/test",
            headers={"PAYMENT-SIGNATURE": payment_header},
        )

        assert response.status_code == 402
        data = response.json()
        assert "Settlement failed" in data["error"]

    @patch("t402.starlette.middleware.FacilitatorClient")
    def test_v1_payment_header_flow(self, mock_facilitator_cls):
        """Test V1 protocol with X-PAYMENT header."""
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

        app = _create_app_with_middleware(path="/api/*")
        client = TestClient(app)

        payment_header = _make_payment_header()

        # Use X-PAYMENT (V1) header
        response = client.get(
            "/api/test",
            headers={"X-PAYMENT": payment_header},
        )

        assert response.status_code == 200
        # V1 should get X-PAYMENT-RESPONSE header
        assert HEADER_X_PAYMENT_RESPONSE in response.headers

    @patch("t402.starlette.middleware.FacilitatorClient")
    def test_verification_exception_returns_402(self, mock_facilitator_cls):
        """Test that facilitator verify exception returns 402."""
        mock_facilitator = MagicMock()
        mock_facilitator.verify = AsyncMock(
            side_effect=Exception("Connection refused")
        )
        mock_facilitator_cls.return_value = mock_facilitator

        app = _create_app_with_middleware(path="/api/*")
        client = TestClient(app)

        payment_header = _make_payment_header()

        response = client.get(
            "/api/test",
            headers={"PAYMENT-SIGNATURE": payment_header},
        )

        assert response.status_code == 402
        data = response.json()
        assert "Payment verification failed" in data["error"]

    @patch("t402.starlette.middleware.FacilitatorClient")
    def test_settlement_exception_returns_402(self, mock_facilitator_cls):
        """Test that settlement exception returns 402."""
        mock_verify_response = VerifyResponse(
            is_valid=True,
            invalid_reason=None,
            payer="0xPayerAddress",
        )

        mock_facilitator = MagicMock()
        mock_facilitator.verify = AsyncMock(return_value=mock_verify_response)
        mock_facilitator.settle = AsyncMock(
            side_effect=Exception("Settlement timeout")
        )
        mock_facilitator_cls.return_value = mock_facilitator

        app = _create_app_with_middleware(path="/api/*")
        client = TestClient(app)

        payment_header = _make_payment_header()

        response = client.get(
            "/api/test",
            headers={"PAYMENT-SIGNATURE": payment_header},
        )

        assert response.status_code == 402
        data = response.json()
        assert "Settlement failed" in data["error"]

    def test_resource_info_in_v2_response(self):
        """Resource info should be present in V2 response."""
        app = _create_app_with_middleware(
            path="/api/*",
            description="Test resource",
        )
        client = TestClient(app)
        response = client.get("/api/test")

        data = response.json()
        resource = data["resource"]

        assert "url" in resource
        assert "description" in resource

    @patch("t402.starlette.middleware.FacilitatorClient")
    def test_payment_details_stored_in_state(self, mock_facilitator_cls):
        """Test that payment details are stored in request.state."""
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

        captured_state = {}

        async def test_endpoint(request: Request):
            captured_state["payment_details"] = getattr(
                request.state, "payment_details", None
            )
            captured_state["verify_response"] = getattr(
                request.state, "verify_response", None
            )
            return JSONResponse({"message": "success"})

        app = Starlette(
            routes=[
                Route("/api/test", test_endpoint),
            ],
        )
        payment = PaymentMiddleware(app)
        payment.add(
            path="/api/*",
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            network="base-sepolia",
        )

        client = TestClient(app)
        payment_header = _make_payment_header()

        response = client.get(
            "/api/test",
            headers={"PAYMENT-SIGNATURE": payment_header},
        )

        assert response.status_code == 200
        assert captured_state["payment_details"] is not None
        assert isinstance(captured_state["payment_details"], PaymentDetails)
        assert captured_state["payment_details"].is_verified is True
        assert captured_state["verify_response"] is not None
