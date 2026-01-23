"""EVM Exact Payment Scheme.

This package provides the exact payment scheme implementation for EVM networks
using EIP-3009 TransferWithAuthorization.

The exact scheme allows users to authorize token transfers that can be executed
by a facilitator, enabling gasless payments.
"""

from t402.schemes.evm.exact.client import (
    ExactEvmClientScheme,
    EvmSigner,
    create_nonce,
    SCHEME_EXACT,
)
from t402.schemes.evm.exact.server import (
    ExactEvmServerScheme,
)
from t402.schemes.evm.exact.facilitator import (
    ExactEvmFacilitatorScheme,
    FacilitatorEvmSigner,
    EvmVerifyResult,
    EvmTransactionConfirmation,
)

__all__ = [
    # Client
    "ExactEvmClientScheme",
    "EvmSigner",
    "create_nonce",
    # Server
    "ExactEvmServerScheme",
    # Facilitator
    "ExactEvmFacilitatorScheme",
    "FacilitatorEvmSigner",
    "EvmVerifyResult",
    "EvmTransactionConfirmation",
    # Constants
    "SCHEME_EXACT",
]
