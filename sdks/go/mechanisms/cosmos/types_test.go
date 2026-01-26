package cosmos

import (
	"encoding/json"
	"testing"
)

func TestPayloadFromMap(t *testing.T) {
	tests := []struct {
		name    string
		data    map[string]interface{}
		want    *ExactDirectPayload
	}{
		{
			name: "Full payload",
			data: map[string]interface{}{
				"txHash": "ABC123",
				"from":   "noble1sender",
				"to":     "noble1receiver",
				"amount": "1000000",
				"denom":  "uusdc",
			},
			want: &ExactDirectPayload{
				TxHash: "ABC123",
				From:   "noble1sender",
				To:     "noble1receiver",
				Amount: "1000000",
				Denom:  "uusdc",
			},
		},
		{
			name: "Minimal payload",
			data: map[string]interface{}{
				"txHash": "DEF456",
				"from":   "noble1sender",
			},
			want: &ExactDirectPayload{
				TxHash: "DEF456",
				From:   "noble1sender",
			},
		},
		{
			name: "Empty payload",
			data: map[string]interface{}{},
			want: &ExactDirectPayload{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := PayloadFromMap(tt.data)
			if err != nil {
				t.Errorf("PayloadFromMap() error = %v", err)
				return
			}
			if got.TxHash != tt.want.TxHash {
				t.Errorf("TxHash = %v, want %v", got.TxHash, tt.want.TxHash)
			}
			if got.From != tt.want.From {
				t.Errorf("From = %v, want %v", got.From, tt.want.From)
			}
			if got.To != tt.want.To {
				t.Errorf("To = %v, want %v", got.To, tt.want.To)
			}
			if got.Amount != tt.want.Amount {
				t.Errorf("Amount = %v, want %v", got.Amount, tt.want.Amount)
			}
			if got.Denom != tt.want.Denom {
				t.Errorf("Denom = %v, want %v", got.Denom, tt.want.Denom)
			}
		})
	}
}

func TestExactDirectPayload_ToMap(t *testing.T) {
	payload := &ExactDirectPayload{
		TxHash: "ABC123",
		From:   "noble1sender",
		To:     "noble1receiver",
		Amount: "1000000",
		Denom:  "uusdc",
	}

	m := payload.ToMap()

	if m["txHash"] != "ABC123" {
		t.Errorf("txHash = %v, want ABC123", m["txHash"])
	}
	if m["from"] != "noble1sender" {
		t.Errorf("from = %v, want noble1sender", m["from"])
	}
	if m["to"] != "noble1receiver" {
		t.Errorf("to = %v, want noble1receiver", m["to"])
	}
	if m["amount"] != "1000000" {
		t.Errorf("amount = %v, want 1000000", m["amount"])
	}
	if m["denom"] != "uusdc" {
		t.Errorf("denom = %v, want uusdc", m["denom"])
	}
}

func TestExactDirectPayload_ToMap_NoDenom(t *testing.T) {
	payload := &ExactDirectPayload{
		TxHash: "ABC123",
		From:   "noble1sender",
		To:     "noble1receiver",
		Amount: "1000000",
	}

	m := payload.ToMap()

	if _, ok := m["denom"]; ok {
		t.Error("denom should not be present when empty")
	}
}

func TestTransactionResult_IsSuccess(t *testing.T) {
	tests := []struct {
		name string
		code int
		want bool
	}{
		{"Success", 0, true},
		{"Failure code 1", 1, false},
		{"Failure code 5", 5, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tx := &TransactionResult{Code: tt.code}
			if got := tx.IsSuccess(); got != tt.want {
				t.Errorf("IsSuccess() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestParseMsgSend(t *testing.T) {
	tests := []struct {
		name    string
		rawMsg  string
		wantNil bool
		wantFrom string
		wantTo   string
	}{
		{
			name: "Valid MsgSend",
			rawMsg: `{
				"@type": "/cosmos.bank.v1beta1.MsgSend",
				"from_address": "noble1sender",
				"to_address": "noble1receiver",
				"amount": [{"denom": "uusdc", "amount": "1000000"}]
			}`,
			wantNil:  false,
			wantFrom: "noble1sender",
			wantTo:   "noble1receiver",
		},
		{
			name: "Different message type",
			rawMsg: `{
				"@type": "/cosmos.staking.v1beta1.MsgDelegate",
				"delegator_address": "noble1sender"
			}`,
			wantNil: true,
		},
		{
			name:    "Invalid JSON",
			rawMsg:  `{invalid}`,
			wantNil: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			msg, err := ParseMsgSend(json.RawMessage(tt.rawMsg))
			if tt.wantNil {
				if msg != nil && err == nil {
					t.Error("expected nil result")
				}
				return
			}
			if err != nil {
				t.Errorf("ParseMsgSend() error = %v", err)
				return
			}
			if msg.FromAddress != tt.wantFrom {
				t.Errorf("FromAddress = %v, want %v", msg.FromAddress, tt.wantFrom)
			}
			if msg.ToAddress != tt.wantTo {
				t.Errorf("ToAddress = %v, want %v", msg.ToAddress, tt.wantTo)
			}
		})
	}
}

func TestMsgSend_GetAmountByDenom(t *testing.T) {
	msg := &MsgSend{
		Amount: []Coin{
			{Denom: "uusdc", Amount: "1000000"},
			{Denom: "uatom", Amount: "500000"},
		},
	}

	tests := []struct {
		denom string
		want  string
	}{
		{"uusdc", "1000000"},
		{"uatom", "500000"},
		{"unknown", ""},
	}

	for _, tt := range tests {
		t.Run(tt.denom, func(t *testing.T) {
			if got := msg.GetAmountByDenom(tt.denom); got != tt.want {
				t.Errorf("GetAmountByDenom(%s) = %v, want %v", tt.denom, got, tt.want)
			}
		})
	}
}

func TestRESTTxResponse_ToTransactionResult(t *testing.T) {
	resp := &RESTTxResponse{
		Tx: TxWrapper{
			Body: TxBody{
				Messages: []json.RawMessage{
					json.RawMessage(`{"@type": "/cosmos.bank.v1beta1.MsgSend"}`),
				},
				Memo: "test memo",
			},
		},
		TxResponse: TxResponse{
			Height:    "12345",
			TxHash:    "ABC123DEF456",
			Code:      0,
			RawLog:    "[]",
			GasWanted: "200000",
			GasUsed:   "150000",
			Timestamp: "2026-01-26T00:00:00Z",
		},
	}

	result := resp.ToTransactionResult()

	if result.TxHash != "ABC123DEF456" {
		t.Errorf("TxHash = %v, want ABC123DEF456", result.TxHash)
	}
	if result.Height != "12345" {
		t.Errorf("Height = %v, want 12345", result.Height)
	}
	if result.Code != 0 {
		t.Errorf("Code = %v, want 0", result.Code)
	}
	if result.GasWanted != "200000" {
		t.Errorf("GasWanted = %v, want 200000", result.GasWanted)
	}
	if result.GasUsed != "150000" {
		t.Errorf("GasUsed = %v, want 150000", result.GasUsed)
	}
	if !result.IsSuccess() {
		t.Error("expected IsSuccess() = true")
	}
}

func TestCoin(t *testing.T) {
	coin := Coin{
		Denom:  "uusdc",
		Amount: "1000000",
	}

	if coin.Denom != "uusdc" {
		t.Errorf("Denom = %v, want uusdc", coin.Denom)
	}
	if coin.Amount != "1000000" {
		t.Errorf("Amount = %v, want 1000000", coin.Amount)
	}
}

func TestBalanceResponse(t *testing.T) {
	resp := BalanceResponse{
		Balance: Coin{
			Denom:  "uusdc",
			Amount: "5000000",
		},
	}

	if resp.Balance.Denom != "uusdc" {
		t.Errorf("Balance.Denom = %v, want uusdc", resp.Balance.Denom)
	}
	if resp.Balance.Amount != "5000000" {
		t.Errorf("Balance.Amount = %v, want 5000000", resp.Balance.Amount)
	}
}
