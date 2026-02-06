// Package upto implements the upto payment scheme for NEAR.
// The upto scheme allows clients to authorize payments up to a maximum amount,
// with the actual settlement amount determined at settlement time.
//
// Note: NEAR NEP-141 tokens don't have native approve/transferFrom.
// This implementation uses an escrow pattern:
// 1. Client transfers maxAmount to the facilitator's NEAR account
// 2. Facilitator verifies the transfer
// 3. Facilitator forwards settleAmount to payTo and refunds (maxAmount - settleAmount)
package upto

import (
	"context"
	"encoding/json"
	"fmt"
)

// SchemeUpto is the scheme identifier for upto payments
const SchemeUpto = "upto"

// UptoNearPayload represents a NEAR upto payment payload.
// Contains the transaction hash of the client's transfer to the facilitator.
type UptoNearPayload struct {
	// TxHash is the NEAR transaction hash of the transfer to facilitator
	TxHash string `json:"txHash"`

	// Authorization contains transfer metadata for verification
	Authorization UptoNearAuthorization `json:"authorization"`

	// PaymentNonce is a unique nonce for replay protection (hex string)
	PaymentNonce string `json:"paymentNonce"`
}

// UptoNearAuthorization contains upto authorization metadata
type UptoNearAuthorization struct {
	// From is the sender's NEAR account ID
	From string `json:"from"`

	// Facilitator is the facilitator's NEAR account ID that receives the transfer
	Facilitator string `json:"facilitator"`

	// TokenContract is the NEP-141 token contract ID
	TokenContract string `json:"tokenContract"`

	// MaxAmount is the maximum authorized amount in smallest units (as string)
	MaxAmount string `json:"maxAmount"`
}

// UptoNearExtra contains upto-specific extra fields for payment requirements
type UptoNearExtra struct {
	// Facilitator is the facilitator account ID that will receive the initial transfer
	Facilitator string `json:"facilitator,omitempty"`

	// MaxAmount is the maximum payment amount authorized
	MaxAmount string `json:"maxAmount,omitempty"`

	// MinAmount is the minimum acceptable settlement amount
	MinAmount string `json:"minAmount,omitempty"`

	// Unit is the billing unit (e.g., "token", "request", "second")
	Unit string `json:"unit,omitempty"`

	// UnitPrice is the price per unit in smallest denomination
	UnitPrice string `json:"unitPrice,omitempty"`
}

// ToMap converts an UptoNearPayload to a map for JSON marshaling
func (p *UptoNearPayload) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"txHash": p.TxHash,
		"authorization": map[string]interface{}{
			"from":          p.Authorization.From,
			"facilitator":   p.Authorization.Facilitator,
			"tokenContract": p.Authorization.TokenContract,
			"maxAmount":     p.Authorization.MaxAmount,
		},
		"paymentNonce": p.PaymentNonce,
	}
}

// UptoPayloadFromMap creates an UptoNearPayload from a map
func UptoPayloadFromMap(data map[string]interface{}) (*UptoNearPayload, error) {
	jsonBytes, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal payload data: %w", err)
	}

	var payload UptoNearPayload
	if err := json.Unmarshal(jsonBytes, &payload); err != nil {
		return nil, fmt.Errorf("failed to unmarshal payload: %w", err)
	}

	if payload.TxHash == "" {
		return nil, fmt.Errorf("missing txHash field in payload")
	}

	if payload.Authorization.From == "" {
		return nil, fmt.Errorf("missing authorization.from field in payload")
	}

	if payload.Authorization.Facilitator == "" {
		return nil, fmt.Errorf("missing authorization.facilitator field in payload")
	}

	if payload.PaymentNonce == "" {
		return nil, fmt.Errorf("missing paymentNonce field in payload")
	}

	return &payload, nil
}

// UptoClientNearSigner defines client-side operations for NEAR upto payments
type UptoClientNearSigner interface {
	// AccountID returns the signer's NEAR account ID
	AccountID() string

	// FtTransfer executes a NEP-141 ft_transfer and returns the tx hash
	FtTransfer(ctx context.Context, params FtTransferParams) (string, error)
}

// FtTransferParams contains parameters for ft_transfer
type FtTransferParams struct {
	// TokenContract is the NEP-141 token contract ID
	TokenContract string

	// ReceiverID is the recipient account ID
	ReceiverID string

	// Amount is the transfer amount in smallest units
	Amount string

	// Memo is an optional memo string
	Memo string
}

// UptoFacilitatorNearSigner defines facilitator operations for NEAR upto payments
type UptoFacilitatorNearSigner interface {
	// GetAddresses returns all NEAR account IDs this facilitator can use
	GetAddresses(ctx context.Context, network string) []string

	// QueryTransaction queries a transaction by hash
	QueryTransaction(ctx context.Context, txHash string, senderID string) (*TransactionResult, error)

	// GetBalance gets the token balance for an account
	GetBalance(ctx context.Context, accountID string, tokenContract string) (string, error)

	// FtTransfer executes a NEP-141 ft_transfer and returns the tx hash
	FtTransfer(ctx context.Context, params FtTransferParams) (string, error)

	// WaitForTransaction waits for a transaction to be confirmed
	WaitForTransaction(ctx context.Context, txHash string, senderID string) error
}

// TransactionResult represents the result of a NEAR transaction query
type TransactionResult struct {
	Status            TransactionStatus     `json:"status"`
	Transaction       Transaction           `json:"transaction"`
	TransactionOutcome TransactionOutcome   `json:"transaction_outcome"`
	ReceiptsOutcome   []ReceiptOutcome      `json:"receipts_outcome"`
}

// TransactionStatus represents the status of a transaction
type TransactionStatus struct {
	SuccessValue *string         `json:"SuccessValue,omitempty"`
	Failure      json.RawMessage `json:"Failure,omitempty"`
}

// IsSuccess returns true if the transaction succeeded
func (s TransactionStatus) IsSuccess() bool {
	return s.SuccessValue != nil && len(s.Failure) == 0
}

// Transaction represents a NEAR transaction
type Transaction struct {
	Hash       string   `json:"hash"`
	SignerID   string   `json:"signer_id"`
	ReceiverID string   `json:"receiver_id"`
	Actions    []Action `json:"actions"`
}

// Action represents a NEAR transaction action
type Action struct {
	FunctionCall *FunctionCallAction `json:"FunctionCall,omitempty"`
}

// FunctionCallAction represents a function call action
type FunctionCallAction struct {
	MethodName string          `json:"method_name"`
	Args       json.RawMessage `json:"args"`
	Gas        uint64          `json:"gas"`
	Deposit    string          `json:"deposit"`
}

// FtTransferArgs represents the arguments to ft_transfer
type FtTransferArgs struct {
	ReceiverID string  `json:"receiver_id"`
	Amount     string  `json:"amount"`
	Memo       *string `json:"memo,omitempty"`
}

// TransactionOutcome represents the outcome of a transaction
type TransactionOutcome struct {
	BlockHash string `json:"block_hash"`
	ID        string `json:"id"`
}

// ReceiptOutcome represents the outcome of a receipt
type ReceiptOutcome struct {
	ID      string          `json:"id"`
	Outcome ExecutionOutcome `json:"outcome"`
}

// ExecutionOutcome represents the execution outcome
type ExecutionOutcome struct {
	Status      ExecutionStatus `json:"status"`
	GasBurnt    uint64          `json:"gas_burnt"`
	TokensBurnt string          `json:"tokens_burnt"`
}

// ExecutionStatus represents the status of execution
type ExecutionStatus struct {
	SuccessValue *string         `json:"SuccessValue,omitempty"`
	Failure      json.RawMessage `json:"Failure,omitempty"`
}
