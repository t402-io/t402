"""Solana SVM Exact Scheme - Facilitator Implementation.

This module provides the facilitator-side implementation of the exact payment
scheme for Solana network using SPL Token TransferChecked instructions.

The facilitator:
1. Verifies signed transactions by checking transfer instruction parameters,
   ensuring the facilitator's funds are not being stolen, and simulating
2. Settles payments by co-signing (as fee payer) and broadcasting the transaction
3. Waits for transaction confirmation
"""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional, Protocol, Union

from t402.types import (
    PaymentRequirementsV2,
    PaymentPayloadV2,
    VerifyResponse,
    SettleResponse,
    Network,
)
from t402.svm import (
    SCHEME_EXACT,
    SOLANA_MAINNET,
    normalize_network,
    is_svm_network,
    get_token_payer_from_transaction,
    parse_transfer_checked_instruction,
    validate_transaction,
)


logger = logging.getLogger(__name__)

# Default timeout for transaction confirmation (seconds)
DEFAULT_CONFIRMATION_TIMEOUT = 30


class FacilitatorSvmSigner(Protocol):
    """Protocol for Solana facilitator signing and RPC operations.

    Implementations must provide fee payer management, transaction signing,
    simulation, broadcasting, and confirmation capabilities.

    Example implementation:
        ```python
        class MySvmFacilitatorSigner:
            def __init__(self, keypairs, rpc_urls):
                self._keypairs = keypairs
                self._rpc_urls = rpc_urls

            def get_addresses(self) -> List[str]:
                return [str(kp.pubkey()) for kp in self._keypairs]

            async def sign_transaction(
                self, tx_base64: str, fee_payer: str, network: str
            ) -> str:
                # Co-sign as fee payer
                ...

            async def simulate_transaction(
                self, tx_base64: str, network: str
            ) -> bool:
                # Simulate via RPC
                ...

            async def send_transaction(
                self, tx_base64: str, network: str
            ) -> str:
                # Send via RPC, return signature
                ...

            async def confirm_transaction(
                self, signature: str, network: str
            ) -> bool:
                # Wait for confirmation
                ...
        ```
    """

    def get_addresses(self) -> List[str]:
        """Get all available fee payer addresses.

        Returns:
            List of base58-encoded public keys for fee payer accounts
        """
        ...

    async def sign_transaction(
        self,
        tx_base64: str,
        fee_payer: str,
        network: str,
    ) -> str:
        """Co-sign a transaction as fee payer.

        Args:
            tx_base64: Base64 encoded partially-signed transaction
            fee_payer: Fee payer address to use for signing
            network: Network identifier

        Returns:
            Base64 encoded fully-signed transaction
        """
        ...

    async def simulate_transaction(
        self,
        tx_base64: str,
        network: str,
    ) -> bool:
        """Simulate a transaction to verify it will succeed.

        Args:
            tx_base64: Base64 encoded signed transaction
            network: Network identifier

        Returns:
            True if simulation succeeds

        Raises:
            Exception: If simulation fails with error details
        """
        ...

    async def send_transaction(
        self,
        tx_base64: str,
        network: str,
    ) -> str:
        """Send a signed transaction to the network.

        Args:
            tx_base64: Base64 encoded signed transaction
            network: Network identifier

        Returns:
            Transaction signature (base58-encoded)
        """
        ...

    async def confirm_transaction(
        self,
        signature: str,
        network: str,
    ) -> bool:
        """Wait for transaction confirmation.

        Args:
            signature: Transaction signature to confirm
            network: Network identifier

        Returns:
            True if confirmed successfully
        """
        ...


class ExactSvmFacilitatorScheme:
    """Facilitator scheme for Solana exact payments using SPL Token TransferChecked.

    Verifies signed Solana transactions and settles payments by co-signing
    as fee payer and broadcasting to the network.

    The verification process checks:
    1. Payload structure validity (base64 transaction present)
    2. Scheme and network compatibility
    3. Fee payer is managed by this facilitator
    4. Transaction contains a valid TransferChecked instruction
    5. Facilitator's signers are not transferring their own funds (security)
    6. Token mint matches required asset
    7. Transfer amount >= required amount
    8. Transaction simulation succeeds

    Example:
        ```python
        facilitator = ExactSvmFacilitatorScheme(signer=my_svm_signer)

        # Verify a payment
        result = await facilitator.verify(payload, requirements)
        if result.is_valid:
            # Settle the payment
            settlement = await facilitator.settle(payload, requirements)
        ```
    """

    scheme = SCHEME_EXACT
    caip_family = "solana:*"

    def __init__(self, signer: FacilitatorSvmSigner):
        """Initialize the SVM facilitator scheme.

        Args:
            signer: SVM facilitator signer for transaction signing,
                simulation, and broadcasting.
        """
        self._signer = signer

    def get_extra(self, network: Network) -> Optional[Dict[str, Any]]:
        """Get mechanism-specific extra data for supported kinds.

        Returns a fee payer address that clients should use when building
        their transactions.

        Args:
            network: The network identifier

        Returns:
            Dict with feePayer address, or None if no addresses available
        """
        import random

        addresses = self._signer.get_addresses()
        if not addresses:
            return None

        return {
            "feePayer": random.choice(addresses),
        }

    def get_signers(self, network: Network) -> List[str]:
        """Get signer addresses for this facilitator.

        Args:
            network: The network identifier

        Returns:
            List of fee payer addresses
        """
        return self._signer.get_addresses()

    async def verify(
        self,
        payload: Union[PaymentPayloadV2, Dict[str, Any]],
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> VerifyResponse:
        """Verify a Solana SPL Token transfer payment payload.

        Performs comprehensive validation including transaction structure,
        transfer parameters, security checks, and simulation.

        Args:
            payload: The payment payload containing signed transaction
            requirements: The payment requirements to verify against

        Returns:
            VerifyResponse indicating validity and payer address
        """
        try:
            # Extract data from payload and requirements
            payload_data = self._extract_payload(payload)
            req_data = self._extract_requirements(requirements)

            network = req_data.get("network", "")
            scheme = req_data.get("scheme", "")

            # Step 1: Validate scheme
            if scheme and scheme != SCHEME_EXACT:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="unsupported_scheme",
                    payer=None,
                )

            # Step 2: Validate network
            if not is_svm_network(network):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="unsupported_network",
                    payer=None,
                )

            # Step 3: Parse SVM payload
            tx_base64 = payload_data.get("transaction")
            if not tx_base64:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_payload_structure",
                    payer=None,
                )

            # Step 4: Validate transaction format
            if not validate_transaction(tx_base64):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_transaction_format",
                    payer=None,
                )

            # Step 5: Validate fee payer is present in requirements
            extra = req_data.get("extra", {})
            fee_payer = extra.get("feePayer") if extra else None
            if not fee_payer:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="missing_fee_payer",
                    payer=None,
                )

            # Step 6: Verify fee payer is managed by this facilitator
            signer_addresses = self._signer.get_addresses()
            if fee_payer not in signer_addresses:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="fee_payer_not_managed",
                    payer=None,
                )

            # Step 7: Get token transfer authority (payer) from transaction
            payer = get_token_payer_from_transaction(tx_base64)
            if not payer:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="no_transfer_instruction",
                    payer=None,
                )

            # Step 8: Parse and validate transfer instruction
            transfer = parse_transfer_checked_instruction(tx_base64)
            if not transfer:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="no_transfer_instruction",
                    payer=payer,
                )

            # Step 9: Security check - facilitator's signers must not be
            # transferring their own funds
            if transfer["authority"] in signer_addresses:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="facilitator_funds_transfer_blocked",
                    payer=payer,
                )

            # Step 10: Verify token mint matches requirements
            required_asset = req_data.get("asset", "")
            if required_asset and transfer["mint"] != required_asset:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="asset_mismatch",
                    payer=payer,
                )

            # Step 11: Verify amount meets requirements
            required_amount_str = req_data.get("amount", "0")
            try:
                required_amount = int(required_amount_str)
            except (ValueError, TypeError):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_required_amount",
                    payer=payer,
                )

            if transfer["amount"] < required_amount:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="insufficient_amount",
                    payer=payer,
                )

            # Step 12: Sign and simulate transaction
            try:
                signed_tx = await self._signer.sign_transaction(
                    tx_base64,
                    fee_payer,
                    normalize_network(network),
                )
                await self._signer.simulate_transaction(
                    signed_tx,
                    normalize_network(network),
                )
            except Exception as e:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"simulation_failed: {str(e)}",
                    payer=payer,
                )

            # All checks passed
            return VerifyResponse(
                is_valid=True,
                invalid_reason=None,
                payer=payer,
            )

        except Exception as e:
            logger.error(f"SVM verification failed: {e}")
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
        """Settle a Solana SPL Token transfer payment on-chain.

        Verifies the payment first, then co-signs as fee payer, broadcasts
        the transaction, and waits for confirmation.

        Args:
            payload: The verified payment payload with signed transaction
            requirements: The payment requirements

        Returns:
            SettleResponse with transaction signature and status
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

        try:
            # Step 2: Extract transaction
            payload_data = self._extract_payload(payload)
            tx_base64 = payload_data.get("transaction")

            if not tx_base64:
                return SettleResponse(
                    success=False,
                    error_reason="invalid_payload_structure",
                    transaction=None,
                    network=network,
                    payer=verify_result.payer,
                )

            # Step 3: Sign transaction as fee payer
            extra = req_data.get("extra", {})
            fee_payer = extra.get("feePayer") if extra else None
            normalized_network = normalize_network(network)

            signed_tx = await self._signer.sign_transaction(
                tx_base64,
                fee_payer,
                normalized_network,
            )

            # Step 4: Send transaction
            signature = await self._signer.send_transaction(
                signed_tx,
                normalized_network,
            )

            # Step 5: Wait for confirmation
            confirmed = await self._signer.confirm_transaction(
                signature,
                normalized_network,
            )

            if not confirmed:
                return SettleResponse(
                    success=False,
                    error_reason="confirmation_timeout",
                    transaction=signature,
                    network=network,
                    payer=verify_result.payer,
                )

            return SettleResponse(
                success=True,
                error_reason=None,
                transaction=signature,
                network=network,
                payer=verify_result.payer,
            )

        except Exception as e:
            logger.error(f"SVM settlement failed: {e}")
            return SettleResponse(
                success=False,
                error_reason=f"settlement_error: {str(e)}",
                transaction=None,
                network=network,
                payer=verify_result.payer,
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
            Dict containing transaction and authorization data
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
