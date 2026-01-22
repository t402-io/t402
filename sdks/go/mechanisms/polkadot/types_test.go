package polkadot

import (
	"encoding/json"
	"testing"
)

func TestExactDirectPayloadToMap(t *testing.T) {
	payload := &ExactDirectPayload{
		ExtrinsicHash:  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
		BlockHash:      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
		ExtrinsicIndex: 2,
		From:           "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
		To:             "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
		Amount:         "1000000",
		AssetID:        1984,
	}

	m := payload.ToMap()

	if m["extrinsicHash"] != payload.ExtrinsicHash {
		t.Errorf("ToMap() extrinsicHash = %v, want %v", m["extrinsicHash"], payload.ExtrinsicHash)
	}
	if m["blockHash"] != payload.BlockHash {
		t.Errorf("ToMap() blockHash = %v, want %v", m["blockHash"], payload.BlockHash)
	}
	if m["extrinsicIndex"] != payload.ExtrinsicIndex {
		t.Errorf("ToMap() extrinsicIndex = %v, want %v", m["extrinsicIndex"], payload.ExtrinsicIndex)
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
	if m["assetId"] != payload.AssetID {
		t.Errorf("ToMap() assetId = %v, want %v", m["assetId"], payload.AssetID)
	}
}

func TestPayloadFromMap(t *testing.T) {
	tests := []struct {
		name string
		data map[string]interface{}
		want ExactDirectPayload
	}{
		{
			name: "valid payload with float64 values",
			data: map[string]interface{}{
				"extrinsicHash":  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
				"blockHash":      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
				"extrinsicIndex": float64(2),
				"from":           "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
				"to":             "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				"amount":         "1000000",
				"assetId":        float64(1984),
			},
			want: ExactDirectPayload{
				ExtrinsicHash:  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
				BlockHash:      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
				ExtrinsicIndex: 2,
				From:           "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
				To:             "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:         "1000000",
				AssetID:        1984,
			},
		},
		{
			name: "valid payload with int values",
			data: map[string]interface{}{
				"extrinsicHash":  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
				"blockHash":      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
				"extrinsicIndex": 5,
				"from":           "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
				"to":             "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				"amount":         "2000000",
				"assetId":        1984,
			},
			want: ExactDirectPayload{
				ExtrinsicHash:  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
				BlockHash:      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
				ExtrinsicIndex: 5,
				From:           "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
				To:             "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:         "2000000",
				AssetID:        1984,
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
			if payload.ExtrinsicHash != tt.want.ExtrinsicHash {
				t.Errorf("PayloadFromMap().ExtrinsicHash = %v, want %v", payload.ExtrinsicHash, tt.want.ExtrinsicHash)
			}
			if payload.ExtrinsicIndex != tt.want.ExtrinsicIndex {
				t.Errorf("PayloadFromMap().ExtrinsicIndex = %v, want %v", payload.ExtrinsicIndex, tt.want.ExtrinsicIndex)
			}
			if payload.AssetID != tt.want.AssetID {
				t.Errorf("PayloadFromMap().AssetID = %v, want %v", payload.AssetID, tt.want.AssetID)
			}
		})
	}
}

func TestPayloadRoundTrip(t *testing.T) {
	original := &ExactDirectPayload{
		ExtrinsicHash:  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
		BlockHash:      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
		ExtrinsicIndex: 3,
		From:           "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
		To:             "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
		Amount:         "1000000",
		AssetID:        1984,
	}

	// Convert to map
	m := original.ToMap()

	// Convert back to payload
	recovered, err := PayloadFromMap(m)
	if err != nil {
		t.Fatalf("PayloadFromMap() error: %v", err)
	}

	// Verify fields match
	if recovered.ExtrinsicHash != original.ExtrinsicHash {
		t.Errorf("Round trip ExtrinsicHash = %v, want %v", recovered.ExtrinsicHash, original.ExtrinsicHash)
	}
	if recovered.BlockHash != original.BlockHash {
		t.Errorf("Round trip BlockHash = %v, want %v", recovered.BlockHash, original.BlockHash)
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
}

func TestExactDirectPayloadJSONSerialization(t *testing.T) {
	payload := &ExactDirectPayload{
		ExtrinsicHash:  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
		BlockHash:      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
		ExtrinsicIndex: 2,
		From:           "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
		To:             "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
		Amount:         "1000000",
		AssetID:        1984,
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
	if recovered.ExtrinsicHash != payload.ExtrinsicHash {
		t.Errorf("JSON round trip ExtrinsicHash = %v, want %v", recovered.ExtrinsicHash, payload.ExtrinsicHash)
	}
	if recovered.ExtrinsicIndex != payload.ExtrinsicIndex {
		t.Errorf("JSON round trip ExtrinsicIndex = %v, want %v", recovered.ExtrinsicIndex, payload.ExtrinsicIndex)
	}
	if recovered.AssetID != payload.AssetID {
		t.Errorf("JSON round trip AssetID = %v, want %v", recovered.AssetID, payload.AssetID)
	}
}

func TestIsValidAddress(t *testing.T) {
	tests := []struct {
		name    string
		address string
		want    bool
	}{
		{
			name:    "valid Polkadot address",
			address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
			want:    true,
		},
		{
			name:    "valid Kusama address",
			address: "HNZata7iMYWmk5RvZRTiAsSDhV8366zq2YGb3tLH5Upf74F",
			want:    true,
		},
		{
			name:    "valid short address",
			address: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
			want:    true,
		},
		{
			name:    "empty address",
			address: "",
			want:    false,
		},
		{
			name:    "too short address",
			address: "15oF4uV",
			want:    false,
		},
		{
			name:    "invalid characters (O)",
			address: "O5oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
			want:    false,
		},
		{
			name:    "invalid characters (0)",
			address: "05oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
			want:    false,
		},
		{
			name:    "invalid characters (l)",
			address: "l5oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
			want:    false,
		},
		{
			name:    "invalid characters (I)",
			address: "I5oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
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

func TestIsValidExtrinsicHash(t *testing.T) {
	tests := []struct {
		name string
		hash string
		want bool
	}{
		{
			name: "valid hash",
			hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			want: true,
		},
		{
			name: "valid hash uppercase",
			hash: "0xABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890",
			want: true,
		},
		{
			name: "empty hash",
			hash: "",
			want: false,
		},
		{
			name: "missing 0x prefix",
			hash: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			want: false,
		},
		{
			name: "too short",
			hash: "0x1234",
			want: false,
		},
		{
			name: "too long",
			hash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef00",
			want: false,
		},
		{
			name: "invalid characters",
			hash: "0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ",
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsValidExtrinsicHash(tt.hash)
			if got != tt.want {
				t.Errorf("IsValidExtrinsicHash(%v) = %v, want %v", tt.hash, got, tt.want)
			}
		})
	}
}

func TestIsValidBlockHash(t *testing.T) {
	// Block hash uses the same validation as extrinsic hash
	tests := []struct {
		name string
		hash string
		want bool
	}{
		{
			name: "valid block hash",
			hash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
			want: true,
		},
		{
			name: "empty hash",
			hash: "",
			want: false,
		},
		{
			name: "invalid hash",
			hash: "invalid",
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsValidBlockHash(tt.hash)
			if got != tt.want {
				t.Errorf("IsValidBlockHash(%v) = %v, want %v", tt.hash, got, tt.want)
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
			addr1: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
			addr2: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
			want:  true,
		},
		{
			name:  "different addresses",
			addr1: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
			addr2: "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
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
			addr1: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
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

func TestIsPolkadotNetwork(t *testing.T) {
	tests := []struct {
		name    string
		network string
		want    bool
	}{
		{
			name:    "Polkadot Asset Hub",
			network: PolkadotAssetHubCAIP2,
			want:    true,
		},
		{
			name:    "Kusama Asset Hub",
			network: KusamaAssetHubCAIP2,
			want:    true,
		},
		{
			name:    "generic polkadot network",
			network: "polkadot:somechain",
			want:    true,
		},
		{
			name:    "EVM network",
			network: "eip155:1",
			want:    false,
		},
		{
			name:    "TON network",
			network: "ton:mainnet",
			want:    false,
		},
		{
			name:    "empty network",
			network: "",
			want:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsPolkadotNetwork(tt.network)
			if got != tt.want {
				t.Errorf("IsPolkadotNetwork(%v) = %v, want %v", tt.network, got, tt.want)
			}
		})
	}
}

func TestExtractAssetTransfer(t *testing.T) {
	tests := []struct {
		name   string
		result *ExtrinsicResult
		want   *ParsedAssetTransfer
	}{
		{
			name:   "nil result",
			result: nil,
			want:   nil,
		},
		{
			name: "failed extrinsic",
			result: &ExtrinsicResult{
				Success: false,
				Module:  "Assets",
				Call:    "transfer",
			},
			want: nil,
		},
		{
			name: "wrong module",
			result: &ExtrinsicResult{
				Success: true,
				Module:  "Balances",
				Call:    "transfer",
			},
			want: nil,
		},
		{
			name: "wrong call",
			result: &ExtrinsicResult{
				Success: true,
				Module:  "Assets",
				Call:    "approve",
			},
			want: nil,
		},
		{
			name: "valid transfer",
			result: &ExtrinsicResult{
				Success: true,
				Module:  "Assets",
				Call:    "transfer",
				Signer:  "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
				Params: []ExtrinsicParam{
					{Name: "id", Value: float64(1984)},
					{Name: "target", Value: "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3"},
					{Name: "amount", Value: "1000000"},
				},
			},
			want: &ParsedAssetTransfer{
				AssetID: 1984,
				From:    "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
				To:      "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "1000000",
				Success: true,
			},
		},
		{
			name: "transfer_keep_alive call",
			result: &ExtrinsicResult{
				Success: true,
				Module:  "assets",
				Call:    "transfer_keep_alive",
				Signer:  "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
				Params: []ExtrinsicParam{
					{Name: "asset_id", Value: float64(1984)},
					{Name: "dest", Value: "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3"},
					{Name: "amount", Value: "500000"},
				},
			},
			want: &ParsedAssetTransfer{
				AssetID: 1984,
				From:    "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
				To:      "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "500000",
				Success: true,
			},
		},
		{
			name: "target as map with Id",
			result: &ExtrinsicResult{
				Success: true,
				Module:  "Assets",
				Call:    "transfer",
				Signer:  "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
				Params: []ExtrinsicParam{
					{Name: "id", Value: float64(1984)},
					{Name: "target", Value: map[string]interface{}{"Id": "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3"}},
					{Name: "amount", Value: "1000000"},
				},
			},
			want: &ParsedAssetTransfer{
				AssetID: 1984,
				From:    "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
				To:      "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "1000000",
				Success: true,
			},
		},
		{
			name: "missing asset id returns nil",
			result: &ExtrinsicResult{
				Success: true,
				Module:  "Assets",
				Call:    "transfer",
				Signer:  "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
				Params: []ExtrinsicParam{
					{Name: "target", Value: "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3"},
					{Name: "amount", Value: "1000000"},
				},
			},
			want: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ExtractAssetTransfer(tt.result)
			if tt.want == nil {
				if got != nil {
					t.Errorf("ExtractAssetTransfer() = %+v, want nil", got)
				}
				return
			}
			if got == nil {
				t.Fatalf("ExtractAssetTransfer() = nil, want %+v", tt.want)
			}
			if got.AssetID != tt.want.AssetID {
				t.Errorf("ExtractAssetTransfer().AssetID = %v, want %v", got.AssetID, tt.want.AssetID)
			}
			if got.From != tt.want.From {
				t.Errorf("ExtractAssetTransfer().From = %v, want %v", got.From, tt.want.From)
			}
			if got.To != tt.want.To {
				t.Errorf("ExtractAssetTransfer().To = %v, want %v", got.To, tt.want.To)
			}
			if got.Amount != tt.want.Amount {
				t.Errorf("ExtractAssetTransfer().Amount = %v, want %v", got.Amount, tt.want.Amount)
			}
			if got.Success != tt.want.Success {
				t.Errorf("ExtractAssetTransfer().Success = %v, want %v", got.Success, tt.want.Success)
			}
		})
	}
}

func TestExtrinsicResultJSONSerialization(t *testing.T) {
	result := &ExtrinsicResult{
		ExtrinsicHash:  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
		BlockHash:      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
		BlockNumber:    12345,
		ExtrinsicIndex: 2,
		Timestamp:      "2024-01-01T00:00:00Z",
		Signer:         "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
		Success:        true,
		Module:         "Assets",
		Call:           "transfer",
	}

	// Marshal to JSON
	jsonBytes, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("json.Marshal() error: %v", err)
	}

	// Unmarshal back
	var recovered ExtrinsicResult
	if err := json.Unmarshal(jsonBytes, &recovered); err != nil {
		t.Fatalf("json.Unmarshal() error: %v", err)
	}

	if recovered.ExtrinsicHash != result.ExtrinsicHash {
		t.Errorf("JSON round trip ExtrinsicHash = %v, want %v", recovered.ExtrinsicHash, result.ExtrinsicHash)
	}
	if recovered.BlockNumber != result.BlockNumber {
		t.Errorf("JSON round trip BlockNumber = %v, want %v", recovered.BlockNumber, result.BlockNumber)
	}
	if recovered.Success != result.Success {
		t.Errorf("JSON round trip Success = %v, want %v", recovered.Success, result.Success)
	}
}

func TestParsedAssetTransferStruct(t *testing.T) {
	transfer := &ParsedAssetTransfer{
		AssetID: 1984,
		From:    "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
		To:      "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
		Amount:  "1000000",
		Success: true,
	}

	// Marshal to JSON
	jsonBytes, err := json.Marshal(transfer)
	if err != nil {
		t.Fatalf("json.Marshal() error: %v", err)
	}

	// Unmarshal back
	var recovered ParsedAssetTransfer
	if err := json.Unmarshal(jsonBytes, &recovered); err != nil {
		t.Fatalf("json.Unmarshal() error: %v", err)
	}

	if recovered.AssetID != transfer.AssetID {
		t.Errorf("JSON round trip AssetID = %v, want %v", recovered.AssetID, transfer.AssetID)
	}
	if recovered.From != transfer.From {
		t.Errorf("JSON round trip From = %v, want %v", recovered.From, transfer.From)
	}
}
