package http

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

// ============================================================================
// Intent Types
// ============================================================================

// IntentStatus represents the current status of a payment intent
type IntentStatus string

const (
	IntentStatusPending   IntentStatus = "pending"
	IntentStatusRouted    IntentStatus = "routed"
	IntentStatusExecuting IntentStatus = "executing"
	IntentStatusCompleted IntentStatus = "completed"
	IntentStatusFailed    IntentStatus = "failed"
	IntentStatusCancelled IntentStatus = "cancelled"
	IntentStatusExpired   IntentStatus = "expired"
)

// IntentPriority represents execution priority
type IntentPriority string

const (
	IntentPriorityLow    IntentPriority = "low"
	IntentPriorityNormal IntentPriority = "normal"
	IntentPriorityHigh   IntentPriority = "high"
	IntentPriorityUrgent IntentPriority = "urgent"
)

// RouteStepType represents the type of route step
type RouteStepType string

const (
	RouteStepTransfer RouteStepType = "transfer"
	RouteStepSwap     RouteStepType = "swap"
	RouteStepBridge   RouteStepType = "bridge"
	RouteStepApprove  RouteStepType = "approve"
	RouteStepWrap     RouteStepType = "wrap"
	RouteStepUnwrap   RouteStepType = "unwrap"
)

// RouteStep represents a single step in a route
type RouteStep struct {
	Order       int           `json:"order"`
	Type        RouteStepType `json:"type"`
	Network     string        `json:"network"`
	Protocol    string        `json:"protocol,omitempty"`
	FromAsset   string        `json:"fromAsset"`
	ToAsset     string        `json:"toAsset"`
	FromAmount  string        `json:"fromAmount"`
	ToAmount    string        `json:"toAmount"`
	GasEstimate string        `json:"gasEstimate,omitempty"`
	Data        string        `json:"data,omitempty"`
}

// Route represents a possible execution path for an intent
type Route struct {
	ID             string       `json:"id"`
	SourceNetwork  string       `json:"sourceNetwork"`
	TargetNetwork  string       `json:"targetNetwork"`
	SourceAsset    string       `json:"sourceAsset"`
	TargetAsset    string       `json:"targetAsset"`
	InputAmount    string       `json:"inputAmount"`
	OutputAmount   string       `json:"outputAmount"`
	EstimatedGas   string       `json:"estimatedGas"`
	EstimatedTime  int64        `json:"estimatedTime"`
	Slippage       float64      `json:"slippage"`
	Score          float64      `json:"score"`
	Steps          []*RouteStep `json:"steps"`
	RequiresBridge bool         `json:"requiresBridge"`
	BridgeProtocol string       `json:"bridgeProtocol,omitempty"`
	ValidUntil     time.Time    `json:"validUntil"`
}

// Intent represents a payment intent
type Intent struct {
	ID              string            `json:"id"`
	Payer           string            `json:"payer"`
	Payee           string            `json:"payee"`
	Amount          string            `json:"amount"`
	Asset           string            `json:"asset"`
	SourceNetworks  []string          `json:"sourceNetworks,omitempty"`
	TargetNetwork   string            `json:"targetNetwork,omitempty"`
	MaxSlippage     float64           `json:"maxSlippage"`
	MaxGasCost      string            `json:"maxGasCost,omitempty"`
	Priority        IntentPriority    `json:"priority"`
	Status          IntentStatus      `json:"status"`
	SelectedRoute   *Route            `json:"selectedRoute,omitempty"`
	AvailableRoutes []*Route          `json:"availableRoutes,omitempty"`
	CreatedAt       time.Time         `json:"createdAt"`
	ExpiresAt       time.Time         `json:"expiresAt"`
	ExecutedAt      *time.Time        `json:"executedAt,omitempty"`
	TxHashes        []string          `json:"txHashes,omitempty"`
	ErrorMessage    string            `json:"errorMessage,omitempty"`
	Metadata        map[string]string `json:"metadata,omitempty"`
}

// CreateIntentRequest is the request to create a new intent
type CreateIntentRequest struct {
	Payer          string            `json:"payer"`
	Payee          string            `json:"payee"`
	Amount         string            `json:"amount"`
	Asset          string            `json:"asset"`
	SourceNetworks []string          `json:"sourceNetworks,omitempty"`
	TargetNetwork  string            `json:"targetNetwork,omitempty"`
	MaxSlippage    float64           `json:"maxSlippage,omitempty"`
	MaxGasCost     string            `json:"maxGasCost,omitempty"`
	Priority       IntentPriority    `json:"priority,omitempty"`
	ExpiresIn      int64             `json:"expiresIn,omitempty"`
	Metadata       map[string]string `json:"metadata,omitempty"`
}

// CreateIntentResponse is the response after creating an intent
type CreateIntentResponse struct {
	Intent           *Intent  `json:"intent"`
	AvailableRoutes  []*Route `json:"availableRoutes"`
	RecommendedRoute *Route   `json:"recommendedRoute,omitempty"`
}

// SelectRouteRequest is the request to select a route
type SelectRouteRequest struct {
	RouteID string `json:"routeId"`
}

// SelectRouteResponse is the response after selecting a route
type SelectRouteResponse struct {
	Intent        *Intent `json:"intent"`
	SelectedRoute *Route  `json:"selectedRoute"`
}

// ExecuteIntentRequest is the request to execute an intent
type ExecuteIntentRequest struct {
	Signature string `json:"signature"`
	RouteID   string `json:"routeId,omitempty"`
}

// ExecuteIntentResponse is the response after executing an intent
type ExecuteIntentResponse struct {
	Intent   *Intent  `json:"intent"`
	TxHashes []string `json:"txHashes"`
	Status   string   `json:"status"`
	Message  string   `json:"message,omitempty"`
}

// GetIntentResponse is the response for getting intent details
type GetIntentResponse struct {
	Intent *Intent `json:"intent"`
}

// CancelIntentRequest is the request to cancel an intent
type CancelIntentRequest struct {
	Reason string `json:"reason,omitempty"`
}

// CancelIntentResponse is the response for cancelling an intent
type CancelIntentResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

// RefreshRoutesResponse is the response after refreshing routes
type RefreshRoutesResponse struct {
	Intent           *Intent  `json:"intent"`
	AvailableRoutes  []*Route `json:"availableRoutes"`
	RecommendedRoute *Route   `json:"recommendedRoute,omitempty"`
}

// ListIntentsParams configures optional filters for listing intents
type ListIntentsParams struct {
	Payer  string
	Payee  string
	Status []IntentStatus
	Limit  int
	Offset int
}

// ListIntentsResponse is the response for listing intents
type ListIntentsResponse struct {
	Intents []*Intent `json:"intents"`
	Total   int64     `json:"total"`
	Limit   int       `json:"limit"`
	Offset  int       `json:"offset"`
	HasMore bool      `json:"hasMore"`
}

// IntentStats maps intent status to count
type IntentStats map[string]int64

// ============================================================================
// Intent Client
// ============================================================================

// IntentClientConfig configures the intent client
type IntentClientConfig struct {
	// URL is the base URL of the facilitator service
	URL string

	// HTTPClient is the HTTP client to use (optional)
	HTTPClient *http.Client

	// APIKey for authentication (optional)
	APIKey string

	// Timeout for requests (optional, defaults to 30s)
	Timeout time.Duration
}

// IntentClient communicates with the facilitator intent API
type IntentClient struct {
	url        string
	httpClient *http.Client
	apiKey     string
}

// NewIntentClient creates a new intent client
func NewIntentClient(config *IntentClientConfig) *IntentClient {
	if config == nil {
		config = &IntentClientConfig{}
	}

	u := config.URL
	if u == "" {
		u = DefaultFacilitatorURL
	}

	httpClient := config.HTTPClient
	if httpClient == nil {
		timeout := config.Timeout
		if timeout == 0 {
			timeout = 30 * time.Second
		}
		httpClient = &http.Client{Timeout: timeout}
	}

	return &IntentClient{
		url:        u,
		httpClient: httpClient,
		apiKey:     config.APIKey,
	}
}

// CreateIntent creates a new payment intent and gets available routes
func (c *IntentClient) CreateIntent(ctx context.Context, req *CreateIntentRequest) (*CreateIntentResponse, error) {
	var resp CreateIntentResponse
	if err := c.doPost(ctx, "/v1/intent", req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// GetIntent gets intent details by ID
func (c *IntentClient) GetIntent(ctx context.Context, id string) (*GetIntentResponse, error) {
	var resp GetIntentResponse
	path := "/v1/intent/" + url.PathEscape(id)
	if err := c.doGet(ctx, path, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// SelectRoute selects a route for an intent
func (c *IntentClient) SelectRoute(ctx context.Context, id string, req *SelectRouteRequest) (*SelectRouteResponse, error) {
	var resp SelectRouteResponse
	path := "/v1/intent/" + url.PathEscape(id) + "/route"
	if err := c.doPost(ctx, path, req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// ExecuteIntent executes an intent with a signed authorization
func (c *IntentClient) ExecuteIntent(ctx context.Context, id string, req *ExecuteIntentRequest) (*ExecuteIntentResponse, error) {
	var resp ExecuteIntentResponse
	path := "/v1/intent/" + url.PathEscape(id) + "/execute"
	if err := c.doPost(ctx, path, req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// CancelIntent cancels a pending intent
func (c *IntentClient) CancelIntent(ctx context.Context, id string, req *CancelIntentRequest) (*CancelIntentResponse, error) {
	var resp CancelIntentResponse
	path := "/v1/intent/" + url.PathEscape(id) + "/cancel"
	body := req
	if body == nil {
		body = &CancelIntentRequest{}
	}
	if err := c.doPost(ctx, path, body, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// RefreshRoutes refreshes available routes for an intent
func (c *IntentClient) RefreshRoutes(ctx context.Context, id string) (*RefreshRoutesResponse, error) {
	var resp RefreshRoutesResponse
	path := "/v1/intent/" + url.PathEscape(id) + "/refresh"
	if err := c.doPost(ctx, path, struct{}{}, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// ListIntents lists intents with optional filters
func (c *IntentClient) ListIntents(ctx context.Context, filters *ListIntentsParams) (*ListIntentsResponse, error) {
	params := url.Values{}
	if filters != nil {
		if filters.Payer != "" {
			params.Set("payer", filters.Payer)
		}
		if filters.Payee != "" {
			params.Set("payee", filters.Payee)
		}
		for _, s := range filters.Status {
			params.Add("status", string(s))
		}
		if filters.Limit > 0 {
			params.Set("limit", strconv.Itoa(filters.Limit))
		}
		if filters.Offset > 0 {
			params.Set("offset", strconv.Itoa(filters.Offset))
		}
	}
	path := "/v1/intent"
	if query := params.Encode(); query != "" {
		path += "?" + query
	}

	var resp ListIntentsResponse
	if err := c.doGet(ctx, path, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// GetIntentStats gets intent statistics (counts by status)
func (c *IntentClient) GetIntentStats(ctx context.Context) (IntentStats, error) {
	var resp IntentStats
	if err := c.doGet(ctx, "/v1/intent/stats", &resp); err != nil {
		return nil, err
	}
	return resp, nil
}

// ============================================================================
// Internal HTTP helpers
// ============================================================================

func (c *IntentClient) setHeaders(req *http.Request) {
	req.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}
}

func (c *IntentClient) doPost(ctx context.Context, path string, body interface{}, result interface{}) error {
	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.url+path, bytes.NewReader(bodyBytes))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("intent API %s request failed: %w", path, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("intent API %s failed (%d): %s", path, resp.StatusCode, string(respBody))
	}

	if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}
	return nil
}

func (c *IntentClient) doGet(ctx context.Context, path string, result interface{}) error {
	req, err := http.NewRequestWithContext(ctx, "GET", c.url+path, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("intent API %s request failed: %w", path, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("intent API %s failed (%d): %s", path, resp.StatusCode, string(respBody))
	}

	if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}
	return nil
}
