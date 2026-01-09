package tron

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
)

var (
	// TRON address regex (base58check, starts with T, 34 characters)
	tronAddressRegex = regexp.MustCompile(`^T[1-9A-HJ-NP-Za-km-z]{33}$`)
)

// NormalizeNetwork validates and returns the network identifier
func NormalizeNetwork(network string) (string, error) {
	// Already in correct format
	if _, ok := NetworkConfigs[network]; ok {
		return network, nil
	}

	// Handle shorthand formats
	lower := strings.ToLower(network)
	switch lower {
	case "mainnet", "tron":
		return TronMainnetCAIP2, nil
	case "nile", "tron-nile":
		return TronNileCAIP2, nil
	case "shasta", "tron-shasta":
		return TronShastaCAIP2, nil
	}

	return "", fmt.Errorf("unsupported TRON network: %s", network)
}

// GetNetworkConfig returns the configuration for a network
func GetNetworkConfig(network string) (*NetworkConfig, error) {
	caip2Network, err := NormalizeNetwork(network)
	if err != nil {
		return nil, err
	}

	config, ok := NetworkConfigs[caip2Network]
	if !ok {
		return nil, fmt.Errorf("network configuration not found: %s", network)
	}

	return &config, nil
}

// GetAssetInfo returns information about an asset on a network
func GetAssetInfo(network string, assetSymbolOrAddress string) (*AssetInfo, error) {
	config, err := GetNetworkConfig(network)
	if err != nil {
		return nil, err
	}

	// Check if it's a valid TRON address (contract address)
	if ValidateTronAddress(assetSymbolOrAddress) {
		// Check if it matches the default asset
		if AddressesEqual(assetSymbolOrAddress, config.DefaultAsset.ContractAddress) {
			return &config.DefaultAsset, nil
		}

		// Check supported assets by address
		for _, asset := range config.SupportedAssets {
			if AddressesEqual(asset.ContractAddress, assetSymbolOrAddress) {
				return &asset, nil
			}
		}

		// Unknown token - return basic info with default decimals
		return &AssetInfo{
			ContractAddress: assetSymbolOrAddress,
			Symbol:          "UNKNOWN",
			Name:            "Unknown TRC20",
			Decimals:        6, // Default decimals
		}, nil
	}

	// Look up by symbol
	if asset, ok := config.SupportedAssets[strings.ToUpper(assetSymbolOrAddress)]; ok {
		return &asset, nil
	}

	// Default to the network's default asset
	return &config.DefaultAsset, nil
}

// ValidateTronAddress checks if a string is a valid TRON address
func ValidateTronAddress(address string) bool {
	// Check length
	if len(address) != TronAddressLength {
		return false
	}

	// Check format (base58check, starts with T)
	return tronAddressRegex.MatchString(address)
}

// AddressesEqual compares two TRON addresses
func AddressesEqual(addr1, addr2 string) bool {
	if addr1 == "" || addr2 == "" {
		return false
	}
	// TRON addresses are case-sensitive in base58check
	return addr1 == addr2
}

// FormatAddress formats a TRON address for display
func FormatAddress(address string, truncate int) string {
	if address == "" {
		return ""
	}

	if truncate > 0 && len(address) > truncate*2+3 {
		return fmt.Sprintf("%s...%s", address[:truncate], address[len(address)-truncate:])
	}

	return address
}

// ParseAmount converts a decimal string amount to token smallest units
func ParseAmount(amount string, decimals int) (uint64, error) {
	// Remove any whitespace
	amount = strings.TrimSpace(amount)

	// Parse the decimal amount
	parts := strings.Split(amount, ".")
	if len(parts) > 2 {
		return 0, fmt.Errorf("invalid amount format: %s", amount)
	}

	// Parse integer part
	intPart, err := strconv.ParseUint(parts[0], 10, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid integer part: %s", parts[0])
	}

	// Handle decimal part
	decPart := uint64(0)
	if len(parts) == 2 && parts[1] != "" {
		// Pad or truncate decimal part to match token decimals
		decStr := parts[1]
		if len(decStr) > decimals {
			decStr = decStr[:decimals]
		} else {
			decStr += strings.Repeat("0", decimals-len(decStr))
		}

		decPart, err = strconv.ParseUint(decStr, 10, 64)
		if err != nil {
			return 0, fmt.Errorf("invalid decimal part: %s", parts[1])
		}
	}

	// Calculate total in smallest unit
	multiplier := uint64(math.Pow10(decimals))
	result := intPart*multiplier + decPart

	return result, nil
}

// FormatAmount converts an amount in smallest units to a decimal string
func FormatAmount(amount uint64, decimals int) string {
	if amount == 0 {
		return "0"
	}

	divisor := uint64(math.Pow10(decimals))
	quotient := amount / divisor
	remainder := amount % divisor

	// Format the decimal part with leading zeros
	decStr := fmt.Sprintf("%0*d", decimals, remainder)

	// Remove trailing zeros
	decStr = strings.TrimRight(decStr, "0")

	if decStr == "" {
		return fmt.Sprintf("%d", quotient)
	}

	return fmt.Sprintf("%d.%s", quotient, decStr)
}

// IsValidHex checks if a string is valid hexadecimal
func IsValidHex(hex string) bool {
	if hex == "" {
		return false
	}

	// Remove 0x prefix if present
	cleanHex := strings.TrimPrefix(hex, "0x")
	if cleanHex == "" {
		return false
	}

	for _, c := range cleanHex {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}

	return true
}

// IsTestnet returns true if the network is a testnet
func IsTestnet(network string) bool {
	return network == TronNileCAIP2 || network == TronShastaCAIP2
}

// GetDefaultAsset returns the default asset for a network
func GetDefaultAsset(network string) (*AssetInfo, error) {
	config, err := GetNetworkConfig(network)
	if err != nil {
		return nil, err
	}
	return &config.DefaultAsset, nil
}

// GetEndpoint returns the API endpoint for a network
func GetEndpoint(network string) (string, error) {
	config, err := GetNetworkConfig(network)
	if err != nil {
		return "", err
	}
	return config.Endpoint, nil
}

// EstimateTransactionFee estimates the transaction fee in SUN
func EstimateTransactionFee(isActivated bool) int64 {
	// TRC20 transfer typically costs ~15-30 TRX in energy
	// New account activation adds ~1 TRX
	baseFee := int64(30_000_000) // 30 TRX
	if !isActivated {
		baseFee += 1_000_000 // 1 TRX for activation
	}
	return baseFee
}
