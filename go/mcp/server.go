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

// Run starts the MCP server and processes requests until EOF.
func (s *Server) Run(ctx context.Context) error {
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
