"""Tezos Exact-Direct Scheme - Client Implementation.

This module provides the client-side implementation of the exact-direct payment
scheme for Tezos using FA2 token transfers.

In the exact-direct scheme, the client directly executes the FA2 transfer on-chain
and provides the operation hash as proof of payment. This differs from off-chain
authorization schemes where the facilitator executes the transfer.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Union

from t402.types import (
    PaymentRequirementsV2,
    T402_VERSION_V1,
    T402_VERSION_V2,
)
from t402.schemes.tezos.constants import (
    SCHEME_EXACT_DIRECT,
    is_tezos_network,
    is_valid_address,
    parse_asset_identifier,
)
from t402.schemes.tezos.types import (
    ClientTezosSigner,
    ExactDirectPayload,
)


logger = logging.getLogger(__name__)


class ExactDirectTezosClient:
    """Client scheme for Tezos exact-direct payments using FA2 transfers.

    This scheme executes FA2 token transfers directly on-chain and provides
    the operation hash as proof of payment. The facilitator verifies the
    operation status and transfer details.

    Example:
        ```python
        from t402.schemes.tezos import ExactDirectTezosClient

        class MyTezosSigner:
            def address(self) -> str:
                return "tz1..."

            async def transfer_fa2(
                self, contract, token_id, to, amount, network
            ) -> str:
                # Execute FA2 transfer
                return "oo7bHf..."  # operation hash

        signer = MyTezosSigner()
        client = ExactDirectTezosClient(signer=signer)

        payload = await client.create_payment_payload(
            t402_version=2,
            requirements={
                "scheme": "exact-direct",
                "network": "tezos:NetXdQprcVkpaWU",
                "asset": "tezos:NetXdQprcVkpaWU/fa2:KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o/0",
                "amount": "1000000",
                "payTo": "tz1...",
                "maxTimeoutSeconds": 300,
            },
        )
        ```
    """

    scheme = SCHEME_EXACT_DIRECT
    caip_family = "tezos:*"

    def __init__(self, signer: ClientTezosSigner):
        """Initialize the Tezos exact-direct client.

        Args:
            signer: A Tezos signer implementing the ClientTezosSigner protocol.
                    Must provide address() and transfer_fa2() methods.
        """
        self._signer = signer

    @property
    def address(self) -> str:
        """Get the signer's Tezos address."""
        return self._signer.address()

    async def create_payment_payload(
        self,
        t402_version: int,
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Execute FA2 transfer and create payment payload with operation hash.

        This method:
        1. Validates the payment requirements
        2. Parses the CAIP-19 asset identifier
        3. Executes the FA2 transfer on-chain via the signer
        4. Returns a payload containing the operation hash as proof

        Args:
            t402_version: Protocol version (1 or 2)
            requirements: Payment requirements specifying amount, network, asset, payTo

        Returns:
            Payment payload dict containing the operation hash and transfer metadata

        Raises:
            ValueError: If requirements are invalid (wrong scheme, network, address, etc.)
            Exception: If the FA2 transfer fails
        """
        # Convert to dict for easier access
        if hasattr(requirements, "model_dump"):
            req = requirements.model_dump(by_alias=True)
        else:
            req = dict(requirements)

        # Validate requirements
        self._validate_requirements(req)

        # Extract fields
        network = req.get("network", "")
        asset = req.get("asset", "")
        amount = req.get("amount", "0")
        pay_to = req.get("payTo") or req.get("pay_to", "")

        # Parse asset to get contract address and token ID
        asset_info = parse_asset_identifier(asset)
        contract_address = asset_info["contract_address"]
        token_id = asset_info["token_id"]

        # Parse amount as integer
        amount_int = int(amount)

        # Execute FA2 transfer on-chain
        logger.debug(
            "Executing FA2 transfer: contract=%s, token_id=%d, to=%s, amount=%d",
            contract_address,
            token_id,
            pay_to,
            amount_int,
        )
        op_hash = await self._signer.transfer_fa2(
            contract=contract_address,
            token_id=token_id,
            to=pay_to,
            amount=amount_int,
            network=network,
        )

        # Build the payload
        payload_data = ExactDirectPayload(
            op_hash=op_hash,
            from_=self._signer.address(),
            to=pay_to,
            amount=amount,
            contract_address=contract_address,
            token_id=token_id,
        )

        if t402_version == T402_VERSION_V1:
            return {
                "t402Version": T402_VERSION_V1,
                "scheme": self.scheme,
                "network": network,
                "payload": payload_data.to_map(),
            }

        # V2 format
        return {
            "t402Version": T402_VERSION_V2,
            "payload": payload_data.to_map(),
        }

    def _validate_requirements(self, req: Dict[str, Any]) -> None:
        """Validate payment requirements for the exact-direct scheme.

        Args:
            req: Requirements dict

        Raises:
            ValueError: If any validation check fails
        """
        # Check scheme
        scheme = req.get("scheme", "")
        if scheme and scheme != SCHEME_EXACT_DIRECT:
            raise ValueError(
                f"Invalid scheme: expected {SCHEME_EXACT_DIRECT}, got {scheme}"
            )

        # Check network is Tezos
        network = req.get("network", "")
        if not is_tezos_network(network):
            raise ValueError(f"Invalid network: {network} (expected tezos:*)")

        # Check payTo address
        pay_to = req.get("payTo") or req.get("pay_to", "")
        if not pay_to:
            raise ValueError("PayTo address is required")
        if not is_valid_address(pay_to):
            raise ValueError(f"Invalid payTo address: {pay_to}")

        # Check amount
        amount = req.get("amount", "")
        if not amount:
            raise ValueError("Amount is required")
        try:
            amount_int = int(amount)
            if amount_int <= 0:
                raise ValueError(
                    f"Invalid amount: {amount} (must be a positive integer)"
                )
        except ValueError:
            raise ValueError(
                f"Invalid amount: {amount} (must be a positive integer string)"
            )

        # Check asset
        asset = req.get("asset", "")
        if not asset:
            raise ValueError("Asset is required")
        # This will raise ValueError if invalid
        parse_asset_identifier(asset)
