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

func TestErrorCodes(t *testing.T) {
	// Verify error code format
	codes := []ErrorCode{
		ErrInvalidRequest, ErrMissingPayload, ErrMissingRequirements,
		ErrInvalidPayload, ErrInvalidRequirements, ErrInvalidSignature,
		ErrInvalidNetwork, ErrInvalidScheme, ErrInvalidAmount,
		ErrInvalidAddress, ErrExpiredPayment, ErrInvalidNonce,
		ErrInternal, ErrDatabaseUnavailable, ErrCacheUnavailable,
		ErrRPCUnavailable, ErrRateLimited, ErrServiceUnavailable,
		ErrVerificationFailed, ErrSettlementFailed, ErrInsufficientBalance,
		ErrAllowanceInsufficient, ErrPaymentMismatch, ErrDuplicatePayment,
		ErrSettlementPending, ErrSettlementTimeout,
		ErrChainUnavailable, ErrTransactionFailed, ErrTransactionReverted,
		ErrGasEstimationFailed, ErrNonceConflict, ErrChainCongested, ErrContractError,
		ErrBridgeUnavailable, ErrBridgeQuoteFailed, ErrBridgeTransferFailed,
		ErrBridgeTimeout, ErrUnsupportedRoute,
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
