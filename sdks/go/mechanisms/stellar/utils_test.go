package stellar

import (
	"testing"
)

func TestValidateStellarAddress(t *testing.T) {
	tests := []struct {
		name     string
		address  string
		expected bool
	}{
		{
			name:     "valid G-account",
			address:  "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAEANBER24HLOOMVHPZ5GYK",
			expected: true,
		},
		{
			name:     "valid G-account 2",
			address:  "GBDEVU63Y6NTHJQQZIKVTC2LSQLMEAIFYRP2XAJDDQVWRDQJLEVLWM36",
			expected: true,
		},
		{
			name:     "invalid - too short",
			address:  "GAAZI4TCR3TY5",
			expected: false,
		},
		{
			name:     "invalid - empty",
			address:  "",
			expected: false,
		},
		{
			name:     "invalid - wrong prefix",
			address:  "XAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAEANBER24HLOOMVHPZ5GYK",
			expected: false,
		},
		{
			name:     "C-account is not a G-account",
			address:  USDCPubnetAddress,
			expected: false,
		},
		{
			name:     "invalid - lowercase",
			address:  "gaazi4tcr3ty5ojhctjc2a4qsy6cjwjh5iaeanber24hloomvhpz5gyk",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ValidateStellarAddress(tt.address)
			if result != tt.expected {
				t.Errorf("ValidateStellarAddress(%s) = %v, want %v", tt.address, result, tt.expected)
			}
		})
	}
}

func TestValidateStellarContract(t *testing.T) {
	tests := []struct {
		name     string
		address  string
		expected bool
	}{
		{
			name:     "valid C-account pubnet USDC",
			address:  USDCPubnetAddress,
			expected: true,
		},
		{
			name:     "valid C-account testnet USDC",
			address:  USDCTestnetAddress,
			expected: true,
		},
		{
			name:     "invalid - too short",
			address:  "CCW67TSZV3",
			expected: false,
		},
		{
			name:     "invalid - empty",
			address:  "",
			expected: false,
		},
		{
			name:     "G-account is not a C-account",
			address:  "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAEANBER24HLOOMVHPZ5GYK",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ValidateStellarContract(tt.address)
			if result != tt.expected {
				t.Errorf("ValidateStellarContract(%s) = %v, want %v", tt.address, result, tt.expected)
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
			name:        "pubnet",
			network:     StellarPubnetCAIP2,
			expected:    StellarPubnetCAIP2,
			expectError: false,
		},
		{
			name:        "testnet",
			network:     StellarTestnetCAIP2,
			expected:    StellarTestnetCAIP2,
			expectError: false,
		},
		{
			name:        "unsupported network",
			network:     "stellar:unsupported",
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
			decimals:    7,
			expected:    1_000_000_000,
			expectError: false,
		},
		{
			name:        "decimal amount",
			amount:      "1.50",
			decimals:    7,
			expected:    15_000_000,
			expectError: false,
		},
		{
			name:        "small decimal",
			amount:      "0.0000001",
			decimals:    7,
			expected:    1,
			expectError: false,
		},
		{
			name:        "zero amount",
			amount:      "0",
			decimals:    7,
			expected:    0,
			expectError: false,
		},
		{
			name:        "large amount",
			amount:      "1000000",
			decimals:    7,
			expected:    10_000_000_000_000,
			expectError: false,
		},
		{
			name:        "with extra decimal places",
			amount:      "1.12345678",
			decimals:    7,
			expected:    11_234_567,
			expectError: false,
		},
		{
			name:        "invalid format",
			amount:      "not-a-number",
			decimals:    7,
			expected:    0,
			expectError: true,
		},
		{
			name:        "multiple dots",
			amount:      "1.2.3",
			decimals:    7,
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
			amount:   10_000_000,
			decimals: 7,
			expected: "1",
		},
		{
			name:     "decimal result",
			amount:   15_000_000,
			decimals: 7,
			expected: "1.5",
		},
		{
			name:     "small amount",
			amount:   1,
			decimals: 7,
			expected: "0.0000001",
		},
		{
			name:     "zero amount",
			amount:   0,
			decimals: 7,
			expected: "0",
		},
		{
			name:     "large amount",
			amount:   10_000_000_000_000,
			decimals: 7,
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
			name:        "pubnet config",
			network:     StellarPubnetCAIP2,
			expectError: false,
		},
		{
			name:        "testnet config",
			network:     StellarTestnetCAIP2,
			expectError: false,
		},
		{
			name:        "unsupported network",
			network:     "stellar:unsupported",
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
			name:           "USDC by symbol pubnet",
			network:        StellarPubnetCAIP2,
			asset:          "USDC",
			expectedSymbol: "USDC",
			expectError:    false,
		},
		{
			name:           "USDC by address pubnet",
			network:        StellarPubnetCAIP2,
			asset:          USDCPubnetAddress,
			expectedSymbol: "USDC",
			expectError:    false,
		},
		{
			name:           "USDC by symbol testnet",
			network:        StellarTestnetCAIP2,
			asset:          "USDC",
			expectedSymbol: "USDC",
			expectError:    false,
		},
		{
			name:           "unknown token by valid C-account",
			network:        StellarPubnetCAIP2,
			asset:          "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB",
			expectedSymbol: "UNKNOWN",
			expectError:    false,
		},
		{
			name:           "unsupported network",
			network:        "stellar:unsupported",
			asset:          "USDC",
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
			name:     "pubnet is valid",
			network:  StellarPubnetCAIP2,
			expected: true,
		},
		{
			name:     "testnet is valid",
			network:  StellarTestnetCAIP2,
			expected: true,
		},
		{
			name:     "unsupported is invalid",
			network:  "stellar:unsupported",
			expected: false,
		},
		{
			name:     "empty is invalid",
			network:  "",
			expected: false,
		},
		{
			name:     "non-stellar is invalid",
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

func TestValidateXDR(t *testing.T) {
	tests := []struct {
		name        string
		xdr         string
		expectError bool
	}{
		{
			name:        "valid base64",
			xdr:         "AAAAAQAAAAA=",
			expectError: false,
		},
		{
			name:        "empty xdr",
			xdr:         "",
			expectError: true,
		},
		{
			name:        "invalid base64",
			xdr:         "not-valid-base64!!!",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateXDR(tt.xdr)
			if tt.expectError {
				if err == nil {
					t.Errorf("ValidateXDR(%s) expected error, got nil", tt.xdr)
				}
			} else {
				if err != nil {
					t.Errorf("ValidateXDR(%s) unexpected error: %v", tt.xdr, err)
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
			addr1:    USDCPubnetAddress,
			addr2:    USDCPubnetAddress,
			expected: true,
		},
		{
			name:     "different addresses",
			addr1:    USDCPubnetAddress,
			addr2:    USDCTestnetAddress,
			expected: false,
		},
		{
			name:     "case sensitive - different case",
			addr1:    "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAEANBER24HLOOMVHPZ5GYK",
			addr2:    "gaazi4tcr3ty5ojhctjc2a4qsy6cjwjh5iaeanber24hloomvhpz5gyk",
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
			network:  StellarTestnetCAIP2,
			expected: true,
		},
		{
			name:     "pubnet returns false",
			network:  StellarPubnetCAIP2,
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

func TestCalculateMaxLedger(t *testing.T) {
	tests := []struct {
		name           string
		currentLedger  int64
		timeoutSeconds int
		expected       int64
	}{
		{
			name:           "default timeout (60s)",
			currentLedger:  50000000,
			timeoutSeconds: 60,
			expected:       50000012,
		},
		{
			name:           "short timeout (5s = 1 ledger)",
			currentLedger:  50000000,
			timeoutSeconds: 5,
			expected:       50000001,
		},
		{
			name:           "partial ledger (7s = 2 ledgers, ceil)",
			currentLedger:  50000000,
			timeoutSeconds: 7,
			expected:       50000002,
		},
		{
			name:           "long timeout (300s)",
			currentLedger:  50000000,
			timeoutSeconds: 300,
			expected:       50000060,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := CalculateMaxLedger(tt.currentLedger, tt.timeoutSeconds)
			if result != tt.expected {
				t.Errorf("CalculateMaxLedger(%d, %d) = %d, want %d", tt.currentLedger, tt.timeoutSeconds, result, tt.expected)
			}
		})
	}
}

func TestGetNetworkPassphrase(t *testing.T) {
	tests := []struct {
		name        string
		network     string
		expected    string
		expectError bool
	}{
		{
			name:        "pubnet passphrase",
			network:     StellarPubnetCAIP2,
			expected:    PubnetPassphrase,
			expectError: false,
		},
		{
			name:        "testnet passphrase",
			network:     StellarTestnetCAIP2,
			expected:    TestnetPassphrase,
			expectError: false,
		},
		{
			name:        "unsupported network",
			network:     "stellar:unknown",
			expected:    "",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := GetNetworkPassphrase(tt.network)
			if tt.expectError {
				if err == nil {
					t.Errorf("GetNetworkPassphrase(%s) expected error, got nil", tt.network)
				}
			} else {
				if err != nil {
					t.Errorf("GetNetworkPassphrase(%s) unexpected error: %v", tt.network, err)
				}
				if result != tt.expected {
					t.Errorf("GetNetworkPassphrase(%s) = %s, want %s", tt.network, result, tt.expected)
				}
			}
		})
	}
}
