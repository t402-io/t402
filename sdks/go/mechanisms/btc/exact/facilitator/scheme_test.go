package facilitator

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"testing"

	t402 "github.com/t402-io/t402/sdks/go"
	"github.com/t402-io/t402/sdks/go/mechanisms/btc"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockBtcFacilitatorSigner implements FacilitatorBtcSigner for testing
type mockBtcFacilitatorSigner struct {
	addresses   []string
	verifyValid bool
	verifyPayer string
	verifyErr   error
	broadcastTx string
	broadcastErr error
	confirmed   bool
	confirmErr  error
}

func (m *mockBtcFacilitatorSigner) GetAddresses() []string { return m.addresses }

func (m *mockBtcFacilitatorSigner) VerifyPsbt(ctx context.Context, signedPsbt, expectedPayTo, expectedAmount string) (bool, string, string, error) {
	if m.verifyErr != nil {
		return false, "", "", m.verifyErr
	}
	return m.verifyValid, "", m.verifyPayer, nil
}

func (m *mockBtcFacilitatorSigner) BroadcastPsbt(ctx context.Context, signedPsbt string) (string, error) {
	if m.broadcastErr != nil {
		return "", m.broadcastErr
	}
	return m.broadcastTx, nil
}

func (m *mockBtcFacilitatorSigner) WaitForConfirmation(ctx context.Context, txID string, confirmations int) (bool, string, int, error) {
	if m.confirmErr != nil {
		return false, "", 0, m.confirmErr
	}
	return m.confirmed, "blockhash123", 1, nil
}

// mockLightningFacilitatorSigner implements FacilitatorLightningSigner for testing
type mockLightningFacilitatorSigner struct {
	addresses  []string
	settled    bool
	amountSats string
	preimage   string
	lookupErr  error
}

func (m *mockLightningFacilitatorSigner) GetAddresses() []string { return m.addresses }

func (m *mockLightningFacilitatorSigner) LookupPayment(ctx context.Context, paymentHash string) (bool, string, string, error) {
	if m.lookupErr != nil {
		return false, "", "", m.lookupErr
	}
	return m.settled, m.amountSats, m.preimage, nil
}

// Test BTC on-chain facilitator

func TestExactBtcScheme_Scheme(t *testing.T) {
	signer := &mockBtcFacilitatorSigner{}
	scheme := NewExactBtcScheme(signer, nil)
	if scheme.Scheme() != "exact" {
		t.Errorf("Scheme() = %v, want exact", scheme.Scheme())
	}
}

func TestExactBtcScheme_CaipFamily(t *testing.T) {
	signer := &mockBtcFacilitatorSigner{}
	scheme := NewExactBtcScheme(signer, nil)
	if scheme.CaipFamily() != "bip122:*" {
		t.Errorf("CaipFamily() = %v, want bip122:*", scheme.CaipFamily())
	}
}

func TestExactBtcScheme_GetExtra(t *testing.T) {
	signer := &mockBtcFacilitatorSigner{}
	scheme := NewExactBtcScheme(signer, nil)
	extra := scheme.GetExtra(t402.Network(btc.BtcMainnetCAIP2))
	if extra != nil {
		t.Errorf("GetExtra() = %v, want nil", extra)
	}
}

func TestExactBtcScheme_GetSigners(t *testing.T) {
	signer := &mockBtcFacilitatorSigner{
		addresses: []string{"bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"},
	}
	scheme := NewExactBtcScheme(signer, nil)
	signers := scheme.GetSigners(t402.Network(btc.BtcMainnetCAIP2))
	if len(signers) != 1 || signers[0] != "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4" {
		t.Errorf("GetSigners() = %v, want [bc1q...]", signers)
	}
}

func TestExactBtcScheme_Verify_Success(t *testing.T) {
	signer := &mockBtcFacilitatorSigner{
		verifyValid: true,
		verifyPayer: "bc1qpayer123",
	}
	scheme := NewExactBtcScheme(signer, nil)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"signedPsbt": "cHNidHNpZ25lZA==",
		},
		Accepted: types.PaymentRequirements{
			Scheme:  btc.SchemeExact,
			Network: btc.BtcMainnetCAIP2,
		},
	}

	requirements := types.PaymentRequirements{
		Scheme:  btc.SchemeExact,
		Network: btc.BtcMainnetCAIP2,
		PayTo:   "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
		Amount:  "100000",
	}

	resp, err := scheme.Verify(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("Verify() error: %v", err)
	}
	if !resp.IsValid {
		t.Error("IsValid should be true")
	}
	if resp.Payer != "bc1qpayer123" {
		t.Errorf("Payer = %v, want bc1qpayer123", resp.Payer)
	}
}

func TestExactBtcScheme_Verify_Errors(t *testing.T) {
	tests := []struct {
		name         string
		signer       *mockBtcFacilitatorSigner
		payload      types.PaymentPayload
		requirements types.PaymentRequirements
		wantReason   string
	}{
		{
			name:   "invalid scheme",
			signer: &mockBtcFacilitatorSigner{},
			payload: types.PaymentPayload{
				Accepted: types.PaymentRequirements{
					Scheme:  "exact-direct",
					Network: btc.BtcMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: btc.BtcMainnetCAIP2,
			},
			wantReason: "invalid_scheme",
		},
		{
			name:   "network mismatch",
			signer: &mockBtcFacilitatorSigner{},
			payload: types.PaymentPayload{
				Accepted: types.PaymentRequirements{
					Scheme:  btc.SchemeExact,
					Network: btc.BtcTestnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: btc.BtcMainnetCAIP2,
			},
			wantReason: "network_mismatch",
		},
		{
			name:   "unsupported network",
			signer: &mockBtcFacilitatorSigner{},
			payload: types.PaymentPayload{
				Accepted: types.PaymentRequirements{
					Scheme:  btc.SchemeExact,
					Network: "bip122:custom",
				},
			},
			requirements: types.PaymentRequirements{
				Network: "bip122:custom",
			},
			wantReason: "unsupported_network",
		},
		{
			name:   "empty PSBT",
			signer: &mockBtcFacilitatorSigner{},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{},
				Accepted: types.PaymentRequirements{
					Scheme:  btc.SchemeExact,
					Network: btc.BtcMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: btc.BtcMainnetCAIP2,
			},
			wantReason: "invalid_payload_structure",
		},
		{
			name:   "invalid payTo",
			signer: &mockBtcFacilitatorSigner{},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"signedPsbt": "cHNidA==",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  btc.SchemeExact,
					Network: btc.BtcMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: btc.BtcMainnetCAIP2,
				PayTo:   "invalid",
				Amount:  "100000",
			},
			wantReason: "invalid_pay_to_address",
		},
		{
			name:   "amount below dust",
			signer: &mockBtcFacilitatorSigner{},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"signedPsbt": "cHNidA==",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  btc.SchemeExact,
					Network: btc.BtcMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: btc.BtcMainnetCAIP2,
				PayTo:   "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
				Amount:  "100",
			},
			wantReason: "amount_below_dust_limit",
		},
		{
			name: "PSBT verification failed",
			signer: &mockBtcFacilitatorSigner{
				verifyValid: false,
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"signedPsbt": "cHNidF9mYWlsZWQ=",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  btc.SchemeExact,
					Network: btc.BtcMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: btc.BtcMainnetCAIP2,
				PayTo:   "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
				Amount:  "100000",
			},
			wantReason: "psbt_verification_failed",
		},
		{
			name: "PSBT verify error",
			signer: &mockBtcFacilitatorSigner{
				verifyErr: fmt.Errorf("signer down"),
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"signedPsbt": "cHNidF9lcnJvcg==",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  btc.SchemeExact,
					Network: btc.BtcMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: btc.BtcMainnetCAIP2,
				PayTo:   "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
				Amount:  "100000",
			},
			wantReason: "psbt_verification_error",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := NewExactBtcScheme(tt.signer, nil)
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

func TestExactBtcScheme_Verify_ReplayProtection(t *testing.T) {
	signer := &mockBtcFacilitatorSigner{
		verifyValid: true,
		verifyPayer: "bc1qpayer123",
	}
	scheme := NewExactBtcScheme(signer, nil)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"signedPsbt": "cHNidF9yZXBsYXk=",
		},
		Accepted: types.PaymentRequirements{
			Scheme:  btc.SchemeExact,
			Network: btc.BtcMainnetCAIP2,
		},
	}
	requirements := types.PaymentRequirements{
		Network: btc.BtcMainnetCAIP2,
		PayTo:   "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
		Amount:  "100000",
	}

	// First verify should succeed
	resp, err := scheme.Verify(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("first Verify() error: %v", err)
	}
	if !resp.IsValid {
		t.Error("first Verify() should be valid")
	}

	// Second verify with same PSBT should fail (replay)
	_, err = scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("second Verify() expected error (replay), got nil")
	}

	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T", err)
	}
	if ve.Reason != "psbt_already_used" {
		t.Errorf("VerifyError.Reason = %v, want psbt_already_used", ve.Reason)
	}
}

func TestExactBtcScheme_Settle_Success(t *testing.T) {
	signer := &mockBtcFacilitatorSigner{
		verifyValid: true,
		verifyPayer: "bc1qpayer123",
		broadcastTx: "txid_abc123",
		confirmed:   true,
	}
	scheme := NewExactBtcScheme(signer, nil)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"signedPsbt": "cHNidF9zZXR0bGU=",
		},
		Accepted: types.PaymentRequirements{
			Scheme:  btc.SchemeExact,
			Network: btc.BtcMainnetCAIP2,
		},
	}
	requirements := types.PaymentRequirements{
		Network: btc.BtcMainnetCAIP2,
		PayTo:   "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
		Amount:  "100000",
	}

	resp, err := scheme.Settle(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("Settle() error: %v", err)
	}
	if !resp.Success {
		t.Error("Success should be true")
	}
	if resp.Transaction != "txid_abc123" {
		t.Errorf("Transaction = %v, want txid_abc123", resp.Transaction)
	}
	if resp.Payer != "bc1qpayer123" {
		t.Errorf("Payer = %v, want bc1qpayer123", resp.Payer)
	}
	if string(resp.Network) != btc.BtcMainnetCAIP2 {
		t.Errorf("Network = %v, want %v", resp.Network, btc.BtcMainnetCAIP2)
	}
}

func TestExactBtcScheme_Settle_BroadcastFails(t *testing.T) {
	signer := &mockBtcFacilitatorSigner{
		verifyValid:  true,
		verifyPayer:  "bc1qpayer123",
		broadcastErr: fmt.Errorf("broadcast failed"),
	}
	scheme := NewExactBtcScheme(signer, nil)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"signedPsbt": "cHNidF9icm9hZGNhc3RfZmFpbA==",
		},
		Accepted: types.PaymentRequirements{
			Scheme:  btc.SchemeExact,
			Network: btc.BtcMainnetCAIP2,
		},
	}
	requirements := types.PaymentRequirements{
		Network: btc.BtcMainnetCAIP2,
		PayTo:   "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
		Amount:  "100000",
	}

	_, err := scheme.Settle(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("Settle() expected error, got nil")
	}
	se, ok := err.(*t402.SettleError)
	if !ok {
		t.Fatalf("expected *t402.SettleError, got %T", err)
	}
	if se.Reason != "broadcast_failed" {
		t.Errorf("SettleError.Reason = %v, want broadcast_failed", se.Reason)
	}
}

func TestExactBtcScheme_Settle_NotConfirmed(t *testing.T) {
	signer := &mockBtcFacilitatorSigner{
		verifyValid: true,
		verifyPayer: "bc1qpayer123",
		broadcastTx: "txid_unconfirmed",
		confirmed:   false,
	}
	scheme := NewExactBtcScheme(signer, nil)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"signedPsbt": "cHNidF91bmNvbmZpcm1lZA==",
		},
		Accepted: types.PaymentRequirements{
			Scheme:  btc.SchemeExact,
			Network: btc.BtcMainnetCAIP2,
		},
	}
	requirements := types.PaymentRequirements{
		Network: btc.BtcMainnetCAIP2,
		PayTo:   "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
		Amount:  "100000",
	}

	_, err := scheme.Settle(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("Settle() expected error, got nil")
	}
	se, ok := err.(*t402.SettleError)
	if !ok {
		t.Fatalf("expected *t402.SettleError, got %T", err)
	}
	if se.Reason != "transaction_not_confirmed" {
		t.Errorf("SettleError.Reason = %v, want transaction_not_confirmed", se.Reason)
	}
}

// Test Lightning facilitator

func TestLightningScheme_Scheme(t *testing.T) {
	signer := &mockLightningFacilitatorSigner{}
	scheme := NewLightningScheme(signer)
	if scheme.Scheme() != "exact" {
		t.Errorf("Scheme() = %v, want exact", scheme.Scheme())
	}
}

func TestLightningScheme_CaipFamily(t *testing.T) {
	signer := &mockLightningFacilitatorSigner{}
	scheme := NewLightningScheme(signer)
	if scheme.CaipFamily() != "lightning:*" {
		t.Errorf("CaipFamily() = %v, want lightning:*", scheme.CaipFamily())
	}
}

func TestLightningScheme_GetExtra(t *testing.T) {
	signer := &mockLightningFacilitatorSigner{}
	scheme := NewLightningScheme(signer)
	extra := scheme.GetExtra(t402.Network(btc.LightningMainnetCAIP2))
	if extra != nil {
		t.Errorf("GetExtra() = %v, want nil", extra)
	}
}

func TestLightningScheme_GetSigners(t *testing.T) {
	signer := &mockLightningFacilitatorSigner{
		addresses: []string{"02abc123nodepubkey"},
	}
	scheme := NewLightningScheme(signer)
	signers := scheme.GetSigners(t402.Network(btc.LightningMainnetCAIP2))
	if len(signers) != 1 || signers[0] != "02abc123nodepubkey" {
		t.Errorf("GetSigners() = %v, want [02abc123nodepubkey]", signers)
	}
}

func TestLightningScheme_Verify_Success(t *testing.T) {
	// Generate a valid preimage/hash pair
	preimageHex := "0000000000000000000000000000000000000000000000000000000000000001"
	preimageBytes, _ := hex.DecodeString(preimageHex)
	hashBytes := sha256.Sum256(preimageBytes)
	paymentHashHex := hex.EncodeToString(hashBytes[:])

	signer := &mockLightningFacilitatorSigner{
		settled:    true,
		amountSats: "10000",
	}
	scheme := NewLightningScheme(signer)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"paymentHash":   paymentHashHex,
			"preimage":      preimageHex,
			"bolt11Invoice": "lnbc100n1psj9jhxdqud3jxktt5w46x7unfv9kz6mn0v3jsnp4q0d3p2sfluzdx45tqcs",
		},
		Accepted: types.PaymentRequirements{
			Scheme:  btc.SchemeExact,
			Network: btc.LightningMainnetCAIP2,
		},
	}

	requirements := types.PaymentRequirements{
		Scheme:  btc.SchemeExact,
		Network: btc.LightningMainnetCAIP2,
		Amount:  "10000",
	}

	resp, err := scheme.Verify(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("Verify() error: %v", err)
	}
	if !resp.IsValid {
		t.Error("IsValid should be true")
	}
}

func TestLightningScheme_Verify_Errors(t *testing.T) {
	validPreimage := "0000000000000000000000000000000000000000000000000000000000000001"
	preimageBytes, _ := hex.DecodeString(validPreimage)
	hashBytes := sha256.Sum256(preimageBytes)
	validHash := hex.EncodeToString(hashBytes[:])

	tests := []struct {
		name         string
		signer       *mockLightningFacilitatorSigner
		payload      types.PaymentPayload
		requirements types.PaymentRequirements
		wantReason   string
	}{
		{
			name:   "invalid scheme",
			signer: &mockLightningFacilitatorSigner{},
			payload: types.PaymentPayload{
				Accepted: types.PaymentRequirements{
					Scheme:  "exact-direct",
					Network: btc.LightningMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: btc.LightningMainnetCAIP2,
			},
			wantReason: "invalid_scheme",
		},
		{
			name:   "network mismatch",
			signer: &mockLightningFacilitatorSigner{},
			payload: types.PaymentPayload{
				Accepted: types.PaymentRequirements{
					Scheme:  btc.SchemeExact,
					Network: btc.LightningTestnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: btc.LightningMainnetCAIP2,
			},
			wantReason: "network_mismatch",
		},
		{
			name:   "unsupported network",
			signer: &mockLightningFacilitatorSigner{},
			payload: types.PaymentPayload{
				Accepted: types.PaymentRequirements{
					Scheme:  btc.SchemeExact,
					Network: "lightning:custom",
				},
			},
			requirements: types.PaymentRequirements{
				Network: "lightning:custom",
			},
			wantReason: "unsupported_network",
		},
		{
			name:   "missing payload fields",
			signer: &mockLightningFacilitatorSigner{},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"paymentHash": validHash,
				},
				Accepted: types.PaymentRequirements{
					Scheme:  btc.SchemeExact,
					Network: btc.LightningMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: btc.LightningMainnetCAIP2,
			},
			wantReason: "invalid_payload_structure",
		},
		{
			name:   "invalid preimage format",
			signer: &mockLightningFacilitatorSigner{},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"paymentHash":   validHash,
					"preimage":      "tooshort",
					"bolt11Invoice": "lnbc100n1psj9jhxdqud3jxktt5w46x7unfv9kz6mn0v3jsnp4q0d3p2sfluzdx45tqcs",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  btc.SchemeExact,
					Network: btc.LightningMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: btc.LightningMainnetCAIP2,
			},
			wantReason: "invalid_preimage_format",
		},
		{
			name:   "preimage hash mismatch",
			signer: &mockLightningFacilitatorSigner{settled: true},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"paymentHash":   "0000000000000000000000000000000000000000000000000000000000000000",
					"preimage":      validPreimage,
					"bolt11Invoice": "lnbc100n1psj9jhxdqud3jxktt5w46x7unfv9kz6mn0v3jsnp4q0d3p2sfluzdx45tqcs",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  btc.SchemeExact,
					Network: btc.LightningMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: btc.LightningMainnetCAIP2,
			},
			wantReason: "preimage_hash_mismatch",
		},
		{
			name: "payment not settled",
			signer: &mockLightningFacilitatorSigner{
				settled: false,
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"paymentHash":   validHash,
					"preimage":      validPreimage,
					"bolt11Invoice": "lnbc100n1psj9jhxdqud3jxktt5w46x7unfv9kz6mn0v3jsnp4q0d3p2sfluzdx45tqcs",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  btc.SchemeExact,
					Network: btc.LightningMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: btc.LightningMainnetCAIP2,
				Amount:  "10000",
			},
			wantReason: "payment_not_settled",
		},
		{
			name: "insufficient amount",
			signer: &mockLightningFacilitatorSigner{
				settled:    true,
				amountSats: "5000",
			},
			payload: types.PaymentPayload{
				Payload: map[string]interface{}{
					"paymentHash":   validHash,
					"preimage":      validPreimage,
					"bolt11Invoice": "lnbc100n1psj9jhxdqud3jxktt5w46x7unfv9kz6mn0v3jsnp4q0d3p2sfluzdx45tqcs",
				},
				Accepted: types.PaymentRequirements{
					Scheme:  btc.SchemeExact,
					Network: btc.LightningMainnetCAIP2,
				},
			},
			requirements: types.PaymentRequirements{
				Network: btc.LightningMainnetCAIP2,
				Amount:  "10000",
			},
			wantReason: "insufficient_amount",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := NewLightningScheme(tt.signer)
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

func TestLightningScheme_Verify_ReplayProtection(t *testing.T) {
	preimageHex := "0000000000000000000000000000000000000000000000000000000000000001"
	preimageBytes, _ := hex.DecodeString(preimageHex)
	hashBytes := sha256.Sum256(preimageBytes)
	paymentHashHex := hex.EncodeToString(hashBytes[:])

	signer := &mockLightningFacilitatorSigner{
		settled:    true,
		amountSats: "10000",
	}
	scheme := NewLightningScheme(signer)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"paymentHash":   paymentHashHex,
			"preimage":      preimageHex,
			"bolt11Invoice": "lnbc100n1psj9jhxdqud3jxktt5w46x7unfv9kz6mn0v3jsnp4q0d3p2sfluzdx45tqcs",
		},
		Accepted: types.PaymentRequirements{
			Scheme:  btc.SchemeExact,
			Network: btc.LightningMainnetCAIP2,
		},
	}
	requirements := types.PaymentRequirements{
		Network: btc.LightningMainnetCAIP2,
		Amount:  "10000",
	}

	// First verify should succeed
	resp, err := scheme.Verify(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("first Verify() error: %v", err)
	}
	if !resp.IsValid {
		t.Error("first Verify() should be valid")
	}

	// Second verify with same hash should fail
	_, err = scheme.Verify(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("second Verify() expected error (replay), got nil")
	}
	ve, ok := err.(*t402.VerifyError)
	if !ok {
		t.Fatalf("expected *t402.VerifyError, got %T", err)
	}
	if ve.Reason != "payment_hash_already_used" {
		t.Errorf("VerifyError.Reason = %v, want payment_hash_already_used", ve.Reason)
	}
}

func TestLightningScheme_Settle_Success(t *testing.T) {
	preimageHex := "0000000000000000000000000000000000000000000000000000000000000001"
	preimageBytes, _ := hex.DecodeString(preimageHex)
	hashBytes := sha256.Sum256(preimageBytes)
	paymentHashHex := hex.EncodeToString(hashBytes[:])

	signer := &mockLightningFacilitatorSigner{
		settled:    true,
		amountSats: "10000",
	}
	scheme := NewLightningScheme(signer)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"paymentHash":   paymentHashHex,
			"preimage":      preimageHex,
			"bolt11Invoice": "lnbc100n1psj9jhxdqud3jxktt5w46x7unfv9kz6mn0v3jsnp4q0d3p2sfluzdx45tqcs",
		},
		Accepted: types.PaymentRequirements{
			Scheme:  btc.SchemeExact,
			Network: btc.LightningMainnetCAIP2,
		},
	}
	requirements := types.PaymentRequirements{
		Network: btc.LightningMainnetCAIP2,
		Amount:  "10000",
	}

	resp, err := scheme.Settle(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("Settle() error: %v", err)
	}
	if !resp.Success {
		t.Error("Success should be true")
	}
	if resp.Transaction != paymentHashHex {
		t.Errorf("Transaction = %v, want %v", resp.Transaction, paymentHashHex)
	}
	if string(resp.Network) != btc.LightningMainnetCAIP2 {
		t.Errorf("Network = %v, want %v", resp.Network, btc.LightningMainnetCAIP2)
	}
}

func TestLightningScheme_Settle_VerifyFails(t *testing.T) {
	signer := &mockLightningFacilitatorSigner{}
	scheme := NewLightningScheme(signer)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload:     map[string]interface{}{},
		Accepted: types.PaymentRequirements{
			Scheme:  btc.SchemeExact,
			Network: btc.LightningMainnetCAIP2,
		},
	}
	requirements := types.PaymentRequirements{
		Network: btc.LightningMainnetCAIP2,
	}

	_, err := scheme.Settle(context.Background(), payload, requirements)
	if err == nil {
		t.Fatal("Settle() expected error, got nil")
	}
	se, ok := err.(*t402.SettleError)
	if !ok {
		t.Fatalf("expected *t402.SettleError, got %T: %v", err, err)
	}
	if se.Reason != "invalid_payload_structure" {
		t.Errorf("SettleError.Reason = %v, want invalid_payload_structure", se.Reason)
	}
}

func TestLightningScheme_Verify_LookupErrorFallsBackToPreimage(t *testing.T) {
	preimageHex := "0000000000000000000000000000000000000000000000000000000000000001"
	preimageBytes, _ := hex.DecodeString(preimageHex)
	hashBytes := sha256.Sum256(preimageBytes)
	paymentHashHex := hex.EncodeToString(hashBytes[:])

	signer := &mockLightningFacilitatorSigner{
		lookupErr: fmt.Errorf("node unavailable"),
	}
	scheme := NewLightningScheme(signer)

	payload := types.PaymentPayload{
		T402Version: 2,
		Payload: map[string]interface{}{
			"paymentHash":   paymentHashHex,
			"preimage":      preimageHex,
			"bolt11Invoice": "lnbc100n1psj9jhxdqud3jxktt5w46x7unfv9kz6mn0v3jsnp4q0d3p2sfluzdx45tqcs",
		},
		Accepted: types.PaymentRequirements{
			Scheme:  btc.SchemeExact,
			Network: btc.LightningMainnetCAIP2,
		},
	}
	requirements := types.PaymentRequirements{
		Network: btc.LightningMainnetCAIP2,
		Amount:  "10000",
	}

	// Should still succeed because preimage verification is sufficient
	resp, err := scheme.Verify(context.Background(), payload, requirements)
	if err != nil {
		t.Fatalf("Verify() error: %v", err)
	}
	if !resp.IsValid {
		t.Error("IsValid should be true (preimage verification sufficient)")
	}
}
