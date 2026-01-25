"""
Utility functions for T402 Multi-sig support.
"""

import secrets
import time
from typing import List


def generate_request_id() -> str:
    """Generate a unique request ID."""
    timestamp = int(time.time() * 1000)
    random_bytes = secrets.token_hex(4)
    return f"msig_{timestamp:x}_{random_bytes}"


def current_timestamp() -> int:
    """Get current Unix timestamp in seconds."""
    return int(time.time())


def sort_addresses(addresses: List[str]) -> List[str]:
    """Sort addresses in ascending order (case-insensitive)."""
    return sorted(addresses, key=lambda a: a.lower())


def is_valid_threshold(threshold: int, owner_count: int) -> bool:
    """Check if a threshold is valid for the given owner count."""
    from .constants import MIN_THRESHOLD

    return MIN_THRESHOLD <= threshold <= owner_count


def are_addresses_unique(addresses: List[str]) -> bool:
    """Check if all addresses are unique (case-insensitive)."""
    lower_addresses = [a.lower() for a in addresses]
    return len(set(lower_addresses)) == len(addresses)


def get_owner_index(owner: str, owners: List[str]) -> int:
    """
    Get the index of an owner in the list.

    Returns -1 if not found.
    """
    owner_lower = owner.lower()
    for i, o in enumerate(owners):
        if o.lower() == owner_lower:
            return i
    return -1


def combine_signatures(signatures: dict) -> bytes:
    """
    Combine multiple signatures sorted by signer address.

    Args:
        signatures: Dict mapping signer address to SafeSignature.

    Returns:
        Combined signature bytes.
    """
    sorted_signers = sort_addresses(list(signatures.keys()))

    packed = b""
    for signer in sorted_signers:
        sig = signatures[signer.lower()]
        packed += sig.signature

    return packed


def pad_to_32_bytes(data: bytes) -> bytes:
    """Pad data to 32 bytes."""
    if len(data) >= 32:
        return data[-32:]
    return b"\x00" * (32 - len(data)) + data
