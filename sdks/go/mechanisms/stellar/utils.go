package stellar

import (
	"encoding/base64"
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
)

var (
	// Stellar G-account regex (Ed25519 public key, strkey encoded, starts with G)
	// Standard length is 56 chars, base32 alphabet A-Z 2-7
	stellarPublicKeyRegex = regexp.MustCompile(`^G[A-Z2-7]{55}$`)

	// Stellar C-account regex (contract address, strkey encoded, starts with C)
	// Standard length is 56 chars, base32 alphabet A-Z 2-7
	// Some contract IDs may vary slightly in length (54-56 chars)
	stellarContractRegex = regexp.MustCompile(`^C[A-Z2-7]{53,55}$`)
)

// NormalizeNetwork validates and returns the network identifier
func NormalizeNetwork(network string) (string, error) {
	if _, ok := NetworkConfigs[network]; ok {
		return network, nil
	}
	return "", fmt.Errorf("unsupported Stellar network: %s", network)
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

	// Check if it's a valid Stellar contract address (C-account)
	if ValidateStellarContract(assetSymbolOrAddress) {
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
			Name:            "Unknown Token",
			Decimals:        DefaultDecimals,
		}, nil
	}

	// Look up by symbol
	if asset, ok := config.SupportedAssets[strings.ToUpper(assetSymbolOrAddress)]; ok {
		return &asset, nil
	}

	// Default to the network's default asset
	return &config.DefaultAsset, nil
}

// ValidateStellarAddress checks if a string is a valid Stellar G-account (public key)
func ValidateStellarAddress(address string) bool {
	return stellarPublicKeyRegex.MatchString(address)
}

// ValidateStellarContract checks if a string is a valid Stellar C-account (contract)
func ValidateStellarContract(address string) bool {
	return stellarContractRegex.MatchString(address)
}

// AddressesEqual compares two Stellar addresses (case-sensitive for base32)
func AddressesEqual(addr1, addr2 string) bool {
	return addr1 == addr2
}

// ParseAmount converts a decimal string amount to token smallest units
func ParseAmount(amount string, decimals int) (uint64, error) {
	amount = strings.TrimSpace(amount)

	parts := strings.Split(amount, ".")
	if len(parts) > 2 {
		return 0, fmt.Errorf("invalid amount format: %s", amount)
	}

	intPart, err := strconv.ParseUint(parts[0], 10, 64)
	if err != nil {
		return 0, fmt.Errorf("invalid integer part: %s", parts[0])
	}

	decPart := uint64(0)
	if len(parts) == 2 && parts[1] != "" {
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

	decStr := fmt.Sprintf("%0*d", decimals, remainder)
	decStr = strings.TrimRight(decStr, "0")

	if decStr == "" {
		return fmt.Sprintf("%d", quotient)
	}

	return fmt.Sprintf("%d.%s", quotient, decStr)
}

// ValidateXDR validates that a string is a valid base64-encoded XDR
func ValidateXDR(xdrBase64 string) error {
	if xdrBase64 == "" {
		return fmt.Errorf("empty XDR")
	}

	_, err := base64.StdEncoding.DecodeString(xdrBase64)
	if err != nil {
		return fmt.Errorf("invalid base64 encoding: %w", err)
	}

	return nil
}

// IsTestnet returns true if the network is a testnet
func IsTestnet(network string) bool {
	return network == StellarTestnetCAIP2
}

// GetDefaultAsset returns the default asset for a network
func GetDefaultAsset(network string) (*AssetInfo, error) {
	config, err := GetNetworkConfig(network)
	if err != nil {
		return nil, err
	}
	return &config.DefaultAsset, nil
}

// CalculateMaxLedger calculates the max ledger for transaction validity
// based on the current ledger and timeout in seconds
func CalculateMaxLedger(currentLedger int64, timeoutSeconds int) int64 {
	ledgerCount := int64(math.Ceil(float64(timeoutSeconds) / float64(LedgerTimeSeconds)))
	return currentLedger + ledgerCount
}

// GetNetworkPassphrase returns the network passphrase for a CAIP-2 network
func GetNetworkPassphrase(network string) (string, error) {
	config, err := GetNetworkConfig(network)
	if err != nil {
		return "", err
	}
	return config.NetworkPassphrase, nil
}
