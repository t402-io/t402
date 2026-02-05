package gasless

import (
	"fmt"
	"math/big"
	"strings"
)

// TokenDecimals is the standard decimal count for stablecoins (USDT0, USDC, USDT).
const TokenDecimals = 6

// ChainIDs maps network names to chain IDs.
var ChainIDs = map[string]int64{
	"ethereum":  1,
	"base":      8453,
	"arbitrum":  42161,
	"optimism":  10,
	"polygon":   137,
	"avalanche": 43114,
}

// DefaultRPCURLs maps network names to default RPC endpoints.
var DefaultRPCURLs = map[string]string{
	"ethereum":  "https://eth.llamarpc.com",
	"base":      "https://mainnet.base.org",
	"arbitrum":  "https://arb1.arbitrum.io/rpc",
	"optimism":  "https://mainnet.optimism.io",
	"polygon":   "https://polygon-rpc.com",
	"avalanche": "https://api.avax.network/ext/bc/C/rpc",
}

// GaslessNetworks lists networks that support ERC-4337 gasless payments.
var GaslessNetworks = []string{
	"ethereum",
	"base",
	"arbitrum",
	"optimism",
	"polygon",
	"avalanche",
}

// USDT0Addresses maps network names to USDT0 contract addresses.
var USDT0Addresses = map[string]string{
	"ethereum": "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
	"arbitrum": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
}

// USDCAddresses maps network names to USDC contract addresses.
var USDCAddresses = map[string]string{
	"ethereum":  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
	"base":      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
	"arbitrum":  "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
	"optimism":  "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
	"polygon":   "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
	"avalanche": "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
}

// ExplorerURLs maps network names to block explorer base URLs.
var ExplorerURLs = map[string]string{
	"ethereum":  "https://etherscan.io",
	"base":      "https://basescan.org",
	"arbitrum":  "https://arbiscan.io",
	"optimism":  "https://optimistic.etherscan.io",
	"polygon":   "https://polygonscan.com",
	"avalanche": "https://snowtrace.io",
}

// IsGaslessNetwork checks if a network supports ERC-4337 gasless payments.
func IsGaslessNetwork(network string) bool {
	for _, n := range GaslessNetworks {
		if n == network {
			return true
		}
	}
	return false
}

// GetTokenAddress returns the token contract address for a network.
func GetTokenAddress(network, token string) (string, bool) {
	switch strings.ToUpper(token) {
	case "USDT0":
		addr, ok := USDT0Addresses[network]
		return addr, ok
	case "USDC":
		addr, ok := USDCAddresses[network]
		return addr, ok
	default:
		return "", false
	}
}

// GetExplorerTxURL returns the block explorer URL for a transaction.
func GetExplorerTxURL(network, txHash string) string {
	baseURL, ok := ExplorerURLs[network]
	if !ok {
		return ""
	}
	return fmt.Sprintf("%s/tx/%s", baseURL, txHash)
}

// ParseTokenAmount parses a human-readable amount string to raw token units.
func ParseTokenAmount(amount string, decimals int) (*big.Int, error) {
	parts := strings.Split(amount, ".")

	whole := new(big.Int)
	if _, ok := whole.SetString(parts[0], 10); !ok {
		return nil, fmt.Errorf("invalid amount: %s", amount)
	}

	multiplier := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil)
	result := new(big.Int).Mul(whole, multiplier)

	if len(parts) == 2 {
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
