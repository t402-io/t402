package hardware

import "context"

// DefaultDerivationPath is the default Ethereum HD derivation base path.
const DefaultDerivationPath = "m/44'/60'/0'/0"

// LedgerWallet is a placeholder implementation of the HardwareWallet interface
// for Ledger devices. All signing and connection methods return ErrNotConnected
// or ErrNotSupported because real USB HID transport is deferred.
type LedgerWallet struct {
	status DeviceStatus
	info   *DeviceInfo
}

// NewLedgerWallet creates a new LedgerWallet stub.
func NewLedgerWallet() *LedgerWallet {
	return &LedgerWallet{
		status: StatusDisconnected,
		info: &DeviceInfo{
			Type:     Ledger,
			IsLocked: true,
			Status:   StatusDisconnected,
		},
	}
}

// Type returns the hardware wallet type.
func (l *LedgerWallet) Type() HardwareWalletType {
	return Ledger
}

// Status returns the current device status.
func (l *LedgerWallet) Status() DeviceStatus {
	return l.status
}

// DeviceInfo returns metadata about the device.
func (l *LedgerWallet) DeviceInfo() *DeviceInfo {
	if l.info == nil {
		return nil
	}
	// Return a copy to prevent mutation.
	cp := *l.info
	return &cp
}

// IsConnected returns true if the device is connected and ready.
func (l *LedgerWallet) IsConnected() bool {
	return l.status == StatusReady
}

// Connect attempts to connect to the Ledger device.
// This stub always returns ErrNotSupported because USB HID is not implemented.
func (l *LedgerWallet) Connect(_ context.Context) error {
	return NewHardwareWalletError(
		ErrCodeNotSupported,
		"Ledger USB HID transport not implemented; use MockHardwareWallet for testing",
		Ledger,
	).WithCause(ErrNotSupported)
}

// Disconnect closes the connection to the Ledger device.
// This stub returns nil since there is nothing to disconnect.
func (l *LedgerWallet) Disconnect() error {
	return nil
}

// GetAddress retrieves an address from the Ledger device.
// This stub returns ErrNotConnected.
func (l *LedgerWallet) GetAddress(_ context.Context, _ string) (string, error) {
	return "", NewHardwareWalletError(
		ErrCodeNotConnected,
		"Ledger device not connected",
		Ledger,
	).WithCause(ErrNotConnected)
}

// GetAddresses retrieves multiple addresses from the Ledger device.
// This stub returns ErrNotConnected.
func (l *LedgerWallet) GetAddresses(_ context.Context, _ string, _ int) ([]string, error) {
	return nil, NewHardwareWalletError(
		ErrCodeNotConnected,
		"Ledger device not connected",
		Ledger,
	).WithCause(ErrNotConnected)
}

// SignTypedData signs EIP-712 typed data using the Ledger device.
// This stub returns ErrNotConnected.
func (l *LedgerWallet) SignTypedData(_ context.Context, _ string, _ []byte) ([]byte, error) {
	return nil, NewHardwareWalletError(
		ErrCodeNotConnected,
		"Ledger device not connected",
		Ledger,
	).WithCause(ErrNotConnected)
}

// SignMessage signs a personal message using the Ledger device.
// This stub returns ErrNotConnected.
func (l *LedgerWallet) SignMessage(_ context.Context, _ string, _ []byte) ([]byte, error) {
	return nil, NewHardwareWalletError(
		ErrCodeNotConnected,
		"Ledger device not connected",
		Ledger,
	).WithCause(ErrNotConnected)
}

// Compile-time interface check.
var _ HardwareWallet = (*LedgerWallet)(nil)
