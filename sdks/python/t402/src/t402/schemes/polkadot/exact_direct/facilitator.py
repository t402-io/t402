"""Polkadot Exact-Direct Scheme - Facilitator Implementation.

This module provides the facilitator-side implementation of the exact-direct
payment scheme for Polkadot Asset Hub networks.

The facilitator:
1. Verifies payment payloads by querying the extrinsic on-chain
2. Validates that the extrinsic is a successful asset transfer matching
   the payment requirements (sender, recipient, amount, asset ID)
3. For settle(), confirms the transfer has already occurred on-chain
   (since exact-direct payments are pre-paid by the client)
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
from t402.schemes.polkadot.constants import (
    SCHEME_EXACT_DIRECT,
    get_network_config,
    is_polkadot_network,
)
from t402.schemes.polkadot.types import (
    FacilitatorPolkadotSigner,
    ExactDirectPayload,
    ExtrinsicResult,
    is_valid_hash,
    extract_asset_transfer,
    parse_asset_identifier,
)


logger = logging.getLogger(__name__)


class ExactDirectPolkadotFacilitatorScheme:
    """Facilitator scheme for Polkadot exact-direct payments.

    Verifies on-chain asset transfers by querying the extrinsic
    via an indexer or RPC, and confirms the transfer matches the
    payment requirements.

    Example:
        ```python
        facilitator = ExactDirectPolkadotFacilitatorScheme(
            signer=my_polkadot_facilitator_signer,
            addresses={
                "polkadot:68d56f15f85d3136970ec16946040bc1": [
                    "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
                ],
            },
        )

        # Verify a payment
        result = await facilitator.verify(payload, requirements)
        if result.is_valid:
            # Payment is confirmed on-chain
            settlement = await facilitator.settle(payload, requirements)
        ```
    """

    scheme = SCHEME_EXACT_DIRECT
    caip_family = "polkadot:*"

    def __init__(
        self,
        signer: FacilitatorPolkadotSigner,
        addresses: Optional[Dict[str, List[str]]] = None,
    ):
        """Initialize the facilitator.

        Args:
            signer: Polkadot facilitator signer for querying extrinsics
            addresses: Mapping of network -> list of facilitator addresses.
                Used in the /supported response.
        """
        self._signer = signer
        self._addresses = addresses or {}

    def get_extra(self, network: Network) -> Optional[Dict[str, Any]]:
        """Get mechanism-specific extra data for supported kinds.

        Returns asset metadata for the network's default token.

        Args:
            network: The network identifier

        Returns:
            Dict with asset metadata, or None if network is unsupported
        """
        try:
            config = get_network_config(network)
        except ValueError:
            return None

        return {
            "assetId": config.default_token.asset_id,
            "assetSymbol": config.default_token.symbol,
            "assetDecimals": config.default_token.decimals,
            "networkName": config.name,
        }

    def get_signers(self, network: Network) -> List[str]:
        """Get signer addresses for this facilitator on a given network.

        Args:
            network: The network identifier

        Returns:
            List of facilitator SS58 addresses for the network
        """
        return self._addresses.get(network, [])

    async def verify(
        self,
        payload: Union[PaymentPayloadV2, Dict[str, Any]],
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> VerifyResponse:
        """Verify a Polkadot exact-direct payment payload.

        Queries the extrinsic on-chain and validates:
        1. The extrinsic exists and was successful
        2. It is an assets.transfer or assets.transfer_keep_alive call
        3. The sender, recipient, amount, and asset ID match the requirements

        Args:
            payload: Payment payload containing extrinsic proof
            requirements: Payment requirements to verify against

        Returns:
            VerifyResponse indicating validity and payer address
        """
        try:
            # Extract data
            payload_data = self._extract_payload(payload)
            req_data = self._extract_requirements(requirements)

            # Parse the payload
            exact_payload = ExactDirectPayload.from_dict(payload_data)

            # Extract requirements
            network = req_data.get("network", "")
            required_amount = req_data.get("amount", "0")
            pay_to = req_data.get("payTo", req_data.get("pay_to", ""))
            asset = req_data.get("asset", "")

            # Validate network
            if not is_polkadot_network(network):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"Unsupported network: {network}",
                    payer=exact_payload.from_address or None,
                )

            # Validate extrinsic hash
            if not exact_payload.extrinsic_hash:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="Missing extrinsic hash in payload",
                    payer=exact_payload.from_address or None,
                )

            if not is_valid_hash(exact_payload.extrinsic_hash):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"Invalid extrinsic hash format: {exact_payload.extrinsic_hash}",
                    payer=exact_payload.from_address or None,
                )

            # Query the extrinsic on-chain
            extrinsic_data = await self._signer.get_extrinsic(
                exact_payload.extrinsic_hash, network
            )

            if not extrinsic_data:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="Extrinsic not found on-chain",
                    payer=exact_payload.from_address or None,
                )

            # Parse the extrinsic result
            extrinsic_result = self._parse_extrinsic_data(extrinsic_data)

            # Check success
            if not extrinsic_result.success:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="Extrinsic failed on-chain",
                    payer=extrinsic_result.signer or None,
                )

            # Extract transfer details
            transfer = extract_asset_transfer(extrinsic_result)
            if transfer is None:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="Extrinsic is not a valid asset transfer",
                    payer=extrinsic_result.signer or None,
                )

            # Validate recipient matches payTo
            if pay_to and transfer.to_address != pay_to:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=(
                        f"Transfer recipient {transfer.to_address} does not match "
                        f"required payTo {pay_to}"
                    ),
                    payer=transfer.from_address or None,
                )

            # Validate amount >= required
            try:
                transfer_amount = int(transfer.amount)
                req_amount = int(required_amount)
            except (ValueError, TypeError):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="Invalid amount format in transfer or requirements",
                    payer=transfer.from_address or None,
                )

            if transfer_amount < req_amount:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=(
                        f"Transfer amount {transfer_amount} is less than "
                        f"required amount {req_amount}"
                    ),
                    payer=transfer.from_address or None,
                )

            # Validate asset ID if specified in requirements
            expected_asset_id = self._resolve_expected_asset_id(asset, req_data)
            if expected_asset_id is not None and transfer.asset_id != expected_asset_id:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=(
                        f"Transfer asset ID {transfer.asset_id} does not match "
                        f"expected asset ID {expected_asset_id}"
                    ),
                    payer=transfer.from_address or None,
                )

            # All checks passed
            return VerifyResponse(
                is_valid=True,
                invalid_reason=None,
                payer=transfer.from_address,
            )

        except Exception as e:
            logger.error(f"Polkadot verification failed: {e}")
            return VerifyResponse(
                is_valid=False,
                invalid_reason=f"Verification error: {str(e)}",
                payer=None,
            )

    async def settle(
        self,
        payload: Union[PaymentPayloadV2, Dict[str, Any]],
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> SettleResponse:
        """Settle a Polkadot exact-direct payment.

        For exact-direct payments, the transfer has already been executed
        on-chain by the client. Settlement simply confirms the transfer
        and returns the extrinsic hash as the transaction identifier.

        This method first verifies the payment, then returns the
        extrinsic hash as the settlement proof.

        Args:
            payload: The verified payment payload
            requirements: The payment requirements

        Returns:
            SettleResponse with the extrinsic hash and status
        """
        try:
            # Extract data
            payload_data = self._extract_payload(payload)
            req_data = self._extract_requirements(requirements)

            network = req_data.get("network", "")

            # First verify the payment
            verify_result = await self.verify(payload, requirements)

            if not verify_result.is_valid:
                return SettleResponse(
                    success=False,
                    error_reason=verify_result.invalid_reason,
                    transaction=None,
                    network=network,
                    payer=verify_result.payer,
                )

            # Payment already settled on-chain, return the extrinsic hash
            exact_payload = ExactDirectPayload.from_dict(payload_data)

            return SettleResponse(
                success=True,
                error_reason=None,
                transaction=exact_payload.extrinsic_hash,
                network=network,
                payer=verify_result.payer,
            )

        except Exception as e:
            logger.error(f"Polkadot settlement failed: {e}")
            return SettleResponse(
                success=False,
                error_reason=f"Settlement error: {str(e)}",
                transaction=None,
                network=req_data.get("network") if "req_data" in dir() else None,
                payer=None,
            )

    def _extract_payload(
        self, payload: Union[PaymentPayloadV2, Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Extract payload data as a dict.

        Handles both PaymentPayloadV2 models and plain dicts.

        Args:
            payload: Payment payload (model or dict)

        Returns:
            Dict containing the inner payload data
        """
        if hasattr(payload, "model_dump"):
            data = payload.model_dump(by_alias=True)
            return data.get("payload", data)
        elif isinstance(payload, dict):
            return payload.get("payload", payload)
        return dict(payload)

    def _extract_requirements(
        self, requirements: Union[PaymentRequirementsV2, Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Extract requirements data as a dict.

        Args:
            requirements: Payment requirements (model or dict)

        Returns:
            Dict containing requirement fields
        """
        if hasattr(requirements, "model_dump"):
            return requirements.model_dump(by_alias=True)
        return dict(requirements)

    def _parse_extrinsic_data(self, data: Dict[str, Any]) -> ExtrinsicResult:
        """Parse raw extrinsic query data into an ExtrinsicResult.

        Args:
            data: Raw dictionary from the indexer/RPC query

        Returns:
            ExtrinsicResult instance
        """
        return ExtrinsicResult(
            extrinsic_hash=data.get("extrinsic_hash", data.get("extrinsicHash", "")),
            block_hash=data.get("block_hash", data.get("blockHash", "")),
            block_number=int(data.get("block_num", data.get("blockNumber", 0))),
            extrinsic_index=int(
                data.get("extrinsic_index", data.get("extrinsicIndex", 0))
            ),
            success=bool(data.get("success", False)),
            signer=data.get("account_id", data.get("signer", "")),
            module=data.get("call_module", data.get("module", "")),
            call=data.get("call_module_function", data.get("call", "")),
            params=data.get("params", []),
        )

    def _resolve_expected_asset_id(
        self, asset: str, req_data: Dict[str, Any]
    ) -> Optional[int]:
        """Resolve the expected asset ID from requirements.

        Tries to determine the asset ID from:
        1. The CAIP-19 asset identifier
        2. The extra.assetId field
        3. The network's default token

        Args:
            asset: CAIP-19 asset identifier string
            req_data: Requirements dictionary

        Returns:
            Expected asset ID, or None if it cannot be determined
        """
        # Try CAIP-19 identifier
        if asset:
            parsed = parse_asset_identifier(asset)
            if parsed is not None:
                return parsed

        # Try extra.assetId
        extra = req_data.get("extra", {})
        if extra and "assetId" in extra:
            try:
                return int(extra["assetId"])
            except (ValueError, TypeError):
                pass

        # Try network default
        network = req_data.get("network", "")
        if network:
            try:
                config = get_network_config(network)
                return config.default_token.asset_id
            except ValueError:
                pass

        return None
