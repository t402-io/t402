package tezos

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
		name     string
		caip2    string
		wantName string
	}{
		{
			name:     "Tezos Mainnet",
			caip2:    TezosMainnetCAIP2,
			wantName: "Tezos Mainnet",
		},
		{
			name:     "Tezos Ghostnet",
			caip2:    TezosGhostnetCAIP2,
			wantName: "Tezos Ghostnet",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if !strings.HasPrefix(tt.caip2, "tezos:") {
				t.Errorf("CAIP-2 identifier %v should start with 'tezos:'", tt.caip2)
			}

			config, ok := GetNetworkConfig(tt.caip2)
			if !ok {
				t.Errorf("GetNetworkConfig(%v) returned false", tt.caip2)
				return
			}
			if config.Name != tt.wantName {
				t.Errorf("GetNetworkConfig(%v).Name = %v, want %v", tt.caip2, config.Name, tt.wantName)
			}
		})
	}
}

func TestTezosMainnetCAIP2Format(t *testing.T) {
	if TezosMainnetCAIP2 != "tezos:NetXdQprcVkpaWU" {
		t.Errorf("TezosMainnetCAIP2 = %v, want tezos:NetXdQprcVkpaWU", TezosMainnetCAIP2)
	}
}

func TestTezosGhostnetCAIP2Format(t *testing.T) {
	if TezosGhostnetCAIP2 != "tezos:NetXnHfVqm9iesp" {
		t.Errorf("TezosGhostnetCAIP2 = %v, want tezos:NetXnHfVqm9iesp", TezosGhostnetCAIP2)
	}
}

func TestRPCEndpoints(t *testing.T) {
	tests := []struct {
		name string
		url  string
	}{
		{"Tezos Mainnet RPC", TezosMainnetRPC},
		{"Tezos Ghostnet RPC", TezosGhostnetRPC},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if !strings.HasPrefix(tt.url, "https://") {
				t.Errorf("%v should use HTTPS protocol, got %v", tt.name, tt.url)
			}
		})
	}
}

func TestIndexerEndpoints(t *testing.T) {
	tests := []struct {
		name string
		url  string
	}{
		{"Tezos Mainnet Indexer", TezosMainnetIndexer},
		{"Tezos Ghostnet Indexer", TezosGhostnetIndexer},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if !strings.HasPrefix(tt.url, "https://") {
				t.Errorf("%v should use HTTPS protocol, got %v", tt.name, tt.url)
			}
			if !strings.Contains(tt.url, "tzkt.io") {
				t.Errorf("%v should use TzKT indexer, got %v", tt.name, tt.url)
			}
		})
	}
}

func TestFA2Constants(t *testing.T) {
	if FA2TransferEntrypoint != "transfer" {
		t.Errorf("FA2TransferEntrypoint = %v, want transfer", FA2TransferEntrypoint)
	}
}

func TestUSDTMainnetToken(t *testing.T) {
	if USDTMainnet.ContractAddress != "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o" {
		t.Errorf("USDTMainnet.ContractAddress = %v, want KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o", USDTMainnet.ContractAddress)
	}
	if USDTMainnet.TokenID != 0 {
		t.Errorf("USDTMainnet.TokenID = %v, want 0", USDTMainnet.TokenID)
	}
	if USDTMainnet.Symbol != "USDt" {
		t.Errorf("USDTMainnet.Symbol = %v, want USDt", USDTMainnet.Symbol)
	}
	if USDTMainnet.Decimals != 6 {
		t.Errorf("USDTMainnet.Decimals = %v, want 6", USDTMainnet.Decimals)
	}
	if USDTMainnet.Name != "Tether USD" {
		t.Errorf("USDTMainnet.Name = %v, want Tether USD", USDTMainnet.Name)
	}
	// Contract address should start with KT1
	if !strings.HasPrefix(USDTMainnet.ContractAddress, "KT1") {
		t.Errorf("USDTMainnet.ContractAddress should start with KT1")
	}
}

func TestGetNetworkConfig(t *testing.T) {
	tests := []struct {
		name    string
		network string
		wantOK  bool
	}{
		{"Mainnet", TezosMainnetCAIP2, true},
		{"Ghostnet", TezosGhostnetCAIP2, true},
		{"Invalid", "invalid", false},
		{"Empty", "", false},
		{"EVM network", "eip155:1", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, ok := GetNetworkConfig(tt.network)
			if ok != tt.wantOK {
				t.Errorf("GetNetworkConfig(%v) ok = %v, want %v", tt.network, ok, tt.wantOK)
			}
		})
	}
}

func TestNetworkConfigHasDefaultToken(t *testing.T) {
	mainnetConfig, ok := GetNetworkConfig(TezosMainnetCAIP2)
	if !ok {
		t.Fatal("GetNetworkConfig(mainnet) returned false")
	}
	if mainnetConfig.DefaultToken.Symbol != "USDt" {
		t.Errorf("Mainnet DefaultToken.Symbol = %v, want USDt", mainnetConfig.DefaultToken.Symbol)
	}

	ghostnetConfig, ok := GetNetworkConfig(TezosGhostnetCAIP2)
	if !ok {
		t.Fatal("GetNetworkConfig(ghostnet) returned false")
	}
	// Ghostnet should have empty default token
	if ghostnetConfig.DefaultToken.Symbol != "" {
		t.Errorf("Ghostnet DefaultToken.Symbol = %v, want empty", ghostnetConfig.DefaultToken.Symbol)
	}
}

func TestGetTokenInfo(t *testing.T) {
	tests := []struct {
		name       string
		network    string
		symbol     string
		wantOK     bool
		wantSymbol string
	}{
		{
			name:       "USDt on mainnet",
			network:    TezosMainnetCAIP2,
			symbol:     "USDt",
			wantOK:     true,
			wantSymbol: "USDt",
		},
		{
			name:    "Unknown token on mainnet",
			network: TezosMainnetCAIP2,
			symbol:  "UNKNOWN",
			wantOK:  false,
		},
		{
			name:    "Token on ghostnet",
			network: TezosGhostnetCAIP2,
			symbol:  "USDt",
			wantOK:  false, // Ghostnet has no registered tokens
		},
		{
			name:    "Invalid network",
			network: "invalid",
			symbol:  "USDt",
			wantOK:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token, ok := GetTokenInfo(tt.network, tt.symbol)
			if ok != tt.wantOK {
				t.Errorf("GetTokenInfo(%v, %v) ok = %v, want %v", tt.network, tt.symbol, ok, tt.wantOK)
			}
			if ok && token.Symbol != tt.wantSymbol {
				t.Errorf("GetTokenInfo(%v, %v).Symbol = %v, want %v", tt.network, tt.symbol, token.Symbol, tt.wantSymbol)
			}
		})
	}
}

func TestGetTokenByContract(t *testing.T) {
	tests := []struct {
		name     string
		network  string
		contract string
		tokenID  int
		wantOK   bool
	}{
		{
			name:     "USDT on mainnet",
			network:  TezosMainnetCAIP2,
			contract: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
			tokenID:  0,
			wantOK:   true,
		},
		{
			name:     "Wrong token ID",
			network:  TezosMainnetCAIP2,
			contract: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
			tokenID:  1,
			wantOK:   false,
		},
		{
			name:     "Unknown contract",
			network:  TezosMainnetCAIP2,
			contract: "KT1Unknown",
			tokenID:  0,
			wantOK:   false,
		},
		{
			name:     "Invalid network",
			network:  "invalid",
			contract: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
			tokenID:  0,
			wantOK:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, ok := GetTokenByContract(tt.network, tt.contract, tt.tokenID)
			if ok != tt.wantOK {
				t.Errorf("GetTokenByContract(%v, %v, %v) ok = %v, want %v",
					tt.network, tt.contract, tt.tokenID, ok, tt.wantOK)
			}
		})
	}
}

func TestNetworkConfigsCompleteness(t *testing.T) {
	expectedNetworks := []string{
		TezosMainnetCAIP2,
		TezosGhostnetCAIP2,
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
	tokens, ok := TokenRegistry[TezosMainnetCAIP2]
	if !ok {
		t.Fatal("TokenRegistry missing mainnet")
	}
	if len(tokens) == 0 {
		t.Error("TokenRegistry[mainnet] is empty")
	}
	if _, ok := tokens["USDt"]; !ok {
		t.Error("TokenRegistry[mainnet] missing USDt")
	}
}
