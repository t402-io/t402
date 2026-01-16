"""Constants for T402 MCP Server."""

from typing import Optional

from .types import ServerConfig, SupportedNetwork, SupportedToken

# Chain IDs for supported networks
CHAIN_IDS: dict[SupportedNetwork, int] = {
    "ethereum": 1,
    "base": 8453,
    "arbitrum": 42161,
    "optimism": 10,
    "polygon": 137,
    "avalanche": 43114,
    "ink": 57073,
    "berachain": 80094,
    "unichain": 130,
}

# Native token symbols for each network
NATIVE_SYMBOLS: dict[SupportedNetwork, str] = {
    "ethereum": "ETH",
    "base": "ETH",
    "arbitrum": "ETH",
    "optimism": "ETH",
    "polygon": "MATIC",
    "avalanche": "AVAX",
    "ink": "ETH",
    "berachain": "BERA",
    "unichain": "ETH",
}

# Block explorer URLs for each network
EXPLORER_URLS: dict[SupportedNetwork, str] = {
    "ethereum": "https://etherscan.io",
    "base": "https://basescan.org",
    "arbitrum": "https://arbiscan.io",
    "optimism": "https://optimistic.etherscan.io",
    "polygon": "https://polygonscan.com",
    "avalanche": "https://snowtrace.io",
    "ink": "https://explorer.ink.xyz",
    "berachain": "https://berascan.com",
    "unichain": "https://uniscan.xyz",
}

# Default RPC URLs for each network
DEFAULT_RPC_URLS: dict[SupportedNetwork, str] = {
    "ethereum": "https://eth.llamarpc.com",
    "base": "https://mainnet.base.org",
    "arbitrum": "https://arb1.arbitrum.io/rpc",
    "optimism": "https://mainnet.optimism.io",
    "polygon": "https://polygon-rpc.com",
    "avalanche": "https://api.avax.network/ext/bc/C/rpc",
    "ink": "https://rpc-qnd.ink.xyz",
    "berachain": "https://artio.rpc.berachain.com",
    "unichain": "https://mainnet.unichain.org",
}

# USDC contract addresses by network
USDC_ADDRESSES: dict[SupportedNetwork, str] = {
    "ethereum": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "base": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "arbitrum": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    "optimism": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    "polygon": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    "avalanche": "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
    "ink": "0x0200C29006150606B650577BBE7B6248F58470c1",
    "berachain": "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
    "unichain": "0x588ce4F028D8e7B53B687865d6A67b3A54C75518",
}

# USDT contract addresses by network
USDT_ADDRESSES: dict[SupportedNetwork, str] = {
    "ethereum": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    "arbitrum": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    "optimism": "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
    "polygon": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    "avalanche": "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
}

# USDT0 OFT contract addresses (LayerZero bridgeable)
USDT0_ADDRESSES: dict[SupportedNetwork, str] = {
    "ethereum": "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
    "arbitrum": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    "ink": "0x0200C29006150606B650577BBE7B6248F58470c1",
    "berachain": "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
    "unichain": "0x588ce4F028D8e7B53B687865d6A67b3A54C75518",
}

# Networks that support USDT0 bridging via LayerZero
BRIDGEABLE_CHAINS: list[SupportedNetwork] = [
    "ethereum",
    "arbitrum",
    "ink",
    "berachain",
    "unichain",
]

# Networks that support ERC-4337 gasless payments
GASLESS_NETWORKS: list[SupportedNetwork] = [
    "ethereum",
    "base",
    "arbitrum",
    "optimism",
    "polygon",
    "avalanche",
]

# LayerZero endpoint IDs for bridging
LAYERZERO_ENDPOINT_IDS: dict[SupportedNetwork, int] = {
    "ethereum": 30101,
    "arbitrum": 30110,
    "ink": 30291,
    "berachain": 30362,
    "unichain": 30320,
}

# LayerZero Scan URL for tracking bridge messages
LAYERZERO_SCAN_URL = "https://layerzeroscan.com/tx/"

# All supported networks
ALL_NETWORKS: list[SupportedNetwork] = [
    "ethereum",
    "base",
    "arbitrum",
    "optimism",
    "polygon",
    "avalanche",
    "ink",
    "berachain",
    "unichain",
]

# Token decimals
TOKEN_DECIMALS = 6
NATIVE_DECIMALS = 18


def is_valid_network(network: str) -> bool:
    """Check if a network string is valid."""
    return network in ALL_NETWORKS


def is_bridgeable_chain(network: str) -> bool:
    """Check if a network supports USDT0 bridging."""
    return network in BRIDGEABLE_CHAINS


def is_gasless_network(network: str) -> bool:
    """Check if a network supports ERC-4337 gasless payments."""
    return network in GASLESS_NETWORKS


def get_token_address(
    network: SupportedNetwork, token: SupportedToken
) -> Optional[str]:
    """Get the token contract address for a network."""
    if token == "USDC":
        return USDC_ADDRESSES.get(network)
    elif token == "USDT":
        return USDT_ADDRESSES.get(network)
    elif token == "USDT0":
        return USDT0_ADDRESSES.get(network)
    return None


def get_explorer_tx_url(network: SupportedNetwork, tx_hash: str) -> str:
    """Get the explorer URL for a transaction."""
    base_url = EXPLORER_URLS.get(network, "")
    if not base_url:
        return ""
    return f"{base_url}/tx/{tx_hash}"


def get_rpc_url(config: Optional[ServerConfig], network: SupportedNetwork) -> str:
    """Get the RPC URL for a network, using config override if available."""
    if config and config.rpc_urls and network in config.rpc_urls:
        return config.rpc_urls[network]
    return DEFAULT_RPC_URLS.get(network, "")


def format_token_amount(amount: int, decimals: int) -> str:
    """Format a raw token amount with decimals to human-readable string."""
    if amount == 0:
        return "0"

    divisor = 10**decimals
    whole = amount // divisor
    fraction = amount % divisor

    if fraction == 0:
        return str(whole)

    # Format fraction and trim trailing zeros
    fraction_str = str(fraction).zfill(decimals).rstrip("0")
    return f"{whole}.{fraction_str}"


def parse_token_amount(amount: str, decimals: int) -> int:
    """Parse a human-readable amount string to raw token units."""
    parts = amount.split(".")

    whole = int(parts[0])
    result = whole * (10**decimals)

    if len(parts) == 2:
        frac = parts[1]
        if len(frac) > decimals:
            frac = frac[:decimals]
        frac = frac.ljust(decimals, "0")
        result += int(frac)

    return result
