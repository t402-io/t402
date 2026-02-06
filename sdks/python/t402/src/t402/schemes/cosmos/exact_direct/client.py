"""Cosmos/Noble Exact-Direct Scheme - Client Implementation.

This module provides the client-side implementation of the exact-direct payment
scheme for Cosmos/Noble networks using bank MsgSend.

Unlike other schemes where the client creates a signed message for the facilitator
to execute, the exact-direct scheme has the client execute the transfer directly.
The transaction hash is then used as proof of payment.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional, Union

from t402.types import PaymentRequirementsV2
from t402.schemes.cosmos.constants import (
    SCHEME_EXACT_DIRECT,
    CAIP_FAMILY,
    USDC_DENOM,
    is_valid_network,
    is_valid_address,
    get_network_config,
    get_token_info,
)
from t402.schemes.cosmos.types import (
    ClientCosmosSigner,
    ExactDirectPayload,
)


logger = logging.getLogger(__name__)


class ExactDirectCosmosClientConfig:
    """Configuration for the ExactDirectCosmosClientScheme.

    Attributes:
        memo: Optional memo to include in the transaction.
    """

    def __init__(
        self,
        memo: Optional[str] = None,
    ) -> None:
        self.memo = memo


class ExactDirectCosmosClientScheme:
    """Client scheme for Cosmos/Noble exact-direct payments using bank MsgSend.

    This scheme executes the token transfer on-chain directly and returns the
    transaction hash as proof of payment. The facilitator then verifies the
    transaction was successful.

    Example:
        ```python
        class MyCosmosSigner:
            def address(self) -> str:
                return "noble1abc..."

            async def send_tokens(
                self, network, to, amount, denom
            ) -> str:
                # Execute the transaction
                return "AABB1122..."

        signer = MyCosmosSigner()
        scheme = ExactDirectCosmosClientScheme(signer)

        payload = await scheme.create_payment_payload(
            t402_version=2,
            requirements=requirements,
        )
        ```
    """

    def __init__(
        self,
        signer: ClientCosmosSigner,
        config: Optional[ExactDirectCosmosClientConfig] = None,
    ) -> None:
        """Initialize with a Cosmos signer.

        Args:
            signer: Any object implementing the ClientCosmosSigner protocol.
            config: Optional configuration for the client scheme.
        """
        self._signer = signer
        self._config = config or ExactDirectCosmosClientConfig()

    @property
    def scheme(self) -> str:
        """The scheme identifier."""
        return SCHEME_EXACT_DIRECT

    @property
    def caip_family(self) -> str:
        """The CAIP-2 family pattern for Cosmos networks."""
        return CAIP_FAMILY

    @property
    def signer_address(self) -> str:
        """Get the signer's Cosmos address."""
        return self._signer.address()

    async def create_payment_payload(
        self,
        t402_version: int,
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Create a payment payload by executing a bank send on-chain.

        Executes a Cosmos bank MsgSend to the specified recipient and returns
        the transaction hash as proof of payment.

        Args:
            t402_version: The T402 protocol version.
            requirements: Payment requirements with amount, asset, payTo, network.

        Returns:
            Dict with t402Version and payload containing txHash, from, to, amount.

        Raises:
            ValueError: If requirements are invalid (bad network, missing fields,
                invalid addresses).
            RuntimeError: If the transaction execution fails.
        """
        # Extract requirements as dict
        if hasattr(requirements, "model_dump"):
            req = requirements.model_dump(by_alias=True)
        else:
            req = dict(requirements)

        network = req.get("network", "")
        asset = req.get("asset", "")
        pay_to = req.get("payTo") or req.get("pay_to", "")
        amount = req.get("amount", "")

        # Validate network
        if not is_valid_network(network):
            raise ValueError(f"Unsupported network: {network}")

        # Get network config for address validation
        config = get_network_config(network)
        if config is None:
            raise ValueError(f"Unsupported network: {network}")

        # Validate required fields
        if not pay_to:
            raise ValueError("payTo address is required")
        if not amount:
            raise ValueError("Amount is required")

        # Determine denom
        denom = USDC_DENOM
        if asset:
            # Check if asset is a symbol or denom
            token = get_token_info(network, asset)
            if token:
                denom = token.denom
            else:
                # Assume it's already a denom
                denom = asset

        # Validate recipient address
        if not is_valid_address(pay_to, config.bech32_prefix):
            raise ValueError(f"Invalid recipient address: {pay_to}")

        # Validate sender address
        sender = self._signer.address()
        if not is_valid_address(sender, config.bech32_prefix):
            raise ValueError(f"Invalid sender address: {sender}")

        # Execute the transfer via the signer
        try:
            tx_hash = await self._signer.send_tokens(
                network=network,
                to=pay_to,
                amount=amount,
                denom=denom,
            )
        except Exception as e:
            raise RuntimeError(f"Failed to send tokens: {e}") from e

        # Build the payload
        payload = ExactDirectPayload(
            tx_hash=tx_hash,
            from_address=sender,
            to_address=pay_to,
            amount=amount,
            denom=denom,
        )

        return {
            "t402Version": t402_version,
            "payload": payload.to_map(),
        }
