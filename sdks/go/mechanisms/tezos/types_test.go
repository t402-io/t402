package tezos

import (
	"encoding/json"
	"testing"
)

func TestExactDirectPayloadToMap(t *testing.T) {
	payload := &ExactDirectPayload{
		OpHash:          "oo7TSyLzXuiMxZjGp5Z4P4VBUXuc6MNr8PhJNcLX8yY1jyMhMNH",
		From:            "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
		To:              "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
		Amount:          "1000000",
		ContractAddress: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
		TokenID:         0,
	}

	m := payload.ToMap()

	if m["opHash"] != payload.OpHash {
		t.Errorf("ToMap() opHash = %v, want %v", m["opHash"], payload.OpHash)
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
	if m["contractAddress"] != payload.ContractAddress {
		t.Errorf("ToMap() contractAddress = %v, want %v", m["contractAddress"], payload.ContractAddress)
	}
	if m["tokenId"] != payload.TokenID {
		t.Errorf("ToMap() tokenId = %v, want %v", m["tokenId"], payload.TokenID)
	}
}

func TestPayloadFromMap(t *testing.T) {
	tests := []struct {
		name string
		data map[string]interface{}
		want ExactDirectPayload
	}{
		{
			name: "valid payload with float64 tokenId",
			data: map[string]interface{}{
				"opHash":          "oo7TSyLzXuiMxZjGp5Z4P4VBUXuc6MNr8PhJNcLX8yY1jyMhMNH",
				"from":            "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
				"to":              "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
				"amount":          "1000000",
				"contractAddress": "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
				"tokenId":         float64(0),
			},
			want: ExactDirectPayload{
				OpHash:          "oo7TSyLzXuiMxZjGp5Z4P4VBUXuc6MNr8PhJNcLX8yY1jyMhMNH",
				From:            "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
				To:              "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
				Amount:          "1000000",
				ContractAddress: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
				TokenID:         0,
			},
		},
		{
			name: "valid payload with int tokenId",
			data: map[string]interface{}{
				"opHash":          "oo7TSyLzXuiMxZjGp5Z4P4VBUXuc6MNr8PhJNcLX8yY1jyMhMNH",
				"from":            "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
				"to":              "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
				"amount":          "2000000",
				"contractAddress": "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
				"tokenId":         5,
			},
			want: ExactDirectPayload{
				OpHash:          "oo7TSyLzXuiMxZjGp5Z4P4VBUXuc6MNr8PhJNcLX8yY1jyMhMNH",
				From:            "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
				To:              "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
				Amount:          "2000000",
				ContractAddress: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
				TokenID:         5,
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
			if payload.OpHash != tt.want.OpHash {
				t.Errorf("PayloadFromMap().OpHash = %v, want %v", payload.OpHash, tt.want.OpHash)
			}
			if payload.From != tt.want.From {
				t.Errorf("PayloadFromMap().From = %v, want %v", payload.From, tt.want.From)
			}
			if payload.TokenID != tt.want.TokenID {
				t.Errorf("PayloadFromMap().TokenID = %v, want %v", payload.TokenID, tt.want.TokenID)
			}
		})
	}
}

func TestPayloadRoundTrip(t *testing.T) {
	original := &ExactDirectPayload{
		OpHash:          "oo7TSyLzXuiMxZjGp5Z4P4VBUXuc6MNr8PhJNcLX8yY1jyMhMNH",
		From:            "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
		To:              "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
		Amount:          "1000000",
		ContractAddress: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
		TokenID:         0,
	}

	// Convert to map
	m := original.ToMap()

	// Convert back to payload
	recovered, err := PayloadFromMap(m)
	if err != nil {
		t.Fatalf("PayloadFromMap() error: %v", err)
	}

	// Verify fields match
	if recovered.OpHash != original.OpHash {
		t.Errorf("Round trip OpHash = %v, want %v", recovered.OpHash, original.OpHash)
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
	if recovered.ContractAddress != original.ContractAddress {
		t.Errorf("Round trip ContractAddress = %v, want %v", recovered.ContractAddress, original.ContractAddress)
	}
	if recovered.TokenID != original.TokenID {
		t.Errorf("Round trip TokenID = %v, want %v", recovered.TokenID, original.TokenID)
	}
}

func TestExactDirectPayloadJSONSerialization(t *testing.T) {
	payload := &ExactDirectPayload{
		OpHash:          "oo7TSyLzXuiMxZjGp5Z4P4VBUXuc6MNr8PhJNcLX8yY1jyMhMNH",
		From:            "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
		To:              "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
		Amount:          "1000000",
		ContractAddress: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
		TokenID:         0,
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
	if recovered.OpHash != payload.OpHash {
		t.Errorf("JSON round trip OpHash = %v, want %v", recovered.OpHash, payload.OpHash)
	}
	if recovered.From != payload.From {
		t.Errorf("JSON round trip From = %v, want %v", recovered.From, payload.From)
	}
	if recovered.TokenID != payload.TokenID {
		t.Errorf("JSON round trip TokenID = %v, want %v", recovered.TokenID, payload.TokenID)
	}
}

func TestIsValidAddress(t *testing.T) {
	tests := []struct {
		name    string
		address string
		want    bool
	}{
		{
			name:    "valid tz1 address",
			address: "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
			want:    true,
		},
		{
			name:    "valid tz2 address",
			address: "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
			want:    true,
		},
		{
			name:    "valid tz3 address",
			address: "tz3WXYtyDUNL91qfiCJtVUX746QpNv5i5ve5",
			want:    true,
		},
		{
			name:    "valid KT1 contract address",
			address: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
			want:    true,
		},
		{
			name:    "empty address",
			address: "",
			want:    false,
		},
		{
			name:    "too short address",
			address: "tz1Short",
			want:    false,
		},
		{
			name:    "too long address",
			address: "tz1TooLongAddressThatExceeds36Characters12",
			want:    false,
		},
		{
			name:    "invalid prefix tz4",
			address: "tz4InvalidPrefixAddress12345678901234",
			want:    false,
		},
		{
			name:    "invalid prefix KT2",
			address: "KT2InvalidPrefixAddress12345678901234",
			want:    false,
		},
		{
			name:    "Ethereum-style address",
			address: "0x1234567890123456789012345678901234567890",
			want:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsValidAddress(tt.address)
			if got != tt.want {
				t.Errorf("IsValidAddress(%v) = %v, want %v", tt.address, got, tt.want)
			}
		})
	}
}

func TestIsValidOperationHash(t *testing.T) {
	tests := []struct {
		name   string
		opHash string
		want   bool
	}{
		{
			name:   "valid operation hash",
			opHash: "oo7TSyLzXuiMxZjGp5Z4P4VBUXuc6MNr8PhJNcLX8yY1jyMhMNH",
			want:   true,
		},
		{
			name:   "empty hash",
			opHash: "",
			want:   false,
		},
		{
			name:   "wrong prefix",
			opHash: "xo7TSyLzXuiMxZjGp5Z4P4VBUXuc6MNr8PhJNcLX8yY1jyMhMNH",
			want:   false,
		},
		{
			name:   "too short",
			opHash: "oshort",
			want:   false,
		},
		{
			name:   "too long",
			opHash: "oo7TSyLzXuiMxZjGp5Z4P4VBUXuc6MNr8PhJNcLX8yY1jyMhMNHaaa",
			want:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsValidOperationHash(tt.opHash)
			if got != tt.want {
				t.Errorf("IsValidOperationHash(%v) = %v, want %v", tt.opHash, got, tt.want)
			}
		})
	}
}

func TestCompareAddresses(t *testing.T) {
	tests := []struct {
		name  string
		addr1 string
		addr2 string
		want  bool
	}{
		{
			name:  "identical tz1 addresses",
			addr1: "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
			addr2: "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
			want:  true,
		},
		{
			name:  "identical KT1 addresses",
			addr1: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
			addr2: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
			want:  true,
		},
		{
			name:  "different addresses",
			addr1: "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
			addr2: "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
			want:  false,
		},
		{
			name:  "empty addresses",
			addr1: "",
			addr2: "",
			want:  true,
		},
		{
			name:  "one empty address",
			addr1: "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
			addr2: "",
			want:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CompareAddresses(tt.addr1, tt.addr2)
			if got != tt.want {
				t.Errorf("CompareAddresses(%v, %v) = %v, want %v", tt.addr1, tt.addr2, got, tt.want)
			}
		})
	}
}

func TestFormatAmount(t *testing.T) {
	tests := []struct {
		name     string
		amount   string
		decimals int
		want     string
	}{
		{
			name:     "whole amount",
			amount:   "1000000",
			decimals: 6,
			want:     "1.000000",
		},
		{
			name:     "decimal amount",
			amount:   "1500000",
			decimals: 6,
			want:     "1.500000",
		},
		{
			name:     "small amount",
			amount:   "1",
			decimals: 6,
			want:     "0.000001",
		},
		{
			name:     "zero",
			amount:   "0",
			decimals: 6,
			want:     "0.0",
		},
		{
			name:     "large amount",
			amount:   "100000000",
			decimals: 6,
			want:     "100.000000",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := FormatAmount(tt.amount, tt.decimals)
			if got != tt.want {
				t.Errorf("FormatAmount(%v, %v) = %v, want %v", tt.amount, tt.decimals, got, tt.want)
			}
		})
	}
}

func TestOperationResultJSONSerialization(t *testing.T) {
	result := &OperationResult{
		Hash:       "oo7TSyLzXuiMxZjGp5Z4P4VBUXuc6MNr8PhJNcLX8yY1jyMhMNH",
		Level:      12345,
		Timestamp:  "2024-01-01T00:00:00Z",
		Status:     "applied",
		Entrypoint: "transfer",
		Sender: &OperationActor{
			Address: "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
		},
		Target: &OperationActor{
			Address: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
		},
	}

	// Marshal to JSON
	jsonBytes, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("json.Marshal() error: %v", err)
	}

	// Unmarshal back
	var recovered OperationResult
	if err := json.Unmarshal(jsonBytes, &recovered); err != nil {
		t.Fatalf("json.Unmarshal() error: %v", err)
	}

	if recovered.Hash != result.Hash {
		t.Errorf("JSON round trip Hash = %v, want %v", recovered.Hash, result.Hash)
	}
	if recovered.Level != result.Level {
		t.Errorf("JSON round trip Level = %v, want %v", recovered.Level, result.Level)
	}
	if recovered.Status != result.Status {
		t.Errorf("JSON round trip Status = %v, want %v", recovered.Status, result.Status)
	}
	if recovered.Sender == nil || recovered.Sender.Address != result.Sender.Address {
		t.Errorf("JSON round trip Sender.Address mismatch")
	}
}

func TestExtractTransferDetails(t *testing.T) {
	tests := []struct {
		name   string
		op     *OperationResult
		want   *ParsedFA2Transfer
		wantOK bool
	}{
		{
			name:   "nil operation",
			op:     nil,
			want:   nil,
			wantOK: false,
		},
		{
			name: "failed operation",
			op: &OperationResult{
				Status:     "failed",
				Entrypoint: "transfer",
			},
			want:   nil,
			wantOK: false,
		},
		{
			name: "wrong entrypoint",
			op: &OperationResult{
				Status:     "applied",
				Entrypoint: "approve",
			},
			want:   nil,
			wantOK: false,
		},
		{
			name: "missing target",
			op: &OperationResult{
				Status:     "applied",
				Entrypoint: "transfer",
				Target:     nil,
			},
			want:   nil,
			wantOK: false,
		},
		{
			name: "valid transfer with array parameter",
			op: &OperationResult{
				Status:     "applied",
				Entrypoint: "transfer",
				Target: &OperationActor{
					Address: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
				},
				Parameter: json.RawMessage(`[{"from_":"tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb","txs":[{"to_":"tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m","token_id":0,"amount":"1000000"}]}]`),
			},
			want: &ParsedFA2Transfer{
				From:            "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
				To:              "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
				Amount:          "1000000",
				ContractAddress: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
				TokenID:         0,
			},
			wantOK: true,
		},
		{
			name: "valid transfer with single object parameter",
			op: &OperationResult{
				Status:     "applied",
				Entrypoint: "transfer",
				Target: &OperationActor{
					Address: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
				},
				Parameter: json.RawMessage(`{"from_":"tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb","txs":[{"to_":"tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m","token_id":0,"amount":"2000000"}]}`),
			},
			want: &ParsedFA2Transfer{
				From:            "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
				To:              "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
				Amount:          "2000000",
				ContractAddress: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
				TokenID:         0,
			},
			wantOK: true,
		},
		{
			name: "empty txs array",
			op: &OperationResult{
				Status:     "applied",
				Entrypoint: "transfer",
				Target: &OperationActor{
					Address: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
				},
				Parameter: json.RawMessage(`[{"from_":"tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb","txs":[]}]`),
			},
			want:   nil,
			wantOK: false,
		},
		{
			name: "invalid JSON parameter",
			op: &OperationResult{
				Status:     "applied",
				Entrypoint: "transfer",
				Target: &OperationActor{
					Address: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
				},
				Parameter: json.RawMessage(`invalid json`),
			},
			want:   nil,
			wantOK: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ExtractTransferDetails(tt.op)
			if tt.want == nil {
				if got != nil {
					t.Errorf("ExtractTransferDetails() = %+v, want nil", got)
				}
				return
			}
			if got == nil {
				t.Fatalf("ExtractTransferDetails() = nil, want %+v", tt.want)
			}
			if got.From != tt.want.From {
				t.Errorf("ExtractTransferDetails().From = %v, want %v", got.From, tt.want.From)
			}
			if got.To != tt.want.To {
				t.Errorf("ExtractTransferDetails().To = %v, want %v", got.To, tt.want.To)
			}
			if got.Amount != tt.want.Amount {
				t.Errorf("ExtractTransferDetails().Amount = %v, want %v", got.Amount, tt.want.Amount)
			}
			if got.ContractAddress != tt.want.ContractAddress {
				t.Errorf("ExtractTransferDetails().ContractAddress = %v, want %v", got.ContractAddress, tt.want.ContractAddress)
			}
			if got.TokenID != tt.want.TokenID {
				t.Errorf("ExtractTransferDetails().TokenID = %v, want %v", got.TokenID, tt.want.TokenID)
			}
		})
	}
}

func TestFA2TransferParamJSONSerialization(t *testing.T) {
	param := FA2TransferParam{
		From: "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
		Txs: []FA2TransferTx{
			{
				To:      "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
				TokenID: 0,
				Amount:  "1000000",
			},
		},
	}

	// Marshal to JSON
	jsonBytes, err := json.Marshal(param)
	if err != nil {
		t.Fatalf("json.Marshal() error: %v", err)
	}

	// Unmarshal back
	var recovered FA2TransferParam
	if err := json.Unmarshal(jsonBytes, &recovered); err != nil {
		t.Fatalf("json.Unmarshal() error: %v", err)
	}

	if recovered.From != param.From {
		t.Errorf("JSON round trip From = %v, want %v", recovered.From, param.From)
	}
	if len(recovered.Txs) != len(param.Txs) {
		t.Fatalf("JSON round trip Txs length = %v, want %v", len(recovered.Txs), len(param.Txs))
	}
	if recovered.Txs[0].To != param.Txs[0].To {
		t.Errorf("JSON round trip Txs[0].To = %v, want %v", recovered.Txs[0].To, param.Txs[0].To)
	}
	if recovered.Txs[0].Amount != param.Txs[0].Amount {
		t.Errorf("JSON round trip Txs[0].Amount = %v, want %v", recovered.Txs[0].Amount, param.Txs[0].Amount)
	}
}

func TestParsedFA2TransferStruct(t *testing.T) {
	transfer := &ParsedFA2Transfer{
		From:            "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb",
		To:              "tz2TSvNTh2epDMhZHrw73nV9piBX7kLZ9K9m",
		Amount:          "1000000",
		ContractAddress: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
		TokenID:         0,
	}

	// Marshal to JSON
	jsonBytes, err := json.Marshal(transfer)
	if err != nil {
		t.Fatalf("json.Marshal() error: %v", err)
	}

	// Unmarshal back
	var recovered ParsedFA2Transfer
	if err := json.Unmarshal(jsonBytes, &recovered); err != nil {
		t.Fatalf("json.Unmarshal() error: %v", err)
	}

	if recovered.From != transfer.From {
		t.Errorf("JSON round trip From = %v, want %v", recovered.From, transfer.From)
	}
	if recovered.ContractAddress != transfer.ContractAddress {
		t.Errorf("JSON round trip ContractAddress = %v, want %v", recovered.ContractAddress, transfer.ContractAddress)
	}
}
