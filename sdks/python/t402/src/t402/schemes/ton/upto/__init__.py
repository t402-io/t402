"""TON Up-To Payment Scheme.

This package provides types for the upto payment scheme on TON blockchain.

The upto scheme uses an escrow pattern:
1. Client signs a transfer of maxAmount to the facilitator's holding address
2. Facilitator broadcasts the transfer, then sends settleAmount to payTo
   and refunds (maxAmount - settleAmount) back to the client.
"""

from t402.schemes.ton.upto.types import (
    # Models
    UptoTonAuthorization,
    UptoTonPayload,
    UptoTonExtra,
    # Type guards
    is_upto_ton_payload,
    # Helper functions
    upto_payload_from_dict,
)

__all__ = [
    # Types
    "UptoTonAuthorization",
    "UptoTonPayload",
    "UptoTonExtra",
    # Type guards
    "is_upto_ton_payload",
    # Helper functions
    "upto_payload_from_dict",
]
