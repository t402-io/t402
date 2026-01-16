package config

import (
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
