"""TRON Exact Payment Scheme.

This package provides the exact payment scheme implementation for TRON
using TRC-20 token transfers.

The exact scheme allows users to sign TRC-20 transfer transactions that
can be verified and broadcast by a facilitator, enabling gasless payments.
"""

from t402.schemes.tron.exact.client import (
    ExactTronClientScheme,
    TronSigner,
    SCHEME_EXACT,
)
from t402.schemes.tron.exact.server import (
    ExactTronServerScheme,
)

__all__ = [
    # Client
    "ExactTronClientScheme",
    "TronSigner",
    # Server
    "ExactTronServerScheme",
    # Constants
    "SCHEME_EXACT",
]
