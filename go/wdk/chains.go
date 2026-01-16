package wdk

import "strings"

// Default chain configurations.
var DefaultChains = map[string]ChainConfig{
	"ethereum": {
		ChainID:     1,
		Network:     "eip155:1",
		Name:        "ethereum",
		RPCURL:      "https://eth.drpc.org",
		NetworkType: NetworkTypeEVM,
	},
	"arbitrum": {
		ChainID:     42161,
		Network:     "eip155:42161",
		Name:        "arbitrum",
		RPCURL:      "https://arb1.arbitrum.io/rpc",
		NetworkType: NetworkTypeEVM,
	},
	"base": {
		ChainID:     8453,
		Network:     "eip155:8453",
		Name:        "base",
		RPCURL:      "https://mainnet.base.org",
		NetworkType: NetworkTypeEVM,
	},
	"ink": {
		ChainID:     57073,
		Network:     "eip155:57073",
		Name:        "ink",
		RPCURL:      "https://rpc-gel.inkonchain.com",
		NetworkType: NetworkTypeEVM,
	},
	"berachain": {
		ChainID:     80094,
		Network:     "eip155:80094",
		Name:        "berachain",
		RPCURL:      "https://rpc.berachain.com",
		NetworkType: NetworkTypeEVM,
	},
	"polygon": {
		ChainID:     137,
		Network:     "eip155:137",
		Name:        "polygon",
		RPCURL:      "https://polygon-rpc.com",
		NetworkType: NetworkTypeEVM,
	},
	"optimism": {
		ChainID:     10,
		Network:     "eip155:10",
		Name:        "optimism",
		RPCURL:      "https://mainnet.optimism.io",
		NetworkType: NetworkTypeEVM,
	},
	// Testnets
	"arbitrum-sepolia": {
		ChainID:     421614,
		Network:     "eip155:421614",
		Name:        "arbitrum-sepolia",
		RPCURL:      "https://sepolia-rollup.arbitrum.io/rpc",
		NetworkType: NetworkTypeEVM,
	},
	"base-sepolia": {
		ChainID:     84532,
		Network:     "eip155:84532",
		Name:        "base-sepolia",
		RPCURL:      "https://sepolia.base.org",
		NetworkType: NetworkTypeEVM,
	},
}

// USDT0Addresses contains USDT0 token addresses by chain (supports EIP-3009).
var USDT0Addresses = map[string]string{
	"ethereum":  "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
	"arbitrum":  "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
	"ink":       "0x0200C29006150606B650577BBE7B6248F58470c1",
	"berachain": "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
	"unichain":  "0x588ce4F028D8e7B53B687865d6A67b3A54C75518",
}

// USDCAddresses contains USDC token addresses by chain.
var USDCAddresses = map[string]string{
	"ethereum": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
	"arbitrum": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
	"base":     "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
	"polygon":  "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
	"optimism": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
}

// USDTLegacyAddresses contains legacy USDT addresses (no EIP-3009 support).
var USDTLegacyAddresses = map[string]string{
	"ethereum": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
	"polygon":  "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
}

// ChainTokens maps chains to their supported tokens.
var ChainTokens = map[string][]TokenInfo{
	"ethereum": {
		{
			Address:         USDT0Addresses["ethereum"],
			Symbol:          "USDT0",
			Name:            "TetherToken",
			Decimals:        6,
			SupportsEIP3009: true,
		},
		{
			Address:         USDCAddresses["ethereum"],
			Symbol:          "USDC",
			Name:            "USD Coin",
			Decimals:        6,
			SupportsEIP3009: true,
		},
		{
			Address:         USDTLegacyAddresses["ethereum"],
			Symbol:          "USDT",
			Name:            "Tether USD",
			Decimals:        6,
			SupportsEIP3009: false,
		},
	},
	"arbitrum": {
		{
			Address:         USDT0Addresses["arbitrum"],
			Symbol:          "USDT0",
			Name:            "TetherToken",
			Decimals:        6,
			SupportsEIP3009: true,
		},
		{
			Address:         USDCAddresses["arbitrum"],
			Symbol:          "USDC",
			Name:            "USD Coin",
			Decimals:        6,
			SupportsEIP3009: true,
		},
	},
	"base": {
		{
			Address:         USDCAddresses["base"],
			Symbol:          "USDC",
			Name:            "USD Coin",
			Decimals:        6,
			SupportsEIP3009: true,
		},
	},
	"ink": {
		{
			Address:         USDT0Addresses["ink"],
			Symbol:          "USDT0",
			Name:            "TetherToken",
			Decimals:        6,
			SupportsEIP3009: true,
		},
	},
	"berachain": {
		{
			Address:         USDT0Addresses["berachain"],
			Symbol:          "USDT0",
			Name:            "TetherToken",
			Decimals:        6,
			SupportsEIP3009: true,
		},
	},
	"polygon": {
		{
			Address:         USDCAddresses["polygon"],
			Symbol:          "USDC",
			Name:            "USD Coin",
			Decimals:        6,
			SupportsEIP3009: true,
		},
		{
			Address:         USDTLegacyAddresses["polygon"],
			Symbol:          "USDT",
			Name:            "Tether USD",
			Decimals:        6,
			SupportsEIP3009: false,
		},
	},
	"optimism": {
		{
			Address:         USDCAddresses["optimism"],
			Symbol:          "USDC",
			Name:            "USD Coin",
			Decimals:        6,
			SupportsEIP3009: true,
		},
	},
}

// GetChainConfig returns the configuration for a chain.
func GetChainConfig(chain string) (ChainConfig, bool) {
	config, ok := DefaultChains[chain]
	return config, ok
}

// GetChainID returns the chain ID for a chain name.
func GetChainID(chain string) int64 {
	if config, ok := DefaultChains[chain]; ok {
		return config.ChainID
	}
	return 1
}

// GetNetworkFromChain returns the CAIP-2 network ID from a chain name.
func GetNetworkFromChain(chain string) string {
	if config, ok := DefaultChains[chain]; ok {
		return config.Network
	}
	return "eip155:1"
}

// GetChainFromNetwork returns the chain name from a CAIP-2 network ID.
func GetChainFromNetwork(network string) (string, bool) {
	for chain, config := range DefaultChains {
		if config.Network == network {
			return chain, true
		}
	}
	return "", false
}

// GetUSDT0Chains returns all chains that support USDT0.
func GetUSDT0Chains() []string {
	chains := make([]string, 0, len(USDT0Addresses))
	for chain := range USDT0Addresses {
		chains = append(chains, chain)
	}
	return chains
}

// GetChainTokens returns all tokens for a chain.
func GetChainTokens(chain string) []TokenInfo {
	if tokens, ok := ChainTokens[chain]; ok {
		return tokens
	}
	return nil
}

// GetPreferredToken returns the preferred token for a chain (USDT0 > USDC > others).
func GetPreferredToken(chain string) *TokenInfo {
	tokens := GetChainTokens(chain)
	if len(tokens) == 0 {
		return nil
	}

	// Priority: USDT0 > USDC > others
	for _, symbol := range []string{"USDT0", "USDC"} {
		for i := range tokens {
			if tokens[i].Symbol == symbol {
				return &tokens[i]
			}
		}
	}
	return &tokens[0]
}

// GetTokenAddress returns the token address for a chain and symbol.
func GetTokenAddress(chain, symbol string) (string, bool) {
	tokens := GetChainTokens(chain)
	symbol = strings.ToUpper(symbol)
	for _, token := range tokens {
		if strings.ToUpper(token.Symbol) == symbol {
			return token.Address, true
		}
	}
	return "", false
}

// IsTestnet checks if a chain is a testnet.
func IsTestnet(chain string) bool {
	testnetKeywords := []string{"sepolia", "testnet", "devnet", "nile", "shasta"}
	chainLower := strings.ToLower(chain)
	for _, keyword := range testnetKeywords {
		if strings.Contains(chainLower, keyword) {
			return true
		}
	}
	return false
}

// GetAllChains returns all configured chain names.
func GetAllChains() []string {
	chains := make([]string, 0, len(DefaultChains))
	for chain := range DefaultChains {
		chains = append(chains, chain)
	}
	return chains
}

// GetMainnetChains returns all mainnet chain names.
func GetMainnetChains() []string {
	var chains []string
	for chain := range DefaultChains {
		if !IsTestnet(chain) {
			chains = append(chains, chain)
		}
	}
	return chains
}
