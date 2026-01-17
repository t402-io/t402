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
	ErrVerificationFailed   ErrorCode = "T402-3001" // Payment verification failed
	ErrSettlementFailed     ErrorCode = "T402-3002" // Payment settlement failed
	ErrInsufficientBalance  ErrorCode = "T402-3003" // Payer has insufficient balance
	ErrAllowanceInsufficient ErrorCode = "T402-3004" // Token allowance insufficient
	ErrPaymentMismatch      ErrorCode = "T402-3005" // Payment doesn't match requirements
	ErrDuplicatePayment     ErrorCode = "T402-3006" // Payment already processed
	ErrSettlementPending    ErrorCode = "T402-3007" // Settlement is pending
	ErrSettlementTimeout    ErrorCode = "T402-3008" // Settlement timed out
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
	switch e.Code[5] { // Check the category digit (1-5)
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
