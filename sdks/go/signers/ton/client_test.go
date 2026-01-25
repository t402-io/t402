package ton

import (
	"context"
	"math/big"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Test mnemonic for testing (DO NOT USE IN PRODUCTION)
const testMnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art"

func TestNewClientSignerFromMnemonic(t *testing.T) {
	// Skip if CI environment (requires network)
	if testing.Short() {
		t.Skip("Skipping network test in short mode")
	}

	config := &Config{
		Endpoint:  "testnet",
		Workchain: 0,
	}

	signer, err := NewClientSignerFromMnemonic(testMnemonic, config)
	require.NoError(t, err)
	require.NotNil(t, signer)

	// Address should be non-empty
	address := signer.Address()
	assert.NotEmpty(t, address)
	assert.Contains(t, address, ":") // TON addresses contain workchain:hash
}

func TestNewClientSignerFromPrivateKey(t *testing.T) {
	// Skip if CI environment (requires network)
	if testing.Short() {
		t.Skip("Skipping network test in short mode")
	}

	// Test private key (32 bytes seed in hex)
	testPrivateKeyHex := "0x0000000000000000000000000000000000000000000000000000000000000001"

	config := &Config{
		Endpoint:  "testnet",
		Workchain: 0,
	}

	signer, err := NewClientSignerFromPrivateKey(testPrivateKeyHex, config)
	require.NoError(t, err)
	require.NotNil(t, signer)

	address := signer.Address()
	assert.NotEmpty(t, address)
}

func TestNewClientSignerInvalidMnemonic(t *testing.T) {
	config := &Config{
		Endpoint:  "testnet",
		Workchain: 0,
	}

	// Invalid mnemonic (too few words)
	_, err := NewClientSignerFromMnemonic("abandon abandon abandon", config)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "expected 24 words")
}

func TestNewClientSignerInvalidPrivateKey(t *testing.T) {
	config := &Config{
		Endpoint:  "testnet",
		Workchain: 0,
	}

	// Invalid hex
	_, err := NewClientSignerFromPrivateKey("not-valid-hex", config)
	assert.Error(t, err)

	// Invalid length
	_, err = NewClientSignerFromPrivateKey("0x1234", config)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid private key length")
}

func TestBuildJettonTransferBody(t *testing.T) {
	// Test building a Jetton transfer body
	queryId := big.NewInt(12345)
	amount := big.NewInt(1000000) // 1 USDT (6 decimals)
	destination := "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs"
	responseDestination := "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs"
	forwardAmount := uint64(1)

	body, err := BuildJettonTransferBody(queryId, amount, destination, responseDestination, forwardAmount)
	require.NoError(t, err)
	assert.NotEmpty(t, body)

	// Body should be valid base64
	assert.Regexp(t, `^[A-Za-z0-9+/]+=*$`, body)
}

func TestBuildJettonTransferBodyInvalidAddress(t *testing.T) {
	queryId := big.NewInt(12345)
	amount := big.NewInt(1000000)
	forwardAmount := uint64(1)

	// Invalid destination
	_, err := BuildJettonTransferBody(queryId, amount, "invalid", "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs", forwardAmount)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid destination address")

	// Invalid response destination
	_, err = BuildJettonTransferBody(queryId, amount, "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs", "invalid", forwardAmount)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid response destination address")
}

func TestGenerateQueryId(t *testing.T) {
	// Generate multiple query IDs
	ids := make([]*big.Int, 10)
	for i := 0; i < 10; i++ {
		ids[i] = GenerateQueryId()
		time.Sleep(time.Millisecond) // Ensure different timestamps
	}

	// All IDs should be unique
	seen := make(map[string]bool)
	for _, id := range ids {
		idStr := id.String()
		assert.False(t, seen[idStr], "Duplicate query ID generated: %s", idStr)
		seen[idStr] = true
	}

	// All IDs should be positive
	for _, id := range ids {
		assert.True(t, id.Sign() > 0, "Query ID should be positive")
	}
}

func TestGetSeqno(t *testing.T) {
	// Skip if CI environment (requires network)
	if testing.Short() {
		t.Skip("Skipping network test in short mode")
	}

	config := &Config{
		Endpoint:  "testnet",
		Workchain: 0,
	}

	signer, err := NewClientSignerFromMnemonic(testMnemonic, config)
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Get seqno (may be 0 if wallet not deployed)
	seqno, err := signer.GetSeqno(ctx)
	require.NoError(t, err)
	assert.GreaterOrEqual(t, seqno, int64(0))
}

func TestGetJettonWalletAddress(t *testing.T) {
	// Skip if CI environment (requires network)
	if testing.Short() {
		t.Skip("Skipping network test in short mode")
	}

	config := &Config{
		Endpoint:  "testnet",
		Workchain: 0,
	}

	signer, err := NewClientSignerFromMnemonic(testMnemonic, config)
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Testnet USDT Jetton master address
	jettonMaster := "kQBqSpvo4S87mX9tTc4FX3Sfqf4uSp3Tx-Fz4RBUfTRWBx"

	cs, ok := signer.(*ClientSigner)
	require.True(t, ok)

	walletAddr, err := cs.GetJettonWalletAddress(ctx, signer.Address(), jettonMaster)
	require.NoError(t, err)
	assert.NotEmpty(t, walletAddr)
	assert.Contains(t, walletAddr, ":")
}

func TestConstants(t *testing.T) {
	// Verify constants match expected values
	assert.Equal(t, uint32(0x0f8a7ea5), uint32(JettonTransferOp))
	assert.Equal(t, uint64(100_000_000), uint64(DefaultGasAmount))
	assert.Equal(t, uint64(1), uint64(DefaultForwardAmount))
	assert.Equal(t, int64(300), int64(DefaultTimeout))
}
