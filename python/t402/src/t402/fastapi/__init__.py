"""FastAPI Integration for T402 Payment Protocol.

This package provides FastAPI middleware and utilities for integrating
T402 payments into FastAPI applications.

Features:
- PaymentMiddleware: Class-based middleware for protecting routes
- require_payment: Functional middleware for fine-grained control
- PaymentRequired: Dependency for per-route payment requirements
- V1 and V2 protocol support
- Automatic settlement on successful responses
- Browser paywall support

Usage:
    ```python
    from fastapi import FastAPI, Depends
    from t402.fastapi import (
        PaymentMiddleware,
        PaymentRequired,
        PaymentDetails,
        require_payment,
    )

    app = FastAPI()

    # Option 1: Middleware class (recommended for multiple routes)
    payment = PaymentMiddleware(app)
    payment.add(
        path="/api/*",
        price="$0.10",
        pay_to_address="0x1234...",
        network="eip155:8453",
    )

    # Option 2: Per-route dependency (recommended for specific routes)
    premium_payment = PaymentRequired(
        price="$0.10",
        pay_to_address="0x1234...",
    )

    @app.get("/premium")
    async def premium_content(payment: PaymentDetails = Depends(premium_payment)):
        return {"data": "premium content"}

    # Option 3: Functional middleware
    @app.middleware("http")
    async def payment_middleware(request, call_next):
        middleware_fn = require_payment(
            price="$0.10",
            pay_to_address="0x1234...",
            path="/api/*",
        )
        return await middleware_fn(request, call_next)
    ```
"""

from t402.fastapi.middleware import (
    PaymentMiddleware,
    PaymentConfig,
    PaymentDetails,
    require_payment,
)
from t402.fastapi.dependencies import (
    PaymentRequired,
    get_payment_details,
    settle_payment,
)

__all__ = [
    # Middleware
    "PaymentMiddleware",
    "PaymentConfig",
    "PaymentDetails",
    "require_payment",
    # Dependencies
    "PaymentRequired",
    "get_payment_details",
    "settle_payment",
]
