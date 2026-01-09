from typing import Literal, Union, get_args


# EVM Networks
EVMNetworks = Literal["base", "base-sepolia", "avalanche-fuji", "avalanche"]

# TON Networks (CAIP-2 format)
TONNetworks = Literal["ton:mainnet", "ton:testnet"]

# All supported networks
SupportedNetworks = Union[EVMNetworks, TONNetworks]


def get_all_supported_networks() -> tuple[str, ...]:
    """Get all supported network identifiers as a flat tuple of strings."""
    evm = get_args(EVMNetworks)
    ton = get_args(TONNetworks)
    return evm + ton

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


def is_ton_network(network: str) -> bool:
    """Check if a network is a TON network."""
    return network.startswith("ton:")


def is_evm_network(network: str) -> bool:
    """Check if a network is an EVM network."""
    return network in EVM_NETWORK_TO_CHAIN_ID


def get_network_type(network: str) -> str:
    """Get the network type (ton, evm, or unknown)."""
    if is_ton_network(network):
        return "ton"
    if is_evm_network(network):
        return "evm"
    return "unknown"
