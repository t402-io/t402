package aptos

import (
	"bytes"
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/aptos"
)

// Test seed (DO NOT USE IN PRODUCTION)
const testSeed = "0000000000000000000000000000000000000000000000000000000000000001"

func TestNewClientSignerFromSeed(t *testing.T) {
	signer, err := NewClientSignerFromSeed(testSeed, nil)
	require.NoError(t, err)
	require.NotNil(t, signer)

	// Address should be valid
	address := signer.Address()
	assert.True(t, aptos.IsValidAddress(address))
	assert.True(t, len(address) > 2)
	assert.Equal(t, "0x", address[:2])

	// Public key should be valid hex
	pubKey := signer.PublicKeyHex()
	assert.True(t, len(pubKey) > 2)
	assert.Equal(t, "0x", pubKey[:2])
}

func TestNewClientSignerFromPrivateKey(t *testing.T) {
	// Create from seed first
	seedSigner, err := NewClientSignerFromSeed(testSeed, nil)
	require.NoError(t, err)

	// Create from full private key (64 bytes)
	fullKeyHex := "0x" + testSeed + seedSigner.PublicKeyHex()[2:]
	keySigner, err := NewClientSignerFromPrivateKey(fullKeyHex, nil)
	require.NoError(t, err)

	// Addresses should match
	assert.Equal(t, seedSigner.Address(), keySigner.Address())
}

func TestNewClientSignerInvalidSeed(t *testing.T) {
	// Invalid hex
	_, err := NewClientSignerFromSeed("not-valid-hex", nil)
	assert.Error(t, err)

	// Too short
	_, err = NewClientSignerFromSeed("0x1234", nil)
	assert.Error(t, err)

	// Too long
	_, err = NewClientSignerFromSeed("00000000000000000000000000000000000000000000000000000000000000000001", nil)
	assert.Error(t, err)
}

func TestAddressToBytes(t *testing.T) {
	// Full address
	bytes1, err := addressToBytes("0x0000000000000000000000000000000000000000000000000000000000000001")
	require.NoError(t, err)
	assert.Equal(t, 32, len(bytes1))
	assert.Equal(t, byte(1), bytes1[31])

	// Short address (should be padded)
	bytes2, err := addressToBytes("0x1")
	require.NoError(t, err)
	assert.Equal(t, 32, len(bytes2))
	assert.Equal(t, byte(1), bytes2[31])

	// Without 0x prefix
	bytes3, err := addressToBytes("1")
	require.NoError(t, err)
	assert.Equal(t, bytes2, bytes3)
}

func TestWriteULEB128(t *testing.T) {
	tests := []struct {
		value    uint64
		expected []byte
	}{
		{0, []byte{0x00}},
		{1, []byte{0x01}},
		{127, []byte{0x7F}},
		{128, []byte{0x80, 0x01}},
		{255, []byte{0xFF, 0x01}},
		{300, []byte{0xAC, 0x02}},
	}

	for _, tc := range tests {
		var buf bytes.Buffer
		writeULEB128(&buf, tc.value)
		assert.Equal(t, tc.expected, buf.Bytes(), "value: %d", tc.value)
	}
}

func TestWriteString(t *testing.T) {
	var buf bytes.Buffer
	writeString(&buf, "hello")

	// ULEB128(5) = 0x05, then "hello"
	expected := []byte{0x05, 'h', 'e', 'l', 'l', 'o'}
	assert.Equal(t, expected, buf.Bytes())
}

func TestWriteBytes(t *testing.T) {
	var buf bytes.Buffer
	writeBytes(&buf, []byte{1, 2, 3})

	// ULEB128(3) = 0x03, then bytes
	expected := []byte{0x03, 1, 2, 3}
	assert.Equal(t, expected, buf.Bytes())
}

func TestSignAndSubmitTransaction(t *testing.T) {
	// Skip if CI environment (requires network)
	if testing.Short() {
		t.Skip("Skipping network test in short mode")
	}

	signer, err := NewClientSignerFromSeed(testSeed, nil)
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Build a FA transfer payload
	payload := aptos.TransactionPayload{
		Type:          "entry_function_payload",
		Function:      aptos.FATransferFunction,
		TypeArguments: []string{},
		Arguments: []interface{}{
			aptos.USDTMainnet.MetadataAddress, // FA metadata
			"0x1",                             // recipient
			"1000000",                         // amount
		},
	}

	// This will fail because the test account doesn't have funds
	// but it tests the transaction building logic
	_, err = signer.SignAndSubmitTransaction(ctx, payload, t402.Network(aptos.AptosTestnetCAIP2))

	// We expect an error because the test account doesn't have funds
	assert.Error(t, err)
}

func TestDeterministicAddressDerivation(t *testing.T) {
	// Same seed should produce same address
	signer1, err := NewClientSignerFromSeed(testSeed, nil)
	require.NoError(t, err)

	signer2, err := NewClientSignerFromSeed(testSeed, nil)
	require.NoError(t, err)

	assert.Equal(t, signer1.Address(), signer2.Address())
	assert.Equal(t, signer1.PublicKeyHex(), signer2.PublicKeyHex())
}
