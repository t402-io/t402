package persistence

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
)

// AuditMetrics tracks audit logging metrics
type AuditMetrics struct {
	TotalLogged uint64
	TotalFailed uint64
}

// Global audit metrics for monitoring
var auditMetrics AuditMetrics

// GetAuditMetrics returns current audit logging metrics
func GetAuditMetrics() AuditMetrics {
	return AuditMetrics{
		TotalLogged: atomic.LoadUint64(&auditMetrics.TotalLogged),
		TotalFailed: atomic.LoadUint64(&auditMetrics.TotalFailed),
	}
}

// AuditMiddlewareConfig configures the audit middleware
type AuditMiddlewareConfig struct {
	// SkipPaths are paths that should not be audited
	SkipPaths []string
	// SkipRequestBody skips logging request body for specific paths
	SkipRequestBody []string
	// SkipResponseBody skips logging response body for specific paths
	SkipResponseBody []string
	// MaxBodySize is the maximum size of request/response body to log (default: 64KB)
	MaxBodySize int
}

// DefaultAuditMiddlewareConfig returns default configuration
func DefaultAuditMiddlewareConfig() *AuditMiddlewareConfig {
	return &AuditMiddlewareConfig{
		SkipPaths:        []string{"/health", "/ready", "/metrics"},
		SkipRequestBody:  []string{},
		SkipResponseBody: []string{"/metrics"},
		MaxBodySize:      64 * 1024, // 64KB
	}
}

// responseWriter wraps gin.ResponseWriter to capture response body
type responseWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w *responseWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

// AuditMiddleware creates a Gin middleware that logs requests to the audit repository
func AuditMiddleware(repo *AuditRepository, config *AuditMiddlewareConfig) gin.HandlerFunc {
	if config == nil {
		config = DefaultAuditMiddlewareConfig()
	}

	skipPaths := make(map[string]bool)
	for _, path := range config.SkipPaths {
		skipPaths[path] = true
	}

	skipRequestBody := make(map[string]bool)
	for _, path := range config.SkipRequestBody {
		skipRequestBody[path] = true
	}

	skipResponseBody := make(map[string]bool)
	for _, path := range config.SkipResponseBody {
		skipResponseBody[path] = true
	}

	return func(c *gin.Context) {
		path := c.Request.URL.Path

		// Skip audit for certain paths
		if skipPaths[path] {
			c.Next()
			return
		}

		start := time.Now()

		// Read and restore request body
		var requestBody []byte
		if !skipRequestBody[path] && c.Request.Body != nil {
			requestBody, _ = io.ReadAll(c.Request.Body)
			c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))

			// Truncate if too large
			if config.MaxBodySize > 0 && len(requestBody) > config.MaxBodySize {
				requestBody = requestBody[:config.MaxBodySize]
			}
		}

		// Wrap response writer to capture response body
		var responseBody *bytes.Buffer
		if !skipResponseBody[path] {
			responseBody = &bytes.Buffer{}
			c.Writer = &responseWriter{
				ResponseWriter: c.Writer,
				body:           responseBody,
			}
		}

		// Process request
		c.Next()

		// Calculate duration
		duration := time.Since(start)

		// Determine action based on path
		action := determineAction(path)

		// Get network from request context or body
		network := c.GetString("network")
		if network == "" {
			network = extractNetworkFromBody(requestBody)
		}

		// Prepare response body for logging
		var responseBytesToLog []byte
		if responseBody != nil {
			responseBytesToLog = responseBody.Bytes()
			if config.MaxBodySize > 0 && len(responseBytesToLog) > config.MaxBodySize {
				responseBytesToLog = responseBytesToLog[:config.MaxBodySize]
			}
		}

		// Create audit entry
		entry := &AuditEntry{
			Timestamp:    start,
			Action:       action,
			Network:      network,
			RequestID:    c.GetHeader("X-Request-ID"),
			IPAddress:    c.ClientIP(),
			APIKeyID:     c.GetString("api_key_id"),
			RequestBody:  sanitizeJSON(requestBody),
			ResponseBody: sanitizeJSON(responseBytesToLog),
			DurationMs:   int(duration.Milliseconds()),
			StatusCode:   c.Writer.Status(),
		}

		// Log asynchronously to not block the request
		go func() {
			ctx := c.Request.Context()
			if err := repo.Log(ctx, entry); err != nil {
				// Log error but don't fail the request
				// Track failure for monitoring
				atomic.AddUint64(&auditMetrics.TotalFailed, 1)
				log.Printf("ERROR: Audit log failed: %v (action=%s, requestID=%s)",
					err, entry.Action, entry.RequestID)
			} else {
				atomic.AddUint64(&auditMetrics.TotalLogged, 1)
			}
		}()
	}
}

// determineAction maps request path to audit action
func determineAction(path string) AuditAction {
	switch path {
	case "/verify":
		return AuditActionVerify
	case "/settle":
		return AuditActionSettle
	case "/health", "/ready":
		return AuditActionHealth
	case "/supported":
		return AuditActionSupport
	default:
		return AuditActionError
	}
}

// extractNetworkFromBody attempts to extract network from JSON body
func extractNetworkFromBody(body []byte) string {
	if len(body) == 0 {
		return ""
	}

	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return ""
	}

	// Try to get network from requirements.network or network field
	if requirements, ok := data["requirements"].(map[string]interface{}); ok {
		if network, ok := requirements["network"].(string); ok {
			return network
		}
	}

	if network, ok := data["network"].(string); ok {
		return network
	}

	return ""
}

// sensitiveFields lists JSON fields that should be redacted from audit logs
// SECURITY: These fields may contain signatures, keys, or other sensitive data
var sensitiveFields = map[string]bool{
	"signature":       true,
	"payerSignature":  true,
	"payeeSignature":  true,
	"depositSignature": true,
	"privateKey":      true,
	"mnemonic":        true,
	"seed":            true,
	"secret":          true,
	"password":        true,
	"token":           true,
	"apiKey":          true,
	"api_key":         true,
}

// sanitizeJSON validates that data is valid JSON and redacts sensitive fields
// SECURITY: P2-2 fix - Prevents sensitive data from being logged
func sanitizeJSON(data []byte) json.RawMessage {
	if len(data) == 0 {
		return nil
	}

	// Check if it's valid JSON
	if !json.Valid(data) {
		return nil
	}

	// Try to redact sensitive fields
	redacted := redactSensitiveFields(data)
	if redacted != nil {
		return json.RawMessage(redacted)
	}

	return json.RawMessage(data)
}

// redactSensitiveFields recursively redacts sensitive fields from JSON
func redactSensitiveFields(data []byte) []byte {
	var obj interface{}
	if err := json.Unmarshal(data, &obj); err != nil {
		return nil
	}

	redactedObj := redactValue(obj)
	result, err := json.Marshal(redactedObj)
	if err != nil {
		return nil
	}
	return result
}

// redactValue recursively processes values to redact sensitive fields
func redactValue(v interface{}) interface{} {
	switch val := v.(type) {
	case map[string]interface{}:
		result := make(map[string]interface{})
		for key, value := range val {
			if sensitiveFields[key] {
				// Redact the value but preserve the key to show it was present
				result[key] = "[REDACTED]"
			} else {
				result[key] = redactValue(value)
			}
		}
		return result
	case []interface{}:
		result := make([]interface{}, len(val))
		for i, item := range val {
			result[i] = redactValue(item)
		}
		return result
	default:
		return v
	}
}

// RequestStatsHandler returns an HTTP handler that provides request statistics
func RequestStatsHandler(repo *AuditRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		network := c.Query("network")

		stats, err := repo.GetRequestStats(c.Request.Context(), AuditFilter{
			Network: network,
		})
		if err != nil {
			c.JSON(500, gin.H{"error": "failed to get request stats"})
			return
		}

		c.JSON(200, stats)
	}
}

// SettlementStatsHandler returns an HTTP handler that provides settlement statistics
func SettlementStatsHandler(repo *SettlementRepository) gin.HandlerFunc {
	return func(c *gin.Context) {
		network := c.Query("network")

		counts, err := repo.CountByStatus(c.Request.Context(), network)
		if err != nil {
			c.JSON(500, gin.H{"error": "failed to get settlement stats"})
			return
		}

		c.JSON(200, gin.H{
			"pending":   counts[SettlementStatusPending],
			"confirmed": counts[SettlementStatusConfirmed],
			"failed":    counts[SettlementStatusFailed],
		})
	}
}
