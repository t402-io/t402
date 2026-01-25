"""TON Exact Scheme - Facilitator Implementation.

This module provides the facilitator-side implementation of the exact payment
scheme for TON network using Jetton transfers.

The facilitator:
1. Verifies signed BOC messages by checking authorization metadata, balances,
   seqno, and message structure
2. Settles payments by broadcasting the signed BOC to the TON network
3. Waits for transaction confirmation via seqno monitoring
"""

from __future__ import annotations

import time
import logging
from typing import Any, Dict, List, Optional, Protocol, Union, runtime_checkable

from t402.types import (
    PaymentRequirementsV2,
    PaymentPayloadV2,
    VerifyResponse,
    SettleResponse,
    Network,
)
from t402.ton import (
    SCHEME_EXACT,
    MIN_VALIDITY_BUFFER,
    validate_boc,
    addresses_equal,
    is_valid_network,
    get_network_config,
    TonVerifyMessageResult,
    TonTransactionConfirmation,
)


logger = logging.getLogger(__name__)


@runtime_checkable
class FacilitatorTonSigner(Protocol):
    """Protocol for TON facilitator signer operations.

    Implementations should provide address retrieval, message verification,
    balance checking, BOC broadcasting, and transaction confirmation capabilities.

    Example implementation:
        ```python
        class MyTonFacilitatorSigner:
            def __init__(self, client, addresses):
                self._client = client
                self._addresses = addresses

            def get_addresses(self, network: str) -> List[str]:
                return self._addresses.get(network, [])

            async def get_jetton_balance(
                self,
                owner_address: str,
                jetton_master_address: str,
                network: str,
            ) -> str:
                return await self._client.get_jetton_balance(
                    owner_address, jetton_master_address
                )

            async def verify_message(
                self,
                signed_boc: str,
                expected_from: str,
                expected_transfer: dict,
                network: str,
            ) -> TonVerifyMessageResult:
                # Verify BOC structure and transfer parameters
                ...

            async def send_external_message(
                self, signed_boc: str, network: str
            ) -> str:
                return await self._client.send_boc(signed_boc)

            async def wait_for_transaction(
                self,
                address: str,
                seqno: int,
                timeout_ms: int,
                network: str,
            ) -> TonTransactionConfirmation:
                # Poll for seqno increase
                ...

            async def get_seqno(self, address: str, network: str) -> int:
                return await self._client.get_seqno(address)

            async def is_deployed(self, address: str, network: str) -> bool:
                return await self._client.is_deployed(address)
        ```
    """

    def get_addresses(self, network: str) -> List[str]:
        """Return all facilitator addresses for the given network."""
        ...

    async def get_jetton_balance(
        self,
        owner_address: str,
        jetton_master_address: str,
        network: str,
    ) -> str:
        """Get the Jetton balance for an owner.

        Args:
            owner_address: Owner's TON address
            jetton_master_address: Jetton master contract address
            network: Network identifier

        Returns:
            Balance in smallest units as string
        """
        ...

    async def verify_message(
        self,
        signed_boc: str,
        expected_from: str,
        expected_transfer: Dict[str, str],
        network: str,
    ) -> TonVerifyMessageResult:
        """Verify a signed BOC message structure.

        Checks that the BOC contains a valid Jetton transfer message
        with the expected parameters.

        Args:
            signed_boc: Base64-encoded signed BOC
            expected_from: Expected sender address
            expected_transfer: Dict with jetton_amount, destination, jetton_master
            network: Network identifier

        Returns:
            TonVerifyMessageResult indicating validity
        """
        ...

    async def send_external_message(
        self,
        signed_boc: str,
        network: str,
    ) -> str:
        """Broadcast a signed external message to the TON network.

        Args:
            signed_boc: Base64-encoded signed BOC
            network: Network identifier

        Returns:
            Transaction hash or message hash
        """
        ...

    async def wait_for_transaction(
        self,
        address: str,
        seqno: int,
        timeout_ms: int,
        network: str,
    ) -> TonTransactionConfirmation:
        """Wait for a transaction to be confirmed by monitoring seqno.

        Args:
            address: Wallet address to monitor
            seqno: Expected new seqno (current + 1)
            timeout_ms: Maximum wait time in milliseconds
            network: Network identifier

        Returns:
            TonTransactionConfirmation with success status and hash
        """
        ...

    async def get_seqno(self, address: str, network: str) -> int:
        """Get the current wallet sequence number.

        Args:
            address: Wallet address
            network: Network identifier

        Returns:
            Current seqno as integer
        """
        ...

    async def is_deployed(self, address: str, network: str) -> bool:
        """Check if a wallet contract is deployed on-chain.

        Args:
            address: Wallet address
            network: Network identifier

        Returns:
            True if the wallet is deployed
        """
        ...


class ExactTonFacilitatorScheme:
    """Facilitator scheme for TON exact payments using Jetton transfers.

    Verifies signed BOC messages containing Jetton transfer operations and
    settles payments by broadcasting them to the TON network.

    The verification process checks:
    1. Scheme and network validity
    2. BOC format (valid base64)
    3. Message structure via signer verification
    4. Authorization expiry (with 30-second buffer)
    5. Jetton balance sufficiency
    6. Amount >= required amount
    7. Recipient matches payTo
    8. Jetton master matches required asset
    9. Seqno for replay protection
    10. Wallet deployment status

    Example:
        ```python
        facilitator = ExactTonFacilitatorScheme(signer=my_ton_signer)

        # Verify a payment
        result = await facilitator.verify(payload, requirements)
        if result.is_valid:
            # Settle the payment
            settlement = await facilitator.settle(payload, requirements)
        ```
    """

    scheme = SCHEME_EXACT
    caip_family = "ton:*"

    def __init__(self, signer: FacilitatorTonSigner):
        """Initialize the TON facilitator scheme.

        Args:
            signer: TON facilitator signer for message verification,
                balance checking, and transaction broadcasting.
        """
        self._signer = signer

    def get_extra(self, network: Network) -> Optional[Dict[str, Any]]:
        """Get mechanism-specific extra data for supported kinds.

        Returns asset metadata (default asset address, symbol, decimals)
        for the specified TON network.

        Args:
            network: The network identifier (e.g., "ton:mainnet")

        Returns:
            Dict with asset metadata if network is supported, else None
        """
        config = get_network_config(network)
        if not config:
            return None

        default_asset = config["default_asset"]
        return {
            "defaultAsset": default_asset["master_address"],
            "symbol": default_asset["symbol"],
            "decimals": default_asset["decimals"],
        }

    def get_signers(self, network: Network) -> List[str]:
        """Get signer addresses for this facilitator on the given network.

        Args:
            network: The network identifier

        Returns:
            List of facilitator wallet addresses
        """
        return self._signer.get_addresses(network)

    async def verify(
        self,
        payload: Union[PaymentPayloadV2, Dict[str, Any]],
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> VerifyResponse:
        """Verify a TON Jetton transfer payment payload.

        Performs comprehensive validation of the signed BOC message including
        authorization metadata, balance checks, and replay protection.

        Args:
            payload: The payment payload containing signed BOC and authorization
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

            # Step 3: Parse TON payload
            ton_payload = self._parse_ton_payload(payload_data)
            if ton_payload is None:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_payload",
                    payer=None,
                )

            authorization = ton_payload["authorization"]
            signed_boc = ton_payload["signed_boc"]
            payer = authorization["from"]

            # Step 4: Validate BOC format
            if not validate_boc(signed_boc):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="invalid_boc_format",
                    payer=payer,
                )

            # Step 5: Verify message structure via signer
            pay_to = req_data.get("payTo", "")
            asset = req_data.get("asset", "")

            expected_transfer = {
                "jetton_amount": authorization["jetton_amount"],
                "destination": pay_to,
                "jetton_master": asset,
            }

            verify_result = await self._signer.verify_message(
                signed_boc=signed_boc,
                expected_from=payer,
                expected_transfer=expected_transfer,
                network=network,
            )

            if not verify_result.valid:
                reason = verify_result.reason or "unknown"
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"message_verification_failed: {reason}",
                    payer=payer,
                )

            # Step 6: Check authorization expiry (with buffer)
            now = int(time.time())
            valid_until = authorization["valid_until"]
            if valid_until < now + MIN_VALIDITY_BUFFER:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="authorization_expired",
                    payer=payer,
                )

            # Step 7: Verify Jetton balance
            try:
                balance_str = await self._signer.get_jetton_balance(
                    owner_address=payer,
                    jetton_master_address=asset,
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
                    invalid_reason="insufficient_jetton_balance",
                    payer=payer,
                )

            # Step 8: Verify amount sufficiency
            try:
                payload_amount = int(authorization["jetton_amount"])
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
            auth_to = authorization.get("to", "")
            if not addresses_equal(auth_to, pay_to):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="recipient_mismatch",
                    payer=payer,
                )

            # Step 10: Verify Jetton master matching
            auth_jetton_master = authorization.get("jetton_master", "")
            if not addresses_equal(auth_jetton_master, asset):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="asset_mismatch",
                    payer=payer,
                )

            # Step 11: Verify seqno (replay protection)
            try:
                current_seqno = await self._signer.get_seqno(payer, network)
            except Exception as e:
                logger.error(f"Seqno check failed: {e}")
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="seqno_check_failed",
                    payer=payer,
                )

            auth_seqno = authorization.get("seqno", -1)
            if auth_seqno < current_seqno:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="seqno_already_used",
                    payer=payer,
                )

            if auth_seqno > current_seqno:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="seqno_too_high",
                    payer=payer,
                )

            # Step 12: Verify wallet is deployed
            try:
                deployed = await self._signer.is_deployed(payer, network)
            except Exception as e:
                logger.error(f"Deployment check failed: {e}")
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="deployment_check_failed",
                    payer=payer,
                )

            if not deployed:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="wallet_not_deployed",
                    payer=payer,
                )

            # All checks passed
            return VerifyResponse(
                is_valid=True,
                invalid_reason=None,
                payer=payer,
            )

        except Exception as e:
            logger.error(f"TON verification failed: {e}")
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
        """Settle a TON Jetton transfer payment on-chain.

        Verifies the payment first, then broadcasts the signed BOC to the TON
        network and waits for transaction confirmation via seqno monitoring.

        Args:
            payload: The verified payment payload with signed BOC
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

        # Step 2: Extract payload data for broadcasting
        try:
            payload_data = self._extract_payload(payload)
            ton_payload = self._parse_ton_payload(payload_data)

            if ton_payload is None:
                return SettleResponse(
                    success=False,
                    error_reason="invalid_payload",
                    transaction=None,
                    network=network,
                    payer=verify_result.payer,
                )

            authorization = ton_payload["authorization"]
            signed_boc = ton_payload["signed_boc"]
            payer = authorization["from"]
            auth_seqno = authorization.get("seqno", 0)

        except Exception as e:
            logger.error(f"Payload extraction failed: {e}")
            return SettleResponse(
                success=False,
                error_reason=f"invalid_payload: {str(e)}",
                transaction=None,
                network=network,
                payer=verify_result.payer,
            )

        # Step 3: Broadcast the signed BOC
        try:
            tx_hash = await self._signer.send_external_message(
                signed_boc=signed_boc,
                network=network,
            )
        except Exception as e:
            logger.error(f"Transaction broadcast failed: {e}")
            return SettleResponse(
                success=False,
                error_reason=f"transaction_failed: {str(e)}",
                transaction=None,
                network=network,
                payer=payer,
            )

        # Step 4: Wait for transaction confirmation
        try:
            confirmation = await self._signer.wait_for_transaction(
                address=payer,
                seqno=auth_seqno + 1,  # Wait for next seqno
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

        # Use the confirmed transaction hash if available
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
        """Extract payload data as a dict.

        Handles both PaymentPayloadV2 models (where the inner payload is
        in the 'payload' field) and plain dicts.

        Args:
            payload: Payment payload (model or dict)

        Returns:
            Dict containing signed BOC and authorization data
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

    def _parse_ton_payload(
        self, payload_data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Parse and validate TON-specific payload fields.

        Extracts signedBoc and authorization from the payload data,
        normalizing field names for internal use.

        Args:
            payload_data: Raw payload dict

        Returns:
            Normalized dict with signed_boc and authorization fields,
            or None if required fields are missing.
        """
        signed_boc = payload_data.get("signedBoc") or payload_data.get("signed_boc")
        if not signed_boc:
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
        jetton_master = (
            auth_data.get("jettonMaster")
            or auth_data.get("jetton_master")
            or ""
        )
        jetton_amount = (
            auth_data.get("jettonAmount")
            or auth_data.get("jetton_amount")
            or "0"
        )
        ton_amount = (
            auth_data.get("tonAmount")
            or auth_data.get("ton_amount")
            or "0"
        )
        valid_until = (
            auth_data.get("validUntil")
            or auth_data.get("valid_until")
            or 0
        )
        seqno = auth_data.get("seqno", 0)
        query_id = (
            auth_data.get("queryId")
            or auth_data.get("query_id")
            or ""
        )

        if not from_addr:
            return None

        return {
            "signed_boc": signed_boc,
            "authorization": {
                "from": from_addr,
                "to": to_addr,
                "jetton_master": jetton_master,
                "jetton_amount": str(jetton_amount),
                "ton_amount": str(ton_amount),
                "valid_until": int(valid_until),
                "seqno": int(seqno),
                "query_id": str(query_id),
            },
        }
