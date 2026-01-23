"""Solana SVM Exact Payment Scheme.

This package provides the exact payment scheme implementation for Solana
using SPL Token TransferChecked instructions with a facilitator fee payer.

The exact scheme allows users to sign transactions that transfer SPL tokens
to a recipient. The facilitator pays for gas (transaction fees) and broadcasts
the transaction.
"""

from t402.schemes.svm.exact.client import (
    ExactSvmClientScheme,
    ClientSvmSigner,
    SCHEME_EXACT,
)
from t402.schemes.svm.exact.server import (
    ExactSvmServerScheme,
)
from t402.schemes.svm.exact.facilitator import (
    ExactSvmFacilitatorScheme,
    FacilitatorSvmSigner,
)

__all__ = [
    # Client
    "ExactSvmClientScheme",
    "ClientSvmSigner",
    # Server
    "ExactSvmServerScheme",
    # Facilitator
    "ExactSvmFacilitatorScheme",
    "FacilitatorSvmSigner",
    # Constants
    "SCHEME_EXACT",
]
