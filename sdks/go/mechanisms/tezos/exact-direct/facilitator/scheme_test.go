package facilitator

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/tezos"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockFacilitatorSigner implements FacilitatorTezosSigner for testing
type mockFacilitatorSigner struct {
	addresses map[string][]string
	result    *tezos.OperationResult
	err       error
}

func (m *mockFacilitatorSigner) GetAddresses(_ context.Context, network string) []string {
	if addrs, ok := m.addresses[network]; ok {
		return addrs
	}
	return nil
}

func (m *mockFacilitatorSigner) QueryOperation(_ context.Context, _ string) (*tezos.OperationResult, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.result, nil
}

func (m *mockFacilitatorSigner) GetBalance(_ context.Context, _ string, _ int, _ string) (string, error) {
	return "1000000", nil
}

func makeFA2TransferParam(from, to, amount string, tokenID int) json.RawMessage {
	params := []tezos.FA2TransferParam{
		{
			From: from,
			Txs: []tezos.FA2TransferTx{
				{
					To:      to,
					TokenID: tokenID,
					Amount:  amount,
				},
			},
		},
	}
	b, _ := json.Marshal(params)
	return b
}

func TestScheme(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewExactDirectTezosScheme(signer, nil)

	if scheme.Scheme() != "exact-direct" {
		t.Errorf("Scheme() = %v, want exact-direct", scheme.Scheme())
	}
}

func TestCaipFamily(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewExactDirectTezosScheme(signer, nil)

	if scheme.CaipFamily() != "tezos:*" {
		t.Errorf("CaipFamily() = %v, want tezos:*", scheme.CaipFamily())
	}
}

func TestGetSigners(t *testing.T) {
	signer := &mockFacilitatorSigner{
		addresses: map[string][]string{
			tezos.TezosMainnetCAIP2:  {"tz1facilitator"},
			tezos.TezosGhostnetCAIP2: {"tz1testfacilitator"},
		},
	}
	scheme := NewExactDirectTezosScheme(signer, nil)

	mainnetSigners := scheme.GetSigners(t402.Network(tezos.TezosMainnetCAIP2))
	if len(mainnetSigners) != 1 || mainnetSigners[0] != "tz1facilitator" {
		t.Errorf("GetSigners(mainnet) = %v, want [tz1facilitator]", mainnetSigners)
	}
}

func TestGetExtra(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewExactDirectTezosScheme(signer, nil)

	extra := scheme.GetExtra(t402.Network(tezos.TezosMainnetCAIP2))
	if extra == nil {
		t.Fatal("GetExtra(mainnet) returned nil")
	}

	extra = scheme.GetExtra(t402.Network("tezos:unknown"))
	if extra != nil {
		t.Errorf("GetExtra(unknown) = %v, want nil", extra)
	}
}

func TestVerify_Success(t *testing.T) {
	opHash := "opabc123456789abcdef123456789abcdef123456789abcdef1"
	signer := &mockFacilitatorSigner{
		result: &tezos.OperationResult{
			Hash:       opHash,
			Status:     "applied",
			Timestamp:  time.Now().Format(time.RFC3339),
			Entrypoint: "transfer",
			Sender:     &tezos.OperationActor{Address: "tz1sender"},
			Target:     &tezos.OperationActor{Address: "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o"},
			Parameter:  makeFA2TransferParam("tz1sender", "tz1recipient", "1000000", 0),
		},
	}

	scheme := NewExactDirectTezosScheme(signer, nil)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"opHash":          opHash,
			"from":            "tz1sender",
			"contractAddress": "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o",
			"tokenId":         0,
		},
		Accepted: types.PaymentRequirements{
			Scheme:  tezos.SchemeExactDirect,
			Network: tezos.TezosMainnetCAIP2,
		},
	}

	requirements := types.PaymentRequirements{
		Scheme:  tezos.SchemeExactDirect,
		Network: tezos.TezosMainnetCAIP2,
		PayTo:   "tz1recipient",
		Amount:  "1000000",
	}

	resp, err := scheme.Verify(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("Verify() error: %v", err)
	}
	if !resp.IsValid {
		t.Error("IsValid should be true")
	}
	if resp.Payer != "tz1sender" {
		t.Errorf("Payer = %v, want tz1sender", resp.Payer)
	}
}

func TestVerify_Errors(t *testing.T) {
	validOpHash := "opabc123456789abcdef123456789abcdef123456789abcdef1"

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
					Network: tezos.TezosMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: tezos.TezosMainnetCAIP2,
			},
			wantReason: "invalid_scheme",
		},
		{
			name:   "network mismatch",
			signer: &mockFacilitatorSigner{},
			payload: types.PaymentPayload{
				Accepted: types.PaymentRequirements{
					Scheme:  tezos.SchemeExactDirect,
					Network: tezos.TezosGhostnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: tezos.TezosMainnetCAIP2,
			},
			wantReason: "network_mismatch",
		},
		{
			name:   "invalid operation hash format",
			signer: &mockFacilitatorSigner{},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"opHash": "invalid-hash",
					"from":   "tz1sender",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  tezos.SchemeExactDirect,
					Network: tezos.TezosMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: tezos.TezosMainnetCAIP2,
			},
			wantReason: "invalid_operation_hash_format",
		},
		{
			name:   "missing from",
			signer: &mockFacilitatorSigner{},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"opHash": validOpHash,
				},
				Accepted: types.PaymentRequirements{
					Scheme:  tezos.SchemeExactDirect,
					Network: tezos.TezosMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: tezos.TezosMainnetCAIP2,
			},
			wantReason: "missing_from",
		},
		{
			name: "operation not found",
			signer: &mockFacilitatorSigner{
				err: fmt.Errorf("not found"),
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"opHash": validOpHash,
					"from":   "tz1sender",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  tezos.SchemeExactDirect,
					Network: tezos.TezosMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: tezos.TezosMainnetCAIP2,
			},
			wantReason: "operation_not_found",
		},
		{
			name: "operation not applied",
			signer: &mockFacilitatorSigner{
				result: &tezos.OperationResult{
					Status: "failed",
				},
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"opHash": validOpHash,
					"from":   "tz1sender",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  tezos.SchemeExactDirect,
					Network: tezos.TezosMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: tezos.TezosMainnetCAIP2,
			},
			wantReason: "operation_not_applied",
		},
		{
			name: "operation too old",
			signer: &mockFacilitatorSigner{
				result: &tezos.OperationResult{
					Hash:       validOpHash,
					Status:     "applied",
					Timestamp:  time.Now().Add(-2 * time.Hour).Format(time.RFC3339),
					Entrypoint: "transfer",
					Sender:     &tezos.OperationActor{Address: "tz1sender"},
					Target:     &tezos.OperationActor{Address: "KT1contract"},
					Parameter:  makeFA2TransferParam("tz1sender", "tz1recipient", "1000000", 0),
				},
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"opHash":          validOpHash,
					"from":            "tz1sender",
					"contractAddress": "KT1contract",
					"tokenId":         0,
				},
				Accepted: types.PaymentRequirements{
					Scheme:  tezos.SchemeExactDirect,
					Network: tezos.TezosMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: tezos.TezosMainnetCAIP2,
				PayTo:   "tz1recipient",
				Amount:  "1000000",
			},
			wantReason: "operation_too_old",
		},
		{
			name: "recipient mismatch",
			signer: &mockFacilitatorSigner{
				result: &tezos.OperationResult{
					Hash:       validOpHash,
					Status:     "applied",
					Timestamp:  time.Now().Format(time.RFC3339),
					Entrypoint: "transfer",
					Sender:     &tezos.OperationActor{Address: "tz1sender"},
					Target:     &tezos.OperationActor{Address: "KT1contract"},
					Parameter:  makeFA2TransferParam("tz1sender", "tz1wrong", "1000000", 0),
				},
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"opHash":          validOpHash,
					"from":            "tz1sender",
					"contractAddress": "KT1contract",
					"tokenId":         0,
				},
				Accepted: types.PaymentRequirements{
					Scheme:  tezos.SchemeExactDirect,
					Network: tezos.TezosMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: tezos.TezosMainnetCAIP2,
				PayTo:   "tz1recipient",
				Amount:  "1000000",
			},
			wantReason: "recipient_mismatch",
		},
		{
			name: "insufficient amount",
			signer: &mockFacilitatorSigner{
				result: &tezos.OperationResult{
					Hash:       validOpHash,
					Status:     "applied",
					Timestamp:  time.Now().Format(time.RFC3339),
					Entrypoint: "transfer",
					Sender:     &tezos.OperationActor{Address: "tz1sender"},
					Target:     &tezos.OperationActor{Address: "KT1contract"},
					Parameter:  makeFA2TransferParam("tz1sender", "tz1recipient", "500000", 0),
				},
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"opHash":          validOpHash,
					"from":            "tz1sender",
					"contractAddress": "KT1contract",
					"tokenId":         0,
				},
				Accepted: types.PaymentRequirements{
					Scheme:  tezos.SchemeExactDirect,
					Network: tezos.TezosMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: tezos.TezosMainnetCAIP2,
				PayTo:   "tz1recipient",
				Amount:  "1000000",
			},
			wantReason: "insufficient_amount",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := NewExactDirectTezosScheme(tt.signer, nil)
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
	opHash := "opabc123456789abcdef123456789abcdef123456789abcdef1"
	signer := &mockFacilitatorSigner{
		result: &tezos.OperationResult{
			Hash:       opHash,
			Status:     "applied",
			Timestamp:  time.Now().Format(time.RFC3339),
			Entrypoint: "transfer",
			Sender:     &tezos.OperationActor{Address: "tz1sender"},
			Target:     &tezos.OperationActor{Address: "KT1contract"},
			Parameter:  makeFA2TransferParam("tz1sender", "tz1recipient", "1000000", 0),
		},
	}

	scheme := NewExactDirectTezosScheme(signer, nil)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"opHash":          opHash,
			"from":            "tz1sender",
			"contractAddress": "KT1contract",
			"tokenId":         0,
		},
		Accepted: types.PaymentRequirements{
			Scheme:  tezos.SchemeExactDirect,
			Network: tezos.TezosMainnetCAIP2,
		},
	}

	requirements := types.PaymentRequirements{
		Network: tezos.TezosMainnetCAIP2,
		PayTo:   "tz1recipient",
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

	// Second verify should fail (replay)
	_, err = scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("second Verify() expected error (replay), got nil")
	}

	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T", err)
	}
	if ve.Reason != "operation_already_used" {
		t.Errorf("VerifyError.Reason = %v, want operation_already_used", ve.Reason)
	}
}

func TestSettle_Success(t *testing.T) {
	opHash := "opabc123456789abcdef123456789abcdef123456789abcdef1"
	signer := &mockFacilitatorSigner{
		result: &tezos.OperationResult{
			Hash:       opHash,
			Status:     "applied",
			Timestamp:  time.Now().Format(time.RFC3339),
			Entrypoint: "transfer",
			Sender:     &tezos.OperationActor{Address: "tz1sender"},
			Target:     &tezos.OperationActor{Address: "KT1contract"},
			Parameter:  makeFA2TransferParam("tz1sender", "tz1recipient", "1000000", 0),
		},
	}

	scheme := NewExactDirectTezosScheme(signer, nil)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"opHash":          opHash,
			"from":            "tz1sender",
			"contractAddress": "KT1contract",
			"tokenId":         0,
		},
		Accepted: types.PaymentRequirements{
			Scheme:  tezos.SchemeExactDirect,
			Network: tezos.TezosMainnetCAIP2,
		},
	}

	requirements := types.PaymentRequirements{
		Network: tezos.TezosMainnetCAIP2,
		PayTo:   "tz1recipient",
		Amount:  "1000000",
	}

	resp, err := scheme.Settle(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("Settle() error: %v", err)
	}
	if !resp.Success {
		t.Error("Success should be true")
	}
	if resp.Transaction != opHash {
		t.Errorf("Transaction = %v, want %v", resp.Transaction, opHash)
	}
}

func TestSettle_VerificationFails(t *testing.T) {
	signer := &mockFacilitatorSigner{
		err: fmt.Errorf("not found"),
	}

	scheme := NewExactDirectTezosScheme(signer, nil)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"opHash": "opabc123456789abcdef123456789abcdef123456789abcdef1",
			"from":   "tz1sender",
		},
		Accepted: types.PaymentRequirements{
			Scheme:  tezos.SchemeExactDirect,
			Network: tezos.TezosMainnetCAIP2,
		},
	}

	requirements := types.PaymentRequirements{
		Network: tezos.TezosMainnetCAIP2,
		PayTo:   "tz1recipient",
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
	if se.Reason != "operation_not_found" {
		t.Errorf("SettleError.Reason = %v, want operation_not_found", se.Reason)
	}
}

func TestNewExactDirectTezosScheme_DefaultConfig(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewExactDirectTezosScheme(signer, nil)

	if scheme.config.MaxOperationAge != 3600 {
		t.Errorf("MaxOperationAge = %v, want 3600", scheme.config.MaxOperationAge)
	}
	if scheme.config.UsedOpCacheDuration != 24*time.Hour {
		t.Errorf("UsedOpCacheDuration = %v, want 24h", scheme.config.UsedOpCacheDuration)
	}
}
