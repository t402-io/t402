package svm

import (
	"testing"
)

func TestConstants(t *testing.T) {
	t.Run("scheme constants", func(t *testing.T) {
		if SchemeExact != "exact" {
			t.Errorf("SchemeExact = %s, want exact", SchemeExact)
		}
	})

	t.Run("default decimals", func(t *testing.T) {
		if DefaultDecimals != 6 {
			t.Errorf("DefaultDecimals = %d, want 6", DefaultDecimals)
		}
	})

	t.Run("compute unit limits", func(t *testing.T) {
		if DefaultComputeUnitPriceMicrolamports != 1 {
			t.Errorf("DefaultComputeUnitPriceMicrolamports = %d, want 1", DefaultComputeUnitPriceMicrolamports)
		}
		if MaxComputeUnitPriceMicrolamports != 5_000_000 {
			t.Errorf("MaxComputeUnitPriceMicrolamports = %d, want 5000000", MaxComputeUnitPriceMicrolamports)
		}
		if DefaultComputeUnitLimit != 6500 {
			t.Errorf("DefaultComputeUnitLimit = %d, want 6500", DefaultComputeUnitLimit)
		}
	})
}

func TestCAIP2Identifiers(t *testing.T) {
	tests := []struct {
		name     string
		constant string
		expected string
	}{
		{
			name:     "mainnet CAIP-2",
			constant: SolanaMainnetCAIP2,
			expected: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
		},
		{
			name:     "devnet CAIP-2",
			constant: SolanaDevnetCAIP2,
			expected: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
		},
		{
			name:     "testnet CAIP-2",
			constant: SolanaTestnetCAIP2,
			expected: "solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.constant != tt.expected {
				t.Errorf("%s = %s, want %s", tt.name, tt.constant, tt.expected)
			}
		})
	}
}

func TestV1NetworkNames(t *testing.T) {
	tests := []struct {
		name     string
		constant string
		expected string
	}{
		{
			name:     "mainnet V1",
			constant: SolanaMainnetV1,
			expected: "solana",
		},
		{
			name:     "devnet V1",
			constant: SolanaDevnetV1,
			expected: "solana-devnet",
		},
		{
			name:     "testnet V1",
			constant: SolanaTestnetV1,
			expected: "solana-testnet",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.constant != tt.expected {
				t.Errorf("%s = %s, want %s", tt.name, tt.constant, tt.expected)
			}
		})
	}
}

func TestUSDCAddresses(t *testing.T) {
	tests := []struct {
		name     string
		constant string
		expected string
	}{
		{
			name:     "mainnet USDC",
			constant: USDCMainnetAddress,
			expected: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
		},
		{
			name:     "devnet USDC",
			constant: USDCDevnetAddress,
			expected: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
		},
		{
			name:     "testnet USDC (same as devnet)",
			constant: USDCTestnetAddress,
			expected: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.constant != tt.expected {
				t.Errorf("%s = %s, want %s", tt.name, tt.constant, tt.expected)
			}
		})
	}
}

func TestNetworkConfigs(t *testing.T) {
	// Verify all expected networks are configured
	expectedNetworks := []string{
		SolanaMainnetCAIP2,
		SolanaDevnetCAIP2,
		SolanaTestnetCAIP2,
	}

	for _, network := range expectedNetworks {
		t.Run(network, func(t *testing.T) {
			config, ok := NetworkConfigs[network]
			if !ok {
				t.Fatalf("NetworkConfigs missing network: %s", network)
			}

			// Verify required fields
			if config.Name == "" {
				t.Errorf("NetworkConfigs[%s].Name is empty", network)
			}
			if config.CAIP2 != network {
				t.Errorf("NetworkConfigs[%s].CAIP2 = %s, want %s", network, config.CAIP2, network)
			}
			if config.RPCURL == "" {
				t.Errorf("NetworkConfigs[%s].RPCURL is empty", network)
			}
			if config.DefaultAsset.Address == "" {
				t.Errorf("NetworkConfigs[%s].DefaultAsset.Address is empty", network)
			}
			if config.DefaultAsset.Symbol == "" {
				t.Errorf("NetworkConfigs[%s].DefaultAsset.Symbol is empty", network)
			}
			if config.DefaultAsset.Decimals != 6 {
				t.Errorf("NetworkConfigs[%s].DefaultAsset.Decimals = %d, want 6", network, config.DefaultAsset.Decimals)
			}
		})
	}
}

func TestV1ToV2NetworkMap(t *testing.T) {
	tests := []struct {
		v1Network string
		v2Network string
	}{
		{SolanaMainnetV1, SolanaMainnetCAIP2},
		{SolanaDevnetV1, SolanaDevnetCAIP2},
		{SolanaTestnetV1, SolanaTestnetCAIP2},
	}

	for _, tt := range tests {
		t.Run(tt.v1Network, func(t *testing.T) {
			mapped, ok := V1ToV2NetworkMap[tt.v1Network]
			if !ok {
				t.Fatalf("V1ToV2NetworkMap missing key: %s", tt.v1Network)
			}
			if mapped != tt.v2Network {
				t.Errorf("V1ToV2NetworkMap[%s] = %s, want %s", tt.v1Network, mapped, tt.v2Network)
			}
		})
	}
}

func TestNetworkConfigsSupportedAssets(t *testing.T) {
	// Verify that each network has USDC as a supported asset
	for network, config := range NetworkConfigs {
		t.Run(network, func(t *testing.T) {
			usdc, ok := config.SupportedAssets["USDC"]
			if !ok {
				t.Fatalf("NetworkConfigs[%s] missing USDC in SupportedAssets", network)
			}
			if usdc.Symbol != "USDC" {
				t.Errorf("USDC symbol = %s, want USDC", usdc.Symbol)
			}
			if usdc.Decimals != 6 {
				t.Errorf("USDC decimals = %d, want 6", usdc.Decimals)
			}
			if usdc.Address == "" {
				t.Errorf("USDC address is empty")
			}
		})
	}
}
