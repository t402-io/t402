package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"math/big"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConstants(t *testing.T) {
	t.Run("ChainIDs", func(t *testing.T) {
		assert.Equal(t, int64(1), ChainIDs[NetworkEthereum])
		assert.Equal(t, int64(8453), ChainIDs[NetworkBase])
		assert.Equal(t, int64(42161), ChainIDs[NetworkArbitrum])
	})

	t.Run("NativeSymbols", func(t *testing.T) {
		assert.Equal(t, "ETH", NativeSymbols[NetworkEthereum])
		assert.Equal(t, "MATIC", NativeSymbols[NetworkPolygon])
		assert.Equal(t, "AVAX", NativeSymbols[NetworkAvalanche])
	})

	t.Run("ExplorerURLs", func(t *testing.T) {
		assert.Equal(t, "https://etherscan.io", ExplorerURLs[NetworkEthereum])
		assert.Equal(t, "https://basescan.org", ExplorerURLs[NetworkBase])
	})

	t.Run("USDCAddresses", func(t *testing.T) {
		addr, ok := GetTokenAddress(NetworkEthereum, TokenUSDC)
		assert.True(t, ok)
		assert.True(t, strings.HasPrefix(addr, "0x"))
		assert.Equal(t, 42, len(addr))
	})
}

func TestIsValidNetwork(t *testing.T) {
	assert.True(t, IsValidNetwork("ethereum"))
	assert.True(t, IsValidNetwork("base"))
	assert.True(t, IsValidNetwork("arbitrum"))
	assert.False(t, IsValidNetwork("invalid"))
	assert.False(t, IsValidNetwork(""))
}

func TestIsBridgeableChain(t *testing.T) {
	assert.True(t, IsBridgeableChain("ethereum"))
	assert.True(t, IsBridgeableChain("arbitrum"))
	assert.True(t, IsBridgeableChain("ink"))
	assert.False(t, IsBridgeableChain("base")) // Not in bridgeable list
	assert.False(t, IsBridgeableChain("invalid"))
}

func TestIsGaslessNetwork(t *testing.T) {
	assert.True(t, IsGaslessNetwork("ethereum"))
	assert.True(t, IsGaslessNetwork("base"))
	assert.True(t, IsGaslessNetwork("arbitrum"))
	assert.False(t, IsGaslessNetwork("ink"))
	assert.False(t, IsGaslessNetwork("invalid"))
}

func TestGetTokenAddress(t *testing.T) {
	t.Run("USDC on Ethereum", func(t *testing.T) {
		addr, ok := GetTokenAddress(NetworkEthereum, TokenUSDC)
		assert.True(t, ok)
		assert.Equal(t, "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", addr)
	})

	t.Run("USDT on Arbitrum", func(t *testing.T) {
		addr, ok := GetTokenAddress(NetworkArbitrum, TokenUSDT)
		assert.True(t, ok)
		assert.NotEmpty(t, addr)
	})

	t.Run("USDT0 on Ink", func(t *testing.T) {
		addr, ok := GetTokenAddress(NetworkInk, TokenUSDT0)
		assert.True(t, ok)
		assert.NotEmpty(t, addr)
	})

	t.Run("Unsupported token", func(t *testing.T) {
		_, ok := GetTokenAddress(NetworkBase, TokenUSDT)
		assert.False(t, ok) // Base doesn't have USDT
	})
}

func TestGetExplorerTxURL(t *testing.T) {
	url := GetExplorerTxURL(NetworkEthereum, "0x1234")
	assert.Equal(t, "https://etherscan.io/tx/0x1234", url)

	url = GetExplorerTxURL(NetworkArbitrum, "0xabcd")
	assert.Equal(t, "https://arbiscan.io/tx/0xabcd", url)
}

func TestGetRPCURL(t *testing.T) {
	t.Run("Default URL", func(t *testing.T) {
		url := GetRPCURL(nil, NetworkEthereum)
		assert.Equal(t, "https://eth.llamarpc.com", url)
	})

	t.Run("Custom URL", func(t *testing.T) {
		config := &ServerConfig{
			RPCURLs: map[string]string{
				"ethereum": "https://custom.rpc.com",
			},
		}
		url := GetRPCURL(config, NetworkEthereum)
		assert.Equal(t, "https://custom.rpc.com", url)
	})

	t.Run("Fallback to default", func(t *testing.T) {
		config := &ServerConfig{
			RPCURLs: map[string]string{},
		}
		url := GetRPCURL(config, NetworkBase)
		assert.Equal(t, "https://mainnet.base.org", url)
	})
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
		{"1 ETH", big.NewInt(1000000000000000000), 18, "1"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := FormatTokenAmount(tt.amount, tt.decimals)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestParseTokenAmount(t *testing.T) {
	tests := []struct {
		name     string
		amount   string
		decimals int
		want     *big.Int
		wantErr  bool
	}{
		{"whole number", "1", 6, big.NewInt(1000000), false},
		{"with decimals", "1.5", 6, big.NewInt(1500000), false},
		{"small amount", "0.000001", 6, big.NewInt(1), false},
		{"large amount", "1000000", 6, big.NewInt(1000000000000), false},
		{"invalid", "abc", 6, nil, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseTokenAmount(tt.amount, tt.decimals)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, 0, got.Cmp(tt.want))
			}
		})
	}
}

func TestAllNetworks(t *testing.T) {
	networks := AllNetworks()
	assert.Len(t, networks, 9)
	assert.Contains(t, networks, NetworkEthereum)
	assert.Contains(t, networks, NetworkBase)
	assert.Contains(t, networks, NetworkArbitrum)
}

func TestGetToolDefinitions(t *testing.T) {
	tools := GetToolDefinitions()
	assert.Len(t, tools, 6)

	toolNames := make(map[string]bool)
	for _, tool := range tools {
		toolNames[tool.Name] = true
	}

	assert.True(t, toolNames["t402/getBalance"])
	assert.True(t, toolNames["t402/getAllBalances"])
	assert.True(t, toolNames["t402/pay"])
	assert.True(t, toolNames["t402/payGasless"])
	assert.True(t, toolNames["t402/getBridgeFee"])
	assert.True(t, toolNames["t402/bridge"])
}

func TestToolDefinitionSchemas(t *testing.T) {
	tools := GetToolDefinitions()

	for _, tool := range tools {
		t.Run(tool.Name, func(t *testing.T) {
			assert.NotEmpty(t, tool.Description)
			assert.Equal(t, "object", tool.InputSchema.Type)
			assert.NotEmpty(t, tool.InputSchema.Properties)
			assert.NotEmpty(t, tool.InputSchema.Required)

			// Verify all required fields exist in properties
			for _, req := range tool.InputSchema.Required {
				_, ok := tool.InputSchema.Properties[req]
				assert.True(t, ok, "Required field %s not in properties", req)
			}
		})
	}
}

func TestServerInitialize(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	inputData := `{"jsonrpc":"2.0","id":1,"method":"initialize"}` + "\n"

	// Use a pipe to provide input that signals EOF after the request
	pr, pw := io.Pipe()
	go func() {
		pw.Write([]byte(inputData))
		pw.Close() // Signal EOF after writing
	}()

	output := &bytes.Buffer{}
	server := NewServerWithIO(config, pr, output)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_ = server.Run(ctx)

	// Parse response
	var response JSONRPCResponse
	err := json.Unmarshal(output.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, "2.0", response.JSONRPC)
	assert.Nil(t, response.Error)

	result, ok := response.Result.(map[string]any)
	require.True(t, ok)

	serverInfo, ok := result["serverInfo"].(map[string]any)
	require.True(t, ok)
	assert.Equal(t, "t402", serverInfo["name"])
}

func TestServerListTools(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	inputData := `{"jsonrpc":"2.0","id":2,"method":"tools/list"}` + "\n"

	// Use a pipe to provide input that signals EOF after the request
	pr, pw := io.Pipe()
	go func() {
		pw.Write([]byte(inputData))
		pw.Close() // Signal EOF after writing
	}()

	output := &bytes.Buffer{}
	server := NewServerWithIO(config, pr, output)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_ = server.Run(ctx)

	var response JSONRPCResponse
	err := json.Unmarshal(output.Bytes(), &response)
	require.NoError(t, err)

	result, ok := response.Result.(map[string]any)
	require.True(t, ok)

	tools, ok := result["tools"].([]any)
	require.True(t, ok)
	assert.Len(t, tools, 6)
}

func TestServerCallToolGetBalance(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	params := `{"name":"t402/getBalance","arguments":{"address":"0x1234567890abcdef1234567890abcdef12345678","network":"ethereum"}}`
	inputData := `{"jsonrpc":"2.0","id":3,"method":"tools/call","params":` + params + `}` + "\n"

	// Use a pipe to provide input that signals EOF after the request
	pr, pw := io.Pipe()
	go func() {
		pw.Write([]byte(inputData))
		pw.Close() // Signal EOF after writing
	}()

	output := &bytes.Buffer{}
	server := NewServerWithIO(config, pr, output)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_ = server.Run(ctx)

	var response JSONRPCResponse
	err := json.Unmarshal(output.Bytes(), &response)
	require.NoError(t, err)

	// The result should be a ToolResult
	result, ok := response.Result.(*ToolResult)
	if !ok {
		// It might be a map due to JSON unmarshaling
		resultMap, mapOk := response.Result.(map[string]any)
		require.True(t, mapOk)
		content, contentOk := resultMap["content"].([]any)
		require.True(t, contentOk)
		assert.NotEmpty(t, content)
	} else {
		assert.NotEmpty(t, result.Content)
	}
}

func TestServerCallToolInvalidTool(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	params := `{"name":"t402/invalid","arguments":{}}`
	inputData := `{"jsonrpc":"2.0","id":4,"method":"tools/call","params":` + params + `}` + "\n"

	// Use a pipe to provide input that signals EOF after the request
	pr, pw := io.Pipe()
	go func() {
		pw.Write([]byte(inputData))
		pw.Close() // Signal EOF after writing
	}()

	output := &bytes.Buffer{}
	server := NewServerWithIO(config, pr, output)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_ = server.Run(ctx)

	var response JSONRPCResponse
	err := json.Unmarshal(output.Bytes(), &response)
	require.NoError(t, err)

	// Should return error in ToolResult
	resultMap, ok := response.Result.(map[string]any)
	require.True(t, ok)
	isError, _ := resultMap["isError"].(bool)
	assert.True(t, isError)
}

func TestLoadConfigFromEnv(t *testing.T) {
	// Save and restore env
	t.Setenv("T402_PRIVATE_KEY", "0x1234")
	t.Setenv("T402_DEMO_MODE", "true")
	t.Setenv("T402_BUNDLER_URL", "https://bundler.example.com")

	config := LoadConfigFromEnv()

	assert.Equal(t, "0x1234", config.PrivateKey)
	assert.True(t, config.DemoMode)
	assert.Equal(t, "https://bundler.example.com", config.BundlerURL)
}

// Type tests

func TestGetBridgeFeeInputJSON(t *testing.T) {
	params := GetBridgeFeeInput{
		FromChain: "arbitrum",
		ToChain:   "ethereum",
		Amount:    "100",
		Recipient: "0x1234567890abcdef1234567890abcdef12345678",
	}

	data, err := json.Marshal(params)
	require.NoError(t, err)

	var decoded GetBridgeFeeInput
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, params, decoded)
}

func TestPayInputJSON(t *testing.T) {
	input := PayInput{
		To:      "0x1234567890abcdef1234567890abcdef12345678",
		Amount:  "10.5",
		Token:   TokenUSDC,
		Network: NetworkBase,
	}

	data, err := json.Marshal(input)
	require.NoError(t, err)

	var decoded PayInput
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, input, decoded)
}

func TestToolResultJSON(t *testing.T) {
	result := ToolResult{
		Content: []ContentBlock{
			{Type: "text", Text: "Hello, World!"},
		},
		IsError: false,
	}

	data, err := json.Marshal(result)
	require.NoError(t, err)

	var decoded ToolResult
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, result.Content[0].Text, decoded.Content[0].Text)
	assert.False(t, decoded.IsError)
}

// Formatting tests

func TestFormatPaymentResult(t *testing.T) {
	result := PaymentResult{
		TxHash:      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
		From:        "0xfrom",
		To:          "0xto",
		Amount:      "100",
		Token:       "USDC",
		Network:     "ethereum",
		ExplorerURL: "https://etherscan.io/tx/0x1234",
		DemoMode:    false,
	}

	text := formatPaymentResult(result)
	assert.Contains(t, text, "Payment Successful")
	assert.Contains(t, text, "100 USDC")
	assert.Contains(t, text, "0xto")
	assert.Contains(t, text, "ethereum")
}

func TestFormatPaymentResultDemoMode(t *testing.T) {
	result := PaymentResult{
		TxHash:   "0x_demo",
		Amount:   "50",
		Token:    "USDT",
		Network:  "base",
		DemoMode: true,
	}

	text := formatPaymentResult(result)
	assert.Contains(t, text, "Demo Mode")
	assert.Contains(t, text, "simulated")
}

func TestFormatBridgeFeeResult(t *testing.T) {
	result := BridgeFeeResult{
		NativeFee:     "0.001",
		NativeSymbol:  "ETH",
		FromChain:     "arbitrum",
		ToChain:       "ethereum",
		Amount:        "100",
		EstimatedTime: 300,
	}

	text := formatBridgeFeeResult(result)
	assert.Contains(t, text, "Bridge Fee Quote")
	assert.Contains(t, text, "arbitrum")
	assert.Contains(t, text, "ethereum")
	assert.Contains(t, text, "0.001 ETH")
	assert.Contains(t, text, "300 seconds")
}

func TestTruncateHash(t *testing.T) {
	hash := "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
	truncated := truncateHash(hash)
	assert.Equal(t, "0x123456...abcdef", truncated)

	short := "0x1234"
	assert.Equal(t, short, truncateHash(short))
}

// Additional formatting tests

func TestTextResult(t *testing.T) {
	result := textResult("Hello, World!")

	assert.NotNil(t, result)
	assert.False(t, result.IsError)
	assert.Len(t, result.Content, 1)
	assert.Equal(t, "text", result.Content[0].Type)
	assert.Equal(t, "Hello, World!", result.Content[0].Text)
}

func TestErrorResult(t *testing.T) {
	result := errorResult("Something went wrong")

	assert.NotNil(t, result)
	assert.True(t, result.IsError)
	assert.Len(t, result.Content, 1)
	assert.Equal(t, "text", result.Content[0].Type)
	assert.Contains(t, result.Content[0].Text, "Error: Something went wrong")
}

func TestFormatBalanceResult(t *testing.T) {
	t.Run("With tokens", func(t *testing.T) {
		result := NetworkBalance{
			Network: "ethereum",
			Native: BalanceInfo{
				Token:   "ETH",
				Balance: "1.5",
				Raw:     "1500000000000000000",
			},
			Tokens: []BalanceInfo{
				{Token: "USDC", Balance: "100", Raw: "100000000"},
				{Token: "USDT0", Balance: "50", Raw: "50000000"},
			},
		}

		text := formatBalanceResult(result)
		assert.Contains(t, text, "Balance on ethereum")
		assert.Contains(t, text, "Native (ETH):**")
		assert.Contains(t, text, "1.5")
		assert.Contains(t, text, "USDC: 100")
		assert.Contains(t, text, "USDT0: 50")
	})

	t.Run("With error", func(t *testing.T) {
		result := NetworkBalance{
			Network: "base",
			Error:   "Connection failed",
		}

		text := formatBalanceResult(result)
		assert.Contains(t, text, "Balance on base")
		assert.Contains(t, text, "Error: Connection failed")
	})

	t.Run("No tokens", func(t *testing.T) {
		result := NetworkBalance{
			Network: "arbitrum",
			Native: BalanceInfo{
				Token:   "ETH",
				Balance: "0.5",
				Raw:     "500000000000000000",
			},
			Tokens: []BalanceInfo{},
		}

		text := formatBalanceResult(result)
		assert.Contains(t, text, "No token balances found")
	})
}

func TestFormatAllBalancesResult(t *testing.T) {
	t.Run("Multiple networks with totals", func(t *testing.T) {
		results := []NetworkBalance{
			{
				Network: "ethereum",
				Native: BalanceInfo{
					Token:   "ETH",
					Balance: "1.0",
					Raw:     "1000000000000000000",
				},
				Tokens: []BalanceInfo{
					{Token: "USDC", Balance: "100", Raw: "100000000"},
				},
			},
			{
				Network: "base",
				Native: BalanceInfo{
					Token:   "ETH",
					Balance: "0.5",
					Raw:     "500000000000000000",
				},
				Tokens: []BalanceInfo{
					{Token: "USDC", Balance: "200", Raw: "200000000"},
					{Token: "USDT0", Balance: "50", Raw: "50000000"},
				},
			},
		}

		text := formatAllBalancesResult(results)
		assert.Contains(t, text, "Balances Across All Networks")
		assert.Contains(t, text, "### ethereum")
		assert.Contains(t, text, "### base")
		assert.Contains(t, text, "### Totals")
		assert.Contains(t, text, "USDC: 300") // Total USDC
	})

	t.Run("Network with error", func(t *testing.T) {
		results := []NetworkBalance{
			{
				Network: "polygon",
				Error:   "RPC timeout",
			},
		}

		text := formatAllBalancesResult(results)
		assert.Contains(t, text, "### polygon")
		assert.Contains(t, text, "❌ RPC timeout")
	})
}

func TestFormatGaslessPaymentResult(t *testing.T) {
	t.Run("Basic result", func(t *testing.T) {
		result := &GaslessPaymentResult{
			TxHash:      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			UserOpHash:  "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
			Network:     "ethereum",
			Amount:      "100",
			Token:       "USDC",
			To:          "0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d",
			ExplorerURL: "https://etherscan.io/tx/0x1234",
		}

		text := formatGaslessPaymentResult(result)
		assert.Contains(t, text, "Gasless Payment Successful")
		assert.Contains(t, text, "100 USDC")
		assert.Contains(t, text, "ethereum")
		assert.Contains(t, text, "Gas fees were sponsored")
	})

	t.Run("With paymaster", func(t *testing.T) {
		result := &GaslessPaymentResult{
			TxHash:      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			UserOpHash:  "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
			Network:     "base",
			Amount:      "50",
			Token:       "USDT",
			To:          "0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d",
			ExplorerURL: "https://basescan.org/tx/0x1234",
			Paymaster:   "Pimlico",
		}

		text := formatGaslessPaymentResult(result)
		assert.Contains(t, text, "**Paymaster:**")
		assert.Contains(t, text, "Pimlico")
	})
}

func TestFormatBridgeResult(t *testing.T) {
	t.Run("Real bridge", func(t *testing.T) {
		result := BridgeResult{
			TxHash:        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			MessageGUID:   "0xguid123",
			FromChain:     "arbitrum",
			ToChain:       "ethereum",
			Amount:        "100",
			ExplorerURL:   "https://arbiscan.io/tx/0x1234",
			TrackingURL:   "https://layerzeroscan.com/tx/0xguid123",
			EstimatedTime: 300,
			DemoMode:      false,
		}

		text := formatBridgeResult(result)
		assert.Contains(t, text, "Bridge Initiated")
		assert.Contains(t, text, "100 USDT0")
		assert.Contains(t, text, "arbitrum")
		assert.Contains(t, text, "ethereum")
		assert.Contains(t, text, "LayerZero Scan")
		assert.Contains(t, text, "300 seconds")
	})

	t.Run("Demo mode", func(t *testing.T) {
		result := BridgeResult{
			TxHash:        "0x_demo",
			MessageGUID:   "0x_demo_guid",
			FromChain:     "ink",
			ToChain:       "berachain",
			Amount:        "50",
			ExplorerURL:   "https://explorer.ink.xyz/tx/0x_demo",
			TrackingURL:   "https://layerzeroscan.com/tx/0x_demo_guid",
			EstimatedTime: 300,
			DemoMode:      true,
		}

		text := formatBridgeResult(result)
		assert.Contains(t, text, "Demo Mode")
		assert.Contains(t, text, "simulated")
	})
}

// Type JSON marshaling tests

func TestUserOperationJSON(t *testing.T) {
	userOp := UserOperation{
		Sender:               "0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d",
		Nonce:                "0x1",
		InitCode:             "0x",
		CallData:             "0xabcdef",
		CallGasLimit:         "0x186a0",
		VerificationGasLimit: "0x186a0",
		PreVerificationGas:   "0xc350",
		MaxFeePerGas:         "0x3b9aca00",
		MaxPriorityFeePerGas: "0x5f5e100",
		PaymasterAndData:     "0x",
		Signature:            "0x1234",
	}

	data, err := json.Marshal(userOp)
	require.NoError(t, err)

	var decoded UserOperation
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, userOp.Sender, decoded.Sender)
	assert.Equal(t, userOp.Nonce, decoded.Nonce)
	assert.Equal(t, userOp.InitCode, decoded.InitCode)
	assert.Equal(t, userOp.CallData, decoded.CallData)
	assert.Equal(t, userOp.CallGasLimit, decoded.CallGasLimit)
	assert.Equal(t, userOp.VerificationGasLimit, decoded.VerificationGasLimit)
	assert.Equal(t, userOp.PreVerificationGas, decoded.PreVerificationGas)
	assert.Equal(t, userOp.MaxFeePerGas, decoded.MaxFeePerGas)
	assert.Equal(t, userOp.MaxPriorityFeePerGas, decoded.MaxPriorityFeePerGas)
	assert.Equal(t, userOp.PaymasterAndData, decoded.PaymasterAndData)
	assert.Equal(t, userOp.Signature, decoded.Signature)
}

func TestGaslessPaymentResultJSON(t *testing.T) {
	result := GaslessPaymentResult{
		TxHash:      "0x1234",
		UserOpHash:  "0xabcd",
		Network:     "ethereum",
		Amount:      "100",
		Token:       "USDC",
		To:          "0xrecipient",
		ExplorerURL: "https://etherscan.io/tx/0x1234",
		Paymaster:   "Pimlico",
	}

	data, err := json.Marshal(result)
	require.NoError(t, err)

	var decoded GaslessPaymentResult
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, result.TxHash, decoded.TxHash)
	assert.Equal(t, result.UserOpHash, decoded.UserOpHash)
	assert.Equal(t, result.Paymaster, decoded.Paymaster)
}

func TestUserOperationReceiptJSON(t *testing.T) {
	receipt := UserOperationReceipt{
		TransactionHash: "0x1234567890",
		Success:         true,
	}

	data, err := json.Marshal(receipt)
	require.NoError(t, err)

	var decoded UserOperationReceipt
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, receipt.TransactionHash, decoded.TransactionHash)
	assert.True(t, decoded.Success)
}

func TestBridgeResultJSON(t *testing.T) {
	result := BridgeResult{
		TxHash:        "0x1234",
		MessageGUID:   "0xguid",
		FromChain:     "arbitrum",
		ToChain:       "ethereum",
		Amount:        "100",
		ExplorerURL:   "https://arbiscan.io/tx/0x1234",
		TrackingURL:   "https://layerzeroscan.com/tx/0xguid",
		EstimatedTime: 300,
		DemoMode:      false,
	}

	data, err := json.Marshal(result)
	require.NoError(t, err)

	var decoded BridgeResult
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, result.TxHash, decoded.TxHash)
	assert.Equal(t, result.MessageGUID, decoded.MessageGUID)
	assert.Equal(t, result.FromChain, decoded.FromChain)
	assert.Equal(t, result.ToChain, decoded.ToChain)
	assert.Equal(t, result.EstimatedTime, decoded.EstimatedTime)
}

func TestBridgeFeeResultJSON(t *testing.T) {
	result := BridgeFeeResult{
		NativeFee:     "0.001",
		NativeSymbol:  "ETH",
		FromChain:     "arbitrum",
		ToChain:       "ethereum",
		Amount:        "100",
		EstimatedTime: 300,
	}

	data, err := json.Marshal(result)
	require.NoError(t, err)

	var decoded BridgeFeeResult
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, result.NativeFee, decoded.NativeFee)
	assert.Equal(t, result.NativeSymbol, decoded.NativeSymbol)
	assert.Equal(t, result.EstimatedTime, decoded.EstimatedTime)
}

func TestNetworkBalanceJSON(t *testing.T) {
	balance := NetworkBalance{
		Network: "ethereum",
		Native: BalanceInfo{
			Token:   "ETH",
			Balance: "1.5",
			Raw:     "1500000000000000000",
		},
		Tokens: []BalanceInfo{
			{Token: "USDC", Balance: "100", Raw: "100000000"},
		},
		Error: "",
	}

	data, err := json.Marshal(balance)
	require.NoError(t, err)

	var decoded NetworkBalance
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, balance.Network, decoded.Network)
	assert.Equal(t, balance.Native.Token, decoded.Native.Token)
	assert.Len(t, decoded.Tokens, 1)
	assert.Equal(t, "USDC", decoded.Tokens[0].Token)
}

func TestBalanceInfoJSON(t *testing.T) {
	info := BalanceInfo{
		Token:   "USDT0",
		Balance: "1000.50",
		Raw:     "1000500000",
	}

	data, err := json.Marshal(info)
	require.NoError(t, err)

	var decoded BalanceInfo
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, info.Token, decoded.Token)
	assert.Equal(t, info.Balance, decoded.Balance)
	assert.Equal(t, info.Raw, decoded.Raw)
}

func TestBridgeInputJSON(t *testing.T) {
	input := BridgeInput{
		FromChain: "arbitrum",
		ToChain:   "ethereum",
		Amount:    "100",
		Recipient: "0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d",
	}

	data, err := json.Marshal(input)
	require.NoError(t, err)

	var decoded BridgeInput
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, input.FromChain, decoded.FromChain)
	assert.Equal(t, input.ToChain, decoded.ToChain)
	assert.Equal(t, input.Amount, decoded.Amount)
	assert.Equal(t, input.Recipient, decoded.Recipient)
}

func TestGetBalanceInputJSON(t *testing.T) {
	input := GetBalanceInput{
		Address: "0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d",
		Network: NetworkEthereum,
	}

	data, err := json.Marshal(input)
	require.NoError(t, err)

	var decoded GetBalanceInput
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, input.Address, decoded.Address)
	assert.Equal(t, input.Network, decoded.Network)
}

func TestGetAllBalancesInputJSON(t *testing.T) {
	input := GetAllBalancesInput{
		Address: "0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d",
	}

	data, err := json.Marshal(input)
	require.NoError(t, err)

	var decoded GetAllBalancesInput
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, input.Address, decoded.Address)
}

func TestPayGaslessInputJSON(t *testing.T) {
	input := PayGaslessInput{
		To:      "0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d",
		Amount:  "100",
		Token:   TokenUSDC,
		Network: NetworkBase,
	}

	data, err := json.Marshal(input)
	require.NoError(t, err)

	var decoded PayGaslessInput
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, input.To, decoded.To)
	assert.Equal(t, input.Amount, decoded.Amount)
	assert.Equal(t, input.Token, decoded.Token)
	assert.Equal(t, input.Network, decoded.Network)
}

// hashUserOperation test

func TestHashUserOperation(t *testing.T) {
	userOp := UserOperation{
		Sender:               "0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d",
		Nonce:                "0x1",
		InitCode:             "0x",
		CallData:             "0xabcdef",
		CallGasLimit:         "0x186a0",
		VerificationGasLimit: "0x186a0",
		PreVerificationGas:   "0xc350",
		MaxFeePerGas:         "0x3b9aca00",
		MaxPriorityFeePerGas: "0x5f5e100",
		PaymasterAndData:     "0x",
		Signature:            "0x",
	}

	hash, err := hashUserOperation(userOp, 1)
	require.NoError(t, err)
	assert.Len(t, hash, 32) // Keccak256 produces 32 bytes

	// Same input should produce same hash
	hash2, err := hashUserOperation(userOp, 1)
	require.NoError(t, err)
	assert.Equal(t, hash, hash2)

	// Different chain ID should produce different hash
	hash3, err := hashUserOperation(userOp, 8453) // Base chain ID
	require.NoError(t, err)
	assert.NotEqual(t, hash, hash3)
}

// Constants and utility tests

func TestEstimatedBridgeTimes(t *testing.T) {
	assert.Equal(t, 900, EstimatedBridgeTimes[NetworkEthereum])
	assert.Equal(t, 300, EstimatedBridgeTimes[NetworkArbitrum])
	assert.Equal(t, 300, EstimatedBridgeTimes[NetworkInk])
}

func TestLayerZeroConstants(t *testing.T) {
	// Check LayerZero endpoint IDs exist for bridgeable chains
	assert.NotZero(t, LayerZeroEndpointIDs[NetworkEthereum])
	assert.NotZero(t, LayerZeroEndpointIDs[NetworkArbitrum])
	assert.NotZero(t, LayerZeroEndpointIDs[NetworkInk])

	// Check USDT0 addresses
	assert.NotEmpty(t, USDT0Addresses[NetworkEthereum])
	assert.NotEmpty(t, USDT0Addresses[NetworkArbitrum])
	assert.NotEmpty(t, USDT0Addresses[NetworkInk])

	// Check LayerZero scan URL
	assert.Contains(t, LayerZeroScanURL, "layerzeroscan")
}

func TestOftABIJSON(t *testing.T) {
	// Verify the ABI JSON is valid
	assert.NotEmpty(t, oftABIJSON)
	assert.Contains(t, oftABIJSON, "quoteSend")
	assert.Contains(t, oftABIJSON, "send")
}

// Server demo mode tool tests

func TestServerCallToolPayGasless(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	params := `{"name":"t402/payGasless","arguments":{"to":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d","amount":"100","token":"USDC","network":"ethereum"}}`
	inputData := `{"jsonrpc":"2.0","id":5,"method":"tools/call","params":` + params + `}` + "\n"

	pr, pw := io.Pipe()
	go func() {
		pw.Write([]byte(inputData))
		pw.Close()
	}()

	output := &bytes.Buffer{}
	server := NewServerWithIO(config, pr, output)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_ = server.Run(ctx)

	var response JSONRPCResponse
	err := json.Unmarshal(output.Bytes(), &response)
	require.NoError(t, err)

	resultMap, ok := response.Result.(map[string]any)
	require.True(t, ok)
	content, contentOk := resultMap["content"].([]any)
	require.True(t, contentOk)
	assert.NotEmpty(t, content)
}

func TestServerCallToolPay(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	params := `{"name":"t402/pay","arguments":{"to":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d","amount":"100","token":"USDC","network":"base"}}`
	inputData := `{"jsonrpc":"2.0","id":6,"method":"tools/call","params":` + params + `}` + "\n"

	pr, pw := io.Pipe()
	go func() {
		pw.Write([]byte(inputData))
		pw.Close()
	}()

	output := &bytes.Buffer{}
	server := NewServerWithIO(config, pr, output)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_ = server.Run(ctx)

	var response JSONRPCResponse
	err := json.Unmarshal(output.Bytes(), &response)
	require.NoError(t, err)

	resultMap, ok := response.Result.(map[string]any)
	require.True(t, ok)
	content, contentOk := resultMap["content"].([]any)
	require.True(t, contentOk)
	assert.NotEmpty(t, content)
}

func TestServerCallToolGetBridgeFee(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	params := `{"name":"t402/getBridgeFee","arguments":{"fromChain":"arbitrum","toChain":"ethereum","amount":"100","recipient":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d"}}`
	inputData := `{"jsonrpc":"2.0","id":7,"method":"tools/call","params":` + params + `}` + "\n"

	pr, pw := io.Pipe()
	go func() {
		pw.Write([]byte(inputData))
		pw.Close()
	}()

	output := &bytes.Buffer{}
	server := NewServerWithIO(config, pr, output)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_ = server.Run(ctx)

	var response JSONRPCResponse
	err := json.Unmarshal(output.Bytes(), &response)
	require.NoError(t, err)

	resultMap, ok := response.Result.(map[string]any)
	require.True(t, ok)
	content, contentOk := resultMap["content"].([]any)
	require.True(t, contentOk)
	assert.NotEmpty(t, content)
}

func TestServerCallToolBridge(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	params := `{"name":"t402/bridge","arguments":{"fromChain":"arbitrum","toChain":"ethereum","amount":"100","recipient":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d"}}`
	inputData := `{"jsonrpc":"2.0","id":8,"method":"tools/call","params":` + params + `}` + "\n"

	pr, pw := io.Pipe()
	go func() {
		pw.Write([]byte(inputData))
		pw.Close()
	}()

	output := &bytes.Buffer{}
	server := NewServerWithIO(config, pr, output)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_ = server.Run(ctx)

	var response JSONRPCResponse
	err := json.Unmarshal(output.Bytes(), &response)
	require.NoError(t, err)

	resultMap, ok := response.Result.(map[string]any)
	require.True(t, ok)
	content, contentOk := resultMap["content"].([]any)
	require.True(t, contentOk)
	assert.NotEmpty(t, content)
}

func TestServerCallToolGetAllBalances(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	params := `{"name":"t402/getAllBalances","arguments":{"address":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d"}}`
	inputData := `{"jsonrpc":"2.0","id":9,"method":"tools/call","params":` + params + `}` + "\n"

	pr, pw := io.Pipe()
	go func() {
		pw.Write([]byte(inputData))
		pw.Close()
	}()

	output := &bytes.Buffer{}
	server := NewServerWithIO(config, pr, output)

	// Use a longer timeout since this queries multiple networks
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	_ = server.Run(ctx)

	var response JSONRPCResponse
	err := json.Unmarshal(output.Bytes(), &response)
	require.NoError(t, err)

	// The result should contain content
	resultMap, ok := response.Result.(map[string]any)
	require.True(t, ok)
	content, contentOk := resultMap["content"].([]any)
	require.True(t, contentOk)
	assert.NotEmpty(t, content)
}

// Error case tests for tool handlers

func TestServerCallToolInvalidNetwork(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	params := `{"name":"t402/getBalance","arguments":{"address":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d","network":"invalid_network"}}`
	inputData := `{"jsonrpc":"2.0","id":10,"method":"tools/call","params":` + params + `}` + "\n"

	pr, pw := io.Pipe()
	go func() {
		pw.Write([]byte(inputData))
		pw.Close()
	}()

	output := &bytes.Buffer{}
	server := NewServerWithIO(config, pr, output)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_ = server.Run(ctx)

	var response JSONRPCResponse
	err := json.Unmarshal(output.Bytes(), &response)
	require.NoError(t, err)

	// Should return error in result
	resultMap, ok := response.Result.(map[string]any)
	require.True(t, ok)
	isError, _ := resultMap["isError"].(bool)
	assert.True(t, isError)
}

func TestServerCallToolInvalidAmount(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	params := `{"name":"t402/pay","arguments":{"to":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d","amount":"invalid","token":"USDC","network":"base"}}`
	inputData := `{"jsonrpc":"2.0","id":11,"method":"tools/call","params":` + params + `}` + "\n"

	pr, pw := io.Pipe()
	go func() {
		pw.Write([]byte(inputData))
		pw.Close()
	}()

	output := &bytes.Buffer{}
	server := NewServerWithIO(config, pr, output)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_ = server.Run(ctx)

	var response JSONRPCResponse
	err := json.Unmarshal(output.Bytes(), &response)
	require.NoError(t, err)

	resultMap, ok := response.Result.(map[string]any)
	require.True(t, ok)
	isError, _ := resultMap["isError"].(bool)
	assert.True(t, isError)
}

func TestServerCallToolUnsupportedToken(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	// Try to use USDT on base which doesn't support it
	params := `{"name":"t402/pay","arguments":{"to":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d","amount":"100","token":"USDT","network":"base"}}`
	inputData := `{"jsonrpc":"2.0","id":12,"method":"tools/call","params":` + params + `}` + "\n"

	pr, pw := io.Pipe()
	go func() {
		pw.Write([]byte(inputData))
		pw.Close()
	}()

	output := &bytes.Buffer{}
	server := NewServerWithIO(config, pr, output)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_ = server.Run(ctx)

	var response JSONRPCResponse
	err := json.Unmarshal(output.Bytes(), &response)
	require.NoError(t, err)

	resultMap, ok := response.Result.(map[string]any)
	require.True(t, ok)
	isError, _ := resultMap["isError"].(bool)
	assert.True(t, isError)
}

func TestServerCallToolPayGaslessInvalidNetwork(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	// ink doesn't support gasless
	params := `{"name":"t402/payGasless","arguments":{"to":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d","amount":"100","token":"USDT0","network":"ink"}}`
	inputData := `{"jsonrpc":"2.0","id":13,"method":"tools/call","params":` + params + `}` + "\n"

	pr, pw := io.Pipe()
	go func() {
		pw.Write([]byte(inputData))
		pw.Close()
	}()

	output := &bytes.Buffer{}
	server := NewServerWithIO(config, pr, output)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_ = server.Run(ctx)

	var response JSONRPCResponse
	err := json.Unmarshal(output.Bytes(), &response)
	require.NoError(t, err)

	resultMap, ok := response.Result.(map[string]any)
	require.True(t, ok)
	isError, _ := resultMap["isError"].(bool)
	assert.True(t, isError)
}

func TestServerCallToolBridgeSameChain(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	// Same chain should fail
	params := `{"name":"t402/bridge","arguments":{"fromChain":"arbitrum","toChain":"arbitrum","amount":"100","recipient":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d"}}`
	inputData := `{"jsonrpc":"2.0","id":14,"method":"tools/call","params":` + params + `}` + "\n"

	pr, pw := io.Pipe()
	go func() {
		pw.Write([]byte(inputData))
		pw.Close()
	}()

	output := &bytes.Buffer{}
	server := NewServerWithIO(config, pr, output)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_ = server.Run(ctx)

	var response JSONRPCResponse
	err := json.Unmarshal(output.Bytes(), &response)
	require.NoError(t, err)

	resultMap, ok := response.Result.(map[string]any)
	require.True(t, ok)
	isError, _ := resultMap["isError"].(bool)
	assert.True(t, isError)
}

func TestServerCallToolBridgeInvalidChain(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	// base is not bridgeable
	params := `{"name":"t402/bridge","arguments":{"fromChain":"base","toChain":"ethereum","amount":"100","recipient":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d"}}`
	inputData := `{"jsonrpc":"2.0","id":15,"method":"tools/call","params":` + params + `}` + "\n"

	pr, pw := io.Pipe()
	go func() {
		pw.Write([]byte(inputData))
		pw.Close()
	}()

	output := &bytes.Buffer{}
	server := NewServerWithIO(config, pr, output)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_ = server.Run(ctx)

	var response JSONRPCResponse
	err := json.Unmarshal(output.Bytes(), &response)
	require.NoError(t, err)

	resultMap, ok := response.Result.(map[string]any)
	require.True(t, ok)
	isError, _ := resultMap["isError"].(bool)
	assert.True(t, isError)
}

func TestServerCallToolGetBridgeFeeSameChain(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	// Same chain should fail
	params := `{"name":"t402/getBridgeFee","arguments":{"fromChain":"arbitrum","toChain":"arbitrum","amount":"100","recipient":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d"}}`
	inputData := `{"jsonrpc":"2.0","id":16,"method":"tools/call","params":` + params + `}` + "\n"

	pr, pw := io.Pipe()
	go func() {
		pw.Write([]byte(inputData))
		pw.Close()
	}()

	output := &bytes.Buffer{}
	server := NewServerWithIO(config, pr, output)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_ = server.Run(ctx)

	var response JSONRPCResponse
	err := json.Unmarshal(output.Bytes(), &response)
	require.NoError(t, err)

	resultMap, ok := response.Result.(map[string]any)
	require.True(t, ok)
	isError, _ := resultMap["isError"].(bool)
	assert.True(t, isError)
}

// Config tests

func TestLoadConfigFromEnvExtended(t *testing.T) {
	t.Run("Default values", func(t *testing.T) {
		// Clear env vars
		t.Setenv("T402_PRIVATE_KEY", "")
		t.Setenv("T402_DEMO_MODE", "")
		t.Setenv("T402_BUNDLER_URL", "")
		t.Setenv("T402_PAYMASTER_URL", "")

		config := LoadConfigFromEnv()

		assert.Empty(t, config.PrivateKey)
		assert.False(t, config.DemoMode)
		assert.Empty(t, config.BundlerURL)
		assert.Empty(t, config.PaymasterURL)
	})

	t.Run("All values set", func(t *testing.T) {
		t.Setenv("T402_PRIVATE_KEY", "0xabcd1234")
		t.Setenv("T402_DEMO_MODE", "true")
		t.Setenv("T402_BUNDLER_URL", "https://bundler.example.com")
		t.Setenv("T402_PAYMASTER_URL", "https://paymaster.example.com")

		config := LoadConfigFromEnv()

		assert.Equal(t, "0xabcd1234", config.PrivateKey)
		assert.True(t, config.DemoMode)
		assert.Equal(t, "https://bundler.example.com", config.BundlerURL)
		assert.Equal(t, "https://paymaster.example.com", config.PaymasterURL)
	})
}

func TestServerConfigRPCURLs(t *testing.T) {
	config := &ServerConfig{
		RPCURLs: map[string]string{
			"ethereum": "https://my-eth-rpc.com",
			"base":     "https://my-base-rpc.com",
		},
	}

	assert.Equal(t, "https://my-eth-rpc.com", GetRPCURL(config, NetworkEthereum))
	assert.Equal(t, "https://my-base-rpc.com", GetRPCURL(config, NetworkBase))
	// Should fall back to default for unconfigured networks
	assert.Equal(t, "https://arb1.arbitrum.io/rpc", GetRPCURL(config, NetworkArbitrum))
}

// JSONRPC types tests

func TestJSONRPCRequestJSON(t *testing.T) {
	req := JSONRPCRequest{
		JSONRPC: "2.0",
		ID:      json.RawMessage(`1`),
		Method:  "tools/list",
		Params:  nil,
	}

	data, err := json.Marshal(req)
	require.NoError(t, err)

	var decoded JSONRPCRequest
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, "2.0", decoded.JSONRPC)
	assert.Equal(t, "tools/list", decoded.Method)
}

func TestJSONRPCResponseJSON(t *testing.T) {
	resp := JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      json.RawMessage(`1`),
		Result:  map[string]any{"tools": []any{}},
		Error:   nil,
	}

	data, err := json.Marshal(resp)
	require.NoError(t, err)

	var decoded JSONRPCResponse
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, "2.0", decoded.JSONRPC)
	assert.NotNil(t, decoded.Result)
	assert.Nil(t, decoded.Error)
}

func TestJSONRPCErrorJSON(t *testing.T) {
	rpcErr := &JSONRPCError{
		Code:    -32600,
		Message: "Invalid Request",
	}

	data, err := json.Marshal(rpcErr)
	require.NoError(t, err)

	var decoded JSONRPCError
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, -32600, decoded.Code)
	assert.Equal(t, "Invalid Request", decoded.Message)
}

// PaymentResult JSON test

func TestPaymentResultJSON(t *testing.T) {
	result := PaymentResult{
		TxHash:      "0x1234",
		From:        "0xfrom",
		To:          "0xto",
		Amount:      "100",
		Token:       "USDC",
		Network:     "ethereum",
		ExplorerURL: "https://etherscan.io/tx/0x1234",
		DemoMode:    false,
	}

	data, err := json.Marshal(result)
	require.NoError(t, err)

	var decoded PaymentResult
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, result.TxHash, decoded.TxHash)
	assert.Equal(t, result.From, decoded.From)
	assert.Equal(t, result.To, decoded.To)
	assert.Equal(t, result.Amount, decoded.Amount)
	assert.False(t, decoded.DemoMode)
}

// ContentBlock JSON test

func TestContentBlockJSON(t *testing.T) {
	block := ContentBlock{
		Type: "text",
		Text: "Hello, World!",
	}

	data, err := json.Marshal(block)
	require.NoError(t, err)

	var decoded ContentBlock
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, "text", decoded.Type)
	assert.Equal(t, "Hello, World!", decoded.Text)
}

// InputSchema JSON test

func TestInputSchemaJSON(t *testing.T) {
	schema := InputSchema{
		Type: "object",
		Properties: map[string]Property{
			"address": {Type: "string", Description: "Wallet address"},
			"network": {Type: "string", Description: "Network name"},
		},
		Required: []string{"address", "network"},
	}

	data, err := json.Marshal(schema)
	require.NoError(t, err)

	var decoded InputSchema
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, "object", decoded.Type)
	assert.Len(t, decoded.Properties, 2)
	assert.Contains(t, decoded.Required, "address")
}

// ToolDefinition test

func TestToolDefinitionJSON(t *testing.T) {
	tool := Tool{
		Name:        "t402/test",
		Description: "A test tool",
		InputSchema: InputSchema{
			Type: "object",
			Properties: map[string]Property{
				"param": {Type: "string", Description: "A parameter"},
			},
			Required: []string{"param"},
		},
	}

	data, err := json.Marshal(tool)
	require.NoError(t, err)

	var decoded Tool
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, "t402/test", decoded.Name)
	assert.Equal(t, "A test tool", decoded.Description)
	assert.Equal(t, "object", decoded.InputSchema.Type)
}
