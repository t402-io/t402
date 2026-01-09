package tron

import (
	"testing"
)

func TestValidateTronAddress(t *testing.T) {
	tests := []struct {
		name     string
		address  string
		expected bool
	}{
		{
			name:     "valid mainnet USDT address",
			address:  USDTMainnetAddress,
			expected: true,
		},
		{
			name:     "valid nile USDT address",
			address:  USDTNileAddress,
			expected: true,
		},
		{
			name:     "valid shasta USDT address",
			address:  USDTShastaAddress,
			expected: true,
		},
		{
			name:     "valid address starting with T",
			address:  "TJYPgMHqGBqbjmgcDxBQEL1PPxbRvnLBKY",
			expected: true,
		},
		{
			name:     "invalid - too short",
			address:  "TR7NHqjeKQxGTCi",
			expected: false,
		},
		{
			name:     "invalid - too long",
			address:  "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6tXXXXX",
			expected: false,
		},
		{
			name:     "invalid - empty",
			address:  "",
			expected: false,
		},
		{
			name:     "invalid - wrong prefix",
			address:  "0R7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
			expected: false,
		},
		{
			name:     "invalid - contains invalid base58 char (0)",
			address:  "T07NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
			expected: false,
		},
		{
			name:     "invalid - contains invalid base58 char (O)",
			address:  "TOONHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
			expected: false,
		},
		{
			name:     "invalid - contains invalid base58 char (I)",
			address:  "TI7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
			expected: false,
		},
		{
			name:     "invalid - contains invalid base58 char (l)",
			address:  "Tl7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ValidateTronAddress(tt.address)
			if result != tt.expected {
				t.Errorf("ValidateTronAddress(%s) = %v, want %v", tt.address, result, tt.expected)
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
			name:        "mainnet caip2",
			network:     TronMainnetCAIP2,
			expected:    TronMainnetCAIP2,
			expectError: false,
		},
		{
			name:        "nile caip2",
			network:     TronNileCAIP2,
			expected:    TronNileCAIP2,
			expectError: false,
		},
		{
			name:        "shasta caip2",
			network:     TronShastaCAIP2,
			expected:    TronShastaCAIP2,
			expectError: false,
		},
		{
			name:        "shorthand mainnet",
			network:     "mainnet",
			expected:    TronMainnetCAIP2,
			expectError: false,
		},
		{
			name:        "shorthand tron",
			network:     "tron",
			expected:    TronMainnetCAIP2,
			expectError: false,
		},
		{
			name:        "shorthand nile",
			network:     "nile",
			expected:    TronNileCAIP2,
			expectError: false,
		},
		{
			name:        "shorthand shasta",
			network:     "shasta",
			expected:    TronShastaCAIP2,
			expectError: false,
		},
		{
			name:        "unsupported network",
			network:     "tron:unsupported",
			expected:    "",
			expectError: true,
		},
		{
			name:        "empty network",
			network:     "",
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
			name:        "with extra decimal places truncated",
			amount:      "1.123456789",
			decimals:    6,
			expected:    1_123_456,
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
			name:        "with whitespace",
			amount:      "  100  ",
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

func TestGetNetworkConfig(t *testing.T) {
	tests := []struct {
		name        string
		network     string
		expectError bool
	}{
		{
			name:        "mainnet config",
			network:     TronMainnetCAIP2,
			expectError: false,
		},
		{
			name:        "nile config",
			network:     TronNileCAIP2,
			expectError: false,
		},
		{
			name:        "shasta config",
			network:     TronShastaCAIP2,
			expectError: false,
		},
		{
			name:        "unsupported network",
			network:     "tron:unsupported",
			expectError: true,
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
				if config != nil && config.CAIP2 != tt.network {
					t.Errorf("GetNetworkConfig(%s) CAIP2 = %s, want %s", tt.network, config.CAIP2, tt.network)
				}
			}
		})
	}
}

func TestGetAssetInfo(t *testing.T) {
	tests := []struct {
		name           string
		network        string
		asset          string
		expectedSymbol string
		expectError    bool
	}{
		{
			name:           "USDT by symbol mainnet",
			network:        TronMainnetCAIP2,
			asset:          "USDT",
			expectedSymbol: "USDT",
			expectError:    false,
		},
		{
			name:           "USDT by address mainnet",
			network:        TronMainnetCAIP2,
			asset:          USDTMainnetAddress,
			expectedSymbol: "USDT",
			expectError:    false,
		},
		{
			name:           "USDT by symbol nile",
			network:        TronNileCAIP2,
			asset:          "USDT",
			expectedSymbol: "USDT",
			expectError:    false,
		},
		{
			name:           "USDT by address nile",
			network:        TronNileCAIP2,
			asset:          USDTNileAddress,
			expectedSymbol: "USDT",
			expectError:    false,
		},
		{
			name:           "unknown token by valid address",
			network:        TronMainnetCAIP2,
			asset:          "TJYPgMHqGBqbjmgcDxBQEL1PPxbRvnLBKY",
			expectedSymbol: "UNKNOWN",
			expectError:    false,
		},
		{
			name:           "unsupported network",
			network:        "tron:unsupported",
			asset:          "USDT",
			expectedSymbol: "",
			expectError:    true,
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
			}
		})
	}
}

func TestIsValidNetwork(t *testing.T) {
	tests := []struct {
		name     string
		network  string
		expected bool
	}{
		{
			name:     "mainnet is valid",
			network:  TronMainnetCAIP2,
			expected: true,
		},
		{
			name:     "nile is valid",
			network:  TronNileCAIP2,
			expected: true,
		},
		{
			name:     "shasta is valid",
			network:  TronShastaCAIP2,
			expected: true,
		},
		{
			name:     "unsupported is invalid",
			network:  "tron:unsupported",
			expected: false,
		},
		{
			name:     "empty is invalid",
			network:  "",
			expected: false,
		},
		{
			name:     "non-tron is invalid",
			network:  "eip155:1",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsValidNetwork(tt.network)
			if result != tt.expected {
				t.Errorf("IsValidNetwork(%s) = %v, want %v", tt.network, result, tt.expected)
			}
		})
	}
}

func TestIsValidHex(t *testing.T) {
	tests := []struct {
		name     string
		hex      string
		expected bool
	}{
		{
			name:     "valid hex",
			hex:      "a9059cbb",
			expected: true,
		},
		{
			name:     "valid hex with 0x prefix",
			hex:      "0xa9059cbb",
			expected: true,
		},
		{
			name:     "valid hex uppercase",
			hex:      "A9059CBB",
			expected: true,
		},
		{
			name:     "empty hex",
			hex:      "",
			expected: false,
		},
		{
			name:     "only 0x prefix",
			hex:      "0x",
			expected: false,
		},
		{
			name:     "invalid characters",
			hex:      "xyz123",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsValidHex(tt.hex)
			if result != tt.expected {
				t.Errorf("IsValidHex(%s) = %v, want %v", tt.hex, result, tt.expected)
			}
		})
	}
}

func TestAddressesEqual(t *testing.T) {
	tests := []struct {
		name     string
		addr1    string
		addr2    string
		expected bool
	}{
		{
			name:     "same address",
			addr1:    USDTMainnetAddress,
			addr2:    USDTMainnetAddress,
			expected: true,
		},
		{
			name:     "different addresses",
			addr1:    USDTMainnetAddress,
			addr2:    USDTNileAddress,
			expected: false,
		},
		{
			name:     "empty first address",
			addr1:    "",
			addr2:    USDTMainnetAddress,
			expected: false,
		},
		{
			name:     "empty second address",
			addr1:    USDTMainnetAddress,
			addr2:    "",
			expected: false,
		},
		{
			name:     "both empty",
			addr1:    "",
			addr2:    "",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := AddressesEqual(tt.addr1, tt.addr2)
			if result != tt.expected {
				t.Errorf("AddressesEqual(%s, %s) = %v, want %v", tt.addr1, tt.addr2, result, tt.expected)
			}
		})
	}
}

func TestIsTestnet(t *testing.T) {
	tests := []struct {
		name     string
		network  string
		expected bool
	}{
		{
			name:     "nile returns true",
			network:  TronNileCAIP2,
			expected: true,
		},
		{
			name:     "shasta returns true",
			network:  TronShastaCAIP2,
			expected: true,
		},
		{
			name:     "mainnet returns false",
			network:  TronMainnetCAIP2,
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsTestnet(tt.network)
			if result != tt.expected {
				t.Errorf("IsTestnet(%s) = %v, want %v", tt.network, result, tt.expected)
			}
		})
	}
}

func TestFormatAddress(t *testing.T) {
	tests := []struct {
		name     string
		address  string
		truncate int
		expected string
	}{
		{
			name:     "no truncation",
			address:  USDTMainnetAddress,
			truncate: 0,
			expected: USDTMainnetAddress,
		},
		{
			name:     "truncate 6 chars",
			address:  "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
			truncate: 6,
			expected: "TR7NHq...gjLj6t",
		},
		{
			name:     "empty address",
			address:  "",
			truncate: 6,
			expected: "",
		},
		{
			name:     "truncate larger than address",
			address:  "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
			truncate: 20,
			expected: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := FormatAddress(tt.address, tt.truncate)
			if result != tt.expected {
				t.Errorf("FormatAddress(%s, %d) = %s, want %s", tt.address, tt.truncate, result, tt.expected)
			}
		})
	}
}

func TestEstimateTransactionFee(t *testing.T) {
	tests := []struct {
		name        string
		isActivated bool
		expected    int64
	}{
		{
			name:        "activated account",
			isActivated: true,
			expected:    30_000_000, // 30 TRX
		},
		{
			name:        "not activated account",
			isActivated: false,
			expected:    31_000_000, // 30 TRX + 1 TRX activation
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := EstimateTransactionFee(tt.isActivated)
			if result != tt.expected {
				t.Errorf("EstimateTransactionFee(%v) = %d, want %d", tt.isActivated, result, tt.expected)
			}
		})
	}
}
