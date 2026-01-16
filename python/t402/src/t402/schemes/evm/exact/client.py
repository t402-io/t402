"""EVM Exact Scheme - Client Implementation.

This module provides the client-side implementation of the exact payment scheme
for EVM networks using EIP-3009 TransferWithAuthorization.
"""

from __future__ import annotations

import secrets
import time
from typing import Any, Dict, Protocol, Union, runtime_checkable

from t402.types import (
    PaymentRequirementsV2,
    T402_VERSION_V1,
)
from t402.chains import get_chain_id


# Constants
SCHEME_EXACT = "exact"


@runtime_checkable
class EvmSigner(Protocol):
    """Protocol for EVM signing operations."""

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


def create_nonce() -> bytes:
    """Create a random 32-byte nonce for authorization signatures."""
    return secrets.token_bytes(32)


class ExactEvmClientScheme:
    """Client scheme for EVM exact payments using EIP-3009.

    This scheme creates payment payloads using EIP-3009 TransferWithAuthorization,
    which allows gasless token transfers with signature authorization.

    Example:
        ```python
        from eth_account import Account

        # Create signer from private key
        account = Account.from_key("0x...")

        # Create scheme
        scheme = ExactEvmClientScheme(account)

        # Create payment payload
        payload = await scheme.create_payment_payload(
            t402_version=2,
            requirements=requirements,
        )
        ```
    """

    scheme = SCHEME_EXACT
    caip_family = "eip155:*"

    def __init__(self, signer: EvmSigner):
        """Initialize with an EVM signer.

        Args:
            signer: Any object implementing the EvmSigner protocol
                   (e.g., eth_account.Account)
        """
        self._signer = signer

    @property
    def address(self) -> str:
        """Get the signer's address."""
        return self._signer.address

    async def create_payment_payload(
        self,
        t402_version: int,
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Create a payment payload for EVM exact scheme.

        Creates an EIP-3009 TransferWithAuthorization and signs it.

        Args:
            t402_version: Protocol version (1 or 2)
            requirements: Payment requirements with amount, asset, payTo, etc.

        Returns:
            Dict with t402Version, scheme, network, and payload containing
            signature and authorization data.
        """
        # Extract requirements (handle both model and dict)
        if hasattr(requirements, "model_dump"):
            req = requirements.model_dump(by_alias=True)
        else:
            req = dict(requirements)

        # Get network and chain ID
        network = req.get("network", "")
        chain_id = self._get_chain_id(network)

        # Get amount - V2 uses 'amount', V1 uses 'maxAmountRequired'
        amount = req.get("amount") or req.get("maxAmountRequired", "0")

        # Get pay_to address
        pay_to = req.get("payTo") or req.get("pay_to", "")

        # Get asset address
        asset = req.get("asset", "")

        # Get timeout
        max_timeout = req.get("maxTimeoutSeconds") or req.get("max_timeout_seconds", 300)

        # Get EIP-712 domain info from extra
        extra = req.get("extra", {})
        token_name = extra.get("name", "USD Coin")
        token_version = extra.get("version", "2")

        # Create authorization
        nonce = create_nonce()
        now = int(time.time())
        valid_after = str(now - 60)  # 60 seconds buffer
        valid_before = str(now + max_timeout)

        authorization = {
            "from": self._signer.address,
            "to": pay_to,
            "value": str(amount),
            "validAfter": valid_after,
            "validBefore": valid_before,
            "nonce": nonce,
        }

        # Sign the authorization
        signature = self._sign_authorization(
            authorization=authorization,
            chain_id=chain_id,
            asset_address=asset,
            token_name=token_name,
            token_version=token_version,
        )

        # Convert nonce to hex string
        authorization["nonce"] = f"0x{nonce.hex()}"

        # Build payload based on version
        if t402_version == T402_VERSION_V1:
            return {
                "t402Version": t402_version,
                "scheme": self.scheme,
                "network": network,
                "payload": {
                    "signature": signature,
                    "authorization": authorization,
                },
            }
        else:
            # V2 - return just the partial payload
            return {
                "t402Version": t402_version,
                "payload": {
                    "signature": signature,
                    "authorization": authorization,
                },
            }

    def _get_chain_id(self, network: str) -> int:
        """Get chain ID from network identifier.

        Args:
            network: Network identifier (CAIP-2 or legacy format)

        Returns:
            Chain ID as integer
        """
        # Handle CAIP-2 format (eip155:8453)
        if network.startswith("eip155:"):
            return int(network.split(":")[1])

        # Handle legacy format
        try:
            return get_chain_id(network)
        except (KeyError, ValueError):
            raise ValueError(f"Unknown network: {network}")

    def _sign_authorization(
        self,
        authorization: Dict[str, Any],
        chain_id: int,
        asset_address: str,
        token_name: str,
        token_version: str,
    ) -> str:
        """Sign an EIP-3009 authorization.

        Args:
            authorization: Authorization data
            chain_id: EVM chain ID
            asset_address: Token contract address
            token_name: Token name for EIP-712 domain
            token_version: Token version for EIP-712 domain

        Returns:
            Signature as hex string
        """
        # Get nonce as bytes
        nonce = authorization["nonce"]
        if isinstance(nonce, str):
            nonce = bytes.fromhex(nonce.replace("0x", ""))

        # Build EIP-712 typed data
        domain = {
            "name": token_name,
            "version": token_version,
            "chainId": chain_id,
            "verifyingContract": asset_address,
        }

        types = {
            "TransferWithAuthorization": [
                {"name": "from", "type": "address"},
                {"name": "to", "type": "address"},
                {"name": "value", "type": "uint256"},
                {"name": "validAfter", "type": "uint256"},
                {"name": "validBefore", "type": "uint256"},
                {"name": "nonce", "type": "bytes32"},
            ]
        }

        message = {
            "from": authorization["from"],
            "to": authorization["to"],
            "value": int(authorization["value"]),
            "validAfter": int(authorization["validAfter"]),
            "validBefore": int(authorization["validBefore"]),
            "nonce": nonce,
        }

        # Sign
        signed = self._signer.sign_typed_data(
            domain_data=domain,
            message_types=types,
            message_data=message,
        )

        # Extract signature
        signature = signed.signature.hex()
        if not signature.startswith("0x"):
            signature = f"0x{signature}"

        return signature
