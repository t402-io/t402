"""EVM Blockchain Payment Schemes.

This package provides payment scheme implementations for EVM-compatible
blockchains (Ethereum, Base, Avalanche, etc.).

Supported schemes:
- exact: EIP-3009 TransferWithAuthorization (recommended)
- exact-legacy: approve + transferFrom (DEPRECATED - see deprecation notice below)
- upto: EIP-2612 Permit (usage-based billing)
- permit2: Uniswap Permit2 PermitTransferFrom
- permit2-proxy: Permit2 with witness via proxy contracts
- erc7710: ERC-7710 delegation via smart account (ERC-4337/ERC-7579)

.. deprecated:: 2.3.0
    The **exact-legacy** scheme is deprecated and will be removed in v3.0.0.

    The exact-legacy scheme uses the traditional approve + transferFrom pattern,
    which has several drawbacks compared to the "exact" scheme with USDT0:

    1. **Two transactions required**: Users must approve then transfer
    2. **Gas costs**: Users pay gas for both transactions
    3. **Limited availability**: Legacy USDT only on specific chains

    **Migration Guide:**
    1. Replace `ExactLegacyEvmClientScheme` with `ExactEvmClientScheme`
    2. Replace `ExactLegacyEvmServerScheme` with `ExactEvmServerScheme`
    3. Use USDT0 token addresses instead of legacy USDT
    4. See https://docs.t402.io/advanced/migration-v1-to-v2 for details

    **USDT0 Advantages:**
    - Single signature (no approve transaction)
    - Gasless via EIP-3009
    - Available on 19+ chains via LayerZero
    - Cross-chain bridging support
"""

from t402.schemes.evm.exact import (
    ExactEvmClientScheme,
    ExactEvmServerScheme,
    ExactEvmFacilitatorScheme,
    FacilitatorEvmSigner,
    EvmVerifyResult,
    EvmTransactionConfirmation,
    EvmSigner,
    create_nonce,
    SCHEME_EXACT,
)

from t402.schemes.evm.exact_legacy import (
    ExactLegacyEvmClientScheme,
    ExactLegacyEvmServerScheme,
    SCHEME_EXACT_LEGACY,
)

from t402.schemes.evm.upto import (
    UptoEvmClientScheme,
    UptoEvmServerScheme,
    UptoEvmFacilitatorScheme,
    create_payment_nonce,
    SCHEME_UPTO,
    PermitSignature,
    PermitAuthorization,
    UptoEIP2612Payload,
    UptoEvmExtra,
    is_eip2612_payload,
)

from t402.schemes.evm.permit2 import (
    Permit2EvmClientScheme,
    Permit2EvmServerScheme,
    Permit2EvmFacilitatorScheme,
    FacilitatorPermit2Signer,
    SCHEME_PERMIT2,
    PERMIT2_ADDRESS,
)

from t402.schemes.evm.erc7710 import (
    ERC7710EvmFacilitatorScheme,
    ERC7710EvmFacilitatorSigner,
    ERC7710TransactionConfirmation,
    encode_erc7579_execution,
    parse_erc7710_payload,
)

from t402.schemes.evm.permit2_proxy import (
    Permit2ProxyEvmClientScheme,
    Permit2ProxyEvmServerScheme,
    Permit2ProxyEvmFacilitatorScheme,
    FacilitatorPermit2ProxySigner,
    Permit2ProxyTransactionConfirmation,
    SCHEME_PERMIT2_PROXY,
    EXACT_PROXY_ADDRESS,
    UPTO_PROXY_ADDRESS,
    WITNESS_TYPE_HASH,
)

__all__ = [
    # Exact scheme
    "ExactEvmClientScheme",
    "ExactEvmServerScheme",
    "ExactEvmFacilitatorScheme",
    "FacilitatorEvmSigner",
    "EvmVerifyResult",
    "EvmTransactionConfirmation",
    "EvmSigner",
    "create_nonce",
    "SCHEME_EXACT",
    # Exact-Legacy scheme
    "ExactLegacyEvmClientScheme",
    "ExactLegacyEvmServerScheme",
    "SCHEME_EXACT_LEGACY",
    # Upto scheme
    "UptoEvmClientScheme",
    "UptoEvmServerScheme",
    "UptoEvmFacilitatorScheme",
    "create_payment_nonce",
    "SCHEME_UPTO",
    "PermitSignature",
    "PermitAuthorization",
    "UptoEIP2612Payload",
    "UptoEvmExtra",
    "is_eip2612_payload",
    # Permit2 scheme
    "Permit2EvmClientScheme",
    "Permit2EvmServerScheme",
    "Permit2EvmFacilitatorScheme",
    "FacilitatorPermit2Signer",
    "SCHEME_PERMIT2",
    "PERMIT2_ADDRESS",
    # ERC-7710 scheme
    "ERC7710EvmFacilitatorScheme",
    "ERC7710EvmFacilitatorSigner",
    "ERC7710TransactionConfirmation",
    "encode_erc7579_execution",
    "parse_erc7710_payload",
    # Permit2-Proxy scheme
    "Permit2ProxyEvmClientScheme",
    "Permit2ProxyEvmServerScheme",
    "Permit2ProxyEvmFacilitatorScheme",
    "FacilitatorPermit2ProxySigner",
    "Permit2ProxyTransactionConfirmation",
    "SCHEME_PERMIT2_PROXY",
    "EXACT_PROXY_ADDRESS",
    "UPTO_PROXY_ADDRESS",
    "WITNESS_TYPE_HASH",
]
