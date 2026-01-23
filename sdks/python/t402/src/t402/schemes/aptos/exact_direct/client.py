"""Aptos Exact-Direct Scheme - Client Implementation.

This module provides the client-side implementation of the exact-direct payment
scheme for Aptos using Fungible Asset transfers.

The client executes ``0x1::primary_fungible_store::transfer`` on-chain and returns
the transaction hash as proof of payment.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Union

from t402.types import (
    PaymentRequirementsV2,
    T402_VERSION_V1,
    T402_VERSION_V2,
)
from t402.schemes.aptos.constants import (
    SCHEME_EXACT_DIRECT,
    CAIP_FAMILY,
    FA_TRANSFER_FUNCTION,
    is_valid_address,
    is_valid_network,
    is_valid_tx_hash,
)
from t402.schemes.aptos.types import (
    ClientAptosSigner,
    ExactDirectPayload,
)


logger = logging.getLogger(__name__)


class ExactDirectAptosClientScheme:
    """Client scheme for Aptos exact-direct payments using FA transfers.

    Executes a fungible asset transfer on-chain and returns the transaction
    hash as proof of payment. The facilitator then verifies the transaction
    details match the payment requirements.

    Example:
        ```python
        scheme = ExactDirectAptosClientScheme(signer=my_aptos_signer)

        payload = await scheme.create_payment_payload(
            t402_version=2,
            requirements={
                "scheme": "exact-direct",
                "network": "aptos:1",
                "asset": "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
                "amount": "1000000",
                "payTo": "0x1234...abcd",
            },
        )
        ```

    Attributes:
        scheme: The scheme identifier ("exact-direct").
        caip_family: The CAIP-2 family pattern ("aptos:*").
    """

    scheme = SCHEME_EXACT_DIRECT
    caip_family = CAIP_FAMILY

    def __init__(self, signer: ClientAptosSigner) -> None:
        """Initialize the Aptos exact-direct client scheme.

        Args:
            signer: An implementation of ClientAptosSigner that can sign
                and submit transactions to the Aptos network.
        """
        self._signer = signer

    @property
    def address(self) -> str:
        """Return the signer's Aptos address."""
        return self._signer.address()

    async def create_payment_payload(
        self,
        t402_version: int,
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Create a payment payload by executing the FA transfer on-chain.

        This method:
        1. Validates the payment requirements.
        2. Builds the FA transfer transaction payload.
        3. Signs and submits the transaction via the signer.
        4. Returns the transaction hash as proof of payment.

        Args:
            t402_version: Protocol version (1 or 2).
            requirements: Payment requirements specifying amount, asset, and payTo.

        Returns:
            Payment payload dict containing the transaction hash and transfer details.

        Raises:
            ValueError: If requirements are invalid (bad address, network, amount, etc.).
            Exception: If the signer fails to sign or submit the transaction.
        """
        # Convert to dict for easier access
        if hasattr(requirements, "model_dump"):
            req = requirements.model_dump(by_alias=True)
        else:
            req = dict(requirements)

        # Extract and validate fields
        network = req.get("network", "")
        asset = req.get("asset", "")
        amount = req.get("amount", "0")
        pay_to = req.get("payTo", "")
        scheme = req.get("scheme", "")

        # Validate scheme
        if scheme and scheme != SCHEME_EXACT_DIRECT:
            raise ValueError(
                f"Invalid scheme: expected {SCHEME_EXACT_DIRECT}, got {scheme}"
            )

        # Validate network
        if not network.startswith("aptos:"):
            raise ValueError(
                f"Invalid network: {network} (expected aptos:* format)"
            )
        if not is_valid_network(network):
            raise ValueError(f"Unsupported network: {network}")

        # Validate payTo address
        if not pay_to:
            raise ValueError("PayTo address is required")
        if not is_valid_address(pay_to):
            raise ValueError(f"Invalid payTo address: {pay_to}")

        # Validate asset (FA metadata address)
        if not asset:
            raise ValueError("Asset (FA metadata address) is required")
        if not is_valid_address(asset):
            raise ValueError(f"Invalid asset address: {asset}")

        # Validate amount
        if not amount:
            raise ValueError("Amount is required")
        try:
            amount_int = int(amount)
        except (ValueError, TypeError):
            raise ValueError(f"Invalid amount: {amount}")
        if amount_int <= 0:
            raise ValueError(f"Amount must be positive, got: {amount}")

        # Validate signer address
        signer_address = self._signer.address()
        if not is_valid_address(signer_address):
            raise ValueError(f"Invalid signer address: {signer_address}")

        # Build the FA transfer transaction payload
        tx_payload: Dict[str, Any] = {
            "type": "entry_function_payload",
            "function": FA_TRANSFER_FUNCTION,
            "type_arguments": [],
            "arguments": [
                asset,    # FA metadata address
                pay_to,   # recipient address
                amount,   # amount (u64 as string)
            ],
        }

        # Sign and submit the transaction
        tx_hash = await self._signer.sign_and_submit(tx_payload, network)

        # Validate returned transaction hash
        if not is_valid_tx_hash(tx_hash):
            raise ValueError(
                f"Signer returned invalid transaction hash: {tx_hash}"
            )

        # Build the exact-direct payload
        aptos_payload = ExactDirectPayload(
            tx_hash=tx_hash,
            from_address=signer_address,
            to_address=pay_to,
            amount=amount,
            metadata_address=asset,
        )

        if t402_version == T402_VERSION_V1:
            return {
                "t402Version": T402_VERSION_V1,
                "scheme": self.scheme,
                "network": network,
                "payload": aptos_payload.to_dict(),
            }

        # V2 format
        return {
            "t402Version": T402_VERSION_V2,
            "payload": aptos_payload.to_dict(),
        }
