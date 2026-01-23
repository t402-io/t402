"""Aptos Exact-Direct Payment Scheme.

This package provides the exact-direct payment scheme implementation for Aptos
using Fungible Asset (FA) transfers via ``0x1::primary_fungible_store::transfer``.

The exact-direct scheme works as follows:
1. Client executes the FA transfer on-chain directly.
2. Client returns the transaction hash as proof of payment.
3. Facilitator queries the Aptos REST API to verify the transaction details.

This is a "push" payment model where the client performs the transfer first,
unlike permit-based models where the facilitator executes settlement.
"""

from t402.schemes.aptos.exact_direct.client import (
    ExactDirectAptosClientScheme,
)
from t402.schemes.aptos.exact_direct.server import (
    ExactDirectAptosServerScheme,
)
from t402.schemes.aptos.exact_direct.facilitator import (
    ExactDirectAptosFacilitatorScheme,
)
from t402.schemes.aptos.constants import SCHEME_EXACT_DIRECT
from t402.schemes.aptos.types import (
    ClientAptosSigner,
    FacilitatorAptosSigner,
    ExactDirectPayload,
)

__all__ = [
    # Client
    "ExactDirectAptosClientScheme",
    "ClientAptosSigner",
    # Server
    "ExactDirectAptosServerScheme",
    # Facilitator
    "ExactDirectAptosFacilitatorScheme",
    "FacilitatorAptosSigner",
    # Types
    "ExactDirectPayload",
    # Constants
    "SCHEME_EXACT_DIRECT",
]
