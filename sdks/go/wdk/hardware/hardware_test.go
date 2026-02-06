package hardware

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Mock: Connect / Disconnect
// ---------------------------------------------------------------------------

func TestMockConnectDisconnect(t *testing.T) {
	mock := NewMockHardwareWallet(Ledger)
	ctx := context.Background()

	// Initially disconnected.
	assert.Equal(t, StatusDisconnected, mock.Status())
	assert.False(t, mock.IsConnected())
	assert.Equal(t, 0, mock.ConnectCalls())

	// Connect.
	err := mock.Connect(ctx)
	require.NoError(t, err)
	assert.Equal(t, StatusReady, mock.Status())
	assert.True(t, mock.IsConnected())
	assert.Equal(t, 1, mock.ConnectCalls())

	// DeviceInfo reflects ready state.
	info := mock.DeviceInfo()
	require.NotNil(t, info)
	assert.Equal(t, StatusReady, info.Status)
	assert.False(t, info.IsLocked)

	// Disconnect.
	err = mock.Disconnect()
	require.NoError(t, err)
	assert.Equal(t, StatusDisconnected, mock.Status())
	assert.False(t, mock.IsConnected())
	assert.Equal(t, 1, mock.DisconnectCalls())

	// DeviceInfo reflects disconnected state.
	info = mock.DeviceInfo()
	require.NotNil(t, info)
	assert.Equal(t, StatusDisconnected, info.Status)
	assert.True(t, info.IsLocked)
}

func TestMockConnectError(t *testing.T) {
	connectErr := NewHardwareWalletError(ErrCodeDeviceNotFound, "no device", Ledger)
	mock := NewMockHardwareWallet(Ledger).WithConnectError(connectErr)
	ctx := context.Background()

	err := mock.Connect(ctx)
	require.Error(t, err)
	assert.Equal(t, StatusDisconnected, mock.Status())

	var hwErr *HardwareWalletError
	require.True(t, errors.As(err, &hwErr))
	assert.Equal(t, ErrCodeDeviceNotFound, hwErr.Code)
}

func TestMockDisconnectError(t *testing.T) {
	disconnectErr := errors.New("usb disconnect failed")
	mock := NewMockHardwareWallet(Trezor).WithDisconnectError(disconnectErr)
	ctx := context.Background()

	// Connect first.
	require.NoError(t, mock.Connect(ctx))
	assert.True(t, mock.IsConnected())

	// Disconnect should return the configured error.
	err := mock.Disconnect()
	require.Error(t, err)
	assert.Equal(t, "usb disconnect failed", err.Error())
}

// ---------------------------------------------------------------------------
// Mock: GetAddress
// ---------------------------------------------------------------------------

func TestMockGetAddress(t *testing.T) {
	mock := NewMockHardwareWallet(Ledger).
		SetAddresses([]string{
			"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			"0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
			"0xcccccccccccccccccccccccccccccccccccccccc",
		})
	ctx := context.Background()

	// Must be connected first.
	_, err := mock.GetAddress(ctx, "m/44'/60'/0'/0/0")
	require.Error(t, err)
	assert.True(t, IsHardwareWalletError(err))

	// Connect and get address.
	require.NoError(t, mock.Connect(ctx))
	addr, err := mock.GetAddress(ctx, "m/44'/60'/0'/0/0")
	require.NoError(t, err)
	assert.Equal(t, "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", addr)
}

func TestMockGetAddresses(t *testing.T) {
	allAddresses := []string{
		"0x1111111111111111111111111111111111111111",
		"0x2222222222222222222222222222222222222222",
		"0x3333333333333333333333333333333333333333",
		"0x4444444444444444444444444444444444444444",
		"0x5555555555555555555555555555555555555555",
	}
	mock := NewMockHardwareWallet(Trezor).SetAddresses(allAddresses)
	ctx := context.Background()

	require.NoError(t, mock.Connect(ctx))

	// Request exactly the count available.
	addrs, err := mock.GetAddresses(ctx, DefaultDerivationPath, 5)
	require.NoError(t, err)
	assert.Len(t, addrs, 5)
	assert.Equal(t, allAddresses, addrs)

	// Request more than available; should return what's there.
	addrs, err = mock.GetAddresses(ctx, DefaultDerivationPath, 10)
	require.NoError(t, err)
	assert.Len(t, addrs, 5)

	// Request fewer.
	addrs, err = mock.GetAddresses(ctx, DefaultDerivationPath, 2)
	require.NoError(t, err)
	assert.Len(t, addrs, 2)
	assert.Equal(t, allAddresses[:2], addrs)

	// Request zero.
	addrs, err = mock.GetAddresses(ctx, DefaultDerivationPath, 0)
	require.NoError(t, err)
	assert.Len(t, addrs, 0)
}

func TestMockGetAddressNoAddressesConfigured(t *testing.T) {
	mock := NewMockHardwareWallet(Ledger)
	ctx := context.Background()

	require.NoError(t, mock.Connect(ctx))
	_, err := mock.GetAddress(ctx, "")
	require.Error(t, err)

	var hwErr *HardwareWalletError
	require.True(t, errors.As(err, &hwErr))
	assert.Equal(t, ErrCodeDeviceNotFound, hwErr.Code)
}

func TestMockGetAddressError(t *testing.T) {
	addrErr := NewHardwareWalletError(ErrCodeAppNotOpen, "open Ethereum app", Ledger)
	mock := NewMockHardwareWallet(Ledger).
		SetAddresses([]string{"0xabc"}).
		WithGetAddressError(addrErr)
	ctx := context.Background()

	require.NoError(t, mock.Connect(ctx))
	_, err := mock.GetAddress(ctx, "")
	require.Error(t, err)

	var hwErr *HardwareWalletError
	require.True(t, errors.As(err, &hwErr))
	assert.Equal(t, ErrCodeAppNotOpen, hwErr.Code)
}

// ---------------------------------------------------------------------------
// Mock: SignTypedData
// ---------------------------------------------------------------------------

func TestMockSignTypedData(t *testing.T) {
	expectedSig := []byte{0xde, 0xad, 0xbe, 0xef, 0x01, 0x02, 0x03}
	mock := NewMockHardwareWallet(Ledger).
		SetAddresses([]string{"0xabc"}).
		SetSignResponse(expectedSig)
	ctx := context.Background()

	// Not connected should fail.
	_, err := mock.SignTypedData(ctx, "0xabc", []byte(`{"domain":{}}`))
	require.Error(t, err)
	assert.Equal(t, 1, mock.SignTypedDataCalls()) // counted even when not connected

	// Connect and sign.
	require.NoError(t, mock.Connect(ctx))
	sig, err := mock.SignTypedData(ctx, "0xabc", []byte(`{"domain":{},"types":{},"primaryType":"Test","message":{}}`))
	require.NoError(t, err)
	assert.Equal(t, expectedSig, sig)
	assert.Equal(t, 2, mock.SignTypedDataCalls())

	// Returned slice is a copy, not the same backing array.
	sig[0] = 0x00
	sig2, err := mock.SignTypedData(ctx, "0xabc", []byte(`{}`))
	require.NoError(t, err)
	assert.Equal(t, byte(0xde), sig2[0], "mock should return independent copies")
}

func TestMockSignTypedDataError(t *testing.T) {
	signErr := NewHardwareWalletError(ErrCodeUserRejected, "user rejected on device", Ledger)
	mock := NewMockHardwareWallet(Ledger).
		SetSignResponse([]byte{0x01}).
		WithSignTypedDataError(signErr)
	ctx := context.Background()

	require.NoError(t, mock.Connect(ctx))
	_, err := mock.SignTypedData(ctx, "0xabc", []byte(`{}`))
	require.Error(t, err)

	var hwErr *HardwareWalletError
	require.True(t, errors.As(err, &hwErr))
	assert.Equal(t, ErrCodeUserRejected, hwErr.Code)
}

func TestMockSignTypedDataNoResponse(t *testing.T) {
	mock := NewMockHardwareWallet(Ledger)
	ctx := context.Background()

	require.NoError(t, mock.Connect(ctx))
	_, err := mock.SignTypedData(ctx, "0xabc", []byte(`{}`))
	require.Error(t, err)

	var hwErr *HardwareWalletError
	require.True(t, errors.As(err, &hwErr))
	assert.Equal(t, ErrCodeSigningFailed, hwErr.Code)
}

// ---------------------------------------------------------------------------
// Mock: SignMessage
// ---------------------------------------------------------------------------

func TestMockSignMessage(t *testing.T) {
	expectedSig := []byte{0xca, 0xfe, 0xba, 0xbe}
	mock := NewMockHardwareWallet(Trezor).
		SetSignResponse(expectedSig)
	ctx := context.Background()

	require.NoError(t, mock.Connect(ctx))
	sig, err := mock.SignMessage(ctx, "0xabc", []byte("hello world"))
	require.NoError(t, err)
	assert.Equal(t, expectedSig, sig)
	assert.Equal(t, 1, mock.SignMessageCalls())
}

func TestMockSignMessageError(t *testing.T) {
	signErr := NewHardwareWalletError(ErrCodeTimeout, "device timed out", Trezor)
	mock := NewMockHardwareWallet(Trezor).
		SetSignResponse([]byte{0x01}).
		WithSignMessageError(signErr)
	ctx := context.Background()

	require.NoError(t, mock.Connect(ctx))
	_, err := mock.SignMessage(ctx, "0xabc", []byte("test"))
	require.Error(t, err)

	var hwErr *HardwareWalletError
	require.True(t, errors.As(err, &hwErr))
	assert.Equal(t, ErrCodeTimeout, hwErr.Code)
}

func TestMockSignMessageNotConnected(t *testing.T) {
	mock := NewMockHardwareWallet(Trezor).SetSignResponse([]byte{0x01})
	ctx := context.Background()

	_, err := mock.SignMessage(ctx, "0xabc", []byte("test"))
	require.Error(t, err)

	var hwErr *HardwareWalletError
	require.True(t, errors.As(err, &hwErr))
	assert.Equal(t, ErrCodeNotConnected, hwErr.Code)
	assert.True(t, errors.Is(err, ErrNotConnected))
}

// ---------------------------------------------------------------------------
// Mock: Type and DeviceInfo
// ---------------------------------------------------------------------------

func TestMockType(t *testing.T) {
	ledger := NewMockHardwareWallet(Ledger)
	trezor := NewMockHardwareWallet(Trezor)

	assert.Equal(t, Ledger, ledger.Type())
	assert.Equal(t, Trezor, trezor.Type())
}

func TestMockDeviceInfoPopulation(t *testing.T) {
	mock := NewMockHardwareWallet(Ledger).SetDeviceInfo(&DeviceInfo{
		Type:            Ledger,
		Name:            "Ledger Nano X",
		Model:           "Nano X",
		FirmwareVersion: "2.1.0",
		AppName:         "Ethereum",
		AppVersion:      "1.10.4",
		IsLocked:        false,
		Status:          StatusReady,
	})

	info := mock.DeviceInfo()
	require.NotNil(t, info)
	assert.Equal(t, Ledger, info.Type)
	assert.Equal(t, "Ledger Nano X", info.Name)
	assert.Equal(t, "Nano X", info.Model)
	assert.Equal(t, "2.1.0", info.FirmwareVersion)
	assert.Equal(t, "Ethereum", info.AppName)
	assert.Equal(t, "1.10.4", info.AppVersion)

	// Mutation safety: changing the returned info should not affect the mock.
	info.Model = "changed"
	info2 := mock.DeviceInfo()
	assert.Equal(t, "Nano X", info2.Model)
}

func TestMockDeviceInfoNil(t *testing.T) {
	mock := NewMockHardwareWallet(Ledger)
	mock.SetDeviceInfo(nil)
	assert.Nil(t, mock.DeviceInfo())
}

// ---------------------------------------------------------------------------
// Mock: Call counting
// ---------------------------------------------------------------------------

func TestMockCallCounting(t *testing.T) {
	mock := NewMockHardwareWallet(Ledger).
		SetAddresses([]string{"0xabc"}).
		SetSignResponse([]byte{0x01})
	ctx := context.Background()

	assert.Equal(t, 0, mock.ConnectCalls())
	assert.Equal(t, 0, mock.DisconnectCalls())
	assert.Equal(t, 0, mock.GetAddressCalls())
	assert.Equal(t, 0, mock.SignTypedDataCalls())
	assert.Equal(t, 0, mock.SignMessageCalls())

	_ = mock.Connect(ctx)
	_ = mock.Connect(ctx) // second connect
	assert.Equal(t, 2, mock.ConnectCalls())

	_, _ = mock.GetAddress(ctx, "")
	_, _ = mock.GetAddresses(ctx, "", 3)
	assert.Equal(t, 2, mock.GetAddressCalls())

	_, _ = mock.SignTypedData(ctx, "0xabc", []byte(`{}`))
	_, _ = mock.SignMessage(ctx, "0xabc", []byte("msg"))
	assert.Equal(t, 1, mock.SignTypedDataCalls())
	assert.Equal(t, 1, mock.SignMessageCalls())

	_ = mock.Disconnect()
	assert.Equal(t, 1, mock.DisconnectCalls())
}

// ---------------------------------------------------------------------------
// Ledger stub
// ---------------------------------------------------------------------------

func TestLedgerStubInterface(t *testing.T) {
	ledger := NewLedgerWallet()
	ctx := context.Background()

	assert.Equal(t, Ledger, ledger.Type())
	assert.Equal(t, StatusDisconnected, ledger.Status())
	assert.False(t, ledger.IsConnected())

	info := ledger.DeviceInfo()
	require.NotNil(t, info)
	assert.Equal(t, Ledger, info.Type)
	assert.True(t, info.IsLocked)

	// Connect returns ErrNotSupported.
	err := ledger.Connect(ctx)
	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrNotSupported))
	var hwErr *HardwareWalletError
	require.True(t, errors.As(err, &hwErr))
	assert.Equal(t, ErrCodeNotSupported, hwErr.Code)

	// Disconnect is a no-op.
	require.NoError(t, ledger.Disconnect())

	// GetAddress returns ErrNotConnected.
	_, err = ledger.GetAddress(ctx, "m/44'/60'/0'/0/0")
	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrNotConnected))

	// GetAddresses returns ErrNotConnected.
	_, err = ledger.GetAddresses(ctx, DefaultDerivationPath, 5)
	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrNotConnected))

	// SignTypedData returns ErrNotConnected.
	_, err = ledger.SignTypedData(ctx, "0xabc", []byte(`{}`))
	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrNotConnected))

	// SignMessage returns ErrNotConnected.
	_, err = ledger.SignMessage(ctx, "0xabc", []byte("hello"))
	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrNotConnected))
}

// ---------------------------------------------------------------------------
// Trezor stub
// ---------------------------------------------------------------------------

func TestTrezorStubInterface(t *testing.T) {
	trezor := NewTrezorWallet()
	ctx := context.Background()

	assert.Equal(t, Trezor, trezor.Type())
	assert.Equal(t, StatusDisconnected, trezor.Status())
	assert.False(t, trezor.IsConnected())

	info := trezor.DeviceInfo()
	require.NotNil(t, info)
	assert.Equal(t, Trezor, info.Type)
	assert.True(t, info.IsLocked)

	// Connect returns ErrNotSupported.
	err := trezor.Connect(ctx)
	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrNotSupported))
	var hwErr *HardwareWalletError
	require.True(t, errors.As(err, &hwErr))
	assert.Equal(t, ErrCodeNotSupported, hwErr.Code)

	// Disconnect is a no-op.
	require.NoError(t, trezor.Disconnect())

	// GetAddress returns ErrNotConnected.
	_, err = trezor.GetAddress(ctx, "m/44'/60'/0'/0/0")
	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrNotConnected))

	// GetAddresses returns ErrNotConnected.
	_, err = trezor.GetAddresses(ctx, DefaultDerivationPath, 5)
	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrNotConnected))

	// SignTypedData returns ErrNotConnected.
	_, err = trezor.SignTypedData(ctx, "0xabc", []byte(`{}`))
	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrNotConnected))

	// SignMessage returns ErrNotConnected.
	_, err = trezor.SignMessage(ctx, "0xabc", []byte("hello"))
	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrNotConnected))
}

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

func TestHardwareWalletErrorFormat(t *testing.T) {
	err := NewHardwareWalletError(ErrCodeUserRejected, "user said no", Ledger)
	assert.Equal(t, "[ledger:USER_REJECTED] user said no", err.Error())

	// Without wallet type.
	err2 := &HardwareWalletError{Code: ErrCodeTimeout, Message: "timed out"}
	assert.Equal(t, "[TIMEOUT] timed out", err2.Error())
}

func TestHardwareWalletErrorUnwrap(t *testing.T) {
	cause := errors.New("underlying USB error")
	err := NewHardwareWalletError(ErrCodeTransportError, "transport failed", Ledger).WithCause(cause)

	assert.True(t, errors.Is(err, cause))
	assert.Equal(t, cause, errors.Unwrap(err))
}

func TestIsHardwareWalletError(t *testing.T) {
	hwErr := NewHardwareWalletError(ErrCodeDeviceLocked, "locked", Trezor)
	assert.True(t, IsHardwareWalletError(hwErr))
	assert.False(t, IsHardwareWalletError(errors.New("plain error")))
}

func TestGetHardwareWalletError(t *testing.T) {
	hwErr := NewHardwareWalletError(ErrCodeSigningFailed, "signing failed", Ledger)

	extracted, ok := GetHardwareWalletError(hwErr)
	require.True(t, ok)
	assert.Equal(t, ErrCodeSigningFailed, extracted.Code)
	assert.Equal(t, Ledger, extracted.WalletType)

	_, ok = GetHardwareWalletError(errors.New("not a hw error"))
	assert.False(t, ok)
}

func TestErrorCodeConstants(t *testing.T) {
	// Ensure all error codes have distinct values.
	codes := []ErrorCode{
		ErrCodeDeviceNotFound,
		ErrCodeConnectionFailed,
		ErrCodeDeviceLocked,
		ErrCodeAppNotOpen,
		ErrCodeTransportError,
		ErrCodeUserRejected,
		ErrCodeSigningFailed,
		ErrCodeInvalidData,
		ErrCodeNotSupported,
		ErrCodeTimeout,
		ErrCodeNotConnected,
		ErrCodeUnknown,
	}
	seen := make(map[ErrorCode]bool, len(codes))
	for _, c := range codes {
		assert.False(t, seen[c], "duplicate error code: %s", c)
		seen[c] = true
	}
}

// ---------------------------------------------------------------------------
// DeviceStatus constants
// ---------------------------------------------------------------------------

func TestDeviceStatusConstants(t *testing.T) {
	statuses := []DeviceStatus{
		StatusDisconnected,
		StatusConnecting,
		StatusConnected,
		StatusLocked,
		StatusUnlocked,
		StatusAppClosed,
		StatusReady,
	}
	seen := make(map[DeviceStatus]bool, len(statuses))
	for _, s := range statuses {
		assert.False(t, seen[s], "duplicate status: %s", s)
		seen[s] = true
	}
}

// ---------------------------------------------------------------------------
// HardwareWalletType constants
// ---------------------------------------------------------------------------

func TestHardwareWalletTypeConstants(t *testing.T) {
	assert.Equal(t, HardwareWalletType("ledger"), Ledger)
	assert.Equal(t, HardwareWalletType("trezor"), Trezor)
}

// ---------------------------------------------------------------------------
// Interface compliance (compile-time, verified at runtime too)
// ---------------------------------------------------------------------------

func TestInterfaceCompliance(t *testing.T) {
	var _ HardwareWallet = (*LedgerWallet)(nil)
	var _ HardwareWallet = (*TrezorWallet)(nil)
	var _ HardwareWallet = (*MockHardwareWallet)(nil)

	// Also check the error interface.
	var _ error = (*HardwareWalletError)(nil)
}

// ---------------------------------------------------------------------------
// ConnectionOptions defaults
// ---------------------------------------------------------------------------

func TestDefaultConnectionOptions(t *testing.T) {
	opts := DefaultConnectionOptions()
	assert.Equal(t, 0, opts.AccountIndex)
	assert.Equal(t, "", opts.DerivationPath)
	assert.Equal(t, 30000, opts.Timeout)
}
