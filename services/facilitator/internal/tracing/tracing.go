// Package tracing provides OpenTelemetry distributed tracing support.
package tracing

import (
	"context"
	"fmt"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
	"go.opentelemetry.io/otel/trace"
)

// Config holds tracing configuration
type Config struct {
	// Enabled enables tracing
	Enabled bool
	// ServiceName is the name of the service
	ServiceName string
	// ServiceVersion is the version of the service
	ServiceVersion string
	// Environment is the deployment environment (development, staging, production)
	Environment string
	// Endpoint is the OTLP collector endpoint
	Endpoint string
	// Protocol is the OTLP protocol (grpc or http)
	Protocol string
	// Insecure disables TLS for the exporter
	Insecure bool
	// SampleRate is the sampling rate (0.0 to 1.0)
	SampleRate float64
	// Headers are additional headers to send with traces
	Headers map[string]string
}

// DefaultConfig returns default tracing configuration
func DefaultConfig() *Config {
	return &Config{
		Enabled:        false,
		ServiceName:    "facilitator",
		ServiceVersion: "dev",
		Environment:    "development",
		Endpoint:       "localhost:4317",
		Protocol:       "grpc",
		Insecure:       true,
		SampleRate:     1.0,
		Headers:        make(map[string]string),
	}
}

// Provider wraps the OpenTelemetry trace provider
type Provider struct {
	provider *sdktrace.TracerProvider
	config   *Config
}

// NewProvider creates a new tracing provider
func NewProvider(ctx context.Context, cfg *Config) (*Provider, error) {
	if cfg == nil {
		cfg = DefaultConfig()
	}

	if !cfg.Enabled {
		return &Provider{config: cfg}, nil
	}

	// Create exporter based on protocol
	var exporter *otlptrace.Exporter
	var err error

	switch cfg.Protocol {
	case "http":
		opts := []otlptracehttp.Option{
			otlptracehttp.WithEndpoint(cfg.Endpoint),
		}
		if cfg.Insecure {
			opts = append(opts, otlptracehttp.WithInsecure())
		}
		if len(cfg.Headers) > 0 {
			opts = append(opts, otlptracehttp.WithHeaders(cfg.Headers))
		}
		exporter, err = otlptracehttp.New(ctx, opts...)
	default: // grpc
		opts := []otlptracegrpc.Option{
			otlptracegrpc.WithEndpoint(cfg.Endpoint),
		}
		if cfg.Insecure {
			opts = append(opts, otlptracegrpc.WithInsecure())
		}
		if len(cfg.Headers) > 0 {
			opts = append(opts, otlptracegrpc.WithHeaders(cfg.Headers))
		}
		exporter, err = otlptracegrpc.New(ctx, opts...)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to create OTLP exporter: %w", err)
	}

	// Create resource with service info
	res, err := resource.Merge(
		resource.Default(),
		resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceName(cfg.ServiceName),
			semconv.ServiceVersion(cfg.ServiceVersion),
			semconv.DeploymentEnvironment(cfg.Environment),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	// Create sampler
	var sampler sdktrace.Sampler
	if cfg.SampleRate >= 1.0 {
		sampler = sdktrace.AlwaysSample()
	} else if cfg.SampleRate <= 0.0 {
		sampler = sdktrace.NeverSample()
	} else {
		sampler = sdktrace.ParentBased(
			sdktrace.TraceIDRatioBased(cfg.SampleRate),
		)
	}

	// Create trace provider
	tp := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter,
			sdktrace.WithBatchTimeout(5*time.Second),
			sdktrace.WithMaxExportBatchSize(512),
		),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sampler),
	)

	// Set global provider and propagator
	otel.SetTracerProvider(tp)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	return &Provider{
		provider: tp,
		config:   cfg,
	}, nil
}

// Tracer returns a named tracer
func (p *Provider) Tracer(name string) trace.Tracer {
	if p.provider == nil {
		return otel.Tracer(name)
	}
	return p.provider.Tracer(name)
}

// Shutdown gracefully shuts down the provider
func (p *Provider) Shutdown(ctx context.Context) error {
	if p.provider == nil {
		return nil
	}
	return p.provider.Shutdown(ctx)
}

// IsEnabled returns whether tracing is enabled
func (p *Provider) IsEnabled() bool {
	return p.config.Enabled && p.provider != nil
}

// SpanFromContext returns the current span from context
func SpanFromContext(ctx context.Context) trace.Span {
	return trace.SpanFromContext(ctx)
}

// StartSpan starts a new span
func StartSpan(ctx context.Context, name string, opts ...trace.SpanStartOption) (context.Context, trace.Span) {
	return otel.Tracer("facilitator").Start(ctx, name, opts...)
}

// AddSpanAttributes adds attributes to the current span
func AddSpanAttributes(ctx context.Context, attrs ...attribute.KeyValue) {
	span := trace.SpanFromContext(ctx)
	if span.IsRecording() {
		span.SetAttributes(attrs...)
	}
}

// RecordError records an error on the current span
func RecordError(ctx context.Context, err error, opts ...trace.EventOption) {
	span := trace.SpanFromContext(ctx)
	if span.IsRecording() {
		span.RecordError(err, opts...)
	}
}

// SetSpanStatus sets the status of the current span
func SetSpanStatus(ctx context.Context, code trace.SpanKind, description string) {
	// Note: This function signature is for convenience, actual status setting
	// should use codes.Code
}

// Common attribute keys for T402 facilitator
var (
	AttrNetwork     = attribute.Key("t402.network")
	AttrScheme      = attribute.Key("t402.scheme")
	AttrAction      = attribute.Key("t402.action")
	AttrPayerAddr   = attribute.Key("t402.payer")
	AttrPayeeAddr   = attribute.Key("t402.payee")
	AttrAmount      = attribute.Key("t402.amount")
	AttrAsset       = attribute.Key("t402.asset")
	AttrTxHash      = attribute.Key("t402.tx_hash")
	AttrRequestID   = attribute.Key("t402.request_id")
	AttrAPIKeyID    = attribute.Key("t402.api_key_id")
	AttrIsValid     = attribute.Key("t402.is_valid")
	AttrErrorCode   = attribute.Key("t402.error_code")
	AttrErrorMsg    = attribute.Key("t402.error_message")
)
