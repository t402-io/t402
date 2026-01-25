package erc4337

import (
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewPimlicoPaymaster(t *testing.T) {
	tests := []struct {
		name   string
		config PimlicoPaymasterConfig
	}{
		{
			name: "with default URL",
			config: PimlicoPaymasterConfig{
				APIKey:  "test-api-key",
				ChainID: 1,
			},
		},
		{
			name: "with custom URL",
			config: PimlicoPaymasterConfig{
				APIKey:       "test-api-key",
				ChainID:      1,
				PaymasterURL: "https://custom-paymaster.example.com",
			},
		},
		{
			name: "with sponsorship policy",
			config: PimlicoPaymasterConfig{
				APIKey:              "test-api-key",
				ChainID:             8453,
				SponsorshipPolicyID: "policy-123",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			pm := NewPimlicoPaymaster(tt.config)
			require.NotNil(t, pm)
			assert.Equal(t, tt.config.APIKey, pm.apiKey)
			assert.Equal(t, tt.config.ChainID, pm.chainID)
			if tt.config.PaymasterURL != "" {
				assert.Equal(t, tt.config.PaymasterURL, pm.paymasterURL)
			} else {
				assert.Contains(t, pm.paymasterURL, "pimlico.io")
			}
		})
	}
}

func TestPimlicoPaymasterSponsorUserOperation(t *testing.T) {
	t.Run("V07 format response", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var req map[string]interface{}
			json.NewDecoder(r.Body).Decode(&req)

			assert.Equal(t, "pm_sponsorUserOperation", req["method"])

			response := map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      req["id"],
				"result": map[string]interface{}{
					"paymaster":                     "0x1234567890123456789012345678901234567890",
					"paymasterVerificationGasLimit": "0xc350",
					"paymasterPostOpGasLimit":       "0x61a8",
					"paymasterData":                 "0xabcdef",
				},
			}
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		pm := NewPimlicoPaymaster(PimlicoPaymasterConfig{
			APIKey:       "test-key",
			ChainID:      1,
			PaymasterURL: server.URL,
		})

		userOp := &UserOperation{
			Sender:               common.HexToAddress("0x1234567890123456789012345678901234567890"),
			Nonce:                big.NewInt(0),
			CallData:             []byte{0x01, 0x02},
			VerificationGasLimit: big.NewInt(150000),
			CallGasLimit:         big.NewInt(100000),
			PreVerificationGas:   big.NewInt(50000),
			MaxPriorityFeePerGas: big.NewInt(1000000000),
			MaxFeePerGas:         big.NewInt(10000000000),
		}

		data, err := pm.SponsorUserOperation(userOp)
		require.NoError(t, err)
		require.NotNil(t, data)
		assert.Equal(t, common.HexToAddress("0x1234567890123456789012345678901234567890"), data.Paymaster)
		assert.Equal(t, big.NewInt(50000), data.PaymasterVerificationGasLimit)
		assert.Equal(t, big.NewInt(25000), data.PaymasterPostOpGasLimit)
	})

	t.Run("V06 format response (paymasterAndData)", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			response := map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      1,
				"result": map[string]interface{}{
					"paymasterAndData": "0x1234567890123456789012345678901234567890abcdef",
				},
			}
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		pm := NewPimlicoPaymaster(PimlicoPaymasterConfig{
			APIKey:       "test-key",
			ChainID:      1,
			PaymasterURL: server.URL,
		})

		userOp := &UserOperation{
			Sender:   common.HexToAddress("0x1234567890123456789012345678901234567890"),
			Nonce:    big.NewInt(0),
			CallData: []byte{},
		}

		data, err := pm.SponsorUserOperation(userOp)
		require.NoError(t, err)
		require.NotNil(t, data)
		assert.Equal(t, common.HexToAddress("0x1234567890123456789012345678901234567890"), data.Paymaster)
	})
}

func TestPimlicoPaymasterGetTokenQuotes(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req map[string]interface{}
		json.NewDecoder(r.Body).Decode(&req)

		assert.Equal(t, "pimlico_getTokenQuotes", req["method"])

		response := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      req["id"],
			"result": []map[string]interface{}{
				{
					"token":        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
					"symbol":       "USDC",
					"decimals":     6,
					"fee":          "0x186a0",
					"exchangeRate": "0xde0b6b3a7640000",
				},
			},
		}
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	pm := NewPimlicoPaymaster(PimlicoPaymasterConfig{
		APIKey:       "test-key",
		ChainID:      1,
		PaymasterURL: server.URL,
	})

	userOp := &UserOperation{
		Sender:   common.HexToAddress("0x1234567890123456789012345678901234567890"),
		Nonce:    big.NewInt(0),
		CallData: []byte{},
	}

	quotes, err := pm.GetTokenQuotes(userOp, []common.Address{
		common.HexToAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
	})
	require.NoError(t, err)
	require.Len(t, quotes, 1)
	assert.Equal(t, "USDC", quotes[0].Symbol)
	assert.Equal(t, 6, quotes[0].Decimals)
}

func TestPimlicoPaymasterWillSponsor(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"result": map[string]interface{}{
				"paymaster": "0x1234567890123456789012345678901234567890",
			},
		}
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	pm := NewPimlicoPaymaster(PimlicoPaymasterConfig{
		APIKey:       "test-key",
		ChainID:      1,
		PaymasterURL: server.URL,
	})

	userOp := &UserOperation{
		Sender:   common.HexToAddress("0x1234567890123456789012345678901234567890"),
		Nonce:    big.NewInt(0),
		CallData: []byte{},
	}

	willSponsor, err := pm.WillSponsor(userOp, 1, common.HexToAddress(EntryPointV07Address))
	require.NoError(t, err)
	assert.True(t, willSponsor)
}

func TestNewBiconomyPaymaster(t *testing.T) {
	config := BiconomyPaymasterConfig{
		APIKey:       "test-api-key",
		ChainID:      137,
		PaymasterURL: "https://paymaster.biconomy.io",
		Mode:         "sponsored",
	}

	pm := NewBiconomyPaymaster(config)
	require.NotNil(t, pm)
	assert.Equal(t, config.APIKey, pm.apiKey)
	assert.Equal(t, config.ChainID, pm.chainID)
	assert.Equal(t, config.PaymasterURL, pm.paymasterURL)
	assert.Equal(t, config.Mode, pm.mode)
}

func TestBiconomyPaymasterGetPaymasterData(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify API key header
		assert.Equal(t, "test-api-key", r.Header.Get("x-api-key"))

		response := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"result": map[string]interface{}{
				"paymaster":                     "0x1234567890123456789012345678901234567890",
				"paymasterVerificationGasLimit": "0xc350",
				"paymasterPostOpGasLimit":       "0x61a8",
			},
		}
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	pm := NewBiconomyPaymaster(BiconomyPaymasterConfig{
		APIKey:       "test-api-key",
		ChainID:      137,
		PaymasterURL: server.URL,
		Mode:         "sponsored",
	})

	userOp := &UserOperation{
		Sender:   common.HexToAddress("0x1234567890123456789012345678901234567890"),
		Nonce:    big.NewInt(0),
		CallData: []byte{},
	}

	data, err := pm.GetPaymasterData(userOp, 137, common.HexToAddress(EntryPointV07Address))
	require.NoError(t, err)
	require.NotNil(t, data)
	assert.Equal(t, common.HexToAddress("0x1234567890123456789012345678901234567890"), data.Paymaster)
}

func TestNewStackupPaymaster(t *testing.T) {
	config := StackupPaymasterConfig{
		APIKey:       "test-api-key",
		ChainID:      1,
		PaymasterURL: "https://api.stackup.sh/v1/paymaster",
		Type:         "payg",
	}

	pm := NewStackupPaymaster(config)
	require.NotNil(t, pm)
	assert.Equal(t, config.APIKey, pm.apiKey)
	assert.Equal(t, config.ChainID, pm.chainID)
	assert.Equal(t, config.PaymasterURL, pm.paymasterURL)
	assert.Equal(t, config.Type, pm.pmType)
}

func TestStackupPaymasterGetPaymasterData(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify Authorization header
		assert.Equal(t, "Bearer test-api-key", r.Header.Get("Authorization"))

		var req map[string]interface{}
		json.NewDecoder(r.Body).Decode(&req)

		assert.Equal(t, "pm_getPaymasterStubData", req["method"])

		response := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      req["id"],
			"result": map[string]interface{}{
				"paymaster":                     "0x1234567890123456789012345678901234567890",
				"paymasterVerificationGasLimit": "0xc350",
				"paymasterPostOpGasLimit":       "0x61a8",
			},
		}
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	pm := NewStackupPaymaster(StackupPaymasterConfig{
		APIKey:       "test-api-key",
		ChainID:      1,
		PaymasterURL: server.URL,
		Type:         "payg",
	})

	userOp := &UserOperation{
		Sender:   common.HexToAddress("0x1234567890123456789012345678901234567890"),
		Nonce:    big.NewInt(0),
		CallData: []byte{},
	}

	data, err := pm.GetPaymasterData(userOp, 1, common.HexToAddress(EntryPointV07Address))
	require.NoError(t, err)
	require.NotNil(t, data)
	assert.Equal(t, common.HexToAddress("0x1234567890123456789012345678901234567890"), data.Paymaster)
}

func TestPackUserOpForPaymaster(t *testing.T) {
	t.Run("with all fields", func(t *testing.T) {
		userOp := &UserOperation{
			Sender:               common.HexToAddress("0x1234567890123456789012345678901234567890"),
			Nonce:                big.NewInt(5),
			InitCode:             []byte{0x01, 0x02, 0x03},
			CallData:             []byte{0xde, 0xad, 0xbe, 0xef},
			VerificationGasLimit: big.NewInt(150000),
			CallGasLimit:         big.NewInt(100000),
			PreVerificationGas:   big.NewInt(50000),
			MaxPriorityFeePerGas: big.NewInt(1000000000),
			MaxFeePerGas:         big.NewInt(10000000000),
			PaymasterAndData:     []byte{0xab, 0xcd},
			Signature:            []byte{0x12, 0x34},
		}

		packed := packUserOpForPaymaster(userOp)
		require.NotNil(t, packed)

		assert.Equal(t, "0x1234567890123456789012345678901234567890", packed["sender"])
		assert.Equal(t, "0x5", packed["nonce"])
		assert.Equal(t, "0x010203", packed["initCode"])
		assert.Equal(t, "0xdeadbeef", packed["callData"])
		assert.Equal(t, "0x249f0", packed["verificationGasLimit"])
		assert.Equal(t, "0x186a0", packed["callGasLimit"])
		assert.Equal(t, "0xc350", packed["preVerificationGas"])
		assert.Equal(t, "0x3b9aca00", packed["maxPriorityFeePerGas"])
		assert.Equal(t, "0x2540be400", packed["maxFeePerGas"])
		assert.Equal(t, "0xabcd", packed["paymasterAndData"])
		assert.Equal(t, "0x1234", packed["signature"])
	})

	t.Run("with nil fields uses defaults", func(t *testing.T) {
		userOp := &UserOperation{
			Sender: common.HexToAddress("0x1234567890123456789012345678901234567890"),
		}

		packed := packUserOpForPaymaster(userOp)
		require.NotNil(t, packed)

		// Should use defaults
		assert.Equal(t, "0x0", packed["nonce"])
		assert.Equal(t, "0x", packed["initCode"])
		assert.NotEmpty(t, packed["verificationGasLimit"])
		assert.NotEmpty(t, packed["callGasLimit"])
		assert.NotEmpty(t, packed["preVerificationGas"])
		// Should use dummy signature
		assert.NotEqual(t, "0x", packed["signature"])
	})
}

func TestPaymasterRPCError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"error": map[string]interface{}{
				"code":    -32000,
				"message": "sponsorship limit exceeded",
			},
		}
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	pm := NewPimlicoPaymaster(PimlicoPaymasterConfig{
		APIKey:       "test-key",
		ChainID:      1,
		PaymasterURL: server.URL,
	})

	userOp := &UserOperation{
		Sender:   common.HexToAddress("0x1234567890123456789012345678901234567890"),
		Nonce:    big.NewInt(0),
		CallData: []byte{},
	}

	_, err := pm.SponsorUserOperation(userOp)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "RPC error")
	assert.Contains(t, err.Error(), "sponsorship limit exceeded")
}
