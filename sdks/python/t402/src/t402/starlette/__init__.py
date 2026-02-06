"""Starlette Integration for T402 Payment Protocol.

This package provides Starlette ASGI middleware for integrating T402 payments
into Starlette applications.

Features:
- PaymentMiddleware: Class-based middleware for protecting routes
- V1 and V2 protocol support
- Automatic settlement on successful responses
- Browser paywall support

Usage:
    ```python
    from starlette.applications import Starlette
    from t402.starlette import PaymentMiddleware

    app = Starlette()
    payment = PaymentMiddleware(app)
    payment.add(
        path="/api/*",
        price="$0.10",
        pay_to_address="0x1234...",
        network="eip155:8453",
    )
    ```
"""

from t402.starlette.middleware import (
    PaymentMiddleware,
    PaymentConfig,
    PaymentDetails,
)

__all__ = [
    "PaymentMiddleware",
    "PaymentConfig",
    "PaymentDetails",
]
