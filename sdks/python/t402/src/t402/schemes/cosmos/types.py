"""Cosmos/Noble blockchain types for the T402 protocol.

This module defines the data types used by the Cosmos exact-direct payment scheme,
including transaction structures, payload types, and signer protocols.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional, Protocol, runtime_checkable

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

from t402.schemes.cosmos.constants import MSG_TYPE_SEND


# =============================================================================
# Signer Protocols
# =============================================================================


@runtime_checkable
class ClientCosmosSigner(Protocol):
    """Protocol for Cosmos client-side signing operations.

    Implementations should handle key management and transaction signing
    for the Cosmos blockchain.

    Example:
        ```python
        class MyCosmosSigner:
            def address(self) -> str:
                return "noble1abc..."

            async def send_tokens(
                self, network: str, to: str, amount: str, denom: str
            ) -> str:
                # Build, sign, and send the transaction
                return "tx_hash_here"
        ```
    """

    def address(self) -> str:
        """Get the signer's Cosmos address.

        Returns:
            The bech32-encoded address (e.g., "noble1abc...").
        """
        ...

    async def send_tokens(
        self,
        network: str,
        to: str,
        amount: str,
        denom: str,
    ) -> str:
        """Send tokens and return the transaction hash.

        This is a pre-signed direct transfer (exact-direct scheme).

        Args:
            network: The CAIP-2 network identifier (e.g., "cosmos:noble-1").
            to: The recipient's bech32 address.
            amount: The amount in atomic units (e.g., "1000000" for 1 USDC).
            denom: The token denomination (e.g., "uusdc").

        Returns:
            Transaction hash string on success.

        Raises:
            Exception: If the transaction fails.
        """
        ...


@runtime_checkable
class FacilitatorCosmosSigner(Protocol):
    """Protocol for Cosmos facilitator-side operations.

    Implementations should handle transaction querying and balance lookups
    for the Cosmos blockchain.

    Example:
        ```python
        class MyCosmosRPC:
            def get_addresses(self, network: str) -> List[str]:
                return ["noble1facilitator..."]

            async def query_transaction(
                self, network: str, tx_hash: str
            ) -> TransactionResult:
                # Query the Cosmos REST API for the transaction
                return TransactionResult(...)

            async def get_balance(
                self, network: str, address: str, denom: str
            ) -> str:
                return "1000000"
        ```
    """

    def get_addresses(self, network: str) -> List[str]:
        """Get the facilitator's Cosmos addresses for a network.

        Args:
            network: The CAIP-2 network identifier.

        Returns:
            List of bech32-encoded addresses.
        """
        ...

    async def query_transaction(
        self,
        network: str,
        tx_hash: str,
    ) -> TransactionResult:
        """Query a transaction by hash from the Cosmos REST API.

        Args:
            network: The CAIP-2 network identifier.
            tx_hash: The transaction hash to query.

        Returns:
            TransactionResult with the transaction details.

        Raises:
            Exception: If the transaction is not found or the query fails.
        """
        ...

    async def get_balance(
        self,
        network: str,
        address: str,
        denom: str,
    ) -> str:
        """Get the token balance for an account.

        Args:
            network: The CAIP-2 network identifier.
            address: The bech32-encoded address.
            denom: The token denomination (e.g., "uusdc").

        Returns:
            Balance in atomic units as a string.

        Raises:
            Exception: If the balance query fails.
        """
        ...


# =============================================================================
# Transaction Types
# =============================================================================


class Coin:
    """Represents a Cosmos SDK Coin.

    Attributes:
        denom: The token denomination.
        amount: The amount in atomic units.
    """

    def __init__(self, denom: str, amount: str) -> None:
        self.denom = denom
        self.amount = amount

    def to_dict(self) -> Dict[str, str]:
        """Convert to a dict.

        Returns:
            Dict with denom and amount fields.
        """
        return {"denom": self.denom, "amount": self.amount}

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> Coin:
        """Create a Coin from a dict.

        Args:
            data: Dict with denom and amount fields.

        Returns:
            Coin instance.
        """
        return cls(
            denom=data.get("denom", ""),
            amount=data.get("amount", "0"),
        )


class MsgSend:
    """Represents a Cosmos SDK MsgSend message.

    Attributes:
        type: The message type URL (should be /cosmos.bank.v1beta1.MsgSend).
        from_address: The sender's bech32 address.
        to_address: The recipient's bech32 address.
        amount: List of Coin objects.
    """

    def __init__(
        self,
        type: str,
        from_address: str,
        to_address: str,
        amount: List[Coin],
    ) -> None:
        self.type = type
        self.from_address = from_address
        self.to_address = to_address
        self.amount = amount

    def get_amount_by_denom(self, denom: str) -> str:
        """Get the amount for a specific denomination.

        Args:
            denom: The token denomination to look for.

        Returns:
            Amount string if found, empty string otherwise.
        """
        for coin in self.amount:
            if coin.denom == denom:
                return coin.amount
        return ""

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> Optional[MsgSend]:
        """Parse a message dict into a MsgSend.

        Returns None if the message is not a MsgSend type.

        Args:
            data: Dict representing a Cosmos message.

        Returns:
            MsgSend instance if it is a bank send message, None otherwise.
        """
        msg_type = data.get("@type", "")
        if msg_type != MSG_TYPE_SEND:
            return None

        coins = []
        for coin_data in data.get("amount", []):
            coins.append(Coin.from_dict(coin_data))

        return cls(
            type=msg_type,
            from_address=data.get("from_address", ""),
            to_address=data.get("to_address", ""),
            amount=coins,
        )


class TxEvent:
    """Represents an event in a transaction log.

    Attributes:
        type: The event type.
        attributes: List of key-value attribute dicts.
    """

    def __init__(self, type: str, attributes: List[Dict[str, str]]) -> None:
        self.type = type
        self.attributes = attributes

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> TxEvent:
        """Create a TxEvent from a dict.

        Args:
            data: Dict with type and attributes fields.

        Returns:
            TxEvent instance.
        """
        return cls(
            type=data.get("type", ""),
            attributes=data.get("attributes", []),
        )


class TxLog:
    """Represents a transaction log.

    Attributes:
        msg_index: The message index.
        log: The log string.
        events: List of TxEvent objects.
    """

    def __init__(self, msg_index: int, log: str, events: List[TxEvent]) -> None:
        self.msg_index = msg_index
        self.log = log
        self.events = events

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> TxLog:
        """Create a TxLog from a dict.

        Args:
            data: Dict with msg_index, log, and events fields.

        Returns:
            TxLog instance.
        """
        events = [TxEvent.from_dict(e) for e in data.get("events", [])]
        return cls(
            msg_index=data.get("msg_index", 0),
            log=data.get("log", ""),
            events=events,
        )


class TransactionResult:
    """Represents the result of a Cosmos transaction query.

    Attributes:
        tx_hash: The transaction hash.
        height: The block height.
        code: The response code (0 = success).
        raw_log: The raw log string.
        logs: List of TxLog objects.
        gas_wanted: The gas requested.
        gas_used: The gas consumed.
        messages: List of raw message dicts from the transaction body.
        timestamp: The block timestamp.
    """

    def __init__(
        self,
        tx_hash: str = "",
        height: str = "",
        code: int = 0,
        raw_log: str = "",
        logs: Optional[List[TxLog]] = None,
        gas_wanted: str = "",
        gas_used: str = "",
        messages: Optional[List[Dict[str, Any]]] = None,
        timestamp: str = "",
    ) -> None:
        self.tx_hash = tx_hash
        self.height = height
        self.code = code
        self.raw_log = raw_log
        self.logs = logs or []
        self.gas_wanted = gas_wanted
        self.gas_used = gas_used
        self.messages = messages or []
        self.timestamp = timestamp

    def is_success(self) -> bool:
        """Check if the transaction succeeded.

        Returns:
            True if the response code is 0.
        """
        return self.code == 0

    def find_msg_send(self) -> Optional[MsgSend]:
        """Find the first MsgSend message in the transaction.

        Returns:
            MsgSend if found, None otherwise.
        """
        for msg_data in self.messages:
            msg = MsgSend.from_dict(msg_data)
            if msg is not None:
                return msg
        return None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> TransactionResult:
        """Create a TransactionResult from a REST API response dict.

        Handles both the direct format and the nested tx_response format.

        Args:
            data: Dict from the Cosmos REST API.

        Returns:
            TransactionResult instance.
        """
        # Handle nested REST API response format
        tx_response = data.get("tx_response", data)
        tx_wrapper = data.get("tx", {})

        # Parse logs
        logs = []
        for log_data in tx_response.get("logs", []):
            logs.append(TxLog.from_dict(log_data))

        # Parse messages from tx body
        messages: List[Dict[str, Any]] = []
        body = tx_wrapper.get("body", {})
        raw_messages = body.get("messages", [])
        for raw_msg in raw_messages:
            if isinstance(raw_msg, dict):
                messages.append(raw_msg)
            elif isinstance(raw_msg, (str, bytes)):
                try:
                    messages.append(json.loads(raw_msg))
                except (json.JSONDecodeError, TypeError):
                    continue

        return cls(
            tx_hash=tx_response.get("txhash", tx_response.get("tx_hash", "")),
            height=tx_response.get("height", ""),
            code=tx_response.get("code", 0),
            raw_log=tx_response.get("raw_log", ""),
            logs=logs,
            gas_wanted=tx_response.get("gas_wanted", ""),
            gas_used=tx_response.get("gas_used", ""),
            messages=messages,
            timestamp=tx_response.get("timestamp", ""),
        )


# =============================================================================
# Payload Types
# =============================================================================


class ExactDirectPayload(BaseModel):
    """Payload for the exact-direct scheme on Cosmos.

    Contains the transaction hash as proof of on-chain payment,
    along with transfer details for verification.

    Attributes:
        tx_hash: The on-chain transaction hash.
        from_address: The sender's bech32 address.
        to_address: The recipient's bech32 address.
        amount: The transfer amount in atomic units.
        denom: The token denomination (optional, defaults to "uusdc").
    """

    tx_hash: str = Field(alias="txHash")
    from_address: str = Field(alias="from")
    to_address: str = Field(alias="to")
    amount: str
    denom: str = ""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: str) -> str:
        """Validate that amount is a valid integer string."""
        try:
            int(v)
        except ValueError:
            raise ValueError("amount must be an integer encoded as a string")
        return v

    def to_map(self) -> Dict[str, Any]:
        """Convert the payload to a plain dict for inclusion in PaymentPayload.

        Returns:
            Dict with txHash, from, to, amount, and optionally denom fields.
        """
        m: Dict[str, Any] = {
            "txHash": self.tx_hash,
            "from": self.from_address,
            "to": self.to_address,
            "amount": self.amount,
        }
        if self.denom:
            m["denom"] = self.denom
        return m

    @classmethod
    def from_map(cls, data: Dict[str, Any]) -> ExactDirectPayload:
        """Create an ExactDirectPayload from a plain dict.

        Args:
            data: Dict with txHash, from, to, amount, and optionally denom fields.

        Returns:
            ExactDirectPayload instance.

        Raises:
            ValueError: If required fields are missing.
        """
        return cls(
            tx_hash=data.get("txHash", ""),
            from_address=data.get("from", ""),
            to_address=data.get("to", ""),
            amount=data.get("amount", "0"),
            denom=data.get("denom", ""),
        )
