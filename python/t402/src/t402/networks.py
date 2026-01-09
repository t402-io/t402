from typing import Literal, Union, get_args


# EVM Networks
EVMNetworks = Literal["base", "base-sepolia", "avalanche-fuji", "avalanche"]

# TON Networks (CAIP-2 format)
TONNetworks = Literal["ton:mainnet", "ton:testnet"]

# TRON Networks (CAIP-2 format)
TRONNetworks = Literal["tron:mainnet", "tron:nile", "tron:shasta"]

# All supported networks
SupportedNetworks = Union[EVMNetworks, TONNetworks, TRONNetworks]


def get_all_supported_networks() -> tuple[str, ...]:
    """Get all supported network identifiers as a flat tuple of strings."""
    evm = get_args(EVMNetworks)
    ton = get_args(TONNetworks)
    tron = get_args(TRONNetworks)
    return evm + ton + tron

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


def is_ton_network(network: str) -> bool:
    """Check if a network is a TON network."""
    return network.startswith("ton:")


def is_tron_network(network: str) -> bool:
    """Check if a network is a TRON network."""
    return network.startswith("tron:")


def is_evm_network(network: str) -> bool:
    """Check if a network is an EVM network."""
    return network in EVM_NETWORK_TO_CHAIN_ID


def get_network_type(network: str) -> str:
    """Get the network type (ton, tron, evm, or unknown)."""
    if is_ton_network(network):
        return "ton"
    if is_tron_network(network):
        return "tron"
    if is_evm_network(network):
        return "evm"
    return "unknown"
