package wdk

import (
	"errors"
	"fmt"
)

// Error codes for WDK operations.
const (
	// ErrorCodeInvalidSeedPhrase indicates an invalid BIP-39 seed phrase.
	ErrorCodeInvalidSeedPhrase = "INVALID_SEED_PHRASE"
	// ErrorCodeSignerNotInitialized indicates the signer hasn't been initialized.
	ErrorCodeSignerNotInitialized = "SIGNER_NOT_INITIALIZED"
	// ErrorCodeInvalidTypedData indicates invalid EIP-712 typed data.
	ErrorCodeInvalidTypedData = "INVALID_TYPED_DATA"
	// ErrorCodeInvalidMessage indicates an invalid message.
	ErrorCodeInvalidMessage = "INVALID_MESSAGE"
	// ErrorCodeSignTypedDataFailed indicates typed data signing failed.
	ErrorCodeSignTypedDataFailed = "SIGN_TYPED_DATA_FAILED"
	// ErrorCodeSignMessageFailed indicates message signing failed.
	ErrorCodeSignMessageFailed = "SIGN_MESSAGE_FAILED"
	// ErrorCodeChainNotConfigured indicates the chain is not configured.
	ErrorCodeChainNotConfigured = "CHAIN_NOT_CONFIGURED"
	// ErrorCodeBalanceFetchFailed indicates balance fetch failed.
	ErrorCodeBalanceFetchFailed = "BALANCE_FETCH_FAILED"
	// ErrorCodeTokenBalanceFetchFailed indicates token balance fetch failed.
	ErrorCodeTokenBalanceFetchFailed = "TOKEN_BALANCE_FETCH_FAILED"
	// ErrorCodeInvalidTokenAddress indicates an invalid token address.
	ErrorCodeInvalidTokenAddress = "INVALID_TOKEN_ADDRESS"
	// ErrorCodeTransactionFailed indicates a transaction failed.
	ErrorCodeTransactionFailed = "TRANSACTION_FAILED"
	// ErrorCodeBridgeFailed indicates a bridge operation failed.
	ErrorCodeBridgeFailed = "BRIDGE_FAILED"
)

// Common errors.
var (
	// ErrInvalidSeedPhrase is returned when the seed phrase is invalid.
	ErrInvalidSeedPhrase = errors.New("invalid BIP-39 seed phrase")
	// ErrSignerNotInitialized is returned when the signer is not initialized.
	ErrSignerNotInitialized = errors.New("signer not initialized")
	// ErrChainNotConfigured is returned when a chain is not configured.
	ErrChainNotConfigured = errors.New("chain not configured")
	// ErrInvalidTypedData is returned when typed data is invalid.
	ErrInvalidTypedData = errors.New("invalid typed data")
)

// WDKError represents a WDK-specific error.
type WDKError struct {
	// Code is the error code.
	Code string `json:"code"`
	// Message is the error message.
	Message string `json:"message"`
	// Chain is the chain name if applicable.
	Chain string `json:"chain,omitempty"`
	// Token is the token address if applicable.
	Token string `json:"token,omitempty"`
	// Operation is the operation that failed.
	Operation string `json:"operation,omitempty"`
	// Cause is the underlying error.
	Cause error `json:"-"`
}

// Error implements the error interface.
func (e *WDKError) Error() string {
	if e.Chain != "" {
		return fmt.Sprintf("[%s] %s (chain: %s)", e.Code, e.Message, e.Chain)
	}
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

// Unwrap returns the underlying error.
func (e *WDKError) Unwrap() error {
	return e.Cause
}

// NewWDKError creates a new WDK error.
func NewWDKError(code, message string) *WDKError {
	return &WDKError{
		Code:    code,
		Message: message,
	}
}

// WithChain adds chain information to the error.
func (e *WDKError) WithChain(chain string) *WDKError {
	e.Chain = chain
	return e
}

// WithToken adds token information to the error.
func (e *WDKError) WithToken(token string) *WDKError {
	e.Token = token
	return e
}

// WithOperation adds operation information to the error.
func (e *WDKError) WithOperation(op string) *WDKError {
	e.Operation = op
	return e
}

// WithCause adds the underlying error.
func (e *WDKError) WithCause(cause error) *WDKError {
	e.Cause = cause
	return e
}

// InitializationError creates an initialization error.
func InitializationError(message string, cause error) *WDKError {
	return &WDKError{
		Code:      ErrorCodeInvalidSeedPhrase,
		Message:   message,
		Operation: "initialize",
		Cause:     cause,
	}
}

// SignerError creates a signer error.
func SignerError(code, message string) *WDKError {
	return &WDKError{
		Code:    code,
		Message: message,
	}
}

// SigningError creates a signing error.
func SigningError(code, message, chain string, cause error) *WDKError {
	return &WDKError{
		Code:      code,
		Message:   message,
		Chain:     chain,
		Operation: "sign",
		Cause:     cause,
	}
}

// ChainError creates a chain-related error.
func ChainError(code, message, chain string) *WDKError {
	return &WDKError{
		Code:    code,
		Message: message,
		Chain:   chain,
	}
}

// BalanceError creates a balance fetch error.
func BalanceError(code, message, chain, token string, cause error) *WDKError {
	return &WDKError{
		Code:      code,
		Message:   message,
		Chain:     chain,
		Token:     token,
		Operation: "balance",
		Cause:     cause,
	}
}

// IsWDKError checks if an error is a WDK error.
func IsWDKError(err error) bool {
	var wdkErr *WDKError
	return errors.As(err, &wdkErr)
}

// GetWDKError extracts a WDK error from an error chain.
func GetWDKError(err error) (*WDKError, bool) {
	var wdkErr *WDKError
	if errors.As(err, &wdkErr) {
		return wdkErr, true
	}
	return nil, false
}
