package ton

import (
	"encoding/json"
	"testing"
)

func TestExactTonPayloadToMap(t *testing.T) {
	payload := &ExactTonPayload{
		SignedBoc: "dGVzdCBib2MgZGF0YQ==",
		Authorization: ExactTonAuthorization{
			From:         "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
			To:           "EQBqSpvo4S87mX9tTc4FX3Sfqf4uSp3Tx-Fz4RBUfTRWBx",
			JettonMaster: USDTMainnetAddress,
			JettonAmount: "1000000",
			TonAmount:    "100000000",
			ValidUntil:   1704067200,
			Seqno:        42,
			QueryId:      "1704067200000042",
		},
	}

	m := payload.ToMap()

	if m["signedBoc"] != payload.SignedBoc {
		t.Errorf("ToMap() signedBoc = %v, want %v", m["signedBoc"], payload.SignedBoc)
	}

	auth, ok := m["authorization"].(map[string]interface{})
	if !ok {
		t.Fatal("ToMap() authorization is not a map")
	}

	if auth["from"] != payload.Authorization.From {
		t.Errorf("ToMap() from = %v, want %v", auth["from"], payload.Authorization.From)
	}

	if auth["to"] != payload.Authorization.To {
		t.Errorf("ToMap() to = %v, want %v", auth["to"], payload.Authorization.To)
	}

	if auth["jettonMaster"] != payload.Authorization.JettonMaster {
		t.Errorf("ToMap() jettonMaster = %v, want %v", auth["jettonMaster"], payload.Authorization.JettonMaster)
	}

	if auth["jettonAmount"] != payload.Authorization.JettonAmount {
		t.Errorf("ToMap() jettonAmount = %v, want %v", auth["jettonAmount"], payload.Authorization.JettonAmount)
	}
}

func TestPayloadFromMap(t *testing.T) {
	tests := []struct {
		name        string
		data        map[string]interface{}
		expectError bool
	}{
		{
			name: "valid payload",
			data: map[string]interface{}{
				"signedBoc": "dGVzdCBib2MgZGF0YQ==",
				"authorization": map[string]interface{}{
					"from":         "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
					"to":           "EQBqSpvo4S87mX9tTc4FX3Sfqf4uSp3Tx-Fz4RBUfTRWBx",
					"jettonMaster": USDTMainnetAddress,
					"jettonAmount": "1000000",
					"tonAmount":    "100000000",
					"validUntil":   float64(1704067200),
					"seqno":        float64(42),
					"queryId":      "1704067200000042",
				},
			},
			expectError: false,
		},
		{
			name: "missing signedBoc",
			data: map[string]interface{}{
				"authorization": map[string]interface{}{
					"from": "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
				},
			},
			expectError: true,
		},
		{
			name: "missing authorization.from",
			data: map[string]interface{}{
				"signedBoc": "dGVzdCBib2MgZGF0YQ==",
				"authorization": map[string]interface{}{
					"to": "EQBqSpvo4S87mX9tTc4FX3Sfqf4uSp3Tx-Fz4RBUfTRWBx",
				},
			},
			expectError: true,
		},
		{
			name:        "empty map",
			data:        map[string]interface{}{},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload, err := PayloadFromMap(tt.data)
			if tt.expectError {
				if err == nil {
					t.Errorf("PayloadFromMap() expected error, got nil")
				}
			} else {
				if err != nil {
					t.Errorf("PayloadFromMap() unexpected error: %v", err)
				}
				if payload == nil {
					t.Errorf("PayloadFromMap() returned nil payload")
				}
			}
		})
	}
}

func TestPayloadRoundTrip(t *testing.T) {
	original := &ExactTonPayload{
		SignedBoc: "dGVzdCBib2MgZGF0YQ==",
		Authorization: ExactTonAuthorization{
			From:         "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
			To:           "EQBqSpvo4S87mX9tTc4FX3Sfqf4uSp3Tx-Fz4RBUfTRWBx",
			JettonMaster: USDTMainnetAddress,
			JettonAmount: "1000000",
			TonAmount:    "100000000",
			ValidUntil:   1704067200,
			Seqno:        42,
			QueryId:      "1704067200000042",
		},
	}

	// Convert to map
	m := original.ToMap()

	// Convert back to payload
	recovered, err := PayloadFromMap(m)
	if err != nil {
		t.Fatalf("PayloadFromMap() error: %v", err)
	}

	// Verify fields match
	if recovered.SignedBoc != original.SignedBoc {
		t.Errorf("Round trip SignedBoc = %v, want %v", recovered.SignedBoc, original.SignedBoc)
	}
	if recovered.Authorization.From != original.Authorization.From {
		t.Errorf("Round trip From = %v, want %v", recovered.Authorization.From, original.Authorization.From)
	}
	if recovered.Authorization.To != original.Authorization.To {
		t.Errorf("Round trip To = %v, want %v", recovered.Authorization.To, original.Authorization.To)
	}
	if recovered.Authorization.JettonMaster != original.Authorization.JettonMaster {
		t.Errorf("Round trip JettonMaster = %v, want %v", recovered.Authorization.JettonMaster, original.Authorization.JettonMaster)
	}
	if recovered.Authorization.JettonAmount != original.Authorization.JettonAmount {
		t.Errorf("Round trip JettonAmount = %v, want %v", recovered.Authorization.JettonAmount, original.Authorization.JettonAmount)
	}
}

func TestExactTonPayloadJSONSerialization(t *testing.T) {
	payload := &ExactTonPayload{
		SignedBoc: "dGVzdCBib2MgZGF0YQ==",
		Authorization: ExactTonAuthorization{
			From:         "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
			To:           "EQBqSpvo4S87mX9tTc4FX3Sfqf4uSp3Tx-Fz4RBUfTRWBx",
			JettonMaster: USDTMainnetAddress,
			JettonAmount: "1000000",
			TonAmount:    "100000000",
			ValidUntil:   1704067200,
			Seqno:        42,
			QueryId:      "1704067200000042",
		},
	}

	// Marshal to JSON
	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("json.Marshal() error: %v", err)
	}

	// Unmarshal back
	var recovered ExactTonPayload
	if err := json.Unmarshal(jsonBytes, &recovered); err != nil {
		t.Fatalf("json.Unmarshal() error: %v", err)
	}

	// Verify fields match
	if recovered.SignedBoc != payload.SignedBoc {
		t.Errorf("JSON round trip SignedBoc = %v, want %v", recovered.SignedBoc, payload.SignedBoc)
	}
	if recovered.Authorization.From != payload.Authorization.From {
		t.Errorf("JSON round trip From = %v, want %v", recovered.Authorization.From, payload.Authorization.From)
	}
	if recovered.Authorization.ValidUntil != payload.Authorization.ValidUntil {
		t.Errorf("JSON round trip ValidUntil = %v, want %v", recovered.Authorization.ValidUntil, payload.Authorization.ValidUntil)
	}
	if recovered.Authorization.Seqno != payload.Authorization.Seqno {
		t.Errorf("JSON round trip Seqno = %v, want %v", recovered.Authorization.Seqno, payload.Authorization.Seqno)
	}
}

func TestVerifyMessageResult(t *testing.T) {
	result := &VerifyMessageResult{
		Valid:  true,
		Reason: "",
		Transfer: &TransferInfo{
			From:         "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
			To:           "EQBqSpvo4S87mX9tTc4FX3Sfqf4uSp3Tx-Fz4RBUfTRWBx",
			JettonAmount: "1000000",
			QueryId:      "1704067200000042",
		},
	}

	// Marshal to JSON
	jsonBytes, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("json.Marshal() error: %v", err)
	}

	// Unmarshal back
	var recovered VerifyMessageResult
	if err := json.Unmarshal(jsonBytes, &recovered); err != nil {
		t.Fatalf("json.Unmarshal() error: %v", err)
	}

	if recovered.Valid != result.Valid {
		t.Errorf("JSON round trip Valid = %v, want %v", recovered.Valid, result.Valid)
	}
	if recovered.Transfer == nil {
		t.Fatal("JSON round trip Transfer is nil")
	}
	if recovered.Transfer.From != result.Transfer.From {
		t.Errorf("JSON round trip Transfer.From = %v, want %v", recovered.Transfer.From, result.Transfer.From)
	}
}

func TestTransactionConfirmation(t *testing.T) {
	confirmation := &TransactionConfirmation{
		Success: true,
		Lt:      "12345678901234",
		Hash:    "abc123def456",
	}

	// Marshal to JSON
	jsonBytes, err := json.Marshal(confirmation)
	if err != nil {
		t.Fatalf("json.Marshal() error: %v", err)
	}

	// Unmarshal back
	var recovered TransactionConfirmation
	if err := json.Unmarshal(jsonBytes, &recovered); err != nil {
		t.Fatalf("json.Unmarshal() error: %v", err)
	}

	if recovered.Success != confirmation.Success {
		t.Errorf("JSON round trip Success = %v, want %v", recovered.Success, confirmation.Success)
	}
	if recovered.Lt != confirmation.Lt {
		t.Errorf("JSON round trip Lt = %v, want %v", recovered.Lt, confirmation.Lt)
	}
	if recovered.Hash != confirmation.Hash {
		t.Errorf("JSON round trip Hash = %v, want %v", recovered.Hash, confirmation.Hash)
	}
}
