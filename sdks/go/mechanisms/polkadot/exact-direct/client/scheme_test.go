package client

import (
	"context"
	"fmt"
	"testing"

	"github.com/t402-io/t402/sdks/go/mechanisms/polkadot"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockSigner implements ClientPolkadotSigner for testing
type mockSigner struct {
	address     string
	result      *polkadot.ClientExtrinsicResult
	err         error
	lastCall    polkadot.ExtrinsicCall
	lastNetwork string
	callCount   int
}

func (m *mockSigner) Address() string {
	return m.address
}

func (m *mockSigner) SignAndSubmitExtrinsic(ctx context.Context, call polkadot.ExtrinsicCall, network string) (*polkadot.ClientExtrinsicResult, error) {
	m.lastCall = call
	m.lastNetwork = network
	m.callCount++
	if m.err != nil {
		return nil, m.err
	}
	return m.result, nil
}

func TestScheme(t *testing.T) {
	signer := &mockSigner{address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5"}
	scheme := NewExactDirectPolkadotScheme(signer, nil)

	if scheme.Scheme() != "exact-direct" {
		t.Errorf("Scheme() = %v, want exact-direct", scheme.Scheme())
	}
}

func TestCreatePaymentPayload_Success(t *testing.T) {
	tests := []struct {
		name         string
		signer       *mockSigner
		requirements types.PaymentRequirements
		validate     func(t *testing.T, payload types.PaymentPayload, signer *mockSigner)
	}{
		{
			name: "successful payment on Polkadot Asset Hub",
			signer: &mockSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
				result: &polkadot.ClientExtrinsicResult{
					ExtrinsicHash:  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
					BlockHash:      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
					ExtrinsicIndex: 2,
				},
			},
			requirements: types.PaymentRequirements{
				Scheme:  polkadot.SchemeExactDirect,
				Network: polkadot.PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "1000000",
				Extra: map[string]interface{}{
					"assetId": float64(1984),
				},
			},
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockSigner) {
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
				// Verify signer was called with correct parameters
				if signer.lastCall.AssetID != 1984 {
					t.Errorf("signer called with AssetID = %v, want 1984", signer.lastCall.AssetID)
				}
				if signer.lastCall.Target != "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3" {
					t.Errorf("signer called with Target = %v, want payTo address", signer.lastCall.Target)
				}
				if signer.lastCall.Amount != "1000000" {
					t.Errorf("signer called with Amount = %v, want 1000000", signer.lastCall.Amount)
				}
				if signer.lastNetwork != polkadot.PolkadotAssetHubCAIP2 {
					t.Errorf("signer called with network = %v, want %v", signer.lastNetwork, polkadot.PolkadotAssetHubCAIP2)
				}
			},
		},
		{
			name: "successful payment on Westend Asset Hub",
			signer: &mockSigner{
				address: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
				result: &polkadot.ClientExtrinsicResult{
					ExtrinsicHash:  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
					BlockHash:      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
					ExtrinsicIndex: 0,
				},
			},
			requirements: types.PaymentRequirements{
				Scheme:  polkadot.SchemeExactDirect,
				Network: polkadot.WestendAssetHubCAIP2,
				PayTo:   "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
				Amount:  "500000",
			},
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockSigner) {
				if payload.T402Version != 2 {
					t.Errorf("T402Version = %v, want 2", payload.T402Version)
				}
				// Should use default USDT asset ID (1984) when no assetId in extra
				if payload.Payload["assetId"] != 1984 {
					t.Errorf("assetId = %v, want 1984 (default)", payload.Payload["assetId"])
				}
				if signer.lastNetwork != polkadot.WestendAssetHubCAIP2 {
					t.Errorf("network = %v, want %v", signer.lastNetwork, polkadot.WestendAssetHubCAIP2)
				}
			},
		},
		{
			name: "successful payment with CAIP-19 asset identifier",
			signer: &mockSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
				result: &polkadot.ClientExtrinsicResult{
					ExtrinsicHash:  "0x1111111111111111111111111111111111111111111111111111111111111111",
					BlockHash:      "0x2222222222222222222222222222222222222222222222222222222222222222",
					ExtrinsicIndex: 1,
				},
			},
			requirements: types.PaymentRequirements{
				Scheme:  polkadot.SchemeExactDirect,
				Network: polkadot.PolkadotAssetHubCAIP2,
				Asset:   "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984",
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "2000000",
			},
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockSigner) {
				if signer.lastCall.AssetID != 1984 {
					t.Errorf("signer called with AssetID = %v, want 1984", signer.lastCall.AssetID)
				}
			},
		},
		{
			name: "successful with only block hash (no extrinsic hash)",
			signer: &mockSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
				result: &polkadot.ClientExtrinsicResult{
					ExtrinsicHash:  "",
					BlockHash:      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
					ExtrinsicIndex: 3,
				},
			},
			requirements: types.PaymentRequirements{
				Scheme:  polkadot.SchemeExactDirect,
				Network: polkadot.PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "1000000",
			},
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockSigner) {
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
			signer: &mockSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
				result: &polkadot.ClientExtrinsicResult{
					ExtrinsicHash:  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
					BlockHash:      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
					ExtrinsicIndex: 0,
				},
			},
			requirements: types.PaymentRequirements{
				Scheme:  polkadot.SchemeExactDirect,
				Network: polkadot.PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "5000000",
				Extra: map[string]interface{}{
					"assetId": 1984,
				},
			},
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockSigner) {
				if signer.lastCall.AssetID != 1984 {
					t.Errorf("AssetID = %v, want 1984", signer.lastCall.AssetID)
				}
			},
		},
		{
			name: "asset ID from string value in extra",
			signer: &mockSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
				result: &polkadot.ClientExtrinsicResult{
					ExtrinsicHash:  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
					BlockHash:      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
					ExtrinsicIndex: 0,
				},
			},
			requirements: types.PaymentRequirements{
				Scheme:  polkadot.SchemeExactDirect,
				Network: polkadot.PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "5000000",
				Extra: map[string]interface{}{
					"assetId": "1984",
				},
			},
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockSigner) {
				if signer.lastCall.AssetID != 1984 {
					t.Errorf("AssetID = %v, want 1984", signer.lastCall.AssetID)
				}
			},
		},
		{
			name: "large amount value",
			signer: &mockSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
				result: &polkadot.ClientExtrinsicResult{
					ExtrinsicHash:  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
					BlockHash:      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
					ExtrinsicIndex: 0,
				},
			},
			requirements: types.PaymentRequirements{
				Scheme:  polkadot.SchemeExactDirect,
				Network: polkadot.PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "999999999999999999",
			},
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockSigner) {
				if payload.Payload["amount"] != "999999999999999999" {
					t.Errorf("amount = %v, want 999999999999999999", payload.Payload["amount"])
				}
			},
		},
		{
			name: "empty scheme in requirements is accepted",
			signer: &mockSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
				result: &polkadot.ClientExtrinsicResult{
					ExtrinsicHash:  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
					BlockHash:      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
					ExtrinsicIndex: 0,
				},
			},
			requirements: types.PaymentRequirements{
				Scheme:  "", // empty is acceptable
				Network: polkadot.PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "1000000",
			},
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockSigner) {
				if payload.T402Version != 2 {
					t.Errorf("T402Version = %v, want 2", payload.T402Version)
				}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := NewExactDirectPolkadotScheme(tt.signer, nil)
			payload, err := scheme.CreatePaymentPayload(context.Background(), tt.requirements)

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if tt.validate != nil {
				tt.validate(t, payload, tt.signer)
			}
		})
	}
}

func TestCreatePaymentPayload_Errors(t *testing.T) {
	tests := []struct {
		name         string
		signer       *mockSigner
		requirements types.PaymentRequirements
		wantErrMsg   string
	}{
		{
			name: "unsupported network (not polkadot)",
			signer: &mockSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
			},
			requirements: types.PaymentRequirements{
				Network: "eip155:1",
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "1000000",
			},
			wantErrMsg: "unsupported network",
		},
		{
			name: "unknown polkadot network",
			signer: &mockSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
			},
			requirements: types.PaymentRequirements{
				Network: "polkadot:unknowngenesishash12345678901234",
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "1000000",
			},
			wantErrMsg: "unknown polkadot network",
		},
		{
			name: "missing payTo",
			signer: &mockSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
			},
			requirements: types.PaymentRequirements{
				Scheme:  polkadot.SchemeExactDirect,
				Network: polkadot.PolkadotAssetHubCAIP2,
				Amount:  "1000000",
			},
			wantErrMsg: "payTo address is required",
		},
		{
			name: "invalid payTo address",
			signer: &mockSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
			},
			requirements: types.PaymentRequirements{
				Scheme:  polkadot.SchemeExactDirect,
				Network: polkadot.PolkadotAssetHubCAIP2,
				PayTo:   "0x1234567890abcdef",
				Amount:  "1000000",
			},
			wantErrMsg: "invalid payTo address",
		},
		{
			name: "missing amount",
			signer: &mockSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
			},
			requirements: types.PaymentRequirements{
				Scheme:  polkadot.SchemeExactDirect,
				Network: polkadot.PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
			},
			wantErrMsg: "amount is required",
		},
		{
			name: "invalid amount format",
			signer: &mockSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
			},
			requirements: types.PaymentRequirements{
				Scheme:  polkadot.SchemeExactDirect,
				Network: polkadot.PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "not-a-number",
			},
			wantErrMsg: "invalid amount format",
		},
		{
			name: "zero amount",
			signer: &mockSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
			},
			requirements: types.PaymentRequirements{
				Scheme:  polkadot.SchemeExactDirect,
				Network: polkadot.PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "0",
			},
			wantErrMsg: "amount must be positive",
		},
		{
			name: "negative amount",
			signer: &mockSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
			},
			requirements: types.PaymentRequirements{
				Scheme:  polkadot.SchemeExactDirect,
				Network: polkadot.PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "-1000000",
			},
			wantErrMsg: "amount must be positive",
		},
		{
			name: "invalid scheme",
			signer: &mockSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact",
				Network: polkadot.PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "1000000",
			},
			wantErrMsg: "invalid scheme",
		},
		{
			name: "signer returns error",
			signer: &mockSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
				err:     fmt.Errorf("insufficient balance"),
			},
			requirements: types.PaymentRequirements{
				Scheme:  polkadot.SchemeExactDirect,
				Network: polkadot.PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "1000000",
			},
			wantErrMsg: "failed to sign and submit extrinsic",
		},
		{
			name: "empty signer address",
			signer: &mockSigner{
				address: "",
				result: &polkadot.ClientExtrinsicResult{
					ExtrinsicHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
				},
			},
			requirements: types.PaymentRequirements{
				Scheme:  polkadot.SchemeExactDirect,
				Network: polkadot.PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "1000000",
			},
			wantErrMsg: "signer address is empty",
		},
		{
			name: "result missing both hashes",
			signer: &mockSigner{
				address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
				result: &polkadot.ClientExtrinsicResult{
					ExtrinsicHash:  "",
					BlockHash:      "",
					ExtrinsicIndex: 0,
				},
			},
			requirements: types.PaymentRequirements{
				Scheme:  polkadot.SchemeExactDirect,
				Network: polkadot.PolkadotAssetHubCAIP2,
				PayTo:   "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3",
				Amount:  "1000000",
			},
			wantErrMsg: "extrinsic result missing both",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := NewExactDirectPolkadotScheme(tt.signer, nil)
			_, err := scheme.CreatePaymentPayload(context.Background(), tt.requirements)

			if err == nil {
				t.Fatalf("expected error, got nil")
			}
			if tt.wantErrMsg != "" && !contains(err.Error(), tt.wantErrMsg) {
				t.Errorf("error = %v, want to contain %v", err.Error(), tt.wantErrMsg)
			}
		})
	}
}

func TestCreatePaymentPayload_SignerCalledOnce(t *testing.T) {
	signer := &mockSigner{
		address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5",
		result: &polkadot.ClientExtrinsicResult{
			ExtrinsicHash:  "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			BlockHash:      "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
			ExtrinsicIndex: 0,
		},
	}

	scheme := NewExactDirectPolkadotScheme(signer, nil)
	_, err := scheme.CreatePaymentPayload(context.Background(), types.PaymentRequirements{
		Scheme:  polkadot.SchemeExactDirect,
		Network: polkadot.PolkadotAssetHubCAIP2,
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

func TestNewExactDirectPolkadotScheme_DefaultConfig(t *testing.T) {
	signer := &mockSigner{address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5"}
	scheme := NewExactDirectPolkadotScheme(signer, nil)

	if scheme.config.RPCURL != "" {
		t.Errorf("Default RPCURL = %v, want empty", scheme.config.RPCURL)
	}
}

func TestNewExactDirectPolkadotScheme_CustomConfig(t *testing.T) {
	signer := &mockSigner{address: "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5"}
	config := &ExactDirectPolkadotClientConfig{
		RPCURL: "wss://custom-rpc.example.com",
	}
	scheme := NewExactDirectPolkadotScheme(signer, config)

	if scheme.config.RPCURL != "wss://custom-rpc.example.com" {
		t.Errorf("RPCURL = %v, want wss://custom-rpc.example.com", scheme.config.RPCURL)
	}
}

func TestResolveAssetID(t *testing.T) {
	tests := []struct {
		name         string
		requirements types.PaymentRequirements
		wantID       int
		wantErr      bool
	}{
		{
			name: "from extra float64",
			requirements: types.PaymentRequirements{
				Network: polkadot.PolkadotAssetHubCAIP2,
				Extra:   map[string]interface{}{"assetId": float64(1984)},
			},
			wantID: 1984,
		},
		{
			name: "from extra int",
			requirements: types.PaymentRequirements{
				Network: polkadot.PolkadotAssetHubCAIP2,
				Extra:   map[string]interface{}{"assetId": 1984},
			},
			wantID: 1984,
		},
		{
			name: "from extra string",
			requirements: types.PaymentRequirements{
				Network: polkadot.PolkadotAssetHubCAIP2,
				Extra:   map[string]interface{}{"assetId": "1984"},
			},
			wantID: 1984,
		},
		{
			name: "from CAIP-19 asset field",
			requirements: types.PaymentRequirements{
				Network: polkadot.PolkadotAssetHubCAIP2,
				Asset:   "polkadot:68d56f15f85d3136970ec16946040bc1/asset:1984",
			},
			wantID: 1984,
		},
		{
			name: "default from network config",
			requirements: types.PaymentRequirements{
				Network: polkadot.PolkadotAssetHubCAIP2,
			},
			wantID: 1984, // Default USDT
		},
		{
			name: "default from Westend network config",
			requirements: types.PaymentRequirements{
				Network: polkadot.WestendAssetHubCAIP2,
			},
			wantID: 1984, // Default USDT
		},
		{
			name: "extra takes priority over asset field",
			requirements: types.PaymentRequirements{
				Network: polkadot.PolkadotAssetHubCAIP2,
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
			scheme := &ExactDirectPolkadotScheme{}
			id, err := scheme.resolveAssetID(tt.requirements)
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
			id, err := parseAssetIdentifier(tt.asset)
			if tt.wantErr {
				if err == nil {
					t.Errorf("parseAssetIdentifier(%v) expected error, got nil", tt.asset)
				}
				return
			}
			if err != nil {
				t.Fatalf("parseAssetIdentifier(%v) unexpected error: %v", tt.asset, err)
			}
			if id != tt.wantID {
				t.Errorf("parseAssetIdentifier(%v) = %v, want %v", tt.asset, id, tt.wantID)
			}
		})
	}
}

// contains checks if substr is in s (helper for error matching)
func contains(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
