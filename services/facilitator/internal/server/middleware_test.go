package server

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/t402-io/t402/services/facilitator/internal/ratelimit"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestRequestIDMiddleware_GeneratesID(t *testing.T) {
	router := gin.New()
	router.Use(RequestIDMiddleware())
	router.GET("/test", func(c *gin.Context) {
		requestID, exists := c.Get("request_id")
		if !exists {
			t.Error("request_id not set in context")
		}
		if requestID == "" {
			t.Error("request_id is empty")
		}
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// Check response header
	responseID := w.Header().Get("X-Request-ID")
	if responseID == "" {
		t.Error("X-Request-ID header not set in response")
	}
}

func TestRequestIDMiddleware_UsesProvidedID(t *testing.T) {
	router := gin.New()
	router.Use(RequestIDMiddleware())
	router.GET("/test", func(c *gin.Context) {
		requestID, _ := c.Get("request_id")
		if requestID != "my-custom-id" {
			t.Errorf("expected request_id=my-custom-id, got %v", requestID)
		}
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Request-ID", "my-custom-id")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	responseID := w.Header().Get("X-Request-ID")
	if responseID != "my-custom-id" {
		t.Errorf("expected X-Request-ID=my-custom-id, got %s", responseID)
	}
}

func TestGenerateRequestID(t *testing.T) {
	id1 := generateRequestID()
	id2 := generateRequestID()

	if id1 == "" {
		t.Error("generated ID is empty")
	}

	// IDs should be unique (though not guaranteed for same nanosecond)
	time.Sleep(time.Nanosecond)
	if id1 == id2 {
		t.Log("Warning: generated IDs are the same (may happen in very fast execution)")
	}
}

func TestCORSMiddleware(t *testing.T) {
	router := gin.New()
	router.Use(CORSMiddleware())
	router.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// Check CORS headers
	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "*" {
		t.Errorf("Access-Control-Allow-Origin = %s, expected *", got)
	}
	if got := w.Header().Get("Access-Control-Allow-Methods"); got != "GET, POST, OPTIONS" {
		t.Errorf("Access-Control-Allow-Methods = %s, expected GET, POST, OPTIONS", got)
	}
	if got := w.Header().Get("Access-Control-Max-Age"); got != "86400" {
		t.Errorf("Access-Control-Max-Age = %s, expected 86400", got)
	}
}

func TestCORSMiddleware_OPTIONS(t *testing.T) {
	router := gin.New()
	router.Use(CORSMiddleware())
	router.OPTIONS("/test", func(c *gin.Context) {
		t.Error("handler should not be called for OPTIONS")
	})

	req := httptest.NewRequest(http.MethodOptions, "/test", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Errorf("expected status 204, got %d", w.Code)
	}
}

func TestLoggingMiddleware(t *testing.T) {
	router := gin.New()
	router.Use(RequestIDMiddleware())
	router.Use(LoggingMiddleware())
	router.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()

	// Just verify it doesn't panic
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
}

// MockLimiter is a mock implementation of ratelimit.Limiter for testing
type MockLimiter struct {
	AllowFunc func(ctx context.Context, key string) (bool, ratelimit.Info, error)
}

func (m *MockLimiter) Allow(ctx context.Context, key string) (bool, ratelimit.Info, error) {
	return m.AllowFunc(ctx, key)
}

func TestRateLimitMiddleware_Allowed(t *testing.T) {
	limiter := &MockLimiter{
		AllowFunc: func(ctx context.Context, key string) (bool, ratelimit.Info, error) {
			return true, ratelimit.Info{
				Limit:     100,
				Remaining: 99,
				Reset:     time.Now().Add(time.Minute),
			}, nil
		},
	}

	router := gin.New()
	router.Use(RateLimitMiddleware(limiter))
	router.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	// Check rate limit headers
	if w.Header().Get("X-RateLimit-Limit") != "100" {
		t.Errorf("X-RateLimit-Limit = %s, expected 100", w.Header().Get("X-RateLimit-Limit"))
	}
	if w.Header().Get("X-RateLimit-Remaining") != "99" {
		t.Errorf("X-RateLimit-Remaining = %s, expected 99", w.Header().Get("X-RateLimit-Remaining"))
	}
}

func TestRateLimitMiddleware_Exceeded(t *testing.T) {
	limiter := &MockLimiter{
		AllowFunc: func(ctx context.Context, key string) (bool, ratelimit.Info, error) {
			return false, ratelimit.Info{
				Limit:     100,
				Remaining: 0,
				Reset:     time.Now().Add(time.Minute),
			}, nil
		},
	}

	router := gin.New()
	router.Use(RateLimitMiddleware(limiter))
	router.GET("/test", func(c *gin.Context) {
		t.Error("handler should not be called when rate limited")
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusTooManyRequests {
		t.Errorf("expected status 429, got %d", w.Code)
	}

	// Check Retry-After header is set
	if w.Header().Get("Retry-After") == "" {
		t.Error("Retry-After header not set")
	}
}

func TestRateLimitMiddleware_SkipsHealthEndpoints(t *testing.T) {
	callCount := 0
	limiter := &MockLimiter{
		AllowFunc: func(ctx context.Context, key string) (bool, ratelimit.Info, error) {
			callCount++
			return true, ratelimit.Info{}, nil
		},
	}

	router := gin.New()
	router.Use(RateLimitMiddleware(limiter))

	endpoints := []string{"/health", "/ready", "/metrics"}
	for _, endpoint := range endpoints {
		router.GET(endpoint, func(c *gin.Context) {
			c.String(http.StatusOK, "ok")
		})
	}

	for _, endpoint := range endpoints {
		req := httptest.NewRequest(http.MethodGet, endpoint, nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("expected status 200 for %s, got %d", endpoint, w.Code)
		}
	}

	// Limiter should not have been called for any of these endpoints
	if callCount != 0 {
		t.Errorf("expected limiter to not be called for health endpoints, but was called %d times", callCount)
	}
}

func TestRateLimitMiddleware_Error(t *testing.T) {
	limiter := &MockLimiter{
		AllowFunc: func(ctx context.Context, key string) (bool, ratelimit.Info, error) {
			return false, ratelimit.Info{}, context.DeadlineExceeded
		},
	}

	router := gin.New()
	router.Use(RateLimitMiddleware(limiter))
	router.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// On error, should allow the request to proceed
	if w.Code != http.StatusOK {
		t.Errorf("expected status 200 on error (fail open), got %d", w.Code)
	}
}

func TestAPIKeyMiddleware_NoKeysConfigured(t *testing.T) {
	router := gin.New()
	router.Use(APIKeyMiddleware(map[string]bool{}))
	router.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// Should allow request when no keys configured
	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
}

func TestAPIKeyMiddleware_ValidKeyHeader(t *testing.T) {
	validKeys := map[string]bool{"valid-key": true}

	router := gin.New()
	router.Use(APIKeyMiddleware(validKeys))
	router.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-API-Key", "valid-key")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
}

func TestAPIKeyMiddleware_ValidKeyQuery(t *testing.T) {
	validKeys := map[string]bool{"valid-key": true}

	router := gin.New()
	router.Use(APIKeyMiddleware(validKeys))
	router.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodGet, "/test?api_key=valid-key", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
}

func TestAPIKeyMiddleware_MissingKey(t *testing.T) {
	validKeys := map[string]bool{"valid-key": true}

	router := gin.New()
	router.Use(APIKeyMiddleware(validKeys))
	router.GET("/test", func(c *gin.Context) {
		t.Error("handler should not be called")
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected status 401, got %d", w.Code)
	}
}

func TestAPIKeyMiddleware_InvalidKey(t *testing.T) {
	validKeys := map[string]bool{"valid-key": true}

	router := gin.New()
	router.Use(APIKeyMiddleware(validKeys))
	router.GET("/test", func(c *gin.Context) {
		t.Error("handler should not be called")
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-API-Key", "invalid-key")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected status 401, got %d", w.Code)
	}
}
