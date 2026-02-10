from typing import Literal, Union, get_args


# EVM Networks (V1 short names, use EVM_NETWORK_TO_CHAIN_ID for chain IDs)
EVMNetworks = Literal[
    # Standard networks
    "base", "base-sepolia", "avalanche-fuji", "avalanche",
    # Core USDT0 Networks
    "ethereum", "arbitrum", "optimism", "polygon", "ink", "berachain", "unichain",
    # Phase 1: High Priority USDT0 Networks
    "mantle", "plasma", "sei", "conflux", "monad",
    # Phase 2: Medium Priority USDT0 Networks
    "flare", "rootstock", "xlayer", "stable", "hyperevm", "megaeth", "corn",
]

# TON Networks (CAIP-2 format)
TONNetworks = Literal["ton:mainnet", "ton:testnet"]

# TRON Networks (CAIP-2 format)
TRONNetworks = Literal["tron:mainnet", "tron:nile", "tron:shasta"]

# SVM Networks (CAIP-2 format for Solana)
SVMNetworks = Literal[
    "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",  # Mainnet
    "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",  # Devnet
    "solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z",  # Testnet
]

# NEAR Networks (CAIP-2 format)
NEARNetworks = Literal["near:mainnet", "near:testnet"]

# Aptos Networks (CAIP-2 format)
AptosNetworks = Literal["aptos:1", "aptos:2", "aptos:149"]

# Tezos Networks (CAIP-2 format)
TezosNetworks = Literal["tezos:NetXdQprcVkpaWU", "tezos:NetXnHfVqm9iesp"]

# Polkadot Networks (CAIP-2 format)
PolkadotNetworks = Literal[
    "polkadot:68d56f15f85d3136970ec16946040bc1",  # Asset Hub
    "polkadot:e143f23803ac50e8f6f8e62695d1ce9e",  # Westend Asset Hub
]

# Stacks Networks (CAIP-2 format)
StacksNetworks = Literal["stacks:1", "stacks:2147483648"]

# Cosmos Networks (CAIP-2 format)
CosmosNetworks = Literal["cosmos:noble-1", "cosmos:grand-1"]

# Legacy SVM network identifiers (V1 format)
SVMNetworksV1 = Literal["solana", "solana-devnet", "solana-testnet"]

# All supported networks
SupportedNetworks = Union[
    EVMNetworks, TONNetworks, TRONNetworks, SVMNetworks,
    NEARNetworks, AptosNetworks, TezosNetworks, PolkadotNetworks,
    StacksNetworks, CosmosNetworks,
]


def get_all_supported_networks() -> tuple[str, ...]:
    """Get all supported network identifiers as a flat tuple of strings."""
    evm = get_args(EVMNetworks)
    ton = get_args(TONNetworks)
    tron = get_args(TRONNetworks)
    svm = get_args(SVMNetworks)
    near = get_args(NEARNetworks)
    aptos = get_args(AptosNetworks)
    tezos = get_args(TezosNetworks)
    polkadot = get_args(PolkadotNetworks)
    stacks = get_args(StacksNetworks)
    cosmos = get_args(CosmosNetworks)
    return evm + ton + tron + svm + near + aptos + tezos + polkadot + stacks + cosmos


EVM_NETWORK_TO_CHAIN_ID = {
    # Standard networks
    "base-sepolia": 84532,
    "base": 8453,
    "avalanche-fuji": 43113,
    "avalanche": 43114,
    # Core USDT0 Networks
    "ethereum": 1,
    "arbitrum": 42161,
    "optimism": 10,
    "polygon": 137,
    "ink": 57073,
    "berachain": 80094,
    "unichain": 130,
    # Phase 1: High Priority USDT0 Networks
    "mantle": 5000,
    "plasma": 9745,
    "sei": 1329,
    "conflux": 1030,
    "monad": 143,
    # Phase 2: Medium Priority USDT0 Networks
    "flare": 14,
    "rootstock": 30,
    "xlayer": 196,
    "stable": 988,
    "hyperevm": 999,
    "megaeth": 4326,
    "corn": 21000000,
}

# V1 to V2 EVM network mapping
EVM_V1_TO_V2_MAP = {
    name: f"eip155:{chain_id}" for name, chain_id in EVM_NETWORK_TO_CHAIN_ID.items()
}

# TON Network configurations
TON_NETWORKS = {
    "ton:mainnet": {
        "name": "TON Mainnet",
        "endpoint": "https://toncenter.com/api/v2/jsonRPC",
        "is_testnet": False,
    },
    "ton:testnet": {
        "name": "TON Testnet",
        "endpoint": "https://testnet.toncenter.com/api/v2/jsonRPC",
        "is_testnet": True,
    },
}

# TRON Network configurations
TRON_NETWORKS = {
    "tron:mainnet": {
        "name": "TRON Mainnet",
        "endpoint": "https://api.trongrid.io",
        "is_testnet": False,
    },
    "tron:nile": {
        "name": "TRON Nile Testnet",
        "endpoint": "https://api.nileex.io",
        "is_testnet": True,
    },
    "tron:shasta": {
        "name": "TRON Shasta Testnet",
        "endpoint": "https://api.shasta.trongrid.io",
        "is_testnet": True,
    },
}

# SVM (Solana) Network configurations
SVM_NETWORKS = {
    "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": {
        "name": "Solana Mainnet",
        "endpoint": "https://api.mainnet-beta.solana.com",
        "is_testnet": False,
    },
    "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1": {
        "name": "Solana Devnet",
        "endpoint": "https://api.devnet.solana.com",
        "is_testnet": True,
    },
    "solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z": {
        "name": "Solana Testnet",
        "endpoint": "https://api.testnet.solana.com",
        "is_testnet": True,
    },
}

# V1 to V2 SVM network mapping
SVM_V1_TO_V2_MAP = {
    "solana": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    "solana-devnet": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
    "solana-testnet": "solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z",
}


def is_ton_network(network: str) -> bool:
    """Check if a network is a TON network."""
    return network.startswith("ton:")


def is_tron_network(network: str) -> bool:
    """Check if a network is a TRON network."""
    return network.startswith("tron:")


def is_evm_network(network: str) -> bool:
    """Check if a network is an EVM network."""
    return network in EVM_NETWORK_TO_CHAIN_ID or network.startswith("eip155:")


def is_svm_network(network: str) -> bool:
    """Check if a network is a Solana SVM network."""
    return network.startswith("solana:") or network in SVM_V1_TO_V2_MAP


def is_near_network(network: str) -> bool:
    """Check if a network is a NEAR network."""
    return network.startswith("near:")


def is_aptos_network(network: str) -> bool:
    """Check if a network is an Aptos network."""
    return network.startswith("aptos:")


def is_tezos_network(network: str) -> bool:
    """Check if a network is a Tezos network."""
    return network.startswith("tezos:")


def is_polkadot_network(network: str) -> bool:
    """Check if a network is a Polkadot network."""
    return network.startswith("polkadot:")


def is_stacks_network(network: str) -> bool:
    """Check if a network is a Stacks network."""
    return network.startswith("stacks:")


def is_cosmos_network(network: str) -> bool:
    """Check if a network is a Cosmos network."""
    return network.startswith("cosmos:")


def get_network_type(network: str) -> str:
    """Get the network type (ton, tron, evm, svm, near, aptos, tezos, polkadot, stacks, cosmos, or unknown)."""
    if is_ton_network(network):
        return "ton"
    if is_tron_network(network):
        return "tron"
    if is_svm_network(network):
        return "svm"
    if is_near_network(network):
        return "near"
    if is_aptos_network(network):
        return "aptos"
    if is_tezos_network(network):
        return "tezos"
    if is_polkadot_network(network):
        return "polkadot"
    if is_stacks_network(network):
        return "stacks"
    if is_cosmos_network(network):
        return "cosmos"
    if is_evm_network(network):
        return "evm"
    return "unknown"
