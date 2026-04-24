package mcp

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"
)

// Server is the T402 MCP server.
type Server struct {
	config *ServerConfig
	reader *bufio.Reader
	writer io.Writer
}

// NewServer creates a new MCP server with the given configuration.
func NewServer(config *ServerConfig) *Server {
	return &Server{
		config: config,
		reader: bufio.NewReader(os.Stdin),
		writer: os.Stdout,
	}
}

// NewServerWithIO creates a new MCP server with custom IO for testing.
func NewServerWithIO(config *ServerConfig, reader io.Reader, writer io.Writer) *Server {
	return &Server{
		config: config,
		reader: bufio.NewReader(reader),
		writer: writer,
	}
}

// Cleanup clears sensitive data from memory.
// Should be called on server shutdown.
func (s *Server) Cleanup() {
	if s.config != nil {
		s.config.PrivateKey = ""
	}
}

// Run starts the MCP server and processes requests until EOF.
func (s *Server) Run(ctx context.Context) error {
	defer s.Cleanup()
	// Log startup to stderr (not stdout, which is for MCP protocol)
	fmt.Fprintln(os.Stderr, "T402 MCP Server starting...")
	fmt.Fprintf(os.Stderr, "Demo mode: %v\n", s.config.DemoMode)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// Read a line (JSON-RPC message)
		line, err := s.reader.ReadString('\n')
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return fmt.Errorf("error reading input: %w", err)
		}

		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Parse and handle the request
		response := s.handleRequest(ctx, []byte(line))

		// Write the response
		responseBytes, err := json.Marshal(response)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error marshaling response: %v\n", err)
			continue
		}

		fmt.Fprintln(s.writer, string(responseBytes))
	}
}

// handleRequest processes a single JSON-RPC request.
func (s *Server) handleRequest(ctx context.Context, data []byte) *JSONRPCResponse {
	var req JSONRPCRequest
	if err := json.Unmarshal(data, &req); err != nil {
		return &JSONRPCResponse{
			JSONRPC: "2.0",
			ID:      nil,
			Error: &JSONRPCError{
				Code:    -32700,
				Message: "Parse error",
				Data:    err.Error(),
			},
		}
	}

	response := &JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
	}

	switch req.Method {
	case "initialize":
		response.Result = s.handleInitialize()
	case "tools/list":
		response.Result = s.handleListTools()
	case "tools/call":
		response.Result = s.handleCallTool(ctx, req.Params)
	case "notifications/initialized":
		// Client notification, no response needed
		response.Result = map[string]any{}
	default:
		response.Error = &JSONRPCError{
			Code:    -32601,
			Message: "Method not found",
			Data:    req.Method,
		}
	}

	return response
}

// handleInitialize handles the initialize request.
func (s *Server) handleInitialize() map[string]any {
	return map[string]any{
		"protocolVersion": "2024-11-05",
		"serverInfo": map[string]any{
			"name":    "t402",
			"version": "1.0.0",
		},
		"capabilities": map[string]any{
			"tools": map[string]any{},
		},
	}
}

// handleListTools handles the tools/list request.
func (s *Server) handleListTools() map[string]any {
	return map[string]any{
		"tools": GetToolDefinitions(),
	}
}

// handleCallTool handles the tools/call request.
func (s *Server) handleCallTool(ctx context.Context, params json.RawMessage) *ToolResult {
	var callParams CallToolParams
	if err := json.Unmarshal(params, &callParams); err != nil {
		return &ToolResult{
			Content: []ContentBlock{{Type: "text", Text: fmt.Sprintf("Error parsing parameters: %v", err)}},
			IsError: true,
		}
	}

	switch callParams.Name {
	case "t402/getBalance":
		return s.handleGetBalance(ctx, callParams.Arguments)
	case "t402/getAllBalances":
		return s.handleGetAllBalances(ctx, callParams.Arguments)
	case "t402/pay":
		return s.handlePay(ctx, callParams.Arguments)
	case "t402/payGasless":
		return s.handlePayGasless(ctx, callParams.Arguments)
	case "t402/getBridgeFee":
		return s.handleGetBridgeFee(ctx, callParams.Arguments)
	case "t402/bridge":
		return s.handleBridge(ctx, callParams.Arguments)
	case "t402/getTokenPrice":
		return s.handleGetTokenPrice(ctx, callParams.Arguments)
	case "t402/getGasPrice":
		return s.handleGetGasPrice(ctx, callParams.Arguments)
	case "t402/signMessage":
		return s.handleSignMessage(ctx, callParams.Arguments)
	case "t402/wdk/getWallet":
		return s.handleWdkGetWallet(ctx, callParams.Arguments)
	case "t402/wdk/getBalances":
		return s.handleWdkGetBalances(ctx, callParams.Arguments)
	case "t402/wdk/transfer":
		return s.handleWdkTransfer(ctx, callParams.Arguments)
	case "t402/wdk/swap":
		return s.handleWdkSwap(ctx, callParams.Arguments)
	case "t402/wdk/quoteSwap":
		return s.handleWdkQuoteSwap(ctx, callParams.Arguments)
	case "t402/wdk/executeSwap":
		return s.handleWdkExecuteSwap(ctx, callParams.Arguments)
	case "t402/verifySignature":
		return s.handleVerifySignature(ctx, callParams.Arguments)
	case "t402/estimatePaymentFee":
		return s.handleEstimatePaymentFee(ctx, callParams.Arguments)
	case "t402/compareNetworkFees":
		return s.handleCompareNetworkFees(ctx, callParams.Arguments)
	case "t402/getHistoricalPrice":
		return s.handleGetHistoricalPrice(ctx, callParams.Arguments)
	case "t402/quoteBridge":
		return s.handleQuoteBridge(ctx, callParams.Arguments)
	case "t402/executeBridgeFromQuote":
		return s.handleExecuteBridgeFromQuote(ctx, callParams.Arguments)
	default:
		return &ToolResult{
			Content: []ContentBlock{{Type: "text", Text: fmt.Sprintf("Unknown tool: %s", callParams.Name)}},
			IsError: true,
		}
	}
}

// GetToolDefinitions returns all available tool definitions.
func GetToolDefinitions() []Tool {
	networks := make([]string, len(AllNetworks()))
	for i, n := range AllNetworks() {
		networks[i] = string(n)
	}

	bridgeableChains := make([]string, len(BridgeableChains))
	for i, n := range BridgeableChains {
		bridgeableChains[i] = string(n)
	}

	gaslessNetworks := make([]string, len(GaslessNetworks))
	for i, n := range GaslessNetworks {
		gaslessNetworks[i] = string(n)
	}

	return []Tool{
		{
			Name:        "t402/getBalance",
			Description: "Get token balances (native + stablecoins) for a wallet address on a specific network",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"address": {
						Type:        "string",
						Description: "Ethereum address (0x...)",
						Pattern:     "^0x[a-fA-F0-9]{40}$",
					},
					"network": {
						Type:        "string",
						Description: "Network to query",
						Enum:        networks,
					},
				},
				Required: []string{"address", "network"},
			},
		},
		{
			Name:        "t402/getAllBalances",
			Description: "Get token balances across all supported networks for a wallet address",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"address": {
						Type:        "string",
						Description: "Ethereum address (0x...)",
						Pattern:     "^0x[a-fA-F0-9]{40}$",
					},
				},
				Required: []string{"address"},
			},
		},
		{
			Name:        "t402/pay",
			Description: "Execute a stablecoin payment (USDC, USDT, or USDT0)",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"to": {
						Type:        "string",
						Description: "Recipient address (0x...)",
						Pattern:     "^0x[a-fA-F0-9]{40}$",
					},
					"amount": {
						Type:        "string",
						Description: "Amount to send (e.g., '10.5')",
						Pattern:     `^\d+(\.\d+)?$`,
					},
					"token": {
						Type:        "string",
						Description: "Token to send",
						Enum:        []string{"USDC", "USDT", "USDT0"},
					},
					"network": {
						Type:        "string",
						Description: "Network to use",
						Enum:        networks,
					},
				},
				Required: []string{"to", "amount", "token", "network"},
			},
		},
		{
			Name:        "t402/payGasless",
			Description: "Execute a gasless payment using ERC-4337 account abstraction (user pays no gas)",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"to": {
						Type:        "string",
						Description: "Recipient address (0x...)",
						Pattern:     "^0x[a-fA-F0-9]{40}$",
					},
					"amount": {
						Type:        "string",
						Description: "Amount to send (e.g., '10.5')",
						Pattern:     `^\d+(\.\d+)?$`,
					},
					"token": {
						Type:        "string",
						Description: "Token to send",
						Enum:        []string{"USDC", "USDT", "USDT0"},
					},
					"network": {
						Type:        "string",
						Description: "Network to use (must support ERC-4337)",
						Enum:        gaslessNetworks,
					},
				},
				Required: []string{"to", "amount", "token", "network"},
			},
		},
		{
			Name:        "t402/getBridgeFee",
			Description: "Get the fee quote for bridging USDT0 between chains via LayerZero",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"fromChain": {
						Type:        "string",
						Description: "Source chain",
						Enum:        bridgeableChains,
					},
					"toChain": {
						Type:        "string",
						Description: "Destination chain",
						Enum:        bridgeableChains,
					},
					"amount": {
						Type:        "string",
						Description: "Amount to bridge (e.g., '100')",
						Pattern:     `^\d+(\.\d+)?$`,
					},
					"recipient": {
						Type:        "string",
						Description: "Recipient address on destination chain (0x...)",
						Pattern:     "^0x[a-fA-F0-9]{40}$",
					},
				},
				Required: []string{"fromChain", "toChain", "amount", "recipient"},
			},
		},
		{
			Name:        "t402/bridge",
			Description: "Bridge USDT0 between chains using LayerZero OFT",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"fromChain": {
						Type:        "string",
						Description: "Source chain",
						Enum:        bridgeableChains,
					},
					"toChain": {
						Type:        "string",
						Description: "Destination chain",
						Enum:        bridgeableChains,
					},
					"amount": {
						Type:        "string",
						Description: "Amount to bridge (e.g., '100')",
						Pattern:     `^\d+(\.\d+)?$`,
					},
					"recipient": {
						Type:        "string",
						Description: "Recipient address on destination chain (0x...)",
						Pattern:     "^0x[a-fA-F0-9]{40}$",
					},
				},
				Required: []string{"fromChain", "toChain", "amount", "recipient"},
			},
		},
		{
			Name:        "t402/getTokenPrice",
			Description: "Get current token prices in a target currency via CoinGecko (e.g., ETH, USDC in USD)",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"tokens": {
						Type:        "array",
						Description: "Token symbols to price (e.g., [\"ETH\", \"USDC\"])",
					},
					"currency": {
						Type:        "string",
						Description: "Target currency (default: 'usd')",
					},
				},
				Required: []string{"tokens"},
			},
		},
		{
			Name:        "t402/getGasPrice",
			Description: "Get the current suggested gas price for a network (wei and gwei)",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"network": {
						Type:        "string",
						Description: "Network to query",
						Enum:        networks,
					},
				},
				Required: []string{"network"},
			},
		},
		{
			Name:        "t402/signMessage",
			Description: "Sign a message using the configured private key (EIP-191 personal_sign)",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"message": {
						Type:        "string",
						Description: "Plain-text message to sign",
					},
				},
				Required: []string{"message"},
			},
		},
		// ------------------------------------------------------------------
		// Phase C Batch 2: WDK tools (2026-04-24)
		//
		// Three are fully implemented (getWallet, getBalances, transfer).
		// The swap trio is schema-only for cross-SDK parity; Go has no
		// @tetherto/wdk counterpart, and the handlers return a clear
		// error directing callers to the TypeScript SDK.
		// ------------------------------------------------------------------
		{
			Name:        "t402/wdk/getWallet",
			Description: "Get wallet info (EVM address and configured chains) for the current WDK identity",
			InputSchema: InputSchema{
				Type:       "object",
				Properties: map[string]Property{},
				Required:   []string{},
			},
		},
		{
			Name:        "t402/wdk/getBalances",
			Description: "Get multi-chain balances (USDT0, USDC, native) for the WDK wallet, with totals",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"chains": {
						Type:        "array",
						Description: "Optional list of chains to check. If empty, checks all configured chains.",
					},
				},
				Required: []string{},
			},
		},
		{
			Name:        "t402/wdk/transfer",
			Description: "Send tokens via the WDK wallet. Requires `confirmed: true` to execute; otherwise returns a preview.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"to": {
						Type:        "string",
						Description: "Recipient address",
						Pattern:     "^0x[a-fA-F0-9]{40}$",
					},
					"amount": {
						Type:        "string",
						Description: "Amount to send (e.g., '10.5')",
						Pattern:     `^\d+(\.\d+)?$`,
					},
					"token": {
						Type:        "string",
						Description: "Token to transfer",
						Enum:        []string{"USDC", "USDT", "USDT0"},
					},
					"chain": {
						Type:        "string",
						Description: "Chain to execute transfer on",
						Enum:        networks,
					},
					"confirmed": {
						Type:        "boolean",
						Description: "Set to true to execute; otherwise a preview is returned.",
					},
				},
				Required: []string{"to", "amount", "token", "chain"},
			},
		},
		{
			Name:        "t402/wdk/swap",
			Description: "[Go SDK: not implemented — returns an error directing callers to the TS SDK] Swap tokens via WDK.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"fromToken": {Type: "string", Description: "Token to swap from"},
					"toToken":   {Type: "string", Description: "Token to swap to"},
					"amount":    {Type: "string", Description: "Amount to swap", Pattern: `^\d+(\.\d+)?$`},
					"chain":     {Type: "string", Description: "Chain to execute swap on", Enum: networks},
					"confirmed": {Type: "boolean", Description: "Set to true to execute; otherwise a preview is returned."},
				},
				Required: []string{"fromToken", "toToken", "amount", "chain"},
			},
		},
		{
			Name:        "t402/wdk/quoteSwap",
			Description: "[Go SDK: not implemented — returns an error directing callers to the TS SDK] Get a swap quote with a stored quoteId.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"fromToken": {Type: "string", Description: "Token to swap from"},
					"toToken":   {Type: "string", Description: "Token to swap to"},
					"amount":    {Type: "string", Description: "Amount to swap", Pattern: `^\d+(\.\d+)?$`},
					"chain":     {Type: "string", Description: "Chain to execute swap on", Enum: networks},
				},
				Required: []string{"fromToken", "toToken", "amount", "chain"},
			},
		},
		{
			Name:        "t402/wdk/executeSwap",
			Description: "[Go SDK: not implemented — returns an error directing callers to the TS SDK] Execute a swap from a stored quoteId.",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"quoteId":   {Type: "string", Description: "Quote ID from wdk/quoteSwap"},
					"confirmed": {Type: "boolean", Description: "Set to true to execute"},
				},
				Required: []string{"quoteId"},
			},
		},
		// ------------------------------------------------------------------
		// Phase C Batch 3 tools (2026-04-24)
		// ------------------------------------------------------------------
		{
			Name:        "t402/verifySignature",
			Description: "Verify an EIP-191 signed message against an expected signer address",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"chain":     {Type: "string", Description: "Blockchain network context", Enum: networks},
					"message":   {Type: "string", Description: "The original message that was signed"},
					"signature": {Type: "string", Description: "The signature to verify (hex string)", Pattern: "^0x[a-fA-F0-9]+$"},
					"address":   {Type: "string", Description: "The expected signer address", Pattern: "^0x[a-fA-F0-9]{40}$"},
				},
				Required: []string{"chain", "message", "signature", "address"},
			},
		},
		{
			Name:        "t402/estimatePaymentFee",
			Description: "Estimate gas and USD cost for an ERC-20 payment on a specific network",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"network": {Type: "string", Description: "Network to estimate on", Enum: networks},
					"amount":  {Type: "string", Description: "Payment amount", Pattern: `^\d+(\.\d+)?$`},
					"token":   {Type: "string", Description: "Token to use", Enum: []string{"USDC", "USDT", "USDT0"}},
				},
				Required: []string{"network", "amount", "token"},
			},
		},
		{
			Name:        "t402/compareNetworkFees",
			Description: "Compare payment fees across multiple networks for a given amount and token",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"amount":   {Type: "string", Description: "Payment amount", Pattern: `^\d+(\.\d+)?$`},
					"token":    {Type: "string", Description: "Token to use", Enum: []string{"USDC", "USDT", "USDT0"}},
					"networks": {Type: "array", Description: "Networks to compare. If empty, compares all supported networks."},
				},
				Required: []string{"amount", "token"},
			},
		},
		{
			Name:        "t402/getHistoricalPrice",
			Description: "Get historical price data (1-365 days) for a token via CoinGecko",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"token": {Type: "string", Description: "Token symbol (e.g., 'ETH', 'USDC')"},
					"days":  {Type: "integer", Description: "Number of days (default: 7, max: 365)"},
				},
				Required: []string{"token"},
			},
		},
		{
			Name:        "t402/quoteBridge",
			Description: "Get a USDT0 bridge quote and receive a quoteId usable with executeBridgeFromQuote",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"fromChain": {Type: "string", Description: "Source chain", Enum: bridgeableChains},
					"toChain":   {Type: "string", Description: "Destination chain", Enum: bridgeableChains},
					"amount":    {Type: "string", Description: "Amount to bridge", Pattern: `^\d+(\.\d+)?$`},
					"recipient": {Type: "string", Description: "Recipient address on destination chain", Pattern: "^0x[a-fA-F0-9]{40}$"},
				},
				Required: []string{"fromChain", "toChain", "amount", "recipient"},
			},
		},
		{
			Name:        "t402/executeBridgeFromQuote",
			Description: "Execute a USDT0 bridge from a stored quoteId (requires confirmed: true)",
			InputSchema: InputSchema{
				Type: "object",
				Properties: map[string]Property{
					"quoteId":   {Type: "string", Description: "Quote ID from t402/quoteBridge"},
					"confirmed": {Type: "boolean", Description: "Set to true to execute"},
				},
				Required: []string{"quoteId"},
			},
		},
	}
}

// LoadConfigFromEnv loads server configuration from environment variables.
func LoadConfigFromEnv() *ServerConfig {
	config := &ServerConfig{
		PrivateKey:   os.Getenv("T402_PRIVATE_KEY"),
		DemoMode:     os.Getenv("T402_DEMO_MODE") == "true",
		BundlerURL:   os.Getenv("T402_BUNDLER_URL"),
		PaymasterURL: os.Getenv("T402_PAYMASTER_URL"),
		RPCURLs:      make(map[string]string),
	}

	// Load network-specific RPC URLs
	for _, network := range AllNetworks() {
		envKey := fmt.Sprintf("T402_RPC_%s", strings.ToUpper(string(network)))
		if url := os.Getenv(envKey); url != "" {
			config.RPCURLs[string(network)] = url
		}
	}

	return config
}
