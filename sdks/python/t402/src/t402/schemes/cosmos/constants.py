"""Cosmos/Noble blockchain constants for the T402 protocol.

This module contains network configurations, token denominations,
and other constants used by the Cosmos exact-direct payment scheme.
"""

from __future__ import annotations

from typing import Dict, Optional


# Scheme identifier
SCHEME_EXACT_DIRECT = "exact-direct"

# CAIP-2 network identifiers
# Noble is a Cosmos app-chain specifically built for native USDC issuance
COSMOS_NOBLE_MAINNET = "cosmos:noble-1"
COSMOS_NOBLE_TESTNET = "cosmos:grand-1"

# RPC endpoints
NOBLE_MAINNET_RPC = "https://noble-rpc.polkachu.com"
NOBLE_TESTNET_RPC = "https://rpc.testnet.noble.strange.love"

# REST API endpoints
NOBLE_MAINNET_REST = "https://noble-api.polkachu.com"
NOBLE_TESTNET_REST = "https://api.testnet.noble.strange.love"

# Address prefix (bech32)
NOBLE_BECH32_PREFIX = "noble"

# USDC denom on Noble (micro USDC: 1 USDC = 1,000,000 uusdc)
USDC_DENOM = "uusdc"

# Gas settings
DEFAULT_GAS_LIMIT = 200000
DEFAULT_GAS_PRICE = "0.025uusdc"
DEFAULT_FEE_AMOUNT = "5000"  # 0.005 USDC
DEFAULT_FEE_DENOM = USDC_DENOM

# Message types
MSG_TYPE_SEND = "/cosmos.bank.v1beta1.MsgSend"
MSG_TYPE_MULTI_SEND = "/cosmos.bank.v1beta1.MsgMultiSend"

# CAIP family pattern
CAIP_FAMILY = "cosmos:*"


class TokenInfo:
    """Contains information about a Cosmos token.

    Attributes:
        denom: The token denomination (e.g., "uusdc").
        symbol: The token symbol (e.g., "USDC").
        decimals: The number of decimal places for the token.
    """

    def __init__(self, denom: str, symbol: str, decimals: int) -> None:
        self.denom = denom
        self.symbol = symbol
        self.decimals = decimals

    def __repr__(self) -> str:
        return f"TokenInfo(denom={self.denom!r}, symbol={self.symbol!r}, decimals={self.decimals})"


class NetworkConfig:
    """Network-specific configuration for Cosmos.

    Attributes:
        chain_id: The Cosmos chain ID (e.g., "noble-1").
        rpc_url: The RPC endpoint URL.
        rest_url: The REST API endpoint URL.
        bech32_prefix: The bech32 address prefix (e.g., "noble").
        default_token: The default token for this network.
    """

    def __init__(
        self,
        chain_id: str,
        rpc_url: str,
        rest_url: str,
        bech32_prefix: str,
        default_token: TokenInfo,
    ) -> None:
        self.chain_id = chain_id
        self.rpc_url = rpc_url
        self.rest_url = rest_url
        self.bech32_prefix = bech32_prefix
        self.default_token = default_token


# Token definitions
USDC_TOKEN = TokenInfo(
    denom=USDC_DENOM,
    symbol="USDC",
    decimals=6,
)

# Network configurations
NETWORK_CONFIGS: Dict[str, NetworkConfig] = {
    COSMOS_NOBLE_MAINNET: NetworkConfig(
        chain_id="noble-1",
        rpc_url=NOBLE_MAINNET_RPC,
        rest_url=NOBLE_MAINNET_REST,
        bech32_prefix=NOBLE_BECH32_PREFIX,
        default_token=USDC_TOKEN,
    ),
    COSMOS_NOBLE_TESTNET: NetworkConfig(
        chain_id="grand-1",
        rpc_url=NOBLE_TESTNET_RPC,
        rest_url=NOBLE_TESTNET_REST,
        bech32_prefix=NOBLE_BECH32_PREFIX,
        default_token=USDC_TOKEN,
    ),
}

# Token registry: network -> symbol -> TokenInfo
TOKEN_REGISTRY: Dict[str, Dict[str, TokenInfo]] = {
    COSMOS_NOBLE_MAINNET: {
        "USDC": USDC_TOKEN,
    },
    COSMOS_NOBLE_TESTNET: {
        "USDC": USDC_TOKEN,
    },
}


def get_network_config(network: str) -> Optional[NetworkConfig]:
    """Get the configuration for a Cosmos network.

    Args:
        network: The CAIP-2 network identifier (e.g., "cosmos:noble-1").

    Returns:
        NetworkConfig if the network is supported, None otherwise.
    """
    return NETWORK_CONFIGS.get(network)


def is_valid_network(network: str) -> bool:
    """Check if a network identifier is a supported Cosmos network.

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
        symbol: The token symbol (e.g., "USDC").

    Returns:
        TokenInfo if found, None otherwise.
    """
    tokens = TOKEN_REGISTRY.get(network)
    if tokens is None:
        return None
    return tokens.get(symbol)


def get_token_by_denom(network: str, denom: str) -> Optional[TokenInfo]:
    """Get token info by denomination.

    Args:
        network: The CAIP-2 network identifier.
        denom: The token denomination (e.g., "uusdc").

    Returns:
        TokenInfo if found, None otherwise.
    """
    tokens = TOKEN_REGISTRY.get(network)
    if tokens is None:
        return None
    for token in tokens.values():
        if token.denom == denom:
            return token
    return None


def is_valid_address(address: str, expected_prefix: str) -> bool:
    """Check if an address has the correct bech32 prefix.

    Validates that the address starts with the expected prefix followed by "1"
    (the bech32 separator) and has sufficient length.

    Args:
        address: The bech32 address to validate.
        expected_prefix: The expected prefix (e.g., "noble").

    Returns:
        True if the address has the correct prefix format.
    """
    if not address or len(address) < len(expected_prefix) + 1:
        return False
    return address[:len(expected_prefix)] == expected_prefix


def get_supported_networks() -> list:
    """Get a list of supported Cosmos network identifiers.

    Returns:
        List of CAIP-2 network identifier strings.
    """
    return [COSMOS_NOBLE_MAINNET, COSMOS_NOBLE_TESTNET]
