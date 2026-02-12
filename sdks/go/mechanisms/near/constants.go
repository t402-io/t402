package near

const (
	// Scheme identifiers
	SchemeExactDirect = "exact-direct"

	// CAIP-2 network identifiers
	NearMainnetCAIP2 = "near:mainnet"
	NearTestnetCAIP2 = "near:testnet"

	// RPC endpoints
	NearMainnetRPC = "https://rpc.mainnet.near.org"
	NearTestnetRPC = "https://rpc.testnet.near.org"

	// Default gas for ft_transfer (30 TGas)
	DefaultGas = "30000000000000"

	// Storage deposit required (1 yoctoNEAR)
	StorageDeposit = "1"

	// NEP-141 function names
	FunctionFtTransfer   = "ft_transfer"
	FunctionFtBalanceOf  = "ft_balance_of"
	FunctionStorageBalance = "storage_balance_of"
)

// TokenInfo contains information about a NEAR token
type TokenInfo struct {
	ContractID string
	Symbol     string
	Decimals   int
}

// NetworkConfig contains network-specific configuration
type NetworkConfig struct {
	NetworkID    string
	RPCURL       string
	DefaultToken TokenInfo
}

var (
	// USDC on NEAR Mainnet (Rainbow Bridge)
	USDCMainnet = TokenInfo{
		ContractID: "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
		Symbol:     "USDC",
		Decimals:   6,
	}

	// USDT on NEAR Mainnet
	USDTMainnet = TokenInfo{
		ContractID: "usdt.tether-token.near",
		Symbol:     "USDT",
		Decimals:   6,
	}

	// USDC on NEAR Testnet (fake)
	USDCTestnet = TokenInfo{
		ContractID: "usdc.fakes.testnet",
		Symbol:     "USDC",
		Decimals:   6,
	}

	// Network configurations
	NetworkConfigs = map[string]NetworkConfig{
		NearMainnetCAIP2: {
			NetworkID:    "mainnet",
			RPCURL:       NearMainnetRPC,
			DefaultToken: USDTMainnet,
		},
		NearTestnetCAIP2: {
			NetworkID:    "testnet",
			RPCURL:       NearTestnetRPC,
			DefaultToken: USDTTestnet,
		},
	}

	// USDT on NEAR Testnet
	USDTTestnet = TokenInfo{
		ContractID: "usdt.fakes.testnet",
		Symbol:     "USDT",
		Decimals:   6,
	}

	// Token registry by network
	TokenRegistry = map[string]map[string]TokenInfo{
		NearMainnetCAIP2: {
			"USDC": USDCMainnet,
			"USDT": USDTMainnet,
		},
		NearTestnetCAIP2: {
			"USDC": USDCTestnet,
			"USDT": USDTTestnet,
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

// GetTokenByContract returns token info by contract address
func GetTokenByContract(network, contractID string) (TokenInfo, bool) {
	tokens, ok := TokenRegistry[network]
	if !ok {
		return TokenInfo{}, false
	}
	for _, token := range tokens {
		if token.ContractID == contractID {
			return token, true
		}
	}
	return TokenInfo{}, false
}
