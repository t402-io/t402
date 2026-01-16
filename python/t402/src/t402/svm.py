"""
Solana SVM blockchain support for t402 protocol.

This module provides types and utilities for Solana payments
using SPL token transfers.
"""

from __future__ import annotations

import re
import time
import base64
from typing import Any, Dict, Optional, List
from typing_extensions import TypedDict

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel


# Constants
SCHEME_EXACT = "exact"
DEFAULT_DECIMALS = 6

# CAIP-2 network identifiers (V2)
SOLANA_MAINNET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"
SOLANA_DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1"
SOLANA_TESTNET = "solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z"

# Legacy network identifiers (V1) for backwards compatibility
SOLANA_MAINNET_V1 = "solana"
SOLANA_DEVNET_V1 = "solana-devnet"
SOLANA_TESTNET_V1 = "solana-testnet"

# V1 to V2 network mapping
V1_TO_V2_NETWORK_MAP: Dict[str, str] = {
    SOLANA_MAINNET_V1: SOLANA_MAINNET,
    SOLANA_DEVNET_V1: SOLANA_DEVNET,
    SOLANA_TESTNET_V1: SOLANA_TESTNET,
}

# Token program addresses (same across all Solana networks)
TOKEN_PROGRAM_ADDRESS = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
TOKEN_2022_PROGRAM_ADDRESS = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
COMPUTE_BUDGET_PROGRAM_ADDRESS = "ComputeBudget111111111111111111111111111111"

# Default RPC URLs for Solana networks
MAINNET_RPC_URL = "https://api.mainnet-beta.solana.com"
DEVNET_RPC_URL = "https://api.devnet.solana.com"
TESTNET_RPC_URL = "https://api.testnet.solana.com"
MAINNET_WS_URL = "wss://api.mainnet-beta.solana.com"
DEVNET_WS_URL = "wss://api.devnet.solana.com"
TESTNET_WS_URL = "wss://api.testnet.solana.com"

# USDC token mint addresses
USDC_MAINNET_ADDRESS = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
USDC_DEVNET_ADDRESS = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
USDC_TESTNET_ADDRESS = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"  # Same as devnet

# Compute budget configuration (microlamports: 1 lamport = 1,000,000 microlamports)
DEFAULT_COMPUTE_UNIT_PRICE_MICROLAMPORTS = 1
MAX_COMPUTE_UNIT_PRICE_MICROLAMPORTS = 5_000_000  # 5 lamports
DEFAULT_COMPUTE_UNIT_LIMIT = 6500

# Validity and timing
DEFAULT_VALIDITY_DURATION = 3600  # 1 hour in seconds
MIN_VALIDITY_BUFFER = 30  # 30 seconds minimum validity

# Solana address validation regex (base58, 32-44 characters)
SVM_ADDRESS_REGEX = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")


class TokenConfig(TypedDict):
    """Configuration for an SPL token."""

    mint_address: str
    symbol: str
    name: str
    decimals: int


class NetworkConfig(TypedDict):
    """Configuration for a Solana network."""

    name: str
    rpc_url: str
    ws_url: str
    is_testnet: bool
    default_asset: TokenConfig
    supported_assets: Dict[str, TokenConfig]


# Network configurations
NETWORK_CONFIGS: Dict[str, NetworkConfig] = {
    SOLANA_MAINNET: {
        "name": "Solana Mainnet",
        "rpc_url": MAINNET_RPC_URL,
        "ws_url": MAINNET_WS_URL,
        "is_testnet": False,
        "default_asset": {
            "mint_address": USDC_MAINNET_ADDRESS,
            "symbol": "USDC",
            "name": "USD Coin",
            "decimals": DEFAULT_DECIMALS,
        },
        "supported_assets": {
            "USDC": {
                "mint_address": USDC_MAINNET_ADDRESS,
                "symbol": "USDC",
                "name": "USD Coin",
                "decimals": DEFAULT_DECIMALS,
            },
        },
    },
    SOLANA_DEVNET: {
        "name": "Solana Devnet",
        "rpc_url": DEVNET_RPC_URL,
        "ws_url": DEVNET_WS_URL,
        "is_testnet": True,
        "default_asset": {
            "mint_address": USDC_DEVNET_ADDRESS,
            "symbol": "USDC",
            "name": "USD Coin (Devnet)",
            "decimals": DEFAULT_DECIMALS,
        },
        "supported_assets": {
            "USDC": {
                "mint_address": USDC_DEVNET_ADDRESS,
                "symbol": "USDC",
                "name": "USD Coin (Devnet)",
                "decimals": DEFAULT_DECIMALS,
            },
        },
    },
    SOLANA_TESTNET: {
        "name": "Solana Testnet",
        "rpc_url": TESTNET_RPC_URL,
        "ws_url": TESTNET_WS_URL,
        "is_testnet": True,
        "default_asset": {
            "mint_address": USDC_TESTNET_ADDRESS,
            "symbol": "USDC",
            "name": "USD Coin (Testnet)",
            "decimals": DEFAULT_DECIMALS,
        },
        "supported_assets": {
            "USDC": {
                "mint_address": USDC_TESTNET_ADDRESS,
                "symbol": "USDC",
                "name": "USD Coin (Testnet)",
                "decimals": DEFAULT_DECIMALS,
            },
        },
    },
}


class SvmAuthorization(BaseModel):
    """Solana transfer authorization metadata."""

    from_: str = Field(alias="from")
    to: str
    mint: str
    amount: str
    valid_until: int = Field(alias="validUntil")
    fee_payer: Optional[str] = Field(default=None, alias="feePayer")

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )

    @field_validator("amount")
    def validate_amount(cls, v):
        try:
            int(v)
        except ValueError:
            raise ValueError("amount must be an integer encoded as a string")
        return v


class SvmPaymentPayload(BaseModel):
    """SVM payment payload containing base64 encoded transaction."""

    transaction: str
    authorization: Optional[SvmAuthorization] = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class SvmVerifyMessageResult(BaseModel):
    """Result of SVM transaction verification."""

    valid: bool
    reason: Optional[str] = None
    transfer: Optional[Dict[str, Any]] = None


class SvmTransactionConfirmation(BaseModel):
    """Solana transaction confirmation result."""

    success: bool
    signature: Optional[str] = None
    slot: Optional[int] = None
    error: Optional[str] = None


def validate_svm_address(address: str) -> bool:
    """
    Validate a Solana address.

    Solana addresses are base58 encoded, 32-44 characters.

    Args:
        address: The address to validate

    Returns:
        True if valid, False otherwise
    """
    if not address:
        return False

    return bool(SVM_ADDRESS_REGEX.match(address))


def addresses_equal(addr1: str, addr2: str) -> bool:
    """
    Compare two Solana addresses for equality.

    Solana addresses are case-sensitive (base58).

    Args:
        addr1: First address
        addr2: Second address

    Returns:
        True if addresses are equal
    """
    return addr1 == addr2


def is_valid_network(network: str) -> bool:
    """
    Check if a network is a supported Solana network.

    Args:
        network: Network identifier (CAIP-2 or legacy)

    Returns:
        True if supported
    """
    # Check CAIP-2 format
    if network in NETWORK_CONFIGS:
        return True
    # Check legacy V1 format
    if network in V1_TO_V2_NETWORK_MAP:
        return True
    return False


def is_svm_network(network: str) -> bool:
    """
    Check if a network is a Solana SVM network.

    Args:
        network: Network identifier

    Returns:
        True if it's a Solana network
    """
    return network.startswith("solana:") or network in V1_TO_V2_NETWORK_MAP


def normalize_network(network: str) -> str:
    """
    Normalize a network identifier to CAIP-2 format.

    Args:
        network: Network identifier (V1 or V2)

    Returns:
        CAIP-2 format network identifier
    """
    if network in V1_TO_V2_NETWORK_MAP:
        return V1_TO_V2_NETWORK_MAP[network]
    return network


def get_network_config(network: str) -> Optional[NetworkConfig]:
    """
    Get configuration for a Solana network.

    Args:
        network: Network identifier (e.g., "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")

    Returns:
        NetworkConfig or None if not found
    """
    normalized = normalize_network(network)
    return NETWORK_CONFIGS.get(normalized)


def get_default_asset(network: str) -> Optional[TokenConfig]:
    """
    Get the default asset (USDC) for a network.

    Args:
        network: Network identifier

    Returns:
        TokenConfig or None if network not found
    """
    config = get_network_config(network)
    if config:
        return config["default_asset"]
    return None


def get_asset_info(network: str, asset_symbol_or_address: str) -> Optional[TokenConfig]:
    """
    Get asset information by symbol or mint address.

    Args:
        network: Network identifier
        asset_symbol_or_address: Asset symbol (e.g., "USDC") or mint address

    Returns:
        TokenConfig or None if not found
    """
    config = get_network_config(network)
    if not config:
        return None

    # Check if it's a valid address
    if validate_svm_address(asset_symbol_or_address):
        # Check default asset
        if addresses_equal(
            asset_symbol_or_address, config["default_asset"]["mint_address"]
        ):
            return config["default_asset"]

        # Check supported assets by address
        for asset in config["supported_assets"].values():
            if addresses_equal(asset_symbol_or_address, asset["mint_address"]):
                return asset

        # Unknown token
        return {
            "mint_address": asset_symbol_or_address,
            "symbol": "UNKNOWN",
            "name": "Unknown Token",
            "decimals": 9,  # Default to 9 decimals for SOL-like tokens
        }

    # Look up by symbol
    symbol = asset_symbol_or_address.upper()
    if symbol in config["supported_assets"]:
        return config["supported_assets"][symbol]

    # Default to network's default asset
    return config["default_asset"]


def parse_amount(amount: str, decimals: int) -> int:
    """
    Parse a decimal string amount to token smallest units (lamports/etc).

    Args:
        amount: Decimal string (e.g., "1.50")
        decimals: Token decimals

    Returns:
        Amount in smallest units

    Raises:
        ValueError: If amount format is invalid
    """
    amount = amount.strip()
    parts = amount.split(".")

    if len(parts) > 2:
        raise ValueError(f"Invalid amount format: {amount}")

    int_part = int(parts[0])

    dec_part = 0
    if len(parts) == 2 and parts[1]:
        dec_str = parts[1]
        if len(dec_str) > decimals:
            dec_str = dec_str[:decimals]
        else:
            dec_str = dec_str + "0" * (decimals - len(dec_str))
        dec_part = int(dec_str)

    multiplier = 10**decimals
    return int_part * multiplier + dec_part


def format_amount(amount: int, decimals: int) -> str:
    """
    Format an amount in smallest units to a decimal string.

    Args:
        amount: Amount in smallest units
        decimals: Token decimals

    Returns:
        Decimal string representation
    """
    if amount == 0:
        return "0"

    divisor = 10**decimals
    quotient = amount // divisor
    remainder = amount % divisor

    if remainder == 0:
        return str(quotient)

    dec_str = str(remainder).zfill(decimals).rstrip("0")
    return f"{quotient}.{dec_str}"


def validate_transaction(tx_base64: str) -> bool:
    """
    Validate that a string is a valid base64-encoded Solana transaction.

    Args:
        tx_base64: Base64 encoded transaction string

    Returns:
        True if valid, False otherwise
    """
    if not tx_base64:
        return False

    try:
        decoded = base64.b64decode(tx_base64)
        # Solana transactions have minimum size
        return len(decoded) >= 100
    except Exception:
        return False


def is_testnet(network: str) -> bool:
    """
    Check if a network is a testnet/devnet.

    Args:
        network: Network identifier

    Returns:
        True if testnet/devnet
    """
    normalized = normalize_network(network)
    return normalized in (SOLANA_DEVNET, SOLANA_TESTNET)


def prepare_svm_payment_header(
    sender_address: str,
    t402_version: int,
    network: str,
    pay_to: str,
    asset: str,
    amount: str,
    fee_payer: Optional[str] = None,
    max_timeout_seconds: int = DEFAULT_VALIDITY_DURATION,
) -> Dict[str, Any]:
    """
    Prepare an unsigned SVM payment header.

    Args:
        sender_address: Sender's Solana address
        t402_version: Protocol version
        network: Network identifier
        pay_to: Recipient address
        asset: Token mint address
        amount: Amount in smallest units
        fee_payer: Optional fee payer address (provided by facilitator)
        max_timeout_seconds: Maximum timeout in seconds

    Returns:
        Unsigned payment header dictionary
    """
    now = int(time.time())
    valid_until = now + max_timeout_seconds

    normalized_network = normalize_network(network)

    return {
        "t402Version": t402_version,
        "scheme": SCHEME_EXACT,
        "network": normalized_network,
        "payload": {
            "transaction": None,  # Will be filled after signing
            "authorization": {
                "from": sender_address,
                "to": pay_to,
                "mint": asset,
                "amount": amount,
                "validUntil": valid_until,
                "feePayer": fee_payer,
            },
        },
    }


def get_usdc_address(network: str) -> str:
    """
    Get the USDC mint address for a network.

    Args:
        network: Network identifier

    Returns:
        USDC mint address

    Raises:
        ValueError: If network is not supported
    """
    normalized = normalize_network(network)
    if normalized == SOLANA_MAINNET:
        return USDC_MAINNET_ADDRESS
    elif normalized in (SOLANA_DEVNET, SOLANA_TESTNET):
        return USDC_DEVNET_ADDRESS
    else:
        raise ValueError(f"Unsupported Solana network: {network}")


def get_rpc_url(network: str) -> str:
    """
    Get the RPC URL for a Solana network.

    Args:
        network: Network identifier

    Returns:
        RPC URL

    Raises:
        ValueError: If network is not supported
    """
    config = get_network_config(network)
    if config:
        return config["rpc_url"]
    raise ValueError(f"Unsupported Solana network: {network}")


def get_known_tokens(network: str) -> List[TokenConfig]:
    """
    Get list of known tokens for a network.

    Args:
        network: Network identifier

    Returns:
        List of TokenConfig
    """
    config = get_network_config(network)
    if not config:
        return []
    return list(config["supported_assets"].values())
