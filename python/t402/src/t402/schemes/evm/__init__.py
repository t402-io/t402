"""EVM Blockchain Payment Schemes.

This package provides payment scheme implementations for EVM-compatible
blockchains (Ethereum, Base, Avalanche, etc.).

Supported schemes:
- exact: EIP-3009 TransferWithAuthorization
- upto: EIP-2612 Permit (usage-based billing)
"""

from t402.schemes.evm.exact import (
    ExactEvmClientScheme,
    ExactEvmServerScheme,
    EvmSigner,
    create_nonce,
    SCHEME_EXACT,
)

from t402.schemes.evm.upto import (
    UptoEvmClientScheme,
    create_payment_nonce,
    SCHEME_UPTO,
    PermitSignature,
    PermitAuthorization,
    UptoEIP2612Payload,
    UptoEvmExtra,
    is_eip2612_payload,
)

__all__ = [
    # Exact scheme
    "ExactEvmClientScheme",
    "ExactEvmServerScheme",
    "EvmSigner",
    "create_nonce",
    "SCHEME_EXACT",
    # Upto scheme
    "UptoEvmClientScheme",
    "create_payment_nonce",
    "SCHEME_UPTO",
    "PermitSignature",
    "PermitAuthorization",
    "UptoEIP2612Payload",
    "UptoEvmExtra",
    "is_eip2612_payload",
]
