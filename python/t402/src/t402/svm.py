"""
Solana SVM blockchain support for t402 protocol.

This module provides types and utilities for Solana payments
using SPL token transfers.

Features:
- Client scheme for creating payment payloads
- Server scheme for parsing prices and requirements
- Facilitator scheme for verifying and settling payments
- Signer interfaces for key management
- Transaction utilities for validation and parsing
"""

from __future__ import annotations

import re
import time
import base64
from typing import Any, Dict, Optional, List, Callable, Awaitable, Protocol, runtime_checkable
from typing_extensions import TypedDict

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

# Optional solana imports - only required for actual blockchain operations
try:
    from solders.keypair import Keypair
    from solders.pubkey import Pubkey
    from solders.transaction import VersionedTransaction
    from solders.message import MessageV0
    from solders.signature import Signature
    from solders.instruction import CompiledInstruction
    from solana.rpc.async_api import AsyncClient
    from solana.rpc.commitment import Commitment, Confirmed
    SOLANA_AVAILABLE = True
except ImportError:
    SOLANA_AVAILABLE = False
    Keypair = None
    Pubkey = None
    VersionedTransaction = None
    MessageV0 = None
    Signature = None
    CompiledInstruction = None
    AsyncClient = None
    Commitment = None
    Confirmed = None


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


# =============================================================================
# Transaction Utilities
# =============================================================================


def decode_transaction(tx_base64: str) -> bytes:
    """
    Decode a base64 encoded transaction.

    Args:
        tx_base64: Base64 encoded transaction string

    Returns:
        Transaction bytes

    Raises:
        ValueError: If transaction cannot be decoded
    """
    try:
        return base64.b64decode(tx_base64)
    except Exception as e:
        raise ValueError(f"Failed to decode transaction: {e}")


def decode_versioned_transaction(tx_base64: str) -> "VersionedTransaction":
    """
    Decode a base64 encoded Solana versioned transaction.

    Requires solana/solders packages to be installed.

    Args:
        tx_base64: Base64 encoded transaction string

    Returns:
        VersionedTransaction object

    Raises:
        ImportError: If solana packages not installed
        ValueError: If transaction cannot be decoded
    """
    if not SOLANA_AVAILABLE:
        raise ImportError(
            "solana and solders packages required for transaction decoding. "
            "Install with: pip install t402[svm]"
        )

    try:
        tx_bytes = decode_transaction(tx_base64)
        return VersionedTransaction.from_bytes(tx_bytes)
    except Exception as e:
        raise ValueError(f"Failed to decode versioned transaction: {e}")


def encode_transaction(tx: "VersionedTransaction") -> str:
    """
    Encode a versioned transaction to base64.

    Args:
        tx: VersionedTransaction object

    Returns:
        Base64 encoded transaction string
    """
    return base64.b64encode(bytes(tx)).decode("utf-8")


def get_transaction_fee_payer(tx_base64: str) -> Optional[str]:
    """
    Extract the fee payer address from a transaction.

    Args:
        tx_base64: Base64 encoded transaction string

    Returns:
        Fee payer address or None if cannot be extracted
    """
    if not SOLANA_AVAILABLE:
        return None

    try:
        tx = decode_versioned_transaction(tx_base64)
        message = tx.message
        if hasattr(message, "account_keys") and len(message.account_keys) > 0:
            return str(message.account_keys[0])
        return None
    except Exception:
        return None


def get_token_payer_from_transaction(tx_base64: str) -> Optional[str]:
    """
    Extract the token transfer authority (payer) from a transaction.

    This looks for the authority account in TransferChecked instructions.

    Args:
        tx_base64: Base64 encoded transaction string

    Returns:
        Token payer address or None if cannot be extracted
    """
    if not SOLANA_AVAILABLE:
        return None

    try:
        tx = decode_versioned_transaction(tx_base64)
        message = tx.message
        account_keys = list(message.account_keys) if hasattr(message, "account_keys") else []

        # Look for token program instructions
        for ix in message.instructions:
            program_idx = ix.program_id_index
            if program_idx >= len(account_keys):
                continue

            program_id = str(account_keys[program_idx])

            # Check if it's a token program
            if program_id in (TOKEN_PROGRAM_ADDRESS, TOKEN_2022_PROGRAM_ADDRESS):
                # TransferChecked has authority at index 2
                accounts = list(ix.accounts)
                if len(accounts) >= 3:
                    authority_idx = accounts[2]
                    if authority_idx < len(account_keys):
                        return str(account_keys[authority_idx])

        return None
    except Exception:
        return None


class TransferDetails(TypedDict):
    """Details of a token transfer instruction."""
    source: str
    mint: str
    destination: str
    authority: str
    amount: int
    decimals: int


def parse_transfer_checked_instruction(
    tx_base64: str,
) -> Optional[TransferDetails]:
    """
    Parse a TransferChecked instruction from a transaction.

    Args:
        tx_base64: Base64 encoded transaction string

    Returns:
        TransferDetails or None if no transfer found
    """
    if not SOLANA_AVAILABLE:
        return None

    try:
        tx = decode_versioned_transaction(tx_base64)
        message = tx.message
        account_keys = list(message.account_keys) if hasattr(message, "account_keys") else []

        for ix in message.instructions:
            program_idx = ix.program_id_index
            if program_idx >= len(account_keys):
                continue

            program_id = str(account_keys[program_idx])

            # Check if it's a token program
            if program_id not in (TOKEN_PROGRAM_ADDRESS, TOKEN_2022_PROGRAM_ADDRESS):
                continue

            # Check instruction discriminator for TransferChecked (12)
            if not ix.data or ix.data[0] != 12:
                continue

            accounts = list(ix.accounts)
            if len(accounts) < 4:
                continue

            # Parse TransferChecked data: [discriminator(1), amount(8), decimals(1)]
            if len(ix.data) < 10:
                continue

            amount = int.from_bytes(ix.data[1:9], "little")
            decimals = ix.data[9]

            source_idx = accounts[0]
            mint_idx = accounts[1]
            dest_idx = accounts[2]
            authority_idx = accounts[3]

            return {
                "source": str(account_keys[source_idx]) if source_idx < len(account_keys) else "",
                "mint": str(account_keys[mint_idx]) if mint_idx < len(account_keys) else "",
                "destination": str(account_keys[dest_idx]) if dest_idx < len(account_keys) else "",
                "authority": str(account_keys[authority_idx]) if authority_idx < len(account_keys) else "",
                "amount": amount,
                "decimals": decimals,
            }

        return None
    except Exception:
        return None


# =============================================================================
# Signer Interfaces
# =============================================================================


@runtime_checkable
class ClientSvmSigner(Protocol):
    """
    Interface for client-side SVM signing operations.

    Implementations should provide methods to:
    - Get the signer's public address
    - Sign transactions
    - Optionally get token balances
    """

    def get_address(self) -> str:
        """Get the signer's Solana address."""
        ...

    async def sign_transaction(
        self,
        tx_base64: str,
        network: str,
    ) -> str:
        """
        Sign a transaction.

        Args:
            tx_base64: Base64 encoded unsigned transaction
            network: Network identifier

        Returns:
            Base64 encoded signed transaction
        """
        ...


@runtime_checkable
class FacilitatorSvmSigner(Protocol):
    """
    Interface for facilitator-side SVM operations.

    Extends client signer with RPC capabilities for:
    - Signing transactions (as fee payer)
    - Simulating transactions
    - Sending and confirming transactions
    """

    def get_addresses(self) -> List[str]:
        """Get all available fee payer addresses."""
        ...

    async def sign_transaction(
        self,
        tx_base64: str,
        fee_payer: str,
        network: str,
    ) -> str:
        """
        Sign a transaction as fee payer.

        Args:
            tx_base64: Base64 encoded transaction
            fee_payer: Fee payer address to use
            network: Network identifier

        Returns:
            Base64 encoded fully signed transaction
        """
        ...

    async def simulate_transaction(
        self,
        tx_base64: str,
        network: str,
    ) -> bool:
        """
        Simulate a transaction to verify it will succeed.

        Args:
            tx_base64: Base64 encoded signed transaction
            network: Network identifier

        Returns:
            True if simulation succeeds

        Raises:
            Exception: If simulation fails
        """
        ...

    async def send_transaction(
        self,
        tx_base64: str,
        network: str,
    ) -> str:
        """
        Send a signed transaction to the network.

        Args:
            tx_base64: Base64 encoded signed transaction
            network: Network identifier

        Returns:
            Transaction signature
        """
        ...

    async def confirm_transaction(
        self,
        signature: str,
        network: str,
    ) -> bool:
        """
        Wait for transaction confirmation.

        Args:
            signature: Transaction signature
            network: Network identifier

        Returns:
            True if confirmed
        """
        ...


class KeypairSvmSigner:
    """
    Simple SVM signer using a Keypair.

    Suitable for client-side signing operations.
    """

    def __init__(self, keypair: "Keypair"):
        """
        Initialize with a Keypair.

        Args:
            keypair: Solders Keypair object
        """
        if not SOLANA_AVAILABLE:
            raise ImportError(
                "solana and solders packages required. "
                "Install with: pip install t402[svm]"
            )
        self._keypair = keypair

    @classmethod
    def from_secret_key(cls, secret_key: bytes) -> "KeypairSvmSigner":
        """Create signer from a 64-byte secret key."""
        if not SOLANA_AVAILABLE:
            raise ImportError(
                "solana and solders packages required. "
                "Install with: pip install t402[svm]"
            )
        return cls(Keypair.from_bytes(secret_key))

    @classmethod
    def from_base58(cls, base58_key: str) -> "KeypairSvmSigner":
        """Create signer from a base58 encoded secret key."""
        if not SOLANA_AVAILABLE:
            raise ImportError(
                "solana and solders packages required. "
                "Install with: pip install t402[svm]"
            )
        return cls(Keypair.from_base58_string(base58_key))

    def get_address(self) -> str:
        """Get the signer's public address."""
        return str(self._keypair.pubkey())

    async def sign_transaction(
        self,
        tx_base64: str,
        network: str,
    ) -> str:
        """Sign a transaction."""
        tx = decode_versioned_transaction(tx_base64)

        # Sign the transaction
        tx.sign([self._keypair])

        return encode_transaction(tx)


class RpcSvmSigner:
    """
    Facilitator SVM signer with RPC capabilities.

    Manages multiple keypairs and provides RPC operations
    for transaction simulation, sending, and confirmation.
    """

    def __init__(
        self,
        keypairs: List["Keypair"],
        rpc_urls: Optional[Dict[str, str]] = None,
    ):
        """
        Initialize with keypairs and optional custom RPC URLs.

        Args:
            keypairs: List of Keypair objects for signing
            rpc_urls: Optional map of network -> RPC URL overrides
        """
        if not SOLANA_AVAILABLE:
            raise ImportError(
                "solana and solders packages required. "
                "Install with: pip install t402[svm]"
            )

        self._keypairs = {str(kp.pubkey()): kp for kp in keypairs}
        self._rpc_urls = rpc_urls or {}

    def get_addresses(self) -> List[str]:
        """Get all available fee payer addresses."""
        return list(self._keypairs.keys())

    def _get_rpc_url(self, network: str) -> str:
        """Get RPC URL for a network."""
        if network in self._rpc_urls:
            return self._rpc_urls[network]
        return get_rpc_url(network)

    async def sign_transaction(
        self,
        tx_base64: str,
        fee_payer: str,
        network: str,
    ) -> str:
        """Sign a transaction as fee payer."""
        if fee_payer not in self._keypairs:
            raise ValueError(f"Fee payer {fee_payer} not found in managed keypairs")

        tx = decode_versioned_transaction(tx_base64)
        keypair = self._keypairs[fee_payer]

        # Sign the transaction
        tx.sign([keypair])

        return encode_transaction(tx)

    async def simulate_transaction(
        self,
        tx_base64: str,
        network: str,
    ) -> bool:
        """Simulate a transaction."""
        rpc_url = self._get_rpc_url(network)

        async with AsyncClient(rpc_url) as client:
            tx = decode_versioned_transaction(tx_base64)
            result = await client.simulate_transaction(tx)

            if result.value.err:
                raise Exception(f"Simulation failed: {result.value.err}")

            return True

    async def send_transaction(
        self,
        tx_base64: str,
        network: str,
    ) -> str:
        """Send a signed transaction."""
        rpc_url = self._get_rpc_url(network)

        async with AsyncClient(rpc_url) as client:
            tx = decode_versioned_transaction(tx_base64)
            result = await client.send_transaction(tx)
            return str(result.value)

    async def confirm_transaction(
        self,
        signature: str,
        network: str,
        timeout_seconds: int = 30,
    ) -> bool:
        """Wait for transaction confirmation."""
        rpc_url = self._get_rpc_url(network)

        async with AsyncClient(rpc_url) as client:
            sig = Signature.from_string(signature)
            # Wait for confirmation with timeout
            result = await client.confirm_transaction(
                sig,
                commitment=Confirmed,
            )
            return result.value[0].confirmation_status is not None


# =============================================================================
# Scheme Implementations
# =============================================================================


class ExactSvmPayloadV2(TypedDict):
    """Exact SVM payment payload (V2 format)."""
    transaction: str
    authorization: Optional[Dict[str, Any]]


class SvmPaymentRequirementsExtra(TypedDict, total=False):
    """Extra fields for SVM payment requirements."""
    feePayer: str


class ExactSvmClientScheme:
    """
    Client scheme for creating SVM payment payloads.

    Handles creation of SPL token transfer transactions
    for the exact payment scheme.
    """

    scheme = SCHEME_EXACT
    caip_family = "solana:*"

    def __init__(self, signer: ClientSvmSigner):
        """
        Initialize with a client signer.

        Args:
            signer: ClientSvmSigner implementation
        """
        self._signer = signer

    async def create_payment_payload(
        self,
        requirements: Dict[str, Any],
        build_transaction: Callable[[], Awaitable[str]],
    ) -> Dict[str, Any]:
        """
        Create a payment payload for the given requirements.

        Args:
            requirements: Payment requirements dict
            build_transaction: Async function that builds and returns
                a base64 encoded unsigned transaction

        Returns:
            Payment payload dict ready for header encoding
        """
        # Build the transaction
        unsigned_tx = await build_transaction()

        # Sign the transaction
        signed_tx = await self._signer.sign_transaction(
            unsigned_tx,
            requirements.get("network", SOLANA_MAINNET),
        )

        # Extract transfer details for authorization
        transfer = parse_transfer_checked_instruction(signed_tx)

        now = int(time.time())
        valid_until = now + requirements.get("maxTimeoutSeconds", DEFAULT_VALIDITY_DURATION)

        authorization = None
        if transfer:
            authorization = {
                "from": self._signer.get_address(),
                "to": requirements.get("payTo", ""),
                "mint": transfer["mint"],
                "amount": str(transfer["amount"]),
                "validUntil": valid_until,
                "feePayer": requirements.get("extra", {}).get("feePayer"),
            }

        return {
            "t402Version": requirements.get("t402Version", 1),
            "scheme": SCHEME_EXACT,
            "network": requirements.get("network", SOLANA_MAINNET),
            "payload": {
                "transaction": signed_tx,
                "authorization": authorization,
            },
        }


class ExactSvmServerScheme:
    """
    Server scheme for SVM payment processing.

    Handles parsing prices and enhancing payment requirements
    with SVM-specific details.
    """

    scheme = SCHEME_EXACT
    caip_family = "solana:*"

    def parse_price(
        self,
        price: str,
        network: str,
    ) -> Dict[str, Any]:
        """
        Parse a price string into amount and asset info.

        Args:
            price: Price string (e.g., "1.50" or "1500000")
            network: Network identifier

        Returns:
            Dict with amount (in atomic units) and asset info
        """
        default_asset = get_default_asset(network)
        if not default_asset:
            raise ValueError(f"Unsupported network: {network}")

        decimals = default_asset["decimals"]

        # Check if price is already in atomic units (no decimal)
        if "." in price:
            amount = parse_amount(price, decimals)
        else:
            amount = int(price)

        return {
            "amount": str(amount),
            "asset": default_asset["mint_address"],
            "decimals": decimals,
            "symbol": default_asset["symbol"],
        }

    def enhance_payment_requirements(
        self,
        requirements: Dict[str, Any],
        fee_payer: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Enhance payment requirements with SVM-specific details.

        Args:
            requirements: Base payment requirements
            fee_payer: Optional fee payer address from facilitator

        Returns:
            Enhanced requirements dict
        """
        enhanced = dict(requirements)

        # Normalize network to CAIP-2 format
        network = enhanced.get("network", SOLANA_MAINNET)
        enhanced["network"] = normalize_network(network)

        # Add fee payer if provided
        if fee_payer:
            extra = enhanced.get("extra", {})
            extra["feePayer"] = fee_payer
            enhanced["extra"] = extra

        return enhanced


class ExactSvmFacilitatorScheme:
    """
    Facilitator scheme for SVM payment verification and settlement.

    Handles transaction validation, simulation, and settlement
    for the exact payment scheme.
    """

    scheme = SCHEME_EXACT
    caip_family = "solana:*"

    def __init__(self, signer: FacilitatorSvmSigner):
        """
        Initialize with a facilitator signer.

        Args:
            signer: FacilitatorSvmSigner implementation
        """
        self._signer = signer

    def get_extra(self, network: str) -> Optional[Dict[str, Any]]:
        """
        Get mechanism-specific extra data for supported kinds.

        Returns a randomly selected fee payer address to distribute load.

        Args:
            network: Network identifier (unused for SVM)

        Returns:
            Dict with feePayer address
        """
        import random

        addresses = self._signer.get_addresses()
        if not addresses:
            return None

        return {
            "feePayer": random.choice(addresses),
        }

    def get_signers(self, network: str) -> List[str]:
        """
        Get all signer addresses for this facilitator.

        Args:
            network: Network identifier (unused for SVM)

        Returns:
            List of fee payer addresses
        """
        return self._signer.get_addresses()

    async def verify(
        self,
        payload: Dict[str, Any],
        requirements: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Verify a payment payload.

        Args:
            payload: Payment payload dict
            requirements: Payment requirements dict

        Returns:
            Verification result dict with isValid, invalidReason, payer
        """
        svm_payload = payload.get("payload", {})
        tx_base64 = svm_payload.get("transaction")

        # Validate payload structure
        if not tx_base64:
            return {
                "isValid": False,
                "invalidReason": "invalid_payload_structure",
                "payer": "",
            }

        # Validate scheme
        if payload.get("scheme") != SCHEME_EXACT or requirements.get("scheme") != SCHEME_EXACT:
            return {
                "isValid": False,
                "invalidReason": "unsupported_scheme",
                "payer": "",
            }

        # Validate network
        accepted_network = payload.get("network", "")
        required_network = requirements.get("network", "")
        if normalize_network(accepted_network) != normalize_network(required_network):
            return {
                "isValid": False,
                "invalidReason": "network_mismatch",
                "payer": "",
            }

        # Validate fee payer
        extra = requirements.get("extra", {})
        fee_payer = extra.get("feePayer")
        if not fee_payer:
            return {
                "isValid": False,
                "invalidReason": "invalid_exact_svm_payload_missing_fee_payer",
                "payer": "",
            }

        # Verify fee payer is managed by this facilitator
        signer_addresses = self._signer.get_addresses()
        if fee_payer not in signer_addresses:
            return {
                "isValid": False,
                "invalidReason": "fee_payer_not_managed_by_facilitator",
                "payer": "",
            }

        # Get token payer from transaction
        payer = get_token_payer_from_transaction(tx_base64)
        if not payer:
            return {
                "isValid": False,
                "invalidReason": "invalid_exact_svm_payload_no_transfer_instruction",
                "payer": "",
            }

        # Parse and validate transfer instruction
        transfer = parse_transfer_checked_instruction(tx_base64)
        if not transfer:
            return {
                "isValid": False,
                "invalidReason": "invalid_exact_svm_payload_no_transfer_instruction",
                "payer": payer,
            }

        # Security: Verify facilitator's signers are not transferring their own funds
        if transfer["authority"] in signer_addresses:
            return {
                "isValid": False,
                "invalidReason": "invalid_exact_svm_payload_transaction_fee_payer_transferring_funds",
                "payer": payer,
            }

        # Verify mint matches requirements
        if transfer["mint"] != requirements.get("asset"):
            return {
                "isValid": False,
                "invalidReason": "invalid_exact_svm_payload_mint_mismatch",
                "payer": payer,
            }

        # Verify amount meets requirements
        required_amount = int(requirements.get("maxAmountRequired", "0"))
        if transfer["amount"] < required_amount:
            return {
                "isValid": False,
                "invalidReason": "invalid_exact_svm_payload_amount_insufficient",
                "payer": payer,
            }

        # Sign and simulate transaction
        try:
            signed_tx = await self._signer.sign_transaction(
                tx_base64,
                fee_payer,
                required_network,
            )
            await self._signer.simulate_transaction(signed_tx, required_network)
        except Exception as e:
            return {
                "isValid": False,
                "invalidReason": f"transaction_simulation_failed: {str(e)}",
                "payer": payer,
            }

        return {
            "isValid": True,
            "invalidReason": None,
            "payer": payer,
        }

    async def settle(
        self,
        payload: Dict[str, Any],
        requirements: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Settle a payment by submitting the transaction.

        Args:
            payload: Payment payload dict
            requirements: Payment requirements dict

        Returns:
            Settlement result dict
        """
        network = payload.get("network", "")
        svm_payload = payload.get("payload", {})
        tx_base64 = svm_payload.get("transaction")

        if not tx_base64:
            return {
                "success": False,
                "network": network,
                "transaction": "",
                "errorReason": "invalid_payload_structure",
                "payer": "",
            }

        # Verify first
        verify_result = await self.verify(payload, requirements)
        if not verify_result.get("isValid"):
            return {
                "success": False,
                "network": network,
                "transaction": "",
                "errorReason": verify_result.get("invalidReason", "verification_failed"),
                "payer": verify_result.get("payer", ""),
            }

        try:
            fee_payer = requirements.get("extra", {}).get("feePayer")
            required_network = requirements.get("network", network)

            # Sign transaction
            signed_tx = await self._signer.sign_transaction(
                tx_base64,
                fee_payer,
                required_network,
            )

            # Send transaction
            signature = await self._signer.send_transaction(signed_tx, required_network)

            # Wait for confirmation
            await self._signer.confirm_transaction(signature, required_network)

            return {
                "success": True,
                "transaction": signature,
                "network": network,
                "payer": verify_result.get("payer", ""),
            }
        except Exception as e:
            return {
                "success": False,
                "errorReason": f"transaction_failed: {str(e)}",
                "transaction": "",
                "network": network,
                "payer": verify_result.get("payer", ""),
            }


# =============================================================================
# Helper Functions
# =============================================================================


def create_client_scheme(signer: ClientSvmSigner) -> ExactSvmClientScheme:
    """
    Create a client scheme for SVM payments.

    Args:
        signer: ClientSvmSigner implementation

    Returns:
        ExactSvmClientScheme instance
    """
    return ExactSvmClientScheme(signer)


def create_server_scheme() -> ExactSvmServerScheme:
    """
    Create a server scheme for SVM payments.

    Returns:
        ExactSvmServerScheme instance
    """
    return ExactSvmServerScheme()


def create_facilitator_scheme(signer: FacilitatorSvmSigner) -> ExactSvmFacilitatorScheme:
    """
    Create a facilitator scheme for SVM payments.

    Args:
        signer: FacilitatorSvmSigner implementation

    Returns:
        ExactSvmFacilitatorScheme instance
    """
    return ExactSvmFacilitatorScheme(signer)


def check_solana_available() -> bool:
    """
    Check if Solana packages are available.

    Returns:
        True if solana/solders packages are installed
    """
    return SOLANA_AVAILABLE
