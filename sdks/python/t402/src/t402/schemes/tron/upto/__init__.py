"""TRON Up-To Payment Scheme.

This package provides the upto payment scheme types for TRON networks
using TRC-20 approve + transferFrom for authorized maximum-amount payments.

The upto scheme allows clients to authorize a maximum amount that can be
settled later based on actual usage.
"""

from t402.schemes.tron.upto.types import (
    # Models
    UptoTronAuthorization,
    UptoTronPayload,
    UptoTronExtra,
    # Type guards
    is_upto_tron_payload,
    # Helper functions
    upto_payload_from_dict,
)

__all__ = [
    # Types
    "UptoTronAuthorization",
    "UptoTronPayload",
    "UptoTronExtra",
    # Type guards
    "is_upto_tron_payload",
    # Helper functions
    "upto_payload_from_dict",
]
