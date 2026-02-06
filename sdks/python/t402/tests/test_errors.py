"""Tests for T402 standardized error codes."""

from t402.errors import (
    ALL_ERROR_CODES,
    APIError,
    ERR_BRIDGE_UNAVAILABLE,
    ERR_CHAIN_UNAVAILABLE,
    ERR_INTENT_NOT_FOUND,
    ERR_INTERNAL,
    ERR_INVALID_REQUEST,
    ERR_NOT_AUTHORIZED,
    ERR_PAYMENT_MISMATCH,
    ERR_RATE_LIMITED,
    ERR_RESOURCE_ALREADY_EXISTS,
    ERR_RESOURCE_NOT_FOUND,
    ERR_STREAM_NOT_FOUND,
    ERR_VERIFICATION_FAILED,
    http_status_for_code,
)


def test_error_code_count():
    """All 60 error codes should be defined."""
    assert len(ALL_ERROR_CODES) == 66


def test_error_code_format():
    """All error codes should follow T402-XYYY format."""
    for code in ALL_ERROR_CODES:
        assert len(code) == 9, f"Code {code} has wrong length"
        assert code.startswith("T402-"), f"Code {code} missing T402- prefix"
        assert code[5].isdigit(), f"Code {code} category is not a digit"


def test_error_code_categories():
    """Error codes should be in categories 1-8."""
    categories = {code[5] for code in ALL_ERROR_CODES}
    assert categories == {"1", "2", "3", "4", "5", "6", "7", "8"}


def test_http_status_client_error():
    assert http_status_for_code(ERR_INVALID_REQUEST) == 400


def test_http_status_rate_limited():
    assert http_status_for_code(ERR_RATE_LIMITED) == 429


def test_http_status_server_error():
    assert http_status_for_code(ERR_INTERNAL) == 500


def test_http_status_verification_failed():
    assert http_status_for_code(ERR_VERIFICATION_FAILED) == 422


def test_http_status_payment_mismatch():
    assert http_status_for_code(ERR_PAYMENT_MISMATCH) == 422


def test_http_status_chain_error():
    assert http_status_for_code(ERR_CHAIN_UNAVAILABLE) == 502


def test_http_status_bridge_error():
    assert http_status_for_code(ERR_BRIDGE_UNAVAILABLE) == 502


def test_http_status_stream_not_found():
    assert http_status_for_code(ERR_STREAM_NOT_FOUND) == 404


def test_http_status_intent_not_found():
    assert http_status_for_code(ERR_INTENT_NOT_FOUND) == 404


def test_http_status_resource_not_found():
    assert http_status_for_code(ERR_RESOURCE_NOT_FOUND) == 404


def test_http_status_resource_conflict():
    assert http_status_for_code(ERR_RESOURCE_ALREADY_EXISTS) == 409


def test_http_status_not_authorized():
    assert http_status_for_code(ERR_NOT_AUTHORIZED) == 403


def test_api_error_str():
    err = APIError(code=ERR_INVALID_REQUEST, message="Bad input", details="missing field")
    assert str(err) == "[T402-1001] Bad input: missing field"


def test_api_error_str_no_details():
    err = APIError(code=ERR_INTERNAL, message="Server error")
    assert str(err) == "[T402-2001] Server error"


def test_api_error_properties():
    err = APIError(code=ERR_INVALID_REQUEST, message="Bad input")
    assert err.is_client_error
    assert not err.is_server_error
    assert err.http_status == 400
    assert not err.is_retryable


def test_api_error_from_dict():
    data = {
        "code": "T402-2005",
        "message": "Rate limit exceeded",
        "details": "too many requests",
        "retry": True,
    }
    err = APIError.from_dict(data)
    assert err.code == ERR_RATE_LIMITED
    assert err.message == "Rate limit exceeded"
    assert err.details == "too many requests"
    assert err.is_retryable
    assert err.http_status == 429


def test_api_error_is_exception():
    """APIError should be an Exception subclass for raise support."""
    err = APIError(code=ERR_INTERNAL, message="fail")
    assert isinstance(err, Exception)
