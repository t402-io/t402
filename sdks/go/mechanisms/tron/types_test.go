package tron

import (
	"encoding/json"
	"testing"
)

func TestExactTronPayloadToMap(t *testing.T) {
	payload := &ExactTronPayload{
		SignedTransaction: "0a02abcd2208deadbeef12345678",
		Authorization: ExactTronAuthorization{
			From:            "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
			To:              "TJYPgMHqGBqbjmgcDxBQEL1PPxbRvnLBKY",
			ContractAddress: USDTMainnetAddress,
			Amount:          "1000000",
			Expiration:      1704067200000,
			RefBlockBytes:   "abcd",
			RefBlockHash:    "deadbeef12345678",
			Timestamp:       1704063600000,
		},
	}

	m := payload.ToMap()

	if m["signedTransaction"] != payload.SignedTransaction {
		t.Errorf("ToMap() signedTransaction = %v, want %v", m["signedTransaction"], payload.SignedTransaction)
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

	if auth["contractAddress"] != payload.Authorization.ContractAddress {
		t.Errorf("ToMap() contractAddress = %v, want %v", auth["contractAddress"], payload.Authorization.ContractAddress)
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
				"signedTransaction": "0a02abcd2208deadbeef12345678",
				"authorization": map[string]interface{}{
					"from":            "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
					"to":              "TJYPgMHqGBqbjmgcDxBQEL1PPxbRvnLBKY",
					"contractAddress": USDTMainnetAddress,
					"amount":          "1000000",
					"expiration":      float64(1704067200000),
					"refBlockBytes":   "abcd",
					"refBlockHash":    "deadbeef12345678",
					"timestamp":       float64(1704063600000),
				},
			},
			expectError: false,
		},
		{
			name: "missing signedTransaction",
			data: map[string]interface{}{
				"authorization": map[string]interface{}{
					"from": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
				},
			},
			expectError: true,
		},
		{
			name: "missing authorization.from",
			data: map[string]interface{}{
				"signedTransaction": "0a02abcd2208deadbeef12345678",
				"authorization": map[string]interface{}{
					"to": "TJYPgMHqGBqbjmgcDxBQEL1PPxbRvnLBKY",
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
	original := &ExactTronPayload{
		SignedTransaction: "0a02abcd2208deadbeef12345678",
		Authorization: ExactTronAuthorization{
			From:            "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
			To:              "TJYPgMHqGBqbjmgcDxBQEL1PPxbRvnLBKY",
			ContractAddress: USDTMainnetAddress,
			Amount:          "1000000",
			Expiration:      1704067200000,
			RefBlockBytes:   "abcd",
			RefBlockHash:    "deadbeef12345678",
			Timestamp:       1704063600000,
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
	if recovered.SignedTransaction != original.SignedTransaction {
		t.Errorf("Round trip SignedTransaction = %v, want %v", recovered.SignedTransaction, original.SignedTransaction)
	}
	if recovered.Authorization.From != original.Authorization.From {
		t.Errorf("Round trip From = %v, want %v", recovered.Authorization.From, original.Authorization.From)
	}
	if recovered.Authorization.To != original.Authorization.To {
		t.Errorf("Round trip To = %v, want %v", recovered.Authorization.To, original.Authorization.To)
	}
	if recovered.Authorization.ContractAddress != original.Authorization.ContractAddress {
		t.Errorf("Round trip ContractAddress = %v, want %v", recovered.Authorization.ContractAddress, original.Authorization.ContractAddress)
	}
	if recovered.Authorization.Amount != original.Authorization.Amount {
		t.Errorf("Round trip Amount = %v, want %v", recovered.Authorization.Amount, original.Authorization.Amount)
	}
}

func TestExactTronPayloadJSONSerialization(t *testing.T) {
	payload := &ExactTronPayload{
		SignedTransaction: "0a02abcd2208deadbeef12345678",
		Authorization: ExactTronAuthorization{
			From:            "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
			To:              "TJYPgMHqGBqbjmgcDxBQEL1PPxbRvnLBKY",
			ContractAddress: USDTMainnetAddress,
			Amount:          "1000000",
			Expiration:      1704067200000,
			RefBlockBytes:   "abcd",
			RefBlockHash:    "deadbeef12345678",
			Timestamp:       1704063600000,
		},
	}

	// Marshal to JSON
	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("json.Marshal() error: %v", err)
	}

	// Unmarshal back
	var recovered ExactTronPayload
	if err := json.Unmarshal(jsonBytes, &recovered); err != nil {
		t.Fatalf("json.Unmarshal() error: %v", err)
	}

	// Verify fields match
	if recovered.SignedTransaction != payload.SignedTransaction {
		t.Errorf("JSON round trip SignedTransaction = %v, want %v", recovered.SignedTransaction, payload.SignedTransaction)
	}
	if recovered.Authorization.From != payload.Authorization.From {
		t.Errorf("JSON round trip From = %v, want %v", recovered.Authorization.From, payload.Authorization.From)
	}
	if recovered.Authorization.Expiration != payload.Authorization.Expiration {
		t.Errorf("JSON round trip Expiration = %v, want %v", recovered.Authorization.Expiration, payload.Authorization.Expiration)
	}
	if recovered.Authorization.Timestamp != payload.Authorization.Timestamp {
		t.Errorf("JSON round trip Timestamp = %v, want %v", recovered.Authorization.Timestamp, payload.Authorization.Timestamp)
	}
}

func TestVerifyMessageResult(t *testing.T) {
	result := &VerifyMessageResult{
		Valid:  true,
		Reason: "",
		Transfer: &TransferInfo{
			From:            "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
			To:              "TJYPgMHqGBqbjmgcDxBQEL1PPxbRvnLBKY",
			ContractAddress: USDTMainnetAddress,
			Amount:          "1000000",
			TxId:            "abc123def456",
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
	if recovered.Transfer.TxId != result.Transfer.TxId {
		t.Errorf("JSON round trip Transfer.TxId = %v, want %v", recovered.Transfer.TxId, result.Transfer.TxId)
	}
}

func TestTransactionConfirmation(t *testing.T) {
	confirmation := &TransactionConfirmation{
		Success:     true,
		TxId:        "abc123def456",
		BlockNumber: 12345678,
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
	if recovered.TxId != confirmation.TxId {
		t.Errorf("JSON round trip TxId = %v, want %v", recovered.TxId, confirmation.TxId)
	}
	if recovered.BlockNumber != confirmation.BlockNumber {
		t.Errorf("JSON round trip BlockNumber = %v, want %v", recovered.BlockNumber, confirmation.BlockNumber)
	}
}

func TestBlockInfoSerialization(t *testing.T) {
	blockInfo := &BlockInfo{
		RefBlockBytes: "abcd",
		RefBlockHash:  "deadbeef12345678",
		Expiration:    1704067200000,
		Timestamp:     1704063600000,
	}

	// Marshal to JSON
	jsonBytes, err := json.Marshal(blockInfo)
	if err != nil {
		t.Fatalf("json.Marshal() error: %v", err)
	}

	// Unmarshal back
	var recovered BlockInfo
	if err := json.Unmarshal(jsonBytes, &recovered); err != nil {
		t.Fatalf("json.Unmarshal() error: %v", err)
	}

	if recovered.RefBlockBytes != blockInfo.RefBlockBytes {
		t.Errorf("JSON round trip RefBlockBytes = %v, want %v", recovered.RefBlockBytes, blockInfo.RefBlockBytes)
	}
	if recovered.RefBlockHash != blockInfo.RefBlockHash {
		t.Errorf("JSON round trip RefBlockHash = %v, want %v", recovered.RefBlockHash, blockInfo.RefBlockHash)
	}
	if recovered.Expiration != blockInfo.Expiration {
		t.Errorf("JSON round trip Expiration = %v, want %v", recovered.Expiration, blockInfo.Expiration)
	}
}

func TestAssetInfoDefaults(t *testing.T) {
	// Test that mainnet default asset is correctly configured
	config := NetworkConfigs[TronMainnetCAIP2]

	if config.DefaultAsset.Symbol != "USDT" {
		t.Errorf("Mainnet default asset Symbol = %v, want USDT", config.DefaultAsset.Symbol)
	}
	if config.DefaultAsset.Decimals != DefaultDecimals {
		t.Errorf("Mainnet default asset Decimals = %v, want %v", config.DefaultAsset.Decimals, DefaultDecimals)
	}
	if config.DefaultAsset.ContractAddress != USDTMainnetAddress {
		t.Errorf("Mainnet default asset ContractAddress = %v, want %v", config.DefaultAsset.ContractAddress, USDTMainnetAddress)
	}
}

func TestNetworkConfigEndpoints(t *testing.T) {
	tests := []struct {
		name             string
		network          string
		expectedEndpoint string
	}{
		{
			name:             "mainnet endpoint",
			network:          TronMainnetCAIP2,
			expectedEndpoint: "https://api.trongrid.io",
		},
		{
			name:             "nile endpoint",
			network:          TronNileCAIP2,
			expectedEndpoint: "https://api.nileex.io",
		},
		{
			name:             "shasta endpoint",
			network:          TronShastaCAIP2,
			expectedEndpoint: "https://api.shasta.trongrid.io",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := NetworkConfigs[tt.network]
			if config.Endpoint != tt.expectedEndpoint {
				t.Errorf("NetworkConfigs[%s].Endpoint = %v, want %v", tt.network, config.Endpoint, tt.expectedEndpoint)
			}
		})
	}
}
