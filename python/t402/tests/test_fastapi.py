"""Tests for FastAPI Middleware and Dependencies."""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch
import json
import base64

from fastapi import FastAPI, Request, Depends
from fastapi.testclient import TestClient

from t402.fastapi import (
    PaymentMiddleware,
    PaymentConfig,
    PaymentDetails,
    PaymentRequired,
    require_payment,
    get_payment_details,
)
from t402.types import (
    T402_VERSION_V1,
    T402_VERSION_V2,
    VerifyResponse,
    SettleResponse,
)
from t402.encoding import (
    HEADER_PAYMENT_SIGNATURE,
    HEADER_PAYMENT_REQUIRED,
    HEADER_X_PAYMENT,
    safe_base64_encode,
)


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


class TestPaymentMiddleware:
    """Test PaymentMiddleware class."""

    def test_middleware_initialization(self):
        app = FastAPI()
        middleware = PaymentMiddleware(app)

        assert middleware.app == app
        assert middleware.configs == []
        assert middleware._middleware_added is False

    def test_add_returns_self(self):
        app = FastAPI()
        middleware = PaymentMiddleware(app)

        result = middleware.add(
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            path="/api/*",
            network="base-sepolia",
        )

        assert result is middleware

    def test_add_multiple_configs(self):
        app = FastAPI()
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
        app = FastAPI()
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


class TestRequirePayment:
    """Test require_payment function."""

    def test_creates_middleware_function(self):
        middleware = require_payment(
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            path="/api/*",
            network="base-sepolia",
        )

        assert callable(middleware)

    def test_invalid_network_raises(self):
        with pytest.raises(ValueError, match="Unsupported network"):
            require_payment(
                price="$0.10",
                pay_to_address="0x1234",
                network="invalid-network",
            )


class TestPaymentRequired:
    """Test PaymentRequired dependency."""

    def test_initialization(self):
        dep = PaymentRequired(
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            network="base-sepolia",
        )

        assert dep.price == "$0.10"
        assert dep.pay_to_address == "0x1234567890123456789012345678901234567890"
        assert dep.network == "base-sepolia"
        assert dep.max_amount_required is not None

    def test_invalid_network(self):
        with pytest.raises(ValueError, match="Unsupported network"):
            PaymentRequired(
                price="$0.10",
                pay_to_address="0x1234",
                network="invalid",
            )


class TestFastAPIIntegration:
    """Integration tests for FastAPI middleware."""

    @pytest.fixture
    def app_with_middleware(self):
        """Create a FastAPI app with payment middleware."""
        app = FastAPI()
        middleware = PaymentMiddleware(app)

        middleware.add(
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            path="/protected/*",
            network="base-sepolia",
        )

        @app.get("/protected/data")
        async def protected_endpoint():
            return {"message": "success"}

        @app.get("/free/data")
        async def free_endpoint():
            return {"message": "free"}

        return app

    def test_free_endpoint_accessible(self, app_with_middleware):
        """Free endpoints should be accessible without payment."""
        client = TestClient(app_with_middleware)
        response = client.get("/free/data")

        assert response.status_code == 200
        assert response.json() == {"message": "free"}

    def test_protected_endpoint_returns_402_without_payment(self, app_with_middleware):
        """Protected endpoints should return 402 without payment header."""
        client = TestClient(app_with_middleware)
        response = client.get("/protected/data")

        assert response.status_code == 402
        data = response.json()
        assert "error" in data or "accepts" in data

    def test_protected_endpoint_returns_402_v2_header(self, app_with_middleware):
        """Protected endpoints should include PAYMENT-REQUIRED header for V2."""
        client = TestClient(app_with_middleware)
        response = client.get("/protected/data")

        assert response.status_code == 402
        # V2 protocol should include the header
        assert HEADER_PAYMENT_REQUIRED in response.headers

    def test_browser_request_returns_html(self, app_with_middleware):
        """Browser requests should receive HTML paywall."""
        client = TestClient(app_with_middleware)
        response = client.get(
            "/protected/data",
            headers={
                "Accept": "text/html,application/xhtml+xml",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0",
            },
        )

        assert response.status_code == 402
        assert "text/html" in response.headers.get("content-type", "")


class TestProtocolVersionDetection:
    """Test protocol version detection."""

    def test_v2_header_detected(self):
        from t402.encoding import detect_protocol_version_from_headers

        headers = {"payment-signature": "test"}
        version = detect_protocol_version_from_headers(headers)
        assert version == T402_VERSION_V2

    def test_v1_header_detected(self):
        from t402.encoding import detect_protocol_version_from_headers

        headers = {"x-payment": "test"}
        version = detect_protocol_version_from_headers(headers)
        assert version == T402_VERSION_V1

    def test_default_to_v2(self):
        from t402.encoding import detect_protocol_version_from_headers

        headers = {}
        version = detect_protocol_version_from_headers(headers)
        assert version == T402_VERSION_V2


class TestPaymentHeaderExtraction:
    """Test payment header extraction."""

    def test_extract_v2_header(self):
        from t402.encoding import extract_payment_from_headers

        payment_data = safe_base64_encode(json.dumps({"t402Version": 2}))
        headers = {"payment-signature": payment_data}

        version, value = extract_payment_from_headers(headers)
        assert version == T402_VERSION_V2
        assert value == payment_data

    def test_extract_v1_header(self):
        from t402.encoding import extract_payment_from_headers

        payment_data = safe_base64_encode(json.dumps({"t402Version": 1}))
        headers = {"x-payment": payment_data}

        version, value = extract_payment_from_headers(headers)
        assert version == T402_VERSION_V1
        assert value == payment_data

    def test_no_payment_header(self):
        from t402.encoding import extract_payment_from_headers

        headers = {}
        version, value = extract_payment_from_headers(headers)
        assert version == T402_VERSION_V2
        assert value is None


class TestGetPaymentDetails:
    """Test get_payment_details dependency."""

    @pytest.mark.asyncio
    async def test_returns_none_when_no_payment(self):
        """Should return None when no payment details in state."""
        mock_request = MagicMock(spec=Request)
        mock_request.state = MagicMock()
        del mock_request.state.payment_details  # Simulate missing attribute

        result = await get_payment_details(mock_request)
        assert result is None

    @pytest.mark.asyncio
    async def test_returns_payment_details(self):
        """Should return payment details when present."""
        mock_verify = MagicMock(spec=VerifyResponse)
        mock_verify.is_valid = True

        mock_details = PaymentDetails(
            requirements=MagicMock(),
            verify_response=mock_verify,
            protocol_version=T402_VERSION_V2,
        )

        mock_request = MagicMock(spec=Request)
        mock_request.state = MagicMock()
        mock_request.state.payment_details = mock_details

        result = await get_payment_details(mock_request)
        assert result == mock_details
        assert result.is_verified is True


class TestPaymentRequiredResponse:
    """Test 402 response format."""

    @pytest.fixture
    def simple_app(self):
        """Create a simple app for testing 402 responses."""
        app = FastAPI()

        middleware = PaymentMiddleware(app)
        middleware.add(
            price="$0.10",
            pay_to_address="0x1234567890123456789012345678901234567890",
            path="/api/*",
            network="base-sepolia",
            description="Test resource",
            protocol_version=T402_VERSION_V2,
        )

        @app.get("/api/test")
        async def test_endpoint():
            return {"status": "ok"}

        return app

    def test_v2_response_structure(self, simple_app):
        """V2 response should have correct structure."""
        client = TestClient(simple_app)
        response = client.get("/api/test")

        assert response.status_code == 402
        data = response.json()

        # V2 structure
        assert "t402Version" in data
        assert data["t402Version"] == 2
        assert "resource" in data
        assert "accepts" in data
        assert "error" in data

    def test_v2_accepts_structure(self, simple_app):
        """V2 accepts should have correct structure."""
        client = TestClient(simple_app)
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

    def test_resource_info(self, simple_app):
        """Resource info should be present in V2 response."""
        client = TestClient(simple_app)
        response = client.get("/api/test")

        data = response.json()
        resource = data["resource"]

        assert "url" in resource
        assert "description" in resource
