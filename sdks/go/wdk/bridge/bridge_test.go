package bridge

import (
	"math/big"
	"testing"
)

func TestIsBridgeableChain(t *testing.T) {
	tests := []struct {
		chain    string
		expected bool
	}{
		{"ethereum", true},
		{"arbitrum", true},
		{"ink", true},
		{"berachain", true},
		{"unichain", true},
		{"bitcoin", false},
		{"solana", false},
		{"base", false},
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.chain, func(t *testing.T) {
			result := IsBridgeableChain(tt.chain)
			if result != tt.expected {
				t.Errorf("IsBridgeableChain(%q) = %v, want %v", tt.chain, result, tt.expected)
			}
		})
	}
}

func TestGetExplorerTxURL(t *testing.T) {
	url := GetExplorerTxURL("ethereum", "0xabc123")
	expected := "https://etherscan.io/tx/0xabc123"
	if url != expected {
		t.Errorf("GetExplorerTxURL() = %q, want %q", url, expected)
	}

	url = GetExplorerTxURL("unknown", "0xabc123")
	if url != "" {
		t.Errorf("GetExplorerTxURL() for unknown network = %q, want empty", url)
	}
}

func TestFormatTokenAmount(t *testing.T) {
	tests := []struct {
		name     string
		amount   *big.Int
		decimals int
		expected string
	}{
		{"zero", big.NewInt(0), 6, "0"},
		{"nil", nil, 6, "0"},
		{"one usdt", big.NewInt(1000000), 6, "1"},
		{"fractional", big.NewInt(1500000), 6, "1.5"},
		{"small", big.NewInt(1), 6, "0.000001"},
		{"native eth", new(big.Int).Mul(big.NewInt(1), new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)), 18, "1"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := FormatTokenAmount(tt.amount, tt.decimals)
			if result != tt.expected {
				t.Errorf("FormatTokenAmount() = %q, want %q", result, tt.expected)
			}
		})
	}
}

func TestParseTokenAmount(t *testing.T) {
	tests := []struct {
		amount   string
		decimals int
		expected *big.Int
		wantErr  bool
	}{
		{"1", 6, big.NewInt(1000000), false},
		{"1.5", 6, big.NewInt(1500000), false},
		{"0.000001", 6, big.NewInt(1), false},
		{"100", 6, big.NewInt(100000000), false},
		{"abc", 6, nil, true},
	}

	for _, tt := range tests {
		t.Run(tt.amount, func(t *testing.T) {
			result, err := ParseTokenAmount(tt.amount, tt.decimals)
			if (err != nil) != tt.wantErr {
				t.Errorf("ParseTokenAmount(%q) error = %v, wantErr %v", tt.amount, err, tt.wantErr)
				return
			}
			if !tt.wantErr && result.Cmp(tt.expected) != 0 {
				t.Errorf("ParseTokenAmount(%q) = %s, want %s", tt.amount, result, tt.expected)
			}
		})
	}
}

func TestNewClient(t *testing.T) {
	client := NewClient(Config{
		PrivateKey: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
	})

	if client == nil {
		t.Fatal("NewClient returned nil")
	}
}

func TestLayerZeroEndpointIDs(t *testing.T) {
	// Verify all bridgeable chains have endpoint IDs
	for _, chain := range BridgeableChains {
		if _, ok := LayerZeroEndpointIDs[chain]; !ok {
			t.Errorf("bridgeable chain %q missing LayerZero endpoint ID", chain)
		}
	}
}

func TestUSDT0Addresses(t *testing.T) {
	// Verify all bridgeable chains have USDT0 addresses
	for _, chain := range BridgeableChains {
		addr, ok := USDT0Addresses[chain]
		if !ok {
			t.Errorf("bridgeable chain %q missing USDT0 address", chain)
		}
		if ok && addr == "" {
			t.Errorf("bridgeable chain %q has empty USDT0 address", chain)
		}
	}
}
