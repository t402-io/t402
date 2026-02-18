"""E2E tests for Flask middleware integration with T402 payment protocol."""

import json
import base64
import pytest
from flask import Flask

from t402.flask.middleware import PaymentMiddleware
from t402.types import T402_VERSION_V2


# ========================
# App Fixtures
# ========================


def create_flask_app(
    price: str = "$1.00",
    pay_to: str = "0x1111111111111111111111111111111111111111",
    path: str = "/protected",
    network: str = "base-sepolia",
    **kwargs,
) -> Flask:
    """Create a Flask app with T402 payment middleware."""
    app = Flask(__name__)

    @app.route("/protected")
    def protected_endpoint():
        return {"message": "premium content"}

    @app.route("/unprotected")
    def unprotected_endpoint():
        return {"message": "free content"}

    @app.route("/protected", methods=["POST"])
    def protected_post():
        return {"message": "premium post"}

    middleware = PaymentMiddleware(app)
    middleware.add(
        price=price,
        pay_to_address=pay_to,
        path=path,
        network=network,
        description="Test payment",
        **kwargs,
    )
    return app


# ========================
# 402 Response
# ========================


class TestFlaskMiddleware402:
    """E2E tests for Flask middleware returning 402."""

    def test_protected_route_returns_402(self):
        """Test protected route returns 402 without payment."""
        app = create_flask_app()
        with app.test_client() as client:
            response = client.get("/protected")
            assert response.status_code == 402

    def test_unprotected_route_returns_200(self):
        """Test unprotected route passes through."""
        app = create_flask_app()
        with app.test_client() as client:
            response = client.get("/unprotected")
            assert response.status_code == 200
            assert response.json == {"message": "free content"}

    def test_402_body_contains_accepts(self):
        """Test 402 response body contains accepts array."""
        app = create_flask_app()
        with app.test_client() as client:
            response = client.get("/protected")
            assert response.status_code == 402
            body = response.json
            assert body is not None
            assert "accepts" in body

    def test_402_body_contains_error(self):
        """Test 402 response body contains error message."""
        app = create_flask_app()
        with app.test_client() as client:
            response = client.get("/protected")
            body = response.json
            assert "error" in body

    def test_402_contains_v2_fields(self):
        """Test 402 response has V2 format."""
        app = create_flask_app()
        with app.test_client() as client:
            response = client.get("/protected")
            body = response.json
            assert body["t402Version"] == T402_VERSION_V2
            assert "resource" in body

    def test_402_contains_payment_required_header(self):
        """Test V2 PAYMENT-REQUIRED header is set."""
        app = create_flask_app()
        with app.test_client() as client:
            response = client.get("/protected")
            assert response.status_code == 402
            assert "PAYMENT-REQUIRED" in response.headers


# ========================
# Invalid Payment Headers
# ========================


class TestFlaskInvalidPayment:
    """E2E tests for invalid payment handling."""

    def test_invalid_payment_header_format(self):
        """Test invalid payment header returns 402 with error."""
        app = create_flask_app()
        with app.test_client() as client:
            response = client.get(
                "/protected", headers={"X-PAYMENT": "not_base64"}
            )
            assert response.status_code == 402
            assert response.json is not None
            assert "Invalid payment header format" in response.json["error"]

    def test_v1_x_payment_header_detected(self):
        """Test V1 X-PAYMENT header is still detected."""
        app = create_flask_app()
        with app.test_client() as client:
            response = client.get(
                "/protected", headers={"X-PAYMENT": "invalid"}
            )
            assert response.status_code == 402

    def test_v2_payment_signature_header_detected(self):
        """Test V2 PAYMENT-SIGNATURE header is detected."""
        app = create_flask_app()
        with app.test_client() as client:
            response = client.get(
                "/protected", headers={"PAYMENT-SIGNATURE": "invalid"}
            )
            assert response.status_code == 402


# ========================
# Path Matching
# ========================


class TestFlaskPathMatching:
    """E2E tests for path matching in Flask middleware."""

    def test_single_path(self):
        """Test single path protection."""
        app = create_flask_app(path="/protected")
        with app.test_client() as client:
            assert client.get("/protected").status_code == 402
            assert client.get("/unprotected").status_code == 200

    def test_multiple_paths(self):
        """Test multiple path protection."""
        app = Flask(__name__)

        @app.route("/a")
        def a():
            return {"a": True}

        @app.route("/b")
        def b():
            return {"b": True}

        @app.route("/c")
        def c():
            return {"c": True}

        middleware = PaymentMiddleware(app)
        middleware.add(
            price="$1.00",
            pay_to_address="0x1111111111111111111111111111111111111111",
            path=["/a", "/b"],
            network="base-sepolia",
        )

        with app.test_client() as client:
            assert client.get("/a").status_code == 402
            assert client.get("/b").status_code == 402
            assert client.get("/c").status_code == 200

    def test_glob_path_pattern(self):
        """Test glob path pattern matching."""
        app = Flask(__name__)

        @app.route("/api/data")
        def api_data():
            return {"data": True}

        @app.route("/public")
        def public():
            return {"public": True}

        middleware = PaymentMiddleware(app)
        middleware.add(
            price="$1.00",
            pay_to_address="0x1111111111111111111111111111111111111111",
            path="/api/*",
            network="base-sepolia",
        )

        with app.test_client() as client:
            assert client.get("/api/data").status_code == 402
            assert client.get("/public").status_code == 200

    def test_post_method_protected(self):
        """Test POST method on protected route."""
        app = create_flask_app()
        with app.test_client() as client:
            assert client.post("/protected").status_code == 402


# ========================
# Multiple Middleware Configs
# ========================


class TestFlaskMultipleConfigs:
    """E2E tests for multiple middleware configurations."""

    def test_multiple_configs(self):
        """Test multiple middleware registrations."""
        app = Flask(__name__)

        @app.route("/cheap")
        def cheap():
            return {"cheap": True}

        @app.route("/expensive")
        def expensive():
            return {"expensive": True}

        @app.route("/free")
        def free():
            return {"free": True}

        middleware = PaymentMiddleware(app)
        middleware.add(
            price="$0.01",
            pay_to_address="0x1111111111111111111111111111111111111111",
            path="/cheap",
            network="base-sepolia",
        )
        middleware.add(
            price="$10.00",
            pay_to_address="0x2222222222222222222222222222222222222222",
            path="/expensive",
            network="base-sepolia",
        )

        with app.test_client() as client:
            assert client.get("/cheap").status_code == 402
            assert client.get("/expensive").status_code == 402
            assert client.get("/free").status_code == 200


# ========================
# Price Configuration
# ========================


class TestFlaskPriceConfig:
    """E2E tests for price configuration."""

    def test_dollar_price(self):
        """Test dollar price format."""
        app = create_flask_app(price="$2.50")
        with app.test_client() as client:
            response = client.get("/protected")
            assert response.status_code == 402
            body = response.json
            assert "accepts" in body

    def test_small_price(self):
        """Test small price format."""
        app = create_flask_app(price="$0.001")
        with app.test_client() as client:
            response = client.get("/protected")
            assert response.status_code == 402

    def test_large_price(self):
        """Test large price format."""
        app = create_flask_app(price="$1000.00")
        with app.test_client() as client:
            response = client.get("/protected")
            assert response.status_code == 402


# ========================
# Browser vs API Detection
# ========================


class TestFlaskBrowserDetection:
    """E2E tests for browser vs API client detection."""

    def test_browser_request_returns_html(self):
        """Test browser requests return HTML paywall."""
        app = create_flask_app()
        browser_headers = {
            "Accept": "text/html,application/xhtml+xml",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        }
        with app.test_client() as client:
            response = client.get("/protected", headers=browser_headers)
            assert response.status_code == 402
            assert response.content_type == "text/html; charset=utf-8"
            html = response.get_data(as_text=True)
            assert "window.t402" in html

    def test_api_request_returns_json(self):
        """Test API client requests return JSON."""
        app = create_flask_app()
        api_headers = {
            "Accept": "application/json",
            "User-Agent": "curl/7.68.0",
        }
        with app.test_client() as client:
            response = client.get("/protected", headers=api_headers)
            assert response.status_code == 402
            assert response.content_type == "application/json"
            body = response.json
            assert "accepts" in body


# ========================
# Paywall Configuration
# ========================


class TestFlaskPaywallConfig:
    """E2E tests for paywall configuration."""

    def test_paywall_config_injection(self):
        """Test paywall config is injected into HTML."""
        paywall_config = {
            "app_name": "Test App",
            "app_logo": "https://example.com/logo.png",
        }
        app = create_flask_app(paywall_config=paywall_config)

        browser_headers = {
            "Accept": "text/html",
            "User-Agent": "Mozilla/5.0",
        }
        with app.test_client() as client:
            response = client.get("/protected", headers=browser_headers)
            assert response.status_code == 402
            html = response.get_data(as_text=True)
            assert "window.t402" in html
            assert '"appName": "Test App"' in html

    def test_custom_paywall_html(self):
        """Test custom paywall HTML is used."""
        custom_html = "<html><body>Custom Paywall</body></html>"
        app = create_flask_app(custom_paywall_html=custom_html)

        browser_headers = {
            "Accept": "text/html",
            "User-Agent": "Mozilla/5.0",
        }
        with app.test_client() as client:
            response = client.get("/protected", headers=browser_headers)
            assert response.status_code == 402
            html = response.get_data(as_text=True)
            assert "Custom Paywall" in html


# ========================
# Testnet vs Mainnet
# ========================


class TestFlaskNetworkConfig:
    """E2E tests for network configuration."""

    def test_testnet_config(self):
        """Test testnet configuration."""
        app = create_flask_app(network="base-sepolia")
        browser_headers = {
            "Accept": "text/html",
            "User-Agent": "Mozilla/5.0",
        }
        with app.test_client() as client:
            response = client.get("/protected", headers=browser_headers)
            html = response.get_data(as_text=True)
            assert '"testnet": true' in html

    def test_mainnet_config(self):
        """Test mainnet configuration."""
        app = create_flask_app(network="base")
        browser_headers = {
            "Accept": "text/html",
            "User-Agent": "Mozilla/5.0",
        }
        with app.test_client() as client:
            response = client.get("/protected", headers=browser_headers)
            html = response.get_data(as_text=True)
            assert '"testnet": false' in html
