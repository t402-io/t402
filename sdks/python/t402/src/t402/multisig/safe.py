"""
Safe client implementation for T402 Multi-sig support.
"""

from typing import List, Optional

from eth_account import Account
from web3 import AsyncWeb3, Web3
from web3.types import TxParams

from .constants import (
    GET_OWNERS_SELECTOR,
    GET_THRESHOLD_SELECTOR,
    NONCE_SELECTOR,
    GET_TRANSACTION_HASH_SELECTOR,
    EXEC_TRANSACTION_SELECTOR,
)
from .types import (
    SafeConfig,
    SafeInfo,
    SafeSignature,
    SafeTransaction,
    SignatureType,
    TransactionRequest,
    ExecutionResult,
)
from .utils import generate_request_id, current_timestamp, sort_addresses


class SafeClient:
    """Client for interacting with Safe multi-sig contracts."""

    def __init__(self, config: SafeConfig):
        """
        Initialize SafeClient.

        Args:
            config: Safe configuration with address and RPC URL.
        """
        self.address = Web3.to_checksum_address(config.address)
        self.rpc_url = config.rpc_url
        self._chain_id = config.chain_id
        self._w3: Optional[AsyncWeb3] = None
        self._cached_info: Optional[SafeInfo] = None

    async def _get_w3(self) -> AsyncWeb3:
        """Get or create async Web3 instance."""
        if self._w3 is None:
            self._w3 = AsyncWeb3(AsyncWeb3.AsyncHTTPProvider(self.rpc_url))
        return self._w3

    async def get_chain_id(self) -> int:
        """Get the chain ID."""
        if self._chain_id is None:
            w3 = await self._get_w3()
            self._chain_id = await w3.eth.chain_id
        return self._chain_id

    async def get_info(self) -> SafeInfo:
        """
        Get Safe information (owners, threshold, nonce).

        Returns:
            SafeInfo with current Safe state.
        """
        owners = await self.get_owners()
        threshold = await self.get_threshold()
        nonce = await self.get_nonce()
        chain_id = await self.get_chain_id()

        info = SafeInfo(
            address=self.address,
            owners=owners,
            threshold=threshold,
            nonce=nonce,
            chain_id=chain_id,
        )
        self._cached_info = info
        return info

    async def get_owners(self) -> List[str]:
        """Get list of Safe owners."""
        w3 = await self._get_w3()
        result = await w3.eth.call({"to": self.address, "data": GET_OWNERS_SELECTOR})

        # Decode address[] from ABI
        # Skip offset (32 bytes) and length (32 bytes)
        if len(result) < 64:
            return []

        length = int.from_bytes(result[32:64], "big")
        owners = []
        for i in range(length):
            start = 64 + i * 32
            addr_bytes = result[start + 12 : start + 32]
            owners.append(Web3.to_checksum_address(addr_bytes.hex()))

        return owners

    async def get_threshold(self) -> int:
        """Get the required number of signatures."""
        w3 = await self._get_w3()
        result = await w3.eth.call({"to": self.address, "data": GET_THRESHOLD_SELECTOR})
        return int.from_bytes(result, "big")

    async def get_nonce(self) -> int:
        """Get the current Safe nonce."""
        w3 = await self._get_w3()
        result = await w3.eth.call({"to": self.address, "data": NONCE_SELECTOR})
        return int.from_bytes(result, "big")

    async def is_owner(self, address: str) -> bool:
        """Check if an address is a Safe owner."""
        owners = await self.get_owners()
        address_lower = address.lower()
        return any(o.lower() == address_lower for o in owners)

    async def propose_transaction(
        self, tx: SafeTransaction
    ) -> TransactionRequest:
        """
        Create a new transaction proposal.

        Args:
            tx: The Safe transaction to propose.

        Returns:
            TransactionRequest for collecting signatures.
        """
        # Get nonce if not set
        if tx.nonce is None:
            tx.nonce = await self.get_nonce()

        # Calculate transaction hash
        tx_hash = await self.get_transaction_hash(tx)

        # Get threshold
        threshold = await self.get_threshold()

        # Create request
        from .constants import DEFAULT_REQUEST_EXPIRATION_SECONDS

        now = current_timestamp()
        request = TransactionRequest(
            id=generate_request_id(),
            safe_address=self.address,
            transaction=tx,
            transaction_hash=tx_hash,
            signatures={},
            threshold=threshold,
            created_at=now,
            expires_at=now + DEFAULT_REQUEST_EXPIRATION_SECONDS,
        )

        return request

    async def get_transaction_hash(self, tx: SafeTransaction) -> str:
        """
        Calculate the Safe transaction hash.

        Args:
            tx: The Safe transaction.

        Returns:
            Transaction hash as hex string.
        """
        w3 = await self._get_w3()

        # Build calldata for getTransactionHash
        calldata = self._build_get_transaction_hash_calldata(tx)

        result = await w3.eth.call({"to": self.address, "data": calldata})
        return "0x" + result.hex()

    def sign_transaction(
        self, tx: SafeTransaction, private_key: str
    ) -> SafeSignature:
        """
        Sign a transaction with a private key.

        Args:
            tx: The Safe transaction.
            private_key: Private key hex string.

        Returns:
            SafeSignature containing the signature.
        """
        # Get account from private key
        account = Account.from_key(private_key)

        # We need the transaction hash - this should be calculated beforehand
        # For now, we'll compute it synchronously using Web3
        w3_sync = Web3(Web3.HTTPProvider(self.rpc_url))
        calldata = self._build_get_transaction_hash_calldata(tx)
        result = w3_sync.eth.call({"to": self.address, "data": calldata})
        tx_hash = result

        # Sign the hash
        signed = account.signHash(tx_hash)

        # Adjust v value for Safe (add 4 for EOA signature)
        v = signed.v
        if v < 27:
            v += 27
        v += 4

        # Combine r, s, v
        signature = signed.r.to_bytes(32, "big") + signed.s.to_bytes(32, "big") + bytes([v])

        return SafeSignature(
            signer=account.address,
            signature=signature,
            signature_type=SignatureType.EOA,
        )

    async def sign_transaction_async(
        self, tx: SafeTransaction, private_key: str
    ) -> SafeSignature:
        """
        Sign a transaction asynchronously.

        Args:
            tx: The Safe transaction.
            private_key: Private key hex string.

        Returns:
            SafeSignature containing the signature.
        """
        # Get account from private key
        account = Account.from_key(private_key)

        # Get transaction hash
        tx_hash = await self.get_transaction_hash(tx)
        tx_hash_bytes = bytes.fromhex(tx_hash[2:])

        # Sign the hash
        signed = account.signHash(tx_hash_bytes)

        # Adjust v value for Safe (add 4 for EOA signature)
        v = signed.v
        if v < 27:
            v += 27
        v += 4

        # Combine r, s, v
        signature = signed.r.to_bytes(32, "big") + signed.s.to_bytes(32, "big") + bytes([v])

        return SafeSignature(
            signer=account.address,
            signature=signature,
            signature_type=SignatureType.EOA,
        )

    def add_signature(
        self, request: TransactionRequest, sig: SafeSignature
    ) -> None:
        """
        Add a signature to a transaction request.

        Args:
            request: The transaction request.
            sig: The signature to add.

        Raises:
            ValueError: If signer is not an owner.
        """
        request.signatures[sig.signer.lower()] = sig

    async def execute_transaction(
        self,
        request: TransactionRequest,
        private_key: str,
    ) -> ExecutionResult:
        """
        Execute a Safe transaction with collected signatures.

        Args:
            request: Transaction request with signatures.
            private_key: Private key of the executor.

        Returns:
            ExecutionResult with transaction details.

        Raises:
            ValueError: If not enough signatures.
        """
        if not request.is_ready():
            raise ValueError(
                f"Not enough signatures: have {request.collected_count()}, "
                f"need {request.threshold}"
            )

        w3 = await self._get_w3()
        account = Account.from_key(private_key)

        # Pack signatures sorted by signer address
        packed_sigs = self._pack_signatures(request.signatures)

        # Build execTransaction calldata
        calldata = self._build_exec_transaction_calldata(
            request.transaction, packed_sigs
        )

        # Build transaction
        nonce = await w3.eth.get_transaction_count(account.address)
        gas_price = await w3.eth.gas_price

        # Estimate gas
        gas_estimate = await w3.eth.estimate_gas(
            {
                "from": account.address,
                "to": self.address,
                "data": calldata,
            }
        )

        tx_params: TxParams = {
            "from": account.address,
            "to": self.address,
            "data": calldata,
            "gas": gas_estimate,
            "gasPrice": gas_price,
            "nonce": nonce,
            "chainId": await self.get_chain_id(),
        }

        # Sign and send
        signed_tx = account.sign_transaction(tx_params)
        tx_hash = await w3.eth.send_raw_transaction(signed_tx.rawTransaction)

        return ExecutionResult(
            tx_hash="0x" + tx_hash.hex(),
            success=True,
        )

    async def wait_for_execution(self, tx_hash: str) -> ExecutionResult:
        """
        Wait for a transaction to be mined.

        Args:
            tx_hash: Transaction hash.

        Returns:
            ExecutionResult with final status.
        """
        w3 = await self._get_w3()

        # Wait for receipt
        receipt = await w3.eth.wait_for_transaction_receipt(tx_hash)

        return ExecutionResult(
            tx_hash=tx_hash,
            success=receipt["status"] == 1,
            gas_used=receipt["gasUsed"],
            block_number=receipt["blockNumber"],
        )

    def _pack_signatures(self, signatures: dict) -> bytes:
        """Pack signatures sorted by signer address."""
        # Sort signers by address
        sorted_signers = sort_addresses(list(signatures.keys()))

        # Pack signatures
        packed = b""
        for signer in sorted_signers:
            sig = signatures[signer.lower()]
            packed += sig.signature

        return packed

    def _build_exec_transaction_calldata(
        self, tx: SafeTransaction, signatures: bytes
    ) -> bytes:
        """Build execTransaction calldata."""
        from eth_abi import encode

        # Encode parameters
        encoded = encode(
            [
                "address",
                "uint256",
                "bytes",
                "uint8",
                "uint256",
                "uint256",
                "uint256",
                "address",
                "address",
                "bytes",
            ],
            [
                Web3.to_checksum_address(tx.to),
                tx.value,
                tx.data,
                tx.operation,
                tx.safe_tx_gas,
                tx.base_gas,
                tx.gas_price,
                Web3.to_checksum_address(tx.gas_token),
                Web3.to_checksum_address(tx.refund_receiver),
                signatures,
            ],
        )

        return EXEC_TRANSACTION_SELECTOR + encoded

    def _build_get_transaction_hash_calldata(self, tx: SafeTransaction) -> bytes:
        """Build getTransactionHash calldata."""
        from eth_abi import encode

        nonce = tx.nonce if tx.nonce is not None else 0

        # Encode parameters
        encoded = encode(
            [
                "address",
                "uint256",
                "bytes",
                "uint8",
                "uint256",
                "uint256",
                "uint256",
                "address",
                "address",
                "uint256",
            ],
            [
                Web3.to_checksum_address(tx.to),
                tx.value,
                tx.data,
                tx.operation,
                tx.safe_tx_gas,
                tx.base_gas,
                tx.gas_price,
                Web3.to_checksum_address(tx.gas_token),
                Web3.to_checksum_address(tx.refund_receiver),
                nonce,
            ],
        )

        return GET_TRANSACTION_HASH_SELECTOR + encoded
