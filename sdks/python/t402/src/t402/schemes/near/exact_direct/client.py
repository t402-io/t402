"""NEAR Exact-Direct Scheme - Client Implementation.

This module provides the client-side implementation of the exact-direct payment
scheme for NEAR networks using NEP-141 ft_transfer.

Unlike other schemes where the client creates a signed message for the facilitator
to execute, the exact-direct scheme has the client execute the transfer directly.
The transaction hash is then used as proof of payment.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional, Union

from t402.types import PaymentRequirementsV2
from t402.schemes.near.constants import (
    SCHEME_EXACT_DIRECT,
    CAIP_FAMILY,
    DEFAULT_GAS_INT,
    STORAGE_DEPOSIT,
    FUNCTION_FT_TRANSFER,
    is_valid_network,
)
from t402.schemes.near.types import (
    ClientNearSigner,
    ExactDirectPayload,
    is_valid_account_id,
)


logger = logging.getLogger(__name__)


class ExactDirectNearClientConfig:
    """Configuration for the ExactDirectNearClientScheme.

    Attributes:
        memo: Optional memo to include in the ft_transfer call.
        gas_amount: Gas to attach to the ft_transfer call (default: 30 TGas).
    """

    def __init__(
        self,
        memo: Optional[str] = None,
        gas_amount: Optional[int] = None,
    ) -> None:
        self.memo = memo
        self.gas_amount = gas_amount or DEFAULT_GAS_INT


class ExactDirectNearClientScheme:
    """Client scheme for NEAR exact-direct payments using NEP-141 ft_transfer.

    This scheme executes the token transfer on-chain directly and returns the
    transaction hash as proof of payment. The facilitator then verifies the
    transaction was successful.

    Example:
        ```python
        class MyNearSigner:
            def account_id(self) -> str:
                return "alice.near"

            async def sign_and_send_transaction(
                self, receiver_id, actions, network
            ) -> str:
                # Execute the transaction
                return "Abc123TxHash..."

        signer = MyNearSigner()
        scheme = ExactDirectNearClientScheme(signer)

        payload = await scheme.create_payment_payload(
            t402_version=2,
            requirements=requirements,
        )
        ```
    """

    def __init__(
        self,
        signer: ClientNearSigner,
        config: Optional[ExactDirectNearClientConfig] = None,
    ) -> None:
        """Initialize with a NEAR signer.

        Args:
            signer: Any object implementing the ClientNearSigner protocol.
            config: Optional configuration for the client scheme.
        """
        self._signer = signer
        self._config = config or ExactDirectNearClientConfig()

    @property
    def scheme(self) -> str:
        """The scheme identifier."""
        return SCHEME_EXACT_DIRECT

    @property
    def caip_family(self) -> str:
        """The CAIP-2 family pattern for NEAR networks."""
        return CAIP_FAMILY

    @property
    def account_id(self) -> str:
        """Get the signer's NEAR account ID."""
        return self._signer.account_id()

    async def create_payment_payload(
        self,
        t402_version: int,
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Create a payment payload by executing ft_transfer on-chain.

        Executes a NEP-141 ft_transfer to the specified recipient and returns
        the transaction hash as proof of payment.

        Args:
            t402_version: The T402 protocol version.
            requirements: Payment requirements with amount, asset, payTo, network.

        Returns:
            Dict with t402Version and payload containing txHash, from, to, amount.

        Raises:
            ValueError: If requirements are invalid (bad network, missing fields,
                invalid account IDs).
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

        # Validate required fields
        if not asset:
            raise ValueError("Asset (token contract address) is required")
        if not pay_to:
            raise ValueError("payTo address is required")
        if not amount:
            raise ValueError("Amount is required")

        # Validate account IDs
        if not is_valid_account_id(pay_to):
            raise ValueError(f"Invalid recipient account ID: {pay_to}")
        sender_id = self._signer.account_id()
        if not is_valid_account_id(sender_id):
            raise ValueError(f"Invalid sender account ID: {sender_id}")

        # Build ft_transfer arguments
        ft_transfer_args: Dict[str, Any] = {
            "receiver_id": pay_to,
            "amount": amount,
        }
        if self._config.memo:
            ft_transfer_args["memo"] = self._config.memo

        # Build the function call action
        actions: List[Dict[str, Any]] = [
            {
                "FunctionCall": {
                    "method_name": FUNCTION_FT_TRANSFER,
                    "args": json.dumps(ft_transfer_args),
                    "gas": self._config.gas_amount,
                    "deposit": STORAGE_DEPOSIT,
                }
            }
        ]

        # Execute the transfer via the signer
        try:
            tx_hash = await self._signer.sign_and_send_transaction(
                receiver_id=asset,
                actions=actions,
                network=network,
            )
        except Exception as e:
            raise RuntimeError(f"Failed to execute ft_transfer: {e}") from e

        # Build the payload
        payload = ExactDirectPayload(
            tx_hash=tx_hash,
            from_account=sender_id,
            to_account=pay_to,
            amount=amount,
        )

        return {
            "t402Version": t402_version,
            "payload": payload.to_map(),
        }
