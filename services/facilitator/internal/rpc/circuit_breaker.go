package rpc

import (
	"sync"
	"time"
)

// CircuitBreakerState represents the state of a circuit breaker.
type CircuitBreakerState int

const (
	// StateClosed means the circuit is working normally.
	StateClosed CircuitBreakerState = iota
	// StateOpen means the circuit is broken and requests are blocked.
	StateOpen
	// StateHalfOpen means the circuit is testing if the service is recovered.
	StateHalfOpen
)

func (s CircuitBreakerState) String() string {
	switch s {
	case StateClosed:
		return "closed"
	case StateOpen:
		return "open"
	case StateHalfOpen:
		return "half-open"
	default:
		return "unknown"
	}
}

// CircuitBreaker implements the circuit breaker pattern for an RPC endpoint.
type CircuitBreaker struct {
	state           CircuitBreakerState
	failures        int
	successes       int
	lastFailureTime time.Time
	threshold       int           // Number of failures before opening
	timeout         time.Duration // Time to wait before half-open
	halfOpenMax     int           // Successes needed in half-open to close

	mu sync.RWMutex
}

// NewCircuitBreaker creates a new circuit breaker.
func NewCircuitBreaker(threshold int, timeout time.Duration) *CircuitBreaker {
	return &CircuitBreaker{
		state:       StateClosed,
		threshold:   threshold,
		timeout:     timeout,
		halfOpenMax: 3,
	}
}

// IsAllowed returns true if the circuit breaker allows a request.
func (cb *CircuitBreaker) IsAllowed() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case StateClosed:
		return true
	case StateOpen:
		// Check if timeout has passed
		if time.Since(cb.lastFailureTime) > cb.timeout {
			cb.state = StateHalfOpen
			cb.successes = 0
			return true
		}
		return false
	case StateHalfOpen:
		return true
	default:
		return true
	}
}

// RecordSuccess records a successful request.
func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case StateClosed:
		cb.failures = 0
	case StateHalfOpen:
		cb.successes++
		if cb.successes >= cb.halfOpenMax {
			cb.state = StateClosed
			cb.failures = 0
			cb.successes = 0
		}
	}
}

// RecordFailure records a failed request.
func (cb *CircuitBreaker) RecordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.failures++
	cb.lastFailureTime = time.Now()

	switch cb.state {
	case StateClosed:
		if cb.failures >= cb.threshold {
			cb.state = StateOpen
		}
	case StateHalfOpen:
		cb.state = StateOpen
		cb.successes = 0
	}
}

// GetState returns the current state of the circuit breaker.
func (cb *CircuitBreaker) GetState() CircuitBreakerState {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.state
}

// Reset resets the circuit breaker to closed state.
func (cb *CircuitBreaker) Reset() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.state = StateClosed
	cb.failures = 0
	cb.successes = 0
}

// CircuitBreakerManager manages circuit breakers for multiple endpoints.
type CircuitBreakerManager struct {
	breakers map[string]*CircuitBreaker
	config   *Config

	mu sync.RWMutex
}

// NewCircuitBreakerManager creates a new circuit breaker manager.
func NewCircuitBreakerManager(config *Config) *CircuitBreakerManager {
	return &CircuitBreakerManager{
		breakers: make(map[string]*CircuitBreaker),
		config:   config,
	}
}

// getOrCreate gets or creates a circuit breaker for a URL.
func (m *CircuitBreakerManager) getOrCreate(url string) *CircuitBreaker {
	m.mu.Lock()
	defer m.mu.Unlock()

	if cb, ok := m.breakers[url]; ok {
		return cb
	}

	cb := NewCircuitBreaker(
		m.config.CircuitBreakerThreshold,
		m.config.CircuitBreakerTimeout,
	)
	m.breakers[url] = cb
	return cb
}

// IsAllowed checks if requests to a URL are allowed.
func (m *CircuitBreakerManager) IsAllowed(url string) bool {
	return m.getOrCreate(url).IsAllowed()
}

// RecordSuccess records a successful request to a URL.
func (m *CircuitBreakerManager) RecordSuccess(url string) {
	m.getOrCreate(url).RecordSuccess()
}

// RecordFailure records a failed request to a URL.
func (m *CircuitBreakerManager) RecordFailure(url string) {
	m.getOrCreate(url).RecordFailure()
}

// GetState returns the circuit breaker state for a URL.
func (m *CircuitBreakerManager) GetState(url string) string {
	m.mu.RLock()
	cb, ok := m.breakers[url]
	m.mu.RUnlock()

	if !ok {
		return "none"
	}
	return cb.GetState().String()
}

// Reset resets the circuit breaker for a URL.
func (m *CircuitBreakerManager) Reset(url string) {
	m.mu.RLock()
	cb, ok := m.breakers[url]
	m.mu.RUnlock()

	if ok {
		cb.Reset()
	}
}

// ResetAll resets all circuit breakers.
func (m *CircuitBreakerManager) ResetAll() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, cb := range m.breakers {
		cb.Reset()
	}
}
