package svm

import (
	"testing"
)

func TestExactSvmPayloadToMap(t *testing.T) {
	tests := []struct {
		name        string
		payload     ExactSvmPayload
		expectedTx  string
	}{
		{
			name: "valid payload",
			payload: ExactSvmPayload{
				Transaction: "base64EncodedTransaction",
			},
			expectedTx: "base64EncodedTransaction",
		},
		{
			name: "empty transaction",
			payload: ExactSvmPayload{
				Transaction: "",
			},
			expectedTx: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.payload.ToMap()
			if result["transaction"] != tt.expectedTx {
				t.Errorf("ToMap() transaction = %v, want %v", result["transaction"], tt.expectedTx)
			}
		})
	}
}

func TestPayloadFromMap(t *testing.T) {
	tests := []struct {
		name        string
		data        map[string]interface{}
		expectedTx  string
		expectError bool
	}{
		{
			name: "valid map",
			data: map[string]interface{}{
				"transaction": "base64EncodedTransaction",
			},
			expectedTx:  "base64EncodedTransaction",
			expectError: false,
		},
		{
			name:        "missing transaction field",
			data:        map[string]interface{}{},
			expectedTx:  "",
			expectError: true,
		},
		{
			name: "empty transaction field",
			data: map[string]interface{}{
				"transaction": "",
			},
			expectedTx:  "",
			expectError: true,
		},
		{
			name: "transaction field with wrong type",
			data: map[string]interface{}{
				"transaction": 12345,
			},
			expectedTx:  "",
			expectError: true,
		},
		{
			name:        "nil map",
			data:        nil,
			expectedTx:  "",
			expectError: true,
		},
		{
			name: "extra fields are ignored",
			data: map[string]interface{}{
				"transaction": "validTx",
				"extra":       "field",
			},
			expectedTx:  "validTx",
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := PayloadFromMap(tt.data)
			if tt.expectError {
				if err == nil {
					t.Errorf("PayloadFromMap() expected error, got nil")
				}
			} else {
				if err != nil {
					t.Errorf("PayloadFromMap() unexpected error: %v", err)
				}
				if result == nil {
					t.Errorf("PayloadFromMap() returned nil result")
				}
				if result != nil && result.Transaction != tt.expectedTx {
					t.Errorf("PayloadFromMap() Transaction = %v, want %v", result.Transaction, tt.expectedTx)
				}
			}
		})
	}
}

func TestIsValidNetwork(t *testing.T) {
	tests := []struct {
		name     string
		network  string
		expected bool
	}{
		{
			name:     "mainnet CAIP-2 is valid",
			network:  SolanaMainnetCAIP2,
			expected: true,
		},
		{
			name:     "devnet CAIP-2 is valid",
			network:  SolanaDevnetCAIP2,
			expected: true,
		},
		{
			name:     "testnet CAIP-2 is valid",
			network:  SolanaTestnetCAIP2,
			expected: true,
		},
		{
			name:     "V1 mainnet is valid",
			network:  SolanaMainnetV1,
			expected: true,
		},
		{
			name:     "V1 devnet is valid",
			network:  SolanaDevnetV1,
			expected: true,
		},
		{
			name:     "V1 testnet is valid",
			network:  SolanaTestnetV1,
			expected: true,
		},
		{
			name:     "unsupported CAIP-2 is invalid",
			network:  "solana:unsupported",
			expected: false,
		},
		{
			name:     "empty is invalid",
			network:  "",
			expected: false,
		},
		{
			name:     "non-solana is invalid",
			network:  "eip155:1",
			expected: false,
		},
		{
			name:     "random string is invalid",
			network:  "random",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := IsValidNetwork(tt.network)
			if result != tt.expected {
				t.Errorf("IsValidNetwork(%s) = %v, want %v", tt.network, result, tt.expected)
			}
		})
	}
}

func TestPayloadRoundTrip(t *testing.T) {
	original := ExactSvmPayload{
		Transaction: "testTransaction123",
	}

	// Convert to map
	m := original.ToMap()

	// Convert back from map
	result, err := PayloadFromMap(m)
	if err != nil {
		t.Fatalf("PayloadFromMap failed: %v", err)
	}

	if result.Transaction != original.Transaction {
		t.Errorf("Round trip failed: original=%s, result=%s", original.Transaction, result.Transaction)
	}
}
