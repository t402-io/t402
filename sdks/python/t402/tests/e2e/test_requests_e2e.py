"""E2E tests for requests client integration with T402 payment protocol."""

import json
import base64
import pytest
from unittest.mock import MagicMock, patch
from requests import Response, PreparedRequest
from eth_account import Account

from t402.clients.requests import t402HTTPAdapter, t402_http_adapter, t402_requests
from t402.clients.base import PaymentError, t402Client
from t402.types import (
    PaymentRequirements,
    t402PaymentRequiredResponse,
    T402_VERSION_V1,
)


@pytest.fixture
def account():
    """Test Ethereum account."""
    return Account.create()


@pytest.fixture
def session(account):
    """Pre-configured requests session with T402 adapter."""
    return t402_requests(account)


@pytest.fixture
def adapter(account):
    """T402 HTTP adapter instance."""
    return t402_http_adapter(account)


@pytest.fixture
def payment_requirements():
    """V1 payment requirements fixture."""
    return PaymentRequirements(
        scheme="exact",
        network="base-sepolia",
        asset="0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        pay_to="0x0000000000000000000000000000000000000000",
        max_amount_required="10000",
        resource="https://example.com/api/data",
        description="Test payment",
        max_timeout_seconds=1000,
        mime_type="application/json",
        output_schema=None,
        extra={"name": "USD Coin", "version": "2"},
    )


# ========================
# Full Payment Flow
# ========================


class TestRequestsPaymentFlow:
    """E2E tests for the full requests payment flow."""

    def test_full_payment_flow(self, adapter, payment_requirements):
        """Test: request -> 402 -> sign -> resubmit -> 200."""
        # Build initial 402 response
        payment_response = t402PaymentRequiredResponse(
            t402_version=T402_VERSION_V1,
            accepts=[payment_requirements],
            error="Payment Required",
        )
        initial_response = Response()
        initial_response.status_code = 402
        initial_response._content = json.dumps(
            payment_response.model_dump(by_alias=True)
        ).encode()

        # Build retry 200 response
        payment_result = {
            "success": True,
            "transaction": "0x" + "ab" * 32,
            "network": "base-sepolia",
            "payer": "0x" + "cd" * 20,
        }
        retry_response = Response()
        retry_response.status_code = 200
        retry_response.headers = {
            "X-Payment-Response": base64.b64encode(
                json.dumps(payment_result).encode()
            ).decode()
        }
        retry_response._content = b'{"data": "premium content"}'

        # Prepare request
        request = PreparedRequest()
        request.prepare("GET", "https://example.com/api/data")
        request.headers = {}

        # Mock client methods
        adapter.client.select_payment_requirements = MagicMock(
            return_value=payment_requirements
        )
        mock_header = "mock_signed_payment_header"
        adapter.client.create_payment_header = MagicMock(return_value=mock_header)

        def mock_send_impl(req, **kwargs):
            if adapter._is_retry:
                return retry_response
            return initial_response

        with patch(
            "requests.adapters.HTTPAdapter.send", side_effect=mock_send_impl
        ) as mock_send:
            response = adapter.send(request)

        assert response.status_code == 200
        assert "X-Payment-Response" in response.headers
        adapter.client.select_payment_requirements.assert_called_once()
        adapter.client.create_payment_header.assert_called_once()

    def test_success_passes_through(self, adapter):
        """Test that 200 responses pass through."""
        mock_response = Response()
        mock_response.status_code = 200
        mock_response._content = b"ok"

        request = PreparedRequest()
        request.prepare("GET", "https://example.com")

        with patch("requests.adapters.HTTPAdapter.send", return_value=mock_response):
            response = adapter.send(request)

        assert response.status_code == 200

    def test_non_402_passes_through(self, adapter):
        """Test that non-402 errors pass through."""
        for status in [301, 404, 500, 503]:
            mock_response = Response()
            mock_response.status_code = status
            mock_response._content = b"error"

            request = PreparedRequest()
            request.prepare("GET", "https://example.com")

            with patch(
                "requests.adapters.HTTPAdapter.send", return_value=mock_response
            ):
                response = adapter.send(request)
            assert response.status_code == status

    def test_retry_402_no_infinite_loop(self, adapter):
        """Test that a retry 402 does not cause infinite loop."""
        mock_response = Response()
        mock_response.status_code = 402
        mock_response._content = b"payment required"

        request = PreparedRequest()
        request.prepare("GET", "https://example.com")
        adapter._is_retry = True

        with patch("requests.adapters.HTTPAdapter.send", return_value=mock_response):
            response = adapter.send(request)

        assert response.status_code == 402
        assert not adapter._is_retry


# ========================
# Session Creation
# ========================


class TestRequestsSessionCreation:
    """E2E tests for session creation and configuration."""

    def test_create_session(self, account):
        """Test basic session creation."""
        session = t402_requests(account)
        assert session is not None

    def test_create_adapter(self, account):
        """Test basic adapter creation."""
        adapter = t402_http_adapter(account)
        assert isinstance(adapter, t402HTTPAdapter)
        assert adapter.client.account == account

    def test_create_adapter_with_max_value(self, account):
        """Test adapter creation with max_value."""
        adapter = t402_http_adapter(account, max_value=5000)
        assert adapter.client.max_value == 5000

    def test_create_adapter_with_custom_selector(self, account):
        """Test adapter creation with custom selector."""

        def custom_selector(accepts, **kwargs):
            return accepts[0]

        adapter = t402_http_adapter(
            account, payment_requirements_selector=custom_selector
        )
        assert (
            adapter.client._payment_requirements_selector is custom_selector
        )


# ========================
# Error Handling
# ========================


class TestRequestsErrorHandling:
    """E2E tests for error handling in requests client."""

    def test_invalid_json_402_response(self, adapter):
        """Test invalid JSON in 402 body raises PaymentError."""
        mock_response = Response()
        mock_response.status_code = 402
        mock_response._content = b"not valid json"

        request = PreparedRequest()
        request.prepare("GET", "https://example.com")

        with patch("requests.adapters.HTTPAdapter.send", return_value=mock_response):
            with pytest.raises(PaymentError):
                adapter.send(request)
        assert not adapter._is_retry

    def test_unsupported_scheme(self, adapter, payment_requirements):
        """Test unsupported payment scheme raises PaymentError."""
        payment_requirements.scheme = "unsupported"
        payment_response = t402PaymentRequiredResponse(
            t402_version=T402_VERSION_V1,
            accepts=[payment_requirements],
            error="Payment Required",
        )

        mock_response = Response()
        mock_response.status_code = 402
        mock_response._content = json.dumps(
            payment_response.model_dump(by_alias=True)
        ).encode()

        request = PreparedRequest()
        request.prepare("GET", "https://example.com")

        with patch("requests.adapters.HTTPAdapter.send", return_value=mock_response):
            with pytest.raises(PaymentError):
                adapter.send(request)
        assert not adapter._is_retry
