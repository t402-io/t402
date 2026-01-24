package stacks

import (
	"testing"
)

func TestPayloadFromMap(t *testing.T) {
	tests := []struct {
		name    string
		data    map[string]interface{}
		wantTxId string
		wantFrom string
		wantTo   string
		wantAmt  string
		wantAddr string
	}{
		{
			name: "complete payload",
			data: map[string]interface{}{
				"txId":            "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
				"from":            "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
				"to":              "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
				"amount":          "1000000",
				"contractAddress": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
			},
			wantTxId: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			wantFrom: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
			wantTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
			wantAmt:  "1000000",
			wantAddr: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
		},
		{
			name:    "empty map",
			data:    map[string]interface{}{},
			wantTxId: "",
			wantFrom: "",
			wantTo:   "",
			wantAmt:  "",
			wantAddr: "",
		},
		{
			name: "partial payload",
			data: map[string]interface{}{
				"txId": "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
				"from": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
			},
			wantTxId: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
			wantFrom: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
			wantTo:   "",
			wantAmt:  "",
			wantAddr: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload, err := PayloadFromMap(tt.data)
			if err != nil {
				t.Fatalf("PayloadFromMap() error: %v", err)
			}
			if payload.TxId != tt.wantTxId {
				t.Errorf("TxId = %v, want %v", payload.TxId, tt.wantTxId)
			}
			if payload.From != tt.wantFrom {
				t.Errorf("From = %v, want %v", payload.From, tt.wantFrom)
			}
			if payload.To != tt.wantTo {
				t.Errorf("To = %v, want %v", payload.To, tt.wantTo)
			}
			if payload.Amount != tt.wantAmt {
				t.Errorf("Amount = %v, want %v", payload.Amount, tt.wantAmt)
			}
			if payload.ContractAddress != tt.wantAddr {
				t.Errorf("ContractAddress = %v, want %v", payload.ContractAddress, tt.wantAddr)
			}
		})
	}
}

func TestPayloadToMap(t *testing.T) {
	payload := &ExactDirectPayload{
		TxId:            "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
		From:            "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
		To:              "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
		Amount:          "5000000",
		ContractAddress: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
	}

	m := payload.ToMap()

	if m["txId"] != payload.TxId {
		t.Errorf("ToMap()[txId] = %v, want %v", m["txId"], payload.TxId)
	}
	if m["from"] != payload.From {
		t.Errorf("ToMap()[from] = %v, want %v", m["from"], payload.From)
	}
	if m["to"] != payload.To {
		t.Errorf("ToMap()[to] = %v, want %v", m["to"], payload.To)
	}
	if m["amount"] != payload.Amount {
		t.Errorf("ToMap()[amount] = %v, want %v", m["amount"], payload.Amount)
	}
	if m["contractAddress"] != payload.ContractAddress {
		t.Errorf("ToMap()[contractAddress] = %v, want %v", m["contractAddress"], payload.ContractAddress)
	}
}

func TestPayloadRoundTrip(t *testing.T) {
	original := &ExactDirectPayload{
		TxId:            "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		From:            "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
		To:              "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
		Amount:          "999999",
		ContractAddress: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
	}

	m := original.ToMap()
	restored, err := PayloadFromMap(m)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if restored.TxId != original.TxId {
		t.Errorf("TxId mismatch: got %v, want %v", restored.TxId, original.TxId)
	}
	if restored.From != original.From {
		t.Errorf("From mismatch: got %v, want %v", restored.From, original.From)
	}
	if restored.To != original.To {
		t.Errorf("To mismatch: got %v, want %v", restored.To, original.To)
	}
	if restored.Amount != original.Amount {
		t.Errorf("Amount mismatch: got %v, want %v", restored.Amount, original.Amount)
	}
	if restored.ContractAddress != original.ContractAddress {
		t.Errorf("ContractAddress mismatch: got %v, want %v", restored.ContractAddress, original.ContractAddress)
	}
}

func TestExtractTransfer(t *testing.T) {
	tests := []struct {
		name       string
		result     *StacksTransactionResult
		wantNil    bool
		wantFrom   string
		wantTo     string
		wantAmount string
	}{
		{
			name:    "nil result",
			result:  nil,
			wantNil: true,
		},
		{
			name: "pending transaction",
			result: &StacksTransactionResult{
				TxStatus: "pending",
				TxType:   "contract_call",
			},
			wantNil: true,
		},
		{
			name: "aborted transaction",
			result: &StacksTransactionResult{
				TxStatus: "abort_by_response",
				TxType:   "contract_call",
			},
			wantNil: true,
		},
		{
			name: "non-contract-call transaction",
			result: &StacksTransactionResult{
				TxStatus: "success",
				TxType:   "token_transfer",
			},
			wantNil: true,
		},
		{
			name: "nil contract call",
			result: &StacksTransactionResult{
				TxStatus:     "success",
				TxType:       "contract_call",
				ContractCall: nil,
			},
			wantNil: true,
		},
		{
			name: "non-transfer function",
			result: &StacksTransactionResult{
				TxStatus: "success",
				TxType:   "contract_call",
				ContractCall: &ContractCallInfo{
					ContractID:   "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
					FunctionName: "mint",
				},
			},
			wantNil: true,
		},
		{
			name: "successful transfer",
			result: &StacksTransactionResult{
				TxStatus:      "success",
				TxType:        "contract_call",
				SenderAddress: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
				ContractCall: &ContractCallInfo{
					ContractID:   "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
					FunctionName: "transfer",
					FunctionArgs: []FunctionArg{
						{Name: "amount", Type: "uint", Repr: "u1000000"},
						{Name: "recipient", Type: "principal", Repr: "'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7"},
					},
				},
			},
			wantNil:    false,
			wantFrom:   "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
			wantTo:     "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
			wantAmount: "1000000",
		},
		{
			name: "transfer with 'to' arg name",
			result: &StacksTransactionResult{
				TxStatus:      "success",
				TxType:        "contract_call",
				SenderAddress: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
				ContractCall: &ContractCallInfo{
					ContractID:   "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
					FunctionName: "transfer",
					FunctionArgs: []FunctionArg{
						{Name: "amount", Type: "uint", Repr: "u5000000"},
						{Name: "to", Type: "principal", Repr: "'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7"},
					},
				},
			},
			wantNil:    false,
			wantFrom:   "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
			wantTo:     "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
			wantAmount: "5000000",
		},
		{
			name: "transfer missing amount",
			result: &StacksTransactionResult{
				TxStatus:      "success",
				TxType:        "contract_call",
				SenderAddress: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
				ContractCall: &ContractCallInfo{
					ContractID:   "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
					FunctionName: "transfer",
					FunctionArgs: []FunctionArg{
						{Name: "recipient", Type: "principal", Repr: "'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7"},
					},
				},
			},
			wantNil: true,
		},
		{
			name: "transfer missing recipient",
			result: &StacksTransactionResult{
				TxStatus:      "success",
				TxType:        "contract_call",
				SenderAddress: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
				ContractCall: &ContractCallInfo{
					ContractID:   "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
					FunctionName: "transfer",
					FunctionArgs: []FunctionArg{
						{Name: "amount", Type: "uint", Repr: "u1000000"},
					},
				},
			},
			wantNil: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			transfer := ExtractTransfer(tt.result)
			if tt.wantNil {
				if transfer != nil {
					t.Errorf("ExtractTransfer() = %v, want nil", transfer)
				}
				return
			}
			if transfer == nil {
				t.Fatal("ExtractTransfer() = nil, want non-nil")
			}
			if transfer.From != tt.wantFrom {
				t.Errorf("From = %v, want %v", transfer.From, tt.wantFrom)
			}
			if transfer.To != tt.wantTo {
				t.Errorf("To = %v, want %v", transfer.To, tt.wantTo)
			}
			if transfer.Amount != tt.wantAmount {
				t.Errorf("Amount = %v, want %v", transfer.Amount, tt.wantAmount)
			}
			if !transfer.Success {
				t.Error("Success should be true")
			}
		})
	}
}

func TestExtractUintFromRepr(t *testing.T) {
	tests := []struct {
		repr string
		want string
	}{
		{"u1000000", "1000000"},
		{"u0", "0"},
		{"u999999999999999999", "999999999999999999"},
		{"1000000", "1000000"},
		{"", ""},
	}

	for _, tt := range tests {
		got := extractUintFromRepr(tt.repr)
		if got != tt.want {
			t.Errorf("extractUintFromRepr(%v) = %v, want %v", tt.repr, got, tt.want)
		}
	}
}

func TestExtractPrincipalFromRepr(t *testing.T) {
	tests := []struct {
		repr string
		want string
	}{
		{"'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K", "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K"},
		{"'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"},
		{"SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K", "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K"},
		{"", ""},
	}

	for _, tt := range tests {
		got := extractPrincipalFromRepr(tt.repr)
		if got != tt.want {
			t.Errorf("extractPrincipalFromRepr(%v) = %v, want %v", tt.repr, got, tt.want)
		}
	}
}
