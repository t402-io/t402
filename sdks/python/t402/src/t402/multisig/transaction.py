"""
Transaction builder for T402 Multi-sig (Safe) support.
"""

from typing import List, Optional

from web3 import Web3

from .constants import SAFE_MULTISEND, ERC20_TRANSFER_SELECTOR, MULTISEND_SELECTOR
from .types import SafeTransaction, OperationType


class TransactionBuilder:
    """Builder for Safe transactions."""

    def __init__(self):
        """Initialize TransactionBuilder."""
        self._to: str = "0x0000000000000000000000000000000000000000"
        self._value: int = 0
        self._data: bytes = b""
        self._operation: OperationType = OperationType.CALL
        self._safe_tx_gas: int = 0
        self._base_gas: int = 0
        self._gas_price: int = 0
        self._gas_token: str = "0x0000000000000000000000000000000000000000"
        self._refund_receiver: str = "0x0000000000000000000000000000000000000000"
        self._nonce: Optional[int] = None

    def to(self, address: str) -> "TransactionBuilder":
        """Set the target address."""
        self._to = Web3.to_checksum_address(address)
        return self

    def value(self, amount: int) -> "TransactionBuilder":
        """Set the ETH value to send."""
        self._value = amount
        return self

    def data(self, data: bytes) -> "TransactionBuilder":
        """Set the calldata."""
        self._data = data
        return self

    def operation(self, op: OperationType) -> "TransactionBuilder":
        """Set the operation type."""
        self._operation = op
        return self

    def delegate_call(self) -> "TransactionBuilder":
        """Set operation to delegate call."""
        self._operation = OperationType.DELEGATE_CALL
        return self

    def safe_tx_gas(self, gas: int) -> "TransactionBuilder":
        """Set the Safe transaction gas."""
        self._safe_tx_gas = gas
        return self

    def base_gas(self, gas: int) -> "TransactionBuilder":
        """Set the base gas."""
        self._base_gas = gas
        return self

    def gas_price(self, price: int) -> "TransactionBuilder":
        """Set the gas price for refund."""
        self._gas_price = price
        return self

    def gas_token(self, token: str) -> "TransactionBuilder":
        """Set the token for gas refund (zero address for ETH)."""
        self._gas_token = Web3.to_checksum_address(token)
        return self

    def refund_receiver(self, receiver: str) -> "TransactionBuilder":
        """Set the address to receive gas refund."""
        self._refund_receiver = Web3.to_checksum_address(receiver)
        return self

    def nonce(self, nonce: int) -> "TransactionBuilder":
        """Set the Safe nonce."""
        self._nonce = nonce
        return self

    def build(self) -> SafeTransaction:
        """Build the SafeTransaction."""
        return SafeTransaction(
            to=self._to,
            value=self._value,
            data=self._data,
            operation=self._operation,
            safe_tx_gas=self._safe_tx_gas,
            base_gas=self._base_gas,
            gas_price=self._gas_price,
            gas_token=self._gas_token,
            refund_receiver=self._refund_receiver,
            nonce=self._nonce,
        )


def erc20_transfer(token: str, to: str, amount: int) -> SafeTransaction:
    """
    Create a transaction for ERC20 token transfer.

    Args:
        token: Token contract address.
        to: Recipient address.
        amount: Amount in smallest units.

    Returns:
        SafeTransaction for the transfer.
    """
    # Build calldata: transfer(address,uint256)
    to_addr = Web3.to_checksum_address(to)
    data = (
        ERC20_TRANSFER_SELECTOR
        + bytes(12)  # Padding for address
        + bytes.fromhex(to_addr[2:])
        + amount.to_bytes(32, "big")
    )

    return (
        TransactionBuilder()
        .to(token)
        .data(data)
        .build()
    )


def eth_transfer(to: str, amount: int) -> SafeTransaction:
    """
    Create a transaction for sending ETH.

    Args:
        to: Recipient address.
        amount: Amount in wei.

    Returns:
        SafeTransaction for the transfer.
    """
    return (
        TransactionBuilder()
        .to(to)
        .value(amount)
        .build()
    )


def contract_call(target: str, data: bytes) -> SafeTransaction:
    """
    Create a transaction for calling a contract.

    Args:
        target: Target contract address.
        data: Calldata.

    Returns:
        SafeTransaction for the call.
    """
    return (
        TransactionBuilder()
        .to(target)
        .data(data)
        .build()
    )


class BatchTransactionBuilder:
    """Builder for batch transactions via MultiSend."""

    def __init__(self):
        """Initialize BatchTransactionBuilder."""
        self._transactions: List[SafeTransaction] = []

    def add(self, tx: SafeTransaction) -> "BatchTransactionBuilder":
        """Add a transaction to the batch."""
        self._transactions.append(tx)
        return self

    def add_transfer(
        self, token: str, to: str, amount: int
    ) -> "BatchTransactionBuilder":
        """Add an ERC20 transfer to the batch."""
        return self.add(erc20_transfer(token, to, amount))

    def add_eth_transfer(self, to: str, amount: int) -> "BatchTransactionBuilder":
        """Add an ETH transfer to the batch."""
        return self.add(eth_transfer(to, amount))

    def build(self) -> List[SafeTransaction]:
        """Return all transactions in the batch."""
        return self._transactions.copy()

    def build_multisend(self) -> SafeTransaction:
        """
        Create a single transaction that executes all batch transactions via MultiSend.

        Returns:
            SafeTransaction for MultiSend execution.
        """
        # Encode each transaction for MultiSend
        # Format: operation (1 byte) + to (20 bytes) + value (32 bytes) +
        #         dataLength (32 bytes) + data (variable)
        packed_txs = b""
        for tx in self._transactions:
            # Operation (1 byte)
            packed_txs += bytes([tx.operation])

            # To (20 bytes)
            packed_txs += bytes.fromhex(tx.to[2:])

            # Value (32 bytes)
            packed_txs += tx.value.to_bytes(32, "big")

            # Data length (32 bytes)
            packed_txs += len(tx.data).to_bytes(32, "big")

            # Data
            packed_txs += tx.data

        # Build MultiSend calldata
        # multiSend(bytes transactions)
        # Offset (32 bytes) + Length (32 bytes) + Data (padded to 32 bytes)
        offset = (32).to_bytes(32, "big")  # Offset to data
        length = len(packed_txs).to_bytes(32, "big")

        # Pad to 32-byte boundary
        padded_len = ((len(packed_txs) + 31) // 32) * 32
        padded_data = packed_txs + b"\x00" * (padded_len - len(packed_txs))

        calldata = MULTISEND_SELECTOR + offset + length + padded_data

        return (
            TransactionBuilder()
            .to(SAFE_MULTISEND)
            .data(calldata)
            .delegate_call()
            .build()
        )
