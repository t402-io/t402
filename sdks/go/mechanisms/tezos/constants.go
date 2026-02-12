package tezos

const (
	// Scheme identifiers
	SchemeExactDirect = "exact-direct"

	// CAIP-2 network identifiers (derived from genesis block hash)
	TezosMainnetCAIP2  = "tezos:NetXdQprcVkpaWU"
	TezosGhostnetCAIP2 = "tezos:NetXnHfVqm9iesp"

	// RPC endpoints
	TezosMainnetRPC  = "https://mainnet.api.tez.ie"
	TezosGhostnetRPC = "https://ghostnet.tezos.marigold.dev"

	// Indexer API endpoints (TzKT)
	TezosMainnetIndexer  = "https://api.tzkt.io"
	TezosGhostnetIndexer = "https://api.ghostnet.tzkt.io"

	// FA2 token standard (TZIP-12)
	FA2TransferEntrypoint = "transfer"
)

// TokenInfo contains information about a Tezos FA2 token
type TokenInfo struct {
	ContractAddress string
	TokenID         int
	Symbol          string
	Name            string
	Decimals        int
}

// NetworkConfig contains network-specific configuration
type NetworkConfig struct {
	Name       string
	RpcURL     string
	IndexerURL string
	DefaultToken TokenInfo
}

var (
	// USDT on Tezos Mainnet
	USDTMainnet = TokenInfo{
		ContractAddress: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
		TokenID:         0,
		Symbol:          "USDt",
		Name:            "Tether USD",
		Decimals:        6,
	}

	// USDt metadata for Ghostnet (no deployed contract, metadata only)
	USDTGhostnet = TokenInfo{
		Symbol:   "USDt",
		Name:     "Tether USD (Testnet)",
		Decimals: 6,
	}

	// Network configurations
	NetworkConfigs = map[string]NetworkConfig{
		TezosMainnetCAIP2: {
			Name:         "Tezos Mainnet",
			RpcURL:       TezosMainnetRPC,
			IndexerURL:   TezosMainnetIndexer,
			DefaultToken: USDTMainnet,
		},
		TezosGhostnetCAIP2: {
			Name:         "Tezos Ghostnet",
			RpcURL:       TezosGhostnetRPC,
			IndexerURL:   TezosGhostnetIndexer,
			DefaultToken: USDTGhostnet,
		},
	}

	// Token registry by network
	TokenRegistry = map[string]map[string]TokenInfo{
		TezosMainnetCAIP2: {
			"USDt": USDTMainnet,
		},
		TezosGhostnetCAIP2: {},
	}
)

// GetNetworkConfig returns the configuration for a network
func GetNetworkConfig(network string) (NetworkConfig, bool) {
	config, ok := NetworkConfigs[network]
	return config, ok
}

// GetTokenInfo returns token info for a network and symbol
func GetTokenInfo(network, symbol string) (TokenInfo, bool) {
	tokens, ok := TokenRegistry[network]
	if !ok {
		return TokenInfo{}, false
	}
	token, ok := tokens[symbol]
	return token, ok
}

// GetTokenByContract returns token info by contract address and token ID
func GetTokenByContract(network, contractAddress string, tokenID int) (TokenInfo, bool) {
	tokens, ok := TokenRegistry[network]
	if !ok {
		return TokenInfo{}, false
	}
	for _, token := range tokens {
		if token.ContractAddress == contractAddress && token.TokenID == tokenID {
			return token, true
		}
	}
	return TokenInfo{}, false
}
