"""Lightning Network Exact Payment Scheme.

This package provides the exact payment scheme implementation for Lightning Network.
Uses BOLT11 invoices for payment and preimage as proof of payment.

Components:
    - LightningClientScheme: Client-side (pays BOLT11 invoices)
    - LightningServerScheme: Server-side (generates invoices, enhances requirements)
    - LightningFacilitatorScheme: Facilitator-side (verifies preimage, confirms payment)
"""

from t402.schemes.btc.lightning.client import LightningClientScheme
from t402.schemes.btc.lightning.server import LightningServerScheme
from t402.schemes.btc.lightning.facilitator import LightningFacilitatorScheme

__all__ = [
    "LightningClientScheme",
    "LightningServerScheme",
    "LightningFacilitatorScheme",
]
