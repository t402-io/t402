package erc4337

import (
	"encoding/hex"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewBundlerClient(t *testing.T) {
	tests := []struct {
		name       string
		config     BundlerConfig
		wantEntry  common.Address
	}{
		{
			name: "with default entry point",
			config: BundlerConfig{
				BundlerURL: "https://bundler.example.com",
				ChainID:    1,
			},
			wantEntry: common.HexToAddress(EntryPointV07Address),
		},
		{
			name: "with custom entry point",
			config: BundlerConfig{
				BundlerURL: "https://bundler.example.com",
				ChainID:    1,
				EntryPoint: common.HexToAddress("0x1234567890123456789012345678901234567890"),
			},
			wantEntry: common.HexToAddress("0x1234567890123456789012345678901234567890"),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := NewBundlerClient(tt.config)
			require.NotNil(t, client)
			assert.Equal(t, tt.config.BundlerURL, client.bundlerURL)
			assert.Equal(t, tt.config.ChainID, client.chainID)
			assert.Equal(t, tt.wantEntry, client.entryPoint)
		})
	}
}

func TestBigIntToHex(t *testing.T) {
	tests := []struct {
		input    *big.Int
		expected string
	}{
		{nil, "0x0"},
		{big.NewInt(0), "0x0"},
		{big.NewInt(1), "0x1"},
		{big.NewInt(255), "0xff"},
		{big.NewInt(256), "0x100"},
		{big.NewInt(1000000), "0xf4240"},
	}

	for _, tt := range tests {
		result := bigIntToHex(tt.input)
		assert.Equal(t, tt.expected, result, "input: %v", tt.input)
	}
}

func TestBytesToHex(t *testing.T) {
	tests := []struct {
		input    []byte
		expected string
	}{
		{nil, "0x"},
		{[]byte{}, "0x"},
		{[]byte{0x00}, "0x00"},
		{[]byte{0x01, 0x02, 0x03}, "0x010203"},
		{[]byte{0xde, 0xad, 0xbe, 0xef}, "0xdeadbeef"},
	}

	for _, tt := range tests {
		result := bytesToHex(tt.input)
		assert.Equal(t, tt.expected, result, "input: %v", tt.input)
	}
}

func TestHexToBigInt(t *testing.T) {
	tests := []struct {
		input    string
		expected *big.Int
	}{
		{"", big.NewInt(0)},
		{"0x", big.NewInt(0)},
		{"0x0", big.NewInt(0)},
		{"0x1", big.NewInt(1)},
		{"0xff", big.NewInt(255)},
		{"0x100", big.NewInt(256)},
		{"0xf4240", big.NewInt(1000000)},
		{"f4240", big.NewInt(1000000)}, // without 0x prefix
	}

	for _, tt := range tests {
		result := hexToBigInt(tt.input)
		assert.Equal(t, 0, result.Cmp(tt.expected), "input: %s", tt.input)
	}
}

func TestHexToBytes(t *testing.T) {
	tests := []struct {
		input    string
		expected []byte
	}{
		{"", nil},
		{"0x", nil},
		{"0x00", []byte{0x00}},
		{"0x010203", []byte{0x01, 0x02, 0x03}},
		{"0xdeadbeef", []byte{0xde, 0xad, 0xbe, 0xef}},
		{"deadbeef", []byte{0xde, 0xad, 0xbe, 0xef}}, // without 0x prefix
	}

	for _, tt := range tests {
		result := hexToBytes(tt.input)
		assert.Equal(t, tt.expected, result, "input: %s", tt.input)
	}
}

func TestParseUserOp(t *testing.T) {
	data := map[string]interface{}{
		"sender":               "0x1234567890123456789012345678901234567890",
		"nonce":                "0x1",
		"initCode":             "0x",
		"callData":             "0xdeadbeef",
		"verificationGasLimit": "0x186a0",
		"callGasLimit":         "0x186a0",
		"preVerificationGas":   "0xc350",
		"maxPriorityFeePerGas": "0x3b9aca00",
		"maxFeePerGas":         "0x2540be400",
		"paymasterAndData":     "0x",
		"signature":            "0xabcdef",
	}

	userOp := parseUserOp(data)
	require.NotNil(t, userOp)
	assert.Equal(t, common.HexToAddress("0x1234567890123456789012345678901234567890"), userOp.Sender)
	assert.Equal(t, big.NewInt(1), userOp.Nonce)
	assert.Equal(t, []byte{0xde, 0xad, 0xbe, 0xef}, userOp.CallData)
	assert.Equal(t, big.NewInt(100000), userOp.VerificationGasLimit)
	assert.Equal(t, big.NewInt(100000), userOp.CallGasLimit)
	assert.Equal(t, big.NewInt(50000), userOp.PreVerificationGas)
	assert.Equal(t, big.NewInt(1000000000), userOp.MaxPriorityFeePerGas)
	assert.Equal(t, big.NewInt(10000000000), userOp.MaxFeePerGas)
}

func TestPackUserOp(t *testing.T) {
	userOp := &UserOperation{
		Sender:               common.HexToAddress("0x1234567890123456789012345678901234567890"),
		Nonce:                big.NewInt(1),
		InitCode:             []byte{},
		CallData:             []byte{0xde, 0xad, 0xbe, 0xef},
		VerificationGasLimit: big.NewInt(150000),
		CallGasLimit:         big.NewInt(100000),
		PreVerificationGas:   big.NewInt(50000),
		MaxPriorityFeePerGas: big.NewInt(1000000000),
		MaxFeePerGas:         big.NewInt(10000000000),
		PaymasterAndData:     []byte{},
		Signature:            []byte{0x01, 0x02, 0x03},
	}

	client := NewBundlerClient(BundlerConfig{
		BundlerURL: "https://bundler.example.com",
		ChainID:    1,
	})

	packed := client.packUserOp(userOp)
	require.NotNil(t, packed)

	// Check that all expected fields are present
	assert.Equal(t, "0x1234567890123456789012345678901234567890", packed["sender"])
	assert.Equal(t, "0x1", packed["nonce"])
	assert.Equal(t, "0x", packed["initCode"])
	assert.Equal(t, "0xdeadbeef", packed["callData"])
	assert.Contains(t, packed, "accountGasLimits")
	assert.Contains(t, packed, "preVerificationGas")
	assert.Contains(t, packed, "gasFees")
	assert.Equal(t, "0x", packed["paymasterAndData"])
	assert.Equal(t, "0x010203", packed["signature"])
}

func TestBundlerClientWithMockServer(t *testing.T) {
	t.Run("SendUserOperation", func(t *testing.T) {
		expectedHash := "0x1234567890123456789012345678901234567890123456789012345678901234"

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var req map[string]interface{}
			json.NewDecoder(r.Body).Decode(&req)

			assert.Equal(t, "eth_sendUserOperation", req["method"])

			response := map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      req["id"],
				"result":  expectedHash,
			}
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		client := NewBundlerClient(BundlerConfig{
			BundlerURL: server.URL,
			ChainID:    1,
		})

		userOp := &UserOperation{
			Sender:               common.HexToAddress("0x1234567890123456789012345678901234567890"),
			Nonce:                big.NewInt(0),
			InitCode:             []byte{},
			CallData:             []byte{},
			VerificationGasLimit: big.NewInt(150000),
			CallGasLimit:         big.NewInt(100000),
			PreVerificationGas:   big.NewInt(50000),
			MaxPriorityFeePerGas: big.NewInt(1000000000),
			MaxFeePerGas:         big.NewInt(10000000000),
			PaymasterAndData:     []byte{},
			Signature:            []byte{0x01},
		}

		hash, err := client.SendUserOperation(userOp)
		require.NoError(t, err)
		assert.Equal(t, common.HexToHash(expectedHash), hash)
	})

	t.Run("EstimateUserOperationGas", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var req map[string]interface{}
			json.NewDecoder(r.Body).Decode(&req)

			assert.Equal(t, "eth_estimateUserOperationGas", req["method"])

			response := map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      req["id"],
				"result": map[string]string{
					"verificationGasLimit": "0x186a0",
					"callGasLimit":         "0x186a0",
					"preVerificationGas":   "0xc350",
				},
			}
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		client := NewBundlerClient(BundlerConfig{
			BundlerURL: server.URL,
			ChainID:    1,
		})

		userOp := &UserOperation{
			Sender:               common.HexToAddress("0x1234567890123456789012345678901234567890"),
			Nonce:                big.NewInt(0),
			InitCode:             []byte{},
			CallData:             []byte{},
			VerificationGasLimit: big.NewInt(0),
			CallGasLimit:         big.NewInt(0),
			PreVerificationGas:   big.NewInt(0),
			MaxPriorityFeePerGas: big.NewInt(1000000000),
			MaxFeePerGas:         big.NewInt(10000000000),
			PaymasterAndData:     []byte{},
			Signature:            []byte{},
		}

		estimate, err := client.EstimateUserOperationGas(userOp)
		require.NoError(t, err)
		assert.Equal(t, big.NewInt(100000), estimate.VerificationGasLimit)
		assert.Equal(t, big.NewInt(100000), estimate.CallGasLimit)
		assert.Equal(t, big.NewInt(50000), estimate.PreVerificationGas)
	})

	t.Run("GetSupportedEntryPoints", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var req map[string]interface{}
			json.NewDecoder(r.Body).Decode(&req)

			assert.Equal(t, "eth_supportedEntryPoints", req["method"])

			response := map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      req["id"],
				"result": []string{
					EntryPointV07Address,
					EntryPointV06Address,
				},
			}
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		client := NewBundlerClient(BundlerConfig{
			BundlerURL: server.URL,
			ChainID:    1,
		})

		entryPoints, err := client.GetSupportedEntryPoints()
		require.NoError(t, err)
		assert.Len(t, entryPoints, 2)
		assert.Equal(t, common.HexToAddress(EntryPointV07Address), entryPoints[0])
		assert.Equal(t, common.HexToAddress(EntryPointV06Address), entryPoints[1])
	})

	t.Run("GetUserOperationReceipt", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var req map[string]interface{}
			json.NewDecoder(r.Body).Decode(&req)

			assert.Equal(t, "eth_getUserOperationReceipt", req["method"])

			response := map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      req["id"],
				"result": map[string]interface{}{
					"userOpHash":    "0x1234567890123456789012345678901234567890123456789012345678901234",
					"sender":        "0x1234567890123456789012345678901234567890",
					"nonce":         "0x1",
					"actualGasCost": "0x12345",
					"actualGasUsed": "0x6789",
					"success":       true,
					"receipt": map[string]interface{}{
						"transactionHash": "0xabcdef1234567890123456789012345678901234567890123456789012345678",
						"blockNumber":     "0x100",
						"blockHash":       "0x9876543210987654321098765432109876543210987654321098765432109876",
					},
				},
			}
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		client := NewBundlerClient(BundlerConfig{
			BundlerURL: server.URL,
			ChainID:    1,
		})

		receipt, err := client.GetUserOperationReceipt(common.HexToHash("0x1234"))
		require.NoError(t, err)
		require.NotNil(t, receipt)
		assert.True(t, receipt.Success)
		assert.Equal(t, big.NewInt(256), receipt.Receipt.BlockNumber)
	})

	t.Run("GetUserOperationByHash", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var req map[string]interface{}
			json.NewDecoder(r.Body).Decode(&req)

			assert.Equal(t, "eth_getUserOperationByHash", req["method"])

			response := map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      req["id"],
				"result": map[string]interface{}{
					"userOperation": map[string]interface{}{
						"sender":               "0x1234567890123456789012345678901234567890",
						"nonce":                "0x5",
						"initCode":             "0x",
						"callData":             "0xdeadbeef",
						"verificationGasLimit": "0x186a0",
						"callGasLimit":         "0x186a0",
						"preVerificationGas":   "0xc350",
						"maxPriorityFeePerGas": "0x3b9aca00",
						"maxFeePerGas":         "0x2540be400",
						"paymasterAndData":     "0x",
						"signature":            "0xabcdef",
					},
					"entryPoint": EntryPointV07Address,
				},
			}
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		client := NewBundlerClient(BundlerConfig{
			BundlerURL: server.URL,
			ChainID:    1,
		})

		userOp, err := client.GetUserOperationByHash(common.HexToHash("0x1234"))
		require.NoError(t, err)
		require.NotNil(t, userOp)
		assert.Equal(t, big.NewInt(5), userOp.Nonce)
		assert.Equal(t, []byte{0xde, 0xad, 0xbe, 0xef}, userOp.CallData)
	})

	t.Run("RPC Error", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var req map[string]interface{}
			json.NewDecoder(r.Body).Decode(&req)

			response := map[string]interface{}{
				"jsonrpc": "2.0",
				"id":      req["id"],
				"error": map[string]interface{}{
					"code":    -32000,
					"message": "execution reverted",
				},
			}
			json.NewEncoder(w).Encode(response)
		}))
		defer server.Close()

		client := NewBundlerClient(BundlerConfig{
			BundlerURL: server.URL,
			ChainID:    1,
		})

		_, err := client.GetSupportedEntryPoints()
		require.Error(t, err)
		assert.Contains(t, err.Error(), "RPC error")
		assert.Contains(t, err.Error(), "execution reverted")
	})
}

func TestBundlerMethods(t *testing.T) {
	assert.Equal(t, "eth_sendUserOperation", BundlerMethods.SendUserOperation)
	assert.Equal(t, "eth_estimateUserOperationGas", BundlerMethods.EstimateUserOperationGas)
	assert.Equal(t, "eth_getUserOperationByHash", BundlerMethods.GetUserOperationByHash)
	assert.Equal(t, "eth_getUserOperationReceipt", BundlerMethods.GetUserOperationReceipt)
	assert.Equal(t, "eth_supportedEntryPoints", BundlerMethods.SupportedEntryPoints)
	assert.Equal(t, "eth_chainId", BundlerMethods.ChainID)
}

func TestHexConversionRoundTrip(t *testing.T) {
	// Test big.Int round trip
	original := big.NewInt(123456789)
	hexStr := bigIntToHex(original)
	restored := hexToBigInt(hexStr)
	assert.Equal(t, 0, original.Cmp(restored))

	// Test bytes round trip
	originalBytes := []byte{0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef}
	hexBytesStr := bytesToHex(originalBytes)
	restoredBytes := hexToBytes(hexBytesStr)
	assert.Equal(t, originalBytes, restoredBytes)
}

func TestGetUserOperationByHashNotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"result": map[string]interface{}{
				"userOperation": nil,
				"entryPoint":    "",
			},
		}
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	client := NewBundlerClient(BundlerConfig{
		BundlerURL: server.URL,
		ChainID:    1,
	})

	userOp, err := client.GetUserOperationByHash(common.HexToHash("0x1234"))
	require.NoError(t, err)
	assert.Nil(t, userOp)
}

func TestGetUserOperationReceiptNotFound(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		response := map[string]interface{}{
			"jsonrpc": "2.0",
			"id":      1,
			"result": map[string]interface{}{
				"userOpHash": "",
			},
		}
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	client := NewBundlerClient(BundlerConfig{
		BundlerURL: server.URL,
		ChainID:    1,
	})

	receipt, err := client.GetUserOperationReceipt(common.HexToHash("0x1234"))
	require.NoError(t, err)
	assert.Nil(t, receipt)
}

func TestParseUserOpEmptyData(t *testing.T) {
	// Test with empty map
	userOp := parseUserOp(map[string]interface{}{})
	require.NotNil(t, userOp)
	assert.Equal(t, common.Address{}, userOp.Sender)
	assert.Nil(t, userOp.Nonce)
}

func TestBytesToHexAndBack(t *testing.T) {
	// Special case: hex encoding should preserve leading zeros
	data := []byte{0x00, 0x01, 0x02}
	hexStr := bytesToHex(data)
	assert.Equal(t, "0x000102", hexStr)

	// Decode it back
	decoded := hexToBytes(hexStr)
	assert.Equal(t, data, decoded)
}

// Ensure unused import is utilized
var _ = hex.EncodeToString
