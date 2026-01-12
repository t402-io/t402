"""
Chain configurations and token addresses for T402 WDK.
"""

from typing import Dict, List, Optional
from .types import ChainConfig, TokenInfo, NetworkType


# Default chain configurations
DEFAULT_CHAINS: Dict[str, ChainConfig] = {
    "ethereum": ChainConfig(
        chain_id=1,
        network="eip155:1",
        name="ethereum",
        rpc_url="https://eth.drpc.org",
        network_type=NetworkType.EVM,
    ),
    "arbitrum": ChainConfig(
        chain_id=42161,
        network="eip155:42161",
        name="arbitrum",
        rpc_url="https://arb1.arbitrum.io/rpc",
        network_type=NetworkType.EVM,
    ),
    "base": ChainConfig(
        chain_id=8453,
        network="eip155:8453",
        name="base",
        rpc_url="https://mainnet.base.org",
        network_type=NetworkType.EVM,
    ),
    "ink": ChainConfig(
        chain_id=57073,
        network="eip155:57073",
        name="ink",
        rpc_url="https://rpc-gel.inkonchain.com",
        network_type=NetworkType.EVM,
    ),
    "berachain": ChainConfig(
        chain_id=80094,
        network="eip155:80094",
        name="berachain",
        rpc_url="https://rpc.berachain.com",
        network_type=NetworkType.EVM,
    ),
    "polygon": ChainConfig(
        chain_id=137,
        network="eip155:137",
        name="polygon",
        rpc_url="https://polygon-rpc.com",
        network_type=NetworkType.EVM,
    ),
    # Testnets
    "arbitrum-sepolia": ChainConfig(
        chain_id=421614,
        network="eip155:421614",
        name="arbitrum-sepolia",
        rpc_url="https://sepolia-rollup.arbitrum.io/rpc",
        network_type=NetworkType.EVM,
    ),
    "base-sepolia": ChainConfig(
        chain_id=84532,
        network="eip155:84532",
        name="base-sepolia",
        rpc_url="https://sepolia.base.org",
        network_type=NetworkType.EVM,
    ),
}


# USDT0 token addresses by chain (supports EIP-3009)
USDT0_ADDRESSES: Dict[str, str] = {
    "ethereum": "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
    "arbitrum": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    "ink": "0x0200C29006150606B650577BBE7B6248F58470c1",
    "berachain": "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
    "unichain": "0x588ce4F028D8e7B53B687865d6A67b3A54C75518",
}


# USDC token addresses by chain
USDC_ADDRESSES: Dict[str, str] = {
    "ethereum": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "arbitrum": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    "base": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "polygon": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
}


# Legacy USDT addresses (no EIP-3009 support)
USDT_LEGACY_ADDRESSES: Dict[str, str] = {
    "ethereum": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    "polygon": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
}


# All supported tokens per chain
CHAIN_TOKENS: Dict[str, List[TokenInfo]] = {
    "ethereum": [
        TokenInfo(
            address=USDT0_ADDRESSES["ethereum"],
            symbol="USDT0",
            name="TetherToken",
            decimals=6,
            supports_eip3009=True,
        ),
        TokenInfo(
            address=USDC_ADDRESSES["ethereum"],
            symbol="USDC",
            name="USD Coin",
            decimals=6,
            supports_eip3009=True,
        ),
        TokenInfo(
            address=USDT_LEGACY_ADDRESSES["ethereum"],
            symbol="USDT",
            name="Tether USD",
            decimals=6,
            supports_eip3009=False,
        ),
    ],
    "arbitrum": [
        TokenInfo(
            address=USDT0_ADDRESSES["arbitrum"],
            symbol="USDT0",
            name="TetherToken",
            decimals=6,
            supports_eip3009=True,
        ),
        TokenInfo(
            address=USDC_ADDRESSES["arbitrum"],
            symbol="USDC",
            name="USD Coin",
            decimals=6,
            supports_eip3009=True,
        ),
    ],
    "base": [
        TokenInfo(
            address=USDC_ADDRESSES["base"],
            symbol="USDC",
            name="USD Coin",
            decimals=6,
            supports_eip3009=True,
        ),
    ],
    "ink": [
        TokenInfo(
            address=USDT0_ADDRESSES["ink"],
            symbol="USDT0",
            name="TetherToken",
            decimals=6,
            supports_eip3009=True,
        ),
    ],
    "berachain": [
        TokenInfo(
            address=USDT0_ADDRESSES["berachain"],
            symbol="USDT0",
            name="TetherToken",
            decimals=6,
            supports_eip3009=True,
        ),
    ],
    "polygon": [
        TokenInfo(
            address=USDC_ADDRESSES["polygon"],
            symbol="USDC",
            name="USD Coin",
            decimals=6,
            supports_eip3009=True,
        ),
        TokenInfo(
            address=USDT_LEGACY_ADDRESSES["polygon"],
            symbol="USDT",
            name="Tether USD",
            decimals=6,
            supports_eip3009=False,
        ),
    ],
}


def get_chain_config(chain: str) -> Optional[ChainConfig]:
    """Get configuration for a chain."""
    return DEFAULT_CHAINS.get(chain)


def get_chain_id(chain: str) -> int:
    """Get chain ID from chain name."""
    config = DEFAULT_CHAINS.get(chain)
    return config.chain_id if config else 1


def get_network_from_chain(chain: str) -> str:
    """Get CAIP-2 network ID from chain name."""
    config = DEFAULT_CHAINS.get(chain)
    return config.network if config else "eip155:1"


def get_chain_from_network(network: str) -> Optional[str]:
    """Get chain name from CAIP-2 network ID."""
    for chain, config in DEFAULT_CHAINS.items():
        if config.network == network:
            return chain
    return None


def get_usdt0_chains() -> List[str]:
    """Get all chains that support USDT0."""
    return list(USDT0_ADDRESSES.keys())


def get_chain_tokens(chain: str) -> List[TokenInfo]:
    """Get all tokens for a chain."""
    return CHAIN_TOKENS.get(chain, [])


def get_preferred_token(chain: str) -> Optional[TokenInfo]:
    """Get preferred token for a chain (USDT0 > USDC > USDT)."""
    tokens = CHAIN_TOKENS.get(chain, [])
    if not tokens:
        return None

    # Priority: USDT0 > USDC > others
    for symbol in ["USDT0", "USDC"]:
        for token in tokens:
            if token.symbol == symbol:
                return token
    return tokens[0] if tokens else None


def get_token_address(chain: str, symbol: str) -> Optional[str]:
    """Get token address for a chain and symbol."""
    tokens = CHAIN_TOKENS.get(chain, [])
    for token in tokens:
        if token.symbol.upper() == symbol.upper():
            return token.address
    return None


def is_testnet(chain: str) -> bool:
    """Check if a chain is a testnet."""
    testnet_keywords = ["sepolia", "testnet", "devnet", "nile", "shasta"]
    return any(keyword in chain.lower() for keyword in testnet_keywords)
