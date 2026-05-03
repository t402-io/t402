"""Stellar Exact Scheme - Facilitator Implementation.

This module provides the facilitator-side implementation of the exact payment
scheme for Stellar network using Soroban token transfers (SEP-41).

The facilitator:
1. Verifies signed transactions by checking authorization metadata and
   transaction structure
2. Settles payments by submitting the signed transaction to the Stellar network
3. Waits for transaction confirmation via ledger inclusion
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
from t402.stellar import (
    SCHEME_EXACT,
    MIN_VALIDITY_BUFFER,
    LEDGER_TIME_SECONDS,
    addresses_equal,
    is_valid_network,
    get_network_config,
    StellarVerifyResult,
    StellarTransactionConfirmation,
)


logger = logging.getLogger(__name__)


@runtime_checkable
class FacilitatorStellarSigner(Protocol):
    """Protocol for Stellar facilitator signer operations.

    Implementations should provide address retrieval, transaction verification,
    balance checking, transaction submission, and confirmation capabilities.

    Example implementation:
        ```python
        class MyStellarFacilitatorSigner:
            def __init__(self, server, addresses):
                self._server = server
                self._addresses = addresses

            def get_addresses(self, network: str) -> List[str]:
                return self._addresses.get(network, [])

            async def get_token_balance(
                self,
                owner_address: str,
                token_contract: str,
                network: str,
            ) -> str:
                return await self._server.get_token_balance(
                    owner_address, token_contract
                )

            async def verify_transaction(
                self,
                signed_tx: str,
                expected_from: str,
                expected_transfer: dict,
                network: str,
            ) -> StellarVerifyResult:
                # Verify transaction structure and parameters
                ...

            async def submit_transaction(
                self, signed_tx: str, network: str
            ) -> str:
                return await self._server.submit_transaction(signed_tx)

            async def wait_for_confirmation(
                self,
                tx_hash: str,
                timeout_ms: int,
                network: str,
            ) -> StellarTransactionConfirmation:
                # Wait for ledger inclusion
                ...

            async def get_current_ledger(self, network: str) -> int:
                return await self._server.get_current_ledger()
        ```
    """

    def get_addresses(self, network: str) -> List[str]:
        """Return all facilitator addresses for the given network."""
        ...

    async def get_token_balance(
        self,
        owner_address: str,
        token_contract: str,
        network: str,
    ) -> str:
        """Get the token balance for an owner.

        Args:
            owner_address: Owner's Stellar address (G-account)
            token_contract: Token contract address (C-account)
            network: Network identifier

        Returns:
            Balance in smallest units as string
        """
        ...

    async def verify_transaction(
        self,
        signed_tx: str,
        expected_from: str,
        expected_transfer: Dict[str, str],
        network: str,
    ) -> StellarVerifyResult:
        """Verify a signed transaction structure.

        Args:
            signed_tx: Base64-encoded signed transaction XDR
            expected_from: Expected sender address
            expected_transfer: Dict with amount, destination, token_contract
            network: Network identifier

        Returns:
            StellarVerifyResult indicating validity
        """
        ...

    async def submit_transaction(
        self,
        signed_tx: str,
        network: str,
    ) -> str:
        """Submit a signed transaction to the Stellar network.

        Args:
            signed_tx: Base64-encoded signed transaction XDR
            network: Network identifier

        Returns:
            Transaction hash
        """
        ...

    async def wait_for_confirmation(
        self,
        tx_hash: str,
        timeout_ms: int,
        network: str,
    ) -> StellarTransactionConfirmation:
        """Wait for a transaction to be confirmed in a ledger.

        Args:
            tx_hash: Transaction hash to confirm
            timeout_ms: Maximum wait time in milliseconds
            network: Network identifier

        Returns:
            StellarTransactionConfirmation with success status and hash
        """
        ...

    async def get_current_ledger(self, network: str) -> int:
        """Get the current ledger sequence number.

        Args:
            network: Network identifier

        Returns:
            Current ledger sequence number
        """
        ...


class ExactStellarFacilitatorScheme:
    """Facilitator scheme for Stellar exact payments using Soroban token transfers.

    Verifies signed transactions and settles payments by submitting them
    to the Stellar network.

    The verification process checks:
    1. Scheme and network validity
    2. Transaction structure via signer verification
    3. Max ledger expiry (with buffer)
    4. Token balance sufficiency
    5. Amount >= required amount
    6. Recipient matches payTo
    7. Token contract matches required asset

    Example:
        ```python
        facilitator = ExactStellarFacilitatorScheme(signer=my_stellar_signer)

        # Verify a payment
        result = await facilitator.verify(payload, requirements)
        if result.is_valid:
            # Settle the payment
            settlement = await facilitator.settle(payload, requirements)
        ```
    """

    scheme = SCHEME_EXACT
    caip_family = "stellar:*"

    def __init__(self, signer: FacilitatorStellarSigner):
        """Initialize the Stellar facilitator scheme.

        Args:
            signer: Stellar facilitator signer for transaction verification,
                balance checking, and transaction submission.
        """
        self._signer = signer

    def get_extra(self, network: Network) -> Optional[Dict[str, Any]]:
        """Get mechanism-specific extra data for supported kinds.

        Returns asset metadata (default asset address, symbol, decimals)
        for the specified Stellar network.

        Args:
            network: The network identifier (e.g., "stellar:pubnet")

        Returns:
            Dict with asset metadata if network is supported, else None
        """
        config = get_network_config(network)
        if not config:
            return None

        default_asset = config["default_asset"]
        return {
            "defaultAsset": default_asset["contract_address"],
            "symbol": default_asset["symbol"],
            "decimals": default_asset["decimals"],
        }

    def get_signers(self, network: Network) -> List[str]:
        """Get signer addresses for this facilitator on the given network.

        Args:
            network: The network identifier

        Returns:
            List of facilitator account addresses
        """
        return self._signer.get_addresses(network)

    async def verify(
        self,
        payload: Union[PaymentPayloadV2, Dict[str, Any]],
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> VerifyResponse:
        """Verify a Stellar token transfer payment payload.

        Args:
            payload: The payment payload containing signed transaction
            requirements: The payment requirements to verify against

        Returns:
            VerifyResponse indicating validity and payer address
        """
        try:
            payload_data = self._extract_payload(payload)
            req_data = self._extract_requirements(requirements)

            network = req_data.get("network", "")
            scheme = req_data.get("scheme", "")

            # Step 1: Validate scheme
            if scheme != SCHEME_EXACT:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="unsupported_scheme",
                    payer=None,
                )

            # Step 2: Validate network
            if not is_valid_network(network):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="unsupported_network",
                    payer=None,
                )

            # Step 3: Parse Stellar payload
            stellar_payload = self._parse_stellar_payload(payload_data)
            if stellar_payload is None:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_payload",
                    payer=None,
                )

            authorization = stellar_payload["authorization"]
            signed_tx = stellar_payload["signed_tx"]
            payer = authorization["from"]

            # Step 4: Verify transaction structure via signer
            pay_to = req_data.get("payTo", "")
            asset = req_data.get("asset", "")

            expected_transfer = {
                "amount": authorization["amount"],
                "destination": pay_to,
                "token_contract": asset,
            }

            verify_result = await self._signer.verify_transaction(
                signed_tx=signed_tx,
                expected_from=payer,
                expected_transfer=expected_transfer,
                network=network,
            )

            if not verify_result.valid:
                reason = verify_result.reason or "unknown"
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"transaction_verification_failed: {reason}",
                    payer=payer,
                )

            # Step 5: Check max ledger expiry (with buffer)
            try:
                current_ledger = await self._signer.get_current_ledger(network)
            except Exception as e:
                logger.error(f"Ledger check failed: {e}")
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="ledger_check_failed",
                    payer=payer,
                )

            max_ledger = authorization["max_ledger"]
            buffer_ledgers = MIN_VALIDITY_BUFFER // LEDGER_TIME_SECONDS
            if max_ledger < current_ledger + buffer_ledgers:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="transaction_expired",
                    payer=payer,
                )

            # Step 6: Verify token balance
            try:
                balance_str = await self._signer.get_token_balance(
                    owner_address=payer,
                    token_contract=asset,
                    network=network,
                )
                balance = int(balance_str)
            except (ValueError, TypeError) as e:
                logger.error(f"Balance check failed: {e}")
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="balance_check_failed",
                    payer=payer,
                )

            required_amount_str = req_data.get("amount", "0")
            try:
                required_amount = int(required_amount_str)
            except (ValueError, TypeError):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_required_amount",
                    payer=payer,
                )

            if balance < required_amount:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="insufficient_balance",
                    payer=payer,
                )

            # Step 7: Verify amount sufficiency
            try:
                payload_amount = int(authorization["amount"])
            except (ValueError, TypeError):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_payload_amount",
                    payer=payer,
                )

            if payload_amount < required_amount:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="insufficient_amount",
                    payer=payer,
                )

            # Step 8: Verify recipient matching
            auth_to = authorization.get("to", "")
            if not addresses_equal(auth_to, pay_to):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="recipient_mismatch",
                    payer=payer,
                )

            # Step 9: Verify token contract matching
            auth_token = authorization.get("token_contract", "")
            if not addresses_equal(auth_token, asset):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="asset_mismatch",
                    payer=payer,
                )

            # All checks passed
            return VerifyResponse(
                is_valid=True,
                invalid_reason=None,
                payer=payer,
            )

        except Exception as e:
            logger.error(f"Stellar verification failed: {e}")
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
        """Settle a Stellar token transfer payment on-chain.

        Verifies the payment first, then submits the signed transaction
        and waits for ledger confirmation.

        Args:
            payload: The verified payment payload with signed transaction
            requirements: The payment requirements

        Returns:
            SettleResponse with transaction hash and status
        """
        req_data = self._extract_requirements(requirements)
        network = req_data.get("network", "")

        # Step 1: Verify the payment first
        verify_result = await self.verify(payload, requirements)

        if not verify_result.is_valid:
            return SettleResponse(
                success=False,
                error_reason=verify_result.invalid_reason,
                transaction=None,
                network=network,
                payer=verify_result.payer,
            )

        # Step 2: Extract payload data for submission
        try:
            payload_data = self._extract_payload(payload)
            stellar_payload = self._parse_stellar_payload(payload_data)

            if stellar_payload is None:
                return SettleResponse(
                    success=False,
                    error_reason="invalid_payload",
                    transaction=None,
                    network=network,
                    payer=verify_result.payer,
                )

            signed_tx = stellar_payload["signed_tx"]
            payer = stellar_payload["authorization"]["from"]

        except Exception as e:
            logger.error(f"Payload extraction failed: {e}")
            return SettleResponse(
                success=False,
                error_reason=f"invalid_payload: {str(e)}",
                transaction=None,
                network=network,
                payer=verify_result.payer,
            )

        # Step 3: Submit the signed transaction
        try:
            tx_hash = await self._signer.submit_transaction(
                signed_tx=signed_tx,
                network=network,
            )
        except Exception as e:
            logger.error(f"Transaction submission failed: {e}")
            return SettleResponse(
                success=False,
                error_reason=f"transaction_failed: {str(e)}",
                transaction=None,
                network=network,
                payer=payer,
            )

        # Step 4: Wait for transaction confirmation
        try:
            confirmation = await self._signer.wait_for_confirmation(
                tx_hash=tx_hash,
                timeout_ms=60000,  # 60 seconds
                network=network,
            )
        except Exception as e:
            logger.error(f"Transaction confirmation failed: {e}")
            return SettleResponse(
                success=False,
                error_reason=f"transaction_confirmation_failed: {str(e)}",
                transaction=tx_hash,
                network=network,
                payer=payer,
            )

        if not confirmation.success:
            return SettleResponse(
                success=False,
                error_reason=confirmation.error or "confirmation_failed",
                transaction=tx_hash,
                network=network,
                payer=payer,
            )

        final_tx_hash = confirmation.hash if confirmation.hash else tx_hash

        return SettleResponse(
            success=True,
            error_reason=None,
            transaction=final_tx_hash,
            network=network,
            payer=payer,
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

    def _parse_stellar_payload(
        self, payload_data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Parse and validate Stellar-specific payload fields.

        Args:
            payload_data: Raw payload dict

        Returns:
            Normalized dict with signed_tx and authorization fields,
            or None if required fields are missing.
        """
        signed_tx = payload_data.get("signedTx") or payload_data.get("signed_tx")
        if not signed_tx:
            return None

        auth_data = payload_data.get("authorization")
        if not auth_data:
            return None

        # Normalize authorization fields (handle both camelCase and snake_case)
        from_addr = (
            auth_data.get("from")
            or auth_data.get("from_")
            or ""
        )
        to_addr = auth_data.get("to", "")
        token_contract = (
            auth_data.get("tokenContract")
            or auth_data.get("token_contract")
            or ""
        )
        amount = auth_data.get("amount", "0")
        max_ledger = (
            auth_data.get("maxLedger")
            or auth_data.get("max_ledger")
            or 0
        )
        network = auth_data.get("network", "")

        if not from_addr:
            return None

        return {
            "signed_tx": signed_tx,
            "authorization": {
                "from": from_addr,
                "to": to_addr,
                "token_contract": token_contract,
                "amount": str(amount),
                "max_ledger": int(max_ledger),
                "network": network,
            },
        }
