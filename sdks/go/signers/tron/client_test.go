package tron

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Test private key (DO NOT USE IN PRODUCTION)
const testPrivateKey = "0x0000000000000000000000000000000000000000000000000000000000000001"

func TestNewClientSignerFromPrivateKey(t *testing.T) {
	config := &Config{
		Endpoint: "nile",
		FeeLimit: DefaultFeeLimit,
	}

	signer, err := NewClientSignerFromPrivateKey(testPrivateKey, config)
	require.NoError(t, err)
	require.NotNil(t, signer)

	// Address should be non-empty and start with T
	address := signer.Address()
	assert.NotEmpty(t, address)
	assert.True(t, address[0] == 'T', "Address should start with T")
	assert.Equal(t, 34, len(address), "TRON address should be 34 characters")
}

func TestNewClientSignerInvalidPrivateKey(t *testing.T) {
	config := &Config{
		Endpoint: "nile",
	}

	// Invalid hex
	_, err := NewClientSignerFromPrivateKey("not-valid-hex", config)
	assert.Error(t, err)

	// Too short
	_, err = NewClientSignerFromPrivateKey("0x1234", config)
	assert.Error(t, err)
}

func TestPublicKeyToAddress(t *testing.T) {
	// Test with a known private key and expected address
	signer, err := NewClientSignerFromPrivateKey(testPrivateKey, &Config{Endpoint: "nile"})
	require.NoError(t, err)

	address := signer.Address()

	// Should be a valid TRON address
	assert.True(t, ValidateTronAddress(address))
}

func TestBase58CheckEncode(t *testing.T) {
	// Test encoding with known values
	input := []byte{0x41, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01}
	encoded := Base58CheckEncode(input)

	// Should be a valid base58 string
	assert.NotEmpty(t, encoded)

	// Should decode back to the same value
	decoded, err := Base58CheckDecode(encoded)
	require.NoError(t, err)
	assert.Equal(t, input, decoded)
}

func TestBase58CheckDecode(t *testing.T) {
	// Test with a known TRON address
	address := "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb"

	decoded, err := Base58CheckDecode(address)
	require.NoError(t, err)
	assert.NotEmpty(t, decoded)

	// First byte should be the TRON prefix
	assert.Equal(t, byte(TronAddressPrefix), decoded[0])
}

func TestBase58CheckDecodeInvalid(t *testing.T) {
	// Invalid character
	_, err := Base58CheckDecode("invalid0address")
	assert.Error(t, err)

	// Too short
	_, err = Base58CheckDecode("T")
	assert.Error(t, err)
}

func TestAddressToHex(t *testing.T) {
	address := "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb"

	hexAddr, err := AddressToHex(address)
	require.NoError(t, err)

	// Should start with 41 (TRON prefix)
	assert.True(t, len(hexAddr) == 42, "Hex address should be 42 characters (21 bytes)")
	assert.Equal(t, "41", hexAddr[:2])

	// Should convert back
	backToAddr, err := HexToAddress(hexAddr)
	require.NoError(t, err)
	assert.Equal(t, address, backToAddr)
}

func TestHexToAddress(t *testing.T) {
	// Test with known hex address
	hexAddr := "410000000000000000000000000000000000000001"

	address, err := HexToAddress(hexAddr)
	require.NoError(t, err)
	assert.True(t, ValidateTronAddress(address))
}

func TestValidateTronAddress(t *testing.T) {
	// Valid addresses
	assert.True(t, ValidateTronAddress("T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb"))
	assert.True(t, ValidateTronAddress("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")) // USDT contract

	// Invalid addresses
	assert.False(t, ValidateTronAddress(""))
	assert.False(t, ValidateTronAddress("short"))
	assert.False(t, ValidateTronAddress("0x1234567890123456789012345678901234567890")) // Ethereum format
	assert.False(t, ValidateTronAddress("A9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb"))        // Wrong prefix
}

func TestResolveEndpoint(t *testing.T) {
	// Test endpoint resolution
	assert.Equal(t, "https://api.trongrid.io", resolveEndpoint("mainnet"))
	assert.Equal(t, "https://api.trongrid.io", resolveEndpoint(""))
	assert.Equal(t, "https://nile.trongrid.io", resolveEndpoint("nile"))
	assert.Equal(t, "https://api.shasta.trongrid.io", resolveEndpoint("shasta"))
	assert.Equal(t, "https://custom.endpoint.io", resolveEndpoint("https://custom.endpoint.io"))
}

func TestGetBlockInfo(t *testing.T) {
	// Skip if CI environment (requires network)
	if testing.Short() {
		t.Skip("Skipping network test in short mode")
	}

	config := &Config{
		Endpoint: "nile",
	}

	signer, err := NewClientSignerFromPrivateKey(testPrivateKey, config)
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	blockInfo, err := signer.GetBlockInfo(ctx)
	require.NoError(t, err)

	// Verify block info
	assert.NotEmpty(t, blockInfo.RefBlockBytes)
	assert.Equal(t, 4, len(blockInfo.RefBlockBytes), "RefBlockBytes should be 4 hex chars")
	assert.NotEmpty(t, blockInfo.RefBlockHash)
	assert.Equal(t, 16, len(blockInfo.RefBlockHash), "RefBlockHash should be 16 hex chars")
	assert.Greater(t, blockInfo.Expiration, int64(0))
	assert.Greater(t, blockInfo.Timestamp, int64(0))
}

func TestConstants(t *testing.T) {
	// Verify constants
	assert.Equal(t, byte(0x41), byte(TronAddressPrefix))
	assert.Equal(t, int64(100_000_000), int64(DefaultFeeLimit))
	assert.Equal(t, 300, DefaultExpiration)
}
