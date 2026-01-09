package server

import (
	"log"
	"net/http"
	"strconv"
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

// generateRequestID generates a unique request ID
func generateRequestID() string {
	return strconv.FormatInt(time.Now().UnixNano(), 36)
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

// CORSMiddleware handles Cross-Origin Resource Sharing
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization, X-Request-ID, X-API-Key")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
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
