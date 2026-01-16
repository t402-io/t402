"""TRON Exact Scheme - Client Implementation.

This module provides the client-side implementation of the exact payment scheme
for TRON network using TRC-20 token transfers.
"""

from __future__ import annotations

import time
from typing import Any, Dict, Optional, Protocol, Union

from t402.types import (
    PaymentRequirementsV2,
    T402_VERSION_V1,
    T402_VERSION_V2,
)
from t402.tron import (
    TronAuthorization,
    TronPaymentPayload,
    DEFAULT_FEE_LIMIT,
    validate_tron_address,
)


# Constants
SCHEME_EXACT = "exact"


class BlockInfo(Protocol):
    """Protocol for TRON block reference info."""

    @property
    def ref_block_bytes(self) -> str:
        """Reference block bytes (4 bytes hex)."""
        ...

    @property
    def ref_block_hash(self) -> str:
        """Reference block hash (8 bytes hex)."""
        ...

    @property
    def expiration(self) -> int:
        """Transaction expiration timestamp in milliseconds."""
        ...


class TronSigner(Protocol):
    """Protocol for TRON wallet signing operations.

    Implementations should provide wallet address, block info retrieval,
    and transaction signing capabilities.

    Example implementation with tronpy:
        ```python
        class MyTronSigner:
            def __init__(self, private_key, client):
                self._private_key = private_key
                self._client = client
                self._address = private_key_to_address(private_key)

            @property
            def address(self) -> str:
                return self._address

            async def get_block_info(self) -> BlockInfo:
                block = await self._client.get_latest_block()
                return {
                    "ref_block_bytes": block.ref_block_bytes,
                    "ref_block_hash": block.ref_block_hash,
                    "expiration": int(time.time() * 1000) + 3600000,
                }

            async def sign_transaction(
                self,
                contract_address: str,
                to: str,
                amount: str,
                fee_limit: int,
                expiration: int,
            ) -> str:
                # Build and sign TRC-20 transfer transaction
                return signed_transaction_hex
        ```
    """

    @property
    def address(self) -> str:
        """Return the wallet address (T-prefix base58check)."""
        ...

    async def get_block_info(self) -> Dict[str, Any]:
        """Get the current reference block info for transaction building.

        Returns:
            Dict with ref_block_bytes, ref_block_hash, and expiration
        """
        ...

    async def sign_transaction(
        self,
        contract_address: str,
        to: str,
        amount: str,
        fee_limit: int,
        expiration: int,
    ) -> str:
        """Sign a TRC-20 transfer transaction.

        Args:
            contract_address: TRC-20 contract address
            to: Recipient address
            amount: Amount in smallest units
            fee_limit: Fee limit in SUN
            expiration: Transaction expiration in milliseconds

        Returns:
            Hex-encoded signed transaction
        """
        ...


class ExactTronClientScheme:
    """Client scheme for TRON exact payments using TRC-20 transfers.

    Creates signed TRC-20 transfer transactions that can be verified and
    broadcast by a facilitator to complete the payment.

    Example:
        ```python
        scheme = ExactTronClientScheme(signer=my_tron_signer)

        payload = await scheme.create_payment_payload(
            t402_version=2,
            requirements={
                "scheme": "exact",
                "network": "tron:mainnet",
                "asset": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
                "amount": "1000000",
                "payTo": "TPayToAddress...",
                "maxTimeoutSeconds": 300,
            },
        )
        ```
    """

    scheme = SCHEME_EXACT
    caip_family = "tron:*"

    def __init__(
        self,
        signer: TronSigner,
        fee_limit: Optional[int] = None,
    ):
        """Initialize the TRON client scheme.

        Args:
            signer: TRON signer for signing transactions
            fee_limit: Override fee limit in SUN (default: 100 TRX)
        """
        self._signer = signer
        self._fee_limit = fee_limit or DEFAULT_FEE_LIMIT

    @property
    def address(self) -> str:
        """Return the wallet address."""
        return self._signer.address

    async def create_payment_payload(
        self,
        t402_version: int,
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Create a payment payload for TRC-20 transfer.

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
        max_timeout = req.get("maxTimeoutSeconds", 300)

        # Validate required fields
        if not asset:
            raise ValueError("Asset (TRC-20 contract address) is required")
        if not pay_to:
            raise ValueError("PayTo address is required")
        if not amount:
            raise ValueError("Amount is required")

        # Validate addresses
        if not validate_tron_address(asset):
            raise ValueError(f"Invalid TRC-20 contract address: {asset}")
        if not validate_tron_address(pay_to):
            raise ValueError(f"Invalid payTo address: {pay_to}")
        if not validate_tron_address(self._signer.address):
            raise ValueError(f"Invalid signer address: {self._signer.address}")

        # Get block info for transaction
        block_info = await self._signer.get_block_info()
        ref_block_bytes = block_info.get("ref_block_bytes", "")
        ref_block_hash = block_info.get("ref_block_hash", "")

        # Calculate expiration
        now_ms = int(time.time() * 1000)
        expiration = block_info.get("expiration") or (now_ms + max_timeout * 1000)

        # Sign the transaction
        signed_transaction = await self._signer.sign_transaction(
            contract_address=asset,
            to=pay_to,
            amount=amount,
            fee_limit=self._fee_limit,
            expiration=expiration,
        )

        # Build authorization metadata
        authorization = TronAuthorization(
            from_=self._signer.address,
            to=pay_to,
            contract_address=asset,
            amount=amount,
            expiration=expiration,
            ref_block_bytes=ref_block_bytes,
            ref_block_hash=ref_block_hash,
            timestamp=now_ms,
        )

        # Build payload
        payload_data = TronPaymentPayload(
            signed_transaction=signed_transaction,
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
