package client

import (
	"context"
	"fmt"
	"math/big"
	"testing"

	"github.com/t402-io/t402/sdks/go/mechanisms/stacks"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockSigner implements ClientStacksSigner for testing
type mockSigner struct {
	address         string
	txId            string
	err             error
	lastContract    string
	lastTo          string
	lastAmount      *big.Int
	callCount       int
}

func (m *mockSigner) Address() string {
	return m.address
}

func (m *mockSigner) TransferToken(ctx context.Context, contractAddress, to string, amount *big.Int) (string, error) {
	m.lastContract = contractAddress
	m.lastTo = to
	m.lastAmount = amount
	m.callCount++
	if m.err != nil {
		return "", m.err
	}
	return m.txId, nil
}

func TestScheme(t *testing.T) {
	signer := &mockSigner{address: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K"}
	scheme := NewExactDirectStacksScheme(signer, nil)

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
			name: "successful payment on Stacks Mainnet",
			signer: &mockSigner{
				address: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
				txId:    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			},
			requirements: types.PaymentRequirements{
				Scheme:  stacks.SchemeExactDirect,
				Network: stacks.StacksMainnetCAIP2,
				PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
				Amount:  "1000000",
				Extra: map[string]interface{}{
					"contractAddress": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
				},
			},
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockSigner) {
				if payload.T402Version != 2 {
					t.Errorf("T402Version = %v, want 2", payload.T402Version)
				}
				if payload.Payload["txId"] != "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef" {
					t.Errorf("txId = %v, want correct hash", payload.Payload["txId"])
				}
				if payload.Payload["from"] != "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K" {
					t.Errorf("from = %v, want signer address", payload.Payload["from"])
				}
				if payload.Payload["to"] != "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7" {
					t.Errorf("to = %v, want payTo address", payload.Payload["to"])
				}
				if payload.Payload["amount"] != "1000000" {
					t.Errorf("amount = %v, want 1000000", payload.Payload["amount"])
				}
				if payload.Payload["contractAddress"] != "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc" {
					t.Errorf("contractAddress = %v, want mainnet contract", payload.Payload["contractAddress"])
				}
				// Verify signer was called with correct parameters
				if signer.lastContract != "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc" {
					t.Errorf("signer called with contract = %v, want mainnet contract", signer.lastContract)
				}
				if signer.lastTo != "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7" {
					t.Errorf("signer called with to = %v, want payTo", signer.lastTo)
				}
				expectedAmount := new(big.Int)
				expectedAmount.SetString("1000000", 10)
				if signer.lastAmount.Cmp(expectedAmount) != 0 {
					t.Errorf("signer called with amount = %v, want 1000000", signer.lastAmount)
				}
			},
		},
		{
			name: "successful payment on Stacks Testnet",
			signer: &mockSigner{
				address: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
				txId:    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			},
			requirements: types.PaymentRequirements{
				Scheme:  stacks.SchemeExactDirect,
				Network: stacks.StacksTestnetCAIP2,
				PayTo:   "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
				Amount:  "500000",
			},
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockSigner) {
				if payload.T402Version != 2 {
					t.Errorf("T402Version = %v, want 2", payload.T402Version)
				}
				// Should use default testnet contract when no contractAddress in extra
				if payload.Payload["contractAddress"] != "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.token-susdc" {
					t.Errorf("contractAddress = %v, want testnet contract", payload.Payload["contractAddress"])
				}
			},
		},
		{
			name: "successful payment with CAIP-19 asset identifier",
			signer: &mockSigner{
				address: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
				txId:    "0x1111111111111111111111111111111111111111111111111111111111111111",
			},
			requirements: types.PaymentRequirements{
				Scheme:  stacks.SchemeExactDirect,
				Network: stacks.StacksMainnetCAIP2,
				Asset:   "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
				PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
				Amount:  "2000000",
			},
			validate: func(t *testing.T, payload types.PaymentPayload, signer *mockSigner) {
				if signer.lastContract != "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc" {
					t.Errorf("signer called with contract = %v, want contract from asset field", signer.lastContract)
				}
			},
		},
		{
			name: "large amount value",
			signer: &mockSigner{
				address: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
				txId:    "0x2222222222222222222222222222222222222222222222222222222222222222",
			},
			requirements: types.PaymentRequirements{
				Scheme:  stacks.SchemeExactDirect,
				Network: stacks.StacksMainnetCAIP2,
				PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
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
				address: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
				txId:    "0x3333333333333333333333333333333333333333333333333333333333333333",
			},
			requirements: types.PaymentRequirements{
				Scheme:  "", // empty is acceptable
				Network: stacks.StacksMainnetCAIP2,
				PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
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
			scheme := NewExactDirectStacksScheme(tt.signer, nil)
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
			name: "unsupported network (not stacks)",
			signer: &mockSigner{
				address: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
			},
			requirements: types.PaymentRequirements{
				Network: "eip155:1",
				PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
				Amount:  "1000000",
			},
			wantErrMsg: "unsupported network",
		},
		{
			name: "unknown stacks network",
			signer: &mockSigner{
				address: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
			},
			requirements: types.PaymentRequirements{
				Network: "stacks:99999",
				PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
				Amount:  "1000000",
			},
			wantErrMsg: "unknown stacks network",
		},
		{
			name: "missing payTo",
			signer: &mockSigner{
				address: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
			},
			requirements: types.PaymentRequirements{
				Scheme:  stacks.SchemeExactDirect,
				Network: stacks.StacksMainnetCAIP2,
				Amount:  "1000000",
			},
			wantErrMsg: "payTo address is required",
		},
		{
			name: "invalid payTo address",
			signer: &mockSigner{
				address: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
			},
			requirements: types.PaymentRequirements{
				Scheme:  stacks.SchemeExactDirect,
				Network: stacks.StacksMainnetCAIP2,
				PayTo:   "0x1234567890abcdef",
				Amount:  "1000000",
			},
			wantErrMsg: "invalid payTo address",
		},
		{
			name: "missing amount",
			signer: &mockSigner{
				address: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
			},
			requirements: types.PaymentRequirements{
				Scheme:  stacks.SchemeExactDirect,
				Network: stacks.StacksMainnetCAIP2,
				PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
			},
			wantErrMsg: "amount is required",
		},
		{
			name: "invalid amount format",
			signer: &mockSigner{
				address: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
			},
			requirements: types.PaymentRequirements{
				Scheme:  stacks.SchemeExactDirect,
				Network: stacks.StacksMainnetCAIP2,
				PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
				Amount:  "not-a-number",
			},
			wantErrMsg: "invalid amount format",
		},
		{
			name: "zero amount",
			signer: &mockSigner{
				address: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
			},
			requirements: types.PaymentRequirements{
				Scheme:  stacks.SchemeExactDirect,
				Network: stacks.StacksMainnetCAIP2,
				PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
				Amount:  "0",
			},
			wantErrMsg: "amount must be positive",
		},
		{
			name: "negative amount",
			signer: &mockSigner{
				address: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
			},
			requirements: types.PaymentRequirements{
				Scheme:  stacks.SchemeExactDirect,
				Network: stacks.StacksMainnetCAIP2,
				PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
				Amount:  "-1000000",
			},
			wantErrMsg: "amount must be positive",
		},
		{
			name: "invalid scheme",
			signer: &mockSigner{
				address: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
			},
			requirements: types.PaymentRequirements{
				Scheme:  "exact",
				Network: stacks.StacksMainnetCAIP2,
				PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
				Amount:  "1000000",
			},
			wantErrMsg: "invalid scheme",
		},
		{
			name: "signer returns error",
			signer: &mockSigner{
				address: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
				err:     fmt.Errorf("insufficient balance"),
			},
			requirements: types.PaymentRequirements{
				Scheme:  stacks.SchemeExactDirect,
				Network: stacks.StacksMainnetCAIP2,
				PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
				Amount:  "1000000",
			},
			wantErrMsg: "failed to execute transfer",
		},
		{
			name: "empty signer address",
			signer: &mockSigner{
				address: "",
				txId:    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			},
			requirements: types.PaymentRequirements{
				Scheme:  stacks.SchemeExactDirect,
				Network: stacks.StacksMainnetCAIP2,
				PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
				Amount:  "1000000",
			},
			wantErrMsg: "signer address is empty",
		},
		{
			name: "signer returns empty tx id",
			signer: &mockSigner{
				address: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
				txId:    "",
			},
			requirements: types.PaymentRequirements{
				Scheme:  stacks.SchemeExactDirect,
				Network: stacks.StacksMainnetCAIP2,
				PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
				Amount:  "1000000",
			},
			wantErrMsg: "transfer returned empty transaction ID",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := NewExactDirectStacksScheme(tt.signer, nil)
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
		address: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
		txId:    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
	}

	scheme := NewExactDirectStacksScheme(signer, nil)
	_, err := scheme.CreatePaymentPayload(context.Background(), types.PaymentRequirements{
		Scheme:  stacks.SchemeExactDirect,
		Network: stacks.StacksMainnetCAIP2,
		PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
		Amount:  "1000000",
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if signer.callCount != 1 {
		t.Errorf("signer.TransferToken called %d times, want 1", signer.callCount)
	}
}

func TestNewExactDirectStacksScheme_DefaultConfig(t *testing.T) {
	signer := &mockSigner{address: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K"}
	scheme := NewExactDirectStacksScheme(signer, nil)

	if scheme.config.ApiURL != "" {
		t.Errorf("Default ApiURL = %v, want empty", scheme.config.ApiURL)
	}
}

func TestNewExactDirectStacksScheme_CustomConfig(t *testing.T) {
	signer := &mockSigner{address: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K"}
	config := &ExactDirectStacksClientConfig{
		ApiURL: "https://custom-api.example.com",
	}
	scheme := NewExactDirectStacksScheme(signer, config)

	if scheme.config.ApiURL != "https://custom-api.example.com" {
		t.Errorf("ApiURL = %v, want https://custom-api.example.com", scheme.config.ApiURL)
	}
}

func TestResolveContractAddress(t *testing.T) {
	tests := []struct {
		name         string
		requirements types.PaymentRequirements
		wantAddr     string
		wantErr      bool
	}{
		{
			name: "from extra field",
			requirements: types.PaymentRequirements{
				Network: stacks.StacksMainnetCAIP2,
				Extra: map[string]interface{}{
					"contractAddress": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.custom-token",
				},
			},
			wantAddr: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.custom-token",
		},
		{
			name: "from CAIP-19 asset field",
			requirements: types.PaymentRequirements{
				Network: stacks.StacksMainnetCAIP2,
				Asset:   "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
			},
			wantAddr: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
		},
		{
			name: "default from mainnet network config",
			requirements: types.PaymentRequirements{
				Network: stacks.StacksMainnetCAIP2,
			},
			wantAddr: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
		},
		{
			name: "default from testnet network config",
			requirements: types.PaymentRequirements{
				Network: stacks.StacksTestnetCAIP2,
			},
			wantAddr: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.token-susdc",
		},
		{
			name: "extra takes priority over asset field",
			requirements: types.PaymentRequirements{
				Network: stacks.StacksMainnetCAIP2,
				Asset:   "stacks:1/token:SP000000000000000000000000000000000.other-token",
				Extra: map[string]interface{}{
					"contractAddress": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
				},
			},
			wantAddr: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
		},
		{
			name: "error for unknown network without contract info",
			requirements: types.PaymentRequirements{
				Network: "stacks:99999",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := &ExactDirectStacksScheme{}
			addr, err := scheme.resolveContractAddress(tt.requirements)
			if tt.wantErr {
				if err == nil {
					t.Errorf("resolveContractAddress() expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("resolveContractAddress() unexpected error: %v", err)
			}
			if addr != tt.wantAddr {
				t.Errorf("resolveContractAddress() = %v, want %v", addr, tt.wantAddr)
			}
		})
	}
}

func TestParseAssetContract(t *testing.T) {
	tests := []struct {
		name    string
		asset   string
		wantAddr string
	}{
		{
			name:     "valid CAIP-19 identifier",
			asset:    "stacks:1/token:SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
			wantAddr: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
		},
		{
			name:     "testnet asset",
			asset:    "stacks:2147483648/token:ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.token-susdc",
			wantAddr: "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.token-susdc",
		},
		{
			name:     "missing /token: prefix",
			asset:    "stacks:1",
			wantAddr: "",
		},
		{
			name:     "empty string",
			asset:    "",
			wantAddr: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseAssetContract(tt.asset)
			if got != tt.wantAddr {
				t.Errorf("parseAssetContract(%v) = %v, want %v", tt.asset, got, tt.wantAddr)
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
