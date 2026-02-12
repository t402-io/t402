package server

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log"
	"net"
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

// SecurityHeadersMiddleware adds security-related HTTP headers to all responses
// SECURITY: Protects against XSS, clickjacking, MIME-type sniffing, and other attacks
func SecurityHeadersMiddleware(isProduction bool) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Prevent clickjacking attacks by disallowing framing
		c.Header("X-Frame-Options", "DENY")

		// Prevent MIME-type sniffing attacks
		c.Header("X-Content-Type-Options", "nosniff")

		// Enable browser XSS filter (legacy, but still useful for older browsers)
		c.Header("X-XSS-Protection", "1; mode=block")

		// Control how much referrer information is sent
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")

		// Prevent caching of sensitive API responses
		c.Header("Cache-Control", "no-store, no-cache, must-revalidate, private")
		c.Header("Pragma", "no-cache")

		// Content Security Policy - restrict resource loading
		c.Header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")

		// Only add HSTS in production (requires HTTPS)
		if isProduction {
			// Strict Transport Security - force HTTPS for 1 year
			c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
		}

		c.Next()
	}
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

		// Get rate limit key - prefer API key ID over IP for authenticated requests
		// This provides per-API-key rate limiting for authenticated clients
		rateLimitKey := getRateLimitKey(c, config)

		allowed, info, err := limiter.Allow(c.Request.Context(), rateLimitKey)
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

// getRateLimitKey returns the appropriate key for rate limiting
// SECURITY: Uses API key ID for authenticated requests, IP address for anonymous
// This provides proper per-API-key rate limiting while preventing spoofing
func getRateLimitKey(c *gin.Context, config *RateLimitConfig) string {
	// Check if request is authenticated with an API key
	// API key ID is set by the auth middleware in context
	if apiKeyID, exists := c.Get("api_key_id"); exists {
		if keyID, ok := apiKeyID.(string); ok && keyID != "" {
			// Use "apikey:" prefix to separate from IP-based keys
			return "apikey:" + keyID
		}
	}

	// Fall back to client IP for anonymous requests
	return "ip:" + getSecureClientIP(c, config)
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
		// P1-12: Log proxy trust denial for security auditing
		if config.TrustProxy {
			log.Printf("SECURITY: proxy trust denied for remote_ip=%s path=%s", remoteIP, c.Request.URL.Path)
		}
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
			// P1-12: Log proxy trust grant for security auditing
			log.Printf("SECURITY: proxy trust granted remote_ip=%s forwarded_client=%s path=%s",
				remoteIP, clientIP, c.Request.URL.Path)
			return clientIP
		}
	}

	return remoteIP
}

// isTrustedProxy checks if an IP is in the trusted proxy list
// SECURITY: Uses proper CIDR parsing to prevent IP spoofing attacks
// The previous string prefix matching was vulnerable (e.g., 192.168.100.1 would match 192.168.1.0/24)
func isTrustedProxy(ip string, trustedProxies []string) bool {
	// Parse the IP address first
	parsedIP := net.ParseIP(ip)
	if parsedIP == nil {
		// Invalid IP format - don't trust it
		return false
	}

	for _, trusted := range trustedProxies {
		// Check for exact match first
		if trusted == ip {
			return true
		}

		// Support CIDR notation (e.g., "10.0.0.0/8", "192.168.1.0/24")
		if strings.Contains(trusted, "/") {
			_, cidr, err := net.ParseCIDR(trusted)
			if err != nil {
				// Invalid CIDR format - skip this entry
				log.Printf("Warning: invalid CIDR format in trusted proxies: %s", trusted)
				continue
			}
			if cidr.Contains(parsedIP) {
				return true
			}
		} else {
			// Non-CIDR format - try parsing as IP for comparison
			trustedIP := net.ParseIP(trusted)
			if trustedIP != nil && trustedIP.Equal(parsedIP) {
				return true
			}
		}
	}
	return false
}

// isValidIP validates that a string is a valid IP address
// SECURITY: Uses net.ParseIP for proper validation instead of character checks
func isValidIP(ip string) bool {
	// Use standard library for proper IP validation
	// This handles both IPv4 and IPv6 correctly
	return net.ParseIP(ip) != nil
}

// EndpointRateLimitConfig holds per-endpoint rate limit configuration
// SECURITY: P2-1 fix - Allows stricter rate limits for sensitive endpoints
type EndpointRateLimitConfig struct {
	// DefaultLimit is the default rate limit for unspecified endpoints
	DefaultLimit int
	// EndpointLimits maps endpoint paths to their specific rate limits
	// Lower values mean stricter limits
	EndpointLimits map[string]int
}

// DefaultEndpointRateLimitConfig returns secure default endpoint limits
// /settle has stricter limits as it executes on-chain transactions
func DefaultEndpointRateLimitConfig() *EndpointRateLimitConfig {
	return &EndpointRateLimitConfig{
		DefaultLimit: 1000, // Default: 1000 req/min
		EndpointLimits: map[string]int{
			"/settle":           100,  // Settle: 100 req/min (on-chain transactions)
			"/v1/stream/open":   200,  // Stream open: 200 req/min
			"/v1/stream/close":  200,  // Stream close: 200 req/min
			"/v1/intent":        200,  // Intent create: 200 req/min
			"/v1/intent/execute": 100, // Intent execute: 100 req/min
		},
	}
}

// GetEndpointLimit returns the rate limit for a specific endpoint
func (c *EndpointRateLimitConfig) GetEndpointLimit(path string) int {
	if limit, ok := c.EndpointLimits[path]; ok {
		return limit
	}
	return c.DefaultLimit
}

// P1-7: UserRateLimitMiddleware applies per-user/API-key rate limiting.
// This runs AFTER auth middleware so api_key_id is available in context.
// Provides isolated rate limits per API key, preventing one key from exhausting global limits.
func UserRateLimitMiddleware(userLimiter *ratelimit.UserRateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip for health and metrics endpoints
		path := c.Request.URL.Path
		if path == "/health" || path == "/ready" || path == "/metrics" {
			c.Next()
			return
		}

		// Only apply to authenticated requests with an API key
		apiKeyID, exists := c.Get("api_key_id")
		if !exists {
			c.Next()
			return
		}
		keyID, ok := apiKeyID.(string)
		if !ok || keyID == "" {
			c.Next()
			return
		}

		allowed, info, err := userLimiter.AllowUser(c.Request.Context(), keyID, path)
		if err != nil {
			// P1-7: Fail closed — deny if rate limiter is unavailable
			log.Printf("User rate limit error for key=%s: %v", keyID, err)
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"code":    "RATE_LIMITER_UNAVAILABLE",
				"message": "Service temporarily unavailable, please retry",
			})
			return
		}

		// Set user-specific rate limit headers
		c.Header("X-RateLimit-User-Limit", strconv.Itoa(info.Limit))
		c.Header("X-RateLimit-User-Remaining", strconv.Itoa(info.Remaining))

		if !allowed {
			c.Header("Retry-After", strconv.FormatInt(int64(time.Until(info.Reset).Seconds()), 10))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":      "per-user rate limit exceeded",
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

// MaxResponseSize is the maximum allowed response size (10 MB)
// SECURITY: P2-5 fix - Prevents memory exhaustion from large responses
const MaxResponseSize = 10 << 20 // 10 MB

// ResponseSizeLimitMiddleware wraps the response writer to limit response size
// SECURITY: Prevents memory exhaustion attacks via excessively large responses
func ResponseSizeLimitMiddleware(maxSize int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Replace the response writer with a size-limited one
		limitedWriter := &limitedResponseWriter{
			ResponseWriter: c.Writer,
			maxSize:        maxSize,
			written:        0,
		}
		c.Writer = limitedWriter

		c.Next()

		// Check if we hit the limit (response may have been truncated)
		if limitedWriter.limitExceeded {
			log.Printf("WARNING: Response size limit exceeded for %s %s", c.Request.Method, c.Request.URL.Path)
		}
	}
}

// limitedResponseWriter wraps gin.ResponseWriter to limit response size
type limitedResponseWriter struct {
	gin.ResponseWriter
	maxSize       int64
	written       int64
	limitExceeded bool
}

func (w *limitedResponseWriter) Write(data []byte) (int, error) {
	remaining := w.maxSize - w.written
	if remaining <= 0 {
		// Already exceeded limit
		w.limitExceeded = true
		return 0, nil
	}

	if int64(len(data)) > remaining {
		// Would exceed limit - truncate
		data = data[:remaining]
		w.limitExceeded = true
	}

	n, err := w.ResponseWriter.Write(data)
	w.written += int64(n)
	return n, err
}

// P1-6: endpointTimeouts provides per-endpoint timeout overrides.
// Settlement needs more time because on-chain transactions vary by chain
// (e.g., TON uses 60s confirmation, EVM varies by congestion).
var endpointTimeouts = map[string]time.Duration{
	"/settle": 60 * time.Second, // P1-6: Settlement needs more time for on-chain confirmation
}

// OperationTimeoutMiddleware adds per-operation context timeouts.
// Handlers should check c.Request.Context() for cancellation.
// SECURITY: P2-6 fix - Prevents resource exhaustion from hanging operations
// P1-6: Uses per-endpoint timeouts for settlement
func OperationTimeoutMiddleware(defaultTimeout time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip for endpoints that don't need strict timeouts
		// (health checks, metrics)
		path := c.Request.URL.Path
		if path == "/health" || path == "/ready" || path == "/metrics" {
			c.Next()
			return
		}

		// P1-6: Use per-endpoint timeout if configured, otherwise default
		timeout := defaultTimeout
		if t, ok := endpointTimeouts[path]; ok {
			timeout = t
		}

		// Create a timeout context for this operation
		ctx, cancel := context.WithTimeout(c.Request.Context(), timeout)
		defer cancel()

		// Replace the request context — handlers use c.Request.Context()
		// to detect cancellation and return early.
		c.Request = c.Request.WithContext(ctx)

		c.Next()

		// If the context expired during handler execution, log it.
		if ctx.Err() == context.DeadlineExceeded && !c.Writer.Written() {
			log.Printf("Request timeout for %s %s", c.Request.Method, c.Request.URL.Path)
			c.AbortWithStatusJSON(http.StatusGatewayTimeout, gin.H{
				"code":    "REQUEST_TIMEOUT",
				"message": "Request processing timed out",
			})
		}
	}
}
