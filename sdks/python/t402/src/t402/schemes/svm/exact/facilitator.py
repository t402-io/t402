"""Solana SVM Exact Scheme - Facilitator Implementation.

This module provides the facilitator-side implementation of the exact payment
scheme for Solana network using SPL Token TransferChecked instructions.

The facilitator:
1. Verifies signed transactions by checking transfer instruction parameters,
   ensuring the facilitator's funds are not being stolen, and simulating
2. Settles payments by co-signing (as fee payer) and broadcasting the transaction
3. Waits for transaction confirmation

This module re-exports the facilitator implementation from the monolithic svm module,
providing the standard scheme package structure.
"""

from t402.svm import (
    ExactSvmFacilitatorScheme,
    FacilitatorSvmSigner,
)

__all__ = [
    "ExactSvmFacilitatorScheme",
    "FacilitatorSvmSigner",
]
