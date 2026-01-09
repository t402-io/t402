package bridge

import (
	"encoding/hex"
	"fmt"
	"strings"
)

const (
	// LayerZeroScanBaseURL is the base URL for LayerZero Scan API.
	LayerZeroScanBaseURL = "https://scan.layerzero-api.com/v1"

	// DefaultSlippage is the default slippage tolerance (0.5%).
	DefaultSlippage = 0.5

	// EstimatedBridgeTime is the estimated bridge completion time in seconds (~5 minutes).
	EstimatedBridgeTime = 300

	// DefaultTimeout is the default timeout for waiting (10 minutes).
	DefaultTimeout = 600000

	// DefaultPollInterval is the default polling interval (10 seconds).
	DefaultPollInterval = 10000
)

// LayerZero Endpoint IDs (v2)
var LayerZeroEndpointIDs = map[string]uint32{
	"ethereum":  30101,
	"arbitrum":  30110,
	"ink":       30291,
	"berachain": 30362,
	"unichain":  30320,
}

// USDT0 OFT Contract Addresses
var USDT0OFTAddresses = map[string]string{
	"ethereum":  "0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee",
	"arbitrum":  "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
	"ink":       "0x0200C29006150606B650577BBE7B6248F58470c1",
	"berachain": "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
	"unichain":  "0x588ce4F028D8e7B53B687865d6A67b3A54C75518",
}

// NetworkToChain maps network identifiers to chain names.
var NetworkToChain = map[string]string{
	"eip155:1":      "ethereum",
	"eip155:42161":  "arbitrum",
	"eip155:57073":  "ink",
	"eip155:80094":  "berachain",
	"eip155:130":    "unichain",
}

// ChainToNetwork maps chain names to network identifiers.
var ChainToNetwork = map[string]string{
	"ethereum":  "eip155:1",
	"arbitrum":  "eip155:42161",
	"ink":       "eip155:57073",
	"berachain": "eip155:80094",
	"unichain":  "eip155:130",
}

// OFTSentEventTopic is the keccak256 hash of OFTSent event signature.
// OFTSent(bytes32 indexed guid, uint32 dstEid, address indexed from, uint256 amountSentLD, uint256 amountReceivedLD)
const OFTSentEventTopic = "0x85496b760a4b7f8d66384b9df21b381f5d1b1e79f229a47aaf4c232edc2fe59a"

// DefaultExtraOptions is the default extra options for LayerZero send (empty).
var DefaultExtraOptions = []byte{}

// OFT Send ABI
var OFTSendABI = []byte(`[
	{
		"inputs": [
			{
				"components": [
					{"name": "dstEid", "type": "uint32"},
					{"name": "to", "type": "bytes32"},
					{"name": "amountLD", "type": "uint256"},
					{"name": "minAmountLD", "type": "uint256"},
					{"name": "extraOptions", "type": "bytes"},
					{"name": "composeMsg", "type": "bytes"},
					{"name": "oftCmd", "type": "bytes"}
				],
				"name": "_sendParam",
				"type": "tuple"
			},
			{"name": "_payInLzToken", "type": "bool"}
		],
		"name": "quoteSend",
		"outputs": [
			{
				"components": [
					{"name": "nativeFee", "type": "uint256"},
					{"name": "lzTokenFee", "type": "uint256"}
				],
				"name": "",
				"type": "tuple"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"components": [
					{"name": "dstEid", "type": "uint32"},
					{"name": "to", "type": "bytes32"},
					{"name": "amountLD", "type": "uint256"},
					{"name": "minAmountLD", "type": "uint256"},
					{"name": "extraOptions", "type": "bytes"},
					{"name": "composeMsg", "type": "bytes"},
					{"name": "oftCmd", "type": "bytes"}
				],
				"name": "_sendParam",
				"type": "tuple"
			},
			{
				"components": [
					{"name": "nativeFee", "type": "uint256"},
					{"name": "lzTokenFee", "type": "uint256"}
				],
				"name": "_fee",
				"type": "tuple"
			},
			{"name": "_refundAddress", "type": "address"}
		],
		"name": "send",
		"outputs": [
			{
				"components": [
					{"name": "guid", "type": "bytes32"},
					{"name": "nonce", "type": "uint64"},
					{
						"components": [
							{"name": "nativeFee", "type": "uint256"},
							{"name": "lzTokenFee", "type": "uint256"}
						],
						"name": "fee",
						"type": "tuple"
					}
				],
				"name": "",
				"type": "tuple"
			},
			{
				"components": [
					{"name": "amountSentLD", "type": "uint256"},
					{"name": "amountReceivedLD", "type": "uint256"}
				],
				"name": "",
				"type": "tuple"
			}
		],
		"stateMutability": "payable",
		"type": "function"
	}
]`)

// ERC20 Approve ABI
var ERC20ApproveABI = []byte(`[
	{
		"inputs": [
			{"name": "owner", "type": "address"},
			{"name": "spender", "type": "address"}
		],
		"name": "allowance",
		"outputs": [{"name": "", "type": "uint256"}],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{"name": "spender", "type": "address"},
			{"name": "amount", "type": "uint256"}
		],
		"name": "approve",
		"outputs": [{"name": "", "type": "bool"}],
		"stateMutability": "nonpayable",
		"type": "function"
	}
]`)

// GetEndpointID returns the LayerZero endpoint ID for a chain name.
func GetEndpointID(chain string) (uint32, bool) {
	eid, ok := LayerZeroEndpointIDs[strings.ToLower(chain)]
	return eid, ok
}

// GetEndpointIDFromNetwork returns the LayerZero endpoint ID from a network identifier.
func GetEndpointIDFromNetwork(network string) (uint32, bool) {
	chain, ok := NetworkToChain[network]
	if !ok {
		return 0, false
	}
	return GetEndpointID(chain)
}

// GetUSDT0OFTAddress returns the USDT0 OFT contract address for a chain.
func GetUSDT0OFTAddress(chain string) (string, bool) {
	addr, ok := USDT0OFTAddresses[strings.ToLower(chain)]
	return addr, ok
}

// SupportsBridging checks if a chain supports USDT0 bridging.
func SupportsBridging(chain string) bool {
	_, ok := USDT0OFTAddresses[strings.ToLower(chain)]
	return ok
}

// GetBridgeableChains returns all chains that support USDT0 bridging.
func GetBridgeableChains() []string {
	chains := make([]string, 0, len(USDT0OFTAddresses))
	for chain := range USDT0OFTAddresses {
		chains = append(chains, chain)
	}
	return chains
}

// AddressToBytes32 converts an address string to a 32-byte array (left-padded).
func AddressToBytes32(address string) ([32]byte, error) {
	var result [32]byte

	// Remove 0x prefix if present
	addr := strings.TrimPrefix(address, "0x")

	// Decode hex
	decoded, err := hex.DecodeString(addr)
	if err != nil {
		return result, fmt.Errorf("invalid address: %w", err)
	}

	if len(decoded) != 20 {
		return result, fmt.Errorf("invalid address length: expected 20 bytes, got %d", len(decoded))
	}

	// Copy to last 20 bytes (left-padded with zeros)
	copy(result[12:], decoded)
	return result, nil
}

// Bytes32ToAddress converts a 32-byte array to an address string.
func Bytes32ToAddress(b [32]byte) string {
	// Take last 20 bytes
	return "0x" + hex.EncodeToString(b[12:])
}
