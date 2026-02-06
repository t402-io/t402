"""TRON Blockchain Payment Schemes.

This package provides payment scheme implementations for TRON blockchain.

Supported schemes:
- exact: TRC-20 token transfers with signed transactions
- upto: TRC-20 approve + transferFrom for authorized maximum-amount payments
"""

from t402.schemes.tron.exact import (
    ExactTronClientScheme,
    ExactTronServerScheme,
    ExactTronFacilitatorScheme,
    ExactTronFacilitatorConfig,
    TronSigner,
    FacilitatorTronSigner,
    SCHEME_EXACT,
)

from t402.schemes.tron.upto import (
    UptoTronAuthorization,
    UptoTronPayload,
    UptoTronExtra,
    is_upto_tron_payload,
    upto_payload_from_dict,
)

__all__ = [
    # Exact - Client
    "ExactTronClientScheme",
    "TronSigner",
    # Exact - Server
    "ExactTronServerScheme",
    # Exact - Facilitator
    "ExactTronFacilitatorScheme",
    "ExactTronFacilitatorConfig",
    "FacilitatorTronSigner",
    # Exact - Constants
    "SCHEME_EXACT",
    # Upto - Types
    "UptoTronAuthorization",
    "UptoTronPayload",
    "UptoTronExtra",
    # Upto - Type guards
    "is_upto_tron_payload",
    # Upto - Helpers
    "upto_payload_from_dict",
]
