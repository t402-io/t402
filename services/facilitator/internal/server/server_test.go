package server

import (
	"context"
	"testing"

	"github.com/gin-gonic/gin"
	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/services/facilitator/internal/auth"
	"github.com/t402-io/t402/services/facilitator/internal/config"
	"github.com/t402-io/t402/services/facilitator/internal/health"
	"github.com/t402-io/t402/services/facilitator/internal/ratelimit"
)

// createTestServer creates a server for testing without calling metrics.New()
// to avoid duplicate prometheus registration
func createTestServer(f Facilitator, cfg *config.Config) *Server {
	if cfg == nil {
		cfg = &config.Config{
			Port:              8080,
			Environment:       "test",
			RateLimitRequests: 100,
			RateLimitWindow:   60,
		}
	}

	limiter := ratelimit.NewRedisLimiter(nil, cfg.RateLimitRequests, cfg.RateLimitWindow)
	healthChecker := health.NewChecker(nil, Version)
	authManager := auth.NewManager(nil)

	if cfg.APIKeys != "" {
		authManager.LoadFromEnv(cfg.APIKeys)
	}

	return &Server{
		router:      gin.New(),
		facilitator: f,
		config:      cfg,
		metrics:     getTestMetrics(), // Use shared metrics
		limiter:     limiter,
		health:      healthChecker,
		authManager: authManager,
	}
}

func TestCreateTestServer(t *testing.T) {
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
		APIKeys:           "",
	}

	server := createTestServer(mock, cfg)

	if server == nil {
		t.Fatal("expected non-nil server")
	}
	if server.router == nil {
		t.Error("expected router to be set")
	}
	if server.facilitator == nil {
		t.Error("expected facilitator to be set")
	}
	if server.config == nil {
		t.Error("expected config to be set")
	}
	if server.metrics == nil {
		t.Error("expected metrics to be set")
	}
	if server.limiter == nil {
		t.Error("expected limiter to be set")
	}
	if server.health == nil {
		t.Error("expected health checker to be set")
	}
	if server.authManager == nil {
		t.Error("expected auth manager to be set")
	}
}

func TestCreateTestServer_WithAPIKeys(t *testing.T) {
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
		APIKeys:           "key1:app1,key2:app2",
	}

	server := createTestServer(mock, cfg)

	if server == nil {
		t.Fatal("expected non-nil server")
	}
	if server.authManager == nil {
		t.Fatal("expected auth manager to be set")
	}

	// Should have loaded 2 keys
	if server.authManager.GetKeyCount() != 2 {
		t.Errorf("expected 2 API keys, got %d", server.authManager.GetKeyCount())
	}
}

func TestCreateTestServer_DefaultConfig(t *testing.T) {
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

	// Use nil config to get defaults
	server := createTestServer(mock, nil)

	if server == nil {
		t.Fatal("expected non-nil server")
	}
	if server.config.Port != 8080 {
		t.Errorf("expected default port=8080, got %d", server.config.Port)
	}
}

func TestVersion(t *testing.T) {
	// Default version should be "dev"
	if Version != "dev" {
		// Version may be set at build time, so just check it's not empty
		if Version == "" {
			t.Error("Version should not be empty")
		}
	}
}

func TestFacilitatorInterface(t *testing.T) {
	// Verify MockFacilitator implements Facilitator interface
	var _ Facilitator = (*MockFacilitator)(nil)
}

func TestServerFields(t *testing.T) {
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
		RateLimitRequests:  500,
		RateLimitWindow:    120,
		APIKeyRequired:     true,
		CORSAllowedOrigins: "https://example.com",
	}

	server := createTestServer(mock, cfg)

	// Verify config is properly assigned
	if server.config.Port != 8080 {
		t.Errorf("expected port=8080, got %d", server.config.Port)
	}
	if server.config.RateLimitRequests != 500 {
		t.Errorf("expected RateLimitRequests=500, got %d", server.config.RateLimitRequests)
	}
	if server.config.APIKeyRequired != true {
		t.Error("expected APIKeyRequired=true")
	}
}

func TestServerStruct(t *testing.T) {
	// Test that Server struct has all required fields
	s := &Server{}

	if s.router != nil {
		t.Error("expected nil router by default")
	}
	if s.httpServer != nil {
		t.Error("expected nil httpServer by default")
	}
	if s.facilitator != nil {
		t.Error("expected nil facilitator by default")
	}
	if s.config != nil {
		t.Error("expected nil config by default")
	}
	if s.metrics != nil {
		t.Error("expected nil metrics by default")
	}
	if s.limiter != nil {
		t.Error("expected nil limiter by default")
	}
	if s.health != nil {
		t.Error("expected nil health by default")
	}
	if s.authManager != nil {
		t.Error("expected nil authManager by default")
	}
}
