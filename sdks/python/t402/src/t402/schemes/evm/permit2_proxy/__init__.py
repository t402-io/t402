"""EVM Permit2 Proxy Payment Scheme.

This package provides the Permit2 Proxy payment scheme implementation for EVM
networks using Uniswap's Permit2 contract with a witness (PermitWitnessTransferFrom).

The Permit2 Proxy scheme adds a witness struct binding the payment destination
and facilitator into the payer's EIP-712 signature, enabling trustless settlement
via proxy contracts.
"""

from t402.schemes.evm.permit2_proxy.client import (
    Permit2ProxyEvmClientScheme,
    SCHEME_PERMIT2_PROXY,
    EXACT_PROXY_ADDRESS,
    UPTO_PROXY_ADDRESS,
    WITNESS_TYPE_HASH,
)
from t402.schemes.evm.permit2_proxy.server import (
    Permit2ProxyEvmServerScheme,
)
from t402.schemes.evm.permit2_proxy.facilitator import (
    Permit2ProxyEvmFacilitatorScheme,
    FacilitatorPermit2ProxySigner,
    Permit2ProxyTransactionConfirmation,
)

__all__ = [
    # Client
    "Permit2ProxyEvmClientScheme",
    # Server
    "Permit2ProxyEvmServerScheme",
    # Facilitator
    "Permit2ProxyEvmFacilitatorScheme",
    "FacilitatorPermit2ProxySigner",
    "Permit2ProxyTransactionConfirmation",
    # Constants
    "SCHEME_PERMIT2_PROXY",
    "EXACT_PROXY_ADDRESS",
    "UPTO_PROXY_ADDRESS",
    "WITNESS_TYPE_HASH",
]
