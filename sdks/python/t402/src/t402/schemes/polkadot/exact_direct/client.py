"""Polkadot Exact-Direct Scheme - Client Implementation.

This module provides the client-side implementation of the exact-direct
payment scheme for Polkadot Asset Hub networks.

The client:
1. Builds an assets.transfer_keep_alive extrinsic
2. Signs and submits it on-chain via the signer
3. Returns the extrinsic hash, block hash, and index as payment proof
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional, Union

from t402.types import (
    PaymentRequirementsV2,
    T402_VERSION_V1,
    T402_VERSION_V2,
)
from t402.schemes.polkadot.constants import (
    SCHEME_EXACT_DIRECT,
    get_network_config,
    is_polkadot_network,
)
from t402.schemes.polkadot.types import (
    ClientPolkadotSigner,
    ExactDirectPayload,
    is_valid_ss58_address,
    parse_asset_identifier,
)


logger = logging.getLogger(__name__)


class ExactDirectPolkadotClientScheme:
    """Client scheme for Polkadot exact-direct payments.

    Executes on-chain asset transfers and returns the transaction proof
    as a payment payload.

    Example:
        ```python
        scheme = ExactDirectPolkadotClientScheme(signer=my_polkadot_signer)

        payload = await scheme.create_payment_payload(
            t402_version=2,
            requirements={
                "scheme": "exact-direct",
                "network": "polkadot:68d56f15f85d3136970ec16946040bc1",
                "asset": "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984",
                "amount": "1000000",
                "payTo": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
                "maxTimeoutSeconds": 300,
            },
        )
        ```
    """

    scheme = SCHEME_EXACT_DIRECT
    caip_family = "polkadot:*"

    def __init__(
        self,
        signer: ClientPolkadotSigner,
        rpc_url: Optional[str] = None,
    ):
        """Initialize the Polkadot client scheme.

        Args:
            signer: Polkadot signer for signing and submitting extrinsics
            rpc_url: Optional RPC endpoint override for the network
        """
        self._signer = signer
        self._rpc_url = rpc_url

    @property
    def address(self) -> str:
        """Return the signer's SS58 address."""
        return self._signer.address()

    async def create_payment_payload(
        self,
        t402_version: int,
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Create a payment payload by executing an on-chain transfer.

        Validates the requirements, builds an assets.transfer_keep_alive
        extrinsic, signs and submits it, then returns the proof.

        Args:
            t402_version: Protocol version (1 or 2)
            requirements: Payment requirements specifying the transfer details

        Returns:
            Payment payload dictionary with extrinsic proof

        Raises:
            ValueError: If requirements are invalid (bad network, address, amount, etc.)
            Exception: If signing or submission fails
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
        extra = req.get("extra", {})

        # Validate network
        if not is_polkadot_network(network):
            raise ValueError(f"Unsupported network: {network}")

        network_config = get_network_config(network)

        # Validate payTo address
        if not pay_to:
            raise ValueError("payTo address is required")
        if not is_valid_ss58_address(pay_to):
            raise ValueError(f"Invalid payTo address: {pay_to}")

        # Validate amount
        if not amount:
            raise ValueError("Amount is required")
        try:
            amount_int = int(amount)
        except (ValueError, TypeError):
            raise ValueError(f"Invalid amount format: {amount}")
        if amount_int <= 0:
            raise ValueError(f"Amount must be positive: {amount}")

        # Resolve asset ID
        asset_id = self._resolve_asset_id(asset, extra, network_config)

        # Get sender address
        from_address = self._signer.address()
        if not from_address:
            raise ValueError("Signer address is empty")

        # Build the extrinsic call (assets.transfer_keep_alive)
        call = {
            "assetId": asset_id,
            "target": pay_to,
            "amount": amount,
        }

        # Sign and submit the extrinsic
        result = await self._signer.sign_and_submit(call, network)

        # Validate result
        extrinsic_hash = result.get("extrinsicHash", "")
        block_hash = result.get("blockHash", "")
        extrinsic_index = result.get("extrinsicIndex", 0)

        if not extrinsic_hash and not block_hash:
            raise ValueError(
                "Extrinsic result missing both extrinsic hash and block hash"
            )

        # Build the payload
        payload = ExactDirectPayload(
            extrinsic_hash=extrinsic_hash,
            block_hash=block_hash,
            extrinsic_index=extrinsic_index,
            from_address=from_address,
            to_address=pay_to,
            amount=amount,
            asset_id=asset_id,
        )

        if t402_version == T402_VERSION_V1:
            return {
                "t402Version": T402_VERSION_V1,
                "scheme": self.scheme,
                "network": network,
                "payload": payload.to_dict(),
            }

        # V2 format
        return {
            "t402Version": T402_VERSION_V2,
            "payload": payload.to_dict(),
        }

    def _resolve_asset_id(
        self,
        asset: str,
        extra: Dict[str, Any],
        network_config: Any,
    ) -> int:
        """Resolve the asset ID from requirements fields.

        Tries to determine the asset ID from:
        1. The extra.assetId field
        2. The CAIP-19 asset identifier
        3. The network's default token

        Args:
            asset: CAIP-19 asset identifier string
            extra: Extra metadata from requirements
            network_config: Network configuration

        Returns:
            Resolved asset ID

        Raises:
            ValueError: If asset ID cannot be determined
        """
        # Try extra.assetId first
        if extra and "assetId" in extra:
            asset_id_val = extra["assetId"]
            if isinstance(asset_id_val, (int, float)):
                return int(asset_id_val)
            if isinstance(asset_id_val, str):
                try:
                    return int(asset_id_val)
                except ValueError:
                    pass

        # Try parsing CAIP-19 asset identifier
        if asset:
            parsed_id = parse_asset_identifier(asset)
            if parsed_id is not None:
                return parsed_id

        # Fall back to network default
        return network_config.default_token.asset_id
