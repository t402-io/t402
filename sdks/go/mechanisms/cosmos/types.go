package cosmos

import (
	"context"
	"encoding/json"
)

// ExactDirectPayload represents the payment payload for exact-direct scheme on Cosmos
type ExactDirectPayload struct {
	TxHash string `json:"txHash"`
	From   string `json:"from"`
	To     string `json:"to"`
	Amount string `json:"amount"`
	Denom  string `json:"denom,omitempty"`
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
	if denom, ok := data["denom"].(string); ok {
		payload.Denom = denom
	}

	return payload, nil
}

// ToMap converts the payload to a map
func (p *ExactDirectPayload) ToMap() map[string]interface{} {
	m := map[string]interface{}{
		"txHash": p.TxHash,
		"from":   p.From,
		"to":     p.To,
		"amount": p.Amount,
	}
	if p.Denom != "" {
		m["denom"] = p.Denom
	}
	return m
}

// FacilitatorCosmosSigner defines the interface for Cosmos facilitator operations
type FacilitatorCosmosSigner interface {
	// GetAddresses returns the facilitator's Cosmos addresses for a network
	GetAddresses(ctx context.Context, network string) []string

	// QueryTransaction queries a transaction by hash
	QueryTransaction(ctx context.Context, network, txHash string) (*TransactionResult, error)

	// GetBalance gets the token balance for an account
	GetBalance(ctx context.Context, network, address, denom string) (string, error)
}

// TransactionResult represents the result of a Cosmos transaction query
type TransactionResult struct {
	TxHash    string          `json:"txhash"`
	Height    string          `json:"height"`
	Code      int             `json:"code"`
	RawLog    string          `json:"raw_log"`
	Logs      []TxLog         `json:"logs"`
	GasWanted string          `json:"gas_wanted"`
	GasUsed   string          `json:"gas_used"`
	Tx        TxWrapper       `json:"tx"`
	Timestamp string          `json:"timestamp"`
}

// IsSuccess returns true if the transaction succeeded
func (t *TransactionResult) IsSuccess() bool {
	return t.Code == 0
}

// TxWrapper wraps the transaction body
type TxWrapper struct {
	Body TxBody `json:"body"`
}

// TxBody contains the transaction messages
type TxBody struct {
	Messages []json.RawMessage `json:"messages"`
	Memo     string            `json:"memo"`
}

// TxLog represents a transaction log
type TxLog struct {
	MsgIndex int      `json:"msg_index"`
	Log      string   `json:"log"`
	Events   []TxEvent `json:"events"`
}

// TxEvent represents an event in a transaction log
type TxEvent struct {
	Type       string            `json:"type"`
	Attributes []TxEventAttribute `json:"attributes"`
}

// TxEventAttribute represents an attribute of a transaction event
type TxEventAttribute struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// MsgSend represents a Cosmos SDK MsgSend message
type MsgSend struct {
	Type        string `json:"@type"`
	FromAddress string `json:"from_address"`
	ToAddress   string `json:"to_address"`
	Amount      []Coin `json:"amount"`
}

// Coin represents a Cosmos SDK Coin
type Coin struct {
	Denom  string `json:"denom"`
	Amount string `json:"amount"`
}

// ParseMsgSend parses a raw message into a MsgSend
func ParseMsgSend(rawMsg json.RawMessage) (*MsgSend, error) {
	var msg MsgSend
	if err := json.Unmarshal(rawMsg, &msg); err != nil {
		return nil, err
	}
	if msg.Type != MsgTypeSend {
		return nil, nil // Not a MsgSend
	}
	return &msg, nil
}

// GetAmountByDenom returns the amount for a specific denom
func (m *MsgSend) GetAmountByDenom(denom string) string {
	for _, coin := range m.Amount {
		if coin.Denom == denom {
			return coin.Amount
		}
	}
	return ""
}

// RESTTxResponse represents the response from the REST API for transaction query
type RESTTxResponse struct {
	Tx         TxWrapper `json:"tx"`
	TxResponse TxResponse `json:"tx_response"`
}

// TxResponse is the transaction response from REST API
type TxResponse struct {
	Height    string          `json:"height"`
	TxHash    string          `json:"txhash"`
	Codespace string          `json:"codespace"`
	Code      int             `json:"code"`
	Data      string          `json:"data"`
	RawLog    string          `json:"raw_log"`
	Logs      []TxLog         `json:"logs"`
	Info      string          `json:"info"`
	GasWanted string          `json:"gas_wanted"`
	GasUsed   string          `json:"gas_used"`
	Tx        json.RawMessage `json:"tx"`
	Timestamp string          `json:"timestamp"`
	Events    []TxEvent       `json:"events"`
}

// ToTransactionResult converts RESTTxResponse to TransactionResult
func (r *RESTTxResponse) ToTransactionResult() *TransactionResult {
	return &TransactionResult{
		TxHash:    r.TxResponse.TxHash,
		Height:    r.TxResponse.Height,
		Code:      r.TxResponse.Code,
		RawLog:    r.TxResponse.RawLog,
		Logs:      r.TxResponse.Logs,
		GasWanted: r.TxResponse.GasWanted,
		GasUsed:   r.TxResponse.GasUsed,
		Tx:        r.Tx,
		Timestamp: r.TxResponse.Timestamp,
	}
}

// BalanceResponse represents the response from balance query
type BalanceResponse struct {
	Balance Coin `json:"balance"`
}
