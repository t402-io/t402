package ratelimit

import (
	"context"
	"time"
)

// Info contains rate limit information for a request
type Info struct {
	Limit     int       // Maximum requests allowed
	Remaining int       // Remaining requests in window
	Reset     time.Time // When the limit resets
}

// Limiter is the interface for rate limiting
type Limiter interface {
	// Allow checks if a request is allowed for the given key
	// Returns whether the request is allowed and rate limit info
	Allow(ctx context.Context, key string) (bool, Info, error)
}
