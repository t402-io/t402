"""Bitcoin On-chain Exact Scheme - Client Implementation.

This module provides the client-side implementation of the exact payment
scheme for Bitcoin on-chain payments using PSBTs.

The client:
1. Validates payment requirements (address, amount, dust limit).
2. Builds an unsigned PSBT with the required output.
3. Signs the PSBT using the client signer.
4. Returns the signed PSBT as the payment payload.
"""

from __future__ import annotations

import base64
import json
import logging
from typing import Any, Dict, Optional, Union

from t402.types import PaymentRequirementsV2
from t402.schemes.btc.constants import (
    SCHEME_EXACT,
    BTC_CAIP_FAMILY,
    DUST_LIMIT,
    validate_bitcoin_address,
)
from t402.schemes.btc.types import ClientBtcSigner, BtcOnchainPayload


logger = logging.getLogger(__name__)


class ExactBtcClientConfig:
    """Configuration for the ExactBtcClientScheme.

    Attributes:
        memo: Optional memo to include in the transaction.
    """

    def __init__(self, memo: Optional[str] = None) -> None:
        self.memo = memo


class ExactBtcClientScheme:
    """Client scheme for Bitcoin on-chain exact payments using PSBTs.

    Creates signed PSBTs for on-chain Bitcoin payments that can be
    finalized and broadcast by a facilitator.

    Example:
        ```python
        class MyBtcSigner:
            def get_address(self) -> str:
                return "bc1q..."

            def get_public_key(self) -> str:
                return "02abc..."

            async def sign_psbt(self, psbt: str) -> str:
                return signed_psbt_base64

        signer = MyBtcSigner()
        scheme = ExactBtcClientScheme(signer)

        payload = await scheme.create_payment_payload(2, requirements)
        ```
    """

    def __init__(
        self,
        signer: ClientBtcSigner,
        config: Optional[ExactBtcClientConfig] = None,
    ) -> None:
        """Initialize with a Bitcoin signer.

        Args:
            signer: Any object implementing the ClientBtcSigner protocol.
            config: Optional configuration.
        """
        self._signer = signer
        self._config = config or ExactBtcClientConfig()

    @property
    def scheme(self) -> str:
        """The scheme identifier."""
        return SCHEME_EXACT

    @property
    def caip_family(self) -> str:
        """The CAIP-2 family pattern for BTC networks."""
        return BTC_CAIP_FAMILY

    @property
    def signer_address(self) -> str:
        """Get the signer's Bitcoin address."""
        return self._signer.get_address()

    async def create_payment_payload(
        self,
        t402_version: int,
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Create a payment payload by building and signing a PSBT.

        Args:
            t402_version: The T402 protocol version.
            requirements: Payment requirements with amount, payTo, network.

        Returns:
            Dict with t402Version and payload containing signedPsbt.

        Raises:
            ValueError: If requirements are invalid.
        """
        # Extract requirements as dict
        if hasattr(requirements, "model_dump"):
            req = requirements.model_dump(by_alias=True)
        else:
            req = dict(requirements)

        pay_to = req.get("payTo") or req.get("pay_to", "")
        amount = req.get("amount", "")
        network = req.get("network", "")

        # Validate required fields
        if not pay_to:
            raise ValueError("PayTo address is required")
        if not amount:
            raise ValueError("Amount is required")

        # Validate address format
        if not validate_bitcoin_address(pay_to):
            raise ValueError(f"Invalid Bitcoin address: {pay_to}")

        # Validate amount is above dust limit
        amount_sats = int(amount)
        if amount_sats < DUST_LIMIT:
            raise ValueError(
                f"Amount {amount_sats} satoshis is below dust limit ({DUST_LIMIT})"
            )

        # Build an unsigned PSBT
        unsigned_psbt = self._build_unsigned_psbt(req)

        # Sign the PSBT
        signed_psbt = await self._signer.sign_psbt(unsigned_psbt)

        # Create payload
        payload = BtcOnchainPayload(signed_psbt=signed_psbt)

        return {
            "t402Version": t402_version,
            "payload": payload.to_map(),
        }

    def _build_unsigned_psbt(self, requirements: Dict[str, Any]) -> str:
        """Build an unsigned PSBT for the payment.

        Creates a minimal PSBT representation with the required output.
        The actual UTXO selection and fee calculation should be handled
        by the signer implementation.

        Args:
            requirements: Payment requirements dict.

        Returns:
            Base64-encoded unsigned PSBT.
        """
        pay_to = requirements.get("payTo") or requirements.get("pay_to", "")
        psbt_data = {
            "outputs": [
                {
                    "address": pay_to,
                    "value": requirements.get("amount", ""),
                },
            ],
            "network": requirements.get("network", ""),
            "fromAddress": self._signer.get_address(),
            "fromPubKey": self._signer.get_public_key(),
        }

        return base64.b64encode(json.dumps(psbt_data).encode()).decode()
