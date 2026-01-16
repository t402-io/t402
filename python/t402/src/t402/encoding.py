"""T402 Protocol Encoding/Decoding Utilities.

This module provides encoding and decoding utilities for the T402 payment protocol,
supporting both V1 and V2 protocol versions.

V1 Headers:
    - X-PAYMENT: Payment signature (client → server)
    - X-PAYMENT-RESPONSE: Settlement response (server → client)
    - Response body: PaymentRequired JSON

V2 Headers:
    - PAYMENT-SIGNATURE: Payment signature (client → server)
    - PAYMENT-REQUIRED: Payment requirements (server → client, 402 response)
    - PAYMENT-RESPONSE: Settlement response (server → client)
"""

import base64
import json
import re
from typing import Any, Union

from t402.types import (
    PaymentPayloadV1,
    PaymentPayloadV2,
    PaymentRequiredV2,
    PaymentResponseV2,
    SettleResponse,
    T402_VERSION_V1,
    T402_VERSION_V2,
)

# Header name constants
HEADER_PAYMENT_SIGNATURE = "PAYMENT-SIGNATURE"  # V2: Client payment
HEADER_PAYMENT_REQUIRED = "PAYMENT-REQUIRED"  # V2: Server 402 response
HEADER_PAYMENT_RESPONSE = "PAYMENT-RESPONSE"  # V2: Server settlement
HEADER_X_PAYMENT = "X-PAYMENT"  # V1: Client payment
HEADER_X_PAYMENT_RESPONSE = "X-PAYMENT-RESPONSE"  # V1: Server settlement

# Base64 validation regex (standard base64 with optional padding)
BASE64_REGEX = re.compile(r"^[A-Za-z0-9+/]*={0,2}$")


def safe_base64_encode(data: Union[str, bytes]) -> str:
    """Safely encode string or bytes to base64 string.

    Args:
        data: String or bytes to encode

    Returns:
        Base64 encoded string
    """
    if isinstance(data, str):
        data = data.encode("utf-8")
    return base64.b64encode(data).decode("utf-8")


def safe_base64_decode(data: str) -> str:
    """Safely decode base64 string to bytes and then to utf-8 string.

    Args:
        data: Base64 encoded string

    Returns:
        Decoded utf-8 string
    """
    return base64.b64decode(data).decode("utf-8")


def is_valid_base64(data: str) -> bool:
    """Check if a string is valid base64.

    Args:
        data: String to validate

    Returns:
        True if valid base64, False otherwise
    """
    if not data:
        return False
    # Check length is multiple of 4 (with padding)
    if len(data) % 4 != 0:
        return False
    return bool(BASE64_REGEX.match(data))


# =============================================================================
# V2 Header Encoding/Decoding
# =============================================================================


def encode_payment_signature_header(payment_payload: Union[PaymentPayloadV1, PaymentPayloadV2, dict]) -> str:
    """Encode a payment payload as a base64 header value.

    Works with both V1 and V2 payment payloads.

    Args:
        payment_payload: The payment payload to encode (model or dict)

    Returns:
        Base64 encoded string representation of the payment payload
    """
    if hasattr(payment_payload, "model_dump"):
        data = payment_payload.model_dump(by_alias=True, exclude_none=True)
    else:
        data = payment_payload
    return safe_base64_encode(json.dumps(data))


def decode_payment_signature_header(header_value: str) -> dict[str, Any]:
    """Decode a base64 payment signature header into a payment payload dict.

    The caller should determine the version from the t402Version field
    and parse into the appropriate type.

    Args:
        header_value: The base64 encoded payment signature header

    Returns:
        The decoded payment payload as a dict

    Raises:
        ValueError: If the header is not valid base64 or JSON
    """
    if not is_valid_base64(header_value):
        raise ValueError("Invalid payment signature header: not valid base64")
    try:
        return json.loads(safe_base64_decode(header_value))
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid payment signature header: invalid JSON - {e}")


def encode_payment_required_header(payment_required: Union[PaymentRequiredV2, dict]) -> str:
    """Encode a payment required object as a base64 header value.

    Args:
        payment_required: The payment required object to encode (model or dict)

    Returns:
        Base64 encoded string representation of the payment required object
    """
    if hasattr(payment_required, "model_dump"):
        data = payment_required.model_dump(by_alias=True, exclude_none=True)
    else:
        data = payment_required
    return safe_base64_encode(json.dumps(data))


def decode_payment_required_header(header_value: str) -> dict[str, Any]:
    """Decode a base64 payment required header.

    Args:
        header_value: The base64 encoded payment required header

    Returns:
        The decoded payment required object as a dict

    Raises:
        ValueError: If the header is not valid base64 or JSON
    """
    if not is_valid_base64(header_value):
        raise ValueError("Invalid payment required header: not valid base64")
    try:
        return json.loads(safe_base64_decode(header_value))
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid payment required header: invalid JSON - {e}")


def encode_payment_response_header(
    payment_response: Union[PaymentResponseV2, SettleResponse, dict],
    requirements: dict[str, Any] | None = None,
) -> str:
    """Encode a payment response as a base64 header value.

    Args:
        payment_response: The payment response to encode (model or dict)
        requirements: Optional requirements to include (for V2 format)

    Returns:
        Base64 encoded string representation of the payment response
    """
    if hasattr(payment_response, "model_dump"):
        data = payment_response.model_dump(by_alias=True, exclude_none=True)
    else:
        data = dict(payment_response)

    # If requirements provided separately, add them
    if requirements and "requirements" not in data:
        data["requirements"] = requirements

    return safe_base64_encode(json.dumps(data))


def decode_payment_response_header(header_value: str) -> dict[str, Any]:
    """Decode a base64 payment response header.

    Args:
        header_value: The base64 encoded payment response header

    Returns:
        The decoded payment response as a dict

    Raises:
        ValueError: If the header is not valid base64 or JSON
    """
    if not is_valid_base64(header_value):
        raise ValueError("Invalid payment response header: not valid base64")
    try:
        return json.loads(safe_base64_decode(header_value))
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid payment response header: invalid JSON - {e}")


# =============================================================================
# Header Detection Utilities
# =============================================================================


def get_payment_header_name(version: int) -> str:
    """Get the payment header name for a protocol version.

    Args:
        version: Protocol version (1 or 2)

    Returns:
        Header name string
    """
    if version == T402_VERSION_V1:
        return HEADER_X_PAYMENT
    return HEADER_PAYMENT_SIGNATURE


def get_payment_response_header_name(version: int) -> str:
    """Get the payment response header name for a protocol version.

    Args:
        version: Protocol version (1 or 2)

    Returns:
        Header name string
    """
    if version == T402_VERSION_V1:
        return HEADER_X_PAYMENT_RESPONSE
    return HEADER_PAYMENT_RESPONSE


def detect_protocol_version_from_headers(headers: dict[str, str]) -> int:
    """Detect the protocol version from HTTP headers.

    Checks for V2 headers first, falls back to V1.

    Args:
        headers: HTTP headers (case-insensitive keys)

    Returns:
        Protocol version (1 or 2)
    """
    # Normalize header keys to lowercase for comparison
    lower_headers = {k.lower(): v for k, v in headers.items()}

    # Check for V2 headers first
    if "payment-signature" in lower_headers or "payment-required" in lower_headers:
        return T402_VERSION_V2

    # Fall back to V1
    if "x-payment" in lower_headers:
        return T402_VERSION_V1

    # Default to V2 (current version)
    return T402_VERSION_V2


def extract_payment_from_headers(headers: dict[str, str]) -> tuple[int, str | None]:
    """Extract payment header value and detect version from headers.

    Args:
        headers: HTTP headers (case-insensitive keys)

    Returns:
        Tuple of (version, header_value or None)
    """
    # Normalize header keys to lowercase for comparison
    lower_headers = {k.lower(): v for k, v in headers.items()}

    # Check V2 first
    if "payment-signature" in lower_headers:
        return T402_VERSION_V2, lower_headers["payment-signature"]

    # Check V1
    if "x-payment" in lower_headers:
        return T402_VERSION_V1, lower_headers["x-payment"]

    return T402_VERSION_V2, None


def extract_payment_required_from_response(
    headers: dict[str, str],
    body: dict[str, Any] | None = None,
) -> tuple[int, dict[str, Any] | None]:
    """Extract payment required from HTTP response (headers or body).

    V2: Payment required is in PAYMENT-REQUIRED header
    V1: Payment required is in response body

    Args:
        headers: HTTP response headers
        body: Optional response body (for V1)

    Returns:
        Tuple of (version, payment_required dict or None)
    """
    # Normalize header keys
    lower_headers = {k.lower(): v for k, v in headers.items()}

    # Check V2 header first
    if "payment-required" in lower_headers:
        try:
            return T402_VERSION_V2, decode_payment_required_header(lower_headers["payment-required"])
        except ValueError:
            pass

    # Check V1 body
    if body and isinstance(body, dict) and "t402Version" in body:
        return body.get("t402Version", T402_VERSION_V1), body

    return T402_VERSION_V2, None
