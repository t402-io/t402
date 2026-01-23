"""Aptos Scheme Types.

This module defines the data types used by the Aptos exact-direct payment scheme,
including the payload structure, transaction result, and signer protocols.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Protocol, runtime_checkable


@runtime_checkable
class ClientAptosSigner(Protocol):
    """Protocol for Aptos client-side signing operations.

    Implementations must provide the signer's address and the ability
    to sign and submit transactions to the Aptos network.

    Example:
        ```python
        class MyAptosSigner:
            def __init__(self, account, client):
                self._account = account
                self._client = client

            def address(self) -> str:
                return str(self._account.address())

            async def sign_and_submit(self, payload: Dict, network: str) -> str:
                txn = await self._client.submit_transaction(
                    self._account, payload
                )
                return txn["hash"]
        ```
    """

    def address(self) -> str:
        """Return the signer's Aptos address (0x-prefixed hex).

        Returns:
            The account address as a hex string.
        """
        ...

    async def sign_and_submit(self, payload: Dict[str, Any], network: str) -> str:
        """Sign and submit a transaction to the Aptos network.

        Args:
            payload: Transaction payload dict with function, type_arguments, and arguments.
            network: CAIP-2 network identifier (e.g., "aptos:1").

        Returns:
            Transaction hash as a 0x-prefixed hex string.

        Raises:
            Exception: If signing or submission fails.
        """
        ...


@runtime_checkable
class FacilitatorAptosSigner(Protocol):
    """Protocol for Aptos facilitator-side operations.

    Implementations must provide the ability to query transactions
    from the Aptos network for verification.

    Example:
        ```python
        import httpx

        class MyAptosQuerier:
            def __init__(self, rpc_url: str):
                self._rpc_url = rpc_url
                self._client = httpx.AsyncClient()

            def get_addresses(self, network: str) -> List[str]:
                return []  # No on-chain addresses needed for exact-direct

            async def get_transaction(self, tx_hash: str, network: str) -> Dict:
                resp = await self._client.get(
                    f"{self._rpc_url}/transactions/by_hash/{tx_hash}"
                )
                return resp.json()
        ```
    """

    def get_addresses(self, network: str) -> List[str]:
        """Return the facilitator's Aptos addresses for a network.

        For exact-direct, the facilitator typically does not hold funds
        and may return an empty list.

        Args:
            network: CAIP-2 network identifier.

        Returns:
            List of facilitator addresses.
        """
        ...

    async def get_transaction(self, tx_hash: str, network: str) -> Dict[str, Any]:
        """Query a transaction by hash from the Aptos network.

        Args:
            tx_hash: The transaction hash to query (0x-prefixed).
            network: CAIP-2 network identifier.

        Returns:
            Transaction result dict from the Aptos REST API containing fields:
            - hash: Transaction hash
            - version: Ledger version
            - success: Whether the transaction succeeded
            - vm_status: VM execution status
            - sender: Transaction sender address
            - timestamp: Block timestamp in microseconds
            - payload: Transaction payload
            - events: Transaction events

        Raises:
            Exception: If the transaction is not found or the query fails.
        """
        ...


class ExactDirectPayload:
    """Represents the payment payload for the exact-direct scheme on Aptos.

    This payload contains proof that the client has already executed a
    fungible asset transfer on-chain.

    Attributes:
        tx_hash: The transaction hash of the completed transfer.
        from_address: The sender's Aptos address.
        to_address: The recipient's Aptos address.
        amount: The transfer amount in atomic units.
        metadata_address: The FA metadata object address.
    """

    def __init__(
        self,
        tx_hash: str,
        from_address: str,
        to_address: str,
        amount: str,
        metadata_address: str,
    ) -> None:
        self.tx_hash = tx_hash
        self.from_address = from_address
        self.to_address = to_address
        self.amount = amount
        self.metadata_address = metadata_address

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization.

        Returns:
            Dict with camelCase keys matching the protocol format.
        """
        return {
            "txHash": self.tx_hash,
            "from": self.from_address,
            "to": self.to_address,
            "amount": self.amount,
            "metadataAddress": self.metadata_address,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ExactDirectPayload":
        """Create an ExactDirectPayload from a dictionary.

        Args:
            data: Dict with payload fields (supports both camelCase and snake_case).

        Returns:
            ExactDirectPayload instance.

        Raises:
            ValueError: If required fields are missing.
        """
        tx_hash = data.get("txHash") or data.get("tx_hash", "")
        from_address = data.get("from") or data.get("from_address", "")
        to_address = data.get("to") or data.get("to_address", "")
        amount = data.get("amount", "")
        metadata_address = (
            data.get("metadataAddress") or data.get("metadata_address", "")
        )

        return cls(
            tx_hash=tx_hash,
            from_address=from_address,
            to_address=to_address,
            amount=amount,
            metadata_address=metadata_address,
        )


def extract_transfer_details(tx: Dict[str, Any]) -> Optional[Dict[str, str]]:
    """Extract fungible asset transfer details from a transaction result.

    Parses the transaction payload to extract sender, recipient, amount,
    and metadata address from a primary_fungible_store::transfer call.

    Args:
        tx: Transaction result dict from the Aptos REST API.

    Returns:
        Dict with 'from', 'to', 'amount', 'metadata_address' keys,
        or None if the transaction is not a valid FA transfer.
    """
    if not tx or not tx.get("success"):
        return None

    payload = tx.get("payload")
    if not payload or payload.get("type") != "entry_function_payload":
        return None

    function = payload.get("function", "")
    if "primary_fungible_store::transfer" not in function:
        return None

    arguments = payload.get("arguments", [])
    if len(arguments) < 3:
        return None

    metadata_address = str(arguments[0])
    to_address = str(arguments[1])
    amount = str(arguments[2])

    sender = tx.get("sender", "")

    return {
        "from": sender,
        "to": to_address,
        "amount": amount,
        "metadata_address": metadata_address,
    }
