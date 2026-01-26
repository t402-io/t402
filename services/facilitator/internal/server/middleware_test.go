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
	router.Use(CORSMiddleware("*"))
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
	router.Use(CORSMiddleware("*"))
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

func TestCORSMiddleware_AllowedOrigins(t *testing.T) {
	router := gin.New()
	router.Use(CORSMiddleware("https://example.com,https://test.com"))
	router.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	// Test allowed origin
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "https://example.com")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "https://example.com" {
		t.Errorf("Access-Control-Allow-Origin = %s, expected https://example.com", got)
	}
	if got := w.Header().Get("Vary"); got != "Origin" {
		t.Errorf("Vary = %s, expected Origin", got)
	}
}

func TestCORSMiddleware_DisallowedOrigin(t *testing.T) {
	router := gin.New()
	router.Use(CORSMiddleware("https://example.com"))
	router.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	// Test disallowed origin
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "https://malicious.com")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Should not set Access-Control-Allow-Origin for disallowed origins
	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Access-Control-Allow-Origin = %s, expected empty for disallowed origin", got)
	}
}

func TestCORSMiddleware_OPTIONS_DisallowedOrigin(t *testing.T) {
	router := gin.New()
	router.Use(CORSMiddleware("https://example.com"))
	router.OPTIONS("/test", func(c *gin.Context) {
		t.Error("handler should not be called for OPTIONS")
	})

	req := httptest.NewRequest(http.MethodOptions, "/test", nil)
	req.Header.Set("Origin", "https://malicious.com")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	// Should return 403 for disallowed origin on preflight
	if w.Code != http.StatusForbidden {
		t.Errorf("expected status 403, got %d", w.Code)
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

	// On error, should fail closed (deny request) to prevent abuse during outages
	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("expected status 503 on error (fail closed), got %d", w.Code)
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

func TestCORSMiddleware_OPTIONS_NoOrigin(t *testing.T) {
	router := gin.New()
	router.Use(CORSMiddleware("https://example.com"))
	router.OPTIONS("/test", func(c *gin.Context) {
		t.Error("handler should not be called for OPTIONS")
	})

	// OPTIONS request without Origin header
	req := httptest.NewRequest(http.MethodOptions, "/test", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// Should return 403 for OPTIONS without origin when origins are restricted
	if w.Code != http.StatusForbidden {
		t.Errorf("expected status 403, got %d", w.Code)
	}
}

func TestCORSMiddleware_EmptyOriginsList(t *testing.T) {
	router := gin.New()
	router.Use(CORSMiddleware(""))
	router.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "https://anyorigin.com")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// Empty string should be treated as allow all
	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "*" {
		t.Errorf("Access-Control-Allow-Origin = %s, expected * for empty config", got)
	}
}

func TestCORSMiddleware_WhitespaceInOrigins(t *testing.T) {
	router := gin.New()
	// Origins with whitespace
	router.Use(CORSMiddleware(" https://example.com , https://test.com "))
	router.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Origin", "https://example.com")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// Should still work with trimmed whitespace
	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "https://example.com" {
		t.Errorf("Access-Control-Allow-Origin = %s, expected https://example.com", got)
	}
}

func TestCORSMiddleware_NoOriginHeader(t *testing.T) {
	router := gin.New()
	router.Use(CORSMiddleware("https://example.com"))
	router.GET("/test", func(c *gin.Context) {
		c.String(http.StatusOK, "ok")
	})

	// Request without Origin header (same-origin or non-browser)
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// Should succeed but not set CORS origin header
	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}
	// No origin header should result in no Access-Control-Allow-Origin
	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Access-Control-Allow-Origin = %s, expected empty for no origin", got)
	}
}

func TestGenerateRequestID_Format(t *testing.T) {
	id := generateRequestID()

	// Should be 32 hex characters (16 bytes * 2)
	if len(id) != 32 {
		t.Errorf("expected ID length 32, got %d", len(id))
	}

	// Should only contain hex characters
	for _, c := range id {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
			t.Errorf("ID contains non-hex character: %c", c)
		}
	}
}

func TestGenerateRequestID_Uniqueness(t *testing.T) {
	ids := make(map[string]bool)
	count := 1000

	for i := 0; i < count; i++ {
		id := generateRequestID()
		if ids[id] {
			t.Errorf("duplicate ID generated: %s", id)
		}
		ids[id] = true
	}
}

func TestLoggingMiddleware_WithDifferentStatuses(t *testing.T) {
	tests := []struct {
		name   string
		status int
	}{
		{"success", http.StatusOK},
		{"created", http.StatusCreated},
		{"bad request", http.StatusBadRequest},
		{"not found", http.StatusNotFound},
		{"internal error", http.StatusInternalServerError},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			router := gin.New()
			router.Use(RequestIDMiddleware())
			router.Use(LoggingMiddleware())
			router.GET("/test", func(c *gin.Context) {
				c.String(tt.status, "response")
			})

			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code != tt.status {
				t.Errorf("expected status %d, got %d", tt.status, w.Code)
			}
		})
	}
}

func TestRateLimitMiddleware_HeaderValues(t *testing.T) {
	resetTime := time.Now().Add(time.Minute)
	limiter := &MockLimiter{
		AllowFunc: func(ctx context.Context, key string) (bool, ratelimit.Info, error) {
			return true, ratelimit.Info{
				Limit:     1000,
				Remaining: 500,
				Reset:     resetTime,
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

	// Verify all rate limit headers
	if w.Header().Get("X-RateLimit-Limit") != "1000" {
		t.Errorf("X-RateLimit-Limit = %s, expected 1000", w.Header().Get("X-RateLimit-Limit"))
	}
	if w.Header().Get("X-RateLimit-Remaining") != "500" {
		t.Errorf("X-RateLimit-Remaining = %s, expected 500", w.Header().Get("X-RateLimit-Remaining"))
	}
	if w.Header().Get("X-RateLimit-Reset") == "" {
		t.Error("X-RateLimit-Reset header not set")
	}
}

// Tests for P0-7: X-Request-ID validation
func TestIsValidRequestID(t *testing.T) {
	tests := []struct {
		name     string
		id       string
		expected bool
	}{
		// Valid IDs
		{"alphanumeric", "abc123XYZ", true},
		{"with hyphens", "abc-123-xyz", true},
		{"with underscores", "abc_123_xyz", true},
		{"uuid format", "550e8400-e29b-41d4-a716-446655440000", true},
		{"short id", "a1", true},
		{"max length", string(make([]byte, 64)), false}, // all zeros = invalid chars

		// Invalid IDs
		{"empty", "", false},
		{"too long", string(make([]byte, 65)), false},
		{"with spaces", "abc 123", false},
		{"with newline", "abc\n123", false},
		{"with tab", "abc\t123", false},
		{"with carriage return", "abc\r123", false},
		{"with null byte", "abc\x00123", false},
		{"with special chars", "abc!@#$%", false},
		{"with unicode", "abc日本語", false},
		{"log injection attempt", "abc\nINFO: fake log entry", false},
		{"html injection", "<script>alert(1)</script>", false},
		{"path traversal", "../../../etc/passwd", false},
		{"sql injection", "'; DROP TABLE users; --", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isValidRequestID(tt.id)
			if result != tt.expected {
				t.Errorf("isValidRequestID(%q) = %v, expected %v", tt.id, result, tt.expected)
			}
		})
	}
}

func TestRequestIDMiddleware_RejectsInvalidID(t *testing.T) {
	router := gin.New()
	router.Use(RequestIDMiddleware())
	router.GET("/test", func(c *gin.Context) {
		requestID, _ := c.Get("request_id")
		// Invalid IDs should be replaced with generated ones
		if requestID == "invalid\nlog-injection" {
			t.Error("Invalid request ID was accepted")
		}
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Request-ID", "invalid\nlog-injection")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// Should generate a new valid ID
	responseID := w.Header().Get("X-Request-ID")
	if responseID == "invalid\nlog-injection" {
		t.Error("Invalid request ID was echoed back")
	}
	if !isValidRequestID(responseID) {
		t.Errorf("Generated request ID is not valid: %q", responseID)
	}
}

// Tests for P0-5: Client IP spoofing prevention
func TestIsValidIP(t *testing.T) {
	tests := []struct {
		name     string
		ip       string
		expected bool
	}{
		// Valid IPs
		{"ipv4", "192.168.1.1", true},
		{"ipv4 localhost", "127.0.0.1", true},
		{"ipv6 full", "2001:0db8:85a3:0000:0000:8a2e:0370:7334", true},
		{"ipv6 short", "::1", true},

		// Invalid IPs
		{"empty", "", false},
		{"no separator", "192168001001", false},
		{"with spaces", "192.168.1.1 ", false},
		{"injection attempt", "192.168.1.1\n", false},
		{"too long", string(make([]byte, 50)), false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isValidIP(tt.ip)
			if result != tt.expected {
				t.Errorf("isValidIP(%q) = %v, expected %v", tt.ip, result, tt.expected)
			}
		})
	}
}

func TestIsTrustedProxy(t *testing.T) {
	trustedProxies := []string{"10.0.0.1", "192.168.1.0/24"}

	tests := []struct {
		name     string
		ip       string
		expected bool
	}{
		{"exact match", "10.0.0.1", true},
		{"cidr match", "192.168.1.100", true},
		{"not trusted", "8.8.8.8", false},
		{"empty", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isTrustedProxy(tt.ip, trustedProxies)
			if result != tt.expected {
				t.Errorf("isTrustedProxy(%q) = %v, expected %v", tt.ip, result, tt.expected)
			}
		})
	}
}

func TestGetSecureClientIP_NoProxyTrust(t *testing.T) {
	config := &RateLimitConfig{
		TrustProxy:     false,
		TrustedProxies: []string{},
	}

	router := gin.New()
	var capturedIP string

	router.GET("/test", func(c *gin.Context) {
		capturedIP = getSecureClientIP(c, config)
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	// Try to spoof IP via X-Forwarded-For
	req.Header.Set("X-Forwarded-For", "1.2.3.4")
	req.RemoteAddr = "192.168.1.100:12345"
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// Should use RemoteAddr, not the spoofed X-Forwarded-For
	if capturedIP == "1.2.3.4" {
		t.Error("Spoofed IP was accepted when TrustProxy=false")
	}
}

func TestGetSecureClientIP_WithTrustedProxy(t *testing.T) {
	config := &RateLimitConfig{
		TrustProxy:     true,
		TrustedProxies: []string{"192.168.1.1"},
	}

	router := gin.New()
	var capturedIP string

	router.GET("/test", func(c *gin.Context) {
		capturedIP = getSecureClientIP(c, config)
		c.String(http.StatusOK, "ok")
	})

	// Request from trusted proxy
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Forwarded-For", "8.8.8.8, 192.168.1.1")
	req.RemoteAddr = "192.168.1.1:12345"
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// Should trust X-Forwarded-For from trusted proxy
	if capturedIP != "8.8.8.8" {
		t.Errorf("Expected IP 8.8.8.8 from trusted proxy, got %s", capturedIP)
	}
}

func TestGetSecureClientIP_UntrustedProxySpoofAttempt(t *testing.T) {
	config := &RateLimitConfig{
		TrustProxy:     true,
		TrustedProxies: []string{"10.0.0.1"},
	}

	router := gin.New()
	var capturedIP string

	router.GET("/test", func(c *gin.Context) {
		capturedIP = getSecureClientIP(c, config)
		c.String(http.StatusOK, "ok")
	})

	// Request NOT from trusted proxy, trying to spoof
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("X-Forwarded-For", "1.2.3.4")
	req.RemoteAddr = "8.8.8.8:12345"
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	// Should NOT trust X-Forwarded-For from untrusted source
	if capturedIP == "1.2.3.4" {
		t.Error("Spoofed IP was accepted from untrusted proxy")
	}
}

func TestDefaultRateLimitConfig(t *testing.T) {
	config := DefaultRateLimitConfig()

	if config.TrustProxy {
		t.Error("Default config should not trust proxies")
	}
	if len(config.TrustedProxies) != 0 {
		t.Error("Default config should have empty trusted proxies")
	}
}

// Tests for P0-2: CIDR validation fix
// This tests the fix for the bug where string prefix matching was used instead of proper CIDR parsing
// The old buggy code would match 192.168.100.1 to 192.168.1.0/24 because "192.168.1" is a prefix of "192.168.100"
func TestIsTrustedProxy_CIDRValidation(t *testing.T) {
	tests := []struct {
		name           string
		ip             string
		trustedProxies []string
		expected       bool
	}{
		// CIDR validation tests - these would fail with the old buggy code
		{
			name:           "CIDR exact match in range",
			ip:             "192.168.1.50",
			trustedProxies: []string{"192.168.1.0/24"},
			expected:       true,
		},
		{
			name:           "CIDR boundary start",
			ip:             "192.168.1.0",
			trustedProxies: []string{"192.168.1.0/24"},
			expected:       true,
		},
		{
			name:           "CIDR boundary end",
			ip:             "192.168.1.255",
			trustedProxies: []string{"192.168.1.0/24"},
			expected:       true,
		},
		{
			name:           "CIDR out of range - would match with string prefix bug",
			ip:             "192.168.100.1",
			trustedProxies: []string{"192.168.1.0/24"},
			expected:       false, // CRITICAL: This is the bug fix - 192.168.100.1 should NOT match 192.168.1.0/24
		},
		{
			name:           "CIDR out of range - similar prefix",
			ip:             "192.168.10.1",
			trustedProxies: []string{"192.168.1.0/24"},
			expected:       false, // 192.168.10.1 should NOT match 192.168.1.0/24
		},
		{
			name:           "CIDR /16 range",
			ip:             "10.0.255.1",
			trustedProxies: []string{"10.0.0.0/16"},
			expected:       true,
		},
		{
			name:           "CIDR /16 out of range",
			ip:             "10.1.0.1",
			trustedProxies: []string{"10.0.0.0/16"},
			expected:       false,
		},
		{
			name:           "CIDR /8 range",
			ip:             "10.255.255.255",
			trustedProxies: []string{"10.0.0.0/8"},
			expected:       true,
		},
		{
			name:           "CIDR /32 exact",
			ip:             "192.168.1.1",
			trustedProxies: []string{"192.168.1.1/32"},
			expected:       true,
		},
		{
			name:           "CIDR /32 no match",
			ip:             "192.168.1.2",
			trustedProxies: []string{"192.168.1.1/32"},
			expected:       false,
		},
		// IPv6 CIDR tests
		{
			name:           "IPv6 CIDR match",
			ip:             "2001:db8::1",
			trustedProxies: []string{"2001:db8::/32"},
			expected:       true,
		},
		{
			name:           "IPv6 CIDR no match",
			ip:             "2001:db9::1",
			trustedProxies: []string{"2001:db8::/32"},
			expected:       false,
		},
		// Invalid CIDR handling
		{
			name:           "Invalid CIDR format - should be skipped",
			ip:             "192.168.1.1",
			trustedProxies: []string{"invalid/cidr", "192.168.1.1"},
			expected:       true, // Should match the exact IP
		},
		// Empty/invalid IP handling
		{
			name:           "Empty IP",
			ip:             "",
			trustedProxies: []string{"192.168.1.0/24"},
			expected:       false,
		},
		{
			name:           "Invalid IP format",
			ip:             "not.an.ip",
			trustedProxies: []string{"192.168.1.0/24"},
			expected:       false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isTrustedProxy(tt.ip, tt.trustedProxies)
			if result != tt.expected {
				t.Errorf("isTrustedProxy(%q, %v) = %v, expected %v", tt.ip, tt.trustedProxies, result, tt.expected)
			}
		})
	}
}

// TestIsTrustedProxy_BugRegression specifically tests the bug that was fixed
// where string prefix matching allowed IP spoofing
func TestIsTrustedProxy_BugRegression(t *testing.T) {
	// This is the specific scenario that the bug allowed:
	// If trusted proxy is 192.168.1.0/24, the old code would:
	// 1. Extract prefix "192.168.1"
	// 2. Check if IP starts with "192.168.1"
	// 3. "192.168.100.1" starts with "192.168.1" -> INCORRECTLY TRUSTED
	//
	// With the fix using net.ParseCIDR:
	// 192.168.1.0/24 = 192.168.1.0 to 192.168.1.255
	// 192.168.100.1 is NOT in this range -> CORRECTLY REJECTED

	attackerIP := "192.168.100.1"    // Attacker's real IP
	trustedCIDR := "192.168.1.0/24"  // Legitimate proxy CIDR

	if isTrustedProxy(attackerIP, []string{trustedCIDR}) {
		t.Error("SECURITY BUG: Attacker IP 192.168.100.1 was incorrectly matched to CIDR 192.168.1.0/24")
	}

	// Also test another similar case
	attackerIP2 := "192.168.10.50"
	if isTrustedProxy(attackerIP2, []string{trustedCIDR}) {
		t.Error("SECURITY BUG: Attacker IP 192.168.10.50 was incorrectly matched to CIDR 192.168.1.0/24")
	}
}
