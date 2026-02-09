package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

// TestAdminHandlers_NilStreamingService tests that admin endpoints return 404
// when the streaming service is not configured (nil).
func TestAdminHandlers_NilStreamingService(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := NewAdminHandlers(nil)
	router := gin.New()
	handler.RegisterRoutes(router.Group(""))

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{"pause returns 404", http.MethodPost, "/admin/auto-settle/pause"},
		{"resume returns 404", http.MethodPost, "/admin/auto-settle/resume"},
		{"status returns 404", http.MethodGet, "/admin/auto-settle/status"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code != http.StatusNotFound {
				t.Errorf("expected status 404, got %d", w.Code)
			}

			var resp map[string]interface{}
			if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
				t.Fatalf("failed to parse response: %v", err)
			}

			if resp["error"] != "streaming payments not enabled" {
				t.Errorf("expected error='streaming payments not enabled', got %v", resp["error"])
			}
		})
	}
}

// TestNewAdminHandlers tests that creating admin handlers works correctly.
func TestNewAdminHandlers(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("creates AdminHandlers with nil streaming service", func(t *testing.T) {
		handler := NewAdminHandlers(nil)
		if handler == nil {
			t.Fatal("expected non-nil AdminHandlers")
		}
		if handler.streamingService != nil {
			t.Error("expected streamingService to be nil")
		}
	})

	t.Run("RegisterRoutes does not panic with nil streaming service", func(t *testing.T) {
		handler := NewAdminHandlers(nil)
		router := gin.New()

		// Should not panic
		handler.RegisterRoutes(router.Group(""))
	})

	t.Run("RegisterRoutes does not panic on nested group", func(t *testing.T) {
		handler := NewAdminHandlers(nil)
		router := gin.New()

		// Should not panic with nested groups
		handler.RegisterRoutes(router.Group("/api/v1"))
	})

	t.Run("routes are registered correctly", func(t *testing.T) {
		handler := NewAdminHandlers(nil)
		router := gin.New()
		handler.RegisterRoutes(router.Group(""))

		// Verify routes are accessible (they return 404 from handler, not 404 from router)
		paths := []struct {
			method string
			path   string
		}{
			{http.MethodPost, "/admin/auto-settle/pause"},
			{http.MethodPost, "/admin/auto-settle/resume"},
			{http.MethodGet, "/admin/auto-settle/status"},
		}

		for _, p := range paths {
			req := httptest.NewRequest(p.method, p.path, nil)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, req)

			// Should get a JSON response (404 from handler), not a 404 from router
			contentType := w.Header().Get("Content-Type")
			if contentType == "" {
				t.Errorf("%s %s: expected Content-Type header to be set", p.method, p.path)
			}
		}
	})
}

// TestAdminHandlers_MethodNotAllowed verifies that wrong HTTP methods are rejected.
func TestAdminHandlers_MethodNotAllowed(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := NewAdminHandlers(nil)
	router := gin.New()
	router.HandleMethodNotAllowed = true
	handler.RegisterRoutes(router.Group(""))

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{"GET on pause endpoint", http.MethodGet, "/admin/auto-settle/pause"},
		{"GET on resume endpoint", http.MethodGet, "/admin/auto-settle/resume"},
		{"POST on status endpoint", http.MethodPost, "/admin/auto-settle/status"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code != http.StatusMethodNotAllowed {
				t.Errorf("expected status 405, got %d", w.Code)
			}
		})
	}
}
