"""NEAR Exact-Direct Payment Scheme.

This package provides the exact-direct payment scheme implementation for NEAR.
In this scheme, the client executes the NEP-141 ft_transfer on-chain directly,
and the transaction hash is used as proof of payment.

Components:
    - ExactDirectNearClientScheme: Client-side (executes transfer, returns tx hash)
    - ExactDirectNearServerScheme: Server-side (parses prices, enhances requirements)
    - ExactDirectNearFacilitatorScheme: Facilitator-side (verifies tx, marks settled)
"""

from t402.schemes.near.exact_direct.client import ExactDirectNearClientScheme
from t402.schemes.near.exact_direct.server import ExactDirectNearServerScheme
from t402.schemes.near.exact_direct.facilitator import ExactDirectNearFacilitatorScheme

__all__ = [
    "ExactDirectNearClientScheme",
    "ExactDirectNearServerScheme",
    "ExactDirectNearFacilitatorScheme",
]
