"""EVM Exact-Legacy Payment Scheme.

This package provides the exact-legacy payment scheme implementation for EVM networks
using the approve + transferFrom pattern for legacy tokens without EIP-3009 support.

The exact-legacy scheme requires users to approve a facilitator address to spend
their tokens, then sign an authorization that includes timing constraints.
"""

from t402.schemes.evm.exact_legacy.client import (
    ExactLegacyEvmClientScheme,
    create_nonce,
    SCHEME_EXACT_LEGACY,
)
from t402.schemes.evm.exact_legacy.server import (
    ExactLegacyEvmServerScheme,
)
from t402.schemes.evm.exact_legacy.facilitator import (
    ExactLegacyEvmFacilitatorScheme,
    FacilitatorLegacyEvmSigner,
    LegacyVerifyResult,
    LegacyTransactionConfirmation,
)

__all__ = [
    # Client
    "ExactLegacyEvmClientScheme",
    "create_nonce",
    # Server
    "ExactLegacyEvmServerScheme",
    # Facilitator
    "ExactLegacyEvmFacilitatorScheme",
    "FacilitatorLegacyEvmSigner",
    "LegacyVerifyResult",
    "LegacyTransactionConfirmation",
    # Constants
    "SCHEME_EXACT_LEGACY",
]
