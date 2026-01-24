"""Stacks Exact-Direct Payment Scheme.

This package provides the exact-direct payment scheme implementation for
Stacks (Bitcoin L2) networks using SIP-010 token transfers.

The exact-direct scheme works by:
1. Client executes a SIP-010 token transfer on-chain
2. Client returns the transaction ID as proof
3. Facilitator verifies the transfer on-chain via Hiro API

This is a "direct" scheme because the client pays on-chain before
submitting the payment proof, rather than providing an off-chain signature
for later settlement.
"""

from t402.schemes.stacks.exact_direct.client import (
    ExactDirectStacksClientScheme,
)
from t402.schemes.stacks.exact_direct.server import (
    ExactDirectStacksServerScheme,
)
from t402.schemes.stacks.exact_direct.facilitator import (
    ExactDirectStacksFacilitatorScheme,
)
from t402.schemes.stacks.constants import SCHEME_EXACT_DIRECT
from t402.schemes.stacks.types import (
    ClientStacksSigner,
    FacilitatorStacksSigner,
)

__all__ = [
    # Client
    "ExactDirectStacksClientScheme",
    # Server
    "ExactDirectStacksServerScheme",
    # Facilitator
    "ExactDirectStacksFacilitatorScheme",
    # Signer protocols
    "ClientStacksSigner",
    "FacilitatorStacksSigner",
    # Constants
    "SCHEME_EXACT_DIRECT",
]
