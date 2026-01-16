from typing import Literal, Union, get_args


# EVM Networks
EVMNetworks = Literal["base", "base-sepolia", "avalanche-fuji", "avalanche"]

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

# Legacy SVM network identifiers (V1 format)
SVMNetworksV1 = Literal["solana", "solana-devnet", "solana-testnet"]

# All supported networks
SupportedNetworks = Union[EVMNetworks, TONNetworks, TRONNetworks, SVMNetworks]


def get_all_supported_networks() -> tuple[str, ...]:
    """Get all supported network identifiers as a flat tuple of strings."""
    evm = get_args(EVMNetworks)
    ton = get_args(TONNetworks)
    tron = get_args(TRONNetworks)
    svm = get_args(SVMNetworks)
    return evm + ton + tron + svm

EVM_NETWORK_TO_CHAIN_ID = {
    "base-sepolia": 84532,
    "base": 8453,
    "avalanche-fuji": 43113,
    "avalanche": 43114,
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
    return network in EVM_NETWORK_TO_CHAIN_ID


def is_svm_network(network: str) -> bool:
    """Check if a network is a Solana SVM network."""
    return network.startswith("solana:") or network in SVM_V1_TO_V2_MAP


def get_network_type(network: str) -> str:
    """Get the network type (ton, tron, evm, svm, or unknown)."""
    if is_ton_network(network):
        return "ton"
    if is_tron_network(network):
        return "tron"
    if is_svm_network(network):
        return "svm"
    if is_evm_network(network):
        return "evm"
    return "unknown"
