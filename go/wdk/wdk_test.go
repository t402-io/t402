package wdk

import (
	"context"
	"math/big"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Test seed phrase for testing (DO NOT USE IN PRODUCTION)
const testSeedPhrase = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"

func TestGenerateSeedPhrase(t *testing.T) {
	tests := []struct {
		name     string
		numWords int
		wantLen  int
	}{
		{"12 words", 12, 12},
		{"15 words", 15, 15},
		{"18 words", 18, 18},
		{"21 words", 21, 21},
		{"24 words", 24, 24},
		{"default (12 words)", 0, 12},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			seed, err := GenerateSeedPhrase(tt.numWords)
			require.NoError(t, err)
			assert.True(t, ValidateSeedPhrase(seed))

			words := len(splitWords(seed))
			if tt.numWords == 0 {
				assert.Equal(t, 12, words)
			} else {
				assert.Equal(t, tt.wantLen, words)
			}
		})
	}
}

func TestValidateSeedPhrase(t *testing.T) {
	tests := []struct {
		name       string
		seedPhrase string
		want       bool
	}{
		{"valid 12 words", testSeedPhrase, true},
		{"empty string", "", false},
		{"11 words", "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon", false},
		{"13 words", "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about extra", false},
		{"random words", "hello world foo bar baz qux quux corge grault garply waldo fred", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ValidateSeedPhrase(tt.seedPhrase)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestNewSigner(t *testing.T) {
	t.Run("valid seed phrase", func(t *testing.T) {
		signer, err := NewSigner(testSeedPhrase, nil, 0)
		require.NoError(t, err)
		assert.NotNil(t, signer)
		assert.False(t, signer.IsInitialized())
	})

	t.Run("empty seed phrase", func(t *testing.T) {
		signer, err := NewSigner("", nil, 0)
		assert.Error(t, err)
		assert.Nil(t, signer)
	})

	t.Run("invalid seed phrase", func(t *testing.T) {
		signer, err := NewSigner("invalid seed phrase", nil, 0)
		assert.Error(t, err)
		assert.Nil(t, signer)
	})

	t.Run("with custom chains", func(t *testing.T) {
		chains := map[string]string{
			"arbitrum": "https://arb1.arbitrum.io/rpc",
			"base":     "https://mainnet.base.org",
		}
		signer, err := NewSigner(testSeedPhrase, chains, 0)
		require.NoError(t, err)
		assert.NotNil(t, signer)
		assert.True(t, signer.IsChainConfigured("arbitrum"))
		assert.True(t, signer.IsChainConfigured("base"))
		assert.False(t, signer.IsChainConfigured("ethereum"))
	})
}

func TestSignerInitialize(t *testing.T) {
	signer, err := NewSigner(testSeedPhrase, nil, 0)
	require.NoError(t, err)

	ctx := context.Background()
	err = signer.Initialize(ctx)
	require.NoError(t, err)
	assert.True(t, signer.IsInitialized())

	// Test idempotent initialization
	err = signer.Initialize(ctx)
	require.NoError(t, err)
}

func TestSignerGetAddress(t *testing.T) {
	signer, err := NewSigner(testSeedPhrase, nil, 0)
	require.NoError(t, err)

	ctx := context.Background()
	err = signer.Initialize(ctx)
	require.NoError(t, err)

	t.Run("EVM address", func(t *testing.T) {
		addr, err := signer.GetAddress(NetworkTypeEVM)
		require.NoError(t, err)
		assert.NotEmpty(t, addr)
		assert.True(t, len(addr) == 42) // 0x + 40 hex chars
		assert.Equal(t, "0x", addr[:2])
	})

	t.Run("not initialized", func(t *testing.T) {
		uninitSigner, _ := NewSigner(testSeedPhrase, nil, 0)
		_, err := uninitSigner.GetAddress(NetworkTypeEVM)
		assert.Error(t, err)
	})
}

func TestSignerGetEVMAddress(t *testing.T) {
	signer, err := NewSigner(testSeedPhrase, nil, 0)
	require.NoError(t, err)

	ctx := context.Background()
	err = signer.Initialize(ctx)
	require.NoError(t, err)

	addr, err := signer.GetEVMAddress()
	require.NoError(t, err)
	assert.NotEmpty(t, addr.Hex())

	// Known address for test seed phrase with account index 0
	// This is the standard derivation path m/44'/60'/0'/0/0
	expectedAddr := "0x9858EfFD232B4033E47d90003D41EC34EcaEda94"
	assert.Equal(t, expectedAddr, addr.Hex())
}

func TestSignerSignMessage(t *testing.T) {
	signer, err := NewSigner(testSeedPhrase, nil, 0)
	require.NoError(t, err)

	ctx := context.Background()
	err = signer.Initialize(ctx)
	require.NoError(t, err)

	t.Run("sign message", func(t *testing.T) {
		message := []byte("Hello, T402!")
		sig, err := signer.SignMessage(message)
		require.NoError(t, err)
		assert.Len(t, sig, 65) // r (32) + s (32) + v (1)
	})

	t.Run("not initialized", func(t *testing.T) {
		uninitSigner, _ := NewSigner(testSeedPhrase, nil, 0)
		_, err := uninitSigner.SignMessage([]byte("test"))
		assert.Error(t, err)
	})
}

func TestSignerGetConfiguredChains(t *testing.T) {
	chains := map[string]string{
		"arbitrum": "https://arb1.arbitrum.io/rpc",
		"base":     "https://mainnet.base.org",
	}
	signer, err := NewSigner(testSeedPhrase, chains, 0)
	require.NoError(t, err)

	configured := signer.GetConfiguredChains()
	assert.Len(t, configured, 2)
	assert.Contains(t, configured, "arbitrum")
	assert.Contains(t, configured, "base")
}

func TestSignerGetChainConfig(t *testing.T) {
	chains := map[string]string{
		"arbitrum": "https://custom-rpc.example.com",
	}
	signer, err := NewSigner(testSeedPhrase, chains, 0)
	require.NoError(t, err)

	config, ok := signer.GetChainConfig("arbitrum")
	assert.True(t, ok)
	assert.Equal(t, int64(42161), config.ChainID)
	assert.Equal(t, "eip155:42161", config.Network)
	assert.Equal(t, "https://custom-rpc.example.com", config.RPCURL)

	_, ok = signer.GetChainConfig("nonexistent")
	assert.False(t, ok)
}

func TestFormatTokenAmount(t *testing.T) {
	tests := []struct {
		name     string
		amount   *big.Int
		decimals int
		want     string
	}{
		{"zero", big.NewInt(0), 6, "0"},
		{"nil", nil, 6, "0"},
		{"1 USDC", big.NewInt(1000000), 6, "1"},
		{"1.5 USDC", big.NewInt(1500000), 6, "1.5"},
		{"0.000001 USDC", big.NewInt(1), 6, "0.000001"},
		{"123.456789 with 6 decimals", big.NewInt(123456789), 6, "123.456789"},
		{"1 ETH", big.NewInt(1000000000000000000), 18, "1"},
		{"0.1 ETH", big.NewInt(100000000000000000), 18, "0.1"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := FormatTokenAmount(tt.amount, tt.decimals)
			assert.Equal(t, tt.want, got)
		})
	}
}

// Chain configuration tests

func TestGetChainConfig(t *testing.T) {
	tests := []struct {
		chain   string
		wantOk  bool
		chainID int64
	}{
		{"ethereum", true, 1},
		{"arbitrum", true, 42161},
		{"base", true, 8453},
		{"polygon", true, 137},
		{"nonexistent", false, 0},
	}

	for _, tt := range tests {
		t.Run(tt.chain, func(t *testing.T) {
			config, ok := GetChainConfig(tt.chain)
			assert.Equal(t, tt.wantOk, ok)
			if ok {
				assert.Equal(t, tt.chainID, config.ChainID)
			}
		})
	}
}

func TestGetChainID(t *testing.T) {
	assert.Equal(t, int64(1), GetChainID("ethereum"))
	assert.Equal(t, int64(42161), GetChainID("arbitrum"))
	assert.Equal(t, int64(8453), GetChainID("base"))
	assert.Equal(t, int64(1), GetChainID("nonexistent")) // defaults to 1
}

func TestGetNetworkFromChain(t *testing.T) {
	assert.Equal(t, "eip155:1", GetNetworkFromChain("ethereum"))
	assert.Equal(t, "eip155:42161", GetNetworkFromChain("arbitrum"))
	assert.Equal(t, "eip155:8453", GetNetworkFromChain("base"))
	assert.Equal(t, "eip155:1", GetNetworkFromChain("nonexistent")) // defaults to eip155:1
}

func TestGetChainFromNetwork(t *testing.T) {
	chain, ok := GetChainFromNetwork("eip155:42161")
	assert.True(t, ok)
	assert.Equal(t, "arbitrum", chain)

	chain, ok = GetChainFromNetwork("eip155:8453")
	assert.True(t, ok)
	assert.Equal(t, "base", chain)

	_, ok = GetChainFromNetwork("eip155:99999")
	assert.False(t, ok)
}

func TestGetUSDT0Chains(t *testing.T) {
	chains := GetUSDT0Chains()
	assert.NotEmpty(t, chains)
	assert.Contains(t, chains, "ethereum")
	assert.Contains(t, chains, "arbitrum")
}

func TestGetChainTokens(t *testing.T) {
	tokens := GetChainTokens("arbitrum")
	assert.NotEmpty(t, tokens)

	// Should have USDT0 and USDC
	var hasUSDT0, hasUSDC bool
	for _, token := range tokens {
		if token.Symbol == "USDT0" {
			hasUSDT0 = true
		}
		if token.Symbol == "USDC" {
			hasUSDC = true
		}
	}
	assert.True(t, hasUSDT0)
	assert.True(t, hasUSDC)
}

func TestGetPreferredToken(t *testing.T) {
	// Arbitrum should prefer USDT0
	token := GetPreferredToken("arbitrum")
	require.NotNil(t, token)
	assert.Equal(t, "USDT0", token.Symbol)

	// Base should prefer USDC (no USDT0)
	token = GetPreferredToken("base")
	require.NotNil(t, token)
	assert.Equal(t, "USDC", token.Symbol)

	// Nonexistent chain
	token = GetPreferredToken("nonexistent")
	assert.Nil(t, token)
}

func TestGetTokenAddress(t *testing.T) {
	addr, ok := GetTokenAddress("arbitrum", "USDT0")
	assert.True(t, ok)
	assert.NotEmpty(t, addr)

	addr, ok = GetTokenAddress("base", "USDC")
	assert.True(t, ok)
	assert.Equal(t, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", addr)

	_, ok = GetTokenAddress("arbitrum", "NONEXISTENT")
	assert.False(t, ok)
}

func TestIsTestnet(t *testing.T) {
	assert.False(t, IsTestnet("ethereum"))
	assert.False(t, IsTestnet("arbitrum"))
	assert.True(t, IsTestnet("arbitrum-sepolia"))
	assert.True(t, IsTestnet("base-sepolia"))
}

func TestGetAllChains(t *testing.T) {
	chains := GetAllChains()
	assert.NotEmpty(t, chains)
	assert.Contains(t, chains, "ethereum")
	assert.Contains(t, chains, "arbitrum")
	assert.Contains(t, chains, "base")
}

func TestGetMainnetChains(t *testing.T) {
	chains := GetMainnetChains()
	assert.NotEmpty(t, chains)
	assert.Contains(t, chains, "ethereum")
	assert.Contains(t, chains, "arbitrum")
	assert.NotContains(t, chains, "arbitrum-sepolia")
	assert.NotContains(t, chains, "base-sepolia")
}

// Error tests

func TestWDKError(t *testing.T) {
	err := NewWDKError(ErrorCodeChainNotConfigured, "chain not found")
	assert.Equal(t, "[CHAIN_NOT_CONFIGURED] chain not found", err.Error())

	err = err.WithChain("arbitrum")
	assert.Equal(t, "[CHAIN_NOT_CONFIGURED] chain not found (chain: arbitrum)", err.Error())
	assert.Equal(t, "arbitrum", err.Chain)

	err = err.WithToken("0x1234")
	assert.Equal(t, "0x1234", err.Token)

	err = err.WithOperation("balance")
	assert.Equal(t, "balance", err.Operation)
}

func TestIsWDKError(t *testing.T) {
	wdkErr := NewWDKError(ErrorCodeChainNotConfigured, "test")
	assert.True(t, IsWDKError(wdkErr))

	stdErr := assert.AnError
	assert.False(t, IsWDKError(stdErr))
}

func TestGetWDKError(t *testing.T) {
	wdkErr := NewWDKError(ErrorCodeChainNotConfigured, "test")
	extracted, ok := GetWDKError(wdkErr)
	assert.True(t, ok)
	assert.Equal(t, wdkErr, extracted)

	_, ok = GetWDKError(assert.AnError)
	assert.False(t, ok)
}

// Helper function
func splitWords(s string) []string {
	var words []string
	word := ""
	for _, c := range s {
		if c == ' ' {
			if word != "" {
				words = append(words, word)
				word = ""
			}
		} else {
			word += string(c)
		}
	}
	if word != "" {
		words = append(words, word)
	}
	return words
}
