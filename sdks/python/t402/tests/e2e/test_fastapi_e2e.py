"""E2E tests for FastAPI middleware integration with T402 payment protocol."""

import json
import base64
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from t402.fastapi.middleware import require_payment
from t402.types import T402_VERSION_V2


# ========================
# App Fixtures
# ========================


def create_fastapi_app(
    price: str = "$1.00",
    pay_to: str = "0x1111111111111111111111111111111111111111",
    path: str = "/protected",
    network: str = "base-sepolia",
    **kwargs,
) -> FastAPI:
    """Create a FastAPI app with T402 payment middleware."""
    app = FastAPI()

    @app.get("/protected")
    async def protected_endpoint():
        return {"message": "premium content"}

    @app.get("/unprotected")
    async def unprotected_endpoint():
        return {"message": "free content"}

    @app.post("/protected")
    async def protected_post():
        return {"message": "premium post"}

    app.middleware("http")(
        require_payment(
            price=price,
            pay_to_address=pay_to,
            path=path,
            network=network,
            description="Test payment",
            **kwargs,
        )
    )
    return app


# ========================
# 402 Response
# ========================


class TestFastApiMiddleware402:
    """E2E tests for FastAPI middleware returning 402."""

    def test_protected_route_returns_402(self):
        """Test protected route returns 402 without payment."""
        app = create_fastapi_app()
        client = TestClient(app)
        response = client.get("/protected")
        assert response.status_code == 402

    def test_unprotected_route_returns_200(self):
        """Test unprotected route passes through."""
        app = create_fastapi_app()
        client = TestClient(app)
        response = client.get("/unprotected")
        assert response.status_code == 200
        assert response.json() == {"message": "free content"}

    def test_402_body_contains_accepts(self):
        """Test 402 response contains accepts array."""
        app = create_fastapi_app()
        client = TestClient(app)
        response = client.get("/protected")
        assert response.status_code == 402
        body = response.json()
        assert "accepts" in body

    def test_402_body_contains_error(self):
        """Test 402 response contains error message."""
        app = create_fastapi_app()
        client = TestClient(app)
        response = client.get("/protected")
        body = response.json()
        assert "error" in body

    def test_402_contains_v2_fields(self):
        """Test 402 response has V2 format."""
        app = create_fastapi_app()
        client = TestClient(app)
        response = client.get("/protected")
        body = response.json()
        assert body["t402Version"] == T402_VERSION_V2
        assert "resource" in body

    def test_402_contains_payment_required_header(self):
        """Test V2 PAYMENT-REQUIRED header is set."""
        app = create_fastapi_app()
        client = TestClient(app)
        response = client.get("/protected")
        assert response.status_code == 402
        assert "PAYMENT-REQUIRED" in response.headers


# ========================
# Invalid Payment Headers
# ========================


class TestFastApiInvalidPayment:
    """E2E tests for invalid payment handling."""

    def test_invalid_payment_header_format(self):
        """Test invalid payment header returns 402 with error."""
        app = create_fastapi_app()
        client = TestClient(app)
        response = client.get(
            "/protected", headers={"X-PAYMENT": "not_valid_base64!"}
        )
        assert response.status_code == 402
        assert "Invalid payment header format" in response.json()["error"]

    def test_v1_x_payment_header_accepted(self):
        """Test V1 X-PAYMENT header is still detected."""
        app = create_fastapi_app()
        client = TestClient(app)
        # Invalid payload, but should be detected as V1 header
        response = client.get(
            "/protected", headers={"X-PAYMENT": "invalid_base64"}
        )
        assert response.status_code == 402

    def test_v2_payment_signature_header_accepted(self):
        """Test V2 PAYMENT-SIGNATURE header is detected."""
        app = create_fastapi_app()
        client = TestClient(app)
        response = client.get(
            "/protected", headers={"PAYMENT-SIGNATURE": "invalid_base64"}
        )
        assert response.status_code == 402


# ========================
# Path Matching
# ========================


class TestFastApiPathMatching:
    """E2E tests for path matching in FastAPI middleware."""

    def test_single_path(self):
        """Test single path protection."""
        app = create_fastapi_app(path="/protected")
        client = TestClient(app)
        assert client.get("/protected").status_code == 402
        assert client.get("/unprotected").status_code == 200

    def test_multiple_paths(self):
        """Test multiple path protection."""
        app = FastAPI()

        @app.get("/a")
        async def a():
            return {"a": True}

        @app.get("/b")
        async def b():
            return {"b": True}

        @app.get("/c")
        async def c():
            return {"c": True}

        app.middleware("http")(
            require_payment(
                price="$1.00",
                pay_to_address="0x1111111111111111111111111111111111111111",
                path=["/a", "/b"],
                network="base-sepolia",
                description="Test",
            )
        )

        client = TestClient(app)
        assert client.get("/a").status_code == 402
        assert client.get("/b").status_code == 402
        assert client.get("/c").status_code == 200

    def test_post_method_protected(self):
        """Test POST method on protected route."""
        app = create_fastapi_app()
        client = TestClient(app)
        assert client.post("/protected").status_code == 402


# ========================
# Price Configuration
# ========================


class TestFastApiPriceConfig:
    """E2E tests for price configuration."""

    def test_dollar_price(self):
        """Test dollar price format."""
        app = create_fastapi_app(price="$2.50")
        client = TestClient(app)
        response = client.get("/protected")
        assert response.status_code == 402
        body = response.json()
        assert "accepts" in body
        assert len(body["accepts"]) > 0

    def test_small_price(self):
        """Test small price format."""
        app = create_fastapi_app(price="$0.001")
        client = TestClient(app)
        response = client.get("/protected")
        assert response.status_code == 402

    def test_large_price(self):
        """Test large price format."""
        app = create_fastapi_app(price="$1000.00")
        client = TestClient(app)
        response = client.get("/protected")
        assert response.status_code == 402


# ========================
# Browser vs API Detection
# ========================


class TestFastApiBrowserDetection:
    """E2E tests for browser vs API client detection."""

    def test_browser_request_returns_html(self):
        """Test browser requests return HTML paywall."""
        app = create_fastapi_app()
        client = TestClient(app)
        browser_headers = {
            "Accept": "text/html,application/xhtml+xml",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        }
        response = client.get("/protected", headers=browser_headers)
        assert response.status_code == 402
        assert "text/html" in response.headers.get("content-type", "")

    def test_api_request_returns_json(self):
        """Test API client requests return JSON."""
        app = create_fastapi_app()
        client = TestClient(app)
        api_headers = {
            "Accept": "application/json",
            "User-Agent": "curl/7.68.0",
        }
        response = client.get("/protected", headers=api_headers)
        assert response.status_code == 402
        assert "application/json" in response.headers.get("content-type", "")
        body = response.json()
        assert "accepts" in body
