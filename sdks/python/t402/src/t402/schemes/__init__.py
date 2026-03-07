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
    ExactEvmFacilitatorScheme,
    FacilitatorEvmSigner,
    EvmVerifyResult,
    EvmTransactionConfirmation,
    EvmSigner,
    # Upto EVM
    UptoEvmClientScheme,
    UptoEvmServerScheme,
    UptoEvmFacilitatorScheme,
    PermitSignature,
    PermitAuthorization,
    UptoEIP2612Payload,
    UptoEvmExtra,
    # Permit2 EVM
    Permit2EvmClientScheme,
    Permit2EvmServerScheme,
    Permit2EvmFacilitatorScheme,
    FacilitatorPermit2Signer,
    SCHEME_PERMIT2,
    PERMIT2_ADDRESS,
    # Permit2-Proxy EVM
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
    ExactTonFacilitatorScheme,
    TonSigner,
    FacilitatorTonSigner,
)

# TRON Schemes
from t402.schemes.tron import (
    ExactTronClientScheme,
    ExactTronServerScheme,
    ExactTronFacilitatorScheme,
    ExactTronFacilitatorConfig,
    TronSigner,
    FacilitatorTronSigner,
)

# SVM Schemes
from t402.schemes.svm import (
    ExactSvmClientScheme,
    ExactSvmServerScheme,
    ExactSvmFacilitatorScheme,
    ClientSvmSigner as SvmClientSigner,
    FacilitatorSvmSigner as SvmFacilitatorSigner,
    SCHEME_EXACT as SVM_SCHEME_EXACT,
)

# NEAR Schemes
from t402.schemes.near import (
    ExactDirectNearClientScheme,
    ExactDirectNearServerScheme,
    ExactDirectNearFacilitatorScheme,
    ClientNearSigner,
    FacilitatorNearSigner,
    SCHEME_EXACT_DIRECT as NEAR_SCHEME_EXACT_DIRECT,
)

# Aptos Schemes
from t402.schemes.aptos import (
    ExactDirectAptosClientScheme,
    ExactDirectAptosServerScheme,
    ExactDirectAptosFacilitatorScheme,
    ClientAptosSigner,
    FacilitatorAptosSigner,
    SCHEME_EXACT_DIRECT,
)

# Polkadot Schemes
from t402.schemes.polkadot import (
    ExactDirectPolkadotClientScheme,
    ExactDirectPolkadotServerScheme,
    ExactDirectPolkadotFacilitatorScheme,
    ClientPolkadotSigner,
    FacilitatorPolkadotSigner,
    SCHEME_EXACT_DIRECT as POLKADOT_SCHEME_EXACT_DIRECT,
)

# Tezos Schemes
from t402.schemes.tezos import (
    ExactDirectTezosClient,
    ExactDirectTezosServer,
    ExactDirectTezosFacilitator,
    ClientTezosSigner,
    FacilitatorTezosSigner,
    SCHEME_EXACT_DIRECT as TEZOS_SCHEME_EXACT_DIRECT,
)

# Stacks Schemes
from t402.schemes.stacks import (
    ExactDirectStacksClientScheme,
    ExactDirectStacksServerScheme,
    ExactDirectStacksFacilitatorScheme,
    ClientStacksSigner,
    FacilitatorStacksSigner,
    SCHEME_EXACT_DIRECT as STACKS_SCHEME_EXACT_DIRECT,
)

# Cosmos Schemes
from t402.schemes.cosmos import (
    ExactDirectCosmosClientScheme,
    ExactDirectCosmosServerScheme,
    ExactDirectCosmosFacilitatorScheme,
    ExactDirectCosmosFacilitatorConfig,
    ClientCosmosSigner,
    FacilitatorCosmosSigner,
    SCHEME_EXACT_DIRECT as COSMOS_SCHEME_EXACT_DIRECT,
)

# Stellar Schemes
from t402.schemes.stellar import (
    ExactStellarClientScheme,
    ExactStellarServerScheme,
    ExactStellarFacilitatorScheme,
    StellarSigner,
    FacilitatorStellarSigner,
    SCHEME_EXACT as STELLAR_SCHEME_EXACT,
)

# BTC / Lightning Schemes
from t402.schemes.btc import (
    # On-chain
    ExactBtcClientScheme,
    ExactBtcServerScheme,
    ExactBtcFacilitatorScheme,
    ExactBtcClientConfig,
    ExactBtcServerConfig,
    ExactBtcFacilitatorConfig,
    # Lightning
    LightningClientScheme,
    LightningServerScheme,
    LightningFacilitatorScheme,
    LightningServerConfig,
    # Signer protocols
    ClientBtcSigner,
    ClientLightningSigner,
    FacilitatorBtcSigner,
    FacilitatorLightningSigner,
    # Payload types
    BtcOnchainPayload,
    LightningPayload,
    # Constants
    SCHEME_EXACT as BTC_SCHEME_EXACT,
    BTC_MAINNET,
    BTC_TESTNET,
    BTC_SIGNET,
    LIGHTNING_MAINNET,
    LIGHTNING_TESTNET,
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
    "ExactEvmFacilitatorScheme",
    "FacilitatorEvmSigner",
    "EvmVerifyResult",
    "EvmTransactionConfirmation",
    "EvmSigner",
    # EVM Upto Schemes
    "UptoEvmClientScheme",
    "UptoEvmServerScheme",
    "UptoEvmFacilitatorScheme",
    "PermitSignature",
    "PermitAuthorization",
    "UptoEIP2612Payload",
    "UptoEvmExtra",
    # EVM Permit2 Schemes
    "Permit2EvmClientScheme",
    "Permit2EvmServerScheme",
    "Permit2EvmFacilitatorScheme",
    "FacilitatorPermit2Signer",
    "SCHEME_PERMIT2",
    "PERMIT2_ADDRESS",
    # EVM Permit2-Proxy Schemes
    "Permit2ProxyEvmClientScheme",
    "Permit2ProxyEvmServerScheme",
    "Permit2ProxyEvmFacilitatorScheme",
    "FacilitatorPermit2ProxySigner",
    "Permit2ProxyTransactionConfirmation",
    "SCHEME_PERMIT2_PROXY",
    "EXACT_PROXY_ADDRESS",
    "UPTO_PROXY_ADDRESS",
    "WITNESS_TYPE_HASH",
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
    "ExactTonFacilitatorScheme",
    "TonSigner",
    "FacilitatorTonSigner",
    # TRON Schemes
    "ExactTronClientScheme",
    "ExactTronServerScheme",
    "ExactTronFacilitatorScheme",
    "ExactTronFacilitatorConfig",
    "TronSigner",
    "FacilitatorTronSigner",
    # SVM Schemes
    "ExactSvmClientScheme",
    "ExactSvmServerScheme",
    "ExactSvmFacilitatorScheme",
    "SvmClientSigner",
    "SvmFacilitatorSigner",
    "SVM_SCHEME_EXACT",
    # NEAR Schemes
    "ExactDirectNearClientScheme",
    "ExactDirectNearServerScheme",
    "ExactDirectNearFacilitatorScheme",
    "ClientNearSigner",
    "FacilitatorNearSigner",
    "NEAR_SCHEME_EXACT_DIRECT",
    # Aptos Schemes
    "ExactDirectAptosClientScheme",
    "ExactDirectAptosServerScheme",
    "ExactDirectAptosFacilitatorScheme",
    "ClientAptosSigner",
    "FacilitatorAptosSigner",
    "SCHEME_EXACT_DIRECT",
    # Polkadot Schemes
    "ExactDirectPolkadotClientScheme",
    "ExactDirectPolkadotServerScheme",
    "ExactDirectPolkadotFacilitatorScheme",
    "ClientPolkadotSigner",
    "FacilitatorPolkadotSigner",
    "POLKADOT_SCHEME_EXACT_DIRECT",
    # Tezos Schemes
    "ExactDirectTezosClient",
    "ExactDirectTezosServer",
    "ExactDirectTezosFacilitator",
    "ClientTezosSigner",
    "FacilitatorTezosSigner",
    "TEZOS_SCHEME_EXACT_DIRECT",
    # Stacks Schemes
    "ExactDirectStacksClientScheme",
    "ExactDirectStacksServerScheme",
    "ExactDirectStacksFacilitatorScheme",
    "ClientStacksSigner",
    "FacilitatorStacksSigner",
    "STACKS_SCHEME_EXACT_DIRECT",
    # Cosmos Schemes
    "ExactDirectCosmosClientScheme",
    "ExactDirectCosmosServerScheme",
    "ExactDirectCosmosFacilitatorScheme",
    "ExactDirectCosmosFacilitatorConfig",
    "ClientCosmosSigner",
    "FacilitatorCosmosSigner",
    "COSMOS_SCHEME_EXACT_DIRECT",
    # Stellar Schemes
    "ExactStellarClientScheme",
    "ExactStellarServerScheme",
    "ExactStellarFacilitatorScheme",
    "StellarSigner",
    "FacilitatorStellarSigner",
    "STELLAR_SCHEME_EXACT",
    # BTC On-chain Schemes
    "ExactBtcClientScheme",
    "ExactBtcServerScheme",
    "ExactBtcFacilitatorScheme",
    "ExactBtcClientConfig",
    "ExactBtcServerConfig",
    "ExactBtcFacilitatorConfig",
    "ClientBtcSigner",
    "FacilitatorBtcSigner",
    "BtcOnchainPayload",
    "BTC_SCHEME_EXACT",
    "BTC_MAINNET",
    "BTC_TESTNET",
    "BTC_SIGNET",
    # Lightning Schemes
    "LightningClientScheme",
    "LightningServerScheme",
    "LightningFacilitatorScheme",
    "LightningServerConfig",
    "ClientLightningSigner",
    "FacilitatorLightningSigner",
    "LightningPayload",
    "LIGHTNING_MAINNET",
    "LIGHTNING_TESTNET",
]
