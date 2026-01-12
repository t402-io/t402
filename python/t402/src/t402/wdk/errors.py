"""
Error types for T402 WDK Python adapter.
"""

from enum import Enum
from typing import Optional, Dict, Any


class WDKErrorCode(Enum):
    """Error codes for WDK operations."""

    # Initialization errors
    WDK_NOT_INITIALIZED = "WDK_NOT_INITIALIZED"
    INVALID_SEED_PHRASE = "INVALID_SEED_PHRASE"
    SIGNER_NOT_INITIALIZED = "SIGNER_NOT_INITIALIZED"

    # Chain errors
    CHAIN_NOT_CONFIGURED = "CHAIN_NOT_CONFIGURED"
    CHAIN_NOT_SUPPORTED = "CHAIN_NOT_SUPPORTED"
    INVALID_CHAIN_CONFIG = "INVALID_CHAIN_CONFIG"

    # Signing errors
    SIGN_TYPED_DATA_FAILED = "SIGN_TYPED_DATA_FAILED"
    SIGN_MESSAGE_FAILED = "SIGN_MESSAGE_FAILED"
    INVALID_TYPED_DATA = "INVALID_TYPED_DATA"
    INVALID_MESSAGE = "INVALID_MESSAGE"

    # Balance errors
    BALANCE_FETCH_FAILED = "BALANCE_FETCH_FAILED"
    TOKEN_BALANCE_FETCH_FAILED = "TOKEN_BALANCE_FETCH_FAILED"
    INVALID_TOKEN_ADDRESS = "INVALID_TOKEN_ADDRESS"
    ADDRESS_FETCH_FAILED = "ADDRESS_FETCH_FAILED"
    ACCOUNT_FETCH_FAILED = "ACCOUNT_FETCH_FAILED"

    # Transaction errors
    TRANSACTION_FAILED = "TRANSACTION_FAILED"
    GAS_ESTIMATION_FAILED = "GAS_ESTIMATION_FAILED"
    INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE"

    # Bridge errors
    BRIDGE_NOT_AVAILABLE = "BRIDGE_NOT_AVAILABLE"
    BRIDGE_NOT_SUPPORTED = "BRIDGE_NOT_SUPPORTED"
    BRIDGE_FAILED = "BRIDGE_FAILED"

    # Timeout errors
    OPERATION_TIMEOUT = "OPERATION_TIMEOUT"

    # Unknown error
    UNKNOWN_ERROR = "UNKNOWN_ERROR"


class WDKError(Exception):
    """Base exception for WDK errors."""

    def __init__(
        self,
        code: WDKErrorCode,
        message: str,
        chain: Optional[str] = None,
        cause: Optional[Exception] = None,
        context: Optional[Dict[str, Any]] = None,
    ):
        self.code = code
        self.message = message
        self.chain = chain
        self.cause = cause
        self.context = context or {}
        super().__init__(self._format_message())

    def _format_message(self) -> str:
        parts = [f"[{self.code.value}] {self.message}"]
        if self.chain:
            parts.append(f"Chain: {self.chain}")
        if self.cause:
            parts.append(f"Cause: {str(self.cause)}")
        return " | ".join(parts)

    def to_dict(self) -> Dict[str, Any]:
        """Convert error to dictionary representation."""
        return {
            "code": self.code.value,
            "message": self.message,
            "chain": self.chain,
            "context": self.context,
        }


class WDKInitializationError(WDKError):
    """Error during WDK initialization."""

    def __init__(
        self,
        message: str,
        code: WDKErrorCode = WDKErrorCode.WDK_NOT_INITIALIZED,
        cause: Optional[Exception] = None,
        context: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(code=code, message=message, cause=cause, context=context)


class SignerError(WDKError):
    """Error during signer operations."""

    def __init__(
        self,
        code: WDKErrorCode,
        message: str,
        chain: Optional[str] = None,
        cause: Optional[Exception] = None,
        context: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(code=code, message=message, chain=chain, cause=cause, context=context)


class SigningError(WDKError):
    """Error during signing operations."""

    def __init__(
        self,
        code: WDKErrorCode,
        message: str,
        operation: str,
        chain: Optional[str] = None,
        cause: Optional[Exception] = None,
        context: Optional[Dict[str, Any]] = None,
    ):
        self.operation = operation
        ctx = context or {}
        ctx["operation"] = operation
        super().__init__(code=code, message=message, chain=chain, cause=cause, context=ctx)


class ChainError(WDKError):
    """Error related to chain operations."""

    def __init__(
        self,
        code: WDKErrorCode,
        message: str,
        chain: str,
        cause: Optional[Exception] = None,
        context: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(code=code, message=message, chain=chain, cause=cause, context=context)


class BalanceError(WDKError):
    """Error during balance operations."""

    def __init__(
        self,
        code: WDKErrorCode,
        message: str,
        chain: Optional[str] = None,
        token: Optional[str] = None,
        cause: Optional[Exception] = None,
        context: Optional[Dict[str, Any]] = None,
    ):
        self.token = token
        ctx = context or {}
        if token:
            ctx["token"] = token
        super().__init__(code=code, message=message, chain=chain, cause=cause, context=ctx)


class TransactionError(WDKError):
    """Error during transaction operations."""

    def __init__(
        self,
        code: WDKErrorCode,
        message: str,
        chain: Optional[str] = None,
        tx_hash: Optional[str] = None,
        cause: Optional[Exception] = None,
        context: Optional[Dict[str, Any]] = None,
    ):
        self.tx_hash = tx_hash
        ctx = context or {}
        if tx_hash:
            ctx["tx_hash"] = tx_hash
        super().__init__(code=code, message=message, chain=chain, cause=cause, context=ctx)


class BridgeError(WDKError):
    """Error during bridge operations."""

    def __init__(
        self,
        code: WDKErrorCode,
        message: str,
        from_chain: Optional[str] = None,
        to_chain: Optional[str] = None,
        cause: Optional[Exception] = None,
        context: Optional[Dict[str, Any]] = None,
    ):
        self.from_chain = from_chain
        self.to_chain = to_chain
        ctx = context or {}
        if from_chain:
            ctx["from_chain"] = from_chain
        if to_chain:
            ctx["to_chain"] = to_chain
        super().__init__(
            code=code, message=message, chain=from_chain, cause=cause, context=ctx
        )


def is_wdk_error(error: Exception) -> bool:
    """Check if an exception is a WDK error."""
    return isinstance(error, WDKError)
