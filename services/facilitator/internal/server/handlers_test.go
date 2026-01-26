package server

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/services/facilitator/internal/config"
	"github.com/t402-io/t402/services/facilitator/internal/metrics"
)

var (
	testMetrics     *metrics.Metrics
	testMetricsOnce sync.Once
)

func init() {
	gin.SetMode(gin.TestMode)
}

func getTestMetrics() *metrics.Metrics {
	testMetricsOnce.Do(func() {
		testMetrics = metrics.New()
	})
	return testMetrics
}

// MockFacilitator is a mock implementation of the Facilitator interface
type MockFacilitator struct {
	VerifyFunc       func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error)
	SettleFunc       func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error)
	GetSupportedFunc func() t402.SupportedResponse
}

func (m *MockFacilitator) Verify(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
	return m.VerifyFunc(ctx, payloadBytes, requirementsBytes)
}

func (m *MockFacilitator) Settle(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
	return m.SettleFunc(ctx, payloadBytes, requirementsBytes)
}

func (m *MockFacilitator) GetSupported() t402.SupportedResponse {
	return m.GetSupportedFunc()
}

func newTestServer(f Facilitator) *Server {
	cfg := &config.Config{
		Port:        8080,
		Environment: "test",
	}

	return &Server{
		router:      gin.New(),
		facilitator: f,
		config:      cfg,
		metrics:     getTestMetrics(),
	}
}

func TestHandleVerify_Success(t *testing.T) {
	mock := &MockFacilitator{
		VerifyFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
			return &t402.VerifyResponse{
				IsValid: true,
				Payer:   "0x1234567890abcdef",
			}, nil
		},
	}

	server := newTestServer(mock)
	router := gin.New()
	router.POST("/verify", server.handleVerify)

	body := `{"paymentPayload":{"test":"payload"},"paymentRequirements":{"network":"eip155:1","scheme":"exact"}}`
	req := httptest.NewRequest(http.MethodPost, "/verify", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp t402.VerifyResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if !resp.IsValid {
		t.Error("expected IsValid=true")
	}
	if resp.Payer != "0x1234567890abcdef" {
		t.Errorf("expected Payer=0x1234567890abcdef, got %s", resp.Payer)
	}
}

func TestHandleVerify_InvalidBody(t *testing.T) {
	mock := &MockFacilitator{}
	server := newTestServer(mock)
	router := gin.New()
	router.POST("/verify", server.handleVerify)

	// Missing required fields
	body := `{"paymentPayload":{}}`
	req := httptest.NewRequest(http.MethodPost, "/verify", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
}

func TestHandleVerify_FacilitatorError(t *testing.T) {
	mock := &MockFacilitator{
		VerifyFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
			return nil, errors.New("verification failed")
		},
	}

	server := newTestServer(mock)
	router := gin.New()
	router.POST("/verify", server.handleVerify)

	body := `{"paymentPayload":{"test":"payload"},"paymentRequirements":{"network":"eip155:1","scheme":"exact"}}`
	req := httptest.NewRequest(http.MethodPost, "/verify", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected status 500, got %d", w.Code)
	}
}

func TestHandleSettle_Success(t *testing.T) {
	mock := &MockFacilitator{
		SettleFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{
				Success:     true,
				Payer:       "0x1234567890abcdef",
				Transaction: "0xabc123",
				Network:     "eip155:1",
			}, nil
		},
	}

	server := newTestServer(mock)
	router := gin.New()
	router.POST("/settle", server.handleSettle)

	body := `{"paymentPayload":{"test":"payload"},"paymentRequirements":{"network":"eip155:1","scheme":"exact"}}`
	req := httptest.NewRequest(http.MethodPost, "/settle", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp t402.SettleResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if !resp.Success {
		t.Error("expected Success=true")
	}
	if resp.Transaction != "0xabc123" {
		t.Errorf("expected Transaction=0xabc123, got %s", resp.Transaction)
	}
}

func TestHandleSettle_Failure(t *testing.T) {
	mock := &MockFacilitator{
		SettleFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{
				Success:     false,
				ErrorReason: "insufficient funds",
			}, nil
		},
	}

	server := newTestServer(mock)
	router := gin.New()
	router.POST("/settle", server.handleSettle)

	body := `{"paymentPayload":{"test":"payload"},"paymentRequirements":{"network":"eip155:1","scheme":"exact"}}`
	req := httptest.NewRequest(http.MethodPost, "/settle", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// Should return 422 for unsuccessful settlement
	if w.Code != http.StatusUnprocessableEntity {
		t.Errorf("expected status 422, got %d", w.Code)
	}
}

func TestHandleSettle_InvalidBody(t *testing.T) {
	mock := &MockFacilitator{}
	server := newTestServer(mock)
	router := gin.New()
	router.POST("/settle", server.handleSettle)

	body := `{"invalid":"json`
	req := httptest.NewRequest(http.MethodPost, "/settle", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
}

func TestHandleSettle_FacilitatorError(t *testing.T) {
	mock := &MockFacilitator{
		SettleFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
			return nil, errors.New("settlement error")
		},
	}

	server := newTestServer(mock)
	router := gin.New()
	router.POST("/settle", server.handleSettle)

	body := `{"paymentPayload":{"test":"payload"},"paymentRequirements":{"network":"eip155:1","scheme":"exact"}}`
	req := httptest.NewRequest(http.MethodPost, "/settle", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected status 500, got %d", w.Code)
	}
}

func TestHandleSupported(t *testing.T) {
	mock := &MockFacilitator{
		GetSupportedFunc: func() t402.SupportedResponse {
			return t402.SupportedResponse{
				Kinds: []t402.SupportedKind{
					{
						T402Version: 2,
						Scheme:      "exact",
						Network:     "eip155:1",
					},
				},
				Signers: map[string][]string{
					"eip155:*": {"0x1234567890abcdef"},
				},
			}
		},
	}

	server := newTestServer(mock)
	router := gin.New()
	router.GET("/supported", server.handleSupported)

	req := httptest.NewRequest(http.MethodGet, "/supported", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp t402.SupportedResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if len(resp.Kinds) != 1 {
		t.Errorf("expected 1 kind, got %d", len(resp.Kinds))
	}
	if resp.Kinds[0].Network != "eip155:1" {
		t.Errorf("expected network=eip155:1, got %s", resp.Kinds[0].Network)
	}
}

func TestExtractNetworkScheme(t *testing.T) {
	tests := []struct {
		name            string
		requirements    string
		expectedNetwork string
		expectedScheme  string
	}{
		{
			name:            "valid JSON",
			requirements:    `{"network":"eip155:1","scheme":"exact"}`,
			expectedNetwork: "eip155:1",
			expectedScheme:  "exact",
		},
		{
			name:            "missing network",
			requirements:    `{"scheme":"exact"}`,
			expectedNetwork: "",
			expectedScheme:  "exact",
		},
		{
			name:            "missing scheme",
			requirements:    `{"network":"eip155:1"}`,
			expectedNetwork: "eip155:1",
			expectedScheme:  "",
		},
		{
			name:            "invalid JSON",
			requirements:    `{invalid`,
			expectedNetwork: "unknown",
			expectedScheme:  "unknown",
		},
		{
			name:            "empty JSON",
			requirements:    `{}`,
			expectedNetwork: "",
			expectedScheme:  "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			network, scheme := extractNetworkScheme(json.RawMessage(tt.requirements))

			if network != tt.expectedNetwork {
				t.Errorf("expected network=%s, got %s", tt.expectedNetwork, network)
			}
			if scheme != tt.expectedScheme {
				t.Errorf("expected scheme=%s, got %s", tt.expectedScheme, scheme)
			}
		})
	}
}

func TestVerifyRequest_JSON(t *testing.T) {
	reqJSON := `{
		"paymentPayload": {"signature": "0x123"},
		"paymentRequirements": {"network": "eip155:1", "scheme": "exact"}
	}`

	var req VerifyRequest
	err := json.Unmarshal([]byte(reqJSON), &req)

	if err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if req.PaymentPayload == nil {
		t.Error("expected PaymentPayload to be set")
	}
	if req.PaymentRequirements == nil {
		t.Error("expected PaymentRequirements to be set")
	}
}

func TestSettleRequest_JSON(t *testing.T) {
	reqJSON := `{
		"paymentPayload": {"signature": "0x123"},
		"paymentRequirements": {"network": "eip155:1", "scheme": "exact"}
	}`

	var req SettleRequest
	err := json.Unmarshal([]byte(reqJSON), &req)

	if err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if req.PaymentPayload == nil {
		t.Error("expected PaymentPayload to be set")
	}
	if req.PaymentRequirements == nil {
		t.Error("expected PaymentRequirements to be set")
	}
}

// Integration tests for full request flow

func TestHandleVerify_InvalidJSON(t *testing.T) {
	mock := &MockFacilitator{}
	server := newTestServer(mock)
	router := gin.New()
	router.POST("/verify", server.handleVerify)

	// Completely invalid JSON
	body := `not json at all`
	req := httptest.NewRequest(http.MethodPost, "/verify", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
}

func TestHandleVerify_EmptyBody(t *testing.T) {
	mock := &MockFacilitator{}
	server := newTestServer(mock)
	router := gin.New()
	router.POST("/verify", server.handleVerify)

	req := httptest.NewRequest(http.MethodPost, "/verify", bytes.NewBufferString(""))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
}

func TestHandleVerify_InvalidPayment(t *testing.T) {
	mock := &MockFacilitator{
		VerifyFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
			return &t402.VerifyResponse{
				IsValid:       false,
				InvalidReason: "invalid signature",
			}, nil
		},
	}

	server := newTestServer(mock)
	router := gin.New()
	router.POST("/verify", server.handleVerify)

	body := `{"paymentPayload":{"test":"payload"},"paymentRequirements":{"network":"eip155:1","scheme":"exact"}}`
	req := httptest.NewRequest(http.MethodPost, "/verify", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp t402.VerifyResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if resp.IsValid {
		t.Error("expected IsValid=false")
	}
	if resp.InvalidReason != "invalid signature" {
		t.Errorf("expected InvalidReason='invalid signature', got %s", resp.InvalidReason)
	}
}

func TestHandleSettle_EmptyBody(t *testing.T) {
	mock := &MockFacilitator{}
	server := newTestServer(mock)
	router := gin.New()
	router.POST("/settle", server.handleSettle)

	req := httptest.NewRequest(http.MethodPost, "/settle", bytes.NewBufferString(""))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
}

func TestHandleSettle_MissingPayload(t *testing.T) {
	mock := &MockFacilitator{}
	server := newTestServer(mock)
	router := gin.New()
	router.POST("/settle", server.handleSettle)

	// Missing paymentPayload field
	body := `{"paymentRequirements":{"network":"eip155:1","scheme":"exact"}}`
	req := httptest.NewRequest(http.MethodPost, "/settle", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
}

func TestHandleSettle_MissingRequirements(t *testing.T) {
	mock := &MockFacilitator{}
	server := newTestServer(mock)
	router := gin.New()
	router.POST("/settle", server.handleSettle)

	// Missing paymentRequirements field
	body := `{"paymentPayload":{"test":"payload"}}`
	req := httptest.NewRequest(http.MethodPost, "/settle", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", w.Code)
	}
}

func TestHandleSettle_WithErrorReason(t *testing.T) {
	mock := &MockFacilitator{
		SettleFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{
				Success:     false,
				ErrorReason: "nonce already used",
				Network:     "eip155:1",
			}, nil
		},
	}

	server := newTestServer(mock)
	router := gin.New()
	router.POST("/settle", server.handleSettle)

	body := `{"paymentPayload":{"test":"payload"},"paymentRequirements":{"network":"eip155:1","scheme":"exact"}}`
	req := httptest.NewRequest(http.MethodPost, "/settle", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnprocessableEntity {
		t.Errorf("expected status 422, got %d", w.Code)
	}

	var resp t402.SettleResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if resp.Success {
		t.Error("expected Success=false")
	}
	if resp.ErrorReason != "nonce already used" {
		t.Errorf("expected ErrorReason='nonce already used', got %s", resp.ErrorReason)
	}
}

func TestHandleSupported_EmptyKinds(t *testing.T) {
	mock := &MockFacilitator{
		GetSupportedFunc: func() t402.SupportedResponse {
			return t402.SupportedResponse{
				Kinds:   []t402.SupportedKind{},
				Signers: map[string][]string{},
			}
		},
	}

	server := newTestServer(mock)
	router := gin.New()
	router.GET("/supported", server.handleSupported)

	req := httptest.NewRequest(http.MethodGet, "/supported", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp t402.SupportedResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if len(resp.Kinds) != 0 {
		t.Errorf("expected 0 kinds, got %d", len(resp.Kinds))
	}
}

func TestHandleSupported_MultipleNetworks(t *testing.T) {
	mock := &MockFacilitator{
		GetSupportedFunc: func() t402.SupportedResponse {
			return t402.SupportedResponse{
				Kinds: []t402.SupportedKind{
					{T402Version: 2, Scheme: "exact", Network: "eip155:1"},
					{T402Version: 2, Scheme: "exact", Network: "eip155:8453"},
					{T402Version: 2, Scheme: "exact", Network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"},
					{T402Version: 2, Scheme: "exact", Network: "ton:mainnet"},
				},
				Signers: map[string][]string{
					"eip155:*": {"0x1234567890abcdef"},
					"solana:*": {"8GGtWHRQ1wz5gDKE2KXZLktqzcfV1CBqSbeUZjA7hoWL"},
					"ton:*":    {"EQ5d11d21276ac6b5efdf179e654ff0c6eee34e0abfa263a"},
				},
			}
		},
	}

	server := newTestServer(mock)
	router := gin.New()
	router.GET("/supported", server.handleSupported)

	req := httptest.NewRequest(http.MethodGet, "/supported", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp t402.SupportedResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if len(resp.Kinds) != 4 {
		t.Errorf("expected 4 kinds, got %d", len(resp.Kinds))
	}
	if len(resp.Signers) != 3 {
		t.Errorf("expected 3 signers, got %d", len(resp.Signers))
	}
}

func TestExtractNetworkScheme_AllChains(t *testing.T) {
	tests := []struct {
		name            string
		requirements    string
		expectedNetwork string
		expectedScheme  string
	}{
		{
			name:            "EVM mainnet",
			requirements:    `{"network":"eip155:1","scheme":"exact"}`,
			expectedNetwork: "eip155:1",
			expectedScheme:  "exact",
		},
		{
			name:            "Base",
			requirements:    `{"network":"eip155:8453","scheme":"exact"}`,
			expectedNetwork: "eip155:8453",
			expectedScheme:  "exact",
		},
		{
			name:            "Solana",
			requirements:    `{"network":"solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp","scheme":"exact"}`,
			expectedNetwork: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
			expectedScheme:  "exact",
		},
		{
			name:            "TON",
			requirements:    `{"network":"ton:mainnet","scheme":"exact"}`,
			expectedNetwork: "ton:mainnet",
			expectedScheme:  "exact",
		},
		{
			name:            "TRON",
			requirements:    `{"network":"tron:mainnet","scheme":"exact"}`,
			expectedNetwork: "tron:mainnet",
			expectedScheme:  "exact",
		},
		{
			name:            "NEAR",
			requirements:    `{"network":"near:mainnet","scheme":"exact-direct"}`,
			expectedNetwork: "near:mainnet",
			expectedScheme:  "exact-direct",
		},
		{
			name:            "Aptos",
			requirements:    `{"network":"aptos:1","scheme":"exact-direct"}`,
			expectedNetwork: "aptos:1",
			expectedScheme:  "exact-direct",
		},
		{
			name:            "Tezos",
			requirements:    `{"network":"tezos:NetXdQprcVkpaWU","scheme":"exact-direct"}`,
			expectedNetwork: "tezos:NetXdQprcVkpaWU",
			expectedScheme:  "exact-direct",
		},
		{
			name:            "Polkadot Asset Hub",
			requirements:    `{"network":"polkadot:68d56f15f85d3136970ec16946040bc1","scheme":"exact-direct"}`,
			expectedNetwork: "polkadot:68d56f15f85d3136970ec16946040bc1",
			expectedScheme:  "exact-direct",
		},
		{
			name:            "Stacks",
			requirements:    `{"network":"stacks:1","scheme":"exact-direct"}`,
			expectedNetwork: "stacks:1",
			expectedScheme:  "exact-direct",
		},
		{
			name:            "upto scheme",
			requirements:    `{"network":"eip155:1","scheme":"upto"}`,
			expectedNetwork: "eip155:1",
			expectedScheme:  "upto",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			network, scheme := extractNetworkScheme(json.RawMessage(tt.requirements))

			if network != tt.expectedNetwork {
				t.Errorf("expected network=%s, got %s", tt.expectedNetwork, network)
			}
			if scheme != tt.expectedScheme {
				t.Errorf("expected scheme=%s, got %s", tt.expectedScheme, scheme)
			}
		})
	}
}

func TestReadBody(t *testing.T) {
	router := gin.New()
	router.POST("/test", func(c *gin.Context) {
		body, err := readBody(c)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"body": string(body)})
	})

	tests := []struct {
		name           string
		body           string
		expectedStatus int
	}{
		{"with body", `{"test":"data"}`, http.StatusOK},
		{"empty body", "", http.StatusOK},
		{"large body", string(make([]byte, 1000)), http.StatusOK},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/test", bytes.NewBufferString(tt.body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d", tt.expectedStatus, w.Code)
			}
		})
	}
}

func TestVerifyRequest_Validation(t *testing.T) {
	tests := []struct {
		name    string
		reqJSON string
		wantErr bool
	}{
		{
			name:    "valid request",
			reqJSON: `{"paymentPayload":{"sig":"0x123"},"paymentRequirements":{"network":"eip155:1"}}`,
			wantErr: false,
		},
		{
			name:    "empty payload",
			reqJSON: `{"paymentPayload":{},"paymentRequirements":{"network":"eip155:1"}}`,
			wantErr: false, // empty object is still valid JSON
		},
		{
			name:    "null payload",
			reqJSON: `{"paymentPayload":null,"paymentRequirements":{"network":"eip155:1"}}`,
			wantErr: false, // null is valid json.RawMessage
		},
		{
			name:    "complex nested payload",
			reqJSON: `{"paymentPayload":{"signature":"0x123","nonce":"abc","deadline":1234567890},"paymentRequirements":{"network":"eip155:1","scheme":"exact","amount":"1000000"}}`,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var req VerifyRequest
			err := json.Unmarshal([]byte(tt.reqJSON), &req)
			if (err != nil) != tt.wantErr {
				t.Errorf("Unmarshal() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestSettleRequest_Validation(t *testing.T) {
	tests := []struct {
		name    string
		reqJSON string
		wantErr bool
	}{
		{
			name:    "valid request",
			reqJSON: `{"paymentPayload":{"sig":"0x123"},"paymentRequirements":{"network":"eip155:1"}}`,
			wantErr: false,
		},
		{
			name:    "with all fields",
			reqJSON: `{"paymentPayload":{"signature":"0x123","nonce":"abc","deadline":1234567890},"paymentRequirements":{"network":"eip155:1","scheme":"exact","amount":"1000000","payTo":"0xabc"}}`,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var req SettleRequest
			err := json.Unmarshal([]byte(tt.reqJSON), &req)
			if (err != nil) != tt.wantErr {
				t.Errorf("Unmarshal() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestHandleVerify_ContextCancellation(t *testing.T) {
	mock := &MockFacilitator{
		VerifyFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
			// Simulate context awareness
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			default:
				return &t402.VerifyResponse{IsValid: true}, nil
			}
		},
	}

	server := newTestServer(mock)
	router := gin.New()
	router.POST("/verify", server.handleVerify)

	body := `{"paymentPayload":{"test":"payload"},"paymentRequirements":{"network":"eip155:1","scheme":"exact"}}`
	req := httptest.NewRequest(http.MethodPost, "/verify", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// Should succeed since context is not cancelled
	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
}

func TestHandleSettle_FullResponse(t *testing.T) {
	mock := &MockFacilitator{
		SettleFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{
				Success:     true,
				Payer:       "0x1234567890abcdef1234567890abcdef12345678",
				Transaction: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
				Network:     "eip155:8453",
			}, nil
		},
	}

	server := newTestServer(mock)
	router := gin.New()
	router.POST("/settle", server.handleSettle)

	body := `{"paymentPayload":{"signature":"0x123"},"paymentRequirements":{"network":"eip155:8453","scheme":"exact"}}`
	req := httptest.NewRequest(http.MethodPost, "/settle", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp t402.SettleResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if !resp.Success {
		t.Error("expected Success=true")
	}
	if resp.Payer != "0x1234567890abcdef1234567890abcdef12345678" {
		t.Errorf("unexpected Payer: %s", resp.Payer)
	}
	if resp.Transaction == "" {
		t.Error("expected Transaction to be set")
	}
	if resp.Network != "eip155:8453" {
		t.Errorf("expected Network=eip155:8453, got %s", resp.Network)
	}
}
