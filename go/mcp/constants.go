package mcp

import (
	"fmt"
	"math/big"
	"strings"
)

// Chain IDs for supported networks.
var ChainIDs = map[SupportedNetwork]int64{
	NetworkEthereum:  1,
	NetworkBase:      8453,
	NetworkArbitrum:  42161,
	NetworkOptimism:  10,
	NetworkPolygon:   137,
	NetworkAvalanche: 43114,
	NetworkInk:       57073,
	NetworkBerachain: 80094,
	NetworkUnichain:  130,
}

// Native token symbols for each network.
var NativeSymbols = map[SupportedNetwork]string{
	NetworkEthereum:  "ETH",
	NetworkBase:      "ETH",
	NetworkArbitrum:  "ETH",
	NetworkOptimism:  "ETH",
	NetworkPolygon:   "MATIC",
	NetworkAvalanche: "AVAX",
	NetworkInk:       "ETH",
	NetworkBerachain: "BERA",
	NetworkUnichain:  "ETH",
}

// Block explorer URLs for each network.
var ExplorerURLs = map[SupportedNetwork]string{
	NetworkEthereum:  "https://etherscan.io",
	NetworkBase:      "https://basescan.org",
	NetworkArbitrum:  "https://arbiscan.io",
	NetworkOptimism:  "https://optimistic.etherscan.io",
	NetworkPolygon:   "https://polygonscan.com",
	NetworkAvalanche: "https://snowtrace.io",
	NetworkInk:       "https://explorer.ink.xyz",
	NetworkBerachain: "https://berascan.com",
	NetworkUnichain:  "https://uniscan.xyz",
}

// Default RPC URLs for each network.
var DefaultRPCURLs = map[SupportedNetwork]string{
	NetworkEthereum:  "https://eth.llamarpc.com",
	NetworkBase:      "https://mainnet.base.org",
	NetworkArbitrum:  "https://arb1.arbitrum.io/rpc",
	NetworkOptimism:  "https://mainnet.optimism.io",
	NetworkPolygon:   "https://polygon-rpc.com",
	NetworkAvalanche: "https://api.avax.network/ext/bc/C/rpc",
	NetworkInk:       "https://rpc-qnd.ink.xyz",
	NetworkBerachain: "https://artio.rpc.berachain.com",
	NetworkUnichain:  "https://mainnet.unichain.org",
}

// USDC contract addresses by network.
var USDCAddresses = map[SupportedNetwork]string{
	NetworkEthereum:  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
	NetworkBase:      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
	NetworkArbitrum:  "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
	NetworkOptimism:  "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
	NetworkPolygon:   "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
	NetworkAvalanche: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
	NetworkInk:       "0x0200C29006150606B650577BBE7B6248F58470c1", // May differ
	NetworkBerachain: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736", // May differ
	NetworkUnichain:  "0x588ce4F028D8e7B53B687865d6A67b3A54C75518", // May differ
}

// USDT contract addresses by network.
var USDTAddresses = map[SupportedNetwork]string{
	NetworkEthereum:  "0xdAC17F958D2ee523a2206206994597C13D831ec7",
	NetworkArbitrum:  "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
	NetworkOptimism:  "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
	NetworkPolygon:   "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
	NetworkAvalanche: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
}

// USDT0 OFT contract addresses (LayerZero bridgeable).
var USDT0Addresses = map[SupportedNetwork]string{
	NetworkEthereum:  "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
	NetworkArbitrum:  "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
	NetworkInk:       "0x0200C29006150606B650577BBE7B6248F58470c1",
	NetworkBerachain: "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
	NetworkUnichain:  "0x588ce4F028D8e7B53B687865d6A67b3A54C75518",
}

// Networks that support USDT0 bridging via LayerZero.
var BridgeableChains = []SupportedNetwork{
	NetworkEthereum,
	NetworkArbitrum,
	NetworkInk,
	NetworkBerachain,
	NetworkUnichain,
}

// Networks that support ERC-4337 gasless payments.
var GaslessNetworks = []SupportedNetwork{
	NetworkEthereum,
	NetworkBase,
	NetworkArbitrum,
	NetworkOptimism,
	NetworkPolygon,
	NetworkAvalanche,
}

// LayerZero endpoint IDs for bridging.
var LayerZeroEndpointIDs = map[SupportedNetwork]uint32{
	NetworkEthereum:  30101,
	NetworkArbitrum:  30110,
	NetworkInk:       30291,
	NetworkBerachain: 30362,
	NetworkUnichain:  30320,
}

// LayerZero Scan URL for tracking bridge messages.
const LayerZeroScanURL = "https://layerzeroscan.com/tx/"

// AllNetworks returns all supported networks.
func AllNetworks() []SupportedNetwork {
	return []SupportedNetwork{
		NetworkEthereum,
		NetworkBase,
		NetworkArbitrum,
		NetworkOptimism,
		NetworkPolygon,
		NetworkAvalanche,
		NetworkInk,
		NetworkBerachain,
		NetworkUnichain,
	}
}

// IsValidNetwork checks if a network string is valid.
func IsValidNetwork(network string) bool {
	for _, n := range AllNetworks() {
		if string(n) == network {
			return true
		}
	}
	return false
}

// IsBridgeableChain checks if a network supports USDT0 bridging.
func IsBridgeableChain(network string) bool {
	for _, n := range BridgeableChains {
		if string(n) == network {
			return true
		}
	}
	return false
}

// IsGaslessNetwork checks if a network supports ERC-4337 gasless payments.
func IsGaslessNetwork(network string) bool {
	for _, n := range GaslessNetworks {
		if string(n) == network {
			return true
		}
	}
	return false
}

// GetTokenAddress returns the token contract address for a network.
func GetTokenAddress(network SupportedNetwork, token SupportedToken) (string, bool) {
	switch token {
	case TokenUSDC:
		addr, ok := USDCAddresses[network]
		return addr, ok
	case TokenUSDT:
		addr, ok := USDTAddresses[network]
		return addr, ok
	case TokenUSDT0:
		addr, ok := USDT0Addresses[network]
		return addr, ok
	default:
		return "", false
	}
}

// GetExplorerTxURL returns the explorer URL for a transaction.
func GetExplorerTxURL(network SupportedNetwork, txHash string) string {
	baseURL, ok := ExplorerURLs[network]
	if !ok {
		return ""
	}
	return fmt.Sprintf("%s/tx/%s", baseURL, txHash)
}

// GetRPCURL returns the RPC URL for a network, using config override if available.
func GetRPCURL(config *ServerConfig, network SupportedNetwork) string {
	if config != nil && config.RPCURLs != nil {
		if url, ok := config.RPCURLs[string(network)]; ok && url != "" {
			return url
		}
	}
	return DefaultRPCURLs[network]
}

// FormatTokenAmount formats a raw token amount with decimals to human-readable string.
func FormatTokenAmount(amount *big.Int, decimals int) string {
	if amount == nil || amount.Cmp(big.NewInt(0)) == 0 {
		return "0"
	}

	divisor := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil)
	whole := new(big.Int).Div(amount, divisor)
	fraction := new(big.Int).Mod(amount, divisor)

	if fraction.Cmp(big.NewInt(0)) == 0 {
		return whole.String()
	}

	// Format fraction and trim trailing zeros
	fractionStr := fraction.String()
	for len(fractionStr) < decimals {
		fractionStr = "0" + fractionStr
	}
	fractionStr = strings.TrimRight(fractionStr, "0")

	return fmt.Sprintf("%s.%s", whole.String(), fractionStr)
}

// ParseTokenAmount parses a human-readable amount string to raw token units.
func ParseTokenAmount(amount string, decimals int) (*big.Int, error) {
	parts := strings.Split(amount, ".")

	whole := new(big.Int)
	if _, ok := whole.SetString(parts[0], 10); !ok {
		return nil, fmt.Errorf("invalid amount: %s", amount)
	}

	// Multiply by 10^decimals
	multiplier := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil)
	result := new(big.Int).Mul(whole, multiplier)

	if len(parts) == 2 {
		// Handle fractional part
		frac := parts[1]
		if len(frac) > decimals {
			frac = frac[:decimals]
		}
		for len(frac) < decimals {
			frac += "0"
		}

		fracBig := new(big.Int)
		if _, ok := fracBig.SetString(frac, 10); !ok {
			return nil, fmt.Errorf("invalid fractional part: %s", parts[1])
		}
		result = result.Add(result, fracBig)
	}

	return result, nil
}

// TokenDecimals is the standard decimal count for stablecoins.
const TokenDecimals = 6

// NativeDecimals is the standard decimal count for native tokens.
const NativeDecimals = 18
