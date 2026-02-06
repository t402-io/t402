package hardware

import "context"

// TrezorWallet is a placeholder implementation of the HardwareWallet interface
// for Trezor devices. All signing and connection methods return ErrNotConnected
// or ErrNotSupported because real USB HID transport is deferred.
type TrezorWallet struct {
	status DeviceStatus
	info   *DeviceInfo
}

// NewTrezorWallet creates a new TrezorWallet stub.
func NewTrezorWallet() *TrezorWallet {
	return &TrezorWallet{
		status: StatusDisconnected,
		info: &DeviceInfo{
			Type:     Trezor,
			IsLocked: true,
			Status:   StatusDisconnected,
		},
	}
}

// Type returns the hardware wallet type.
func (t *TrezorWallet) Type() HardwareWalletType {
	return Trezor
}

// Status returns the current device status.
func (t *TrezorWallet) Status() DeviceStatus {
	return t.status
}

// DeviceInfo returns metadata about the device.
func (t *TrezorWallet) DeviceInfo() *DeviceInfo {
	if t.info == nil {
		return nil
	}
	// Return a copy to prevent mutation.
	cp := *t.info
	return &cp
}

// IsConnected returns true if the device is connected and ready.
func (t *TrezorWallet) IsConnected() bool {
	return t.status == StatusReady
}

// Connect attempts to connect to the Trezor device.
// This stub always returns ErrNotSupported because USB HID is not implemented.
func (t *TrezorWallet) Connect(_ context.Context) error {
	return NewHardwareWalletError(
		ErrCodeNotSupported,
		"Trezor USB transport not implemented; use MockHardwareWallet for testing",
		Trezor,
	).WithCause(ErrNotSupported)
}

// Disconnect closes the connection to the Trezor device.
// This stub returns nil since there is nothing to disconnect.
func (t *TrezorWallet) Disconnect() error {
	return nil
}

// GetAddress retrieves an address from the Trezor device.
// This stub returns ErrNotConnected.
func (t *TrezorWallet) GetAddress(_ context.Context, _ string) (string, error) {
	return "", NewHardwareWalletError(
		ErrCodeNotConnected,
		"Trezor device not connected",
		Trezor,
	).WithCause(ErrNotConnected)
}

// GetAddresses retrieves multiple addresses from the Trezor device.
// This stub returns ErrNotConnected.
func (t *TrezorWallet) GetAddresses(_ context.Context, _ string, _ int) ([]string, error) {
	return nil, NewHardwareWalletError(
		ErrCodeNotConnected,
		"Trezor device not connected",
		Trezor,
	).WithCause(ErrNotConnected)
}

// SignTypedData signs EIP-712 typed data using the Trezor device.
// This stub returns ErrNotConnected.
func (t *TrezorWallet) SignTypedData(_ context.Context, _ string, _ []byte) ([]byte, error) {
	return nil, NewHardwareWalletError(
		ErrCodeNotConnected,
		"Trezor device not connected",
		Trezor,
	).WithCause(ErrNotConnected)
}

// SignMessage signs a personal message using the Trezor device.
// This stub returns ErrNotConnected.
func (t *TrezorWallet) SignMessage(_ context.Context, _ string, _ []byte) ([]byte, error) {
	return nil, NewHardwareWalletError(
		ErrCodeNotConnected,
		"Trezor device not connected",
		Trezor,
	).WithCause(ErrNotConnected)
}

// Compile-time interface check.
var _ HardwareWallet = (*TrezorWallet)(nil)
