// Package bridge provides cross-chain USDT0 bridging via LayerZero OFT standard.
package bridge

import (
	"context"
	"math/big"
)

// BridgeQuoteParams contains parameters for quoting a bridge transaction.
type BridgeQuoteParams struct {
	// FromChain is the source chain name (e.g., "ethereum", "arbitrum").
	FromChain string
	// ToChain is the destination chain name.
	ToChain string
	// Amount is the amount to bridge in token units (6 decimals for USDT0).
	Amount *big.Int
	// Recipient is the address on destination chain.
	Recipient string
}

// BridgeQuote contains the quote result for a bridge transaction.
type BridgeQuote struct {
	// NativeFee is the native token fee required (in wei).
	NativeFee *big.Int
	// AmountToSend is the amount that will be sent.
	AmountToSend *big.Int
	// MinAmountToReceive is the minimum amount to receive (after fees/slippage).
	MinAmountToReceive *big.Int
	// EstimatedTime is the estimated time for bridge completion in seconds.
	EstimatedTime int
	// FromChain is the source chain.
	FromChain string
	// ToChain is the destination chain.
	ToChain string
}

// BridgeExecuteParams contains parameters for executing a bridge transaction.
type BridgeExecuteParams struct {
	BridgeQuoteParams
	// SlippageTolerance as percentage (e.g., 0.5 for 0.5%). Default: 0.5.
	SlippageTolerance float64
	// DstGasLimit is a custom gas limit for the destination chain execution.
	DstGasLimit *big.Int
	// RefundAddress for excess fees (defaults to sender).
	RefundAddress string
}

// BridgeResult contains the result of a bridge transaction.
type BridgeResult struct {
	// TxHash is the transaction hash on source chain.
	TxHash string
	// MessageGUID is the LayerZero message GUID.
	MessageGUID string
	// AmountSent is the amount sent.
	AmountSent *big.Int
	// AmountToReceive is the amount to be received on destination.
	AmountToReceive *big.Int
	// FromChain is the source chain.
	FromChain string
	// ToChain is the destination chain.
	ToChain string
	// EstimatedTime is the estimated completion time in seconds.
	EstimatedTime int
}

// BridgeStatus represents the status of a cross-chain transfer.
type BridgeStatus string

const (
	// BridgeStatusPending indicates the transaction is submitted, waiting for confirmation.
	BridgeStatusPending BridgeStatus = "pending"
	// BridgeStatusInflight indicates the message is sent via LayerZero, in transit.
	BridgeStatusInflight BridgeStatus = "inflight"
	// BridgeStatusDelivered indicates the message is delivered to destination.
	BridgeStatusDelivered BridgeStatus = "delivered"
	// BridgeStatusCompleted indicates tokens are received on destination.
	BridgeStatusCompleted BridgeStatus = "completed"
	// BridgeStatusFailed indicates the bridge failed.
	BridgeStatusFailed BridgeStatus = "failed"
)

// LayerZeroMessageStatus represents the status from LayerZero Scan API.
type LayerZeroMessageStatus string

const (
	// LayerZeroStatusInflight indicates the message is sent, in transit between chains.
	LayerZeroStatusInflight LayerZeroMessageStatus = "INFLIGHT"
	// LayerZeroStatusConfirming indicates the message is awaiting confirmations.
	LayerZeroStatusConfirming LayerZeroMessageStatus = "CONFIRMING"
	// LayerZeroStatusDelivered indicates the message is successfully delivered.
	LayerZeroStatusDelivered LayerZeroMessageStatus = "DELIVERED"
	// LayerZeroStatusFailed indicates delivery failed.
	LayerZeroStatusFailed LayerZeroMessageStatus = "FAILED"
	// LayerZeroStatusBlocked indicates the message is blocked by DVN.
	LayerZeroStatusBlocked LayerZeroMessageStatus = "BLOCKED"
)

// LayerZeroMessage represents a message from LayerZero Scan API.
type LayerZeroMessage struct {
	// GUID is the unique message identifier.
	GUID string `json:"guid"`
	// SrcEid is the source chain LayerZero endpoint ID.
	SrcEid int `json:"srcEid"`
	// DstEid is the destination chain LayerZero endpoint ID.
	DstEid int `json:"dstEid"`
	// SrcUaAddress is the source chain OApp address.
	SrcUaAddress string `json:"srcUaAddress"`
	// DstUaAddress is the destination chain OApp address.
	DstUaAddress string `json:"dstUaAddress"`
	// SrcTxHash is the source chain transaction hash.
	SrcTxHash string `json:"srcTxHash"`
	// DstTxHash is the destination chain transaction hash (when delivered).
	DstTxHash string `json:"dstTxHash,omitempty"`
	// Status is the current message status.
	Status LayerZeroMessageStatus `json:"status"`
	// SrcBlockNumber is the source chain block number.
	SrcBlockNumber int64 `json:"srcBlockNumber"`
	// DstBlockNumber is the destination chain block number (when delivered).
	DstBlockNumber int64 `json:"dstBlockNumber,omitempty"`
	// Created is the timestamp when the message was created.
	Created string `json:"created"`
	// Updated is the timestamp when the message was last updated.
	Updated string `json:"updated"`
}

// WaitForDeliveryOptions contains options for waiting for message delivery.
type WaitForDeliveryOptions struct {
	// Timeout is the maximum time to wait in milliseconds (default: 600000 = 10 minutes).
	Timeout int64
	// PollInterval is the polling interval in milliseconds (default: 10000 = 10 seconds).
	PollInterval int64
	// OnStatusChange is called when the message status changes.
	OnStatusChange func(status LayerZeroMessageStatus)
}

// SendParam represents the LayerZero SendParam struct.
type SendParam struct {
	DstEid       uint32
	To           [32]byte
	AmountLD     *big.Int
	MinAmountLD  *big.Int
	ExtraOptions []byte
	ComposeMsg   []byte
	OftCmd       []byte
}

// MessagingFee represents the LayerZero MessagingFee struct.
type MessagingFee struct {
	NativeFee  *big.Int
	LzTokenFee *big.Int
}

// TransactionLog represents a transaction log entry.
type TransactionLog struct {
	// Address is the contract address that emitted the log.
	Address string
	// Topics are the indexed event parameters.
	Topics []string
	// Data is the non-indexed event data.
	Data string
}

// BridgeTransactionReceipt represents a transaction receipt with logs.
type BridgeTransactionReceipt struct {
	// Status is the transaction status (1 = success, 0 = reverted).
	Status uint64
	// TransactionHash is the transaction hash.
	TransactionHash string
	// Logs are the event logs emitted during transaction.
	Logs []TransactionLog
}

// BridgeSigner defines the interface for bridge operations.
type BridgeSigner interface {
	// Address returns the signer's address.
	Address() string

	// ReadContract reads data from a smart contract.
	ReadContract(ctx context.Context, address string, abi []byte, functionName string, args ...interface{}) (interface{}, error)

	// WriteContract executes a smart contract transaction.
	WriteContract(ctx context.Context, address string, abi []byte, functionName string, value *big.Int, args ...interface{}) (string, error)

	// WaitForTransactionReceipt waits for a transaction to be mined.
	WaitForTransactionReceipt(ctx context.Context, txHash string) (*BridgeTransactionReceipt, error)
}

// CrossChainPaymentParams contains parameters for cross-chain payment routing.
type CrossChainPaymentParams struct {
	// SourceChain is where the user has funds.
	SourceChain string
	// DestinationChain is where payment is needed.
	DestinationChain string
	// Amount to transfer (in token units, 6 decimals for USDT0).
	Amount *big.Int
	// PayTo is the payment recipient on destination chain.
	PayTo string
	// Payer address (receives bridged funds on destination).
	Payer string
	// SlippageTolerance percentage (default: 0.5).
	SlippageTolerance float64
}

// CrossChainPaymentResult contains the result of cross-chain payment routing.
type CrossChainPaymentResult struct {
	// BridgeTxHash is the bridge transaction hash on source chain.
	BridgeTxHash string
	// MessageGUID is the LayerZero message GUID for tracking.
	MessageGUID string
	// AmountBridged from source chain.
	AmountBridged *big.Int
	// EstimatedReceiveAmount on destination.
	EstimatedReceiveAmount *big.Int
	// SourceChain name.
	SourceChain string
	// DestinationChain name.
	DestinationChain string
	// EstimatedDeliveryTime in seconds.
	EstimatedDeliveryTime int
}
