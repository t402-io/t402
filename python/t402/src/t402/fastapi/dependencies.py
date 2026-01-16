"""FastAPI Dependencies for T402 Payment Protocol.

This module provides FastAPI dependency injection utilities for
requiring payment on specific routes.

Usage:
    ```python
    from fastapi import FastAPI, Depends
    from t402.fastapi import PaymentRequired, get_payment_details

    app = FastAPI()

    # Create a payment requirement
    premium_payment = PaymentRequired(
        price="$0.10",
        pay_to_address="0x1234...",
        network="eip155:8453",
    )

    @app.get("/premium")
    async def premium_content(
        payment: PaymentDetails = Depends(premium_payment)
    ):
        # Access payment details
        print(f"Paid by: {payment.payer_address}")
        return {"message": "Premium content"}

    # Or use the simpler get_payment_details dependency
    @app.get("/data")
    async def get_data(
        payment: PaymentDetails = Depends(get_payment_details)
    ):
        if not payment:
            raise HTTPException(402, "Payment required")
        return {"data": "..."}
    ```
"""

from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import HTTPException, Request

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
)
from t402.facilitator import FacilitatorClient, FacilitatorConfig
from t402.networks import get_all_supported_networks
from t402.types import (
    PaymentPayload,
    PaymentRequirements,
    PaymentRequirementsV2,
    PaymentRequiredV2,
    ResourceInfo,
    Price,
    t402PaymentRequiredResponse,
    PaywallConfig,
    T402_VERSION_V1,
    T402_VERSION_V2,
)
from t402.fastapi.middleware import PaymentDetails

logger = logging.getLogger(__name__)


async def get_payment_details(request: Request) -> Optional[PaymentDetails]:
    """Get payment details from request state.

    This dependency retrieves payment details that were set by the
    PaymentMiddleware after successful payment verification.

    Args:
        request: FastAPI request

    Returns:
        PaymentDetails if payment was verified, None otherwise

    Example:
        ```python
        @app.get("/data")
        async def get_data(payment: PaymentDetails = Depends(get_payment_details)):
            if payment and payment.is_verified:
                return {"message": "Paid content"}
            return {"message": "Free content"}
        ```
    """
    return getattr(request.state, "payment_details", None)


class PaymentRequired:
    """FastAPI dependency for requiring payment on a route.

    This class creates a callable dependency that can be used with
    FastAPI's Depends() to require payment for specific routes.

    The dependency will:
    1. Check for a valid payment header
    2. Verify the payment with the facilitator
    3. Return PaymentDetails on success
    4. Raise HTTPException(402) on failure

    Example:
        ```python
        from fastapi import FastAPI, Depends
        from t402.fastapi import PaymentRequired, PaymentDetails

        app = FastAPI()

        # Create reusable payment requirement
        api_payment = PaymentRequired(
            price="$0.10",
            pay_to_address="0x1234...",
            network="eip155:8453",
            description="API access",
        )

        @app.get("/api/data")
        async def get_data(payment: PaymentDetails = Depends(api_payment)):
            return {"data": "premium content", "payer": payment.payer_address}
        ```
    """

    def __init__(
        self,
        price: Price,
        pay_to_address: str,
        description: str = "",
        mime_type: str = "",
        max_timeout_seconds: int = 60,
        facilitator_config: Optional[FacilitatorConfig] = None,
        network: str = "eip155:8453",
        paywall_config: Optional[PaywallConfig] = None,
        custom_paywall_html: Optional[str] = None,
        protocol_version: int = T402_VERSION_V2,
        auto_settle: bool = False,
    ):
        """Initialize the payment requirement.

        Args:
            price: Payment price (USD string or TokenAmount dict)
            pay_to_address: Address to receive payment
            description: Resource description
            mime_type: Resource MIME type
            max_timeout_seconds: Maximum payment timeout
            facilitator_config: Facilitator configuration
            network: Network identifier (CAIP-2 format)
            paywall_config: Paywall UI configuration
            custom_paywall_html: Custom paywall HTML
            protocol_version: T402 protocol version (1 or 2)
            auto_settle: Whether to auto-settle (default False, settlement
                         is typically done by middleware or manually)
        """
        self.price = price
        self.pay_to_address = pay_to_address
        self.description = description
        self.mime_type = mime_type
        self.max_timeout_seconds = max_timeout_seconds
        self.facilitator_config = facilitator_config
        self.network = network
        self.paywall_config = paywall_config
        self.custom_paywall_html = custom_paywall_html
        self.protocol_version = protocol_version
        self.auto_settle = auto_settle

        # Validate network
        supported_networks = get_all_supported_networks()
        if network not in supported_networks:
            raise ValueError(
                f"Unsupported network: {network}. Must be one of: {supported_networks}"
            )

        # Process price
        try:
            self.max_amount_required, self.asset_address, self.eip712_domain = (
                process_price_to_atomic_amount(price, network)
            )
        except Exception as e:
            raise ValueError(f"Invalid price: {price}. Error: {e}")

        # Create facilitator client
        self.facilitator = FacilitatorClient(facilitator_config)

    async def __call__(self, request: Request) -> PaymentDetails:
        """Verify payment and return details.

        Args:
            request: FastAPI request

        Returns:
            PaymentDetails after successful verification

        Raises:
            HTTPException: 402 if payment is missing or invalid
        """
        # Get resource URL
        resource_url = str(request.url)

        # Build requirements
        requirements = PaymentRequirements(
            scheme="exact",
            network=self.network,
            asset=self.asset_address,
            max_amount_required=self.max_amount_required,
            resource=resource_url,
            description=self.description,
            mime_type=self.mime_type,
            pay_to=self.pay_to_address,
            max_timeout_seconds=self.max_timeout_seconds,
            output_schema=None,
            extra=self.eip712_domain,
        )

        # Get request headers
        request_headers = dict(request.headers)

        # Extract payment header
        version, payment_header = extract_payment_from_headers(request_headers)

        if not payment_header:
            self._raise_402("No payment header provided", [requirements], request)

        # Decode payment
        try:
            payment_dict = decode_payment_signature_header(payment_header)
            payment = PaymentPayload(**payment_dict)
        except Exception as e:
            logger.warning(f"Invalid payment header: {e}")
            self._raise_402("Invalid payment header format", [requirements], request)

        # Find matching requirements
        selected = find_matching_payment_requirements([requirements], payment)
        if not selected:
            self._raise_402(
                "No matching payment requirements found", [requirements], request
            )

        # Verify payment
        try:
            verify_response = await self.facilitator.verify(payment, selected)
        except Exception as e:
            logger.error(f"Verification failed: {e}")
            self._raise_402(f"Verification failed: {e}", [requirements], request)

        if not verify_response.is_valid:
            error = verify_response.invalid_reason or "Unknown error"
            self._raise_402(f"Invalid payment: {error}", [requirements], request)

        # Create payment details
        payment_details = PaymentDetails(
            requirements=selected,
            verify_response=verify_response,
            protocol_version=version,
        )

        # Store in request state for later use
        request.state.payment_details = payment_details
        request.state.verify_response = verify_response

        # Store payment for potential settlement
        request.state._payment = payment
        request.state._selected_requirements = selected
        request.state._protocol_version = version

        return payment_details

    def _raise_402(
        self,
        error: str,
        requirements: List[PaymentRequirements],
        request: Request,
    ) -> None:
        """Raise a 402 HTTPException.

        Args:
            error: Error message
            requirements: Payment requirements
            request: FastAPI request

        Raises:
            HTTPException: Always raises 402
        """
        dict(request.headers)
        resource_url = str(request.url)

        # Build response content
        if self.protocol_version == T402_VERSION_V2:
            resource_info = ResourceInfo(
                url=resource_url,
                description=self.description,
                mime_type=self.mime_type,
            )

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
            content = payment_required.model_dump(by_alias=True)
            headers = {HEADER_PAYMENT_REQUIRED: header_value}
        else:
            response_data = t402PaymentRequiredResponse(
                t402_version=T402_VERSION_V1,
                accepts=requirements,
                error=error,
            )
            content = response_data.model_dump(by_alias=True)
            headers = {}

        raise HTTPException(
            status_code=402,
            detail=content,
            headers=headers,
        )


async def settle_payment(request: Request) -> Optional[str]:
    """Settle a verified payment.

    This dependency should be called after the route handler completes
    successfully to settle the payment with the facilitator.

    Args:
        request: FastAPI request (must have payment details from PaymentRequired)

    Returns:
        Settlement header value on success, None if no payment to settle

    Example:
        ```python
        @app.get("/data")
        async def get_data(
            payment: PaymentDetails = Depends(premium_payment),
            request: Request,
        ):
            # Do work...
            result = {"data": "..."}

            # Settle payment after successful response
            settlement = await settle_payment(request)

            return result
        ```
    """
    # Get stored payment info
    payment = getattr(request.state, "_payment", None)
    selected = getattr(request.state, "_selected_requirements", None)
    getattr(request.state, "_protocol_version", T402_VERSION_V2)

    if not payment or not selected:
        return None

    # Get facilitator from payment details
    payment_details: Optional[PaymentDetails] = getattr(
        request.state, "payment_details", None
    )
    if not payment_details:
        return None

    # Create facilitator client
    facilitator = FacilitatorClient(None)

    try:
        settle_response = await facilitator.settle(payment, selected)
        if settle_response.success:
            return encode_payment_response_header(settle_response)
        else:
            logger.error(f"Settlement failed: {settle_response.error_reason}")
            return None
    except Exception as e:
        logger.error(f"Settlement error: {e}")
        return None
