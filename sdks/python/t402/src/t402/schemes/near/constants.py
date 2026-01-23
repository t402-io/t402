"""NEAR blockchain constants for the T402 protocol.

This module contains network configurations, token contract addresses,
and other constants used by the NEAR exact-direct payment scheme.
"""

from __future__ import annotations

from typing import Dict, Optional


# Scheme identifier
SCHEME_EXACT_DIRECT = "exact-direct"

# CAIP-2 network identifiers
NEAR_MAINNET = "near:mainnet"
NEAR_TESTNET = "near:testnet"

# RPC endpoints
NEAR_MAINNET_RPC = "https://rpc.mainnet.near.org"
NEAR_TESTNET_RPC = "https://rpc.testnet.near.org"

# Default gas for ft_transfer (30 TGas)
DEFAULT_GAS = "30000000000000"
DEFAULT_GAS_INT = 30_000_000_000_000

# Storage deposit required (1 yoctoNEAR) for ft_transfer
STORAGE_DEPOSIT = "1"

# NEP-141 function names
FUNCTION_FT_TRANSFER = "ft_transfer"
FUNCTION_FT_BALANCE_OF = "ft_balance_of"
FUNCTION_STORAGE_BALANCE = "storage_balance_of"

# CAIP family pattern
CAIP_FAMILY = "near:*"


class TokenInfo:
    """Contains information about a NEAR fungible token.

    Attributes:
        contract_id: The NEAR account ID of the token contract.
        symbol: The token symbol (e.g., "USDT").
        decimals: The number of decimal places for the token.
    """

    def __init__(self, contract_id: str, symbol: str, decimals: int) -> None:
        self.contract_id = contract_id
        self.symbol = symbol
        self.decimals = decimals

    def __repr__(self) -> str:
        return f"TokenInfo(contract_id={self.contract_id!r}, symbol={self.symbol!r}, decimals={self.decimals})"


class NetworkConfig:
    """Network-specific configuration for NEAR.

    Attributes:
        network_id: The short network identifier (e.g., "mainnet").
        rpc_url: The RPC endpoint URL.
        default_token: The default token for this network.
    """

    def __init__(self, network_id: str, rpc_url: str, default_token: TokenInfo) -> None:
        self.network_id = network_id
        self.rpc_url = rpc_url
        self.default_token = default_token


# Token definitions
USDT_MAINNET = TokenInfo(
    contract_id="usdt.tether-token.near",
    symbol="USDT",
    decimals=6,
)

USDT_TESTNET = TokenInfo(
    contract_id="usdt.fakes.testnet",
    symbol="USDT",
    decimals=6,
)

USDC_MAINNET = TokenInfo(
    contract_id="17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
    symbol="USDC",
    decimals=6,
)

USDC_TESTNET = TokenInfo(
    contract_id="usdc.fakes.testnet",
    symbol="USDC",
    decimals=6,
)

# Network configurations
NETWORK_CONFIGS: Dict[str, NetworkConfig] = {
    NEAR_MAINNET: NetworkConfig(
        network_id="mainnet",
        rpc_url=NEAR_MAINNET_RPC,
        default_token=USDT_MAINNET,
    ),
    NEAR_TESTNET: NetworkConfig(
        network_id="testnet",
        rpc_url=NEAR_TESTNET_RPC,
        default_token=USDT_TESTNET,
    ),
}

# Token registry: network -> symbol -> TokenInfo
TOKEN_REGISTRY: Dict[str, Dict[str, TokenInfo]] = {
    NEAR_MAINNET: {
        "USDT": USDT_MAINNET,
        "USDC": USDC_MAINNET,
    },
    NEAR_TESTNET: {
        "USDT": USDT_TESTNET,
        "USDC": USDC_TESTNET,
    },
}


def get_network_config(network: str) -> Optional[NetworkConfig]:
    """Get the configuration for a NEAR network.

    Args:
        network: The CAIP-2 network identifier (e.g., "near:mainnet").

    Returns:
        NetworkConfig if the network is supported, None otherwise.
    """
    return NETWORK_CONFIGS.get(network)


def is_valid_network(network: str) -> bool:
    """Check if a network identifier is a supported NEAR network.

    Args:
        network: The CAIP-2 network identifier.

    Returns:
        True if the network is supported.
    """
    return network in NETWORK_CONFIGS


def get_token_info(network: str, symbol: str) -> Optional[TokenInfo]:
    """Get token info for a network and symbol.

    Args:
        network: The CAIP-2 network identifier.
        symbol: The token symbol (e.g., "USDT").

    Returns:
        TokenInfo if found, None otherwise.
    """
    tokens = TOKEN_REGISTRY.get(network)
    if tokens is None:
        return None
    return tokens.get(symbol)


def get_token_by_contract(network: str, contract_id: str) -> Optional[TokenInfo]:
    """Get token info by contract address.

    Args:
        network: The CAIP-2 network identifier.
        contract_id: The token contract account ID.

    Returns:
        TokenInfo if found, None otherwise.
    """
    tokens = TOKEN_REGISTRY.get(network)
    if tokens is None:
        return None
    for token in tokens.values():
        if token.contract_id == contract_id:
            return token
    return None


def get_supported_networks() -> list:
    """Get a list of supported NEAR network identifiers.

    Returns:
        List of CAIP-2 network identifier strings.
    """
    return [NEAR_MAINNET, NEAR_TESTNET]
