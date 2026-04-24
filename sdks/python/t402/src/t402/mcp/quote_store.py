"""In-memory quote store with TTL.

Matches the TypeScript implementation in
`sdks/typescript/packages/mcp/src/tools/quoteStore.ts` so cross-SDK
agent flows behave the same way: 5-minute default TTL, UUID quote IDs,
per-read garbage collection, and an explicit `clear_quote_store` hook
for tests. Keeping it in-memory is deliberate — quotes are session-
scoped and losing them on restart just forces a fresh quote request.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from threading import Lock
from typing import Any, Literal, Optional


QuoteType = Literal["swap", "bridge"]


@dataclass
class Quote:
    """A single entry in the store."""

    id: str
    type: QuoteType
    created_at: float
    expires_at: float
    data: dict[str, Any] = field(default_factory=dict)


_DEFAULT_TTL_SECONDS = 5 * 60.0

_store: dict[str, Quote] = {}
_store_lock = Lock()


def create_quote(
    quote_type: QuoteType,
    data: dict[str, Any],
    ttl_seconds: float = _DEFAULT_TTL_SECONDS,
) -> str:
    """Store a quote and return its UUID."""
    qid = str(uuid.uuid4())
    now = time.time()
    with _store_lock:
        _store[qid] = Quote(
            id=qid,
            type=quote_type,
            created_at=now,
            expires_at=now + ttl_seconds,
            data=data,
        )
    return qid


def get_quote(quote_id: str) -> Optional[Quote]:
    """Fetch a quote if it exists and is not expired. Collect on read."""
    with _store_lock:
        quote = _store.get(quote_id)
        if quote is None:
            return None
        if time.time() > quote.expires_at:
            del _store[quote_id]
            return None
        return quote


def delete_quote(quote_id: str) -> None:
    """Remove a quote by id. No-op if missing."""
    with _store_lock:
        _store.pop(quote_id, None)


def clear_quote_store() -> None:
    """Empty the store. Test hook only."""
    with _store_lock:
        _store.clear()
