package t402

import "net/http"

// ErrorCode represents a standardized T402 error code returned by the facilitator API.
// Error codes follow the format T402-XYYY where X is the category (1-8)
// and YYY is the specific error within that category.
type ErrorCode string

// Client Errors (T402-1xxx): Invalid input, malformed requests
const (
	ErrInvalidRequest        ErrorCode = "T402-1001"
	ErrMissingPayload        ErrorCode = "T402-1002"
	ErrMissingRequirements   ErrorCode = "T402-1003"
	ErrInvalidPayload        ErrorCode = "T402-1004"
	ErrInvalidRequirements   ErrorCode = "T402-1005"
	ErrInvalidSignature      ErrorCode = "T402-1006"
	ErrInvalidNetwork        ErrorCode = "T402-1007"
	ErrInvalidScheme         ErrorCode = "T402-1008"
	ErrInvalidAmount         ErrorCode = "T402-1009"
	ErrInvalidAddress        ErrorCode = "T402-1010"
	ErrExpiredPayment        ErrorCode = "T402-1011"
	ErrInvalidNonce          ErrorCode = "T402-1012"
	ErrInsufficientAmount    ErrorCode = "T402-1013"
	ErrInvalidIdempotencyKey ErrorCode = "T402-1014"
	ErrSignatureExpired      ErrorCode = "T402-1015"
)

// Server Errors (T402-2xxx): Internal failures, dependency issues
const (
	ErrInternal            ErrorCode = "T402-2001"
	ErrDatabaseUnavailable ErrorCode = "T402-2002"
	ErrCacheUnavailable    ErrorCode = "T402-2003"
	ErrRPCUnavailable      ErrorCode = "T402-2004"
	ErrRateLimited         ErrorCode = "T402-2005"
	ErrServiceUnavailable  ErrorCode = "T402-2006"
)

// Facilitator Errors (T402-3xxx): Verification and settlement failures
const (
	ErrVerificationFailed     ErrorCode = "T402-3001"
	ErrSettlementFailed       ErrorCode = "T402-3002"
	ErrInsufficientBalance    ErrorCode = "T402-3003"
	ErrAllowanceInsufficient  ErrorCode = "T402-3004"
	ErrPaymentMismatch        ErrorCode = "T402-3005"
	ErrDuplicatePayment       ErrorCode = "T402-3006"
	ErrSettlementPending      ErrorCode = "T402-3007"
	ErrSettlementTimeout      ErrorCode = "T402-3008"
	ErrNonceReplay            ErrorCode = "T402-3009"
	ErrIdempotencyConflict    ErrorCode = "T402-3010"
	ErrIdempotencyUnavailable ErrorCode = "T402-3011"
	ErrPreviousRequestFailed  ErrorCode = "T402-3012"
	ErrRequestInProgress      ErrorCode = "T402-3013"
)

// Chain-Specific Errors (T402-4xxx): Network and transaction issues
const (
	ErrChainUnavailable    ErrorCode = "T402-4001"
	ErrTransactionFailed   ErrorCode = "T402-4002"
	ErrTransactionReverted ErrorCode = "T402-4003"
	ErrGasEstimationFailed ErrorCode = "T402-4004"
	ErrNonceConflict       ErrorCode = "T402-4005"
	ErrChainCongested      ErrorCode = "T402-4006"
	ErrContractError       ErrorCode = "T402-4007"
)

// Bridge Errors (T402-5xxx): Cross-chain operation failures
const (
	ErrBridgeUnavailable    ErrorCode = "T402-5001"
	ErrBridgeQuoteFailed    ErrorCode = "T402-5002"
	ErrBridgeTransferFailed ErrorCode = "T402-5003"
	ErrBridgeTimeout        ErrorCode = "T402-5004"
	ErrUnsupportedRoute     ErrorCode = "T402-5005"
)

// Streaming Errors (T402-6xxx): Payment stream issues
const (
	ErrStreamNotFound       ErrorCode = "T402-6001"
	ErrStreamAlreadyClosed  ErrorCode = "T402-6002"
	ErrStreamAlreadyPaused  ErrorCode = "T402-6003"
	ErrStreamNotPaused      ErrorCode = "T402-6004"
	ErrStreamAmountExceeded ErrorCode = "T402-6005"
	ErrStreamExpired        ErrorCode = "T402-6006"
	ErrStreamInvalidState   ErrorCode = "T402-6007"
	ErrStreamRateLimited    ErrorCode = "T402-6008"
)

// Intent Errors (T402-7xxx): Payment intent issues
const (
	ErrIntentNotFound        ErrorCode = "T402-7001"
	ErrIntentAlreadyExecuted ErrorCode = "T402-7002"
	ErrIntentCancelled       ErrorCode = "T402-7003"
	ErrIntentExpired         ErrorCode = "T402-7004"
	ErrNoRoutesAvailable     ErrorCode = "T402-7005"
	ErrRouteExpired          ErrorCode = "T402-7006"
	ErrRouteNotSelected      ErrorCode = "T402-7007"
	ErrIntentInvalidState    ErrorCode = "T402-7008"
)

// Discovery Errors (T402-8xxx): Resource marketplace issues
const (
	ErrResourceNotFound      ErrorCode = "T402-8001"
	ErrResourceAlreadyExists ErrorCode = "T402-8002"
	ErrInvalidParameters     ErrorCode = "T402-8003"
	ErrNotAuthorized         ErrorCode = "T402-8004"
)

// APIError represents a structured error response from the facilitator API.
type APIError struct {
	Code    ErrorCode `json:"code"`
	Message string    `json:"message"`
	Details string    `json:"details,omitempty"`
	Retry   bool      `json:"retry,omitempty"`
}

// Error implements the error interface.
func (e *APIError) Error() string {
	if e.Details != "" {
		return "[" + string(e.Code) + "] " + e.Message + ": " + e.Details
	}
	return "[" + string(e.Code) + "] " + e.Message
}

// HTTPStatus returns the expected HTTP status code for this error code.
func (e *APIError) HTTPStatus() int {
	if len(e.Code) < 6 {
		return http.StatusInternalServerError
	}
	switch e.Code[5] {
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

// IsRetryable returns whether the client should retry this error.
func (e *APIError) IsRetryable() bool {
	return e.Retry
}

// Category returns the error category number (1-8).
func (c ErrorCode) Category() byte {
	if len(c) >= 6 {
		return c[5]
	}
	return 0
}

// IsClientError returns true for T402-1xxx errors.
func (c ErrorCode) IsClientError() bool { return c.Category() == '1' }

// IsServerError returns true for T402-2xxx errors.
func (c ErrorCode) IsServerError() bool { return c.Category() == '2' }

// IsFacilitatorError returns true for T402-3xxx errors.
func (c ErrorCode) IsFacilitatorError() bool { return c.Category() == '3' }

// IsChainError returns true for T402-4xxx errors.
func (c ErrorCode) IsChainError() bool { return c.Category() == '4' }

// IsBridgeError returns true for T402-5xxx errors.
func (c ErrorCode) IsBridgeError() bool { return c.Category() == '5' }
