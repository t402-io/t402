// Package rpc provides RPC provider management with failover support.
package rpc

import (
	"context"
	"errors"
	"sync"
	"time"
)

var (
	// ErrNoHealthyProviders is returned when no healthy RPC providers are available.
	ErrNoHealthyProviders = errors.New("no healthy RPC providers available")
	// ErrProviderNotFound is returned when a provider for a network is not found.
	ErrProviderNotFound = errors.New("provider not found for network")
)

// Provider represents an RPC endpoint with health status.
type Provider struct {
	URL       string
	Network   string
	Priority  int  // Lower is higher priority
	IsHealthy bool
	LastCheck time.Time
	Latency   time.Duration

	mu sync.RWMutex
}

// SetHealthy updates the provider's health status.
func (p *Provider) SetHealthy(healthy bool, latency time.Duration) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.IsHealthy = healthy
	p.Latency = latency
	p.LastCheck = time.Now()
}

// GetHealth returns the provider's health status.
func (p *Provider) GetHealth() (bool, time.Duration, time.Time) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.IsHealthy, p.Latency, p.LastCheck
}

// Manager manages multiple RPC providers with automatic failover.
type Manager struct {
	providers      map[string][]*Provider // network -> providers
	circuitBreaker *CircuitBreakerManager
	healthChecker  *HealthChecker
	config         *Config

	// P1-17: Round-robin index per network for load distribution
	rrIndex map[string]uint64
	rrMu    sync.Mutex

	mu sync.RWMutex
}

// NewManager creates a new RPC provider manager.
func NewManager(config *Config) *Manager {
	m := &Manager{
		providers:      make(map[string][]*Provider),
		circuitBreaker: NewCircuitBreakerManager(config),
		config:         config,
		rrIndex:        make(map[string]uint64),
	}
	m.healthChecker = NewHealthChecker(m, config)
	return m
}

// RegisterProvider adds an RPC provider for a network.
func (m *Manager) RegisterProvider(network, url string, priority int) {
	m.mu.Lock()
	defer m.mu.Unlock()

	provider := &Provider{
		URL:       url,
		Network:   network,
		Priority:  priority,
		IsHealthy: true, // Assume healthy initially
		LastCheck: time.Now(),
	}

	m.providers[network] = append(m.providers[network], provider)

	// Sort by priority (lower first)
	providers := m.providers[network]
	for i := len(providers) - 1; i > 0; i-- {
		if providers[i].Priority < providers[i-1].Priority {
			providers[i], providers[i-1] = providers[i-1], providers[i]
		}
	}
}

// GetProvider returns the best available RPC URL for a network.
// P1-17: Uses round-robin selection among same-priority healthy providers
// to distribute load across multiple endpoints.
func (m *Manager) GetProvider(ctx context.Context, network string) (string, error) {
	m.mu.RLock()
	providers, ok := m.providers[network]
	m.mu.RUnlock()

	if !ok || len(providers) == 0 {
		return "", ErrProviderNotFound
	}

	// P1-4: Collect healthy providers, treating stale health status as unhealthy.
	// If health checker stops running, stale status should not be trusted.
	stalenessThreshold := m.config.HealthCheckInterval * 3
	if stalenessThreshold == 0 {
		stalenessThreshold = 90 * time.Second // default fallback
	}
	healthyByPriority := make(map[int][]*Provider)
	for _, p := range providers {
		healthy, _, lastCheck := p.GetHealth()
		isStale := time.Since(lastCheck) > stalenessThreshold
		if healthy && !isStale && m.circuitBreaker.IsAllowed(p.URL) {
			healthyByPriority[p.Priority] = append(healthyByPriority[p.Priority], p)
		}
	}

	// Find the lowest (best) priority that has healthy providers
	if len(healthyByPriority) > 0 {
		bestPriority := -1
		for priority := range healthyByPriority {
			if bestPriority == -1 || priority < bestPriority {
				bestPriority = priority
			}
		}

		candidates := healthyByPriority[bestPriority]
		if len(candidates) == 1 {
			return candidates[0].URL, nil
		}

		// Round-robin among candidates at the same priority level
		m.rrMu.Lock()
		idx := m.rrIndex[network]
		m.rrIndex[network] = idx + 1
		m.rrMu.Unlock()

		selected := candidates[idx%uint64(len(candidates))]
		return selected.URL, nil
	}

	// If all providers are unhealthy, try the first one anyway
	// (it might have recovered)
	return providers[0].URL, ErrNoHealthyProviders
}

// GetAllProviders returns all providers for a network.
func (m *Manager) GetAllProviders(network string) []*Provider {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.providers[network]
}

// ReportFailure reports a failure for a provider URL.
func (m *Manager) ReportFailure(url string) {
	m.circuitBreaker.RecordFailure(url)
}

// ReportSuccess reports a success for a provider URL.
func (m *Manager) ReportSuccess(url string) {
	m.circuitBreaker.RecordSuccess(url)
}

// StartHealthChecks starts periodic health checking.
func (m *Manager) StartHealthChecks(ctx context.Context) {
	m.healthChecker.Start(ctx)
}

// GetNetworks returns all registered networks.
func (m *Manager) GetNetworks() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	networks := make([]string, 0, len(m.providers))
	for network := range m.providers {
		networks = append(networks, network)
	}
	return networks
}

// GetStats returns statistics for all providers.
func (m *Manager) GetStats() map[string][]ProviderStats {
	m.mu.RLock()
	defer m.mu.RUnlock()

	stats := make(map[string][]ProviderStats)
	for network, providers := range m.providers {
		for _, p := range providers {
			healthy, latency, lastCheck := p.GetHealth()
			cbState := m.circuitBreaker.GetState(p.URL)
			stats[network] = append(stats[network], ProviderStats{
				URL:                p.URL,
				Priority:           p.Priority,
				IsHealthy:          healthy,
				Latency:            latency,
				LastCheck:          lastCheck,
				CircuitBreakerState: cbState,
			})
		}
	}
	return stats
}

// ProviderStats contains statistics for a provider.
type ProviderStats struct {
	URL                 string
	Priority            int
	IsHealthy           bool
	Latency             time.Duration
	LastCheck           time.Time
	CircuitBreakerState string
}
