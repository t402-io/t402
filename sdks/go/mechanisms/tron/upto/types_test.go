package upto

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestUptoTronPayloadToMap(t *testing.T) {
	payload := &UptoTronPayload{
		SignedTransaction: "0a02abcd2208ef01234567890abc",
		Authorization: UptoTronAuthorization{
			Owner:           "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
			Spender:         "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
			ContractAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
			MaxAmount:       "5000000",
			Expiration:      1704067200000,
			RefBlockBytes:   "abcd",
			RefBlockHash:    "ef01234567890abc",
			Timestamp:       1704067100000,
		},
		PaymentNonce: "0xabcdef1234567890abcdef1234567890",
	}

	m := payload.ToMap()

	if m["signedTransaction"] != payload.SignedTransaction {
		t.Errorf("ToMap() signedTransaction = %v, want %v", m["signedTransaction"], payload.SignedTransaction)
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

	if auth["spender"] != payload.Authorization.Spender {
		t.Errorf("ToMap() spender = %v, want %v", auth["spender"], payload.Authorization.Spender)
	}

	if auth["contractAddress"] != payload.Authorization.ContractAddress {
		t.Errorf("ToMap() contractAddress = %v, want %v", auth["contractAddress"], payload.Authorization.ContractAddress)
	}

	if auth["maxAmount"] != payload.Authorization.MaxAmount {
		t.Errorf("ToMap() maxAmount = %v, want %v", auth["maxAmount"], payload.Authorization.MaxAmount)
	}

	if auth["expiration"] != payload.Authorization.Expiration {
		t.Errorf("ToMap() expiration = %v, want %v", auth["expiration"], payload.Authorization.Expiration)
	}

	if auth["refBlockBytes"] != payload.Authorization.RefBlockBytes {
		t.Errorf("ToMap() refBlockBytes = %v, want %v", auth["refBlockBytes"], payload.Authorization.RefBlockBytes)
	}

	if auth["refBlockHash"] != payload.Authorization.RefBlockHash {
		t.Errorf("ToMap() refBlockHash = %v, want %v", auth["refBlockHash"], payload.Authorization.RefBlockHash)
	}

	if auth["timestamp"] != payload.Authorization.Timestamp {
		t.Errorf("ToMap() timestamp = %v, want %v", auth["timestamp"], payload.Authorization.Timestamp)
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
				"signedTransaction": "0a02abcd2208ef01234567890abc",
				"authorization": map[string]interface{}{
					"owner":           "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
					"spender":         "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
					"contractAddress": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
					"maxAmount":       "5000000",
					"expiration":      float64(1704067200000),
					"refBlockBytes":   "abcd",
					"refBlockHash":    "ef01234567890abc",
					"timestamp":       float64(1704067100000),
				},
				"paymentNonce": "0xabcdef1234567890abcdef1234567890",
			},
			expectError: false,
		},
		{
			name: "missing signedTransaction",
			data: map[string]interface{}{
				"authorization": map[string]interface{}{
					"owner":   "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
					"spender": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
				},
				"paymentNonce": "0xabcdef1234567890abcdef1234567890",
			},
			expectError: true,
			errContains: "signedTransaction",
		},
		{
			name: "missing authorization.owner",
			data: map[string]interface{}{
				"signedTransaction": "0a02abcd2208ef01234567890abc",
				"authorization": map[string]interface{}{
					"spender": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
				},
				"paymentNonce": "0xabcdef1234567890abcdef1234567890",
			},
			expectError: true,
			errContains: "authorization.owner",
		},
		{
			name: "missing authorization.spender",
			data: map[string]interface{}{
				"signedTransaction": "0a02abcd2208ef01234567890abc",
				"authorization": map[string]interface{}{
					"owner": "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
				},
				"paymentNonce": "0xabcdef1234567890abcdef1234567890",
			},
			expectError: true,
			errContains: "authorization.spender",
		},
		{
			name: "missing paymentNonce",
			data: map[string]interface{}{
				"signedTransaction": "0a02abcd2208ef01234567890abc",
				"authorization": map[string]interface{}{
					"owner":   "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
					"spender": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
				},
			},
			expectError: true,
			errContains: "paymentNonce",
		},
		{
			name:        "empty map",
			data:        map[string]interface{}{},
			expectError: true,
			errContains: "signedTransaction",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload, err := UptoPayloadFromMap(tt.data)
			if tt.expectError {
				if err == nil {
					t.Errorf("UptoPayloadFromMap() expected error, got nil")
				} else if tt.errContains != "" && !strings.Contains(err.Error(), tt.errContains) {
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
	original := &UptoTronPayload{
		SignedTransaction: "0a02abcd2208ef01234567890abc",
		Authorization: UptoTronAuthorization{
			Owner:           "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
			Spender:         "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
			ContractAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
			MaxAmount:       "5000000",
			Expiration:      1704067200000,
			RefBlockBytes:   "abcd",
			RefBlockHash:    "ef01234567890abc",
			Timestamp:       1704067100000,
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
	if recovered.SignedTransaction != original.SignedTransaction {
		t.Errorf("Round trip SignedTransaction = %v, want %v", recovered.SignedTransaction, original.SignedTransaction)
	}
	if recovered.PaymentNonce != original.PaymentNonce {
		t.Errorf("Round trip PaymentNonce = %v, want %v", recovered.PaymentNonce, original.PaymentNonce)
	}
	if recovered.Authorization.Owner != original.Authorization.Owner {
		t.Errorf("Round trip Owner = %v, want %v", recovered.Authorization.Owner, original.Authorization.Owner)
	}
	if recovered.Authorization.Spender != original.Authorization.Spender {
		t.Errorf("Round trip Spender = %v, want %v", recovered.Authorization.Spender, original.Authorization.Spender)
	}
	if recovered.Authorization.ContractAddress != original.Authorization.ContractAddress {
		t.Errorf("Round trip ContractAddress = %v, want %v", recovered.Authorization.ContractAddress, original.Authorization.ContractAddress)
	}
	if recovered.Authorization.MaxAmount != original.Authorization.MaxAmount {
		t.Errorf("Round trip MaxAmount = %v, want %v", recovered.Authorization.MaxAmount, original.Authorization.MaxAmount)
	}
	if recovered.Authorization.Expiration != original.Authorization.Expiration {
		t.Errorf("Round trip Expiration = %v, want %v", recovered.Authorization.Expiration, original.Authorization.Expiration)
	}
	if recovered.Authorization.RefBlockBytes != original.Authorization.RefBlockBytes {
		t.Errorf("Round trip RefBlockBytes = %v, want %v", recovered.Authorization.RefBlockBytes, original.Authorization.RefBlockBytes)
	}
	if recovered.Authorization.RefBlockHash != original.Authorization.RefBlockHash {
		t.Errorf("Round trip RefBlockHash = %v, want %v", recovered.Authorization.RefBlockHash, original.Authorization.RefBlockHash)
	}
	if recovered.Authorization.Timestamp != original.Authorization.Timestamp {
		t.Errorf("Round trip Timestamp = %v, want %v", recovered.Authorization.Timestamp, original.Authorization.Timestamp)
	}
}

func TestUptoTronPayloadJSONSerialization(t *testing.T) {
	payload := &UptoTronPayload{
		SignedTransaction: "0a02abcd2208ef01234567890abc",
		Authorization: UptoTronAuthorization{
			Owner:           "TT1MqNNj2k5qdGA6nrrCodW6oyHbbAreQ5",
			Spender:         "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
			ContractAddress: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
			MaxAmount:       "5000000",
			Expiration:      1704067200000,
			RefBlockBytes:   "abcd",
			RefBlockHash:    "ef01234567890abc",
			Timestamp:       1704067100000,
		},
		PaymentNonce: "0xabcdef1234567890abcdef1234567890",
	}

	// Marshal to JSON
	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("json.Marshal() error: %v", err)
	}

	// Unmarshal back
	var recovered UptoTronPayload
	if err := json.Unmarshal(jsonBytes, &recovered); err != nil {
		t.Fatalf("json.Unmarshal() error: %v", err)
	}

	if recovered.SignedTransaction != payload.SignedTransaction {
		t.Errorf("JSON round trip SignedTransaction = %v, want %v", recovered.SignedTransaction, payload.SignedTransaction)
	}
	if recovered.PaymentNonce != payload.PaymentNonce {
		t.Errorf("JSON round trip PaymentNonce = %v, want %v", recovered.PaymentNonce, payload.PaymentNonce)
	}
	if recovered.Authorization.Owner != payload.Authorization.Owner {
		t.Errorf("JSON round trip Owner = %v, want %v", recovered.Authorization.Owner, payload.Authorization.Owner)
	}
	if recovered.Authorization.Spender != payload.Authorization.Spender {
		t.Errorf("JSON round trip Spender = %v, want %v", recovered.Authorization.Spender, payload.Authorization.Spender)
	}
	if recovered.Authorization.ContractAddress != payload.Authorization.ContractAddress {
		t.Errorf("JSON round trip ContractAddress = %v, want %v", recovered.Authorization.ContractAddress, payload.Authorization.ContractAddress)
	}
	if recovered.Authorization.MaxAmount != payload.Authorization.MaxAmount {
		t.Errorf("JSON round trip MaxAmount = %v, want %v", recovered.Authorization.MaxAmount, payload.Authorization.MaxAmount)
	}
	if recovered.Authorization.Expiration != payload.Authorization.Expiration {
		t.Errorf("JSON round trip Expiration = %v, want %v", recovered.Authorization.Expiration, payload.Authorization.Expiration)
	}
	if recovered.Authorization.RefBlockBytes != payload.Authorization.RefBlockBytes {
		t.Errorf("JSON round trip RefBlockBytes = %v, want %v", recovered.Authorization.RefBlockBytes, payload.Authorization.RefBlockBytes)
	}
	if recovered.Authorization.RefBlockHash != payload.Authorization.RefBlockHash {
		t.Errorf("JSON round trip RefBlockHash = %v, want %v", recovered.Authorization.RefBlockHash, payload.Authorization.RefBlockHash)
	}
	if recovered.Authorization.Timestamp != payload.Authorization.Timestamp {
		t.Errorf("JSON round trip Timestamp = %v, want %v", recovered.Authorization.Timestamp, payload.Authorization.Timestamp)
	}
}
