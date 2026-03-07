"""Stellar Exact Payment Scheme.

This package provides the exact payment scheme implementation for Stellar
using Soroban smart contract token transfers (SEP-41).

The exact scheme allows users to sign Soroban token transfer transactions
that can be submitted by a facilitator.
"""

from t402.schemes.stellar.exact.client import (
    ExactStellarClientScheme,
    StellarSigner,
    SCHEME_EXACT,
)
from t402.schemes.stellar.exact.server import (
    ExactStellarServerScheme,
)
from t402.schemes.stellar.exact.facilitator import (
    ExactStellarFacilitatorScheme,
    FacilitatorStellarSigner,
)

__all__ = [
    # Client
    "ExactStellarClientScheme",
    "StellarSigner",
    # Server
    "ExactStellarServerScheme",
    # Facilitator
    "ExactStellarFacilitatorScheme",
    "FacilitatorStellarSigner",
    # Constants
    "SCHEME_EXACT",
]
