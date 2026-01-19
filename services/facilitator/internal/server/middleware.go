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
func RequestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = generateRequestID()
		}
		c.Set("request_id", requestID)
		c.Header("X-Request-ID", requestID)
		c.Next()
	}
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

// RateLimitMiddleware applies rate limiting based on client IP
func RateLimitMiddleware(limiter ratelimit.Limiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip rate limiting for health and metrics endpoints
		path := c.Request.URL.Path
		if path == "/health" || path == "/ready" || path == "/metrics" {
			c.Next()
			return
		}

		// Use client IP as rate limit key
		clientIP := c.ClientIP()

		allowed, info, err := limiter.Allow(c.Request.Context(), clientIP)
		if err != nil {
			log.Printf("Rate limit error: %v", err)
			c.Next()
			return
		}

		// Set rate limit headers
		c.Header("X-RateLimit-Limit", strconv.Itoa(info.Limit))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(info.Remaining))
		c.Header("X-RateLimit-Reset", strconv.FormatInt(info.Reset.Unix(), 10))

		if !allowed {
			c.Header("Retry-After", strconv.FormatInt(int64(time.Until(info.Reset).Seconds()), 10))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error": "rate limit exceeded",
				"retryAfter": time.Until(info.Reset).Seconds(),
			})
			return
		}

		c.Next()
	}
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
