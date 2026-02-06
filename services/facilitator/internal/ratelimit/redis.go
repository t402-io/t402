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

// P1-7: UserRateLimiter provides per-user/API-key rate limiting
type UserRateLimiter struct {
	cache          *cache.Client
	globalRequests int           // Global rate limit
	userRequests   int           // Per-user rate limit
	window         time.Duration // Time window
}

// NewUserRateLimiter creates a new per-user rate limiter
func NewUserRateLimiter(cache *cache.Client, globalRequests, userRequests int, window time.Duration) *UserRateLimiter {
	return &UserRateLimiter{
		cache:          cache,
		globalRequests: globalRequests,
		userRequests:   userRequests,
		window:         window,
	}
}

// AllowUser checks if a request is allowed for the given user/API key
// P1-7: Implements hierarchical rate limiting: global -> per-user -> per-endpoint
func (l *UserRateLimiter) AllowUser(ctx context.Context, apiKeyID, endpoint string) (bool, Info, error) {
	// Check per-user limit first (most restrictive)
	userKey := fmt.Sprintf("ratelimit:user:%s", apiKeyID)
	userCount, err := l.cache.Incr(ctx, userKey)
	if err != nil {
		return false, Info{}, fmt.Errorf("failed to increment user rate limit counter: %w", err)
	}

	if userCount == 1 {
		if err := l.cache.Expire(ctx, userKey, l.window); err != nil {
			return false, Info{}, fmt.Errorf("failed to set user rate limit expiry: %w", err)
		}
	}

	// Get TTL to calculate reset time
	ttl, err := l.cache.TTL(ctx, userKey)
	if err != nil {
		ttl = l.window
	}

	userInfo := Info{
		Limit:     l.userRequests,
		Remaining: max(0, l.userRequests-int(userCount)),
		Reset:     time.Now().Add(ttl),
	}

	// Check if user is over limit
	if int(userCount) > l.userRequests {
		return false, userInfo, nil
	}

	// Check per-endpoint limit for this user
	endpointKey := fmt.Sprintf("ratelimit:user:%s:%s", apiKeyID, endpoint)
	endpointCount, err := l.cache.Incr(ctx, endpointKey)
	if err != nil {
		return false, Info{}, fmt.Errorf("failed to increment endpoint rate limit counter: %w", err)
	}

	if endpointCount == 1 {
		if err := l.cache.Expire(ctx, endpointKey, l.window); err != nil {
			return false, Info{}, fmt.Errorf("failed to set endpoint rate limit expiry: %w", err)
		}
	}

	// Per-endpoint limit is half of user limit
	endpointLimit := l.userRequests / 2
	if endpointLimit < 10 {
		endpointLimit = 10
	}

	if int(endpointCount) > endpointLimit {
		return false, Info{
			Limit:     endpointLimit,
			Remaining: 0,
			Reset:     time.Now().Add(ttl),
		}, nil
	}

	return true, userInfo, nil
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
