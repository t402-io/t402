package erc4337

import (
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/common"
)

func TestPackAccountGasLimits(t *testing.T) {
	tests := []struct {
		name                 string
		verificationGasLimit *big.Int
		callGasLimit         *big.Int
	}{
		{
			name:                 "small values",
			verificationGasLimit: big.NewInt(100000),
			callGasLimit:         big.NewInt(50000),
		},
		{
			name:                 "large values",
			verificationGasLimit: big.NewInt(1000000),
			callGasLimit:         big.NewInt(500000),
		},
		{
			name:                 "default values",
			verificationGasLimit: DefaultGasLimits.VerificationGasLimit,
			callGasLimit:         DefaultGasLimits.CallGasLimit,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			packed := PackAccountGasLimits(tt.verificationGasLimit, tt.callGasLimit)
			unpackedVerification, unpackedCall := UnpackAccountGasLimits(packed)

			if unpackedVerification.Cmp(tt.verificationGasLimit) != 0 {
				t.Errorf("verificationGasLimit mismatch: got %v, want %v", unpackedVerification, tt.verificationGasLimit)
			}
			if unpackedCall.Cmp(tt.callGasLimit) != 0 {
				t.Errorf("callGasLimit mismatch: got %v, want %v", unpackedCall, tt.callGasLimit)
			}
		})
	}
}

func TestPackGasFees(t *testing.T) {
	tests := []struct {
		name                 string
		maxPriorityFeePerGas *big.Int
		maxFeePerGas         *big.Int
	}{
		{
			name:                 "small values",
			maxPriorityFeePerGas: big.NewInt(1000000000), // 1 gwei
			maxFeePerGas:         big.NewInt(10000000000), // 10 gwei
		},
		{
			name:                 "large values",
			maxPriorityFeePerGas: big.NewInt(100000000000), // 100 gwei
			maxFeePerGas:         big.NewInt(500000000000), // 500 gwei
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			packed := PackGasFees(tt.maxPriorityFeePerGas, tt.maxFeePerGas)
			unpackedPriority, unpackedMax := UnpackGasFees(packed)

			if unpackedPriority.Cmp(tt.maxPriorityFeePerGas) != 0 {
				t.Errorf("maxPriorityFeePerGas mismatch: got %v, want %v", unpackedPriority, tt.maxPriorityFeePerGas)
			}
			if unpackedMax.Cmp(tt.maxFeePerGas) != 0 {
				t.Errorf("maxFeePerGas mismatch: got %v, want %v", unpackedMax, tt.maxFeePerGas)
			}
		})
	}
}

func TestGetAlchemyNetwork(t *testing.T) {
	tests := []struct {
		chainID      int64
		wantNetwork  string
		wantSupported bool
	}{
		{1, "eth-mainnet", true},
		{11155111, "eth-sepolia", true},
		{137, "polygon-mainnet", true},
		{8453, "base-mainnet", true},
		{84532, "base-sepolia", true},
		{999999, "", false},
	}

	for _, tt := range tests {
		network, supported := GetAlchemyNetwork(tt.chainID)
		if network != tt.wantNetwork {
			t.Errorf("GetAlchemyNetwork(%d) network = %q, want %q", tt.chainID, network, tt.wantNetwork)
		}
		if supported != tt.wantSupported {
			t.Errorf("GetAlchemyNetwork(%d) supported = %v, want %v", tt.chainID, supported, tt.wantSupported)
		}
	}
}

func TestIsSupportedChain(t *testing.T) {
	tests := []struct {
		chainID int64
		want    bool
	}{
		{1, true},
		{11155111, true},
		{8453, true},
		{84532, true},
		{10, true},
		{42161, true},
		{137, true},
		{999999, false},
		{0, false},
	}

	for _, tt := range tests {
		got := IsSupportedChain(tt.chainID)
		if got != tt.want {
			t.Errorf("IsSupportedChain(%d) = %v, want %v", tt.chainID, got, tt.want)
		}
	}
}

func TestSafe4337Addresses(t *testing.T) {
	// Verify Safe addresses are valid
	if Safe4337Addresses.Module == (common.Address{}) {
		t.Error("Safe4337Addresses.Module is zero address")
	}
	if Safe4337Addresses.ModuleSetup == (common.Address{}) {
		t.Error("Safe4337Addresses.ModuleSetup is zero address")
	}
	if Safe4337Addresses.Singleton == (common.Address{}) {
		t.Error("Safe4337Addresses.Singleton is zero address")
	}
	if Safe4337Addresses.ProxyFactory == (common.Address{}) {
		t.Error("Safe4337Addresses.ProxyFactory is zero address")
	}
}

func TestEntryPointAddresses(t *testing.T) {
	v07 := common.HexToAddress(EntryPointV07Address)
	v06 := common.HexToAddress(EntryPointV06Address)

	if v07 == (common.Address{}) {
		t.Error("EntryPointV07Address is zero address")
	}
	if v06 == (common.Address{}) {
		t.Error("EntryPointV06Address is zero address")
	}
	if v07 == v06 {
		t.Error("EntryPoint addresses should be different")
	}
}

func TestPaymasterType(t *testing.T) {
	tests := []struct {
		pt   PaymasterType
		want string
	}{
		{PaymasterTypeNone, "none"},
		{PaymasterTypeVerifying, "verifying"},
		{PaymasterTypeToken, "token"},
		{PaymasterTypeSponsoring, "sponsoring"},
	}

	for _, tt := range tests {
		if string(tt.pt) != tt.want {
			t.Errorf("PaymasterType = %q, want %q", tt.pt, tt.want)
		}
	}
}

func TestUserOperationStruct(t *testing.T) {
	userOp := &UserOperation{
		Sender:               common.HexToAddress("0x1234567890123456789012345678901234567890"),
		Nonce:                big.NewInt(0),
		InitCode:             []byte{},
		CallData:             []byte{0x01, 0x02, 0x03},
		VerificationGasLimit: big.NewInt(150000),
		CallGasLimit:         big.NewInt(100000),
		PreVerificationGas:   big.NewInt(50000),
		MaxPriorityFeePerGas: big.NewInt(1000000000),
		MaxFeePerGas:         big.NewInt(10000000000),
		PaymasterAndData:     []byte{},
		Signature:            []byte{0x04, 0x05, 0x06},
	}

	if userOp.Sender == (common.Address{}) {
		t.Error("UserOperation.Sender should not be zero")
	}
	if userOp.Nonce.Cmp(big.NewInt(0)) != 0 {
		t.Error("UserOperation.Nonce should be 0")
	}
	if len(userOp.CallData) != 3 {
		t.Error("UserOperation.CallData should have 3 bytes")
	}
}

func TestDefaultGasLimits(t *testing.T) {
	if DefaultGasLimits.VerificationGasLimit.Cmp(big.NewInt(0)) <= 0 {
		t.Error("DefaultGasLimits.VerificationGasLimit should be positive")
	}
	if DefaultGasLimits.CallGasLimit.Cmp(big.NewInt(0)) <= 0 {
		t.Error("DefaultGasLimits.CallGasLimit should be positive")
	}
	if DefaultGasLimits.PreVerificationGas.Cmp(big.NewInt(0)) <= 0 {
		t.Error("DefaultGasLimits.PreVerificationGas should be positive")
	}
}
