// Package providers implements RPC provider failover with automatic retry.
//
// Usage:
//
//	client := providers.NewFailoverClient([]string{
//	    "https://base-rpc.example.com",     // Primary
//	    "https://base.publicnode.com",       // Fallback 1
//	    "https://base.drpc.org",             // Fallback 2
//	})
//	result, err := client.Call(ctx, "eth_getBalance", params)
package providers

import (
	"context"
	"errors"
	"sync"
	"time"
)

// ErrAllProvidersFailed is returned when all RPC providers have failed.
var ErrAllProvidersFailed = errors.New("all RPC providers failed")

// RPCCaller is the interface for making RPC calls.
type RPCCaller interface {
	Call(ctx context.Context, method string, params ...interface{}) (interface{}, error)
}

// FailoverConfig configures the failover client.
type FailoverConfig struct {
	// Maximum retries per provider before moving to next
	MaxRetriesPerProvider int
	// Delay between retries (exponential backoff base)
	RetryDelay time.Duration
	// Circuit breaker: fail count before marking provider unhealthy
	CircuitBreakerThreshold int
	// Recovery time before retrying an unhealthy provider
	CircuitBreakerRecovery time.Duration
}

// DefaultConfig returns sensible defaults.
func DefaultConfig() FailoverConfig {
	return FailoverConfig{
		MaxRetriesPerProvider:   2,
		RetryDelay:              100 * time.Millisecond,
		CircuitBreakerThreshold: 5,
		CircuitBreakerRecovery:  30 * time.Second,
	}
}

type providerState struct {
	url          string
	failCount    int
	lastFailure  time.Time
	isHealthy    bool
}

// FailoverClient wraps multiple RPC providers with automatic failover.
type FailoverClient struct {
	mu        sync.RWMutex
	providers []*providerState
	config    FailoverConfig
	callFunc  func(ctx context.Context, url string, method string, params ...interface{}) (interface{}, error)
}

// NewFailoverClient creates a client that tries providers in order.
// callFunc is the actual RPC call implementation.
func NewFailoverClient(
	urls []string,
	callFunc func(ctx context.Context, url string, method string, params ...interface{}) (interface{}, error),
	configs ...FailoverConfig,
) *FailoverClient {
	config := DefaultConfig()
	if len(configs) > 0 {
		config = configs[0]
	}

	providers := make([]*providerState, len(urls))
	for i, url := range urls {
		providers[i] = &providerState{url: url, isHealthy: true}
	}

	return &FailoverClient{
		providers: providers,
		config:    config,
		callFunc:  callFunc,
	}
}

// Call makes an RPC call, trying providers in order with failover.
func (c *FailoverClient) Call(ctx context.Context, method string, params ...interface{}) (interface{}, error) {
	var lastErr error

	for _, provider := range c.getHealthyProviders() {
		for attempt := 0; attempt <= c.config.MaxRetriesPerProvider; attempt++ {
			if attempt > 0 {
				delay := c.config.RetryDelay * time.Duration(1<<(attempt-1))
				select {
				case <-ctx.Done():
					return nil, ctx.Err()
				case <-time.After(delay):
				}
			}

			result, err := c.callFunc(ctx, provider.url, method, params...)
			if err == nil {
				c.recordSuccess(provider.url)
				return result, nil
			}
			lastErr = err
		}

		c.recordFailure(provider.url)
	}

	if lastErr != nil {
		return nil, lastErr
	}
	return nil, ErrAllProvidersFailed
}

// HealthStatus returns the health of each provider.
func (c *FailoverClient) HealthStatus() map[string]bool {
	c.mu.RLock()
	defer c.mu.RUnlock()

	status := make(map[string]bool, len(c.providers))
	for _, p := range c.providers {
		status[p.url] = p.isHealthy
	}
	return status
}

func (c *FailoverClient) getHealthyProviders() []*providerState {
	c.mu.RLock()
	defer c.mu.RUnlock()

	now := time.Now()
	healthy := make([]*providerState, 0, len(c.providers))

	for _, p := range c.providers {
		if p.isHealthy || now.Sub(p.lastFailure) > c.config.CircuitBreakerRecovery {
			healthy = append(healthy, p)
		}
	}

	// If all unhealthy, try all (last resort)
	if len(healthy) == 0 {
		return c.providers
	}
	return healthy
}

func (c *FailoverClient) recordSuccess(url string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, p := range c.providers {
		if p.url == url {
			p.failCount = 0
			p.isHealthy = true
			return
		}
	}
}

func (c *FailoverClient) recordFailure(url string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, p := range c.providers {
		if p.url == url {
			p.failCount++
			p.lastFailure = time.Now()
			if p.failCount >= c.config.CircuitBreakerThreshold {
				p.isHealthy = false
			}
			return
		}
	}
}
