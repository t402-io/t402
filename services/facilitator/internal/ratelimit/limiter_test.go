package ratelimit

import (
	"testing"
	"time"
)

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
