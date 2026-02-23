"""EVM Permit2 Proxy Scheme - Facilitator Implementation.

This module provides the facilitator-side implementation of the Permit2 Proxy
payment scheme for EVM networks.

The facilitator:
1. Verifies Permit2 Proxy payload fields (token, amount, witness, facilitator)
2. Checks payer balance and validAfter constraint
3. Settles payments by calling settle() on the proxy contract
4. Waits for transaction confirmation

The proxy contract routes settlement through either the exact proxy
(settle(permit, owner, witness, signature)) or the upto proxy
(settle(permit, amount, owner, witness, signature)).
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional, Protocol, Union, runtime_checkable

from t402.types import (
    PaymentRequirementsV2,
    PaymentPayloadV2,
    VerifyResponse,
    SettleResponse,
    Network,
)
from t402.schemes.evm.permit2.client import PERMIT2_ADDRESS
from t402.schemes.evm.permit2_proxy.client import (
    SCHEME_PERMIT2_PROXY,
    EXACT_PROXY_ADDRESS,
    UPTO_PROXY_ADDRESS,
)


logger = logging.getLogger(__name__)

CAIP_FAMILY = "eip155:*"
DEFAULT_CONFIRMATION_TIMEOUT = 60000


class Permit2ProxyTransactionConfirmation:
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


@runtime_checkable
class FacilitatorPermit2ProxySigner(Protocol):
    """Protocol for EVM facilitator signer operations for Permit2 Proxy."""

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

    async def execute_proxy_settle(
        self,
        proxy_address: str,
        token: str,
        amount: str,
        nonce: str,
        deadline: str,
        owner: str,
        witness_to: str,
        witness_facilitator: str,
        witness_valid_after: str,
        signature: str,
        network: str,
        settlement_amount: Optional[str] = None,
    ) -> str:
        """Call settle() on the proxy contract.

        For exact proxy: settle(permit, owner, witness, signature)
        For upto proxy: settle(permit, amount, owner, witness, signature)

        Args:
            proxy_address: Proxy contract address
            token: Token address
            amount: Permitted amount
            nonce: Permit nonce
            deadline: Permit deadline
            owner: Token owner (payer)
            witness_to: Witness recipient address
            witness_facilitator: Witness facilitator address
            witness_valid_after: Witness validAfter timestamp
            signature: EIP-712 signature
            network: Network identifier
            settlement_amount: Settlement amount for upto proxy (None for exact)

        Returns:
            Transaction hash
        """
        ...

    async def wait_for_confirmation(
        self,
        tx_hash: str,
        network: str,
        timeout_ms: int = 60000,
    ) -> Permit2ProxyTransactionConfirmation:
        """Wait for a transaction to be confirmed."""
        ...


class Permit2ProxyEvmFacilitatorScheme:
    """Facilitator scheme for EVM Permit2 Proxy payments.

    Verifies Permit2 Proxy payloads and settles payments via proxy contracts.

    Example:
        ```python
        facilitator = Permit2ProxyEvmFacilitatorScheme(signer=my_signer)

        result = await facilitator.verify(payload, requirements)
        if result.is_valid:
            settlement = await facilitator.settle(payload, requirements)
        ```
    """

    scheme = SCHEME_PERMIT2_PROXY
    caip_family = CAIP_FAMILY

    def __init__(self, signer: FacilitatorPermit2ProxySigner):
        self._signer = signer

    def get_extra(self, network: Network) -> Optional[Dict[str, Any]]:
        """Get Permit2 Proxy-specific extra data for supported kinds."""
        if not self._is_valid_network(network):
            return None
        return {
            "permit2Address": PERMIT2_ADDRESS,
            "exactProxyAddress": EXACT_PROXY_ADDRESS,
            "uptoProxyAddress": UPTO_PROXY_ADDRESS,
        }

    def get_signers(self, network: Network) -> List[str]:
        """Get signer addresses for this facilitator."""
        return self._signer.get_addresses(network)

    async def verify(
        self,
        payload: Union[PaymentPayloadV2, Dict[str, Any]],
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> VerifyResponse:
        """Verify a Permit2 Proxy payment payload.

        Checks:
        1. Scheme validity
        2. Network validity
        3. Payload structure (permit, witness, signature, owner)
        4. Token matches required asset
        5. Witness destination matches payTo
        6. Facilitator in witness is one of our addresses
        7. Permitted amount >= required amount
        8. validAfter is not in the future
        9. Payer balance sufficiency
        """
        try:
            payload_data = self._extract_payload(payload)
            req_data = self._extract_requirements(requirements)

            network = req_data.get("network", "")
            scheme = req_data.get("scheme", "")

            # Step 1: Validate scheme
            if scheme != SCHEME_PERMIT2_PROXY:
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

            # Step 3: Parse Permit2 Proxy payload
            proxy_payload = self._parse_proxy_payload(payload_data)
            if proxy_payload is None:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_payload",
                    payer=None,
                )

            owner = proxy_payload["owner"]
            permit = proxy_payload["permit"]
            witness = proxy_payload["witness"]

            # Step 4: Verify token matches
            if not self._addresses_equal(
                permit["permitted"]["token"], req_data.get("asset", "")
            ):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="token_mismatch",
                    payer=owner,
                )

            # Step 5: Verify witness destination matches payTo
            if not self._addresses_equal(
                witness["to"], req_data.get("payTo", "")
            ):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="recipient_mismatch",
                    payer=owner,
                )

            # Step 6: Verify facilitator is one of our addresses
            facilitator_match = False
            for addr in self._signer.get_addresses(network):
                if self._addresses_equal(addr, witness["facilitator"]):
                    facilitator_match = True
                    break

            if not facilitator_match:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="unauthorized_facilitator",
                    payer=owner,
                )

            # Step 7: Verify permitted amount
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

            # Step 8: Verify validAfter is not in the future
            try:
                valid_after = int(witness["validAfter"])
            except (ValueError, TypeError):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_valid_after",
                    payer=owner,
                )

            now = int(time.time())
            if valid_after > now:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="payment_too_early",
                    payer=owner,
                )

            # Step 9: Check balance
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
            logger.error(f"Permit2 Proxy verification failed: {e}")
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
        """Settle a Permit2 Proxy payment on-chain via the proxy contract.

        Verifies first, then calls settle() on the appropriate proxy contract.
        Uses exact proxy for exact-amount settlements and upto proxy when
        the permitted amount exceeds the required amount.
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
            proxy_payload = self._parse_proxy_payload(payload_data)
            if proxy_payload is None:
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

        owner = proxy_payload["owner"]
        permit = proxy_payload["permit"]
        witness = proxy_payload["witness"]

        # Determine proxy type (exact vs upto)
        permitted_amount = int(permit["permitted"]["amount"])
        required_amount = int(req_data.get("amount", "0"))
        is_upto = (
            req_data.get("scheme") == "upto"
            or permitted_amount > required_amount
        )

        # Get proxy addresses from requirements extra
        extra = req_data.get("extra", {}) or {}
        if is_upto:
            proxy_address = extra.get("uptoProxyAddress", UPTO_PROXY_ADDRESS)
            settlement_amount = str(required_amount)
        else:
            proxy_address = extra.get("exactProxyAddress", EXACT_PROXY_ADDRESS)
            settlement_amount = None

        # Step 3: Execute settle on proxy contract
        try:
            tx_hash = await self._signer.execute_proxy_settle(
                proxy_address=proxy_address,
                token=permit["permitted"]["token"],
                amount=permit["permitted"]["amount"],
                nonce=permit["nonce"],
                deadline=permit["deadline"],
                owner=owner,
                witness_to=witness["to"],
                witness_facilitator=witness["facilitator"],
                witness_valid_after=witness["validAfter"],
                signature=proxy_payload["signature"],
                network=network,
                settlement_amount=settlement_amount,
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

    def _parse_proxy_payload(
        self, payload_data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Parse and validate Permit2 Proxy payload fields."""
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

        witness = payload_data.get("witness")
        if not witness:
            return None

        if not witness.get("to") or not witness.get("facilitator"):
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
            "witness": {
                "to": witness.get("to", ""),
                "facilitator": witness.get("facilitator", ""),
                "validAfter": str(witness.get("validAfter", "0")),
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
