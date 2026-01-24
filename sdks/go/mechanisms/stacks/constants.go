package stacks

import (
	"fmt"
	"regexp"
	"strings"
)

// Scheme identifiers
const (
	SchemeExactDirect = "exact-direct"
)

// CAIP-2 identifiers for Stacks networks
const (
	StacksCAIP2Namespace = "stacks"
	StacksMainnetCAIP2   = "stacks:1"
	StacksTestnetCAIP2   = "stacks:2147483648"
)

// Default Hiro API endpoints
const (
	DefaultHiroMainnetAPI = "https://api.mainnet.hiro.so"
	DefaultHiroTestnetAPI = "https://api.testnet.hiro.so"
)

// TokenInfo represents token configuration for a Stacks SIP-010 token
type TokenInfo struct {
	ContractAddress string
	Symbol          string
	Name            string
	Decimals        int
}

// Default tokens per network
var (
	// sUSDC on Stacks Mainnet
	SUSDCMainnet = TokenInfo{
		ContractAddress: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
		Symbol:          "sUSDC",
		Name:            "Bridged USDC",
		Decimals:        6,
	}

	// sUSDC on Stacks Testnet
	SUSDCTestnet = TokenInfo{
		ContractAddress: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.token-susdc",
		Symbol:          "sUSDC",
		Name:            "Bridged USDC (Testnet)",
		Decimals:        6,
	}
)

// NetworkConfig holds configuration for a Stacks network
type NetworkConfig struct {
	Name         string
	CAIP2        string
	ApiURL       string
	IsTestnet    bool
	DefaultToken TokenInfo
}

// Networks maps CAIP-2 identifiers to network configurations
var Networks = map[string]NetworkConfig{
	StacksMainnetCAIP2: {
		Name:         "Stacks Mainnet",
		CAIP2:        StacksMainnetCAIP2,
		ApiURL:       DefaultHiroMainnetAPI,
		IsTestnet:    false,
		DefaultToken: SUSDCMainnet,
	},
	StacksTestnetCAIP2: {
		Name:         "Stacks Testnet",
		CAIP2:        StacksTestnetCAIP2,
		ApiURL:       DefaultHiroTestnetAPI,
		IsTestnet:    true,
		DefaultToken: SUSDCTestnet,
	},
}

// GetNetworkConfig returns the network configuration for a CAIP-2 identifier
func GetNetworkConfig(network string) (*NetworkConfig, error) {
	config, ok := Networks[network]
	if !ok {
		return nil, fmt.Errorf("unknown stacks network: %s", network)
	}
	return &config, nil
}

// IsStacksNetwork checks if a network identifier is a Stacks network
func IsStacksNetwork(network string) bool {
	return strings.HasPrefix(network, StacksCAIP2Namespace+":")
}

// IsValidPrincipal checks if an address is a valid Stacks principal
// Stacks principals start with SP (mainnet) or ST (testnet) followed by alphanumeric characters
func IsValidPrincipal(address string) bool {
	if address == "" {
		return false
	}
	principalRegex := regexp.MustCompile(`^(SP|ST)[0-9A-Z]{33,41}$`)
	return principalRegex.MatchString(address)
}

// IsValidTxId checks if a transaction ID is valid (0x prefixed 64 hex chars)
func IsValidTxId(txId string) bool {
	if txId == "" {
		return false
	}
	txIdRegex := regexp.MustCompile(`^0x[a-fA-F0-9]{64}$`)
	return txIdRegex.MatchString(txId)
}

// CompareAddresses compares two Stacks addresses (case-sensitive)
func CompareAddresses(addr1, addr2 string) bool {
	return addr1 == addr2
}
