"""FastAPI Middleware for T402 Payment Protocol.

This module provides middleware and utilities for integrating T402 payments
with FastAPI applications, supporting both V1 and V2 protocols.

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
    from fastapi import FastAPI
    from t402.fastapi import PaymentMiddleware, require_payment

    app = FastAPI()

    # Option 1: Use middleware class
    payment = PaymentMiddleware(app)
    payment.add(path="/api/*", price="$0.10", pay_to_address="0x...")

    # Option 2: Use dependency injection (per-route)
    @app.get("/premium")
    async def premium_content(payment: PaymentDetails = Depends(require_payment("$0.10", "0x..."))):
        return {"message": "Premium content"}
    ```
"""

from __future__ import annotations

import logging
from typing import Any, Callable, Dict, List, Optional, Union, cast

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse, HTMLResponse
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic import validate_call

from t402.common import (
    process_price_to_atomic_amount,
    find_matching_payment_requirements,
)
from t402.encoding import (
    encode_payment_required_header,
    encode_payment_response_header,
    detect_protocol_version_from_headers,
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
    """Payment details stored in request state after verification."""

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
        # Validate network is supported
        supported_networks = get_all_supported_networks()
        if self.network not in supported_networks:
            raise ValueError(
                f"Unsupported network: {self.network}. Must be one of: {supported_networks}"
            )

        # Process price
        try:
            self.max_amount_required, self.asset_address, self.eip712_domain = (
                process_price_to_atomic_amount(self.price, self.network)
            )
        except Exception as e:
            raise ValueError(f"Invalid price: {self.price}. Error: {e}")


class PaymentMiddleware:
    """FastAPI middleware for T402 payment requirements.

    This class provides a flexible way to add payment requirements to FastAPI routes.
    It supports multiple configurations with different path patterns and settings.

    Example:
        ```python
        app = FastAPI()
        payment = PaymentMiddleware(app)

        # Add payment requirement for a specific path
        payment.add(
            path="/api/premium/*",
            price="$0.10",
            pay_to_address="0x1234...",
            network="eip155:8453",
        )

        # Add payment for another path with different config
        payment.add(
            path="/api/data",
            price={"amount": "1000000", "asset": "0xUSDC..."},
            pay_to_address="0x5678...",
        )
        ```
    """

    def __init__(self, app: FastAPI):
        """Initialize the payment middleware.

        Args:
            app: FastAPI application instance
        """
        self.app = app
        self.configs: List[PaymentConfig] = []
        self._middleware_added = False

    def add(
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
    ) -> "PaymentMiddleware":
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
            Self for chaining
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
        self.configs.append(config)

        # Add middleware if not already added
        if not self._middleware_added:
            self.app.add_middleware(
                BaseHTTPMiddleware,
                dispatch=self._dispatch,
            )
            self._middleware_added = True

        return self

    async def _dispatch(
        self, request: Request, call_next: Callable
    ) -> Response:
        """Process request through payment middleware.

        Args:
            request: Incoming request
            call_next: Next middleware/handler

        Returns:
            Response object
        """
        # Find matching config
        config = self._find_matching_config(request.url.path)
        if not config:
            return await call_next(request)

        # Create facilitator client
        facilitator = FacilitatorClient(config.facilitator_config)

        # Get resource URL
        resource_url = config.resource or str(request.url)

        # Detect protocol version from request headers
        request_headers = dict(request.headers)
        detect_protocol_version_from_headers(request_headers)

        # Build payment requirements
        requirements = self._build_requirements(config, request, resource_url)

        # Create 402 response helper
        def create_402_response(error: str) -> Response:
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
            logger.warning(
                f"Invalid payment header from {request.client.host if request.client else 'unknown'}: {e}"
            )
            return create_402_response("Invalid payment header format")

        # Find matching requirements
        selected_requirements = find_matching_payment_requirements(
            [requirements], payment
        )
        if not selected_requirements:
            return create_402_response("No matching payment requirements found")

        # Verify payment
        try:
            verify_response = await facilitator.verify(payment, selected_requirements)
        except Exception as e:
            logger.error(f"Payment verification failed: {e}")
            return create_402_response(f"Payment verification failed: {e}")

        if not verify_response.is_valid:
            error_reason = verify_response.invalid_reason or "Unknown error"
            return create_402_response(f"Invalid payment: {error_reason}")

        # Store payment details in request state
        request.state.payment_details = PaymentDetails(
            requirements=selected_requirements,
            verify_response=verify_response,
            protocol_version=version,
        )
        request.state.verify_response = verify_response

        # Process request
        response = await call_next(request)

        # Skip settlement for non-2xx responses
        if response.status_code < 200 or response.status_code >= 300:
            return response

        # Settle payment
        try:
            settle_response = await facilitator.settle(payment, selected_requirements)
            if settle_response.success:
                # Add settlement header based on version
                header_name = (
                    HEADER_PAYMENT_RESPONSE
                    if version == T402_VERSION_V2
                    else HEADER_X_PAYMENT_RESPONSE
                )
                header_value = encode_payment_response_header(settle_response)
                response.headers[header_name] = header_value
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
        for config in self.configs:
            if path_is_match(config.path, path):
                return config
        return None

    def _build_requirements(
        self,
        config: PaymentConfig,
        request: Request,
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
    ) -> Response:
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
            402 Response
        """
        status_code = 402

        # Browser request - return HTML paywall
        if is_browser_request(request_headers):
            html_content = custom_paywall_html or get_paywall_html(
                error, requirements, paywall_config
            )
            return HTMLResponse(
                content=html_content,
                status_code=status_code,
                headers={"Content-Type": "text/html; charset=utf-8"},
            )

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

            # Return response with header and body
            return JSONResponse(
                content=payment_required.model_dump(by_alias=True),
                status_code=status_code,
                headers={
                    "Content-Type": "application/json",
                    HEADER_PAYMENT_REQUIRED: header_value,
                },
            )
        else:
            # V1: Return body only
            response_data = t402PaymentRequiredResponse(
                t402_version=T402_VERSION_V1,
                accepts=requirements,
                error=error,
            ).model_dump(by_alias=True)

            return JSONResponse(
                content=response_data,
                status_code=status_code,
                headers={"Content-Type": "application/json"},
            )


@validate_call
def require_payment(
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
    """Generate a FastAPI middleware that gates payments for an endpoint.

    This is the functional middleware approach, useful when you want
    fine-grained control over which endpoints require payment.

    Args:
        price: Payment price (USD string like "$0.10" or TokenAmount dict)
        pay_to_address: Address to receive the payment
        path: Path pattern(s) to protect. Defaults to "*" for all.
        description: Description of the resource
        mime_type: MIME type of the resource
        max_timeout_seconds: Maximum time allowed for payment
        input_schema: Schema for request structure
        output_schema: Schema for response structure
        discoverable: Whether the route is discoverable
        facilitator_config: Facilitator configuration
        network: Network identifier (CAIP-2 format)
        resource: Explicit resource URL
        paywall_config: Paywall UI configuration
        custom_paywall_html: Custom paywall HTML
        protocol_version: T402 protocol version (1 or 2)

    Returns:
        FastAPI middleware function

    Example:
        ```python
        app = FastAPI()

        @app.middleware("http")
        async def payment_middleware(request: Request, call_next):
            middleware = require_payment(
                price="$0.10",
                pay_to_address="0x...",
                path="/api/*",
            )
            return await middleware(request, call_next)
        ```
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

    facilitator = FacilitatorClient(facilitator_config)

    async def middleware(request: Request, call_next: Callable) -> Response:
        # Skip if path doesn't match
        if not path_is_match(config.path, request.url.path):
            return await call_next(request)

        # Get resource URL
        resource_url = config.resource or str(request.url)

        # Detect protocol version
        request_headers = dict(request.headers)
        detect_protocol_version_from_headers(request_headers)

        # Build requirements
        requirements = PaymentRequirements(
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

        def create_402_response(error: str) -> Response:
            """Create a 402 response."""
            status_code = 402

            if is_browser_request(request_headers):
                html = config.custom_paywall_html or get_paywall_html(
                    error, [requirements], config.paywall_config
                )
                return HTMLResponse(content=html, status_code=status_code)

            if config.protocol_version == T402_VERSION_V2:
                resource_info = ResourceInfo(
                    url=resource_url,
                    description=config.description,
                    mime_type=config.mime_type,
                )
                payment_required = PaymentRequiredV2(
                    t402_version=T402_VERSION_V2,
                    resource=resource_info,
                    accepts=[
                        PaymentRequirementsV2(
                            scheme=requirements.scheme,
                            network=requirements.network,
                            asset=requirements.asset,
                            amount=requirements.max_amount_required,
                            pay_to=requirements.pay_to,
                            max_timeout_seconds=requirements.max_timeout_seconds,
                            extra=requirements.extra or {},
                        )
                    ],
                    error=error,
                )
                header_value = encode_payment_required_header(payment_required)
                return JSONResponse(
                    content=payment_required.model_dump(by_alias=True),
                    status_code=status_code,
                    headers={HEADER_PAYMENT_REQUIRED: header_value},
                )
            else:
                response_data = t402PaymentRequiredResponse(
                    t402_version=T402_VERSION_V1,
                    accepts=[requirements],
                    error=error,
                ).model_dump(by_alias=True)
                return JSONResponse(content=response_data, status_code=status_code)

        # Extract payment header
        version, payment_header = extract_payment_from_headers(request_headers)

        if not payment_header:
            return create_402_response("No payment header provided")

        # Decode payment
        try:
            payment_dict = decode_payment_signature_header(payment_header)
            payment = PaymentPayload(**payment_dict)
        except Exception as e:
            logger.warning(f"Invalid payment header: {e}")
            return create_402_response("Invalid payment header format")

        # Find matching requirements
        selected = find_matching_payment_requirements([requirements], payment)
        if not selected:
            return create_402_response("No matching payment requirements found")

        # Verify
        try:
            verify_response = await facilitator.verify(payment, selected)
        except Exception as e:
            logger.error(f"Verification failed: {e}")
            return create_402_response(f"Verification failed: {e}")

        if not verify_response.is_valid:
            return create_402_response(
                f"Invalid payment: {verify_response.invalid_reason or 'Unknown'}"
            )

        # Store in request state
        request.state.payment_details = PaymentDetails(
            requirements=selected,
            verify_response=verify_response,
            protocol_version=version,
        )
        request.state.verify_response = verify_response

        # Call next
        response = await call_next(request)

        # Skip settlement for non-2xx
        if response.status_code < 200 or response.status_code >= 300:
            return response

        # Settle
        try:
            settle_response = await facilitator.settle(payment, selected)
            if settle_response.success:
                header_name = (
                    HEADER_PAYMENT_RESPONSE
                    if version == T402_VERSION_V2
                    else HEADER_X_PAYMENT_RESPONSE
                )
                response.headers[header_name] = encode_payment_response_header(
                    settle_response
                )
            else:
                return create_402_response(
                    f"Settlement failed: {settle_response.error_reason or 'Unknown'}"
                )
        except Exception as e:
            logger.error(f"Settlement failed: {e}")
            return create_402_response(f"Settlement failed: {e}")

        return response

    return middleware
