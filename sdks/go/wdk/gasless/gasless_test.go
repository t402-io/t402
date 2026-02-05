package gasless

import (
	"math/big"
	"testing"
)

func TestIsGaslessNetwork(t *testing.T) {
	tests := []struct {
		network  string
		expected bool
	}{
		{"ethereum", true},
		{"base", true},
		{"arbitrum", true},
		{"optimism", true},
		{"polygon", true},
		{"avalanche", true},
		{"bitcoin", false},
		{"solana", false},
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.network, func(t *testing.T) {
			result := IsGaslessNetwork(tt.network)
			if result != tt.expected {
				t.Errorf("IsGaslessNetwork(%q) = %v, want %v", tt.network, result, tt.expected)
			}
		})
	}
}

func TestGetTokenAddress(t *testing.T) {
	tests := []struct {
		network string
		token   string
		wantOk  bool
	}{
		{"ethereum", "USDT0", true},
		{"arbitrum", "USDT0", true},
		{"ethereum", "USDC", true},
		{"base", "USDC", true},
		{"ethereum", "UNKNOWN", false},
		{"unknown", "USDT0", false},
	}

	for _, tt := range tests {
		t.Run(tt.network+"/"+tt.token, func(t *testing.T) {
			addr, ok := GetTokenAddress(tt.network, tt.token)
			if ok != tt.wantOk {
				t.Errorf("GetTokenAddress(%q, %q) ok = %v, want %v", tt.network, tt.token, ok, tt.wantOk)
			}
			if ok && addr == "" {
				t.Error("expected non-empty address when ok=true")
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
		BundlerURL: "https://bundler.example.com",
		PrivateKey: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
	})

	if client == nil {
		t.Fatal("NewClient returned nil")
	}
}

func TestHashUserOperation(t *testing.T) {
	userOp := UserOperation{
		Sender:               "0x1234567890123456789012345678901234567890",
		Nonce:                "0x0",
		InitCode:             "0x",
		CallData:             "0x",
		CallGasLimit:         "0x186a0",
		VerificationGasLimit: "0x186a0",
		PreVerificationGas:   "0xc350",
		MaxFeePerGas:         "0x3b9aca00",
		MaxPriorityFeePerGas: "0x5f5e100",
		PaymasterAndData:     "0x",
		Signature:            "0x",
	}

	hash, err := hashUserOperation(userOp, 1)
	if err != nil {
		t.Fatalf("hashUserOperation() error = %v", err)
	}
	if len(hash) != 32 {
		t.Errorf("hashUserOperation() returned %d bytes, want 32", len(hash))
	}
}
