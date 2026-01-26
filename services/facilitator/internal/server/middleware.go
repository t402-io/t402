package server

import (
	"crypto/rand"
	"encoding/hex"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/t402-io/t402/services/facilitator/internal/ratelimit"
)

// RequestIDMiddleware adds a unique request ID to each request
// Validates client-provided request IDs to prevent log injection attacks
func RequestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")

		// Validate format if client provided a request ID
		if requestID != "" {
			if !isValidRequestID(requestID) {
				// Invalid format - generate a new one instead
				// Don't log the invalid ID to prevent log injection
				requestID = ""
			}
		}

		if requestID == "" {
			requestID = generateRequestID()
		}

		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)
		c.Next()
	}
}

// isValidRequestID validates that a request ID only contains safe characters
// Prevents log injection and other attacks via malicious request IDs
func isValidRequestID(id string) bool {
	// Max length check
	if len(id) > 64 || len(id) == 0 {
		return false
	}

	// Only allow alphanumeric characters, hyphens, and underscores
	for _, c := range id {
		if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
			(c >= '0' && c <= '9') || c == '-' || c == '_') {
			return false
		}
	}

	return true
}

// generateRequestID generates a cryptographically secure unique request ID
// Format: 16 random bytes encoded as 32 hex characters
func generateRequestID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		// Fallback to timestamp if crypto/rand fails (should never happen)
		return strconv.FormatInt(time.Now().UnixNano(), 36)
	}
	return hex.EncodeToString(b)
}

// LoggingMiddleware logs each request
func LoggingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()
		requestID, _ := c.Get("request_id")

		log.Printf("[%s] %s %s %d %v",
			requestID,
			c.Request.Method,
			path,
			status,
			latency,
		)
	}
}

// MaxBodySize is the maximum allowed request body size (1 MB)
const MaxBodySize = 1 << 20 // 1 MB

// BodySizeLimitMiddleware limits the request body size to prevent DoS attacks
func BodySizeLimitMiddleware(maxSize int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip for GET, HEAD, OPTIONS (no body)
		if c.Request.Method == "GET" || c.Request.Method == "HEAD" || c.Request.Method == "OPTIONS" {
			c.Next()
			return
		}

		// Check Content-Length header first (if present)
		if c.Request.ContentLength > maxSize {
			c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, gin.H{
				"code":    "REQUEST_TOO_LARGE",
				"message": "Request body too large",
			})
			return
		}

		// Wrap the body with a size limiter to enforce limit during reading
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxSize)

		c.Next()
	}
}

// CORSMiddleware handles Cross-Origin Resource Sharing with configurable allowed origins
// allowedOrigins: comma-separated list of allowed origins, or "*" for all
func CORSMiddleware(allowedOrigins string) gin.HandlerFunc {
	// Parse allowed origins into a map for O(1) lookup
	allowAll := allowedOrigins == "*" || allowedOrigins == ""
	originsMap := make(map[string]bool)

	if !allowAll {
		for _, origin := range strings.Split(allowedOrigins, ",") {
			origin = strings.TrimSpace(origin)
			if origin != "" {
				originsMap[origin] = true
			}
		}
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")

		// Determine the Access-Control-Allow-Origin value
		var allowOrigin string
		if allowAll {
			allowOrigin = "*"
		} else if originsMap[origin] {
			allowOrigin = origin
		} else if origin == "" {
			// No Origin header (same-origin request or non-browser client)
			allowOrigin = ""
		} else {
			// Origin not allowed - still set headers but with empty value
			// This effectively blocks the request on the browser side
			allowOrigin = ""
		}

		if allowOrigin != "" {
			c.Header("Access-Control-Allow-Origin", allowOrigin)
			if !allowAll {
				// When not allowing all origins, add Vary header for proper caching
				c.Header("Vary", "Origin")
			}
		}

		c.Header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization, X-Request-ID, X-API-Key")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			if allowOrigin != "" {
				c.AbortWithStatus(http.StatusNoContent)
			} else {
				c.AbortWithStatus(http.StatusForbidden)
			}
			return
		}

		c.Next()
	}
}

// RateLimitConfig holds configuration for rate limiting
type RateLimitConfig struct {
	// TrustProxy enables trusting X-Forwarded-For headers from trusted proxies
	TrustProxy bool
	// TrustedProxies is a list of trusted proxy IPs/CIDRs
	// Only these IPs are allowed to set X-Forwarded-For
	TrustedProxies []string
}

// DefaultRateLimitConfig returns a secure default configuration
// By default, does NOT trust proxy headers to prevent IP spoofing
func DefaultRateLimitConfig() *RateLimitConfig {
	return &RateLimitConfig{
		TrustProxy:     false,
		TrustedProxies: []string{},
	}
}

// RateLimitMiddleware applies rate limiting based on client IP
// Uses secure IP detection that doesn't blindly trust X-Forwarded-For
func RateLimitMiddleware(limiter ratelimit.Limiter) gin.HandlerFunc {
	return RateLimitMiddlewareWithConfig(limiter, DefaultRateLimitConfig())
}

// RateLimitMiddlewareWithConfig applies rate limiting with custom configuration
func RateLimitMiddlewareWithConfig(limiter ratelimit.Limiter, config *RateLimitConfig) gin.HandlerFunc {
	if config == nil {
		config = DefaultRateLimitConfig()
	}

	return func(c *gin.Context) {
		// Skip rate limiting for health and metrics endpoints
		path := c.Request.URL.Path
		if path == "/health" || path == "/ready" || path == "/metrics" {
			c.Next()
			return
		}

		// Get client IP using secure method
		clientIP := getSecureClientIP(c, config)

		allowed, info, err := limiter.Allow(c.Request.Context(), clientIP)
		if err != nil {
			// Fail-closed: deny requests when rate limiter is unavailable
			// This prevents potential abuse during Redis outages
			log.Printf("Rate limit error (failing closed): %v", err)
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"code":    "RATE_LIMITER_UNAVAILABLE",
				"message": "Service temporarily unavailable, please retry",
			})
			return
		}

		// Set rate limit headers
		c.Header("X-RateLimit-Limit", strconv.Itoa(info.Limit))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(info.Remaining))
		c.Header("X-RateLimit-Reset", strconv.FormatInt(info.Reset.Unix(), 10))

		if !allowed {
			c.Header("Retry-After", strconv.FormatInt(int64(time.Until(info.Reset).Seconds()), 10))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":      "rate limit exceeded",
				"retryAfter": time.Until(info.Reset).Seconds(),
			})
			return
		}

		c.Next()
	}
}

// getSecureClientIP returns the client IP with protection against spoofing
// Only trusts X-Forwarded-For from configured trusted proxies
func getSecureClientIP(c *gin.Context, config *RateLimitConfig) string {
	// Get the direct connection IP (cannot be spoofed)
	remoteIP := c.RemoteIP()

	// If proxy trust is disabled, always use the direct connection IP
	if !config.TrustProxy || len(config.TrustedProxies) == 0 {
		return remoteIP
	}

	// Check if the direct connection is from a trusted proxy
	if !isTrustedProxy(remoteIP, config.TrustedProxies) {
		// Not from a trusted proxy - use direct IP to prevent spoofing
		return remoteIP
	}

	// Connection is from a trusted proxy - we can trust X-Forwarded-For
	xff := c.GetHeader("X-Forwarded-For")
	if xff == "" {
		return remoteIP
	}

	// X-Forwarded-For contains comma-separated IPs: client, proxy1, proxy2, ...
	// The first IP is the original client (if the first proxy is trusted)
	ips := strings.Split(xff, ",")
	if len(ips) > 0 {
		clientIP := strings.TrimSpace(ips[0])
		// Validate the IP format
		if isValidIP(clientIP) {
			return clientIP
		}
	}

	return remoteIP
}

// isTrustedProxy checks if an IP is in the trusted proxy list
func isTrustedProxy(ip string, trustedProxies []string) bool {
	for _, trusted := range trustedProxies {
		if trusted == ip {
			return true
		}
		// Support CIDR notation (e.g., "10.0.0.0/8")
		if strings.Contains(trusted, "/") {
			// Simple prefix match for common cases
			// For production, consider using net.ParseCIDR
			prefix := strings.Split(trusted, "/")[0]
			if strings.HasPrefix(ip, strings.TrimSuffix(prefix, ".0")) {
				return true
			}
		}
	}
	return false
}

// isValidIP validates that a string looks like an IP address
func isValidIP(ip string) bool {
	// Basic validation - must contain dots or colons (IPv4 or IPv6)
	if !strings.Contains(ip, ".") && !strings.Contains(ip, ":") {
		return false
	}
	// Must not contain dangerous characters
	for _, c := range ip {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') ||
			(c >= 'A' && c <= 'F') || c == '.' || c == ':') {
			return false
		}
	}
	return len(ip) <= 45 // Max IPv6 length
}

// APIKeyMiddleware validates API keys (optional - for future use)
func APIKeyMiddleware(validKeys map[string]bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip if no keys configured
		if len(validKeys) == 0 {
			c.Next()
			return
		}

		apiKey := c.GetHeader("X-API-Key")
		if apiKey == "" {
			apiKey = c.Query("api_key")
		}

		if apiKey == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "API key required",
			})
			return
		}

		if !validKeys[apiKey] {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "invalid API key",
			})
			return
		}

		c.Next()
	}
}
