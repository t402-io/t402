"""
TRON blockchain support for t402 protocol.

This module provides types and utilities for TRON payments
using TRC-20 USDT transfers.
"""

from __future__ import annotations

import re
import time
from typing import Any, Dict, Optional, List
from typing_extensions import TypedDict

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel


# Constants
SCHEME_EXACT = "exact"
DEFAULT_DECIMALS = 6

# CAIP-2 network identifiers
TRON_MAINNET = "tron:mainnet"
TRON_NILE = "tron:nile"
TRON_SHASTA = "tron:shasta"

# TRC20 function selectors
TRC20_TRANSFER_SELECTOR = "a9059cbb"
TRC20_APPROVE_SELECTOR = "095ea7b3"
TRC20_BALANCE_OF_SELECTOR = "70a08231"

# Gas defaults (in SUN, 1 TRX = 1,000,000 SUN)
DEFAULT_FEE_LIMIT = 100_000_000  # 100 TRX
MIN_FEE_LIMIT = 10_000_000  # 10 TRX
MAX_FEE_LIMIT = 1_000_000_000  # 1000 TRX
SUN_PER_TRX = 1_000_000

# Validity and timing
DEFAULT_VALIDITY_DURATION = 3600  # 1 hour in seconds
MIN_VALIDITY_BUFFER = 30  # 30 seconds minimum validity

# Address format
TRON_ADDRESS_PREFIX = "T"
TRON_ADDRESS_LENGTH = 34

# USDT TRC20 contract addresses
USDT_MAINNET_ADDRESS = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
USDT_NILE_ADDRESS = "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf"
USDT_SHASTA_ADDRESS = "TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs"

# TRON address regex (base58check, starts with T, 34 characters)
TRON_ADDRESS_REGEX = re.compile(r"^T[1-9A-HJ-NP-Za-km-z]{33}$")


class TRC20Config(TypedDict):
    """Configuration for a TRC20 token."""
    contract_address: str
    symbol: str
    name: str
    decimals: int


class NetworkConfig(TypedDict):
    """Configuration for a TRON network."""
    name: str
    endpoint: str
    is_testnet: bool
    default_asset: TRC20Config
    supported_assets: Dict[str, TRC20Config]


# Network configurations
NETWORK_CONFIGS: Dict[str, NetworkConfig] = {
    TRON_MAINNET: {
        "name": "TRON Mainnet",
        "endpoint": "https://api.trongrid.io",
        "is_testnet": False,
        "default_asset": {
            "contract_address": USDT_MAINNET_ADDRESS,
            "symbol": "USDT",
            "name": "Tether USD",
            "decimals": DEFAULT_DECIMALS,
        },
        "supported_assets": {
            "USDT": {
                "contract_address": USDT_MAINNET_ADDRESS,
                "symbol": "USDT",
                "name": "Tether USD",
                "decimals": DEFAULT_DECIMALS,
            },
        },
    },
    TRON_NILE: {
        "name": "TRON Nile Testnet",
        "endpoint": "https://api.nileex.io",
        "is_testnet": True,
        "default_asset": {
            "contract_address": USDT_NILE_ADDRESS,
            "symbol": "USDT",
            "name": "Tether USD (Nile)",
            "decimals": DEFAULT_DECIMALS,
        },
        "supported_assets": {
            "USDT": {
                "contract_address": USDT_NILE_ADDRESS,
                "symbol": "USDT",
                "name": "Tether USD (Nile)",
                "decimals": DEFAULT_DECIMALS,
            },
        },
    },
    TRON_SHASTA: {
        "name": "TRON Shasta Testnet",
        "endpoint": "https://api.shasta.trongrid.io",
        "is_testnet": True,
        "default_asset": {
            "contract_address": USDT_SHASTA_ADDRESS,
            "symbol": "USDT",
            "name": "Tether USD (Shasta)",
            "decimals": DEFAULT_DECIMALS,
        },
        "supported_assets": {
            "USDT": {
                "contract_address": USDT_SHASTA_ADDRESS,
                "symbol": "USDT",
                "name": "Tether USD (Shasta)",
                "decimals": DEFAULT_DECIMALS,
            },
        },
    },
}


class TronAuthorization(BaseModel):
    """TRON transfer authorization metadata."""

    from_: str = Field(alias="from")
    to: str
    contract_address: str = Field(alias="contractAddress")
    amount: str
    expiration: int
    ref_block_bytes: str = Field(alias="refBlockBytes")
    ref_block_hash: str = Field(alias="refBlockHash")
    timestamp: int

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


class TronPaymentPayload(BaseModel):
    """TRON payment payload containing signed transaction and authorization."""

    signed_transaction: str = Field(alias="signedTransaction")
    authorization: TronAuthorization

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class TronVerifyResult(BaseModel):
    """Result of TRON transaction verification."""

    valid: bool
    reason: Optional[str] = None
    transfer: Optional[Dict[str, Any]] = None


class TronTransactionConfirmation(BaseModel):
    """TRON transaction confirmation result."""

    success: bool
    tx_id: Optional[str] = Field(None, alias="txId")
    block_number: Optional[int] = Field(None, alias="blockNumber")
    error: Optional[str] = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


def validate_tron_address(address: str) -> bool:
    """
    Validate a TRON address.

    TRON addresses are:
    - Base58check encoded
    - 34 characters long
    - Start with 'T' (mainnet)

    Args:
        address: The address to validate

    Returns:
        True if valid, False otherwise
    """
    if not address:
        return False

    if len(address) != TRON_ADDRESS_LENGTH:
        return False

    if not address.startswith(TRON_ADDRESS_PREFIX):
        return False

    return bool(TRON_ADDRESS_REGEX.match(address))


def addresses_equal(addr1: str, addr2: str) -> bool:
    """
    Compare two TRON addresses for equality.

    TRON addresses are case-sensitive in base58check.

    Args:
        addr1: First address
        addr2: Second address

    Returns:
        True if addresses are equal
    """
    if not addr1 or not addr2:
        return False
    return addr1 == addr2


def is_valid_network(network: str) -> bool:
    """
    Check if a network is a supported TRON network.

    Args:
        network: Network identifier

    Returns:
        True if supported
    """
    return network in NETWORK_CONFIGS


def normalize_network(network: str) -> str:
    """
    Normalize a network identifier to CAIP-2 format.

    Args:
        network: Network identifier

    Returns:
        Normalized CAIP-2 network identifier

    Raises:
        ValueError: If network is not supported
    """
    # Already in correct format
    if network in NETWORK_CONFIGS:
        return network

    # Handle shorthand formats
    lower = network.lower()
    if lower in ("mainnet", "tron"):
        return TRON_MAINNET
    if lower in ("nile", "tron-nile"):
        return TRON_NILE
    if lower in ("shasta", "tron-shasta"):
        return TRON_SHASTA

    raise ValueError(f"Unsupported TRON network: {network}")


def get_network_config(network: str) -> Optional[NetworkConfig]:
    """
    Get configuration for a TRON network.

    Args:
        network: Network identifier (e.g., "tron:mainnet")

    Returns:
        NetworkConfig or None if not found
    """
    return NETWORK_CONFIGS.get(network)


def get_default_asset(network: str) -> Optional[TRC20Config]:
    """
    Get the default asset (USDT) for a network.

    Args:
        network: Network identifier

    Returns:
        TRC20Config or None if network not found
    """
    config = get_network_config(network)
    if config:
        return config["default_asset"]
    return None


def get_asset_info(network: str, asset_symbol_or_address: str) -> Optional[TRC20Config]:
    """
    Get asset information by symbol or address.

    Args:
        network: Network identifier
        asset_symbol_or_address: Asset symbol (e.g., "USDT") or contract address

    Returns:
        TRC20Config or None if not found
    """
    config = get_network_config(network)
    if not config:
        return None

    # Check if it's a valid address
    if validate_tron_address(asset_symbol_or_address):
        # Check default asset
        if addresses_equal(
            asset_symbol_or_address, config["default_asset"]["contract_address"]
        ):
            return config["default_asset"]

        # Check supported assets by address
        for asset in config["supported_assets"].values():
            if addresses_equal(asset_symbol_or_address, asset["contract_address"]):
                return asset

        # Unknown token
        return {
            "contract_address": asset_symbol_or_address,
            "symbol": "UNKNOWN",
            "name": "Unknown TRC20",
            "decimals": 6,
        }

    # Look up by symbol
    symbol = asset_symbol_or_address.upper()
    if symbol in config["supported_assets"]:
        return config["supported_assets"][symbol]

    # Default to network's default asset
    return config["default_asset"]


def parse_amount(amount: str, decimals: int) -> int:
    """
    Parse a decimal string amount to token smallest units.

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


def is_valid_hex(hex_string: str) -> bool:
    """
    Validate that a string is valid hexadecimal.

    Args:
        hex_string: String to validate

    Returns:
        True if valid hex, False otherwise
    """
    if not hex_string:
        return False

    # Remove 0x prefix if present
    clean_hex = hex_string[2:] if hex_string.startswith("0x") else hex_string
    if not clean_hex:
        return False

    try:
        int(clean_hex, 16)
        return True
    except ValueError:
        return False


def is_testnet(network: str) -> bool:
    """
    Check if a network is a testnet.

    Args:
        network: Network identifier

    Returns:
        True if testnet
    """
    return network in (TRON_NILE, TRON_SHASTA)


def prepare_tron_payment_header(
    sender_address: str,
    t402_version: int,
    network: str,
    pay_to: str,
    asset: str,
    amount: str,
    max_timeout_seconds: int = DEFAULT_VALIDITY_DURATION,
) -> Dict[str, Any]:
    """
    Prepare an unsigned TRON payment header.

    Args:
        sender_address: Sender's TRON address
        t402_version: Protocol version
        network: Network identifier
        pay_to: Recipient address
        asset: TRC20 contract address
        amount: Amount in smallest units
        max_timeout_seconds: Maximum timeout in seconds

    Returns:
        Unsigned payment header dictionary
    """
    now_ms = int(time.time() * 1000)
    expiration = now_ms + (max_timeout_seconds * 1000)

    return {
        "t402Version": t402_version,
        "scheme": SCHEME_EXACT,
        "network": network,
        "payload": {
            "signedTransaction": None,  # Will be filled after signing
            "authorization": {
                "from": sender_address,
                "to": pay_to,
                "contractAddress": asset,
                "amount": amount,
                "expiration": expiration,
                "refBlockBytes": "",  # Will be filled with block info
                "refBlockHash": "",  # Will be filled with block info
                "timestamp": now_ms,
            },
        },
    }


def get_usdt_address(network: str) -> str:
    """
    Get the USDT TRC20 contract address for a network.

    Args:
        network: Network identifier

    Returns:
        USDT contract address

    Raises:
        ValueError: If network is not supported
    """
    if network == TRON_MAINNET:
        return USDT_MAINNET_ADDRESS
    elif network == TRON_NILE:
        return USDT_NILE_ADDRESS
    elif network == TRON_SHASTA:
        return USDT_SHASTA_ADDRESS
    else:
        raise ValueError(f"Unsupported TRON network: {network}")


def get_known_tokens(network: str) -> List[TRC20Config]:
    """
    Get list of known TRC20 tokens for a network.

    Args:
        network: Network identifier

    Returns:
        List of TRC20Config
    """
    config = get_network_config(network)
    if not config:
        return []
    return list(config["supported_assets"].values())


def get_endpoint(network: str) -> str:
    """
    Get the API endpoint for a network.

    Args:
        network: Network identifier

    Returns:
        API endpoint URL

    Raises:
        ValueError: If network is not supported
    """
    config = get_network_config(network)
    if not config:
        raise ValueError(f"Unsupported TRON network: {network}")
    return config["endpoint"]


def estimate_transaction_fee(is_activated: bool = True) -> int:
    """
    Estimate the transaction fee in SUN.

    TRC20 transfer typically costs ~15-30 TRX in energy.
    New account activation adds ~1 TRX.

    Args:
        is_activated: Whether the recipient account is activated

    Returns:
        Estimated fee in SUN
    """
    base_fee = 30_000_000  # 30 TRX
    if not is_activated:
        base_fee += 1_000_000  # 1 TRX for activation
    return base_fee
