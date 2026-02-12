package rpc

import (
	"os"
	"testing"
	"time"
)

func TestDefaultConfig(t *testing.T) {
	config := DefaultConfig()

	if config == nil {
		t.Fatal("expected non-nil config")
	}
	if config.HealthCheckInterval != 30*time.Second {
		t.Errorf("expected HealthCheckInterval=30s, got %v", config.HealthCheckInterval)
	}
	if config.HealthCheckTimeout != 10*time.Second {
		t.Errorf("expected HealthCheckTimeout=10s, got %v", config.HealthCheckTimeout)
	}
	if config.CircuitBreakerThreshold != 5 {
		t.Errorf("expected CircuitBreakerThreshold=5, got %d", config.CircuitBreakerThreshold)
	}
	if config.CircuitBreakerTimeout != 60*time.Second {
		t.Errorf("expected CircuitBreakerTimeout=60s, got %v", config.CircuitBreakerTimeout)
	}
}

func TestLoadConfigFromEnv_Defaults(t *testing.T) {
	// Clear relevant env vars
	os.Unsetenv("RPC_HEALTH_CHECK_INTERVAL")
	os.Unsetenv("RPC_HEALTH_CHECK_TIMEOUT")
	os.Unsetenv("RPC_CIRCUIT_BREAKER_THRESHOLD")
	os.Unsetenv("RPC_CIRCUIT_BREAKER_TIMEOUT")

	config := LoadConfigFromEnv()

	// Should use defaults
	if config.HealthCheckInterval != 30*time.Second {
		t.Errorf("expected HealthCheckInterval=30s, got %v", config.HealthCheckInterval)
	}
	if config.CircuitBreakerThreshold != 5 {
		t.Errorf("expected CircuitBreakerThreshold=5, got %d", config.CircuitBreakerThreshold)
	}
}

func TestLoadConfigFromEnv_CustomValues(t *testing.T) {
	// Set custom env vars
	os.Setenv("RPC_HEALTH_CHECK_INTERVAL", "60")
	os.Setenv("RPC_HEALTH_CHECK_TIMEOUT", "20")
	os.Setenv("RPC_CIRCUIT_BREAKER_THRESHOLD", "10")
	os.Setenv("RPC_CIRCUIT_BREAKER_TIMEOUT", "120")
	defer func() {
		os.Unsetenv("RPC_HEALTH_CHECK_INTERVAL")
		os.Unsetenv("RPC_HEALTH_CHECK_TIMEOUT")
		os.Unsetenv("RPC_CIRCUIT_BREAKER_THRESHOLD")
		os.Unsetenv("RPC_CIRCUIT_BREAKER_TIMEOUT")
	}()

	config := LoadConfigFromEnv()

	if config.HealthCheckInterval != 60*time.Second {
		t.Errorf("expected HealthCheckInterval=60s, got %v", config.HealthCheckInterval)
	}
	if config.HealthCheckTimeout != 20*time.Second {
		t.Errorf("expected HealthCheckTimeout=20s, got %v", config.HealthCheckTimeout)
	}
	if config.CircuitBreakerThreshold != 10 {
		t.Errorf("expected CircuitBreakerThreshold=10, got %d", config.CircuitBreakerThreshold)
	}
	if config.CircuitBreakerTimeout != 120*time.Second {
		t.Errorf("expected CircuitBreakerTimeout=120s, got %v", config.CircuitBreakerTimeout)
	}
}

func TestLoadConfigFromEnv_InvalidValues(t *testing.T) {
	// Set invalid env vars
	os.Setenv("RPC_HEALTH_CHECK_INTERVAL", "invalid")
	os.Setenv("RPC_CIRCUIT_BREAKER_THRESHOLD", "not-a-number")
	defer func() {
		os.Unsetenv("RPC_HEALTH_CHECK_INTERVAL")
		os.Unsetenv("RPC_CIRCUIT_BREAKER_THRESHOLD")
	}()

	config := LoadConfigFromEnv()

	// Should use defaults when parsing fails
	if config.HealthCheckInterval != 30*time.Second {
		t.Errorf("expected default HealthCheckInterval=30s, got %v", config.HealthCheckInterval)
	}
	if config.CircuitBreakerThreshold != 5 {
		t.Errorf("expected default CircuitBreakerThreshold=5, got %d", config.CircuitBreakerThreshold)
	}
}

func TestLoadConfigFromEnv_PartialOverride(t *testing.T) {
	os.Setenv("RPC_HEALTH_CHECK_INTERVAL", "45")
	os.Unsetenv("RPC_HEALTH_CHECK_TIMEOUT")
	defer os.Unsetenv("RPC_HEALTH_CHECK_INTERVAL")

	config := LoadConfigFromEnv()

	if config.HealthCheckInterval != 45*time.Second {
		t.Errorf("expected HealthCheckInterval=45s, got %v", config.HealthCheckInterval)
	}
	// Other values should use defaults
	if config.HealthCheckTimeout != 10*time.Second {
		t.Errorf("expected default HealthCheckTimeout=10s, got %v", config.HealthCheckTimeout)
	}
}

func TestNetworkRPCConfig(t *testing.T) {
	config := &NetworkRPCConfig{
		Network:      "eip155:1",
		PrimaryURL:   "https://eth.llamarpc.com",
		FallbackURLs: []string{"https://rpc.ankr.com/eth", "https://eth.drpc.org"},
	}

	if config.Network != "eip155:1" {
		t.Errorf("expected Network='eip155:1', got '%s'", config.Network)
	}
	if config.PrimaryURL != "https://eth.llamarpc.com" {
		t.Errorf("expected PrimaryURL='https://eth.llamarpc.com', got '%s'", config.PrimaryURL)
	}
	if len(config.FallbackURLs) != 2 {
		t.Errorf("expected 2 fallback URLs, got %d", len(config.FallbackURLs))
	}
}

func TestParseNetworkRPCsFromEnv_Basic(t *testing.T) {
	os.Setenv("ETH_RPC", "https://eth.llamarpc.com")
	defer os.Unsetenv("ETH_RPC")

	config := ParseNetworkRPCsFromEnv("ETH", "eip155:1")

	if config.Network != "eip155:1" {
		t.Errorf("expected Network='eip155:1', got '%s'", config.Network)
	}
	if config.PrimaryURL != "https://eth.llamarpc.com" {
		t.Errorf("expected PrimaryURL='https://eth.llamarpc.com', got '%s'", config.PrimaryURL)
	}
	if len(config.FallbackURLs) != 0 {
		t.Errorf("expected 0 fallback URLs, got %d", len(config.FallbackURLs))
	}
}

func TestParseNetworkRPCsFromEnv_WithFallbacks(t *testing.T) {
	os.Setenv("ETH_RPC", "https://eth.llamarpc.com")
	os.Setenv("ETH_RPC_FALLBACK", "https://rpc.ankr.com/eth,https://eth.drpc.org")
	defer func() {
		os.Unsetenv("ETH_RPC")
		os.Unsetenv("ETH_RPC_FALLBACK")
	}()

	config := ParseNetworkRPCsFromEnv("ETH", "eip155:1")

	if config.PrimaryURL != "https://eth.llamarpc.com" {
		t.Errorf("expected PrimaryURL='https://eth.llamarpc.com', got '%s'", config.PrimaryURL)
	}
	if len(config.FallbackURLs) != 2 {
		t.Errorf("expected 2 fallback URLs, got %d", len(config.FallbackURLs))
	}
	if config.FallbackURLs[0] != "https://rpc.ankr.com/eth" {
		t.Errorf("expected fallback[0]='https://rpc.ankr.com/eth', got '%s'", config.FallbackURLs[0])
	}
	if config.FallbackURLs[1] != "https://eth.drpc.org" {
		t.Errorf("expected fallback[1]='https://eth.drpc.org', got '%s'", config.FallbackURLs[1])
	}
}

func TestParseNetworkRPCsFromEnv_FallbacksWithSpaces(t *testing.T) {
	os.Setenv("ETH_RPC", "https://eth.llamarpc.com")
	os.Setenv("ETH_RPC_FALLBACK", "  https://rpc1.example.com  ,  https://rpc2.example.com  , https://rpc3.example.com ")
	defer func() {
		os.Unsetenv("ETH_RPC")
		os.Unsetenv("ETH_RPC_FALLBACK")
	}()

	config := ParseNetworkRPCsFromEnv("ETH", "eip155:1")

	if len(config.FallbackURLs) != 3 {
		t.Fatalf("expected 3 fallback URLs, got %d", len(config.FallbackURLs))
	}
	// Spaces should be trimmed
	if config.FallbackURLs[0] != "https://rpc1.example.com" {
		t.Errorf("expected trimmed URL, got '%s'", config.FallbackURLs[0])
	}
}

func TestParseNetworkRPCsFromEnv_EmptyFallback(t *testing.T) {
	os.Setenv("ETH_RPC", "https://eth.llamarpc.com")
	os.Setenv("ETH_RPC_FALLBACK", "")
	defer func() {
		os.Unsetenv("ETH_RPC")
		os.Unsetenv("ETH_RPC_FALLBACK")
	}()

	config := ParseNetworkRPCsFromEnv("ETH", "eip155:1")

	if len(config.FallbackURLs) != 0 {
		t.Errorf("expected 0 fallback URLs for empty string, got %d", len(config.FallbackURLs))
	}
}

func TestParseNetworkRPCsFromEnv_EmptyEntriesInFallback(t *testing.T) {
	os.Setenv("ETH_RPC", "https://eth.llamarpc.com")
	os.Setenv("ETH_RPC_FALLBACK", "https://rpc1.example.com,,https://rpc2.example.com,  ,https://rpc3.example.com")
	defer func() {
		os.Unsetenv("ETH_RPC")
		os.Unsetenv("ETH_RPC_FALLBACK")
	}()

	config := ParseNetworkRPCsFromEnv("ETH", "eip155:1")

	// Empty entries should be filtered
	if len(config.FallbackURLs) != 3 {
		t.Errorf("expected 3 fallback URLs (empty filtered), got %d: %v", len(config.FallbackURLs), config.FallbackURLs)
	}
}

func TestParseNetworkRPCsFromEnv_NoPrimary(t *testing.T) {
	os.Unsetenv("TEST_RPC")
	os.Setenv("TEST_RPC_FALLBACK", "https://fallback.example.com")
	defer os.Unsetenv("TEST_RPC_FALLBACK")

	config := ParseNetworkRPCsFromEnv("TEST", "test:network")

	if config.PrimaryURL != "" {
		t.Errorf("expected empty PrimaryURL, got '%s'", config.PrimaryURL)
	}
	if len(config.FallbackURLs) != 1 {
		t.Errorf("expected 1 fallback URL, got %d", len(config.FallbackURLs))
	}
}

func TestEVMNetworkPrefixes(t *testing.T) {
	// Test that all expected networks are present
	expectedNetworks := map[string]string{
		"eip155:1":       "ETH",
		"eip155:10":      "OPTIMISM",
		"eip155:137":     "POLYGON",
		"eip155:42161":   "ARBITRUM",
		"eip155:8453":    "BASE",
		"eip155:43114":   "AVALANCHE",
		"eip155:56":      "BSC",
		"eip155:250":     "FANTOM",
		"eip155:42220":   "CELO",
		"eip155:8217":    "KAIA",
		"eip155:30":      "ROOTSTOCK",
		"eip155:14":      "FLARE",
		"eip155:5000":    "MANTLE",
		"eip155:57073":   "INK",
		"eip155:80094":   "BERACHAIN",
		"eip155:130":     "UNICHAIN",
		"eip155:1030":     "CONFLUX",
		"eip155:143":      "MONAD",
		"eip155:9745":     "PLASMA",
		"eip155:1329":     "SEI",
		"eip155:196":      "XLAYER",
		"eip155:988":      "STABLE",
		"eip155:999":      "HYPEREVM",
		"eip155:4326":     "MEGAETH",
		"eip155:21000000": "CORN",
	}

	for network, expectedPrefix := range expectedNetworks {
		prefix, ok := EVMNetworkPrefixes[network]
		if !ok {
			t.Errorf("expected network '%s' to be present", network)
			continue
		}
		if prefix != expectedPrefix {
			t.Errorf("network '%s': expected prefix '%s', got '%s'", network, expectedPrefix, prefix)
		}
	}

	// Verify count
	if len(EVMNetworkPrefixes) != len(expectedNetworks) {
		t.Errorf("expected %d EVM networks, got %d", len(expectedNetworks), len(EVMNetworkPrefixes))
	}
}

func TestNonEVMNetworkPrefixes(t *testing.T) {
	expectedNetworks := map[string]string{
		"ton:mainnet":                              "TON",
		"ton:testnet":                              "TON_TESTNET",
		"tron:mainnet":                             "TRON",
		"tron:nile":                                "TRON_NILE",
		"solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp":  "SOLANA",
		"solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1":  "SOLANA_DEVNET",
		"near:mainnet":                             "NEAR",
		"near:testnet":                             "NEAR_TESTNET",
		"aptos:1":                                  "APTOS",
		"aptos:2":                                  "APTOS_TESTNET",
		"tezos:NetXdQprcVkpaWU":                    "TEZOS",
		"tezos:NetXnHfVqm9iesp":                    "TEZOS_TESTNET",
		"polkadot:68d56f15f85d3136970ec16946040bc1": "POLKADOT_ASSET_HUB",
		"polkadot:e143f23803ac50e8f6f8e62695d1ce9e": "WESTEND_ASSET_HUB",
		"stacks:1":                                 "STACKS",
		"stacks:2147483648":                        "STACKS_TESTNET",
		"tron:shasta":                              "TRON_SHASTA",
		"cosmos:noble-1":                           "COSMOS",
		"cosmos:grand-1":                           "COSMOS_TESTNET",
	}

	for network, expectedPrefix := range expectedNetworks {
		prefix, ok := NonEVMNetworkPrefixes[network]
		if !ok {
			t.Errorf("expected network '%s' to be present", network)
			continue
		}
		if prefix != expectedPrefix {
			t.Errorf("network '%s': expected prefix '%s', got '%s'", network, expectedPrefix, prefix)
		}
	}

	// Verify count
	if len(NonEVMNetworkPrefixes) != len(expectedNetworks) {
		t.Errorf("expected %d non-EVM networks, got %d", len(expectedNetworks), len(NonEVMNetworkPrefixes))
	}
}

func TestParseNetworkRPCsFromEnv_AllEVMNetworks(t *testing.T) {
	// Test that we can parse config for all EVM networks
	for network, prefix := range EVMNetworkPrefixes {
		envKey := prefix + "_RPC"
		testURL := "https://" + prefix + ".example.com"
		os.Setenv(envKey, testURL)
		defer os.Unsetenv(envKey)

		config := ParseNetworkRPCsFromEnv(prefix, network)

		if config.Network != network {
			t.Errorf("network %s: expected Network='%s', got '%s'", network, network, config.Network)
		}
		if config.PrimaryURL != testURL {
			t.Errorf("network %s: expected PrimaryURL='%s', got '%s'", network, testURL, config.PrimaryURL)
		}
	}
}

func TestParseNetworkRPCsFromEnv_AllNonEVMNetworks(t *testing.T) {
	// Test that we can parse config for all non-EVM networks
	for network, prefix := range NonEVMNetworkPrefixes {
		envKey := prefix + "_RPC"
		testURL := "https://" + prefix + ".example.com"
		os.Setenv(envKey, testURL)
		defer os.Unsetenv(envKey)

		config := ParseNetworkRPCsFromEnv(prefix, network)

		if config.Network != network {
			t.Errorf("network %s: expected Network='%s', got '%s'", network, network, config.Network)
		}
		if config.PrimaryURL != testURL {
			t.Errorf("network %s: expected PrimaryURL='%s', got '%s'", network, testURL, config.PrimaryURL)
		}
	}
}

func BenchmarkLoadConfigFromEnv(b *testing.B) {
	os.Setenv("RPC_HEALTH_CHECK_INTERVAL", "30")
	os.Setenv("RPC_CIRCUIT_BREAKER_THRESHOLD", "5")
	defer func() {
		os.Unsetenv("RPC_HEALTH_CHECK_INTERVAL")
		os.Unsetenv("RPC_CIRCUIT_BREAKER_THRESHOLD")
	}()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		LoadConfigFromEnv()
	}
}

func BenchmarkParseNetworkRPCsFromEnv(b *testing.B) {
	os.Setenv("ETH_RPC", "https://eth.llamarpc.com")
	os.Setenv("ETH_RPC_FALLBACK", "https://rpc1.example.com,https://rpc2.example.com,https://rpc3.example.com")
	defer func() {
		os.Unsetenv("ETH_RPC")
		os.Unsetenv("ETH_RPC_FALLBACK")
	}()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ParseNetworkRPCsFromEnv("ETH", "eip155:1")
	}
}
