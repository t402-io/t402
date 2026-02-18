"""Sign-In-With-X (SIWx) Extension for the t402 protocol.

Provides CAIP-122 compliant wallet-based identity assertions,
allowing clients to prove control of a wallet address.
"""

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


SIWX_EXTENSION_KEY = "siwx"
SIWX_HEADER_NAME = "X-T402-SIWx"

SIWX_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "required": [
        "domain",
        "address",
        "uri",
        "version",
        "chainId",
        "nonce",
        "issuedAt",
        "signature",
    ],
    "properties": {
        "domain": {"type": "string"},
        "address": {"type": "string"},
        "statement": {"type": "string"},
        "uri": {"type": "string"},
        "version": {"type": "string"},
        "chainId": {"type": "string"},
        "nonce": {"type": "string"},
        "issuedAt": {"type": "string", "format": "date-time"},
        "expirationTime": {"type": "string", "format": "date-time"},
        "notBefore": {"type": "string", "format": "date-time"},
        "requestId": {"type": "string"},
        "resources": {"type": "array", "items": {"type": "string"}},
        "signature": {"type": "string"},
    },
}


class SIWxExtensionInfo(BaseModel):
    """Server-side SIWX declaration."""

    domain: str
    uri: str
    statement: Optional[str] = None
    version: str = "1"
    chain_id: str
    nonce: str
    issued_at: str
    expiration_time: Optional[str] = None
    not_before: Optional[str] = None
    request_id: Optional[str] = None
    resources: List[str] = []
    signature_scheme: Optional[str] = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class SIWxPayload(BaseModel):
    """Client-side SIWX response."""

    domain: str
    address: str
    statement: Optional[str] = None
    uri: str
    version: str
    chain_id: str
    nonce: str
    issued_at: str
    expiration_time: Optional[str] = None
    not_before: Optional[str] = None
    request_id: Optional[str] = None
    resources: Optional[List[str]] = None
    signature: str

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class SIWxExtension(BaseModel):
    """Full SIWX extension for requirements."""

    info: SIWxExtensionInfo
    schema_: Dict[str, Any] = {}

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


def declare_siwx_extension(
    resource_uri: str,
    network: str,
    *,
    statement: Optional[str] = None,
    version: str = "1",
    expiration_time: Optional[str] = None,
    signature_scheme: Optional[str] = None,
) -> SIWxExtension:
    """Declare a SIWx extension for server responses.

    Args:
        resource_uri: Full URI of the resource.
        network: Network in CAIP-2 format (e.g., "eip155:8453").
        statement: Optional statement explaining the sign-in purpose.
        version: SIWx version (defaults to "1").
        expiration_time: Custom expiration (defaults to +5 minutes).
        signature_scheme: Preferred signature scheme.

    Returns:
        SIWxExtension ready for inclusion in response extensions.
    """
    parsed = urlparse(resource_uri)
    domain = parsed.netloc

    now = datetime.now(timezone.utc)
    nonce = secrets.token_hex(16)

    if not expiration_time:
        exp = now + timedelta(minutes=5)
        expiration_time = exp.isoformat()

    info = SIWxExtensionInfo(
        domain=domain,
        uri=resource_uri,
        statement=statement,
        version=version,
        chain_id=network,
        nonce=nonce,
        issued_at=now.isoformat(),
        expiration_time=expiration_time,
        resources=[resource_uri],
        signature_scheme=signature_scheme,
    )

    return SIWxExtension(info=info, schema_=SIWX_SCHEMA)


def parse_siwx_payload(
    extensions: Optional[Dict[str, Any]],
) -> Optional[SIWxPayload]:
    """Parse a SIWx payload from extensions.

    Args:
        extensions: Extensions dict from the payment payload.

    Returns:
        Parsed SIWxPayload, or None if not present.

    Raises:
        ValueError: If the payload is present but invalid.
    """
    if not extensions or SIWX_EXTENSION_KEY not in extensions:
        return None

    raw = extensions[SIWX_EXTENSION_KEY]
    if not isinstance(raw, dict):
        raise ValueError("Invalid siwx extension: expected dict")

    required = ["domain", "address", "uri", "version", "chainId", "nonce", "issuedAt", "signature"]
    for field in required:
        if field not in raw:
            raise ValueError(f"Invalid siwx extension: missing required field {field}")

    return SIWxPayload(**raw)


def validate_siwx_message(
    payload: SIWxPayload,
    expected_resource_uri: str,
    max_age_seconds: int = 300,
) -> Optional[str]:
    """Validate a SIWx message against expected values.

    Args:
        payload: The SIWx payload to validate.
        expected_resource_uri: Expected resource URI.
        max_age_seconds: Maximum age of issuedAt in seconds (default: 5 min).

    Returns:
        None if valid, error message string if invalid.
    """
    parsed = urlparse(expected_resource_uri)
    expected_domain = parsed.netloc

    if payload.domain != expected_domain:
        return f"Domain mismatch: expected {expected_domain}, got {payload.domain}"

    if payload.uri != expected_resource_uri:
        return f"URI mismatch: expected {expected_resource_uri}, got {payload.uri}"

    if payload.version != "1":
        return f"Unsupported version: {payload.version}"

    try:
        issued_at = datetime.fromisoformat(payload.issued_at)
        if issued_at.tzinfo is None:
            issued_at = issued_at.replace(tzinfo=timezone.utc)
    except ValueError:
        return f"Invalid issuedAt: {payload.issued_at}"

    now = datetime.now(timezone.utc)
    age = (now - issued_at).total_seconds()
    if age > max_age_seconds:
        return "Message has expired (issuedAt too old)"

    if payload.expiration_time:
        try:
            expiration = datetime.fromisoformat(payload.expiration_time)
            if expiration.tzinfo is None:
                expiration = expiration.replace(tzinfo=timezone.utc)
            if now > expiration:
                return "Message has expired"
        except ValueError:
            return f"Invalid expirationTime: {payload.expiration_time}"

    if payload.not_before:
        try:
            not_before = datetime.fromisoformat(payload.not_before)
            if not_before.tzinfo is None:
                not_before = not_before.replace(tzinfo=timezone.utc)
            if now < not_before:
                return "Message not yet valid (notBefore in future)"
        except ValueError:
            return f"Invalid notBefore: {payload.not_before}"

    return None
