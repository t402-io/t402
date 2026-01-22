"""TON Exact Scheme - Client Implementation.

This module provides the client-side implementation of the exact payment scheme
for TON network using Jetton transfers.
"""

from __future__ import annotations

import time
from typing import Any, Callable, Dict, Optional, Protocol, Union, Awaitable

from t402.types import (
    PaymentRequirementsV2,
    T402_VERSION_V1,
    T402_VERSION_V2,
)
from t402.ton import (
    TonAuthorization,
    TonPaymentPayload,
    DEFAULT_JETTON_TRANSFER_TON,
    DEFAULT_FORWARD_TON,
    validate_ton_address,
)


# Constants
SCHEME_EXACT = "exact"


class SignedMessage(Protocol):
    """Protocol for a signed TON message."""

    def to_boc_base64(self) -> str:
        """Convert message to base64-encoded BOC."""
        ...


class TonSigner(Protocol):
    """Protocol for TON wallet signing operations.

    Implementations should provide wallet address, seqno retrieval,
    and message signing capabilities.

    Example implementation with tonsdk:
        ```python
        class MyTonSigner:
            def __init__(self, wallet, client):
                self._wallet = wallet
                self._client = client

            @property
            def address(self) -> str:
                return self._wallet.address.to_string(True, True, True)

            async def get_seqno(self) -> int:
                return await self._client.get_seqno(self._wallet.address)

            async def sign_message(
                self,
                to: str,
                value: int,
                body: bytes,
                timeout: int,
            ) -> SignedMessage:
                # Build and sign the message
                return signed_message
        ```
    """

    @property
    def address(self) -> str:
        """Return the wallet address as a friendly string."""
        ...

    async def get_seqno(self) -> int:
        """Get the current sequence number for replay protection."""
        ...

    async def sign_message(
        self,
        to: str,
        value: int,
        body: bytes,
        timeout: int,
    ) -> SignedMessage:
        """Sign a message to be sent to the TON network.

        Args:
            to: Destination address
            value: Amount of TON in nanoTON
            body: Message body as bytes (BOC)
            timeout: Message validity timeout in seconds

        Returns:
            SignedMessage that can be converted to BOC
        """
        ...


# Type for Jetton wallet address resolver
JettonWalletResolver = Callable[[str, str], Awaitable[str]]


def generate_query_id() -> int:
    """Generate a unique query ID for Jetton transfers.

    Returns:
        Unique query ID based on timestamp
    """
    return int(time.time() * 1000000)


class ExactTonClientScheme:
    """Client scheme for TON exact payments using Jetton transfers.

    Creates signed BOC messages that can be broadcast by a facilitator
    to complete the payment.

    Example:
        ```python
        scheme = ExactTonClientScheme(
            signer=my_ton_signer,
            get_jetton_wallet_address=my_resolver,
        )

        payload = await scheme.create_payment_payload(
            t402_version=2,
            requirements={
                "scheme": "exact",
                "network": "ton:mainnet",
                "asset": "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
                "amount": "1000000",
                "payTo": "EQ...",
                "maxTimeoutSeconds": 300,
            },
        )
        ```
    """

    scheme = SCHEME_EXACT
    caip_family = "ton:*"

    def __init__(
        self,
        signer: TonSigner,
        get_jetton_wallet_address: JettonWalletResolver,
        gas_amount: Optional[int] = None,
        forward_amount: Optional[int] = None,
    ):
        """Initialize the TON client scheme.

        Args:
            signer: TON signer for signing messages
            get_jetton_wallet_address: Function to resolve Jetton wallet address
            gas_amount: Override TON amount for gas (in nanoTON)
            forward_amount: Override forward TON amount (in nanoTON)
        """
        self._signer = signer
        self._get_jetton_wallet_address = get_jetton_wallet_address
        self._gas_amount = gas_amount or DEFAULT_JETTON_TRANSFER_TON
        self._forward_amount = forward_amount or DEFAULT_FORWARD_TON

    @property
    def address(self) -> str:
        """Return the wallet address."""
        return self._signer.address

    async def create_payment_payload(
        self,
        t402_version: int,
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Create a payment payload for TON Jetton transfer.

        Args:
            t402_version: Protocol version (1 or 2)
            requirements: Payment requirements

        Returns:
            Payment payload with signed BOC and authorization metadata
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
        max_timeout = req.get("maxTimeoutSeconds", 300)

        # Validate required fields
        if not asset:
            raise ValueError("Asset (Jetton master address) is required")
        if not pay_to:
            raise ValueError("PayTo address is required")
        if not amount:
            raise ValueError("Amount is required")
        if not validate_ton_address(pay_to):
            raise ValueError(f"Invalid payTo address: {pay_to}")

        # Get sender's Jetton wallet address
        sender_jetton_wallet = await self._get_jetton_wallet_address(
            self._signer.address,
            asset,
        )

        # Get current seqno for replay protection
        seqno = await self._signer.get_seqno()

        # Calculate validity period
        now = int(time.time())
        valid_until = now + max_timeout

        # Generate unique query ID
        query_id = generate_query_id()

        # Parse amount
        jetton_amount = int(amount)

        # Build Jetton transfer body
        jetton_body = self._build_jetton_transfer_body(
            query_id=query_id,
            amount=jetton_amount,
            destination=pay_to,
            response_destination=self._signer.address,
            forward_amount=self._forward_amount,
        )

        # Sign the message
        signed_message = await self._signer.sign_message(
            to=sender_jetton_wallet,
            value=self._gas_amount,
            body=jetton_body,
            timeout=max_timeout,
        )

        # Encode to base64
        signed_boc = signed_message.to_boc_base64()

        # Build authorization metadata
        authorization = TonAuthorization(
            from_=self._signer.address,
            to=pay_to,
            jetton_master=asset,
            jetton_amount=str(jetton_amount),
            ton_amount=str(self._gas_amount),
            valid_until=valid_until,
            seqno=seqno,
            query_id=str(query_id),
        )

        # Build payload
        payload_data = TonPaymentPayload(
            signed_boc=signed_boc,
            authorization=authorization,
        )

        if t402_version == T402_VERSION_V1:
            return {
                "t402Version": T402_VERSION_V1,
                "scheme": self.scheme,
                "network": network,
                "payload": payload_data.model_dump(by_alias=True),
            }

        # V2 format
        return {
            "t402Version": T402_VERSION_V2,
            "payload": payload_data.model_dump(by_alias=True),
        }

    def _build_jetton_transfer_body(
        self,
        query_id: int,
        amount: int,
        destination: str,
        response_destination: str,
        forward_amount: int,
    ) -> bytes:
        """Build Jetton transfer body as bytes.

        This builds the TEP-74 Jetton transfer internal message body.

        Args:
            query_id: Unique query ID
            amount: Jetton amount in smallest units
            destination: Destination address
            response_destination: Address for excess response
            forward_amount: Forward TON amount

        Returns:
            Serialized message body as bytes

        Note:
            This returns a minimal placeholder. Real implementations should
            use tonsdk or pytoniq to build proper BOC cells.
        """
        # Import here to avoid hard dependency
        try:
            from t402.ton import JETTON_TRANSFER_OP

            # Build cell using available library
            # This is a placeholder - real implementation needs tonsdk/pytoniq
            #
            # The actual cell structure should be:
            # transfer#0f8a7ea5 query_id:uint64 amount:(VarUInteger 16)
            #                   destination:MsgAddress response_destination:MsgAddress
            #                   custom_payload:(Maybe ^Cell) forward_ton_amount:(VarUInteger 16)
            #                   forward_payload:(Either Cell ^Cell) = InternalMsgBody;

            # For now, return a placeholder that indicates the transfer params
            # Real signers should handle cell building internally
            import json

            # Encode as JSON for testing/mocking purposes
            # Real implementation would use proper BOC encoding
            transfer_params = {
                "op": JETTON_TRANSFER_OP,
                "query_id": query_id,
                "amount": amount,
                "destination": destination,
                "response_destination": response_destination,
                "forward_amount": forward_amount,
            }
            return json.dumps(transfer_params).encode("utf-8")

        except ImportError:
            # Fallback if ton module not fully available
            import json

            transfer_params = {
                "op": 0x0F8A7EA5,
                "query_id": query_id,
                "amount": amount,
                "destination": destination,
                "response_destination": response_destination,
                "forward_amount": forward_amount,
            }
            return json.dumps(transfer_params).encode("utf-8")
