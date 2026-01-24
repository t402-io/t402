"""Stacks Blockchain Payment Schemes.

This package provides payment scheme implementations for Stacks (Bitcoin L2).

Supported schemes:
- exact-direct: SIP-010 token transfers verified on-chain

Supported networks:
- stacks:1 (Stacks Mainnet)
- stacks:2147483648 (Stacks Testnet)
"""

from t402.schemes.stacks.exact_direct import (
    ExactDirectStacksClientScheme,
    ExactDirectStacksServerScheme,
    ExactDirectStacksFacilitatorScheme,
    ClientStacksSigner,
    FacilitatorStacksSigner,
    SCHEME_EXACT_DIRECT,
)
from t402.schemes.stacks.constants import (
    STACKS_MAINNET_CAIP2,
    STACKS_TESTNET_CAIP2,
    SUSDC_DECIMALS,
    NETWORKS,
    get_network_config,
    get_supported_networks,
    is_stacks_network,
)
from t402.schemes.stacks.types import (
    ExactDirectPayload,
    TransactionResult,
    ParsedTokenTransfer,
    is_valid_stacks_address,
    is_valid_tx_id,
    parse_contract_identifier,
    create_asset_identifier,
    extract_token_transfer,
)

__all__ = [
    # Schemes
    "ExactDirectStacksClientScheme",
    "ExactDirectStacksServerScheme",
    "ExactDirectStacksFacilitatorScheme",
    # Signer protocols
    "ClientStacksSigner",
    "FacilitatorStacksSigner",
    # Constants
    "SCHEME_EXACT_DIRECT",
    "STACKS_MAINNET_CAIP2",
    "STACKS_TESTNET_CAIP2",
    "SUSDC_DECIMALS",
    "NETWORKS",
    # Functions
    "get_network_config",
    "get_supported_networks",
    "is_stacks_network",
    # Types
    "ExactDirectPayload",
    "TransactionResult",
    "ParsedTokenTransfer",
    "is_valid_stacks_address",
    "is_valid_tx_id",
    "parse_contract_identifier",
    "create_asset_identifier",
    "extract_token_transfer",
]
