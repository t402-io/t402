"""NEAR Blockchain Payment Schemes.

This package provides payment scheme implementations for the NEAR blockchain.

Supported schemes:
- exact-direct: Client executes NEP-141 ft_transfer, tx hash used as proof.

Usage:
    ```python
    from t402.schemes.near import (
        # Client
        ExactDirectNearClientScheme,
        ExactDirectNearClientConfig,
        # Server
        ExactDirectNearServerScheme,
        ExactDirectNearServerConfig,
        # Facilitator
        ExactDirectNearFacilitatorScheme,
        ExactDirectNearFacilitatorConfig,
        # Signer protocols
        ClientNearSigner,
        FacilitatorNearSigner,
        # Constants
        SCHEME_EXACT_DIRECT,
        NEAR_MAINNET,
        NEAR_TESTNET,
    )
    ```
"""

from t402.schemes.near.exact_direct import (
    ExactDirectNearClientScheme,
    ExactDirectNearServerScheme,
    ExactDirectNearFacilitatorScheme,
)
from t402.schemes.near.exact_direct.client import ExactDirectNearClientConfig
from t402.schemes.near.exact_direct.server import ExactDirectNearServerConfig
from t402.schemes.near.exact_direct.facilitator import ExactDirectNearFacilitatorConfig
from t402.schemes.near.types import (
    ClientNearSigner,
    FacilitatorNearSigner,
    ExactDirectPayload,
    FtTransferArgs,
    is_valid_account_id,
)
from t402.schemes.near.constants import (
    SCHEME_EXACT_DIRECT,
    NEAR_MAINNET,
    NEAR_TESTNET,
    NEAR_MAINNET_RPC,
    NEAR_TESTNET_RPC,
    CAIP_FAMILY,
    DEFAULT_GAS,
    DEFAULT_GAS_INT,
    STORAGE_DEPOSIT,
    FUNCTION_FT_TRANSFER,
    USDT_MAINNET,
    USDT_TESTNET,
    USDC_MAINNET,
    USDC_TESTNET,
    TokenInfo,
    NetworkConfig,
    get_network_config,
    get_token_info,
    get_token_by_contract,
    is_valid_network,
    get_supported_networks,
)

__all__ = [
    # Scheme implementations
    "ExactDirectNearClientScheme",
    "ExactDirectNearServerScheme",
    "ExactDirectNearFacilitatorScheme",
    # Configurations
    "ExactDirectNearClientConfig",
    "ExactDirectNearServerConfig",
    "ExactDirectNearFacilitatorConfig",
    # Signer protocols
    "ClientNearSigner",
    "FacilitatorNearSigner",
    # Payload types
    "ExactDirectPayload",
    "FtTransferArgs",
    # Validation
    "is_valid_account_id",
    "is_valid_network",
    # Constants
    "SCHEME_EXACT_DIRECT",
    "NEAR_MAINNET",
    "NEAR_TESTNET",
    "NEAR_MAINNET_RPC",
    "NEAR_TESTNET_RPC",
    "CAIP_FAMILY",
    "DEFAULT_GAS",
    "DEFAULT_GAS_INT",
    "STORAGE_DEPOSIT",
    "FUNCTION_FT_TRANSFER",
    # Token definitions
    "USDT_MAINNET",
    "USDT_TESTNET",
    "USDC_MAINNET",
    "USDC_TESTNET",
    # Data classes
    "TokenInfo",
    "NetworkConfig",
    # Lookup functions
    "get_network_config",
    "get_token_info",
    "get_token_by_contract",
    "get_supported_networks",
]
