// Package erc4337 provides ERC-4337 Account Abstraction support for the T402 protocol.
//
// This package implements ERC-4337 v0.7 types and interfaces for:
// - UserOperation building and signing
// - Bundler client for operation submission
// - Paymaster integration for gas sponsorship
// - Smart account signer interfaces
package erc4337

import (
	"math/big"

	"github.com/ethereum/go-ethereum/common"
)

// EntryPoint addresses (canonical deployments)
const (
	// EntryPointV07Address is the v0.7 EntryPoint contract address
	EntryPointV07Address = "0x0000000071727De22E5E9d8BAf0edAc6f37da032"
	// EntryPointV06Address is the v0.6 EntryPoint contract address (legacy)
	EntryPointV06Address = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"
)

// UserOperation represents an ERC-4337 UserOperation for off-chain representation.
// This is the format used before packing for on-chain submission.
type UserOperation struct {
	// Sender is the smart account address
	Sender common.Address `json:"sender"`
	// Nonce is the anti-replay nonce
	Nonce *big.Int `json:"nonce"`
	// InitCode is the factory address + init data (for account deployment) or empty
	InitCode []byte `json:"initCode"`
	// CallData is the encoded call data for the account's execute function
	CallData []byte `json:"callData"`
	// VerificationGasLimit is the gas limit for account validation
	VerificationGasLimit *big.Int `json:"verificationGasLimit"`
	// CallGasLimit is the gas limit for call execution
	CallGasLimit *big.Int `json:"callGasLimit"`
	// PreVerificationGas is the gas to pay bundler for overhead
	PreVerificationGas *big.Int `json:"preVerificationGas"`
	// MaxPriorityFeePerGas is the max priority fee per gas (tip)
	MaxPriorityFeePerGas *big.Int `json:"maxPriorityFeePerGas"`
	// MaxFeePerGas is the max fee per gas
	MaxFeePerGas *big.Int `json:"maxFeePerGas"`
	// PaymasterAndData is the paymaster address + data, or empty for self-pay
	PaymasterAndData []byte `json:"paymasterAndData"`
	// Signature is the signature over the UserOperation hash
	Signature []byte `json:"signature"`
}

// PackedUserOperation represents an ERC-4337 UserOperation packed for on-chain submission (v0.7).
// Gas fields are packed into bytes32 for efficiency.
type PackedUserOperation struct {
	// Sender is the smart account address
	Sender common.Address `json:"sender"`
	// Nonce is the anti-replay nonce
	Nonce *big.Int `json:"nonce"`
	// InitCode is the factory address + init data, or empty
	InitCode []byte `json:"initCode"`
	// CallData is the encoded call data
	CallData []byte `json:"callData"`
	// AccountGasLimits is packed: verificationGasLimit (16 bytes) + callGasLimit (16 bytes)
	AccountGasLimits [32]byte `json:"accountGasLimits"`
	// PreVerificationGas is the gas for bundler overhead
	PreVerificationGas *big.Int `json:"preVerificationGas"`
	// GasFees is packed: maxPriorityFeePerGas (16 bytes) + maxFeePerGas (16 bytes)
	GasFees [32]byte `json:"gasFees"`
	// PaymasterAndData is the paymaster address + verification gas + postOp gas + data
	PaymasterAndData []byte `json:"paymasterAndData"`
	// Signature is the authorization signature
	Signature []byte `json:"signature"`
}

// PaymasterData contains paymaster information for gas sponsorship.
type PaymasterData struct {
	// Paymaster is the paymaster contract address
	Paymaster common.Address `json:"paymaster"`
	// PaymasterVerificationGasLimit is the gas limit for paymaster validation
	PaymasterVerificationGasLimit *big.Int `json:"paymasterVerificationGasLimit"`
	// PaymasterPostOpGasLimit is the gas limit for paymaster post-operation
	PaymasterPostOpGasLimit *big.Int `json:"paymasterPostOpGasLimit"`
	// PaymasterData is the additional paymaster-specific data
	PaymasterData []byte `json:"paymasterData"`
}

// GasEstimate contains gas estimation results from the bundler.
type GasEstimate struct {
	// VerificationGasLimit is the gas for account validation
	VerificationGasLimit *big.Int `json:"verificationGasLimit"`
	// CallGasLimit is the gas for call execution
	CallGasLimit *big.Int `json:"callGasLimit"`
	// PreVerificationGas is the gas for bundler overhead
	PreVerificationGas *big.Int `json:"preVerificationGas"`
	// PaymasterVerificationGasLimit is the gas for paymaster validation (if applicable)
	PaymasterVerificationGasLimit *big.Int `json:"paymasterVerificationGasLimit,omitempty"`
	// PaymasterPostOpGasLimit is the gas for paymaster post-op (if applicable)
	PaymasterPostOpGasLimit *big.Int `json:"paymasterPostOpGasLimit,omitempty"`
}

// UserOperationReceipt contains the receipt after UserOperation execution.
type UserOperationReceipt struct {
	// UserOpHash is the UserOperation hash
	UserOpHash common.Hash `json:"userOpHash"`
	// Sender is the smart account address
	Sender common.Address `json:"sender"`
	// Nonce is the nonce used
	Nonce *big.Int `json:"nonce"`
	// Paymaster is the paymaster address (if used)
	Paymaster *common.Address `json:"paymaster,omitempty"`
	// ActualGasCost is the actual gas cost
	ActualGasCost *big.Int `json:"actualGasCost"`
	// ActualGasUsed is the actual gas used
	ActualGasUsed *big.Int `json:"actualGasUsed"`
	// Success indicates if the operation succeeded
	Success bool `json:"success"`
	// Reason is the revert reason (if failed)
	Reason string `json:"reason,omitempty"`
	// Receipt is the transaction receipt
	Receipt TransactionReceipt `json:"receipt"`
}

// TransactionReceipt contains transaction receipt information.
type TransactionReceipt struct {
	// TransactionHash is the transaction hash
	TransactionHash common.Hash `json:"transactionHash"`
	// BlockNumber is the block number
	BlockNumber *big.Int `json:"blockNumber"`
	// BlockHash is the block hash
	BlockHash common.Hash `json:"blockHash"`
}

// BundlerConfig contains configuration for the bundler client.
type BundlerConfig struct {
	// BundlerURL is the bundler RPC endpoint URL
	BundlerURL string `json:"bundlerUrl"`
	// EntryPoint is the EntryPoint contract address (optional, defaults to v0.7)
	EntryPoint common.Address `json:"entryPoint,omitempty"`
	// ChainID is the chain ID
	ChainID int64 `json:"chainId"`
}

// PaymasterConfig contains configuration for paymaster integration.
type PaymasterConfig struct {
	// Address is the paymaster contract address
	Address common.Address `json:"address"`
	// URL is the paymaster service URL (for verifying paymasters)
	URL string `json:"url,omitempty"`
	// Type is the paymaster type: "verifying", "token", or "sponsoring"
	Type string `json:"type"`
}

// SmartAccountSigner is the interface for smart account signers.
type SmartAccountSigner interface {
	// GetAddress returns the smart account address
	GetAddress() (common.Address, error)
	// SignUserOpHash signs a UserOperation hash
	SignUserOpHash(userOpHash common.Hash) ([]byte, error)
	// GetInitCode returns the account's init code (for deployment)
	GetInitCode() ([]byte, error)
	// IsDeployed checks if the account is deployed
	IsDeployed() (bool, error)
	// EncodeExecute encodes a call to the account's execute function
	EncodeExecute(target common.Address, value *big.Int, data []byte) ([]byte, error)
	// EncodeExecuteBatch encodes a batch call to the account's executeBatch function
	EncodeExecuteBatch(targets []common.Address, values []*big.Int, datas [][]byte) ([]byte, error)
}

// BundlerClient is the interface for bundler clients.
type BundlerClient interface {
	// SendUserOperation submits a UserOperation to the bundler
	SendUserOperation(userOp *UserOperation) (common.Hash, error)
	// EstimateUserOperationGas estimates gas for a UserOperation
	EstimateUserOperationGas(userOp *UserOperation) (*GasEstimate, error)
	// GetUserOperationByHash retrieves a UserOperation by hash
	GetUserOperationByHash(hash common.Hash) (*UserOperation, error)
	// GetUserOperationReceipt retrieves the receipt for a UserOperation
	GetUserOperationReceipt(hash common.Hash) (*UserOperationReceipt, error)
	// GetSupportedEntryPoints returns supported EntryPoint addresses
	GetSupportedEntryPoints() ([]common.Address, error)
}

// PaymasterClient is the interface for paymaster clients.
type PaymasterClient interface {
	// GetPaymasterData returns paymaster data for a UserOperation
	GetPaymasterData(userOp *UserOperation, chainID int64, entryPoint common.Address) (*PaymasterData, error)
	// WillSponsor checks if the paymaster will sponsor this operation
	WillSponsor(userOp *UserOperation, chainID int64, entryPoint common.Address) (bool, error)
}
