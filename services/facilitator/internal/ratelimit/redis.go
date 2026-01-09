package ratelimit

import (
	"context"
	"fmt"
	"time"

	"github.com/t402-io/t402/services/facilitator/internal/cache"
)

// RedisLimiter implements rate limiting using Redis
type RedisLimiter struct {
	cache    *cache.Client
	requests int           // Max requests per window
	window   time.Duration // Time window
	prefix   string        // Key prefix
}

// NewRedisLimiter creates a new Redis-based rate limiter
func NewRedisLimiter(cache *cache.Client, requests int, window time.Duration) *RedisLimiter {
	return &RedisLimiter{
		cache:    cache,
		requests: requests,
		window:   window,
		prefix:   "ratelimit:",
	}
}

// Allow checks if a request is allowed for the given key
func (l *RedisLimiter) Allow(ctx context.Context, key string) (bool, Info, error) {
	redisKey := l.prefix + key

	// Increment the counter
	count, err := l.cache.Incr(ctx, redisKey)
	if err != nil {
		return false, Info{}, fmt.Errorf("failed to increment rate limit counter: %w", err)
	}

	// If this is the first request, set the expiry
	if count == 1 {
		if err := l.cache.Expire(ctx, redisKey, l.window); err != nil {
			return false, Info{}, fmt.Errorf("failed to set rate limit expiry: %w", err)
		}
	}

	// Get TTL to calculate reset time
	ttl, err := l.cache.TTL(ctx, redisKey)
	if err != nil {
		ttl = l.window // Default to full window on error
	}

	info := Info{
		Limit:     l.requests,
		Remaining: max(0, l.requests-int(count)),
		Reset:     time.Now().Add(ttl),
	}

	// Check if over limit
	if int(count) > l.requests {
		return false, info, nil
	}

	return true, info, nil
}

// max returns the larger of two integers
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
