"""Stacks Scheme Types.

This module defines types, payload structures, and validation utilities
for the Stacks exact-direct payment scheme.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Dict, Optional, Protocol, runtime_checkable


# Stacks address regex: SP/ST prefix followed by base58 characters
# SP for mainnet, ST for testnet, typical length 39-41 characters total
STACKS_ADDRESS_REGEX = re.compile(r"^S[PT][A-Z0-9]{38,40}$")

# Transaction ID regex: 0x-prefixed 64 hex characters (32 bytes)
TX_ID_REGEX = re.compile(r"^0x[a-fA-F0-9]{64}$")

# Contract identifier regex: address.contract-name
CONTRACT_ID_REGEX = re.compile(
    r"^S[PT][A-Z0-9]{38,40}\.[a-zA-Z][a-zA-Z0-9\-]{0,127}$"
)


@dataclass
class ExactDirectPayload:
    """Payment payload for the exact-direct scheme on Stacks.

    Contains the on-chain proof of a completed SIP-010 token transfer.

    Attributes:
        tx_id: The 0x-prefixed hex transaction ID
        from_address: The sender's Stacks address
        to_address: The recipient's Stacks address
        amount: The atomic amount transferred (as string)
        contract_address: The SIP-010 token contract identifier
    """

    tx_id: str
    from_address: str
    to_address: str
    amount: str
    contract_address: str

    def to_dict(self) -> Dict[str, Any]:
        """Convert the payload to a dictionary suitable for JSON serialization.

        Returns:
            Dictionary with camelCase keys matching the protocol format
        """
        return {
            "txId": self.tx_id,
            "from": self.from_address,
            "to": self.to_address,
            "amount": self.amount,
            "contractAddress": self.contract_address,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ExactDirectPayload":
        """Create an ExactDirectPayload from a dictionary.

        Args:
            data: Dictionary with payload fields (camelCase or snake_case)

        Returns:
            ExactDirectPayload instance

        Raises:
            KeyError: If required fields are missing
            TypeError: If field types are incorrect
        """
        return cls(
            tx_id=data.get("txId", data.get("tx_id", "")),
            from_address=data.get("from", data.get("from_address", "")),
            to_address=data.get("to", data.get("to_address", "")),
            amount=str(data.get("amount", "")),
            contract_address=data.get(
                "contractAddress", data.get("contract_address", "")
            ),
        )


@dataclass
class TransactionResult:
    """Result of querying a transaction from the Stacks chain.

    Represents the on-chain data for a submitted transaction,
    including its parameters and success status.

    Attributes:
        tx_id: The 0x-prefixed transaction ID
        tx_status: Transaction status (e.g., "success", "pending")
        sender_address: The sender's Stacks address
        contract_call: Details of the contract call (if applicable)
        block_height: Block height where the transaction was included
        block_hash: Hash of the block
    """

    tx_id: str
    tx_status: str
    sender_address: str
    contract_call: Optional[Dict[str, Any]]
    block_height: int
    block_hash: str


@dataclass
class ParsedTokenTransfer:
    """Parsed SIP-010 token transfer details extracted from a transaction.

    Attributes:
        contract_address: The SIP-010 contract identifier
        from_address: Sender Stacks address
        to_address: Recipient Stacks address
        amount: Transfer amount in atomic units (as string)
        success: Whether the transfer succeeded
    """

    contract_address: str
    from_address: str
    to_address: str
    amount: str
    success: bool


@runtime_checkable
class ClientStacksSigner(Protocol):
    """Protocol for signing and submitting Stacks token transfers.

    Implementations should provide the signer's address and the ability
    to execute SIP-010 token transfers on the Stacks chain.

    Example:
        ```python
        class MyStacksSigner:
            @property
            def address(self) -> str:
                return "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K"

            async def transfer_token(
                self, contract_address: str, to: str, amount: int
            ) -> str:
                # Build and submit SIP-010 transfer contract call
                # Returns the transaction ID
                return "0x..."
        ```
    """

    @property
    def address(self) -> str:
        """Return the Stacks address of the signer.

        Returns:
            Stacks address string (SP... or ST...)
        """
        ...

    async def transfer_token(
        self, contract_address: str, to: str, amount: int
    ) -> str:
        """Execute a SIP-010 token transfer on-chain.

        Builds a contract-call transaction for the SIP-010 `transfer`
        function and submits it to the Stacks chain.

        Args:
            contract_address: The SIP-010 token contract identifier
                (e.g., "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc")
            to: The recipient's Stacks address
            amount: The amount to transfer in atomic units

        Returns:
            The 0x-prefixed transaction ID

        Raises:
            Exception: If signing or submission fails
        """
        ...


@runtime_checkable
class FacilitatorStacksSigner(Protocol):
    """Protocol for facilitator-side Stacks operations.

    Implementations should provide the ability to query transactions
    from the Stacks chain (via Hiro API or similar).

    Example:
        ```python
        class MyStacksFacilitator:
            def get_addresses(self, network: str) -> list[str]:
                return ["SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K"]

            async def query_transaction(self, tx_id: str) -> dict | None:
                # Query Hiro API for transaction details
                return {
                    "tx_id": "0x...",
                    "tx_status": "success",
                    "sender_address": "SP...",
                    "contract_call": {
                        "contract_id": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
                        "function_name": "transfer",
                        "function_args": [...],
                    },
                    "block_height": 12345,
                    "block_hash": "0x...",
                }
        ```
    """

    def get_addresses(self, network: str) -> list:
        """Get the facilitator addresses for a given network.

        Args:
            network: CAIP-2 network identifier

        Returns:
            List of Stacks addresses for the facilitator on this network
        """
        ...

    async def query_transaction(self, tx_id: str) -> Optional[Dict[str, Any]]:
        """Query a transaction by its ID from the Stacks chain.

        Args:
            tx_id: The 0x-prefixed transaction ID

        Returns:
            Dictionary with transaction details, or None if not found.
            Expected fields:
            - tx_id: str
            - tx_status: str ("success", "pending", "abort_by_response", etc.)
            - sender_address: str
            - contract_call: dict with contract_id, function_name, function_args
            - block_height: int
            - block_hash: str

        Raises:
            Exception: If the query fails
        """
        ...


def is_valid_stacks_address(address: str) -> bool:
    """Check if a string is a valid Stacks address.

    Validates that the address starts with SP (mainnet) or ST (testnet)
    followed by the expected base58 characters.

    Args:
        address: String to validate

    Returns:
        True if the address matches the Stacks address format
    """
    if not address:
        return False
    return bool(STACKS_ADDRESS_REGEX.match(address))


def is_valid_tx_id(tx_id: str) -> bool:
    """Check if a string is a valid Stacks transaction ID.

    Transaction IDs are 0x-prefixed 64 hex character strings (32 bytes).

    Args:
        tx_id: String to validate

    Returns:
        True if the transaction ID matches the expected format
    """
    if not tx_id:
        return False
    return bool(TX_ID_REGEX.match(tx_id))


def parse_contract_identifier(asset: str) -> Optional[str]:
    """Parse a CAIP-19 asset identifier to extract the contract identifier.

    Format: "{network}/token:{contract_id}"
    Example: "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc"

    Args:
        asset: CAIP-19 asset identifier string

    Returns:
        The contract identifier string, or None if parsing fails
    """
    prefix = "/token:"
    idx = asset.find(prefix)
    if idx == -1:
        return None
    contract_id = asset[idx + len(prefix):]
    if not contract_id:
        return None
    return contract_id


def create_asset_identifier(network: str, contract_address: str) -> str:
    """Create a CAIP-19 asset identifier for a Stacks SIP-010 token.

    Format: "{network}/token:{contract_id}"

    Args:
        network: CAIP-2 network identifier
        contract_address: SIP-010 contract identifier

    Returns:
        CAIP-19 asset identifier string
    """
    return f"{network}/token:{contract_address}"


def extract_token_transfer(result: TransactionResult) -> Optional[ParsedTokenTransfer]:
    """Extract SIP-010 token transfer details from a transaction result.

    Validates that the transaction is a successful SIP-010 transfer
    contract call and extracts the transfer parameters.

    Args:
        result: TransactionResult from chain query

    Returns:
        ParsedTokenTransfer if the transaction is a valid token transfer,
        None otherwise
    """
    if result.tx_status != "success":
        return None

    if not result.contract_call:
        return None

    # Check for transfer function
    function_name = result.contract_call.get("function_name", "")
    if function_name != "transfer":
        return None

    contract_id = result.contract_call.get("contract_id", "")
    if not contract_id:
        return None

    # Extract function arguments
    function_args = result.contract_call.get("function_args", [])

    amount: Optional[str] = None
    to_address: Optional[str] = None

    for arg in function_args:
        if not isinstance(arg, dict):
            continue

        arg_name = arg.get("name", "")
        arg_repr = arg.get("repr", "")

        if arg_name == "amount":
            # repr is like "u1000000" for uint
            if arg_repr.startswith("u"):
                amount = arg_repr[1:]
            else:
                amount = arg_repr
        elif arg_name == "recipient" or arg_name == "to":
            # repr is the principal address, strip leading '
            if arg_repr.startswith("'"):
                to_address = arg_repr[1:]
            else:
                to_address = arg_repr

    if not amount or not to_address:
        return None

    return ParsedTokenTransfer(
        contract_address=contract_id,
        from_address=result.sender_address,
        to_address=to_address,
        amount=amount,
        success=True,
    )
