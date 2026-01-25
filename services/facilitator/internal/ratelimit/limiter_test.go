package ratelimit

import (
	"context"
	"testing"
	"time"

	"github.com/t402-io/t402/services/facilitator/internal/cache"
)

// MockCache implements cache operations for testing
type MockCache struct {
	IncrFunc   func(ctx context.Context, key string) (int64, error)
	ExpireFunc func(ctx context.Context, key string, ttl time.Duration) error
	TTLFunc    func(ctx context.Context, key string) (time.Duration, error)
	counter    int64
}

func (m *MockCache) Get(ctx context.Context, key string) (string, error) {
	return "", nil
}

func (m *MockCache) Set(ctx context.Context, key string, value interface{}, ttl time.Duration) error {
	return nil
}

func (m *MockCache) Incr(ctx context.Context, key string) (int64, error) {
	if m.IncrFunc != nil {
		return m.IncrFunc(ctx, key)
	}
	m.counter++
	return m.counter, nil
}

func (m *MockCache) Expire(ctx context.Context, key string, ttl time.Duration) error {
	if m.ExpireFunc != nil {
		return m.ExpireFunc(ctx, key, ttl)
	}
	return nil
}

func (m *MockCache) TTL(ctx context.Context, key string) (time.Duration, error) {
	if m.TTLFunc != nil {
		return m.TTLFunc(ctx, key)
	}
	return time.Minute, nil
}

func (m *MockCache) Delete(ctx context.Context, keys ...string) error {
	return nil
}

func (m *MockCache) Exists(ctx context.Context, key string) (bool, error) {
	return false, nil
}

func (m *MockCache) Ping(ctx context.Context) error {
	return nil
}

func (m *MockCache) Close() error {
	return nil
}

// wrapMockCache wraps MockCache to satisfy the *cache.Client pointer expectation
// by embedding the mock functionality
type wrappedMockCache struct {
	mock *MockCache
}

func TestInfo(t *testing.T) {
	now := time.Now()
	info := Info{
		Limit:     100,
		Remaining: 50,
		Reset:     now.Add(time.Minute),
	}

	if info.Limit != 100 {
		t.Errorf("expected Limit=100, got %d", info.Limit)
	}
	if info.Remaining != 50 {
		t.Errorf("expected Remaining=50, got %d", info.Remaining)
	}
	if info.Reset.Before(now) {
		t.Error("expected Reset to be in the future")
	}
}

func TestNewRedisLimiter(t *testing.T) {
	limiter := NewRedisLimiter(nil, 100, time.Minute)

	if limiter == nil {
		t.Fatal("expected non-nil limiter")
	}
	if limiter.requests != 100 {
		t.Errorf("expected requests=100, got %d", limiter.requests)
	}
	if limiter.window != time.Minute {
		t.Errorf("expected window=1m, got %v", limiter.window)
	}
	if limiter.prefix != "ratelimit:" {
		t.Errorf("expected prefix=ratelimit:, got %s", limiter.prefix)
	}
}

func TestNewRedisLimiter_DifferentConfigs(t *testing.T) {
	tests := []struct {
		name     string
		requests int
		window   time.Duration
	}{
		{"low limit", 10, time.Second * 30},
		{"high limit", 10000, time.Hour},
		{"zero limit", 0, time.Minute},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			limiter := NewRedisLimiter(nil, tt.requests, tt.window)

			if limiter.requests != tt.requests {
				t.Errorf("expected requests=%d, got %d", tt.requests, limiter.requests)
			}
			if limiter.window != tt.window {
				t.Errorf("expected window=%v, got %v", tt.window, limiter.window)
			}
		})
	}
}

func TestMax(t *testing.T) {
	tests := []struct {
		a, b     int
		expected int
	}{
		{1, 2, 2},
		{2, 1, 2},
		{0, 0, 0},
		{-1, -2, -1},
		{-1, 1, 1},
		{100, 100, 100},
	}

	for _, tt := range tests {
		got := max(tt.a, tt.b)
		if got != tt.expected {
			t.Errorf("max(%d, %d) = %d, expected %d", tt.a, tt.b, got, tt.expected)
		}
	}
}

// LimiterInterface ensures RedisLimiter implements Limiter interface
func TestLimiterInterface(t *testing.T) {
	var _ Limiter = (*RedisLimiter)(nil)
}

// mockCacheClient creates a cache.Client for testing purposes
// Note: This approach requires type assertion tricks since cache.Client is a concrete type
// For full test coverage of Allow(), the cache package should expose an interface

func TestInfoZeroValues(t *testing.T) {
	info := Info{}

	if info.Limit != 0 {
		t.Errorf("expected Limit=0, got %d", info.Limit)
	}
	if info.Remaining != 0 {
		t.Errorf("expected Remaining=0, got %d", info.Remaining)
	}
	if !info.Reset.IsZero() {
		t.Error("expected Reset to be zero time")
	}
}

func TestInfoNegativeRemaining(t *testing.T) {
	info := Info{
		Limit:     10,
		Remaining: -5, // This could happen if count exceeds limit
	}

	if info.Remaining != -5 {
		t.Errorf("expected Remaining=-5, got %d", info.Remaining)
	}
}

func TestNewRedisLimiter_NilCache(t *testing.T) {
	limiter := NewRedisLimiter(nil, 100, time.Minute)

	if limiter == nil {
		t.Fatal("expected non-nil limiter")
	}
	if limiter.cache != nil {
		t.Error("expected nil cache")
	}
	if limiter.prefix != "ratelimit:" {
		t.Errorf("expected prefix='ratelimit:', got '%s'", limiter.prefix)
	}
}

func TestNewRedisLimiter_VeryShortWindow(t *testing.T) {
	limiter := NewRedisLimiter(nil, 1, time.Millisecond)

	if limiter.window != time.Millisecond {
		t.Errorf("expected window=1ms, got %v", limiter.window)
	}
}

func TestNewRedisLimiter_VeryLongWindow(t *testing.T) {
	limiter := NewRedisLimiter(nil, 1, 24*time.Hour)

	if limiter.window != 24*time.Hour {
		t.Errorf("expected window=24h, got %v", limiter.window)
	}
}

func TestMax_LargeNumbers(t *testing.T) {
	tests := []struct {
		a, b     int
		expected int
	}{
		{1000000, 999999, 1000000},
		{999999, 1000000, 1000000},
		{2147483647, 2147483646, 2147483647}, // Max int32
	}

	for _, tt := range tests {
		got := max(tt.a, tt.b)
		if got != tt.expected {
			t.Errorf("max(%d, %d) = %d, expected %d", tt.a, tt.b, got, tt.expected)
		}
	}
}

// TestRedisLimiterFields verifies the struct fields are set correctly
func TestRedisLimiterFields(t *testing.T) {
	limiter := NewRedisLimiter(nil, 500, 5*time.Minute)

	if limiter.requests != 500 {
		t.Errorf("expected requests=500, got %d", limiter.requests)
	}
	if limiter.window != 5*time.Minute {
		t.Errorf("expected window=5m, got %v", limiter.window)
	}
	if limiter.prefix != "ratelimit:" {
		t.Errorf("expected prefix='ratelimit:', got '%s'", limiter.prefix)
	}
}

// TestAllowWithNilCache documents behavior when cache is nil
// Note: In production, Allow() would panic if called with nil cache
// This test documents that the limiter accepts nil cache during creation
func TestAllowWithNilCacheCreation(t *testing.T) {
	limiter := NewRedisLimiter(nil, 100, time.Minute)

	// Limiter can be created with nil cache
	if limiter == nil {
		t.Fatal("expected non-nil limiter")
	}

	// But calling Allow() with nil cache would cause issues
	// This is expected behavior - the limiter requires a valid cache at runtime
}

// _ is used to satisfy import requirements
var _ = cache.Client{}
