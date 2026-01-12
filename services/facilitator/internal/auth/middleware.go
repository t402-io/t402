package auth

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// Config holds authentication middleware configuration
type Config struct {
	// Required determines if API key is required (true) or optional (false)
	Required bool

	// SkipPaths are paths that skip authentication (e.g., /health, /metrics)
	SkipPaths []string

	// HeaderName is the HTTP header to check for API key (default: X-API-Key)
	HeaderName string

	// QueryParam is the query parameter to check for API key (default: api_key)
	QueryParam string
}

// DefaultConfig returns the default authentication configuration
func DefaultConfig() *Config {
	return &Config{
		Required:   false,
		SkipPaths:  []string{"/health", "/ready", "/metrics", "/supported"},
		HeaderName: "X-API-Key",
		QueryParam: "api_key",
	}
}

// Middleware returns a Gin middleware for API key authentication
func Middleware(manager *Manager, cfg *Config) gin.HandlerFunc {
	if cfg == nil {
		cfg = DefaultConfig()
	}

	return func(c *gin.Context) {
		// Check if path should skip authentication
		path := c.Request.URL.Path
		for _, skipPath := range cfg.SkipPaths {
			if path == skipPath || strings.HasPrefix(path, skipPath+"/") {
				c.Next()
				return
			}
		}

		// If no keys configured and not required, skip
		if !manager.HasKeys() && !cfg.Required {
			c.Next()
			return
		}

		// Extract API key from header or query
		apiKey := c.GetHeader(cfg.HeaderName)
		if apiKey == "" {
			apiKey = c.Query(cfg.QueryParam)
		}

		// Also check Authorization header with Bearer scheme
		if apiKey == "" {
			auth := c.GetHeader("Authorization")
			if strings.HasPrefix(auth, "Bearer ") {
				apiKey = strings.TrimPrefix(auth, "Bearer ")
			}
		}

		// If no API key provided
		if apiKey == "" {
			if cfg.Required || manager.HasKeys() {
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
					"error":   "unauthorized",
					"message": "API key required. Provide via X-API-Key header, Authorization: Bearer <key>, or api_key query parameter.",
				})
				return
			}
			c.Next()
			return
		}

		// Validate API key
		keyInfo, err := manager.ValidateKey(c.Request.Context(), apiKey)
		if err != nil {
			status := http.StatusUnauthorized
			message := "Invalid API key"

			switch err {
			case ErrAPIKeyExpired:
				message = "API key has expired"
			case ErrAPIKeyRevoked:
				message = "API key has been revoked"
			}

			c.AbortWithStatusJSON(status, gin.H{
				"error":   "unauthorized",
				"message": message,
			})
			return
		}

		// Check permission for the endpoint
		permission := getPermissionForPath(path, c.Request.Method)
		if !keyInfo.HasPermission(permission) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"error":   "forbidden",
				"message": "API key does not have permission for this operation",
			})
			return
		}

		// Store key info in context for downstream use
		c.Set("api_key_id", keyInfo.ID)
		c.Set("api_key_name", keyInfo.Name)
		c.Set("api_key_rate_limit", keyInfo.RateLimit)

		c.Next()
	}
}

// getPermissionForPath returns the required permission for a path
func getPermissionForPath(path, method string) string {
	switch path {
	case "/verify":
		return "verify"
	case "/settle":
		return "settle"
	case "/supported":
		return "supported"
	default:
		return "read"
	}
}

// GetKeyID extracts the API key ID from the Gin context
func GetKeyID(c *gin.Context) string {
	if id, exists := c.Get("api_key_id"); exists {
		return id.(string)
	}
	return ""
}

// GetKeyName extracts the API key name from the Gin context
func GetKeyName(c *gin.Context) string {
	if name, exists := c.Get("api_key_name"); exists {
		return name.(string)
	}
	return ""
}

// GetKeyRateLimit extracts the API key rate limit from the Gin context
func GetKeyRateLimit(c *gin.Context) int {
	if limit, exists := c.Get("api_key_rate_limit"); exists {
		return limit.(int)
	}
	return 0
}
