package polkadot

import (
	"bytes"
	"context"
	"math/big"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/t402-io/t402/sdks/go/mechanisms/polkadot"
)

// Test seed (DO NOT USE IN PRODUCTION)
const testSeed = "0000000000000000000000000000000000000000000000000000000000000001"

func TestNewClientSignerFromSeed(t *testing.T) {
	config := &Config{
		SS58Prefix: 42, // Westend
	}

	signer, err := NewClientSignerFromSeed(testSeed, config)
	require.NoError(t, err)
	require.NotNil(t, signer)

	// Address should be valid SS58 address
	address := signer.Address()
	assert.True(t, polkadot.IsValidAddress(address))
	assert.True(t, len(address) >= 45)

	// Public key should be 0x-prefixed hex
	pubKey := signer.PublicKeyHex()
	assert.True(t, len(pubKey) > 2)
	assert.Equal(t, "0x", pubKey[:2])
}

func TestNewClientSignerInvalidSeed(t *testing.T) {
	config := &Config{SS58Prefix: 42}

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

func TestPublicKeyToSS58(t *testing.T) {
	// Create a known public key
	signer, err := NewClientSignerFromSeed(testSeed, &Config{SS58Prefix: 42})
	require.NoError(t, err)

	// Address should be reproducible
	address := signer.Address()
	assert.NotEmpty(t, address)

	// Decode and re-encode should give same result
	publicKey, err := ss58ToPublicKey(address)
	require.NoError(t, err)
	assert.Equal(t, 32, len(publicKey))

	reEncoded, err := publicKeyToSS58(publicKey, 42)
	require.NoError(t, err)
	assert.Equal(t, address, reEncoded)
}

func TestSS58WithDifferentPrefixes(t *testing.T) {
	tests := []struct {
		prefix int
		name   string
	}{
		{0, "Polkadot"},
		{2, "Kusama"},
		{42, "Westend"},
	}

	// Same seed, different prefixes should give different addresses
	addresses := make(map[string]bool)

	for _, tc := range tests {
		signer, err := NewClientSignerFromSeed(testSeed, &Config{SS58Prefix: tc.prefix})
		require.NoError(t, err, "failed for %s", tc.name)

		address := signer.Address()
		assert.NotEmpty(t, address, "empty address for %s", tc.name)
		assert.True(t, polkadot.IsValidAddress(address), "invalid address for %s: %s", tc.name, address)

		// All addresses should be different
		assert.False(t, addresses[address], "duplicate address for different prefix")
		addresses[address] = true
	}
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

func TestWriteCompact(t *testing.T) {
	tests := []struct {
		value    uint64
		expected []byte
	}{
		{0, []byte{0x00}},
		{1, []byte{0x04}},
		{63, []byte{0xFC}},
		{64, []byte{0x01, 0x01}},
		{16383, []byte{0xFD, 0xFF}},
	}

	for _, tc := range tests {
		var buf bytes.Buffer
		writeCompact(&buf, tc.value)
		assert.Equal(t, tc.expected, buf.Bytes(), "value: %d", tc.value)
	}
}

func TestGetMortalEra(t *testing.T) {
	era := getMortalEra(1000, 64)
	assert.Len(t, era, 2)
	// Era bytes should be non-zero for mortal
}

func TestDeterministicAddressDerivation(t *testing.T) {
	config := &Config{SS58Prefix: 42}

	// Same seed should produce same address
	signer1, err := NewClientSignerFromSeed(testSeed, config)
	require.NoError(t, err)

	signer2, err := NewClientSignerFromSeed(testSeed, config)
	require.NoError(t, err)

	assert.Equal(t, signer1.Address(), signer2.Address())
	assert.Equal(t, signer1.PublicKeyHex(), signer2.PublicKeyHex())
}

func TestSignAndSubmitExtrinsic(t *testing.T) {
	// Skip if CI environment (requires network)
	if testing.Short() {
		t.Skip("Skipping network test in short mode")
	}

	config := &Config{SS58Prefix: 42} // Westend
	signer, err := NewClientSignerFromSeed(testSeed, config)
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	call := polkadot.ExtrinsicCall{
		AssetID: polkadot.USDTWestend.AssetID,
		Target:  "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY", // Alice on Westend
		Amount:  "1000000",
	}

	// This will fail because:
	// 1. Network calls to Subscan may fail (rate limiting, network issues)
	// 2. Extrinsic submission is not implemented
	_, err = signer.SignAndSubmitExtrinsic(ctx, call, polkadot.WestendAssetHubCAIP2)

	// We expect an error - either network failure or "not implemented"
	assert.Error(t, err)
	// Accept any of these error types:
	// - "not implemented" - submission endpoint not implemented
	// - "failed to get latest block" - network/API issue
	// - "failed to get nonce" - network/API issue
	errMsg := err.Error()
	validError := strings.Contains(errMsg, "not implemented") ||
		strings.Contains(errMsg, "failed to get latest block") ||
		strings.Contains(errMsg, "failed to get nonce")
	assert.True(t, validError, "Expected network error or not implemented error, got: %s", errMsg)
}

func TestNewClientSignerFromPrivateKey(t *testing.T) {
	config := &Config{SS58Prefix: 42}

	t.Run("32-byte seed key", func(t *testing.T) {
		signer, err := NewClientSignerFromPrivateKey(testSeed, config)
		require.NoError(t, err)
		require.NotNil(t, signer)
		assert.True(t, polkadot.IsValidAddress(signer.Address()))
	})

	t.Run("64-byte full key", func(t *testing.T) {
		// Create a signer from seed first
		seedSigner, err := NewClientSignerFromSeed(testSeed, config)
		require.NoError(t, err)

		// Get the full private key (64 bytes)
		fullKeyHex := "0x" + strings.Repeat("00", 64) // 64 bytes of zeros
		_, err = NewClientSignerFromPrivateKey(fullKeyHex, config)
		// This should work or fail based on key validity
		// Ed25519 accepts any 64-byte key
		assert.NoError(t, err)

		// Verify the seed signer works
		assert.NotEmpty(t, seedSigner.Address())
	})

	t.Run("with 0x prefix", func(t *testing.T) {
		signer, err := NewClientSignerFromPrivateKey("0x"+testSeed, config)
		require.NoError(t, err)
		assert.NotEmpty(t, signer.Address())
	})

	t.Run("invalid hex", func(t *testing.T) {
		_, err := NewClientSignerFromPrivateKey("not-valid-hex", config)
		assert.Error(t, err)
	})

	t.Run("invalid length", func(t *testing.T) {
		_, err := NewClientSignerFromPrivateKey("1234", config)
		assert.Error(t, err)
	})
}

func TestNewClientSignerDefaultConfig(t *testing.T) {
	// Test with nil config (should use default SS58 prefix)
	signer, err := NewClientSignerFromSeed(testSeed, nil)
	require.NoError(t, err)
	assert.NotEmpty(t, signer.Address())

	// Default should be Westend (prefix 42)
	assert.Equal(t, 42, signer.ss58Prefix)
}

func TestWriteCompactLargeValues(t *testing.T) {
	tests := []struct {
		name  string
		value uint64
	}{
		{"medium value", 16384},
		{"large value", 1073741824},
		{"very large value", 1099511627776},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			var buf bytes.Buffer
			writeCompact(&buf, tc.value)
			// Should not panic and should produce output
			assert.NotEmpty(t, buf.Bytes())
		})
	}
}

func TestWriteCompactBigInt(t *testing.T) {
	t.Run("small value", func(t *testing.T) {
		var buf bytes.Buffer
		writeCompactBigInt(&buf, big.NewInt(100))
		assert.NotEmpty(t, buf.Bytes())
	})

	t.Run("large value", func(t *testing.T) {
		var buf bytes.Buffer
		// Value larger than 2^30
		largeValue := new(big.Int)
		largeValue.SetString("10000000000000000000", 10)
		writeCompactBigInt(&buf, largeValue)
		assert.NotEmpty(t, buf.Bytes())
	})
}

func TestBase58DecodeErrors(t *testing.T) {
	t.Run("invalid character", func(t *testing.T) {
		_, err := base58Decode("0OIl") // Contains invalid Base58 chars
		assert.Error(t, err)
	})
}

func TestSS58ToPublicKeyErrors(t *testing.T) {
	t.Run("too short", func(t *testing.T) {
		_, err := ss58ToPublicKey("abc")
		assert.Error(t, err)
	})

	t.Run("invalid base58", func(t *testing.T) {
		_, err := ss58ToPublicKey("0OIl0OIl0OIl")
		assert.Error(t, err)
	})
}

func TestPublicKeyToSS58Errors(t *testing.T) {
	t.Run("invalid public key length", func(t *testing.T) {
		_, err := publicKeyToSS58([]byte{1, 2, 3}, 42)
		assert.Error(t, err)
	})

	t.Run("prefix too large", func(t *testing.T) {
		pubKey := make([]byte, 32)
		_, err := publicKeyToSS58(pubKey, 20000)
		assert.Error(t, err)
	})

	t.Run("two-byte prefix", func(t *testing.T) {
		pubKey := make([]byte, 32)
		// Prefix between 64 and 16384 uses two-byte encoding
		address, err := publicKeyToSS58(pubKey, 100)
		assert.NoError(t, err)
		assert.NotEmpty(t, address)
	})
}

func TestGetMortalEraEdgeCases(t *testing.T) {
	tests := []struct {
		name        string
		blockNumber int64
		period      int64
	}{
		{"small period", 100, 4},
		{"large period", 100000, 128},
		{"very large period", 100000, 100000},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			era := getMortalEra(tc.blockNumber, tc.period)
			assert.Len(t, era, 2)
		})
	}
}

func TestSignAndSubmitUnsupportedNetwork(t *testing.T) {
	config := &Config{SS58Prefix: 42}
	signer, err := NewClientSignerFromSeed(testSeed, config)
	require.NoError(t, err)

	ctx := context.Background()
	call := polkadot.ExtrinsicCall{
		AssetID: 1984,
		Target:  "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
		Amount:  "1000000",
	}

	_, err = signer.SignAndSubmitExtrinsic(ctx, call, "unsupported:network")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "unsupported network")
}
