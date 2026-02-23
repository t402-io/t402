"""EVM Permit2 Proxy Scheme - Client Implementation.

This module provides the client-side implementation of the Permit2 Proxy payment
scheme for EVM networks using PermitWitnessTransferFrom with a T402 Witness struct.
"""

from __future__ import annotations

import secrets
import time
from typing import Any, Dict, Protocol, Union, runtime_checkable

from t402.types import PaymentRequirementsV2
from t402.schemes.evm.permit2.client import PERMIT2_ADDRESS


# Constants
SCHEME_PERMIT2_PROXY = "permit2-proxy"

# Proxy contract addresses (TBD - not yet deployed)
EXACT_PROXY_ADDRESS = "0x0000000000000000000000000000000000000000"
UPTO_PROXY_ADDRESS = "0x0000000000000000000000000000000000000000"

# Witness type definitions
WITNESS_TYPE_HASH = "Witness(address to,address facilitator,uint256 validAfter)"
WITNESS_TYPE_STRING = (
    "Witness witness)"
    "TokenPermissions(address token,uint256 amount)"
    "Witness(address to,address facilitator,uint256 validAfter)"
)


@runtime_checkable
class Permit2ProxyEvmSigner(Protocol):
    """Protocol for EVM signing operations needed by Permit2 Proxy."""

    @property
    def address(self) -> str:
        ...

    def sign_typed_data(
        self,
        domain_data: Dict[str, Any],
        message_types: Dict[str, Any],
        message_data: Dict[str, Any],
    ) -> Any:
        ...


class Permit2ProxyEvmClientScheme:
    """Client scheme for EVM Permit2 Proxy payments.

    Creates payment payloads using Permit2's PermitWitnessTransferFrom,
    binding a witness struct (to, facilitator, validAfter) into the
    payer's EIP-712 signature.

    Example:
        ```python
        from eth_account import Account

        account = Account.from_key("0x...")
        scheme = Permit2ProxyEvmClientScheme(account)

        payload = await scheme.create_payment_payload(
            t402_version=2,
            requirements=requirements,
        )
        ```
    """

    scheme = SCHEME_PERMIT2_PROXY
    caip_family = "eip155:*"

    def __init__(self, signer: Permit2ProxyEvmSigner):
        self._signer = signer

    @property
    def address(self) -> str:
        return self._signer.address

    async def create_payment_payload(
        self,
        t402_version: int,
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Create a Permit2 Proxy payment payload.

        Creates a PermitWitnessTransferFrom EIP-712 typed data signature
        with a T402 Witness struct.

        Args:
            t402_version: Protocol version
            requirements: Payment requirements (must have facilitator in extra)

        Returns:
            Dict with t402Version and payload containing permit, witness,
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
        extra = req.get("extra", {}) or {}

        # Extract facilitator address from requirements extra
        facilitator = extra.get("facilitator", "")
        if not facilitator:
            raise ValueError("facilitator address required in requirements extra")

        # Generate random nonce
        nonce = int.from_bytes(secrets.token_bytes(32), "big")

        # Calculate deadline (1 hour from now)
        deadline = int(time.time()) + 3600

        # Calculate validAfter (30 seconds before now to account for clock skew)
        valid_after = int(time.time()) - 30

        permit = {
            "permitted": {
                "token": asset,
                "amount": amount,
            },
            "nonce": str(nonce),
            "deadline": str(deadline),
        }

        witness = {
            "to": pay_to,
            "facilitator": facilitator,
            "validAfter": str(valid_after),
        }

        # Determine spender (proxy contract address)
        spender = extra.get("exactProxyAddress", EXACT_PROXY_ADDRESS)

        # Sign the PermitWitnessTransferFrom
        signature = self._sign_permit_witness_transfer_from(
            permit=permit,
            witness=witness,
            spender=spender,
            chain_id=chain_id,
        )

        payload = {
            "permit": permit,
            "witness": witness,
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

    def _sign_permit_witness_transfer_from(
        self,
        permit: Dict[str, Any],
        witness: Dict[str, Any],
        spender: str,
        chain_id: int,
    ) -> str:
        """Sign a PermitWitnessTransferFrom using EIP-712."""
        domain = {
            "name": "Permit2",
            "chainId": chain_id,
            "verifyingContract": PERMIT2_ADDRESS,
        }

        types = {
            "PermitWitnessTransferFrom": [
                {"name": "permitted", "type": "TokenPermissions"},
                {"name": "spender", "type": "address"},
                {"name": "nonce", "type": "uint256"},
                {"name": "deadline", "type": "uint256"},
                {"name": "witness", "type": "Witness"},
            ],
            "TokenPermissions": [
                {"name": "token", "type": "address"},
                {"name": "amount", "type": "uint256"},
            ],
            "Witness": [
                {"name": "to", "type": "address"},
                {"name": "facilitator", "type": "address"},
                {"name": "validAfter", "type": "uint256"},
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
            "witness": {
                "to": witness["to"],
                "facilitator": witness["facilitator"],
                "validAfter": int(witness["validAfter"]),
            },
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
