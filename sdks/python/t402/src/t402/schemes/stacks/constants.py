"""Stacks Scheme Constants.

This module defines constants for the Stacks exact-direct payment scheme,
including network identifiers, token configurations, and default endpoints.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict


# Scheme identifier
SCHEME_EXACT_DIRECT = "exact-direct"

# CAIP-2 network identifiers for Stacks
STACKS_MAINNET_CAIP2 = "stacks:1"
STACKS_TESTNET_CAIP2 = "stacks:2147483648"

# Default Hiro API endpoints
STACKS_MAINNET_API = "https://api.hiro.so"
STACKS_TESTNET_API = "https://api.testnet.hiro.so"

# sUSDC token decimals
SUSDC_DECIMALS = 6


@dataclass(frozen=True)
class TokenInfo:
    """Token configuration for a Stacks asset."""

    contract_address: str
    symbol: str
    name: str
    decimals: int


@dataclass(frozen=True)
class NetworkConfig:
    """Configuration for a Stacks network."""

    name: str
    caip2: str
    api_url: str
    chain_id: int
    is_testnet: bool
    default_token: TokenInfo


# Default token configurations
SUSDC_MAINNET = TokenInfo(
    contract_address="SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
    symbol="sUSDC",
    name="Stacks USDC",
    decimals=SUSDC_DECIMALS,
)

SUSDC_TESTNET = TokenInfo(
    contract_address="ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.token-susdc",
    symbol="sUSDC",
    name="Test Stacks USDC",
    decimals=SUSDC_DECIMALS,
)

# Network configurations indexed by CAIP-2 identifier
NETWORKS: Dict[str, NetworkConfig] = {
    STACKS_MAINNET_CAIP2: NetworkConfig(
        name="Stacks Mainnet",
        caip2=STACKS_MAINNET_CAIP2,
        api_url=STACKS_MAINNET_API,
        chain_id=1,
        is_testnet=False,
        default_token=SUSDC_MAINNET,
    ),
    STACKS_TESTNET_CAIP2: NetworkConfig(
        name="Stacks Testnet",
        caip2=STACKS_TESTNET_CAIP2,
        api_url=STACKS_TESTNET_API,
        chain_id=2147483648,
        is_testnet=True,
        default_token=SUSDC_TESTNET,
    ),
}


def get_network_config(network: str) -> NetworkConfig:
    """Get the network configuration for a CAIP-2 identifier.

    Args:
        network: CAIP-2 network identifier (e.g., "stacks:1")

    Returns:
        NetworkConfig for the given network

    Raises:
        ValueError: If the network is not supported
    """
    config = NETWORKS.get(network)
    if config is None:
        raise ValueError(f"Unsupported Stacks network: {network}")
    return config


def is_stacks_network(network: str) -> bool:
    """Check if a network identifier is a Stacks network.

    Args:
        network: Network identifier to check

    Returns:
        True if the network starts with "stacks:"
    """
    return network.startswith("stacks:")


def get_supported_networks() -> list:
    """Get all supported Stacks network identifiers.

    Returns:
        List of CAIP-2 network identifiers
    """
    return list(NETWORKS.keys())
