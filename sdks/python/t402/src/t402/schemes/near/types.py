"""NEAR blockchain types for the T402 protocol.

This module defines the data types used by the NEAR exact-direct payment scheme,
including RPC request/response types, transaction structures, and payload types.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Protocol, runtime_checkable

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel


# NEAR account ID validation regex.
# NEAR accounts are either implicit (64 hex chars) or named (multiple dot-separated
# segments where each segment is alphanumeric with optional hyphens/underscores).
# Examples: alice.near, sub.alice.near, usdt.tether-token.near, my_account.testnet
NEAR_ACCOUNT_ID_REGEX = re.compile(
    r"^(([a-z\d]+[-_])*[a-z\d]+\.)+([a-z\d]+[-_])*[a-z\d]+$|^[0-9a-f]{64}$"
)


def is_valid_account_id(account_id: str) -> bool:
    """Validate a NEAR account ID format.

    NEAR account IDs follow these rules:
    - Must be between 2 and 64 characters
    - Can be implicit (64 hex chars) or named (dot-separated segments)
    - Named segments are alphanumeric with optional hyphens/underscores

    Args:
        account_id: The NEAR account ID to validate.

    Returns:
        True if the account ID is valid.
    """
    if not account_id:
        return False
    if len(account_id) < 2 or len(account_id) > 64:
        return False
    return bool(NEAR_ACCOUNT_ID_REGEX.match(account_id))


# =============================================================================
# Signer Protocols
# =============================================================================


@runtime_checkable
class ClientNearSigner(Protocol):
    """Protocol for NEAR client-side signing operations.

    Implementations should handle key management and transaction signing
    for the NEAR blockchain.

    Example:
        ```python
        class MyNearSigner:
            def account_id(self) -> str:
                return "alice.near"

            async def sign_and_send_transaction(
                self, receiver_id: str, actions: List[Dict], network: str
            ) -> str:
                # Build, sign, and send the transaction
                return "tx_hash_here"
        ```
    """

    def account_id(self) -> str:
        """Get the signer's NEAR account ID.

        Returns:
            The NEAR account ID (e.g., "alice.near").
        """
        ...

    async def sign_and_send_transaction(
        self,
        receiver_id: str,
        actions: List[Dict[str, Any]],
        network: str,
    ) -> str:
        """Sign and send a NEAR transaction.

        Args:
            receiver_id: The contract account receiving the function call.
            actions: The actions to include in the transaction.
            network: The network to send the transaction on (e.g., "near:mainnet").

        Returns:
            Transaction hash string on success.

        Raises:
            Exception: If the transaction fails.
        """
        ...


@runtime_checkable
class FacilitatorNearSigner(Protocol):
    """Protocol for NEAR facilitator-side operations.

    Implementations should handle transaction querying and balance lookups
    for the NEAR blockchain.

    Example:
        ```python
        class MyNearFacilitator:
            def get_addresses(self, network: str) -> List[str]:
                return ["facilitator.near"]

            async def query_transaction(
                self, tx_hash: str, sender_id: str, network: str
            ) -> Dict[str, Any]:
                # Query the NEAR RPC for the transaction
                return {...}
        ```
    """

    def get_addresses(self, network: str) -> List[str]:
        """Get the facilitator's NEAR account IDs for a network.

        Args:
            network: The CAIP-2 network identifier.

        Returns:
            List of NEAR account IDs.
        """
        ...

    async def query_transaction(
        self,
        tx_hash: str,
        sender_id: str,
        network: str,
    ) -> Dict[str, Any]:
        """Query a transaction by hash from the NEAR RPC.

        The returned dict should match the NEAR RPC tx response format:
        {
            "status": {"SuccessValue": "...", ...},
            "transaction": {
                "hash": "...",
                "signer_id": "...",
                "receiver_id": "...",
                "actions": [...]
            },
            ...
        }

        Args:
            tx_hash: The transaction hash to query.
            sender_id: The sender's account ID (needed for RPC query).
            network: The CAIP-2 network identifier.

        Returns:
            Transaction result dict from the NEAR RPC.

        Raises:
            Exception: If the transaction is not found or the query fails.
        """
        ...


# =============================================================================
# Payload Types
# =============================================================================


class ExactDirectPayload(BaseModel):
    """Payload for the exact-direct scheme on NEAR.

    Contains the transaction hash as proof of on-chain payment,
    along with transfer details for verification.

    Attributes:
        tx_hash: The on-chain transaction hash.
        from_account: The sender's NEAR account ID.
        to_account: The recipient's NEAR account ID.
        amount: The transfer amount in atomic units.
    """

    tx_hash: str = Field(alias="txHash")
    from_account: str = Field(alias="from")
    to_account: str = Field(alias="to")
    amount: str

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
            Dict with txHash, from, to, and amount fields.
        """
        return {
            "txHash": self.tx_hash,
            "from": self.from_account,
            "to": self.to_account,
            "amount": self.amount,
        }

    @classmethod
    def from_map(cls, data: Dict[str, Any]) -> "ExactDirectPayload":
        """Create an ExactDirectPayload from a plain dict.

        Args:
            data: Dict with txHash, from, to, and amount fields.

        Returns:
            ExactDirectPayload instance.

        Raises:
            ValueError: If required fields are missing.
        """
        return cls(
            tx_hash=data.get("txHash", ""),
            from_account=data.get("from", ""),
            to_account=data.get("to", ""),
            amount=data.get("amount", "0"),
        )


# =============================================================================
# NEP-141 Action Types
# =============================================================================


class FtTransferArgs(BaseModel):
    """Arguments for the NEP-141 ft_transfer function call.

    Attributes:
        receiver_id: The recipient's NEAR account ID.
        amount: The transfer amount in atomic units (string).
        memo: Optional memo to include with the transfer.
    """

    receiver_id: str
    amount: str
    memo: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
    )


class FunctionCallAction(BaseModel):
    """Represents a NEAR function call action.

    Attributes:
        method_name: The name of the contract method to call.
        args: The JSON-serialized arguments.
        gas: The gas to attach (in yoctoNEAR units of gas).
        deposit: The deposit to attach (in yoctoNEAR).
    """

    method_name: str
    args: str  # JSON-serialized arguments
    gas: int
    deposit: str

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
    )

    def to_action_dict(self) -> Dict[str, Any]:
        """Convert to the action dict format expected by signers.

        Returns:
            Dict with FunctionCall action structure.
        """
        return {
            "FunctionCall": {
                "method_name": self.method_name,
                "args": self.args,
                "gas": self.gas,
                "deposit": self.deposit,
            }
        }


# =============================================================================
# RPC Types
# =============================================================================


class TransactionStatus:
    """Represents the status of a NEAR transaction.

    Attributes:
        success_value: The success value (present if transaction succeeded).
        failure: The failure info (present if transaction failed).
    """

    def __init__(
        self,
        success_value: Optional[str] = None,
        failure: Optional[Any] = None,
    ) -> None:
        self.success_value = success_value
        self.failure = failure

    def is_success(self) -> bool:
        """Check if the transaction succeeded.

        Returns:
            True if the transaction has a SuccessValue and no Failure.
        """
        return self.success_value is not None and self.failure is None

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TransactionStatus":
        """Create a TransactionStatus from an RPC response dict.

        Args:
            data: The status dict from the RPC response.

        Returns:
            TransactionStatus instance.
        """
        success_value = data.get("SuccessValue")
        failure = data.get("Failure")
        return cls(success_value=success_value, failure=failure)


def parse_transaction_result(data: Dict[str, Any]) -> Dict[str, Any]:
    """Parse a NEAR RPC transaction result into a structured format.

    Extracts the status, transaction details, and actions from the raw
    RPC response for easier verification.

    Args:
        data: The raw transaction result from the NEAR RPC.

    Returns:
        Parsed transaction dict with:
        - status: TransactionStatus
        - transaction: Dict with hash, signer_id, receiver_id, actions
        - ft_transfer_args: Optional FtTransferArgs if ft_transfer found

    Raises:
        ValueError: If the transaction data is malformed.
    """
    if not data:
        raise ValueError("Empty transaction data")

    # Parse status
    status_data = data.get("status", {})
    status = TransactionStatus.from_dict(status_data)

    # Parse transaction
    tx_data = data.get("transaction", {})
    if not tx_data:
        raise ValueError("Missing transaction field in result")

    receiver_id = tx_data.get("receiver_id", "")
    signer_id = tx_data.get("signer_id", "")
    tx_hash = tx_data.get("hash", "")
    actions = tx_data.get("actions", [])

    # Find ft_transfer action and parse its args
    ft_transfer_args: Optional[FtTransferArgs] = None
    for action in actions:
        func_call = action.get("FunctionCall")
        if func_call and func_call.get("method_name") == "ft_transfer":
            import base64
            import json

            args_raw = func_call.get("args", "")
            try:
                # Args are base64-encoded JSON in RPC responses
                args_bytes = base64.b64decode(args_raw)
                args_dict = json.loads(args_bytes)
            except Exception:
                # Try raw JSON if base64 fails
                try:
                    if isinstance(args_raw, str):
                        args_dict = json.loads(args_raw)
                    else:
                        args_dict = args_raw
                except Exception:
                    continue

            ft_transfer_args = FtTransferArgs(
                receiver_id=args_dict.get("receiver_id", ""),
                amount=args_dict.get("amount", "0"),
                memo=args_dict.get("memo"),
            )
            break

    return {
        "status": status,
        "transaction": {
            "hash": tx_hash,
            "signer_id": signer_id,
            "receiver_id": receiver_id,
            "actions": actions,
        },
        "ft_transfer_args": ft_transfer_args,
    }
