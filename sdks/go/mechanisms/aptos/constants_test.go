package aptos

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
		name    string
		caip2   string
		chainID int
	}{
		{
			name:    "Aptos Mainnet",
			caip2:   AptosMainnetCAIP2,
			chainID: 1,
		},
		{
			name:    "Aptos Testnet",
			caip2:   AptosTestnetCAIP2,
			chainID: 2,
		},
		{
			name:    "Aptos Devnet",
			caip2:   AptosDevnetCAIP2,
			chainID: 149,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if !strings.HasPrefix(tt.caip2, "aptos:") {
				t.Errorf("CAIP-2 identifier %v should start with 'aptos:'", tt.caip2)
			}

			config, ok := GetNetworkConfig(tt.caip2)
			if !ok {
				t.Errorf("GetNetworkConfig(%v) returned false", tt.caip2)
				return
			}
			if config.ChainID != tt.chainID {
				t.Errorf("GetNetworkConfig(%v).ChainID = %v, want %v", tt.caip2, config.ChainID, tt.chainID)
			}
		})
	}
}

func TestAptosMainnetCAIP2Format(t *testing.T) {
	if AptosMainnetCAIP2 != "aptos:1" {
		t.Errorf("AptosMainnetCAIP2 = %v, want aptos:1", AptosMainnetCAIP2)
	}
}

func TestAptosTestnetCAIP2Format(t *testing.T) {
	if AptosTestnetCAIP2 != "aptos:2" {
		t.Errorf("AptosTestnetCAIP2 = %v, want aptos:2", AptosTestnetCAIP2)
	}
}

func TestAptosDevnetCAIP2Format(t *testing.T) {
	if AptosDevnetCAIP2 != "aptos:149" {
		t.Errorf("AptosDevnetCAIP2 = %v, want aptos:149", AptosDevnetCAIP2)
	}
}

func TestRPCEndpoints(t *testing.T) {
	tests := []struct {
		name string
		url  string
	}{
		{"Aptos Mainnet RPC", AptosMainnetRPC},
		{"Aptos Testnet RPC", AptosTestnetRPC},
		{"Aptos Devnet RPC", AptosDevnetRPC},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if !strings.HasPrefix(tt.url, "https://") {
				t.Errorf("%v should use HTTPS protocol, got %v", tt.name, tt.url)
			}
			if !strings.Contains(tt.url, "aptoslabs.com") {
				t.Errorf("%v should use aptoslabs.com domain, got %v", tt.name, tt.url)
			}
			if !strings.HasSuffix(tt.url, "/v1") {
				t.Errorf("%v should end with /v1, got %v", tt.name, tt.url)
			}
		})
	}
}

func TestModuleConstants(t *testing.T) {
	if PrimaryFungibleStoreModule != "0x1::primary_fungible_store" {
		t.Errorf("PrimaryFungibleStoreModule = %v, want 0x1::primary_fungible_store", PrimaryFungibleStoreModule)
	}
	if FungibleAssetModule != "0x1::fungible_asset" {
		t.Errorf("FungibleAssetModule = %v, want 0x1::fungible_asset", FungibleAssetModule)
	}
	if FATransferFunction != "0x1::primary_fungible_store::transfer" {
		t.Errorf("FATransferFunction = %v, want 0x1::primary_fungible_store::transfer", FATransferFunction)
	}
}

func TestUSDTMainnetToken(t *testing.T) {
	if USDTMainnet.Symbol != "USDT" {
		t.Errorf("USDTMainnet.Symbol = %v, want USDT", USDTMainnet.Symbol)
	}
	if USDTMainnet.Decimals != 6 {
		t.Errorf("USDTMainnet.Decimals = %v, want 6", USDTMainnet.Decimals)
	}
	if USDTMainnet.Name != "Tether USD" {
		t.Errorf("USDTMainnet.Name = %v, want Tether USD", USDTMainnet.Name)
	}
	if !strings.HasPrefix(USDTMainnet.MetadataAddress, "0x") {
		t.Error("USDTMainnet.MetadataAddress should start with 0x")
	}
}

func TestUSDCMainnetToken(t *testing.T) {
	if USDCMainnet.Symbol != "USDC" {
		t.Errorf("USDCMainnet.Symbol = %v, want USDC", USDCMainnet.Symbol)
	}
	if USDCMainnet.Decimals != 6 {
		t.Errorf("USDCMainnet.Decimals = %v, want 6", USDCMainnet.Decimals)
	}
	if USDCMainnet.Name != "USD Coin" {
		t.Errorf("USDCMainnet.Name = %v, want USD Coin", USDCMainnet.Name)
	}
	if !strings.HasPrefix(USDCMainnet.MetadataAddress, "0x") {
		t.Error("USDCMainnet.MetadataAddress should start with 0x")
	}
}

func TestGetNetworkConfig(t *testing.T) {
	tests := []struct {
		name        string
		network     string
		wantOK      bool
		wantChainID int
	}{
		{
			name:        "Mainnet",
			network:     AptosMainnetCAIP2,
			wantOK:      true,
			wantChainID: 1,
		},
		{
			name:        "Testnet",
			network:     AptosTestnetCAIP2,
			wantOK:      true,
			wantChainID: 2,
		},
		{
			name:        "Devnet",
			network:     AptosDevnetCAIP2,
			wantOK:      true,
			wantChainID: 149,
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
			if ok && config.ChainID != tt.wantChainID {
				t.Errorf("GetNetworkConfig(%v).ChainID = %v, want %v", tt.network, config.ChainID, tt.wantChainID)
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
			name:    "USDT on mainnet",
			network: AptosMainnetCAIP2,
			symbol:  "USDT",
			wantOK:  true,
		},
		{
			name:    "USDC on mainnet",
			network: AptosMainnetCAIP2,
			symbol:  "USDC",
			wantOK:  true,
		},
		{
			name:    "USDT on testnet",
			network: AptosTestnetCAIP2,
			symbol:  "USDT",
			wantOK:  true,
		},
		{
			name:    "Unknown token on mainnet",
			network: AptosMainnetCAIP2,
			symbol:  "UNKNOWN",
			wantOK:  false,
		},
		{
			name:    "Invalid network",
			network: "invalid",
			symbol:  "USDT",
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

func TestGetTokenByAddress(t *testing.T) {
	tests := []struct {
		name            string
		network         string
		metadataAddress string
		wantOK          bool
		wantSymbol      string
	}{
		{
			name:            "USDT on mainnet",
			network:         AptosMainnetCAIP2,
			metadataAddress: USDTMainnet.MetadataAddress,
			wantOK:          true,
			wantSymbol:      "USDT",
		},
		{
			name:            "USDC on mainnet",
			network:         AptosMainnetCAIP2,
			metadataAddress: USDCMainnet.MetadataAddress,
			wantOK:          true,
			wantSymbol:      "USDC",
		},
		{
			name:            "Unknown address",
			network:         AptosMainnetCAIP2,
			metadataAddress: "0x0000000000000000000000000000000000000000000000000000000000000000",
			wantOK:          false,
		},
		{
			name:            "Invalid network",
			network:         "invalid",
			metadataAddress: USDTMainnet.MetadataAddress,
			wantOK:          false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token, ok := GetTokenByAddress(tt.network, tt.metadataAddress)
			if ok != tt.wantOK {
				t.Errorf("GetTokenByAddress(%v, %v) ok = %v, want %v",
					tt.network, tt.metadataAddress, ok, tt.wantOK)
			}
			if ok && token.Symbol != tt.wantSymbol {
				t.Errorf("GetTokenByAddress(%v, %v).Symbol = %v, want %v",
					tt.network, tt.metadataAddress, token.Symbol, tt.wantSymbol)
			}
		})
	}
}

func TestNetworkConfigsCompleteness(t *testing.T) {
	expectedNetworks := []string{
		AptosMainnetCAIP2,
		AptosTestnetCAIP2,
		AptosDevnetCAIP2,
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
	tokens, ok := TokenRegistry[AptosMainnetCAIP2]
	if !ok {
		t.Fatal("TokenRegistry missing mainnet")
	}
	if len(tokens) < 2 {
		t.Errorf("TokenRegistry[mainnet] has %v tokens, want at least 2", len(tokens))
	}
	if _, ok := tokens["USDT"]; !ok {
		t.Error("TokenRegistry[mainnet] missing USDT")
	}
	if _, ok := tokens["USDC"]; !ok {
		t.Error("TokenRegistry[mainnet] missing USDC")
	}
}

func TestNormalizeAddress(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "lowercase address",
			input: "0xabcdef",
			want:  "0xabcdef",
		},
		{
			name:  "full address",
			input: "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
			want:  "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
		},
		{
			name:  "no prefix",
			input: "abcdef",
			want:  "abcdef",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := normalizeAddress(tt.input)
			if got != tt.want {
				t.Errorf("normalizeAddress(%v) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}
