package config

import (
	"encoding/json"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// Config holds all configuration for the facilitator service
type Config struct {
	// Server
	Port        int
	Environment string

	// Database
	DatabaseURL         string
	DatabaseMaxConns    int
	DatabaseIdleConns   int
	DatabaseAutoMigrate bool

	// Redis
	RedisURL string

	// Rate Limiting
	RateLimitRequests int
	RateLimitWindow   time.Duration

	// API Key Authentication
	APIKeys        string // Comma-separated list of "key:name" pairs
	APIKeyRequired bool   // If true, all requests require API key

	// CORS Configuration
	CORSAllowedOrigins string // Comma-separated list of allowed origins, "*" for all

	// EVM Configuration
	EvmPrivateKey string
	EthRPC        string
	ArbitrumRPC   string
	BaseRPC       string
	OptimismRPC   string
	InkRPC        string
	BerachainRPC  string
	UnichainRPC   string
	// Phase 1: High Priority USDT0 Networks
	PolygonRPC  string
	MantleRPC   string
	PlasmaRPC   string
	SeiRPC      string
	ConfluxRPC  string
	MonadRPC    string
	// Phase 2: Medium Priority USDT0 Networks
	FlareRPC     string
	RootstockRPC string
	XLayerRPC    string
	StableRPC    string
	HyperEvmRPC  string
	MegaEthRPC   string
	CornRPC      string
	// Legacy USDT Networks (no EIP-3009 support)
	BnbRPC       string
	AvalancheRPC string
	FantomRPC    string
	CeloRPC      string
	KaiaRPC      string

	// TON Configuration
	TonMnemonic       string
	TonRPC            string
	TonTestnetRPC     string
	TonMainnetAddress string // Pre-computed wallet address for mainnet
	TonTestnetAddress string // Pre-computed wallet address for testnet

	// TRON Configuration
	TronPrivateKey string
	TronRPC        string

	// Solana Configuration
	SvmPrivateKey string
	SolanaRPC     string

	// NEAR Configuration
	NearRPC        string
	NearTestnetRPC string

	// Aptos Configuration
	AptosRPC        string
	AptosTestnetRPC string

	// Tezos Configuration
	TezosRPC        string
	TezosTestnetRPC string

	// Polkadot Configuration
	PolkadotAssetHubIndexer string
	WestendAssetHubIndexer  string

	// Stacks Configuration
	StacksAPIURL        string
	StacksTestnetAPIURL string
	StacksAddress       string

	// Cosmos/Noble Configuration
	CosmosMainnetREST    string
	CosmosTestnetREST    string
	CosmosMainnetAddress string
	CosmosTestnetAddress string

	// OpenTelemetry Configuration
	OTELEnabled    bool
	OTELEndpoint   string
	OTELProtocol   string // grpc or http
	OTELInsecure   bool
	OTELSampleRate float64

	// HTTP Server Timeouts
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	IdleTimeout     time.Duration
	ShutdownTimeout time.Duration
}

// MarshalJSON implements json.Marshaler to prevent sensitive fields from being serialized
// SECURITY: Prevents private keys, mnemonics, and database credentials from appearing in logs or API responses
func (c *Config) MarshalJSON() ([]byte, error) {
	// Create a safe copy with sensitive fields redacted
	type SafeConfig Config
	safe := SafeConfig(*c)

	// Redact sensitive fields
	if safe.EvmPrivateKey != "" {
		safe.EvmPrivateKey = "[REDACTED]"
	}
	if safe.TonMnemonic != "" {
		safe.TonMnemonic = "[REDACTED]"
	}
	if safe.TronPrivateKey != "" {
		safe.TronPrivateKey = "[REDACTED]"
	}
	if safe.SvmPrivateKey != "" {
		safe.SvmPrivateKey = "[REDACTED]"
	}
	if safe.DatabaseURL != "" {
		safe.DatabaseURL = "[REDACTED]"
	}
	if safe.RedisURL != "" {
		safe.RedisURL = "[REDACTED]"
	}
	if safe.APIKeys != "" {
		safe.APIKeys = "[REDACTED]"
	}

	return json.Marshal(safe)
}

// String implements fmt.Stringer to prevent sensitive fields from appearing in logs
// SECURITY: Ensures fmt.Printf("%v", config) doesn't leak secrets
func (c *Config) String() string {
	return "[Config: use MarshalJSON for safe output]"
}

// ContainsSensitiveData checks if a string might contain sensitive configuration
// SECURITY: Helper for log sanitization
func ContainsSensitiveData(s string) bool {
	lower := strings.ToLower(s)
	sensitivePatterns := []string{
		"private", "key", "secret", "password", "mnemonic", "seed",
		"token", "credential", "auth",
	}
	for _, pattern := range sensitivePatterns {
		if strings.Contains(lower, pattern) {
			return true
		}
	}
	return false
}

// Load loads configuration from environment variables
func Load() *Config {
	// Load .env file if it exists
	_ = godotenv.Load()

	env := getEnv("ENVIRONMENT", "development")

	// CORS defaults: secure in production, permissive in development
	// In production, require explicit CORS configuration (empty = no CORS)
	// In development, default to "*" for easier local testing
	corsDefault := "*"
	if env == "production" {
		corsDefault = "" // Require explicit configuration in production
	}

	return &Config{
		// Server
		Port:        getEnvInt("PORT", 8080),
		Environment: env,

		// Database
		DatabaseURL:         getEnv("DATABASE_URL", ""),
		DatabaseMaxConns:    getEnvInt("DATABASE_MAX_CONNS", 25),
		DatabaseIdleConns:   getEnvInt("DATABASE_IDLE_CONNS", 5),
		DatabaseAutoMigrate: getEnvBool("DATABASE_AUTO_MIGRATE", true),

		// Redis
		RedisURL: getEnv("REDIS_URL", "redis://localhost:6379"),

		// Rate Limiting
		RateLimitRequests: getEnvInt("RATE_LIMIT_REQUESTS", 1000),
		RateLimitWindow:   time.Duration(getEnvInt("RATE_LIMIT_WINDOW", 60)) * time.Second,

		// API Key Authentication
		APIKeys:        getEnv("API_KEYS", ""),
		APIKeyRequired: getEnvBool("API_KEY_REQUIRED", false),

		// CORS Configuration
		// Development: defaults to "*" (allow all)
		// Production: defaults to "" (require explicit configuration for security)
		// Set specific origins like "https://example.com,https://app.example.com"
		CORSAllowedOrigins: getEnv("CORS_ALLOWED_ORIGINS", corsDefault),

		// EVM Configuration
		EvmPrivateKey: getEnv("EVM_PRIVATE_KEY", ""),
		EthRPC:        getEnv("ETH_RPC", "https://eth.llamarpc.com"),
		ArbitrumRPC:   getEnv("ARBITRUM_RPC", "https://arb1.arbitrum.io/rpc"),
		BaseRPC:       getEnv("BASE_RPC", "https://mainnet.base.org"),
		OptimismRPC:   getEnv("OPTIMISM_RPC", "https://mainnet.optimism.io"),
		InkRPC:        getEnv("INK_RPC", "https://rpc-gel.inkonchain.com"),
		BerachainRPC:  getEnv("BERACHAIN_RPC", "https://rpc.berachain.com"),
		UnichainRPC:   getEnv("UNICHAIN_RPC", "https://mainnet.unichain.org"),
		// Phase 1: High Priority USDT0 Networks
		PolygonRPC:  getEnv("POLYGON_RPC", "https://polygon-rpc.com"),
		MantleRPC:   getEnv("MANTLE_RPC", "https://rpc.mantle.xyz"),
		PlasmaRPC:   getEnv("PLASMA_RPC", "https://rpc.plasma.io"),
		SeiRPC:      getEnv("SEI_RPC", "https://evm-rpc.sei-apis.com"),
		ConfluxRPC:  getEnv("CONFLUX_RPC", "https://evm.confluxrpc.com"),
		MonadRPC:    getEnv("MONAD_RPC", "https://rpc.monad.xyz"),
		// Phase 2: Medium Priority USDT0 Networks
		FlareRPC:     getEnv("FLARE_RPC", "https://flare-api.flare.network/ext/C/rpc"),
		RootstockRPC: getEnv("ROOTSTOCK_RPC", "https://public-node.rsk.co"),
		XLayerRPC:    getEnv("XLAYER_RPC", "https://rpc.xlayer.tech"),
		StableRPC:    getEnv("STABLE_RPC", "https://rpc.stable.io"),
		HyperEvmRPC:  getEnv("HYPEREVM_RPC", "https://rpc.hyperevm.xyz"),
		MegaEthRPC:   getEnv("MEGAETH_RPC", "https://rpc.megaeth.com"),
		CornRPC:      getEnv("CORN_RPC", "https://rpc.corn.xyz"),
		// Legacy USDT Networks (no EIP-3009 support)
		BnbRPC:       getEnv("BNB_RPC", "https://bsc-dataseed.binance.org"),
		AvalancheRPC: getEnv("AVALANCHE_RPC", "https://api.avax.network/ext/bc/C/rpc"),
		FantomRPC:    getEnv("FANTOM_RPC", "https://rpc.ftm.tools"),
		CeloRPC:      getEnv("CELO_RPC", "https://forno.celo.org"),
		KaiaRPC:      getEnv("KAIA_RPC", "https://public-en.node.kaia.io"),

		// TON Configuration
		TonMnemonic:       getEnv("TON_MNEMONIC", ""),
		TonRPC:            getEnv("TON_RPC", "https://toncenter.com/api/v2/jsonRPC"),
		TonTestnetRPC:     getEnv("TON_TESTNET_RPC", "https://testnet.toncenter.com/api/v2/jsonRPC"),
		TonMainnetAddress: getEnv("TON_MAINNET_ADDRESS", ""),
		TonTestnetAddress: getEnv("TON_TESTNET_ADDRESS", ""),

		// TRON Configuration
		TronPrivateKey: getEnv("TRON_PRIVATE_KEY", ""),
		TronRPC:        getEnv("TRON_RPC", "https://api.trongrid.io"),

		// Solana Configuration
		SvmPrivateKey: getEnv("SVM_PRIVATE_KEY", ""),
		SolanaRPC:     getEnv("SOLANA_RPC", "https://api.mainnet-beta.solana.com"),

		// NEAR Configuration
		NearRPC:        getEnv("NEAR_RPC", "https://rpc.mainnet.near.org"),
		NearTestnetRPC: getEnv("NEAR_TESTNET_RPC", "https://rpc.testnet.near.org"),

		// Aptos Configuration
		AptosRPC:        getEnv("APTOS_RPC", "https://fullnode.mainnet.aptoslabs.com/v1"),
		AptosTestnetRPC: getEnv("APTOS_TESTNET_RPC", "https://fullnode.testnet.aptoslabs.com/v1"),

		// Tezos Configuration
		TezosRPC:        getEnv("TEZOS_RPC", "https://mainnet.api.tez.ie"),
		TezosTestnetRPC: getEnv("TEZOS_TESTNET_RPC", "https://ghostnet.tezos.marigold.dev"),

		// Polkadot Configuration
		PolkadotAssetHubIndexer: getEnv("POLKADOT_ASSET_HUB_INDEXER", "https://assethub-polkadot.api.subscan.io"),
		WestendAssetHubIndexer:  getEnv("WESTEND_ASSET_HUB_INDEXER", "https://assethub-westend.api.subscan.io"),

		// Stacks Configuration
		StacksAPIURL:        getEnv("STACKS_API_URL", "https://api.mainnet.hiro.so"),
		StacksTestnetAPIURL: getEnv("STACKS_TESTNET_API_URL", "https://api.testnet.hiro.so"),
		StacksAddress:       getEnv("STACKS_ADDRESS", ""),

		// Cosmos/Noble Configuration
		CosmosMainnetREST:    getEnv("COSMOS_MAINNET_REST", "https://noble-api.polkachu.com"),
		CosmosTestnetREST:    getEnv("COSMOS_TESTNET_REST", "https://api.testnet.noble.strange.love"),
		CosmosMainnetAddress: getEnv("COSMOS_MAINNET_ADDRESS", ""),
		CosmosTestnetAddress: getEnv("COSMOS_TESTNET_ADDRESS", ""),

		// OpenTelemetry Configuration
		OTELEnabled:    getEnvBool("OTEL_ENABLED", false),
		OTELEndpoint:   getEnv("OTEL_EXPORTER_OTLP_ENDPOINT", "localhost:4317"),
		OTELProtocol:   getEnv("OTEL_EXPORTER_OTLP_PROTOCOL", "grpc"),
		OTELInsecure:   getEnvBool("OTEL_EXPORTER_OTLP_INSECURE", true),
		OTELSampleRate: getEnvFloat("OTEL_TRACES_SAMPLER_ARG", 1.0),

		// HTTP Server Timeouts (configurable for different deployment scenarios)
		ReadTimeout:     time.Duration(getEnvInt("HTTP_READ_TIMEOUT", 30)) * time.Second,
		WriteTimeout:    time.Duration(getEnvInt("HTTP_WRITE_TIMEOUT", 30)) * time.Second,
		IdleTimeout:     time.Duration(getEnvInt("HTTP_IDLE_TIMEOUT", 60)) * time.Second,
		ShutdownTimeout: time.Duration(getEnvInt("HTTP_SHUTDOWN_TIMEOUT", 30)) * time.Second,
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

func getEnvFloat(key string, defaultValue float64) float64 {
	if value := os.Getenv(key); value != "" {
		if floatValue, err := strconv.ParseFloat(value, 64); err == nil {
			return floatValue
		}
	}
	return defaultValue
}
