"""Stellar Exact Scheme - Client Implementation.

This module provides the client-side implementation of the exact payment scheme
for Stellar network using Soroban token transfers (SEP-41).
"""

from __future__ import annotations

import math
from typing import Any, Dict, Protocol, Union

from t402.types import (
    PaymentRequirementsV2,
    T402_VERSION_V1,
    T402_VERSION_V2,
)
from t402.stellar import (
    StellarAuthorization,
    StellarPaymentPayload,
    validate_stellar_address,
    LEDGER_TIME_SECONDS,
    DEFAULT_TIMEOUT_SECONDS,
)


# Constants
SCHEME_EXACT = "exact"


class StellarSigner(Protocol):
    """Protocol for Stellar wallet signing operations.

    Implementations should provide the account address, current ledger
    retrieval, and transaction signing capabilities.

    Example implementation:
        ```python
        class MyStellarSigner:
            def __init__(self, keypair, server):
                self._keypair = keypair
                self._server = server

            @property
            def address(self) -> str:
                return self._keypair.public_key

            async def get_current_ledger(self) -> int:
                return await self._server.get_current_ledger()

            async def sign_transaction(
                self,
                token_contract: str,
                to: str,
                amount: int,
                max_ledger: int,
                network: str,
            ) -> str:
                # Build and sign the Soroban transaction
                return signed_tx_xdr
        ```
    """

    @property
    def address(self) -> str:
        """Return the account address (G-account)."""
        ...

    async def get_current_ledger(self) -> int:
        """Get the current ledger sequence number."""
        ...

    async def sign_transaction(
        self,
        token_contract: str,
        to: str,
        amount: int,
        max_ledger: int,
        network: str,
    ) -> str:
        """Sign a Soroban token transfer transaction.

        Args:
            token_contract: Token contract address (C-account)
            to: Destination address (G-account)
            amount: Amount in smallest units (stroops)
            max_ledger: Maximum ledger for transaction validity
            network: Network identifier (CAIP-2)

        Returns:
            Signed transaction XDR (base64-encoded)
        """
        ...


class ExactStellarClientScheme:
    """Client scheme for Stellar exact payments using Soroban token transfers.

    Creates signed Soroban transactions that can be submitted by a facilitator
    to complete the payment.

    Example:
        ```python
        scheme = ExactStellarClientScheme(signer=my_stellar_signer)

        payload = await scheme.create_payment_payload(
            t402_version=2,
            requirements={
                "scheme": "exact",
                "network": "stellar:pubnet",
                "asset": "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI",
                "amount": "10000000",
                "payTo": "GABC...",
                "maxTimeoutSeconds": 60,
            },
        )
        ```
    """

    scheme = SCHEME_EXACT
    caip_family = "stellar:*"

    def __init__(self, signer: StellarSigner):
        """Initialize the Stellar client scheme.

        Args:
            signer: Stellar signer for signing transactions
        """
        self._signer = signer

    @property
    def address(self) -> str:
        """Return the wallet address."""
        return self._signer.address

    async def create_payment_payload(
        self,
        t402_version: int,
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Create a payment payload for Stellar token transfer.

        Args:
            t402_version: Protocol version (1 or 2)
            requirements: Payment requirements

        Returns:
            Payment payload with signed transaction and authorization metadata
        """
        # Convert to dict for easier access
        if hasattr(requirements, "model_dump"):
            req = requirements.model_dump(by_alias=True)
        else:
            req = dict(requirements)

        # Extract fields
        network = req.get("network", "")
        asset = req.get("asset", "")
        amount = req.get("amount", "0")
        pay_to = req.get("payTo", "")
        max_timeout = req.get("maxTimeoutSeconds", DEFAULT_TIMEOUT_SECONDS)

        # Validate required fields
        if not asset:
            raise ValueError("Asset (token contract address) is required")
        if not pay_to:
            raise ValueError("PayTo address is required")
        if not amount:
            raise ValueError("Amount is required")
        if not validate_stellar_address(pay_to):
            raise ValueError(f"Invalid payTo address: {pay_to}")

        # Parse amount
        token_amount = int(amount)

        # Get current ledger for validity calculation
        current_ledger = await self._signer.get_current_ledger()
        max_ledger = current_ledger + math.ceil(max_timeout / LEDGER_TIME_SECONDS)

        # Sign the transaction
        signed_tx = await self._signer.sign_transaction(
            token_contract=asset,
            to=pay_to,
            amount=token_amount,
            max_ledger=max_ledger,
            network=network,
        )

        # Build authorization metadata
        authorization = StellarAuthorization(
            from_=self._signer.address,
            to=pay_to,
            token_contract=asset,
            amount=str(token_amount),
            max_ledger=max_ledger,
            network=network,
        )

        # Build payload
        payload_data = StellarPaymentPayload(
            signed_tx=signed_tx,
            authorization=authorization,
        )

        if t402_version == T402_VERSION_V1:
            return {
                "t402Version": T402_VERSION_V1,
                "scheme": self.scheme,
                "network": network,
                "payload": payload_data.model_dump(by_alias=True),
            }

        # V2 format
        return {
            "t402Version": T402_VERSION_V2,
            "payload": payload_data.model_dump(by_alias=True),
        }
