package evm

// XAU₮0 (Tether Gold) contract addresses by network.
// XAU₮0 uses the same LayerZero OFT standard as USDT0.
// Each XAU₮0 token represents one troy ounce of gold.
// Decimals: 6
var XAUT0Addresses = map[string]string{
	"eip155:1":     "0x68749665FF8D2d112Fa859AA293F07A622782F38", // Ethereum Mainnet
	"eip155:42161": "0x68749665FF8D2d112Fa859AA293F07A622782F38", // Arbitrum One
	"eip155:10":    "0x68749665FF8D2d112Fa859AA293F07A622782F38", // Optimism
	"eip155:137":   "0x68749665FF8D2d112Fa859AA293F07a622782F38", // Polygon
	"eip155:8453":  "0x68749665FF8D2d112Fa859AA293F07a622782F38", // Base
	"eip155:80094": "0x68749665FF8D2d112Fa859AA293F07a622782F38", // Berachain
}

// XAUT0TokenName is the EIP-712 domain name for XAU₮0
const XAUT0TokenName = "TetherGold"

// XAUT0TokenVersion is the EIP-712 domain version
const XAUT0TokenVersion = "1"

// XAUT0Decimals is the number of decimal places
const XAUT0Decimals = 6
