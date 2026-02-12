package rpc

import (
	"os"
	"strconv"
	"strings"
	"time"
)

// Config contains configuration for the RPC manager.
type Config struct {
	// HealthCheckInterval is the interval between health checks.
	HealthCheckInterval time.Duration
	// HealthCheckTimeout is the timeout for health check requests.
	HealthCheckTimeout time.Duration
	// CircuitBreakerThreshold is the number of failures before opening the circuit.
	CircuitBreakerThreshold int
	// CircuitBreakerTimeout is the time to wait before trying a half-open state.
	CircuitBreakerTimeout time.Duration
}

// DefaultConfig returns the default RPC configuration.
func DefaultConfig() *Config {
	return &Config{
		HealthCheckInterval:     30 * time.Second,
		HealthCheckTimeout:      10 * time.Second,
		CircuitBreakerThreshold: 5,
		CircuitBreakerTimeout:   60 * time.Second,
	}
}

// LoadConfigFromEnv loads RPC configuration from environment variables.
func LoadConfigFromEnv() *Config {
	config := DefaultConfig()

	if v := os.Getenv("RPC_HEALTH_CHECK_INTERVAL"); v != "" {
		if seconds, err := strconv.Atoi(v); err == nil {
			config.HealthCheckInterval = time.Duration(seconds) * time.Second
		}
	}

	if v := os.Getenv("RPC_HEALTH_CHECK_TIMEOUT"); v != "" {
		if seconds, err := strconv.Atoi(v); err == nil {
			config.HealthCheckTimeout = time.Duration(seconds) * time.Second
		}
	}

	if v := os.Getenv("RPC_CIRCUIT_BREAKER_THRESHOLD"); v != "" {
		if threshold, err := strconv.Atoi(v); err == nil {
			config.CircuitBreakerThreshold = threshold
		}
	}

	if v := os.Getenv("RPC_CIRCUIT_BREAKER_TIMEOUT"); v != "" {
		if seconds, err := strconv.Atoi(v); err == nil {
			config.CircuitBreakerTimeout = time.Duration(seconds) * time.Second
		}
	}

	return config
}

// NetworkRPCConfig contains RPC configuration for a specific network.
type NetworkRPCConfig struct {
	Network     string
	PrimaryURL  string
	FallbackURLs []string
}

// ParseNetworkRPCsFromEnv parses RPC URLs from environment variables.
// It supports the format:
//   - {PREFIX}_RPC for primary RPC
//   - {PREFIX}_RPC_FALLBACK for comma-separated fallback RPCs
//
// Example:
//   ETH_RPC=https://eth.llamarpc.com
//   ETH_RPC_FALLBACK=https://rpc.ankr.com/eth,https://eth.drpc.org
func ParseNetworkRPCsFromEnv(prefix, network string) *NetworkRPCConfig {
	config := &NetworkRPCConfig{
		Network: network,
	}

	// Get primary RPC
	primaryKey := prefix + "_RPC"
	config.PrimaryURL = os.Getenv(primaryKey)

	// Get fallback RPCs
	fallbackKey := prefix + "_RPC_FALLBACK"
	if fallbacks := os.Getenv(fallbackKey); fallbacks != "" {
		urls := strings.Split(fallbacks, ",")
		for _, url := range urls {
			url = strings.TrimSpace(url)
			if url != "" {
				config.FallbackURLs = append(config.FallbackURLs, url)
			}
		}
	}

	return config
}

// EVMNetworkPrefixes maps EVM chain IDs to environment variable prefixes.
var EVMNetworkPrefixes = map[string]string{
	"eip155:1":     "ETH",
	"eip155:10":    "OPTIMISM",
	"eip155:137":   "POLYGON",
	"eip155:42161": "ARBITRUM",
	"eip155:8453":  "BASE",
	"eip155:43114": "AVALANCHE",
	"eip155:56":    "BSC",
	"eip155:250":   "FANTOM",
	"eip155:42220": "CELO",
	"eip155:8217":  "KAIA",
	"eip155:30":    "ROOTSTOCK",
	"eip155:14":    "FLARE",
	"eip155:5000":  "MANTLE",
	"eip155:57073": "INK",
	"eip155:80094": "BERACHAIN",
	"eip155:130":      "UNICHAIN",
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

// NonEVMNetworkPrefixes maps non-EVM networks to environment variable prefixes.
var NonEVMNetworkPrefixes = map[string]string{
	"ton:mainnet":                            "TON",
	"ton:testnet":                            "TON_TESTNET",
	"tron:mainnet":                           "TRON",
	"tron:nile":                              "TRON_NILE",
	"tron:shasta":                            "TRON_SHASTA",
	"solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp": "SOLANA",
	"solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1": "SOLANA_DEVNET",
	"near:mainnet":                           "NEAR",
	"near:testnet":                           "NEAR_TESTNET",
	"aptos:1":                                "APTOS",
	"aptos:2":                                "APTOS_TESTNET",
	"tezos:NetXdQprcVkpaWU":                  "TEZOS",
	"tezos:NetXnHfVqm9iesp":                  "TEZOS_TESTNET",
	"polkadot:68d56f15f85d3136970ec16946040bc1": "POLKADOT_ASSET_HUB",
	"polkadot:e143f23803ac50e8f6f8e62695d1ce9e": "WESTEND_ASSET_HUB",
	"stacks:1":                               "STACKS",
	"stacks:2147483648":                      "STACKS_TESTNET",
	"cosmos:noble-1":                         "COSMOS",
	"cosmos:grand-1":                         "COSMOS_TESTNET",
}
