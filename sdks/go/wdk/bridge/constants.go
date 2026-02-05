package bridge

import (
	"fmt"
	"math/big"
	"strings"
)

// TokenDecimals is the standard decimal count for stablecoins.
const TokenDecimals = 6

// NativeDecimals is the standard decimal count for native tokens.
const NativeDecimals = 18

// LayerZeroScanURL is the base URL for tracking bridge messages.
const LayerZeroScanURL = "https://layerzeroscan.com/tx/"

// ChainIDs maps network names to chain IDs.
var ChainIDs = map[string]int64{
	"ethereum":  1,
	"arbitrum":  42161,
	"ink":       57073,
	"berachain": 80094,
	"unichain":  130,
}

// USDT0Addresses maps network names to USDT0 OFT contract addresses.
var USDT0Addresses = map[string]string{
	"ethereum":  "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
	"arbitrum":  "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
	"ink":       "0x0200C29006150606B650577BBE7B6248F58470c1",
	"berachain": "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
	"unichain":  "0x9151434b16b9763660705744891fA906F660EcC5",
}

// LayerZeroEndpointIDs maps network names to LayerZero endpoint IDs.
var LayerZeroEndpointIDs = map[string]uint32{
	"ethereum":  30101,
	"arbitrum":  30110,
	"ink":       30291,
	"berachain": 30362,
	"unichain":  30320,
}

// EstimatedBridgeTimes maps network names to estimated bridge time in seconds.
var EstimatedBridgeTimes = map[string]int{
	"ethereum":  900, // 15 minutes for L1
	"arbitrum":  300, // 5 minutes
	"ink":       300,
	"berachain": 300,
	"unichain":  300,
}

// NativeSymbols maps network names to native token symbols.
var NativeSymbols = map[string]string{
	"ethereum":  "ETH",
	"arbitrum":  "ETH",
	"ink":       "ETH",
	"berachain": "BERA",
	"unichain":  "ETH",
}

// ExplorerURLs maps network names to block explorer base URLs.
var ExplorerURLs = map[string]string{
	"ethereum":  "https://etherscan.io",
	"arbitrum":  "https://arbiscan.io",
	"ink":       "https://explorer.ink.xyz",
	"berachain": "https://berascan.com",
	"unichain":  "https://uniscan.xyz",
}

// DefaultRPCURLs maps network names to default RPC endpoints.
var DefaultRPCURLs = map[string]string{
	"ethereum":  "https://eth.llamarpc.com",
	"arbitrum":  "https://arb1.arbitrum.io/rpc",
	"ink":       "https://rpc-gel.inkonchain.com",
	"berachain": "https://rpc.berachain.com",
	"unichain":  "https://mainnet.unichain.org",
}

// BridgeableChains lists all chains that support USDT0 bridging.
var BridgeableChains = []string{
	"ethereum",
	"arbitrum",
	"ink",
	"berachain",
	"unichain",
}

// IsBridgeableChain checks if a chain supports USDT0 bridging.
func IsBridgeableChain(chain string) bool {
	for _, c := range BridgeableChains {
		if c == chain {
			return true
		}
	}
	return false
}

// GetExplorerTxURL returns the block explorer URL for a transaction.
func GetExplorerTxURL(network, txHash string) string {
	baseURL, ok := ExplorerURLs[network]
	if !ok {
		return ""
	}
	return fmt.Sprintf("%s/tx/%s", baseURL, txHash)
}

// FormatTokenAmount formats a raw token amount with decimals.
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
