"""
Type definitions for T402 Multi-sig (Safe) support.
"""

from dataclasses import dataclass, field
from enum import IntEnum
from typing import Dict, List, Optional


class SignatureType(IntEnum):
    """Type of signature for Safe transactions."""

    EOA = 0  # Standard EOA signature
    CONTRACT = 1  # EIP-1271 contract signature
    APPROVED_HASH = 4  # Pre-approved hash


class OperationType(IntEnum):
    """Operation type for Safe transactions."""

    CALL = 0
    DELEGATE_CALL = 1


@dataclass
class SafeConfig:
    """Configuration for a Safe multi-sig account."""

    address: str
    rpc_url: str
    chain_id: Optional[int] = None


@dataclass
class SafeOwner:
    """Represents an owner of a Safe account."""

    address: str
    index: int


@dataclass
class SafeTransaction:
    """Represents a pending Safe transaction."""

    to: str
    value: int = 0
    data: bytes = field(default_factory=bytes)
    operation: OperationType = OperationType.CALL
    safe_tx_gas: int = 0
    base_gas: int = 0
    gas_price: int = 0
    gas_token: str = "0x0000000000000000000000000000000000000000"
    refund_receiver: str = "0x0000000000000000000000000000000000000000"
    nonce: Optional[int] = None


@dataclass
class SafeSignature:
    """Holds a signature from a Safe owner."""

    signer: str
    signature: bytes
    signature_type: SignatureType = SignatureType.EOA


@dataclass
class TransactionRequest:
    """Represents a multi-sig transaction awaiting signatures."""

    id: str
    safe_address: str
    transaction: SafeTransaction
    transaction_hash: str
    signatures: Dict[str, SafeSignature] = field(default_factory=dict)
    threshold: int = 0
    created_at: int = 0
    expires_at: int = 0

    def is_ready(self) -> bool:
        """Check if enough signatures have been collected."""
        return len(self.signatures) >= self.threshold

    def collected_count(self) -> int:
        """Return the number of signatures collected."""
        return len(self.signatures)


@dataclass
class SafeInfo:
    """Information about a Safe account."""

    address: str
    owners: List[str]
    threshold: int
    nonce: int
    version: Optional[str] = None
    chain_id: Optional[int] = None


@dataclass
class ExecutionResult:
    """Result of executing a Safe transaction."""

    tx_hash: str
    success: bool
    gas_used: int = 0
    block_number: int = 0
