"""EVM Permit2 Payment Scheme.

This package provides the Permit2 payment scheme implementation for EVM networks
using Uniswap's Permit2 contract (PermitTransferFrom with EIP-712 signatures).

The Permit2 scheme allows gasless token transfers where:
- The token holder signs an off-chain PermitTransferFrom (EIP-712 typed data)
- A facilitator calls permitTransferFrom on the Permit2 contract
- The Permit2 contract verifies the signature and executes the transfer
"""

from t402.schemes.evm.permit2.client import (
    Permit2EvmClientScheme,
    SCHEME_PERMIT2,
    PERMIT2_ADDRESS,
)
from t402.schemes.evm.permit2.server import (
    Permit2EvmServerScheme,
)
from t402.schemes.evm.permit2.facilitator import (
    Permit2EvmFacilitatorScheme,
    FacilitatorPermit2Signer,
)

__all__ = [
    # Client
    "Permit2EvmClientScheme",
    # Server
    "Permit2EvmServerScheme",
    # Facilitator
    "Permit2EvmFacilitatorScheme",
    "FacilitatorPermit2Signer",
    # Constants
    "SCHEME_PERMIT2",
    "PERMIT2_ADDRESS",
]
