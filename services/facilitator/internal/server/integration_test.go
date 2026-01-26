package server

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/services/facilitator/internal/auth"
	"github.com/t402-io/t402/services/facilitator/internal/config"
	"github.com/t402-io/t402/services/facilitator/internal/health"
	"github.com/t402-io/t402/services/facilitator/internal/ratelimit"
)

// mockLimiter is a test limiter that always allows requests
type mockLimiter struct {
	limit int
}

func (m *mockLimiter) Allow(ctx context.Context, key string) (bool, ratelimit.Info, error) {
	return true, ratelimit.Info{
		Limit:     m.limit,
		Remaining: m.limit - 1,
		Reset:     time.Now().Add(time.Minute),
	}, nil
}

// createFullTestServer creates a server with middleware and routes set up
func createFullTestServer(f Facilitator, cfg *config.Config) *Server {
	if cfg == nil {
		cfg = &config.Config{
			Port:              8080,
			Environment:       "test",
			RateLimitRequests: 100,
			RateLimitWindow:   60,
		}
	}

	// Use mock limiter instead of Redis-based limiter for testing
	limiter := &mockLimiter{limit: cfg.RateLimitRequests}
	healthChecker := health.NewChecker(nil, Version)
	authManager := auth.NewManager(nil)

	if cfg.APIKeys != "" {
		authManager.LoadFromEnv(cfg.APIKeys)
	}

	s := &Server{
		router:      gin.New(),
		facilitator: f,
		config:      cfg,
		metrics:     getTestMetrics(),
		limiter:     limiter,
		health:      healthChecker,
		authManager: authManager,
	}

	s.setupMiddleware()
	s.setupRoutes()

	return s
}

func TestIntegration_VerifyEndpoint(t *testing.T) {
	mock := &MockFacilitator{
		VerifyFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
			return &t402.VerifyResponse{
				IsValid: true,
				Payer:   "0x1234567890abcdef",
			}, nil
		},
		SettleFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{Success: true}, nil
		},
		GetSupportedFunc: func() t402.SupportedResponse {
			return t402.SupportedResponse{}
		},
	}

	cfg := &config.Config{
		Port:               8080,
		Environment:        "test",
		RateLimitRequests:  100,
		RateLimitWindow:    60,
		CORSAllowedOrigins: "*",
	}

	server := createFullTestServer(mock, cfg)

	body := `{"paymentPayload":{"signature":"0x123"},"paymentRequirements":{"network":"eip155:1","scheme":"exact"}}`
	req := httptest.NewRequest(http.MethodPost, "/verify", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Origin", "https://t402.io")
	w := httptest.NewRecorder()

	server.router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d, body: %s", w.Code, w.Body.String())
	}

	// Check CORS headers are set
	if w.Header().Get("Access-Control-Allow-Origin") == "" {
		t.Error("expected CORS headers to be set")
	}

	// Check request ID header
	if w.Header().Get("X-Request-ID") == "" {
		t.Error("expected X-Request-ID header to be set")
	}
}

func TestIntegration_SettleEndpoint(t *testing.T) {
	mock := &MockFacilitator{
		VerifyFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
			return &t402.VerifyResponse{IsValid: true}, nil
		},
		SettleFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{
				Success:     true,
				Payer:       "0x1234567890abcdef",
				Transaction: "0xabc123",
				Network:     "eip155:1",
			}, nil
		},
		GetSupportedFunc: func() t402.SupportedResponse {
			return t402.SupportedResponse{}
		},
	}

	cfg := &config.Config{
		Port:               8080,
		Environment:        "test",
		RateLimitRequests:  100,
		RateLimitWindow:    60,
		CORSAllowedOrigins: "*",
	}

	server := createFullTestServer(mock, cfg)

	body := `{"paymentPayload":{"signature":"0x123"},"paymentRequirements":{"network":"eip155:1","scheme":"exact"}}`
	req := httptest.NewRequest(http.MethodPost, "/settle", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	server.router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d, body: %s", w.Code, w.Body.String())
	}

	var resp t402.SettleResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if !resp.Success {
		t.Error("expected Success=true")
	}
}

func TestIntegration_SupportedEndpoint(t *testing.T) {
	mock := &MockFacilitator{
		VerifyFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
			return &t402.VerifyResponse{IsValid: true}, nil
		},
		SettleFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{Success: true}, nil
		},
		GetSupportedFunc: func() t402.SupportedResponse {
			return t402.SupportedResponse{
				Kinds: []t402.SupportedKind{
					{T402Version: 2, Scheme: "exact", Network: "eip155:1"},
					{T402Version: 2, Scheme: "exact", Network: "eip155:8453"},
				},
				Signers: map[string][]string{
					"eip155:*": {"0x1234567890abcdef"},
				},
			}
		},
	}

	server := createFullTestServer(mock, nil)

	req := httptest.NewRequest(http.MethodGet, "/supported", nil)
	w := httptest.NewRecorder()

	server.router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp t402.SupportedResponse
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if len(resp.Kinds) != 2 {
		t.Errorf("expected 2 kinds, got %d", len(resp.Kinds))
	}
}

func TestIntegration_HealthEndpoint(t *testing.T) {
	mock := &MockFacilitator{
		VerifyFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
			return &t402.VerifyResponse{IsValid: true}, nil
		},
		SettleFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{Success: true}, nil
		},
		GetSupportedFunc: func() t402.SupportedResponse {
			return t402.SupportedResponse{}
		},
	}

	server := createFullTestServer(mock, nil)

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()

	server.router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if resp["status"] != "healthy" {
		t.Errorf("expected status=healthy, got %v", resp["status"])
	}
}

func TestIntegration_ReadyEndpoint(t *testing.T) {
	mock := &MockFacilitator{
		VerifyFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
			return &t402.VerifyResponse{IsValid: true}, nil
		},
		SettleFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{Success: true}, nil
		},
		GetSupportedFunc: func() t402.SupportedResponse {
			return t402.SupportedResponse{}
		},
	}

	server := createFullTestServer(mock, nil)

	req := httptest.NewRequest(http.MethodGet, "/ready", nil)
	w := httptest.NewRecorder()

	server.router.ServeHTTP(w, req)

	// Without Redis, ready endpoint returns 503
	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status 503 (no redis), got %d", w.Code)
	}
}

func TestIntegration_MetricsEndpoint(t *testing.T) {
	mock := &MockFacilitator{
		VerifyFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
			return &t402.VerifyResponse{IsValid: true}, nil
		},
		SettleFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{Success: true}, nil
		},
		GetSupportedFunc: func() t402.SupportedResponse {
			return t402.SupportedResponse{}
		},
	}

	server := createFullTestServer(mock, nil)

	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	w := httptest.NewRecorder()

	server.router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	// Metrics endpoint returns prometheus format
	body := w.Body.String()
	if len(body) == 0 {
		t.Error("expected metrics output")
	}
}

func TestIntegration_CORSPreflight(t *testing.T) {
	mock := &MockFacilitator{
		VerifyFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
			return &t402.VerifyResponse{IsValid: true}, nil
		},
		SettleFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{Success: true}, nil
		},
		GetSupportedFunc: func() t402.SupportedResponse {
			return t402.SupportedResponse{}
		},
	}

	cfg := &config.Config{
		Port:               8080,
		Environment:        "test",
		RateLimitRequests:  100,
		RateLimitWindow:    60,
		CORSAllowedOrigins: "https://t402.io",
	}

	server := createFullTestServer(mock, cfg)

	req := httptest.NewRequest(http.MethodOptions, "/verify", nil)
	req.Header.Set("Origin", "https://t402.io")
	req.Header.Set("Access-Control-Request-Method", "POST")
	req.Header.Set("Access-Control-Request-Headers", "Content-Type")
	w := httptest.NewRecorder()

	server.router.ServeHTTP(w, req)

	// OPTIONS should return 204 or 200
	if w.Code != http.StatusNoContent && w.Code != http.StatusOK {
		t.Errorf("expected status 204 or 200, got %d", w.Code)
	}

	// Check CORS headers
	if w.Header().Get("Access-Control-Allow-Origin") != "https://t402.io" {
		t.Errorf("expected Access-Control-Allow-Origin=https://t402.io, got %s", w.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestIntegration_APIKeyRequired(t *testing.T) {
	mock := &MockFacilitator{
		VerifyFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
			return &t402.VerifyResponse{IsValid: true}, nil
		},
		SettleFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{Success: true}, nil
		},
		GetSupportedFunc: func() t402.SupportedResponse {
			return t402.SupportedResponse{}
		},
	}

	cfg := &config.Config{
		Port:              8080,
		Environment:       "test",
		RateLimitRequests: 100,
		RateLimitWindow:   60,
		APIKeyRequired:    true,
		APIKeys:           "testkey123:testapp",
	}

	server := createFullTestServer(mock, cfg)

	// Without API key - should fail
	body := `{"paymentPayload":{"signature":"0x123"},"paymentRequirements":{"network":"eip155:1","scheme":"exact"}}`
	req := httptest.NewRequest(http.MethodPost, "/verify", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	server.router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected status 401 without API key, got %d", w.Code)
	}

	// With valid API key - should succeed
	req = httptest.NewRequest(http.MethodPost, "/verify", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", "testkey123")
	w = httptest.NewRecorder()

	server.router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200 with valid API key, got %d, body: %s", w.Code, w.Body.String())
	}
}

func TestIntegration_APIKeyInQuery_DisabledByDefault(t *testing.T) {
	mock := &MockFacilitator{
		VerifyFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
			return &t402.VerifyResponse{IsValid: true}, nil
		},
		SettleFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{Success: true}, nil
		},
		GetSupportedFunc: func() t402.SupportedResponse {
			return t402.SupportedResponse{}
		},
	}

	cfg := &config.Config{
		Port:              8080,
		Environment:       "test",
		RateLimitRequests: 100,
		RateLimitWindow:   60,
		APIKeyRequired:    true,
		APIKeys:           "testkey123:testapp",
	}

	server := createFullTestServer(mock, cfg)

	// API key in query parameter is disabled by default for security
	body := `{"paymentPayload":{"signature":"0x123"},"paymentRequirements":{"network":"eip155:1","scheme":"exact"}}`
	req := httptest.NewRequest(http.MethodPost, "/verify?api_key=testkey123", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	server.router.ServeHTTP(w, req)

	// Query parameter auth is disabled by default - should return 401 Unauthorized
	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected status 401 with API key in query (disabled by default), got %d, body: %s", w.Code, w.Body.String())
	}
}

func TestIntegration_InvalidAPIKey(t *testing.T) {
	mock := &MockFacilitator{
		VerifyFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
			return &t402.VerifyResponse{IsValid: true}, nil
		},
		SettleFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{Success: true}, nil
		},
		GetSupportedFunc: func() t402.SupportedResponse {
			return t402.SupportedResponse{}
		},
	}

	cfg := &config.Config{
		Port:              8080,
		Environment:       "test",
		RateLimitRequests: 100,
		RateLimitWindow:   60,
		APIKeyRequired:    true,
		APIKeys:           "testkey123:testapp",
	}

	server := createFullTestServer(mock, cfg)

	// With invalid API key
	body := `{"paymentPayload":{"signature":"0x123"},"paymentRequirements":{"network":"eip155:1","scheme":"exact"}}`
	req := httptest.NewRequest(http.MethodPost, "/verify", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", "wrongkey")
	w := httptest.NewRecorder()

	server.router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected status 401 with invalid API key, got %d", w.Code)
	}
}

func TestIntegration_AllEndpointsWithMiddleware(t *testing.T) {
	mock := &MockFacilitator{
		VerifyFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.VerifyResponse, error) {
			return &t402.VerifyResponse{IsValid: true, Payer: "0x123"}, nil
		},
		SettleFunc: func(ctx context.Context, payloadBytes []byte, requirementsBytes []byte) (*t402.SettleResponse, error) {
			return &t402.SettleResponse{Success: true, Transaction: "0xabc", Network: "eip155:1"}, nil
		},
		GetSupportedFunc: func() t402.SupportedResponse {
			return t402.SupportedResponse{
				Kinds: []t402.SupportedKind{{Network: "eip155:1", Scheme: "exact"}},
			}
		},
	}

	cfg := &config.Config{
		Port:               8080,
		Environment:        "test",
		RateLimitRequests:  1000,
		RateLimitWindow:    60,
		CORSAllowedOrigins: "*",
	}

	server := createFullTestServer(mock, cfg)

	tests := []struct {
		name           string
		method         string
		path           string
		body           string
		expectedStatus int
	}{
		{"verify success", "POST", "/verify", `{"paymentPayload":{},"paymentRequirements":{"network":"eip155:1"}}`, http.StatusOK},
		{"settle success", "POST", "/settle", `{"paymentPayload":{},"paymentRequirements":{"network":"eip155:1"}}`, http.StatusOK},
		{"supported", "GET", "/supported", "", http.StatusOK},
		{"health", "GET", "/health", "", http.StatusOK},
		{"metrics", "GET", "/metrics", "", http.StatusOK},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var req *http.Request
			if tt.body != "" {
				req = httptest.NewRequest(tt.method, tt.path, bytes.NewBufferString(tt.body))
				req.Header.Set("Content-Type", "application/json")
			} else {
				req = httptest.NewRequest(tt.method, tt.path, nil)
			}
			w := httptest.NewRecorder()

			server.router.ServeHTTP(w, req)

			if w.Code != tt.expectedStatus {
				t.Errorf("expected status %d, got %d, body: %s", tt.expectedStatus, w.Code, w.Body.String())
			}

			// All endpoints should have request ID
			if w.Header().Get("X-Request-ID") == "" {
				t.Error("expected X-Request-ID header")
			}
		})
	}
}
