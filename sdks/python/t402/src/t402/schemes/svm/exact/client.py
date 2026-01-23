"""Solana SVM Exact Scheme - Client Implementation.

This module provides the client-side implementation of the exact payment scheme
for Solana network using SPL Token TransferChecked instructions.

The client creates and signs a Solana transaction containing a TransferChecked
instruction, which the facilitator then co-signs (as fee payer) and broadcasts.
"""

from __future__ import annotations

import time
from typing import Any, Callable, Dict, List, Optional, Protocol, Union, Awaitable

from t402.types import (
    PaymentRequirementsV2,
    T402_VERSION_V1,
    T402_VERSION_V2,
)
from t402.svm import (
    SCHEME_EXACT,
    SOLANA_MAINNET,
    DEFAULT_VALIDITY_DURATION,
    validate_svm_address,
    normalize_network,
    parse_transfer_checked_instruction,
)


class ClientSvmSigner(Protocol):
    """Protocol for client-side SVM signing operations.

    Implementations should provide methods to:
    - Get the signer's public address
    - Sign transactions

    Example implementation:
        ```python
        class MySvmSigner:
            def __init__(self, keypair):
                self._keypair = keypair

            def get_address(self) -> str:
                return str(self._keypair.pubkey())

            async def sign_transaction(
                self, tx_base64: str, network: str
            ) -> str:
                # Decode, sign, re-encode
                return signed_tx_base64
        ```
    """

    def get_address(self) -> str:
        """Get the signer's Solana address (base58-encoded public key)."""
        ...

    async def sign_transaction(
        self,
        tx_base64: str,
        network: str,
    ) -> str:
        """Sign a base64-encoded Solana transaction.

        Args:
            tx_base64: Base64 encoded unsigned/partially-signed transaction
            network: Network identifier (CAIP-2 format)

        Returns:
            Base64 encoded signed transaction
        """
        ...


# Type for transaction builder callback
TransactionBuilder = Callable[[], Awaitable[str]]


class ExactSvmClientScheme:
    """Client scheme for Solana exact payments using SPL Token TransferChecked.

    Creates signed Solana transactions that transfer SPL tokens. The facilitator
    acts as fee payer and co-signs the transaction for broadcast.

    Example:
        ```python
        scheme = ExactSvmClientScheme(signer=my_svm_signer)

        payload = await scheme.create_payment_payload(
            t402_version=2,
            requirements={
                "scheme": "exact",
                "network": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
                "asset": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                "amount": "1000000",
                "payTo": "8GGtWHRQ...",
                "extra": {"feePayer": "facilitator_address"},
            },
            build_transaction=my_tx_builder,
        )
        ```
    """

    scheme = SCHEME_EXACT
    caip_family = "solana:*"

    def __init__(self, signer: ClientSvmSigner):
        """Initialize the SVM client scheme.

        Args:
            signer: SVM signer for signing transactions
        """
        self._signer = signer

    @property
    def address(self) -> str:
        """Return the wallet address."""
        return self._signer.get_address()

    async def create_payment_payload(
        self,
        t402_version: int,
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
        build_transaction: Optional[TransactionBuilder] = None,
    ) -> Dict[str, Any]:
        """Create a payment payload for SVM SPL Token transfer.

        Args:
            t402_version: Protocol version (1 or 2)
            requirements: Payment requirements
            build_transaction: Async function that builds and returns a
                base64-encoded unsigned transaction. If None, the caller
                must provide a pre-built transaction in requirements.

        Returns:
            Payment payload with signed transaction and authorization metadata

        Raises:
            ValueError: If requirements are invalid or transaction build fails
        """
        # Convert to dict for easier access
        if hasattr(requirements, "model_dump"):
            req = requirements.model_dump(by_alias=True)
        else:
            req = dict(requirements)

        # Extract fields
        network = req.get("network", SOLANA_MAINNET)
        asset = req.get("asset", "")
        amount = req.get("amount", "0")
        pay_to = req.get("payTo", "")
        max_timeout = req.get("maxTimeoutSeconds", DEFAULT_VALIDITY_DURATION)
        extra = req.get("extra", {})
        fee_payer = extra.get("feePayer") if extra else None

        # Validate required fields
        if not asset:
            raise ValueError("Asset (token mint address) is required")
        if not pay_to:
            raise ValueError("PayTo address is required")
        if not amount:
            raise ValueError("Amount is required")
        if not validate_svm_address(pay_to):
            raise ValueError(f"Invalid payTo address: {pay_to}")

        # Build the transaction if builder is provided
        if build_transaction is not None:
            unsigned_tx = await build_transaction()
        else:
            raise ValueError(
                "build_transaction callback is required to create the "
                "SPL Token transfer transaction"
            )

        # Sign the transaction
        signed_tx = await self._signer.sign_transaction(
            unsigned_tx,
            normalize_network(network),
        )

        # Calculate validity period
        now = int(time.time())
        valid_until = now + max_timeout

        # Extract transfer details for authorization metadata
        transfer = parse_transfer_checked_instruction(signed_tx)

        authorization: Optional[Dict[str, Any]] = None
        if transfer:
            authorization = {
                "from": self._signer.get_address(),
                "to": pay_to,
                "mint": transfer["mint"],
                "amount": str(transfer["amount"]),
                "validUntil": valid_until,
                "feePayer": fee_payer,
            }
        else:
            # Fallback authorization from requirements
            authorization = {
                "from": self._signer.get_address(),
                "to": pay_to,
                "mint": asset,
                "amount": amount,
                "validUntil": valid_until,
                "feePayer": fee_payer,
            }

        # Build payload
        payload_data = {
            "transaction": signed_tx,
            "authorization": authorization,
        }

        if t402_version == T402_VERSION_V1:
            return {
                "t402Version": T402_VERSION_V1,
                "scheme": self.scheme,
                "network": normalize_network(network),
                "payload": payload_data,
            }

        # V2 format
        return {
            "t402Version": T402_VERSION_V2,
            "payload": payload_data,
        }
