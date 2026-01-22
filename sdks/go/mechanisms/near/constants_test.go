package near

import (
	"strings"
	"testing"
)

func TestSchemeConstants(t *testing.T) {
	if SchemeExactDirect != "exact-direct" {
		t.Errorf("SchemeExactDirect = %v, want exact-direct", SchemeExactDirect)
	}
}

func TestCAIP2Identifiers(t *testing.T) {
	tests := []struct {
		name  string
		caip2 string
		want  string
	}{
		{
			name:  "NEAR Mainnet",
			caip2: NearMainnetCAIP2,
			want:  "near:mainnet",
		},
		{
			name:  "NEAR Testnet",
			caip2: NearTestnetCAIP2,
			want:  "near:testnet",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.caip2 != tt.want {
				t.Errorf("%v = %v, want %v", tt.name, tt.caip2, tt.want)
			}
			if !strings.HasPrefix(tt.caip2, "near:") {
				t.Errorf("CAIP-2 identifier %v should start with 'near:'", tt.caip2)
			}
		})
	}
}

func TestRPCEndpoints(t *testing.T) {
	tests := []struct {
		name string
		url  string
	}{
		{"NEAR Mainnet RPC", NearMainnetRPC},
		{"NEAR Testnet RPC", NearTestnetRPC},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if !strings.HasPrefix(tt.url, "https://") {
				t.Errorf("%v should use HTTPS protocol, got %v", tt.name, tt.url)
			}
			if !strings.Contains(tt.url, ".near.org") {
				t.Errorf("%v should use near.org domain, got %v", tt.name, tt.url)
			}
		})
	}
}

func TestNEP141Constants(t *testing.T) {
	if FunctionFtTransfer != "ft_transfer" {
		t.Errorf("FunctionFtTransfer = %v, want ft_transfer", FunctionFtTransfer)
	}
	if FunctionFtBalanceOf != "ft_balance_of" {
		t.Errorf("FunctionFtBalanceOf = %v, want ft_balance_of", FunctionFtBalanceOf)
	}
	if FunctionStorageBalance != "storage_balance_of" {
		t.Errorf("FunctionStorageBalance = %v, want storage_balance_of", FunctionStorageBalance)
	}
}

func TestDefaultGasValues(t *testing.T) {
	if DefaultGas != "30000000000000" {
		t.Errorf("DefaultGas = %v, want 30000000000000", DefaultGas)
	}
	if StorageDeposit != "1" {
		t.Errorf("StorageDeposit = %v, want 1", StorageDeposit)
	}
}

func TestUSDCMainnetToken(t *testing.T) {
	if USDCMainnet.Symbol != "USDC" {
		t.Errorf("USDCMainnet.Symbol = %v, want USDC", USDCMainnet.Symbol)
	}
	if USDCMainnet.Decimals != 6 {
		t.Errorf("USDCMainnet.Decimals = %v, want 6", USDCMainnet.Decimals)
	}
	if USDCMainnet.ContractID == "" {
		t.Error("USDCMainnet.ContractID should not be empty")
	}
}

func TestUSDTMainnetToken(t *testing.T) {
	if USDTMainnet.Symbol != "USDT" {
		t.Errorf("USDTMainnet.Symbol = %v, want USDT", USDTMainnet.Symbol)
	}
	if USDTMainnet.Decimals != 6 {
		t.Errorf("USDTMainnet.Decimals = %v, want 6", USDTMainnet.Decimals)
	}
	if USDTMainnet.ContractID != "usdt.tether-token.near" {
		t.Errorf("USDTMainnet.ContractID = %v, want usdt.tether-token.near", USDTMainnet.ContractID)
	}
}

func TestGetNetworkConfig(t *testing.T) {
	tests := []struct {
		name      string
		network   string
		wantOK    bool
		wantNetID string
	}{
		{
			name:      "Mainnet",
			network:   NearMainnetCAIP2,
			wantOK:    true,
			wantNetID: "mainnet",
		},
		{
			name:      "Testnet",
			network:   NearTestnetCAIP2,
			wantOK:    true,
			wantNetID: "testnet",
		},
		{
			name:    "Invalid",
			network: "invalid",
			wantOK:  false,
		},
		{
			name:    "Empty",
			network: "",
			wantOK:  false,
		},
		{
			name:    "EVM network",
			network: "eip155:1",
			wantOK:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config, ok := GetNetworkConfig(tt.network)
			if ok != tt.wantOK {
				t.Errorf("GetNetworkConfig(%v) ok = %v, want %v", tt.network, ok, tt.wantOK)
			}
			if ok && config.NetworkID != tt.wantNetID {
				t.Errorf("GetNetworkConfig(%v).NetworkID = %v, want %v", tt.network, config.NetworkID, tt.wantNetID)
			}
		})
	}
}

func TestGetTokenInfo(t *testing.T) {
	tests := []struct {
		name    string
		network string
		symbol  string
		wantOK  bool
	}{
		{
			name:    "USDC on mainnet",
			network: NearMainnetCAIP2,
			symbol:  "USDC",
			wantOK:  true,
		},
		{
			name:    "USDT on mainnet",
			network: NearMainnetCAIP2,
			symbol:  "USDT",
			wantOK:  true,
		},
		{
			name:    "USDC on testnet",
			network: NearTestnetCAIP2,
			symbol:  "USDC",
			wantOK:  true,
		},
		{
			name:    "Unknown token on mainnet",
			network: NearMainnetCAIP2,
			symbol:  "UNKNOWN",
			wantOK:  false,
		},
		{
			name:    "Invalid network",
			network: "invalid",
			symbol:  "USDC",
			wantOK:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token, ok := GetTokenInfo(tt.network, tt.symbol)
			if ok != tt.wantOK {
				t.Errorf("GetTokenInfo(%v, %v) ok = %v, want %v", tt.network, tt.symbol, ok, tt.wantOK)
			}
			if ok && token.Symbol != tt.symbol {
				t.Errorf("GetTokenInfo(%v, %v).Symbol = %v, want %v", tt.network, tt.symbol, token.Symbol, tt.symbol)
			}
		})
	}
}

func TestGetTokenByContract(t *testing.T) {
	tests := []struct {
		name       string
		network    string
		contractID string
		wantOK     bool
		wantSymbol string
	}{
		{
			name:       "USDT on mainnet",
			network:    NearMainnetCAIP2,
			contractID: "usdt.tether-token.near",
			wantOK:     true,
			wantSymbol: "USDT",
		},
		{
			name:       "Unknown contract",
			network:    NearMainnetCAIP2,
			contractID: "unknown.near",
			wantOK:     false,
		},
		{
			name:       "Invalid network",
			network:    "invalid",
			contractID: "usdt.tether-token.near",
			wantOK:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token, ok := GetTokenByContract(tt.network, tt.contractID)
			if ok != tt.wantOK {
				t.Errorf("GetTokenByContract(%v, %v) ok = %v, want %v",
					tt.network, tt.contractID, ok, tt.wantOK)
			}
			if ok && token.Symbol != tt.wantSymbol {
				t.Errorf("GetTokenByContract(%v, %v).Symbol = %v, want %v",
					tt.network, tt.contractID, token.Symbol, tt.wantSymbol)
			}
		})
	}
}

func TestNetworkConfigsCompleteness(t *testing.T) {
	expectedNetworks := []string{
		NearMainnetCAIP2,
		NearTestnetCAIP2,
	}

	for _, network := range expectedNetworks {
		if _, ok := NetworkConfigs[network]; !ok {
			t.Errorf("NetworkConfigs missing %v", network)
		}
	}

	if len(NetworkConfigs) != len(expectedNetworks) {
		t.Errorf("NetworkConfigs has %v entries, want %v", len(NetworkConfigs), len(expectedNetworks))
	}
}

func TestTokenRegistryHasMainnet(t *testing.T) {
	tokens, ok := TokenRegistry[NearMainnetCAIP2]
	if !ok {
		t.Fatal("TokenRegistry missing mainnet")
	}
	if len(tokens) < 2 {
		t.Errorf("TokenRegistry[mainnet] has %v tokens, want at least 2", len(tokens))
	}
	if _, ok := tokens["USDC"]; !ok {
		t.Error("TokenRegistry[mainnet] missing USDC")
	}
	if _, ok := tokens["USDT"]; !ok {
		t.Error("TokenRegistry[mainnet] missing USDT")
	}
}
