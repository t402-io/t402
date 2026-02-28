package evm

import (
	"math/big"
)

const (
	// Scheme identifiers
	SchemeExact       = "exact"
	SchemeExactLegacy = "exact-legacy"

	// Default token decimals for USDC
	DefaultDecimals = 6

	// EIP-3009 function names
	FunctionTransferWithAuthorization = "transferWithAuthorization"
	FunctionReceiveWithAuthorization  = "receiveWithAuthorization"
	FunctionAuthorizationState        = "authorizationState"

	// Transaction status
	TxStatusSuccess = 1
	TxStatusFailed  = 0

	// Default validity period (1 hour)
	DefaultValidityPeriod = 3600 // seconds

	// ERC-6492 magic value (last 32 bytes of wrapped signature)
	// This is bytes32(uint256(keccak256("erc6492.invalid.signature")) - 1)
	ERC6492MagicValue = "0x6492649264926492649264926492649264926492649264926492649264926492"

	// EIP-1271 magic value (returned by isValidSignature on success)
	EIP1271MagicValue = "0x1626ba7e"

	// Error codes matching TypeScript implementation
	ErrInvalidSignature            = "invalid_exact_evm_payload_signature"
	ErrUndeployedSmartWallet       = "invalid_exact_evm_payload_undeployed_smart_wallet"
	ErrSmartWalletDeploymentFailed = "smart_wallet_deployment_failed"
)

var (
	// Network chain IDs
	ChainIDMainnet     = big.NewInt(1)
	ChainIDBase        = big.NewInt(8453)
	ChainIDBaseSepolia = big.NewInt(84532)
	ChainIDArbitrum    = big.NewInt(42161)
	ChainIDOptimism    = big.NewInt(10)
	ChainIDPolygon     = big.NewInt(137)
	ChainIDInk         = big.NewInt(57073)
	ChainIDBerachain   = big.NewInt(80094)
	ChainIDUnichain    = big.NewInt(130)
	ChainIDMantle      = big.NewInt(5000)
	ChainIDPlasma      = big.NewInt(9745)
	ChainIDSei         = big.NewInt(1329)
	ChainIDConflux     = big.NewInt(1030)
	ChainIDMonad       = big.NewInt(143)
	ChainIDFlare       = big.NewInt(14)
	ChainIDRootstock   = big.NewInt(30)
	ChainIDXLayer      = big.NewInt(196)
	ChainIDStable      = big.NewInt(988)
	ChainIDHyperEVM    = big.NewInt(999)
	ChainIDMegaETH     = big.NewInt(4326)
	ChainIDCorn        = big.NewInt(21000000)
	// Testnet networks
	ChainIDSepolia         = big.NewInt(11155111)
	ChainIDArbitrumSepolia = big.NewInt(421614)
	// Legacy USDT networks (no EIP-3009 support)
	ChainIDBNB = big.NewInt(56)
	ChainIDAvalanche = big.NewInt(43114)
	ChainIDFantom    = big.NewInt(250)
	ChainIDCelo      = big.NewInt(42220)
	ChainIDKaia      = big.NewInt(8217)

	// Network configurations
	NetworkConfigs = map[string]NetworkConfig{
		"eip155:1": {
			ChainID: ChainIDMainnet,
			DefaultAsset: AssetInfo{
				Address:  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC on Ethereum mainnet
				Name:     "USD Coin",
				Version:  "2",
				Decimals: DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDC": {
					Address:  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
					Name:     "USD Coin",
					Version:  "2",
					Decimals: DefaultDecimals,
				},
				"USAT": {
					Address:  "0x07041776f5007aca2a54844f50503a18a72a8b68",
					Name:     "Tether America USD",
					Version:  "1",
					Decimals: DefaultDecimals,
				},
			},
		},
		"eip155:8453": {
			ChainID: ChainIDBase,
			DefaultAsset: AssetInfo{
				Address:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
				Name:     "USD Coin",
				Version:  "2",
				Decimals: DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDC": {
					Address:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
					Name:     "USD Coin",
					Version:  "2",
					Decimals: DefaultDecimals,
				},
			},
		},
		"base": {
			ChainID: ChainIDBase,
			DefaultAsset: AssetInfo{
				Address:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				Name:     "USD Coin",
				Version:  "2",
				Decimals: DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDC": {
					Address:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
					Name:     "USD Coin",
					Version:  "2",
					Decimals: DefaultDecimals,
				},
			},
		},
		"base-mainnet": {
			ChainID: ChainIDBase,
			DefaultAsset: AssetInfo{
				Address:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				Name:     "USD Coin",
				Version:  "2",
				Decimals: DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDC": {
					Address:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
					Name:     "USD Coin",
					Version:  "2",
					Decimals: DefaultDecimals,
				},
			},
		},
		"eip155:84532": {
			ChainID: ChainIDBaseSepolia,
			DefaultAsset: AssetInfo{
				Address:  "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
				Name:     "USDC",
				Version:  "2",
				Decimals: DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDC": {
					Address:  "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
					Name:     "USDC",
					Version:  "2",
					Decimals: DefaultDecimals,
				},
			},
		},
		"base-sepolia": {
			ChainID: ChainIDBaseSepolia,
			DefaultAsset: AssetInfo{
				Address:  "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
				Name:     "USDC",
				Version:  "2",
				Decimals: DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDC": {
					Address:  "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
					Name:     "USDC",
					Version:  "2",
					Decimals: DefaultDecimals,
				},
			},
		},
		// Ethereum Sepolia
		"eip155:11155111": {
			ChainID: ChainIDSepolia,
			DefaultAsset: AssetInfo{
				Address:  "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // USDC on Ethereum Sepolia
				Name:     "USDC",
				Version:  "2",
				Decimals: DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDC": {
					Address:  "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
					Name:     "USDC",
					Version:  "2",
					Decimals: DefaultDecimals,
				},
			},
		},
		// Arbitrum Sepolia
		"eip155:421614": {
			ChainID: ChainIDArbitrumSepolia,
			DefaultAsset: AssetInfo{
				Address:  "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", // USDC on Arbitrum Sepolia
				Name:     "USDC",
				Version:  "2",
				Decimals: DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDC": {
					Address:  "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
					Name:     "USDC",
					Version:  "2",
					Decimals: DefaultDecimals,
				},
			},
		},
		// === USDT0 Networks ===
		// Arbitrum One
		"eip155:42161": {
			ChainID: ChainIDArbitrum,
			DefaultAsset: AssetInfo{
				Address:  "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
				Name:     "TetherToken",
				Version:  "1",
				Decimals: DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDT0": {
					Address:  "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
					Name:     "TetherToken",
					Version:  "1",
					Decimals: DefaultDecimals,
				},
			},
		},
		// Optimism
		"eip155:10": {
			ChainID: ChainIDOptimism,
			DefaultAsset: AssetInfo{
				Address:  "0x01bFF41798a0BcF287b996046Ca68b395DbC1071",
				Name:     "TetherToken",
				Version:  "1",
				Decimals: DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDT0": {
					Address:  "0x01bFF41798a0BcF287b996046Ca68b395DbC1071",
					Name:     "TetherToken",
					Version:  "1",
					Decimals: DefaultDecimals,
				},
			},
		},
		// Polygon
		"eip155:137": {
			ChainID: ChainIDPolygon,
			DefaultAsset: AssetInfo{
				Address:  "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
				Name:     "TetherToken",
				Version:  "1",
				Decimals: DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDT0": {
					Address:  "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
					Name:     "TetherToken",
					Version:  "1",
					Decimals: DefaultDecimals,
				},
			},
		},
		// Ink
		"eip155:57073": {
			ChainID: ChainIDInk,
			DefaultAsset: AssetInfo{
				Address:  "0x0200C29006150606B650577BBE7B6248F58470c1",
				Name:     "TetherToken",
				Version:  "1",
				Decimals: DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDT0": {
					Address:  "0x0200C29006150606B650577BBE7B6248F58470c1",
					Name:     "TetherToken",
					Version:  "1",
					Decimals: DefaultDecimals,
				},
			},
		},
		// Berachain
		"eip155:80094": {
			ChainID: ChainIDBerachain,
			DefaultAsset: AssetInfo{
				Address:  "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
				Name:     "TetherToken",
				Version:  "1",
				Decimals: DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDT0": {
					Address:  "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
					Name:     "TetherToken",
					Version:  "1",
					Decimals: DefaultDecimals,
				},
			},
		},
		// Unichain
		"eip155:130": {
			ChainID: ChainIDUnichain,
			DefaultAsset: AssetInfo{
				Address:  "0x9151434b16b9763660705744891fA906F660EcC5",
				Name:     "TetherToken",
				Version:  "1",
				Decimals: DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDT0": {
					Address:  "0x9151434b16b9763660705744891fA906F660EcC5",
					Name:     "TetherToken",
					Version:  "1",
					Decimals: DefaultDecimals,
				},
			},
		},
		// Mantle
		"eip155:5000": {
			ChainID: ChainIDMantle,
			DefaultAsset: AssetInfo{
				Address:  "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
				Name:     "TetherToken",
				Version:  "1",
				Decimals: DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDT0": {
					Address:  "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
					Name:     "TetherToken",
					Version:  "1",
					Decimals: DefaultDecimals,
				},
			},
		},
		// Plasma
		"eip155:9745": {
			ChainID: ChainIDPlasma,
			DefaultAsset: AssetInfo{
				Address:  "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
				Name:     "TetherToken",
				Version:  "1",
				Decimals: DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDT0": {
					Address:  "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
					Name:     "TetherToken",
					Version:  "1",
					Decimals: DefaultDecimals,
				},
			},
		},
		// Sei
		"eip155:1329": {
			ChainID: ChainIDSei,
			DefaultAsset: AssetInfo{
				Address:  "0x9151434b16b9763660705744891fA906F660EcC5",
				Name:     "TetherToken",
				Version:  "1",
				Decimals: DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDT0": {
					Address:  "0x9151434b16b9763660705744891fA906F660EcC5",
					Name:     "TetherToken",
					Version:  "1",
					Decimals: DefaultDecimals,
				},
			},
		},
		// Conflux eSpace
		"eip155:1030": {
			ChainID: ChainIDConflux,
			DefaultAsset: AssetInfo{
				Address:  "0xaf37E8B6C9ED7f6318979f56Fc287d76c30847ff",
				Name:     "TetherToken",
				Version:  "1",
				Decimals: DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDT0": {
					Address:  "0xaf37E8B6C9ED7f6318979f56Fc287d76c30847ff",
					Name:     "TetherToken",
					Version:  "1",
					Decimals: DefaultDecimals,
				},
			},
		},
		// Monad
		"eip155:143": {
			ChainID: ChainIDMonad,
			DefaultAsset: AssetInfo{
				Address:  "0xe7cd86e13AC4309349F30B3435a9d337750fC82D",
				Name:     "TetherToken",
				Version:  "1",
				Decimals: DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDT0": {
					Address:  "0xe7cd86e13AC4309349F30B3435a9d337750fC82D",
					Name:     "TetherToken",
					Version:  "1",
					Decimals: DefaultDecimals,
				},
			},
		},
		// Flare
		"eip155:14": {
			ChainID: ChainIDFlare,
			DefaultAsset: AssetInfo{
				Address:  "0xe7cd86e13AC4309349F30B3435a9d337750fC82D",
				Name:     "TetherToken",
				Version:  "1",
				Decimals: DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDT0": {
					Address:  "0xe7cd86e13AC4309349F30B3435a9d337750fC82D",
					Name:     "TetherToken",
					Version:  "1",
					Decimals: DefaultDecimals,
				},
			},
		},
		// Rootstock
		"eip155:30": {
			ChainID: ChainIDRootstock,
			DefaultAsset: AssetInfo{
				Address:  "0x779dED0C9e1022225F8e0630b35A9B54Be713736",
				Name:     "TetherToken",
				Version:  "1",
				Decimals: DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDT0": {
					Address:  "0x779dED0C9e1022225F8e0630b35A9B54Be713736",
					Name:     "TetherToken",
					Version:  "1",
					Decimals: DefaultDecimals,
				},
			},
		},
		// XLayer
		"eip155:196": {
			ChainID: ChainIDXLayer,
			DefaultAsset: AssetInfo{
				Address:  "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
				Name:     "TetherToken",
				Version:  "1",
				Decimals: DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDT0": {
					Address:  "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
					Name:     "TetherToken",
					Version:  "1",
					Decimals: DefaultDecimals,
				},
			},
		},
		// Stable
		"eip155:988": {
			ChainID: ChainIDStable,
			DefaultAsset: AssetInfo{
				Address:  "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
				Name:     "TetherToken",
				Version:  "1",
				Decimals: DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDT0": {
					Address:  "0x779Ded0c9e1022225f8E0630b35a9b54bE713736",
					Name:     "TetherToken",
					Version:  "1",
					Decimals: DefaultDecimals,
				},
			},
		},
		// HyperEVM
		"eip155:999": {
			ChainID: ChainIDHyperEVM,
			DefaultAsset: AssetInfo{
				Address:  "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
				Name:     "TetherToken",
				Version:  "1",
				Decimals: DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDT0": {
					Address:  "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
					Name:     "TetherToken",
					Version:  "1",
					Decimals: DefaultDecimals,
				},
			},
		},
		// MegaETH
		"eip155:4326": {
			ChainID: ChainIDMegaETH,
			DefaultAsset: AssetInfo{
				Address:  "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb",
				Name:     "TetherToken",
				Version:  "1",
				Decimals: DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDT0": {
					Address:  "0xb8ce59fc3717ada4c02eadf9682a9e934f625ebb",
					Name:     "TetherToken",
					Version:  "1",
					Decimals: DefaultDecimals,
				},
			},
		},
		// Corn
		"eip155:21000000": {
			ChainID: ChainIDCorn,
			DefaultAsset: AssetInfo{
				Address:  "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
				Name:     "TetherToken",
				Version:  "1",
				Decimals: DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDT0": {
					Address:  "0xB8CE59FC3717ada4C02eaDF9682A9e934F625ebb",
					Name:     "TetherToken",
					Version:  "1",
					Decimals: DefaultDecimals,
				},
			},
		},

		// === Legacy USDT Networks (no EIP-3009 support) ===
		// These require the approve + transferFrom pattern (exact-legacy scheme)

		// BNB Chain (BSC)
		"eip155:56": {
			ChainID: ChainIDBNB,
			DefaultAsset: AssetInfo{
				Address:  "0x55d398326f99059fF775485246999027B3197955",
				Name:     "Tether USD",
				Version:  "1",
				Decimals: 18, // BSC USDT uses 18 decimals
			},
			SupportedAssets: map[string]AssetInfo{
				"USDT": {
					Address:  "0x55d398326f99059fF775485246999027B3197955",
					Name:     "Tether USD",
					Version:  "1",
					Decimals: 18,
				},
			},
		},
		// Avalanche C-Chain
		"eip155:43114": {
			ChainID: ChainIDAvalanche,
			DefaultAsset: AssetInfo{
				Address:  "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
				Name:     "TetherToken",
				Version:  "1",
				Decimals: DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDT": {
					Address:  "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7",
					Name:     "TetherToken",
					Version:  "1",
					Decimals: DefaultDecimals,
				},
			},
		},
		// Fantom
		"eip155:250": {
			ChainID: ChainIDFantom,
			DefaultAsset: AssetInfo{
				Address:  "0x049d68029688eabf473097a2fc38ef61633a3c7a",
				Name:     "Frapped USDT",
				Version:  "1",
				Decimals: DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDT": {
					Address:  "0x049d68029688eabf473097a2fc38ef61633a3c7a",
					Name:     "Frapped USDT",
					Version:  "1",
					Decimals: DefaultDecimals,
				},
			},
		},
		// Celo
		"eip155:42220": {
			ChainID: ChainIDCelo,
			DefaultAsset: AssetInfo{
				Address:  "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
				Name:     "Tether USD",
				Version:  "1",
				Decimals: 18,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDT": {
					Address:  "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
					Name:     "Tether USD",
					Version:  "1",
					Decimals: 18,
				},
			},
		},
		// Kaia (formerly Klaytn)
		"eip155:8217": {
			ChainID: ChainIDKaia,
			DefaultAsset: AssetInfo{
				Address:  "0xd077a400968890eacc75cdc901f0356c943e4fdb", // Official Tether USD on Kaia
				Name:     "Tether USD",
				Version:  "1",
				Decimals: DefaultDecimals,
			},
			SupportedAssets: map[string]AssetInfo{
				"USDT": {
					Address:  "0xd077a400968890eacc75cdc901f0356c943e4fdb",
					Name:     "Tether USD",
					Version:  "1",
					Decimals: DefaultDecimals,
				},
			},
		},
	}

	// EIP-3009 ABI for transferWithAuthorization with v,r,s (EOA signatures)
	TransferWithAuthorizationVRSABI = []byte(`[
		{
			"inputs": [
				{"name": "from", "type": "address"},
				{"name": "to", "type": "address"},
				{"name": "value", "type": "uint256"},
				{"name": "validAfter", "type": "uint256"},
				{"name": "validBefore", "type": "uint256"},
				{"name": "nonce", "type": "bytes32"},
				{"name": "v", "type": "uint8"},
				{"name": "r", "type": "bytes32"},
				{"name": "s", "type": "bytes32"}
			],
			"name": "transferWithAuthorization",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		}
	]`)

	// EIP-3009 ABI for transferWithAuthorization with bytes signature (smart wallets)
	TransferWithAuthorizationBytesABI = []byte(`[
		{
			"inputs": [
				{"name": "from", "type": "address"},
				{"name": "to", "type": "address"},
				{"name": "value", "type": "uint256"},
				{"name": "validAfter", "type": "uint256"},
				{"name": "validBefore", "type": "uint256"},
				{"name": "nonce", "type": "bytes32"},
				{"name": "signature", "type": "bytes"}
			],
			"name": "transferWithAuthorization",
			"outputs": [],
			"stateMutability": "nonpayable",
			"type": "function"
		}
	]`)

	// Legacy: Combined ABI (deprecated, use specific ABIs above)
	TransferWithAuthorizationABI = TransferWithAuthorizationVRSABI

	// ABI for authorizationState check
	AuthorizationStateABI = []byte(`[
		{
			"inputs": [
				{"name": "authorizer", "type": "address"},
				{"name": "nonce", "type": "bytes32"}
			],
			"name": "authorizationState",
			"outputs": [{"name": "", "type": "bool"}],
			"stateMutability": "view",
			"type": "function"
		}
	]`)

	// ERC20 Legacy ABI for approve + transferFrom pattern
	ERC20LegacyABI = []byte(`[
		{
			"inputs": [{"name": "account", "type": "address"}],
			"name": "balanceOf",
			"outputs": [{"name": "", "type": "uint256"}],
			"stateMutability": "view",
			"type": "function"
		},
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
		},
		{
			"inputs": [
				{"name": "from", "type": "address"},
				{"name": "to", "type": "address"},
				{"name": "amount", "type": "uint256"}
			],
			"name": "transferFrom",
			"outputs": [{"name": "", "type": "bool"}],
			"stateMutability": "nonpayable",
			"type": "function"
		}
	]`)

	// Function names for legacy ERC20 operations
	FunctionBalanceOf    = "balanceOf"
	FunctionAllowance    = "allowance"
	FunctionApprove      = "approve"
	FunctionTransferFrom = "transferFrom"
)
