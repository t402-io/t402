package polkadot

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
			name:     "Polkadot Asset Hub",
			caip2:    PolkadotAssetHubCAIP2,
			wantName: "Polkadot Asset Hub",
		},
		{
			name:     "Kusama Asset Hub",
			caip2:    KusamaAssetHubCAIP2,
			wantName: "Kusama Asset Hub",
		},
		{
			name:     "Westend Asset Hub",
			caip2:    WestendAssetHubCAIP2,
			wantName: "Westend Asset Hub",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if !strings.HasPrefix(tt.caip2, "polkadot:") {
				t.Errorf("CAIP-2 identifier %v should start with 'polkadot:'", tt.caip2)
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

func TestPolkadotAssetHubCAIP2Format(t *testing.T) {
	if PolkadotAssetHubCAIP2 != "polkadot:68d56f15f85d3136970ec16946040bc1" {
		t.Errorf("PolkadotAssetHubCAIP2 = %v, want polkadot:68d56f15f85d3136970ec16946040bc1", PolkadotAssetHubCAIP2)
	}
}

func TestIndexerEndpoints(t *testing.T) {
	tests := []struct {
		name    string
		url     string
		wantURL string
	}{
		{
			name:    "Polkadot Asset Hub Indexer",
			url:     PolkadotAssetHubIndexer,
			wantURL: "https://assethub-polkadot.api.subscan.io",
		},
		{
			name:    "Kusama Asset Hub Indexer",
			url:     KusamaAssetHubIndexer,
			wantURL: "https://assethub-kusama.api.subscan.io",
		},
		{
			name:    "Westend Asset Hub Indexer",
			url:     WestendAssetHubIndexer,
			wantURL: "https://assethub-westend.api.subscan.io",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.url != tt.wantURL {
				t.Errorf("%v = %v, want %v", tt.name, tt.url, tt.wantURL)
			}
			if !strings.HasPrefix(tt.url, "https://") {
				t.Errorf("%v should use HTTPS", tt.name)
			}
		})
	}
}

func TestRPCEndpoints(t *testing.T) {
	tests := []struct {
		name string
		url  string
	}{
		{"Polkadot Asset Hub RPC", PolkadotAssetHubRPC},
		{"Kusama Asset Hub RPC", KusamaAssetHubRPC},
		{"Westend Asset Hub RPC", WestendAssetHubRPC},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if !strings.HasPrefix(tt.url, "wss://") {
				t.Errorf("%v should use WSS protocol, got %v", tt.name, tt.url)
			}
		})
	}
}

func TestUSDTTokenInfo(t *testing.T) {
	tests := []struct {
		name  string
		token TokenInfo
	}{
		{"USDT Polkadot", USDTPolkadot},
		{"USDT Kusama", USDTKusama},
		{"USDT Westend", USDTWestend},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// All USDT tokens should have asset ID 1984
			if tt.token.AssetID != 1984 {
				t.Errorf("%v.AssetID = %v, want 1984", tt.name, tt.token.AssetID)
			}
			// All USDT tokens should have 6 decimals
			if tt.token.Decimals != 6 {
				t.Errorf("%v.Decimals = %v, want 6", tt.name, tt.token.Decimals)
			}
			// All should have USDT symbol
			if tt.token.Symbol != "USDT" {
				t.Errorf("%v.Symbol = %v, want USDT", tt.name, tt.token.Symbol)
			}
		})
	}
}

func TestNetworkConfigHasCorrectCAIP2(t *testing.T) {
	for caip2, config := range Networks {
		t.Run(config.Name, func(t *testing.T) {
			if config.CAIP2 != caip2 {
				t.Errorf("Networks[%v].CAIP2 = %v, want %v", caip2, config.CAIP2, caip2)
			}
		})
	}
}

func TestNetworkConfigHasGenesisHash(t *testing.T) {
	for caip2, config := range Networks {
		t.Run(config.Name, func(t *testing.T) {
			if config.GenesisHash == "" {
				t.Errorf("Networks[%v].GenesisHash is empty", caip2)
			}
			if !strings.HasPrefix(config.GenesisHash, "0x") {
				t.Errorf("Networks[%v].GenesisHash should start with 0x", caip2)
			}
			// Genesis hash should be 66 characters (0x + 64 hex chars)
			if len(config.GenesisHash) != 66 {
				t.Errorf("Networks[%v].GenesisHash length = %v, want 66", caip2, len(config.GenesisHash))
			}
		})
	}
}

func TestNetworkConfigSS58Prefix(t *testing.T) {
	tests := []struct {
		caip2       string
		wantPrefix  int
		wantTestnet bool
	}{
		{PolkadotAssetHubCAIP2, 0, false},
		{KusamaAssetHubCAIP2, 2, false},
		{WestendAssetHubCAIP2, 42, true},
	}

	for _, tt := range tests {
		t.Run(tt.caip2, func(t *testing.T) {
			config, ok := GetNetworkConfig(tt.caip2)
			if !ok {
				t.Fatalf("GetNetworkConfig(%v) returned false", tt.caip2)
			}
			if config.SS58Prefix != tt.wantPrefix {
				t.Errorf("GetNetworkConfig(%v).SS58Prefix = %v, want %v", tt.caip2, config.SS58Prefix, tt.wantPrefix)
			}
			if config.IsTestnet != tt.wantTestnet {
				t.Errorf("GetNetworkConfig(%v).IsTestnet = %v, want %v", tt.caip2, config.IsTestnet, tt.wantTestnet)
			}
		})
	}
}

func TestGetNetworkConfigInvalid(t *testing.T) {
	tests := []string{
		"",
		"invalid",
		"eip155:1",
		"polkadot:invalid",
		"polkadot:",
	}

	for _, network := range tests {
		t.Run(network, func(t *testing.T) {
			_, ok := GetNetworkConfig(network)
			if ok {
				t.Errorf("GetNetworkConfig(%v) should return false for invalid network", network)
			}
		})
	}
}

func TestNetworksMapCompleteness(t *testing.T) {
	expectedNetworks := []string{
		PolkadotAssetHubCAIP2,
		KusamaAssetHubCAIP2,
		WestendAssetHubCAIP2,
	}

	for _, network := range expectedNetworks {
		if _, ok := Networks[network]; !ok {
			t.Errorf("Networks map missing %v", network)
		}
	}

	// Verify count
	if len(Networks) != len(expectedNetworks) {
		t.Errorf("Networks map has %v entries, want %v", len(Networks), len(expectedNetworks))
	}
}
