package stellar

import "time"

const (
	// SchemeExact is the scheme identifier for exact payments
	SchemeExact = "exact"

	// DefaultDecimals is the default token decimals for USDC on Stellar (7 decimals)
	DefaultDecimals = 7

	// CAIP-2 network identifiers
	StellarPubnetCAIP2  = "stellar:pubnet"
	StellarTestnetCAIP2 = "stellar:testnet"

	// Network passphrases (used for transaction signing)
	PubnetPassphrase  = "Public Global Stellar Network ; September 2015"
	TestnetPassphrase = "Test SDF Network ; September 2015"

	// USDC contract addresses (Soroban C-accounts)
	USDCPubnetAddress  = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI"
	USDCTestnetAddress = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"

	// Timing constants
	DefaultTimeoutSeconds = 60
	LedgerTimeSeconds     = 5 // Stellar ledger close time

	// Transaction confirmation
	MaxConfirmAttempts = 60
	ConfirmRetryDelay  = 1 * time.Second

	// Address lengths
	StellarPublicKeyLength  = 56 // G-account (Ed25519 public key, base32)
	StellarContractLength   = 56 // C-account (contract address, base32)
)

var (
	// NetworkConfigs maps CAIP-2 identifiers to network configurations
	NetworkConfigs = map[string]NetworkConfig{
		StellarPubnetCAIP2: {
			Name:             "Stellar Pubnet",
			CAIP2:            StellarPubnetCAIP2,
			HorizonURL:       "https://horizon.stellar.org",
			SorobanRPCURL:    "https://soroban-rpc.mainnet.stellar.gateway.fm",
			NetworkPassphrase: PubnetPassphrase,
			DefaultAsset: AssetInfo{
				ContractAddress: USDCPubnetAddress,
				Symbol:          "USDC",
				Name:            "USD Coin",
				Decimals:        DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDC": {
					ContractAddress: USDCPubnetAddress,
					Symbol:          "USDC",
					Name:            "USD Coin",
					Decimals:        DefaultDecimals,
				},
			},
		},
		StellarTestnetCAIP2: {
			Name:             "Stellar Testnet",
			CAIP2:            StellarTestnetCAIP2,
			HorizonURL:       "https://horizon-testnet.stellar.org",
			SorobanRPCURL:    "https://soroban-testnet.stellar.org",
			NetworkPassphrase: TestnetPassphrase,
			DefaultAsset: AssetInfo{
				ContractAddress: USDCTestnetAddress,
				Symbol:          "USDC",
				Name:            "USD Coin (Testnet)",
				Decimals:        DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDC": {
					ContractAddress: USDCTestnetAddress,
					Symbol:          "USDC",
					Name:            "USD Coin (Testnet)",
					Decimals:        DefaultDecimals,
				},
			},
		},
	}
)
