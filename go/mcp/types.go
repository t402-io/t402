// Package mcp provides a Model Context Protocol (MCP) server for T402 payments.
package mcp

import (
	"encoding/json"
)

// ServerConfig holds the MCP server configuration.
type ServerConfig struct {
	// PrivateKey is the hex wallet private key with 0x prefix.
	PrivateKey string `json:"privateKey,omitempty"`
	// RPCURLs are custom RPC endpoints by network.
	RPCURLs map[string]string `json:"rpcUrls,omitempty"`
	// DemoMode enables transaction simulation without executing.
	DemoMode bool `json:"demoMode,omitempty"`
	// PaymasterURL is the ERC-4337 paymaster endpoint.
	PaymasterURL string `json:"paymasterUrl,omitempty"`
	// BundlerURL is the ERC-4337 bundler endpoint.
	BundlerURL string `json:"bundlerUrl,omitempty"`
}

// SupportedNetwork represents a supported blockchain network.
type SupportedNetwork string

const (
	NetworkEthereum  SupportedNetwork = "ethereum"
	NetworkBase      SupportedNetwork = "base"
	NetworkArbitrum  SupportedNetwork = "arbitrum"
	NetworkOptimism  SupportedNetwork = "optimism"
	NetworkPolygon   SupportedNetwork = "polygon"
	NetworkAvalanche SupportedNetwork = "avalanche"
	NetworkInk       SupportedNetwork = "ink"
	NetworkBerachain SupportedNetwork = "berachain"
	NetworkUnichain  SupportedNetwork = "unichain"
)

// SupportedToken represents a supported token type.
type SupportedToken string

const (
	TokenUSDC  SupportedToken = "USDC"
	TokenUSDT  SupportedToken = "USDT"
	TokenUSDT0 SupportedToken = "USDT0"
)

// ===== MCP Protocol Types =====

// JSONRPCRequest represents a JSON-RPC 2.0 request.
type JSONRPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

// JSONRPCResponse represents a JSON-RPC 2.0 response.
type JSONRPCResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Result  any             `json:"result,omitempty"`
	Error   *JSONRPCError   `json:"error,omitempty"`
}

// JSONRPCError represents a JSON-RPC 2.0 error.
type JSONRPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

// ===== MCP Tool Types =====

// Tool represents an MCP tool definition.
type Tool struct {
	Name        string      `json:"name"`
	Description string      `json:"description"`
	InputSchema InputSchema `json:"inputSchema"`
}

// InputSchema represents the JSON Schema for tool inputs.
type InputSchema struct {
	Type       string                 `json:"type"`
	Properties map[string]Property    `json:"properties"`
	Required   []string               `json:"required,omitempty"`
}

// Property represents a JSON Schema property.
type Property struct {
	Type        string   `json:"type"`
	Description string   `json:"description,omitempty"`
	Enum        []string `json:"enum,omitempty"`
	Pattern     string   `json:"pattern,omitempty"`
}

// CallToolParams represents the parameters for a tool call.
type CallToolParams struct {
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments,omitempty"`
}

// ToolResult represents the result of a tool execution.
type ToolResult struct {
	Content []ContentBlock `json:"content"`
	IsError bool           `json:"isError,omitempty"`
}

// ContentBlock represents a content block in tool result.
type ContentBlock struct {
	Type string `json:"type"`
	Text string `json:"text,omitempty"`
}

// ===== Tool Input Types =====

// GetBalanceInput is the input for t402/getBalance.
type GetBalanceInput struct {
	Address string           `json:"address"`
	Network SupportedNetwork `json:"network"`
}

// GetAllBalancesInput is the input for t402/getAllBalances.
type GetAllBalancesInput struct {
	Address string `json:"address"`
}

// PayInput is the input for t402/pay.
type PayInput struct {
	To      string           `json:"to"`
	Amount  string           `json:"amount"`
	Token   SupportedToken   `json:"token"`
	Network SupportedNetwork `json:"network"`
}

// PayGaslessInput is the input for t402/payGasless.
type PayGaslessInput struct {
	To      string           `json:"to"`
	Amount  string           `json:"amount"`
	Token   SupportedToken   `json:"token"`
	Network SupportedNetwork `json:"network"`
}

// GetBridgeFeeInput is the input for t402/getBridgeFee.
type GetBridgeFeeInput struct {
	FromChain string `json:"fromChain"`
	ToChain   string `json:"toChain"`
	Amount    string `json:"amount"`
	Recipient string `json:"recipient"`
}

// BridgeInput is the input for t402/bridge.
type BridgeInput struct {
	FromChain string `json:"fromChain"`
	ToChain   string `json:"toChain"`
	Amount    string `json:"amount"`
	Recipient string `json:"recipient"`
}

// ===== Tool Result Types =====

// BalanceInfo represents balance information for a token.
type BalanceInfo struct {
	Token   string `json:"token"`
	Balance string `json:"balance"`
	Raw     string `json:"raw"`
}

// NetworkBalance represents balances for a single network.
type NetworkBalance struct {
	Network  string        `json:"network"`
	Native   BalanceInfo   `json:"native"`
	Tokens   []BalanceInfo `json:"tokens"`
	Error    string        `json:"error,omitempty"`
}

// PaymentResult represents the result of a payment.
type PaymentResult struct {
	TxHash      string `json:"txHash"`
	From        string `json:"from"`
	To          string `json:"to"`
	Amount      string `json:"amount"`
	Token       string `json:"token"`
	Network     string `json:"network"`
	ExplorerURL string `json:"explorerUrl"`
	DemoMode    bool   `json:"demoMode,omitempty"`
}

// BridgeFeeResult represents the result of a bridge fee query.
type BridgeFeeResult struct {
	NativeFee     string `json:"nativeFee"`
	NativeSymbol  string `json:"nativeSymbol"`
	FromChain     string `json:"fromChain"`
	ToChain       string `json:"toChain"`
	Amount        string `json:"amount"`
	EstimatedTime int    `json:"estimatedTime"`
}

// BridgeResult represents the result of a bridge operation.
type BridgeResult struct {
	TxHash        string `json:"txHash"`
	MessageGUID   string `json:"messageGuid"`
	FromChain     string `json:"fromChain"`
	ToChain       string `json:"toChain"`
	Amount        string `json:"amount"`
	ExplorerURL   string `json:"explorerUrl"`
	TrackingURL   string `json:"trackingUrl"`
	EstimatedTime int    `json:"estimatedTime"`
	DemoMode      bool   `json:"demoMode,omitempty"`
}
