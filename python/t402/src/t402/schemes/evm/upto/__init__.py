"""EVM Up-To Payment Scheme.

This package provides the upto payment scheme implementation for EVM networks
using EIP-2612 Permit for gasless token approvals.

The upto scheme allows clients to authorize a maximum amount that can be
settled later based on actual usage.
"""

from t402.schemes.evm.upto.types import (
    # Type definitions
    PERMIT_TYPES,
    PERMIT_DOMAIN_TYPES,
    # Models
    PermitSignature,
    PermitAuthorization,
    UptoEIP2612Payload,
    UptoCompactPayload,
    UptoEvmExtra,
    UptoEvmSettlement,
    UptoEvmUsageDetails,
    # Type guards
    is_eip2612_payload,
    # Helper functions
    create_permit_domain,
    create_permit_message,
    payload_from_dict,
)

from t402.schemes.evm.upto.client import (
    UptoEvmClientScheme,
    create_payment_nonce,
    SCHEME_UPTO,
)

__all__ = [
    # Constants
    "SCHEME_UPTO",
    "PERMIT_TYPES",
    "PERMIT_DOMAIN_TYPES",
    # Client
    "UptoEvmClientScheme",
    "create_payment_nonce",
    # Types
    "PermitSignature",
    "PermitAuthorization",
    "UptoEIP2612Payload",
    "UptoCompactPayload",
    "UptoEvmExtra",
    "UptoEvmSettlement",
    "UptoEvmUsageDetails",
    # Type guards
    "is_eip2612_payload",
    # Helper functions
    "create_permit_domain",
    "create_permit_message",
    "payload_from_dict",
]
