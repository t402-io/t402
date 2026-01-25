"""Stacks Exact-Direct Scheme - Client Implementation.

This module provides the client-side implementation of the exact-direct
payment scheme for Stacks (Bitcoin L2) networks.

The client:
1. Builds a SIP-010 token transfer contract call
2. Signs and submits it on-chain via the signer
3. Returns the transaction ID as payment proof
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Union

from t402.types import (
    PaymentRequirementsV2,
    T402_VERSION_V1,
    T402_VERSION_V2,
)
from t402.schemes.stacks.constants import (
    SCHEME_EXACT_DIRECT,
    get_network_config,
    is_stacks_network,
)
from t402.schemes.stacks.types import (
    ClientStacksSigner,
    ExactDirectPayload,
    is_valid_stacks_address,
    is_valid_tx_id,
    parse_contract_identifier,
)


logger = logging.getLogger(__name__)


class ExactDirectStacksClientScheme:
    """Client scheme for Stacks exact-direct payments.

    Executes on-chain SIP-010 token transfers and returns the transaction
    ID as a payment payload.

    Example:
        ```python
        scheme = ExactDirectStacksClientScheme(signer=my_stacks_signer)

        payload = await scheme.create_payment_payload(
            t402_version=2,
            requirements={
                "scheme": "exact-direct",
                "network": "stacks:1",
                "asset": "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
                "amount": "1000000",
                "payTo": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
                "maxTimeoutSeconds": 300,
            },
        )
        ```
    """

    scheme = SCHEME_EXACT_DIRECT
    caip_family = "stacks:*"

    def __init__(
        self,
        signer: ClientStacksSigner,
    ):
        """Initialize the Stacks client scheme.

        Args:
            signer: Stacks signer for signing and submitting token transfers
        """
        self._signer = signer

    @property
    def address(self) -> str:
        """Return the signer's Stacks address."""
        return self._signer.address

    async def create_payment_payload(
        self,
        t402_version: int,
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Create a payment payload by executing an on-chain token transfer.

        Validates the requirements, resolves the contract address, calls
        the signer to execute the transfer, then returns the proof.

        Args:
            t402_version: Protocol version (1 or 2)
            requirements: Payment requirements specifying the transfer details

        Returns:
            Payment payload dictionary with transaction proof

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
        if not is_stacks_network(network):
            raise ValueError(f"Unsupported network: {network}")

        network_config = get_network_config(network)

        # Validate payTo address
        if not pay_to:
            raise ValueError("payTo address is required")
        if not is_valid_stacks_address(pay_to):
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

        # Resolve contract address
        contract_address = self._resolve_contract_address(
            asset, extra, network_config
        )

        # Get sender address
        from_address = self._signer.address
        if not from_address:
            raise ValueError("Signer address is empty")

        # Execute the token transfer
        tx_id = await self._signer.transfer_token(
            contract_address=contract_address,
            to=pay_to,
            amount=amount_int,
        )

        # Validate result
        if not tx_id:
            raise ValueError("Transfer returned empty transaction ID")

        if not is_valid_tx_id(tx_id):
            raise ValueError(f"Invalid transaction ID format: {tx_id}")

        # Build the payload
        payload = ExactDirectPayload(
            tx_id=tx_id,
            from_address=from_address,
            to_address=pay_to,
            amount=amount,
            contract_address=contract_address,
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

    def _resolve_contract_address(
        self,
        asset: str,
        extra: Dict[str, Any],
        network_config: Any,
    ) -> str:
        """Resolve the contract address from requirements fields.

        Tries to determine the contract address from:
        1. The extra.contractAddress field
        2. The CAIP-19 asset identifier
        3. The network's default token

        Args:
            asset: CAIP-19 asset identifier string
            extra: Extra metadata from requirements
            network_config: Network configuration

        Returns:
            Resolved contract address

        Raises:
            ValueError: If contract address cannot be determined
        """
        # Try extra.contractAddress first
        if extra and "contractAddress" in extra:
            contract_val = extra["contractAddress"]
            if isinstance(contract_val, str) and contract_val:
                return contract_val

        # Try parsing CAIP-19 asset identifier
        if asset:
            parsed = parse_contract_identifier(asset)
            if parsed is not None:
                return parsed

        # Fall back to network default
        return network_config.default_token.contract_address
