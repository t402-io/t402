"""EVM Permit2 Scheme - Client Implementation.

This module provides the client-side implementation of the Permit2 payment scheme
for EVM networks using Uniswap's Permit2 PermitTransferFrom with EIP-712 signatures.
"""

from __future__ import annotations

import secrets
import time
from typing import Any, Dict, Protocol, Union, runtime_checkable

from t402.types import PaymentRequirementsV2


# Constants
SCHEME_PERMIT2 = "permit2"
PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3"


@runtime_checkable
class Permit2EvmSigner(Protocol):
    """Protocol for EVM signing operations needed by Permit2."""

    @property
    def address(self) -> str:
        """Get the signer's address."""
        ...

    def sign_typed_data(
        self,
        domain_data: Dict[str, Any],
        message_types: Dict[str, Any],
        message_data: Dict[str, Any],
    ) -> Any:
        """Sign EIP-712 typed data."""
        ...


class Permit2EvmClientScheme:
    """Client scheme for EVM Permit2 payments.

    This scheme creates payment payloads using Uniswap Permit2's
    PermitTransferFrom, which allows gasless token transfers with
    EIP-712 signature authorization.

    Example:
        ```python
        from eth_account import Account

        account = Account.from_key("0x...")
        scheme = Permit2EvmClientScheme(account)

        payload = await scheme.create_payment_payload(
            t402_version=2,
            requirements=requirements,
        )
        ```
    """

    scheme = SCHEME_PERMIT2
    caip_family = "eip155:*"

    def __init__(self, signer: Permit2EvmSigner):
        self._signer = signer

    @property
    def address(self) -> str:
        return self._signer.address

    async def create_payment_payload(
        self,
        t402_version: int,
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Create a Permit2 payment payload.

        Creates a PermitTransferFrom EIP-712 typed data signature.

        Args:
            t402_version: Protocol version (1 or 2)
            requirements: Payment requirements with amount, asset, payTo, etc.

        Returns:
            Dict with t402Version and payload containing permit, transferDetails,
            signature, and owner.
        """
        if hasattr(requirements, "model_dump"):
            req = requirements.model_dump(by_alias=True)
        else:
            req = dict(requirements)

        network = req.get("network", "")
        chain_id = self._get_chain_id(network)
        amount = str(req.get("amount") or req.get("maxAmountRequired", "0"))
        pay_to = req.get("payTo") or req.get("pay_to", "")
        asset = req.get("asset", "")

        # Generate random nonce
        nonce = int.from_bytes(secrets.token_bytes(32), "big")

        # Calculate deadline (1 hour from now)
        deadline = int(time.time()) + 3600

        permit = {
            "permitted": {
                "token": asset,
                "amount": amount,
            },
            "nonce": str(nonce),
            "deadline": str(deadline),
        }

        transfer_details = {
            "to": pay_to,
            "requestedAmount": amount,
        }

        # Sign the PermitTransferFrom
        signature = self._sign_permit_transfer_from(
            permit=permit,
            spender=pay_to,
            chain_id=chain_id,
        )

        payload = {
            "permit": permit,
            "transferDetails": transfer_details,
            "signature": signature,
            "owner": self._signer.address,
        }

        return {
            "t402Version": t402_version,
            "payload": payload,
        }

    def _get_chain_id(self, network: str) -> int:
        if network.startswith("eip155:"):
            return int(network.split(":")[1])
        raise ValueError(f"Unknown network: {network}")

    def _sign_permit_transfer_from(
        self,
        permit: Dict[str, Any],
        spender: str,
        chain_id: int,
    ) -> str:
        """Sign a PermitTransferFrom using EIP-712.

        The Permit2 EIP-712 domain uses name="Permit2" with NO version field,
        matching the canonical Permit2 contract deployment.
        """
        domain = {
            "name": "Permit2",
            "chainId": chain_id,
            "verifyingContract": PERMIT2_ADDRESS,
        }

        types = {
            "PermitTransferFrom": [
                {"name": "permitted", "type": "TokenPermissions"},
                {"name": "spender", "type": "address"},
                {"name": "nonce", "type": "uint256"},
                {"name": "deadline", "type": "uint256"},
            ],
            "TokenPermissions": [
                {"name": "token", "type": "address"},
                {"name": "amount", "type": "uint256"},
            ],
        }

        message = {
            "permitted": {
                "token": permit["permitted"]["token"],
                "amount": int(permit["permitted"]["amount"]),
            },
            "spender": spender,
            "nonce": int(permit["nonce"]),
            "deadline": int(permit["deadline"]),
        }

        signed = self._signer.sign_typed_data(
            domain_data=domain,
            message_types=types,
            message_data=message,
        )

        signature = signed.signature.hex()
        if not signature.startswith("0x"):
            signature = f"0x{signature}"

        return signature
