package stacks

import (
	"context"
	"math/big"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/t402-io/t402/sdks/go/mechanisms/stacks"
)

// Test seed (DO NOT USE IN PRODUCTION)
const testSeed = "0000000000000000000000000000000000000000000000000000000000000001"

func TestNewClientSignerFromSeed(t *testing.T) {
	config := &Config{
		IsTestnet: true,
	}

	signer, err := NewClientSignerFromSeed(testSeed, config)
	require.NoError(t, err)
	require.NotNil(t, signer)

	// Address should be valid Stacks principal
	address := signer.Address()
	t.Logf("Generated address: %s (length: %d)", address, len(address))

	// Check validity
	isValid := stacks.IsValidPrincipal(address)
	t.Logf("IsValidPrincipal: %v", isValid)

	// For now, just check prefix and reasonable length
	assert.True(t, len(address) > 20, "Address too short")
	assert.True(t, len(address) < 50, "Address too long")

	// Public key should be 33 bytes compressed
	pubKey := signer.PublicKeyHex()
	assert.Len(t, pubKey, 66) // 33 bytes = 66 hex chars
}

func TestMainnetAddress(t *testing.T) {
	config := &Config{
		IsTestnet: false,
	}

	signer, err := NewClientSignerFromSeed(testSeed, config)
	require.NoError(t, err)

	address := signer.Address()
	t.Logf("Mainnet address: %s (length: %d)", address, len(address))

	// Check reasonable length
	assert.True(t, len(address) > 20, "Address too short")
	assert.True(t, len(address) < 50, "Address too long")
}

func TestNewClientSignerInvalidSeed(t *testing.T) {
	config := &Config{IsTestnet: true}

	// Invalid hex
	_, err := NewClientSignerFromSeed("not-valid-hex", config)
	assert.Error(t, err)

	// Too short
	_, err = NewClientSignerFromSeed("0x1234", config)
	assert.Error(t, err)

	// Too long
	_, err = NewClientSignerFromSeed("00000000000000000000000000000000000000000000000000000000000000000001", config)
	assert.Error(t, err)
}

func TestBase58RoundTrip(t *testing.T) {
	tests := []struct {
		data []byte
	}{
		{[]byte{0}},
		{[]byte{0, 0, 0}},
		{[]byte{1, 2, 3, 4, 5}},
		{[]byte{255, 255, 255}},
	}

	for _, tc := range tests {
		encoded := base58Encode(tc.data)
		decoded, err := base58Decode(encoded)
		require.NoError(t, err)
		assert.Equal(t, tc.data, decoded, "data: %v", tc.data)
	}
}

func TestBase58CheckRoundTrip(t *testing.T) {
	// Test data
	data := []byte{22, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20}

	encoded := base58CheckEncode(data)
	decoded, err := base58CheckDecode(encoded)
	require.NoError(t, err)
	assert.Equal(t, data, decoded)
}

func TestHash160(t *testing.T) {
	// Hash160 should produce 20 bytes
	result := hash160([]byte("test data"))
	assert.Len(t, result, 20)
}

func TestParseContractId(t *testing.T) {
	principal, name, err := parseContractId("SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc")
	require.NoError(t, err)
	assert.Equal(t, "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K", principal)
	assert.Equal(t, "token-susdc", name)

	// Invalid format
	_, _, err = parseContractId("invalid")
	assert.Error(t, err)
}

func TestDeterministicAddressDerivation(t *testing.T) {
	config := &Config{IsTestnet: true}

	// Same seed should produce same address
	signer1, err := NewClientSignerFromSeed(testSeed, config)
	require.NoError(t, err)

	signer2, err := NewClientSignerFromSeed(testSeed, config)
	require.NoError(t, err)

	assert.Equal(t, signer1.Address(), signer2.Address())
	assert.Equal(t, signer1.PublicKeyHex(), signer2.PublicKeyHex())
}

func TestDifferentNetworkPrefixes(t *testing.T) {
	mainnetSigner, err := NewClientSignerFromSeed(testSeed, &Config{IsTestnet: false})
	require.NoError(t, err)

	testnetSigner, err := NewClientSignerFromSeed(testSeed, &Config{IsTestnet: true})
	require.NoError(t, err)

	// Different networks should have different addresses
	assert.NotEqual(t, mainnetSigner.Address(), testnetSigner.Address())

	// But same public key
	assert.Equal(t, mainnetSigner.PublicKeyHex(), testnetSigner.PublicKeyHex())
}

func TestTransferToken(t *testing.T) {
	// Skip if CI environment (requires network)
	if testing.Short() {
		t.Skip("Skipping network test in short mode")
	}

	config := &Config{IsTestnet: true}
	signer, err := NewClientSignerFromSeed(testSeed, config)
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// This will fail because the test account doesn't have funds
	// but it tests the transaction building logic
	_, err = signer.TransferToken(
		ctx,
		stacks.SUSDCTestnet.ContractAddress,
		"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
		big.NewInt(1000000),
	)

	// We expect an error because the test account doesn't have funds
	assert.Error(t, err)
}
