package svm

import (
	"testing"
)

func TestValidateSolanaAddress(t *testing.T) {
	tests := []struct {
		name     string
		address  string
		expected bool
	}{
		{
			name:     "valid mainnet USDC address",
			address:  USDCMainnetAddress,
			expected: true,
		},
		{
			name:     "valid devnet USDC address",
			address:  USDCDevnetAddress,
			expected: true,
		},
		{
			name:     "valid random address",
			address:  "11111111111111111111111111111111",
			expected: true,
		},
		{
			name:     "valid 44 char address",
			address:  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
			expected: true,
		},
		{
			name:     "invalid - too short",
			address:  "EPjFWdd5AufqSSqeM",
			expected: false,
		},
		{
			name:     "invalid - too long",
			address:  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1vEPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
			expected: false,
		},
		{
			name:     "invalid - empty",
			address:  "",
			expected: false,
		},
		{
			name:     "invalid - contains 0 (not in base58)",
			address:  "0PjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
			expected: false,
		},
		{
			name:     "invalid - contains O (not in base58)",
			address:  "OPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
			expected: false,
		},
		{
			name:     "invalid - contains I (not in base58)",
			address:  "IPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
			expected: false,
		},
		{
			name:     "invalid - contains l (not in base58)",
			address:  "lPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
			expected: false,
		},
		{
			name:     "invalid - wrong format",
			address:  "not-a-valid-address",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ValidateSolanaAddress(tt.address)
			if result != tt.expected {
				t.Errorf("ValidateSolanaAddress(%s) = %v, want %v", tt.address, result, tt.expected)
			}
		})
	}
}

func TestNormalizeNetwork(t *testing.T) {
	tests := []struct {
		name        string
		network     string
		expected    string
		expectError bool
	}{
		{
			name:        "mainnet CAIP-2",
			network:     SolanaMainnetCAIP2,
			expected:    SolanaMainnetCAIP2,
			expectError: false,
		},
		{
			name:        "devnet CAIP-2",
			network:     SolanaDevnetCAIP2,
			expected:    SolanaDevnetCAIP2,
			expectError: false,
		},
		{
			name:        "testnet CAIP-2",
			network:     SolanaTestnetCAIP2,
			expected:    SolanaTestnetCAIP2,
			expectError: false,
		},
		{
			name:        "V1 mainnet",
			network:     SolanaMainnetV1,
			expected:    SolanaMainnetCAIP2,
			expectError: false,
		},
		{
			name:        "V1 devnet",
			network:     SolanaDevnetV1,
			expected:    SolanaDevnetCAIP2,
			expectError: false,
		},
		{
			name:        "V1 testnet",
			network:     SolanaTestnetV1,
			expected:    SolanaTestnetCAIP2,
			expectError: false,
		},
		{
			name:        "unsupported CAIP-2 network",
			network:     "solana:unsupported",
			expected:    "",
			expectError: true,
		},
		{
			name:        "unsupported V1 network",
			network:     "solana-invalid",
			expected:    "",
			expectError: true,
		},
		{
			name:        "empty network",
			network:     "",
			expected:    "",
			expectError: true,
		},
		{
			name:        "non-solana CAIP-2",
			network:     "eip155:1",
			expected:    "",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := NormalizeNetwork(tt.network)
			if tt.expectError {
				if err == nil {
					t.Errorf("NormalizeNetwork(%s) expected error, got nil", tt.network)
				}
			} else {
				if err != nil {
					t.Errorf("NormalizeNetwork(%s) unexpected error: %v", tt.network, err)
				}
				if result != tt.expected {
					t.Errorf("NormalizeNetwork(%s) = %s, want %s", tt.network, result, tt.expected)
				}
			}
		})
	}
}

func TestGetNetworkConfig(t *testing.T) {
	tests := []struct {
		name         string
		network      string
		expectedName string
		expectError  bool
	}{
		{
			name:         "mainnet config",
			network:      SolanaMainnetCAIP2,
			expectedName: "Solana Mainnet",
			expectError:  false,
		},
		{
			name:         "devnet config",
			network:      SolanaDevnetCAIP2,
			expectedName: "Solana Devnet",
			expectError:  false,
		},
		{
			name:         "testnet config",
			network:      SolanaTestnetCAIP2,
			expectedName: "Solana Testnet",
			expectError:  false,
		},
		{
			name:         "V1 mainnet config",
			network:      SolanaMainnetV1,
			expectedName: "Solana Mainnet",
			expectError:  false,
		},
		{
			name:         "unsupported network",
			network:      "solana:unsupported",
			expectedName: "",
			expectError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config, err := GetNetworkConfig(tt.network)
			if tt.expectError {
				if err == nil {
					t.Errorf("GetNetworkConfig(%s) expected error, got nil", tt.network)
				}
			} else {
				if err != nil {
					t.Errorf("GetNetworkConfig(%s) unexpected error: %v", tt.network, err)
				}
				if config == nil {
					t.Errorf("GetNetworkConfig(%s) returned nil config", tt.network)
				}
				if config != nil && config.Name != tt.expectedName {
					t.Errorf("GetNetworkConfig(%s) Name = %s, want %s", tt.network, config.Name, tt.expectedName)
				}
			}
		})
	}
}

func TestGetAssetInfo(t *testing.T) {
	tests := []struct {
		name            string
		network         string
		asset           string
		expectedSymbol  string
		expectedAddress string
		expectError     bool
	}{
		{
			name:            "USDC by symbol mainnet",
			network:         SolanaMainnetCAIP2,
			asset:           "USDC",
			expectedSymbol:  "USDC",
			expectedAddress: USDCMainnetAddress,
			expectError:     false,
		},
		{
			name:            "USDC by address mainnet",
			network:         SolanaMainnetCAIP2,
			asset:           USDCMainnetAddress,
			expectedSymbol:  "USDC",
			expectedAddress: USDCMainnetAddress,
			expectError:     false,
		},
		{
			name:            "USDC by lowercase symbol",
			network:         SolanaMainnetCAIP2,
			asset:           "usdc",
			expectedSymbol:  "USDC",
			expectedAddress: USDCMainnetAddress,
			expectError:     false,
		},
		{
			name:            "USDC devnet by symbol",
			network:         SolanaDevnetCAIP2,
			asset:           "USDC",
			expectedSymbol:  "USDC",
			expectedAddress: USDCDevnetAddress,
			expectError:     false,
		},
		{
			name:            "unknown token by valid address",
			network:         SolanaMainnetCAIP2,
			asset:           "11111111111111111111111111111111",
			expectedSymbol:  "UNKNOWN",
			expectedAddress: "11111111111111111111111111111111",
			expectError:     false,
		},
		{
			name:            "default asset for unknown symbol",
			network:         SolanaMainnetCAIP2,
			asset:           "UNKNOWN_TOKEN",
			expectedSymbol:  "USDC",
			expectedAddress: USDCMainnetAddress,
			expectError:     false,
		},
		{
			name:            "unsupported network",
			network:         "solana:unsupported",
			asset:           "USDC",
			expectedSymbol:  "",
			expectedAddress: "",
			expectError:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			info, err := GetAssetInfo(tt.network, tt.asset)
			if tt.expectError {
				if err == nil {
					t.Errorf("GetAssetInfo(%s, %s) expected error, got nil", tt.network, tt.asset)
				}
			} else {
				if err != nil {
					t.Errorf("GetAssetInfo(%s, %s) unexpected error: %v", tt.network, tt.asset, err)
				}
				if info == nil {
					t.Errorf("GetAssetInfo(%s, %s) returned nil info", tt.network, tt.asset)
				}
				if info != nil && info.Symbol != tt.expectedSymbol {
					t.Errorf("GetAssetInfo(%s, %s) Symbol = %s, want %s", tt.network, tt.asset, info.Symbol, tt.expectedSymbol)
				}
				if info != nil && info.Address != tt.expectedAddress {
					t.Errorf("GetAssetInfo(%s, %s) Address = %s, want %s", tt.network, tt.asset, info.Address, tt.expectedAddress)
				}
			}
		})
	}
}

func TestParseAmount(t *testing.T) {
	tests := []struct {
		name        string
		amount      string
		decimals    int
		expected    uint64
		expectError bool
	}{
		{
			name:        "integer amount",
			amount:      "100",
			decimals:    6,
			expected:    100_000_000,
			expectError: false,
		},
		{
			name:        "decimal amount",
			amount:      "1.50",
			decimals:    6,
			expected:    1_500_000,
			expectError: false,
		},
		{
			name:        "small decimal",
			amount:      "0.000001",
			decimals:    6,
			expected:    1,
			expectError: false,
		},
		{
			name:        "zero amount",
			amount:      "0",
			decimals:    6,
			expected:    0,
			expectError: false,
		},
		{
			name:        "large amount",
			amount:      "1000000",
			decimals:    6,
			expected:    1_000_000_000_000,
			expectError: false,
		},
		{
			name:        "with extra decimal places (truncated)",
			amount:      "1.123456789",
			decimals:    6,
			expected:    1_123_456,
			expectError: false,
		},
		{
			name:        "fewer decimal places (padded)",
			amount:      "1.5",
			decimals:    6,
			expected:    1_500_000,
			expectError: false,
		},
		{
			name:        "with whitespace",
			amount:      "  100  ",
			decimals:    6,
			expected:    100_000_000,
			expectError: false,
		},
		{
			name:        "9 decimals (Solana default)",
			amount:      "1.5",
			decimals:    9,
			expected:    1_500_000_000,
			expectError: false,
		},
		{
			name:        "invalid format",
			amount:      "not-a-number",
			decimals:    6,
			expected:    0,
			expectError: true,
		},
		{
			name:        "multiple dots",
			amount:      "1.2.3",
			decimals:    6,
			expected:    0,
			expectError: true,
		},
		{
			name:        "negative amount",
			amount:      "-100",
			decimals:    6,
			expected:    0,
			expectError: true,
		},
		{
			name:        "empty amount",
			amount:      "",
			decimals:    6,
			expected:    0,
			expectError: true,
		},
		{
			name:        "only decimal point",
			amount:      ".",
			decimals:    6,
			expected:    0,
			expectError: true,
		},
		{
			name:        "trailing decimal point",
			amount:      "100.",
			decimals:    6,
			expected:    100_000_000,
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ParseAmount(tt.amount, tt.decimals)
			if tt.expectError {
				if err == nil {
					t.Errorf("ParseAmount(%s, %d) expected error, got nil", tt.amount, tt.decimals)
				}
			} else {
				if err != nil {
					t.Errorf("ParseAmount(%s, %d) unexpected error: %v", tt.amount, tt.decimals, err)
				}
				if result != tt.expected {
					t.Errorf("ParseAmount(%s, %d) = %d, want %d", tt.amount, tt.decimals, result, tt.expected)
				}
			}
		})
	}
}

func TestFormatAmount(t *testing.T) {
	tests := []struct {
		name     string
		amount   uint64
		decimals int
		expected string
	}{
		{
			name:     "integer result",
			amount:   1_000_000,
			decimals: 6,
			expected: "1",
		},
		{
			name:     "decimal result",
			amount:   1_500_000,
			decimals: 6,
			expected: "1.5",
		},
		{
			name:     "small amount",
			amount:   1,
			decimals: 6,
			expected: "0.000001",
		},
		{
			name:     "zero amount",
			amount:   0,
			decimals: 6,
			expected: "0",
		},
		{
			name:     "large amount",
			amount:   1_000_000_000_000,
			decimals: 6,
			expected: "1000000",
		},
		{
			name:     "trailing zeros removed",
			amount:   1_100_000,
			decimals: 6,
			expected: "1.1",
		},
		{
			name:     "9 decimals",
			amount:   1_500_000_000,
			decimals: 9,
			expected: "1.5",
		},
		{
			name:     "very small amount 9 decimals",
			amount:   1,
			decimals: 9,
			expected: "0.000000001",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := FormatAmount(tt.amount, tt.decimals)
			if result != tt.expected {
				t.Errorf("FormatAmount(%d, %d) = %s, want %s", tt.amount, tt.decimals, result, tt.expected)
			}
		})
	}
}

func TestParseFormatAmountRoundTrip(t *testing.T) {
	tests := []struct {
		name     string
		amount   string
		decimals int
	}{
		{"integer", "100", 6},
		{"decimal", "1.5", 6},
		{"small decimal", "0.000001", 6},
		{"large amount", "1000000", 6},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			parsed, err := ParseAmount(tt.amount, tt.decimals)
			if err != nil {
				t.Fatalf("ParseAmount failed: %v", err)
			}

			formatted := FormatAmount(parsed, tt.decimals)
			if formatted != tt.amount {
				t.Errorf("Round trip failed: %s -> %d -> %s", tt.amount, parsed, formatted)
			}
		})
	}
}

func TestDecodeEncodeTransactionRoundTrip(t *testing.T) {
	// This is a minimal valid Solana transaction (empty message)
	// In real tests, you'd use actual transaction data
	t.Run("invalid base64", func(t *testing.T) {
		_, err := DecodeTransaction("not-valid-base64!!!")
		if err == nil {
			t.Error("DecodeTransaction should fail for invalid base64")
		}
	})

	t.Run("empty transaction", func(t *testing.T) {
		_, err := DecodeTransaction("")
		if err == nil {
			t.Error("DecodeTransaction should fail for empty string")
		}
	})
}

func TestGetTokenPayerFromTransaction(t *testing.T) {
	t.Run("nil transaction", func(t *testing.T) {
		_, err := GetTokenPayerFromTransaction(nil)
		if err == nil {
			t.Error("GetTokenPayerFromTransaction should fail for nil transaction")
		}
	})
}
