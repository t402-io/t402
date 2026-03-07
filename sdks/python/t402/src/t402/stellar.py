"""
Stellar blockchain support for t402 protocol.

This module provides types and utilities for Stellar payments
using Soroban smart contract token transfers (SEP-41).
"""

from __future__ import annotations

import re
import time
import base64
import math
from enum import Enum
from typing import Any, Dict, Optional, List
from typing_extensions import TypedDict

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel


# Constants
SCHEME_EXACT = "exact"
DEFAULT_DECIMALS = 7  # USDC on Stellar uses 7 decimals

# CAIP-2 network identifiers
STELLAR_PUBNET = "stellar:pubnet"
STELLAR_TESTNET = "stellar:testnet"

# Network passphrases (used for transaction signing)
PUBNET_PASSPHRASE = "Public Global Stellar Network ; September 2015"
TESTNET_PASSPHRASE = "Test SDF Network ; September 2015"

# Ledger timing: ~5 seconds per ledger
LEDGER_TIME_SECONDS = 5

# Default timeout
DEFAULT_TIMEOUT_SECONDS = 60

# Validity buffer
MIN_VALIDITY_BUFFER = 30  # 30 seconds minimum validity

# USDC contract addresses (C-accounts, Soroban contract)
USDC_PUBNET_ADDRESS = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI"
USDC_TESTNET_ADDRESS = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"

# Stellar address patterns (StrKey base32 encoding)
# G-accounts: Ed25519 public keys (56 chars, start with G)
STELLAR_G_ADDRESS_REGEX = re.compile(r"^G[A-Z2-7]{45,55}$")
# C-accounts: Contract addresses (start with C, 46-56 chars)
STELLAR_C_ADDRESS_REGEX = re.compile(r"^C[A-Z2-7]{45,55}$")


class TokenConfig(TypedDict):
    """Configuration for a Stellar token."""

    contract_address: str
    symbol: str
    name: str
    decimals: int


class NetworkConfig(TypedDict):
    """Configuration for a Stellar network."""

    name: str
    passphrase: str
    horizon_url: str
    is_testnet: bool
    default_asset: TokenConfig
    supported_assets: Dict[str, TokenConfig]


# Network configurations
NETWORK_CONFIGS: Dict[str, NetworkConfig] = {
    STELLAR_PUBNET: {
        "name": "Stellar Pubnet",
        "passphrase": PUBNET_PASSPHRASE,
        "horizon_url": "https://horizon.stellar.org",
        "is_testnet": False,
        "default_asset": {
            "contract_address": USDC_PUBNET_ADDRESS,
            "symbol": "USDC",
            "name": "USD Coin",
            "decimals": DEFAULT_DECIMALS,
        },
        "supported_assets": {
            "USDC": {
                "contract_address": USDC_PUBNET_ADDRESS,
                "symbol": "USDC",
                "name": "USD Coin",
                "decimals": DEFAULT_DECIMALS,
            },
        },
    },
    STELLAR_TESTNET: {
        "name": "Stellar Testnet",
        "passphrase": TESTNET_PASSPHRASE,
        "horizon_url": "https://horizon-testnet.stellar.org",
        "is_testnet": True,
        "default_asset": {
            "contract_address": USDC_TESTNET_ADDRESS,
            "symbol": "USDC",
            "name": "USD Coin (Testnet)",
            "decimals": DEFAULT_DECIMALS,
        },
        "supported_assets": {
            "USDC": {
                "contract_address": USDC_TESTNET_ADDRESS,
                "symbol": "USDC",
                "name": "USD Coin (Testnet)",
                "decimals": DEFAULT_DECIMALS,
            },
        },
    },
}


class StellarAuthorization(BaseModel):
    """Stellar transfer authorization metadata."""

    from_: str = Field(alias="from")
    to: str
    token_contract: str = Field(alias="tokenContract")
    amount: str
    max_ledger: int = Field(alias="maxLedger")
    network: str

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


class StellarPaymentPayload(BaseModel):
    """Stellar payment payload containing signed transaction and authorization."""

    signed_tx: str = Field(alias="signedTx")
    authorization: StellarAuthorization

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class StellarVerifyResult(BaseModel):
    """Result of Stellar transaction verification."""

    valid: bool
    reason: Optional[str] = None


class TransactionStatus(str, Enum):
    """Transaction lifecycle status for Stellar payments."""

    PENDING = "pending"
    CONFIRMED = "confirmed"
    FAILED = "failed"


class StellarTransactionConfirmation(BaseModel):
    """Stellar transaction confirmation result."""

    success: bool
    status: Optional[TransactionStatus] = None
    hash: Optional[str] = None
    ledger: Optional[int] = None
    error: Optional[str] = None


def validate_stellar_address(address: str) -> bool:
    """Validate a Stellar address (G-account or C-account).

    Args:
        address: The address to validate

    Returns:
        True if valid, False otherwise
    """
    if not address:
        return False

    # G-account (Ed25519 public key)
    if STELLAR_G_ADDRESS_REGEX.match(address):
        return True

    # C-account (contract address)
    if STELLAR_C_ADDRESS_REGEX.match(address):
        return True

    return False


def is_g_address(address: str) -> bool:
    """Check if an address is a G-account (Ed25519 public key)."""
    return bool(STELLAR_G_ADDRESS_REGEX.match(address)) if address else False


def is_c_address(address: str) -> bool:
    """Check if an address is a C-account (contract address)."""
    return bool(STELLAR_C_ADDRESS_REGEX.match(address)) if address else False


def addresses_equal(addr1: str, addr2: str) -> bool:
    """Compare two Stellar addresses for equality.

    Stellar addresses are case-sensitive (base32).

    Args:
        addr1: First address
        addr2: Second address

    Returns:
        True if addresses are equal
    """
    return addr1 == addr2


def is_valid_network(network: str) -> bool:
    """Check if a network is a supported Stellar network.

    Args:
        network: Network identifier

    Returns:
        True if supported
    """
    return network in NETWORK_CONFIGS


def get_network_config(network: str) -> Optional[NetworkConfig]:
    """Get configuration for a Stellar network.

    Args:
        network: Network identifier (e.g., "stellar:pubnet")

    Returns:
        NetworkConfig or None if not found
    """
    return NETWORK_CONFIGS.get(network)


def get_default_asset(network: str) -> Optional[TokenConfig]:
    """Get the default asset (USDC) for a network.

    Args:
        network: Network identifier

    Returns:
        TokenConfig or None if network not found
    """
    config = get_network_config(network)
    if config:
        return config["default_asset"]
    return None


def get_asset_info(
    network: str, asset_symbol_or_address: str
) -> Optional[TokenConfig]:
    """Get asset information by symbol or contract address.

    Args:
        network: Network identifier
        asset_symbol_or_address: Asset symbol (e.g., "USDC") or contract address

    Returns:
        TokenConfig or None if not found
    """
    config = get_network_config(network)
    if not config:
        return None

    # Check if it's a valid contract address
    if is_c_address(asset_symbol_or_address):
        if addresses_equal(
            asset_symbol_or_address, config["default_asset"]["contract_address"]
        ):
            return config["default_asset"]

        for asset in config["supported_assets"].values():
            if addresses_equal(asset_symbol_or_address, asset["contract_address"]):
                return asset

        return {
            "contract_address": asset_symbol_or_address,
            "symbol": "UNKNOWN",
            "name": "Unknown Token",
            "decimals": DEFAULT_DECIMALS,
        }

    # Look up by symbol
    symbol = asset_symbol_or_address.upper()
    if symbol in config["supported_assets"]:
        return config["supported_assets"][symbol]

    return config["default_asset"]


def get_usdc_address(network: str) -> str:
    """Get the USDC contract address for a network.

    Args:
        network: Network identifier

    Returns:
        USDC contract address

    Raises:
        ValueError: If network is not supported
    """
    if network == STELLAR_PUBNET:
        return USDC_PUBNET_ADDRESS
    elif network == STELLAR_TESTNET:
        return USDC_TESTNET_ADDRESS
    else:
        raise ValueError(f"Unsupported Stellar network: {network}")


def get_network_passphrase(network: str) -> str:
    """Get the network passphrase for transaction signing.

    Args:
        network: Network identifier

    Returns:
        Network passphrase string

    Raises:
        ValueError: If network is not supported
    """
    config = get_network_config(network)
    if not config:
        raise ValueError(f"Unsupported Stellar network: {network}")
    return config["passphrase"]


def calculate_max_ledger(
    current_ledger: int, timeout_seconds: int
) -> int:
    """Calculate the max ledger for transaction validity.

    Args:
        current_ledger: Current ledger sequence number
        timeout_seconds: Desired timeout in seconds

    Returns:
        Max ledger number for the transaction
    """
    ledgers = math.ceil(timeout_seconds / LEDGER_TIME_SECONDS)
    return current_ledger + ledgers


def is_testnet(network: str) -> bool:
    """Check if a network is a testnet.

    Args:
        network: Network identifier

    Returns:
        True if testnet
    """
    return network == STELLAR_TESTNET


def is_stellar_network(network: str) -> bool:
    """Check if a network identifier is for Stellar.

    Args:
        network: Network identifier

    Returns:
        True if network starts with 'stellar:'
    """
    return network.startswith("stellar:")
