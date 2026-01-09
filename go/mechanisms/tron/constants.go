package tron

import "time"

const (
	// SchemeExact is the scheme identifier for exact payments
	SchemeExact = "exact"

	// DefaultDecimals is the default token decimals for USDT on TRON
	DefaultDecimals = 6

	// CAIP-2 network identifiers
	TronMainnetCAIP2 = "tron:mainnet"
	TronNileCAIP2    = "tron:nile"
	TronShastaCAIP2  = "tron:shasta"

	// TRC20 function selectors
	TRC20TransferSelector  = "a9059cbb"
	TRC20ApproveSelector   = "095ea7b3"
	TRC20BalanceOfSelector = "70a08231"

	// Gas and fee constants (in SUN, 1 TRX = 1,000,000 SUN)
	DefaultFeeLimit = 100_000_000 // 100 TRX
	MinFeeLimit     = 10_000_000  // 10 TRX
	MaxFeeLimit     = 1_000_000_000 // 1000 TRX
	SunPerTrx       = 1_000_000

	// Validity and timing
	DefaultValidityDuration = 3600 // 1 hour in seconds
	MinValidityBuffer       = 30   // 30 seconds minimum validity

	// Transaction confirmation
	MaxConfirmAttempts = 60
	ConfirmRetryDelay  = 1 * time.Second

	// Address format
	TronAddressPrefix = "T"
	TronAddressLength = 34

	// USDT TRC20 contract addresses
	USDTMainnetAddress = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
	USDTNileAddress    = "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf"
	USDTShastaAddress  = "TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs"
)

var (
	// NetworkConfigs maps CAIP-2 identifiers to network configurations
	NetworkConfigs = map[string]NetworkConfig{
		TronMainnetCAIP2: {
			Name:     "TRON Mainnet",
			CAIP2:    TronMainnetCAIP2,
			Endpoint: "https://api.trongrid.io",
			DefaultAsset: AssetInfo{
				ContractAddress: USDTMainnetAddress,
				Symbol:          "USDT",
				Name:            "Tether USD",
				Decimals:        DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDT": {
					ContractAddress: USDTMainnetAddress,
					Symbol:          "USDT",
					Name:            "Tether USD",
					Decimals:        DefaultDecimals,
				},
			},
		},
		TronNileCAIP2: {
			Name:     "TRON Nile Testnet",
			CAIP2:    TronNileCAIP2,
			Endpoint: "https://api.nileex.io",
			DefaultAsset: AssetInfo{
				ContractAddress: USDTNileAddress,
				Symbol:          "USDT",
				Name:            "Tether USD (Nile)",
				Decimals:        DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDT": {
					ContractAddress: USDTNileAddress,
					Symbol:          "USDT",
					Name:            "Tether USD (Nile)",
					Decimals:        DefaultDecimals,
				},
			},
		},
		TronShastaCAIP2: {
			Name:     "TRON Shasta Testnet",
			CAIP2:    TronShastaCAIP2,
			Endpoint: "https://api.shasta.trongrid.io",
			DefaultAsset: AssetInfo{
				ContractAddress: USDTShastaAddress,
				Symbol:          "USDT",
				Name:            "Tether USD (Shasta)",
				Decimals:        DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDT": {
					ContractAddress: USDTShastaAddress,
					Symbol:          "USDT",
					Name:            "Tether USD (Shasta)",
					Decimals:        DefaultDecimals,
				},
			},
		},
	}
)
