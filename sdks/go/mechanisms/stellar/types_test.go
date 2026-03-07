package stellar

import (
	"encoding/json"
	"testing"
)

func TestExactStellarPayloadToMap(t *testing.T) {
	payload := &ExactStellarPayload{
		SignedXDR: "AAAAAQAAAAA=",
		Authorization: ExactStellarAuthorization{
			From:          "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAEANBER24HLOOMVHPZ5GYK",
			To:            "GBDEVU63Y6NTHJQQZIKVTC2LSQLMEAIFYRP2XAJDDQVWRDQJLEVLWM36",
			TokenContract: USDCPubnetAddress,
			Amount:        "10000000",
			MaxLedger:     50000000,
			Network:       StellarPubnetCAIP2,
		},
	}

	m := payload.ToMap()

	if m["signedXdr"] != payload.SignedXDR {
		t.Errorf("ToMap() signedXdr = %v, want %v", m["signedXdr"], payload.SignedXDR)
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

	if auth["tokenContract"] != payload.Authorization.TokenContract {
		t.Errorf("ToMap() tokenContract = %v, want %v", auth["tokenContract"], payload.Authorization.TokenContract)
	}

	if auth["amount"] != payload.Authorization.Amount {
		t.Errorf("ToMap() amount = %v, want %v", auth["amount"], payload.Authorization.Amount)
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
				"signedXdr": "AAAAAQAAAAA=",
				"authorization": map[string]interface{}{
					"from":          "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAEANBER24HLOOMVHPZ5GYK",
					"to":            "GBDEVU63Y6NTHJQQZIKVTC2LSQLMEAIFYRP2XAJDDQVWRDQJLEVLWM36",
					"tokenContract": USDCPubnetAddress,
					"amount":        "10000000",
					"maxLedger":     float64(50000000),
					"network":       StellarPubnetCAIP2,
				},
			},
			expectError: false,
		},
		{
			name: "missing signedXdr",
			data: map[string]interface{}{
				"authorization": map[string]interface{}{
					"from": "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAEANBER24HLOOMVHPZ5GYK",
				},
			},
			expectError: true,
		},
		{
			name: "missing authorization.from",
			data: map[string]interface{}{
				"signedXdr": "AAAAAQAAAAA=",
				"authorization": map[string]interface{}{
					"to": "GBDEVU63Y6NTHJQQZIKVTC2LSQLMEAIFYRP2XAJDDQVWRDQJLEVLWM36",
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
	original := &ExactStellarPayload{
		SignedXDR: "AAAAAQAAAAA=",
		Authorization: ExactStellarAuthorization{
			From:          "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAEANBER24HLOOMVHPZ5GYK",
			To:            "GBDEVU63Y6NTHJQQZIKVTC2LSQLMEAIFYRP2XAJDDQVWRDQJLEVLWM36",
			TokenContract: USDCPubnetAddress,
			Amount:        "10000000",
			MaxLedger:     50000000,
			Network:       StellarPubnetCAIP2,
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
	if recovered.SignedXDR != original.SignedXDR {
		t.Errorf("Round trip SignedXDR = %v, want %v", recovered.SignedXDR, original.SignedXDR)
	}
	if recovered.Authorization.From != original.Authorization.From {
		t.Errorf("Round trip From = %v, want %v", recovered.Authorization.From, original.Authorization.From)
	}
	if recovered.Authorization.To != original.Authorization.To {
		t.Errorf("Round trip To = %v, want %v", recovered.Authorization.To, original.Authorization.To)
	}
	if recovered.Authorization.TokenContract != original.Authorization.TokenContract {
		t.Errorf("Round trip TokenContract = %v, want %v", recovered.Authorization.TokenContract, original.Authorization.TokenContract)
	}
	if recovered.Authorization.Amount != original.Authorization.Amount {
		t.Errorf("Round trip Amount = %v, want %v", recovered.Authorization.Amount, original.Authorization.Amount)
	}
}

func TestExactStellarPayloadJSONSerialization(t *testing.T) {
	payload := &ExactStellarPayload{
		SignedXDR: "AAAAAQAAAAA=",
		Authorization: ExactStellarAuthorization{
			From:          "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAEANBER24HLOOMVHPZ5GYK",
			To:            "GBDEVU63Y6NTHJQQZIKVTC2LSQLMEAIFYRP2XAJDDQVWRDQJLEVLWM36",
			TokenContract: USDCPubnetAddress,
			Amount:        "10000000",
			MaxLedger:     50000000,
			Network:       StellarPubnetCAIP2,
		},
	}

	// Marshal to JSON
	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("json.Marshal() error: %v", err)
	}

	// Unmarshal back
	var recovered ExactStellarPayload
	if err := json.Unmarshal(jsonBytes, &recovered); err != nil {
		t.Fatalf("json.Unmarshal() error: %v", err)
	}

	// Verify fields match
	if recovered.SignedXDR != payload.SignedXDR {
		t.Errorf("JSON round trip SignedXDR = %v, want %v", recovered.SignedXDR, payload.SignedXDR)
	}
	if recovered.Authorization.From != payload.Authorization.From {
		t.Errorf("JSON round trip From = %v, want %v", recovered.Authorization.From, payload.Authorization.From)
	}
	if recovered.Authorization.MaxLedger != payload.Authorization.MaxLedger {
		t.Errorf("JSON round trip MaxLedger = %v, want %v", recovered.Authorization.MaxLedger, payload.Authorization.MaxLedger)
	}
	if recovered.Authorization.Network != payload.Authorization.Network {
		t.Errorf("JSON round trip Network = %v, want %v", recovered.Authorization.Network, payload.Authorization.Network)
	}
}

func TestVerifyTransactionResult(t *testing.T) {
	result := &VerifyTransactionResult{
		Valid:  true,
		Reason: "",
		Transfer: &TransferInfo{
			From:          "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAEANBER24HLOOMVHPZ5GYK",
			To:            "GBDEVU63Y6NTHJQQZIKVTC2LSQLMEAIFYRP2XAJDDQVWRDQJLEVLWM36",
			Amount:        "10000000",
			TokenContract: USDCPubnetAddress,
		},
	}

	// Marshal to JSON
	jsonBytes, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("json.Marshal() error: %v", err)
	}

	// Unmarshal back
	var recovered VerifyTransactionResult
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
		Ledger:  50000100,
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
	if recovered.Ledger != confirmation.Ledger {
		t.Errorf("JSON round trip Ledger = %v, want %v", recovered.Ledger, confirmation.Ledger)
	}
	if recovered.Hash != confirmation.Hash {
		t.Errorf("JSON round trip Hash = %v, want %v", recovered.Hash, confirmation.Hash)
	}
}
