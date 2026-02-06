"""Django Middleware for T402 Payment Protocol.

This module provides middleware for integrating T402 payments
with Django applications, supporting both V1 and V2 protocols.

V1 Protocol:
    - X-PAYMENT header for payment signature
    - X-PAYMENT-RESPONSE header for settlement
    - Response body contains PaymentRequired

V2 Protocol:
    - PAYMENT-SIGNATURE header for payment signature
    - PAYMENT-REQUIRED header for 402 responses
    - PAYMENT-RESPONSE header for settlement

Usage:
    ```python
    # settings.py
    MIDDLEWARE = [
        ...
        "t402.django.PaymentMiddleware",
        ...
    ]

    T402_PAYMENT_CONFIGS = [
        {
            "path": "/api/premium/*",
            "price": "$0.10",
            "pay_to_address": "0x1234...",
            "network": "eip155:8453",
        },
    ]

    # Or configure programmatically:
    from t402.django import PaymentMiddleware
    PaymentMiddleware.configure([
        PaymentConfig(
            price="$0.10",
            pay_to_address="0x...",
            path="/api/*",
            network="eip155:8453",
        ),
    ])
    ```
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Callable, Dict, List, Optional, Union, cast

from django.http import HttpRequest, HttpResponse, JsonResponse

from t402.common import (
    process_price_to_atomic_amount,
    find_matching_payment_requirements,
)
from t402.encoding import (
    encode_payment_required_header,
    encode_payment_response_header,
    extract_payment_from_headers,
    decode_payment_signature_header,
    HEADER_PAYMENT_REQUIRED,
    HEADER_PAYMENT_RESPONSE,
    HEADER_X_PAYMENT_RESPONSE,
)
from t402.facilitator import FacilitatorClient, FacilitatorConfig
from t402.networks import get_all_supported_networks, SupportedNetworks
from t402.path import path_is_match
from t402.paywall import is_browser_request, get_paywall_html
from t402.types import (
    PaymentPayload,
    PaymentRequirements,
    PaymentRequirementsV2,
    PaymentRequiredV2,
    ResourceInfo,
    Price,
    t402PaymentRequiredResponse,
    PaywallConfig,
    HTTPInputSchema,
    T402_VERSION_V1,
    T402_VERSION_V2,
    VerifyResponse,
)

logger = logging.getLogger(__name__)


class PaymentDetails:
    """Payment details stored in request after verification."""

    def __init__(
        self,
        requirements: Union[PaymentRequirements, PaymentRequirementsV2],
        verify_response: VerifyResponse,
        protocol_version: int,
    ):
        self.requirements = requirements
        self.verify_response = verify_response
        self.protocol_version = protocol_version

    @property
    def is_verified(self) -> bool:
        """Check if payment was verified."""
        return self.verify_response.is_valid

    @property
    def payer_address(self) -> Optional[str]:
        """Get payer address from verify response."""
        return getattr(self.verify_response, "payer", None)


class PaymentConfig:
    """Configuration for a payment-protected route."""

    def __init__(
        self,
        price: Price,
        pay_to_address: str,
        path: Union[str, List[str]] = "*",
        description: str = "",
        mime_type: str = "",
        max_timeout_seconds: int = 60,
        input_schema: Optional[HTTPInputSchema] = None,
        output_schema: Optional[Any] = None,
        discoverable: bool = True,
        facilitator_config: Optional[FacilitatorConfig] = None,
        network: str = "eip155:8453",
        resource: Optional[str] = None,
        paywall_config: Optional[PaywallConfig] = None,
        custom_paywall_html: Optional[str] = None,
        protocol_version: int = T402_VERSION_V2,
    ):
        self.price = price
        self.pay_to_address = pay_to_address
        self.path = path
        self.description = description
        self.mime_type = mime_type
        self.max_timeout_seconds = max_timeout_seconds
        self.input_schema = input_schema
        self.output_schema = output_schema
        self.discoverable = discoverable
        self.facilitator_config = facilitator_config
        self.network = network
        self.resource = resource
        self.paywall_config = paywall_config
        self.custom_paywall_html = custom_paywall_html
        self.protocol_version = protocol_version

        # Validate and process price
        self._validate()

    def _validate(self):
        """Validate configuration."""
        supported_networks = get_all_supported_networks()
        if self.network not in supported_networks:
            raise ValueError(
                f"Unsupported network: {self.network}. Must be one of: {supported_networks}"
            )

        try:
            self.max_amount_required, self.asset_address, self.eip712_domain = (
                process_price_to_atomic_amount(self.price, self.network)
            )
        except Exception as e:
            raise ValueError(f"Invalid price: {self.price}. Error: {e}")


class PaymentMiddleware:
    """Django middleware for T402 payment requirements.

    This class provides Django-compatible middleware for protecting routes
    with T402 payment requirements. It supports multiple configurations
    with different path patterns and settings.

    Configuration via Django settings:
        ```python
        # settings.py
        MIDDLEWARE = [
            ...
            "t402.django.PaymentMiddleware",
            ...
        ]

        T402_PAYMENT_CONFIGS = [
            {
                "path": "/api/premium/*",
                "price": "$0.10",
                "pay_to_address": "0x1234...",
                "network": "eip155:8453",
            },
        ]
        ```

    Programmatic configuration:
        ```python
        PaymentMiddleware.configure([
            PaymentConfig(price="$0.10", pay_to_address="0x...", path="/api/*"),
        ])
        ```
    """

    # Class-level storage for payment configs
    _configs: List[PaymentConfig] = []

    def __init__(self, get_response: Callable):
        """Initialize the Django middleware.

        Args:
            get_response: The next middleware or view callable in the chain
        """
        self.get_response = get_response

        # Load configs from Django settings if no programmatic configs
        if not PaymentMiddleware._configs:
            self._load_from_settings()

    def _load_from_settings(self):
        """Load payment configs from Django settings."""
        try:
            from django.conf import settings

            configs_data = getattr(settings, "T402_PAYMENT_CONFIGS", [])
            for config_dict in configs_data:
                config = PaymentConfig(**config_dict)
                PaymentMiddleware._configs.append(config)
        except Exception:
            # Settings may not be configured in all environments
            pass

    @classmethod
    def configure(cls, configs: List[PaymentConfig]) -> None:
        """Configure payment middleware with a list of PaymentConfig objects.

        Args:
            configs: List of PaymentConfig objects
        """
        cls._configs = list(configs)

    @classmethod
    def add(
        cls,
        price: Price,
        pay_to_address: str,
        path: Union[str, List[str]] = "*",
        description: str = "",
        mime_type: str = "",
        max_timeout_seconds: int = 60,
        input_schema: Optional[HTTPInputSchema] = None,
        output_schema: Optional[Any] = None,
        discoverable: bool = True,
        facilitator_config: Optional[FacilitatorConfig] = None,
        network: str = "eip155:8453",
        resource: Optional[str] = None,
        paywall_config: Optional[PaywallConfig] = None,
        custom_paywall_html: Optional[str] = None,
        protocol_version: int = T402_VERSION_V2,
    ) -> type:
        """Add a payment requirement configuration.

        Args:
            price: Payment price (USD string or TokenAmount dict)
            pay_to_address: Address to receive payment
            path: Path pattern(s) to protect
            description: Resource description
            mime_type: Resource MIME type
            max_timeout_seconds: Maximum payment timeout
            input_schema: HTTP input schema
            output_schema: Response schema
            discoverable: Whether route is discoverable
            facilitator_config: Facilitator configuration
            network: Network identifier (CAIP-2 format)
            resource: Explicit resource URL
            paywall_config: Paywall UI configuration
            custom_paywall_html: Custom paywall HTML
            protocol_version: T402 protocol version (1 or 2)

        Returns:
            The class for chaining
        """
        config = PaymentConfig(
            price=price,
            pay_to_address=pay_to_address,
            path=path,
            description=description,
            mime_type=mime_type,
            max_timeout_seconds=max_timeout_seconds,
            input_schema=input_schema,
            output_schema=output_schema,
            discoverable=discoverable,
            facilitator_config=facilitator_config,
            network=network,
            resource=resource,
            paywall_config=paywall_config,
            custom_paywall_html=custom_paywall_html,
            protocol_version=protocol_version,
        )
        cls._configs.append(config)
        return cls

    @classmethod
    def reset(cls) -> None:
        """Reset all payment configs. Useful for testing."""
        cls._configs = []

    def __call__(self, request: HttpRequest) -> HttpResponse:
        """Process the request through payment middleware.

        Args:
            request: Incoming Django HttpRequest

        Returns:
            HttpResponse object
        """
        # Find matching config
        config = self._find_matching_config(request.path)
        if not config:
            return self.get_response(request)

        # Create facilitator client
        facilitator = FacilitatorClient(config.facilitator_config)

        # Get resource URL
        resource_url = config.resource or request.build_absolute_uri()

        # Build request headers dict for protocol detection
        request_headers = self._get_headers_dict(request)

        # Build payment requirements
        requirements = self._build_requirements(config, request, resource_url)

        # Create 402 response helper
        def create_402_response(error: str) -> HttpResponse:
            return self._create_402_response(
                error=error,
                requirements=[requirements],
                request_headers=request_headers,
                protocol_version=config.protocol_version,
                paywall_config=config.paywall_config,
                custom_paywall_html=config.custom_paywall_html,
                resource_url=resource_url,
            )

        # Extract payment from headers
        version, payment_header = extract_payment_from_headers(request_headers)

        if not payment_header:
            return create_402_response("No payment header provided")

        # Decode payment
        try:
            payment_dict = decode_payment_signature_header(payment_header)
            payment = PaymentPayload(**payment_dict)
        except Exception as e:
            client_ip = request.META.get("REMOTE_ADDR", "unknown")
            logger.warning(f"Invalid payment header from {client_ip}: {e}")
            return create_402_response("Invalid payment header format")

        # Find matching requirements
        selected_requirements = find_matching_payment_requirements(
            [requirements], payment
        )
        if not selected_requirements:
            return create_402_response("No matching payment requirements found")

        # Verify payment (async in sync context)
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                verify_response = loop.run_until_complete(
                    facilitator.verify(payment, selected_requirements)
                )
            finally:
                loop.close()
        except Exception as e:
            logger.error(f"Payment verification failed: {e}")
            return create_402_response(f"Payment verification failed: {e}")

        if not verify_response.is_valid:
            error_reason = verify_response.invalid_reason or "Unknown error"
            return create_402_response(f"Invalid payment: {error_reason}")

        # Store payment details on the request
        request.payment_details = PaymentDetails(
            requirements=selected_requirements,
            verify_response=verify_response,
            protocol_version=version,
        )
        request.verify_response = verify_response

        # Process request through the rest of the middleware chain / view
        response = self.get_response(request)

        # Skip settlement for non-2xx responses
        if response.status_code < 200 or response.status_code >= 300:
            return response

        # Settle payment
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                settle_response = loop.run_until_complete(
                    facilitator.settle(payment, selected_requirements)
                )
            finally:
                loop.close()

            if settle_response.success:
                # Add settlement header based on version
                header_name = (
                    HEADER_PAYMENT_RESPONSE
                    if version == T402_VERSION_V2
                    else HEADER_X_PAYMENT_RESPONSE
                )
                header_value = encode_payment_response_header(settle_response)
                response[header_name] = header_value
            else:
                return create_402_response(
                    f"Settlement failed: {settle_response.error_reason or 'Unknown error'}"
                )
        except Exception as e:
            logger.error(f"Settlement failed: {e}")
            return create_402_response(f"Settlement failed: {e}")

        return response

    def _find_matching_config(self, path: str) -> Optional[PaymentConfig]:
        """Find a matching payment config for the given path.

        Args:
            path: Request path

        Returns:
            Matching PaymentConfig or None
        """
        for config in PaymentMiddleware._configs:
            if path_is_match(config.path, path):
                return config
        return None

    def _get_headers_dict(self, request: HttpRequest) -> Dict[str, str]:
        """Extract headers from Django request into a flat dict.

        Django stores headers in META with HTTP_ prefix and uppercase names.

        Args:
            request: Django HttpRequest

        Returns:
            Dictionary of header name to value
        """
        headers = {}
        for key, value in request.META.items():
            if key.startswith("HTTP_"):
                # Convert HTTP_PAYMENT_SIGNATURE to payment-signature
                header_name = key[5:].replace("_", "-").lower()
                headers[header_name] = value
            elif key == "CONTENT_TYPE":
                headers["content-type"] = value
            elif key == "CONTENT_LENGTH":
                headers["content-length"] = value
        return headers

    def _build_requirements(
        self,
        config: PaymentConfig,
        request: HttpRequest,
        resource_url: str,
    ) -> PaymentRequirements:
        """Build payment requirements from config.

        Args:
            config: Payment configuration
            request: Incoming request
            resource_url: Resource URL

        Returns:
            PaymentRequirements object
        """
        return PaymentRequirements(
            scheme="exact",
            network=cast(SupportedNetworks, config.network),
            asset=config.asset_address,
            max_amount_required=config.max_amount_required,
            resource=resource_url,
            description=config.description,
            mime_type=config.mime_type,
            pay_to=config.pay_to_address,
            max_timeout_seconds=config.max_timeout_seconds,
            output_schema={
                "input": {
                    "type": "http",
                    "method": request.method.upper(),
                    "discoverable": config.discoverable,
                    **(config.input_schema.model_dump() if config.input_schema else {}),
                },
                "output": config.output_schema,
            },
            extra=config.eip712_domain,
        )

    def _create_402_response(
        self,
        error: str,
        requirements: List[PaymentRequirements],
        request_headers: Dict[str, str],
        protocol_version: int,
        paywall_config: Optional[PaywallConfig],
        custom_paywall_html: Optional[str],
        resource_url: str,
    ) -> HttpResponse:
        """Create a 402 Payment Required response.

        Args:
            error: Error message
            requirements: Payment requirements
            request_headers: Request headers
            protocol_version: Protocol version
            paywall_config: Paywall configuration
            custom_paywall_html: Custom HTML
            resource_url: Resource URL

        Returns:
            402 HttpResponse
        """
        status_code = 402

        # Browser request - return HTML paywall
        if is_browser_request(request_headers):
            html_content = custom_paywall_html or get_paywall_html(
                error, requirements, paywall_config
            )
            response = HttpResponse(
                content=html_content,
                status=status_code,
                content_type="text/html; charset=utf-8",
            )
            return response

        # API request - return JSON with appropriate headers
        if protocol_version == T402_VERSION_V2:
            # V2: Use PAYMENT-REQUIRED header
            resource_info = ResourceInfo(
                url=resource_url,
                description=requirements[0].description if requirements else "",
                mime_type=requirements[0].mime_type if requirements else "",
            )

            # Convert V1 requirements to V2 format
            accepts_v2 = []
            for req in requirements:
                accepts_v2.append(
                    PaymentRequirementsV2(
                        scheme=req.scheme,
                        network=req.network,
                        asset=req.asset,
                        amount=req.max_amount_required,
                        pay_to=req.pay_to,
                        max_timeout_seconds=req.max_timeout_seconds,
                        extra=req.extra or {},
                    )
                )

            payment_required = PaymentRequiredV2(
                t402_version=T402_VERSION_V2,
                resource=resource_info,
                accepts=accepts_v2,
                error=error,
            )

            header_value = encode_payment_required_header(payment_required)

            response = JsonResponse(
                data=payment_required.model_dump(by_alias=True),
                status=status_code,
            )
            response["Content-Type"] = "application/json"
            response[HEADER_PAYMENT_REQUIRED] = header_value
            return response
        else:
            # V1: Return body only
            response_data = t402PaymentRequiredResponse(
                t402_version=T402_VERSION_V1,
                accepts=requirements,
                error=error,
            ).model_dump(by_alias=True)

            response = JsonResponse(
                data=response_data,
                status=status_code,
            )
            response["Content-Type"] = "application/json"
            return response
