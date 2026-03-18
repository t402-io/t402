package providers

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"
)

func mockCallFunc(results map[string]error) func(ctx context.Context, url string, method string, params ...interface{}) (interface{}, error) {
	return func(ctx context.Context, url string, method string, params ...interface{}) (interface{}, error) {
		if err, ok := results[url]; ok && err != nil {
			return nil, err
		}
		return "result-from-" + url, nil
	}
}

func TestFailover_PrimarySuccess(t *testing.T) {
	c := NewFailoverClient(
		[]string{"primary", "fallback"},
		mockCallFunc(map[string]error{}),
	)
	result, err := c.Call(context.Background(), "eth_blockNumber")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != "result-from-primary" {
		t.Errorf("expected primary result, got %v", result)
	}
}

func TestFailover_FallbackOnPrimaryFailure(t *testing.T) {
	c := NewFailoverClient(
		[]string{"primary", "fallback"},
		mockCallFunc(map[string]error{"primary": errors.New("connection refused")}),
	)
	result, err := c.Call(context.Background(), "eth_blockNumber")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result != "result-from-fallback" {
		t.Errorf("expected fallback result, got %v", result)
	}
}

func TestFailover_AllFail(t *testing.T) {
	c := NewFailoverClient(
		[]string{"a", "b"},
		mockCallFunc(map[string]error{
			"a": errors.New("fail"),
			"b": errors.New("fail"),
		}),
	)
	_, err := c.Call(context.Background(), "eth_blockNumber")
	if err == nil {
		t.Error("expected error when all providers fail")
	}
}

func TestFailover_CircuitBreaker(t *testing.T) {
	callCount := atomic.Int32{}
	c := NewFailoverClient(
		[]string{"bad", "good"},
		func(ctx context.Context, url string, method string, params ...interface{}) (interface{}, error) {
			callCount.Add(1)
			if url == "bad" {
				return nil, errors.New("fail")
			}
			return "ok", nil
		},
		FailoverConfig{
			MaxRetriesPerProvider:   0,
			RetryDelay:              time.Millisecond,
			CircuitBreakerThreshold: 2,
			CircuitBreakerRecovery:  time.Hour,
		},
	)

	// First 2 calls trip the circuit breaker on "bad"
	c.Call(context.Background(), "test")
	c.Call(context.Background(), "test")

	// After circuit breaker trips, "bad" should be skipped
	callCount.Store(0)
	c.Call(context.Background(), "test")

	// Should only call "good" (bad is circuit-broken)
	status := c.HealthStatus()
	if status["bad"] {
		t.Error("expected bad provider to be unhealthy")
	}
	if !status["good"] {
		t.Error("expected good provider to be healthy")
	}
}

func TestFailover_ContextCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	c := NewFailoverClient(
		[]string{"slow"},
		func(ctx context.Context, url string, method string, params ...interface{}) (interface{}, error) {
			return nil, errors.New("fail")
		},
		FailoverConfig{
			MaxRetriesPerProvider: 5,
			RetryDelay:            time.Second,
		},
	)

	_, err := c.Call(ctx, "test")
	if err == nil {
		t.Error("expected error on cancelled context")
	}
}

func TestFailover_HealthStatus(t *testing.T) {
	c := NewFailoverClient(
		[]string{"a", "b", "c"},
		mockCallFunc(map[string]error{}),
	)
	status := c.HealthStatus()
	if len(status) != 3 {
		t.Errorf("expected 3 providers, got %d", len(status))
	}
	for _, healthy := range status {
		if !healthy {
			t.Error("all should be healthy initially")
		}
	}
}

func TestDefaultConfig(t *testing.T) {
	cfg := DefaultConfig()
	if cfg.MaxRetriesPerProvider != 2 {
		t.Errorf("expected 2 retries, got %d", cfg.MaxRetriesPerProvider)
	}
	if cfg.CircuitBreakerThreshold != 5 {
		t.Errorf("expected threshold 5, got %d", cfg.CircuitBreakerThreshold)
	}
}
