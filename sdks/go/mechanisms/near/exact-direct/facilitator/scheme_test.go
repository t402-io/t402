package facilitator

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/near"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockFacilitatorSigner implements FacilitatorNearSigner for testing
type mockFacilitatorSigner struct {
	addresses map[string][]string
	result    *near.TransactionResult
	err       error
}

func (m *mockFacilitatorSigner) GetAddresses(_ context.Context, network string) []string {
	if addrs, ok := m.addresses[network]; ok {
		return addrs
	}
	return nil
}

func (m *mockFacilitatorSigner) QueryTransaction(_ context.Context, _ string, _ string) (*near.TransactionResult, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.result, nil
}

func (m *mockFacilitatorSigner) GetBalance(_ context.Context, _ string, _ string) (string, error) {
	return "1000000", nil
}

func TestScheme(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewExactDirectNearScheme(signer, nil)

	if scheme.Scheme() != "exact-direct" {
		t.Errorf("Scheme() = %v, want exact-direct", scheme.Scheme())
	}
}

func TestCaipFamily(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewExactDirectNearScheme(signer, nil)

	if scheme.CaipFamily() != "near:*" {
		t.Errorf("CaipFamily() = %v, want near:*", scheme.CaipFamily())
	}
}

func TestGetSigners(t *testing.T) {
	signer := &mockFacilitatorSigner{
		addresses: map[string][]string{
			near.NearMainnetCAIP2: {"facilitator.near"},
			near.NearTestnetCAIP2: {"facilitator.testnet"},
		},
	}
	scheme := NewExactDirectNearScheme(signer, nil)

	mainnetSigners := scheme.GetSigners(t402.Network(near.NearMainnetCAIP2))
	if len(mainnetSigners) != 1 || mainnetSigners[0] != "facilitator.near" {
		t.Errorf("GetSigners(mainnet) = %v, want [facilitator.near]", mainnetSigners)
	}

	testnetSigners := scheme.GetSigners(t402.Network(near.NearTestnetCAIP2))
	if len(testnetSigners) != 1 || testnetSigners[0] != "facilitator.testnet" {
		t.Errorf("GetSigners(testnet) = %v, want [facilitator.testnet]", testnetSigners)
	}
}

func TestGetExtra(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewExactDirectNearScheme(signer, nil)

	extra := scheme.GetExtra(t402.Network(near.NearMainnetCAIP2))
	if extra == nil {
		t.Fatal("GetExtra(mainnet) returned nil")
	}

	extra = scheme.GetExtra(t402.Network("near:unknown"))
	if extra != nil {
		t.Errorf("GetExtra(unknown) = %v, want nil", extra)
	}
}

func makeSuccessStatus() near.TransactionStatus {
	val := ""
	return near.TransactionStatus{SuccessValue: &val}
}

func makeFtTransferArgs(receiver, amount string) json.RawMessage {
	args := near.FtTransferArgs{
		ReceiverID: receiver,
		Amount:     amount,
	}
	b, _ := json.Marshal(args)
	// The NEAR SDK stores args as raw JSON bytes in the RawMessage field
	return json.RawMessage(b)
}

func TestVerify_Success(t *testing.T) {
	txHash := "9FtHPMV3V1yN3sJQyJqwT1MDB4oPqh6KHhBRCPmRVkP"
	signer := &mockFacilitatorSigner{
		result: &near.TransactionResult{
			Status: makeSuccessStatus(),
			Transaction: near.Transaction{
				Hash:       txHash,
				SignerID:   "sender.near",
				ReceiverID: "usdt.tether-token.near",
				Actions: []near.Action{
					{
						FunctionCall: &near.FunctionCallAction{
							MethodName: near.FunctionFtTransfer,
							Args:       makeFtTransferArgs("recipient.near", "1000000"),
						},
					},
				},
			},
		},
	}

	scheme := NewExactDirectNearScheme(signer, nil)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"txHash": txHash,
			"from":   "sender.near",
		},
		Accepted: types.PaymentRequirements{
			Scheme:  near.SchemeExactDirect,
			Network: near.NearMainnetCAIP2,
		},
	}

	requirements := types.PaymentRequirements{
		Scheme:  near.SchemeExactDirect,
		Network: near.NearMainnetCAIP2,
		PayTo:   "recipient.near",
		Amount:  "1000000",
		Asset:   "usdt.tether-token.near",
	}

	resp, err := scheme.Verify(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("Verify() error: %v", err)
	}
	if !resp.IsValid {
		t.Error("IsValid should be true")
	}
	if resp.Payer != "sender.near" {
		t.Errorf("Payer = %v, want sender.near", resp.Payer)
	}
}

func TestVerify_Errors(t *testing.T) {
	validTxHash := "9FtHPMV3V1yN3sJQyJqwT1MDB4oPqh6KHhBRCPmRVkP"

	tests := []struct {
		name         string
		signer       *mockFacilitatorSigner
		payload      types.PaymentPayload
		requirements types.PaymentRequirements
		wantReason   string
	}{
		{
			name:   "invalid scheme",
			signer: &mockFacilitatorSigner{},
			payload: types.PaymentPayload{
				Accepted: types.PaymentRequirements{
					Scheme:  "exact",
					Network: near.NearMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: near.NearMainnetCAIP2,
			},
			wantReason: "invalid_scheme",
		},
		{
			name:   "network mismatch",
			signer: &mockFacilitatorSigner{},
			payload: types.PaymentPayload{
				Accepted: types.PaymentRequirements{
					Scheme:  near.SchemeExactDirect,
					Network: near.NearTestnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: near.NearMainnetCAIP2,
			},
			wantReason: "network_mismatch",
		},
		{
			name:   "missing tx hash",
			signer: &mockFacilitatorSigner{},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"from": "sender.near",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  near.SchemeExactDirect,
					Network: near.NearMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: near.NearMainnetCAIP2,
			},
			wantReason: "missing_tx_hash",
		},
		{
			name:   "missing from",
			signer: &mockFacilitatorSigner{},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"txHash": validTxHash,
				},
				Accepted: types.PaymentRequirements{
					Scheme:  near.SchemeExactDirect,
					Network: near.NearMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: near.NearMainnetCAIP2,
			},
			wantReason: "missing_from",
		},
		{
			name: "transaction not found",
			signer: &mockFacilitatorSigner{
				err: fmt.Errorf("not found"),
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"txHash": validTxHash,
					"from":   "sender.near",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  near.SchemeExactDirect,
					Network: near.NearMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: near.NearMainnetCAIP2,
			},
			wantReason: "transaction_not_found",
		},
		{
			name: "transaction failed",
			signer: &mockFacilitatorSigner{
				result: &near.TransactionResult{
					Status: near.TransactionStatus{Failure: json.RawMessage(`{"error":"failed"}`)},
				},
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"txHash": validTxHash,
					"from":   "sender.near",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  near.SchemeExactDirect,
					Network: near.NearMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: near.NearMainnetCAIP2,
			},
			wantReason: "transaction_failed",
		},
		{
			name: "wrong token contract",
			signer: &mockFacilitatorSigner{
				result: &near.TransactionResult{
					Status: makeSuccessStatus(),
					Transaction: near.Transaction{
						ReceiverID: "wrong-token.near",
					},
				},
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"txHash": validTxHash,
					"from":   "sender.near",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  near.SchemeExactDirect,
					Network: near.NearMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: near.NearMainnetCAIP2,
				Asset:   "usdt.tether-token.near",
			},
			wantReason: "wrong_token_contract",
		},
		{
			name: "wrong recipient",
			signer: &mockFacilitatorSigner{
				result: &near.TransactionResult{
					Status: makeSuccessStatus(),
					Transaction: near.Transaction{
						ReceiverID: "usdt.tether-token.near",
						Actions: []near.Action{
							{
								FunctionCall: &near.FunctionCallAction{
									MethodName: near.FunctionFtTransfer,
									Args:       makeFtTransferArgs("wrong.near", "1000000"),
								},
							},
						},
					},
				},
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"txHash": validTxHash,
					"from":   "sender.near",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  near.SchemeExactDirect,
					Network: near.NearMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: near.NearMainnetCAIP2,
				PayTo:   "recipient.near",
				Amount:  "1000000",
				Asset:   "usdt.tether-token.near",
			},
			wantReason: "wrong_recipient",
		},
		{
			name: "insufficient amount",
			signer: &mockFacilitatorSigner{
				result: &near.TransactionResult{
					Status: makeSuccessStatus(),
					Transaction: near.Transaction{
						ReceiverID: "usdt.tether-token.near",
						Actions: []near.Action{
							{
								FunctionCall: &near.FunctionCallAction{
									MethodName: near.FunctionFtTransfer,
									Args:       makeFtTransferArgs("recipient.near", "500000"),
								},
							},
						},
					},
				},
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"txHash": validTxHash,
					"from":   "sender.near",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  near.SchemeExactDirect,
					Network: near.NearMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: near.NearMainnetCAIP2,
				PayTo:   "recipient.near",
				Amount:  "1000000",
				Asset:   "usdt.tether-token.near",
			},
			wantReason: "insufficient_amount",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := NewExactDirectNearScheme(tt.signer, nil)
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
	txHash := "9FtHPMV3V1yN3sJQyJqwT1MDB4oPqh6KHhBRCPmRVkP"
	signer := &mockFacilitatorSigner{
		result: &near.TransactionResult{
			Status: makeSuccessStatus(),
			Transaction: near.Transaction{
				Hash:       txHash,
				SignerID:   "sender.near",
				ReceiverID: "usdt.tether-token.near",
				Actions: []near.Action{
					{
						FunctionCall: &near.FunctionCallAction{
							MethodName: near.FunctionFtTransfer,
							Args:       makeFtTransferArgs("recipient.near", "1000000"),
						},
					},
				},
			},
		},
	}

	scheme := NewExactDirectNearScheme(signer, nil)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"txHash": txHash,
			"from":   "sender.near",
		},
		Accepted: types.PaymentRequirements{
			Scheme:  near.SchemeExactDirect,
			Network: near.NearMainnetCAIP2,
		},
	}

	requirements := types.PaymentRequirements{
		Network: near.NearMainnetCAIP2,
		PayTo:   "recipient.near",
		Amount:  "1000000",
		Asset:   "usdt.tether-token.near",
	}

	// First verify should succeed
	resp, err := scheme.Verify(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("first Verify() error: %v", err)
	}
	if !resp.IsValid {
		t.Error("first Verify() should be valid")
	}

	// Second verify with same txHash should fail (replay)
	_, err = scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("second Verify() expected error (replay), got nil")
	}

	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T", err)
	}
	if ve.Reason != "transaction_already_used" {
		t.Errorf("VerifyError.Reason = %v, want transaction_already_used", ve.Reason)
	}
}

func TestSettle_Success(t *testing.T) {
	txHash := "9FtHPMV3V1yN3sJQyJqwT1MDB4oPqh6KHhBRCPmRVkP"
	signer := &mockFacilitatorSigner{
		result: &near.TransactionResult{
			Status: makeSuccessStatus(),
			Transaction: near.Transaction{
				Hash:       txHash,
				SignerID:   "sender.near",
				ReceiverID: "usdt.tether-token.near",
				Actions: []near.Action{
					{
						FunctionCall: &near.FunctionCallAction{
							MethodName: near.FunctionFtTransfer,
							Args:       makeFtTransferArgs("recipient.near", "1000000"),
						},
					},
				},
			},
		},
	}

	scheme := NewExactDirectNearScheme(signer, nil)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"txHash": txHash,
			"from":   "sender.near",
		},
		Accepted: types.PaymentRequirements{
			Scheme:  near.SchemeExactDirect,
			Network: near.NearMainnetCAIP2,
		},
	}

	requirements := types.PaymentRequirements{
		Network: near.NearMainnetCAIP2,
		PayTo:   "recipient.near",
		Amount:  "1000000",
		Asset:   "usdt.tether-token.near",
	}

	resp, err := scheme.Settle(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("Settle() error: %v", err)
	}
	if !resp.Success {
		t.Error("Success should be true")
	}
	if resp.Transaction != txHash {
		t.Errorf("Transaction = %v, want %v", resp.Transaction, txHash)
	}
	if resp.Payer != "sender.near" {
		t.Errorf("Payer = %v, want sender.near", resp.Payer)
	}
}

func TestSettle_VerificationFails(t *testing.T) {
	signer := &mockFacilitatorSigner{
		err: fmt.Errorf("not found"),
	}

	scheme := NewExactDirectNearScheme(signer, nil)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"txHash": "9FtHPMV3V1yN3sJQyJqwT1MDB4oPqh6KHhBRCPmRVkP",
			"from":   "sender.near",
		},
		Accepted: types.PaymentRequirements{
			Scheme:  near.SchemeExactDirect,
			Network: near.NearMainnetCAIP2,
		},
	}

	requirements := types.PaymentRequirements{
		Network: near.NearMainnetCAIP2,
		PayTo:   "recipient.near",
		Amount:  "1000000",
		Asset:   "usdt.tether-token.near",
	}

	_, err := scheme.Settle(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("Settle() expected error, got nil")
	}

	se, ok := err.(*t402.SettleError)
	if !ok {
		t.Fatalf("expected *t402.SettleError, got %T: %v", err, err)
	}
	if se.Reason != "transaction_not_found" {
		t.Errorf("SettleError.Reason = %v, want transaction_not_found", se.Reason)
	}
}

func TestNewExactDirectNearScheme_DefaultConfig(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewExactDirectNearScheme(signer, nil)

	if scheme.config.MaxTransactionAge != 5*time.Minute {
		t.Errorf("MaxTransactionAge = %v, want 5m", scheme.config.MaxTransactionAge)
	}
	if scheme.config.UsedTxCacheDuration != 24*time.Hour {
		t.Errorf("UsedTxCacheDuration = %v, want 24h", scheme.config.UsedTxCacheDuration)
	}
}

func TestNewExactDirectNearScheme_CustomConfig(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	config := &ExactDirectNearSchemeConfig{
		MaxTransactionAge:   10 * time.Minute,
		UsedTxCacheDuration: 48 * time.Hour,
	}
	scheme := NewExactDirectNearScheme(signer, config)

	if scheme.config.MaxTransactionAge != 10*time.Minute {
		t.Errorf("MaxTransactionAge = %v, want 10m", scheme.config.MaxTransactionAge)
	}
	if scheme.config.UsedTxCacheDuration != 48*time.Hour {
		t.Errorf("UsedTxCacheDuration = %v, want 48h", scheme.config.UsedTxCacheDuration)
	}
}
