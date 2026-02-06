"""NEAR Up-To Payment Scheme Types.

This package provides the upto payment scheme types for NEAR networks
using an escrow pattern with NEP-141 ft_transfer.

The upto scheme allows clients to authorize a maximum amount that can be
settled later based on actual usage. Since NEAR NEP-141 tokens don't support
native approve/transferFrom, this uses an escrow pattern:

1. Client ft_transfers maxAmount to the facilitator
2. Facilitator verifies the transfer
3. Facilitator forwards settleAmount to payTo and refunds the rest

Usage:
    ```python
    from t402.schemes.near.upto import (
        UptoNearAuthorization,
        UptoNearPayload,
        UptoNearExtra,
        UptoNearSettlement,
        is_upto_near_payload,
        upto_payload_from_dict,
    )

    # Check if data is an upto NEAR payload
    if is_upto_near_payload(data):
        payload = upto_payload_from_dict(data)
        print(payload.tx_hash)
        print(payload.authorization.max_amount)
    ```
"""

from t402.schemes.near.upto.types import (
    UptoNearAuthorization,
    UptoNearPayload,
    UptoNearExtra,
    UptoNearSettlement,
    UptoNearUsageDetails,
    is_upto_near_payload,
    upto_payload_from_dict,
)

__all__ = [
    # Models
    "UptoNearAuthorization",
    "UptoNearPayload",
    "UptoNearExtra",
    "UptoNearSettlement",
    "UptoNearUsageDetails",
    # Type guards
    "is_upto_near_payload",
    # Factory functions
    "upto_payload_from_dict",
]
