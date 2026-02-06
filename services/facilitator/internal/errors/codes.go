// Package errors provides standardized error codes for the T402 Facilitator API.
//
// Error Code Structure:
//   - T402-1xxx: Client errors (invalid input, malformed requests)
//   - T402-2xxx: Server errors (internal failures, dependencies)
//   - T402-3xxx: Facilitator-specific errors (verification, settlement)
//   - T402-4xxx: Chain-specific errors (network issues, transaction failures)
//   - T402-5xxx: Bridge errors (cross-chain operations)
package errors

import (
	"fmt"
	"net/http"
)

// ErrorCode represents a standardized T402 error code
type ErrorCode string

// Client Errors (T402-1xxx)
const (
	ErrInvalidRequest       ErrorCode = "T402-1001" // Malformed request body
	ErrMissingPayload       ErrorCode = "T402-1002" // Missing paymentPayload
	ErrMissingRequirements  ErrorCode = "T402-1003" // Missing paymentRequirements
	ErrInvalidPayload       ErrorCode = "T402-1004" // Invalid paymentPayload format
	ErrInvalidRequirements  ErrorCode = "T402-1005" // Invalid paymentRequirements format
	ErrInvalidSignature     ErrorCode = "T402-1006" // Signature verification failed
	ErrInvalidNetwork       ErrorCode = "T402-1007" // Unsupported network
	ErrInvalidScheme        ErrorCode = "T402-1008" // Unsupported scheme
	ErrInvalidAmount        ErrorCode = "T402-1009" // Invalid payment amount
	ErrInvalidAddress       ErrorCode = "T402-1010" // Invalid address format
	ErrExpiredPayment       ErrorCode = "T402-1011" // Payment deadline expired
	ErrInvalidNonce         ErrorCode = "T402-1012" // Invalid or reused nonce
	ErrInsufficientAmount   ErrorCode = "T402-1013" // Payment amount less than required
	ErrInvalidIdempotencyKey ErrorCode = "T402-1014" // Invalid idempotency key format
	ErrSignatureExpired     ErrorCode = "T402-1015" // Signature has expired
)

// Server Errors (T402-2xxx)
const (
	ErrInternal            ErrorCode = "T402-2001" // Internal server error
	ErrDatabaseUnavailable ErrorCode = "T402-2002" // Database connection failed
	ErrCacheUnavailable    ErrorCode = "T402-2003" // Cache service unavailable
	ErrRPCUnavailable      ErrorCode = "T402-2004" // Blockchain RPC unavailable
	ErrRateLimited         ErrorCode = "T402-2005" // Rate limit exceeded
	ErrServiceUnavailable  ErrorCode = "T402-2006" // Service temporarily unavailable
)

// Facilitator Errors (T402-3xxx)
const (
	ErrVerificationFailed    ErrorCode = "T402-3001" // Payment verification failed
	ErrSettlementFailed      ErrorCode = "T402-3002" // Payment settlement failed
	ErrInsufficientBalance   ErrorCode = "T402-3003" // Payer has insufficient balance
	ErrAllowanceInsufficient ErrorCode = "T402-3004" // Token allowance insufficient
	ErrPaymentMismatch       ErrorCode = "T402-3005" // Payment doesn't match requirements
	ErrDuplicatePayment      ErrorCode = "T402-3006" // Payment already processed
	ErrSettlementPending     ErrorCode = "T402-3007" // Settlement is pending
	ErrSettlementTimeout     ErrorCode = "T402-3008" // Settlement timed out
	ErrNonceReplay           ErrorCode = "T402-3009" // Nonce already used (replay attack)
	ErrIdempotencyConflict   ErrorCode = "T402-3010" // Idempotency key conflict
	ErrIdempotencyUnavailable ErrorCode = "T402-3011" // Idempotency service unavailable
	ErrPreviousRequestFailed ErrorCode = "T402-3012" // Previous request with key failed
	ErrRequestInProgress     ErrorCode = "T402-3013" // Request already in progress
)

// Chain-Specific Errors (T402-4xxx)
const (
	ErrChainUnavailable     ErrorCode = "T402-4001" // Chain RPC not responding
	ErrTransactionFailed    ErrorCode = "T402-4002" // Transaction execution failed
	ErrTransactionReverted  ErrorCode = "T402-4003" // Transaction reverted on-chain
	ErrGasEstimationFailed  ErrorCode = "T402-4004" // Failed to estimate gas
	ErrNonceConflict        ErrorCode = "T402-4005" // Nonce conflict on chain
	ErrChainCongested       ErrorCode = "T402-4006" // Chain is congested
	ErrContractError        ErrorCode = "T402-4007" // Smart contract error
)

// Bridge Errors (T402-5xxx)
const (
	ErrBridgeUnavailable    ErrorCode = "T402-5001" // Bridge service unavailable
	ErrBridgeQuoteFailed    ErrorCode = "T402-5002" // Failed to get bridge quote
	ErrBridgeTransferFailed ErrorCode = "T402-5003" // Bridge transfer failed
	ErrBridgeTimeout        ErrorCode = "T402-5004" // Bridge delivery timeout
	ErrUnsupportedRoute     ErrorCode = "T402-5005" // Bridge route not supported
)

// Streaming Errors (T402-6xxx)
const (
	ErrStreamNotFound       ErrorCode = "T402-6001" // Stream not found
	ErrStreamAlreadyClosed  ErrorCode = "T402-6002" // Stream already closed
	ErrStreamAlreadyPaused  ErrorCode = "T402-6003" // Stream already paused
	ErrStreamNotPaused      ErrorCode = "T402-6004" // Stream is not paused
	ErrStreamAmountExceeded ErrorCode = "T402-6005" // Stream amount exceeds maximum
	ErrStreamExpired        ErrorCode = "T402-6006" // Stream has expired
	ErrStreamInvalidState   ErrorCode = "T402-6007" // Invalid stream state transition
	ErrStreamRateLimited    ErrorCode = "T402-6008" // Stream update rate limited
)

// Intent Errors (T402-7xxx)
const (
	ErrIntentNotFound       ErrorCode = "T402-7001" // Intent not found
	ErrIntentAlreadyExecuted ErrorCode = "T402-7002" // Intent already executed
	ErrIntentCancelled      ErrorCode = "T402-7003" // Intent was cancelled
	ErrIntentExpired        ErrorCode = "T402-7004" // Intent has expired
	ErrNoRoutesAvailable    ErrorCode = "T402-7005" // No routes available for intent
	ErrRouteExpired         ErrorCode = "T402-7006" // Selected route has expired
	ErrRouteNotSelected     ErrorCode = "T402-7007" // No route selected for intent
	ErrIntentInvalidState   ErrorCode = "T402-7008" // Invalid intent state transition
)

// Discovery Errors (T402-8xxx)
const (
	ErrResourceNotFound     ErrorCode = "T402-8001" // Discoverable resource not found
	ErrResourceAlreadyExists ErrorCode = "T402-8002" // Resource already registered
	ErrInvalidParameters    ErrorCode = "T402-8003" // Invalid query parameters
	ErrNotAuthorized        ErrorCode = "T402-8004" // Not authorized for this operation
)

// Additional error code aliases for handler convenience
const (
	InvalidParameters     = ErrInvalidParameters
	InvalidPayload        = ErrInvalidPayload
	ResourceNotFound      = ErrResourceNotFound
	ResourceAlreadyExists = ErrResourceAlreadyExists
	NotAuthorized         = ErrNotAuthorized
)

// APIError represents a structured error response
type APIError struct {
	Code    ErrorCode `json:"code"`
	Message string    `json:"message"`
	Details string    `json:"details,omitempty"`
	Retry   bool      `json:"retry,omitempty"` // Whether the client should retry
}

// Error implements the error interface
func (e *APIError) Error() string {
	if e.Details != "" {
		return fmt.Sprintf("[%s] %s: %s", e.Code, e.Message, e.Details)
	}
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

// HTTPStatus returns the appropriate HTTP status code for the error
func (e *APIError) HTTPStatus() int {
	switch e.Code[5] { // Check the category digit (1-8)
	case '1': // Client errors
		return http.StatusBadRequest
	case '2': // Server errors
		if e.Code == ErrRateLimited {
			return http.StatusTooManyRequests
		}
		return http.StatusInternalServerError
	case '3': // Facilitator errors
		if e.Code == ErrVerificationFailed || e.Code == ErrPaymentMismatch {
			return http.StatusUnprocessableEntity
		}
		return http.StatusInternalServerError
	case '4': // Chain errors
		return http.StatusBadGateway
	case '5': // Bridge errors
		return http.StatusBadGateway
	case '6': // Streaming errors
		if e.Code == ErrStreamNotFound {
			return http.StatusNotFound
		}
		return http.StatusBadRequest
	case '7': // Intent errors
		if e.Code == ErrIntentNotFound {
			return http.StatusNotFound
		}
		return http.StatusBadRequest
	case '8': // Discovery errors
		if e.Code == ErrResourceNotFound {
			return http.StatusNotFound
		}
		if e.Code == ErrResourceAlreadyExists {
			return http.StatusConflict
		}
		if e.Code == ErrNotAuthorized {
			return http.StatusForbidden
		}
		return http.StatusBadRequest
	default:
		return http.StatusInternalServerError
	}
}

// Common error constructors

func NewInvalidRequestError(details string) *APIError {
	return &APIError{
		Code:    ErrInvalidRequest,
		Message: "Invalid request body",
		Details: details,
		Retry:   false,
	}
}

func NewInvalidSignatureError(details string) *APIError {
	return &APIError{
		Code:    ErrInvalidSignature,
		Message: "Signature verification failed",
		Details: details,
		Retry:   false,
	}
}

func NewVerificationFailedError(details string) *APIError {
	return &APIError{
		Code:    ErrVerificationFailed,
		Message: "Payment verification failed",
		Details: details,
		Retry:   false,
	}
}

func NewSettlementFailedError(details string) *APIError {
	return &APIError{
		Code:    ErrSettlementFailed,
		Message: "Payment settlement failed",
		Details: details,
		Retry:   true, // Settlements can often be retried
	}
}

func NewChainUnavailableError(network, details string) *APIError {
	return &APIError{
		Code:    ErrChainUnavailable,
		Message: fmt.Sprintf("Chain %s is unavailable", network),
		Details: details,
		Retry:   true,
	}
}

func NewRateLimitedError() *APIError {
	return &APIError{
		Code:    ErrRateLimited,
		Message: "Rate limit exceeded",
		Details: "Please reduce request frequency",
		Retry:   true,
	}
}

func NewInternalError(details string) *APIError {
	return &APIError{
		Code:    ErrInternal,
		Message: "Internal server error",
		Details: details,
		Retry:   true,
	}
}

func NewUnsupportedNetworkError(network string) *APIError {
	return &APIError{
		Code:    ErrInvalidNetwork,
		Message: fmt.Sprintf("Network %s is not supported", network),
		Details: "See /supported for list of supported networks",
		Retry:   false,
	}
}

func NewExpiredPaymentError() *APIError {
	return &APIError{
		Code:    ErrExpiredPayment,
		Message: "Payment has expired",
		Details: "The payment deadline has passed",
		Retry:   false,
	}
}

func NewInsufficientBalanceError(details string) *APIError {
	return &APIError{
		Code:    ErrInsufficientBalance,
		Message: "Insufficient balance",
		Details: details,
		Retry:   false,
	}
}

func NewInsufficientAmountError(payloadAmount, requiredAmount string) *APIError {
	return &APIError{
		Code:    ErrInsufficientAmount,
		Message: "Payment amount is less than required amount",
		Details: fmt.Sprintf("payload=%s required=%s", payloadAmount, requiredAmount),
		Retry:   false,
	}
}

func NewSignatureExpiredError() *APIError {
	return &APIError{
		Code:    ErrSignatureExpired,
		Message: "Payment signature has expired",
		Details: "The signature deadline has passed",
		Retry:   false,
	}
}

func NewInvalidIdempotencyKeyError() *APIError {
	return &APIError{
		Code:    ErrInvalidIdempotencyKey,
		Message: "Invalid idempotency key format",
		Details: "Max 64 chars, alphanumeric and hyphens only",
		Retry:   false,
	}
}

func NewNonceReplayError() *APIError {
	return &APIError{
		Code:    ErrNonceReplay,
		Message: "This payment authorization has already been used",
		Details: "Nonce replay detected",
		Retry:   false,
	}
}

func NewIdempotencyConflictError() *APIError {
	return &APIError{
		Code:    ErrIdempotencyConflict,
		Message: "Request payload does not match previous request with this idempotency key",
		Retry:   false,
	}
}

func NewIdempotencyUnavailableError() *APIError {
	return &APIError{
		Code:    ErrIdempotencyUnavailable,
		Message: "Idempotency service temporarily unavailable",
		Retry:   true,
	}
}

func NewRequestInProgressError() *APIError {
	return &APIError{
		Code:    ErrRequestInProgress,
		Message: "A request with this idempotency key is already being processed",
		Retry:   true,
	}
}

func NewPreviousRequestFailedError() *APIError {
	return &APIError{
		Code:    ErrPreviousRequestFailed,
		Message: "Previous request with this idempotency key failed. Use a new key to retry.",
		Retry:   false,
	}
}

// Streaming error constructors

func NewStreamNotFoundError(streamID string) *APIError {
	return &APIError{
		Code:    ErrStreamNotFound,
		Message: fmt.Sprintf("Stream %s not found", streamID),
		Retry:   false,
	}
}

func NewStreamAmountExceededError(maxAmount string) *APIError {
	return &APIError{
		Code:    ErrStreamAmountExceeded,
		Message: "Stream amount exceeds maximum allowed",
		Details: fmt.Sprintf("Maximum amount: %s", maxAmount),
		Retry:   false,
	}
}

func NewStreamInvalidStateError(currentState, expectedState string) *APIError {
	return &APIError{
		Code:    ErrStreamInvalidState,
		Message: "Invalid stream state for this operation",
		Details: fmt.Sprintf("current=%s, expected=%s", currentState, expectedState),
		Retry:   false,
	}
}

// Intent error constructors

func NewIntentNotFoundError(intentID string) *APIError {
	return &APIError{
		Code:    ErrIntentNotFound,
		Message: fmt.Sprintf("Intent %s not found", intentID),
		Retry:   false,
	}
}

func NewNoRoutesAvailableError(details string) *APIError {
	return &APIError{
		Code:    ErrNoRoutesAvailable,
		Message: "No routes available for this intent",
		Details: details,
		Retry:   true, // Routes may become available later
	}
}

func NewRouteExpiredError() *APIError {
	return &APIError{
		Code:    ErrRouteExpired,
		Message: "Selected route has expired",
		Details: "Please refresh routes and select a new one",
		Retry:   true,
	}
}

func NewIntentInvalidStateError(currentState, expectedState string) *APIError {
	return &APIError{
		Code:    ErrIntentInvalidState,
		Message: "Invalid intent state for this operation",
		Details: fmt.Sprintf("current=%s, expected=%s", currentState, expectedState),
		Retry:   false,
	}
}

// Discovery error constructors

// NewClientError creates a new client error with the specified code and message.
func NewClientError(code ErrorCode, message, details string) *APIError {
	return &APIError{
		Code:    code,
		Message: message,
		Details: details,
		Retry:   false,
	}
}

// NewResourceNotFoundError creates a new resource not found error.
func NewResourceNotFoundError(resourceID string) *APIError {
	return &APIError{
		Code:    ErrResourceNotFound,
		Message: "Resource not found",
		Details: resourceID,
		Retry:   false,
	}
}

// NewResourceAlreadyExistsError creates a new resource already exists error.
func NewResourceAlreadyExistsError(resourceURL string) *APIError {
	return &APIError{
		Code:    ErrResourceAlreadyExists,
		Message: "Resource already exists",
		Details: resourceURL,
		Retry:   false,
	}
}

// NewNotAuthorizedError creates a new not authorized error.
func NewNotAuthorizedError(operation string) *APIError {
	return &APIError{
		Code:    ErrNotAuthorized,
		Message: "Not authorized for this operation",
		Details: operation,
		Retry:   false,
	}
}

// Error is an alias for APIError for backwards compatibility with handlers.
type Error = APIError
