"""
Type definitions for T402 WDK Python adapter.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Dict, List, Any, TypedDict


class NetworkType(Enum):
    """Blockchain network types."""

    EVM = "evm"
    SOLANA = "solana"
    TON = "ton"
    TRON = "tron"


@dataclass
class ChainConfig:
    """Configuration for a blockchain network."""

    chain_id: int
    network: str  # CAIP-2 format (e.g., "eip155:42161")
    name: str
    rpc_url: str
    network_type: NetworkType = NetworkType.EVM


@dataclass
class TokenInfo:
    """Token metadata."""

    address: str
    symbol: str
    name: str
    decimals: int
    supports_eip3009: bool = False


@dataclass
class TokenBalance:
    """Token balance result."""

    token: str
    symbol: str
    balance: int  # In smallest units
    formatted: str
    decimals: int


@dataclass
class ChainBalance:
    """Balance result for a single chain."""

    chain: str
    network: str
    native: int
    tokens: List[TokenBalance] = field(default_factory=list)


@dataclass
class AggregatedBalance:
    """Aggregated balances across all chains."""

    total_usdt0: int
    total_usdc: int
    chains: List[ChainBalance] = field(default_factory=list)


@dataclass
class PaymentParams:
    """Parameters for making a payment."""

    network: str
    asset: str
    to: str
    amount: int  # In smallest units (e.g., 1000000 for 1 USDT)


@dataclass
class PaymentResult:
    """Result of a payment operation."""

    success: bool
    tx_hash: Optional[str] = None
    error: Optional[str] = None


@dataclass
class SignedTypedData:
    """EIP-712 typed data structure."""

    domain: Dict[str, Any]
    types: Dict[str, Any]
    primary_type: str
    message: Dict[str, Any]


class TypedDataDomain(TypedDict, total=False):
    """EIP-712 domain structure."""

    name: str
    version: str
    chainId: int
    verifyingContract: str
    salt: str


@dataclass
class WDKConfig:
    """Configuration for WDK instance."""

    chains: Dict[str, str] = field(default_factory=dict)  # chain -> rpc_url
    cache_ttl: int = 60  # Balance cache TTL in seconds
    timeout: int = 30  # Operation timeout in seconds


@dataclass
class BridgeParams:
    """Parameters for bridging tokens."""

    from_chain: str
    to_chain: str
    amount: int
    recipient: Optional[str] = None


@dataclass
class BridgeResult:
    """Result of a bridge operation."""

    tx_hash: str
    estimated_time: int = 300  # Estimated completion time in seconds
