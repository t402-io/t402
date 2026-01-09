"""
TON blockchain support for t402 protocol.

This module provides types and utilities for TON (The Open Network) payments
using USDT Jetton transfers.
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

# CAIP-2 network identifiers
TON_MAINNET = "ton:mainnet"
TON_TESTNET = "ton:testnet"

# Jetton transfer operation codes (TEP-74)
JETTON_TRANSFER_OP = 0x0F8A7EA5
JETTON_INTERNAL_TRANSFER_OP = 0x178D4519
JETTON_TRANSFER_NOTIFICATION_OP = 0x7362D09C
JETTON_BURN_OP = 0x595F07BC

# Gas defaults (in nanoTON)
DEFAULT_JETTON_TRANSFER_TON = 100_000_000  # 0.1 TON
DEFAULT_FORWARD_TON = 1  # Minimal forward
MIN_JETTON_TRANSFER_TON = 50_000_000  # 0.05 TON minimum
MAX_JETTON_TRANSFER_TON = 500_000_000  # 0.5 TON maximum

# Validity and timing
DEFAULT_VALIDITY_DURATION = 3600  # 1 hour in seconds
MIN_VALIDITY_BUFFER = 30  # 30 seconds minimum validity

# USDT Jetton master addresses
USDT_MAINNET_ADDRESS = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs"
USDT_TESTNET_ADDRESS = "kQBqSpvo4S87mX9tTc4FX3Sfqf4uSp3Tx-Fz4RBUfTRWBx"

# Address regex patterns
TON_FRIENDLY_ADDRESS_REGEX = re.compile(r"^[A-Za-z0-9_-]{46,48}$")
TON_RAW_ADDRESS_REGEX = re.compile(r"^-?[0-9]:[a-fA-F0-9]{64}$")


class JettonConfig(TypedDict):
    """Configuration for a Jetton token."""
    master_address: str
    symbol: str
    name: str
    decimals: int


class NetworkConfig(TypedDict):
    """Configuration for a TON network."""
    name: str
    endpoint: str
    is_testnet: bool
    default_asset: JettonConfig
    supported_assets: Dict[str, JettonConfig]


# Network configurations
NETWORK_CONFIGS: Dict[str, NetworkConfig] = {
    TON_MAINNET: {
        "name": "TON Mainnet",
        "endpoint": "https://toncenter.com/api/v2/jsonRPC",
        "is_testnet": False,
        "default_asset": {
            "master_address": USDT_MAINNET_ADDRESS,
            "symbol": "USDT",
            "name": "Tether USD",
            "decimals": DEFAULT_DECIMALS,
        },
        "supported_assets": {
            "USDT": {
                "master_address": USDT_MAINNET_ADDRESS,
                "symbol": "USDT",
                "name": "Tether USD",
                "decimals": DEFAULT_DECIMALS,
            },
        },
    },
    TON_TESTNET: {
        "name": "TON Testnet",
        "endpoint": "https://testnet.toncenter.com/api/v2/jsonRPC",
        "is_testnet": True,
        "default_asset": {
            "master_address": USDT_TESTNET_ADDRESS,
            "symbol": "USDT",
            "name": "Tether USD (Testnet)",
            "decimals": DEFAULT_DECIMALS,
        },
        "supported_assets": {
            "USDT": {
                "master_address": USDT_TESTNET_ADDRESS,
                "symbol": "USDT",
                "name": "Tether USD (Testnet)",
                "decimals": DEFAULT_DECIMALS,
            },
        },
    },
}


class TonAuthorization(BaseModel):
    """TON transfer authorization metadata."""

    from_: str = Field(alias="from")
    to: str
    jetton_master: str = Field(alias="jettonMaster")
    jetton_amount: str = Field(alias="jettonAmount")
    ton_amount: str = Field(alias="tonAmount")
    valid_until: int = Field(alias="validUntil")
    seqno: int
    query_id: str = Field(alias="queryId")

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )

    @field_validator("jetton_amount", "ton_amount")
    def validate_amount(cls, v):
        try:
            int(v)
        except ValueError:
            raise ValueError("amount must be an integer encoded as a string")
        return v


class TonPaymentPayload(BaseModel):
    """TON payment payload containing signed BOC and authorization."""

    signed_boc: str = Field(alias="signedBoc")
    authorization: TonAuthorization

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class TonVerifyMessageResult(BaseModel):
    """Result of TON message verification."""

    valid: bool
    reason: Optional[str] = None
    transfer: Optional[Dict[str, Any]] = None


class TonTransactionConfirmation(BaseModel):
    """TON transaction confirmation result."""

    success: bool
    lt: Optional[str] = None
    hash: Optional[str] = None
    error: Optional[str] = None


def validate_ton_address(address: str) -> bool:
    """
    Validate a TON address.

    Supports both friendly format (base64url, 48 chars) and
    raw format (workchain:hash).

    Args:
        address: The address to validate

    Returns:
        True if valid, False otherwise
    """
    if not address:
        return False

    # Check friendly format (base64url, 46-48 chars)
    if TON_FRIENDLY_ADDRESS_REGEX.match(address):
        return True

    # Check raw format (workchain:hash)
    if TON_RAW_ADDRESS_REGEX.match(address):
        return True

    return False


def addresses_equal(addr1: str, addr2: str) -> bool:
    """
    Compare two TON addresses for equality.

    Args:
        addr1: First address
        addr2: Second address

    Returns:
        True if addresses are equal (case-insensitive)
    """
    return addr1.lower() == addr2.lower()


def is_valid_network(network: str) -> bool:
    """
    Check if a network is a supported TON network.

    Args:
        network: Network identifier

    Returns:
        True if supported
    """
    return network in NETWORK_CONFIGS


def get_network_config(network: str) -> Optional[NetworkConfig]:
    """
    Get configuration for a TON network.

    Args:
        network: Network identifier (e.g., "ton:mainnet")

    Returns:
        NetworkConfig or None if not found
    """
    return NETWORK_CONFIGS.get(network)


def get_default_asset(network: str) -> Optional[JettonConfig]:
    """
    Get the default asset (USDT) for a network.

    Args:
        network: Network identifier

    Returns:
        JettonConfig or None if network not found
    """
    config = get_network_config(network)
    if config:
        return config["default_asset"]
    return None


def get_asset_info(network: str, asset_symbol_or_address: str) -> Optional[JettonConfig]:
    """
    Get asset information by symbol or address.

    Args:
        network: Network identifier
        asset_symbol_or_address: Asset symbol (e.g., "USDT") or master address

    Returns:
        JettonConfig or None if not found
    """
    config = get_network_config(network)
    if not config:
        return None

    # Check if it's a valid address
    if validate_ton_address(asset_symbol_or_address):
        # Check default asset
        if addresses_equal(
            asset_symbol_or_address, config["default_asset"]["master_address"]
        ):
            return config["default_asset"]

        # Check supported assets by address
        for asset in config["supported_assets"].values():
            if addresses_equal(asset_symbol_or_address, asset["master_address"]):
                return asset

        # Unknown token
        return {
            "master_address": asset_symbol_or_address,
            "symbol": "UNKNOWN",
            "name": "Unknown Jetton",
            "decimals": 9,
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


def validate_boc(boc_base64: str) -> bool:
    """
    Validate that a string is a valid base64-encoded BOC.

    Args:
        boc_base64: Base64 encoded BOC string

    Returns:
        True if valid, False otherwise
    """
    if not boc_base64:
        return False

    try:
        base64.b64decode(boc_base64)
        return True
    except Exception:
        return False


def is_testnet(network: str) -> bool:
    """
    Check if a network is a testnet.

    Args:
        network: Network identifier

    Returns:
        True if testnet
    """
    return network == TON_TESTNET


def prepare_ton_payment_header(
    sender_address: str,
    t402_version: int,
    network: str,
    pay_to: str,
    asset: str,
    amount: str,
    max_timeout_seconds: int = DEFAULT_VALIDITY_DURATION,
) -> Dict[str, Any]:
    """
    Prepare an unsigned TON payment header.

    Args:
        sender_address: Sender's TON address
        t402_version: Protocol version
        network: Network identifier
        pay_to: Recipient address
        asset: Jetton master address
        amount: Amount in smallest units
        max_timeout_seconds: Maximum timeout in seconds

    Returns:
        Unsigned payment header dictionary
    """
    now = int(time.time())
    valid_until = now + max_timeout_seconds
    seqno = 0  # Will be filled by client
    query_id = str(now * 1000000)  # Unique query ID

    return {
        "t402Version": t402_version,
        "scheme": SCHEME_EXACT,
        "network": network,
        "payload": {
            "signedBoc": None,  # Will be filled after signing
            "authorization": {
                "from": sender_address,
                "to": pay_to,
                "jettonMaster": asset,
                "jettonAmount": amount,
                "tonAmount": str(DEFAULT_JETTON_TRANSFER_TON),
                "validUntil": valid_until,
                "seqno": seqno,
                "queryId": query_id,
            },
        },
    }


def get_usdt_address(network: str) -> str:
    """
    Get the USDT Jetton master address for a network.

    Args:
        network: Network identifier

    Returns:
        USDT master address

    Raises:
        ValueError: If network is not supported
    """
    if network == TON_MAINNET:
        return USDT_MAINNET_ADDRESS
    elif network == TON_TESTNET:
        return USDT_TESTNET_ADDRESS
    else:
        raise ValueError(f"Unsupported TON network: {network}")


def get_known_jettons(network: str) -> List[JettonConfig]:
    """
    Get list of known Jettons for a network.

    Args:
        network: Network identifier

    Returns:
        List of JettonConfig
    """
    config = get_network_config(network)
    if not config:
        return []
    return list(config["supported_assets"].values())
