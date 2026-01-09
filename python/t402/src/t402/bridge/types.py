"""Type definitions for USDT0 cross-chain bridging."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Optional, Protocol
from decimal import Decimal


class BridgeStatus(str, Enum):
    """Bridge transaction status."""

    PENDING = "pending"  # Transaction submitted, waiting for confirmation
    INFLIGHT = "inflight"  # Message sent via LayerZero, in transit
    DELIVERED = "delivered"  # Message delivered to destination
    COMPLETED = "completed"  # Tokens received on destination
    FAILED = "failed"  # Bridge failed


class LayerZeroMessageStatus(str, Enum):
    """LayerZero message status from Scan API."""

    INFLIGHT = "INFLIGHT"  # Message sent, in transit between chains
    CONFIRMING = "CONFIRMING"  # Awaiting confirmations
    DELIVERED = "DELIVERED"  # Successfully delivered to destination chain
    FAILED = "FAILED"  # Delivery failed
    BLOCKED = "BLOCKED"  # Message blocked by DVN


@dataclass
class BridgeQuoteParams:
    """Parameters for quoting a bridge transaction."""

    from_chain: str
    """Source chain name (e.g., 'ethereum', 'arbitrum')."""

    to_chain: str
    """Destination chain name."""

    amount: int
    """Amount to bridge in token units (6 decimals for USDT0)."""

    recipient: str
    """Recipient address on destination chain."""


@dataclass
class BridgeQuote:
    """Quote result for a bridge transaction."""

    native_fee: int
    """Native token fee required (in wei)."""

    amount_to_send: int
    """Amount that will be sent."""

    min_amount_to_receive: int
    """Minimum amount to receive (after fees/slippage)."""

    estimated_time: int
    """Estimated time for bridge completion in seconds."""

    from_chain: str
    """Source chain."""

    to_chain: str
    """Destination chain."""


@dataclass
class BridgeExecuteParams:
    """Parameters for executing a bridge transaction."""

    from_chain: str
    """Source chain name (e.g., 'ethereum', 'arbitrum')."""

    to_chain: str
    """Destination chain name."""

    amount: int
    """Amount to bridge in token units (6 decimals for USDT0)."""

    recipient: str
    """Recipient address on destination chain."""

    slippage_tolerance: float = 0.5
    """Slippage tolerance as percentage (e.g., 0.5 for 0.5%)."""

    dst_gas_limit: Optional[int] = None
    """Custom gas limit for the destination chain execution."""

    refund_address: Optional[str] = None
    """Refund address for excess fees (defaults to sender)."""


@dataclass
class BridgeResult:
    """Result of a bridge transaction."""

    tx_hash: str
    """Transaction hash on source chain."""

    message_guid: str
    """LayerZero message GUID."""

    amount_sent: int
    """Amount sent."""

    amount_to_receive: int
    """Amount to be received on destination."""

    from_chain: str
    """Source chain."""

    to_chain: str
    """Destination chain."""

    estimated_time: int
    """Estimated completion time in seconds."""


@dataclass
class LayerZeroMessage:
    """LayerZero message from Scan API."""

    guid: str
    """Unique message identifier."""

    src_eid: int
    """Source chain LayerZero endpoint ID."""

    dst_eid: int
    """Destination chain LayerZero endpoint ID."""

    src_ua_address: str
    """Source chain OApp address."""

    dst_ua_address: str
    """Destination chain OApp address."""

    src_tx_hash: str
    """Source chain transaction hash."""

    status: LayerZeroMessageStatus
    """Current message status."""

    src_block_number: int
    """Source chain block number."""

    created: str
    """Timestamp when message was created."""

    updated: str
    """Timestamp when message was last updated."""

    dst_tx_hash: Optional[str] = None
    """Destination chain transaction hash (when delivered)."""

    dst_block_number: Optional[int] = None
    """Destination chain block number (when delivered)."""


@dataclass
class WaitForDeliveryOptions:
    """Options for waiting for message delivery."""

    timeout: int = 600_000
    """Maximum time to wait in milliseconds (default: 10 minutes)."""

    poll_interval: int = 10_000
    """Polling interval in milliseconds (default: 10 seconds)."""

    on_status_change: Optional[Callable[[LayerZeroMessageStatus], None]] = None
    """Callback when status changes."""


@dataclass
class SendParam:
    """LayerZero SendParam struct."""

    dst_eid: int
    to: bytes  # 32 bytes
    amount_ld: int
    min_amount_ld: int
    extra_options: bytes = field(default_factory=bytes)
    compose_msg: bytes = field(default_factory=bytes)
    oft_cmd: bytes = field(default_factory=bytes)


@dataclass
class MessagingFee:
    """LayerZero MessagingFee struct."""

    native_fee: int
    lz_token_fee: int = 0


@dataclass
class TransactionLog:
    """Transaction log entry."""

    address: str
    """Contract address that emitted the log."""

    topics: list[str]
    """Indexed event parameters."""

    data: str
    """Non-indexed event data."""


@dataclass
class BridgeTransactionReceipt:
    """Transaction receipt with logs."""

    status: int
    """Transaction status (1 = success, 0 = reverted)."""

    transaction_hash: str
    """Transaction hash."""

    logs: list[TransactionLog]
    """Event logs emitted during transaction."""


class BridgeSigner(Protocol):
    """Protocol for bridge signer operations."""

    @property
    def address(self) -> str:
        """Wallet address."""
        ...

    async def read_contract(
        self,
        address: str,
        abi: list,
        function_name: str,
        *args,
    ) -> any:
        """Read contract state."""
        ...

    async def write_contract(
        self,
        address: str,
        abi: list,
        function_name: str,
        *args,
        value: int = 0,
    ) -> str:
        """Write to contract, returns tx hash."""
        ...

    async def wait_for_transaction_receipt(
        self, tx_hash: str
    ) -> BridgeTransactionReceipt:
        """Wait for transaction receipt."""
        ...


@dataclass
class CrossChainPaymentParams:
    """Parameters for cross-chain payment routing."""

    source_chain: str
    """Source chain where user has funds."""

    destination_chain: str
    """Destination chain where payment is needed."""

    amount: int
    """Amount to transfer (in token units, 6 decimals for USDT0)."""

    pay_to: str
    """Payment recipient on destination chain."""

    payer: str
    """Payer address (receives bridged funds on destination)."""

    slippage_tolerance: float = 0.5
    """Slippage tolerance percentage (default: 0.5)."""


@dataclass
class CrossChainPaymentResult:
    """Result of cross-chain payment routing."""

    bridge_tx_hash: str
    """Bridge transaction hash on source chain."""

    message_guid: str
    """LayerZero message GUID for tracking."""

    amount_bridged: int
    """Amount bridged from source chain."""

    estimated_receive_amount: int
    """Estimated amount to receive on destination."""

    source_chain: str
    """Source chain name."""

    destination_chain: str
    """Destination chain name."""

    estimated_delivery_time: int
    """Estimated delivery time in seconds."""
