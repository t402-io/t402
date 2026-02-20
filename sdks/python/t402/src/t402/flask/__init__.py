"""Flask Integration for T402 Payment Protocol.

This package provides Flask middleware for integrating T402 payments
into Flask applications.

Features:
- PaymentMiddleware: Class-based middleware for protecting routes
- V1 and V2 protocol support
- Automatic settlement on successful responses
- Browser paywall support

Usage:
    ```python
    from flask import Flask
    from t402.flask import PaymentMiddleware

    app = Flask(__name__)
    payment = PaymentMiddleware(app)
    payment.add(
        path="/api/*",
        price="$0.10",
        pay_to_address="0x1234...",
        network="eip155:8453",
    )
    ```
"""

from t402.flask.middleware import PaymentMiddleware

__all__ = [
    "PaymentMiddleware",
]