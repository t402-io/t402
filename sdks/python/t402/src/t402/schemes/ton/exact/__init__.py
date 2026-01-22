"""TON Exact Payment Scheme.

This package provides the exact payment scheme implementation for TON
using Jetton TransferWithAuthorization.

The exact scheme allows users to authorize Jetton transfers that can be
executed by a facilitator, enabling gasless payments on TON.
"""

from t402.schemes.ton.exact.client import (
    ExactTonClientScheme,
    TonSigner,
    SCHEME_EXACT,
)
from t402.schemes.ton.exact.server import (
    ExactTonServerScheme,
)

__all__ = [
    # Client
    "ExactTonClientScheme",
    "TonSigner",
    # Server
    "ExactTonServerScheme",
    # Constants
    "SCHEME_EXACT",
]
