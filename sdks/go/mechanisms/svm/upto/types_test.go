package upto

import (
	"encoding/json"
	"testing"
)

func TestUptoSvmPayloadToMap(t *testing.T) {
	payload := &UptoSvmPayload{
		Transaction: "dGVzdCB0cmFuc2FjdGlvbiBkYXRh",
		Authorization: UptoSvmAuthorization{
			Owner:     "7nYBm5mPdVk7HZkFLSw1Mz7bQFuSPkHaTtEhHNzCJPZ3",
			Delegate:  "BPFLoaderUpgradeab1e11111111111111111111111",
			Mint:      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
			MaxAmount: "5000000",
			SourceATA: "3XMGVSk9XGLEuSz7bLjDCVh4rFDxqkpmcakVEeduDahZ",
		},
		PaymentNonce: "0xabcdef1234567890abcdef1234567890",
	}

	m := payload.ToMap()

	if m["transaction"] != payload.Transaction {
		t.Errorf("ToMap() transaction = %v, want %v", m["transaction"], payload.Transaction)
	}

	if m["paymentNonce"] != payload.PaymentNonce {
		t.Errorf("ToMap() paymentNonce = %v, want %v", m["paymentNonce"], payload.PaymentNonce)
	}

	auth, ok := m["authorization"].(map[string]interface{})
	if !ok {
		t.Fatal("ToMap() authorization is not a map")
	}

	if auth["owner"] != payload.Authorization.Owner {
		t.Errorf("ToMap() owner = %v, want %v", auth["owner"], payload.Authorization.Owner)
	}

	if auth["delegate"] != payload.Authorization.Delegate {
		t.Errorf("ToMap() delegate = %v, want %v", auth["delegate"], payload.Authorization.Delegate)
	}

	if auth["mint"] != payload.Authorization.Mint {
		t.Errorf("ToMap() mint = %v, want %v", auth["mint"], payload.Authorization.Mint)
	}

	if auth["maxAmount"] != payload.Authorization.MaxAmount {
		t.Errorf("ToMap() maxAmount = %v, want %v", auth["maxAmount"], payload.Authorization.MaxAmount)
	}

	if auth["sourceATA"] != payload.Authorization.SourceATA {
		t.Errorf("ToMap() sourceATA = %v, want %v", auth["sourceATA"], payload.Authorization.SourceATA)
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
				"transaction": "dGVzdCB0cmFuc2FjdGlvbiBkYXRh",
				"authorization": map[string]interface{}{
					"owner":     "7nYBm5mPdVk7HZkFLSw1Mz7bQFuSPkHaTtEhHNzCJPZ3",
					"delegate":  "BPFLoaderUpgradeab1e11111111111111111111111",
					"mint":      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
					"maxAmount": "5000000",
					"sourceATA": "3XMGVSk9XGLEuSz7bLjDCVh4rFDxqkpmcakVEeduDahZ",
				},
				"paymentNonce": "0xabcdef1234567890abcdef1234567890",
			},
			expectError: false,
		},
		{
			name: "missing transaction",
			data: map[string]interface{}{
				"authorization": map[string]interface{}{
					"owner":    "7nYBm5mPdVk7HZkFLSw1Mz7bQFuSPkHaTtEhHNzCJPZ3",
					"delegate": "BPFLoaderUpgradeab1e11111111111111111111111",
				},
				"paymentNonce": "0xabcdef1234567890abcdef1234567890",
			},
			expectError: true,
			errContains: "transaction",
		},
		{
			name: "missing authorization.owner",
			data: map[string]interface{}{
				"transaction": "dGVzdCB0cmFuc2FjdGlvbiBkYXRh",
				"authorization": map[string]interface{}{
					"delegate": "BPFLoaderUpgradeab1e11111111111111111111111",
				},
				"paymentNonce": "0xabcdef1234567890abcdef1234567890",
			},
			expectError: true,
			errContains: "owner",
		},
		{
			name: "missing authorization.delegate",
			data: map[string]interface{}{
				"transaction": "dGVzdCB0cmFuc2FjdGlvbiBkYXRh",
				"authorization": map[string]interface{}{
					"owner": "7nYBm5mPdVk7HZkFLSw1Mz7bQFuSPkHaTtEhHNzCJPZ3",
				},
				"paymentNonce": "0xabcdef1234567890abcdef1234567890",
			},
			expectError: true,
			errContains: "delegate",
		},
		{
			name: "missing paymentNonce",
			data: map[string]interface{}{
				"transaction": "dGVzdCB0cmFuc2FjdGlvbiBkYXRh",
				"authorization": map[string]interface{}{
					"owner":    "7nYBm5mPdVk7HZkFLSw1Mz7bQFuSPkHaTtEhHNzCJPZ3",
					"delegate": "BPFLoaderUpgradeab1e11111111111111111111111",
				},
			},
			expectError: true,
			errContains: "paymentNonce",
		},
		{
			name:        "empty map",
			data:        map[string]interface{}{},
			expectError: true,
			errContains: "transaction",
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
	original := &UptoSvmPayload{
		Transaction: "dGVzdCB0cmFuc2FjdGlvbiBkYXRh",
		Authorization: UptoSvmAuthorization{
			Owner:     "7nYBm5mPdVk7HZkFLSw1Mz7bQFuSPkHaTtEhHNzCJPZ3",
			Delegate:  "BPFLoaderUpgradeab1e11111111111111111111111",
			Mint:      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
			MaxAmount: "5000000",
			SourceATA: "3XMGVSk9XGLEuSz7bLjDCVh4rFDxqkpmcakVEeduDahZ",
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
	if recovered.Transaction != original.Transaction {
		t.Errorf("Round trip Transaction = %v, want %v", recovered.Transaction, original.Transaction)
	}
	if recovered.PaymentNonce != original.PaymentNonce {
		t.Errorf("Round trip PaymentNonce = %v, want %v", recovered.PaymentNonce, original.PaymentNonce)
	}
	if recovered.Authorization.Owner != original.Authorization.Owner {
		t.Errorf("Round trip Owner = %v, want %v", recovered.Authorization.Owner, original.Authorization.Owner)
	}
	if recovered.Authorization.Delegate != original.Authorization.Delegate {
		t.Errorf("Round trip Delegate = %v, want %v", recovered.Authorization.Delegate, original.Authorization.Delegate)
	}
	if recovered.Authorization.Mint != original.Authorization.Mint {
		t.Errorf("Round trip Mint = %v, want %v", recovered.Authorization.Mint, original.Authorization.Mint)
	}
	if recovered.Authorization.MaxAmount != original.Authorization.MaxAmount {
		t.Errorf("Round trip MaxAmount = %v, want %v", recovered.Authorization.MaxAmount, original.Authorization.MaxAmount)
	}
	if recovered.Authorization.SourceATA != original.Authorization.SourceATA {
		t.Errorf("Round trip SourceATA = %v, want %v", recovered.Authorization.SourceATA, original.Authorization.SourceATA)
	}
}

func TestUptoSvmPayloadJSONSerialization(t *testing.T) {
	payload := &UptoSvmPayload{
		Transaction: "dGVzdCB0cmFuc2FjdGlvbiBkYXRh",
		Authorization: UptoSvmAuthorization{
			Owner:     "7nYBm5mPdVk7HZkFLSw1Mz7bQFuSPkHaTtEhHNzCJPZ3",
			Delegate:  "BPFLoaderUpgradeab1e11111111111111111111111",
			Mint:      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
			MaxAmount: "5000000",
			SourceATA: "3XMGVSk9XGLEuSz7bLjDCVh4rFDxqkpmcakVEeduDahZ",
		},
		PaymentNonce: "0xabcdef1234567890abcdef1234567890",
	}

	// Marshal to JSON
	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("json.Marshal() error: %v", err)
	}

	// Unmarshal back
	var recovered UptoSvmPayload
	if err := json.Unmarshal(jsonBytes, &recovered); err != nil {
		t.Fatalf("json.Unmarshal() error: %v", err)
	}

	if recovered.Transaction != payload.Transaction {
		t.Errorf("JSON round trip Transaction = %v, want %v", recovered.Transaction, payload.Transaction)
	}
	if recovered.PaymentNonce != payload.PaymentNonce {
		t.Errorf("JSON round trip PaymentNonce = %v, want %v", recovered.PaymentNonce, payload.PaymentNonce)
	}
	if recovered.Authorization.Owner != payload.Authorization.Owner {
		t.Errorf("JSON round trip Owner = %v, want %v", recovered.Authorization.Owner, payload.Authorization.Owner)
	}
	if recovered.Authorization.Delegate != payload.Authorization.Delegate {
		t.Errorf("JSON round trip Delegate = %v, want %v", recovered.Authorization.Delegate, payload.Authorization.Delegate)
	}
	if recovered.Authorization.Mint != payload.Authorization.Mint {
		t.Errorf("JSON round trip Mint = %v, want %v", recovered.Authorization.Mint, payload.Authorization.Mint)
	}
	if recovered.Authorization.MaxAmount != payload.Authorization.MaxAmount {
		t.Errorf("JSON round trip MaxAmount = %v, want %v", recovered.Authorization.MaxAmount, payload.Authorization.MaxAmount)
	}
	if recovered.Authorization.SourceATA != payload.Authorization.SourceATA {
		t.Errorf("JSON round trip SourceATA = %v, want %v", recovered.Authorization.SourceATA, payload.Authorization.SourceATA)
	}
}

func TestUptoSvmExtraJSONSerialization(t *testing.T) {
	extra := &UptoSvmExtra{
		FeePayer:  "BPFLoaderUpgradeab1e11111111111111111111111",
		MaxAmount: "5000000",
		MinAmount: "100000",
		Unit:      "request",
		UnitPrice: "10000",
	}

	// Marshal to JSON
	jsonBytes, err := json.Marshal(extra)
	if err != nil {
		t.Fatalf("json.Marshal() error: %v", err)
	}

	// Unmarshal back
	var recovered UptoSvmExtra
	if err := json.Unmarshal(jsonBytes, &recovered); err != nil {
		t.Fatalf("json.Unmarshal() error: %v", err)
	}

	if recovered.FeePayer != extra.FeePayer {
		t.Errorf("FeePayer = %v, want %v", recovered.FeePayer, extra.FeePayer)
	}
	if recovered.MaxAmount != extra.MaxAmount {
		t.Errorf("MaxAmount = %v, want %v", recovered.MaxAmount, extra.MaxAmount)
	}
	if recovered.MinAmount != extra.MinAmount {
		t.Errorf("MinAmount = %v, want %v", recovered.MinAmount, extra.MinAmount)
	}
	if recovered.Unit != extra.Unit {
		t.Errorf("Unit = %v, want %v", recovered.Unit, extra.Unit)
	}
	if recovered.UnitPrice != extra.UnitPrice {
		t.Errorf("UnitPrice = %v, want %v", recovered.UnitPrice, extra.UnitPrice)
	}
}

func TestUptoSvmExtraOmitEmpty(t *testing.T) {
	extra := &UptoSvmExtra{}

	jsonBytes, err := json.Marshal(extra)
	if err != nil {
		t.Fatalf("json.Marshal() error: %v", err)
	}

	// Should be empty object since all fields are omitempty
	if string(jsonBytes) != "{}" {
		t.Errorf("Empty UptoSvmExtra JSON = %v, want {}", string(jsonBytes))
	}
}

func TestSchemeUptoConstant(t *testing.T) {
	if SchemeUpto != "upto" {
		t.Errorf("SchemeUpto = %v, want upto", SchemeUpto)
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
