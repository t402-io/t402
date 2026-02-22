package client

import (
	"context"
	"fmt"
	"testing"

	"github.com/t402-io/t402/sdks/go/mechanisms/btc"
	"github.com/t402-io/t402/sdks/go/types"
)

// mockBtcSigner implements ClientBtcSigner for testing
type mockBtcSigner struct {
	address   string
	publicKey string
	signErr   error
}

func (m *mockBtcSigner) SignPsbt(psbt string) (string, error) {
	if m.signErr != nil {
		return "", m.signErr
	}
	return "signed_" + psbt, nil
}

func (m *mockBtcSigner) GetAddress() string   { return m.address }
func (m *mockBtcSigner) GetPublicKey() string  { return m.publicKey }

// mockLightningSigner implements ClientLightningSigner for testing
type mockLightningSigner struct {
	nodePubKey  string
	preimage    string
	paymentHash string
	payErr      error
}

func (m *mockLightningSigner) PayInvoice(bolt11 string) (string, string, error) {
	if m.payErr != nil {
		return "", "", m.payErr
	}
	return m.preimage, m.paymentHash, nil
}

func (m *mockLightningSigner) GetNodePubKey() string { return m.nodePubKey }

func TestExactBtcScheme_Scheme(t *testing.T) {
	scheme := NewExactBtcScheme(&mockBtcSigner{})
	if scheme.Scheme() != "exact" {
		t.Errorf("Scheme() = %v, want exact", scheme.Scheme())
	}
}

func TestExactBtcScheme_CreatePaymentPayload_Success(t *testing.T) {
	signer := &mockBtcSigner{
		address:   "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
		publicKey: "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
	}
	scheme := NewExactBtcScheme(signer)

	payload, err := scheme.CreatePaymentPayload(context.Background(), types.PaymentRequirements{
		Scheme:  btc.SchemeExact,
		Network: btc.BtcMainnetCAIP2,
		PayTo:   "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
		Amount:  "100000",
		Asset:   "BTC",
	})

	if err != nil {
		t.Fatalf("CreatePaymentPayload() error: %v", err)
	}

	if payload.T402Version != 2 {
		t.Errorf("T402Version = %v, want 2", payload.T402Version)
	}
	if payload.Accepted.Scheme != btc.SchemeExact {
		t.Errorf("Accepted.Scheme = %v, want exact", payload.Accepted.Scheme)
	}
	if payload.Payload["signedPsbt"] == nil {
		t.Error("payload should contain signedPsbt")
	}
}

func TestExactBtcScheme_CreatePaymentPayload_Errors(t *testing.T) {
	signer := &mockBtcSigner{
		address:   "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
		publicKey: "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
	}

	tests := []struct {
		name         string
		requirements types.PaymentRequirements
		signer       *mockBtcSigner
		wantErr      string
	}{
		{
			name: "missing payTo",
			requirements: types.PaymentRequirements{
				Network: btc.BtcMainnetCAIP2,
				Amount:  "100000",
			},
			signer:  signer,
			wantErr: "payTo address is required",
		},
		{
			name: "missing amount",
			requirements: types.PaymentRequirements{
				Network: btc.BtcMainnetCAIP2,
				PayTo:   "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
			},
			signer:  signer,
			wantErr: "amount is required",
		},
		{
			name: "invalid address",
			requirements: types.PaymentRequirements{
				Network: btc.BtcMainnetCAIP2,
				PayTo:   "invalid",
				Amount:  "100000",
			},
			signer:  signer,
			wantErr: "invalid Bitcoin address",
		},
		{
			name: "amount below dust limit",
			requirements: types.PaymentRequirements{
				Network: btc.BtcMainnetCAIP2,
				PayTo:   "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
				Amount:  "100",
			},
			signer:  signer,
			wantErr: "below dust limit",
		},
		{
			name: "sign error",
			requirements: types.PaymentRequirements{
				Network: btc.BtcMainnetCAIP2,
				PayTo:   "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
				Amount:  "100000",
			},
			signer: &mockBtcSigner{
				address:   "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
				publicKey: "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
				signErr:   fmt.Errorf("signing failed"),
			},
			wantErr: "failed to sign PSBT",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := NewExactBtcScheme(tt.signer)
			_, err := scheme.CreatePaymentPayload(context.Background(), tt.requirements)
			if err == nil {
				t.Fatal("expected error, got nil")
			}
			if got := err.Error(); !contains(got, tt.wantErr) {
				t.Errorf("error = %q, want to contain %q", got, tt.wantErr)
			}
		})
	}
}

func TestLightningScheme_Scheme(t *testing.T) {
	scheme := NewLightningScheme(&mockLightningSigner{})
	if scheme.Scheme() != "exact" {
		t.Errorf("Scheme() = %v, want exact", scheme.Scheme())
	}
}

func TestLightningScheme_CreatePaymentPayload_Success(t *testing.T) {
	signer := &mockLightningSigner{
		nodePubKey:  "02abc123",
		preimage:    "0000000000000000000000000000000000000000000000000000000000000001",
		paymentHash: "ec4916dd28fc4c10d78e287ca5d9cc51ee1ae73cbfde08c6b37324cbfaac8bc5",
	}
	scheme := NewLightningScheme(signer)

	bolt11 := "lnbc100n1psj9jhxdqud3jxktt5w46x7unfv9kz6mn0v3jsnp4q0d3p2sfluzdx45tqcs"
	payload, err := scheme.CreatePaymentPayload(context.Background(), types.PaymentRequirements{
		Scheme:  btc.SchemeExact,
		Network: btc.LightningMainnetCAIP2,
		Amount:  "10000",
		Extra: map[string]interface{}{
			"bolt11Invoice": bolt11,
		},
	})

	if err != nil {
		t.Fatalf("CreatePaymentPayload() error: %v", err)
	}

	if payload.Payload["preimage"] != signer.preimage {
		t.Errorf("preimage = %v, want %v", payload.Payload["preimage"], signer.preimage)
	}
	if payload.Payload["paymentHash"] != signer.paymentHash {
		t.Errorf("paymentHash = %v, want %v", payload.Payload["paymentHash"], signer.paymentHash)
	}
	if payload.Payload["bolt11Invoice"] != bolt11 {
		t.Errorf("bolt11Invoice = %v, want %v", payload.Payload["bolt11Invoice"], bolt11)
	}
}

func TestLightningScheme_CreatePaymentPayload_Errors(t *testing.T) {
	tests := []struct {
		name         string
		requirements types.PaymentRequirements
		signer       *mockLightningSigner
		wantErr      string
	}{
		{
			name: "missing bolt11 invoice",
			requirements: types.PaymentRequirements{
				Network: btc.LightningMainnetCAIP2,
				Amount:  "10000",
			},
			signer:  &mockLightningSigner{},
			wantErr: "BOLT11 invoice is required",
		},
		{
			name: "invalid bolt11 invoice",
			requirements: types.PaymentRequirements{
				Network: btc.LightningMainnetCAIP2,
				Amount:  "10000",
				Extra: map[string]interface{}{
					"bolt11Invoice": "invalid",
				},
			},
			signer:  &mockLightningSigner{},
			wantErr: "invalid BOLT11 invoice",
		},
		{
			name: "pay error",
			requirements: types.PaymentRequirements{
				Network: btc.LightningMainnetCAIP2,
				Amount:  "10000",
				Extra: map[string]interface{}{
					"bolt11Invoice": "lnbc100n1psj9jhxdqud3jxktt5w46x7unfv9kz6mn0v3jsnp4q0d3p2sfluzdx45tqcs",
				},
			},
			signer: &mockLightningSigner{
				payErr: fmt.Errorf("insufficient balance"),
			},
			wantErr: "failed to pay invoice",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheme := NewLightningScheme(tt.signer)
			_, err := scheme.CreatePaymentPayload(context.Background(), tt.requirements)
			if err == nil {
				t.Fatal("expected error, got nil")
			}
			if got := err.Error(); !contains(got, tt.wantErr) {
				t.Errorf("error = %q, want to contain %q", got, tt.wantErr)
			}
		})
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsSubstring(s, substr))
}

func containsSubstring(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
