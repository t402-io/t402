"""EVM Up-To Scheme - Facilitator Implementation.

This module provides the facilitator-side implementation of the upto payment
scheme for EVM networks using EIP-2612 Permit.

The facilitator:
1. Verifies EIP-2612 Permit signatures by recovering the signer via EIP-712
2. Validates permit parameters (value, spender, deadline)
3. Settles payments by calling permit() then transferFrom() on the token contract
"""

from __future__ import annotations

import time
import logging
from typing import Any, Dict, List, Optional, Union

from eth_account.messages import encode_typed_data
from eth_account import Account

from t402.types import (
    PaymentRequirementsV2,
    PaymentPayloadV2,
    VerifyResponse,
    SettleResponse,
    Network,
)
from t402.schemes.evm.upto.types import (
    PERMIT_TYPES,
    is_eip2612_payload,
    create_permit_domain,
)


logger = logging.getLogger(__name__)

# Constants
SCHEME_UPTO = "upto"

# Minimal ERC-20 + EIP-2612 ABI for permit and transferFrom
ERC20_PERMIT_ABI = [
    {
        "inputs": [
            {"name": "owner", "type": "address"},
            {"name": "spender", "type": "address"},
            {"name": "value", "type": "uint256"},
            {"name": "deadline", "type": "uint256"},
            {"name": "v", "type": "uint8"},
            {"name": "r", "type": "bytes32"},
            {"name": "s", "type": "bytes32"},
        ],
        "name": "permit",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"name": "from", "type": "address"},
            {"name": "to", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "name": "transferFrom",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"name": "owner", "type": "address"}],
        "name": "nonces",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
]


class UptoEvmFacilitatorScheme:
    """Facilitator scheme for EVM upto payments using EIP-2612 Permit.

    Verifies EIP-2612 Permit signatures off-chain and settles payments
    on-chain by calling permit() followed by transferFrom() on the
    token contract.

    Example:
        ```python
        from web3 import Web3

        w3 = Web3(Web3.HTTPProvider("https://mainnet.base.org"))
        facilitator = UptoEvmFacilitatorScheme(
            web3=w3,
            private_key="0x...",
        )

        # Verify a permit signature
        result = await facilitator.verify(payload, requirements)
        if result.is_valid:
            # Settle the payment
            settlement = await facilitator.settle(payload, requirements)
        ```
    """

    scheme = SCHEME_UPTO
    caip_family = "eip155:*"

    def __init__(
        self,
        web3: Optional[Any] = None,
        private_key: Optional[str] = None,
        address: Optional[str] = None,
    ):
        """Initialize the facilitator.

        Args:
            web3: Web3 instance for on-chain interactions.
                Required for settle(), optional for verify().
            private_key: Private key for signing transactions.
                Required for settle().
            address: Facilitator address (derived from private_key if not provided).
                This is the address that acts as the spender in permits.
        """
        self._web3 = web3
        self._private_key = private_key

        if address:
            self._address = address
        elif private_key:
            acct = Account.from_key(private_key)
            self._address = acct.address
        else:
            self._address = None

    @property
    def address(self) -> Optional[str]:
        """Get the facilitator's address (spender in permits)."""
        return self._address

    def get_extra(self, network: Network) -> Optional[Dict[str, Any]]:
        """Get mechanism-specific extra data for supported kinds.

        Returns the router/spender address that clients should use
        in their Permit authorization.

        Args:
            network: The network identifier

        Returns:
            Dict with routerAddress if address is configured, else None
        """
        if self._address:
            return {"routerAddress": self._address}
        return None

    def get_signers(self, network: Network) -> List[str]:
        """Get signer addresses for this facilitator.

        Args:
            network: The network identifier

        Returns:
            List containing the facilitator address
        """
        if self._address:
            return [self._address]
        return []

    async def verify(
        self,
        payload: Union[PaymentPayloadV2, Dict[str, Any]],
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
    ) -> VerifyResponse:
        """Verify an EIP-2612 Permit payment payload.

        Validates:
        1. Payload has correct EIP-2612 structure
        2. Permit value >= required amount
        3. Spender matches facilitator address (if configured)
        4. Deadline is in the future
        5. Signature recovers to the claimed owner

        Args:
            payload: The payment payload containing permit signature
            requirements: The payment requirements to verify against

        Returns:
            VerifyResponse indicating validity and payer address
        """
        try:
            # Extract payload data
            payload_data = self._extract_payload(payload)
            req_data = self._extract_requirements(requirements)

            # Validate payload structure
            if not is_eip2612_payload(payload_data):
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="Invalid EIP-2612 payload structure",
                    payer=None,
                )

            signature = payload_data["signature"]
            authorization = payload_data["authorization"]

            owner = authorization["owner"]
            spender = authorization["spender"]
            value = int(authorization["value"])
            deadline = int(authorization["deadline"])
            nonce = authorization.get("nonce", 0)

            # Validate deadline is in the future
            now = int(time.time())
            if deadline <= now:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=f"Permit deadline has passed: {deadline} <= {now}",
                    payer=owner,
                )

            # Validate value >= required amount
            required_amount = int(
                req_data.get("amount")
                or req_data.get("maxAmount")
                or req_data.get("max_amount", "0")
            )
            if value < required_amount:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=(
                        f"Permit value {value} is less than required amount "
                        f"{required_amount}"
                    ),
                    payer=owner,
                )

            # Validate spender matches facilitator address
            if self._address and spender.lower() != self._address.lower():
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=(
                        f"Permit spender {spender} does not match facilitator "
                        f"address {self._address}"
                    ),
                    payer=owner,
                )

            # Recover signer from EIP-712 signature
            network = req_data.get("network", "")
            asset = req_data.get("asset", "")
            extra = req_data.get("extra", {})

            chain_id = self._get_chain_id(network)
            token_name = extra.get("name", "TetherToken")
            token_version = extra.get("version", "1")

            recovered = self._recover_permit_signer(
                owner=owner,
                spender=spender,
                value=value,
                nonce=nonce,
                deadline=deadline,
                signature=signature,
                chain_id=chain_id,
                token_address=asset,
                token_name=token_name,
                token_version=token_version,
            )

            if recovered is None:
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason="Failed to recover signer from permit signature",
                    payer=owner,
                )

            # Validate recovered address matches owner
            if recovered.lower() != owner.lower():
                return VerifyResponse(
                    is_valid=False,
                    invalid_reason=(
                        f"Recovered signer {recovered} does not match "
                        f"claimed owner {owner}"
                    ),
                    payer=owner,
                )

            return VerifyResponse(
                is_valid=True,
                invalid_reason=None,
                payer=owner,
            )

        except Exception as e:
            logger.error(f"Permit verification failed: {e}")
            return VerifyResponse(
                is_valid=False,
                invalid_reason=f"Verification error: {str(e)}",
                payer=None,
            )

    async def settle(
        self,
        payload: Union[PaymentPayloadV2, Dict[str, Any]],
        requirements: Union[PaymentRequirementsV2, Dict[str, Any]],
        settle_amount: Optional[str] = None,
    ) -> SettleResponse:
        """Settle an EIP-2612 Permit payment on-chain.

        Executes two transactions:
        1. token.permit(owner, spender, value, deadline, v, r, s)
        2. token.transferFrom(owner, payTo, settleAmount)

        The settle_amount can be less than or equal to the permitted value,
        enabling usage-based billing.

        Args:
            payload: The verified payment payload with permit signature
            requirements: The payment requirements
            settle_amount: Amount to actually settle (defaults to required amount).
                Must be <= permitted value.

        Returns:
            SettleResponse with transaction hash and status

        Raises:
            RuntimeError: If web3 or private_key is not configured
        """
        if not self._web3:
            return SettleResponse(
                success=False,
                error_reason="Web3 instance not configured",
                transaction=None,
                network=None,
                payer=None,
            )

        if not self._private_key:
            return SettleResponse(
                success=False,
                error_reason="Private key not configured for settlement",
                transaction=None,
                network=None,
                payer=None,
            )

        try:
            # Extract data
            payload_data = self._extract_payload(payload)
            req_data = self._extract_requirements(requirements)

            signature = payload_data["signature"]
            authorization = payload_data["authorization"]

            owner = authorization["owner"]
            spender = authorization["spender"]
            value = int(authorization["value"])
            deadline = int(authorization["deadline"])

            # Get signature components
            v = signature["v"]
            r = signature["r"]
            s = signature["s"]

            # Convert r, s to bytes32
            r_bytes = bytes.fromhex(r[2:] if r.startswith("0x") else r).rjust(32, b'\x00')
            s_bytes = bytes.fromhex(s[2:] if s.startswith("0x") else s).rjust(32, b'\x00')

            # Determine settle amount
            network = req_data.get("network", "")
            asset = req_data.get("asset", "")
            pay_to = req_data.get("payTo") or req_data.get("pay_to", "")

            if settle_amount is not None:
                actual_amount = int(settle_amount)
            else:
                actual_amount = int(
                    req_data.get("amount")
                    or req_data.get("maxAmount")
                    or req_data.get("max_amount", "0")
                )

            # Validate settle amount doesn't exceed permit value
            if actual_amount > value:
                return SettleResponse(
                    success=False,
                    error_reason=(
                        f"Settle amount {actual_amount} exceeds permitted "
                        f"value {value}"
                    ),
                    transaction=None,
                    network=network,
                    payer=owner,
                )

            # Get token contract
            token_contract = self._web3.eth.contract(
                address=self._web3.to_checksum_address(asset),
                abi=ERC20_PERMIT_ABI,
            )

            # Get account from private key
            account = Account.from_key(self._private_key)
            nonce = self._web3.eth.get_transaction_count(account.address)

            # Build and send permit transaction
            permit_tx = token_contract.functions.permit(
                self._web3.to_checksum_address(owner),
                self._web3.to_checksum_address(spender),
                value,
                deadline,
                v,
                r_bytes,
                s_bytes,
            ).build_transaction({
                "from": account.address,
                "nonce": nonce,
                "gas": 100000,
                "gasPrice": self._web3.eth.gas_price,
            })

            signed_permit = self._web3.eth.account.sign_transaction(
                permit_tx, self._private_key
            )
            permit_tx_hash = self._web3.eth.send_raw_transaction(
                signed_permit.raw_transaction
            )

            # Wait for permit confirmation
            self._web3.eth.wait_for_transaction_receipt(permit_tx_hash)

            # Build and send transferFrom transaction
            nonce += 1
            transfer_tx = token_contract.functions.transferFrom(
                self._web3.to_checksum_address(owner),
                self._web3.to_checksum_address(pay_to),
                actual_amount,
            ).build_transaction({
                "from": account.address,
                "nonce": nonce,
                "gas": 100000,
                "gasPrice": self._web3.eth.gas_price,
            })

            signed_transfer = self._web3.eth.account.sign_transaction(
                transfer_tx, self._private_key
            )
            transfer_tx_hash = self._web3.eth.send_raw_transaction(
                signed_transfer.raw_transaction
            )

            # Wait for transfer confirmation
            receipt = self._web3.eth.wait_for_transaction_receipt(transfer_tx_hash)

            tx_hash_hex = receipt.transactionHash.hex()
            if not tx_hash_hex.startswith("0x"):
                tx_hash_hex = f"0x{tx_hash_hex}"

            return SettleResponse(
                success=True,
                error_reason=None,
                transaction=tx_hash_hex,
                network=network,
                payer=owner,
            )

        except Exception as e:
            logger.error(f"Permit settlement failed: {e}")
            return SettleResponse(
                success=False,
                error_reason=f"Settlement error: {str(e)}",
                transaction=None,
                network=req_data.get("network") if 'req_data' in dir() else None,
                payer=None,
            )

    def _recover_permit_signer(
        self,
        owner: str,
        spender: str,
        value: int,
        nonce: int,
        deadline: int,
        signature: Dict[str, Any],
        chain_id: int,
        token_address: str,
        token_name: str,
        token_version: str,
    ) -> Optional[str]:
        """Recover the signer address from an EIP-2612 Permit signature.

        Uses EIP-712 typed data to reconstruct the signing payload and
        recover the signer's address from the v, r, s signature components.

        Args:
            owner: Token owner address
            spender: Approved spender address
            value: Permitted value
            nonce: Permit nonce
            deadline: Permit deadline
            signature: Dict with v, r, s components
            chain_id: EVM chain ID
            token_address: Token contract address
            token_name: Token name for EIP-712 domain
            token_version: Token version for EIP-712 domain

        Returns:
            Recovered address as string, or None if recovery fails
        """
        try:
            # Build EIP-712 domain
            domain = create_permit_domain(
                name=token_name,
                version=token_version,
                chain_id=chain_id,
                token_address=token_address,
            )

            # Build EIP-712 message
            message = {
                "owner": owner,
                "spender": spender,
                "value": value,
                "nonce": nonce,
                "deadline": deadline,
            }

            # Reconstruct the signature bytes
            v = signature["v"]
            r = signature["r"]
            s = signature["s"]

            # Normalize r and s to hex without 0x prefix
            r_hex = r[2:] if isinstance(r, str) and r.startswith("0x") else str(r)
            s_hex = s[2:] if isinstance(s, str) and s.startswith("0x") else str(s)

            # Pad to 64 hex chars (32 bytes)
            r_hex = r_hex.zfill(64)
            s_hex = s_hex.zfill(64)

            # Build combined signature: r (32 bytes) + s (32 bytes) + v (1 byte)
            v_hex = format(v, "02x")
            sig_hex = f"0x{r_hex}{s_hex}{v_hex}"

            # Encode EIP-712 typed data (full_types kept for reference)
            _full_types = {
                "EIP712Domain": [
                    {"name": "name", "type": "string"},
                    {"name": "version", "type": "string"},
                    {"name": "chainId", "type": "uint256"},
                    {"name": "verifyingContract", "type": "address"},
                ],
                "Permit": PERMIT_TYPES["Permit"],
            }

            signable = encode_typed_data(
                domain_data=domain,
                message_types={"Permit": PERMIT_TYPES["Permit"]},
                message_data=message,
            )

            # Recover signer
            recovered = Account.recover_message(
                signable,
                signature=bytes.fromhex(sig_hex[2:]),
            )

            return recovered

        except Exception as e:
            logger.debug(f"Permit signer recovery failed: {e}")
            return None

    def _extract_payload(self, payload: Union[PaymentPayloadV2, Dict[str, Any]]) -> Dict[str, Any]:
        """Extract payload data as a dict.

        Handles both PaymentPayloadV2 models (where the inner payload is
        in the 'payload' field) and plain dicts.

        Args:
            payload: Payment payload (model or dict)

        Returns:
            Dict containing signature and authorization data
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

    def _get_chain_id(self, network: str) -> int:
        """Get chain ID from network identifier.

        Args:
            network: Network identifier (CAIP-2 or legacy format)

        Returns:
            Chain ID as integer

        Raises:
            ValueError: If the network format is unrecognized
        """
        if network.startswith("eip155:"):
            return int(network.split(":")[1])

        from t402.chains import get_chain_id
        try:
            return int(get_chain_id(network))
        except (KeyError, ValueError):
            raise ValueError(f"Unknown network: {network}")
