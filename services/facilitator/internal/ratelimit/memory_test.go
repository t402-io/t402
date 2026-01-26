package ratelimit

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMemoryLimiter_Allow(t *testing.T) {
	limiter := NewMemoryLimiter(3, time.Second)
	defer limiter.Stop()

	ctx := context.Background()
	key := "test-key"

	// First 3 requests should be allowed
	for i := 0; i < 3; i++ {
		allowed, info, err := limiter.Allow(ctx, key)
		require.NoError(t, err)
		assert.True(t, allowed, "request %d should be allowed", i+1)
		assert.Equal(t, 3, info.Limit)
		assert.Equal(t, 3-i-1, info.Remaining)
	}

	// 4th request should be denied
	allowed, info, err := limiter.Allow(ctx, key)
	require.NoError(t, err)
	assert.False(t, allowed)
	assert.Equal(t, 0, info.Remaining)
}

func TestMemoryLimiter_WindowReset(t *testing.T) {
	limiter := NewMemoryLimiter(2, 100*time.Millisecond)
	defer limiter.Stop()

	ctx := context.Background()
	key := "test-key"

	// Use up the limit
	for i := 0; i < 2; i++ {
		allowed, _, err := limiter.Allow(ctx, key)
		require.NoError(t, err)
		assert.True(t, allowed)
	}

	// Should be denied
	allowed, _, err := limiter.Allow(ctx, key)
	require.NoError(t, err)
	assert.False(t, allowed)

	// Wait for window to reset
	time.Sleep(150 * time.Millisecond)

	// Should be allowed again
	allowed, info, err := limiter.Allow(ctx, key)
	require.NoError(t, err)
	assert.True(t, allowed)
	assert.Equal(t, 1, info.Remaining)
}

func TestMemoryLimiter_DifferentKeys(t *testing.T) {
	limiter := NewMemoryLimiter(2, time.Second)
	defer limiter.Stop()

	ctx := context.Background()

	// Use up limit for key1
	for i := 0; i < 2; i++ {
		allowed, _, err := limiter.Allow(ctx, "key1")
		require.NoError(t, err)
		assert.True(t, allowed)
	}

	// key1 should be denied
	allowed, _, err := limiter.Allow(ctx, "key1")
	require.NoError(t, err)
	assert.False(t, allowed)

	// key2 should still be allowed
	allowed, info, err := limiter.Allow(ctx, "key2")
	require.NoError(t, err)
	assert.True(t, allowed)
	assert.Equal(t, 1, info.Remaining)
}

func TestMemoryLimiter_Cleanup(t *testing.T) {
	limiter := NewMemoryLimiter(2, 50*time.Millisecond)
	defer limiter.Stop()

	ctx := context.Background()

	// Create some buckets
	limiter.Allow(ctx, "key1")
	limiter.Allow(ctx, "key2")

	// Wait for cleanup (2x window)
	time.Sleep(150 * time.Millisecond)

	// Trigger cleanup
	limiter.cleanupExpired()

	// Buckets should be cleaned up
	limiter.mu.RLock()
	count := len(limiter.buckets)
	limiter.mu.RUnlock()

	assert.Equal(t, 0, count, "expired buckets should be cleaned up")
}

// mockFailingLimiter always returns an error
type mockFailingLimiter struct{}

func (m *mockFailingLimiter) Allow(ctx context.Context, key string) (bool, Info, error) {
	return false, Info{}, errors.New("redis connection failed")
}

// mockSuccessLimiter always allows requests
type mockSuccessLimiter struct {
	calls int
}

func (m *mockSuccessLimiter) Allow(ctx context.Context, key string) (bool, Info, error) {
	m.calls++
	return true, Info{Limit: 100, Remaining: 99}, nil
}

func TestFallbackLimiter_UsePrimaryWhenAvailable(t *testing.T) {
	primary := &mockSuccessLimiter{}
	fallback := NewFallbackLimiter(primary, 10, time.Second)
	defer fallback.Stop()

	ctx := context.Background()

	allowed, info, err := fallback.Allow(ctx, "test-key")
	require.NoError(t, err)
	assert.True(t, allowed)
	assert.Equal(t, 100, info.Limit) // From primary
	assert.Equal(t, 1, primary.calls)
	assert.False(t, fallback.IsFallbackActive())
}

func TestFallbackLimiter_UseFallbackWhenPrimaryFails(t *testing.T) {
	primary := &mockFailingLimiter{}
	fallback := NewFallbackLimiter(primary, 5, time.Second)
	defer fallback.Stop()

	ctx := context.Background()

	// First request should use fallback
	allowed, info, err := fallback.Allow(ctx, "test-key")
	require.NoError(t, err)
	assert.True(t, allowed)
	assert.Equal(t, 5, info.Limit) // From fallback
	assert.True(t, fallback.IsFallbackActive())

	// Use up the fallback limit
	for i := 0; i < 4; i++ {
		allowed, _, err = fallback.Allow(ctx, "test-key")
		require.NoError(t, err)
	}

	// Should be denied by fallback
	allowed, _, err = fallback.Allow(ctx, "test-key")
	require.NoError(t, err)
	assert.False(t, allowed)
}

func TestFallbackLimiter_RecoverToPrimary(t *testing.T) {
	callCount := 0
	primary := &recoveringLimiter{failUntil: 2, callCount: &callCount}
	fallback := NewFallbackLimiter(primary, 10, time.Second)
	defer fallback.Stop()

	ctx := context.Background()

	// First 2 requests use fallback
	for i := 0; i < 2; i++ {
		allowed, info, err := fallback.Allow(ctx, "test-key")
		require.NoError(t, err)
		assert.True(t, allowed)
		assert.Equal(t, 10, info.Limit) // From fallback
		assert.True(t, fallback.IsFallbackActive())
	}

	// 3rd request should use primary again
	allowed, info, err := fallback.Allow(ctx, "test-key")
	require.NoError(t, err)
	assert.True(t, allowed)
	assert.Equal(t, 100, info.Limit) // From primary
	assert.False(t, fallback.IsFallbackActive())
}

// recoveringLimiter fails for the first N calls then succeeds
type recoveringLimiter struct {
	failUntil int
	callCount *int
}

func (r *recoveringLimiter) Allow(ctx context.Context, key string) (bool, Info, error) {
	*r.callCount++
	if *r.callCount <= r.failUntil {
		return false, Info{}, errors.New("temporarily unavailable")
	}
	return true, Info{Limit: 100, Remaining: 99}, nil
}
