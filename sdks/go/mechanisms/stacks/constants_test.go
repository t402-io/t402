package stacks

import (
	"testing"
)

func TestGetNetworkConfig(t *testing.T) {
	tests := []struct {
		name    string
		network string
		wantErr bool
		wantCfg string
	}{
		{
			name:    "mainnet",
			network: StacksMainnetCAIP2,
			wantErr: false,
			wantCfg: "Stacks Mainnet",
		},
		{
			name:    "testnet",
			network: StacksTestnetCAIP2,
			wantErr: false,
			wantCfg: "Stacks Testnet",
		},
		{
			name:    "unknown network",
			network: "stacks:99999",
			wantErr: true,
		},
		{
			name:    "non-stacks network",
			network: "eip155:1",
			wantErr: true,
		},
		{
			name:    "empty string",
			network: "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config, err := GetNetworkConfig(tt.network)
			if tt.wantErr {
				if err == nil {
					t.Errorf("GetNetworkConfig(%s) expected error, got nil", tt.network)
				}
				return
			}
			if err != nil {
				t.Fatalf("GetNetworkConfig(%s) unexpected error: %v", tt.network, err)
			}
			if config.Name != tt.wantCfg {
				t.Errorf("GetNetworkConfig(%s).Name = %v, want %v", tt.network, config.Name, tt.wantCfg)
			}
		})
	}
}

func TestGetNetworkConfig_MainnetDetails(t *testing.T) {
	config, err := GetNetworkConfig(StacksMainnetCAIP2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if config.CAIP2 != StacksMainnetCAIP2 {
		t.Errorf("CAIP2 = %v, want %v", config.CAIP2, StacksMainnetCAIP2)
	}
	if config.ApiURL != DefaultHiroMainnetAPI {
		t.Errorf("ApiURL = %v, want %v", config.ApiURL, DefaultHiroMainnetAPI)
	}
	if config.IsTestnet {
		t.Error("IsTestnet should be false for mainnet")
	}
	if config.DefaultToken.Symbol != "sUSDC" {
		t.Errorf("DefaultToken.Symbol = %v, want sUSDC", config.DefaultToken.Symbol)
	}
	if config.DefaultToken.Decimals != 6 {
		t.Errorf("DefaultToken.Decimals = %v, want 6", config.DefaultToken.Decimals)
	}
	if config.DefaultToken.ContractAddress != "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc" {
		t.Errorf("DefaultToken.ContractAddress = %v, want mainnet contract", config.DefaultToken.ContractAddress)
	}
}

func TestGetNetworkConfig_TestnetDetails(t *testing.T) {
	config, err := GetNetworkConfig(StacksTestnetCAIP2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if config.CAIP2 != StacksTestnetCAIP2 {
		t.Errorf("CAIP2 = %v, want %v", config.CAIP2, StacksTestnetCAIP2)
	}
	if config.ApiURL != DefaultHiroTestnetAPI {
		t.Errorf("ApiURL = %v, want %v", config.ApiURL, DefaultHiroTestnetAPI)
	}
	if !config.IsTestnet {
		t.Error("IsTestnet should be true for testnet")
	}
	if config.DefaultToken.ContractAddress != "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.token-susdc" {
		t.Errorf("DefaultToken.ContractAddress = %v, want testnet contract", config.DefaultToken.ContractAddress)
	}
}

func TestIsStacksNetwork(t *testing.T) {
	tests := []struct {
		name    string
		network string
		want    bool
	}{
		{"mainnet", StacksMainnetCAIP2, true},
		{"testnet", StacksTestnetCAIP2, true},
		{"arbitrary stacks", "stacks:12345", true},
		{"evm network", "eip155:1", false},
		{"solana network", "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", false},
		{"empty string", "", false},
		{"just stacks", "stacks", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsStacksNetwork(tt.network)
			if got != tt.want {
				t.Errorf("IsStacksNetwork(%v) = %v, want %v", tt.network, got, tt.want)
			}
		})
	}
}

func TestIsValidPrincipal(t *testing.T) {
	tests := []struct {
		name    string
		address string
		want    bool
	}{
		{"valid mainnet principal", "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K", true},
		{"valid testnet principal", "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", true},
		{"empty string", "", false},
		{"lowercase not valid", "sp3y2zsh8p7d50b0vbtsx11s7xsg24m1vb9yfqa4k", false},
		{"ethereum address", "0x1234567890abcdef1234567890abcdef12345678", false},
		{"too short", "SP1234", false},
		{"no prefix", "3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K", false},
		{"invalid prefix", "XX3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsValidPrincipal(tt.address)
			if got != tt.want {
				t.Errorf("IsValidPrincipal(%v) = %v, want %v", tt.address, got, tt.want)
			}
		})
	}
}

func TestIsValidTxId(t *testing.T) {
	tests := []struct {
		name string
		txId string
		want bool
	}{
		{
			name: "valid tx id",
			txId: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			want: true,
		},
		{
			name: "valid tx id uppercase",
			txId: "0xABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890",
			want: true,
		},
		{
			name: "empty string",
			txId: "",
			want: false,
		},
		{
			name: "no 0x prefix",
			txId: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			want: false,
		},
		{
			name: "too short",
			txId: "0x1234",
			want: false,
		},
		{
			name: "too long",
			txId: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef00",
			want: false,
		},
		{
			name: "invalid hex chars",
			txId: "0xzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz",
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsValidTxId(tt.txId)
			if got != tt.want {
				t.Errorf("IsValidTxId(%v) = %v, want %v", tt.txId, got, tt.want)
			}
		})
	}
}

func TestCompareAddresses(t *testing.T) {
	tests := []struct {
		name  string
		addr1 string
		addr2 string
		want  bool
	}{
		{"same mainnet addresses", "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K", "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K", true},
		{"same testnet addresses", "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", true},
		{"different addresses", "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K", "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", false},
		{"empty vs non-empty", "", "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K", false},
		{"both empty", "", "", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CompareAddresses(tt.addr1, tt.addr2)
			if got != tt.want {
				t.Errorf("CompareAddresses(%v, %v) = %v, want %v", tt.addr1, tt.addr2, got, tt.want)
			}
		})
	}
}
