package aptos

const (
	// Scheme identifiers
	SchemeExactDirect = "exact-direct"

	// CAIP-2 network identifiers
	AptosMainnetCAIP2 = "aptos:1"
	AptosTestnetCAIP2 = "aptos:2"
	AptosDevnetCAIP2  = "aptos:149"

	// RPC endpoints
	AptosMainnetRPC = "https://fullnode.mainnet.aptoslabs.com/v1"
	AptosTestnetRPC = "https://fullnode.testnet.aptoslabs.com/v1"
	AptosDevnetRPC  = "https://fullnode.devnet.aptoslabs.com/v1"

	// Fungible Asset module
	PrimaryFungibleStoreModule = "0x1::primary_fungible_store"
	FungibleAssetModule        = "0x1::fungible_asset"

	// Transfer function
	FATransferFunction = "0x1::primary_fungible_store::transfer"
)

// TokenInfo contains information about an Aptos fungible asset
type TokenInfo struct {
	MetadataAddress string
	Symbol          string
	Name            string
	Decimals        int
}

// NetworkConfig contains network-specific configuration
type NetworkConfig struct {
	ChainID      int
	RPCURL       string
	DefaultToken TokenInfo
}

var (
	// USDT on Aptos Mainnet
	USDTMainnet = TokenInfo{
		MetadataAddress: "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
		Symbol:          "USDT",
		Name:            "Tether USD",
		Decimals:        6,
	}

	// USDC on Aptos Mainnet
	USDCMainnet = TokenInfo{
		MetadataAddress: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
		Symbol:          "USDC",
		Name:            "USD Coin",
		Decimals:        6,
	}

	// Network configurations
	NetworkConfigs = map[string]NetworkConfig{
		AptosMainnetCAIP2: {
			ChainID:      1,
			RPCURL:       AptosMainnetRPC,
			DefaultToken: USDTMainnet,
		},
		AptosTestnetCAIP2: {
			ChainID:      2,
			RPCURL:       AptosTestnetRPC,
			DefaultToken: USDTMainnet,
		},
		AptosDevnetCAIP2: {
			ChainID:      149,
			RPCURL:       AptosDevnetRPC,
			DefaultToken: USDTMainnet,
		},
	}

	// Token registry by network
	TokenRegistry = map[string]map[string]TokenInfo{
		AptosMainnetCAIP2: {
			"USDT": USDTMainnet,
			"USDC": USDCMainnet,
		},
		AptosTestnetCAIP2: {
			"USDT": USDTMainnet,
		},
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

// GetTokenByAddress returns token info by metadata address
func GetTokenByAddress(network, metadataAddress string) (TokenInfo, bool) {
	tokens, ok := TokenRegistry[network]
	if !ok {
		return TokenInfo{}, false
	}
	for _, token := range tokens {
		if normalizeAddress(token.MetadataAddress) == normalizeAddress(metadataAddress) {
			return token, true
		}
	}
	return TokenInfo{}, false
}

// normalizeAddress normalizes an Aptos address for comparison
func normalizeAddress(addr string) string {
	// Simple lowercase normalization - full implementation would pad addresses
	if len(addr) > 2 && addr[:2] == "0x" {
		return "0x" + addr[2:]
	}
	return addr
}
