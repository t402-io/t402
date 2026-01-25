"""
Signature collector for T402 Multi-sig support.
"""

import threading
from typing import Dict, List, Optional

from .constants import DEFAULT_REQUEST_EXPIRATION_SECONDS
from .types import (
    SafeSignature,
    SafeTransaction,
    TransactionRequest,
)
from .utils import generate_request_id, current_timestamp, sort_addresses, combine_signatures


class SignatureCollector:
    """Manages pending multi-sig transactions and signature collection."""

    def __init__(self, expiration_seconds: Optional[int] = None):
        """
        Initialize SignatureCollector.

        Args:
            expiration_seconds: Request expiration time (default: 1 hour).
        """
        self._pending_requests: Dict[str, TransactionRequest] = {}
        self._expiration_seconds = (
            expiration_seconds or DEFAULT_REQUEST_EXPIRATION_SECONDS
        )
        self._lock = threading.RLock()

    def create_request(
        self,
        safe_address: str,
        tx: SafeTransaction,
        tx_hash: str,
        owners: List[str],
        threshold: int,
    ) -> TransactionRequest:
        """
        Create a new signature collection request.

        Args:
            safe_address: Address of the Safe.
            tx: The Safe transaction.
            tx_hash: Transaction hash for signing.
            owners: List of owner addresses.
            threshold: Number of signatures required.

        Returns:
            New TransactionRequest.
        """
        with self._lock:
            now = current_timestamp()
            request = TransactionRequest(
                id=generate_request_id(),
                safe_address=safe_address,
                transaction=tx,
                transaction_hash=tx_hash,
                signatures={},
                threshold=threshold,
                created_at=now,
                expires_at=now + self._expiration_seconds,
            )
            self._pending_requests[request.id] = request
            return request

    def add_signature(self, request_id: str, sig: SafeSignature) -> None:
        """
        Add a signature to a request.

        Args:
            request_id: Request ID.
            sig: Signature to add.

        Raises:
            ValueError: If request not found, expired, or already signed.
        """
        with self._lock:
            request = self._pending_requests.get(request_id)
            if request is None:
                raise ValueError("Request not found")

            # Check expiration
            if current_timestamp() > request.expires_at:
                del self._pending_requests[request_id]
                raise ValueError("Request expired")

            # Check if already signed by this signer
            if sig.signer.lower() in request.signatures:
                raise ValueError("Already signed by this signer")

            request.signatures[sig.signer.lower()] = sig

    def get_request(self, request_id: str) -> Optional[TransactionRequest]:
        """
        Get a pending request.

        Args:
            request_id: Request ID.

        Returns:
            TransactionRequest or None if not found/expired.
        """
        with self._lock:
            request = self._pending_requests.get(request_id)
            if request is None:
                return None

            # Check expiration
            if current_timestamp() > request.expires_at:
                del self._pending_requests[request_id]
                return None

            return request

    def remove_request(self, request_id: str) -> bool:
        """
        Remove a request.

        Args:
            request_id: Request ID.

        Returns:
            True if removed, False if not found.
        """
        with self._lock:
            if request_id in self._pending_requests:
                del self._pending_requests[request_id]
                return True
            return False

    def get_pending_requests(self) -> List[TransactionRequest]:
        """
        Get all non-expired pending requests.

        Returns:
            List of pending requests.
        """
        with self._lock:
            self._cleanup_expired()
            return list(self._pending_requests.values())

    def get_pending_owners(
        self, request_id: str, owners: List[str]
    ) -> Optional[List[str]]:
        """
        Get owners who haven't signed a request yet.

        Args:
            request_id: Request ID.
            owners: List of all owner addresses.

        Returns:
            List of pending owner addresses, or None if request not found.
        """
        with self._lock:
            request = self._pending_requests.get(request_id)
            if request is None:
                return None

            pending = []
            for owner in owners:
                if owner.lower() not in request.signatures:
                    pending.append(owner)
            return pending

    def get_signed_owners(self, request_id: str) -> Optional[List[str]]:
        """
        Get owners who have signed a request.

        Args:
            request_id: Request ID.

        Returns:
            List of signed owner addresses, or None if request not found.
        """
        with self._lock:
            request = self._pending_requests.get(request_id)
            if request is None:
                return None

            return list(request.signatures.keys())

    def get_combined_signature(self, request_id: str) -> bytes:
        """
        Get the packed signatures for execution.

        Args:
            request_id: Request ID.

        Returns:
            Combined signature bytes.

        Raises:
            ValueError: If request not found or not ready.
        """
        with self._lock:
            request = self._pending_requests.get(request_id)
            if request is None:
                raise ValueError("Request not found")

            if not request.is_ready():
                raise ValueError("Not enough signatures")

            return combine_signatures(request.signatures)

    def cleanup(self) -> None:
        """Remove expired requests."""
        with self._lock:
            self._cleanup_expired()

    def _cleanup_expired(self) -> None:
        """Remove expired requests (must hold lock)."""
        now = current_timestamp()
        expired = [
            rid
            for rid, req in self._pending_requests.items()
            if now > req.expires_at
        ]
        for rid in expired:
            del self._pending_requests[rid]

    def clear(self) -> None:
        """Remove all pending requests."""
        with self._lock:
            self._pending_requests.clear()
