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
