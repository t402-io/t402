package hardware

import (
	"context"
	"fmt"
	"sync"
)

// MockHardwareWallet is a configurable mock implementation of the HardwareWallet
// interface, designed for testing T402 payment flows that require hardware wallet
// signing without actual USB device access.
//
// All responses and errors can be pre-configured using the Set* and With* methods.
type MockHardwareWallet struct {
	mu sync.RWMutex

	walletType HardwareWalletType
	status     DeviceStatus
	info       *DeviceInfo

	// Configurable responses.
	addresses    []string
	signResponse []byte

	// Configurable errors.
	connectErr     error
	disconnectErr  error
	getAddressErr  error
	signTypedErr   error
	signMessageErr error

	// Call tracking.
	connectCalls     int
	disconnectCalls  int
	getAddressCalls  int
	signTypedCalls   int
	signMessageCalls int
}

// NewMockHardwareWallet creates a new MockHardwareWallet with the specified type.
// The mock starts in the disconnected state with no configured responses.
func NewMockHardwareWallet(walletType HardwareWalletType) *MockHardwareWallet {
	return &MockHardwareWallet{
		walletType: walletType,
		status:     StatusDisconnected,
		info: &DeviceInfo{
			Type:     walletType,
			IsLocked: true,
			Status:   StatusDisconnected,
		},
	}
}

// --- Configuration methods (call before using the mock) ---

// SetAddresses configures the addresses the mock will return from GetAddress
// and GetAddresses. The first address is used for single-address requests.
func (m *MockHardwareWallet) SetAddresses(addresses []string) *MockHardwareWallet {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.addresses = addresses
	return m
}

// SetSignResponse configures the signature bytes the mock returns from
// SignTypedData and SignMessage.
func (m *MockHardwareWallet) SetSignResponse(sig []byte) *MockHardwareWallet {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.signResponse = sig
	return m
}

// SetDeviceInfo overrides the default DeviceInfo returned by the mock.
func (m *MockHardwareWallet) SetDeviceInfo(info *DeviceInfo) *MockHardwareWallet {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.info = info
	return m
}

// WithConnectError configures an error to return from Connect.
func (m *MockHardwareWallet) WithConnectError(err error) *MockHardwareWallet {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.connectErr = err
	return m
}

// WithDisconnectError configures an error to return from Disconnect.
func (m *MockHardwareWallet) WithDisconnectError(err error) *MockHardwareWallet {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.disconnectErr = err
	return m
}

// WithGetAddressError configures an error to return from GetAddress/GetAddresses.
func (m *MockHardwareWallet) WithGetAddressError(err error) *MockHardwareWallet {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.getAddressErr = err
	return m
}

// WithSignTypedDataError configures an error to return from SignTypedData.
func (m *MockHardwareWallet) WithSignTypedDataError(err error) *MockHardwareWallet {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.signTypedErr = err
	return m
}

// WithSignMessageError configures an error to return from SignMessage.
func (m *MockHardwareWallet) WithSignMessageError(err error) *MockHardwareWallet {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.signMessageErr = err
	return m
}

// --- HardwareWallet interface implementation ---

// Type returns the wallet type.
func (m *MockHardwareWallet) Type() HardwareWalletType {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.walletType
}

// Status returns the current mock status.
func (m *MockHardwareWallet) Status() DeviceStatus {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.status
}

// DeviceInfo returns a copy of the device info.
func (m *MockHardwareWallet) DeviceInfo() *DeviceInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.info == nil {
		return nil
	}
	cp := *m.info
	return &cp
}

// IsConnected returns true if the mock is in the ready state.
func (m *MockHardwareWallet) IsConnected() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.status == StatusReady
}

// Connect simulates connecting to the hardware wallet.
// Returns the configured connect error, or transitions to StatusReady.
func (m *MockHardwareWallet) Connect(_ context.Context) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.connectCalls++

	if m.connectErr != nil {
		return m.connectErr
	}

	m.status = StatusReady
	m.info.Status = StatusReady
	m.info.IsLocked = false
	return nil
}

// Disconnect simulates disconnecting from the hardware wallet.
// Returns the configured disconnect error, or transitions to StatusDisconnected.
func (m *MockHardwareWallet) Disconnect() error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.disconnectCalls++

	if m.disconnectErr != nil {
		return m.disconnectErr
	}

	m.status = StatusDisconnected
	m.info.Status = StatusDisconnected
	m.info.IsLocked = true
	return nil
}

// GetAddress returns the first configured address, or the configured error.
func (m *MockHardwareWallet) GetAddress(_ context.Context, _ string) (string, error) {
	m.mu.Lock()
	m.getAddressCalls++
	m.mu.Unlock()

	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.status != StatusReady {
		return "", NewHardwareWalletError(
			ErrCodeNotConnected,
			fmt.Sprintf("%s device not connected", m.walletType),
			m.walletType,
		).WithCause(ErrNotConnected)
	}

	if m.getAddressErr != nil {
		return "", m.getAddressErr
	}

	if len(m.addresses) == 0 {
		return "", NewHardwareWalletError(
			ErrCodeDeviceNotFound,
			"no addresses configured on mock",
			m.walletType,
		)
	}

	return m.addresses[0], nil
}

// GetAddresses returns up to count configured addresses, or the configured error.
func (m *MockHardwareWallet) GetAddresses(_ context.Context, _ string, count int) ([]string, error) {
	m.mu.Lock()
	m.getAddressCalls++
	m.mu.Unlock()

	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.status != StatusReady {
		return nil, NewHardwareWalletError(
			ErrCodeNotConnected,
			fmt.Sprintf("%s device not connected", m.walletType),
			m.walletType,
		).WithCause(ErrNotConnected)
	}

	if m.getAddressErr != nil {
		return nil, m.getAddressErr
	}

	if count <= 0 {
		return []string{}, nil
	}

	end := count
	if end > len(m.addresses) {
		end = len(m.addresses)
	}

	result := make([]string, end)
	copy(result, m.addresses[:end])
	return result, nil
}

// SignTypedData returns the configured sign response or error.
func (m *MockHardwareWallet) SignTypedData(_ context.Context, _ string, _ []byte) ([]byte, error) {
	m.mu.Lock()
	m.signTypedCalls++
	m.mu.Unlock()

	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.status != StatusReady {
		return nil, NewHardwareWalletError(
			ErrCodeNotConnected,
			fmt.Sprintf("%s device not connected", m.walletType),
			m.walletType,
		).WithCause(ErrNotConnected)
	}

	if m.signTypedErr != nil {
		return nil, m.signTypedErr
	}

	if m.signResponse == nil {
		return nil, NewHardwareWalletError(
			ErrCodeSigningFailed,
			"no sign response configured on mock",
			m.walletType,
		)
	}

	sig := make([]byte, len(m.signResponse))
	copy(sig, m.signResponse)
	return sig, nil
}

// SignMessage returns the configured sign response or error.
func (m *MockHardwareWallet) SignMessage(_ context.Context, _ string, _ []byte) ([]byte, error) {
	m.mu.Lock()
	m.signMessageCalls++
	m.mu.Unlock()

	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.status != StatusReady {
		return nil, NewHardwareWalletError(
			ErrCodeNotConnected,
			fmt.Sprintf("%s device not connected", m.walletType),
			m.walletType,
		).WithCause(ErrNotConnected)
	}

	if m.signMessageErr != nil {
		return nil, m.signMessageErr
	}

	if m.signResponse == nil {
		return nil, NewHardwareWalletError(
			ErrCodeSigningFailed,
			"no sign response configured on mock",
			m.walletType,
		)
	}

	sig := make([]byte, len(m.signResponse))
	copy(sig, m.signResponse)
	return sig, nil
}

// --- Call-count accessors (for test assertions) ---

// ConnectCalls returns the number of times Connect was called.
func (m *MockHardwareWallet) ConnectCalls() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.connectCalls
}

// DisconnectCalls returns the number of times Disconnect was called.
func (m *MockHardwareWallet) DisconnectCalls() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.disconnectCalls
}

// GetAddressCalls returns the number of times GetAddress or GetAddresses was called.
func (m *MockHardwareWallet) GetAddressCalls() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.getAddressCalls
}

// SignTypedDataCalls returns the number of times SignTypedData was called.
func (m *MockHardwareWallet) SignTypedDataCalls() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.signTypedCalls
}

// SignMessageCalls returns the number of times SignMessage was called.
func (m *MockHardwareWallet) SignMessageCalls() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.signMessageCalls
}

// Compile-time interface check.
var _ HardwareWallet = (*MockHardwareWallet)(nil)
