"""T402 Payment Scheme Architecture.

This package provides the interfaces and registry for managing payment schemes
in the T402 protocol.

Modules:
    interfaces: Abstract interfaces for scheme implementations
    registry: Scheme registration and lookup functionality

Usage:
    ```python
    from t402.schemes import (
        # Interfaces (for implementing new schemes)
        SchemeNetworkClient,
        SchemeNetworkServer,
        SchemeNetworkFacilitator,

        # Registry classes
        SchemeRegistry,
        ClientSchemeRegistry,
        ServerSchemeRegistry,
        FacilitatorSchemeRegistry,

        # Global registry access
        get_client_registry,
        get_server_registry,
        get_facilitator_registry,
    )

    # Register a scheme
    registry = get_client_registry()
    registry.register("eip155:8453", my_evm_client)

    # Or create your own registry
    my_registry = ClientSchemeRegistry()
    my_registry.register("eip155:*", my_evm_client)  # Wildcard for all EVM
    ```
"""

from t402.schemes.interfaces import (
    # Type aliases
    Price,
    AssetAmount,
    SupportedKindDict,
    # Protocols (duck typing)
    SchemeNetworkClient,
    SchemeNetworkServer,
    SchemeNetworkFacilitator,
    # Abstract Base Classes (inheritance)
    BaseSchemeNetworkClient,
    BaseSchemeNetworkServer,
    BaseSchemeNetworkFacilitator,
)

from t402.schemes.registry import (
    # Core registry
    SchemeRegistry,
    # Typed registries
    ClientSchemeRegistry,
    ServerSchemeRegistry,
    FacilitatorSchemeRegistry,
    # Global registry accessors
    get_client_registry,
    get_server_registry,
    get_facilitator_registry,
    reset_global_registries,
)

# EVM Schemes
from t402.schemes.evm import (
    ExactEvmClientScheme,
    ExactEvmServerScheme,
    EvmSigner,
    # Upto EVM
    UptoEvmClientScheme,
    PermitSignature,
    PermitAuthorization,
    UptoEIP2612Payload,
    UptoEvmExtra,
)

# Upto Core Types
from t402.schemes.upto import (
    SCHEME_UPTO,
    UptoPaymentRequirements,
    UptoExtra,
    UptoSettlement,
    UptoUsageDetails,
    UptoSettlementResponse,
    UptoValidationResult,
    is_upto_payment_requirements,
    is_valid_unit,
    create_payment_requirements as create_upto_requirements,
    create_settlement as create_upto_settlement,
)

# TON Schemes
from t402.schemes.ton import (
    ExactTonClientScheme,
    ExactTonServerScheme,
    TonSigner,
)

# TRON Schemes
from t402.schemes.tron import (
    ExactTronClientScheme,
    ExactTronServerScheme,
    TronSigner,
)

__all__ = [
    # Type aliases
    "Price",
    "AssetAmount",
    "SupportedKindDict",
    # Protocols
    "SchemeNetworkClient",
    "SchemeNetworkServer",
    "SchemeNetworkFacilitator",
    # ABCs
    "BaseSchemeNetworkClient",
    "BaseSchemeNetworkServer",
    "BaseSchemeNetworkFacilitator",
    # Registry classes
    "SchemeRegistry",
    "ClientSchemeRegistry",
    "ServerSchemeRegistry",
    "FacilitatorSchemeRegistry",
    # Global registry functions
    "get_client_registry",
    "get_server_registry",
    "get_facilitator_registry",
    "reset_global_registries",
    # EVM Exact Schemes
    "ExactEvmClientScheme",
    "ExactEvmServerScheme",
    "EvmSigner",
    # EVM Upto Schemes
    "UptoEvmClientScheme",
    "PermitSignature",
    "PermitAuthorization",
    "UptoEIP2612Payload",
    "UptoEvmExtra",
    # Upto Core Types
    "SCHEME_UPTO",
    "UptoPaymentRequirements",
    "UptoExtra",
    "UptoSettlement",
    "UptoUsageDetails",
    "UptoSettlementResponse",
    "UptoValidationResult",
    "is_upto_payment_requirements",
    "is_valid_unit",
    "create_upto_requirements",
    "create_upto_settlement",
    # TON Schemes
    "ExactTonClientScheme",
    "ExactTonServerScheme",
    "TonSigner",
    # TRON Schemes
    "ExactTronClientScheme",
    "ExactTronServerScheme",
    "TronSigner",
]
