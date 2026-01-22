package near

import (
	"encoding/json"
	"testing"
)

func TestExactDirectPayloadToMap(t *testing.T) {
	payload := &ExactDirectPayload{
		TxHash: "4b8HnEfCQKjJXZKz1mQXdF3L7XKf3X7SQvDAyEsKr42Y",
		From:   "alice.near",
		To:     "bob.near",
		Amount: "1000000",
	}

	m := payload.ToMap()

	if m["txHash"] != payload.TxHash {
		t.Errorf("ToMap() txHash = %v, want %v", m["txHash"], payload.TxHash)
	}
	if m["from"] != payload.From {
		t.Errorf("ToMap() from = %v, want %v", m["from"], payload.From)
	}
	if m["to"] != payload.To {
		t.Errorf("ToMap() to = %v, want %v", m["to"], payload.To)
	}
	if m["amount"] != payload.Amount {
		t.Errorf("ToMap() amount = %v, want %v", m["amount"], payload.Amount)
	}
}

func TestPayloadFromMap(t *testing.T) {
	tests := []struct {
		name string
		data map[string]interface{}
		want ExactDirectPayload
	}{
		{
			name: "valid payload",
			data: map[string]interface{}{
				"txHash": "4b8HnEfCQKjJXZKz1mQXdF3L7XKf3X7SQvDAyEsKr42Y",
				"from":   "alice.near",
				"to":     "bob.near",
				"amount": "1000000",
			},
			want: ExactDirectPayload{
				TxHash: "4b8HnEfCQKjJXZKz1mQXdF3L7XKf3X7SQvDAyEsKr42Y",
				From:   "alice.near",
				To:     "bob.near",
				Amount: "1000000",
			},
		},
		{
			name: "empty map returns empty payload",
			data: map[string]interface{}{},
			want: ExactDirectPayload{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload, err := PayloadFromMap(tt.data)
			if err != nil {
				t.Fatalf("PayloadFromMap() error: %v", err)
			}
			if payload.TxHash != tt.want.TxHash {
				t.Errorf("PayloadFromMap().TxHash = %v, want %v", payload.TxHash, tt.want.TxHash)
			}
			if payload.From != tt.want.From {
				t.Errorf("PayloadFromMap().From = %v, want %v", payload.From, tt.want.From)
			}
			if payload.To != tt.want.To {
				t.Errorf("PayloadFromMap().To = %v, want %v", payload.To, tt.want.To)
			}
			if payload.Amount != tt.want.Amount {
				t.Errorf("PayloadFromMap().Amount = %v, want %v", payload.Amount, tt.want.Amount)
			}
		})
	}
}

func TestPayloadRoundTrip(t *testing.T) {
	original := &ExactDirectPayload{
		TxHash: "4b8HnEfCQKjJXZKz1mQXdF3L7XKf3X7SQvDAyEsKr42Y",
		From:   "alice.near",
		To:     "bob.near",
		Amount: "1000000",
	}

	// Convert to map
	m := original.ToMap()

	// Convert back to payload
	recovered, err := PayloadFromMap(m)
	if err != nil {
		t.Fatalf("PayloadFromMap() error: %v", err)
	}

	// Verify fields match
	if recovered.TxHash != original.TxHash {
		t.Errorf("Round trip TxHash = %v, want %v", recovered.TxHash, original.TxHash)
	}
	if recovered.From != original.From {
		t.Errorf("Round trip From = %v, want %v", recovered.From, original.From)
	}
	if recovered.To != original.To {
		t.Errorf("Round trip To = %v, want %v", recovered.To, original.To)
	}
	if recovered.Amount != original.Amount {
		t.Errorf("Round trip Amount = %v, want %v", recovered.Amount, original.Amount)
	}
}

func TestExactDirectPayloadJSONSerialization(t *testing.T) {
	payload := &ExactDirectPayload{
		TxHash: "4b8HnEfCQKjJXZKz1mQXdF3L7XKf3X7SQvDAyEsKr42Y",
		From:   "alice.near",
		To:     "bob.near",
		Amount: "1000000",
	}

	// Marshal to JSON
	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("json.Marshal() error: %v", err)
	}

	// Unmarshal back
	var recovered ExactDirectPayload
	if err := json.Unmarshal(jsonBytes, &recovered); err != nil {
		t.Fatalf("json.Unmarshal() error: %v", err)
	}

	// Verify fields match
	if recovered.TxHash != payload.TxHash {
		t.Errorf("JSON round trip TxHash = %v, want %v", recovered.TxHash, payload.TxHash)
	}
	if recovered.From != payload.From {
		t.Errorf("JSON round trip From = %v, want %v", recovered.From, payload.From)
	}
}

func TestTransactionStatusIsSuccess(t *testing.T) {
	tests := []struct {
		name   string
		status TransactionStatus
		want   bool
	}{
		{
			name: "success with value",
			status: TransactionStatus{
				SuccessValue: strPtr(""),
				Failure:      nil,
			},
			want: true,
		},
		{
			name: "failure",
			status: TransactionStatus{
				SuccessValue: nil,
				Failure:      json.RawMessage(`{"ActionError": {}}`),
			},
			want: false,
		},
		{
			name: "empty status",
			status: TransactionStatus{
				SuccessValue: nil,
				Failure:      nil,
			},
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.status.IsSuccess()
			if got != tt.want {
				t.Errorf("TransactionStatus.IsSuccess() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestTransactionJSONSerialization(t *testing.T) {
	tx := &Transaction{
		Hash:       "4b8HnEfCQKjJXZKz1mQXdF3L7XKf3X7SQvDAyEsKr42Y",
		SignerID:   "alice.near",
		ReceiverID: "usdt.tether-token.near",
		Actions:    []Action{},
	}

	// Marshal to JSON
	jsonBytes, err := json.Marshal(tx)
	if err != nil {
		t.Fatalf("json.Marshal() error: %v", err)
	}

	// Unmarshal back
	var recovered Transaction
	if err := json.Unmarshal(jsonBytes, &recovered); err != nil {
		t.Fatalf("json.Unmarshal() error: %v", err)
	}

	if recovered.Hash != tx.Hash {
		t.Errorf("JSON round trip Hash = %v, want %v", recovered.Hash, tx.Hash)
	}
	if recovered.SignerID != tx.SignerID {
		t.Errorf("JSON round trip SignerID = %v, want %v", recovered.SignerID, tx.SignerID)
	}
	if recovered.ReceiverID != tx.ReceiverID {
		t.Errorf("JSON round trip ReceiverID = %v, want %v", recovered.ReceiverID, tx.ReceiverID)
	}
}

func TestFtTransferArgsJSONSerialization(t *testing.T) {
	memo := "test memo"
	args := &FtTransferArgs{
		ReceiverID: "bob.near",
		Amount:     "1000000",
		Memo:       &memo,
	}

	// Marshal to JSON
	jsonBytes, err := json.Marshal(args)
	if err != nil {
		t.Fatalf("json.Marshal() error: %v", err)
	}

	// Unmarshal back
	var recovered FtTransferArgs
	if err := json.Unmarshal(jsonBytes, &recovered); err != nil {
		t.Fatalf("json.Unmarshal() error: %v", err)
	}

	if recovered.ReceiverID != args.ReceiverID {
		t.Errorf("JSON round trip ReceiverID = %v, want %v", recovered.ReceiverID, args.ReceiverID)
	}
	if recovered.Amount != args.Amount {
		t.Errorf("JSON round trip Amount = %v, want %v", recovered.Amount, args.Amount)
	}
	if recovered.Memo == nil || *recovered.Memo != *args.Memo {
		t.Errorf("JSON round trip Memo mismatch")
	}
}

func TestFtTransferArgsNilMemo(t *testing.T) {
	args := &FtTransferArgs{
		ReceiverID: "bob.near",
		Amount:     "1000000",
		Memo:       nil,
	}

	// Marshal to JSON
	jsonBytes, err := json.Marshal(args)
	if err != nil {
		t.Fatalf("json.Marshal() error: %v", err)
	}

	// Unmarshal back
	var recovered FtTransferArgs
	if err := json.Unmarshal(jsonBytes, &recovered); err != nil {
		t.Fatalf("json.Unmarshal() error: %v", err)
	}

	if recovered.Memo != nil {
		t.Error("Expected Memo to be nil")
	}
}

func TestRPCRequestJSONSerialization(t *testing.T) {
	req := &RPCRequest{
		JSONRPC: "2.0",
		ID:      "test-1",
		Method:  "tx",
		Params:  []interface{}{"txhash", "alice.near"},
	}

	// Marshal to JSON
	jsonBytes, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("json.Marshal() error: %v", err)
	}

	// Unmarshal back
	var recovered RPCRequest
	if err := json.Unmarshal(jsonBytes, &recovered); err != nil {
		t.Fatalf("json.Unmarshal() error: %v", err)
	}

	if recovered.JSONRPC != req.JSONRPC {
		t.Errorf("JSON round trip JSONRPC = %v, want %v", recovered.JSONRPC, req.JSONRPC)
	}
	if recovered.Method != req.Method {
		t.Errorf("JSON round trip Method = %v, want %v", recovered.Method, req.Method)
	}
}

func TestRPCErrorJSONSerialization(t *testing.T) {
	rpcErr := &RPCError{
		Code:    -32000,
		Message: "Unknown block",
		Data:    "DB Not Found Error",
	}

	// Marshal to JSON
	jsonBytes, err := json.Marshal(rpcErr)
	if err != nil {
		t.Fatalf("json.Marshal() error: %v", err)
	}

	// Unmarshal back
	var recovered RPCError
	if err := json.Unmarshal(jsonBytes, &recovered); err != nil {
		t.Fatalf("json.Unmarshal() error: %v", err)
	}

	if recovered.Code != rpcErr.Code {
		t.Errorf("JSON round trip Code = %v, want %v", recovered.Code, rpcErr.Code)
	}
	if recovered.Message != rpcErr.Message {
		t.Errorf("JSON round trip Message = %v, want %v", recovered.Message, rpcErr.Message)
	}
}

func TestTransactionResultJSONSerialization(t *testing.T) {
	successValue := ""
	result := &TransactionResult{
		Status: TransactionStatus{
			SuccessValue: &successValue,
		},
		Transaction: Transaction{
			Hash:       "4b8HnEfCQKjJXZKz1mQXdF3L7XKf3X7SQvDAyEsKr42Y",
			SignerID:   "alice.near",
			ReceiverID: "usdt.tether-token.near",
		},
		TransactionOutcome: TransactionOutcome{
			BlockHash: "block123",
			ID:        "outcome123",
		},
	}

	// Marshal to JSON
	jsonBytes, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("json.Marshal() error: %v", err)
	}

	// Unmarshal back
	var recovered TransactionResult
	if err := json.Unmarshal(jsonBytes, &recovered); err != nil {
		t.Fatalf("json.Unmarshal() error: %v", err)
	}

	if recovered.Transaction.Hash != result.Transaction.Hash {
		t.Errorf("JSON round trip Transaction.Hash = %v, want %v",
			recovered.Transaction.Hash, result.Transaction.Hash)
	}
	if !recovered.Status.IsSuccess() {
		t.Error("Expected status to be success")
	}
}

// Helper function
func strPtr(s string) *string {
	return &s
}
