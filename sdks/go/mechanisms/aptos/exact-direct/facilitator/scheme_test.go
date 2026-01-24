package facilitator

import (
	"context"
	"fmt"
	"testing"
	"time"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/aptos"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockFacilitatorSigner implements FacilitatorAptosSigner for testing
type mockFacilitatorSigner struct {
	addresses map[string][]string
	result    *aptos.TransactionResult
	err       error
}

func (m *mockFacilitatorSigner) GetAddresses(_ context.Context, network string) []string {
	if addrs, ok := m.addresses[network]; ok {
		return addrs
	}
	return nil
}

func (m *mockFacilitatorSigner) QueryTransaction(_ context.Context, _ string) (*aptos.TransactionResult, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.result, nil
}

func (m *mockFacilitatorSigner) GetBalance(_ context.Context, _ string, _ string) (string, error) {
	return "1000000", nil
}

func makeSuccessfulTx(sender, to, amount, metadataAddress string) *aptos.TransactionResult {
	now := fmt.Sprintf("%d", time.Now().UnixMicro())
	return &aptos.TransactionResult{
		Hash:      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
		Success:   true,
		VMStatus:  "Executed successfully",
		Sender:    sender,
		Timestamp: now,
		Payload: &aptos.TransactionPayload{
			Type:     "entry_function_payload",
			Function: "0x1::primary_fungible_store::transfer",
			Arguments: []interface{}{
				metadataAddress,
				to,
				amount,
			},
		},
	}
}

func TestScheme(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewExactDirectAptosScheme(signer, nil)

	if scheme.Scheme() != "exact-direct" {
		t.Errorf("Scheme() = %v, want exact-direct", scheme.Scheme())
	}
}

func TestCaipFamily(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewExactDirectAptosScheme(signer, nil)

	if scheme.CaipFamily() != "aptos:*" {
		t.Errorf("CaipFamily() = %v, want aptos:*", scheme.CaipFamily())
	}
}

func TestGetSigners(t *testing.T) {
	signer := &mockFacilitatorSigner{
		addresses: map[string][]string{
			aptos.AptosMainnetCAIP2: {"0xfacilitator"},
			aptos.AptosTestnetCAIP2: {"0xtestfacilitator"},
		},
	}
	scheme := NewExactDirectAptosScheme(signer, nil)

	mainnetSigners := scheme.GetSigners(t402.Network(aptos.AptosMainnetCAIP2))
	if len(mainnetSigners) != 1 || mainnetSigners[0] != "0xfacilitator" {
		t.Errorf("GetSigners(mainnet) = %v, want [0xfacilitator]", mainnetSigners)
	}
}

func TestGetExtra(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewExactDirectAptosScheme(signer, nil)

	extra := scheme.GetExtra(t402.Network(aptos.AptosMainnetCAIP2))
	if extra == nil {
		t.Fatal("GetExtra(mainnet) returned nil")
	}

	extra = scheme.GetExtra(t402.Network("aptos:unknown"))
	if extra != nil {
		t.Errorf("GetExtra(unknown) = %v, want nil", extra)
	}
}

func TestVerify_Success(t *testing.T) {
	txHash := "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
	signer := &mockFacilitatorSigner{
		result: makeSuccessfulTx(
			"0xsender",
			"0xrecipient",
			"1000000",
			"0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb",
		),
	}

	scheme := NewExactDirectAptosScheme(signer, nil)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"txHash": txHash,
			"from":   "0xsender",
		},
		Accepted: types.PaymentRequirements{
			Scheme:  aptos.SchemeExactDirect,
			Network: aptos.AptosMainnetCAIP2,
		},
	}

	requirements := types.PaymentRequirements{
		Scheme:  aptos.SchemeExactDirect,
		Network: aptos.AptosMainnetCAIP2,
		PayTo:   "0xrecipient",
		Amount:  "1000000",
	}

	resp, err := scheme.Verify(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("Verify() error: %v", err)
	}
	if !resp.IsValid {
		t.Error("IsValid should be true")
	}
	if resp.Payer != "0xsender" {
		t.Errorf("Payer = %v, want 0xsender", resp.Payer)
	}
}

func TestVerify_Errors(t *testing.T) {
	validTxHash := "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"

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
					Network: aptos.AptosMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: aptos.AptosMainnetCAIP2,
			},
			wantReason: "invalid_scheme",
		},
		{
			name:   "network mismatch",
			signer: &mockFacilitatorSigner{},
			payload: types.PaymentPayload{
				Accepted: types.PaymentRequirements{
					Scheme:  aptos.SchemeExactDirect,
					Network: aptos.AptosTestnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: aptos.AptosMainnetCAIP2,
			},
			wantReason: "network_mismatch",
		},
		{
			name:   "invalid tx hash format",
			signer: &mockFacilitatorSigner{},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"txHash": "invalid",
					"from":   "0xsender",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  aptos.SchemeExactDirect,
					Network: aptos.AptosMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: aptos.AptosMainnetCAIP2,
			},
			wantReason: "invalid_tx_hash_format",
		},
		{
			name:   "missing from",
			signer: &mockFacilitatorSigner{},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"txHash": validTxHash,
				},
				Accepted: types.PaymentRequirements{
					Scheme:  aptos.SchemeExactDirect,
					Network: aptos.AptosMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: aptos.AptosMainnetCAIP2,
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
					"from":   "0xsender",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  aptos.SchemeExactDirect,
					Network: aptos.AptosMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: aptos.AptosMainnetCAIP2,
			},
			wantReason: "transaction_not_found",
		},
		{
			name: "transaction failed",
			signer: &mockFacilitatorSigner{
				result: &aptos.TransactionResult{
					Success:  false,
					VMStatus: "ABORTED",
				},
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"txHash": validTxHash,
					"from":   "0xsender",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  aptos.SchemeExactDirect,
					Network: aptos.AptosMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: aptos.AptosMainnetCAIP2,
			},
			wantReason: "transaction_failed",
		},
		{
			name: "transaction too old",
			signer: &mockFacilitatorSigner{
				result: &aptos.TransactionResult{
					Hash:      validTxHash,
					Success:   true,
					Sender:    "0xsender",
					Timestamp: fmt.Sprintf("%d", (time.Now().Unix()-7200)*1000000), // 2 hours ago
					Payload: &aptos.TransactionPayload{
						Type:     "entry_function_payload",
						Function: "0x1::primary_fungible_store::transfer",
						Arguments: []interface{}{
							"0xmeta",
							"0xrecipient",
							"1000000",
						},
					},
				},
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"txHash": validTxHash,
					"from":   "0xsender",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  aptos.SchemeExactDirect,
					Network: aptos.AptosMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: aptos.AptosMainnetCAIP2,
				PayTo:   "0xrecipient",
				Amount:  "1000000",
			},
			wantReason: "transaction_too_old",
		},
		{
			name: "recipient mismatch",
			signer: &mockFacilitatorSigner{
				result: makeSuccessfulTx("0xsender", "0xwrong", "1000000", "0xmeta"),
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"txHash": validTxHash,
					"from":   "0xsender",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  aptos.SchemeExactDirect,
					Network: aptos.AptosMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: aptos.AptosMainnetCAIP2,
				PayTo:   "0xrecipient",
				Amount:  "1000000",
			},
			wantReason: "recipient_mismatch",
		},
		{
			name: "insufficient amount",
			signer: &mockFacilitatorSigner{
				result: makeSuccessfulTx("0xsender", "0xrecipient", "500000", "0xmeta"),
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"txHash": validTxHash,
					"from":   "0xsender",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  aptos.SchemeExactDirect,
					Network: aptos.AptosMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: aptos.AptosMainnetCAIP2,
				PayTo:   "0xrecipient",
				Amount:  "1000000",
			},
			wantReason: "insufficient_amount",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := NewExactDirectAptosScheme(tt.signer, nil)
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
	txHash := "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
	signer := &mockFacilitatorSigner{
		result: makeSuccessfulTx("0xsender", "0xrecipient", "1000000", "0xmeta"),
	}

	scheme := NewExactDirectAptosScheme(signer, nil)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"txHash": txHash,
			"from":   "0xsender",
		},
		Accepted: types.PaymentRequirements{
			Scheme:  aptos.SchemeExactDirect,
			Network: aptos.AptosMainnetCAIP2,
		},
	}

	requirements := types.PaymentRequirements{
		Network: aptos.AptosMainnetCAIP2,
		PayTo:   "0xrecipient",
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
	txHash := "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
	signer := &mockFacilitatorSigner{
		result: makeSuccessfulTx("0xsender", "0xrecipient", "1000000", "0xmeta"),
	}

	scheme := NewExactDirectAptosScheme(signer, nil)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"txHash": txHash,
			"from":   "0xsender",
		},
		Accepted: types.PaymentRequirements{
			Scheme:  aptos.SchemeExactDirect,
			Network: aptos.AptosMainnetCAIP2,
		},
	}

	requirements := types.PaymentRequirements{
		Network: aptos.AptosMainnetCAIP2,
		PayTo:   "0xrecipient",
		Amount:  "1000000",
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
	if resp.Payer != "0xsender" {
		t.Errorf("Payer = %v, want 0xsender", resp.Payer)
	}
}

func TestSettle_VerificationFails(t *testing.T) {
	signer := &mockFacilitatorSigner{
		err: fmt.Errorf("not found"),
	}

	scheme := NewExactDirectAptosScheme(signer, nil)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			"from":   "0xsender",
		},
		Accepted: types.PaymentRequirements{
			Scheme:  aptos.SchemeExactDirect,
			Network: aptos.AptosMainnetCAIP2,
		},
	}

	requirements := types.PaymentRequirements{
		Network: aptos.AptosMainnetCAIP2,
		PayTo:   "0xrecipient",
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
	if se.Reason != "transaction_not_found" {
		t.Errorf("SettleError.Reason = %v, want transaction_not_found", se.Reason)
	}
}

func TestNewExactDirectAptosScheme_DefaultConfig(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewExactDirectAptosScheme(signer, nil)

	if scheme.config.MaxTransactionAge != 3600 {
		t.Errorf("MaxTransactionAge = %v, want 3600", scheme.config.MaxTransactionAge)
	}
	if scheme.config.UsedTxCacheDuration != 24*time.Hour {
		t.Errorf("UsedTxCacheDuration = %v, want 24h", scheme.config.UsedTxCacheDuration)
	}
}

func TestNewExactDirectAptosScheme_CustomConfig(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	config := &ExactDirectAptosSchemeConfig{
		MaxTransactionAge:   7200,
		UsedTxCacheDuration: 48 * time.Hour,
	}
	scheme := NewExactDirectAptosScheme(signer, config)

	if scheme.config.MaxTransactionAge != 7200 {
		t.Errorf("MaxTransactionAge = %v, want 7200", scheme.config.MaxTransactionAge)
	}
	if scheme.config.UsedTxCacheDuration != 48*time.Hour {
		t.Errorf("UsedTxCacheDuration = %v, want 48h", scheme.config.UsedTxCacheDuration)
	}
}
