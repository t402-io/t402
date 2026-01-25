"""Tezos Scheme Type Definitions.

This module defines the Pydantic models and Protocol interfaces used by the
Tezos exact-direct payment scheme.
"""

from __future__ import annotations

from typing import Any, Dict, List, Protocol, runtime_checkable

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel


@runtime_checkable
class ClientTezosSigner(Protocol):
    """Protocol for Tezos client-side signing operations.

    Implementations are responsible for managing private keys, constructing
    FA2 transfer operations, signing, and injecting them into the Tezos network.

    Example implementation:
        ```python
        class MyTezosSigner:
            def __init__(self, private_key: str, rpc_url: str):
                self._key = private_key
                self._rpc_url = rpc_url

            def address(self) -> str:
                return "tz1..."

            async def transfer_fa2(
                self,
                contract: str,
                token_id: int,
                to: str,
                amount: int,
                network: str,
            ) -> str:
                # Build FA2 transfer, sign and inject
                return "o..."  # operation hash
        ```
    """

    def address(self) -> str:
        """Return the Tezos address (tz1/tz2/tz3) of the signer."""
        ...

    async def transfer_fa2(
        self,
        contract: str,
        token_id: int,
        to: str,
        amount: int,
        network: str,
    ) -> str:
        """Execute an FA2 transfer operation on-chain.

        Constructs the FA2 transfer call parameter, signs the operation,
        and injects it into the Tezos network.

        Args:
            contract: The FA2 contract address (KT1...)
            token_id: The token ID within the FA2 contract
            to: Recipient Tezos address
            amount: Amount in atomic units (integer)
            network: CAIP-2 network identifier

        Returns:
            The operation hash (starts with 'o', 51 characters)

        Raises:
            Exception: If the transfer fails
        """
        ...


@runtime_checkable
class FacilitatorTezosSigner(Protocol):
    """Protocol for Tezos facilitator-side operations.

    Implementations query the Tezos blockchain (via RPC or indexer)
    to verify operation status and details.

    Example implementation:
        ```python
        class MyTezosQuerier:
            def __init__(self, indexer_url: str):
                self._indexer_url = indexer_url

            async def get_operation(
                self, op_hash: str, network: str
            ) -> Dict[str, Any]:
                # Query TzKT indexer for operation details
                response = await httpx.get(
                    f"{self._indexer_url}/v1/operations/{op_hash}"
                )
                return response.json()
        ```
    """

    async def get_operation(self, op_hash: str, network: str) -> Dict[str, Any]:
        """Query an operation by its hash.

        Returns the operation details from the Tezos blockchain,
        typically via a TzKT indexer API.

        Args:
            op_hash: The operation hash to query
            network: CAIP-2 network identifier

        Returns:
            Dict containing operation details with at minimum:
            - "status": str ("applied", "failed", "backtracked", "skipped")
            - "sender": Dict with "address" key
            - "target": Dict with "address" key (the FA2 contract)
            - "entrypoint": str (should be "transfer")
            - "parameter": The FA2 transfer parameters

        Raises:
            Exception: If the query fails or operation not found
        """
        ...


class TezosFA2TransferTx(BaseModel):
    """A single transfer transaction within an FA2 transfer batch.

    Attributes:
        to: Recipient address
        token_id: Token ID within the FA2 contract
        amount: Amount in atomic units
    """

    to: str = Field(alias="to_")
    token_id: int = Field(alias="token_id")
    amount: str

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
    )


class TezosFA2TransferParam(BaseModel):
    """FA2 transfer parameter structure.

    Represents a single sender's batch of transfers in the FA2 standard.

    Attributes:
        from_: Sender address
        txs: List of transfer transactions
    """

    from_: str = Field(alias="from_")
    txs: List[TezosFA2TransferTx]

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
    )


class ExactDirectPayload(BaseModel):
    """Payload for the Tezos exact-direct payment scheme.

    Contains the operation hash proving on-chain execution and metadata
    about the FA2 transfer for verification.

    Attributes:
        op_hash: The Tezos operation hash (starts with 'o', 51 chars)
        from_: Sender's Tezos address
        to: Recipient's Tezos address
        amount: Amount transferred in atomic units
        contract_address: FA2 contract address
        token_id: Token ID within the FA2 contract
    """

    op_hash: str = Field(alias="opHash")
    from_: str = Field(alias="from")
    to: str
    amount: str
    contract_address: str = Field(alias="contractAddress")
    token_id: int = Field(alias="tokenId")

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: str) -> str:
        """Validate that amount is a positive integer string."""
        try:
            val = int(v)
            if val <= 0:
                raise ValueError("amount must be a positive integer")
        except ValueError:
            raise ValueError("amount must be a positive integer encoded as a string")
        return v

    @field_validator("op_hash")
    @classmethod
    def validate_op_hash(cls, v: str) -> str:
        """Validate operation hash format."""
        if not v.startswith("o"):
            raise ValueError("Operation hash must start with 'o'")
        if len(v) != 51:
            raise ValueError("Operation hash must be 51 characters")
        return v

    def to_map(self) -> Dict[str, Any]:
        """Convert to a dict suitable for payment payload.

        Returns:
            Dict with camelCase keys matching the protocol format.
        """
        return self.model_dump(by_alias=True)
