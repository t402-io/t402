"""Bitcoin On-chain Exact Scheme - Facilitator Implementation.

This module provides the facilitator-side implementation of the exact payment
scheme for Bitcoin on-chain payments.

The facilitator:
1. Verifies signed PSBTs (validates outputs, signatures, amounts).
2. Broadcasts transactions to the Bitcoin network.
3. Waits for confirmation before marking as settled.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Union

from t402.types import (
    PaymentRequirementsV2,
    PaymentPayloadV2,
    VerifyResponse,
    SettleResponse,
    Network,
)
from t402.schemes.btc.constants import (
    SCHEME_EXACT,
    BTC_CAIP_FAMILY,
    BTC_NETWORKS,
    DUST_LIMIT,
    validate_bitcoin_address,
)
from t402.schemes.btc.types import FacilitatorBtcSigner, BtcOnchainPayload


logger = logging.getLogger(__name__)


class ExactBtcFacilitatorConfig:
    """Configuration for the ExactBtcFacilitatorScheme.

    Attributes:
        confirmations: Number of confirmations to wait for. Default: 1.
    """

    def __init__(self, confirmations: int = 1) -> None:
        self.confirmations = confirmations


class ExactBtcFacilitatorScheme:
    """Facilitator scheme for Bitcoin on-chain exact payments.

    Verifies signed PSBTs and broadcasts transactions to settle payments.

    Example:
        ```python
        class MyBtcNode:
            def get_addresses(self) -> List[str]:
                return ["bc1q..."]

            async def verify_psbt(self, signed_psbt, expected_pay_to, expected_amount):
                return {"valid": True, "payer": "bc1q..."}

            async def broadcast_psbt(self, signed_psbt: str) -> str:
                return "txid..."

            async def wait_for_confirmation(self, tx_id, confirmations=1):
                return {"confirmed": True, "tx_id": "...", "confirmations": 1}

        node = MyBtcNode()
        facilitator = ExactBtcFacilitatorScheme(node)

        result = await facilitator.verify(payload, requirements)
        ```
    """

    def __init__(
        self,
        signer: FacilitatorBtcSigner,
        config: Optional[ExactBtcFacilitatorConfig] = None,
    ) -> None:
        """Initialize the facilitator scheme.

        Args:
            signer: Any object implementing the FacilitatorBtcSigner protocol.
            config: Optional configuration.
        """
        self._signer = signer
        self._config = config or ExactBtcFacilitatorConfig()

    @property
    def scheme(self) -> str:
        """The scheme identifier."""
        return SCHEME_EXACT

    @property
    def caip_family(self) -> str:
        """CAIP-2 family pattern for network matching."""
        return BTC_CAIP_FAMILY

    def get_extra(self, network: Network) -> Optional[Dict[str, Any]]:
        """Get mechanism-specific extra data for supported kinds.

        Bitcoin on-chain has no extra data.

        Args:
            network: The network identifier.

        Returns:
            None (no extra data for BTC on-chain).
        """
        return None

    def get_signers(self, network: Network) -> List[str]:
        """Get signer addresses for this facilitator.

        Args:
            network: The network identifier.

        Returns:
            List of Bitcoin addresses.
        """
        return list(self._signer.get_addresses())

    async def verify(
        self,
        payload: Union[PaymentPayloadV2, Dict[str, Any]],
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> VerifyResponse:
        """Verify a payment payload.

        Validates:
        1. Payload has correct structure with signedPsbt.
        2. Scheme and network matching.
        3. PSBT structure and signatures.
        4. Output matches (payTo, amount).
        5. Amount above dust limit.

        Args:
            payload: The payment payload containing signedPsbt.
            requirements: The payment requirements to verify against.

        Returns:
            VerifyResponse indicating validity and payer address.
        """
        try:
            payload_data = self._extract_payload(payload)
            req_data = self._extract_requirements(requirements)

            # Validate payload structure
            signed_psbt = payload_data.get("signedPsbt", "")
            if not signed_psbt:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_payload_structure",
                    payer=None,
                )

            # Verify scheme matches
            accepted = payload_data if "scheme" not in payload_data else payload_data
            payload_scheme = ""
            if hasattr(payload, "model_dump"):
                full_payload = payload.model_dump(by_alias=True)
                accepted_data = full_payload.get("accepted", {})
                payload_scheme = accepted_data.get("scheme", "")
            elif isinstance(payload, dict):
                accepted_data = payload.get("accepted", {})
                payload_scheme = accepted_data.get("scheme", "")

            req_scheme = req_data.get("scheme", "")

            if payload_scheme and payload_scheme != SCHEME_EXACT:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="unsupported_scheme",
                    payer=None,
                )

            if req_scheme and req_scheme != SCHEME_EXACT:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="unsupported_scheme",
                    payer=None,
                )

            # Verify network is valid BTC network
            network = req_data.get("network", "")
            if network and network not in BTC_NETWORKS:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="unsupported_network",
                    payer=None,
                )

            # Validate payTo address
            pay_to = req_data.get("payTo") or req_data.get("pay_to", "")
            if pay_to and not validate_bitcoin_address(pay_to):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_pay_to_address",
                    payer=None,
                )

            # Validate amount above dust limit
            amount_str = req_data.get("amount", "0")
            try:
                amount = int(amount_str)
                if amount < DUST_LIMIT:
                    return VerifyResponse(
                        is_valid=False,
                        invalid_reason="amount_below_dust_limit",
                        payer=None,
                    )
            except (ValueError, TypeError):
                pass

            # Verify the PSBT via signer
            try:
                result = await self._signer.verify_psbt(
                    signed_psbt=signed_psbt,
                    expected_pay_to=pay_to,
                    expected_amount=amount_str,
                )

                if not result.get("valid", False):
                    return VerifyResponse(
                        is_valid=False,
                        invalid_reason=result.get("reason", "psbt_verification_failed"),
                        payer=result.get("payer"),
                    )

                return VerifyResponse(
                    is_valid=True,
                    invalid_reason=None,
                    payer=result.get("payer"),
                )
            except Exception as e:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"verification_error: {str(e)}",
                    payer=None,
                )

        except Exception as e:
            logger.error(f"BTC verification failed: {e}")
            return VerifyResponse(
                is_valid=False,
                invalid_reason=f"verification_error: {str(e)}",
                payer=None,
            )

    async def settle(
        self,
        payload: Union[PaymentPayloadV2, Dict[str, Any]],
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> SettleResponse:
        """Settle a payment by finalizing and broadcasting the PSBT.

        Args:
            payload: The verified payment payload.
            requirements: The payment requirements.

        Returns:
            SettleResponse with transaction hash and status.
        """
        try:
            payload_data = self._extract_payload(payload)
            req_data = self._extract_requirements(requirements)

            network = req_data.get("network", "")
            signed_psbt = payload_data.get("signedPsbt", "")

            if not signed_psbt:
                return SettleResponse(
                    success=False,
                    error_reason="invalid_payload_structure",
                    transaction=None,
                    network=network,
                    payer=None,
                )

            # Re-verify before settling
            verify_result = await self.verify(payload, requirements)
            if not verify_result.is_valid:
                return SettleResponse(
                    success=False,
                    error_reason=verify_result.invalid_reason or "verification_failed",
                    transaction=None,
                    network=network,
                    payer=verify_result.payer,
                )

            try:
                # Broadcast the signed transaction
                tx_id = await self._signer.broadcast_psbt(signed_psbt)

                # Wait for confirmation
                confirmation = await self._signer.wait_for_confirmation(
                    tx_id, self._config.confirmations
                )

                if not confirmation.get("confirmed", False):
                    return SettleResponse(
                        success=False,
                        error_reason="transaction_not_confirmed",
                        transaction=tx_id,
                        network=network,
                        payer=verify_result.payer,
                    )

                return SettleResponse(
                    success=True,
                    error_reason=None,
                    transaction=tx_id,
                    network=network,
                    payer=verify_result.payer,
                )

            except Exception as e:
                logger.error(f"Failed to settle Bitcoin transaction: {e}")
                return SettleResponse(
                    success=False,
                    error_reason="transaction_failed",
                    transaction=None,
                    network=network,
                    payer=verify_result.payer,
                )

        except Exception as e:
            logger.error(f"BTC settlement failed: {e}")
            return SettleResponse(
                success=False,
                error_reason=f"settlement_error: {str(e)}",
                transaction=None,
                network=None,
                payer=None,
            )

    def _extract_payload(
        self, payload: Union[PaymentPayloadV2, Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Extract payload data as a dict."""
        if hasattr(payload, "model_dump"):
            data = payload.model_dump(by_alias=True)
            return data.get("payload", data)
        elif isinstance(payload, dict):
            return payload.get("payload", payload)
        return dict(payload)

    def _extract_requirements(
        self, requirements: Union[PaymentRequirementsV2, Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Extract requirements data as a dict."""
        if hasattr(requirements, "model_dump"):
            return requirements.model_dump(by_alias=True)
        return dict(requirements)
