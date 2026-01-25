package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig()
	require.NotNil(t, cfg)
	assert.False(t, cfg.Required)
	assert.Contains(t, cfg.SkipPaths, "/health")
	assert.Contains(t, cfg.SkipPaths, "/ready")
	assert.Contains(t, cfg.SkipPaths, "/metrics")
	assert.Contains(t, cfg.SkipPaths, "/supported")
	assert.Equal(t, "X-API-Key", cfg.HeaderName)
	assert.Equal(t, "api_key", cfg.QueryParam)
}

func TestMiddlewareSkipPaths(t *testing.T) {
	manager := NewManager(nil)
	manager.LoadFromEnv("test-key:test-app")

	router := gin.New()
	router.Use(Middleware(manager, nil))
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	router.GET("/ready", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
	router.GET("/metrics", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Test skip paths without API key
	for _, path := range []string{"/health", "/ready", "/metrics"} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code, "Path %s should be accessible without API key", path)
	}
}

func TestMiddlewareNoKeysNotRequired(t *testing.T) {
	manager := NewManager(nil)
	// No keys loaded

	router := gin.New()
	router.Use(Middleware(manager, &Config{Required: false}))
	router.GET("/verify", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest(http.MethodGet, "/verify", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestMiddlewareWithHeaderKey(t *testing.T) {
	manager := NewManager(nil)
	manager.LoadFromEnv("test-key:test-app")

	router := gin.New()
	router.Use(Middleware(manager, nil))
	router.GET("/verify", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest(http.MethodGet, "/verify", nil)
	req.Header.Set("X-API-Key", "test-key")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestMiddlewareWithQueryKey(t *testing.T) {
	manager := NewManager(nil)
	manager.LoadFromEnv("test-key:test-app")

	router := gin.New()
	router.Use(Middleware(manager, nil))
	router.GET("/verify", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest(http.MethodGet, "/verify?api_key=test-key", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestMiddlewareWithBearerToken(t *testing.T) {
	manager := NewManager(nil)
	manager.LoadFromEnv("test-key:test-app")

	router := gin.New()
	router.Use(Middleware(manager, nil))
	router.GET("/verify", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest(http.MethodGet, "/verify", nil)
	req.Header.Set("Authorization", "Bearer test-key")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestMiddlewareMissingKey(t *testing.T) {
	manager := NewManager(nil)
	manager.LoadFromEnv("test-key:test-app")

	router := gin.New()
	router.Use(Middleware(manager, nil))
	router.GET("/verify", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest(http.MethodGet, "/verify", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.Contains(t, w.Body.String(), "API key required")
}

func TestMiddlewareInvalidKey(t *testing.T) {
	manager := NewManager(nil)
	manager.LoadFromEnv("test-key:test-app")

	router := gin.New()
	router.Use(Middleware(manager, nil))
	router.GET("/verify", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest(http.MethodGet, "/verify", nil)
	req.Header.Set("X-API-Key", "wrong-key")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.Contains(t, w.Body.String(), "Invalid API key")
}

func TestMiddlewareExpiredKey(t *testing.T) {
	manager := NewManager(nil)

	// Create an expired key manually
	rawKey := "expired-test-key"
	apiKey := &APIKey{
		ID:        generateKeyID(),
		Name:      "expired",
		KeyHash:   hashKey(rawKey),
		CreatedAt: time.Now().Add(-2 * time.Hour),
		ExpiresAt: time.Now().Add(-time.Hour),
	}
	manager.mu.Lock()
	manager.keys[apiKey.KeyHash] = apiKey
	manager.mu.Unlock()

	router := gin.New()
	router.Use(Middleware(manager, nil))
	router.GET("/verify", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest(http.MethodGet, "/verify", nil)
	req.Header.Set("X-API-Key", rawKey)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.Contains(t, w.Body.String(), "expired")
}

func TestMiddlewareRevokedKey(t *testing.T) {
	manager := NewManager(nil)
	rawKey, apiKey, _ := manager.CreateKey(context.Background(), "test", 0, 0, nil)
	manager.RevokeKey(context.Background(), apiKey.ID)

	router := gin.New()
	router.Use(Middleware(manager, nil))
	router.GET("/verify", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest(http.MethodGet, "/verify", nil)
	req.Header.Set("X-API-Key", rawKey)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.Contains(t, w.Body.String(), "revoked")
}

func TestMiddlewareForbiddenPermission(t *testing.T) {
	manager := NewManager(nil)
	rawKey, _, _ := manager.CreateKey(context.Background(), "test", 0, 0, []string{"supported"})

	router := gin.New()
	router.Use(Middleware(manager, nil))
	router.GET("/settle", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest(http.MethodGet, "/settle", nil)
	req.Header.Set("X-API-Key", rawKey)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusForbidden, w.Code)
	assert.Contains(t, w.Body.String(), "permission")
}

func TestMiddlewareContextValues(t *testing.T) {
	manager := NewManager(nil)
	rawKey, apiKey, _ := manager.CreateKey(context.Background(), "test-app", 1000, 0, nil)

	var capturedID, capturedName string
	var capturedRateLimit int

	router := gin.New()
	router.Use(Middleware(manager, nil))
	router.GET("/verify", func(c *gin.Context) {
		capturedID = GetKeyID(c)
		capturedName = GetKeyName(c)
		capturedRateLimit = GetKeyRateLimit(c)
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest(http.MethodGet, "/verify", nil)
	req.Header.Set("X-API-Key", rawKey)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, apiKey.ID, capturedID)
	assert.Equal(t, "test-app", capturedName)
	assert.Equal(t, 1000, capturedRateLimit)
}

func TestGetPermissionForPath(t *testing.T) {
	tests := []struct {
		path     string
		method   string
		expected string
	}{
		{"/verify", "POST", "verify"},
		{"/settle", "POST", "settle"},
		{"/supported", "GET", "supported"},
		{"/unknown", "GET", "read"},
		{"/other/path", "POST", "read"},
	}

	for _, tt := range tests {
		result := getPermissionForPath(tt.path, tt.method)
		assert.Equal(t, tt.expected, result, "Path: %s, Method: %s", tt.path, tt.method)
	}
}

func TestGetContextFunctionsWithMissingValues(t *testing.T) {
	router := gin.New()
	router.GET("/test", func(c *gin.Context) {
		assert.Equal(t, "", GetKeyID(c))
		assert.Equal(t, "", GetKeyName(c))
		assert.Equal(t, 0, GetKeyRateLimit(c))
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestMiddlewareWithNilConfig(t *testing.T) {
	manager := NewManager(nil)

	router := gin.New()
	router.Use(Middleware(manager, nil))
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestMiddlewareRequiredWithNoKeys(t *testing.T) {
	manager := NewManager(nil)

	router := gin.New()
	router.Use(Middleware(manager, &Config{Required: true}))
	router.GET("/verify", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest(http.MethodGet, "/verify", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestMiddlewareSkipSubPaths(t *testing.T) {
	manager := NewManager(nil)
	manager.LoadFromEnv("test-key:test-app")

	router := gin.New()
	router.Use(Middleware(manager, nil))
	router.GET("/health/detailed", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	req := httptest.NewRequest(http.MethodGet, "/health/detailed", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)
}
