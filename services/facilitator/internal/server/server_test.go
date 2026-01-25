package server

import (
	"context"
	"testing"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/services/facilitator/internal/config"
)

func TestNew(t *testing.T) {
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

	server := New(mock, nil, cfg)

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

func TestNew_WithAPIKeys(t *testing.T) {
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

	server := New(mock, nil, cfg)

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

func TestNew_ProductionMode(t *testing.T) {
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
		Environment:       "production",
		RateLimitRequests: 100,
		RateLimitWindow:   60,
	}

	server := New(mock, nil, cfg)

	if server == nil {
		t.Fatal("expected non-nil server")
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

	server := New(mock, nil, cfg)

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
