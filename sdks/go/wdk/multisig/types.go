// Package multisig provides multi-sig (Safe) smart account support for T402.
package multisig

import (
	"math/big"

	"github.com/ethereum/go-ethereum/common"
)

// SafeConfig holds configuration for a Safe multi-sig account.
type SafeConfig struct {
	// Address of the Safe contract
	Address common.Address
	// ChainID for the network
	ChainID *big.Int
	// RPCURL for the network
	RPCURL string
}

// SafeOwner represents an owner of a Safe account.
type SafeOwner struct {
	// Address of the owner
	Address common.Address
	// Index in the Safe's owner list
	Index int
}

// SafeTransaction represents a pending Safe transaction.
type SafeTransaction struct {
	// To is the target address
	To common.Address
	// Value is the ETH value to send
	Value *big.Int
	// Data is the calldata
	Data []byte
	// Operation type (0 = Call, 1 = DelegateCall)
	Operation uint8
	// SafeTxGas for the transaction
	SafeTxGas *big.Int
	// BaseGas for data and signatures
	BaseGas *big.Int
	// GasPrice for refund calculation
	GasPrice *big.Int
	// GasToken for refund (0x0 for ETH)
	GasToken common.Address
	// RefundReceiver for gas refund
	RefundReceiver common.Address
	// Nonce of the Safe
	Nonce *big.Int
}

// SafeSignature holds a signature from a Safe owner.
type SafeSignature struct {
	// Signer address
	Signer common.Address
	// Signature bytes (r, s, v format)
	Signature []byte
	// SignatureType (EOA, Contract, ApprovedHash)
	SignatureType SignatureType
}

// SignatureType represents the type of signature.
type SignatureType uint8

const (
	// SignatureTypeEOA is an EOA signature (most common)
	SignatureTypeEOA SignatureType = 0
	// SignatureTypeContract is an EIP-1271 contract signature
	SignatureTypeContract SignatureType = 1
	// SignatureTypeApprovedHash is a pre-approved hash
	SignatureTypeApprovedHash SignatureType = 4
)

// TransactionRequest represents a multi-sig transaction awaiting signatures.
type TransactionRequest struct {
	// ID is a unique identifier for this request
	ID string
	// Safe address
	SafeAddress common.Address
	// Transaction to execute
	Transaction *SafeTransaction
	// TransactionHash for signing
	TransactionHash common.Hash
	// Signatures collected so far
	Signatures map[common.Address]*SafeSignature
	// Threshold required
	Threshold int
	// CreatedAt timestamp
	CreatedAt int64
	// ExpiresAt timestamp
	ExpiresAt int64
}

// IsReady returns true if enough signatures have been collected.
func (r *TransactionRequest) IsReady() bool {
	return len(r.Signatures) >= r.Threshold
}

// CollectedCount returns the number of signatures collected.
func (r *TransactionRequest) CollectedCount() int {
	return len(r.Signatures)
}

// SafeInfo holds information about a Safe account.
type SafeInfo struct {
	// Address of the Safe
	Address common.Address
	// Owners of the Safe
	Owners []common.Address
	// Threshold required for transactions
	Threshold int
	// Nonce for the next transaction
	Nonce *big.Int
	// Version of the Safe contract
	Version string
	// ChainID
	ChainID *big.Int
}

// ExecutionResult represents the result of executing a Safe transaction.
type ExecutionResult struct {
	// TxHash of the execution transaction
	TxHash common.Hash
	// Success indicates if the transaction succeeded
	Success bool
	// GasUsed by the transaction
	GasUsed uint64
	// BlockNumber where it was included
	BlockNumber uint64
}
