"""TON Blockchain Payment Schemes.

This package provides payment scheme implementations for TON blockchain.

Supported schemes:
- exact: Jetton TransferWithAuthorization
- upto: Escrow-based usage billing (maxAmount to facilitator, settle + refund)
"""

from t402.schemes.ton.exact import (
    ExactTonClientScheme,
    ExactTonServerScheme,
    ExactTonFacilitatorScheme,
    TonSigner,
    FacilitatorTonSigner,
    SCHEME_EXACT,
)

from t402.schemes.ton.upto import (
    UptoTonAuthorization,
    UptoTonPayload,
    UptoTonExtra,
    is_upto_ton_payload,
    upto_payload_from_dict,
)

__all__ = [
    # Client
    "ExactTonClientScheme",
    "TonSigner",
    # Server
    "ExactTonServerScheme",
    # Facilitator
    "ExactTonFacilitatorScheme",
    "FacilitatorTonSigner",
    # Constants
    "SCHEME_EXACT",
    # Upto types
    "UptoTonAuthorization",
    "UptoTonPayload",
    "UptoTonExtra",
    "is_upto_ton_payload",
    "upto_payload_from_dict",
]
