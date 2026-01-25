package multisig

import "github.com/ethereum/go-ethereum/common"

// Safe 4337 module addresses (v0.3.0)
// Deployed on all major EVM chains at the same addresses
var (
	// Safe4337Module is the Safe 4337 Module address
	Safe4337Module = common.HexToAddress("0xa581c4A4DB7175302464fF3C06380BC3270b4037")
	// SafeModuleSetup is the Safe Module Setup address
	SafeModuleSetup = common.HexToAddress("0x2dd68b007B46fBe91B9A7c3EDa5A7a1063cB5b47")
	// SafeSingleton is the Safe Singleton address
	SafeSingleton = common.HexToAddress("0x29fcB43b46531BcA003ddC8FCB67FFE91900C762")
	// SafeProxyFactory is the Safe Proxy Factory address
	SafeProxyFactory = common.HexToAddress("0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67")
	// SafeFallbackHandler is the Safe Fallback Handler address
	SafeFallbackHandler = common.HexToAddress("0xfd0732Dc9E303f09fCEf3a7388Ad10A83459Ec99")
	// SafeAddModulesLib is the Add Modules Lib address
	SafeAddModulesLib = common.HexToAddress("0x8EcD4ec46D4D2a6B64fE960B3D64e8B94B2234eb")
	// SafeMultiSend is the MultiSend library address
	SafeMultiSend = common.HexToAddress("0x38869bf66a61cF6bDB996A6aE40D5853Fd43B526")
	// EntryPointV07 is the ERC-4337 EntryPoint v0.7 address
	EntryPointV07 = common.HexToAddress("0x0000000071727De22E5E9d8BAf0edAc6f37da032")
)

// Default configuration values
const (
	// DefaultRequestExpirationSeconds is the default request expiration (1 hour)
	DefaultRequestExpirationSeconds = 3600
	// DefaultSaltNonce for deterministic address generation
	DefaultSaltNonce = 0
	// MaxOwners is the maximum number of owners allowed
	MaxOwners = 10
	// MinThreshold is the minimum threshold
	MinThreshold = 1
)

// Operation types for Safe transactions
const (
	// OperationCall is a regular call
	OperationCall uint8 = 0
	// OperationDelegateCall is a delegate call
	OperationDelegateCall uint8 = 1
)

// Safe ABI method signatures (function selectors)
var (
	// GetOwnersSelector is the selector for getOwners()
	GetOwnersSelector = []byte{0xa0, 0xe6, 0x7e, 0x2b}
	// GetThresholdSelector is the selector for getThreshold()
	GetThresholdSelector = []byte{0xe7, 0x5b, 0x23, 0x57}
	// NonceSelector is the selector for nonce()
	NonceSelector = []byte{0xaf, 0xfe, 0xd0, 0xe0}
	// ExecTransactionSelector is the selector for execTransaction()
	ExecTransactionSelector = []byte{0x6a, 0x76, 0x12, 0x02}
	// GetTransactionHashSelector is the selector for getTransactionHash()
	GetTransactionHashSelector = []byte{0xd8, 0xd1, 0x1f, 0x78}
)

// EIP-712 domain type hash for Safe
const SafeDomainSeparatorTypehash = "EIP712Domain(uint256 chainId,address verifyingContract)"

// Safe transaction type hash
const SafeTxTypehash = "SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)"
