package errors

import (
	"net/http"
	"testing"
)

func TestAPIError_Error(t *testing.T) {
	tests := []struct {
		name     string
		err      *APIError
		expected string
	}{
		{
			name: "with details",
			err: &APIError{
				Code:    ErrInvalidRequest,
				Message: "Invalid request body",
				Details: "missing field 'amount'",
			},
			expected: "[T402-1001] Invalid request body: missing field 'amount'",
		},
		{
			name: "without details",
			err: &APIError{
				Code:    ErrInternal,
				Message: "Internal server error",
			},
			expected: "[T402-2001] Internal server error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.err.Error(); got != tt.expected {
				t.Errorf("Error() = %q, want %q", got, tt.expected)
			}
		})
	}
}

func TestAPIError_HTTPStatus(t *testing.T) {
	tests := []struct {
		name       string
		err        *APIError
		wantStatus int
	}{
		// Client errors (1xxx)
		{
			name: "invalid request",
			err:  &APIError{Code: ErrInvalidRequest},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "missing payload",
			err:  &APIError{Code: ErrMissingPayload},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "invalid signature",
			err:  &APIError{Code: ErrInvalidSignature},
			wantStatus: http.StatusBadRequest,
		},

		// Server errors (2xxx)
		{
			name: "internal error",
			err:  &APIError{Code: ErrInternal},
			wantStatus: http.StatusInternalServerError,
		},
		{
			name: "rate limited",
			err:  &APIError{Code: ErrRateLimited},
			wantStatus: http.StatusTooManyRequests,
		},
		{
			name: "database unavailable",
			err:  &APIError{Code: ErrDatabaseUnavailable},
			wantStatus: http.StatusInternalServerError,
		},

		// Facilitator errors (3xxx)
		{
			name: "verification failed",
			err:  &APIError{Code: ErrVerificationFailed},
			wantStatus: http.StatusUnprocessableEntity,
		},
		{
			name: "payment mismatch",
			err:  &APIError{Code: ErrPaymentMismatch},
			wantStatus: http.StatusUnprocessableEntity,
		},
		{
			name: "settlement failed",
			err:  &APIError{Code: ErrSettlementFailed},
			wantStatus: http.StatusInternalServerError,
		},

		// Chain errors (4xxx)
		{
			name: "chain unavailable",
			err:  &APIError{Code: ErrChainUnavailable},
			wantStatus: http.StatusBadGateway,
		},
		{
			name: "transaction failed",
			err:  &APIError{Code: ErrTransactionFailed},
			wantStatus: http.StatusBadGateway,
		},

		// Bridge errors (5xxx)
		{
			name: "bridge unavailable",
			err:  &APIError{Code: ErrBridgeUnavailable},
			wantStatus: http.StatusBadGateway,
		},

		// Streaming errors (6xxx)
		{
			name: "stream not found",
			err:  &APIError{Code: ErrStreamNotFound},
			wantStatus: http.StatusNotFound,
		},
		{
			name: "stream already closed",
			err:  &APIError{Code: ErrStreamAlreadyClosed},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "stream amount exceeded",
			err:  &APIError{Code: ErrStreamAmountExceeded},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "stream invalid state",
			err:  &APIError{Code: ErrStreamInvalidState},
			wantStatus: http.StatusBadRequest,
		},

		// Intent errors (7xxx)
		{
			name: "intent not found",
			err:  &APIError{Code: ErrIntentNotFound},
			wantStatus: http.StatusNotFound,
		},
		{
			name: "intent already executed",
			err:  &APIError{Code: ErrIntentAlreadyExecuted},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "no routes available",
			err:  &APIError{Code: ErrNoRoutesAvailable},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "intent invalid state",
			err:  &APIError{Code: ErrIntentInvalidState},
			wantStatus: http.StatusBadRequest,
		},

		// Discovery errors (8xxx)
		{
			name: "resource not found",
			err:  &APIError{Code: ErrResourceNotFound},
			wantStatus: http.StatusNotFound,
		},
		{
			name: "resource already exists",
			err:  &APIError{Code: ErrResourceAlreadyExists},
			wantStatus: http.StatusConflict,
		},
		{
			name: "not authorized",
			err:  &APIError{Code: ErrNotAuthorized},
			wantStatus: http.StatusForbidden,
		},
		{
			name: "invalid parameters",
			err:  &APIError{Code: ErrInvalidParameters},
			wantStatus: http.StatusBadRequest,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.err.HTTPStatus(); got != tt.wantStatus {
				t.Errorf("HTTPStatus() = %d, want %d", got, tt.wantStatus)
			}
		})
	}
}

func TestAPIError_HTTPStatus_UnknownCode(t *testing.T) {
	// Test with an unknown error code category
	err := &APIError{Code: "T402-9999"}
	if got := err.HTTPStatus(); got != http.StatusInternalServerError {
		t.Errorf("HTTPStatus() for unknown code = %d, want %d", got, http.StatusInternalServerError)
	}
}

func TestNewInvalidRequestError(t *testing.T) {
	err := NewInvalidRequestError("missing field")

	if err.Code != ErrInvalidRequest {
		t.Errorf("Code = %s, want %s", err.Code, ErrInvalidRequest)
	}
	if err.Details != "missing field" {
		t.Errorf("Details = %s, want 'missing field'", err.Details)
	}
	if err.Retry {
		t.Error("Retry should be false")
	}
}

func TestNewInvalidSignatureError(t *testing.T) {
	err := NewInvalidSignatureError("bad signature format")

	if err.Code != ErrInvalidSignature {
		t.Errorf("Code = %s, want %s", err.Code, ErrInvalidSignature)
	}
	if err.Details != "bad signature format" {
		t.Errorf("Details = %s, want 'bad signature format'", err.Details)
	}
}

func TestNewVerificationFailedError(t *testing.T) {
	err := NewVerificationFailedError("signer mismatch")

	if err.Code != ErrVerificationFailed {
		t.Errorf("Code = %s, want %s", err.Code, ErrVerificationFailed)
	}
	if err.Retry {
		t.Error("Retry should be false")
	}
}

func TestNewSettlementFailedError(t *testing.T) {
	err := NewSettlementFailedError("transaction reverted")

	if err.Code != ErrSettlementFailed {
		t.Errorf("Code = %s, want %s", err.Code, ErrSettlementFailed)
	}
	if !err.Retry {
		t.Error("Retry should be true for settlement errors")
	}
}

func TestNewChainUnavailableError(t *testing.T) {
	err := NewChainUnavailableError("eip155:1", "connection timeout")

	if err.Code != ErrChainUnavailable {
		t.Errorf("Code = %s, want %s", err.Code, ErrChainUnavailable)
	}
	if err.Message != "Chain eip155:1 is unavailable" {
		t.Errorf("Message = %s, want 'Chain eip155:1 is unavailable'", err.Message)
	}
	if !err.Retry {
		t.Error("Retry should be true for chain unavailable errors")
	}
}

func TestNewRateLimitedError(t *testing.T) {
	err := NewRateLimitedError()

	if err.Code != ErrRateLimited {
		t.Errorf("Code = %s, want %s", err.Code, ErrRateLimited)
	}
	if !err.Retry {
		t.Error("Retry should be true for rate limit errors")
	}
}

func TestNewInternalError(t *testing.T) {
	err := NewInternalError("database failure")

	if err.Code != ErrInternal {
		t.Errorf("Code = %s, want %s", err.Code, ErrInternal)
	}
	if err.Details != "database failure" {
		t.Errorf("Details = %s, want 'database failure'", err.Details)
	}
	if !err.Retry {
		t.Error("Retry should be true for internal errors")
	}
}

func TestNewUnsupportedNetworkError(t *testing.T) {
	err := NewUnsupportedNetworkError("unknown:999")

	if err.Code != ErrInvalidNetwork {
		t.Errorf("Code = %s, want %s", err.Code, ErrInvalidNetwork)
	}
	if err.Message != "Network unknown:999 is not supported" {
		t.Errorf("Message = %s, want 'Network unknown:999 is not supported'", err.Message)
	}
	if err.Retry {
		t.Error("Retry should be false for unsupported network errors")
	}
}

func TestNewExpiredPaymentError(t *testing.T) {
	err := NewExpiredPaymentError()

	if err.Code != ErrExpiredPayment {
		t.Errorf("Code = %s, want %s", err.Code, ErrExpiredPayment)
	}
	if err.Retry {
		t.Error("Retry should be false for expired payment errors")
	}
}

func TestNewInsufficientBalanceError(t *testing.T) {
	err := NewInsufficientBalanceError("balance: 0, required: 100")

	if err.Code != ErrInsufficientBalance {
		t.Errorf("Code = %s, want %s", err.Code, ErrInsufficientBalance)
	}
	if err.Details != "balance: 0, required: 100" {
		t.Errorf("Details = %s, want 'balance: 0, required: 100'", err.Details)
	}
	if err.Retry {
		t.Error("Retry should be false for insufficient balance errors")
	}
}

func TestNewInsufficientAmountError(t *testing.T) {
	err := NewInsufficientAmountError("50", "100")

	if err.Code != ErrInsufficientAmount {
		t.Errorf("Code = %s, want %s", err.Code, ErrInsufficientAmount)
	}
	if err.Message != "Payment amount is less than required amount" {
		t.Errorf("Message = %q, want 'Payment amount is less than required amount'", err.Message)
	}
	if err.Details != "payload=50 required=100" {
		t.Errorf("Details = %q, want 'payload=50 required=100'", err.Details)
	}
	if err.Retry {
		t.Error("Retry should be false for insufficient amount errors")
	}
}

func TestNewSignatureExpiredError(t *testing.T) {
	err := NewSignatureExpiredError()

	if err.Code != ErrSignatureExpired {
		t.Errorf("Code = %s, want %s", err.Code, ErrSignatureExpired)
	}
	if err.Message != "Payment signature has expired" {
		t.Errorf("Message = %q, want 'Payment signature has expired'", err.Message)
	}
	if err.Details != "The signature deadline has passed" {
		t.Errorf("Details = %q, want 'The signature deadline has passed'", err.Details)
	}
	if err.Retry {
		t.Error("Retry should be false for signature expired errors")
	}
}

func TestNewInvalidIdempotencyKeyError(t *testing.T) {
	err := NewInvalidIdempotencyKeyError()

	if err.Code != ErrInvalidIdempotencyKey {
		t.Errorf("Code = %s, want %s", err.Code, ErrInvalidIdempotencyKey)
	}
	if err.Message != "Invalid idempotency key format" {
		t.Errorf("Message = %q, want 'Invalid idempotency key format'", err.Message)
	}
	if err.Details != "Max 64 chars, alphanumeric and hyphens only" {
		t.Errorf("Details = %q, want 'Max 64 chars, alphanumeric and hyphens only'", err.Details)
	}
	if err.Retry {
		t.Error("Retry should be false for invalid idempotency key errors")
	}
}

func TestNewNonceReplayError(t *testing.T) {
	err := NewNonceReplayError()

	if err.Code != ErrNonceReplay {
		t.Errorf("Code = %s, want %s", err.Code, ErrNonceReplay)
	}
	if err.Message != "This payment authorization has already been used" {
		t.Errorf("Message = %q, want 'This payment authorization has already been used'", err.Message)
	}
	if err.Details != "Nonce replay detected" {
		t.Errorf("Details = %q, want 'Nonce replay detected'", err.Details)
	}
	if err.Retry {
		t.Error("Retry should be false for nonce replay errors")
	}
}

func TestNewIdempotencyConflictError(t *testing.T) {
	err := NewIdempotencyConflictError()

	if err.Code != ErrIdempotencyConflict {
		t.Errorf("Code = %s, want %s", err.Code, ErrIdempotencyConflict)
	}
	if err.Message != "Request payload does not match previous request with this idempotency key" {
		t.Errorf("Message = %q, want 'Request payload does not match previous request with this idempotency key'", err.Message)
	}
	if err.Details != "" {
		t.Errorf("Details = %q, want empty string", err.Details)
	}
	if err.Retry {
		t.Error("Retry should be false for idempotency conflict errors")
	}
}

func TestNewIdempotencyUnavailableError(t *testing.T) {
	err := NewIdempotencyUnavailableError()

	if err.Code != ErrIdempotencyUnavailable {
		t.Errorf("Code = %s, want %s", err.Code, ErrIdempotencyUnavailable)
	}
	if err.Message != "Idempotency service temporarily unavailable" {
		t.Errorf("Message = %q, want 'Idempotency service temporarily unavailable'", err.Message)
	}
	if !err.Retry {
		t.Error("Retry should be true for idempotency unavailable errors")
	}
}

func TestNewRequestInProgressError(t *testing.T) {
	err := NewRequestInProgressError()

	if err.Code != ErrRequestInProgress {
		t.Errorf("Code = %s, want %s", err.Code, ErrRequestInProgress)
	}
	if err.Message != "A request with this idempotency key is already being processed" {
		t.Errorf("Message = %q, want 'A request with this idempotency key is already being processed'", err.Message)
	}
	if !err.Retry {
		t.Error("Retry should be true for request in progress errors")
	}
}

func TestNewPreviousRequestFailedError(t *testing.T) {
	err := NewPreviousRequestFailedError()

	if err.Code != ErrPreviousRequestFailed {
		t.Errorf("Code = %s, want %s", err.Code, ErrPreviousRequestFailed)
	}
	if err.Message != "Previous request with this idempotency key failed. Use a new key to retry." {
		t.Errorf("Message = %q, want 'Previous request with this idempotency key failed. Use a new key to retry.'", err.Message)
	}
	if err.Retry {
		t.Error("Retry should be false for previous request failed errors")
	}
}

func TestNewStreamNotFoundError(t *testing.T) {
	err := NewStreamNotFoundError("stream-abc-123")

	if err.Code != ErrStreamNotFound {
		t.Errorf("Code = %s, want %s", err.Code, ErrStreamNotFound)
	}
	if err.Message != "Stream stream-abc-123 not found" {
		t.Errorf("Message = %q, want 'Stream stream-abc-123 not found'", err.Message)
	}
	if err.Retry {
		t.Error("Retry should be false for stream not found errors")
	}
}

func TestNewStreamAmountExceededError(t *testing.T) {
	err := NewStreamAmountExceededError("1000000")

	if err.Code != ErrStreamAmountExceeded {
		t.Errorf("Code = %s, want %s", err.Code, ErrStreamAmountExceeded)
	}
	if err.Message != "Stream amount exceeds maximum allowed" {
		t.Errorf("Message = %q, want 'Stream amount exceeds maximum allowed'", err.Message)
	}
	if err.Details != "Maximum amount: 1000000" {
		t.Errorf("Details = %q, want 'Maximum amount: 1000000'", err.Details)
	}
	if err.Retry {
		t.Error("Retry should be false for stream amount exceeded errors")
	}
}

func TestNewStreamInvalidStateError(t *testing.T) {
	err := NewStreamInvalidStateError("paused", "active")

	if err.Code != ErrStreamInvalidState {
		t.Errorf("Code = %s, want %s", err.Code, ErrStreamInvalidState)
	}
	if err.Message != "Invalid stream state for this operation" {
		t.Errorf("Message = %q, want 'Invalid stream state for this operation'", err.Message)
	}
	if err.Details != "current=paused, expected=active" {
		t.Errorf("Details = %q, want 'current=paused, expected=active'", err.Details)
	}
	if err.Retry {
		t.Error("Retry should be false for stream invalid state errors")
	}
}

func TestNewIntentNotFoundError(t *testing.T) {
	err := NewIntentNotFoundError("intent-xyz-789")

	if err.Code != ErrIntentNotFound {
		t.Errorf("Code = %s, want %s", err.Code, ErrIntentNotFound)
	}
	if err.Message != "Intent intent-xyz-789 not found" {
		t.Errorf("Message = %q, want 'Intent intent-xyz-789 not found'", err.Message)
	}
	if err.Retry {
		t.Error("Retry should be false for intent not found errors")
	}
}

func TestNewNoRoutesAvailableError(t *testing.T) {
	err := NewNoRoutesAvailableError("no liquidity on eip155:1")

	if err.Code != ErrNoRoutesAvailable {
		t.Errorf("Code = %s, want %s", err.Code, ErrNoRoutesAvailable)
	}
	if err.Message != "No routes available for this intent" {
		t.Errorf("Message = %q, want 'No routes available for this intent'", err.Message)
	}
	if err.Details != "no liquidity on eip155:1" {
		t.Errorf("Details = %q, want 'no liquidity on eip155:1'", err.Details)
	}
	if !err.Retry {
		t.Error("Retry should be true for no routes available errors")
	}
}

func TestNewRouteExpiredError(t *testing.T) {
	err := NewRouteExpiredError()

	if err.Code != ErrRouteExpired {
		t.Errorf("Code = %s, want %s", err.Code, ErrRouteExpired)
	}
	if err.Message != "Selected route has expired" {
		t.Errorf("Message = %q, want 'Selected route has expired'", err.Message)
	}
	if err.Details != "Please refresh routes and select a new one" {
		t.Errorf("Details = %q, want 'Please refresh routes and select a new one'", err.Details)
	}
	if !err.Retry {
		t.Error("Retry should be true for route expired errors")
	}
}

func TestNewIntentInvalidStateError(t *testing.T) {
	err := NewIntentInvalidStateError("executed", "pending")

	if err.Code != ErrIntentInvalidState {
		t.Errorf("Code = %s, want %s", err.Code, ErrIntentInvalidState)
	}
	if err.Message != "Invalid intent state for this operation" {
		t.Errorf("Message = %q, want 'Invalid intent state for this operation'", err.Message)
	}
	if err.Details != "current=executed, expected=pending" {
		t.Errorf("Details = %q, want 'current=executed, expected=pending'", err.Details)
	}
	if err.Retry {
		t.Error("Retry should be false for intent invalid state errors")
	}
}

func TestNewClientError(t *testing.T) {
	err := NewClientError(ErrInvalidRequest, "custom message", "custom details")

	if err.Code != ErrInvalidRequest {
		t.Errorf("Code = %s, want %s", err.Code, ErrInvalidRequest)
	}
	if err.Message != "custom message" {
		t.Errorf("Message = %q, want 'custom message'", err.Message)
	}
	if err.Details != "custom details" {
		t.Errorf("Details = %q, want 'custom details'", err.Details)
	}
	if err.Retry {
		t.Error("Retry should be false for client errors")
	}
}

func TestNewResourceNotFoundError(t *testing.T) {
	err := NewResourceNotFoundError("resource-123")

	if err.Code != ErrResourceNotFound {
		t.Errorf("Code = %s, want %s", err.Code, ErrResourceNotFound)
	}
	if err.Message != "Resource not found" {
		t.Errorf("Message = %q, want 'Resource not found'", err.Message)
	}
	if err.Details != "resource-123" {
		t.Errorf("Details = %q, want 'resource-123'", err.Details)
	}
	if err.Retry {
		t.Error("Retry should be false for resource not found errors")
	}
}

func TestNewResourceAlreadyExistsError(t *testing.T) {
	err := NewResourceAlreadyExistsError("https://example.com/resource")

	if err.Code != ErrResourceAlreadyExists {
		t.Errorf("Code = %s, want %s", err.Code, ErrResourceAlreadyExists)
	}
	if err.Message != "Resource already exists" {
		t.Errorf("Message = %q, want 'Resource already exists'", err.Message)
	}
	if err.Details != "https://example.com/resource" {
		t.Errorf("Details = %q, want 'https://example.com/resource'", err.Details)
	}
	if err.Retry {
		t.Error("Retry should be false for resource already exists errors")
	}
}

func TestNewNotAuthorizedError(t *testing.T) {
	err := NewNotAuthorizedError("delete")

	if err.Code != ErrNotAuthorized {
		t.Errorf("Code = %s, want %s", err.Code, ErrNotAuthorized)
	}
	if err.Message != "Not authorized for this operation" {
		t.Errorf("Message = %q, want 'Not authorized for this operation'", err.Message)
	}
	if err.Details != "delete" {
		t.Errorf("Details = %q, want 'delete'", err.Details)
	}
	if err.Retry {
		t.Error("Retry should be false for not authorized errors")
	}
}

func TestErrorCodes(t *testing.T) {
	// Verify error code format for all error codes including streaming, intent, and discovery
	codes := []ErrorCode{
		// Client errors (1xxx)
		ErrInvalidRequest, ErrMissingPayload, ErrMissingRequirements,
		ErrInvalidPayload, ErrInvalidRequirements, ErrInvalidSignature,
		ErrInvalidNetwork, ErrInvalidScheme, ErrInvalidAmount,
		ErrInvalidAddress, ErrExpiredPayment, ErrInvalidNonce,
		ErrInsufficientAmount, ErrInvalidIdempotencyKey, ErrSignatureExpired,
		// Server errors (2xxx)
		ErrInternal, ErrDatabaseUnavailable, ErrCacheUnavailable,
		ErrRPCUnavailable, ErrRateLimited, ErrServiceUnavailable,
		// Facilitator errors (3xxx)
		ErrVerificationFailed, ErrSettlementFailed, ErrInsufficientBalance,
		ErrAllowanceInsufficient, ErrPaymentMismatch, ErrDuplicatePayment,
		ErrSettlementPending, ErrSettlementTimeout,
		ErrNonceReplay, ErrIdempotencyConflict, ErrIdempotencyUnavailable,
		ErrPreviousRequestFailed, ErrRequestInProgress,
		// Chain errors (4xxx)
		ErrChainUnavailable, ErrTransactionFailed, ErrTransactionReverted,
		ErrGasEstimationFailed, ErrNonceConflict, ErrChainCongested, ErrContractError,
		// Bridge errors (5xxx)
		ErrBridgeUnavailable, ErrBridgeQuoteFailed, ErrBridgeTransferFailed,
		ErrBridgeTimeout, ErrUnsupportedRoute,
		// Streaming errors (6xxx)
		ErrStreamNotFound, ErrStreamAlreadyClosed, ErrStreamAlreadyPaused,
		ErrStreamNotPaused, ErrStreamAmountExceeded, ErrStreamExpired,
		ErrStreamInvalidState, ErrStreamRateLimited,
		// Intent errors (7xxx)
		ErrIntentNotFound, ErrIntentAlreadyExecuted, ErrIntentCancelled,
		ErrIntentExpired, ErrNoRoutesAvailable, ErrRouteExpired,
		ErrRouteNotSelected, ErrIntentInvalidState,
		// Discovery errors (8xxx)
		ErrResourceNotFound, ErrResourceAlreadyExists,
		ErrInvalidParameters, ErrNotAuthorized,
	}

	for _, code := range codes {
		if len(code) != 9 {
			t.Errorf("Error code %s has invalid length %d, expected 9", code, len(code))
		}
		if code[:5] != "T402-" {
			t.Errorf("Error code %s doesn't start with 'T402-'", code)
		}
	}
}

func TestAPIErrorImplementsError(t *testing.T) {
	var _ error = &APIError{}
}
