// Package hardware provides hardware wallet types and interfaces for the T402 WDK.
//
// This package defines the HardwareWallet interface that Ledger and Trezor
// implementations must satisfy, along with error types and device metadata.
// Real USB HID transport is deferred; this package provides types, stub
// implementations, and a configurable mock for testing.
package hardware

import (
	"context"
	"errors"
	"fmt"
)

// HardwareWalletType identifies the hardware wallet manufacturer.
type HardwareWalletType string

const (
	// Ledger represents Ledger hardware wallets (Nano S, Nano S Plus, Nano X, Stax).
	Ledger HardwareWalletType = "ledger"
	// Trezor represents Trezor hardware wallets (One, Model T, Safe 3).
	Trezor HardwareWalletType = "trezor"
)

// DeviceStatus represents the current state of a hardware wallet device.
type DeviceStatus string

const (
	// StatusDisconnected indicates no device connection.
	StatusDisconnected DeviceStatus = "disconnected"
	// StatusConnecting indicates a connection is in progress.
	StatusConnecting DeviceStatus = "connecting"
	// StatusConnected indicates the device is connected but not fully ready.
	StatusConnected DeviceStatus = "connected"
	// StatusLocked indicates the device is connected but locked (PIN required).
	StatusLocked DeviceStatus = "locked"
	// StatusUnlocked indicates the device is unlocked but the app may not be open.
	StatusUnlocked DeviceStatus = "unlocked"
	// StatusAppClosed indicates the required app is not open on the device.
	StatusAppClosed DeviceStatus = "app_closed"
	// StatusReady indicates the device is connected, unlocked, and ready to sign.
	StatusReady DeviceStatus = "ready"
)

// DeviceInfo contains metadata about a connected hardware wallet device.
type DeviceInfo struct {
	// Type is the hardware wallet type (ledger or trezor).
	Type HardwareWalletType `json:"type"`
	// Name is the device name.
	Name string `json:"name,omitempty"`
	// Model is the device model (e.g., "Nano S", "Nano X", "Model T").
	Model string `json:"model,omitempty"`
	// FirmwareVersion is the device firmware version string.
	FirmwareVersion string `json:"firmwareVersion,omitempty"`
	// AppName is the name of the currently open app (e.g., "Ethereum").
	AppName string `json:"appName,omitempty"`
	// AppVersion is the version of the currently open app.
	AppVersion string `json:"appVersion,omitempty"`
	// IsLocked indicates whether the device is locked.
	IsLocked bool `json:"isLocked"`
	// Status is the current device status.
	Status DeviceStatus `json:"status"`
}

// ConnectionOptions contains options for connecting to a hardware wallet.
type ConnectionOptions struct {
	// AccountIndex is the HD derivation account index (default: 0).
	AccountIndex int
	// DerivationPath overrides the default derivation path.
	// Default: m/44'/60'/0'/0/{AccountIndex}
	DerivationPath string
	// Timeout is the connection timeout in milliseconds (default: 30000).
	Timeout int
}

// DefaultConnectionOptions returns connection options with sensible defaults.
func DefaultConnectionOptions() ConnectionOptions {
	return ConnectionOptions{
		AccountIndex: 0,
		Timeout:      30000,
	}
}

// HardwareWallet is the interface that hardware wallet implementations must satisfy.
//
// It provides methods for connecting, disconnecting, retrieving addresses,
// and signing data using a hardware wallet device.
type HardwareWallet interface {
	// Type returns the hardware wallet type (ledger or trezor).
	Type() HardwareWalletType

	// Status returns the current device status.
	Status() DeviceStatus

	// DeviceInfo returns metadata about the connected device, or nil if not connected.
	DeviceInfo() *DeviceInfo

	// IsConnected returns true if the device is connected and ready to sign.
	IsConnected() bool

	// Connect establishes a connection to the hardware wallet device.
	// The context can be used for cancellation and timeout.
	Connect(ctx context.Context) error

	// Disconnect closes the connection to the hardware wallet device.
	Disconnect() error

	// GetAddress retrieves an Ethereum address for the given derivation path.
	// If derivationPath is empty, the default path is used.
	GetAddress(ctx context.Context, derivationPath string) (string, error)

	// GetAddresses retrieves multiple sequential addresses starting from the given derivation path.
	// If derivationPath is empty, the default base path (m/44'/60'/0'/0) is used.
	// Count specifies how many addresses to return.
	GetAddresses(ctx context.Context, derivationPath string, count int) ([]string, error)

	// SignTypedData signs EIP-712 typed data and returns the signature bytes.
	// The address parameter identifies which account on the device should sign.
	// The typedData parameter is the JSON-encoded EIP-712 typed data.
	SignTypedData(ctx context.Context, address string, typedData []byte) ([]byte, error)

	// SignMessage signs a personal message and returns the signature bytes.
	// The address parameter identifies which account on the device should sign.
	// The message parameter is the raw message bytes.
	SignMessage(ctx context.Context, address string, message []byte) ([]byte, error)
}

// ErrorCode identifies the category of a hardware wallet error.
type ErrorCode string

const (
	// ErrCodeDeviceNotFound indicates no hardware wallet device was detected.
	ErrCodeDeviceNotFound ErrorCode = "DEVICE_NOT_FOUND"
	// ErrCodeConnectionFailed indicates the connection to the device failed.
	ErrCodeConnectionFailed ErrorCode = "CONNECTION_FAILED"
	// ErrCodeDeviceLocked indicates the device is locked and requires PIN entry.
	ErrCodeDeviceLocked ErrorCode = "DEVICE_LOCKED"
	// ErrCodeAppNotOpen indicates the required app is not open on the device.
	ErrCodeAppNotOpen ErrorCode = "APP_NOT_OPEN"
	// ErrCodeTransportError indicates a USB/HID transport error.
	ErrCodeTransportError ErrorCode = "TRANSPORT_ERROR"
	// ErrCodeUserRejected indicates the user rejected the operation on the device.
	ErrCodeUserRejected ErrorCode = "USER_REJECTED"
	// ErrCodeSigningFailed indicates signing failed on the device.
	ErrCodeSigningFailed ErrorCode = "SIGNING_FAILED"
	// ErrCodeInvalidData indicates the data provided for signing is invalid.
	ErrCodeInvalidData ErrorCode = "INVALID_DATA"
	// ErrCodeNotSupported indicates the operation is not supported.
	ErrCodeNotSupported ErrorCode = "NOT_SUPPORTED"
	// ErrCodeTimeout indicates the operation timed out.
	ErrCodeTimeout ErrorCode = "TIMEOUT"
	// ErrCodeNotConnected indicates the device is not connected.
	ErrCodeNotConnected ErrorCode = "NOT_CONNECTED"
	// ErrCodeUnknown indicates an unknown error occurred.
	ErrCodeUnknown ErrorCode = "UNKNOWN_ERROR"
)

// Common sentinel errors for quick checking.
var (
	// ErrNotConnected is returned when an operation requires a connected device.
	ErrNotConnected = errors.New("hardware wallet not connected")
	// ErrNotSupported is returned when an operation is not implemented.
	ErrNotSupported = errors.New("operation not supported: real USB HID transport not implemented")
)

// HardwareWalletError represents an error from a hardware wallet operation.
type HardwareWalletError struct {
	// Code categorizes the error.
	Code ErrorCode `json:"code"`
	// Message is the human-readable error description.
	Message string `json:"message"`
	// WalletType identifies which wallet type produced the error.
	WalletType HardwareWalletType `json:"walletType"`
	// Err is the underlying error, if any.
	Err error `json:"-"`
}

// Error implements the error interface.
func (e *HardwareWalletError) Error() string {
	if e.WalletType != "" {
		return fmt.Sprintf("[%s:%s] %s", e.WalletType, e.Code, e.Message)
	}
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

// Unwrap returns the underlying error for errors.Is/As support.
func (e *HardwareWalletError) Unwrap() error {
	return e.Err
}

// NewHardwareWalletError creates a new HardwareWalletError.
func NewHardwareWalletError(code ErrorCode, message string, walletType HardwareWalletType) *HardwareWalletError {
	return &HardwareWalletError{
		Code:       code,
		Message:    message,
		WalletType: walletType,
	}
}

// WithCause attaches an underlying error to the HardwareWalletError.
func (e *HardwareWalletError) WithCause(err error) *HardwareWalletError {
	e.Err = err
	return e
}

// IsHardwareWalletError checks if an error is a HardwareWalletError.
func IsHardwareWalletError(err error) bool {
	var hwErr *HardwareWalletError
	return errors.As(err, &hwErr)
}

// GetHardwareWalletError extracts a HardwareWalletError from an error chain.
func GetHardwareWalletError(err error) (*HardwareWalletError, bool) {
	var hwErr *HardwareWalletError
	if errors.As(err, &hwErr) {
		return hwErr, true
	}
	return nil, false
}
