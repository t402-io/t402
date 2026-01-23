package polkadot

import (
	"context"
	"fmt"
	"testing"

	"github.com/t402-io/t402/sdks/go/types"
)

// mockClientSigner implements ClientPolkadotSigner for testing
type mockClientSigner struct {
	address         string
	result          *ClientExtrinsicResult
	err             error
	lastCall        ExtrinsicCall
	lastNetwork     string
	callCount       int
}

func (m *mockClientSigner) Address() string {
	return m.address
}

func (m *mockClientSigner) SignAndSubmitExtrinsic(ctx context.Context, call ExtrinsicCall, network string) (*ClientExtrinsicResult, error) {
	m.lastCall = call
	m.lastNetwork = network
	m.callCount++
	if m.err != nil {
		return nil, m.err
	}
	return m.result, nil
}

func TestExactDirectPolkadotClient_Scheme(t *testing.T) {
	signer := &mockClientSigner{address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5"}
	client := NewExactDirectPolkadotClient(signer)

	if client.Scheme() != SchemeExactDirect {
		t.Errorf("Scheme() = %v, want %v", client.Scheme(), SchemeExactDirect)
	}
}

func TestExactDirectPolkadotClient_CreatePaymentPayload(t *testing.T) {
	tests := []struct {
		name         string
		signer       *mockClientSigner
		requirements types.PaymentRequirements
		wantErr      bool
		errContains  string
		validate     func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner)
	}{
		{
			name: "successful payment on Polkadot Asset Hub",
			signer: &mockClientSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
				result: &ClientExtrinsicResult{
					ExtrinsicHash:  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
					BlockHash:      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
					ExtrinsicIndex: 2,
				},
			},
			requirements: types.PaymentRequirements{
				Scheme:  SchemeExactDirect,
				Network: PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "1000000",
				Extra: map[string]interface{}{
					"assetId": float64(1984),
				},
			},
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				if payload.T402Version != 2 {
					t.Errorf("T402Version = %v, want 2", payload.T402Version)
				}
				if payload.Payload["extrinsicHash"] != "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" {
					t.Errorf("extrinsicHash = %v, want correct hash", payload.Payload["extrinsicHash"])
				}
				if payload.Payload["blockHash"] != "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" {
					t.Errorf("blockHash = %v, want correct hash", payload.Payload["blockHash"])
				}
				if payload.Payload["extrinsicIndex"] != 2 {
					t.Errorf("extrinsicIndex = %v, want 2", payload.Payload["extrinsicIndex"])
				}
				if payload.Payload["from"] != "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5" {
					t.Errorf("from = %v, want signer address", payload.Payload["from"])
				}
				if payload.Payload["to"] != "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3" {
					t.Errorf("to = %v, want payTo address", payload.Payload["to"])
				}
				if payload.Payload["amount"] != "1000000" {
					t.Errorf("amount = %v, want 1000000", payload.Payload["amount"])
				}
				if payload.Payload["assetId"] != 1984 {
					t.Errorf("assetId = %v, want 1984", payload.Payload["assetId"])
				}
				// Verify the signer was called with correct parameters
				if signer.lastCall.AssetID != 1984 {
					t.Errorf("signer called with AssetID = %v, want 1984", signer.lastCall.AssetID)
				}
				if signer.lastCall.Target != "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3" {
					t.Errorf("signer called with Target = %v, want payTo address", signer.lastCall.Target)
				}
				if signer.lastCall.Amount != "1000000" {
					t.Errorf("signer called with Amount = %v, want 1000000", signer.lastCall.Amount)
				}
				if signer.lastNetwork != PolkadotAssetHubCAIP2 {
					t.Errorf("signer called with network = %v, want %v", signer.lastNetwork, PolkadotAssetHubCAIP2)
				}
			},
		},
		{
			name: "successful payment on Westend Asset Hub",
			signer: &mockClientSigner{
				address: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
				result: &ClientExtrinsicResult{
					ExtrinsicHash:  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
					BlockHash:      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
					ExtrinsicIndex: 0,
				},
			},
			requirements: types.PaymentRequirements{
				Scheme:  SchemeExactDirect,
				Network: WestendAssetHubCAIP2,
				PayTo:   "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
				Amount:  "500000",
			},
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				if payload.T402Version != 2 {
					t.Errorf("T402Version = %v, want 2", payload.T402Version)
				}
				// Should use default USDT asset ID (1984) when no assetId in extra
				if payload.Payload["assetId"] != 1984 {
					t.Errorf("assetId = %v, want 1984 (default)", payload.Payload["assetId"])
				}
				if signer.lastNetwork != WestendAssetHubCAIP2 {
					t.Errorf("network = %v, want %v", signer.lastNetwork, WestendAssetHubCAIP2)
				}
			},
		},
		{
			name: "successful payment with CAIP-19 asset identifier",
			signer: &mockClientSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
				result: &ClientExtrinsicResult{
					ExtrinsicHash:  "0x1111111111111111111111111111111111111111111111111111111111111111",
					BlockHash:      "0x2222222222222222222222222222222222222222222222222222222222222222",
					ExtrinsicIndex: 1,
				},
			},
			requirements: types.PaymentRequirements{
				Scheme:  SchemeExactDirect,
				Network: PolkadotAssetHubCAIP2,
				Asset:   "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984",
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "2000000",
			},
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				if signer.lastCall.AssetID != 1984 {
					t.Errorf("signer called with AssetID = %v, want 1984", signer.lastCall.AssetID)
				}
			},
		},
		{
			name: "error - unsupported network",
			signer: &mockClientSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
			},
			requirements: types.PaymentRequirements{
				Network: "eip155:1",
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "1000000",
			},
			wantErr:     true,
			errContains: "unsupported network",
		},
		{
			name: "error - unknown polkadot network",
			signer: &mockClientSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
			},
			requirements: types.PaymentRequirements{
				Network: "polkadot:unknowngenesishash12345678901234",
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "1000000",
			},
			wantErr:     true,
			errContains: "unknown polkadot network",
		},
		{
			name: "error - missing payTo",
			signer: &mockClientSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
			},
			requirements: types.PaymentRequirements{
				Network: PolkadotAssetHubCAIP2,
				Amount:  "1000000",
			},
			wantErr:     true,
			errContains: "payTo address is required",
		},
		{
			name: "error - missing amount",
			signer: &mockClientSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
			},
			requirements: types.PaymentRequirements{
				Network: PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
			},
			wantErr:     true,
			errContains: "amount is required",
		},
		{
			name: "error - invalid payTo address",
			signer: &mockClientSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
			},
			requirements: types.PaymentRequirements{
				Network: PolkadotAssetHubCAIP2,
				PayTo:   "0x1234567890abcdef",
				Amount:  "1000000",
			},
			wantErr:     true,
			errContains: "invalid payTo address",
		},
		{
			name: "error - invalid amount format",
			signer: &mockClientSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
			},
			requirements: types.PaymentRequirements{
				Network: PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "not-a-number",
			},
			wantErr:     true,
			errContains: "invalid amount format",
		},
		{
			name: "error - zero amount",
			signer: &mockClientSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
			},
			requirements: types.PaymentRequirements{
				Network: PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "0",
			},
			wantErr:     true,
			errContains: "amount must be positive",
		},
		{
			name: "error - negative amount",
			signer: &mockClientSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
			},
			requirements: types.PaymentRequirements{
				Network: PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "-1000000",
			},
			wantErr:     true,
			errContains: "amount must be positive",
		},
		{
			name: "error - signer returns error",
			signer: &mockClientSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
				err:     fmt.Errorf("insufficient balance"),
			},
			requirements: types.PaymentRequirements{
				Network: PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "1000000",
			},
			wantErr:     true,
			errContains: "failed to sign and submit extrinsic",
		},
		{
			name: "error - empty signer address",
			signer: &mockClientSigner{
				address: "",
				result: &ClientExtrinsicResult{
					ExtrinsicHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
				},
			},
			requirements: types.PaymentRequirements{
				Network: PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "1000000",
			},
			wantErr:     true,
			errContains: "signer address is empty",
		},
		{
			name: "error - result missing both hashes",
			signer: &mockClientSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
				result: &ClientExtrinsicResult{
					ExtrinsicHash:  "",
					BlockHash:      "",
					ExtrinsicIndex: 0,
				},
			},
			requirements: types.PaymentRequirements{
				Network: PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "1000000",
			},
			wantErr:     true,
			errContains: "extrinsic result missing both",
		},
		{
			name: "successful with only block hash (no extrinsic hash)",
			signer: &mockClientSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
				result: &ClientExtrinsicResult{
					ExtrinsicHash:  "",
					BlockHash:      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
					ExtrinsicIndex: 3,
				},
			},
			requirements: types.PaymentRequirements{
				Network: PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "1000000",
			},
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				if payload.Payload["extrinsicHash"] != "" {
					t.Errorf("extrinsicHash should be empty, got %v", payload.Payload["extrinsicHash"])
				}
				if payload.Payload["blockHash"] != "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890" {
					t.Errorf("blockHash incorrect")
				}
				if payload.Payload["extrinsicIndex"] != 3 {
					t.Errorf("extrinsicIndex = %v, want 3", payload.Payload["extrinsicIndex"])
				}
			},
		},
		{
			name: "asset ID from int value in extra",
			signer: &mockClientSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
				result: &ClientExtrinsicResult{
					ExtrinsicHash:  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
					BlockHash:      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
					ExtrinsicIndex: 0,
				},
			},
			requirements: types.PaymentRequirements{
				Network: PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "5000000",
				Extra: map[string]interface{}{
					"assetId": 1984,
				},
			},
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				if signer.lastCall.AssetID != 1984 {
					t.Errorf("AssetID = %v, want 1984", signer.lastCall.AssetID)
				}
			},
		},
		{
			name: "asset ID from string value in extra",
			signer: &mockClientSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
				result: &ClientExtrinsicResult{
					ExtrinsicHash:  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
					BlockHash:      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
					ExtrinsicIndex: 0,
				},
			},
			requirements: types.PaymentRequirements{
				Network: PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "5000000",
				Extra: map[string]interface{}{
					"assetId": "1984",
				},
			},
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				if signer.lastCall.AssetID != 1984 {
					t.Errorf("AssetID = %v, want 1984", signer.lastCall.AssetID)
				}
			},
		},
		{
			name: "large amount value",
			signer: &mockClientSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
				result: &ClientExtrinsicResult{
					ExtrinsicHash:  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
					BlockHash:      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
					ExtrinsicIndex: 0,
				},
			},
			requirements: types.PaymentRequirements{
				Network: PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "999999999999999999",
			},
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockClientSigner) {
				if payload.Payload["amount"] != "999999999999999999" {
					t.Errorf("amount = %v, want 999999999999999999", payload.Payload["amount"])
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := NewExactDirectPolkadotClient(tt.signer)
			payload, err := client.CreatePaymentPayload(context.Background(), tt.requirements)

			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				if tt.errContains != "" && !contains(err.Error(), tt.errContains) {
					t.Errorf("error = %v, want to contain %v", err.Error(), tt.errContains)
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if tt.validate != nil {
				tt.validate(t, payload, tt.signer)
			}
		})
	}
}

func TestExactDirectPolkadotClient_WithConfig(t *testing.T) {
	signer := &mockClientSigner{
		address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
		result: &ClientExtrinsicResult{
			ExtrinsicHash:  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			BlockHash:      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
			ExtrinsicIndex: 0,
		},
	}

	config := &ClientConfig{
		RPCURL: "wss://custom-rpc.example.com",
	}

	client := NewExactDirectPolkadotClient(signer, config)

	if client.config != config {
		t.Error("config was not set correctly")
	}
	if client.config.RPCURL != "wss://custom-rpc.example.com" {
		t.Errorf("RPCURL = %v, want wss://custom-rpc.example.com", client.config.RPCURL)
	}
}

func TestExactDirectPolkadotClient_NoConfig(t *testing.T) {
	signer := &mockClientSigner{
		address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
	}

	client := NewExactDirectPolkadotClient(signer)

	if client.config != nil {
		t.Error("config should be nil when not provided")
	}
}

func TestParseAssetIdentifier(t *testing.T) {
	tests := []struct {
		name    string
		asset   string
		wantID  int
		wantErr bool
	}{
		{
			name:   "valid CAIP-19 identifier",
			asset:  "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984",
			wantID: 1984,
		},
		{
			name:   "valid identifier with different asset ID",
			asset:  "polkadot:e143f23803ac50e8f6f8e62695d1ce9e/asset:100",
			wantID: 100,
		},
		{
			name:   "valid identifier with large asset ID",
			asset:  "polkadot:68d56f15f85d3136970ec16946040bc1/asset:999999",
			wantID: 999999,
		},
		{
			name:    "missing /asset: prefix",
			asset:   "polkadot:68d56f15f85d3136970ec16946040bc1",
			wantErr: true,
		},
		{
			name:    "invalid asset ID (not a number)",
			asset:   "polkadot:68d56f15f85d3136970ec16946040bc1/asset:abc",
			wantErr: true,
		},
		{
			name:    "empty string",
			asset:   "",
			wantErr: true,
		},
		{
			name:   "asset ID zero",
			asset:  "polkadot:68d56f15f85d3136970ec16946040bc1/asset:0",
			wantID: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			id, err := ParseAssetIdentifier(tt.asset)
			if tt.wantErr {
				if err == nil {
					t.Errorf("ParseAssetIdentifier(%v) expected error, got nil", tt.asset)
				}
				return
			}
			if err != nil {
				t.Fatalf("ParseAssetIdentifier(%v) unexpected error: %v", tt.asset, err)
			}
			if id != tt.wantID {
				t.Errorf("ParseAssetIdentifier(%v) = %v, want %v", tt.asset, id, tt.wantID)
			}
		})
	}
}

func TestExactDirectPolkadotClient_ResolveAssetID(t *testing.T) {
	tests := []struct {
		name         string
		requirements types.PaymentRequirements
		wantID       int
		wantErr      bool
	}{
		{
			name: "from extra float64",
			requirements: types.PaymentRequirements{
				Network: PolkadotAssetHubCAIP2,
				Extra:   map[string]interface{}{"assetId": float64(1984)},
			},
			wantID: 1984,
		},
		{
			name: "from extra int",
			requirements: types.PaymentRequirements{
				Network: PolkadotAssetHubCAIP2,
				Extra:   map[string]interface{}{"assetId": 1984},
			},
			wantID: 1984,
		},
		{
			name: "from extra string",
			requirements: types.PaymentRequirements{
				Network: PolkadotAssetHubCAIP2,
				Extra:   map[string]interface{}{"assetId": "1984"},
			},
			wantID: 1984,
		},
		{
			name: "from CAIP-19 asset field",
			requirements: types.PaymentRequirements{
				Network: PolkadotAssetHubCAIP2,
				Asset:   "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984",
			},
			wantID: 1984,
		},
		{
			name: "default from network config",
			requirements: types.PaymentRequirements{
				Network: PolkadotAssetHubCAIP2,
			},
			wantID: 1984, // Default USDT
		},
		{
			name: "default from Westend network config",
			requirements: types.PaymentRequirements{
				Network: WestendAssetHubCAIP2,
			},
			wantID: 1984, // Default USDT
		},
		{
			name: "extra takes priority over asset field",
			requirements: types.PaymentRequirements{
				Network: PolkadotAssetHubCAIP2,
				Asset:   "polkadot:68d56f15f85d3136970ec16946040bc1/asset:100",
				Extra:   map[string]interface{}{"assetId": float64(1984)},
			},
			wantID: 1984, // Extra takes priority
		},
		{
			name: "error for unknown network without asset info",
			requirements: types.PaymentRequirements{
				Network: "polkadot:unknownhash",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			client := &ExactDirectPolkadotClient{}
			id, err := client.resolveAssetID(tt.requirements)
			if tt.wantErr {
				if err == nil {
					t.Errorf("resolveAssetID() expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("resolveAssetID() unexpected error: %v", err)
			}
			if id != tt.wantID {
				t.Errorf("resolveAssetID() = %v, want %v", id, tt.wantID)
			}
		})
	}
}

func TestExactDirectPolkadotClient_SignerCalledOnce(t *testing.T) {
	signer := &mockClientSigner{
		address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
		result: &ClientExtrinsicResult{
			ExtrinsicHash:  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			BlockHash:      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
			ExtrinsicIndex: 0,
		},
	}

	client := NewExactDirectPolkadotClient(signer)
	_, err := client.CreatePaymentPayload(context.Background(), types.PaymentRequirements{
		Network: PolkadotAssetHubCAIP2,
		PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
		Amount:  "1000000",
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if signer.callCount != 1 {
		t.Errorf("signer.SignAndSubmitExtrinsic called %d times, want 1", signer.callCount)
	}
}

// contains checks if substr is in s (helper for error matching)
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
