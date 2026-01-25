"""Aptos Network Constants and Token Registry.

This module defines constants for Aptos blockchain networks, token metadata
addresses, and network configurations used by the exact-direct payment scheme.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

# Scheme identifier
SCHEME_EXACT_DIRECT = "exact-direct"

# CAIP-2 family pattern
CAIP_FAMILY = "aptos:*"

# CAIP-2 network identifiers
APTOS_MAINNET = "aptos:1"
APTOS_TESTNET = "aptos:2"
APTOS_DEVNET = "aptos:149"

# RPC endpoints
APTOS_MAINNET_RPC = "https://fullnode.mainnet.aptoslabs.com/v1"
APTOS_TESTNET_RPC = "https://fullnode.testnet.aptoslabs.com/v1"
APTOS_DEVNET_RPC = "https://fullnode.devnet.aptoslabs.com/v1"

# Fungible Asset transfer function
FA_TRANSFER_FUNCTION = "0x1::primary_fungible_store::transfer"

# Default decimals for USDT on Aptos
DEFAULT_DECIMALS = 6

# USDT Fungible Asset metadata address on Aptos mainnet
USDT_MAINNET_METADATA = (
    "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb"
)

# USDC metadata address on Aptos mainnet
USDC_MAINNET_METADATA = (
    "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b"
)


# Token information structure
class TokenInfo:
    """Contains information about an Aptos fungible asset.

    Attributes:
        metadata_address: The on-chain FA metadata object address.
        symbol: Token ticker symbol (e.g., "USDT").
        name: Human-readable token name (e.g., "Tether USD").
        decimals: Number of decimal places for the token.
    """

    def __init__(
        self,
        metadata_address: str,
        symbol: str,
        name: str,
        decimals: int,
    ) -> None:
        self.metadata_address = metadata_address
        self.symbol = symbol
        self.name = name
        self.decimals = decimals

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary representation."""
        return {
            "metadata_address": self.metadata_address,
            "symbol": self.symbol,
            "name": self.name,
            "decimals": self.decimals,
        }


# Token definitions
USDT_MAINNET = TokenInfo(
    metadata_address=USDT_MAINNET_METADATA,
    symbol="USDT",
    name="Tether USD",
    decimals=6,
)

USDC_MAINNET = TokenInfo(
    metadata_address=USDC_MAINNET_METADATA,
    symbol="USDC",
    name="USD Coin",
    decimals=6,
)


# Network configuration
class NetworkConfig:
    """Network-specific configuration for Aptos.

    Attributes:
        chain_id: Numeric chain ID.
        rpc_url: Default RPC endpoint URL.
        default_token: Default token for this network.
    """

    def __init__(
        self,
        chain_id: int,
        rpc_url: str,
        default_token: TokenInfo,
    ) -> None:
        self.chain_id = chain_id
        self.rpc_url = rpc_url
        self.default_token = default_token


# Network configurations registry
NETWORK_CONFIGS: Dict[str, NetworkConfig] = {
    APTOS_MAINNET: NetworkConfig(
        chain_id=1,
        rpc_url=APTOS_MAINNET_RPC,
        default_token=USDT_MAINNET,
    ),
    APTOS_TESTNET: NetworkConfig(
        chain_id=2,
        rpc_url=APTOS_TESTNET_RPC,
        default_token=USDT_MAINNET,
    ),
    APTOS_DEVNET: NetworkConfig(
        chain_id=149,
        rpc_url=APTOS_DEVNET_RPC,
        default_token=USDT_MAINNET,
    ),
}

# Token registry by network
TOKEN_REGISTRY: Dict[str, Dict[str, TokenInfo]] = {
    APTOS_MAINNET: {
        "USDT": USDT_MAINNET,
        "USDC": USDC_MAINNET,
    },
    APTOS_TESTNET: {
        "USDT": USDT_MAINNET,
    },
}


def get_network_config(network: str) -> Optional[NetworkConfig]:
    """Get the configuration for a given network.

    Args:
        network: CAIP-2 network identifier (e.g., "aptos:1").

    Returns:
        NetworkConfig if found, None otherwise.
    """
    return NETWORK_CONFIGS.get(network)


def get_token_info(network: str, symbol: str) -> Optional[TokenInfo]:
    """Get token info for a network and symbol.

    Args:
        network: CAIP-2 network identifier.
        symbol: Token symbol (e.g., "USDT").

    Returns:
        TokenInfo if found, None otherwise.
    """
    tokens = TOKEN_REGISTRY.get(network)
    if not tokens:
        return None
    return tokens.get(symbol)


def get_token_by_address(network: str, metadata_address: str) -> Optional[TokenInfo]:
    """Get token info by FA metadata address.

    Args:
        network: CAIP-2 network identifier.
        metadata_address: The on-chain metadata object address.

    Returns:
        TokenInfo if found, None otherwise.
    """
    tokens = TOKEN_REGISTRY.get(network)
    if not tokens:
        return None
    normalized = normalize_address(metadata_address)
    for token in tokens.values():
        if normalize_address(token.metadata_address) == normalized:
            return token
    return None


def is_valid_network(network: str) -> bool:
    """Check if a network identifier is supported.

    Args:
        network: CAIP-2 network identifier.

    Returns:
        True if the network is known and supported.
    """
    return network in NETWORK_CONFIGS


def is_valid_address(address: str) -> bool:
    """Validate an Aptos address format.

    Aptos addresses are 0x-prefixed hex strings, up to 64 hex characters.

    Args:
        address: The address to validate.

    Returns:
        True if the address is valid.
    """
    if not address:
        return False
    if not address.startswith("0x"):
        return False
    hex_part = address[2:]
    if len(hex_part) == 0 or len(hex_part) > 64:
        return False
    try:
        int(hex_part, 16)
        return True
    except ValueError:
        return False


def is_valid_tx_hash(tx_hash: str) -> bool:
    """Validate an Aptos transaction hash format.

    Transaction hashes are 0x-prefixed hex strings of exactly 64 hex characters.

    Args:
        tx_hash: The transaction hash to validate.

    Returns:
        True if the hash is valid.
    """
    if not tx_hash:
        return False
    if not tx_hash.startswith("0x"):
        return False
    hex_part = tx_hash[2:]
    if len(hex_part) != 64:
        return False
    try:
        int(hex_part, 16)
        return True
    except ValueError:
        return False


def normalize_address(address: str) -> str:
    """Normalize an Aptos address for comparison.

    Converts to lowercase and ensures 0x prefix.

    Args:
        address: The address to normalize.

    Returns:
        Normalized address string.
    """
    if not address:
        return ""
    if address.startswith("0x"):
        return "0x" + address[2:].lower()
    return "0x" + address.lower()


def compare_addresses(addr1: str, addr2: str) -> bool:
    """Compare two Aptos addresses (case-insensitive).

    Args:
        addr1: First address.
        addr2: Second address.

    Returns:
        True if addresses are equivalent.
    """
    if not addr1 or not addr2:
        return False
    return normalize_address(addr1) == normalize_address(addr2)


def parse_amount(amount: str, decimals: int) -> int:
    """Convert a decimal string amount to atomic units.

    Args:
        amount: Decimal amount string (e.g., "1.5").
        decimals: Number of decimal places for the token.

    Returns:
        Amount in smallest atomic units.

    Raises:
        ValueError: If the amount format is invalid.
    """
    amount = amount.strip()
    parts = amount.split(".")

    if len(parts) > 2:
        raise ValueError(f"Invalid amount format: {amount}")

    try:
        int_part = int(parts[0])
    except ValueError:
        raise ValueError(f"Invalid integer part: {parts[0]}")

    dec_part = 0
    if len(parts) == 2 and parts[1]:
        dec_str = parts[1]
        if len(dec_str) > decimals:
            dec_str = dec_str[:decimals]
        else:
            dec_str += "0" * (decimals - len(dec_str))
        try:
            dec_part = int(dec_str)
        except ValueError:
            raise ValueError(f"Invalid decimal part: {parts[1]}")

    multiplier = 10**decimals
    return int_part * multiplier + dec_part


def format_amount(atomic_amount: int, decimals: int) -> str:
    """Convert atomic units to a human-readable decimal string.

    Args:
        atomic_amount: Amount in smallest atomic units.
        decimals: Number of decimal places for the token.

    Returns:
        Formatted decimal string.
    """
    if atomic_amount == 0:
        return "0"

    multiplier = 10**decimals
    int_part = atomic_amount // multiplier
    dec_part = atomic_amount % multiplier

    if dec_part == 0:
        return str(int_part)

    dec_str = str(dec_part).zfill(decimals).rstrip("0")
    return f"{int_part}.{dec_str}"
