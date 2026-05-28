"""Constants for T402 MCP Server.

Source of truth for token addresses:
  sdks/typescript/packages/mechanisms/evm/src/tokens.ts

Cross-SDK alignment (2026-05-28 W2 sprint):
  - USDT0: 19 chains
  - USDT legacy: 7 chains (ethereum, polygon, bsc, avalanche, fantom, celo, kaia)
  - USAT: 1 chain (ethereum)
  - USDC: 6 chains
"""

from typing import Optional

from .types import ServerConfig, SupportedNetwork, SupportedToken

# Chain IDs for supported networks
CHAIN_IDS: dict[SupportedNetwork, int] = {
    # USDT0 mainnet networks
    "ethereum": 1,
    "base": 8453,
    "arbitrum": 42161,
    "optimism": 10,
    "polygon": 137,
    "avalanche": 43114,
    "ink": 57073,
    "berachain": 80094,
    "unichain": 130,
    "mantle": 5000,
    "plasma": 9745,
    "sei": 1329,
    "conflux": 1030,
    "monad": 143,
    "rootstock": 30,
    "xlayer": 196,
    "flare": 14,
    "corn": 21000000,
    "hyperevm": 999,
    "megaeth": 4326,
    "stable": 988,
    # USDT legacy-only mainnet networks
    "bsc": 56,
    "fantom": 250,
    "celo": 42220,
    "kaia": 8217,
}

# Native token symbols for each network
NATIVE_SYMBOLS: dict[SupportedNetwork, str] = {
    "ethereum": "ETH",
    "base": "ETH",
    "arbitrum": "ETH",
    "optimism": "ETH",
    "polygon": "POL",
    "avalanche": "AVAX",
    "ink": "ETH",
    "berachain": "BERA",
    "unichain": "ETH",
    "mantle": "MNT",
    "plasma": "XPL",
    "sei": "SEI",
    "conflux": "CFX",
    "monad": "MON",
    "rootstock": "RBTC",
    "xlayer": "OKB",
    "flare": "FLR",
    "corn": "BTCN",
    "hyperevm": "HYPE",
    "megaeth": "ETH",
    "stable": "USDT",
    "bsc": "BNB",
    "fantom": "FTM",
    "celo": "CELO",
    "kaia": "KAIA",
}

# Block explorer URLs for each network
EXPLORER_URLS: dict[SupportedNetwork, str] = {
    "ethereum": "https://etherscan.io",
    "base": "https://basescan.org",
    "arbitrum": "https://arbiscan.io",
    "optimism": "https://optimistic.etherscan.io",
    "polygon": "https://polygonscan.com",
    "avalanche": "https://snowtrace.io",
    "ink": "https://explorer.inkonchain.com",
    "berachain": "https://berascan.com",
    "unichain": "https://uniscan.xyz",
    "mantle": "https://explorer.mantle.xyz",
    "plasma": "https://plasmascan.to",
    "sei": "https://seitrace.com",
    "conflux": "https://evm.confluxscan.io",
    "monad": "https://explorer.monad.xyz",
    "rootstock": "https://rootstock.blockscout.com",
    "xlayer": "https://www.oklink.com/xlayer",
    "flare": "https://flare-explorer.flare.network",
    "corn": "https://maizenet-explorer.usecorn.com",
    "hyperevm": "https://hyperevmscan.io",
    "megaeth": "https://megaexplorer.xyz",
    "stable": "https://stablescan.org",
    "bsc": "https://bscscan.com",
    "fantom": "https://ftmscan.com",
    "celo": "https://celoscan.io",
    "kaia": "https://kaiascan.io",
}

# Default RPC URLs for each network
# Public endpoints; callers can override via ServerConfig.rpc_urls.
DEFAULT_RPC_URLS: dict[SupportedNetwork, str] = {
    "ethereum": "https://eth.llamarpc.com",
    "base": "https://mainnet.base.org",
    "arbitrum": "https://arb1.arbitrum.io/rpc",
    "optimism": "https://mainnet.optimism.io",
    "polygon": "https://polygon-rpc.com",
    "avalanche": "https://api.avax.network/ext/bc/C/rpc",
    "ink": "https://rpc-gel.inkonchain.com",
    "berachain": "https://rpc.berachain.com",
    "unichain": "https://mainnet.unichain.org",
    "mantle": "https://rpc.mantle.xyz",
    "plasma": "https://rpc.plasma.to",
    "sei": "https://evm-rpc.sei-apis.com",
    "conflux": "https://evm.confluxrpc.com",
    "monad": "https://rpc.monad.xyz",
    "rootstock": "https://public-node.rsk.co",
    "xlayer": "https://rpc.xlayer.tech",
    "flare": "https://flare-api.flare.network/ext/C/rpc",
    "corn": "https://maizenet-rpc.usecorn.com",
    "hyperevm": "https://rpc.hyperliquid.xyz/evm",
    "megaeth": "https://carrot.megaeth.com/rpc",
    "stable": "https://rpc.stable.network",
    "bsc": "https://bsc-dataseed.binance.org",
    "fantom": "https://rpc.ftm.tools",
    "celo": "https://forno.celo.org",
    "kaia": "https://public-en.node.kaia.io",
}

# USDC contract addresses by network
USDC_ADDRESSES: dict[SupportedNetwork, str] = {
    "ethereum": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "base": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "arbitrum": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    "optimism": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    "polygon": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    "avalanche": "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
}

# Legacy USDT contract addresses by network (no EIP-3009 support; requires
# the approve + transferFrom pattern). For chains where USDT0 exists, prefer
# USDT0 over legacy USDT.
USDT_ADDRESSES: dict[SupportedNetwork, str] = {
    "ethereum": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    "polygon": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    "bsc": "0x55d398326f99059fF775485246999027B3197955",
    "avalanche": "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
    "fantom": "0x049d68029688eabf473097a2fc38ef61633a3c7a",
    "celo": "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
    "kaia": "0xd077a400968890eacc75cdc901f0356c943e4fdb",
}

# USDT0 OFT contract addresses (LayerZero bridgeable, EIP-3009 + EIP-2612)
USDT0_ADDRESSES: dict[SupportedNetwork, str] = {
    "ethereum": "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
    "arbitrum": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    "ink": "0x0200C29006150606B650577BBE7B6248F58470c1",
    "berachain": "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
    "unichain": "0x9151434b16b9763660705744891fA906F660EcC5",
    "polygon": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    "mantle": "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
    "optimism": "0x01bFF41798a0BcF287b996046Ca68b395DbC1071",
    "plasma": "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
    "sei": "0x9151434b16b9763660705744891fA906F660EcC5",
    "conflux": "0xaf37E8B6C9ED7f6318979f56Fc287d76c30847ff",
    "monad": "0xe7cd86e13AC4309349F30B3435a9d337750fC82D",
    "rootstock": "0x779dED0C9e1022225F8e0630b35A9B54Be713736",
    "xlayer": "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
    "flare": "0xe7cd86e13AC4309349F30B3435a9d337750fC82D",
    "corn": "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
    "hyperevm": "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
    "megaeth": "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb",
    "stable": "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
}

# USAT contract addresses by network.
# USAT = Tether America USD, Tether's federally-regulated US stablecoin.
# Supports EIP-2612 permit (can use `upto` scheme); does NOT support
# EIP-3009 (must use `exact-legacy` scheme for `exact`).
USAT_ADDRESSES: dict[SupportedNetwork, str] = {
    "ethereum": "0x07041776f5007aca2a54844f50503a18a72a8b68",
}

# Networks that support ERC-4337 gasless payments
GASLESS_NETWORKS: list[SupportedNetwork] = [
    "ethereum",
    "base",
    "arbitrum",
    "optimism",
    "polygon",
    "avalanche",
]

# LayerZero endpoint IDs for bridging.
# https://docs.layerzero.network/v2/developers/evm/technical-reference/deployed-contracts
# Chains with USDT0 but no LayerZero V2 endpoint listed yet
# (plasma, monad, corn, hyperevm, megaeth, stable) are not bridgeable
# until their endpoint IDs are published.
LAYERZERO_ENDPOINT_IDS: dict[SupportedNetwork, int] = {
    "ethereum": 30101,
    "arbitrum": 30110,
    "ink": 30291,
    "berachain": 30362,
    "unichain": 30320,
    "polygon": 30109,
    "mantle": 30181,
    "optimism": 30111,
    "sei": 30280,
    "conflux": 30212,
    "rootstock": 30333,
    "xlayer": 30274,
    "flare": 30295,
}

# Networks that support USDT0 bridging via LayerZero.
# A chain is bridgeable IFF we know its LayerZero endpoint ID. Subset of
# USDT0_ADDRESSES — newer USDT0 chains without published endpoint IDs
# are deployed but not yet routable via LayerZero from our tooling.
BRIDGEABLE_CHAINS: list[SupportedNetwork] = list(LAYERZERO_ENDPOINT_IDS.keys())

# LayerZero Scan URL for tracking bridge messages
LAYERZERO_SCAN_URL = "https://layerzeroscan.com/tx/"

# All supported networks
ALL_NETWORKS: list[SupportedNetwork] = list(CHAIN_IDS.keys())

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
    elif token == "USAT":
        return USAT_ADDRESSES.get(network)
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
