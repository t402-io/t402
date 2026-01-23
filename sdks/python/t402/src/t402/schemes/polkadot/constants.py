"""Polkadot Scheme Constants.

This module defines constants for the Polkadot exact-direct payment scheme,
including network identifiers, token configurations, and default endpoints.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict


# Scheme identifier
SCHEME_EXACT_DIRECT = "exact-direct"

# CAIP-2 network identifiers for Polkadot parachains
POLKADOT_ASSET_HUB_CAIP2 = "polkadot:68d56f15f85d3136970ec16946040bc1"
KUSAMA_ASSET_HUB_CAIP2 = "polkadot:48239ef607d7928874027a43a67689209727dfb3d3dc5e5b03a39bdc2eda771a"
WESTEND_ASSET_HUB_CAIP2 = "polkadot:e143f23803ac50e8f6f8e62695d1ce9e"

# Default indexer endpoints (Subscan)
POLKADOT_ASSET_HUB_INDEXER = "https://assethub-polkadot.api.subscan.io"
KUSAMA_ASSET_HUB_INDEXER = "https://assethub-kusama.api.subscan.io"
WESTEND_ASSET_HUB_INDEXER = "https://assethub-westend.api.subscan.io"

# Default RPC endpoints
POLKADOT_ASSET_HUB_RPC = "wss://polkadot-asset-hub-rpc.polkadot.io"
KUSAMA_ASSET_HUB_RPC = "wss://kusama-asset-hub-rpc.polkadot.io"
WESTEND_ASSET_HUB_RPC = "wss://westend-asset-hub-rpc.polkadot.io"

# USDT Asset ID on Asset Hub parachains
USDT_ASSET_ID = 1984

# Default decimals for USDT
USDT_DECIMALS = 6


@dataclass(frozen=True)
class TokenInfo:
    """Token configuration for a Polkadot asset."""

    asset_id: int
    symbol: str
    name: str
    decimals: int


@dataclass(frozen=True)
class NetworkConfig:
    """Configuration for a Polkadot network."""

    name: str
    caip2: str
    indexer_url: str
    rpc_url: str
    genesis_hash: str
    ss58_prefix: int
    is_testnet: bool
    default_token: TokenInfo


# Default token configurations
USDT_POLKADOT = TokenInfo(
    asset_id=USDT_ASSET_ID,
    symbol="USDT",
    name="Tether USD",
    decimals=USDT_DECIMALS,
)

USDT_KUSAMA = TokenInfo(
    asset_id=USDT_ASSET_ID,
    symbol="USDT",
    name="Tether USD",
    decimals=USDT_DECIMALS,
)

USDT_WESTEND = TokenInfo(
    asset_id=USDT_ASSET_ID,
    symbol="USDT",
    name="Test Tether USD",
    decimals=USDT_DECIMALS,
)

# Network configurations indexed by CAIP-2 identifier
NETWORKS: Dict[str, NetworkConfig] = {
    POLKADOT_ASSET_HUB_CAIP2: NetworkConfig(
        name="Polkadot Asset Hub",
        caip2=POLKADOT_ASSET_HUB_CAIP2,
        indexer_url=POLKADOT_ASSET_HUB_INDEXER,
        rpc_url=POLKADOT_ASSET_HUB_RPC,
        genesis_hash="0x68d56f15f85d3136970ec16946040bc1752654e906147f7e43e9d539d7c3de2f",
        ss58_prefix=0,
        is_testnet=False,
        default_token=USDT_POLKADOT,
    ),
    KUSAMA_ASSET_HUB_CAIP2: NetworkConfig(
        name="Kusama Asset Hub",
        caip2=KUSAMA_ASSET_HUB_CAIP2,
        indexer_url=KUSAMA_ASSET_HUB_INDEXER,
        rpc_url=KUSAMA_ASSET_HUB_RPC,
        genesis_hash="0x48239ef607d7928874027a43a67689209727dfb3d3dc5e5b03a39bdc2eda771a",
        ss58_prefix=2,
        is_testnet=False,
        default_token=USDT_KUSAMA,
    ),
    WESTEND_ASSET_HUB_CAIP2: NetworkConfig(
        name="Westend Asset Hub",
        caip2=WESTEND_ASSET_HUB_CAIP2,
        indexer_url=WESTEND_ASSET_HUB_INDEXER,
        rpc_url=WESTEND_ASSET_HUB_RPC,
        genesis_hash="0xe143f23803ac50e8f6f8e62695d1ce9e4e1d68aa36c1cd2cfd15340213f3423e",
        ss58_prefix=42,
        is_testnet=True,
        default_token=USDT_WESTEND,
    ),
}


def get_network_config(network: str) -> NetworkConfig:
    """Get the network configuration for a CAIP-2 identifier.

    Args:
        network: CAIP-2 network identifier (e.g., "polkadot:68d56f15f85d3136970ec16946040bc1")

    Returns:
        NetworkConfig for the given network

    Raises:
        ValueError: If the network is not supported
    """
    config = NETWORKS.get(network)
    if config is None:
        raise ValueError(f"Unsupported Polkadot network: {network}")
    return config


def is_polkadot_network(network: str) -> bool:
    """Check if a network identifier is a Polkadot network.

    Args:
        network: Network identifier to check

    Returns:
        True if the network starts with "polkadot:"
    """
    return network.startswith("polkadot:")


def get_supported_networks() -> list:
    """Get all supported Polkadot network identifiers.

    Returns:
        List of CAIP-2 network identifiers
    """
    return list(NETWORKS.keys())
