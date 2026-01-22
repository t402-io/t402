package polkadot

// Scheme identifiers
const (
	SchemeExactDirect = "exact-direct"
)

// CAIP-2 identifiers for Polkadot networks
// Format: polkadot:{genesis_hash_first_32_chars}
const (
	// Polkadot Asset Hub (Parachain ID: 1000)
	PolkadotAssetHubCAIP2 = "polkadot:68d56f15f85d3136970ec16946040bc1"

	// Kusama Asset Hub (Parachain ID: 1000)
	KusamaAssetHubCAIP2 = "polkadot:48239ef607d7928874027a43a67689209727dfb3d3dc5e5b03a39bdc2eda771a"

	// Westend Asset Hub (Testnet)
	WestendAssetHubCAIP2 = "polkadot:e143f23803ac50e8f6f8e62695d1ce9e"
)

// Default indexer endpoints (Subscan)
const (
	PolkadotAssetHubIndexer = "https://assethub-polkadot.api.subscan.io"
	KusamaAssetHubIndexer   = "https://assethub-kusama.api.subscan.io"
	WestendAssetHubIndexer  = "https://assethub-westend.api.subscan.io"
)

// Default RPC endpoints
const (
	PolkadotAssetHubRPC = "wss://polkadot-asset-hub-rpc.polkadot.io"
	KusamaAssetHubRPC   = "wss://kusama-asset-hub-rpc.polkadot.io"
	WestendAssetHubRPC  = "wss://westend-asset-hub-rpc.polkadot.io"
)

// TokenInfo represents token configuration
type TokenInfo struct {
	AssetID  int
	Symbol   string
	Name     string
	Decimals int
}

// Default tokens per network
var (
	// USDT on Polkadot Asset Hub (Asset ID: 1984)
	USDTPolkadot = TokenInfo{
		AssetID:  1984,
		Symbol:   "USDT",
		Name:     "Tether USD",
		Decimals: 6,
	}

	// USDT on Kusama Asset Hub
	USDTKusama = TokenInfo{
		AssetID:  1984,
		Symbol:   "USDT",
		Name:     "Tether USD",
		Decimals: 6,
	}

	// Test USDT on Westend Asset Hub
	USDTWestend = TokenInfo{
		AssetID:  1984,
		Symbol:   "USDT",
		Name:     "Test Tether USD",
		Decimals: 6,
	}
)

// NetworkConfig holds configuration for a Polkadot network
type NetworkConfig struct {
	Name         string
	CAIP2        string
	IndexerURL   string
	RPCURL       string
	GenesisHash  string
	SS58Prefix   int
	IsTestnet    bool
	DefaultToken TokenInfo
}

// Networks maps CAIP-2 identifiers to network configurations
var Networks = map[string]NetworkConfig{
	PolkadotAssetHubCAIP2: {
		Name:         "Polkadot Asset Hub",
		CAIP2:        PolkadotAssetHubCAIP2,
		IndexerURL:   PolkadotAssetHubIndexer,
		RPCURL:       PolkadotAssetHubRPC,
		GenesisHash:  "0x68d56f15f85d3136970ec16946040bc1752654e906147f7e43e9d539d7c3de2f",
		SS58Prefix:   0,
		IsTestnet:    false,
		DefaultToken: USDTPolkadot,
	},
	KusamaAssetHubCAIP2: {
		Name:         "Kusama Asset Hub",
		CAIP2:        KusamaAssetHubCAIP2,
		IndexerURL:   KusamaAssetHubIndexer,
		RPCURL:       KusamaAssetHubRPC,
		GenesisHash:  "0x48239ef607d7928874027a43a67689209727dfb3d3dc5e5b03a39bdc2eda771a",
		SS58Prefix:   2,
		IsTestnet:    false,
		DefaultToken: USDTKusama,
	},
	WestendAssetHubCAIP2: {
		Name:         "Westend Asset Hub",
		CAIP2:        WestendAssetHubCAIP2,
		IndexerURL:   WestendAssetHubIndexer,
		RPCURL:       WestendAssetHubRPC,
		GenesisHash:  "0xe143f23803ac50e8f6f8e62695d1ce9e4e1d68aa36c1cd2cfd15340213f3423e",
		SS58Prefix:   42,
		IsTestnet:    true,
		DefaultToken: USDTWestend,
	},
}

// GetNetworkConfig returns the network configuration for a CAIP-2 identifier
func GetNetworkConfig(network string) (NetworkConfig, bool) {
	config, ok := Networks[network]
	return config, ok
}
