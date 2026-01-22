package aptos

import (
	"encoding/json"
	"testing"
)

func TestExactDirectPayloadToMap(t *testing.T) {
	payload := &ExactDirectPayload{
		TxHash:          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
		From:            "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
		To:              "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
		Amount:          "1000000",
		MetadataAddress: "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
		Version:         "12345",
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
	if m["metadataAddress"] != payload.MetadataAddress {
		t.Errorf("ToMap() metadataAddress = %v, want %v", m["metadataAddress"], payload.MetadataAddress)
	}
	if m["version"] != payload.Version {
		t.Errorf("ToMap() version = %v, want %v", m["version"], payload.Version)
	}
}

func TestExactDirectPayloadToMapWithoutVersion(t *testing.T) {
	payload := &ExactDirectPayload{
		TxHash:          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
		From:            "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
		To:              "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
		Amount:          "1000000",
		MetadataAddress: "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
		Version:         "",
	}

	m := payload.ToMap()

	if _, ok := m["version"]; ok {
		t.Error("ToMap() should not include version when empty")
	}
}

func TestPayloadFromMap(t *testing.T) {
	tests := []struct {
		name string
		data map[string]interface{}
		want ExactDirectPayload
	}{
		{
			name: "valid payload with version",
			data: map[string]interface{}{
				"txHash":          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
				"from":            "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
				"to":              "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
				"amount":          "1000000",
				"metadataAddress": "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
				"version":         "12345",
			},
			want: ExactDirectPayload{
				TxHash:          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
				From:            "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
				To:              "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
				Amount:          "1000000",
				MetadataAddress: "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
				Version:         "12345",
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
			if payload.MetadataAddress != tt.want.MetadataAddress {
				t.Errorf("PayloadFromMap().MetadataAddress = %v, want %v", payload.MetadataAddress, tt.want.MetadataAddress)
			}
			if payload.Version != tt.want.Version {
				t.Errorf("PayloadFromMap().Version = %v, want %v", payload.Version, tt.want.Version)
			}
		})
	}
}

func TestPayloadRoundTrip(t *testing.T) {
	original := &ExactDirectPayload{
		TxHash:          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
		From:            "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
		To:              "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
		Amount:          "1000000",
		MetadataAddress: "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
		Version:         "12345",
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
	if recovered.MetadataAddress != original.MetadataAddress {
		t.Errorf("Round trip MetadataAddress = %v, want %v", recovered.MetadataAddress, original.MetadataAddress)
	}
}

func TestExactDirectPayloadJSONSerialization(t *testing.T) {
	payload := &ExactDirectPayload{
		TxHash:          "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
		From:            "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
		To:              "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
		Amount:          "1000000",
		MetadataAddress: "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
		Version:         "12345",
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
	if recovered.Version != payload.Version {
		t.Errorf("JSON round trip Version = %v, want %v", recovered.Version, payload.Version)
	}
}

func TestIsValidAddress(t *testing.T) {
	tests := []struct {
		name    string
		address string
		want    bool
	}{
		{
			name:    "valid full address",
			address: "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
			want:    true,
		},
		{
			name:    "valid short address",
			address: "0x1",
			want:    true,
		},
		{
			name:    "valid uppercase address",
			address: "0xF73E887A8754F540EE6E1A93BDC6DDE2AF69FC7CA5DE32013E89DD44244473CB",
			want:    true,
		},
		{
			name:    "empty address",
			address: "",
			want:    false,
		},
		{
			name:    "missing 0x prefix",
			address: "f73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
			want:    false,
		},
		{
			name:    "only 0x prefix",
			address: "0x",
			want:    false,
		},
		{
			name:    "too long address",
			address: "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb00",
			want:    false,
		},
		{
			name:    "invalid characters",
			address: "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473gg",
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

func TestIsValidTxHash(t *testing.T) {
	tests := []struct {
		name   string
		txHash string
		want   bool
	}{
		{
			name:   "valid tx hash",
			txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			want:   true,
		},
		{
			name:   "valid uppercase tx hash",
			txHash: "0xABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890",
			want:   true,
		},
		{
			name:   "empty hash",
			txHash: "",
			want:   false,
		},
		{
			name:   "missing 0x prefix",
			txHash: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			want:   false,
		},
		{
			name:   "too short",
			txHash: "0x1234",
			want:   false,
		},
		{
			name:   "too long",
			txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef00",
			want:   false,
		},
		{
			name:   "invalid characters",
			txHash: "0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ",
			want:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsValidTxHash(tt.txHash)
			if got != tt.want {
				t.Errorf("IsValidTxHash(%v) = %v, want %v", tt.txHash, got, tt.want)
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
			name:  "identical addresses",
			addr1: "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
			addr2: "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
			want:  true,
		},
		{
			name:  "case insensitive match",
			addr1: "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
			addr2: "0xF73E887A8754F540EE6E1A93BDC6DDE2AF69FC7CA5DE32013E89DD44244473CB",
			want:  true,
		},
		{
			name:  "different addresses",
			addr1: "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
			addr2: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
			want:  false,
		},
		{
			name:  "empty addresses",
			addr1: "",
			addr2: "",
			want:  true,
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

func TestExtractTransferDetails(t *testing.T) {
	tests := []struct {
		name   string
		tx     *TransactionResult
		want   *ParsedFATransfer
		wantOK bool
	}{
		{
			name:   "nil transaction",
			tx:     nil,
			want:   nil,
			wantOK: false,
		},
		{
			name: "failed transaction",
			tx: &TransactionResult{
				Success: false,
				Payload: &TransactionPayload{
					Type:     "entry_function_payload",
					Function: FATransferFunction,
				},
			},
			want:   nil,
			wantOK: false,
		},
		{
			name: "wrong payload type",
			tx: &TransactionResult{
				Success: true,
				Payload: &TransactionPayload{
					Type: "script_payload",
				},
			},
			want:   nil,
			wantOK: false,
		},
		{
			name: "wrong function",
			tx: &TransactionResult{
				Success: true,
				Payload: &TransactionPayload{
					Type:     "entry_function_payload",
					Function: "0x1::coin::transfer",
				},
			},
			want:   nil,
			wantOK: false,
		},
		{
			name: "valid FA transfer",
			tx: &TransactionResult{
				Success: true,
				Sender:  "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
				Payload: &TransactionPayload{
					Type:     "entry_function_payload",
					Function: "0x1::primary_fungible_store::transfer",
					Arguments: []interface{}{
						"0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
						"0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
						"1000000",
					},
				},
			},
			want: &ParsedFATransfer{
				From:            "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
				To:              "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
				Amount:          "1000000",
				MetadataAddress: "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
			},
			wantOK: true,
		},
		{
			name: "insufficient arguments",
			tx: &TransactionResult{
				Success: true,
				Payload: &TransactionPayload{
					Type:      "entry_function_payload",
					Function:  "0x1::primary_fungible_store::transfer",
					Arguments: []interface{}{"0x1"},
				},
			},
			want:   nil,
			wantOK: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ExtractTransferDetails(tt.tx)
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
			if got.MetadataAddress != tt.want.MetadataAddress {
				t.Errorf("ExtractTransferDetails().MetadataAddress = %v, want %v", got.MetadataAddress, tt.want.MetadataAddress)
			}
		})
	}
}

func TestTransactionResultJSONSerialization(t *testing.T) {
	result := &TransactionResult{
		Hash:           "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
		Version:        "12345",
		Success:        true,
		VMStatus:       "Executed successfully",
		Sender:         "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
		SequenceNumber: "0",
		GasUsed:        "100",
		Timestamp:      "1704067200000000",
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

	if recovered.Hash != result.Hash {
		t.Errorf("JSON round trip Hash = %v, want %v", recovered.Hash, result.Hash)
	}
	if recovered.Success != result.Success {
		t.Errorf("JSON round trip Success = %v, want %v", recovered.Success, result.Success)
	}
	if recovered.Version != result.Version {
		t.Errorf("JSON round trip Version = %v, want %v", recovered.Version, result.Version)
	}
}

func TestParsedFATransferStruct(t *testing.T) {
	transfer := &ParsedFATransfer{
		From:            "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
		To:              "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b",
		Amount:          "1000000",
		MetadataAddress: "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
	}

	// Marshal to JSON
	jsonBytes, err := json.Marshal(transfer)
	if err != nil {
		t.Fatalf("json.Marshal() error: %v", err)
	}

	// Unmarshal back
	var recovered ParsedFATransfer
	if err := json.Unmarshal(jsonBytes, &recovered); err != nil {
		t.Fatalf("json.Unmarshal() error: %v", err)
	}

	if recovered.From != transfer.From {
		t.Errorf("JSON round trip From = %v, want %v", recovered.From, transfer.From)
	}
	if recovered.MetadataAddress != transfer.MetadataAddress {
		t.Errorf("JSON round trip MetadataAddress = %v, want %v", recovered.MetadataAddress, transfer.MetadataAddress)
	}
}
