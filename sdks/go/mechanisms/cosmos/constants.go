// Package cosmos provides Cosmos/Noble payment mechanism support for T402.
package cosmos

const (
	// Scheme identifiers
	SchemeExactDirect = "exact-direct"

	// CAIP-2 network identifiers
	// Noble is a Cosmos app-chain specifically built for native USDC issuance
	NobleMainnetCAIP2 = "cosmos:noble-1"
	NobleTestnetCAIP2 = "cosmos:grand-1"

	// RPC endpoints
	NobleMainnetRPC = "https://noble-rpc.polkachu.com"
	NobleTestnetRPC = "https://rpc.testnet.noble.strange.love"

	// REST API endpoints
	NobleMainnetREST = "https://noble-api.polkachu.com"
	NobleTestnetREST = "https://api.testnet.noble.strange.love"

	// Address prefix (bech32)
	NobleBech32Prefix = "noble"

	// USDC denom on Noble (micro USDC: 1 USDC = 1,000,000 uusdc)
	USDCDenom = "uusdc"

	// Gas settings
	DefaultGasLimit   = 200000
	DefaultGasPrice   = "0.025uusdc"
	DefaultFeeAmount  = "5000" // 0.005 USDC
	DefaultFeeDenom   = USDCDenom

	// Message types
	MsgTypeSend     = "/cosmos.bank.v1beta1.MsgSend"
	MsgTypeMultiSend = "/cosmos.bank.v1beta1.MsgMultiSend"
)

// TokenInfo contains information about a Cosmos token
type TokenInfo struct {
	Denom    string
	Symbol   string
	Decimals int
}

// NetworkConfig contains network-specific configuration
type NetworkConfig struct {
	ChainID      string
	RPCURL       string
	RESTURL      string
	Bech32Prefix string
	DefaultToken TokenInfo
}

var (
	// USDC on Noble (native issuance)
	USDCToken = TokenInfo{
		Denom:    USDCDenom,
		Symbol:   "USDC",
		Decimals: 6,
	}

	// Network configurations
	NetworkConfigs = map[string]NetworkConfig{
		NobleMainnetCAIP2: {
			ChainID:      "noble-1",
			RPCURL:       NobleMainnetRPC,
			RESTURL:      NobleMainnetREST,
			Bech32Prefix: NobleBech32Prefix,
			DefaultToken: USDCToken,
		},
		NobleTestnetCAIP2: {
			ChainID:      "grand-1",
			RPCURL:       NobleTestnetRPC,
			RESTURL:      NobleTestnetREST,
			Bech32Prefix: NobleBech32Prefix,
			DefaultToken: USDCToken,
		},
	}

	// Token registry by network
	TokenRegistry = map[string]map[string]TokenInfo{
		NobleMainnetCAIP2: {
			"USDC": USDCToken,
		},
		NobleTestnetCAIP2: {
			"USDC": USDCToken,
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

// GetTokenByDenom returns token info by denom
func GetTokenByDenom(network, denom string) (TokenInfo, bool) {
	tokens, ok := TokenRegistry[network]
	if !ok {
		return TokenInfo{}, false
	}
	for _, token := range tokens {
		if token.Denom == denom {
			return token, true
		}
	}
	return TokenInfo{}, false
}

// IsValidAddress checks if an address has the correct bech32 prefix
func IsValidAddress(address, expectedPrefix string) bool {
	if len(address) < len(expectedPrefix)+1 {
		return false
	}
	return address[:len(expectedPrefix)] == expectedPrefix
}

// GetSupportedNetworks returns all supported Cosmos networks
func GetSupportedNetworks() []string {
	networks := make([]string, 0, len(NetworkConfigs))
	for network := range NetworkConfigs {
		networks = append(networks, network)
	}
	return networks
}
