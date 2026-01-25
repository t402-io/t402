"""Tezos Exact-Direct Scheme - Facilitator Implementation.

This module provides the facilitator-side implementation of the exact-direct
payment scheme for Tezos.

The facilitator:
1. Receives a payment payload containing an operation hash
2. Queries the Tezos blockchain (via TzKT indexer) for operation details
3. Verifies: status="applied", correct sender/recipient/amount/contract
4. For settle: the operation is already executed, so settle confirms verification
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
from t402.schemes.tezos.constants import (
    SCHEME_EXACT_DIRECT,
    FA2_TRANSFER_ENTRYPOINT,
    is_valid_address,
    is_valid_operation_hash,
    parse_asset_identifier,
)
from t402.schemes.tezos.types import FacilitatorTezosSigner


logger = logging.getLogger(__name__)


class ExactDirectTezosFacilitator:
    """Facilitator scheme for Tezos exact-direct payments.

    Verifies on-chain FA2 transfer operations by querying the Tezos blockchain
    and checking that the operation matches the payment requirements.

    In the exact-direct scheme, the client has already executed the transfer,
    so the facilitator's role is purely verification. Settlement confirms that
    the operation was successfully applied on-chain.

    Example:
        ```python
        from t402.schemes.tezos import ExactDirectTezosFacilitator

        class MyTezosQuerier:
            async def get_operation(self, op_hash, network):
                # Query TzKT indexer
                return {...}

        facilitator = ExactDirectTezosFacilitator(
            signer=MyTezosQuerier(),
            addresses={"tezos:NetXdQprcVkpaWU": "tz1..."},
        )

        result = await facilitator.verify(payload, requirements)
        if result.is_valid:
            settlement = await facilitator.settle(payload, requirements)
        ```
    """

    scheme = SCHEME_EXACT_DIRECT
    caip_family = "tezos:*"

    def __init__(
        self,
        signer: FacilitatorTezosSigner,
        addresses: Optional[Dict[str, str]] = None,
    ):
        """Initialize the Tezos exact-direct facilitator.

        Args:
            signer: A Tezos operation querier implementing FacilitatorTezosSigner.
                    Must provide get_operation() method.
            addresses: Mapping of network -> facilitator Tezos address.
                      Used for get_signers() responses. Keys are CAIP-2 network IDs.
        """
        self._signer = signer
        self._addresses = addresses or {}

    def get_extra(self, network: Network) -> Optional[Dict[str, Any]]:
        """Get mechanism-specific extra data for supported kinds.

        Args:
            network: The network identifier

        Returns:
            None (no extra data needed for exact-direct scheme)
        """
        return None

    def get_signers(self, network: Network) -> List[str]:
        """Get signer addresses for this facilitator on a given network.

        Args:
            network: The network identifier (CAIP-2 format)

        Returns:
            List of facilitator addresses for the given network
        """
        address = self._addresses.get(network)
        if address:
            return [address]
        return []

    async def verify(
        self,
        payload: Union[PaymentPayloadV2, Dict[str, Any]],
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> VerifyResponse:
        """Verify a Tezos exact-direct payment payload.

        Queries the Tezos blockchain for the operation hash and verifies:
        1. Operation exists and has status "applied"
        2. Target contract matches the expected FA2 contract
        3. Entrypoint is "transfer"
        4. Sender matches the payload's "from" field
        5. Recipient matches the requirements' "payTo" address
        6. Amount is >= the required amount
        7. Token ID matches

        Args:
            payload: The payment payload containing the operation hash
            requirements: The payment requirements to verify against

        Returns:
            VerifyResponse indicating validity and payer address
        """
        try:
            # Extract payload and requirements data
            payload_data = self._extract_payload(payload)
            req_data = self._extract_requirements(requirements)

            # Get the inner payload fields
            op_hash = payload_data.get("opHash", "")
            from_address = payload_data.get("from", "")
            _to_address = payload_data.get("to", "")  # noqa: F841
            _amount_str = payload_data.get("amount", "0")  # noqa: F841
            contract_address = payload_data.get("contractAddress", "")
            token_id = payload_data.get("tokenId", 0)

            # Validate operation hash format
            if not is_valid_operation_hash(op_hash):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"Invalid operation hash format: {op_hash}",
                    payer=from_address or None,
                )

            # Validate from address
            if not is_valid_address(from_address):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"Invalid sender address: {from_address}",
                    payer=None,
                )

            # Get required fields from requirements
            req_network = req_data.get("network", "")
            req_pay_to = req_data.get("payTo") or req_data.get("pay_to", "")
            req_amount = req_data.get("amount", "0")
            req_asset = req_data.get("asset", "")

            # Parse expected asset info from requirements
            if req_asset:
                try:
                    expected_asset = parse_asset_identifier(req_asset)
                    expected_contract = expected_asset["contract_address"]
                    expected_token_id = expected_asset["token_id"]
                except ValueError as e:
                    return VerifyResponse(
                        is_valid=False,
                        invalid_reason=f"Invalid asset in requirements: {e}",
                        payer=from_address,
                    )
            else:
                expected_contract = contract_address
                expected_token_id = token_id

            # Query the operation on-chain
            try:
                operation = await self._signer.get_operation(op_hash, req_network)
            except Exception as e:
                logger.error("Failed to query operation %s: %s", op_hash, e)
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"Failed to query operation: {str(e)}",
                    payer=from_address,
                )

            if not operation:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"Operation not found: {op_hash}",
                    payer=from_address,
                )

            # Check operation status
            status = operation.get("status", "")
            if status != "applied":
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=(
                        f"Operation status is '{status}', expected 'applied'"
                    ),
                    payer=from_address,
                )

            # Check entrypoint
            entrypoint = operation.get("entrypoint", "")
            if entrypoint != FA2_TRANSFER_ENTRYPOINT:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=(
                        f"Operation entrypoint is '{entrypoint}', "
                        f"expected '{FA2_TRANSFER_ENTRYPOINT}'"
                    ),
                    payer=from_address,
                )

            # Check target contract
            target = operation.get("target", {})
            target_address = target.get("address", "") if isinstance(target, dict) else ""
            if target_address != expected_contract:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=(
                        f"Operation target contract '{target_address}' does not match "
                        f"expected '{expected_contract}'"
                    ),
                    payer=from_address,
                )

            # Check sender
            sender = operation.get("sender", {})
            sender_address = sender.get("address", "") if isinstance(sender, dict) else ""
            if sender_address != from_address:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=(
                        f"Operation sender '{sender_address}' does not match "
                        f"payload sender '{from_address}'"
                    ),
                    payer=from_address,
                )

            # Extract and verify transfer parameters
            transfer_details = self._extract_transfer_details(operation)
            if transfer_details is None:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="Failed to parse FA2 transfer parameters",
                    payer=from_address,
                )

            # Verify recipient
            if req_pay_to and transfer_details["to"] != req_pay_to:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=(
                        f"Transfer recipient '{transfer_details['to']}' does not match "
                        f"required payTo '{req_pay_to}'"
                    ),
                    payer=from_address,
                )

            # Verify amount (must be >= required)
            try:
                transfer_amount = int(transfer_details["amount"])
                required_amount = int(req_amount)
                if transfer_amount < required_amount:
                    return VerifyResponse(
                        is_valid=False,
                        invalid_reason=(
                            f"Transfer amount {transfer_amount} is less than "
                            f"required amount {required_amount}"
                        ),
                        payer=from_address,
                    )
            except (ValueError, TypeError) as e:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"Invalid amount in transfer: {e}",
                    payer=from_address,
                )

            # Verify token ID
            if transfer_details.get("token_id") != expected_token_id:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=(
                        f"Token ID {transfer_details.get('token_id')} does not match "
                        f"expected {expected_token_id}"
                    ),
                    payer=from_address,
                )

            # All checks passed
            return VerifyResponse(
                is_valid=True,
                invalid_reason=None,
                payer=from_address,
            )

        except Exception as e:
            logger.error("Tezos verification failed: %s", e)
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
        """Settle a verified Tezos exact-direct payment.

        In the exact-direct scheme, the transfer has already been executed by
        the client. Settlement simply confirms the verification was successful
        and returns the operation hash as the transaction reference.

        Args:
            payload: The verified payment payload with operation hash
            requirements: The payment requirements

        Returns:
            SettleResponse with operation hash and status
        """
        try:
            # First verify the payment
            verify_result = await self.verify(payload, requirements)

            if not verify_result.is_valid:
                return SettleResponse(
                    success=False,
                    error_reason=verify_result.invalid_reason,
                    transaction=None,
                    network=self._get_network(requirements),
                    payer=verify_result.payer,
                )

            # Extract operation hash from payload
            payload_data = self._extract_payload(payload)
            op_hash = payload_data.get("opHash", "")
            network = self._get_network(requirements)

            return SettleResponse(
                success=True,
                error_reason=None,
                transaction=op_hash,
                network=network,
                payer=verify_result.payer,
            )

        except Exception as e:
            logger.error("Tezos settlement failed: %s", e)
            return SettleResponse(
                success=False,
                error_reason=f"Settlement error: {str(e)}",
                transaction=None,
                network=self._get_network(requirements),
                payer=None,
            )

    def _extract_payload(
        self, payload: Union[PaymentPayloadV2, Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Extract payload data as a dict.

        Handles both PaymentPayloadV2 models (where the inner payload is
        in the 'payload' field) and plain dicts.

        Args:
            payload: Payment payload (model or dict)

        Returns:
            Dict containing the inner payload fields
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

    def _get_network(
        self, requirements: Union[PaymentRequirementsV2, Dict[str, Any]]
    ) -> Optional[str]:
        """Extract network from requirements.

        Args:
            requirements: Payment requirements

        Returns:
            Network string or None
        """
        if hasattr(requirements, "model_dump"):
            data = requirements.model_dump(by_alias=True)
            return data.get("network")
        elif isinstance(requirements, dict):
            return requirements.get("network")
        return None

    def _extract_transfer_details(
        self, operation: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Extract FA2 transfer details from an operation.

        Parses the FA2 transfer parameter to extract sender, recipient,
        amount, and token ID from the first transfer in the batch.

        The parameter structure follows the FA2 standard:
        [{"from_": "tz1...", "txs": [{"to_": "tz1...", "token_id": 0, "amount": "1000000"}]}]

        Args:
            operation: Operation dict from the indexer

        Returns:
            Dict with "from", "to", "amount", "token_id" if parsing succeeds,
            None if the parameter cannot be parsed
        """
        parameter = operation.get("parameter")
        if parameter is None:
            return None

        try:
            # Parameter can be a list of transfer batches or a single batch
            if isinstance(parameter, list):
                params = parameter
            elif isinstance(parameter, dict):
                # Some indexers wrap in a value field
                value = parameter.get("value", parameter)
                if isinstance(value, list):
                    params = value
                else:
                    params = [value]
            else:
                return None

            if not params:
                return None

            first_param = params[0]
            from_address = first_param.get("from_") or first_param.get("from", "")

            txs = first_param.get("txs", [])
            if not txs:
                return None

            first_tx = txs[0]
            to_address = first_tx.get("to_") or first_tx.get("to", "")
            amount = str(first_tx.get("amount", "0"))
            token_id = first_tx.get("token_id", 0)

            # Handle token_id as string or int
            if isinstance(token_id, str):
                token_id = int(token_id)

            return {
                "from": from_address,
                "to": to_address,
                "amount": amount,
                "token_id": token_id,
            }

        except (KeyError, IndexError, TypeError, ValueError) as e:
            logger.debug("Failed to parse FA2 transfer parameters: %s", e)
            return None
