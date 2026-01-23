"""TRON Exact Scheme - Facilitator Implementation.

This module provides the facilitator-side implementation of the exact payment
scheme for TRON network using TRC-20 token transfers.

The facilitator:
1. Verifies signed TRC-20 transactions against payment requirements
2. Validates sender/recipient addresses, amount, and expiration
3. Checks on-chain balance and account activation status
4. Settles payments by broadcasting the signed transaction to the TRON network
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
from t402.tron import (
    SCHEME_EXACT,
    MIN_VALIDITY_BUFFER,
    TronPaymentPayload,
    TronVerifyResult,
    TronTransactionConfirmation,
    validate_tron_address,
    addresses_equal,
    is_valid_network,
    get_network_config,
)


logger = logging.getLogger(__name__)

# Default timeout for transaction confirmation (milliseconds)
DEFAULT_CONFIRMATION_TIMEOUT = 60000


class FacilitatorTronSigner(Protocol):
    """Protocol for TRON facilitator signing and verification operations.

    Implementations must provide address retrieval, transaction verification,
    broadcasting, and balance-checking capabilities.

    Example implementation:
        ```python
        class MyTronFacilitatorSigner:
            def __init__(self, client, private_key):
                self._client = client
                self._private_key = private_key
                self._address = derive_address(private_key)

            def get_addresses(self, network: str) -> List[str]:
                return [self._address]

            async def verify_transaction(
                self,
                signed_transaction: str,
                expected_from: str,
                expected_to: str,
                expected_contract: str,
                expected_amount: str,
                network: str,
            ) -> TronVerifyResult:
                # Decode and verify the signed transaction
                ...

            async def broadcast_transaction(
                self, signed_transaction: str, network: str
            ) -> str:
                # Submit to TRON network, return tx ID
                ...

            async def wait_for_transaction(
                self, tx_id: str, network: str, timeout: int
            ) -> TronTransactionConfirmation:
                # Poll for confirmation
                ...

            async def get_balance(
                self, owner_address: str, contract_address: str, network: str
            ) -> str:
                # Query TRC-20 balance
                ...

            async def is_activated(self, address: str, network: str) -> bool:
                # Check if account is activated on TRON
                ...
        ```
    """

    def get_addresses(self, network: str) -> List[str]:
        """Get facilitator addresses for the given network.

        Args:
            network: Network identifier (e.g., "tron:mainnet")

        Returns:
            List of T-prefix base58check addresses
        """
        ...

    async def verify_transaction(
        self,
        signed_transaction: str,
        expected_from: str,
        expected_to: str,
        expected_contract: str,
        expected_amount: str,
        network: str,
    ) -> TronVerifyResult:
        """Verify a signed TRC-20 transfer transaction.

        Decodes the signed transaction and validates that:
        - The signature is valid (ECDSA secp256k1 recovery)
        - The recovered signer matches expected_from
        - The transfer recipient matches expected_to
        - The contract address matches expected_contract
        - The transfer amount matches expected_amount

        Args:
            signed_transaction: Hex-encoded signed transaction
            expected_from: Expected sender address
            expected_to: Expected recipient address
            expected_contract: Expected TRC-20 contract address
            expected_amount: Expected transfer amount in atomic units
            network: Network identifier

        Returns:
            TronVerifyResult with validity status and optional reason
        """
        ...

    async def broadcast_transaction(
        self, signed_transaction: str, network: str
    ) -> str:
        """Broadcast a signed transaction to the TRON network.

        Args:
            signed_transaction: Hex-encoded signed transaction
            network: Network identifier

        Returns:
            Transaction ID (hex string)

        Raises:
            Exception: If broadcast fails
        """
        ...

    async def wait_for_transaction(
        self, tx_id: str, network: str, timeout: int
    ) -> TronTransactionConfirmation:
        """Wait for a transaction to be confirmed on-chain.

        Args:
            tx_id: Transaction ID to wait for
            network: Network identifier
            timeout: Maximum wait time in milliseconds

        Returns:
            TronTransactionConfirmation with success status
        """
        ...

    async def get_balance(
        self, owner_address: str, contract_address: str, network: str
    ) -> str:
        """Get TRC-20 token balance for an address.

        Args:
            owner_address: Account address to check
            contract_address: TRC-20 contract address
            network: Network identifier

        Returns:
            Balance in atomic units as string
        """
        ...

    async def is_activated(self, address: str, network: str) -> bool:
        """Check if a TRON account is activated (has on-chain state).

        New TRON accounts require activation before they can receive
        TRC-20 tokens. This method verifies the account exists on-chain.

        Args:
            address: TRON address to check
            network: Network identifier

        Returns:
            True if account is activated, False otherwise
        """
        ...


class ExactTronFacilitatorScheme:
    """Facilitator scheme for TRON exact payments using TRC-20 transfers.

    Verifies signed TRC-20 transfer transactions and settles payments
    by broadcasting them to the TRON network.

    The verification process:
    1. Validates scheme and network compatibility
    2. Parses the payment payload (signed transaction + authorization)
    3. Validates TRON addresses (from, to, contract)
    4. Verifies the transaction signature via the signer
    5. Checks authorization expiration (with buffer)
    6. Verifies TRC-20 balance sufficiency
    7. Validates amount >= required amount
    8. Confirms recipient and asset matching
    9. Verifies account activation status

    Example:
        ```python
        facilitator = ExactTronFacilitatorScheme(
            signer=my_tron_signer,
            config=ExactTronFacilitatorConfig(can_sponsor_gas=True),
        )

        # Verify a payment
        result = await facilitator.verify(payload, requirements)
        if result.is_valid:
            # Settle the payment
            settlement = await facilitator.settle(payload, requirements)
        ```
    """

    scheme = SCHEME_EXACT
    caip_family = "tron:*"

    def __init__(
        self,
        signer: FacilitatorTronSigner,
        config: Optional[ExactTronFacilitatorConfig] = None,
    ):
        """Initialize the TRON facilitator scheme.

        Args:
            signer: TRON signer for transaction verification and broadcasting
            config: Optional configuration for the facilitator
        """
        self._signer = signer
        self._config = config

    def get_extra(self, network: Network) -> Optional[Dict[str, Any]]:
        """Get mechanism-specific extra data for supported kinds.

        Returns the default asset info and gas sponsor address (if configured)
        for the /supported endpoint.

        Args:
            network: The network identifier

        Returns:
            Dict with defaultAsset, symbol, decimals, and optionally gasSponsor
        """
        network_config = get_network_config(str(network))
        if not network_config:
            return None

        default_asset = network_config["default_asset"]
        result: Dict[str, Any] = {
            "defaultAsset": default_asset["contract_address"],
            "symbol": default_asset["symbol"],
            "decimals": default_asset["decimals"],
        }

        if self._config and self._config.can_sponsor_gas:
            addresses = self._signer.get_addresses(str(network))
            if addresses:
                result["gasSponsor"] = addresses[0]

        return result

    def get_signers(self, network: Network) -> List[str]:
        """Get signer addresses for this facilitator.

        Args:
            network: The network identifier

        Returns:
            List of facilitator TRON addresses
        """
        return self._signer.get_addresses(str(network))

    async def verify(
        self,
        payload: Union[PaymentPayloadV2, Dict[str, Any]],
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> VerifyResponse:
        """Verify a TRON exact payment payload against requirements.

        Performs comprehensive validation including:
        - Scheme and network validation
        - Payload structure parsing
        - Address validation (from, to, contract)
        - ECDSA signature verification via signer
        - Expiration check with MIN_VALIDITY_BUFFER
        - Balance sufficiency check
        - Amount sufficiency check
        - Recipient and asset matching
        - Account activation check

        Args:
            payload: The payment payload containing signed transaction
            requirements: The payment requirements to verify against

        Returns:
            VerifyResponse indicating validity, reason if invalid, and payer
        """
        try:
            # Extract data from payload and requirements
            payload_data = self._extract_payload(payload)
            req_data = self._extract_requirements(requirements)

            network = req_data.get("network", "")
            payer = ""

            # Step 1: Validate scheme
            req_scheme = req_data.get("scheme", "")
            if req_scheme and req_scheme != SCHEME_EXACT:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="unsupported_scheme",
                    payer=None,
                )

            # Step 2: Validate network is supported
            if not is_valid_network(network):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="unsupported_network",
                    payer=None,
                )

            # Step 3: Parse the TRON payment payload
            tron_payload = self._parse_tron_payload(payload_data)
            if tron_payload is None:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_payload",
                    payer=None,
                )

            authorization = tron_payload.authorization
            payer = authorization.from_

            # Step 4: Validate addresses
            if not validate_tron_address(authorization.from_):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_sender_address",
                    payer=payer,
                )

            if not validate_tron_address(authorization.to):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_recipient_address",
                    payer=payer,
                )

            if not validate_tron_address(authorization.contract_address):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_contract_address",
                    payer=payer,
                )

            # Step 5: Verify transaction signature via signer
            verify_result = await self._signer.verify_transaction(
                signed_transaction=tron_payload.signed_transaction,
                expected_from=authorization.from_,
                expected_to=req_data.get("payTo", ""),
                expected_contract=req_data.get("asset", ""),
                expected_amount=authorization.amount,
                network=network,
            )

            if not verify_result.valid:
                reason = verify_result.reason or "unknown"
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"transaction_verification_failed: {reason}",
                    payer=payer,
                )

            # Step 6: Check authorization expiry (with buffer)
            now_ms = int(time.time() * 1000)
            expiration_with_buffer = authorization.expiration - (
                MIN_VALIDITY_BUFFER * 1000
            )
            if now_ms >= expiration_with_buffer:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="authorization_expired",
                    payer=payer,
                )

            # Step 7: Verify TRC-20 balance
            balance_str = await self._signer.get_balance(
                owner_address=authorization.from_,
                contract_address=req_data.get("asset", ""),
                network=network,
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

            try:
                balance = int(balance_str)
            except (ValueError, TypeError):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_balance_format",
                    payer=payer,
                )

            if balance < required_amount:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="insufficient_balance",
                    payer=payer,
                )

            # Step 8: Verify amount sufficiency
            try:
                payload_amount = int(authorization.amount)
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

            # Step 9: Verify recipient matching
            pay_to = req_data.get("payTo", "")
            if not addresses_equal(authorization.to, pay_to):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="recipient_mismatch",
                    payer=payer,
                )

            # Step 10: Verify contract address matching
            asset = req_data.get("asset", "")
            if not addresses_equal(authorization.contract_address, asset):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="asset_mismatch",
                    payer=payer,
                )

            # Step 11: Verify account is activated
            is_active = await self._signer.is_activated(
                authorization.from_, network
            )
            if not is_active:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="account_not_activated",
                    payer=payer,
                )

            # All checks passed
            return VerifyResponse(
                is_valid=True,
                invalid_reason=None,
                payer=payer,
            )

        except Exception as e:
            logger.error(f"TRON verification failed: {e}")
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
        """Settle a TRON exact payment by broadcasting the signed transaction.

        Performs verification first, then broadcasts the signed transaction
        to the TRON network and waits for confirmation.

        Args:
            payload: The verified payment payload with signed transaction
            requirements: The payment requirements

        Returns:
            SettleResponse with transaction ID, network, and status
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
            # Step 2: Parse payload for broadcast
            payload_data = self._extract_payload(payload)
            tron_payload = self._parse_tron_payload(payload_data)

            if tron_payload is None:
                return SettleResponse(
                    success=False,
                    error_reason="invalid_payload",
                    transaction=None,
                    network=network,
                    payer=verify_result.payer,
                )

            # Step 3: Broadcast the signed transaction
            tx_id = await self._signer.broadcast_transaction(
                signed_transaction=tron_payload.signed_transaction,
                network=network,
            )

            # Step 4: Wait for confirmation
            confirmation = await self._signer.wait_for_transaction(
                tx_id=tx_id,
                network=network,
                timeout=DEFAULT_CONFIRMATION_TIMEOUT,
            )

            if not confirmation.success:
                return SettleResponse(
                    success=False,
                    error_reason=confirmation.error or "confirmation_failed",
                    transaction=tx_id,
                    network=network,
                    payer=verify_result.payer,
                )

            # Use the confirmed tx_id if available (may differ from broadcast)
            final_tx_id = confirmation.tx_id or tx_id

            return SettleResponse(
                success=True,
                error_reason=None,
                transaction=final_tx_id,
                network=network,
                payer=verify_result.payer,
            )

        except Exception as e:
            logger.error(f"TRON settlement failed: {e}")
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

        Handles PaymentPayloadV2 models (with nested 'payload' field)
        and plain dicts.

        Args:
            payload: Payment payload (model or dict)

        Returns:
            Dict containing signedTransaction and authorization data
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

    def _parse_tron_payload(
        self, payload_data: Dict[str, Any]
    ) -> Optional[TronPaymentPayload]:
        """Parse raw payload data into a TronPaymentPayload model.

        Args:
            payload_data: Dict with signedTransaction and authorization fields

        Returns:
            TronPaymentPayload if parsing succeeds, None otherwise
        """
        try:
            # Validate required fields exist
            if "signedTransaction" not in payload_data:
                logger.debug("Missing signedTransaction in payload")
                return None

            if "authorization" not in payload_data:
                logger.debug("Missing authorization in payload")
                return None

            auth_data = payload_data["authorization"]
            if not auth_data.get("from"):
                logger.debug("Missing authorization.from in payload")
                return None

            return TronPaymentPayload.model_validate(payload_data)
        except Exception as e:
            logger.debug(f"Failed to parse TRON payload: {e}")
            return None


class ExactTronFacilitatorConfig:
    """Configuration for the TRON exact facilitator scheme.

    Attributes:
        can_sponsor_gas: Whether this facilitator can sponsor gas costs
            for transactions. When True, the facilitator's address will
            be advertised as a gas sponsor in the /supported response.
    """

    def __init__(self, can_sponsor_gas: bool = False):
        """Initialize facilitator configuration.

        Args:
            can_sponsor_gas: Whether to advertise gas sponsorship capability
        """
        self.can_sponsor_gas = can_sponsor_gas
