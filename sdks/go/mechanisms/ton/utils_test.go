package ton

import (
	"testing"
)

func TestValidateTonAddress(t *testing.T) {
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
			name:     "valid testnet USDT address",
			address:  USDTTestnetAddress,
			expected: true,
		},
		{
			name:     "valid raw address",
			address:  "0:83dfe8d4c9b8e8d3e8d3c8d3e8d3c8d3e8d3c8d3e8d3c8d3e8d3c8d3e8d3c8d3",
			expected: true,
		},
		{
			name:     "invalid - too short",
			address:  "EQCxE6mUtQJK",
			expected: false,
		},
		{
			name:     "invalid - empty",
			address:  "",
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
			result := ValidateTonAddress(tt.address)
			if result != tt.expected {
				t.Errorf("ValidateTonAddress(%s) = %v, want %v", tt.address, result, tt.expected)
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
			name:        "mainnet",
			network:     TonMainnetCAIP2,
			expected:    TonMainnetCAIP2,
			expectError: false,
		},
		{
			name:        "testnet",
			network:     TonTestnetCAIP2,
			expected:    TonTestnetCAIP2,
			expectError: false,
		},
		{
			name:        "unsupported network",
			network:     "ton:unsupported",
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
			name:        "with extra decimal places",
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
			network:     TonMainnetCAIP2,
			expectError: false,
		},
		{
			name:        "testnet config",
			network:     TonTestnetCAIP2,
			expectError: false,
		},
		{
			name:        "unsupported network",
			network:     "ton:unsupported",
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
			network:        TonMainnetCAIP2,
			asset:          "USDT",
			expectedSymbol: "USDT",
			expectError:    false,
		},
		{
			name:           "USDT by address mainnet",
			network:        TonMainnetCAIP2,
			asset:          USDTMainnetAddress,
			expectedSymbol: "USDT",
			expectError:    false,
		},
		{
			name:           "USDT by symbol testnet",
			network:        TonTestnetCAIP2,
			asset:          "USDT",
			expectedSymbol: "USDT",
			expectError:    false,
		},
		{
			name:           "unknown token by valid address",
			network:        TonMainnetCAIP2,
			asset:          "EQDxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_xxx",
			expectedSymbol: "UNKNOWN",
			expectError:    false,
		},
		{
			name:           "unsupported network",
			network:        "ton:unsupported",
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
			network:  TonMainnetCAIP2,
			expected: true,
		},
		{
			name:     "testnet is valid",
			network:  TonTestnetCAIP2,
			expected: true,
		},
		{
			name:     "unsupported is invalid",
			network:  "ton:unsupported",
			expected: false,
		},
		{
			name:     "empty is invalid",
			network:  "",
			expected: false,
		},
		{
			name:     "non-ton is invalid",
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

func TestValidateBoc(t *testing.T) {
	tests := []struct {
		name        string
		boc         string
		expectError bool
	}{
		{
			name:        "valid base64",
			boc:         "dGVzdCBib2MgZGF0YQ==",
			expectError: false,
		},
		{
			name:        "empty boc",
			boc:         "",
			expectError: true,
		},
		{
			name:        "invalid base64",
			boc:         "not-valid-base64!!!",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateBoc(tt.boc)
			if tt.expectError {
				if err == nil {
					t.Errorf("ValidateBoc(%s) expected error, got nil", tt.boc)
				}
			} else {
				if err != nil {
					t.Errorf("ValidateBoc(%s) unexpected error: %v", tt.boc, err)
				}
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
			name:     "different case",
			addr1:    "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
			addr2:    "eqcxe6mutqjkfngfarotkot1lzbdiix1kcixrv7nw2id_sds",
			expected: true,
		},
		{
			name:     "different addresses",
			addr1:    USDTMainnetAddress,
			addr2:    USDTTestnetAddress,
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
			name:     "testnet returns true",
			network:  TonTestnetCAIP2,
			expected: true,
		},
		{
			name:     "mainnet returns false",
			network:  TonMainnetCAIP2,
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
