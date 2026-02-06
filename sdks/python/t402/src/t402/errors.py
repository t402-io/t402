"""Standardized T402 error codes returned by the facilitator API.

Error codes follow the format T402-XYYY where X is the category (1-8)
and YYY is the specific error within that category.
"""

from __future__ import annotations

from dataclasses import dataclass


# Client Errors (T402-1xxx): Invalid input, malformed requests
ERR_INVALID_REQUEST = "T402-1001"
ERR_MISSING_PAYLOAD = "T402-1002"
ERR_MISSING_REQUIREMENTS = "T402-1003"
ERR_INVALID_PAYLOAD = "T402-1004"
ERR_INVALID_REQUIREMENTS = "T402-1005"
ERR_INVALID_SIGNATURE = "T402-1006"
ERR_INVALID_NETWORK = "T402-1007"
ERR_INVALID_SCHEME = "T402-1008"
ERR_INVALID_AMOUNT = "T402-1009"
ERR_INVALID_ADDRESS = "T402-1010"
ERR_EXPIRED_PAYMENT = "T402-1011"
ERR_INVALID_NONCE = "T402-1012"
ERR_INSUFFICIENT_AMOUNT = "T402-1013"
ERR_INVALID_IDEMPOTENCY_KEY = "T402-1014"
ERR_SIGNATURE_EXPIRED = "T402-1015"

# Server Errors (T402-2xxx): Internal failures, dependency issues
ERR_INTERNAL = "T402-2001"
ERR_DATABASE_UNAVAILABLE = "T402-2002"
ERR_CACHE_UNAVAILABLE = "T402-2003"
ERR_RPC_UNAVAILABLE = "T402-2004"
ERR_RATE_LIMITED = "T402-2005"
ERR_SERVICE_UNAVAILABLE = "T402-2006"

# Facilitator Errors (T402-3xxx): Verification and settlement failures
ERR_VERIFICATION_FAILED = "T402-3001"
ERR_SETTLEMENT_FAILED = "T402-3002"
ERR_INSUFFICIENT_BALANCE = "T402-3003"
ERR_ALLOWANCE_INSUFFICIENT = "T402-3004"
ERR_PAYMENT_MISMATCH = "T402-3005"
ERR_DUPLICATE_PAYMENT = "T402-3006"
ERR_SETTLEMENT_PENDING = "T402-3007"
ERR_SETTLEMENT_TIMEOUT = "T402-3008"
ERR_NONCE_REPLAY = "T402-3009"
ERR_IDEMPOTENCY_CONFLICT = "T402-3010"
ERR_IDEMPOTENCY_UNAVAILABLE = "T402-3011"
ERR_PREVIOUS_REQUEST_FAILED = "T402-3012"
ERR_REQUEST_IN_PROGRESS = "T402-3013"

# Chain-Specific Errors (T402-4xxx): Network and transaction issues
ERR_CHAIN_UNAVAILABLE = "T402-4001"
ERR_TRANSACTION_FAILED = "T402-4002"
ERR_TRANSACTION_REVERTED = "T402-4003"
ERR_GAS_ESTIMATION_FAILED = "T402-4004"
ERR_NONCE_CONFLICT = "T402-4005"
ERR_CHAIN_CONGESTED = "T402-4006"
ERR_CONTRACT_ERROR = "T402-4007"

# Bridge Errors (T402-5xxx): Cross-chain operation failures
ERR_BRIDGE_UNAVAILABLE = "T402-5001"
ERR_BRIDGE_QUOTE_FAILED = "T402-5002"
ERR_BRIDGE_TRANSFER_FAILED = "T402-5003"
ERR_BRIDGE_TIMEOUT = "T402-5004"
ERR_UNSUPPORTED_ROUTE = "T402-5005"

# Streaming Errors (T402-6xxx): Payment stream issues
ERR_STREAM_NOT_FOUND = "T402-6001"
ERR_STREAM_ALREADY_CLOSED = "T402-6002"
ERR_STREAM_ALREADY_PAUSED = "T402-6003"
ERR_STREAM_NOT_PAUSED = "T402-6004"
ERR_STREAM_AMOUNT_EXCEEDED = "T402-6005"
ERR_STREAM_EXPIRED = "T402-6006"
ERR_STREAM_INVALID_STATE = "T402-6007"
ERR_STREAM_RATE_LIMITED = "T402-6008"

# Intent Errors (T402-7xxx): Payment intent issues
ERR_INTENT_NOT_FOUND = "T402-7001"
ERR_INTENT_ALREADY_EXECUTED = "T402-7002"
ERR_INTENT_CANCELLED = "T402-7003"
ERR_INTENT_EXPIRED = "T402-7004"
ERR_NO_ROUTES_AVAILABLE = "T402-7005"
ERR_ROUTE_EXPIRED = "T402-7006"
ERR_ROUTE_NOT_SELECTED = "T402-7007"
ERR_INTENT_INVALID_STATE = "T402-7008"

# Discovery Errors (T402-8xxx): Resource marketplace issues
ERR_RESOURCE_NOT_FOUND = "T402-8001"
ERR_RESOURCE_ALREADY_EXISTS = "T402-8002"
ERR_INVALID_PARAMETERS = "T402-8003"
ERR_NOT_AUTHORIZED = "T402-8004"

# All error code constants for iteration/validation
ALL_ERROR_CODES: list[str] = [
    ERR_INVALID_REQUEST, ERR_MISSING_PAYLOAD, ERR_MISSING_REQUIREMENTS,
    ERR_INVALID_PAYLOAD, ERR_INVALID_REQUIREMENTS, ERR_INVALID_SIGNATURE,
    ERR_INVALID_NETWORK, ERR_INVALID_SCHEME, ERR_INVALID_AMOUNT,
    ERR_INVALID_ADDRESS, ERR_EXPIRED_PAYMENT, ERR_INVALID_NONCE,
    ERR_INSUFFICIENT_AMOUNT, ERR_INVALID_IDEMPOTENCY_KEY, ERR_SIGNATURE_EXPIRED,
    ERR_INTERNAL, ERR_DATABASE_UNAVAILABLE, ERR_CACHE_UNAVAILABLE,
    ERR_RPC_UNAVAILABLE, ERR_RATE_LIMITED, ERR_SERVICE_UNAVAILABLE,
    ERR_VERIFICATION_FAILED, ERR_SETTLEMENT_FAILED, ERR_INSUFFICIENT_BALANCE,
    ERR_ALLOWANCE_INSUFFICIENT, ERR_PAYMENT_MISMATCH, ERR_DUPLICATE_PAYMENT,
    ERR_SETTLEMENT_PENDING, ERR_SETTLEMENT_TIMEOUT, ERR_NONCE_REPLAY,
    ERR_IDEMPOTENCY_CONFLICT, ERR_IDEMPOTENCY_UNAVAILABLE,
    ERR_PREVIOUS_REQUEST_FAILED, ERR_REQUEST_IN_PROGRESS,
    ERR_CHAIN_UNAVAILABLE, ERR_TRANSACTION_FAILED, ERR_TRANSACTION_REVERTED,
    ERR_GAS_ESTIMATION_FAILED, ERR_NONCE_CONFLICT, ERR_CHAIN_CONGESTED,
    ERR_CONTRACT_ERROR,
    ERR_BRIDGE_UNAVAILABLE, ERR_BRIDGE_QUOTE_FAILED, ERR_BRIDGE_TRANSFER_FAILED,
    ERR_BRIDGE_TIMEOUT, ERR_UNSUPPORTED_ROUTE,
    ERR_STREAM_NOT_FOUND, ERR_STREAM_ALREADY_CLOSED, ERR_STREAM_ALREADY_PAUSED,
    ERR_STREAM_NOT_PAUSED, ERR_STREAM_AMOUNT_EXCEEDED, ERR_STREAM_EXPIRED,
    ERR_STREAM_INVALID_STATE, ERR_STREAM_RATE_LIMITED,
    ERR_INTENT_NOT_FOUND, ERR_INTENT_ALREADY_EXECUTED, ERR_INTENT_CANCELLED,
    ERR_INTENT_EXPIRED, ERR_NO_ROUTES_AVAILABLE, ERR_ROUTE_EXPIRED,
    ERR_ROUTE_NOT_SELECTED, ERR_INTENT_INVALID_STATE,
    ERR_RESOURCE_NOT_FOUND, ERR_RESOURCE_ALREADY_EXISTS,
    ERR_INVALID_PARAMETERS, ERR_NOT_AUTHORIZED,
]


@dataclass
class APIError(Exception):
    """Structured error response from the facilitator API."""

    code: str
    message: str
    details: str = ""
    retry: bool = False

    def __str__(self) -> str:
        if self.details:
            return f"[{self.code}] {self.message}: {self.details}"
        return f"[{self.code}] {self.message}"

    @property
    def http_status(self) -> int:
        """Returns the expected HTTP status code for this error code."""
        return http_status_for_code(self.code)

    @property
    def is_client_error(self) -> bool:
        return len(self.code) >= 6 and self.code[5] == "1"

    @property
    def is_server_error(self) -> bool:
        return len(self.code) >= 6 and self.code[5] == "2"

    @property
    def is_facilitator_error(self) -> bool:
        return len(self.code) >= 6 and self.code[5] == "3"

    @property
    def is_chain_error(self) -> bool:
        return len(self.code) >= 6 and self.code[5] == "4"

    @property
    def is_bridge_error(self) -> bool:
        return len(self.code) >= 6 and self.code[5] == "5"

    @property
    def is_retryable(self) -> bool:
        return self.retry

    @classmethod
    def from_dict(cls, data: dict) -> "APIError":
        """Create an APIError from a dictionary (e.g., from JSON response)."""
        return cls(
            code=data.get("code", ""),
            message=data.get("message", ""),
            details=data.get("details", ""),
            retry=data.get("retry", False),
        )


def http_status_for_code(code: str) -> int:
    """Returns the expected HTTP status code for a given T402 error code."""
    if len(code) < 6:
        return 500
    category = code[5]
    if category == "1":
        return 400
    if category == "2":
        if code == ERR_RATE_LIMITED:
            return 429
        return 500
    if category == "3":
        if code in (ERR_VERIFICATION_FAILED, ERR_PAYMENT_MISMATCH):
            return 422
        return 500
    if category == "4":
        return 502
    if category == "5":
        return 502
    if category == "6":
        if code == ERR_STREAM_NOT_FOUND:
            return 404
        return 400
    if category == "7":
        if code == ERR_INTENT_NOT_FOUND:
            return 404
        return 400
    if category == "8":
        if code == ERR_RESOURCE_NOT_FOUND:
            return 404
        if code == ERR_RESOURCE_ALREADY_EXISTS:
            return 409
        if code == ERR_NOT_AUTHORIZED:
            return 403
        return 400
    return 500
