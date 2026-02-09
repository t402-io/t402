package upto

import (
	"encoding/json"
	"testing"
)

func TestUptoNearPayloadToMap(t *testing.T) {
	payload := &UptoNearPayload{
		TxHash: "6eFxSCv6TzLbvGBRPaKHcLcfJGHEgH7x5T1aQT4qwZgt",
		Authorization: UptoNearAuthorization{
			From:          "alice.near",
			Facilitator:   "facilitator.near",
			TokenContract: "usdt.tether-token.near",
			MaxAmount:     "5000000",
		},
		PaymentNonce: "0xabcdef1234567890abcdef1234567890",
	}

	m := payload.ToMap()

	if m["txHash"] != payload.TxHash {
		t.Errorf("ToMap() txHash = %v, want %v", m["txHash"], payload.TxHash)
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

	if auth["tokenContract"] != payload.Authorization.TokenContract {
		t.Errorf("ToMap() tokenContract = %v, want %v", auth["tokenContract"], payload.Authorization.TokenContract)
	}

	if auth["maxAmount"] != payload.Authorization.MaxAmount {
		t.Errorf("ToMap() maxAmount = %v, want %v", auth["maxAmount"], payload.Authorization.MaxAmount)
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
				"txHash": "6eFxSCv6TzLbvGBRPaKHcLcfJGHEgH7x5T1aQT4qwZgt",
				"authorization": map[string]interface{}{
					"from":          "alice.near",
					"facilitator":   "facilitator.near",
					"tokenContract": "usdt.tether-token.near",
					"maxAmount":     "5000000",
				},
				"paymentNonce": "0xabcdef1234567890abcdef1234567890",
			},
			expectError: false,
		},
		{
			name: "missing txHash",
			data: map[string]interface{}{
				"authorization": map[string]interface{}{
					"from":        "alice.near",
					"facilitator": "facilitator.near",
				},
				"paymentNonce": "0xabcdef1234567890abcdef1234567890",
			},
			expectError: true,
			errContains: "txHash",
		},
		{
			name: "missing authorization.from",
			data: map[string]interface{}{
				"txHash": "6eFxSCv6TzLbvGBRPaKHcLcfJGHEgH7x5T1aQT4qwZgt",
				"authorization": map[string]interface{}{
					"facilitator": "facilitator.near",
				},
				"paymentNonce": "0xabcdef1234567890abcdef1234567890",
			},
			expectError: true,
			errContains: "from",
		},
		{
			name: "missing authorization.facilitator",
			data: map[string]interface{}{
				"txHash": "6eFxSCv6TzLbvGBRPaKHcLcfJGHEgH7x5T1aQT4qwZgt",
				"authorization": map[string]interface{}{
					"from": "alice.near",
				},
				"paymentNonce": "0xabcdef1234567890abcdef1234567890",
			},
			expectError: true,
			errContains: "facilitator",
		},
		{
			name: "missing paymentNonce",
			data: map[string]interface{}{
				"txHash": "6eFxSCv6TzLbvGBRPaKHcLcfJGHEgH7x5T1aQT4qwZgt",
				"authorization": map[string]interface{}{
					"from":        "alice.near",
					"facilitator": "facilitator.near",
				},
			},
			expectError: true,
			errContains: "paymentNonce",
		},
		{
			name:        "empty map",
			data:        map[string]interface{}{},
			expectError: true,
			errContains: "txHash",
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
	original := &UptoNearPayload{
		TxHash: "6eFxSCv6TzLbvGBRPaKHcLcfJGHEgH7x5T1aQT4qwZgt",
		Authorization: UptoNearAuthorization{
			From:          "alice.near",
			Facilitator:   "facilitator.near",
			TokenContract: "usdt.tether-token.near",
			MaxAmount:     "5000000",
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
	if recovered.TxHash != original.TxHash {
		t.Errorf("Round trip TxHash = %v, want %v", recovered.TxHash, original.TxHash)
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
	if recovered.Authorization.TokenContract != original.Authorization.TokenContract {
		t.Errorf("Round trip TokenContract = %v, want %v", recovered.Authorization.TokenContract, original.Authorization.TokenContract)
	}
	if recovered.Authorization.MaxAmount != original.Authorization.MaxAmount {
		t.Errorf("Round trip MaxAmount = %v, want %v", recovered.Authorization.MaxAmount, original.Authorization.MaxAmount)
	}
}

func TestUptoNearPayloadJSONSerialization(t *testing.T) {
	payload := &UptoNearPayload{
		TxHash: "6eFxSCv6TzLbvGBRPaKHcLcfJGHEgH7x5T1aQT4qwZgt",
		Authorization: UptoNearAuthorization{
			From:          "alice.near",
			Facilitator:   "facilitator.near",
			TokenContract: "usdt.tether-token.near",
			MaxAmount:     "5000000",
		},
		PaymentNonce: "0xabcdef1234567890abcdef1234567890",
	}

	// Marshal to JSON
	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("json.Marshal() error: %v", err)
	}

	// Unmarshal back
	var recovered UptoNearPayload
	if err := json.Unmarshal(jsonBytes, &recovered); err != nil {
		t.Fatalf("json.Unmarshal() error: %v", err)
	}

	if recovered.TxHash != payload.TxHash {
		t.Errorf("JSON round trip TxHash = %v, want %v", recovered.TxHash, payload.TxHash)
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
	if recovered.Authorization.TokenContract != payload.Authorization.TokenContract {
		t.Errorf("JSON round trip TokenContract = %v, want %v", recovered.Authorization.TokenContract, payload.Authorization.TokenContract)
	}
	if recovered.Authorization.MaxAmount != payload.Authorization.MaxAmount {
		t.Errorf("JSON round trip MaxAmount = %v, want %v", recovered.Authorization.MaxAmount, payload.Authorization.MaxAmount)
	}
}

func TestTransactionStatusIsSuccess(t *testing.T) {
	successVal := ""

	tests := []struct {
		name   string
		status TransactionStatus
		want   bool
	}{
		{
			name:   "success with empty value",
			status: TransactionStatus{SuccessValue: &successVal},
			want:   true,
		},
		{
			name:   "failure with nil success",
			status: TransactionStatus{SuccessValue: nil},
			want:   false,
		},
		{
			name:   "failure with failure field",
			status: TransactionStatus{SuccessValue: &successVal, Failure: json.RawMessage(`{"error":"something"}`)},
			want:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.status.IsSuccess()
			if got != tt.want {
				t.Errorf("IsSuccess() = %v, want %v", got, tt.want)
			}
		})
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
