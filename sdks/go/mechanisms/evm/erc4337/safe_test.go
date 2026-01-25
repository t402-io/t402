package erc4337

import (
	"crypto/ecdsa"
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func generateTestPrivateKey(t *testing.T) *ecdsa.PrivateKey {
	key, err := crypto.GenerateKey()
	require.NoError(t, err)
	return key
}

func TestNewSafeSmartAccount(t *testing.T) {
	t.Run("with valid config", func(t *testing.T) {
		key := generateTestPrivateKey(t)

		account, err := NewSafeSmartAccount(SafeAccountConfig{
			Owner:   key,
			ChainID: 1,
		})
		require.NoError(t, err)
		require.NotNil(t, account)
		assert.Equal(t, int64(1), account.chainID)
		assert.Equal(t, 1, account.threshold)
		assert.Equal(t, common.HexToAddress(EntryPointV07Address), account.entryPoint)
	})

	t.Run("with custom config", func(t *testing.T) {
		key := generateTestPrivateKey(t)
		customEntryPoint := common.HexToAddress("0x1234567890123456789012345678901234567890")

		account, err := NewSafeSmartAccount(SafeAccountConfig{
			Owner:      key,
			ChainID:    8453,
			Salt:       big.NewInt(42),
			EntryPoint: customEntryPoint,
			Threshold:  2,
		})
		require.NoError(t, err)
		require.NotNil(t, account)
		assert.Equal(t, int64(8453), account.chainID)
		assert.Equal(t, 2, account.threshold)
		assert.Equal(t, customEntryPoint, account.entryPoint)
		assert.Equal(t, big.NewInt(42), account.salt)
	})

	t.Run("without owner returns error", func(t *testing.T) {
		_, err := NewSafeSmartAccount(SafeAccountConfig{
			ChainID: 1,
		})
		require.Error(t, err)
		assert.Contains(t, err.Error(), "owner private key is required")
	})

	t.Run("with zero threshold uses default", func(t *testing.T) {
		key := generateTestPrivateKey(t)

		account, err := NewSafeSmartAccount(SafeAccountConfig{
			Owner:     key,
			ChainID:   1,
			Threshold: 0,
		})
		require.NoError(t, err)
		assert.Equal(t, 1, account.threshold)
	})

	t.Run("with negative threshold uses default", func(t *testing.T) {
		key := generateTestPrivateKey(t)

		account, err := NewSafeSmartAccount(SafeAccountConfig{
			Owner:     key,
			ChainID:   1,
			Threshold: -1,
		})
		require.NoError(t, err)
		assert.Equal(t, 1, account.threshold)
	})
}

func TestSafeSmartAccountGetAddress(t *testing.T) {
	key := generateTestPrivateKey(t)

	account, err := NewSafeSmartAccount(SafeAccountConfig{
		Owner:   key,
		ChainID: 1,
	})
	require.NoError(t, err)

	// Get address
	address, err := account.GetAddress()
	require.NoError(t, err)
	assert.NotEqual(t, common.Address{}, address)

	// Address should be cached
	address2, err := account.GetAddress()
	require.NoError(t, err)
	assert.Equal(t, address, address2)
}

func TestSafeSmartAccountSignUserOpHash(t *testing.T) {
	key := generateTestPrivateKey(t)

	account, err := NewSafeSmartAccount(SafeAccountConfig{
		Owner:   key,
		ChainID: 1,
	})
	require.NoError(t, err)

	userOpHash := common.HexToHash("0x1234567890123456789012345678901234567890123456789012345678901234")

	signature, err := account.SignUserOpHash(userOpHash)
	require.NoError(t, err)
	assert.Len(t, signature, 65)

	// v value should be 27 or 28
	assert.True(t, signature[64] == 27 || signature[64] == 28)
}

func TestSafeSmartAccountGetInitCode(t *testing.T) {
	key := generateTestPrivateKey(t)

	account, err := NewSafeSmartAccount(SafeAccountConfig{
		Owner:   key,
		ChainID: 1,
	})
	require.NoError(t, err)

	initCode, err := account.GetInitCode()
	require.NoError(t, err)
	assert.NotEmpty(t, initCode)

	// Init code should start with factory address
	factoryAddress := Safe4337Addresses.ProxyFactory.Bytes()
	assert.Equal(t, factoryAddress, initCode[:20])

	// Init code should be cached
	initCode2, err := account.GetInitCode()
	require.NoError(t, err)
	assert.Equal(t, initCode, initCode2)
}

func TestSafeSmartAccountIsDeployed(t *testing.T) {
	key := generateTestPrivateKey(t)

	account, err := NewSafeSmartAccount(SafeAccountConfig{
		Owner:   key,
		ChainID: 1,
	})
	require.NoError(t, err)

	// Currently always returns false
	deployed, err := account.IsDeployed()
	require.NoError(t, err)
	assert.False(t, deployed)
}

func TestSafeSmartAccountEncodeExecute(t *testing.T) {
	key := generateTestPrivateKey(t)

	account, err := NewSafeSmartAccount(SafeAccountConfig{
		Owner:   key,
		ChainID: 1,
	})
	require.NoError(t, err)

	target := common.HexToAddress("0xdead000000000000000000000000000000000000")
	value := big.NewInt(1000000000000000000) // 1 ETH
	data := []byte{0xde, 0xad, 0xbe, 0xef}

	encoded, err := account.EncodeExecute(target, value, data)
	require.NoError(t, err)
	assert.NotEmpty(t, encoded)

	// Check selector (executeUserOp)
	assert.Equal(t, []byte{0x54, 0x1d, 0x63, 0xc8}, encoded[:4])
}

func TestSafeSmartAccountEncodeExecuteBatch(t *testing.T) {
	key := generateTestPrivateKey(t)

	account, err := NewSafeSmartAccount(SafeAccountConfig{
		Owner:   key,
		ChainID: 1,
	})
	require.NoError(t, err)

	targets := []common.Address{
		common.HexToAddress("0xdead000000000000000000000000000000000001"),
		common.HexToAddress("0xdead000000000000000000000000000000000002"),
	}
	values := []*big.Int{
		big.NewInt(1000000000000000000),
		big.NewInt(0),
	}
	datas := [][]byte{
		{0x01, 0x02},
		{0x03, 0x04},
	}

	encoded, err := account.EncodeExecuteBatch(targets, values, datas)
	require.NoError(t, err)
	assert.NotEmpty(t, encoded)

	// Check selector (executeUserOp)
	assert.Equal(t, []byte{0x54, 0x1d, 0x63, 0xc8}, encoded[:4])
}

func TestSafeSmartAccountEncodeExecuteBatchMismatchedLengths(t *testing.T) {
	key := generateTestPrivateKey(t)

	account, err := NewSafeSmartAccount(SafeAccountConfig{
		Owner:   key,
		ChainID: 1,
	})
	require.NoError(t, err)

	// Mismatched lengths
	targets := []common.Address{
		common.HexToAddress("0xdead000000000000000000000000000000000001"),
	}
	values := []*big.Int{
		big.NewInt(1),
		big.NewInt(2),
	}
	datas := [][]byte{
		{0x01},
	}

	_, err = account.EncodeExecuteBatch(targets, values, datas)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "must have same length")
}

func TestEncodeBytes(t *testing.T) {
	tests := []struct {
		name     string
		data     []byte
		wantLen  int
	}{
		{
			name:    "empty data",
			data:    []byte{},
			wantLen: 32, // just length
		},
		{
			name:    "small data",
			data:    []byte{0x01, 0x02, 0x03},
			wantLen: 64, // length (32) + padded data (32)
		},
		{
			name:    "exactly 32 bytes",
			data:    make([]byte, 32),
			wantLen: 64,
		},
		{
			name:    "larger data",
			data:    make([]byte, 64),
			wantLen: 96, // length (32) + data (64)
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			encoded := encodeBytes(tt.data)
			assert.Len(t, encoded, tt.wantLen)

			// First 32 bytes should be the length
			length := new(big.Int).SetBytes(encoded[:32])
			assert.Equal(t, int64(len(tt.data)), length.Int64())
		})
	}
}

func TestEncodeExecuteUserOp(t *testing.T) {
	to := common.HexToAddress("0x1234567890123456789012345678901234567890")
	value := big.NewInt(1000)
	data := []byte{0xde, 0xad, 0xbe, 0xef}
	operation := uint8(0)

	encoded := encodeExecuteUserOp(to, value, data, operation)
	assert.NotEmpty(t, encoded)

	// Should have at least: to (32) + value (32) + offset (32) + operation (32) + length (32) + data
	assert.True(t, len(encoded) >= 160)
}

func TestEncodeExecuteUserOpWithNilValue(t *testing.T) {
	to := common.HexToAddress("0x1234567890123456789012345678901234567890")
	data := []byte{0xde, 0xad}
	operation := uint8(1)

	encoded := encodeExecuteUserOp(to, nil, data, operation)
	assert.NotEmpty(t, encoded)
}

func TestEncodeCreateProxyWithNonce(t *testing.T) {
	singleton := common.HexToAddress("0x1234567890123456789012345678901234567890")
	initializer := []byte{0x01, 0x02, 0x03}
	saltNonce := big.NewInt(42)

	encoded := encodeCreateProxyWithNonce(singleton, initializer, saltNonce)
	assert.NotEmpty(t, encoded)

	// Should have: singleton (32) + offset (32) + saltNonce (32) + length (32) + padded initializer
	assert.True(t, len(encoded) >= 128)
}

func TestEncodeEnableModules(t *testing.T) {
	modules := []common.Address{
		Safe4337Addresses.Module,
	}

	encoded := encodeEnableModules(modules)
	assert.NotEmpty(t, encoded)

	// Check selector
	assert.Equal(t, []byte{0xa3, 0xf4, 0xdf, 0x7e}, encoded[:4])
}

func TestEncodeMultiSendTx(t *testing.T) {
	to := common.HexToAddress("0x1234567890123456789012345678901234567890")
	value := big.NewInt(1000)
	data := []byte{0x01, 0x02, 0x03}

	encoded := encodeMultiSendTx(to, value, data)

	// Should have: operation (1) + to (20) + value (32) + dataLength (32) + data (3)
	assert.Len(t, encoded, 1+20+32+32+3)

	// First byte is operation (CALL = 0)
	assert.Equal(t, uint8(0), encoded[0])

	// Next 20 bytes are the address
	assert.Equal(t, to.Bytes(), encoded[1:21])
}

func TestEncodeMultiSendTxWithNilValue(t *testing.T) {
	to := common.HexToAddress("0x1234567890123456789012345678901234567890")
	data := []byte{0x01}

	encoded := encodeMultiSendTx(to, nil, data)
	assert.NotEmpty(t, encoded)

	// Value should be zero (32 zero bytes at position 21-53)
	for _, b := range encoded[21:53] {
		assert.Equal(t, uint8(0), b)
	}
}

func TestEncodeSetup(t *testing.T) {
	owners := []common.Address{
		common.HexToAddress("0x1111111111111111111111111111111111111111"),
		common.HexToAddress("0x2222222222222222222222222222222222222222"),
	}
	threshold := big.NewInt(2)
	to := common.HexToAddress("0x3333333333333333333333333333333333333333")
	data := []byte{0xab, 0xcd}
	fallbackHandler := common.HexToAddress("0x4444444444444444444444444444444444444444")
	paymentToken := common.Address{}
	payment := big.NewInt(0)
	paymentReceiver := common.Address{}

	encoded := encodeSetup(owners, threshold, to, data, fallbackHandler, paymentToken, payment, paymentReceiver)
	assert.NotEmpty(t, encoded)
}

func TestEncodeSetupWithNilPayment(t *testing.T) {
	owners := []common.Address{
		common.HexToAddress("0x1111111111111111111111111111111111111111"),
	}
	threshold := big.NewInt(1)
	to := common.Address{}
	data := []byte{}
	fallbackHandler := common.Address{}
	paymentToken := common.Address{}
	paymentReceiver := common.Address{}

	encoded := encodeSetup(owners, threshold, to, data, fallbackHandler, paymentToken, nil, paymentReceiver)
	assert.NotEmpty(t, encoded)
}

func TestKeccak256(t *testing.T) {
	data := []byte("hello world")
	hash := keccak256(data)
	assert.Len(t, hash, 32)

	// Same input should produce same hash
	hash2 := keccak256(data)
	assert.Equal(t, hash, hash2)

	// Different input should produce different hash
	hash3 := keccak256([]byte("goodbye world"))
	assert.NotEqual(t, hash, hash3)
}

func TestSafeSmartAccountDeterministicAddress(t *testing.T) {
	// Use a fixed private key for determinism
	privateKeyBytes, _ := crypto.HexToECDSA("0000000000000000000000000000000000000000000000000000000000000001")

	account1, err := NewSafeSmartAccount(SafeAccountConfig{
		Owner:   privateKeyBytes,
		ChainID: 1,
		Salt:    big.NewInt(0),
	})
	require.NoError(t, err)

	account2, err := NewSafeSmartAccount(SafeAccountConfig{
		Owner:   privateKeyBytes,
		ChainID: 1,
		Salt:    big.NewInt(0),
	})
	require.NoError(t, err)

	addr1, _ := account1.GetAddress()
	addr2, _ := account2.GetAddress()

	// Same config should produce same address
	assert.Equal(t, addr1, addr2)

	// Different salt should produce different address
	account3, err := NewSafeSmartAccount(SafeAccountConfig{
		Owner:   privateKeyBytes,
		ChainID: 1,
		Salt:    big.NewInt(1),
	})
	require.NoError(t, err)

	addr3, _ := account3.GetAddress()
	assert.NotEqual(t, addr1, addr3)
}
