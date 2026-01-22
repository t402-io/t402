package ton

import "time"

const (
	// SchemeExact is the scheme identifier for exact payments
	SchemeExact = "exact"

	// DefaultDecimals is the default token decimals for USDT on TON
	DefaultDecimals = 6

	// CAIP-2 network identifiers
	TonMainnetCAIP2 = "ton:mainnet"
	TonTestnetCAIP2 = "ton:testnet"

	// Jetton transfer operation codes (TEP-74)
	JettonTransferOp             = 0x0f8a7ea5
	JettonInternalTransferOp     = 0x178d4519
	JettonTransferNotificationOp = 0x7362d09c
	JettonBurnOp                 = 0x595f07bc

	// Gas defaults (in nanoTON)
	DefaultJettonTransferTon = 100_000_000 // 0.1 TON
	DefaultForwardTon        = 1           // Minimal forward
	MinJettonTransferTon     = 50_000_000  // 0.05 TON minimum
	MaxJettonTransferTon     = 500_000_000 // 0.5 TON maximum

	// Validity and timing
	DefaultValidityDuration = 3600 // 1 hour in seconds
	MinValidityBuffer       = 30   // 30 seconds minimum validity

	// Transaction confirmation
	MaxConfirmAttempts = 60
	ConfirmRetryDelay  = 1 * time.Second

	// Address lengths
	TonFriendlyAddressLength = 48 // Friendly format length
	TonRawAddressLength      = 66 // Raw format: 0:64hex

	// USDT Jetton master addresses
	USDTMainnetAddress = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs"
	USDTTestnetAddress = "kQBqSpvo4S87mX9tTc4FX3Sfqf4uSp3Tx-Fz4RBUfTRWBx"
)

var (
	// NetworkConfigs maps CAIP-2 identifiers to network configurations
	NetworkConfigs = map[string]NetworkConfig{
		TonMainnetCAIP2: {
			Name:     "TON Mainnet",
			CAIP2:    TonMainnetCAIP2,
			Endpoint: "https://toncenter.com/api/v2/jsonRPC",
			DefaultAsset: AssetInfo{
				MasterAddress: USDTMainnetAddress,
				Symbol:        "USDT",
				Name:          "Tether USD",
				Decimals:      DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDT": {
					MasterAddress: USDTMainnetAddress,
					Symbol:        "USDT",
					Name:          "Tether USD",
					Decimals:      DefaultDecimals,
				},
			},
		},
		TonTestnetCAIP2: {
			Name:     "TON Testnet",
			CAIP2:    TonTestnetCAIP2,
			Endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
			DefaultAsset: AssetInfo{
				MasterAddress: USDTTestnetAddress,
				Symbol:        "USDT",
				Name:          "Tether USD (Testnet)",
				Decimals:      DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDT": {
					MasterAddress: USDTTestnetAddress,
					Symbol:        "USDT",
					Name:          "Tether USD (Testnet)",
					Decimals:      DefaultDecimals,
				},
			},
		},
	}
)
