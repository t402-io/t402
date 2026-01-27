package config

import (
	"encoding/json"
	"os"
	"testing"
	"time"
)

func TestLoad_Defaults(t *testing.T) {
	// Clear environment variables to test defaults
	envVars := []string{
		"PORT", "ENVIRONMENT", "REDIS_URL",
		"RATE_LIMIT_REQUESTS", "RATE_LIMIT_WINDOW",
		"API_KEYS", "API_KEY_REQUIRED",
		"EVM_PRIVATE_KEY", "ETH_RPC", "ARBITRUM_RPC", "BASE_RPC",
		"OPTIMISM_RPC", "INK_RPC", "BERACHAIN_RPC", "UNICHAIN_RPC",
		"TON_MNEMONIC", "TON_RPC", "TON_TESTNET_RPC",
		"TON_MAINNET_ADDRESS", "TON_TESTNET_ADDRESS",
		"TRON_PRIVATE_KEY", "TRON_RPC",
		"SVM_PRIVATE_KEY", "SOLANA_RPC",
	}

	// Save current values
	savedVars := make(map[string]string)
	for _, v := range envVars {
		savedVars[v] = os.Getenv(v)
		os.Unsetenv(v)
	}

	// Restore after test
	defer func() {
		for k, v := range savedVars {
			if v != "" {
				os.Setenv(k, v)
			}
		}
	}()

	cfg := Load()

	// Test server defaults
	if cfg.Port != 8080 {
		t.Errorf("expected Port=8080, got %d", cfg.Port)
	}
	if cfg.Environment != "development" {
		t.Errorf("expected Environment=development, got %s", cfg.Environment)
	}

	// Test Redis defaults
	if cfg.RedisURL != "redis://localhost:6379" {
		t.Errorf("expected RedisURL=redis://localhost:6379, got %s", cfg.RedisURL)
	}

	// Test rate limiting defaults
	if cfg.RateLimitRequests != 1000 {
		t.Errorf("expected RateLimitRequests=1000, got %d", cfg.RateLimitRequests)
	}
	if cfg.RateLimitWindow != 60*time.Second {
		t.Errorf("expected RateLimitWindow=60s, got %v", cfg.RateLimitWindow)
	}

	// Test API key defaults
	if cfg.APIKeys != "" {
		t.Errorf("expected APIKeys empty, got %s", cfg.APIKeys)
	}
	if cfg.APIKeyRequired != false {
		t.Errorf("expected APIKeyRequired=false, got %v", cfg.APIKeyRequired)
	}

	// Test EVM defaults
	if cfg.EthRPC != "https://eth.llamarpc.com" {
		t.Errorf("expected EthRPC=https://eth.llamarpc.com, got %s", cfg.EthRPC)
	}
	if cfg.BaseRPC != "https://mainnet.base.org" {
		t.Errorf("expected BaseRPC=https://mainnet.base.org, got %s", cfg.BaseRPC)
	}

	// Test TON defaults
	if cfg.TonRPC != "https://toncenter.com/api/v2/jsonRPC" {
		t.Errorf("expected TonRPC default, got %s", cfg.TonRPC)
	}

	// Test TRON defaults
	if cfg.TronRPC != "https://api.trongrid.io" {
		t.Errorf("expected TronRPC=https://api.trongrid.io, got %s", cfg.TronRPC)
	}

	// Test Solana defaults
	if cfg.SolanaRPC != "https://api.mainnet-beta.solana.com" {
		t.Errorf("expected SolanaRPC default, got %s", cfg.SolanaRPC)
	}
}

func TestLoad_WithEnvVars(t *testing.T) {
	// Set test values
	os.Setenv("PORT", "9090")
	os.Setenv("ENVIRONMENT", "production")
	os.Setenv("REDIS_URL", "redis://redis:6379")
	os.Setenv("RATE_LIMIT_REQUESTS", "500")
	os.Setenv("RATE_LIMIT_WINDOW", "120")
	os.Setenv("API_KEYS", "key1:app1,key2:app2")
	os.Setenv("API_KEY_REQUIRED", "true")
	os.Setenv("EVM_PRIVATE_KEY", "0x1234567890abcdef")
	os.Setenv("ETH_RPC", "https://custom-eth-rpc.com")

	defer func() {
		os.Unsetenv("PORT")
		os.Unsetenv("ENVIRONMENT")
		os.Unsetenv("REDIS_URL")
		os.Unsetenv("RATE_LIMIT_REQUESTS")
		os.Unsetenv("RATE_LIMIT_WINDOW")
		os.Unsetenv("API_KEYS")
		os.Unsetenv("API_KEY_REQUIRED")
		os.Unsetenv("EVM_PRIVATE_KEY")
		os.Unsetenv("ETH_RPC")
	}()

	cfg := Load()

	if cfg.Port != 9090 {
		t.Errorf("expected Port=9090, got %d", cfg.Port)
	}
	if cfg.Environment != "production" {
		t.Errorf("expected Environment=production, got %s", cfg.Environment)
	}
	if cfg.RedisURL != "redis://redis:6379" {
		t.Errorf("expected RedisURL=redis://redis:6379, got %s", cfg.RedisURL)
	}
	if cfg.RateLimitRequests != 500 {
		t.Errorf("expected RateLimitRequests=500, got %d", cfg.RateLimitRequests)
	}
	if cfg.RateLimitWindow != 120*time.Second {
		t.Errorf("expected RateLimitWindow=120s, got %v", cfg.RateLimitWindow)
	}
	if cfg.APIKeys != "key1:app1,key2:app2" {
		t.Errorf("expected APIKeys=key1:app1,key2:app2, got %s", cfg.APIKeys)
	}
	if cfg.APIKeyRequired != true {
		t.Errorf("expected APIKeyRequired=true, got %v", cfg.APIKeyRequired)
	}
	if cfg.EvmPrivateKey != "0x1234567890abcdef" {
		t.Errorf("expected EvmPrivateKey set, got %s", cfg.EvmPrivateKey)
	}
	if cfg.EthRPC != "https://custom-eth-rpc.com" {
		t.Errorf("expected EthRPC=https://custom-eth-rpc.com, got %s", cfg.EthRPC)
	}
}

func TestIsDevelopment(t *testing.T) {
	tests := []struct {
		env      string
		expected bool
	}{
		{"development", true},
		{"production", false},
		{"staging", false},
		{"", false},
	}

	for _, tt := range tests {
		cfg := &Config{Environment: tt.env}
		if got := cfg.IsDevelopment(); got != tt.expected {
			t.Errorf("IsDevelopment() with env=%q: expected %v, got %v", tt.env, tt.expected, got)
		}
	}
}

func TestIsProduction(t *testing.T) {
	tests := []struct {
		env      string
		expected bool
	}{
		{"production", true},
		{"development", false},
		{"staging", false},
		{"", false},
	}

	for _, tt := range tests {
		cfg := &Config{Environment: tt.env}
		if got := cfg.IsProduction(); got != tt.expected {
			t.Errorf("IsProduction() with env=%q: expected %v, got %v", tt.env, tt.expected, got)
		}
	}
}

func TestGetEnv(t *testing.T) {
	// Test with existing env var
	os.Setenv("TEST_VAR", "test_value")
	defer os.Unsetenv("TEST_VAR")

	if got := getEnv("TEST_VAR", "default"); got != "test_value" {
		t.Errorf("getEnv() with existing var: expected test_value, got %s", got)
	}

	// Test with non-existing env var
	if got := getEnv("NON_EXISTING_VAR", "default"); got != "default" {
		t.Errorf("getEnv() with non-existing var: expected default, got %s", got)
	}
}

func TestGetEnvInt(t *testing.T) {
	tests := []struct {
		name     string
		envValue string
		def      int
		expected int
	}{
		{"valid int", "42", 0, 42},
		{"invalid int", "not_a_number", 100, 100},
		{"empty string", "", 50, 50},
		{"negative int", "-10", 0, -10},
		{"zero", "0", 100, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.envValue != "" {
				os.Setenv("TEST_INT", tt.envValue)
				defer os.Unsetenv("TEST_INT")
			} else {
				os.Unsetenv("TEST_INT")
			}

			if got := getEnvInt("TEST_INT", tt.def); got != tt.expected {
				t.Errorf("getEnvInt() = %d, expected %d", got, tt.expected)
			}
		})
	}
}

func TestGetEnvBool(t *testing.T) {
	tests := []struct {
		name     string
		envValue string
		def      bool
		expected bool
	}{
		{"true", "true", false, true},
		{"1", "1", false, true},
		{"yes", "yes", false, true},
		{"false", "false", true, false},
		{"0", "0", true, false},
		{"no", "no", true, false},
		{"empty uses default true", "", true, true},
		{"empty uses default false", "", false, false},
		{"random string is false", "random", true, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.envValue != "" {
				os.Setenv("TEST_BOOL", tt.envValue)
				defer os.Unsetenv("TEST_BOOL")
			} else {
				os.Unsetenv("TEST_BOOL")
			}

			if got := getEnvBool("TEST_BOOL", tt.def); got != tt.expected {
				t.Errorf("getEnvBool() = %v, expected %v", got, tt.expected)
			}
		})
	}
}

func TestCORSDefaults_Development(t *testing.T) {
	// Clear relevant env vars
	os.Unsetenv("ENVIRONMENT")
	os.Unsetenv("CORS_ALLOWED_ORIGINS")
	defer func() {
		os.Unsetenv("ENVIRONMENT")
		os.Unsetenv("CORS_ALLOWED_ORIGINS")
	}()

	cfg := Load()

	// In development (default), CORS should allow all origins
	if cfg.CORSAllowedOrigins != "*" {
		t.Errorf("expected CORS='*' in development, got %s", cfg.CORSAllowedOrigins)
	}
}

func TestCORSDefaults_Production(t *testing.T) {
	// Set production environment without explicit CORS
	os.Setenv("ENVIRONMENT", "production")
	os.Unsetenv("CORS_ALLOWED_ORIGINS")
	defer func() {
		os.Unsetenv("ENVIRONMENT")
		os.Unsetenv("CORS_ALLOWED_ORIGINS")
	}()

	cfg := Load()

	// In production, CORS should default to empty (restrictive)
	if cfg.CORSAllowedOrigins != "" {
		t.Errorf("expected CORS='' in production by default, got %s", cfg.CORSAllowedOrigins)
	}
}

func TestCORSDefaults_ProductionWithExplicitConfig(t *testing.T) {
	// Set production environment with explicit CORS
	os.Setenv("ENVIRONMENT", "production")
	os.Setenv("CORS_ALLOWED_ORIGINS", "https://example.com,https://app.example.com")
	defer func() {
		os.Unsetenv("ENVIRONMENT")
		os.Unsetenv("CORS_ALLOWED_ORIGINS")
	}()

	cfg := Load()

	// Explicit config should be respected
	if cfg.CORSAllowedOrigins != "https://example.com,https://app.example.com" {
		t.Errorf("expected explicit CORS config, got %s", cfg.CORSAllowedOrigins)
	}
}

func TestTimeoutDefaults(t *testing.T) {
	// Clear timeout env vars
	os.Unsetenv("HTTP_READ_TIMEOUT")
	os.Unsetenv("HTTP_WRITE_TIMEOUT")
	os.Unsetenv("HTTP_IDLE_TIMEOUT")
	os.Unsetenv("HTTP_SHUTDOWN_TIMEOUT")

	cfg := Load()

	// Check defaults
	if cfg.ReadTimeout != 30*time.Second {
		t.Errorf("expected ReadTimeout=30s, got %v", cfg.ReadTimeout)
	}
	if cfg.WriteTimeout != 30*time.Second {
		t.Errorf("expected WriteTimeout=30s, got %v", cfg.WriteTimeout)
	}
	if cfg.IdleTimeout != 60*time.Second {
		t.Errorf("expected IdleTimeout=60s, got %v", cfg.IdleTimeout)
	}
	if cfg.ShutdownTimeout != 30*time.Second {
		t.Errorf("expected ShutdownTimeout=30s, got %v", cfg.ShutdownTimeout)
	}
}

func TestTimeoutCustomConfig(t *testing.T) {
	// Set custom timeout values
	os.Setenv("HTTP_READ_TIMEOUT", "15")
	os.Setenv("HTTP_WRITE_TIMEOUT", "45")
	os.Setenv("HTTP_IDLE_TIMEOUT", "120")
	os.Setenv("HTTP_SHUTDOWN_TIMEOUT", "60")
	defer func() {
		os.Unsetenv("HTTP_READ_TIMEOUT")
		os.Unsetenv("HTTP_WRITE_TIMEOUT")
		os.Unsetenv("HTTP_IDLE_TIMEOUT")
		os.Unsetenv("HTTP_SHUTDOWN_TIMEOUT")
	}()

	cfg := Load()

	// Check custom values
	if cfg.ReadTimeout != 15*time.Second {
		t.Errorf("expected ReadTimeout=15s, got %v", cfg.ReadTimeout)
	}
	if cfg.WriteTimeout != 45*time.Second {
		t.Errorf("expected WriteTimeout=45s, got %v", cfg.WriteTimeout)
	}
	if cfg.IdleTimeout != 120*time.Second {
		t.Errorf("expected IdleTimeout=120s, got %v", cfg.IdleTimeout)
	}
	if cfg.ShutdownTimeout != 60*time.Second {
		t.Errorf("expected ShutdownTimeout=60s, got %v", cfg.ShutdownTimeout)
	}
}

func TestMarshalJSON_RedactsSensitiveFields(t *testing.T) {
	cfg := &Config{
		Port:           8080,
		Environment:    "production",
		EvmPrivateKey:  "0xsecretkey123456",
		TonMnemonic:    "word1 word2 word3 word4",
		TronPrivateKey: "tron-secret-key",
		SvmPrivateKey:  "solana-secret-key",
		DatabaseURL:    "postgres://user:pass@localhost/db",
		RedisURL:       "redis://auth:pass@localhost:6379",
		APIKeys:        "key1:app1,key2:app2",
		EthRPC:         "https://eth.llamarpc.com",
	}

	data, err := json.Marshal(cfg)
	if err != nil {
		t.Fatalf("MarshalJSON failed: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("Unmarshal failed: %v", err)
	}

	// Check sensitive fields are redacted
	if result["EvmPrivateKey"] != "[REDACTED]" {
		t.Errorf("expected EvmPrivateKey to be redacted, got %v", result["EvmPrivateKey"])
	}
	if result["TonMnemonic"] != "[REDACTED]" {
		t.Errorf("expected TonMnemonic to be redacted, got %v", result["TonMnemonic"])
	}
	if result["TronPrivateKey"] != "[REDACTED]" {
		t.Errorf("expected TronPrivateKey to be redacted, got %v", result["TronPrivateKey"])
	}
	if result["SvmPrivateKey"] != "[REDACTED]" {
		t.Errorf("expected SvmPrivateKey to be redacted, got %v", result["SvmPrivateKey"])
	}
	if result["DatabaseURL"] != "[REDACTED]" {
		t.Errorf("expected DatabaseURL to be redacted, got %v", result["DatabaseURL"])
	}
	if result["RedisURL"] != "[REDACTED]" {
		t.Errorf("expected RedisURL to be redacted, got %v", result["RedisURL"])
	}
	if result["APIKeys"] != "[REDACTED]" {
		t.Errorf("expected APIKeys to be redacted, got %v", result["APIKeys"])
	}

	// Check non-sensitive fields are not redacted
	if result["EthRPC"] != "https://eth.llamarpc.com" {
		t.Errorf("expected EthRPC to be preserved, got %v", result["EthRPC"])
	}
	if result["Port"] != float64(8080) {
		t.Errorf("expected Port to be preserved, got %v", result["Port"])
	}
}

func TestMarshalJSON_EmptyFieldsNotRedacted(t *testing.T) {
	cfg := &Config{
		Port:        8080,
		Environment: "development",
		// All sensitive fields are empty
	}

	data, err := json.Marshal(cfg)
	if err != nil {
		t.Fatalf("MarshalJSON failed: %v", err)
	}

	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("Unmarshal failed: %v", err)
	}

	// Empty fields should remain empty, not "[REDACTED]"
	if result["EvmPrivateKey"] != "" {
		t.Errorf("expected empty EvmPrivateKey, got %v", result["EvmPrivateKey"])
	}
}

func TestString_HidesSensitiveData(t *testing.T) {
	cfg := &Config{
		EvmPrivateKey: "0xsecretkey",
		TonMnemonic:   "word1 word2",
	}

	str := cfg.String()

	// Should not contain actual values
	if str == "" {
		t.Error("String() returned empty string")
	}
	if str != "[Config: use MarshalJSON for safe output]" {
		t.Errorf("unexpected String() output: %s", str)
	}
}

func TestContainsSensitiveData(t *testing.T) {
	tests := []struct {
		input    string
		expected bool
	}{
		{"privateKey", true},
		{"PRIVATE_KEY", true},
		{"secret_token", true},
		{"password123", true},
		{"mnemonic", true},
		{"seed phrase", true},
		{"token_value", true},
		{"credential", true},
		{"auth_header", true},
		{"public_data", false},
		{"amount", false},
		{"network", false},
		{"address", false},
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			if got := ContainsSensitiveData(tt.input); got != tt.expected {
				t.Errorf("ContainsSensitiveData(%q) = %v, expected %v", tt.input, got, tt.expected)
			}
		})
	}
}

func TestGetEnvFloat(t *testing.T) {
	tests := []struct {
		name     string
		envValue string
		def      float64
		expected float64
	}{
		{"valid float", "0.5", 1.0, 0.5},
		{"integer as float", "1", 0.5, 1.0},
		{"invalid float", "not_a_number", 0.75, 0.75},
		{"empty string", "", 0.25, 0.25},
		{"negative float", "-0.5", 0.0, -0.5},
		{"zero", "0", 1.0, 0.0},
		{"scientific notation", "1e-3", 1.0, 0.001},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.envValue != "" {
				os.Setenv("TEST_FLOAT", tt.envValue)
				defer os.Unsetenv("TEST_FLOAT")
			} else {
				os.Unsetenv("TEST_FLOAT")
			}

			if got := getEnvFloat("TEST_FLOAT", tt.def); got != tt.expected {
				t.Errorf("getEnvFloat() = %v, expected %v", got, tt.expected)
			}
		})
	}
}

func TestOTELConfig(t *testing.T) {
	// Set OTEL env vars
	os.Setenv("OTEL_ENABLED", "true")
	os.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "otel-collector:4317")
	os.Setenv("OTEL_EXPORTER_OTLP_PROTOCOL", "http")
	os.Setenv("OTEL_EXPORTER_OTLP_INSECURE", "false")
	os.Setenv("OTEL_TRACES_SAMPLER_ARG", "0.1")
	defer func() {
		os.Unsetenv("OTEL_ENABLED")
		os.Unsetenv("OTEL_EXPORTER_OTLP_ENDPOINT")
		os.Unsetenv("OTEL_EXPORTER_OTLP_PROTOCOL")
		os.Unsetenv("OTEL_EXPORTER_OTLP_INSECURE")
		os.Unsetenv("OTEL_TRACES_SAMPLER_ARG")
	}()

	cfg := Load()

	if !cfg.OTELEnabled {
		t.Error("expected OTELEnabled=true")
	}
	if cfg.OTELEndpoint != "otel-collector:4317" {
		t.Errorf("expected OTELEndpoint=otel-collector:4317, got %s", cfg.OTELEndpoint)
	}
	if cfg.OTELProtocol != "http" {
		t.Errorf("expected OTELProtocol=http, got %s", cfg.OTELProtocol)
	}
	if cfg.OTELInsecure {
		t.Error("expected OTELInsecure=false")
	}
	if cfg.OTELSampleRate != 0.1 {
		t.Errorf("expected OTELSampleRate=0.1, got %v", cfg.OTELSampleRate)
	}
}

func TestDatabaseConfig(t *testing.T) {
	os.Setenv("DATABASE_URL", "postgres://user:pass@localhost:5432/testdb")
	os.Setenv("DATABASE_MAX_CONNS", "50")
	os.Setenv("DATABASE_IDLE_CONNS", "10")
	os.Setenv("DATABASE_AUTO_MIGRATE", "false")
	defer func() {
		os.Unsetenv("DATABASE_URL")
		os.Unsetenv("DATABASE_MAX_CONNS")
		os.Unsetenv("DATABASE_IDLE_CONNS")
		os.Unsetenv("DATABASE_AUTO_MIGRATE")
	}()

	cfg := Load()

	if cfg.DatabaseURL != "postgres://user:pass@localhost:5432/testdb" {
		t.Errorf("expected DatabaseURL set, got %s", cfg.DatabaseURL)
	}
	if cfg.DatabaseMaxConns != 50 {
		t.Errorf("expected DatabaseMaxConns=50, got %d", cfg.DatabaseMaxConns)
	}
	if cfg.DatabaseIdleConns != 10 {
		t.Errorf("expected DatabaseIdleConns=10, got %d", cfg.DatabaseIdleConns)
	}
	if cfg.DatabaseAutoMigrate {
		t.Error("expected DatabaseAutoMigrate=false")
	}
}

func TestChainRPCConfigs(t *testing.T) {
	// Test Phase 1 networks
	os.Setenv("POLYGON_RPC", "https://custom-polygon.com")
	os.Setenv("MANTLE_RPC", "https://custom-mantle.com")
	os.Setenv("PLASMA_RPC", "https://custom-plasma.com")
	os.Setenv("SEI_RPC", "https://custom-sei.com")
	defer func() {
		os.Unsetenv("POLYGON_RPC")
		os.Unsetenv("MANTLE_RPC")
		os.Unsetenv("PLASMA_RPC")
		os.Unsetenv("SEI_RPC")
	}()

	cfg := Load()

	if cfg.PolygonRPC != "https://custom-polygon.com" {
		t.Errorf("expected custom PolygonRPC, got %s", cfg.PolygonRPC)
	}
	if cfg.MantleRPC != "https://custom-mantle.com" {
		t.Errorf("expected custom MantleRPC, got %s", cfg.MantleRPC)
	}
	if cfg.PlasmaRPC != "https://custom-plasma.com" {
		t.Errorf("expected custom PlasmaRPC, got %s", cfg.PlasmaRPC)
	}
	if cfg.SeiRPC != "https://custom-sei.com" {
		t.Errorf("expected custom SeiRPC, got %s", cfg.SeiRPC)
	}
}

func TestCosmosConfig(t *testing.T) {
	os.Setenv("COSMOS_MAINNET_REST", "https://custom-noble.com")
	os.Setenv("COSMOS_TESTNET_REST", "https://custom-testnet.com")
	os.Setenv("COSMOS_MAINNET_ADDRESS", "noble1abc123")
	os.Setenv("COSMOS_TESTNET_ADDRESS", "noble1xyz789")
	defer func() {
		os.Unsetenv("COSMOS_MAINNET_REST")
		os.Unsetenv("COSMOS_TESTNET_REST")
		os.Unsetenv("COSMOS_MAINNET_ADDRESS")
		os.Unsetenv("COSMOS_TESTNET_ADDRESS")
	}()

	cfg := Load()

	if cfg.CosmosMainnetREST != "https://custom-noble.com" {
		t.Errorf("expected custom CosmosMainnetREST, got %s", cfg.CosmosMainnetREST)
	}
	if cfg.CosmosTestnetREST != "https://custom-testnet.com" {
		t.Errorf("expected custom CosmosTestnetREST, got %s", cfg.CosmosTestnetREST)
	}
	if cfg.CosmosMainnetAddress != "noble1abc123" {
		t.Errorf("expected CosmosMainnetAddress, got %s", cfg.CosmosMainnetAddress)
	}
	if cfg.CosmosTestnetAddress != "noble1xyz789" {
		t.Errorf("expected CosmosTestnetAddress, got %s", cfg.CosmosTestnetAddress)
	}
}
