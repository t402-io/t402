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
	windowSeconds := int(l.window.Seconds())

	// Check per-user limit first (most restrictive) — atomic INCR+EXPIRE
	userKey := fmt.Sprintf("ratelimit:user:%s", apiKeyID)
	result, err := l.cache.Eval(ctx, rateLimitScript, []string{userKey}, windowSeconds)
	if err != nil {
		return false, Info{}, fmt.Errorf("failed to execute user rate limit script: %w", err)
	}

	results, ok := result.([]interface{})
	if !ok || len(results) != 2 {
		return false, Info{}, fmt.Errorf("unexpected user rate limit script result: %v", result)
	}

	userCount, _ := results[0].(int64)
	ttlSeconds, _ := results[1].(int64)
	ttl := time.Duration(ttlSeconds) * time.Second
	if ttl <= 0 {
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

	// Check per-endpoint limit for this user — atomic INCR+EXPIRE
	endpointKey := fmt.Sprintf("ratelimit:user:%s:%s", apiKeyID, endpoint)
	result, err = l.cache.Eval(ctx, rateLimitScript, []string{endpointKey}, windowSeconds)
	if err != nil {
		return false, Info{}, fmt.Errorf("failed to execute endpoint rate limit script: %w", err)
	}

	results, ok = result.([]interface{})
	if !ok || len(results) != 2 {
		return false, Info{}, fmt.Errorf("unexpected endpoint rate limit script result: %v", result)
	}

	endpointCount, _ := results[0].(int64)

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

// rateLimitScript atomically increments a counter and sets expiry on first increment.
// This prevents a race condition where INCR succeeds but EXPIRE fails (e.g., process crash),
// which would leave the key without a TTL, permanently blocking the rate-limited key.
// Returns: [count, ttl_seconds]
const rateLimitScript = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
    redis.call("EXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("TTL", KEYS[1])
return {count, ttl}
`

// Allow checks if a request is allowed for the given key
func (l *RedisLimiter) Allow(ctx context.Context, key string) (bool, Info, error) {
	redisKey := l.prefix + key
	windowSeconds := int(l.window.Seconds())

	result, err := l.cache.Eval(ctx, rateLimitScript, []string{redisKey}, windowSeconds)
	if err != nil {
		return false, Info{}, fmt.Errorf("failed to execute rate limit script: %w", err)
	}

	// Parse Lua script result [count, ttl]
	results, ok := result.([]interface{})
	if !ok || len(results) != 2 {
		return false, Info{}, fmt.Errorf("unexpected rate limit script result: %v", result)
	}

	count, _ := results[0].(int64)
	ttlSeconds, _ := results[1].(int64)
	ttl := time.Duration(ttlSeconds) * time.Second
	if ttl <= 0 {
		ttl = l.window
	}

	info := Info{
		Limit:     l.requests,
		Remaining: max(0, l.requests-int(count)),
		Reset:     time.Now().Add(ttl),
	}

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
