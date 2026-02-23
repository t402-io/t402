"""EVM Permit2 Scheme - Facilitator Implementation.

This module provides the facilitator-side implementation of the Permit2 payment
scheme for EVM networks.

The facilitator:
1. Verifies Permit2 payment payload fields (token, amount, recipient)
2. Checks payer balance
3. Settles payments by calling permitTransferFrom on the Permit2 contract
4. Waits for transaction confirmation
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Protocol, Union, runtime_checkable

from t402.types import (
    PaymentRequirementsV2,
    PaymentPayloadV2,
    VerifyResponse,
    SettleResponse,
    Network,
)
from t402.schemes.evm.permit2.client import SCHEME_PERMIT2, PERMIT2_ADDRESS


logger = logging.getLogger(__name__)

CAIP_FAMILY = "eip155:*"
DEFAULT_CONFIRMATION_TIMEOUT = 60000


@runtime_checkable
class FacilitatorPermit2Signer(Protocol):
    """Protocol for EVM facilitator signer operations for Permit2.

    Implementations should provide address retrieval, balance checking,
    Permit2 contract interaction, and transaction confirmation.
    """

    def get_addresses(self, network: str) -> List[str]:
        """Return all facilitator addresses for the given network."""
        ...

    async def get_balance(
        self,
        owner_address: str,
        token_address: str,
        network: str,
    ) -> str:
        """Get the ERC-20 token balance for an address."""
        ...

    async def execute_permit2_transfer(
        self,
        permit2_address: str,
        token: str,
        amount: str,
        nonce: str,
        deadline: str,
        to: str,
        requested_amount: str,
        owner: str,
        signature: str,
        network: str,
    ) -> str:
        """Call permitTransferFrom on the Permit2 contract.

        Args:
            permit2_address: Permit2 contract address
            token: Token address
            amount: Permitted amount
            nonce: Permit nonce
            deadline: Permit deadline
            to: Transfer recipient
            requested_amount: Requested transfer amount
            owner: Token owner (payer)
            signature: EIP-712 signature
            network: Network identifier

        Returns:
            Transaction hash
        """
        ...

    async def wait_for_confirmation(
        self,
        tx_hash: str,
        network: str,
        timeout_ms: int = 60000,
    ) -> "Permit2TransactionConfirmation":
        """Wait for a transaction to be confirmed."""
        ...


class Permit2TransactionConfirmation:
    """Result of waiting for transaction confirmation."""

    def __init__(
        self,
        success: bool,
        tx_hash: Optional[str] = None,
        block_number: Optional[int] = None,
        error: Optional[str] = None,
    ):
        self.success = success
        self.tx_hash = tx_hash
        self.block_number = block_number
        self.error = error


class Permit2EvmFacilitatorScheme:
    """Facilitator scheme for EVM Permit2 payments.

    Verifies Permit2 PermitTransferFrom payloads and settles payments
    by calling permitTransferFrom on the Permit2 contract.

    Example:
        ```python
        facilitator = Permit2EvmFacilitatorScheme(signer=my_signer)

        result = await facilitator.verify(payload, requirements)
        if result.is_valid:
            settlement = await facilitator.settle(payload, requirements)
        ```
    """

    scheme = SCHEME_PERMIT2
    caip_family = CAIP_FAMILY

    def __init__(self, signer: FacilitatorPermit2Signer):
        self._signer = signer

    def get_extra(self, network: Network) -> Optional[Dict[str, Any]]:
        """Get Permit2-specific extra data for supported kinds."""
        if not self._is_valid_network(network):
            return None
        return {
            "permit2Address": PERMIT2_ADDRESS,
        }

    def get_signers(self, network: Network) -> List[str]:
        """Get signer addresses for this facilitator."""
        return self._signer.get_addresses(network)

    async def verify(
        self,
        payload: Union[PaymentPayloadV2, Dict[str, Any]],
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> VerifyResponse:
        """Verify a Permit2 payment payload.

        Checks:
        1. Scheme validity
        2. Network validity
        3. Payload structure (permit, transferDetails, signature, owner)
        4. Token matches required asset
        5. Recipient matches payTo
        6. Permitted amount >= required amount
        7. Requested amount >= required amount
        8. Payer balance sufficiency
        """
        try:
            payload_data = self._extract_payload(payload)
            req_data = self._extract_requirements(requirements)

            network = req_data.get("network", "")
            scheme = req_data.get("scheme", "")

            # Step 1: Validate scheme
            if scheme != SCHEME_PERMIT2:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="unsupported_scheme",
                    payer=None,
                )

            # Step 2: Validate network
            if not self._is_valid_network(network):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="unsupported_network",
                    payer=None,
                )

            # Step 3: Parse Permit2 payload
            p2 = self._parse_permit2_payload(payload_data)
            if p2 is None:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_payload",
                    payer=None,
                )

            owner = p2["owner"]
            permit = p2["permit"]
            transfer_details = p2["transferDetails"]

            # Step 4: Verify token matches
            if not self._addresses_equal(
                permit["permitted"]["token"], req_data.get("asset", "")
            ):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="token_mismatch",
                    payer=owner,
                )

            # Step 5: Verify recipient matches
            if not self._addresses_equal(
                transfer_details["to"], req_data.get("payTo", "")
            ):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="recipient_mismatch",
                    payer=owner,
                )

            # Step 6: Verify permitted amount
            required_amount_str = req_data.get("amount", "0")
            try:
                required_amount = int(required_amount_str)
            except (ValueError, TypeError):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_required_amount",
                    payer=owner,
                )

            try:
                permitted_amount = int(permit["permitted"]["amount"])
            except (ValueError, TypeError):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_permitted_amount",
                    payer=owner,
                )

            if permitted_amount < required_amount:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="insufficient_permitted_amount",
                    payer=owner,
                )

            # Step 7: Verify requested amount
            try:
                requested_amount = int(transfer_details["requestedAmount"])
            except (ValueError, TypeError):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_requested_amount",
                    payer=owner,
                )

            if requested_amount < required_amount:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="insufficient_requested_amount",
                    payer=owner,
                )

            # Step 8: Check balance
            try:
                balance_str = await self._signer.get_balance(
                    owner_address=owner,
                    token_address=req_data.get("asset", ""),
                    network=network,
                )
                balance = int(balance_str)
            except (ValueError, TypeError) as e:
                logger.error(f"Balance check failed: {e}")
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="balance_check_failed",
                    payer=owner,
                )

            if balance < required_amount:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="insufficient_balance",
                    payer=owner,
                )

            return VerifyResponse(
                is_valid=True,
                invalid_reason=None,
                payer=owner,
            )

        except Exception as e:
            logger.error(f"Permit2 verification failed: {e}")
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
        """Settle a Permit2 payment on-chain.

        Verifies first, then calls permitTransferFrom on the Permit2 contract
        and waits for transaction confirmation.
        """
        req_data = self._extract_requirements(requirements)
        network = req_data.get("network", "")

        # Step 1: Verify
        verify_result = await self.verify(payload, requirements)
        if not verify_result.is_valid:
            return SettleResponse(
                success=False,
                error_reason=verify_result.invalid_reason,
                transaction=None,
                network=network,
                payer=verify_result.payer,
            )

        # Step 2: Extract payload
        try:
            payload_data = self._extract_payload(payload)
            p2 = self._parse_permit2_payload(payload_data)
            if p2 is None:
                return SettleResponse(
                    success=False,
                    error_reason="invalid_payload",
                    transaction=None,
                    network=network,
                    payer=verify_result.payer,
                )
        except Exception as e:
            logger.error(f"Payload extraction failed: {e}")
            return SettleResponse(
                success=False,
                error_reason=f"invalid_payload: {str(e)}",
                transaction=None,
                network=network,
                payer=verify_result.payer,
            )

        owner = p2["owner"]
        permit = p2["permit"]
        transfer_details = p2["transferDetails"]

        # Step 3: Execute permitTransferFrom
        try:
            tx_hash = await self._signer.execute_permit2_transfer(
                permit2_address=PERMIT2_ADDRESS,
                token=permit["permitted"]["token"],
                amount=permit["permitted"]["amount"],
                nonce=permit["nonce"],
                deadline=permit["deadline"],
                to=transfer_details["to"],
                requested_amount=transfer_details["requestedAmount"],
                owner=owner,
                signature=p2["signature"],
                network=network,
            )
        except Exception as e:
            logger.error(f"Transaction execution failed: {e}")
            return SettleResponse(
                success=False,
                error_reason=f"transaction_failed: {str(e)}",
                transaction=None,
                network=network,
                payer=owner,
            )

        # Step 4: Wait for confirmation
        try:
            confirmation = await self._signer.wait_for_confirmation(
                tx_hash=tx_hash,
                network=network,
                timeout_ms=DEFAULT_CONFIRMATION_TIMEOUT,
            )
        except Exception as e:
            logger.error(f"Transaction confirmation failed: {e}")
            return SettleResponse(
                success=False,
                error_reason=f"confirmation_failed: {str(e)}",
                transaction=tx_hash,
                network=network,
                payer=owner,
            )

        if not confirmation.success:
            return SettleResponse(
                success=False,
                error_reason=confirmation.error or "transaction_reverted",
                transaction=tx_hash,
                network=network,
                payer=owner,
            )

        final_tx_hash = confirmation.tx_hash if confirmation.tx_hash else tx_hash

        return SettleResponse(
            success=True,
            error_reason=None,
            transaction=final_tx_hash,
            network=network,
            payer=owner,
        )

    def _extract_payload(
        self, payload: Union[PaymentPayloadV2, Dict[str, Any]]
    ) -> Dict[str, Any]:
        if hasattr(payload, "model_dump"):
            data = payload.model_dump(by_alias=True)
            return data.get("payload", data)
        elif isinstance(payload, dict):
            return payload.get("payload", payload)
        return dict(payload)

    def _extract_requirements(
        self, requirements: Union[PaymentRequirementsV2, Dict[str, Any]]
    ) -> Dict[str, Any]:
        if hasattr(requirements, "model_dump"):
            return requirements.model_dump(by_alias=True)
        return dict(requirements)

    def _parse_permit2_payload(
        self, payload_data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Parse and validate Permit2 payload fields."""
        signature = payload_data.get("signature", "")
        if not signature:
            return None

        owner = payload_data.get("owner", "")
        if not owner:
            return None

        permit = payload_data.get("permit")
        if not permit:
            return None

        permitted = permit.get("permitted")
        if not permitted or not permitted.get("token"):
            return None

        transfer_details = payload_data.get("transferDetails")
        if not transfer_details:
            return None

        return {
            "signature": signature,
            "owner": owner,
            "permit": {
                "permitted": {
                    "token": permitted.get("token", ""),
                    "amount": str(permitted.get("amount", "0")),
                },
                "nonce": str(permit.get("nonce", "0")),
                "deadline": str(permit.get("deadline", "0")),
            },
            "transferDetails": {
                "to": transfer_details.get("to", ""),
                "requestedAmount": str(
                    transfer_details.get("requestedAmount", "0")
                ),
            },
        }

    def _is_valid_network(self, network: str) -> bool:
        if not network.startswith("eip155:"):
            return False
        try:
            chain_id = int(network.split(":")[1])
            return chain_id > 0
        except (IndexError, ValueError):
            return False

    def _addresses_equal(self, addr1: str, addr2: str) -> bool:
        if not addr1 or not addr2:
            return False
        return addr1.lower() == addr2.lower()
