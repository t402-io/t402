"""Solana SVM Exact Scheme - Client Implementation.

This module provides the client-side implementation of the exact payment scheme
for Solana network using SPL Token TransferChecked instructions.

The client creates and signs a Solana transaction containing a TransferChecked
instruction, which the facilitator then co-signs (as fee payer) and broadcasts.

This module re-exports the client implementation from the monolithic svm module,
providing the standard scheme package structure.
"""

from t402.svm import (
    SCHEME_EXACT,
    ExactSvmClientScheme,
    ClientSvmSigner,
)

__all__ = [
    "SCHEME_EXACT",
    "ExactSvmClientScheme",
    "ClientSvmSigner",
]
