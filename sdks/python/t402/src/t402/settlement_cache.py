"""In-memory settlement cache to prevent duplicate concurrent settlement requests.

Thread-safe via threading.Lock. Can be shared across V1/V2 facilitator instances.
"""

import hashlib
import threading
import time
from typing import Optional


DEFAULT_TTL = 60.0  # seconds


class SettlementCache:
    """Prevents duplicate concurrent settlement requests."""

    def __init__(self, ttl: Optional[float] = None):
        self._entries: dict[str, float] = {}  # key -> created_at
        self._ttl = ttl if ttl is not None else DEFAULT_TTL
        self._lock = threading.Lock()

    @staticmethod
    def transaction_key(tx_bytes: bytes | str) -> str:
        """Compute a cache key from transaction bytes."""
        if isinstance(tx_bytes, str):
            data = tx_bytes.encode("utf-8")
        else:
            data = tx_bytes
        return hashlib.sha256(data).hexdigest()

    def is_duplicate(self, key: str) -> bool:
        """Check if a transaction is already being settled.
        Returns True if duplicate, False if new (and records it).
        """
        with self._lock:
            self._prune_expired()
            if key in self._entries:
                return True
            self._entries[key] = time.monotonic()
            return False

    def remove(self, key: str) -> None:
        """Remove a key from the cache (called after settlement completes)."""
        with self._lock:
            self._entries.pop(key, None)

    @property
    def size(self) -> int:
        """Current number of entries (for testing)."""
        with self._lock:
            return len(self._entries)

    def _prune_expired(self) -> None:
        """Remove expired entries. Must be called with lock held."""
        now = time.monotonic()
        expired = [k for k, v in self._entries.items() if now - v > self._ttl]
        for k in expired:
            del self._entries[k]
