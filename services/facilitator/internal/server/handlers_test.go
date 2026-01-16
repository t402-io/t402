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
	t402 "github.com/t402-io/t402/go"
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
