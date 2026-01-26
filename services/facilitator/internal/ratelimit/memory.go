package ratelimit

import (
	"context"
	"sync"
	"time"
)

// MemoryLimiter implements rate limiting using in-memory storage
// This is a simple sliding window implementation suitable for single-instance deployments
// or as a fallback when Redis is unavailable.
type MemoryLimiter struct {
	requests int           // Max requests per window
	window   time.Duration // Time window
	mu       sync.RWMutex
	buckets  map[string]*bucket
	stopCh   chan struct{}
}

type bucket struct {
	count    int
	windowStart time.Time
}

// NewMemoryLimiter creates a new in-memory rate limiter
func NewMemoryLimiter(requests int, window time.Duration) *MemoryLimiter {
	l := &MemoryLimiter{
		requests: requests,
		window:   window,
		buckets:  make(map[string]*bucket),
		stopCh:   make(chan struct{}),
	}
	// Start cleanup goroutine
	go l.cleanup()
	return l
}

// Allow checks if a request is allowed for the given key
func (l *MemoryLimiter) Allow(ctx context.Context, key string) (bool, Info, error) {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()

	b, exists := l.buckets[key]
	if !exists || now.Sub(b.windowStart) >= l.window {
		// New window
		l.buckets[key] = &bucket{
			count:       1,
			windowStart: now,
		}
		return true, Info{
			Limit:     l.requests,
			Remaining: l.requests - 1,
			Reset:     now.Add(l.window),
		}, nil
	}

	// Existing window - increment counter
	b.count++
	remaining := l.requests - b.count
	if remaining < 0 {
		remaining = 0
	}

	info := Info{
		Limit:     l.requests,
		Remaining: remaining,
		Reset:     b.windowStart.Add(l.window),
	}

	if b.count > l.requests {
		return false, info, nil
	}

	return true, info, nil
}

// cleanup periodically removes expired buckets
func (l *MemoryLimiter) cleanup() {
	ticker := time.NewTicker(l.window)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			l.cleanupExpired()
		case <-l.stopCh:
			return
		}
	}
}

// cleanupExpired removes expired buckets
func (l *MemoryLimiter) cleanupExpired() {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	for key, b := range l.buckets {
		if now.Sub(b.windowStart) >= l.window*2 {
			delete(l.buckets, key)
		}
	}
}

// Stop stops the cleanup goroutine
func (l *MemoryLimiter) Stop() {
	close(l.stopCh)
}

// FallbackLimiter wraps a primary limiter with an in-memory fallback
// When the primary limiter fails, it falls back to in-memory limiting
// instead of completely denying or allowing all requests.
type FallbackLimiter struct {
	primary  Limiter
	fallback *MemoryLimiter
	useFallback bool
	mu       sync.RWMutex
}

// NewFallbackLimiter creates a new fallback limiter
func NewFallbackLimiter(primary Limiter, requests int, window time.Duration) *FallbackLimiter {
	return &FallbackLimiter{
		primary:  primary,
		fallback: NewMemoryLimiter(requests, window),
	}
}

// Allow checks if a request is allowed, falling back to in-memory on error
func (l *FallbackLimiter) Allow(ctx context.Context, key string) (bool, Info, error) {
	allowed, info, err := l.primary.Allow(ctx, key)
	if err != nil {
		// Primary failed - use in-memory fallback
		// This maintains rate limiting even during Redis outages
		l.mu.Lock()
		l.useFallback = true
		l.mu.Unlock()

		return l.fallback.Allow(ctx, key)
	}

	// Primary succeeded - reset fallback flag
	l.mu.Lock()
	l.useFallback = false
	l.mu.Unlock()

	return allowed, info, nil
}

// IsFallbackActive returns true if the fallback limiter is currently being used
func (l *FallbackLimiter) IsFallbackActive() bool {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.useFallback
}

// Stop stops the fallback limiter's cleanup goroutine
func (l *FallbackLimiter) Stop() {
	l.fallback.Stop()
}
