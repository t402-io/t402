"""Polkadot Blockchain Payment Schemes.

This package provides payment scheme implementations for Polkadot Asset Hub networks.

Supported schemes:
- exact-direct: On-chain asset transfer with extrinsic proof

Supported networks:
- polkadot:68d56f15f85d3136970ec16946040bc1 (Polkadot Asset Hub)
- polkadot:e143f23803ac50e8f6f8e62695d1ce9e (Westend Asset Hub / Testnet)
"""

from t402.schemes.polkadot.exact_direct import (
    ExactDirectPolkadotClientScheme,
    ExactDirectPolkadotServerScheme,
    ExactDirectPolkadotFacilitatorScheme,
    ClientPolkadotSigner,
    FacilitatorPolkadotSigner,
    SCHEME_EXACT_DIRECT,
)
from t402.schemes.polkadot.constants import (
    POLKADOT_ASSET_HUB_CAIP2,
    WESTEND_ASSET_HUB_CAIP2,
    KUSAMA_ASSET_HUB_CAIP2,
    USDT_ASSET_ID,
    USDT_DECIMALS,
    NETWORKS,
    get_network_config,
    get_supported_networks,
    is_polkadot_network,
)
from t402.schemes.polkadot.types import (
    ExactDirectPayload,
    ExtrinsicResult,
    ParsedAssetTransfer,
    is_valid_ss58_address,
    is_valid_hash,
    parse_asset_identifier,
    create_asset_identifier,
    extract_asset_transfer,
)

__all__ = [
    # Schemes
    "ExactDirectPolkadotClientScheme",
    "ExactDirectPolkadotServerScheme",
    "ExactDirectPolkadotFacilitatorScheme",
    # Signer protocols
    "ClientPolkadotSigner",
    "FacilitatorPolkadotSigner",
    # Constants
    "SCHEME_EXACT_DIRECT",
    "POLKADOT_ASSET_HUB_CAIP2",
    "WESTEND_ASSET_HUB_CAIP2",
    "KUSAMA_ASSET_HUB_CAIP2",
    "USDT_ASSET_ID",
    "USDT_DECIMALS",
    "NETWORKS",
    # Functions
    "get_network_config",
    "get_supported_networks",
    "is_polkadot_network",
    # Types
    "ExactDirectPayload",
    "ExtrinsicResult",
    "ParsedAssetTransfer",
    "is_valid_ss58_address",
    "is_valid_hash",
    "parse_asset_identifier",
    "create_asset_identifier",
    "extract_asset_transfer",
]
