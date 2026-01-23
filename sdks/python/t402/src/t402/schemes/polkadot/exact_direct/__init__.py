"""Polkadot Exact-Direct Payment Scheme.

This package provides the exact-direct payment scheme implementation for
Polkadot Asset Hub networks using on-chain asset transfers.

The exact-direct scheme works by:
1. Client executes assets.transfer_keep_alive on-chain
2. Client returns the extrinsic hash, block hash, and index as proof
3. Facilitator verifies the transfer on-chain via indexer/RPC

This is a "direct" scheme because the client pays on-chain before
submitting the payment proof, rather than providing an off-chain signature
for later settlement.
"""

from t402.schemes.polkadot.exact_direct.client import (
    ExactDirectPolkadotClientScheme,
)
from t402.schemes.polkadot.exact_direct.server import (
    ExactDirectPolkadotServerScheme,
)
from t402.schemes.polkadot.exact_direct.facilitator import (
    ExactDirectPolkadotFacilitatorScheme,
)
from t402.schemes.polkadot.constants import SCHEME_EXACT_DIRECT
from t402.schemes.polkadot.types import (
    ClientPolkadotSigner,
    FacilitatorPolkadotSigner,
)

__all__ = [
    # Client
    "ExactDirectPolkadotClientScheme",
    # Server
    "ExactDirectPolkadotServerScheme",
    # Facilitator
    "ExactDirectPolkadotFacilitatorScheme",
    # Signer protocols
    "ClientPolkadotSigner",
    "FacilitatorPolkadotSigner",
    # Constants
    "SCHEME_EXACT_DIRECT",
]
