"""EVM Up-To Scheme - Client Implementation.

This module provides the client-side implementation of the upto payment scheme
for EVM networks using EIP-2612 Permit.
"""

from __future__ import annotations

import secrets
import time
from typing import Any, Dict, Optional, Union

from t402.types import PaymentRequirementsV2
from t402.chains import get_chain_id
from t402.schemes.evm.exact.client import EvmSigner
from t402.schemes.upto.types import UptoPaymentRequirements


# Constants
SCHEME_UPTO = "upto"


def create_payment_nonce() -> bytes:
    """Create a random 32-byte payment nonce."""
    return secrets.token_bytes(32)


class UptoEvmClientScheme:
    """Client scheme for EVM upto payments using EIP-2612.

    This scheme creates payment payloads using EIP-2612 Permit,
    which allows gasless token approvals for up-to payments.

    Example:
        ```python
        from eth_account import Account

        # Create signer from private key
        account = Account.from_key("0x...")

        # Create scheme
        scheme = UptoEvmClientScheme(account)

        # Create payment payload
        payload = await scheme.create_payment_payload(
            t402_version=2,
            requirements=requirements,
        )
        ```
    """

    scheme = SCHEME_UPTO
    caip_family = "eip155:*"

    def __init__(
        self,
        signer: EvmSigner,
        router_address: Optional[str] = None,
    ):
        """Initialize with an EVM signer.

        Args:
            signer: Any object implementing the EvmSigner protocol
            router_address: Optional default router contract address
        """
        self._signer = signer
        self._router_address = router_address

    @property
    def address(self) -> str:
        """Get the signer's address."""
        return self._signer.address

    async def create_payment_payload(
        self,
        t402_version: int,
        requirements: Union[UptoPaymentRequirements, PaymentRequirementsV2, Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Create a payment payload for EVM upto scheme.

        Creates an EIP-2612 Permit authorization and signs it.

        Args:
            t402_version: Protocol version (1 or 2)
            requirements: Payment requirements with maxAmount, asset, payTo, etc.

        Returns:
            Dict with t402Version and payload containing permit signature
            and authorization data.
        """
        # Extract requirements (handle both model and dict)
        if hasattr(requirements, "model_dump"):
            req = requirements.model_dump(by_alias=True)
        else:
            req = dict(requirements)

        # Get network and chain ID
        network = req.get("network", "")
        chain_id = self._get_chain_id(network)

        # Get maxAmount for upto scheme
        max_amount = req.get("maxAmount") or req.get("max_amount", "0")

        # Get router/spender address
        extra = req.get("extra", {})
        router_address = (
            extra.get("routerAddress")
            or extra.get("router_address")
            or self._router_address
            or req.get("payTo")  # Fallback to payTo
        )

        # Get asset address
        asset = req.get("asset", "")

        # Get timeout
        max_timeout = req.get("maxTimeoutSeconds") or req.get("max_timeout_seconds", 300)

        # Get EIP-712 domain info
        token_name = extra.get("name", "USD Coin")
        token_version = extra.get("version", "2")

        # Create payment nonce
        payment_nonce = create_payment_nonce()

        # Calculate deadline
        deadline = int(time.time()) + max_timeout

        # Get permit nonce from token contract (would need RPC call in production)
        # For now, use 0 as placeholder - real implementation needs contract call
        permit_nonce = 0

        # Create authorization
        authorization = {
            "owner": self._signer.address,
            "spender": router_address,
            "value": str(max_amount),
            "deadline": str(deadline),
            "nonce": permit_nonce,
        }

        # Sign the permit
        signature = self._sign_permit(
            authorization=authorization,
            chain_id=chain_id,
            asset_address=asset,
            token_name=token_name,
            token_version=token_version,
        )

        # Build payload
        payload = {
            "signature": signature,
            "authorization": authorization,
            "paymentNonce": f"0x{payment_nonce.hex()}",
        }

        return {
            "t402Version": t402_version,
            "payload": payload,
        }

    def _get_chain_id(self, network: str) -> int:
        """Get chain ID from network identifier."""
        if network.startswith("eip155:"):
            return int(network.split(":")[1])

        try:
            return get_chain_id(network)
        except (KeyError, ValueError):
            raise ValueError(f"Unknown network: {network}")

    def _sign_permit(
        self,
        authorization: Dict[str, Any],
        chain_id: int,
        asset_address: str,
        token_name: str,
        token_version: str,
    ) -> Dict[str, Any]:
        """Sign an EIP-2612 Permit.

        Args:
            authorization: Permit authorization data
            chain_id: EVM chain ID
            asset_address: Token contract address
            token_name: Token name for EIP-712 domain
            token_version: Token version for EIP-712 domain

        Returns:
            Signature as dict with v, r, s components
        """
        # Build EIP-712 typed data
        domain = {
            "name": token_name,
            "version": token_version,
            "chainId": chain_id,
            "verifyingContract": asset_address,
        }

        types = {
            "Permit": [
                {"name": "owner", "type": "address"},
                {"name": "spender", "type": "address"},
                {"name": "value", "type": "uint256"},
                {"name": "nonce", "type": "uint256"},
                {"name": "deadline", "type": "uint256"},
            ]
        }

        message = {
            "owner": authorization["owner"],
            "spender": authorization["spender"],
            "value": int(authorization["value"]),
            "nonce": authorization["nonce"],
            "deadline": int(authorization["deadline"]),
        }

        # Sign
        signed = self._signer.sign_typed_data(
            domain_data=domain,
            message_types=types,
            message_data=message,
        )

        # Extract signature components
        sig_hex = signed.signature.hex()
        if sig_hex.startswith("0x"):
            sig_hex = sig_hex[2:]

        # Split into v, r, s
        r = f"0x{sig_hex[:64]}"
        s = f"0x{sig_hex[64:128]}"
        v = int(sig_hex[128:], 16) if len(sig_hex) > 128 else 27

        return {
            "v": v,
            "r": r,
            "s": s,
        }
