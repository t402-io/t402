"""
Chain configurations and token addresses for T402 WDK.

Source of truth for token addresses:
  sdks/typescript/packages/mechanisms/evm/src/tokens.ts

Cross-SDK alignment (2026-05-28 W2 sprint): 19 USDT0 chains,
7 USDT legacy chains, 1 USAT chain, 6 USDC chains.
"""

from typing import Dict, List, Optional
from .types import ChainConfig, TokenInfo, NetworkType


# Default chain configurations
DEFAULT_CHAINS: Dict[str, ChainConfig] = {
    # USDT0 mainnet networks
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
    "unichain": ChainConfig(
        chain_id=130,
        network="eip155:130",
        name="unichain",
        rpc_url="https://mainnet.unichain.org",
        network_type=NetworkType.EVM,
    ),
    "optimism": ChainConfig(
        chain_id=10,
        network="eip155:10",
        name="optimism",
        rpc_url="https://mainnet.optimism.io",
        network_type=NetworkType.EVM,
    ),
    "mantle": ChainConfig(
        chain_id=5000,
        network="eip155:5000",
        name="mantle",
        rpc_url="https://rpc.mantle.xyz",
        network_type=NetworkType.EVM,
    ),
    "plasma": ChainConfig(
        chain_id=9745,
        network="eip155:9745",
        name="plasma",
        rpc_url="https://rpc.plasma.to",
        network_type=NetworkType.EVM,
    ),
    "sei": ChainConfig(
        chain_id=1329,
        network="eip155:1329",
        name="sei",
        rpc_url="https://evm-rpc.sei-apis.com",
        network_type=NetworkType.EVM,
    ),
    "conflux": ChainConfig(
        chain_id=1030,
        network="eip155:1030",
        name="conflux",
        rpc_url="https://evm.confluxrpc.com",
        network_type=NetworkType.EVM,
    ),
    "monad": ChainConfig(
        chain_id=143,
        network="eip155:143",
        name="monad",
        rpc_url="https://rpc.monad.xyz",
        network_type=NetworkType.EVM,
    ),
    "rootstock": ChainConfig(
        chain_id=30,
        network="eip155:30",
        name="rootstock",
        rpc_url="https://public-node.rsk.co",
        network_type=NetworkType.EVM,
    ),
    "xlayer": ChainConfig(
        chain_id=196,
        network="eip155:196",
        name="xlayer",
        rpc_url="https://rpc.xlayer.tech",
        network_type=NetworkType.EVM,
    ),
    "flare": ChainConfig(
        chain_id=14,
        network="eip155:14",
        name="flare",
        rpc_url="https://flare-api.flare.network/ext/C/rpc",
        network_type=NetworkType.EVM,
    ),
    "corn": ChainConfig(
        chain_id=21000000,
        network="eip155:21000000",
        name="corn",
        rpc_url="https://maizenet-rpc.usecorn.com",
        network_type=NetworkType.EVM,
    ),
    "hyperevm": ChainConfig(
        chain_id=999,
        network="eip155:999",
        name="hyperevm",
        rpc_url="https://rpc.hyperliquid.xyz/evm",
        network_type=NetworkType.EVM,
    ),
    "megaeth": ChainConfig(
        chain_id=4326,
        network="eip155:4326",
        name="megaeth",
        rpc_url="https://carrot.megaeth.com/rpc",
        network_type=NetworkType.EVM,
    ),
    "stable": ChainConfig(
        chain_id=988,
        network="eip155:988",
        name="stable",
        rpc_url="https://rpc.stable.network",
        network_type=NetworkType.EVM,
    ),
    "avalanche": ChainConfig(
        chain_id=43114,
        network="eip155:43114",
        name="avalanche",
        rpc_url="https://api.avax.network/ext/bc/C/rpc",
        network_type=NetworkType.EVM,
    ),
    # USDT legacy-only mainnet networks
    "bsc": ChainConfig(
        chain_id=56,
        network="eip155:56",
        name="bsc",
        rpc_url="https://bsc-dataseed.binance.org",
        network_type=NetworkType.EVM,
    ),
    "fantom": ChainConfig(
        chain_id=250,
        network="eip155:250",
        name="fantom",
        rpc_url="https://rpc.ftm.tools",
        network_type=NetworkType.EVM,
    ),
    "celo": ChainConfig(
        chain_id=42220,
        network="eip155:42220",
        name="celo",
        rpc_url="https://forno.celo.org",
        network_type=NetworkType.EVM,
    ),
    "kaia": ChainConfig(
        chain_id=8217,
        network="eip155:8217",
        name="kaia",
        rpc_url="https://public-en.node.kaia.io",
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


# USDT0 OFT contract addresses (LayerZero bridgeable, EIP-3009 + EIP-2612)
USDT0_ADDRESSES: Dict[str, str] = {
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


# USDC token addresses by chain
USDC_ADDRESSES: Dict[str, str] = {
    "ethereum": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    "base": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "arbitrum": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    "optimism": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    "polygon": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    "avalanche": "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
}


# Legacy USDT addresses (no EIP-3009 support). For chains where USDT0
# exists, prefer USDT0 over legacy USDT.
USDT_LEGACY_ADDRESSES: Dict[str, str] = {
    "ethereum": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    "polygon": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    "bsc": "0x55d398326f99059fF775485246999027B3197955",
    "avalanche": "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
    "fantom": "0x049d68029688eabf473097a2fc38ef61633a3c7a",
    "celo": "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
    "kaia": "0xd077a400968890eacc75cdc901f0356c943e4fdb",
}


# USAT contract addresses by chain.
# USAT = Tether America USD (federally-regulated US stablecoin).
# Supports EIP-2612 permit (can use `upto` scheme); does NOT support
# EIP-3009 (must use `exact-legacy` scheme for `exact`).
USAT_ADDRESSES: Dict[str, str] = {
    "ethereum": "0x07041776f5007aca2a54844f50503a18a72a8b68",
}


def _usdt0_token(chain: str) -> TokenInfo:
    """Build a USDT0 TokenInfo for a chain."""
    return TokenInfo(
        address=USDT0_ADDRESSES[chain],
        symbol="USDT0",
        name="TetherToken",
        decimals=6,
        supports_eip3009=True,
    )


def _usdc_token(chain: str) -> TokenInfo:
    """Build a USDC TokenInfo for a chain."""
    return TokenInfo(
        address=USDC_ADDRESSES[chain],
        symbol="USDC",
        name="USD Coin",
        decimals=6,
        supports_eip3009=True,
    )


def _usdt_legacy_token(chain: str) -> TokenInfo:
    """Build a legacy USDT TokenInfo for a chain."""
    # BSC and Celo USDT use 18 decimals; others use 6.
    decimals = 18 if chain in ("bsc", "celo") else 6
    return TokenInfo(
        address=USDT_LEGACY_ADDRESSES[chain],
        symbol="USDT",
        name="Tether USD",
        decimals=decimals,
        supports_eip3009=False,
    )


def _usat_token(chain: str) -> TokenInfo:
    """Build a USAT TokenInfo for a chain."""
    return TokenInfo(
        address=USAT_ADDRESSES[chain],
        symbol="USAT",
        name="Tether America USD",
        decimals=6,
        supports_eip3009=False,
    )


# All supported tokens per chain
CHAIN_TOKENS: Dict[str, List[TokenInfo]] = {
    "ethereum": [
        _usdt0_token("ethereum"),
        _usdc_token("ethereum"),
        _usat_token("ethereum"),
        _usdt_legacy_token("ethereum"),
    ],
    "arbitrum": [
        _usdt0_token("arbitrum"),
        _usdc_token("arbitrum"),
    ],
    "base": [
        _usdc_token("base"),
    ],
    "ink": [
        _usdt0_token("ink"),
    ],
    "berachain": [
        _usdt0_token("berachain"),
    ],
    "unichain": [
        _usdt0_token("unichain"),
    ],
    "polygon": [
        _usdt0_token("polygon"),
        _usdc_token("polygon"),
        _usdt_legacy_token("polygon"),
    ],
    "optimism": [
        _usdt0_token("optimism"),
        _usdc_token("optimism"),
    ],
    "avalanche": [
        _usdc_token("avalanche"),
        _usdt_legacy_token("avalanche"),
    ],
    "mantle": [_usdt0_token("mantle")],
    "plasma": [_usdt0_token("plasma")],
    "sei": [_usdt0_token("sei")],
    "conflux": [_usdt0_token("conflux")],
    "monad": [_usdt0_token("monad")],
    "rootstock": [_usdt0_token("rootstock")],
    "xlayer": [_usdt0_token("xlayer")],
    "flare": [_usdt0_token("flare")],
    "corn": [_usdt0_token("corn")],
    "hyperevm": [_usdt0_token("hyperevm")],
    "megaeth": [_usdt0_token("megaeth")],
    "stable": [_usdt0_token("stable")],
    # USDT legacy-only chains
    "bsc": [_usdt_legacy_token("bsc")],
    "fantom": [_usdt_legacy_token("fantom")],
    "celo": [_usdt_legacy_token("celo")],
    "kaia": [_usdt_legacy_token("kaia")],
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
