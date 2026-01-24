package facilitator

import (
	"context"
	"fmt"
	"testing"
	"time"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/stacks"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockFacilitatorSigner implements FacilitatorStacksSigner for testing
type mockFacilitatorSigner struct {
	addresses map[string][]string
	result    *stacks.StacksTransactionResult
	err       error
	lastTxId  string
}

func (m *mockFacilitatorSigner) GetAddresses(network string) []string {
	if addrs, ok := m.addresses[network]; ok {
		return addrs
	}
	return nil
}

func (m *mockFacilitatorSigner) QueryTransaction(ctx context.Context, txId string) (*stacks.StacksTransactionResult, error) {
	m.lastTxId = txId
	if m.err != nil {
		return nil, m.err
	}
	return m.result, nil
}

func TestScheme(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewExactDirectStacksScheme(signer, nil)

	if scheme.Scheme() != "exact-direct" {
		t.Errorf("Scheme() = %v, want exact-direct", scheme.Scheme())
	}
}

func TestCaipFamily(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewExactDirectStacksScheme(signer, nil)

	if scheme.CaipFamily() != "stacks:*" {
		t.Errorf("CaipFamily() = %v, want stacks:*", scheme.CaipFamily())
	}
}

func TestGetExtra(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewExactDirectStacksScheme(signer, nil)

	// Test mainnet
	extra := scheme.GetExtra(t402.Network(stacks.StacksMainnetCAIP2))
	if extra == nil {
		t.Fatal("GetExtra(mainnet) returned nil")
	}
	if extra["contractAddress"] != "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc" {
		t.Errorf("contractAddress = %v, want mainnet contract", extra["contractAddress"])
	}
	if extra["assetSymbol"] != "sUSDC" {
		t.Errorf("assetSymbol = %v, want sUSDC", extra["assetSymbol"])
	}
	if extra["assetDecimals"] != 6 {
		t.Errorf("assetDecimals = %v, want 6", extra["assetDecimals"])
	}
	if extra["networkName"] != "Stacks Mainnet" {
		t.Errorf("networkName = %v, want Stacks Mainnet", extra["networkName"])
	}

	// Test testnet
	extra = scheme.GetExtra(t402.Network(stacks.StacksTestnetCAIP2))
	if extra == nil {
		t.Fatal("GetExtra(testnet) returned nil")
	}
	if extra["networkName"] != "Stacks Testnet" {
		t.Errorf("networkName = %v, want Stacks Testnet", extra["networkName"])
	}

	// Test unknown network
	extra = scheme.GetExtra(t402.Network("stacks:99999"))
	if extra != nil {
		t.Errorf("GetExtra(unknown) = %v, want nil", extra)
	}
}

func TestGetSigners(t *testing.T) {
	signer := &mockFacilitatorSigner{
		addresses: map[string][]string{
			stacks.StacksMainnetCAIP2: {"SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K"},
			stacks.StacksTestnetCAIP2: {"ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM"},
		},
	}
	scheme := NewExactDirectStacksScheme(signer, nil)

	mainnetSigners := scheme.GetSigners(t402.Network(stacks.StacksMainnetCAIP2))
	if len(mainnetSigners) != 1 {
		t.Fatalf("GetSigners(mainnet) returned %d signers, want 1", len(mainnetSigners))
	}
	if mainnetSigners[0] != "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K" {
		t.Errorf("mainnet signer = %v, want mainnet address", mainnetSigners[0])
	}

	testnetSigners := scheme.GetSigners(t402.Network(stacks.StacksTestnetCAIP2))
	if len(testnetSigners) != 1 {
		t.Fatalf("GetSigners(testnet) returned %d signers, want 1", len(testnetSigners))
	}
	if testnetSigners[0] != "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM" {
		t.Errorf("testnet signer = %v, want testnet address", testnetSigners[0])
	}
}

func TestVerify_Success(t *testing.T) {
	txId := "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
	signer := &mockFacilitatorSigner{
		result: &stacks.StacksTransactionResult{
			TxId:          txId,
			TxStatus:      "success",
			TxType:        "contract_call",
			SenderAddress: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
			BurnBlockTime: time.Now().Unix(),
			ContractCall: &stacks.ContractCallInfo{
				ContractID:   "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
				FunctionName: "transfer",
				FunctionArgs: []stacks.FunctionArg{
					{Name: "amount", Type: "uint", Repr: "u1000000"},
					{Name: "recipient", Type: "principal", Repr: "'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7"},
				},
			},
		},
	}

	scheme := NewExactDirectStacksScheme(signer, nil)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"txId":            txId,
			"from":            "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
			"to":              "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
			"amount":          "1000000",
			"contractAddress": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
		},
		Accepted: types.PaymentRequirements{
			Scheme:  stacks.SchemeExactDirect,
			Network: stacks.StacksMainnetCAIP2,
		},
	}

	requirements := types.PaymentRequirements{
		Scheme:  stacks.SchemeExactDirect,
		Network: stacks.StacksMainnetCAIP2,
		PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
		Amount:  "1000000",
		Extra: map[string]interface{}{
			"contractAddress": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
		},
	}

	resp, err := scheme.Verify(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("Verify() error: %v", err)
	}
	if !resp.IsValid {
		t.Error("IsValid should be true")
	}
	if resp.Payer != "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K" {
		t.Errorf("Payer = %v, want sender address", resp.Payer)
	}
}

func TestVerify_AmountGreaterThanRequired(t *testing.T) {
	txId := "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
	signer := &mockFacilitatorSigner{
		result: &stacks.StacksTransactionResult{
			TxId:          txId,
			TxStatus:      "success",
			TxType:        "contract_call",
			SenderAddress: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
			BurnBlockTime: time.Now().Unix(),
			ContractCall: &stacks.ContractCallInfo{
				ContractID:   "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
				FunctionName: "transfer",
				FunctionArgs: []stacks.FunctionArg{
					{Name: "amount", Type: "uint", Repr: "u5000000"},
					{Name: "recipient", Type: "principal", Repr: "'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7"},
				},
			},
		},
	}

	scheme := NewExactDirectStacksScheme(signer, nil)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"txId":            txId,
			"from":            "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
			"to":              "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
			"amount":          "5000000",
			"contractAddress": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
		},
		Accepted: types.PaymentRequirements{
			Scheme:  stacks.SchemeExactDirect,
			Network: stacks.StacksMainnetCAIP2,
		},
	}

	requirements := types.PaymentRequirements{
		Scheme:  stacks.SchemeExactDirect,
		Network: stacks.StacksMainnetCAIP2,
		PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
		Amount:  "1000000", // Only require 1, but paying 5
	}

	resp, err := scheme.Verify(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("Verify() error: %v", err)
	}
	if !resp.IsValid {
		t.Error("IsValid should be true (overpayment accepted)")
	}
}

func TestVerify_Errors(t *testing.T) {
	validTxId := "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"

	tests := []struct {
		name        string
		signer      *mockFacilitatorSigner
		payload     types.PaymentPayload
		requirements types.PaymentRequirements
		wantReason  string
	}{
		{
			name:   "invalid scheme",
			signer: &mockFacilitatorSigner{},
			payload: types.PaymentPayload{
				Accepted: types.PaymentRequirements{
					Scheme:  "exact",
					Network: stacks.StacksMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: stacks.StacksMainnetCAIP2,
			},
			wantReason: "invalid_scheme",
		},
		{
			name:   "network mismatch",
			signer: &mockFacilitatorSigner{},
			payload: types.PaymentPayload{
				Accepted: types.PaymentRequirements{
					Scheme:  stacks.SchemeExactDirect,
					Network: stacks.StacksTestnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: stacks.StacksMainnetCAIP2,
			},
			wantReason: "network_mismatch",
		},
		{
			name:   "missing tx id",
			signer: &mockFacilitatorSigner{},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"from": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  stacks.SchemeExactDirect,
					Network: stacks.StacksMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: stacks.StacksMainnetCAIP2,
			},
			wantReason: "missing_tx_id",
		},
		{
			name:   "invalid tx id format",
			signer: &mockFacilitatorSigner{},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"txId": "invalid-tx-id",
					"from": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  stacks.SchemeExactDirect,
					Network: stacks.StacksMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: stacks.StacksMainnetCAIP2,
			},
			wantReason: "invalid_tx_id_format",
		},
		{
			name:   "missing from",
			signer: &mockFacilitatorSigner{},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"txId": validTxId,
				},
				Accepted: types.PaymentRequirements{
					Scheme:  stacks.SchemeExactDirect,
					Network: stacks.StacksMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: stacks.StacksMainnetCAIP2,
			},
			wantReason: "missing_from",
		},
		{
			name: "tx query error",
			signer: &mockFacilitatorSigner{
				err: fmt.Errorf("transaction not found"),
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"txId": validTxId,
					"from": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  stacks.SchemeExactDirect,
					Network: stacks.StacksMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: stacks.StacksMainnetCAIP2,
			},
			wantReason: "tx_not_found",
		},
		{
			name: "tx not successful (pending)",
			signer: &mockFacilitatorSigner{
				result: &stacks.StacksTransactionResult{
					TxStatus: "pending",
					TxType:   "contract_call",
				},
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"txId": validTxId,
					"from": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  stacks.SchemeExactDirect,
					Network: stacks.StacksMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: stacks.StacksMainnetCAIP2,
			},
			wantReason: "tx_not_successful",
		},
		{
			name: "not contract call",
			signer: &mockFacilitatorSigner{
				result: &stacks.StacksTransactionResult{
					TxStatus: "success",
					TxType:   "token_transfer",
				},
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"txId": validTxId,
					"from": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  stacks.SchemeExactDirect,
					Network: stacks.StacksMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: stacks.StacksMainnetCAIP2,
			},
			wantReason: "not_contract_call",
		},
		{
			name: "not token transfer function",
			signer: &mockFacilitatorSigner{
				result: &stacks.StacksTransactionResult{
					TxStatus:      "success",
					TxType:        "contract_call",
					SenderAddress: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
					BurnBlockTime: time.Now().Unix(),
					ContractCall: &stacks.ContractCallInfo{
						ContractID:   "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
						FunctionName: "mint",
					},
				},
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"txId": validTxId,
					"from": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  stacks.SchemeExactDirect,
					Network: stacks.StacksMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: stacks.StacksMainnetCAIP2,
				PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
				Amount:  "1000000",
			},
			wantReason: "not_token_transfer",
		},
		{
			name: "recipient mismatch",
			signer: &mockFacilitatorSigner{
				result: &stacks.StacksTransactionResult{
					TxStatus:      "success",
					TxType:        "contract_call",
					SenderAddress: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
					BurnBlockTime: time.Now().Unix(),
					ContractCall: &stacks.ContractCallInfo{
						ContractID:   "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
						FunctionName: "transfer",
						FunctionArgs: []stacks.FunctionArg{
							{Name: "amount", Type: "uint", Repr: "u1000000"},
							{Name: "recipient", Type: "principal", Repr: "'SP000WRONG0ADDRESS0000000000000000000"},
						},
					},
				},
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"txId": validTxId,
					"from": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  stacks.SchemeExactDirect,
					Network: stacks.StacksMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: stacks.StacksMainnetCAIP2,
				PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
				Amount:  "1000000",
			},
			wantReason: "recipient_mismatch",
		},
		{
			name: "insufficient amount",
			signer: &mockFacilitatorSigner{
				result: &stacks.StacksTransactionResult{
					TxStatus:      "success",
					TxType:        "contract_call",
					SenderAddress: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
					BurnBlockTime: time.Now().Unix(),
					ContractCall: &stacks.ContractCallInfo{
						ContractID:   "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
						FunctionName: "transfer",
						FunctionArgs: []stacks.FunctionArg{
							{Name: "amount", Type: "uint", Repr: "u500000"},
							{Name: "recipient", Type: "principal", Repr: "'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7"},
						},
					},
				},
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"txId": validTxId,
					"from": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  stacks.SchemeExactDirect,
					Network: stacks.StacksMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: stacks.StacksMainnetCAIP2,
				PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
				Amount:  "1000000",
			},
			wantReason: "insufficient_amount",
		},
		{
			name: "contract mismatch",
			signer: &mockFacilitatorSigner{
				result: &stacks.StacksTransactionResult{
					TxStatus:      "success",
					TxType:        "contract_call",
					SenderAddress: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
					BurnBlockTime: time.Now().Unix(),
					ContractCall: &stacks.ContractCallInfo{
						ContractID:   "SP000000000000000000000000000000000.wrong-token",
						FunctionName: "transfer",
						FunctionArgs: []stacks.FunctionArg{
							{Name: "amount", Type: "uint", Repr: "u1000000"},
							{Name: "recipient", Type: "principal", Repr: "'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7"},
						},
					},
				},
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"txId":            validTxId,
					"from":            "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
					"contractAddress": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  stacks.SchemeExactDirect,
					Network: stacks.StacksMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: stacks.StacksMainnetCAIP2,
				PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
				Amount:  "1000000",
				Extra: map[string]interface{}{
					"contractAddress": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
				},
			},
			wantReason: "contract_mismatch",
		},
		{
			name: "tx too old",
			signer: &mockFacilitatorSigner{
				result: &stacks.StacksTransactionResult{
					TxStatus:      "success",
					TxType:        "contract_call",
					SenderAddress: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
					BurnBlockTime: time.Now().Add(-2 * time.Hour).Unix(), // 2 hours ago
					ContractCall: &stacks.ContractCallInfo{
						ContractID:   "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
						FunctionName: "transfer",
						FunctionArgs: []stacks.FunctionArg{
							{Name: "amount", Type: "uint", Repr: "u1000000"},
							{Name: "recipient", Type: "principal", Repr: "'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7"},
						},
					},
				},
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"txId": validTxId,
					"from": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  stacks.SchemeExactDirect,
					Network: stacks.StacksMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: stacks.StacksMainnetCAIP2,
				PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
				Amount:  "1000000",
			},
			wantReason: "tx_too_old",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := NewExactDirectStacksScheme(tt.signer, nil)
			_, err := scheme.Verify(context.Background(), tt.payload, tt.requirements)

			if err == nil {
				t.Fatal("Verify() expected error, got nil")
			}

			ve, ok := err.(*t402.VerifyError)
			if !ok {
				t.Fatalf("expected *t402.VerifyError, got %T: %v", err, err)
			}
			if ve.Reason != tt.wantReason {
				t.Errorf("VerifyError.Reason = %v, want %v", ve.Reason, tt.wantReason)
			}
		})
	}
}

func TestVerify_ReplayProtection(t *testing.T) {
	txId := "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
	signer := &mockFacilitatorSigner{
		result: &stacks.StacksTransactionResult{
			TxId:          txId,
			TxStatus:      "success",
			TxType:        "contract_call",
			SenderAddress: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
			BurnBlockTime: time.Now().Unix(),
			ContractCall: &stacks.ContractCallInfo{
				ContractID:   "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
				FunctionName: "transfer",
				FunctionArgs: []stacks.FunctionArg{
					{Name: "amount", Type: "uint", Repr: "u1000000"},
					{Name: "recipient", Type: "principal", Repr: "'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7"},
				},
			},
		},
	}

	scheme := NewExactDirectStacksScheme(signer, nil)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"txId": txId,
			"from": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
		},
		Accepted: types.PaymentRequirements{
			Scheme:  stacks.SchemeExactDirect,
			Network: stacks.StacksMainnetCAIP2,
		},
	}

	requirements := types.PaymentRequirements{
		Network: stacks.StacksMainnetCAIP2,
		PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
		Amount:  "1000000",
	}

	// First verify should succeed
	resp, err := scheme.Verify(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("first Verify() error: %v", err)
	}
	if !resp.IsValid {
		t.Error("first Verify() should be valid")
	}

	// Second verify with same txId should fail (replay)
	_, err = scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("second Verify() expected error (replay), got nil")
	}

	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T", err)
	}
	if ve.Reason != "tx_already_used" {
		t.Errorf("VerifyError.Reason = %v, want tx_already_used", ve.Reason)
	}
}

func TestSettle_Success(t *testing.T) {
	txId := "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
	signer := &mockFacilitatorSigner{
		result: &stacks.StacksTransactionResult{
			TxId:          txId,
			TxStatus:      "success",
			TxType:        "contract_call",
			SenderAddress: "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
			BurnBlockTime: time.Now().Unix(),
			ContractCall: &stacks.ContractCallInfo{
				ContractID:   "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc",
				FunctionName: "transfer",
				FunctionArgs: []stacks.FunctionArg{
					{Name: "amount", Type: "uint", Repr: "u1000000"},
					{Name: "recipient", Type: "principal", Repr: "'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7"},
				},
			},
		},
	}

	scheme := NewExactDirectStacksScheme(signer, nil)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"txId": txId,
			"from": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
		},
		Accepted: types.PaymentRequirements{
			Scheme:  stacks.SchemeExactDirect,
			Network: stacks.StacksMainnetCAIP2,
		},
	}

	requirements := types.PaymentRequirements{
		Network: stacks.StacksMainnetCAIP2,
		PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
		Amount:  "1000000",
	}

	resp, err := scheme.Settle(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("Settle() error: %v", err)
	}
	if !resp.Success {
		t.Error("Success should be true")
	}
	if resp.Transaction != txId {
		t.Errorf("Transaction = %v, want %v", resp.Transaction, txId)
	}
	if resp.Payer != "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K" {
		t.Errorf("Payer = %v, want sender address", resp.Payer)
	}
	if string(resp.Network) != stacks.StacksMainnetCAIP2 {
		t.Errorf("Network = %v, want %v", resp.Network, stacks.StacksMainnetCAIP2)
	}
}

func TestSettle_VerificationFails(t *testing.T) {
	signer := &mockFacilitatorSigner{
		err: fmt.Errorf("transaction not found"),
	}

	scheme := NewExactDirectStacksScheme(signer, nil)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"txId": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			"from": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",
		},
		Accepted: types.PaymentRequirements{
			Scheme:  stacks.SchemeExactDirect,
			Network: stacks.StacksMainnetCAIP2,
		},
	}

	requirements := types.PaymentRequirements{
		Network: stacks.StacksMainnetCAIP2,
		PayTo:   "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
		Amount:  "1000000",
	}

	_, err := scheme.Settle(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("Settle() expected error, got nil")
	}

	se, ok := err.(*t402.SettleError)
	if !ok {
		t.Fatalf("expected *t402.SettleError, got %T: %v", err, err)
	}
	if se.Reason != "tx_not_found" {
		t.Errorf("SettleError.Reason = %v, want tx_not_found", se.Reason)
	}
}

func TestNewExactDirectStacksScheme_DefaultConfig(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewExactDirectStacksScheme(signer, nil)

	if scheme.config.MaxTransactionAge != 3600 {
		t.Errorf("MaxTransactionAge = %v, want 3600", scheme.config.MaxTransactionAge)
	}
	if scheme.config.UsedTxCacheDuration != 24*time.Hour {
		t.Errorf("UsedTxCacheDuration = %v, want 24h", scheme.config.UsedTxCacheDuration)
	}
}

func TestNewExactDirectStacksScheme_CustomConfig(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	config := &ExactDirectStacksSchemeConfig{
		MaxTransactionAge:   7200,
		UsedTxCacheDuration: 48 * time.Hour,
	}
	scheme := NewExactDirectStacksScheme(signer, config)

	if scheme.config.MaxTransactionAge != 7200 {
		t.Errorf("MaxTransactionAge = %v, want 7200", scheme.config.MaxTransactionAge)
	}
	if scheme.config.UsedTxCacheDuration != 48*time.Hour {
		t.Errorf("UsedTxCacheDuration = %v, want 48h", scheme.config.UsedTxCacheDuration)
	}
}
