package rpc

import (
	"context"
	"sync"
	"testing"
	"time"
)

func TestProvider_SetHealthy(t *testing.T) {
	p := &Provider{
		URL:     "https://rpc.example.com",
		Network: "eip155:1",
	}

	p.SetHealthy(true, 100*time.Millisecond)

	healthy, latency, lastCheck := p.GetHealth()
	if !healthy {
		t.Error("expected healthy=true")
	}
	if latency != 100*time.Millisecond {
		t.Errorf("expected latency=100ms, got %v", latency)
	}
	if lastCheck.IsZero() {
		t.Error("expected lastCheck to be set")
	}
}

func TestProvider_SetHealthy_Unhealthy(t *testing.T) {
	p := &Provider{
		URL:       "https://rpc.example.com",
		Network:   "eip155:1",
		IsHealthy: true,
	}

	p.SetHealthy(false, 5*time.Second)

	healthy, latency, _ := p.GetHealth()
	if healthy {
		t.Error("expected healthy=false")
	}
	if latency != 5*time.Second {
		t.Errorf("expected latency=5s, got %v", latency)
	}
}

func TestProvider_Concurrent(t *testing.T) {
	p := &Provider{
		URL:     "https://rpc.example.com",
		Network: "eip155:1",
	}

	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(2)
		go func() {
			defer wg.Done()
			p.SetHealthy(true, time.Millisecond)
		}()
		go func() {
			defer wg.Done()
			p.GetHealth()
		}()
	}
	wg.Wait()
	// No race conditions = success
}

func TestNewManager(t *testing.T) {
	config := DefaultConfig()
	m := NewManager(config)

	if m == nil {
		t.Fatal("expected non-nil manager")
	}
	if m.providers == nil {
		t.Error("expected non-nil providers map")
	}
	if m.circuitBreaker == nil {
		t.Error("expected non-nil circuit breaker manager")
	}
	if m.healthChecker == nil {
		t.Error("expected non-nil health checker")
	}
	if m.config != config {
		t.Error("expected config to be set")
	}
}

func TestManager_RegisterProvider(t *testing.T) {
	config := DefaultConfig()
	m := NewManager(config)

	m.RegisterProvider("eip155:1", "https://eth.llamarpc.com", 0)

	providers := m.GetAllProviders("eip155:1")
	if len(providers) != 1 {
		t.Fatalf("expected 1 provider, got %d", len(providers))
	}
	if providers[0].URL != "https://eth.llamarpc.com" {
		t.Errorf("expected URL='https://eth.llamarpc.com', got '%s'", providers[0].URL)
	}
	if providers[0].Network != "eip155:1" {
		t.Errorf("expected Network='eip155:1', got '%s'", providers[0].Network)
	}
	if providers[0].Priority != 0 {
		t.Errorf("expected Priority=0, got %d", providers[0].Priority)
	}
	if !providers[0].IsHealthy {
		t.Error("expected IsHealthy=true initially")
	}
}

func TestManager_RegisterProvider_Sorted(t *testing.T) {
	config := DefaultConfig()
	m := NewManager(config)

	// Register in reverse priority order
	m.RegisterProvider("eip155:1", "https://rpc3.example.com", 2)
	m.RegisterProvider("eip155:1", "https://rpc1.example.com", 0)
	m.RegisterProvider("eip155:1", "https://rpc2.example.com", 1)

	providers := m.GetAllProviders("eip155:1")
	if len(providers) != 3 {
		t.Fatalf("expected 3 providers, got %d", len(providers))
	}

	// Should be sorted by priority
	if providers[0].Priority != 0 {
		t.Errorf("expected first provider priority=0, got %d", providers[0].Priority)
	}
	if providers[1].Priority != 1 {
		t.Errorf("expected second provider priority=1, got %d", providers[1].Priority)
	}
	if providers[2].Priority != 2 {
		t.Errorf("expected third provider priority=2, got %d", providers[2].Priority)
	}
}

func TestManager_GetProvider_SingleProvider(t *testing.T) {
	config := DefaultConfig()
	m := NewManager(config)

	m.RegisterProvider("eip155:1", "https://eth.llamarpc.com", 0)

	url, err := m.GetProvider(context.Background(), "eip155:1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if url != "https://eth.llamarpc.com" {
		t.Errorf("expected URL='https://eth.llamarpc.com', got '%s'", url)
	}
}

func TestManager_GetProvider_NotFound(t *testing.T) {
	config := DefaultConfig()
	m := NewManager(config)

	_, err := m.GetProvider(context.Background(), "eip155:999")
	if err != ErrProviderNotFound {
		t.Errorf("expected ErrProviderNotFound, got %v", err)
	}
}

func TestManager_GetProvider_Failover(t *testing.T) {
	config := DefaultConfig()
	m := NewManager(config)

	m.RegisterProvider("eip155:1", "https://rpc1.example.com", 0)
	m.RegisterProvider("eip155:1", "https://rpc2.example.com", 1)

	// Mark first provider as unhealthy
	providers := m.GetAllProviders("eip155:1")
	providers[0].SetHealthy(false, 0)

	url, err := m.GetProvider(context.Background(), "eip155:1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Should return second provider
	if url != "https://rpc2.example.com" {
		t.Errorf("expected failover to rpc2, got '%s'", url)
	}
}

func TestManager_GetProvider_AllUnhealthy(t *testing.T) {
	config := DefaultConfig()
	m := NewManager(config)

	m.RegisterProvider("eip155:1", "https://rpc1.example.com", 0)
	m.RegisterProvider("eip155:1", "https://rpc2.example.com", 1)

	// Mark all providers as unhealthy
	providers := m.GetAllProviders("eip155:1")
	for _, p := range providers {
		p.SetHealthy(false, 0)
	}

	url, err := m.GetProvider(context.Background(), "eip155:1")
	// Should return first provider with ErrNoHealthyProviders
	if err != ErrNoHealthyProviders {
		t.Errorf("expected ErrNoHealthyProviders, got %v", err)
	}
	if url != "https://rpc1.example.com" {
		t.Errorf("expected first provider URL when all unhealthy, got '%s'", url)
	}
}

func TestManager_GetProvider_CircuitBreakerOpen(t *testing.T) {
	config := &Config{
		CircuitBreakerThreshold: 1,
		CircuitBreakerTimeout:   time.Hour,
	}
	m := NewManager(config)

	m.RegisterProvider("eip155:1", "https://rpc1.example.com", 0)
	m.RegisterProvider("eip155:1", "https://rpc2.example.com", 1)

	// Open circuit breaker for first provider
	m.ReportFailure("https://rpc1.example.com")

	url, err := m.GetProvider(context.Background(), "eip155:1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Should skip first provider due to open circuit
	if url != "https://rpc2.example.com" {
		t.Errorf("expected rpc2 due to circuit breaker, got '%s'", url)
	}
}

func TestManager_ReportFailure(t *testing.T) {
	config := &Config{
		CircuitBreakerThreshold: 2,
		CircuitBreakerTimeout:   time.Hour,
	}
	m := NewManager(config)

	url := "https://rpc.example.com"
	m.RegisterProvider("eip155:1", url, 0)

	// Record failures
	m.ReportFailure(url)
	state := m.circuitBreaker.GetState(url)
	if state != "closed" {
		t.Errorf("expected state=closed after 1 failure, got %s", state)
	}

	m.ReportFailure(url)
	state = m.circuitBreaker.GetState(url)
	if state != "open" {
		t.Errorf("expected state=open after 2 failures, got %s", state)
	}
}

func TestManager_ReportSuccess(t *testing.T) {
	config := DefaultConfig()
	m := NewManager(config)

	url := "https://rpc.example.com"
	m.RegisterProvider("eip155:1", url, 0)

	// Record some failures then success
	m.ReportFailure(url)
	m.ReportSuccess(url)

	// Should still be allowed
	if !m.circuitBreaker.IsAllowed(url) {
		t.Error("expected circuit to be closed after success")
	}
}

func TestManager_GetNetworks(t *testing.T) {
	config := DefaultConfig()
	m := NewManager(config)

	m.RegisterProvider("eip155:1", "https://eth.example.com", 0)
	m.RegisterProvider("eip155:8453", "https://base.example.com", 0)
	m.RegisterProvider("ton:mainnet", "https://ton.example.com", 0)

	networks := m.GetNetworks()
	if len(networks) != 3 {
		t.Fatalf("expected 3 networks, got %d", len(networks))
	}

	networkMap := make(map[string]bool)
	for _, n := range networks {
		networkMap[n] = true
	}

	expected := []string{"eip155:1", "eip155:8453", "ton:mainnet"}
	for _, e := range expected {
		if !networkMap[e] {
			t.Errorf("expected network '%s' to be present", e)
		}
	}
}

func TestManager_GetAllProviders_Empty(t *testing.T) {
	config := DefaultConfig()
	m := NewManager(config)

	providers := m.GetAllProviders("eip155:999")
	if providers != nil {
		t.Errorf("expected nil for unknown network, got %v", providers)
	}
}

func TestManager_GetStats(t *testing.T) {
	config := DefaultConfig()
	m := NewManager(config)

	m.RegisterProvider("eip155:1", "https://rpc1.example.com", 0)
	m.RegisterProvider("eip155:1", "https://rpc2.example.com", 1)

	// Update health for one provider
	providers := m.GetAllProviders("eip155:1")
	providers[0].SetHealthy(true, 50*time.Millisecond)

	stats := m.GetStats()
	if len(stats) != 1 {
		t.Fatalf("expected 1 network in stats, got %d", len(stats))
	}

	ethStats := stats["eip155:1"]
	if len(ethStats) != 2 {
		t.Fatalf("expected 2 provider stats, got %d", len(ethStats))
	}

	// First provider should have updated latency
	if ethStats[0].Latency != 50*time.Millisecond {
		t.Errorf("expected latency=50ms, got %v", ethStats[0].Latency)
	}
}

func TestProviderStats_Fields(t *testing.T) {
	stats := ProviderStats{
		URL:                 "https://rpc.example.com",
		Priority:            0,
		IsHealthy:           true,
		Latency:             100 * time.Millisecond,
		LastCheck:           time.Now(),
		CircuitBreakerState: "closed",
	}

	if stats.URL != "https://rpc.example.com" {
		t.Errorf("expected URL='https://rpc.example.com', got '%s'", stats.URL)
	}
	if stats.Priority != 0 {
		t.Errorf("expected Priority=0, got %d", stats.Priority)
	}
	if !stats.IsHealthy {
		t.Error("expected IsHealthy=true")
	}
	if stats.CircuitBreakerState != "closed" {
		t.Errorf("expected CircuitBreakerState='closed', got '%s'", stats.CircuitBreakerState)
	}
}

func TestManager_Concurrent(t *testing.T) {
	config := DefaultConfig()
	m := NewManager(config)

	m.RegisterProvider("eip155:1", "https://rpc1.example.com", 0)
	m.RegisterProvider("eip155:1", "https://rpc2.example.com", 1)

	var wg sync.WaitGroup
	ctx := context.Background()

	for i := 0; i < 100; i++ {
		wg.Add(4)
		go func() {
			defer wg.Done()
			m.GetProvider(ctx, "eip155:1")
		}()
		go func() {
			defer wg.Done()
			m.GetAllProviders("eip155:1")
		}()
		go func() {
			defer wg.Done()
			m.GetNetworks()
		}()
		go func() {
			defer wg.Done()
			m.GetStats()
		}()
	}

	wg.Wait()
	// No race conditions = success
}

func TestManager_MultipleNetworks(t *testing.T) {
	config := DefaultConfig()
	m := NewManager(config)

	// Register providers for different networks
	networks := map[string][]string{
		"eip155:1":    {"https://eth1.example.com", "https://eth2.example.com"},
		"eip155:8453": {"https://base1.example.com"},
		"ton:mainnet": {"https://ton1.example.com", "https://ton2.example.com", "https://ton3.example.com"},
	}

	for network, urls := range networks {
		for i, url := range urls {
			m.RegisterProvider(network, url, i)
		}
	}

	// Verify each network
	for network, urls := range networks {
		providers := m.GetAllProviders(network)
		if len(providers) != len(urls) {
			t.Errorf("network %s: expected %d providers, got %d", network, len(urls), len(providers))
		}
	}
}

func BenchmarkManager_GetProvider(b *testing.B) {
	config := DefaultConfig()
	m := NewManager(config)

	m.RegisterProvider("eip155:1", "https://rpc1.example.com", 0)
	m.RegisterProvider("eip155:1", "https://rpc2.example.com", 1)
	m.RegisterProvider("eip155:1", "https://rpc3.example.com", 2)

	ctx := context.Background()
	b.ResetTimer()

	for i := 0; i < b.N; i++ {
		m.GetProvider(ctx, "eip155:1")
	}
}

func BenchmarkManager_GetStats(b *testing.B) {
	config := DefaultConfig()
	m := NewManager(config)

	for i := 0; i < 10; i++ {
		m.RegisterProvider("eip155:1", "https://rpc"+string(rune('0'+i))+".example.com", i)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		m.GetStats()
	}
}
