package near

import (
	"context"
	"encoding/json"
)

// ExactDirectPayload represents the payment payload for exact-direct scheme on NEAR
type ExactDirectPayload struct {
	TxHash string `json:"txHash"`
	From   string `json:"from"`
	To     string `json:"to"`
	Amount string `json:"amount"`
}

// PayloadFromMap creates an ExactDirectPayload from a map
func PayloadFromMap(data map[string]interface{}) (*ExactDirectPayload, error) {
	payload := &ExactDirectPayload{}

	if txHash, ok := data["txHash"].(string); ok {
		payload.TxHash = txHash
	}
	if from, ok := data["from"].(string); ok {
		payload.From = from
	}
	if to, ok := data["to"].(string); ok {
		payload.To = to
	}
	if amount, ok := data["amount"].(string); ok {
		payload.Amount = amount
	}

	return payload, nil
}

// ToMap converts the payload to a map
func (p *ExactDirectPayload) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"txHash": p.TxHash,
		"from":   p.From,
		"to":     p.To,
		"amount": p.Amount,
	}
}

// FacilitatorNearSigner defines the interface for NEAR facilitator operations
type FacilitatorNearSigner interface {
	// GetAddresses returns the facilitator's NEAR account IDs
	GetAddresses(ctx context.Context, network string) []string

	// QueryTransaction queries a transaction by hash
	QueryTransaction(ctx context.Context, txHash string, senderID string) (*TransactionResult, error)

	// GetBalance gets the token balance for an account
	GetBalance(ctx context.Context, accountID string, tokenContract string) (string, error)
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
	Transfer     *TransferAction     `json:"Transfer,omitempty"`
}

// FunctionCallAction represents a function call action
type FunctionCallAction struct {
	MethodName string          `json:"method_name"`
	Args       json.RawMessage `json:"args"`
	Gas        uint64          `json:"gas"`
	Deposit    string          `json:"deposit"`
}

// TransferAction represents a NEAR transfer action
type TransferAction struct {
	Deposit string `json:"deposit"`
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

// RPCRequest represents a NEAR JSON-RPC request
type RPCRequest struct {
	JSONRPC string        `json:"jsonrpc"`
	ID      string        `json:"id"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params,omitempty"`
}

// RPCResponse represents a NEAR JSON-RPC response
type RPCResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      string          `json:"id"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *RPCError       `json:"error,omitempty"`
}

// RPCError represents a JSON-RPC error
type RPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Data    string `json:"data,omitempty"`
}
