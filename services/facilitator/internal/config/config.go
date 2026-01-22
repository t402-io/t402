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

		// CORS Configuration
		// Default: "*" (allow all) - for public APIs
		// Production recommendation: set specific origins like "https://example.com,https://app.example.com"
		CORSAllowedOrigins: getEnv("CORS_ALLOWED_ORIGINS", "*"),

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
