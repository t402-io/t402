package intent

import (
	"time"
)

// IntentStatus represents the current status of a payment intent
type IntentStatus string

const (
	IntentStatusPending    IntentStatus = "pending"    // Intent created, awaiting route selection
	IntentStatusRouted     IntentStatus = "routed"     // Route selected, ready for execution
	IntentStatusExecuting  IntentStatus = "executing"  // Execution in progress
	IntentStatusCompleted  IntentStatus = "completed"  // Successfully executed
	IntentStatusFailed     IntentStatus = "failed"     // Execution failed
	IntentStatusCancelled  IntentStatus = "cancelled"  // Cancelled by user
	IntentStatusExpired    IntentStatus = "expired"    // Expired before execution
)

// Intent represents a payment intent
type Intent struct {
	ID              string            `json:"id"`
	Payer           string            `json:"payer"`                     // Payer address (can be multi-chain)
	Payee           string            `json:"payee"`                     // Payee address
	Amount          string            `json:"amount"`                    // Desired amount to pay
	Asset           string            `json:"asset"`                     // Asset type (e.g., "USDT", "USDC")
	SourceNetworks  []string          `json:"sourceNetworks,omitempty"`  // Preferred source networks
	TargetNetwork   string            `json:"targetNetwork,omitempty"`   // Preferred target network
	MaxSlippage     float64           `json:"maxSlippage"`               // Maximum allowed slippage (0-1)
	MaxGasCost      string            `json:"maxGasCost,omitempty"`      // Maximum gas cost willing to pay
	Priority        IntentPriority    `json:"priority"`                  // Execution priority
	Status          IntentStatus      `json:"status"`                    // Current status
	SelectedRoute   *Route            `json:"selectedRoute,omitempty"`   // Selected execution route
	AvailableRoutes []*Route          `json:"availableRoutes,omitempty"` // All available routes
	CreatedAt       time.Time         `json:"createdAt"`                 // Creation timestamp
	ExpiresAt       time.Time         `json:"expiresAt"`                 // Expiration timestamp
	ExecutedAt      *time.Time        `json:"executedAt,omitempty"`      // Execution timestamp
	TxHashes        []string          `json:"txHashes,omitempty"`        // Transaction hashes
	ErrorMessage    string            `json:"errorMessage,omitempty"`    // Error message if failed
	Metadata        map[string]string `json:"metadata,omitempty"`        // Additional metadata
}

// IntentPriority represents execution priority
type IntentPriority string

const (
	PriorityLow      IntentPriority = "low"      // Optimize for cost
	PriorityNormal   IntentPriority = "normal"   // Balance cost and speed
	PriorityHigh     IntentPriority = "high"     // Optimize for speed
	PriorityUrgent   IntentPriority = "urgent"   // Fastest possible execution
)

// Route represents a possible execution path
type Route struct {
	ID             string      `json:"id"`
	SourceNetwork  string      `json:"sourceNetwork"`            // Source network (CAIP-2)
	TargetNetwork  string      `json:"targetNetwork"`            // Target network (CAIP-2)
	SourceAsset    string      `json:"sourceAsset"`              // Source asset address
	TargetAsset    string      `json:"targetAsset"`              // Target asset address
	InputAmount    string      `json:"inputAmount"`              // Amount to send
	OutputAmount   string      `json:"outputAmount"`             // Amount to receive
	EstimatedGas   string      `json:"estimatedGas"`             // Estimated gas cost
	EstimatedTime  int64       `json:"estimatedTime"`            // Estimated time in seconds
	Slippage       float64     `json:"slippage"`                 // Expected slippage
	Score          float64     `json:"score"`                    // Route score (higher is better)
	Steps          []*RouteStep `json:"steps"`                   // Execution steps
	RequiresBridge bool        `json:"requiresBridge"`           // Whether bridging is needed
	BridgeProtocol string      `json:"bridgeProtocol,omitempty"` // Bridge protocol if needed
	ValidUntil     time.Time   `json:"validUntil"`               // Route validity timestamp
}

// RouteStep represents a single step in a route
type RouteStep struct {
	Order       int       `json:"order"`                 // Step order (1-based)
	Type        StepType  `json:"type"`                  // Step type
	Network     string    `json:"network"`               // Network for this step
	Protocol    string    `json:"protocol,omitempty"`    // Protocol to use
	FromAsset   string    `json:"fromAsset"`             // Input asset
	ToAsset     string    `json:"toAsset"`               // Output asset
	FromAmount  string    `json:"fromAmount"`            // Input amount
	ToAmount    string    `json:"toAmount"`              // Output amount (estimated)
	GasEstimate string    `json:"gasEstimate,omitempty"` // Gas estimate for this step
	Data        string    `json:"data,omitempty"`        // Encoded transaction data
}

// StepType represents the type of route step
type StepType string

const (
	StepTypeTransfer StepType = "transfer" // Direct transfer
	StepTypeSwap     StepType = "swap"     // Token swap
	StepTypeBridge   StepType = "bridge"   // Cross-chain bridge
	StepTypeApprove  StepType = "approve"  // Token approval
	StepTypeWrap     StepType = "wrap"     // Wrap native token
	StepTypeUnwrap   StepType = "unwrap"   // Unwrap to native token
)

// CreateIntentRequest is the request to create a new intent
type CreateIntentRequest struct {
	Payer          string            `json:"payer" binding:"required"`           // Payer identifier
	Payee          string            `json:"payee" binding:"required"`           // Payee address
	Amount         string            `json:"amount" binding:"required"`          // Amount to pay
	Asset          string            `json:"asset" binding:"required"`           // Asset type
	SourceNetworks []string          `json:"sourceNetworks,omitempty"`           // Preferred sources
	TargetNetwork  string            `json:"targetNetwork,omitempty"`            // Preferred target
	MaxSlippage    float64           `json:"maxSlippage,omitempty"`              // Max slippage (default 0.5%)
	MaxGasCost     string            `json:"maxGasCost,omitempty"`               // Max gas cost
	Priority       IntentPriority    `json:"priority,omitempty"`                 // Priority (default normal)
	ExpiresIn      int64             `json:"expiresIn,omitempty"`                // Expiry in seconds (default 300)
	Metadata       map[string]string `json:"metadata,omitempty"`                 // Custom metadata
}

// CreateIntentResponse is the response after creating an intent
type CreateIntentResponse struct {
	Intent          *Intent  `json:"intent"`
	AvailableRoutes []*Route `json:"availableRoutes"`
	RecommendedRoute *Route  `json:"recommendedRoute,omitempty"`
}

// SelectRouteRequest is the request to select a route
type SelectRouteRequest struct {
	IntentID string `json:"intentId" binding:"required"` // Intent ID
	RouteID  string `json:"routeId" binding:"required"`  // Selected route ID
}

// SelectRouteResponse is the response after selecting a route
type SelectRouteResponse struct {
	Intent        *Intent `json:"intent"`
	SelectedRoute *Route  `json:"selectedRoute"`
}

// ExecuteIntentRequest is the request to execute an intent
type ExecuteIntentRequest struct {
	IntentID   string `json:"intentId" binding:"required"`   // Intent ID
	Signature  string `json:"signature" binding:"required"`  // Payer signature
	RouteID    string `json:"routeId,omitempty"`             // Optional: override selected route
}

// ExecuteIntentResponse is the response after executing an intent
type ExecuteIntentResponse struct {
	Intent    *Intent  `json:"intent"`
	TxHashes  []string `json:"txHashes"`
	Status    string   `json:"status"`
	Message   string   `json:"message,omitempty"`
}

// GetIntentResponse is the response for getting intent details
type GetIntentResponse struct {
	Intent *Intent `json:"intent"`
}

// ListIntentsRequest is the request to list intents
type ListIntentsRequest struct {
	Payer   string         `form:"payer"`   // Filter by payer
	Payee   string         `form:"payee"`   // Filter by payee
	Status  []IntentStatus `form:"status"`  // Filter by status
	Limit   int            `form:"limit"`   // Max results
	Offset  int            `form:"offset"`  // Offset for pagination
}

// ListIntentsResponse is the response for listing intents
type ListIntentsResponse struct {
	Intents []*Intent `json:"intents"`
	Total   int64     `json:"total"`
	Limit   int       `json:"limit"`
	Offset  int       `json:"offset"`
	HasMore bool      `json:"hasMore"`
}

// CancelIntentRequest is the request to cancel an intent
type CancelIntentRequest struct {
	IntentID string `json:"intentId" binding:"required"` // Intent ID
	Reason   string `json:"reason,omitempty"`            // Cancellation reason
}

// RefreshRoutesRequest is the request to refresh available routes
type RefreshRoutesRequest struct {
	IntentID string `json:"intentId" binding:"required"` // Intent ID
}

// RefreshRoutesResponse is the response after refreshing routes
type RefreshRoutesResponse struct {
	Intent           *Intent  `json:"intent"`
	AvailableRoutes  []*Route `json:"availableRoutes"`
	RecommendedRoute *Route   `json:"recommendedRoute,omitempty"`
}

// NetworkConfig represents configuration for a network
type NetworkConfig struct {
	Network       string   `json:"network"`       // CAIP-2 identifier
	Assets        []string `json:"assets"`        // Supported assets
	GasToken      string   `json:"gasToken"`      // Native gas token
	AvgBlockTime  float64  `json:"avgBlockTime"`  // Average block time in seconds
	Confirmations int      `json:"confirmations"` // Required confirmations
	BridgesFrom   []string `json:"bridgesFrom"`   // Bridge protocols available from this network
	BridgesTo     []string `json:"bridgesTo"`     // Bridge protocols available to this network
}

// AssetMapping maps asset symbols to addresses per network
type AssetMapping struct {
	Symbol   string            `json:"symbol"`   // Asset symbol (e.g., "USDT")
	Decimals int               `json:"decimals"` // Token decimals
	Networks map[string]string `json:"networks"` // Network -> address mapping
}

// BridgeQuote represents a quote from a bridge
type BridgeQuote struct {
	Protocol     string  `json:"protocol"`     // Bridge protocol name
	InputAmount  string  `json:"inputAmount"`  // Amount to send
	OutputAmount string  `json:"outputAmount"` // Amount to receive
	Fee          string  `json:"fee"`          // Bridge fee
	EstimatedTime int64  `json:"estimatedTime"` // Estimated time in seconds
	ValidUntil   time.Time `json:"validUntil"` // Quote validity
}
