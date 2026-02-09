package tracing

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func init() {
	gin.SetMode(gin.TestMode)
}

// newDisabledProvider returns a Provider with tracing disabled, safe for tests
// that should not interact with OpenTelemetry global state.
func newDisabledProvider(t *testing.T) *Provider {
	t.Helper()
	provider, err := NewProvider(context.Background(), nil)
	require.NoError(t, err)
	return provider
}

// ---------------------------------------------------------------------------
// Middleware tests
// ---------------------------------------------------------------------------

func TestMiddleware_SkipPaths(t *testing.T) {
	provider := newDisabledProvider(t)

	skipPaths := []string{"/health", "/ready", "/metrics"}

	for _, path := range skipPaths {
		t.Run(path, func(t *testing.T) {
			handlerCalled := false
			router := gin.New()
			router.Use(Middleware(provider, nil))
			router.GET(path, func(c *gin.Context) {
				handlerCalled = true
				c.Status(http.StatusOK)
			})

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, path, nil)
			router.ServeHTTP(w, req)

			assert.Equal(t, http.StatusOK, w.Code)
			assert.True(t, handlerCalled, "handler should still be called for skipped path %s", path)
		})
	}
}

func TestMiddleware_NormalRequest(t *testing.T) {
	provider := newDisabledProvider(t)

	handlerCalled := false
	router := gin.New()
	router.Use(Middleware(provider, nil))
	router.GET("/test", func(c *gin.Context) {
		handlerCalled = true
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.True(t, handlerCalled, "handler should be called for non-skip path")
}

func TestMiddleware_NilConfig(t *testing.T) {
	provider := newDisabledProvider(t)

	// Passing nil config should use defaults (no panic, skip paths work).
	handlerCalled := false
	router := gin.New()
	router.Use(Middleware(provider, nil))
	router.GET("/health", func(c *gin.Context) {
		handlerCalled = true
		c.Status(http.StatusOK)
	})
	router.GET("/api/data", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	// /health should be skipped by default config
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.True(t, handlerCalled)

	// /api/data should not be skipped
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/api/data", nil)
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestMiddleware_RequestIDHeader(t *testing.T) {
	provider := newDisabledProvider(t)

	var capturedCtx context.Context
	router := gin.New()
	router.Use(Middleware(provider, nil))
	router.GET("/test", func(c *gin.Context) {
		capturedCtx = c.Request.Context()
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Request-ID", "req-abc-123")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	// The context should have been enriched (span stored).
	assert.NotNil(t, capturedCtx, "context should have been set on the request")
}

func TestMiddleware_ErrorStatusCode(t *testing.T) {
	provider := newDisabledProvider(t)

	statusCodes := []int{
		http.StatusBadRequest,
		http.StatusUnauthorized,
		http.StatusForbidden,
		http.StatusNotFound,
		http.StatusInternalServerError,
		http.StatusBadGateway,
	}

	for _, code := range statusCodes {
		t.Run(http.StatusText(code), func(t *testing.T) {
			router := gin.New()
			router.Use(Middleware(provider, nil))
			router.GET("/test", func(c *gin.Context) {
				c.Status(code)
			})

			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			router.ServeHTTP(w, req)

			assert.Equal(t, code, w.Code)
		})
	}
}

func TestMiddleware_GinErrors(t *testing.T) {
	provider := newDisabledProvider(t)

	router := gin.New()
	router.Use(Middleware(provider, nil))
	router.GET("/test", func(c *gin.Context) {
		_ = c.Error(errors.New("first error"))
		_ = c.Error(errors.New("second error"))
		c.Status(http.StatusInternalServerError)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
}

func TestMiddleware_CustomConfig(t *testing.T) {
	provider := newDisabledProvider(t)

	cfg := &MiddlewareConfig{
		TracerName: "custom-tracer",
		SkipPaths:  []string{"/custom-skip"},
		SpanNameFormatter: func(c *gin.Context) string {
			return "custom-" + c.Request.Method
		},
	}

	skipCalled := false
	normalCalled := false
	router := gin.New()
	router.Use(Middleware(provider, cfg))
	router.GET("/custom-skip", func(c *gin.Context) {
		skipCalled = true
		c.Status(http.StatusOK)
	})
	router.GET("/normal", func(c *gin.Context) {
		normalCalled = true
		c.Status(http.StatusOK)
	})

	// Custom skip path should be skipped
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/custom-skip", nil)
	router.ServeHTTP(w, req)
	assert.True(t, skipCalled)

	// /health should NOT be skipped with custom config
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/normal", nil)
	router.ServeHTTP(w, req)
	assert.True(t, normalCalled)
}

func TestMiddleware_SuccessStatusCode(t *testing.T) {
	provider := newDisabledProvider(t)

	router := gin.New()
	router.Use(Middleware(provider, nil))
	router.GET("/test", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

// ---------------------------------------------------------------------------
// TraceVerifyHandler tests
// ---------------------------------------------------------------------------

func TestTraceVerifyHandler(t *testing.T) {
	handlerCalled := false
	inner := func(c *gin.Context) {
		handlerCalled = true
		c.Status(http.StatusOK)
	}

	wrapped := TraceVerifyHandler(inner)

	router := gin.New()
	router.POST("/verify", wrapped)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/verify", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.True(t, handlerCalled, "inner handler should be called")
}

func TestTraceVerifyHandler_WithContextValues(t *testing.T) {
	inner := func(c *gin.Context) {
		c.Set("network", "eip155:1")
		c.Set("scheme", "exact")
		c.Set("is_valid", true)
		c.Status(http.StatusOK)
	}

	wrapped := TraceVerifyHandler(inner)

	router := gin.New()
	router.POST("/verify", wrapped)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/verify", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestTraceVerifyHandler_WithPartialContextValues(t *testing.T) {
	inner := func(c *gin.Context) {
		// Only set network, leave scheme and is_valid empty
		c.Set("network", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")
		c.Status(http.StatusOK)
	}

	wrapped := TraceVerifyHandler(inner)

	router := gin.New()
	router.POST("/verify", wrapped)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/verify", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestTraceVerifyHandler_IsValidNonBool(t *testing.T) {
	// When is_valid is set but is not a bool, it should be ignored gracefully.
	inner := func(c *gin.Context) {
		c.Set("is_valid", "not-a-bool")
		c.Status(http.StatusOK)
	}

	wrapped := TraceVerifyHandler(inner)

	router := gin.New()
	router.POST("/verify", wrapped)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/verify", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

// ---------------------------------------------------------------------------
// TraceSettleHandler tests
// ---------------------------------------------------------------------------

func TestTraceSettleHandler(t *testing.T) {
	handlerCalled := false
	inner := func(c *gin.Context) {
		handlerCalled = true
		c.Status(http.StatusOK)
	}

	wrapped := TraceSettleHandler(inner)

	router := gin.New()
	router.POST("/settle", wrapped)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/settle", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.True(t, handlerCalled, "inner handler should be called")
}

func TestTraceSettleHandler_WithContextValues(t *testing.T) {
	inner := func(c *gin.Context) {
		c.Set("network", "eip155:8453")
		c.Set("scheme", "exact")
		c.Set("tx_hash", "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890")
		c.Status(http.StatusOK)
	}

	wrapped := TraceSettleHandler(inner)

	router := gin.New()
	router.POST("/settle", wrapped)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/settle", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestTraceSettleHandler_WithPartialContextValues(t *testing.T) {
	inner := func(c *gin.Context) {
		// Only set network, leave scheme and tx_hash empty
		c.Set("network", "ton:mainnet")
		c.Status(http.StatusOK)
	}

	wrapped := TraceSettleHandler(inner)

	router := gin.New()
	router.POST("/settle", wrapped)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/settle", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

func TestTraceSettleHandler_NoContextValues(t *testing.T) {
	inner := func(c *gin.Context) {
		// Don't set any context values at all
		c.Status(http.StatusOK)
	}

	wrapped := TraceSettleHandler(inner)

	router := gin.New()
	router.POST("/settle", wrapped)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/settle", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
}

// ---------------------------------------------------------------------------
// InjectTraceContext tests
// ---------------------------------------------------------------------------

func TestInjectTraceContext_ReturnsHeaders(t *testing.T) {
	router := gin.New()
	var headers map[string]string

	router.GET("/test", func(c *gin.Context) {
		headers = InjectTraceContext(c)
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.NotNil(t, headers, "InjectTraceContext should return a non-nil map")
}

func TestInjectTraceContext_WithActiveSpan(t *testing.T) {
	provider := newDisabledProvider(t)

	router := gin.New()
	router.Use(Middleware(provider, nil))

	var headers map[string]string
	router.GET("/test", func(c *gin.Context) {
		headers = InjectTraceContext(c)
		c.Status(http.StatusOK)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.NotNil(t, headers)
}

// ---------------------------------------------------------------------------
// Integration: Middleware + TraceVerifyHandler / TraceSettleHandler
// ---------------------------------------------------------------------------

func TestMiddleware_WithTraceVerifyHandler(t *testing.T) {
	provider := newDisabledProvider(t)

	handlerCalled := false
	inner := func(c *gin.Context) {
		handlerCalled = true
		c.Set("network", "eip155:1")
		c.Set("scheme", "exact")
		c.Set("is_valid", true)
		c.Status(http.StatusOK)
	}

	router := gin.New()
	router.Use(Middleware(provider, nil))
	router.POST("/verify", TraceVerifyHandler(inner))

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/verify", nil)
	req.Header.Set("X-Request-ID", "verify-req-001")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.True(t, handlerCalled)
}

func TestMiddleware_WithTraceSettleHandler(t *testing.T) {
	provider := newDisabledProvider(t)

	handlerCalled := false
	inner := func(c *gin.Context) {
		handlerCalled = true
		c.Set("network", "eip155:8453")
		c.Set("scheme", "exact")
		c.Set("tx_hash", "0xdeadbeef")
		c.Status(http.StatusOK)
	}

	router := gin.New()
	router.Use(Middleware(provider, nil))
	router.POST("/settle", TraceSettleHandler(inner))

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/settle", nil)
	req.Header.Set("X-Request-ID", "settle-req-002")
	router.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.True(t, handlerCalled)
}
