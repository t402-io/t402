"""Django Integration for T402 Payment Protocol.

This package provides Django middleware for integrating T402 payments
into Django applications.

Features:
- PaymentMiddleware: Standard Django middleware for protecting routes
- V1 and V2 protocol support
- Automatic settlement on successful responses
- Browser paywall support

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
    ```
"""

from t402.django.middleware import (
    PaymentMiddleware,
    PaymentConfig,
    PaymentDetails,
)

__all__ = [
    "PaymentMiddleware",
    "PaymentConfig",
    "PaymentDetails",
]
