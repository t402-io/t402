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
// Streaming Types
// ============================================================================

// StreamStatus represents the current status of a payment stream
type StreamStatus string

const (
	StreamStatusPending   StreamStatus = "pending"
	StreamStatusActive    StreamStatus = "active"
	StreamStatusPaused    StreamStatus = "paused"
	StreamStatusClosing   StreamStatus = "closing"
	StreamStatusClosed    StreamStatus = "closed"
	StreamStatusCancelled StreamStatus = "cancelled"
	StreamStatusExpired   StreamStatus = "expired"
)

// StreamMetadata holds optional stream metadata
type StreamMetadata struct {
	ResourceID  string            `json:"resourceId,omitempty"`
	Description string            `json:"description,omitempty"`
	Tags        []string          `json:"tags,omitempty"`
	Extra       map[string]string `json:"extra,omitempty"`
}

// Stream represents a payment stream/channel
type Stream struct {
	ID               string         `json:"id"`
	Network          string         `json:"network"`
	Scheme           string         `json:"scheme"`
	Payer            string         `json:"payer"`
	Payee            string         `json:"payee"`
	Asset            string         `json:"asset"`
	MaxAmount        string         `json:"maxAmount"`
	CurrentAmount    string         `json:"currentAmount"`
	SettledAmount    string         `json:"settledAmount"`
	RatePerSecond    string         `json:"ratePerSecond"`
	Status           StreamStatus   `json:"status"`
	CreatedAt        time.Time      `json:"createdAt"`
	ActivatedAt      *time.Time     `json:"activatedAt"`
	LastUpdatedAt    time.Time      `json:"lastUpdatedAt"`
	ExpiresAt        *time.Time     `json:"expiresAt"`
	ClosedAt         *time.Time     `json:"closedAt"`
	DepositTxHash    string         `json:"depositTxHash"`
	SettlementTxHash string         `json:"settlementTxHash"`
	Metadata         StreamMetadata `json:"metadata"`
}

// StreamUpdate represents an update to a stream
type StreamUpdate struct {
	ID            string    `json:"id"`
	StreamID      string    `json:"streamId"`
	Amount        string    `json:"amount"`
	Signature     string    `json:"signature"`
	Timestamp     time.Time `json:"timestamp"`
	SequenceNum   uint64    `json:"sequenceNum"`
	ResourceUnits int64     `json:"resourceUnits"`
}

// StreamStats contains statistics about a stream
type StreamStats struct {
	TotalUpdates    int64   `json:"totalUpdates"`
	AverageRate     string  `json:"averageRate"`
	Duration        int64   `json:"duration"`
	ResourcesUsed   int64   `json:"resourcesUsed"`
	EfficiencyScore float64 `json:"efficiencyScore"`
}

// OpenStreamRequest is the request to open a new stream
type OpenStreamRequest struct {
	Network       string          `json:"network"`
	Scheme        string          `json:"scheme"`
	Payer         string          `json:"payer"`
	Payee         string          `json:"payee"`
	Asset         string          `json:"asset"`
	MaxAmount     string          `json:"maxAmount"`
	RatePerSecond string          `json:"ratePerSecond,omitempty"`
	ExpiresAt     *time.Time      `json:"expiresAt,omitempty"`
	Signature     string          `json:"signature"`
	Metadata      *StreamMetadata `json:"metadata,omitempty"`
}

// OpenStreamResponse is the response after opening a stream
type OpenStreamResponse struct {
	Stream        *Stream `json:"stream"`
	DepositAmount string  `json:"depositAmount,omitempty"`
	DepositTo     string  `json:"depositTo,omitempty"`
}

// UpdateStreamRequest is the request to update a stream
type UpdateStreamRequest struct {
	StreamID      string `json:"streamId"`
	Amount        string `json:"amount"`
	Signature     string `json:"signature"`
	ResourceUnits int64  `json:"resourceUnits,omitempty"`
}

// UpdateStreamResponse is the response after updating a stream
type UpdateStreamResponse struct {
	Stream      *Stream       `json:"stream"`
	Update      *StreamUpdate `json:"update"`
	Remaining   string        `json:"remaining"`
	CanContinue bool          `json:"canContinue"`
}

// CloseStreamRequest is the request to close a stream
type CloseStreamRequest struct {
	StreamID       string `json:"streamId"`
	FinalAmount    string `json:"finalAmount"`
	PayerSignature string `json:"payerSignature"`
	PayeeSignature string `json:"payeeSignature,omitempty"`
	Reason         string `json:"reason,omitempty"`
}

// CloseStreamResponse is the response after closing a stream
type CloseStreamResponse struct {
	Stream        *Stream `json:"stream"`
	SettledAmount string  `json:"settledAmount"`
	TxHash        string  `json:"txHash"`
	RefundAmount  string  `json:"refundAmount"`
}

// GetStreamOptions configures optional query parameters for GetStream
type GetStreamOptions struct {
	IncludeUpdates bool
	IncludeStats   bool
}

// GetStreamResponse is the response for getting stream details
type GetStreamResponse struct {
	Stream  *Stream         `json:"stream"`
	Updates []*StreamUpdate `json:"updates,omitempty"`
	Stats   *StreamStats    `json:"stats,omitempty"`
}

// PauseResumeResponse is the response for pause/resume operations
type PauseResumeResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

// ListStreamsParams configures optional filters for listing streams
type ListStreamsParams struct {
	Network   string
	Payer     string
	Payee     string
	Status    []StreamStatus
	Limit     int
	Offset    int
	OrderBy   string
	OrderDesc bool
}

// ListStreamsResponse is the response for listing streams
type ListStreamsResponse struct {
	Streams []*Stream `json:"streams"`
	Total   int64     `json:"total"`
	Limit   int       `json:"limit"`
	Offset  int       `json:"offset"`
	HasMore bool      `json:"hasMore"`
}

// ============================================================================
// Streaming Client
// ============================================================================

// StreamingClientConfig configures the streaming client
type StreamingClientConfig struct {
	// URL is the base URL of the facilitator service
	URL string

	// HTTPClient is the HTTP client to use (optional)
	HTTPClient *http.Client

	// APIKey for authentication (optional)
	APIKey string

	// RequesterAddress for pause/resume operations (optional)
	RequesterAddress string

	// Timeout for requests (optional, defaults to 30s)
	Timeout time.Duration
}

// StreamingClient communicates with the facilitator streaming API
type StreamingClient struct {
	url              string
	httpClient       *http.Client
	apiKey           string
	requesterAddress string
}

// NewStreamingClient creates a new streaming client
func NewStreamingClient(config *StreamingClientConfig) *StreamingClient {
	if config == nil {
		config = &StreamingClientConfig{}
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

	return &StreamingClient{
		url:              u,
		httpClient:       httpClient,
		apiKey:           config.APIKey,
		requesterAddress: config.RequesterAddress,
	}
}

// OpenStream opens a new payment stream
func (c *StreamingClient) OpenStream(ctx context.Context, req *OpenStreamRequest) (*OpenStreamResponse, error) {
	var resp OpenStreamResponse
	if err := c.doPost(ctx, "/v1/stream/open", req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// UpdateStream updates a stream with a new cumulative amount
func (c *StreamingClient) UpdateStream(ctx context.Context, req *UpdateStreamRequest) (*UpdateStreamResponse, error) {
	var resp UpdateStreamResponse
	if err := c.doPost(ctx, "/v1/stream/update", req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// CloseStream closes a stream and settles the final amount
func (c *StreamingClient) CloseStream(ctx context.Context, req *CloseStreamRequest) (*CloseStreamResponse, error) {
	var resp CloseStreamResponse
	if err := c.doPost(ctx, "/v1/stream/close", req, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// GetStream gets stream details by ID
func (c *StreamingClient) GetStream(ctx context.Context, id string, opts *GetStreamOptions) (*GetStreamResponse, error) {
	params := url.Values{}
	if opts != nil {
		if opts.IncludeUpdates {
			params.Set("include_updates", "true")
		}
		if opts.IncludeStats {
			params.Set("include_stats", "true")
		}
	}
	path := "/v1/stream/" + url.PathEscape(id)
	if query := params.Encode(); query != "" {
		path += "?" + query
	}

	var resp GetStreamResponse
	if err := c.doGet(ctx, path, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// PauseStream pauses an active stream
func (c *StreamingClient) PauseStream(ctx context.Context, id string) (*PauseResumeResponse, error) {
	var resp PauseResumeResponse
	path := "/v1/stream/" + url.PathEscape(id) + "/pause"
	if err := c.doPost(ctx, path, struct{}{}, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// ResumeStream resumes a paused stream
func (c *StreamingClient) ResumeStream(ctx context.Context, id string) (*PauseResumeResponse, error) {
	var resp PauseResumeResponse
	path := "/v1/stream/" + url.PathEscape(id) + "/resume"
	if err := c.doPost(ctx, path, struct{}{}, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// ListStreams lists streams with optional filters
func (c *StreamingClient) ListStreams(ctx context.Context, filters *ListStreamsParams) (*ListStreamsResponse, error) {
	params := url.Values{}
	if filters != nil {
		if filters.Network != "" {
			params.Set("network", filters.Network)
		}
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
		if filters.OrderBy != "" {
			params.Set("orderBy", filters.OrderBy)
		}
		if filters.OrderDesc {
			params.Set("orderDesc", "true")
		}
	}
	path := "/v1/stream"
	if query := params.Encode(); query != "" {
		path += "?" + query
	}

	var resp ListStreamsResponse
	if err := c.doGet(ctx, path, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// ============================================================================
// Internal HTTP helpers
// ============================================================================

func (c *StreamingClient) setHeaders(req *http.Request) {
	req.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		req.Header.Set("Authorization", "Bearer "+c.apiKey)
	}
	if c.requesterAddress != "" {
		req.Header.Set("X-Requester-Address", c.requesterAddress)
	}
}

func (c *StreamingClient) doPost(ctx context.Context, path string, body interface{}, result interface{}) error {
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
		return fmt.Errorf("streaming API %s request failed: %w", path, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("streaming API %s failed (%d): %s", path, resp.StatusCode, string(respBody))
	}

	if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}
	return nil
}

func (c *StreamingClient) doGet(ctx context.Context, path string, result interface{}) error {
	req, err := http.NewRequestWithContext(ctx, "GET", c.url+path, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	c.setHeaders(req)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("streaming API %s request failed: %w", path, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("streaming API %s failed (%d): %s", path, resp.StatusCode, string(respBody))
	}

	if err := json.NewDecoder(resp.Body).Decode(result); err != nil {
		return fmt.Errorf("failed to decode response: %w", err)
	}
	return nil
}
