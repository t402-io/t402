package erc4337

import (
	"math/big"

	"github.com/ethereum/go-ethereum/common"
)

// DefaultGasLimits contains default gas limits for UserOperations.
var DefaultGasLimits = GasEstimate{
	VerificationGasLimit:          big.NewInt(150000),
	CallGasLimit:                  big.NewInt(100000),
	PreVerificationGas:            big.NewInt(50000),
	PaymasterVerificationGasLimit: big.NewInt(50000),
	PaymasterPostOpGasLimit:       big.NewInt(50000),
}

// BundlerMethods contains the standard bundler JSON-RPC method names.
var BundlerMethods = struct {
	SendUserOperation         string
	EstimateUserOperationGas  string
	GetUserOperationByHash    string
	GetUserOperationReceipt   string
	SupportedEntryPoints      string
	ChainID                   string
}{
	SendUserOperation:         "eth_sendUserOperation",
	EstimateUserOperationGas:  "eth_estimateUserOperationGas",
	GetUserOperationByHash:    "eth_getUserOperationByHash",
	GetUserOperationReceipt:   "eth_getUserOperationReceipt",
	SupportedEntryPoints:      "eth_supportedEntryPoints",
	ChainID:                   "eth_chainId",
}

// PaymasterType represents the type of paymaster.
type PaymasterType string

const (
	// PaymasterTypeNone indicates no paymaster (user pays gas)
	PaymasterTypeNone PaymasterType = "none"
	// PaymasterTypeVerifying indicates a verifying paymaster with off-chain signature
	PaymasterTypeVerifying PaymasterType = "verifying"
	// PaymasterTypeToken indicates a token paymaster (pay gas with ERC20)
	PaymasterTypeToken PaymasterType = "token"
	// PaymasterTypeSponsoring indicates a sponsoring paymaster (third party pays)
	PaymasterTypeSponsoring PaymasterType = "sponsoring"
)

// Safe4337Addresses contains Safe 4337 module addresses (v0.3.0).
var Safe4337Addresses = struct {
	Module         common.Address
	ModuleSetup    common.Address
	Singleton      common.Address
	ProxyFactory   common.Address
	FallbackHandler common.Address
	AddModulesLib  common.Address
}{
	Module:         common.HexToAddress("0xa581c4A4DB7175302464fF3C06380BC3270b4037"),
	ModuleSetup:    common.HexToAddress("0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47"),
	Singleton:      common.HexToAddress("0x29fcB43b46531BcA003ddC8FCB67FFE91900C762"),
	ProxyFactory:   common.HexToAddress("0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67"),
	FallbackHandler: common.HexToAddress("0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99"),
	AddModulesLib:  common.HexToAddress("0x8EcD4ec46D4D2a6B64fE960B3D64e8B94B2234eb"),
}

// PackAccountGasLimits packs verification and call gas limits into bytes32.
func PackAccountGasLimits(verificationGasLimit, callGasLimit *big.Int) [32]byte {
	var result [32]byte

	// First 16 bytes: verification gas limit
	verificationBytes := verificationGasLimit.Bytes()
	copy(result[16-len(verificationBytes):16], verificationBytes)

	// Last 16 bytes: call gas limit
	callBytes := callGasLimit.Bytes()
	copy(result[32-len(callBytes):32], callBytes)

	return result
}

// UnpackAccountGasLimits unpacks account gas limits from bytes32.
func UnpackAccountGasLimits(packed [32]byte) (verificationGasLimit, callGasLimit *big.Int) {
	verificationGasLimit = new(big.Int).SetBytes(packed[:16])
	callGasLimit = new(big.Int).SetBytes(packed[16:])
	return
}

// PackGasFees packs max priority fee and max fee per gas into bytes32.
func PackGasFees(maxPriorityFeePerGas, maxFeePerGas *big.Int) [32]byte {
	var result [32]byte

	// First 16 bytes: max priority fee per gas
	priorityBytes := maxPriorityFeePerGas.Bytes()
	copy(result[16-len(priorityBytes):16], priorityBytes)

	// Last 16 bytes: max fee per gas
	maxBytes := maxFeePerGas.Bytes()
	copy(result[32-len(maxBytes):32], maxBytes)

	return result
}

// UnpackGasFees unpacks gas fees from bytes32.
func UnpackGasFees(packed [32]byte) (maxPriorityFeePerGas, maxFeePerGas *big.Int) {
	maxPriorityFeePerGas = new(big.Int).SetBytes(packed[:16])
	maxFeePerGas = new(big.Int).SetBytes(packed[16:])
	return
}

// AlchemyNetworks maps chain IDs to Alchemy network names.
var AlchemyNetworks = map[int64]string{
	1:        "eth-mainnet",
	11155111: "eth-sepolia",
	137:      "polygon-mainnet",
	80001:    "polygon-mumbai",
	10:       "opt-mainnet",
	420:      "opt-goerli",
	42161:    "arb-mainnet",
	421613:   "arb-goerli",
	8453:     "base-mainnet",
	84532:    "base-sepolia",
}

// GetAlchemyNetwork returns the Alchemy network name for a chain ID.
func GetAlchemyNetwork(chainID int64) (string, bool) {
	network, ok := AlchemyNetworks[chainID]
	return network, ok
}

// SupportedChains lists the supported EVM chain IDs for ERC-4337.
var SupportedChains = []int64{
	1,        // Ethereum Mainnet
	11155111, // Ethereum Sepolia
	8453,     // Base
	84532,    // Base Sepolia
	10,       // Optimism
	42161,    // Arbitrum One
	137,      // Polygon
}

// IsSupportedChain checks if a chain ID is supported.
func IsSupportedChain(chainID int64) bool {
	for _, id := range SupportedChains {
		if id == chainID {
			return true
		}
	}
	return false
}
