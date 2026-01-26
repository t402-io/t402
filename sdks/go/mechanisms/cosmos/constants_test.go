package cosmos

import (
	"testing"
)

func TestGetNetworkConfig(t *testing.T) {
	tests := []struct {
		name     string
		network  string
		wantOK   bool
		wantChainID string
	}{
		{
			name:        "Noble mainnet",
			network:     NobleMainnetCAIP2,
			wantOK:      true,
			wantChainID: "noble-1",
		},
		{
			name:        "Noble testnet",
			network:     NobleTestnetCAIP2,
			wantOK:      true,
			wantChainID: "grand-1",
		},
		{
			name:    "Unknown network",
			network: "cosmos:unknown",
			wantOK:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config, ok := GetNetworkConfig(tt.network)
			if ok != tt.wantOK {
				t.Errorf("GetNetworkConfig(%s) ok = %v, want %v", tt.network, ok, tt.wantOK)
			}
			if ok && config.ChainID != tt.wantChainID {
				t.Errorf("GetNetworkConfig(%s) chainID = %v, want %v", tt.network, config.ChainID, tt.wantChainID)
			}
		})
	}
}

func TestGetTokenInfo(t *testing.T) {
	tests := []struct {
		name       string
		network    string
		symbol     string
		wantOK     bool
		wantDenom  string
	}{
		{
			name:      "USDC on Noble mainnet",
			network:   NobleMainnetCAIP2,
			symbol:    "USDC",
			wantOK:    true,
			wantDenom: USDCDenom,
		},
		{
			name:      "USDC on Noble testnet",
			network:   NobleTestnetCAIP2,
			symbol:    "USDC",
			wantOK:    true,
			wantDenom: USDCDenom,
		},
		{
			name:    "Unknown token",
			network: NobleMainnetCAIP2,
			symbol:  "UNKNOWN",
			wantOK:  false,
		},
		{
			name:    "Unknown network",
			network: "cosmos:unknown",
			symbol:  "USDC",
			wantOK:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token, ok := GetTokenInfo(tt.network, tt.symbol)
			if ok != tt.wantOK {
				t.Errorf("GetTokenInfo(%s, %s) ok = %v, want %v", tt.network, tt.symbol, ok, tt.wantOK)
			}
			if ok && token.Denom != tt.wantDenom {
				t.Errorf("GetTokenInfo(%s, %s) denom = %v, want %v", tt.network, tt.symbol, token.Denom, tt.wantDenom)
			}
		})
	}
}

func TestGetTokenByDenom(t *testing.T) {
	tests := []struct {
		name       string
		network    string
		denom      string
		wantOK     bool
		wantSymbol string
	}{
		{
			name:       "uusdc on Noble mainnet",
			network:    NobleMainnetCAIP2,
			denom:      USDCDenom,
			wantOK:     true,
			wantSymbol: "USDC",
		},
		{
			name:    "Unknown denom",
			network: NobleMainnetCAIP2,
			denom:   "unknown",
			wantOK:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token, ok := GetTokenByDenom(tt.network, tt.denom)
			if ok != tt.wantOK {
				t.Errorf("GetTokenByDenom(%s, %s) ok = %v, want %v", tt.network, tt.denom, ok, tt.wantOK)
			}
			if ok && token.Symbol != tt.wantSymbol {
				t.Errorf("GetTokenByDenom(%s, %s) symbol = %v, want %v", tt.network, tt.denom, token.Symbol, tt.wantSymbol)
			}
		})
	}
}

func TestIsValidAddress(t *testing.T) {
	tests := []struct {
		name    string
		address string
		prefix  string
		want    bool
	}{
		{
			name:    "Valid Noble address",
			address: "noble1abc123xyz",
			prefix:  NobleBech32Prefix,
			want:    true,
		},
		{
			name:    "Invalid prefix",
			address: "cosmos1abc123xyz",
			prefix:  NobleBech32Prefix,
			want:    false,
		},
		{
			name:    "Too short",
			address: "nob",
			prefix:  NobleBech32Prefix,
			want:    false,
		},
		{
			name:    "Empty address",
			address: "",
			prefix:  NobleBech32Prefix,
			want:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsValidAddress(tt.address, tt.prefix)
			if got != tt.want {
				t.Errorf("IsValidAddress(%s, %s) = %v, want %v", tt.address, tt.prefix, got, tt.want)
			}
		})
	}
}

func TestGetSupportedNetworks(t *testing.T) {
	networks := GetSupportedNetworks()

	if len(networks) != 2 {
		t.Errorf("GetSupportedNetworks() returned %d networks, want 2", len(networks))
	}

	networkMap := make(map[string]bool)
	for _, n := range networks {
		networkMap[n] = true
	}

	if !networkMap[NobleMainnetCAIP2] {
		t.Errorf("GetSupportedNetworks() missing %s", NobleMainnetCAIP2)
	}
	if !networkMap[NobleTestnetCAIP2] {
		t.Errorf("GetSupportedNetworks() missing %s", NobleTestnetCAIP2)
	}
}

func TestConstants(t *testing.T) {
	// Test that constants are set correctly
	if SchemeExactDirect != "exact-direct" {
		t.Errorf("SchemeExactDirect = %s, want exact-direct", SchemeExactDirect)
	}
	if NobleMainnetCAIP2 != "cosmos:noble-1" {
		t.Errorf("NobleMainnetCAIP2 = %s, want cosmos:noble-1", NobleMainnetCAIP2)
	}
	if NobleTestnetCAIP2 != "cosmos:grand-1" {
		t.Errorf("NobleTestnetCAIP2 = %s, want cosmos:grand-1", NobleTestnetCAIP2)
	}
	if USDCDenom != "uusdc" {
		t.Errorf("USDCDenom = %s, want uusdc", USDCDenom)
	}
	if NobleBech32Prefix != "noble" {
		t.Errorf("NobleBech32Prefix = %s, want noble", NobleBech32Prefix)
	}
}

func TestTokenInfo(t *testing.T) {
	// Verify USDC token info
	if USDCToken.Denom != USDCDenom {
		t.Errorf("USDCToken.Denom = %s, want %s", USDCToken.Denom, USDCDenom)
	}
	if USDCToken.Symbol != "USDC" {
		t.Errorf("USDCToken.Symbol = %s, want USDC", USDCToken.Symbol)
	}
	if USDCToken.Decimals != 6 {
		t.Errorf("USDCToken.Decimals = %d, want 6", USDCToken.Decimals)
	}
}

func TestNetworkConfigContents(t *testing.T) {
	// Test mainnet config
	mainnet, ok := GetNetworkConfig(NobleMainnetCAIP2)
	if !ok {
		t.Fatal("mainnet config not found")
	}
	if mainnet.ChainID != "noble-1" {
		t.Errorf("mainnet ChainID = %s, want noble-1", mainnet.ChainID)
	}
	if mainnet.Bech32Prefix != NobleBech32Prefix {
		t.Errorf("mainnet Bech32Prefix = %s, want %s", mainnet.Bech32Prefix, NobleBech32Prefix)
	}
	if mainnet.RPCURL == "" {
		t.Error("mainnet RPCURL is empty")
	}
	if mainnet.RESTURL == "" {
		t.Error("mainnet RESTURL is empty")
	}

	// Test testnet config
	testnet, ok := GetNetworkConfig(NobleTestnetCAIP2)
	if !ok {
		t.Fatal("testnet config not found")
	}
	if testnet.ChainID != "grand-1" {
		t.Errorf("testnet ChainID = %s, want grand-1", testnet.ChainID)
	}
}
