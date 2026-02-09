package upto

import (
	"encoding/json"
	"testing"
)

func TestUptoTonPayloadToMap(t *testing.T) {
	payload := &UptoTonPayload{
		SignedBoc: "dGVzdCBib2MgZGF0YQ==",
		Authorization: UptoTonAuthorization{
			From:         "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
			Facilitator:  "EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe",
			JettonMaster: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
			MaxAmount:    "5000000",
			TonAmount:    "100000000",
			ValidUntil:   1704067200,
			Seqno:        42,
			QueryId:      "1704067200000042",
		},
		PaymentNonce: "0xabcdef1234567890abcdef1234567890",
	}

	m := payload.ToMap()

	if m["signedBoc"] != payload.SignedBoc {
		t.Errorf("ToMap() signedBoc = %v, want %v", m["signedBoc"], payload.SignedBoc)
	}

	if m["paymentNonce"] != payload.PaymentNonce {
		t.Errorf("ToMap() paymentNonce = %v, want %v", m["paymentNonce"], payload.PaymentNonce)
	}

	auth, ok := m["authorization"].(map[string]interface{})
	if !ok {
		t.Fatal("ToMap() authorization is not a map")
	}

	if auth["from"] != payload.Authorization.From {
		t.Errorf("ToMap() from = %v, want %v", auth["from"], payload.Authorization.From)
	}

	if auth["facilitator"] != payload.Authorization.Facilitator {
		t.Errorf("ToMap() facilitator = %v, want %v", auth["facilitator"], payload.Authorization.Facilitator)
	}

	if auth["jettonMaster"] != payload.Authorization.JettonMaster {
		t.Errorf("ToMap() jettonMaster = %v, want %v", auth["jettonMaster"], payload.Authorization.JettonMaster)
	}

	if auth["maxAmount"] != payload.Authorization.MaxAmount {
		t.Errorf("ToMap() maxAmount = %v, want %v", auth["maxAmount"], payload.Authorization.MaxAmount)
	}

	if auth["tonAmount"] != payload.Authorization.TonAmount {
		t.Errorf("ToMap() tonAmount = %v, want %v", auth["tonAmount"], payload.Authorization.TonAmount)
	}

	if auth["validUntil"] != payload.Authorization.ValidUntil {
		t.Errorf("ToMap() validUntil = %v, want %v", auth["validUntil"], payload.Authorization.ValidUntil)
	}

	if auth["seqno"] != payload.Authorization.Seqno {
		t.Errorf("ToMap() seqno = %v, want %v", auth["seqno"], payload.Authorization.Seqno)
	}

	if auth["queryId"] != payload.Authorization.QueryId {
		t.Errorf("ToMap() queryId = %v, want %v", auth["queryId"], payload.Authorization.QueryId)
	}
}

func TestUptoPayloadFromMap(t *testing.T) {
	tests := []struct {
		name        string
		data        map[string]interface{}
		expectError bool
		errContains string
	}{
		{
			name: "valid payload",
			data: map[string]interface{}{
				"signedBoc": "dGVzdCBib2MgZGF0YQ==",
				"authorization": map[string]interface{}{
					"from":         "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
					"facilitator":  "EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe",
					"jettonMaster": "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
					"maxAmount":    "5000000",
					"tonAmount":    "100000000",
					"validUntil":   float64(1704067200),
					"seqno":        float64(42),
					"queryId":      "1704067200000042",
				},
				"paymentNonce": "0xabcdef1234567890abcdef1234567890",
			},
			expectError: false,
		},
		{
			name: "missing signedBoc",
			data: map[string]interface{}{
				"authorization": map[string]interface{}{
					"from":        "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
					"facilitator": "EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe",
				},
				"paymentNonce": "0xabcdef1234567890abcdef1234567890",
			},
			expectError: true,
			errContains: "signedBoc",
		},
		{
			name: "missing authorization.from",
			data: map[string]interface{}{
				"signedBoc": "dGVzdCBib2MgZGF0YQ==",
				"authorization": map[string]interface{}{
					"facilitator": "EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe",
				},
				"paymentNonce": "0xabcdef1234567890abcdef1234567890",
			},
			expectError: true,
			errContains: "from",
		},
		{
			name: "missing authorization.facilitator",
			data: map[string]interface{}{
				"signedBoc": "dGVzdCBib2MgZGF0YQ==",
				"authorization": map[string]interface{}{
					"from": "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
				},
				"paymentNonce": "0xabcdef1234567890abcdef1234567890",
			},
			expectError: true,
			errContains: "facilitator",
		},
		{
			name: "missing paymentNonce",
			data: map[string]interface{}{
				"signedBoc": "dGVzdCBib2MgZGF0YQ==",
				"authorization": map[string]interface{}{
					"from":        "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
					"facilitator": "EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe",
				},
			},
			expectError: true,
			errContains: "paymentNonce",
		},
		{
			name:        "empty map",
			data:        map[string]interface{}{},
			expectError: true,
			errContains: "signedBoc",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload, err := UptoPayloadFromMap(tt.data)
			if tt.expectError {
				if err == nil {
					t.Errorf("UptoPayloadFromMap() expected error, got nil")
				} else if tt.errContains != "" && !containsStr(err.Error(), tt.errContains) {
					t.Errorf("UptoPayloadFromMap() error = %v, want error containing %q", err, tt.errContains)
				}
			} else {
				if err != nil {
					t.Errorf("UptoPayloadFromMap() unexpected error: %v", err)
				}
				if payload == nil {
					t.Errorf("UptoPayloadFromMap() returned nil payload")
				}
			}
		})
	}
}

func TestUptoPayloadRoundTrip(t *testing.T) {
	original := &UptoTonPayload{
		SignedBoc: "dGVzdCBib2MgZGF0YQ==",
		Authorization: UptoTonAuthorization{
			From:         "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
			Facilitator:  "EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe",
			JettonMaster: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
			MaxAmount:    "5000000",
			TonAmount:    "100000000",
			ValidUntil:   1704067200,
			Seqno:        42,
			QueryId:      "1704067200000042",
		},
		PaymentNonce: "0xabcdef1234567890abcdef1234567890",
	}

	// Convert to map
	m := original.ToMap()

	// Convert back to payload
	recovered, err := UptoPayloadFromMap(m)
	if err != nil {
		t.Fatalf("UptoPayloadFromMap() error: %v", err)
	}

	// Verify all fields match
	if recovered.SignedBoc != original.SignedBoc {
		t.Errorf("Round trip SignedBoc = %v, want %v", recovered.SignedBoc, original.SignedBoc)
	}
	if recovered.PaymentNonce != original.PaymentNonce {
		t.Errorf("Round trip PaymentNonce = %v, want %v", recovered.PaymentNonce, original.PaymentNonce)
	}
	if recovered.Authorization.From != original.Authorization.From {
		t.Errorf("Round trip From = %v, want %v", recovered.Authorization.From, original.Authorization.From)
	}
	if recovered.Authorization.Facilitator != original.Authorization.Facilitator {
		t.Errorf("Round trip Facilitator = %v, want %v", recovered.Authorization.Facilitator, original.Authorization.Facilitator)
	}
	if recovered.Authorization.JettonMaster != original.Authorization.JettonMaster {
		t.Errorf("Round trip JettonMaster = %v, want %v", recovered.Authorization.JettonMaster, original.Authorization.JettonMaster)
	}
	if recovered.Authorization.MaxAmount != original.Authorization.MaxAmount {
		t.Errorf("Round trip MaxAmount = %v, want %v", recovered.Authorization.MaxAmount, original.Authorization.MaxAmount)
	}
	if recovered.Authorization.TonAmount != original.Authorization.TonAmount {
		t.Errorf("Round trip TonAmount = %v, want %v", recovered.Authorization.TonAmount, original.Authorization.TonAmount)
	}
	if recovered.Authorization.ValidUntil != original.Authorization.ValidUntil {
		t.Errorf("Round trip ValidUntil = %v, want %v", recovered.Authorization.ValidUntil, original.Authorization.ValidUntil)
	}
	if recovered.Authorization.Seqno != original.Authorization.Seqno {
		t.Errorf("Round trip Seqno = %v, want %v", recovered.Authorization.Seqno, original.Authorization.Seqno)
	}
	if recovered.Authorization.QueryId != original.Authorization.QueryId {
		t.Errorf("Round trip QueryId = %v, want %v", recovered.Authorization.QueryId, original.Authorization.QueryId)
	}
}

func TestUptoTonPayloadJSONSerialization(t *testing.T) {
	payload := &UptoTonPayload{
		SignedBoc: "dGVzdCBib2MgZGF0YQ==",
		Authorization: UptoTonAuthorization{
			From:         "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
			Facilitator:  "EQDjv9CUEJ__D_3-3J4trQtqVklMBiNoGVSf3Fu6AaDGkEUe",
			JettonMaster: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
			MaxAmount:    "5000000",
			TonAmount:    "100000000",
			ValidUntil:   1704067200,
			Seqno:        42,
			QueryId:      "1704067200000042",
		},
		PaymentNonce: "0xabcdef1234567890abcdef1234567890",
	}

	// Marshal to JSON
	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("json.Marshal() error: %v", err)
	}

	// Unmarshal back
	var recovered UptoTonPayload
	if err := json.Unmarshal(jsonBytes, &recovered); err != nil {
		t.Fatalf("json.Unmarshal() error: %v", err)
	}

	if recovered.SignedBoc != payload.SignedBoc {
		t.Errorf("JSON round trip SignedBoc = %v, want %v", recovered.SignedBoc, payload.SignedBoc)
	}
	if recovered.PaymentNonce != payload.PaymentNonce {
		t.Errorf("JSON round trip PaymentNonce = %v, want %v", recovered.PaymentNonce, payload.PaymentNonce)
	}
	if recovered.Authorization.From != payload.Authorization.From {
		t.Errorf("JSON round trip From = %v, want %v", recovered.Authorization.From, payload.Authorization.From)
	}
	if recovered.Authorization.Facilitator != payload.Authorization.Facilitator {
		t.Errorf("JSON round trip Facilitator = %v, want %v", recovered.Authorization.Facilitator, payload.Authorization.Facilitator)
	}
	if recovered.Authorization.MaxAmount != payload.Authorization.MaxAmount {
		t.Errorf("JSON round trip MaxAmount = %v, want %v", recovered.Authorization.MaxAmount, payload.Authorization.MaxAmount)
	}
	if recovered.Authorization.ValidUntil != payload.Authorization.ValidUntil {
		t.Errorf("JSON round trip ValidUntil = %v, want %v", recovered.Authorization.ValidUntil, payload.Authorization.ValidUntil)
	}
	if recovered.Authorization.Seqno != payload.Authorization.Seqno {
		t.Errorf("JSON round trip Seqno = %v, want %v", recovered.Authorization.Seqno, payload.Authorization.Seqno)
	}
}

// containsStr checks if a string contains a substring
func containsStr(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
