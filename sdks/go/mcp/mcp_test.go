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
	wdkbridge "github.com/t402-io/t402/sdks/go/wdk/bridge"
	"github.com/t402-io/t402/sdks/go/wdk/gasless"
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
	assert.Len(t, tools, 15)

	toolNames := make(map[string]bool)
	for _, tool := range tools {
		toolNames[tool.Name] = true
	}

	// Original 6 tools (pre-Phase C).
	assert.True(t, toolNames["t402/getBalance"])
	assert.True(t, toolNames["t402/getAllBalances"])
	assert.True(t, toolNames["t402/pay"])
	assert.True(t, toolNames["t402/payGasless"])
	assert.True(t, toolNames["t402/getBridgeFee"])
	assert.True(t, toolNames["t402/bridge"])
	// Phase C Batch 1 (2026-04-24).
	assert.True(t, toolNames["t402/getTokenPrice"])
	assert.True(t, toolNames["t402/getGasPrice"])
	assert.True(t, toolNames["t402/signMessage"])
	// Phase C Batch 2 — WDK tools (2026-04-24).
	assert.True(t, toolNames["t402/wdk/getWallet"])
	assert.True(t, toolNames["t402/wdk/getBalances"])
	assert.True(t, toolNames["t402/wdk/transfer"])
	assert.True(t, toolNames["t402/wdk/swap"])
	assert.True(t, toolNames["t402/wdk/quoteSwap"])
	assert.True(t, toolNames["t402/wdk/executeSwap"])
}

func TestToolDefinitionSchemas(t *testing.T) {
	tools := GetToolDefinitions()

	// Tools that legitimately have no required input — the schema is
	// still valid, it just accepts an empty object.
	toolsWithNoRequired := map[string]bool{
		"t402/wdk/getWallet":   true,
		"t402/wdk/getBalances": true,
	}

	for _, tool := range tools {
		t.Run(tool.Name, func(t *testing.T) {
			assert.NotEmpty(t, tool.Description)
			assert.Equal(t, "object", tool.InputSchema.Type)
			if !toolsWithNoRequired[tool.Name] {
				assert.NotEmpty(t, tool.InputSchema.Properties)
				assert.NotEmpty(t, tool.InputSchema.Required)
			}

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
	assert.Len(t, tools, 15)
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
	userOp := gasless.UserOperation{
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

	var decoded gasless.UserOperation
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
	receipt := gasless.UserOperationReceipt{
		TransactionHash: "0x1234567890",
		Success:         true,
	}

	data, err := json.Marshal(receipt)
	require.NoError(t, err)

	var decoded gasless.UserOperationReceipt
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

// Constants and utility tests

func TestEstimatedBridgeTimes(t *testing.T) {
	// Bridge times are now in wdk/bridge package
	assert.Equal(t, 900, wdkbridge.EstimatedBridgeTimes["ethereum"])
	assert.Equal(t, 300, wdkbridge.EstimatedBridgeTimes["arbitrum"])
	assert.Equal(t, 300, wdkbridge.EstimatedBridgeTimes["ink"])
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

func TestWdkBridgeConstants(t *testing.T) {
	// Verify bridgeable chains have USDT0 addresses in wdk/bridge
	assert.True(t, wdkbridge.IsBridgeableChain("ethereum"))
	assert.True(t, wdkbridge.IsBridgeableChain("arbitrum"))
	assert.False(t, wdkbridge.IsBridgeableChain("base"))
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

// Additional tests for uncovered code paths

func TestServerCallToolPayNoPrivateKey(t *testing.T) {
	// Test pay without private key and not in demo mode
	config := &ServerConfig{DemoMode: false, PrivateKey: ""}

	params := `{"name":"t402/pay","arguments":{"to":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d","amount":"100","token":"USDC","network":"ethereum"}}`
	inputData := `{"jsonrpc":"2.0","id":20,"method":"tools/call","params":` + params + `}` + "\n"

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

	// Check error message mentions private key
	content, _ := resultMap["content"].([]any)
	if len(content) > 0 {
		firstContent, _ := content[0].(map[string]any)
		text, _ := firstContent["text"].(string)
		assert.Contains(t, text, "Private key")
	}
}

func TestServerCallToolPayGaslessNoBundler(t *testing.T) {
	// Test payGasless without bundler URL and not in demo mode
	config := &ServerConfig{DemoMode: false, BundlerURL: ""}

	params := `{"name":"t402/payGasless","arguments":{"to":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d","amount":"100","token":"USDC","network":"ethereum"}}`
	inputData := `{"jsonrpc":"2.0","id":21,"method":"tools/call","params":` + params + `}` + "\n"

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

	// Check error message mentions bundler
	content, _ := resultMap["content"].([]any)
	if len(content) > 0 {
		firstContent, _ := content[0].(map[string]any)
		text, _ := firstContent["text"].(string)
		assert.Contains(t, text, "Bundler URL")
	}
}

func TestServerCallToolBridgeNoPrivateKey(t *testing.T) {
	// Test bridge without private key and not in demo mode
	config := &ServerConfig{DemoMode: false, PrivateKey: ""}

	params := `{"name":"t402/bridge","arguments":{"fromChain":"arbitrum","toChain":"ethereum","amount":"100","recipient":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d"}}`
	inputData := `{"jsonrpc":"2.0","id":22,"method":"tools/call","params":` + params + `}` + "\n"

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

	// Check error message mentions private key
	content, _ := resultMap["content"].([]any)
	if len(content) > 0 {
		firstContent, _ := content[0].(map[string]any)
		text, _ := firstContent["text"].(string)
		assert.Contains(t, text, "Private key")
	}
}

func TestServerCallToolGetBridgeFeeInvalidAmount(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	params := `{"name":"t402/getBridgeFee","arguments":{"fromChain":"arbitrum","toChain":"ethereum","amount":"invalid_amount","recipient":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d"}}`
	inputData := `{"jsonrpc":"2.0","id":23,"method":"tools/call","params":` + params + `}` + "\n"

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

func TestServerCallToolGetBridgeFeeNonBridgeableToChain(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	// From bridgeable chain to non-bridgeable chain
	params := `{"name":"t402/getBridgeFee","arguments":{"fromChain":"arbitrum","toChain":"base","amount":"100","recipient":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d"}}`
	inputData := `{"jsonrpc":"2.0","id":24,"method":"tools/call","params":` + params + `}` + "\n"

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

func TestServerCallToolBridgeNonBridgeableToChain(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	// From bridgeable chain to non-bridgeable chain
	params := `{"name":"t402/bridge","arguments":{"fromChain":"arbitrum","toChain":"base","amount":"100","recipient":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d"}}`
	inputData := `{"jsonrpc":"2.0","id":25,"method":"tools/call","params":` + params + `}` + "\n"

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

func TestServerHandleRequestParseError(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	// Invalid JSON
	inputData := `{invalid json}` + "\n"

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

	// Should return parse error
	assert.NotNil(t, response.Error)
	assert.Equal(t, -32700, response.Error.Code)
	assert.Contains(t, response.Error.Message, "Parse error")
}

func TestServerHandleRequestUnknownMethod(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	inputData := `{"jsonrpc":"2.0","id":26,"method":"unknown/method"}` + "\n"

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

	// Should return method not found error
	assert.NotNil(t, response.Error)
	assert.Equal(t, -32601, response.Error.Code)
}

func TestGetExplorerTxURLMoreNetworks(t *testing.T) {
	tests := []struct {
		network  SupportedNetwork
		txHash   string
		expected string
	}{
		{NetworkEthereum, "0xabc", "https://etherscan.io/tx/0xabc"},
		{NetworkBase, "0xdef", "https://basescan.org/tx/0xdef"},
		{NetworkArbitrum, "0x123", "https://arbiscan.io/tx/0x123"},
		{NetworkPolygon, "0x456", "https://polygonscan.com/tx/0x456"},
		{NetworkAvalanche, "0x789", "https://snowtrace.io/tx/0x789"},
		{NetworkInk, "0xink", "https://explorer.ink.xyz/tx/0xink"},
		{NetworkBerachain, "0xbera", "https://berascan.com/tx/0xbera"},
		{NetworkOptimism, "0xopt", "https://optimistic.etherscan.io/tx/0xopt"},
		{NetworkUnichain, "0xuni", "https://uniscan.xyz/tx/0xuni"},
	}

	for _, tt := range tests {
		t.Run(string(tt.network), func(t *testing.T) {
			result := GetExplorerTxURL(tt.network, tt.txHash)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestGetExplorerTxURLUnknownNetwork(t *testing.T) {
	// Unknown network should return empty string
	result := GetExplorerTxURL("unknown_network", "0x123")
	assert.Empty(t, result)
}

func TestServerEmptyLine(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	// Send empty line followed by valid request
	inputData := "\n\n" + `{"jsonrpc":"2.0","id":27,"method":"initialize"}` + "\n"

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

	// Should still get valid response (empty lines are skipped)
	var response JSONRPCResponse
	err := json.Unmarshal(output.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "2.0", response.JSONRPC)
}

func TestServerContextCancellation(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	pr, pw := io.Pipe()
	output := &bytes.Buffer{}
	server := NewServerWithIO(config, pr, output)

	ctx, cancel := context.WithCancel(context.Background())

	// Start server in goroutine
	done := make(chan error)
	go func() {
		done <- server.Run(ctx)
	}()

	// Cancel context immediately
	cancel()

	// Should exit with context error
	err := <-done
	assert.ErrorIs(t, err, context.Canceled)

	// Clean up pipe
	pw.Close()
}

func TestServerCallToolGetBalanceInvalidInput(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	// Invalid JSON in arguments
	params := `{"name":"t402/getBalance","arguments":"not valid json"}`
	inputData := `{"jsonrpc":"2.0","id":28,"method":"tools/call","params":` + params + `}` + "\n"

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

func TestServerCallToolPayInvalidInputJSON(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	// Missing required fields
	params := `{"name":"t402/pay","arguments":{}}`
	inputData := `{"jsonrpc":"2.0","id":29,"method":"tools/call","params":` + params + `}` + "\n"

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

func TestServerCallToolBridgeInvalidInputJSON(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	// Invalid JSON structure
	params := `{"name":"t402/bridge","arguments":"invalid"}`
	inputData := `{"jsonrpc":"2.0","id":30,"method":"tools/call","params":` + params + `}` + "\n"

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

func TestServerCallToolGetBridgeFeeInvalidInputJSON(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	// Invalid JSON structure
	params := `{"name":"t402/getBridgeFee","arguments":"invalid"}`
	inputData := `{"jsonrpc":"2.0","id":31,"method":"tools/call","params":` + params + `}` + "\n"

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

func TestServerCallToolPayGaslessInvalidInputJSON(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	// Invalid JSON structure
	params := `{"name":"t402/payGasless","arguments":"invalid"}`
	inputData := `{"jsonrpc":"2.0","id":32,"method":"tools/call","params":` + params + `}` + "\n"

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

func TestServerCallToolGetAllBalancesInvalidInput(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	// Invalid JSON structure
	params := `{"name":"t402/getAllBalances","arguments":"invalid"}`
	inputData := `{"jsonrpc":"2.0","id":33,"method":"tools/call","params":` + params + `}` + "\n"

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

func TestParseTokenAmountEdgeCases(t *testing.T) {
	tests := []struct {
		name     string
		amount   string
		decimals int
		wantErr  bool
	}{
		{"empty string", "", 6, true},
		{"negative", "-1", 6, false}, // ParseTokenAmount accepts negative (just parses the number)
		{"very large", "999999999999999999999999", 6, false},
		{"many decimals", "1.123456789", 6, false}, // Will truncate to 6 decimals
		{"zero", "0", 6, false},
		{"decimal only", ".5", 6, true}, // decimal only is invalid
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ParseTokenAmount(tt.amount, tt.decimals)
			if tt.wantErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestGetTokenAddressMoreCases(t *testing.T) {
	// Test USDT0 on various networks
	tests := []struct {
		network SupportedNetwork
		token   SupportedToken
		wantOk  bool
	}{
		{NetworkEthereum, TokenUSDT0, true},
		{NetworkArbitrum, TokenUSDT0, true},
		{NetworkInk, TokenUSDT0, true},
		{NetworkBerachain, TokenUSDT0, true},
		{NetworkUnichain, TokenUSDT0, true},
		// USDC availability
		{NetworkEthereum, TokenUSDC, true},
		{NetworkBase, TokenUSDC, true},
		{NetworkPolygon, TokenUSDC, true},
		// USDT availability (not on all networks)
		{NetworkEthereum, TokenUSDT, true},
		{NetworkArbitrum, TokenUSDT, true},
	}

	for _, tt := range tests {
		t.Run(string(tt.network)+"_"+string(tt.token), func(t *testing.T) {
			_, ok := GetTokenAddress(tt.network, tt.token)
			assert.Equal(t, tt.wantOk, ok)
		})
	}
}

func TestLoadConfigFromEnvWithRPCURLs(t *testing.T) {
	// Test loading network-specific RPC URLs
	t.Setenv("T402_RPC_ETHEREUM", "https://custom-eth.rpc.com")
	t.Setenv("T402_RPC_BASE", "https://custom-base.rpc.com")
	t.Setenv("T402_PRIVATE_KEY", "0xtest")

	config := LoadConfigFromEnv()

	assert.Equal(t, "https://custom-eth.rpc.com", config.RPCURLs["ethereum"])
	assert.Equal(t, "https://custom-base.rpc.com", config.RPCURLs["base"])
	assert.Equal(t, "0xtest", config.PrivateKey)
}

func TestFormatAllBalancesResultEmptyList(t *testing.T) {
	results := []NetworkBalance{}

	text := formatAllBalancesResult(results)
	assert.Contains(t, text, "Balances Across All Networks")
	assert.Contains(t, text, "Totals")
}

func TestFormatAllBalancesResultMixedTokens(t *testing.T) {
	results := []NetworkBalance{
		{
			Network: "ethereum",
			Native: BalanceInfo{
				Token:   "ETH",
				Balance: "1.0",
				Raw:     "1000000000000000000",
			},
			Tokens: []BalanceInfo{
				{Token: "USDT0", Balance: "100", Raw: "100000000"},
				{Token: "USDC", Balance: "50", Raw: "50000000"},
			},
		},
		{
			Network: "arbitrum",
			Native: BalanceInfo{
				Token:   "ETH",
				Balance: "0.5",
				Raw:     "500000000000000000",
			},
			Tokens: []BalanceInfo{
				{Token: "USDT0", Balance: "200", Raw: "200000000"},
			},
		},
	}

	text := formatAllBalancesResult(results)
	assert.Contains(t, text, "USDT0: 300") // Total USDT0
	assert.Contains(t, text, "USDC: 50")   // Total USDC
}

func TestServerMultipleRequests(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	// Send multiple requests
	requests := []string{
		`{"jsonrpc":"2.0","id":1,"method":"initialize"}`,
		`{"jsonrpc":"2.0","id":2,"method":"tools/list"}`,
	}
	inputData := strings.Join(requests, "\n") + "\n"

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

	// Should have two responses
	lines := strings.Split(strings.TrimSpace(output.String()), "\n")
	assert.Len(t, lines, 2)

	// Verify first response (initialize)
	var resp1 JSONRPCResponse
	err := json.Unmarshal([]byte(lines[0]), &resp1)
	require.NoError(t, err)
	assert.Nil(t, resp1.Error)

	// Verify second response (tools/list)
	var resp2 JSONRPCResponse
	err = json.Unmarshal([]byte(lines[1]), &resp2)
	require.NoError(t, err)
	assert.Nil(t, resp2.Error)
}

func TestServerCallToolMissingName(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	// No name in params
	params := `{"arguments":{"address":"0x123"}}`
	inputData := `{"jsonrpc":"2.0","id":40,"method":"tools/call","params":` + params + `}` + "\n"

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

	// Should return error for invalid/missing tool name
	resultMap, ok := response.Result.(map[string]any)
	require.True(t, ok)
	isError, _ := resultMap["isError"].(bool)
	assert.True(t, isError)
}

func TestTokenConstantsExist(t *testing.T) {
	// Verify all token constants are defined
	assert.NotEmpty(t, TokenDecimals)
	assert.Equal(t, 6, TokenDecimals) // USDT/USDC have 6 decimals
}

func TestNetworkChainIDs(t *testing.T) {
	// Verify all networks have chain IDs
	for _, network := range AllNetworks() {
		chainID, ok := ChainIDs[network]
		assert.True(t, ok, "Network %s should have a chain ID", network)
		assert.Greater(t, chainID, int64(0), "Chain ID for %s should be positive", network)
	}
}

func TestAllNetworksHaveNativeSymbols(t *testing.T) {
	for _, network := range AllNetworks() {
		symbol, ok := NativeSymbols[network]
		assert.True(t, ok, "Network %s should have a native symbol", network)
		assert.NotEmpty(t, symbol, "Native symbol for %s should not be empty", network)
	}
}

func TestAllNetworksHaveExplorerURLs(t *testing.T) {
	for _, network := range AllNetworks() {
		url, ok := ExplorerURLs[network]
		assert.True(t, ok, "Network %s should have an explorer URL", network)
		assert.NotEmpty(t, url, "Explorer URL for %s should not be empty", network)
		assert.True(t, strings.HasPrefix(url, "https://"), "Explorer URL for %s should be HTTPS", network)
	}
}

func TestAllNetworksHaveRPCURLs(t *testing.T) {
	for _, network := range AllNetworks() {
		url, ok := DefaultRPCURLs[network]
		assert.True(t, ok, "Network %s should have an RPC URL", network)
		assert.NotEmpty(t, url, "RPC URL for %s should not be empty", network)
		assert.True(t, strings.HasPrefix(url, "https://"), "RPC URL for %s should be HTTPS", network)
	}
}

// Tests for NewServer function
func TestNewServer(t *testing.T) {
	config := &ServerConfig{
		PrivateKey: "0x1234",
		DemoMode:   true,
		BundlerURL: "https://bundler.example.com",
	}

	server := NewServer(config)
	require.NotNil(t, server)

	// Verify config is stored
	assert.Equal(t, config, server.config)
	assert.NotNil(t, server.reader)
	assert.NotNil(t, server.writer)
}

func TestNewServerWithDefaultConfig(t *testing.T) {
	config := &ServerConfig{}

	server := NewServer(config)
	require.NotNil(t, server)

	assert.False(t, server.config.DemoMode)
	assert.Empty(t, server.config.PrivateKey)
}

func TestNewServerWithIO(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	pr, pw := io.Pipe()
	output := &bytes.Buffer{}

	server := NewServerWithIO(config, pr, output)
	require.NotNil(t, server)

	assert.Equal(t, config, server.config)
	assert.Equal(t, output, server.writer)

	pw.Close()
}

// Server notification handler test
func TestServerNotificationsInitialized(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	inputData := `{"jsonrpc":"2.0","id":100,"method":"notifications/initialized"}` + "\n"

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

	// Should return empty result for notifications
	assert.Nil(t, response.Error)
	resultMap, ok := response.Result.(map[string]any)
	assert.True(t, ok)
	assert.Empty(t, resultMap)
}

// Property JSON test
func TestPropertyJSON(t *testing.T) {
	prop := Property{
		Type:        "string",
		Description: "A test property",
		Pattern:     "^0x[a-fA-F0-9]+$",
		Enum:        []string{"option1", "option2"},
	}

	data, err := json.Marshal(prop)
	require.NoError(t, err)

	var decoded Property
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, prop.Type, decoded.Type)
	assert.Equal(t, prop.Description, decoded.Description)
	assert.Equal(t, prop.Pattern, decoded.Pattern)
	assert.Equal(t, prop.Enum, decoded.Enum)
}

// CallToolParams JSON test
func TestCallToolParamsJSON(t *testing.T) {
	params := CallToolParams{
		Name:      "t402/test",
		Arguments: json.RawMessage(`{"key":"value"}`),
	}

	data, err := json.Marshal(params)
	require.NoError(t, err)

	var decoded CallToolParams
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, params.Name, decoded.Name)
	assert.Equal(t, string(params.Arguments), string(decoded.Arguments))
}

// ServerConfig JSON test
func TestServerConfigJSON(t *testing.T) {
	config := ServerConfig{
		PrivateKey:   "0xtest",
		DemoMode:     true,
		BundlerURL:   "https://bundler.example.com",
		PaymasterURL: "https://paymaster.example.com",
		RPCURLs: map[string]string{
			"ethereum": "https://eth.rpc.com",
		},
	}

	data, err := json.Marshal(config)
	require.NoError(t, err)

	var decoded ServerConfig
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, config.PrivateKey, decoded.PrivateKey)
	assert.Equal(t, config.DemoMode, decoded.DemoMode)
	assert.Equal(t, config.BundlerURL, decoded.BundlerURL)
	assert.Equal(t, config.PaymasterURL, decoded.PaymasterURL)
}

// Test handleCallTool with invalid params JSON
func TestServerCallToolInvalidParams(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	// Completely invalid params
	inputData := `{"jsonrpc":"2.0","id":101,"method":"tools/call","params":"invalid"}` + "\n"

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

	// Should return error in ToolResult
	resultMap, ok := response.Result.(map[string]any)
	require.True(t, ok)
	isError, _ := resultMap["isError"].(bool)
	assert.True(t, isError)
}

// Test pay with invalid network
func TestServerCallToolPayInvalidNetwork(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	params := `{"name":"t402/pay","arguments":{"to":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d","amount":"100","token":"USDC","network":"invalid_network"}}`
	inputData := `{"jsonrpc":"2.0","id":102,"method":"tools/call","params":` + params + `}` + "\n"

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

	// Check error message
	content, _ := resultMap["content"].([]any)
	if len(content) > 0 {
		firstContent, _ := content[0].(map[string]any)
		text, _ := firstContent["text"].(string)
		assert.Contains(t, text, "Invalid network")
	}
}

// Test BridgeableChains list
func TestBridgeableChainsList(t *testing.T) {
	assert.NotEmpty(t, BridgeableChains)
	assert.Contains(t, BridgeableChains, SupportedNetwork("ethereum"))
	assert.Contains(t, BridgeableChains, SupportedNetwork("arbitrum"))
	assert.Contains(t, BridgeableChains, SupportedNetwork("ink"))
}

// Test GaslessNetworks list
func TestGaslessNetworksList(t *testing.T) {
	assert.NotEmpty(t, GaslessNetworks)
	assert.Contains(t, GaslessNetworks, SupportedNetwork("ethereum"))
	assert.Contains(t, GaslessNetworks, SupportedNetwork("base"))
}

// Test formatBalanceResult with all token types
func TestFormatBalanceResultWithUSDT(t *testing.T) {
	result := NetworkBalance{
		Network: "ethereum",
		Native: BalanceInfo{
			Token:   "ETH",
			Balance: "1.0",
			Raw:     "1000000000000000000",
		},
		Tokens: []BalanceInfo{
			{Token: "USDT", Balance: "100", Raw: "100000000"},
		},
	}

	text := formatBalanceResult(result)
	assert.Contains(t, text, "USDT: 100")
}

// Test formatAllBalancesResult with USDT total
func TestFormatAllBalancesResultWithUSDTTotal(t *testing.T) {
	results := []NetworkBalance{
		{
			Network: "ethereum",
			Native: BalanceInfo{
				Token:   "ETH",
				Balance: "1.0",
				Raw:     "1000000000000000000",
			},
			Tokens: []BalanceInfo{
				{Token: "USDT", Balance: "100", Raw: "100000000"},
			},
		},
		{
			Network: "arbitrum",
			Native: BalanceInfo{
				Token:   "ETH",
				Balance: "0.5",
				Raw:     "500000000000000000",
			},
			Tokens: []BalanceInfo{
				{Token: "USDT", Balance: "200", Raw: "200000000"},
			},
		},
	}

	text := formatAllBalancesResult(results)
	assert.Contains(t, text, "USDT: 300") // Total USDT
}

// Test GetRPCURL with nil config
func TestGetRPCURLWithNilConfig(t *testing.T) {
	url := GetRPCURL(nil, NetworkEthereum)
	assert.Equal(t, "https://eth.llamarpc.com", url)

	url = GetRPCURL(nil, NetworkBase)
	assert.Equal(t, "https://mainnet.base.org", url)
}

// Test GetRPCURL with empty RPCURLs map
func TestGetRPCURLWithEmptyRPCURLs(t *testing.T) {
	config := &ServerConfig{
		RPCURLs: nil,
	}

	url := GetRPCURL(config, NetworkEthereum)
	assert.Equal(t, "https://eth.llamarpc.com", url)
}

// Test FormatTokenAmount edge cases
func TestFormatTokenAmountEdgeCases(t *testing.T) {
	tests := []struct {
		name     string
		amount   *big.Int
		decimals int
		want     string
	}{
		{"very large amount", new(big.Int).Exp(big.NewInt(10), big.NewInt(30), nil), 6, "1000000000000000000000000"},
		{"tiny amount", big.NewInt(1), 18, "0.000000000000000001"},
		{"zero decimals", big.NewInt(123), 0, "123"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := FormatTokenAmount(tt.amount, tt.decimals)
			assert.Equal(t, tt.want, got)
		})
	}
}

// Test JSON-RPC error with data field
func TestJSONRPCErrorWithData(t *testing.T) {
	rpcErr := JSONRPCError{
		Code:    -32000,
		Message: "Server error",
		Data:    "Additional details",
	}

	data, err := json.Marshal(rpcErr)
	require.NoError(t, err)

	var decoded JSONRPCError
	err = json.Unmarshal(data, &decoded)
	require.NoError(t, err)

	assert.Equal(t, -32000, decoded.Code)
	assert.Equal(t, "Server error", decoded.Message)
	assert.Equal(t, "Additional details", decoded.Data)
}

// Test handleInitialize response structure
func TestHandleInitializeResponseStructure(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	inputData := `{"jsonrpc":"2.0","id":103,"method":"initialize"}` + "\n"

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

	result, ok := response.Result.(map[string]any)
	require.True(t, ok)

	// Verify protocol version
	assert.Equal(t, "2024-11-05", result["protocolVersion"])

	// Verify capabilities
	capabilities, ok := result["capabilities"].(map[string]any)
	require.True(t, ok)
	_, hasTools := capabilities["tools"]
	assert.True(t, hasTools)
}

// Test multiple networks in AllNetworks
func TestAllNetworksCount(t *testing.T) {
	networks := AllNetworks()
	assert.Equal(t, 9, len(networks))
}

// Test tool definitions contain all required properties
func TestToolDefinitionsComplete(t *testing.T) {
	tools := GetToolDefinitions()

	for _, tool := range tools {
		t.Run(tool.Name, func(t *testing.T) {
			// Each tool should have all required properties defined
			for _, required := range tool.InputSchema.Required {
				prop, exists := tool.InputSchema.Properties[required]
				assert.True(t, exists, "Required property %s should exist", required)
				assert.NotEmpty(t, prop.Type, "Property %s should have a type", required)
				assert.NotEmpty(t, prop.Description, "Property %s should have a description", required)
			}
		})
	}
}

// Test truncateHash edge cases
func TestTruncateHashEdgeCases(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"", ""},
		{"0x1234", "0x1234"},
		{"0x123456", "0x123456"},
		{"0x1234567890", "0x1234567890"},
		{"0x12345678901234567890", "0x123456...567890"},
		{"0x1234567890123456789012345678901234567890123456789012345678901234", "0x123456...901234"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := truncateHash(tt.input)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// ===========================================================================
// Additional tests for improved coverage
// ===========================================================================

// Test handlePay error cases
func TestHandlePayErrorCases(t *testing.T) {
	t.Run("invalid network", func(t *testing.T) {
		config := &ServerConfig{DemoMode: true}
		server := NewServerWithIO(config, nil, nil)

		args := []byte(`{"to":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d","amount":"100","token":"USDC","network":"invalid_network"}`)
		result := server.handlePay(context.Background(), args)

		assert.True(t, result.IsError)
		assert.Contains(t, result.Content[0].Text, "Invalid network")
	})

	t.Run("unsupported token on network", func(t *testing.T) {
		config := &ServerConfig{DemoMode: true}
		server := NewServerWithIO(config, nil, nil)

		// Base doesn't have USDT
		args := []byte(`{"to":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d","amount":"100","token":"USDT","network":"base"}`)
		result := server.handlePay(context.Background(), args)

		assert.True(t, result.IsError)
		assert.Contains(t, result.Content[0].Text, "not supported")
	})

	t.Run("invalid amount", func(t *testing.T) {
		config := &ServerConfig{DemoMode: true}
		server := NewServerWithIO(config, nil, nil)

		args := []byte(`{"to":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d","amount":"invalid","token":"USDC","network":"ethereum"}`)
		result := server.handlePay(context.Background(), args)

		assert.True(t, result.IsError)
		assert.Contains(t, result.Content[0].Text, "Invalid amount")
	})

	t.Run("missing private key without demo mode", func(t *testing.T) {
		config := &ServerConfig{DemoMode: false, PrivateKey: ""}
		server := NewServerWithIO(config, nil, nil)

		args := []byte(`{"to":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d","amount":"100","token":"USDC","network":"ethereum"}`)
		result := server.handlePay(context.Background(), args)

		assert.True(t, result.IsError)
		assert.Contains(t, result.Content[0].Text, "Private key not configured")
	})

	t.Run("invalid JSON input", func(t *testing.T) {
		config := &ServerConfig{DemoMode: true}
		server := NewServerWithIO(config, nil, nil)

		args := []byte(`{invalid json}`)
		result := server.handlePay(context.Background(), args)

		assert.True(t, result.IsError)
		assert.Contains(t, result.Content[0].Text, "Invalid input")
	})
}

// Test handlePayGasless error cases
func TestHandlePayGaslessErrorCases(t *testing.T) {
	t.Run("non-gasless network", func(t *testing.T) {
		config := &ServerConfig{DemoMode: true}
		server := NewServerWithIO(config, nil, nil)

		// Ink doesn't support gasless
		args := []byte(`{"to":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d","amount":"100","token":"USDC","network":"ink"}`)
		result := server.handlePayGasless(context.Background(), args)

		assert.True(t, result.IsError)
		assert.Contains(t, result.Content[0].Text, "does not support gasless")
	})

	t.Run("missing bundler URL without demo mode", func(t *testing.T) {
		config := &ServerConfig{DemoMode: false, BundlerURL: ""}
		server := NewServerWithIO(config, nil, nil)

		args := []byte(`{"to":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d","amount":"100","token":"USDC","network":"ethereum"}`)
		result := server.handlePayGasless(context.Background(), args)

		assert.True(t, result.IsError)
		assert.Contains(t, result.Content[0].Text, "Bundler URL not configured")
	})

	t.Run("invalid JSON input", func(t *testing.T) {
		config := &ServerConfig{DemoMode: true}
		server := NewServerWithIO(config, nil, nil)

		args := []byte(`{invalid json}`)
		result := server.handlePayGasless(context.Background(), args)

		assert.True(t, result.IsError)
		assert.Contains(t, result.Content[0].Text, "Invalid input")
	})

	t.Run("demo mode success", func(t *testing.T) {
		config := &ServerConfig{DemoMode: true}
		server := NewServerWithIO(config, nil, nil)

		args := []byte(`{"to":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d","amount":"100","token":"USDC","network":"ethereum"}`)
		result := server.handlePayGasless(context.Background(), args)

		assert.False(t, result.IsError)
		assert.Contains(t, result.Content[0].Text, "Demo Mode")
	})
}

// Test handleGetBridgeFee error cases
func TestHandleGetBridgeFeeErrorCases(t *testing.T) {
	t.Run("non-bridgeable source chain", func(t *testing.T) {
		config := &ServerConfig{DemoMode: true}
		server := NewServerWithIO(config, nil, nil)

		// Base is not bridgeable
		args := []byte(`{"fromChain":"base","toChain":"ethereum","amount":"100","recipient":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d"}`)
		result := server.handleGetBridgeFee(context.Background(), args)

		assert.True(t, result.IsError)
		assert.Contains(t, result.Content[0].Text, "does not support USDT0 bridging")
	})

	t.Run("non-bridgeable destination chain", func(t *testing.T) {
		config := &ServerConfig{DemoMode: true}
		server := NewServerWithIO(config, nil, nil)

		args := []byte(`{"fromChain":"arbitrum","toChain":"base","amount":"100","recipient":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d"}`)
		result := server.handleGetBridgeFee(context.Background(), args)

		assert.True(t, result.IsError)
		assert.Contains(t, result.Content[0].Text, "does not support USDT0 bridging")
	})

	t.Run("same source and destination", func(t *testing.T) {
		config := &ServerConfig{DemoMode: true}
		server := NewServerWithIO(config, nil, nil)

		args := []byte(`{"fromChain":"arbitrum","toChain":"arbitrum","amount":"100","recipient":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d"}`)
		result := server.handleGetBridgeFee(context.Background(), args)

		assert.True(t, result.IsError)
		assert.Contains(t, result.Content[0].Text, "must be different")
	})

	t.Run("invalid amount", func(t *testing.T) {
		config := &ServerConfig{DemoMode: true}
		server := NewServerWithIO(config, nil, nil)

		args := []byte(`{"fromChain":"arbitrum","toChain":"ethereum","amount":"invalid","recipient":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d"}`)
		result := server.handleGetBridgeFee(context.Background(), args)

		assert.True(t, result.IsError)
		assert.Contains(t, result.Content[0].Text, "Invalid amount")
	})

	t.Run("invalid JSON input", func(t *testing.T) {
		config := &ServerConfig{DemoMode: true}
		server := NewServerWithIO(config, nil, nil)

		args := []byte(`{invalid json}`)
		result := server.handleGetBridgeFee(context.Background(), args)

		assert.True(t, result.IsError)
		assert.Contains(t, result.Content[0].Text, "Invalid input")
	})

	t.Run("demo mode success", func(t *testing.T) {
		config := &ServerConfig{DemoMode: true}
		server := NewServerWithIO(config, nil, nil)

		args := []byte(`{"fromChain":"arbitrum","toChain":"ethereum","amount":"100","recipient":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d"}`)
		result := server.handleGetBridgeFee(context.Background(), args)

		assert.False(t, result.IsError)
		assert.Contains(t, result.Content[0].Text, "Bridge Fee Quote")
	})
}

// Test handleBridge error cases
func TestHandleBridgeErrorCases(t *testing.T) {
	t.Run("non-bridgeable source chain", func(t *testing.T) {
		config := &ServerConfig{DemoMode: true}
		server := NewServerWithIO(config, nil, nil)

		args := []byte(`{"fromChain":"base","toChain":"ethereum","amount":"100","recipient":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d"}`)
		result := server.handleBridge(context.Background(), args)

		assert.True(t, result.IsError)
		assert.Contains(t, result.Content[0].Text, "does not support USDT0 bridging")
	})

	t.Run("non-bridgeable destination chain", func(t *testing.T) {
		config := &ServerConfig{DemoMode: true}
		server := NewServerWithIO(config, nil, nil)

		args := []byte(`{"fromChain":"arbitrum","toChain":"polygon","amount":"100","recipient":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d"}`)
		result := server.handleBridge(context.Background(), args)

		assert.True(t, result.IsError)
		assert.Contains(t, result.Content[0].Text, "does not support USDT0 bridging")
	})

	t.Run("same source and destination", func(t *testing.T) {
		config := &ServerConfig{DemoMode: true}
		server := NewServerWithIO(config, nil, nil)

		args := []byte(`{"fromChain":"ethereum","toChain":"ethereum","amount":"100","recipient":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d"}`)
		result := server.handleBridge(context.Background(), args)

		assert.True(t, result.IsError)
		assert.Contains(t, result.Content[0].Text, "must be different")
	})

	t.Run("missing private key without demo mode", func(t *testing.T) {
		config := &ServerConfig{DemoMode: false, PrivateKey: ""}
		server := NewServerWithIO(config, nil, nil)

		args := []byte(`{"fromChain":"arbitrum","toChain":"ethereum","amount":"100","recipient":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d"}`)
		result := server.handleBridge(context.Background(), args)

		assert.True(t, result.IsError)
		assert.Contains(t, result.Content[0].Text, "Private key not configured")
	})

	t.Run("invalid JSON input", func(t *testing.T) {
		config := &ServerConfig{DemoMode: true}
		server := NewServerWithIO(config, nil, nil)

		args := []byte(`{invalid json}`)
		result := server.handleBridge(context.Background(), args)

		assert.True(t, result.IsError)
		assert.Contains(t, result.Content[0].Text, "Invalid input")
	})

	t.Run("demo mode success", func(t *testing.T) {
		config := &ServerConfig{DemoMode: true}
		server := NewServerWithIO(config, nil, nil)

		args := []byte(`{"fromChain":"arbitrum","toChain":"ethereum","amount":"100","recipient":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d"}`)
		result := server.handleBridge(context.Background(), args)

		assert.False(t, result.IsError)
		assert.Contains(t, result.Content[0].Text, "Demo Mode")
	})
}

// Test handleGetBalance error cases
func TestHandleGetBalanceErrorCases(t *testing.T) {
	t.Run("invalid network", func(t *testing.T) {
		config := &ServerConfig{DemoMode: true}
		server := NewServerWithIO(config, nil, nil)

		args := []byte(`{"address":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d","network":"invalid_network"}`)
		result := server.handleGetBalance(context.Background(), args)

		assert.True(t, result.IsError)
		assert.Contains(t, result.Content[0].Text, "Invalid network")
	})

	t.Run("invalid JSON input", func(t *testing.T) {
		config := &ServerConfig{DemoMode: true}
		server := NewServerWithIO(config, nil, nil)

		args := []byte(`{invalid json}`)
		result := server.handleGetBalance(context.Background(), args)

		assert.True(t, result.IsError)
		assert.Contains(t, result.Content[0].Text, "Invalid input")
	})
}

// Test handleGetAllBalances error cases
func TestHandleGetAllBalancesErrorCases(t *testing.T) {
	t.Run("invalid JSON input", func(t *testing.T) {
		config := &ServerConfig{DemoMode: true}
		server := NewServerWithIO(config, nil, nil)

		args := []byte(`{invalid json}`)
		result := server.handleGetAllBalances(context.Background(), args)

		assert.True(t, result.IsError)
		assert.Contains(t, result.Content[0].Text, "Invalid input")
	})
}

// Test ParseTokenAmount additional cases
func TestParseTokenAmountAdditional(t *testing.T) {
	t.Run("zero value", func(t *testing.T) {
		result, err := ParseTokenAmount("0", 6)
		require.NoError(t, err)
		assert.Equal(t, big.NewInt(0), result)
	})

	t.Run("very small decimal", func(t *testing.T) {
		result, err := ParseTokenAmount("0.000001", 6)
		require.NoError(t, err)
		assert.Equal(t, big.NewInt(1), result)
	})

	t.Run("large number", func(t *testing.T) {
		result, err := ParseTokenAmount("1000000000", 6)
		require.NoError(t, err)
		expected, _ := new(big.Int).SetString("1000000000000000", 10)
		assert.Equal(t, expected, result)
	})
}

// Test FormatTokenAmount additional cases
func TestFormatTokenAmountAdditional(t *testing.T) {
	t.Run("nil value returns zero", func(t *testing.T) {
		result := FormatTokenAmount(nil, 6)
		assert.Equal(t, "0", result)
	})

	t.Run("zero with 18 decimals", func(t *testing.T) {
		result := FormatTokenAmount(big.NewInt(0), 18)
		assert.Equal(t, "0", result)
	})

	t.Run("1 wei with 18 decimals", func(t *testing.T) {
		result := FormatTokenAmount(big.NewInt(1), 18)
		assert.Equal(t, "0.000000000000000001", result)
	})
}

// Test GetTokenAddress comprehensive cases
func TestGetTokenAddressComprehensive(t *testing.T) {
	networks := AllNetworks()
	tokens := []SupportedToken{TokenUSDC, TokenUSDT, TokenUSDT0}

	for _, network := range networks {
		for _, token := range tokens {
			addr, ok := GetTokenAddress(network, token)
			if ok {
				t.Run(string(network)+"/"+string(token), func(t *testing.T) {
					assert.True(t, strings.HasPrefix(addr, "0x"), "Address should start with 0x")
					assert.Equal(t, 42, len(addr), "Address should be 42 characters")
				})
			}
		}
	}
}

// Test demo mode payment result format
func TestDemoModePaymentResultFormat(t *testing.T) {
	config := &ServerConfig{DemoMode: true}
	server := NewServerWithIO(config, nil, nil)

	args := []byte(`{"to":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d","amount":"100","token":"USDC","network":"base"}`)
	result := server.handlePay(context.Background(), args)

	assert.False(t, result.IsError)
	text := result.Content[0].Text
	assert.Contains(t, text, "Demo Mode")
	assert.Contains(t, text, "simulated")
	assert.Contains(t, text, "100 USDC")
	assert.Contains(t, text, "base")
}

// Test demo mode bridge result format
func TestDemoModeBridgeResultFormat(t *testing.T) {
	config := &ServerConfig{DemoMode: true}
	server := NewServerWithIO(config, nil, nil)

	args := []byte(`{"fromChain":"arbitrum","toChain":"ink","amount":"50","recipient":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d"}`)
	result := server.handleBridge(context.Background(), args)

	assert.False(t, result.IsError)
	text := result.Content[0].Text
	assert.Contains(t, text, "Demo Mode")
	assert.Contains(t, text, "simulated")
	assert.Contains(t, text, "50 USDT0")
	assert.Contains(t, text, "arbitrum")
	assert.Contains(t, text, "ink")
	assert.Contains(t, text, "LayerZero Scan")
}

// Test demo mode bridge fee result format
func TestDemoModeBridgeFeeResultFormat(t *testing.T) {
	config := &ServerConfig{DemoMode: true}
	server := NewServerWithIO(config, nil, nil)

	args := []byte(`{"fromChain":"ink","toChain":"berachain","amount":"1000","recipient":"0x742d35Cc6634C0532925a3b844Bc9e7595f3dF1d"}`)
	result := server.handleGetBridgeFee(context.Background(), args)

	assert.False(t, result.IsError)
	text := result.Content[0].Text
	assert.Contains(t, text, "Bridge Fee Quote")
	assert.Contains(t, text, "ink")
	assert.Contains(t, text, "berachain")
	assert.Contains(t, text, "1000")
}

// Test bridgeable chains validation
func TestBridgeableChains(t *testing.T) {
	bridgeableChains := []string{
		"ethereum", "arbitrum", "ink", "berachain", "unichain",
	}

	for _, chain := range bridgeableChains {
		t.Run(chain+" is bridgeable", func(t *testing.T) {
			assert.True(t, IsBridgeableChain(chain))
		})
	}

	nonBridgeableChains := []string{
		"base", "polygon", "avalanche", "optimism",
	}

	for _, chain := range nonBridgeableChains {
		t.Run(chain+" is not bridgeable", func(t *testing.T) {
			assert.False(t, IsBridgeableChain(chain))
		})
	}
}

// Test gasless networks validation
func TestGaslessNetworks(t *testing.T) {
	gaslessNetworks := []string{
		"ethereum", "base", "arbitrum", "polygon", "optimism", "avalanche",
	}

	for _, network := range gaslessNetworks {
		t.Run(network+" supports gasless", func(t *testing.T) {
			assert.True(t, IsGaslessNetwork(network))
		})
	}

	nonGaslessNetworks := []string{
		"ink", "berachain", "unichain",
	}

	for _, network := range nonGaslessNetworks {
		t.Run(network+" does not support gasless", func(t *testing.T) {
			assert.False(t, IsGaslessNetwork(network))
		})
	}
}

// Test server creation
func TestServerCreation(t *testing.T) {
	config := &ServerConfig{DemoMode: true}
	server := NewServerWithIO(config, nil, nil)
	assert.NotNil(t, server)
	assert.Equal(t, config, server.config)
}

// Test LoadConfigFromEnv with various combinations
func TestLoadConfigFromEnvCombinations(t *testing.T) {
	t.Run("all empty", func(t *testing.T) {
		// Clear all env vars
		t.Setenv("T402_PRIVATE_KEY", "")
		t.Setenv("T402_DEMO_MODE", "")
		t.Setenv("T402_BUNDLER_URL", "")
		t.Setenv("T402_PAYMASTER_URL", "")

		config := LoadConfigFromEnv()

		assert.Empty(t, config.PrivateKey)
		assert.False(t, config.DemoMode)
		assert.Empty(t, config.BundlerURL)
	})

	t.Run("demo mode false", func(t *testing.T) {
		t.Setenv("T402_DEMO_MODE", "false")

		config := LoadConfigFromEnv()

		assert.False(t, config.DemoMode)
	})

	t.Run("demo mode with true value", func(t *testing.T) {
		// Note: implementation only checks for exact string "true"
		t.Setenv("T402_DEMO_MODE", "true")
		config := LoadConfigFromEnv()
		assert.True(t, config.DemoMode)
	})

	t.Run("with paymaster URL", func(t *testing.T) {
		t.Setenv("T402_PAYMASTER_URL", "https://paymaster.example.com")

		config := LoadConfigFromEnv()

		assert.Equal(t, "https://paymaster.example.com", config.PaymasterURL)
	})

	t.Run("with custom RPC URLs", func(t *testing.T) {
		t.Setenv("T402_RPC_ETHEREUM", "https://custom-eth.example.com")
		t.Setenv("T402_RPC_BASE", "https://custom-base.example.com")

		config := LoadConfigFromEnv()

		assert.Equal(t, "https://custom-eth.example.com", config.RPCURLs["ethereum"])
		assert.Equal(t, "https://custom-base.example.com", config.RPCURLs["base"])
	})
}

// Test chain ID mappings
func TestChainIDMappings(t *testing.T) {
	expectedChainIDs := map[SupportedNetwork]int64{
		NetworkEthereum:  1,
		NetworkBase:      8453,
		NetworkArbitrum:  42161,
		NetworkPolygon:   137,
		NetworkOptimism:  10,
		NetworkAvalanche: 43114,
		NetworkInk:       57073,
		NetworkBerachain: 80094,
		NetworkUnichain:  130,
	}

	for network, expectedID := range expectedChainIDs {
		t.Run(string(network), func(t *testing.T) {
			assert.Equal(t, expectedID, ChainIDs[network])
		})
	}
}

// Test native symbols mappings
func TestNativeSymbolMappings(t *testing.T) {
	expectedSymbols := map[SupportedNetwork]string{
		NetworkEthereum:  "ETH",
		NetworkBase:      "ETH",
		NetworkArbitrum:  "ETH",
		NetworkPolygon:   "MATIC",
		NetworkOptimism:  "ETH",
		NetworkAvalanche: "AVAX",
		NetworkInk:       "ETH",
		NetworkBerachain: "BERA",
		NetworkUnichain:  "ETH",
	}

	for network, expectedSymbol := range expectedSymbols {
		t.Run(string(network), func(t *testing.T) {
			assert.Equal(t, expectedSymbol, NativeSymbols[network])
		})
	}
}

// Test explorer URL generation for all networks
func TestExplorerURLGeneration(t *testing.T) {
	networks := AllNetworks()
	testHash := "0x1234567890abcdef"

	for _, network := range networks {
		t.Run(string(network), func(t *testing.T) {
			url := GetExplorerTxURL(network, testHash)
			assert.Contains(t, url, testHash)
			assert.Contains(t, url, "/tx/")
		})
	}
}

// Test JSON-RPC error response
func TestServerInvalidJSONRPCMethod(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	inputData := `{"jsonrpc":"2.0","id":999,"method":"invalid/method"}` + "\n"

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

	// Should have an error
	assert.NotNil(t, response.Error)
	assert.Equal(t, -32601, response.Error.Code) // Method not found
}

// Test server with invalid JSON input
func TestServerInvalidJSONInput(t *testing.T) {
	config := &ServerConfig{DemoMode: true}

	inputData := `{invalid json}` + "\n"

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

	// Should have a parse error
	assert.NotNil(t, response.Error)
	assert.Equal(t, -32700, response.Error.Code) // Parse error
}
