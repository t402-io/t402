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

func TestNewPimlicoBundlerClient(t *testing.T) {
	tests := []struct {
		name   string
		config PimlicoConfig
	}{
		{
			name: "with default URL",
			config: PimlicoConfig{
				APIKey:  "test-api-key",
				ChainID: 1,
			},
		},
		{
			name: "with custom URL",
			config: PimlicoConfig{
				APIKey:     "test-api-key",
				ChainID:    1,
				BundlerURL: "https://custom-bundler.example.com",
			},
		},
		{
			name: "with custom entry point",
			config: PimlicoConfig{
				APIKey:     "test-api-key",
				ChainID:    8453,
				EntryPoint: common.HexToAddress("0x1234567890123456789012345678901234567890"),
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := NewPimlicoBundlerClient(tt.config)
			require.NotNil(t, client)
			assert.Equal(t, tt.config.APIKey, client.apiKey)
			if tt.config.BundlerURL != "" {
				assert.Equal(t, tt.config.BundlerURL, client.pimlicoURL)
			} else {
				assert.Contains(t, client.pimlicoURL, "pimlico.io")
			}
		})
	}
}

func TestGetPimlicoNetwork(t *testing.T) {
	tests := []struct {
		chainID      int64
		wantNetwork  string
	}{
		{1, "ethereum"},
		{11155111, "sepolia"},
		{137, "polygon"},
		{10, "optimism"},
		{42161, "arbitrum"},
		{8453, "base"},
		{84532, "base-sepolia"},
		{999999, "999999"}, // Unknown chain returns chain ID as string
	}

	for _, tt := range tests {
		network := getPimlicoNetwork(tt.chainID)
		assert.Equal(t, tt.wantNetwork, network, "chainID: %d", tt.chainID)
	}
}

func TestPimlicoBundlerClientGetUserOperationGasPrice(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req map[string]interface{}
		json.NewDecoder(r.Body).Decode(&req)

		assert.Equal(t, "pimlico_getUserOperationGasPrice", req["method"])

		response := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      req["id"],
			"result": map[string]interface{}{
				"slow": map[string]string{
					"maxFeePerGas":         "0x3b9aca00",
					"maxPriorityFeePerGas": "0x77359400",
				},
				"standard": map[string]string{
					"maxFeePerGas":         "0x77359400",
					"maxPriorityFeePerGas": "0xb2d05e00",
				},
				"fast": map[string]string{
					"maxFeePerGas":         "0xb2d05e00",
					"maxPriorityFeePerGas": "0xee6b2800",
				},
			},
		}
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	client := NewPimlicoBundlerClient(PimlicoConfig{
		APIKey:     "test-key",
		ChainID:    1,
		BundlerURL: server.URL,
	})

	gasPrice, err := client.GetUserOperationGasPrice()
	require.NoError(t, err)
	require.NotNil(t, gasPrice)

	// Verify slow gas prices
	assert.Equal(t, big.NewInt(1000000000), gasPrice.Slow.MaxFeePerGas)
	assert.Equal(t, big.NewInt(2000000000), gasPrice.Slow.MaxPriorityFeePerGas)

	// Verify standard gas prices
	assert.Equal(t, big.NewInt(2000000000), gasPrice.Standard.MaxFeePerGas)
	assert.Equal(t, big.NewInt(3000000000), gasPrice.Standard.MaxPriorityFeePerGas)

	// Verify fast gas prices
	assert.Equal(t, big.NewInt(3000000000), gasPrice.Fast.MaxFeePerGas)
	assert.Equal(t, big.NewInt(4000000000), gasPrice.Fast.MaxPriorityFeePerGas)
}

func TestPimlicoBundlerClientSendCompressedUserOperation(t *testing.T) {
	expectedHash := "0x1234567890123456789012345678901234567890123456789012345678901234"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req map[string]interface{}
		json.NewDecoder(r.Body).Decode(&req)

		assert.Equal(t, "pimlico_sendCompressedUserOperation", req["method"])

		response := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      req["id"],
			"result":  expectedHash,
		}
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	client := NewPimlicoBundlerClient(PimlicoConfig{
		APIKey:     "test-key",
		ChainID:    1,
		BundlerURL: server.URL,
	})

	hash, err := client.SendCompressedUserOperation(
		[]byte{0x01, 0x02, 0x03},
		common.HexToAddress("0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"),
	)
	require.NoError(t, err)
	assert.Equal(t, common.HexToHash(expectedHash), hash)
}

func TestPimlicoBundlerClientGetUserOperationStatus(t *testing.T) {
	tests := []struct {
		name         string
		response     map[string]interface{}
		wantStatus   string
		wantTxHash   bool
	}{
		{
			name: "submitted status",
			response: map[string]interface{}{
				"status": "submitted",
			},
			wantStatus: "submitted",
			wantTxHash: false,
		},
		{
			name: "included status with tx hash",
			response: map[string]interface{}{
				"status":          "included",
				"transactionHash": "0xabcdef1234567890123456789012345678901234567890123456789012345678",
			},
			wantStatus: "included",
			wantTxHash: true,
		},
		{
			name: "not found status",
			response: map[string]interface{}{
				"status": "not_found",
			},
			wantStatus: "not_found",
			wantTxHash: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				var req map[string]interface{}
				json.NewDecoder(r.Body).Decode(&req)

				assert.Equal(t, "pimlico_getUserOperationStatus", req["method"])

				response := map[string]interface{}{
					"jsonrpc": "2.0",
					"id":      req["id"],
					"result":  tt.response,
				}
				json.NewEncoder(w).Encode(response)
			}))
			defer server.Close()

			client := NewPimlicoBundlerClient(PimlicoConfig{
				APIKey:     "test-key",
				ChainID:    1,
				BundlerURL: server.URL,
			})

			status, err := client.GetUserOperationStatus(common.HexToHash("0x1234"))
			require.NoError(t, err)
			require.NotNil(t, status)
			assert.Equal(t, tt.wantStatus, status.Status)
			if tt.wantTxHash {
				assert.NotEqual(t, common.Hash{}, status.TransactionHash)
			}
		})
	}
}

func TestPimlicoBundlerClientRPCError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"error": map[string]interface{}{
				"code":    -32600,
				"message": "invalid request",
			},
		}
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	client := NewPimlicoBundlerClient(PimlicoConfig{
		APIKey:     "test-key",
		ChainID:    1,
		BundlerURL: server.URL,
	})

	_, err := client.GetUserOperationGasPrice()
	require.Error(t, err)
	assert.Contains(t, err.Error(), "RPC error")
	assert.Contains(t, err.Error(), "invalid request")
}

func TestPimlicoBundlerClientInheritsGenericMethods(t *testing.T) {
	expectedHash := "0x1234567890123456789012345678901234567890123456789012345678901234"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req map[string]interface{}
		json.NewDecoder(r.Body).Decode(&req)

		response := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      req["id"],
		}

		switch req["method"] {
		case "eth_sendUserOperation":
			response["result"] = expectedHash
		case "eth_supportedEntryPoints":
			response["result"] = []string{EntryPointV07Address}
		}

		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	client := NewPimlicoBundlerClient(PimlicoConfig{
		APIKey:     "test-key",
		ChainID:    1,
		BundlerURL: server.URL,
	})

	// Test inherited SendUserOperation
	userOp := &UserOperation{
		Sender:               common.HexToAddress("0x1234567890123456789012345678901234567890"),
		Nonce:                big.NewInt(0),
		CallData:             []byte{},
		VerificationGasLimit: big.NewInt(150000),
		CallGasLimit:         big.NewInt(100000),
		PreVerificationGas:   big.NewInt(50000),
		MaxPriorityFeePerGas: big.NewInt(1000000000),
		MaxFeePerGas:         big.NewInt(10000000000),
		Signature:            []byte{0x01},
	}

	hash, err := client.SendUserOperation(userOp)
	require.NoError(t, err)
	assert.Equal(t, common.HexToHash(expectedHash), hash)

	// Test inherited GetSupportedEntryPoints
	entryPoints, err := client.GetSupportedEntryPoints()
	require.NoError(t, err)
	require.Len(t, entryPoints, 1)
	assert.Equal(t, common.HexToAddress(EntryPointV07Address), entryPoints[0])
}

func TestUserOperationStatus(t *testing.T) {
	status := &UserOperationStatus{
		Status:          "included",
		TransactionHash: common.HexToHash("0x1234567890123456789012345678901234567890123456789012345678901234"),
	}

	assert.Equal(t, "included", status.Status)
	assert.NotEqual(t, common.Hash{}, status.TransactionHash)
}

func TestPimlicoGasPrice(t *testing.T) {
	gasPrice := &PimlicoGasPrice{
		Slow: struct {
			MaxFeePerGas         *big.Int `json:"maxFeePerGas"`
			MaxPriorityFeePerGas *big.Int `json:"maxPriorityFeePerGas"`
		}{
			MaxFeePerGas:         big.NewInt(1000000000),
			MaxPriorityFeePerGas: big.NewInt(500000000),
		},
		Standard: struct {
			MaxFeePerGas         *big.Int `json:"maxFeePerGas"`
			MaxPriorityFeePerGas *big.Int `json:"maxPriorityFeePerGas"`
		}{
			MaxFeePerGas:         big.NewInt(2000000000),
			MaxPriorityFeePerGas: big.NewInt(1000000000),
		},
		Fast: struct {
			MaxFeePerGas         *big.Int `json:"maxFeePerGas"`
			MaxPriorityFeePerGas *big.Int `json:"maxPriorityFeePerGas"`
		}{
			MaxFeePerGas:         big.NewInt(3000000000),
			MaxPriorityFeePerGas: big.NewInt(1500000000),
		},
	}

	assert.Equal(t, big.NewInt(1000000000), gasPrice.Slow.MaxFeePerGas)
	assert.Equal(t, big.NewInt(2000000000), gasPrice.Standard.MaxFeePerGas)
	assert.Equal(t, big.NewInt(3000000000), gasPrice.Fast.MaxFeePerGas)
}
