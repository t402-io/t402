package tracing

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/propagation"
	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
	"go.opentelemetry.io/otel/trace"
)

// MiddlewareConfig configures the tracing middleware
type MiddlewareConfig struct {
	// TracerName is the name of the tracer
	TracerName string
	// SkipPaths are paths that should not be traced
	SkipPaths []string
	// SpanNameFormatter formats the span name
	SpanNameFormatter func(c *gin.Context) string
}

// DefaultMiddlewareConfig returns default middleware configuration
func DefaultMiddlewareConfig() *MiddlewareConfig {
	return &MiddlewareConfig{
		TracerName: "facilitator-http",
		SkipPaths:  []string{"/health", "/ready", "/metrics"},
		SpanNameFormatter: func(c *gin.Context) string {
			return fmt.Sprintf("%s %s", c.Request.Method, c.FullPath())
		},
	}
}

// Middleware returns a Gin middleware that adds tracing to requests
func Middleware(provider *Provider, cfg *MiddlewareConfig) gin.HandlerFunc {
	if cfg == nil {
		cfg = DefaultMiddlewareConfig()
	}

	skipPaths := make(map[string]bool)
	for _, path := range cfg.SkipPaths {
		skipPaths[path] = true
	}

	tracer := otel.Tracer(cfg.TracerName)
	propagator := otel.GetTextMapPropagator()

	return func(c *gin.Context) {
		// Skip tracing for certain paths
		if skipPaths[c.Request.URL.Path] {
			c.Next()
			return
		}

		// Extract trace context from incoming request
		ctx := propagator.Extract(c.Request.Context(), propagation.HeaderCarrier(c.Request.Header))

		// Start a new span
		spanName := cfg.SpanNameFormatter(c)
		ctx, span := tracer.Start(ctx, spanName,
			trace.WithSpanKind(trace.SpanKindServer),
			trace.WithAttributes(
				semconv.HTTPMethod(c.Request.Method),
				semconv.HTTPRoute(c.FullPath()),
				semconv.HTTPURL(c.Request.URL.String()),
				semconv.HTTPScheme(c.Request.URL.Scheme),
				semconv.UserAgentOriginal(c.Request.UserAgent()),
				semconv.ClientAddress(c.ClientIP()),
			),
		)
		defer span.End()

		// Add request ID if present
		if requestID := c.GetHeader("X-Request-ID"); requestID != "" {
			span.SetAttributes(AttrRequestID.String(requestID))
		}

		// Store span in context
		c.Request = c.Request.WithContext(ctx)

		// Process request
		c.Next()

		// Set response attributes
		statusCode := c.Writer.Status()
		span.SetAttributes(semconv.HTTPStatusCode(statusCode))

		// Set span status based on HTTP status code
		if statusCode >= 400 {
			span.SetStatus(codes.Error, fmt.Sprintf("HTTP %d", statusCode))
		} else {
			span.SetStatus(codes.Ok, "")
		}

		// Record any errors
		if len(c.Errors) > 0 {
			for _, err := range c.Errors {
				span.RecordError(err.Err)
			}
		}
	}
}

// InjectTraceContext injects the current trace context into outgoing HTTP headers
func InjectTraceContext(c *gin.Context) map[string]string {
	headers := make(map[string]string)
	propagator := otel.GetTextMapPropagator()
	propagator.Inject(c.Request.Context(), propagation.MapCarrier(headers))
	return headers
}

// TraceVerifyHandler wraps verify handling with tracing
func TraceVerifyHandler(next gin.HandlerFunc) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, span := StartSpan(c.Request.Context(), "verify-payment")
		defer span.End()

		span.SetAttributes(AttrAction.String("verify"))
		c.Request = c.Request.WithContext(ctx)

		next(c)

		// Add result attributes from context if set
		if network := c.GetString("network"); network != "" {
			span.SetAttributes(AttrNetwork.String(network))
		}
		if scheme := c.GetString("scheme"); scheme != "" {
			span.SetAttributes(AttrScheme.String(scheme))
		}
		if isValid, exists := c.Get("is_valid"); exists {
			if v, ok := isValid.(bool); ok {
				span.SetAttributes(AttrIsValid.Bool(v))
			}
		}
	}
}

// TraceSettleHandler wraps settle handling with tracing
func TraceSettleHandler(next gin.HandlerFunc) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, span := StartSpan(c.Request.Context(), "settle-payment")
		defer span.End()

		span.SetAttributes(AttrAction.String("settle"))
		c.Request = c.Request.WithContext(ctx)

		next(c)

		// Add result attributes from context if set
		if network := c.GetString("network"); network != "" {
			span.SetAttributes(AttrNetwork.String(network))
		}
		if scheme := c.GetString("scheme"); scheme != "" {
			span.SetAttributes(AttrScheme.String(scheme))
		}
		if txHash := c.GetString("tx_hash"); txHash != "" {
			span.SetAttributes(AttrTxHash.String(txHash))
		}
	}
}

// SpanAttributes is a helper to create common T402 span attributes
type SpanAttributes struct {
	Network   string
	Scheme    string
	Payer     string
	Payee     string
	Amount    string
	Asset     string
	TxHash    string
	RequestID string
	APIKeyID  string
	IsValid   bool
	Error     error
}

// ToAttributes converts SpanAttributes to OpenTelemetry attributes
func (a SpanAttributes) ToAttributes() []attribute.KeyValue {
	attrs := []attribute.KeyValue{}

	if a.Network != "" {
		attrs = append(attrs, AttrNetwork.String(a.Network))
	}
	if a.Scheme != "" {
		attrs = append(attrs, AttrScheme.String(a.Scheme))
	}
	if a.Payer != "" {
		attrs = append(attrs, AttrPayerAddr.String(a.Payer))
	}
	if a.Payee != "" {
		attrs = append(attrs, AttrPayeeAddr.String(a.Payee))
	}
	if a.Amount != "" {
		attrs = append(attrs, AttrAmount.String(a.Amount))
	}
	if a.Asset != "" {
		attrs = append(attrs, AttrAsset.String(a.Asset))
	}
	if a.TxHash != "" {
		attrs = append(attrs, AttrTxHash.String(a.TxHash))
	}
	if a.RequestID != "" {
		attrs = append(attrs, AttrRequestID.String(a.RequestID))
	}
	if a.APIKeyID != "" {
		attrs = append(attrs, AttrAPIKeyID.String(a.APIKeyID))
	}
	attrs = append(attrs, AttrIsValid.Bool(a.IsValid))

	if a.Error != nil {
		attrs = append(attrs, AttrErrorMsg.String(a.Error.Error()))
	}

	return attrs
}
