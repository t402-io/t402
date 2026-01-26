package ratelimit

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
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

func TestRedisLimiter_AllowFirstRequest(t *testing.T) {
	// Test that a limiter with no previous requests would allow
	// This documents expected behavior even though we can't test the full Allow()
	// without a real Redis

	limiter := NewRedisLimiter(nil, 100, time.Minute)

	// Verify initial state
	if limiter.requests != 100 {
		t.Errorf("expected requests=100, got %d", limiter.requests)
	}
	if limiter.window != time.Minute {
		t.Errorf("expected window=1m, got %v", limiter.window)
	}
}

func TestInfoReset(t *testing.T) {
	resetTime := time.Now().Add(5 * time.Minute)
	info := Info{
		Limit:     1000,
		Remaining: 500,
		Reset:     resetTime,
	}

	// Verify Reset time is in the future
	if info.Reset.Before(time.Now()) {
		t.Error("expected Reset time to be in the future")
	}

	// Verify time until reset is approximately 5 minutes
	timeUntilReset := time.Until(info.Reset)
	if timeUntilReset < 4*time.Minute || timeUntilReset > 6*time.Minute {
		t.Errorf("expected time until reset ~5m, got %v", timeUntilReset)
	}
}

func TestNewRedisLimiter_ZeroValues(t *testing.T) {
	// Zero requests = effectively unlimited
	limiter := NewRedisLimiter(nil, 0, 0)

	if limiter.requests != 0 {
		t.Errorf("expected requests=0, got %d", limiter.requests)
	}
	if limiter.window != 0 {
		t.Errorf("expected window=0, got %v", limiter.window)
	}
}

func TestRedisLimiterKeyPrefix(t *testing.T) {
	limiter := NewRedisLimiter(nil, 100, time.Minute)

	if limiter.prefix != "ratelimit:" {
		t.Errorf("expected prefix='ratelimit:', got '%s'", limiter.prefix)
	}
}

func TestMaxWithEdgeCases(t *testing.T) {
	tests := []struct {
		name     string
		a, b     int
		expected int
	}{
		{"both zero", 0, 0, 0},
		{"first negative", -1, 0, 0},
		{"both negative", -10, -5, -5},
		{"equal values", 42, 42, 42},
		{"max int", 2147483647, 0, 2147483647},
		{"min int", -2147483648, 0, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := max(tt.a, tt.b)
			if got != tt.expected {
				t.Errorf("max(%d, %d) = %d, expected %d", tt.a, tt.b, got, tt.expected)
			}
		})
	}
}

func TestInfoAllFieldsSet(t *testing.T) {
	now := time.Now()
	info := Info{
		Limit:     100,
		Remaining: 75,
		Reset:     now.Add(30 * time.Second),
	}

	// Verify all fields are accessible and have expected values
	if info.Limit != 100 {
		t.Errorf("Limit = %d, expected 100", info.Limit)
	}
	if info.Remaining != 75 {
		t.Errorf("Remaining = %d, expected 75", info.Remaining)
	}
	if info.Reset.Before(now) {
		t.Error("Reset should be after current time")
	}
}

func TestNewRedisLimiter_NegativeValues(t *testing.T) {
	// Negative values are technically allowed (though not useful)
	limiter := NewRedisLimiter(nil, -1, -time.Second)

	if limiter.requests != -1 {
		t.Errorf("expected requests=-1, got %d", limiter.requests)
	}
	if limiter.window != -time.Second {
		t.Errorf("expected window=-1s, got %v", limiter.window)
	}
}

func TestRedisLimiter_TypeAssertion(t *testing.T) {
	limiter := NewRedisLimiter(nil, 100, time.Minute)

	// Verify the limiter can be used as the Limiter interface
	var iface Limiter = limiter
	if iface == nil {
		t.Error("expected non-nil interface")
	}
}

func BenchmarkMax(b *testing.B) {
	for i := 0; i < b.N; i++ {
		max(i, i+1)
	}
}

// Helper function to create a cache client with miniredis
func newTestCacheClient(t *testing.T) (*cache.Client, *miniredis.Miniredis) {
	t.Helper()

	mr, err := miniredis.Run()
	if err != nil {
		t.Fatalf("Failed to start miniredis: %v", err)
	}

	redisClient := redis.NewClient(&redis.Options{
		Addr: mr.Addr(),
	})

	return cache.NewClientFromRedis(redisClient), mr
}

func TestRedisLimiter_Allow_FirstRequest(t *testing.T) {
	cacheClient, mr := newTestCacheClient(t)
	defer mr.Close()

	limiter := NewRedisLimiter(cacheClient, 100, time.Minute)
	ctx := context.Background()

	allowed, info, err := limiter.Allow(ctx, "client-1")
	if err != nil {
		t.Fatalf("Allow failed: %v", err)
	}

	if !allowed {
		t.Error("First request should be allowed")
	}
	if info.Limit != 100 {
		t.Errorf("Expected Limit=100, got %d", info.Limit)
	}
	if info.Remaining != 99 {
		t.Errorf("Expected Remaining=99, got %d", info.Remaining)
	}
}

func TestRedisLimiter_Allow_MultipleRequests(t *testing.T) {
	cacheClient, mr := newTestCacheClient(t)
	defer mr.Close()

	limiter := NewRedisLimiter(cacheClient, 10, time.Minute)
	ctx := context.Background()

	// Make 5 requests
	for i := 0; i < 5; i++ {
		allowed, info, err := limiter.Allow(ctx, "client-1")
		if err != nil {
			t.Fatalf("Allow failed: %v", err)
		}
		if !allowed {
			t.Errorf("Request %d should be allowed", i+1)
		}
		expectedRemaining := 10 - (i + 1)
		if info.Remaining != expectedRemaining {
			t.Errorf("Request %d: Expected Remaining=%d, got %d", i+1, expectedRemaining, info.Remaining)
		}
	}
}

func TestRedisLimiter_Allow_ExceedsLimit(t *testing.T) {
	cacheClient, mr := newTestCacheClient(t)
	defer mr.Close()

	limiter := NewRedisLimiter(cacheClient, 3, time.Minute)
	ctx := context.Background()

	// Make 3 requests (should be allowed)
	for i := 0; i < 3; i++ {
		allowed, _, err := limiter.Allow(ctx, "client-1")
		if err != nil {
			t.Fatalf("Allow failed: %v", err)
		}
		if !allowed {
			t.Errorf("Request %d should be allowed", i+1)
		}
	}

	// 4th request should be denied
	allowed, info, err := limiter.Allow(ctx, "client-1")
	if err != nil {
		t.Fatalf("Allow failed: %v", err)
	}
	if allowed {
		t.Error("4th request should be denied")
	}
	if info.Remaining != 0 {
		t.Errorf("Expected Remaining=0, got %d", info.Remaining)
	}
}

func TestRedisLimiter_Allow_DifferentClients(t *testing.T) {
	cacheClient, mr := newTestCacheClient(t)
	defer mr.Close()

	limiter := NewRedisLimiter(cacheClient, 2, time.Minute)
	ctx := context.Background()

	// Client 1 makes 2 requests
	for i := 0; i < 2; i++ {
		allowed, _, err := limiter.Allow(ctx, "client-1")
		if err != nil {
			t.Fatalf("Allow failed: %v", err)
		}
		if !allowed {
			t.Error("Client 1 request should be allowed")
		}
	}

	// Client 1's 3rd request should be denied
	allowed, _, err := limiter.Allow(ctx, "client-1")
	if err != nil {
		t.Fatalf("Allow failed: %v", err)
	}
	if allowed {
		t.Error("Client 1's 3rd request should be denied")
	}

	// Client 2 should still be able to make requests
	allowed, info, err := limiter.Allow(ctx, "client-2")
	if err != nil {
		t.Fatalf("Allow failed: %v", err)
	}
	if !allowed {
		t.Error("Client 2's first request should be allowed")
	}
	if info.Remaining != 1 {
		t.Errorf("Expected Remaining=1 for client-2, got %d", info.Remaining)
	}
}

func TestRedisLimiter_Allow_WindowExpiry(t *testing.T) {
	cacheClient, mr := newTestCacheClient(t)
	defer mr.Close()

	// Use 2 seconds window (miniredis requires at least 1 second)
	limiter := NewRedisLimiter(cacheClient, 2, 2*time.Second)
	ctx := context.Background()

	// Make 2 requests
	for i := 0; i < 2; i++ {
		allowed, _, err := limiter.Allow(ctx, "client-1")
		if err != nil {
			t.Fatalf("Allow failed: %v", err)
		}
		if !allowed {
			t.Error("Request should be allowed")
		}
	}

	// 3rd request should be denied
	allowed, _, err := limiter.Allow(ctx, "client-1")
	if err != nil {
		t.Fatalf("Allow failed: %v", err)
	}
	if allowed {
		t.Error("3rd request should be denied")
	}

	// Fast-forward time to expire the window
	mr.FastForward(3 * time.Second)

	// Now requests should be allowed again
	allowed, info, err := limiter.Allow(ctx, "client-1")
	if err != nil {
		t.Fatalf("Allow failed: %v", err)
	}
	if !allowed {
		t.Error("Request should be allowed after window expiry")
	}
	if info.Remaining != 1 {
		t.Errorf("Expected Remaining=1 after reset, got %d", info.Remaining)
	}
}

func TestRedisLimiter_Allow_ResetTime(t *testing.T) {
	cacheClient, mr := newTestCacheClient(t)
	defer mr.Close()

	limiter := NewRedisLimiter(cacheClient, 10, time.Minute)
	ctx := context.Background()

	before := time.Now()
	_, info, err := limiter.Allow(ctx, "client-1")
	after := time.Now()

	if err != nil {
		t.Fatalf("Allow failed: %v", err)
	}

	// Reset time should be approximately 1 minute from now
	expectedReset := before.Add(time.Minute)
	if info.Reset.Before(before) {
		t.Error("Reset time should be after request time")
	}
	if info.Reset.After(after.Add(2 * time.Minute)) {
		t.Error("Reset time should be within reasonable range")
	}
	t.Logf("Reset time: %v, expected around: %v", info.Reset, expectedReset)
}

func TestRedisLimiter_Allow_ZeroRemaining(t *testing.T) {
	cacheClient, mr := newTestCacheClient(t)
	defer mr.Close()

	limiter := NewRedisLimiter(cacheClient, 1, time.Minute)
	ctx := context.Background()

	// First request
	allowed, info, err := limiter.Allow(ctx, "client-1")
	if err != nil {
		t.Fatalf("Allow failed: %v", err)
	}
	if !allowed {
		t.Error("First request should be allowed")
	}
	if info.Remaining != 0 {
		t.Errorf("Expected Remaining=0 after first request with limit=1, got %d", info.Remaining)
	}
}

func TestRedisLimiter_Allow_ConcurrentRequests(t *testing.T) {
	cacheClient, mr := newTestCacheClient(t)
	defer mr.Close()

	limiter := NewRedisLimiter(cacheClient, 100, time.Minute)
	ctx := context.Background()

	done := make(chan bool, 50)
	allowedCount := 0
	var mu = make(chan int, 1)
	mu <- 0

	// Make 50 concurrent requests
	for i := 0; i < 50; i++ {
		go func() {
			allowed, _, err := limiter.Allow(ctx, "client-1")
			if err != nil {
				t.Errorf("Allow failed: %v", err)
			}
			if allowed {
				<-mu
				allowedCount++
				mu <- 0
			}
			done <- true
		}()
	}

	// Wait for all goroutines
	for i := 0; i < 50; i++ {
		<-done
	}
	<-mu

	// All 50 should be allowed since limit is 100
	if allowedCount != 50 {
		t.Errorf("Expected 50 allowed requests, got %d", allowedCount)
	}
}

func TestRedisLimiter_Allow_KeyPrefix(t *testing.T) {
	cacheClient, mr := newTestCacheClient(t)
	defer mr.Close()

	limiter := NewRedisLimiter(cacheClient, 10, time.Minute)
	ctx := context.Background()

	// Make a request
	limiter.Allow(ctx, "192.168.1.1")

	// Check that the key in Redis has the correct prefix
	keys := mr.Keys()
	found := false
	for _, key := range keys {
		if key == "ratelimit:192.168.1.1" {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("Expected key 'ratelimit:192.168.1.1', found keys: %v", keys)
	}
}

func TestRedisLimiter_Allow_NegativeRemaining(t *testing.T) {
	cacheClient, mr := newTestCacheClient(t)
	defer mr.Close()

	limiter := NewRedisLimiter(cacheClient, 2, time.Minute)
	ctx := context.Background()

	// Exhaust the limit
	for i := 0; i < 2; i++ {
		limiter.Allow(ctx, "client-1")
	}

	// Make more requests beyond the limit
	for i := 0; i < 3; i++ {
		allowed, info, err := limiter.Allow(ctx, "client-1")
		if err != nil {
			t.Fatalf("Allow failed: %v", err)
		}
		if allowed {
			t.Error("Request should be denied")
		}
		// Remaining should be 0, not negative (due to max(0, ...) in code)
		if info.Remaining != 0 {
			t.Errorf("Expected Remaining=0, got %d", info.Remaining)
		}
	}
}

func TestRedisLimiter_Allow_LargeLimit(t *testing.T) {
	cacheClient, mr := newTestCacheClient(t)
	defer mr.Close()

	limiter := NewRedisLimiter(cacheClient, 1000000, time.Minute)
	ctx := context.Background()

	allowed, info, err := limiter.Allow(ctx, "client-1")
	if err != nil {
		t.Fatalf("Allow failed: %v", err)
	}
	if !allowed {
		t.Error("Request should be allowed")
	}
	if info.Limit != 1000000 {
		t.Errorf("Expected Limit=1000000, got %d", info.Limit)
	}
	if info.Remaining != 999999 {
		t.Errorf("Expected Remaining=999999, got %d", info.Remaining)
	}
}

func TestRedisLimiter_Allow_EmptyKey(t *testing.T) {
	cacheClient, mr := newTestCacheClient(t)
	defer mr.Close()

	limiter := NewRedisLimiter(cacheClient, 10, time.Minute)
	ctx := context.Background()

	// Empty key should still work (though not recommended in practice)
	allowed, _, err := limiter.Allow(ctx, "")
	if err != nil {
		t.Fatalf("Allow failed: %v", err)
	}
	if !allowed {
		t.Error("Request with empty key should be allowed")
	}
}

func TestRedisLimiter_Allow_SpecialCharactersInKey(t *testing.T) {
	cacheClient, mr := newTestCacheClient(t)
	defer mr.Close()

	limiter := NewRedisLimiter(cacheClient, 10, time.Minute)
	ctx := context.Background()

	keys := []string{
		"192.168.1.1",
		"user@example.com",
		"api-key-123",
		"client:with:colons",
		"key with spaces",
	}

	for _, key := range keys {
		allowed, _, err := limiter.Allow(ctx, key)
		if err != nil {
			t.Errorf("Allow failed for key '%s': %v", key, err)
		}
		if !allowed {
			t.Errorf("Request for key '%s' should be allowed", key)
		}
	}
}

func TestRedisLimiter_Allow_ContextTimeout(t *testing.T) {
	cacheClient, mr := newTestCacheClient(t)
	defer mr.Close()

	limiter := NewRedisLimiter(cacheClient, 10, time.Minute)

	// Create a context that's already cancelled
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, _, err := limiter.Allow(ctx, "client-1")
	if err == nil {
		t.Error("Expected error with cancelled context")
	}
}
