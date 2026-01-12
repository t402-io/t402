package config

import (
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

// Config holds all configuration for the facilitator service
type Config struct {
	// Server
	Port        int
	Environment string

	// Redis
	RedisURL string

	// Rate Limiting
	RateLimitRequests int
	RateLimitWindow   time.Duration

	// API Key Authentication
	APIKeys         string // Comma-separated list of "key:name" pairs
	APIKeyRequired  bool   // If true, all requests require API key

	// EVM Configuration
	EvmPrivateKey string
	EthRPC        string
	ArbitrumRPC   string
	BaseRPC       string
	OptimismRPC   string
	InkRPC        string
	BerachainRPC  string
	UnichainRPC   string

	// TON Configuration
	TonMnemonic    string
	TonRPC         string
	TonTestnetRPC  string

	// TRON Configuration
	TronPrivateKey string
	TronRPC        string

	// Solana Configuration
	SvmPrivateKey string
	SolanaRPC     string
}

// Load loads configuration from environment variables
func Load() *Config {
	// Load .env file if it exists
	_ = godotenv.Load()

	return &Config{
		// Server
		Port:        getEnvInt("PORT", 8080),
		Environment: getEnv("ENVIRONMENT", "development"),

		// Redis
		RedisURL: getEnv("REDIS_URL", "redis://localhost:6379"),

		// Rate Limiting
		RateLimitRequests: getEnvInt("RATE_LIMIT_REQUESTS", 1000),
		RateLimitWindow:   time.Duration(getEnvInt("RATE_LIMIT_WINDOW", 60)) * time.Second,

		// API Key Authentication
		APIKeys:        getEnv("API_KEYS", ""),
		APIKeyRequired: getEnvBool("API_KEY_REQUIRED", false),

		// EVM Configuration
		EvmPrivateKey: getEnv("EVM_PRIVATE_KEY", ""),
		EthRPC:        getEnv("ETH_RPC", "https://eth.llamarpc.com"),
		ArbitrumRPC:   getEnv("ARBITRUM_RPC", "https://arb1.arbitrum.io/rpc"),
		BaseRPC:       getEnv("BASE_RPC", "https://mainnet.base.org"),
		OptimismRPC:   getEnv("OPTIMISM_RPC", "https://mainnet.optimism.io"),
		InkRPC:        getEnv("INK_RPC", "https://rpc-gel.inkonchain.com"),
		BerachainRPC:  getEnv("BERACHAIN_RPC", "https://bartio.rpc.berachain.com"),
		UnichainRPC:   getEnv("UNICHAIN_RPC", "https://mainnet.unichain.org"),

		// TON Configuration
		TonMnemonic:   getEnv("TON_MNEMONIC", ""),
		TonRPC:        getEnv("TON_RPC", "https://toncenter.com/api/v2/jsonRPC"),
		TonTestnetRPC: getEnv("TON_TESTNET_RPC", "https://testnet.toncenter.com/api/v2/jsonRPC"),

		// TRON Configuration
		TronPrivateKey: getEnv("TRON_PRIVATE_KEY", ""),
		TronRPC:        getEnv("TRON_RPC", "https://api.trongrid.io"),

		// Solana Configuration
		SvmPrivateKey: getEnv("SVM_PRIVATE_KEY", ""),
		SolanaRPC:     getEnv("SOLANA_RPC", "https://api.mainnet-beta.solana.com"),
	}
}

// IsDevelopment returns true if running in development mode
func (c *Config) IsDevelopment() bool {
	return c.Environment == "development"
}

// IsProduction returns true if running in production mode
func (c *Config) IsProduction() bool {
	return c.Environment == "production"
}

// Helper functions

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		return value == "true" || value == "1" || value == "yes"
	}
	return defaultValue
}
