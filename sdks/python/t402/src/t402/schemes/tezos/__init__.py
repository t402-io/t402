"""Tezos Blockchain Payment Schemes.

This package provides payment scheme implementations for the Tezos blockchain.

Supported schemes:
- exact-direct: Client executes FA2 transfer directly, provides opHash as proof

Usage:
    ```python
    from t402.schemes.tezos import (
        ExactDirectTezosClient,
        ExactDirectTezosServer,
        ExactDirectTezosFacilitator,
        ClientTezosSigner,
        FacilitatorTezosSigner,
        SCHEME_EXACT_DIRECT,
    )
    ```
"""

from t402.schemes.tezos.constants import (
    SCHEME_EXACT_DIRECT,
    TEZOS_MAINNET,
    TEZOS_GHOSTNET,
    USDT_MAINNET_CONTRACT,
    USDT_MAINNET_TOKEN_ID,
    USDT_DECIMALS,
    USDT_MAINNET,
    NETWORK_CONFIGS,
    TOKEN_REGISTRY,
    is_tezos_network,
    is_valid_address,
    is_valid_operation_hash,
    create_asset_identifier,
    parse_asset_identifier,
    get_network_config,
    get_token_info,
    get_token_by_contract,
    decimal_to_atomic,
    parse_decimal_to_atomic,
)
from t402.schemes.tezos.types import (
    ClientTezosSigner,
    FacilitatorTezosSigner,
    ExactDirectPayload,
)
from t402.schemes.tezos.exact_direct import (
    ExactDirectTezosClient,
    ExactDirectTezosServer,
    ExactDirectTezosFacilitator,
)

__all__ = [
    # Scheme classes
    "ExactDirectTezosClient",
    "ExactDirectTezosServer",
    "ExactDirectTezosFacilitator",
    # Signer protocols
    "ClientTezosSigner",
    "FacilitatorTezosSigner",
    # Payload type
    "ExactDirectPayload",
    # Constants
    "SCHEME_EXACT_DIRECT",
    "TEZOS_MAINNET",
    "TEZOS_GHOSTNET",
    "USDT_MAINNET_CONTRACT",
    "USDT_MAINNET_TOKEN_ID",
    "USDT_DECIMALS",
    "USDT_MAINNET",
    "NETWORK_CONFIGS",
    "TOKEN_REGISTRY",
    # Utility functions
    "is_tezos_network",
    "is_valid_address",
    "is_valid_operation_hash",
    "create_asset_identifier",
    "parse_asset_identifier",
    "get_network_config",
    "get_token_info",
    "get_token_by_contract",
    "decimal_to_atomic",
    "parse_decimal_to_atomic",
]
