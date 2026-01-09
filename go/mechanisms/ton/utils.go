package ton

import (
	"encoding/base64"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
)

var (
	// TON friendly address regex (base64url, 48 characters)
	// Handles both bounceable (EQ...) and non-bounceable (UQ...) addresses
	// Also handles testnet format (kQ...)
	tonFriendlyAddressRegex = regexp.MustCompile(`^[A-Za-z0-9_-]{46,48}$`)

	// TON raw address regex (workchain:hash format)
	tonRawAddressRegex = regexp.MustCompile(`^-?[0-9]:[a-fA-F0-9]{64}$`)
)

// NormalizeNetwork validates and returns the network identifier
func NormalizeNetwork(network string) (string, error) {
	if _, ok := NetworkConfigs[network]; ok {
		return network, nil
	}
	return "", fmt.Errorf("unsupported TON network: %s", network)
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

	// Check if it's a valid TON address (Jetton master address)
	if ValidateTonAddress(assetSymbolOrAddress) {
		// Check if it matches the default asset
		if AddressesEqual(assetSymbolOrAddress, config.DefaultAsset.MasterAddress) {
			return &config.DefaultAsset, nil
		}

		// Check supported assets by address
		for _, asset := range config.SupportedAssets {
			if AddressesEqual(asset.MasterAddress, assetSymbolOrAddress) {
				return &asset, nil
			}
		}

		// Unknown token - return basic info with default decimals
		return &AssetInfo{
			MasterAddress: assetSymbolOrAddress,
			Symbol:        "UNKNOWN",
			Name:          "Unknown Jetton",
			Decimals:      9, // Default decimals
		}, nil
	}

	// Look up by symbol
	if asset, ok := config.SupportedAssets[strings.ToUpper(assetSymbolOrAddress)]; ok {
		return &asset, nil
	}

	// Default to the network's default asset
	return &config.DefaultAsset, nil
}

// ValidateTonAddress checks if a string is a valid TON address
func ValidateTonAddress(address string) bool {
	// Check friendly format (base64url, 48 chars)
	if tonFriendlyAddressRegex.MatchString(address) {
		return true
	}

	// Check raw format (workchain:hash)
	if tonRawAddressRegex.MatchString(address) {
		return true
	}

	return false
}

// AddressesEqual compares two TON addresses (handles different formats)
func AddressesEqual(addr1, addr2 string) bool {
	// Simple string comparison for now
	// In a full implementation, this would normalize addresses to the same format
	return strings.EqualFold(addr1, addr2)
}

// FormatAddress formats a TON address to friendly format
func FormatAddress(address string, bounceable bool, testOnly bool) string {
	// For now, return as-is
	// In a full implementation, this would convert raw addresses to friendly format
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

// ValidateBoc validates that a string is a valid base64-encoded BOC
func ValidateBoc(bocBase64 string) error {
	if bocBase64 == "" {
		return fmt.Errorf("empty BOC")
	}

	// Try to decode base64
	_, err := base64.StdEncoding.DecodeString(bocBase64)
	if err != nil {
		return fmt.Errorf("invalid base64 encoding: %w", err)
	}

	return nil
}

// IsTestnet returns true if the network is a testnet
func IsTestnet(network string) bool {
	return network == TonTestnetCAIP2
}

// GetDefaultAsset returns the default asset for a network
func GetDefaultAsset(network string) (*AssetInfo, error) {
	config, err := GetNetworkConfig(network)
	if err != nil {
		return nil, err
	}
	return &config.DefaultAsset, nil
}
