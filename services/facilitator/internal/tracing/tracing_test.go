package tracing

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/attribute"
)

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig()
	assert.False(t, cfg.Enabled)
	assert.Equal(t, "facilitator", cfg.ServiceName)
	assert.Equal(t, "dev", cfg.ServiceVersion)
	assert.Equal(t, "development", cfg.Environment)
	assert.Equal(t, "localhost:4317", cfg.Endpoint)
	assert.Equal(t, "grpc", cfg.Protocol)
	assert.True(t, cfg.Insecure)
	assert.Equal(t, 1.0, cfg.SampleRate)
}

func TestNewProvider_Disabled(t *testing.T) {
	cfg := &Config{Enabled: false}
	provider, err := NewProvider(context.Background(), cfg)
	require.NoError(t, err)
	assert.NotNil(t, provider)
	assert.False(t, provider.IsEnabled())
}

func TestNewProvider_NilConfig(t *testing.T) {
	provider, err := NewProvider(context.Background(), nil)
	require.NoError(t, err)
	assert.NotNil(t, provider)
	assert.False(t, provider.IsEnabled())
}

func TestProvider_Tracer(t *testing.T) {
	provider, err := NewProvider(context.Background(), nil)
	require.NoError(t, err)

	tracer := provider.Tracer("test")
	assert.NotNil(t, tracer)
}

func TestProvider_Shutdown(t *testing.T) {
	provider, err := NewProvider(context.Background(), nil)
	require.NoError(t, err)

	err = provider.Shutdown(context.Background())
	assert.NoError(t, err)
}

func TestSpanAttributes_ToAttributes(t *testing.T) {
	tests := []struct {
		name     string
		attrs    SpanAttributes
		expected int // number of attributes
	}{
		{
			name:     "empty attributes",
			attrs:    SpanAttributes{},
			expected: 1, // IsValid is always included
		},
		{
			name: "full attributes",
			attrs: SpanAttributes{
				Network:   "eip155:1",
				Scheme:    "exact",
				Payer:     "0x1234",
				Payee:     "0x5678",
				Amount:    "1000000",
				Asset:     "USDT",
				TxHash:    "0xabcd",
				RequestID: "req-123",
				APIKeyID:  "key-456",
				IsValid:   true,
			},
			expected: 10,
		},
		{
			name: "with error",
			attrs: SpanAttributes{
				Network: "eip155:1",
				Error:   assert.AnError,
			},
			expected: 3, // Network + IsValid + ErrorMsg
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			attrs := tt.attrs.ToAttributes()
			assert.Len(t, attrs, tt.expected)
		})
	}
}

func TestAttributeKeys(t *testing.T) {
	// Verify attribute keys are defined correctly
	assert.Equal(t, attribute.Key("t402.network"), AttrNetwork)
	assert.Equal(t, attribute.Key("t402.scheme"), AttrScheme)
	assert.Equal(t, attribute.Key("t402.action"), AttrAction)
	assert.Equal(t, attribute.Key("t402.payer"), AttrPayerAddr)
	assert.Equal(t, attribute.Key("t402.payee"), AttrPayeeAddr)
	assert.Equal(t, attribute.Key("t402.amount"), AttrAmount)
	assert.Equal(t, attribute.Key("t402.asset"), AttrAsset)
	assert.Equal(t, attribute.Key("t402.tx_hash"), AttrTxHash)
	assert.Equal(t, attribute.Key("t402.request_id"), AttrRequestID)
	assert.Equal(t, attribute.Key("t402.api_key_id"), AttrAPIKeyID)
	assert.Equal(t, attribute.Key("t402.is_valid"), AttrIsValid)
	assert.Equal(t, attribute.Key("t402.error_code"), AttrErrorCode)
	assert.Equal(t, attribute.Key("t402.error_message"), AttrErrorMsg)
}

func TestStartSpan(t *testing.T) {
	ctx := context.Background()
	newCtx, span := StartSpan(ctx, "test-span")
	assert.NotNil(t, newCtx)
	assert.NotNil(t, span)
	span.End()
}

func TestSpanFromContext(t *testing.T) {
	ctx := context.Background()
	span := SpanFromContext(ctx)
	assert.NotNil(t, span)
}

func TestAddSpanAttributes(t *testing.T) {
	ctx := context.Background()
	// This should not panic even with no active span
	AddSpanAttributes(ctx, AttrNetwork.String("eip155:1"))
}

func TestRecordError(t *testing.T) {
	ctx := context.Background()
	// This should not panic even with no active span
	RecordError(ctx, assert.AnError)
}

func TestDefaultMiddlewareConfig(t *testing.T) {
	cfg := DefaultMiddlewareConfig()
	assert.Equal(t, "facilitator-http", cfg.TracerName)
	assert.Contains(t, cfg.SkipPaths, "/health")
	assert.Contains(t, cfg.SkipPaths, "/ready")
	assert.Contains(t, cfg.SkipPaths, "/metrics")
	assert.NotNil(t, cfg.SpanNameFormatter)
}
