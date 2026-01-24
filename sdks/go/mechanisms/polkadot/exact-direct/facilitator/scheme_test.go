package facilitator

import (
	"context"
	"fmt"
	"testing"
	"time"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/polkadot"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockFacilitatorSigner implements FacilitatorPolkadotSigner for testing
type mockFacilitatorSigner struct {
	addresses map[string][]string
	result    *polkadot.ExtrinsicResult
	err       error
}

func (m *mockFacilitatorSigner) GetAddresses(_ context.Context, network string) []string {
	if addrs, ok := m.addresses[network]; ok {
		return addrs
	}
	return nil
}

func (m *mockFacilitatorSigner) QueryExtrinsic(_ context.Context, _ string, _ string, _ int) (*polkadot.ExtrinsicResult, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.result, nil
}

func (m *mockFacilitatorSigner) GetBalance(_ context.Context, _ int, _ string) (string, error) {
	return "1000000", nil
}

func makeSuccessfulExtrinsic(signer, to, amount string, assetID int) *polkadot.ExtrinsicResult {
	return &polkadot.ExtrinsicResult{
		ExtrinsicHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
		Success:       true,
		Timestamp:     time.Now().Format(time.RFC3339),
		Signer:        signer,
		Module:        "Assets",
		Call:          "transfer",
		Params: []polkadot.ExtrinsicParam{
			{Name: "id", Value: float64(assetID)},
			{Name: "target", Value: to},
			{Name: "amount", Value: amount},
		},
	}
}

func TestScheme(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewExactDirectPolkadotScheme(signer, nil)

	if scheme.Scheme() != "exact-direct" {
		t.Errorf("Scheme() = %v, want exact-direct", scheme.Scheme())
	}
}

func TestCaipFamily(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewExactDirectPolkadotScheme(signer, nil)

	if scheme.CaipFamily() != "polkadot:*" {
		t.Errorf("CaipFamily() = %v, want polkadot:*", scheme.CaipFamily())
	}
}

func TestGetSigners(t *testing.T) {
	signer := &mockFacilitatorSigner{
		addresses: map[string][]string{
			polkadot.PolkadotAssetHubCAIP2: {"15oF4uVJwmo4TdGW7VfQxNLavjCXviqWrb9sGQgMT7X6"},
		},
	}
	scheme := NewExactDirectPolkadotScheme(signer, nil)

	signers := scheme.GetSigners(t402.Network(polkadot.PolkadotAssetHubCAIP2))
	if len(signers) != 1 || signers[0] != "15oF4uVJwmo4TdGW7VfQxNLavjCXviqWrb9sGQgMT7X6" {
		t.Errorf("GetSigners() = %v, want [15oF4uVJwmo4TdGW7VfQxNLavjCXviqWrb9sGQgMT7X6]", signers)
	}
}

func TestGetExtra(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewExactDirectPolkadotScheme(signer, nil)

	extra := scheme.GetExtra(t402.Network(polkadot.PolkadotAssetHubCAIP2))
	if extra == nil {
		t.Fatal("GetExtra(polkadot asset hub) returned nil")
	}

	extra = scheme.GetExtra(t402.Network("polkadot:unknown"))
	if extra != nil {
		t.Errorf("GetExtra(unknown) = %v, want nil", extra)
	}
}

func TestVerify_Success(t *testing.T) {
	extrinsicHash := "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
	signer := &mockFacilitatorSigner{
		result: makeSuccessfulExtrinsic(
			"15oF4uVJwmo4TdGW7VfQxNLavjCXviqWrb9sGQgMT7X6",
			"16ZL8yLyXv3V3L3z9ofR1ovFLziyXaN1DPq4yffMAZ9czzBD",
			"1000000",
			1984,
		),
	}

	scheme := NewExactDirectPolkadotScheme(signer, nil)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"extrinsicHash": extrinsicHash,
			"from":          "15oF4uVJwmo4TdGW7VfQxNLavjCXviqWrb9sGQgMT7X6",
			"assetId":       1984,
		},
		Accepted: types.PaymentRequirements{
			Scheme:  polkadot.SchemeExactDirect,
			Network: polkadot.PolkadotAssetHubCAIP2,
		},
	}

	requirements := types.PaymentRequirements{
		Scheme:  polkadot.SchemeExactDirect,
		Network: polkadot.PolkadotAssetHubCAIP2,
		PayTo:   "16ZL8yLyXv3V3L3z9ofR1ovFLziyXaN1DPq4yffMAZ9czzBD",
		Amount:  "1000000",
		Extra: map[string]interface{}{
			"assetId": float64(1984),
		},
	}

	resp, err := scheme.Verify(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("Verify() error: %v", err)
	}
	if !resp.IsValid {
		t.Error("IsValid should be true")
	}
	if resp.Payer != "15oF4uVJwmo4TdGW7VfQxNLavjCXviqWrb9sGQgMT7X6" {
		t.Errorf("Payer = %v, want sender address", resp.Payer)
	}
}

func TestVerify_Errors(t *testing.T) {
	validHash := "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"

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
					Network: polkadot.PolkadotAssetHubCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: polkadot.PolkadotAssetHubCAIP2,
			},
			wantReason: "invalid_scheme",
		},
		{
			name:   "network mismatch",
			signer: &mockFacilitatorSigner{},
			payload: types.PaymentPayload{
				Accepted: types.PaymentRequirements{
					Scheme:  polkadot.SchemeExactDirect,
					Network: polkadot.WestendAssetHubCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: polkadot.PolkadotAssetHubCAIP2,
			},
			wantReason: "network_mismatch",
		},
		{
			name:   "invalid extrinsic hash format",
			signer: &mockFacilitatorSigner{},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"extrinsicHash": "invalid",
					"from":          "15oF4uVJwmo4TdGW7VfQxNLavjCXviqWrb9sGQgMT7X6",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  polkadot.SchemeExactDirect,
					Network: polkadot.PolkadotAssetHubCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: polkadot.PolkadotAssetHubCAIP2,
			},
			wantReason: "invalid_extrinsic_hash_format",
		},
		{
			name:   "missing from",
			signer: &mockFacilitatorSigner{},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"extrinsicHash": validHash,
				},
				Accepted: types.PaymentRequirements{
					Scheme:  polkadot.SchemeExactDirect,
					Network: polkadot.PolkadotAssetHubCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: polkadot.PolkadotAssetHubCAIP2,
			},
			wantReason: "missing_from",
		},
		{
			name: "extrinsic not found",
			signer: &mockFacilitatorSigner{
				err: fmt.Errorf("not found"),
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"extrinsicHash": validHash,
					"from":          "15oF4uVJwmo4TdGW7VfQxNLavjCXviqWrb9sGQgMT7X6",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  polkadot.SchemeExactDirect,
					Network: polkadot.PolkadotAssetHubCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: polkadot.PolkadotAssetHubCAIP2,
			},
			wantReason: "extrinsic_not_found",
		},
		{
			name: "extrinsic failed",
			signer: &mockFacilitatorSigner{
				result: &polkadot.ExtrinsicResult{
					Success: false,
				},
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"extrinsicHash": validHash,
					"from":          "15oF4uVJwmo4TdGW7VfQxNLavjCXviqWrb9sGQgMT7X6",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  polkadot.SchemeExactDirect,
					Network: polkadot.PolkadotAssetHubCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: polkadot.PolkadotAssetHubCAIP2,
			},
			wantReason: "extrinsic_failed",
		},
		{
			name: "extrinsic too old",
			signer: &mockFacilitatorSigner{
				result: &polkadot.ExtrinsicResult{
					Success:   true,
					Timestamp: time.Now().Add(-2 * time.Hour).Format(time.RFC3339),
					Signer:    "15oF4uVJwmo4TdGW7VfQxNLavjCXviqWrb9sGQgMT7X6",
					Module:    "Assets",
					Call:      "transfer",
					Params: []polkadot.ExtrinsicParam{
						{Name: "id", Value: float64(1984)},
						{Name: "target", Value: "16ZL8yLyXv3V3L3z9ofR1ovFLziyXaN1DPq4yffMAZ9czzBD"},
						{Name: "amount", Value: "1000000"},
					},
				},
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"extrinsicHash": validHash,
					"from":          "15oF4uVJwmo4TdGW7VfQxNLavjCXviqWrb9sGQgMT7X6",
					"assetId":       1984,
				},
				Accepted: types.PaymentRequirements{
					Scheme:  polkadot.SchemeExactDirect,
					Network: polkadot.PolkadotAssetHubCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: polkadot.PolkadotAssetHubCAIP2,
				PayTo:   "16ZL8yLyXv3V3L3z9ofR1ovFLziyXaN1DPq4yffMAZ9czzBD",
				Amount:  "1000000",
				Extra:   map[string]interface{}{"assetId": float64(1984)},
			},
			wantReason: "extrinsic_too_old",
		},
		{
			name: "recipient mismatch",
			signer: &mockFacilitatorSigner{
				result: makeSuccessfulExtrinsic("15sender", "15wrong", "1000000", 1984),
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"extrinsicHash": validHash,
					"from":          "15sender",
					"assetId":       1984,
				},
				Accepted: types.PaymentRequirements{
					Scheme:  polkadot.SchemeExactDirect,
					Network: polkadot.PolkadotAssetHubCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: polkadot.PolkadotAssetHubCAIP2,
				PayTo:   "16recipient",
				Amount:  "1000000",
				Extra:   map[string]interface{}{"assetId": float64(1984)},
			},
			wantReason: "recipient_mismatch",
		},
		{
			name: "insufficient amount",
			signer: &mockFacilitatorSigner{
				result: makeSuccessfulExtrinsic("15sender", "16recipient", "500000", 1984),
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"extrinsicHash": validHash,
					"from":          "15sender",
					"assetId":       1984,
				},
				Accepted: types.PaymentRequirements{
					Scheme:  polkadot.SchemeExactDirect,
					Network: polkadot.PolkadotAssetHubCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: polkadot.PolkadotAssetHubCAIP2,
				PayTo:   "16recipient",
				Amount:  "1000000",
				Extra:   map[string]interface{}{"assetId": float64(1984)},
			},
			wantReason: "insufficient_amount",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := NewExactDirectPolkadotScheme(tt.signer, nil)
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
	extrinsicHash := "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
	signer := &mockFacilitatorSigner{
		result: makeSuccessfulExtrinsic("15sender", "16recipient", "1000000", 1984),
	}

	scheme := NewExactDirectPolkadotScheme(signer, nil)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"extrinsicHash": extrinsicHash,
			"from":          "15sender",
			"assetId":       1984,
		},
		Accepted: types.PaymentRequirements{
			Scheme:  polkadot.SchemeExactDirect,
			Network: polkadot.PolkadotAssetHubCAIP2,
		},
	}

	requirements := types.PaymentRequirements{
		Network: polkadot.PolkadotAssetHubCAIP2,
		PayTo:   "16recipient",
		Amount:  "1000000",
		Extra:   map[string]interface{}{"assetId": float64(1984)},
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
	if ve.Reason != "extrinsic_already_used" {
		t.Errorf("VerifyError.Reason = %v, want extrinsic_already_used", ve.Reason)
	}
}

func TestSettle_Success(t *testing.T) {
	extrinsicHash := "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
	signer := &mockFacilitatorSigner{
		result: makeSuccessfulExtrinsic("15sender", "16recipient", "1000000", 1984),
	}

	scheme := NewExactDirectPolkadotScheme(signer, nil)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"extrinsicHash": extrinsicHash,
			"from":          "15sender",
			"assetId":       1984,
		},
		Accepted: types.PaymentRequirements{
			Scheme:  polkadot.SchemeExactDirect,
			Network: polkadot.PolkadotAssetHubCAIP2,
		},
	}

	requirements := types.PaymentRequirements{
		Network: polkadot.PolkadotAssetHubCAIP2,
		PayTo:   "16recipient",
		Amount:  "1000000",
		Extra:   map[string]interface{}{"assetId": float64(1984)},
	}

	resp, err := scheme.Settle(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("Settle() error: %v", err)
	}
	if !resp.Success {
		t.Error("Success should be true")
	}
	if resp.Transaction != extrinsicHash {
		t.Errorf("Transaction = %v, want %v", resp.Transaction, extrinsicHash)
	}
}

func TestSettle_VerificationFails(t *testing.T) {
	signer := &mockFacilitatorSigner{
		err: fmt.Errorf("not found"),
	}

	scheme := NewExactDirectPolkadotScheme(signer, nil)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"extrinsicHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			"from":          "15sender",
		},
		Accepted: types.PaymentRequirements{
			Scheme:  polkadot.SchemeExactDirect,
			Network: polkadot.PolkadotAssetHubCAIP2,
		},
	}

	requirements := types.PaymentRequirements{
		Network: polkadot.PolkadotAssetHubCAIP2,
		PayTo:   "16recipient",
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
	if se.Reason != "extrinsic_not_found" {
		t.Errorf("SettleError.Reason = %v, want extrinsic_not_found", se.Reason)
	}
}

func TestNewExactDirectPolkadotScheme_DefaultConfig(t *testing.T) {
	signer := &mockFacilitatorSigner{}
	scheme := NewExactDirectPolkadotScheme(signer, nil)

	if scheme.config.MaxExtrinsicAge != 3600 {
		t.Errorf("MaxExtrinsicAge = %v, want 3600", scheme.config.MaxExtrinsicAge)
	}
	if scheme.config.UsedExtrinsicCacheDuration != 24*time.Hour {
		t.Errorf("UsedExtrinsicCacheDuration = %v, want 24h", scheme.config.UsedExtrinsicCacheDuration)
	}
}
