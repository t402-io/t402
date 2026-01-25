"""Tezos Blockchain Constants for T402 Protocol.

This module defines constants, token information, and network configurations
for the Tezos blockchain mechanism in the T402 protocol.
"""

from __future__ import annotations

from typing import Any, Dict, Optional


# Scheme identifier
SCHEME_EXACT_DIRECT = "exact-direct"

# CAIP-2 network identifiers (derived from genesis block hash prefix)
TEZOS_MAINNET = "tezos:NetXdQprcVkpaWU"
TEZOS_GHOSTNET = "tezos:NetXnHfVqm9iesp"

# RPC endpoints
TEZOS_MAINNET_RPC = "https://mainnet.api.tez.ie"
TEZOS_GHOSTNET_RPC = "https://ghostnet.tezos.marigold.dev"

# Indexer API endpoints (TzKT)
TEZOS_MAINNET_INDEXER = "https://api.tzkt.io"
TEZOS_GHOSTNET_INDEXER = "https://api.ghostnet.tzkt.io"

# FA2 token standard (TZIP-12)
FA2_TRANSFER_ENTRYPOINT = "transfer"

# USDt on Tezos Mainnet
USDT_MAINNET_CONTRACT = "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o"
USDT_MAINNET_TOKEN_ID = 0
USDT_DECIMALS = 6

# Address length for Tezos addresses (tz1/tz2/tz3/KT1)
TEZOS_ADDRESS_LENGTH = 36

# Operation hash length (starts with 'o')
TEZOS_OP_HASH_LENGTH = 51

# Valid address prefixes
VALID_ADDRESS_PREFIXES = ("tz1", "tz2", "tz3", "KT1")

# Base58 character set (no 0, O, I, l)
BASE58_CHARS = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


class TokenInfo:
    """Information about a Tezos FA2 token.

    Attributes:
        contract_address: The FA2 contract address (KT1...)
        token_id: The token ID within the FA2 contract
        symbol: Token symbol (e.g., "USDt")
        name: Full token name (e.g., "Tether USD")
        decimals: Number of decimal places
    """

    def __init__(
        self,
        contract_address: str,
        token_id: int,
        symbol: str,
        name: str,
        decimals: int,
    ):
        self.contract_address = contract_address
        self.token_id = token_id
        self.symbol = symbol
        self.name = name
        self.decimals = decimals


class NetworkConfig:
    """Configuration for a Tezos network.

    Attributes:
        name: Human-readable network name
        rpc_url: Tezos RPC endpoint URL
        indexer_url: TzKT indexer API URL
        default_token: Default token for price conversion (may be None)
        is_testnet: Whether this is a testnet
    """

    def __init__(
        self,
        name: str,
        rpc_url: str,
        indexer_url: str,
        default_token: Optional[TokenInfo] = None,
        is_testnet: bool = False,
    ):
        self.name = name
        self.rpc_url = rpc_url
        self.indexer_url = indexer_url
        self.default_token = default_token
        self.is_testnet = is_testnet


# Token definitions
USDT_MAINNET = TokenInfo(
    contract_address=USDT_MAINNET_CONTRACT,
    token_id=USDT_MAINNET_TOKEN_ID,
    symbol="USDt",
    name="Tether USD",
    decimals=USDT_DECIMALS,
)

# Network configurations
NETWORK_CONFIGS: Dict[str, NetworkConfig] = {
    TEZOS_MAINNET: NetworkConfig(
        name="Tezos Mainnet",
        rpc_url=TEZOS_MAINNET_RPC,
        indexer_url=TEZOS_MAINNET_INDEXER,
        default_token=USDT_MAINNET,
        is_testnet=False,
    ),
    TEZOS_GHOSTNET: NetworkConfig(
        name="Tezos Ghostnet",
        rpc_url=TEZOS_GHOSTNET_RPC,
        indexer_url=TEZOS_GHOSTNET_INDEXER,
        default_token=None,  # No USDT on testnet
        is_testnet=True,
    ),
}

# Token registry indexed by network and symbol
TOKEN_REGISTRY: Dict[str, Dict[str, TokenInfo]] = {
    TEZOS_MAINNET: {
        "USDt": USDT_MAINNET,
    },
    TEZOS_GHOSTNET: {},
}


def get_network_config(network: str) -> Optional[NetworkConfig]:
    """Get the configuration for a Tezos network.

    Args:
        network: CAIP-2 network identifier (e.g., "tezos:NetXdQprcVkpaWU")

    Returns:
        NetworkConfig if found, None otherwise
    """
    return NETWORK_CONFIGS.get(network)


def get_token_info(network: str, symbol: str) -> Optional[TokenInfo]:
    """Get token information by network and symbol.

    Args:
        network: CAIP-2 network identifier
        symbol: Token symbol (e.g., "USDt")

    Returns:
        TokenInfo if found, None otherwise
    """
    tokens = TOKEN_REGISTRY.get(network, {})
    return tokens.get(symbol)


def get_token_by_contract(
    network: str, contract_address: str, token_id: int
) -> Optional[TokenInfo]:
    """Get token information by contract address and token ID.

    Args:
        network: CAIP-2 network identifier
        contract_address: FA2 contract address
        token_id: Token ID within the contract

    Returns:
        TokenInfo if found, None otherwise
    """
    tokens = TOKEN_REGISTRY.get(network, {})
    for token in tokens.values():
        if token.contract_address == contract_address and token.token_id == token_id:
            return token
    return None


def is_tezos_network(network: str) -> bool:
    """Check if a network identifier belongs to the Tezos namespace.

    Args:
        network: Network identifier string

    Returns:
        True if the network starts with "tezos:"
    """
    return network.startswith("tezos:")


def is_valid_address(address: str) -> bool:
    """Validate a Tezos address format.

    Valid addresses:
    - Implicit accounts: tz1, tz2, tz3 (36 characters)
    - Contract accounts: KT1 (36 characters)

    All characters must be valid Base58 characters.

    Args:
        address: The address to validate

    Returns:
        True if the address format is valid
    """
    if not address:
        return False
    if not address.startswith(VALID_ADDRESS_PREFIXES):
        return False
    if len(address) != TEZOS_ADDRESS_LENGTH:
        return False
    # Check all characters are valid base58
    for char in address:
        if char not in BASE58_CHARS:
            return False
    return True


def is_valid_operation_hash(op_hash: str) -> bool:
    """Validate a Tezos operation hash format.

    Operation hashes start with 'o' and are 51 characters of Base58.

    Args:
        op_hash: The operation hash to validate

    Returns:
        True if the operation hash format is valid
    """
    if not op_hash:
        return False
    if not op_hash.startswith("o"):
        return False
    if len(op_hash) != TEZOS_OP_HASH_LENGTH:
        return False
    # Check all characters are valid base58
    for char in op_hash:
        if char not in BASE58_CHARS:
            return False
    return True


def create_asset_identifier(network: str, contract_address: str, token_id: int) -> str:
    """Create a CAIP-19 asset identifier for a Tezos FA2 token.

    Format: tezos:{chainRef}/fa2:{contractAddress}/{tokenId}

    Args:
        network: CAIP-2 network identifier (e.g., "tezos:NetXdQprcVkpaWU")
        contract_address: FA2 contract address (e.g., "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o")
        token_id: Token ID within the FA2 contract

    Returns:
        CAIP-19 asset identifier string
    """
    return f"{network}/fa2:{contract_address}/{token_id}"


def parse_asset_identifier(asset: str) -> Dict[str, Any]:
    """Parse a CAIP-19 asset identifier for Tezos FA2 tokens.

    Supports two formats:
    - CAIP-19: tezos:{chainRef}/fa2:{contractAddress}/{tokenId}
    - Simple: {contractAddress}/{tokenId} or {contractAddress} (tokenId defaults to 0)

    Args:
        asset: The asset identifier string

    Returns:
        Dict with "contract_address" (str) and "token_id" (int)

    Raises:
        ValueError: If the asset format is unrecognized
    """
    if not asset:
        raise ValueError("Asset identifier is empty")

    # Try CAIP-19 format: tezos:{chainRef}/fa2:{contract}/{tokenId}
    if asset.startswith("tezos:"):
        parts = asset.split("/")
        if len(parts) == 3 and parts[1].startswith("fa2:"):
            contract_address = parts[1][4:]  # Remove "fa2:" prefix
            try:
                token_id = int(parts[2])
            except ValueError:
                raise ValueError(f"Invalid token ID in asset: {asset}")
            if not contract_address.startswith("KT1") or len(contract_address) != 36:
                raise ValueError(f"Invalid contract address in asset: {asset}")
            return {"contract_address": contract_address, "token_id": token_id}

    # Try simple format: KT1.../tokenId or KT1...
    if asset.startswith("KT1"):
        parts = asset.split("/")
        contract_address = parts[0]
        if len(contract_address) != 36:
            raise ValueError(f"Invalid contract address in asset: {asset}")
        token_id = 0
        if len(parts) == 2:
            try:
                token_id = int(parts[1])
            except ValueError:
                raise ValueError(f"Invalid token ID in asset: {asset}")
        elif len(parts) > 2:
            raise ValueError(f"Unrecognized asset format: {asset}")
        return {"contract_address": contract_address, "token_id": token_id}

    raise ValueError(
        f"Unrecognized asset format: {asset} "
        f"(expected tezos:{{chainRef}}/fa2:{{contract}}/{{tokenId}} or KT1...)"
    )


def decimal_to_atomic(amount: float, decimals: int) -> str:
    """Convert a decimal amount to atomic units string.

    Args:
        amount: Decimal amount (e.g., 1.50)
        decimals: Number of decimal places for the token

    Returns:
        Atomic amount as string (e.g., "1500000" for 6 decimals)
    """

    multiplier = 10**decimals
    atomic = int(round(amount * multiplier))
    return str(atomic)


def parse_decimal_to_atomic(amount: str, decimals: int) -> str:
    """Convert a decimal string amount to atomic units.

    Args:
        amount: Decimal string (e.g., "1.50")
        decimals: Number of decimal places for the token

    Returns:
        Atomic amount string (e.g., "1500000" for 6 decimals)

    Raises:
        ValueError: If the amount format is invalid
    """
    parts = amount.split(".")

    integer_part = parts[0]
    fractional_part = ""

    if len(parts) == 2:
        fractional_part = parts[1]
    elif len(parts) > 2:
        raise ValueError(f"Invalid amount format: {amount}")

    # Pad or truncate fractional part to match decimals
    if len(fractional_part) > decimals:
        fractional_part = fractional_part[:decimals]
    else:
        fractional_part = fractional_part + "0" * (decimals - len(fractional_part))

    # Combine and parse as integer
    combined = integer_part + fractional_part

    # Remove leading zeros but keep at least one digit
    combined = combined.lstrip("0") or "0"

    try:
        result = int(combined)
    except ValueError:
        raise ValueError(f"Failed to parse amount: {amount}")

    return str(result)
