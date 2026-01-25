"""Stacks Exact-Direct Scheme - Facilitator Implementation.

This module provides the facilitator-side implementation of the exact-direct
payment scheme for Stacks (Bitcoin L2) networks.

The facilitator:
1. Verifies payment payloads by querying the transaction on-chain
2. Validates that the transaction is a successful SIP-010 token transfer
   matching the payment requirements (sender, recipient, amount, contract)
3. For settle(), confirms the transfer has already occurred on-chain
   (since exact-direct payments are pre-paid by the client)
4. Maintains a txId cache for replay protection
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Set, Union

from t402.types import (
    PaymentRequirementsV2,
    PaymentPayloadV2,
    VerifyResponse,
    SettleResponse,
    Network,
)
from t402.schemes.stacks.constants import (
    SCHEME_EXACT_DIRECT,
    get_network_config,
    is_stacks_network,
)
from t402.schemes.stacks.types import (
    FacilitatorStacksSigner,
    ExactDirectPayload,
    TransactionResult,
    is_valid_tx_id,
    extract_token_transfer,
    parse_contract_identifier,
)


logger = logging.getLogger(__name__)


class ExactDirectStacksFacilitatorScheme:
    """Facilitator scheme for Stacks exact-direct payments.

    Verifies on-chain SIP-010 token transfers by querying the transaction
    via the Hiro API, and confirms the transfer matches the payment
    requirements. Includes replay protection via txId caching.

    Example:
        ```python
        facilitator = ExactDirectStacksFacilitatorScheme(
            signer=my_stacks_facilitator_signer,
        )

        # Verify a payment
        result = await facilitator.verify(payload, requirements)
        if result.is_valid:
            # Payment is confirmed on-chain
            settlement = await facilitator.settle(payload, requirements)
        ```
    """

    scheme = SCHEME_EXACT_DIRECT
    caip_family = "stacks:*"

    def __init__(
        self,
        signer: FacilitatorStacksSigner,
    ):
        """Initialize the facilitator.

        Args:
            signer: Stacks facilitator signer for querying transactions
        """
        self._signer = signer
        self._used_tx_ids: Set[str] = set()

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
            "contractAddress": config.default_token.contract_address,
            "assetSymbol": config.default_token.symbol,
            "assetDecimals": config.default_token.decimals,
            "networkName": config.name,
        }

    def get_signers(self, network: Network) -> List[str]:
        """Get signer addresses for this facilitator on a given network.

        Args:
            network: The network identifier

        Returns:
            List of facilitator Stacks addresses for the network
        """
        return self._signer.get_addresses(network)

    async def verify(
        self,
        payload: Union[PaymentPayloadV2, Dict[str, Any]],
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> VerifyResponse:
        """Verify a Stacks exact-direct payment payload.

        Queries the transaction on-chain and validates:
        1. The transaction exists and was successful
        2. It is a SIP-010 token transfer call
        3. The sender, recipient, amount, and contract match the requirements
        4. The transaction has not been previously used (replay protection)

        Args:
            payload: Payment payload containing transaction proof
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
            if not is_stacks_network(network):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"Unsupported network: {network}",
                    payer=exact_payload.from_address or None,
                )

            # Validate transaction ID
            if not exact_payload.tx_id:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="Missing transaction ID in payload",
                    payer=exact_payload.from_address or None,
                )

            if not is_valid_tx_id(exact_payload.tx_id):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"Invalid transaction ID format: {exact_payload.tx_id}",
                    payer=exact_payload.from_address or None,
                )

            # Replay protection: check if txId was already used
            if exact_payload.tx_id in self._used_tx_ids:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"Transaction ID already used: {exact_payload.tx_id}",
                    payer=exact_payload.from_address or None,
                )

            # Query the transaction on-chain
            tx_data = await self._signer.query_transaction(exact_payload.tx_id)

            if not tx_data:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="Transaction not found on-chain",
                    payer=exact_payload.from_address or None,
                )

            # Parse the transaction result
            tx_result = self._parse_transaction_data(tx_data)

            # Check success
            if tx_result.tx_status != "success":
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"Transaction not successful, status: {tx_result.tx_status}",
                    payer=tx_result.sender_address or None,
                )

            # Extract transfer details
            transfer = extract_token_transfer(tx_result)
            if transfer is None:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="Transaction is not a valid SIP-010 token transfer",
                    payer=tx_result.sender_address or None,
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

            # Validate contract address if specified in requirements
            expected_contract = self._resolve_expected_contract(asset, req_data)
            if expected_contract and transfer.contract_address != expected_contract:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=(
                        f"Transfer contract {transfer.contract_address} does not match "
                        f"expected contract {expected_contract}"
                    ),
                    payer=transfer.from_address or None,
                )

            # All checks passed - mark txId as used for replay protection
            self._used_tx_ids.add(exact_payload.tx_id)

            return VerifyResponse(
                is_valid=True,
                invalid_reason=None,
                payer=transfer.from_address,
            )

        except Exception as e:
            logger.error(f"Stacks verification failed: {e}")
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
        """Settle a Stacks exact-direct payment.

        For exact-direct payments, the transfer has already been executed
        on-chain by the client. Settlement simply confirms the transfer
        and returns the transaction ID as the settlement proof.

        This method first verifies the payment, then returns the
        transaction ID as the settlement proof.

        Args:
            payload: The verified payment payload
            requirements: The payment requirements

        Returns:
            SettleResponse with the transaction ID and status
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

            # Payment already settled on-chain, return the transaction ID
            exact_payload = ExactDirectPayload.from_dict(payload_data)

            return SettleResponse(
                success=True,
                error_reason=None,
                transaction=exact_payload.tx_id,
                network=network,
                payer=verify_result.payer,
            )

        except Exception as e:
            logger.error(f"Stacks settlement failed: {e}")
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

    def _parse_transaction_data(self, data: Dict[str, Any]) -> TransactionResult:
        """Parse raw transaction query data into a TransactionResult.

        Args:
            data: Raw dictionary from the Hiro API query

        Returns:
            TransactionResult instance
        """
        return TransactionResult(
            tx_id=data.get("tx_id", ""),
            tx_status=data.get("tx_status", ""),
            sender_address=data.get("sender_address", ""),
            contract_call=data.get("contract_call"),
            block_height=int(data.get("block_height", 0)),
            block_hash=data.get("block_hash", ""),
        )

    def _resolve_expected_contract(
        self, asset: str, req_data: Dict[str, Any]
    ) -> Optional[str]:
        """Resolve the expected contract address from requirements.

        Tries to determine the contract address from:
        1. The CAIP-19 asset identifier
        2. The extra.contractAddress field
        3. The network's default token

        Args:
            asset: CAIP-19 asset identifier string
            req_data: Requirements dictionary

        Returns:
            Expected contract address, or None if it cannot be determined
        """
        # Try CAIP-19 identifier
        if asset:
            parsed = parse_contract_identifier(asset)
            if parsed is not None:
                return parsed

        # Try extra.contractAddress
        extra = req_data.get("extra", {})
        if extra and "contractAddress" in extra:
            contract_val = extra["contractAddress"]
            if isinstance(contract_val, str) and contract_val:
                return contract_val

        # Try network default
        network = req_data.get("network", "")
        if network:
            try:
                config = get_network_config(network)
                return config.default_token.contract_address
            except ValueError:
                pass

        return None
