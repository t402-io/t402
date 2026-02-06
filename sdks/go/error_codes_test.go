package t402

import (
	"encoding/json"
	"net/http"
	"testing"
)

func TestErrorCodeConstants(t *testing.T) {
	// Verify all error codes have the correct prefix and length
	codes := []ErrorCode{
		ErrInvalidRequest, ErrMissingPayload, ErrMissingRequirements,
		ErrInvalidPayload, ErrInvalidRequirements, ErrInvalidSignature,
		ErrInvalidNetwork, ErrInvalidScheme, ErrInvalidAmount,
		ErrInvalidAddress, ErrExpiredPayment, ErrInvalidNonce,
		ErrInsufficientAmount, ErrInvalidIdempotencyKey, ErrSignatureExpired,
		ErrInternal, ErrDatabaseUnavailable, ErrCacheUnavailable,
		ErrRPCUnavailable, ErrRateLimited, ErrServiceUnavailable,
		ErrVerificationFailed, ErrSettlementFailed, ErrInsufficientBalance,
		ErrAllowanceInsufficient, ErrPaymentMismatch, ErrDuplicatePayment,
		ErrSettlementPending, ErrSettlementTimeout, ErrNonceReplay,
		ErrIdempotencyConflict, ErrIdempotencyUnavailable, ErrPreviousRequestFailed,
		ErrRequestInProgress,
		ErrChainUnavailable, ErrTransactionFailed, ErrTransactionReverted,
		ErrGasEstimationFailed, ErrNonceConflict, ErrChainCongested, ErrContractError,
		ErrBridgeUnavailable, ErrBridgeQuoteFailed, ErrBridgeTransferFailed,
		ErrBridgeTimeout, ErrUnsupportedRoute,
		ErrStreamNotFound, ErrStreamAlreadyClosed, ErrStreamAlreadyPaused,
		ErrStreamNotPaused, ErrStreamAmountExceeded, ErrStreamExpired,
		ErrStreamInvalidState, ErrStreamRateLimited,
		ErrIntentNotFound, ErrIntentAlreadyExecuted, ErrIntentCancelled,
		ErrIntentExpired, ErrNoRoutesAvailable, ErrRouteExpired,
		ErrRouteNotSelected, ErrIntentInvalidState,
		ErrResourceNotFound, ErrResourceAlreadyExists, ErrInvalidParameters,
		ErrNotAuthorized,
	}

	for _, code := range codes {
		if len(code) != 9 {
			t.Errorf("error code %s has wrong length: %d", code, len(code))
		}
		if code[:5] != "T402-" {
			t.Errorf("error code %s missing T402- prefix", code)
		}
	}

	// Verify we have all 60 codes
	if len(codes) != 66 {
		t.Errorf("expected 66 error codes, got %d", len(codes))
	}
}

func TestErrorCodeCategory(t *testing.T) {
	tests := []struct {
		code     ErrorCode
		category byte
	}{
		{ErrInvalidRequest, '1'},
		{ErrInternal, '2'},
		{ErrVerificationFailed, '3'},
		{ErrChainUnavailable, '4'},
		{ErrBridgeUnavailable, '5'},
		{ErrStreamNotFound, '6'},
		{ErrIntentNotFound, '7'},
		{ErrResourceNotFound, '8'},
	}
	for _, tt := range tests {
		if got := tt.code.Category(); got != tt.category {
			t.Errorf("ErrorCode(%s).Category() = %c, want %c", tt.code, got, tt.category)
		}
	}
}

func TestErrorCodeCategoryHelpers(t *testing.T) {
	if !ErrInvalidRequest.IsClientError() {
		t.Error("T402-1001 should be client error")
	}
	if !ErrInternal.IsServerError() {
		t.Error("T402-2001 should be server error")
	}
	if !ErrVerificationFailed.IsFacilitatorError() {
		t.Error("T402-3001 should be facilitator error")
	}
	if !ErrChainUnavailable.IsChainError() {
		t.Error("T402-4001 should be chain error")
	}
	if !ErrBridgeUnavailable.IsBridgeError() {
		t.Error("T402-5001 should be bridge error")
	}
}

func TestAPIErrorHTTPStatus(t *testing.T) {
	tests := []struct {
		code   ErrorCode
		status int
	}{
		{ErrInvalidRequest, http.StatusBadRequest},
		{ErrRateLimited, http.StatusTooManyRequests},
		{ErrInternal, http.StatusInternalServerError},
		{ErrVerificationFailed, http.StatusUnprocessableEntity},
		{ErrSettlementFailed, http.StatusInternalServerError},
		{ErrChainUnavailable, http.StatusBadGateway},
		{ErrBridgeUnavailable, http.StatusBadGateway},
		{ErrStreamNotFound, http.StatusNotFound},
		{ErrStreamAlreadyClosed, http.StatusBadRequest},
		{ErrIntentNotFound, http.StatusNotFound},
		{ErrResourceNotFound, http.StatusNotFound},
		{ErrResourceAlreadyExists, http.StatusConflict},
		{ErrNotAuthorized, http.StatusForbidden},
	}
	for _, tt := range tests {
		err := &APIError{Code: tt.code, Message: "test"}
		if got := err.HTTPStatus(); got != tt.status {
			t.Errorf("APIError{Code: %s}.HTTPStatus() = %d, want %d", tt.code, got, tt.status)
		}
	}
}

func TestAPIErrorString(t *testing.T) {
	err := &APIError{Code: ErrInvalidRequest, Message: "Bad input", Details: "missing field"}
	expected := "[T402-1001] Bad input: missing field"
	if got := err.Error(); got != expected {
		t.Errorf("Error() = %q, want %q", got, expected)
	}

	err2 := &APIError{Code: ErrInternal, Message: "Server error"}
	expected2 := "[T402-2001] Server error"
	if got := err2.Error(); got != expected2 {
		t.Errorf("Error() = %q, want %q", got, expected2)
	}
}

func TestAPIErrorJSON(t *testing.T) {
	err := &APIError{
		Code:    ErrInvalidRequest,
		Message: "Bad input",
		Details: "missing field",
		Retry:   false,
	}
	data, marshalErr := json.Marshal(err)
	if marshalErr != nil {
		t.Fatalf("json.Marshal failed: %v", marshalErr)
	}

	var decoded APIError
	if unmarshalErr := json.Unmarshal(data, &decoded); unmarshalErr != nil {
		t.Fatalf("json.Unmarshal failed: %v", unmarshalErr)
	}
	if decoded.Code != ErrInvalidRequest {
		t.Errorf("decoded.Code = %s, want %s", decoded.Code, ErrInvalidRequest)
	}
	if decoded.Message != "Bad input" {
		t.Errorf("decoded.Message = %s, want Bad input", decoded.Message)
	}
}
