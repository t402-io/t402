"""E2E tests for httpx client integration with T402 payment protocol."""

import json
import base64
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import Request, Response
from eth_account import Account

from t402.clients.httpx import HttpxHooks, t402_payment_hooks
from t402.clients.base import PaymentError, t402Client
from t402.types import (
    PaymentRequirements,
    PaymentRequirementsV2,
    t402PaymentRequiredResponse,
    T402_VERSION_V1,
)


@pytest.fixture
def account():
    """Test Ethereum account."""
    return Account.create()


@pytest.fixture
def payment_requirements_v1():
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


@pytest.fixture
def payment_requirements_v2():
    """V2 payment requirements fixture."""
    return PaymentRequirementsV2(
        scheme="exact",
        network="eip155:8453",
        maxAmountRequired="10000",
        resource="https://example.com/api/data",
        description="Test payment v2",
        maxDeadlineSeconds=60,
        payTo="0x0000000000000000000000000000000000000000",
        asset="0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        extra={"name": "USD Coin", "version": "2"},
    )


# ========================
# Full Payment Flow (V1)
# ========================


class TestHttpxPaymentFlowV1:
    """E2E tests for the full httpx V1 payment flow."""

    async def test_full_payment_flow(self, account, payment_requirements_v1):
        """Test: request -> 402 -> sign -> resubmit -> 200."""
        hooks = HttpxHooks(t402Client(account))

        # Build 402 response
        payment_response = t402PaymentRequiredResponse(
            t402_version=T402_VERSION_V1,
            accepts=[payment_requirements_v1],
            error="Payment Required",
        )
        response_402 = Response(402)
        response_402.request = Request("GET", "https://example.com/api/data")
        response_402._content = json.dumps(
            payment_response.model_dump(by_alias=True)
        ).encode()

        # Build 200 retry response
        payment_result = {
            "success": True,
            "transaction": "0x" + "ab" * 32,
            "network": "base-sepolia",
            "payer": account.address,
        }
        retry_response = Response(200)
        retry_response.headers = {
            "PAYMENT-RESPONSE": base64.b64encode(
                json.dumps(payment_result).encode()
            ).decode()
        }
        retry_response._content = b'{"data": "premium content"}'

        mock_client = AsyncMock()
        mock_client.send.return_value = retry_response
        mock_client.__aenter__.return_value = mock_client

        hooks.client.select_payment_requirements = MagicMock(
            return_value=payment_requirements_v1
        )
        mock_header = "mock_signed_payment_header_v1"
        hooks.client.create_payment_header = MagicMock(return_value=mock_header)

        with patch("t402.clients.httpx.AsyncClient", return_value=mock_client):
            result = await hooks.on_response(response_402)

        assert result.status_code == 200
        assert mock_client.send.called
        retry_req = mock_client.send.call_args[0][0]
        assert retry_req.headers["PAYMENT-SIGNATURE"] == mock_header

    async def test_non_402_passes_through(self, account):
        """Test that non-402 responses pass through unchanged."""
        hooks = HttpxHooks(t402Client(account))

        for status in [200, 201, 301, 404, 500]:
            response = Response(status)
            result = await hooks.on_response(response)
            assert result.status_code == status

    async def test_retry_402_passes_through(self, account):
        """Test that a retry 402 response passes through (no infinite loop)."""
        hooks = HttpxHooks(t402Client(account))
        hooks._is_retry = True

        response = Response(402)
        result = await hooks.on_response(response)
        assert result.status_code == 402

    async def test_invalid_json_raises_payment_error(self, account):
        """Test invalid JSON in 402 body raises PaymentError."""
        hooks = HttpxHooks(t402Client(account))

        response = Response(402)
        response.request = Request("GET", "https://example.com")
        response._content = b"not json at all"

        with pytest.raises(PaymentError):
            await hooks.on_response(response)
        assert not hooks._is_retry


# ========================
# Hook Creation
# ========================


class TestHttpxHookCreation:
    """E2E tests for httpx hook creation and configuration."""

    def test_create_hooks_basic(self, account):
        """Test basic hook creation."""
        hooks_dict = t402_payment_hooks(account)
        assert "request" in hooks_dict
        assert "response" in hooks_dict
        assert len(hooks_dict["request"]) == 1
        assert len(hooks_dict["response"]) == 1

    def test_create_hooks_with_max_value(self, account):
        """Test hook creation with max_value."""
        hooks_dict = t402_payment_hooks(account, max_value=5000)
        hooks_instance = hooks_dict["response"][0].__self__
        assert hooks_instance.client.max_value == 5000

    def test_create_hooks_with_custom_selector(self, account):
        """Test hook creation with custom selector."""

        def custom_selector(accepts, **kwargs):
            return accepts[0]

        hooks_dict = t402_payment_hooks(
            account, payment_requirements_selector=custom_selector
        )
        hooks_instance = hooks_dict["response"][0].__self__
        assert hooks_instance.client._payment_requirements_selector is custom_selector

    def test_hooks_instance_type(self, account):
        """Test that hooks instance is correct type."""
        hooks_dict = t402_payment_hooks(account)
        hooks_instance = hooks_dict["response"][0].__self__
        assert isinstance(hooks_instance, HttpxHooks)
        assert hooks_instance.client.account == account


# ========================
# Facilitator Rejection
# ========================


class TestHttpxFacilitatorRejection:
    """E2E tests for facilitator rejection scenarios."""

    async def test_unsupported_scheme_raises_error(
        self, account, payment_requirements_v1
    ):
        """Test that unsupported scheme raises PaymentError."""
        hooks = HttpxHooks(t402Client(account))

        payment_requirements_v1.scheme = "unsupported_scheme"
        payment_response = t402PaymentRequiredResponse(
            t402_version=T402_VERSION_V1,
            accepts=[payment_requirements_v1],
            error="Payment Required",
        )

        response = Response(402)
        response.request = Request("GET", "https://example.com")
        response._content = json.dumps(
            payment_response.model_dump(by_alias=True)
        ).encode()

        with pytest.raises(PaymentError):
            await hooks.on_response(response)
        assert not hooks._is_retry

    async def test_missing_request_raises_error(self, account):
        """Test that missing request object raises PaymentError."""
        hooks = HttpxHooks(t402Client(account))

        response = Response(402)
        # Don't set response.request

        with pytest.raises(PaymentError, match="request"):
            await hooks.on_response(response)
