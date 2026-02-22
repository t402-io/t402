// Package btc provides Bitcoin and Lightning Network payment mechanism support for T402.
//
// Bitcoin on-chain payments use PSBT (Partially Signed Bitcoin Transactions)
// and the "exact" scheme. Lightning payments use BOLT11 invoices and
// preimage-based verification.
package btc

import "strings"

// Scheme identifiers
const (
	SchemeExact = "exact"
)

// CAIP-2 network identifiers for Bitcoin on-chain
// Uses BIP-122 chain genesis block hashes
const (
	BtcMainnetCAIP2 = "bip122:000000000019d6689c085ae165831e93"
	BtcTestnetCAIP2 = "bip122:000000000933ea01ad0ee984209779ba"
)

// CAIP-2 network identifiers for Lightning Network
const (
	LightningMainnetCAIP2 = "lightning:mainnet"
	LightningTestnetCAIP2 = "lightning:testnet"
)

// Dust limit in satoshis - minimum viable output value
const DustLimit int64 = 546

// SatsPerBTC is the number of satoshis in one bitcoin
const SatsPerBTC int64 = 100_000_000

// DefaultValidityDuration is the default timeout for payment validity (seconds)
const DefaultValidityDuration = 3600

// Bitcoin address prefixes for basic validation
var (
	MainnetAddressPrefixes = []string{"bc1", "1", "3"}
	TestnetAddressPrefixes = []string{"tb1", "m", "n", "2"}
)

// BtcNetworks lists all supported Bitcoin on-chain networks
var BtcNetworks = []string{BtcMainnetCAIP2, BtcTestnetCAIP2}

// LightningNetworks lists all supported Lightning networks
var LightningNetworks = []string{LightningMainnetCAIP2, LightningTestnetCAIP2}

// IsBtcNetwork checks if a network identifier is a Bitcoin on-chain network
func IsBtcNetwork(network string) bool {
	return strings.HasPrefix(network, "bip122:")
}

// IsLightningNetwork checks if a network identifier is a Lightning network
func IsLightningNetwork(network string) bool {
	return strings.HasPrefix(network, "lightning:")
}

// IsSupportedBtcNetwork checks if a network is a known BTC on-chain network
func IsSupportedBtcNetwork(network string) bool {
	for _, n := range BtcNetworks {
		if n == network {
			return true
		}
	}
	return false
}

// IsSupportedLightningNetwork checks if a network is a known Lightning network
func IsSupportedLightningNetwork(network string) bool {
	for _, n := range LightningNetworks {
		if n == network {
			return true
		}
	}
	return false
}

// ValidateBitcoinAddress performs basic format validation on a Bitcoin address
func ValidateBitcoinAddress(address string) bool {
	if address == "" || len(address) < 14 || len(address) > 90 {
		return false
	}
	allPrefixes := append(MainnetAddressPrefixes, TestnetAddressPrefixes...)
	for _, prefix := range allPrefixes {
		if strings.HasPrefix(address, prefix) {
			return true
		}
	}
	return false
}

// IsMainnetAddress checks if a Bitcoin address is for mainnet
func IsMainnetAddress(address string) bool {
	for _, prefix := range MainnetAddressPrefixes {
		if strings.HasPrefix(address, prefix) {
			return true
		}
	}
	return false
}

// IsTestnetAddress checks if a Bitcoin address is for testnet
func IsTestnetAddress(address string) bool {
	for _, prefix := range TestnetAddressPrefixes {
		if strings.HasPrefix(address, prefix) {
			return true
		}
	}
	return false
}

// ValidateBolt11Invoice performs basic format validation on a BOLT11 invoice
func ValidateBolt11Invoice(invoice string) bool {
	if invoice == "" || len(invoice) < 20 {
		return false
	}
	lower := strings.ToLower(invoice)
	return strings.HasPrefix(lower, "lnbc") ||
		strings.HasPrefix(lower, "lntb") ||
		strings.HasPrefix(lower, "lnbcrt")
}

// IsValidHex checks if a string is valid hex of the expected byte length
func IsValidHex(hex string, expectedByteLen int) bool {
	if len(hex) == 0 {
		return false
	}
	for _, c := range hex {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	if expectedByteLen > 0 && len(hex) != expectedByteLen*2 {
		return false
	}
	return true
}
