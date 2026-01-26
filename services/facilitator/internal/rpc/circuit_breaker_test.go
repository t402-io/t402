package rpc

import (
	"sync"
	"testing"
	"time"
)

func TestCircuitBreakerState_String(t *testing.T) {
	tests := []struct {
		state    CircuitBreakerState
		expected string
	}{
		{StateClosed, "closed"},
		{StateOpen, "open"},
		{StateHalfOpen, "half-open"},
		{CircuitBreakerState(99), "unknown"},
	}

	for _, tt := range tests {
		got := tt.state.String()
		if got != tt.expected {
			t.Errorf("CircuitBreakerState(%d).String() = %s, expected %s", tt.state, got, tt.expected)
		}
	}
}

func TestNewCircuitBreaker(t *testing.T) {
	cb := NewCircuitBreaker(5, 30*time.Second)

	if cb == nil {
		t.Fatal("expected non-nil circuit breaker")
	}
	if cb.state != StateClosed {
		t.Errorf("expected initial state=Closed, got %s", cb.state.String())
	}
	if cb.threshold != 5 {
		t.Errorf("expected threshold=5, got %d", cb.threshold)
	}
	if cb.timeout != 30*time.Second {
		t.Errorf("expected timeout=30s, got %v", cb.timeout)
	}
	if cb.halfOpenMax != 3 {
		t.Errorf("expected halfOpenMax=3, got %d", cb.halfOpenMax)
	}
}

func TestCircuitBreaker_IsAllowed_Closed(t *testing.T) {
	cb := NewCircuitBreaker(5, 30*time.Second)

	// Closed state should always allow
	for i := 0; i < 10; i++ {
		if !cb.IsAllowed() {
			t.Error("closed circuit should allow requests")
		}
	}
}

func TestCircuitBreaker_IsAllowed_Open(t *testing.T) {
	cb := NewCircuitBreaker(2, 1*time.Hour) // Long timeout

	// Cause failures to open the circuit
	cb.RecordFailure()
	cb.RecordFailure()

	if cb.GetState() != StateOpen {
		t.Errorf("expected state=Open, got %s", cb.GetState().String())
	}

	// Open state should block requests
	if cb.IsAllowed() {
		t.Error("open circuit should block requests")
	}
}

func TestCircuitBreaker_IsAllowed_OpenToHalfOpen(t *testing.T) {
	cb := NewCircuitBreaker(2, 1*time.Millisecond) // Very short timeout

	// Open the circuit
	cb.RecordFailure()
	cb.RecordFailure()

	if cb.GetState() != StateOpen {
		t.Errorf("expected state=Open, got %s", cb.GetState().String())
	}

	// Wait for timeout to pass
	time.Sleep(10 * time.Millisecond)

	// Should transition to half-open and allow
	if !cb.IsAllowed() {
		t.Error("should allow after timeout expires")
	}
	if cb.GetState() != StateHalfOpen {
		t.Errorf("expected state=HalfOpen, got %s", cb.GetState().String())
	}
}

func TestCircuitBreaker_IsAllowed_HalfOpen(t *testing.T) {
	cb := NewCircuitBreaker(2, 1*time.Millisecond)

	// Open and transition to half-open
	cb.RecordFailure()
	cb.RecordFailure()
	time.Sleep(10 * time.Millisecond)
	cb.IsAllowed() // Transitions to half-open

	// Half-open should allow
	if !cb.IsAllowed() {
		t.Error("half-open circuit should allow requests")
	}
}

func TestCircuitBreaker_RecordSuccess_Closed(t *testing.T) {
	cb := NewCircuitBreaker(5, 30*time.Second)

	// Record some failures
	cb.RecordFailure()
	cb.RecordFailure()

	// Success should reset failures
	cb.RecordSuccess()

	if cb.failures != 0 {
		t.Errorf("expected failures=0 after success in closed state, got %d", cb.failures)
	}
}

func TestCircuitBreaker_RecordSuccess_HalfOpenToClosed(t *testing.T) {
	cb := NewCircuitBreaker(2, 1*time.Millisecond)

	// Open and transition to half-open
	cb.RecordFailure()
	cb.RecordFailure()
	time.Sleep(10 * time.Millisecond)
	cb.IsAllowed()

	// Record enough successes to close the circuit
	cb.RecordSuccess()
	cb.RecordSuccess()
	cb.RecordSuccess()

	if cb.GetState() != StateClosed {
		t.Errorf("expected state=Closed after %d successes, got %s", cb.halfOpenMax, cb.GetState().String())
	}
}

func TestCircuitBreaker_RecordFailure_ClosedToOpen(t *testing.T) {
	cb := NewCircuitBreaker(3, 30*time.Second)

	// Record failures up to threshold
	cb.RecordFailure()
	if cb.GetState() != StateClosed {
		t.Error("should still be closed after 1 failure")
	}

	cb.RecordFailure()
	if cb.GetState() != StateClosed {
		t.Error("should still be closed after 2 failures")
	}

	cb.RecordFailure()
	if cb.GetState() != StateOpen {
		t.Errorf("should be open after %d failures, got %s", cb.threshold, cb.GetState().String())
	}
}

func TestCircuitBreaker_RecordFailure_HalfOpenToOpen(t *testing.T) {
	cb := NewCircuitBreaker(2, 1*time.Millisecond)

	// Open and transition to half-open
	cb.RecordFailure()
	cb.RecordFailure()
	time.Sleep(10 * time.Millisecond)
	cb.IsAllowed()

	if cb.GetState() != StateHalfOpen {
		t.Errorf("expected state=HalfOpen, got %s", cb.GetState().String())
	}

	// Failure in half-open should return to open
	cb.RecordFailure()
	if cb.GetState() != StateOpen {
		t.Errorf("expected state=Open after failure in half-open, got %s", cb.GetState().String())
	}
}

func TestCircuitBreaker_Reset(t *testing.T) {
	cb := NewCircuitBreaker(2, 30*time.Second)

	// Open the circuit
	cb.RecordFailure()
	cb.RecordFailure()
	if cb.GetState() != StateOpen {
		t.Error("expected circuit to be open")
	}

	// Reset
	cb.Reset()

	if cb.GetState() != StateClosed {
		t.Errorf("expected state=Closed after reset, got %s", cb.GetState().String())
	}
	if cb.failures != 0 {
		t.Errorf("expected failures=0 after reset, got %d", cb.failures)
	}
	if cb.successes != 0 {
		t.Errorf("expected successes=0 after reset, got %d", cb.successes)
	}
}

func TestCircuitBreaker_Concurrent(t *testing.T) {
	cb := NewCircuitBreaker(100, 30*time.Second)
	var wg sync.WaitGroup

	// Concurrent reads and writes
	for i := 0; i < 100; i++ {
		wg.Add(3)
		go func() {
			defer wg.Done()
			cb.IsAllowed()
		}()
		go func() {
			defer wg.Done()
			cb.RecordSuccess()
		}()
		go func() {
			defer wg.Done()
			cb.GetState()
		}()
	}

	wg.Wait()
	// No race conditions = success
}

func TestCircuitBreakerManager_NewCircuitBreakerManager(t *testing.T) {
	config := DefaultConfig()
	manager := NewCircuitBreakerManager(config)

	if manager == nil {
		t.Fatal("expected non-nil manager")
	}
	if manager.breakers == nil {
		t.Error("expected non-nil breakers map")
	}
	if manager.config != config {
		t.Error("expected config to be set")
	}
}

func TestCircuitBreakerManager_IsAllowed_CreatesBreaker(t *testing.T) {
	config := DefaultConfig()
	manager := NewCircuitBreakerManager(config)

	// First call should create a breaker and allow
	allowed := manager.IsAllowed("https://rpc.example.com")
	if !allowed {
		t.Error("expected to be allowed for new URL")
	}

	manager.mu.RLock()
	_, exists := manager.breakers["https://rpc.example.com"]
	manager.mu.RUnlock()

	if !exists {
		t.Error("expected breaker to be created")
	}
}

func TestCircuitBreakerManager_RecordSuccess(t *testing.T) {
	config := DefaultConfig()
	manager := NewCircuitBreakerManager(config)

	url := "https://rpc.example.com"

	// Record a failure first, then success
	manager.RecordFailure(url)
	manager.RecordSuccess(url)

	// Should still be allowed
	if !manager.IsAllowed(url) {
		t.Error("expected to be allowed after success")
	}
}

func TestCircuitBreakerManager_RecordFailure(t *testing.T) {
	config := &Config{
		CircuitBreakerThreshold: 2,
		CircuitBreakerTimeout:   time.Hour,
	}
	manager := NewCircuitBreakerManager(config)

	url := "https://rpc.example.com"

	// Record enough failures to open
	manager.RecordFailure(url)
	manager.RecordFailure(url)

	// Should be blocked
	if manager.IsAllowed(url) {
		t.Error("expected to be blocked after failures")
	}
}

func TestCircuitBreakerManager_GetState(t *testing.T) {
	config := DefaultConfig()
	manager := NewCircuitBreakerManager(config)

	url := "https://rpc.example.com"

	// Unknown URL returns "none"
	state := manager.GetState(url)
	if state != "none" {
		t.Errorf("expected state='none' for unknown URL, got '%s'", state)
	}

	// After creating
	manager.IsAllowed(url)
	state = manager.GetState(url)
	if state != "closed" {
		t.Errorf("expected state='closed', got '%s'", state)
	}
}

func TestCircuitBreakerManager_Reset(t *testing.T) {
	config := &Config{
		CircuitBreakerThreshold: 2,
		CircuitBreakerTimeout:   time.Hour,
	}
	manager := NewCircuitBreakerManager(config)

	url := "https://rpc.example.com"

	// Open the circuit
	manager.RecordFailure(url)
	manager.RecordFailure(url)
	if manager.IsAllowed(url) {
		t.Error("expected circuit to be open")
	}

	// Reset
	manager.Reset(url)

	// Should be allowed now
	if !manager.IsAllowed(url) {
		t.Error("expected to be allowed after reset")
	}
}

func TestCircuitBreakerManager_ResetAll(t *testing.T) {
	config := &Config{
		CircuitBreakerThreshold: 1,
		CircuitBreakerTimeout:   time.Hour,
	}
	manager := NewCircuitBreakerManager(config)

	urls := []string{
		"https://rpc1.example.com",
		"https://rpc2.example.com",
		"https://rpc3.example.com",
	}

	// Open all circuits
	for _, url := range urls {
		manager.RecordFailure(url)
	}

	// All should be blocked
	for _, url := range urls {
		if manager.IsAllowed(url) {
			t.Errorf("expected %s to be blocked", url)
		}
	}

	// Reset all
	manager.ResetAll()

	// All should be allowed
	for _, url := range urls {
		if !manager.IsAllowed(url) {
			t.Errorf("expected %s to be allowed after reset", url)
		}
	}
}

func TestCircuitBreakerManager_Concurrent(t *testing.T) {
	config := DefaultConfig()
	manager := NewCircuitBreakerManager(config)
	var wg sync.WaitGroup

	urls := []string{
		"https://rpc1.example.com",
		"https://rpc2.example.com",
		"https://rpc3.example.com",
	}

	// Concurrent operations
	for i := 0; i < 100; i++ {
		for _, url := range urls {
			wg.Add(4)
			go func(u string) {
				defer wg.Done()
				manager.IsAllowed(u)
			}(url)
			go func(u string) {
				defer wg.Done()
				manager.RecordSuccess(u)
			}(url)
			go func(u string) {
				defer wg.Done()
				manager.RecordFailure(u)
			}(url)
			go func(u string) {
				defer wg.Done()
				manager.GetState(u)
			}(url)
		}
	}

	wg.Wait()
	// No race conditions = success
}

func TestCircuitBreakerManager_Reset_NonExistent(t *testing.T) {
	config := DefaultConfig()
	manager := NewCircuitBreakerManager(config)

	// Should not panic for non-existent URL
	manager.Reset("https://nonexistent.example.com")
}

func BenchmarkCircuitBreaker_IsAllowed(b *testing.B) {
	cb := NewCircuitBreaker(100, 30*time.Second)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		cb.IsAllowed()
	}
}

func BenchmarkCircuitBreaker_RecordSuccess(b *testing.B) {
	cb := NewCircuitBreaker(100, 30*time.Second)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		cb.RecordSuccess()
	}
}

func BenchmarkCircuitBreakerManager_IsAllowed(b *testing.B) {
	config := DefaultConfig()
	manager := NewCircuitBreakerManager(config)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		manager.IsAllowed("https://rpc.example.com")
	}
}
