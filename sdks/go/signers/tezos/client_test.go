package tezos

import (
	"context"
	"math/big"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/tezos"
)

// Test seed (DO NOT USE IN PRODUCTION)
const testSeed = "0000000000000000000000000000000000000000000000000000000000000001"

func TestNewClientSignerFromSeed(t *testing.T) {
	signer, err := NewClientSignerFromSeed(testSeed, nil)
	require.NoError(t, err)
	require.NotNil(t, signer)

	// Address should be valid tz1 address
	address := signer.Address()
	assert.True(t, tezos.IsValidAddress(address))
	assert.True(t, len(address) == 36)
	assert.True(t, address[:3] == "tz1")

	// Public key should have edpk prefix
	pubKey := signer.PublicKeyBase58()
	assert.True(t, len(pubKey) > 4)
	assert.Equal(t, "edpk", pubKey[:4])
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

func TestBase58CheckRoundTrip(t *testing.T) {
	// Test data
	data := []byte{1, 2, 3, 4, 5}
	prefix := []byte{6, 161, 159} // tz1 prefix

	// Encode
	encoded := base58CheckEncode(prefix, data)
	assert.NotEmpty(t, encoded)

	// Decode
	decoded, err := base58CheckDecode(encoded)
	require.NoError(t, err)

	// Should match original with prefix
	expected := append(prefix, data...)
	assert.Equal(t, expected, decoded)
}

func TestBase58Encode(t *testing.T) {
	tests := []struct {
		input    []byte
		expected string
	}{
		{[]byte{0}, "1"},
		{[]byte{0, 0}, "11"},
		{[]byte{1}, "2"},
		{[]byte{57}, "z"},
		{[]byte{58}, "21"},
	}

	for _, tc := range tests {
		result := base58Encode(tc.input)
		assert.Equal(t, tc.expected, result, "input: %v", tc.input)
	}
}

func TestBase58Decode(t *testing.T) {
	tests := []struct {
		input    string
		expected []byte
	}{
		{"1", []byte{0}},
		{"11", []byte{0, 0}},
		{"2", []byte{1}},
		{"z", []byte{57}},
		{"21", []byte{58}},
	}

	for _, tc := range tests {
		result, err := base58Decode(tc.input)
		require.NoError(t, err)
		assert.Equal(t, tc.expected, result, "input: %s", tc.input)
	}
}

func TestBase58DecodeInvalid(t *testing.T) {
	// Invalid character
	_, err := base58Decode("0") // 0 is not in Base58 alphabet
	assert.Error(t, err)

	_, err = base58Decode("O") // O is not in Base58 alphabet
	assert.Error(t, err)

	_, err = base58Decode("I") // I is not in Base58 alphabet
	assert.Error(t, err)

	_, err = base58Decode("l") // l is not in Base58 alphabet
	assert.Error(t, err)
}

func TestDeterministicAddressDerivation(t *testing.T) {
	// Same seed should produce same address
	signer1, err := NewClientSignerFromSeed(testSeed, nil)
	require.NoError(t, err)

	signer2, err := NewClientSignerFromSeed(testSeed, nil)
	require.NoError(t, err)

	assert.Equal(t, signer1.Address(), signer2.Address())
	assert.Equal(t, signer1.PublicKeyBase58(), signer2.PublicKeyBase58())
}

func TestBuildFA2TransferParams(t *testing.T) {
	params := buildFA2TransferParams(
		"tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
		"tz1aSkwEot3L2kmUvcoxzjMomb9mvBNuzFK6",
		0,
		"1000000",
	)

	// Should be a list
	paramList, ok := params.([]interface{})
	require.True(t, ok)
	assert.Len(t, paramList, 1)
}

func TestGetBalance(t *testing.T) {
	// Skip if CI environment (requires network)
	if testing.Short() {
		t.Skip("Skipping network test in short mode")
	}

	signer, err := NewClientSignerFromSeed(testSeed, nil)
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Get balance for USDT on mainnet
	balance, err := signer.GetBalance(ctx, tezos.USDTMainnet.ContractAddress, tezos.USDTMainnet.TokenID)
	require.NoError(t, err)

	// Balance should be a valid number string
	_, ok := new(big.Int).SetString(balance, 10)
	assert.True(t, ok)
}

func TestTransfer(t *testing.T) {
	// Skip if CI environment (requires network)
	if testing.Short() {
		t.Skip("Skipping network test in short mode")
	}

	signer, err := NewClientSignerFromSeed(testSeed, nil)
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// This will fail because the test account doesn't have funds
	// but it tests the operation building logic
	_, err = signer.Transfer(
		ctx,
		tezos.USDTMainnet.ContractAddress,
		tezos.USDTMainnet.TokenID,
		"tz1aSkwEot3L2kmUvcoxzjMomb9mvBNuzFK6",
		big.NewInt(1000000),
		t402.Network(tezos.TezosMainnetCAIP2),
	)

	// We expect an error because the test account doesn't have funds
	assert.Error(t, err)
}
