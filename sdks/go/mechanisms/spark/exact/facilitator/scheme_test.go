package facilitator

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"testing"

	"github.com/t402-io/t402/sdks/go/mechanisms/spark"
	"github.com/t402-io/t402/sdks/go/types"
)

type mockSparkSigner struct {
	transfers map[string]*spark.TransferInfo
	address   string
}

func (m *mockSparkSigner) GetTransfer(id string) (*spark.TransferInfo, error) {
	t, ok := m.transfers[id]
	if !ok {
		return nil, fmt.Errorf("transfer not found: %s", id)
	}
	return t, nil
}
func (m *mockSparkSigner) GetAddress() string { return m.address }

func newMockSigner(transfers ...*spark.TransferInfo) *mockSparkSigner {
	m := &mockSparkSigner{
		transfers: make(map[string]*spark.TransferInfo),
		address:   "spark:server123",
	}
	for _, t := range transfers {
		m.transfers[t.ID] = t
	}
	return m
}

func TestVerifySparkTransfer(t *testing.T) {
	signer := newMockSigner(&spark.TransferInfo{
		ID: "tx-001", Amount: 1000, Sender: "spark:sender", Receiver: "spark:server123", Status: spark.TransferCompleted,
	})
	f := NewSparkFacilitatorScheme(signer)

	resp, err := f.Verify(context.Background(),
		types.PaymentPayload{Payload: map[string]interface{}{"paymentType": "spark", "transferId": "tx-001"}},
		types.PaymentRequirements{Scheme: "exact", Network: "spark:mainnet", Amount: "1000"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resp.IsValid {
		t.Error("expected valid")
	}
	if resp.Payer != "spark:sender" {
		t.Errorf("wrong payer: %s", resp.Payer)
	}
}

func TestVerifySparkInsufficientAmount(t *testing.T) {
	signer := newMockSigner(&spark.TransferInfo{
		ID: "tx-001", Amount: 500, Sender: "spark:sender", Receiver: "spark:server123", Status: spark.TransferCompleted,
	})
	f := NewSparkFacilitatorScheme(signer)

	_, err := f.Verify(context.Background(),
		types.PaymentPayload{Payload: map[string]interface{}{"paymentType": "spark", "transferId": "tx-001"}},
		types.PaymentRequirements{Scheme: "exact", Network: "spark:mainnet", Amount: "1000"})
	if err == nil {
		t.Error("expected error for insufficient amount")
	}
}

func TestVerifySparkWrongRecipient(t *testing.T) {
	signer := newMockSigner(&spark.TransferInfo{
		ID: "tx-001", Amount: 1000, Sender: "spark:sender", Receiver: "spark:wrong", Status: spark.TransferCompleted,
	})
	f := NewSparkFacilitatorScheme(signer)

	_, err := f.Verify(context.Background(),
		types.PaymentPayload{Payload: map[string]interface{}{"paymentType": "spark", "transferId": "tx-001"}},
		types.PaymentRequirements{Scheme: "exact", Network: "spark:mainnet", Amount: "1000"})
	if err == nil {
		t.Error("expected error for wrong recipient")
	}
}

func TestVerifySparkNotCompleted(t *testing.T) {
	signer := newMockSigner(&spark.TransferInfo{
		ID: "tx-001", Amount: 1000, Sender: "spark:sender", Receiver: "spark:server123", Status: spark.TransferPending,
	})
	f := NewSparkFacilitatorScheme(signer)

	_, err := f.Verify(context.Background(),
		types.PaymentPayload{Payload: map[string]interface{}{"paymentType": "spark", "transferId": "tx-001"}},
		types.PaymentRequirements{Scheme: "exact", Network: "spark:mainnet", Amount: "1000"})
	if err == nil {
		t.Error("expected error for pending transfer")
	}
}

func TestVerifySparkNotFound(t *testing.T) {
	signer := newMockSigner()
	f := NewSparkFacilitatorScheme(signer)

	_, err := f.Verify(context.Background(),
		types.PaymentPayload{Payload: map[string]interface{}{"paymentType": "spark", "transferId": "tx-nonexistent"}},
		types.PaymentRequirements{Scheme: "exact", Network: "spark:mainnet", Amount: "1000"})
	if err == nil {
		t.Error("expected error for not found")
	}
}

func TestVerifySparkReplayProtection(t *testing.T) {
	signer := newMockSigner(&spark.TransferInfo{
		ID: "tx-001", Amount: 1000, Sender: "spark:sender", Receiver: "spark:server123", Status: spark.TransferCompleted,
	})
	f := NewSparkFacilitatorScheme(signer)

	// First verify succeeds
	_, err := f.Verify(context.Background(),
		types.PaymentPayload{Payload: map[string]interface{}{"paymentType": "spark", "transferId": "tx-001"}},
		types.PaymentRequirements{Scheme: "exact", Network: "spark:mainnet", Amount: "1000"})
	if err != nil {
		t.Fatalf("first verify should succeed: %v", err)
	}

	// Second verify fails (replay)
	_, err = f.Verify(context.Background(),
		types.PaymentPayload{Payload: map[string]interface{}{"paymentType": "spark", "transferId": "tx-001"}},
		types.PaymentRequirements{Scheme: "exact", Network: "spark:mainnet", Amount: "1000"})
	if err == nil {
		t.Error("expected replay detection error")
	}
}

func TestVerifyLightning(t *testing.T) {
	// Create a known preimage and compute its hash
	preimage := []byte("secret-preimage-32bytes-padding!")
	hash := sha256.Sum256(preimage)
	preimageHex := hex.EncodeToString(preimage)
	hashHex := hex.EncodeToString(hash[:])

	signer := newMockSigner()
	f := NewSparkFacilitatorScheme(signer)

	resp, err := f.Verify(context.Background(),
		types.PaymentPayload{Payload: map[string]interface{}{
			"paymentType": "lightning", "preimage": preimageHex, "paymentHash": hashHex,
		}},
		types.PaymentRequirements{Scheme: "exact", Network: "spark:mainnet", Amount: "1000"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resp.IsValid {
		t.Error("expected valid")
	}
}

func TestVerifyLightningBadPreimage(t *testing.T) {
	signer := newMockSigner()
	f := NewSparkFacilitatorScheme(signer)

	_, err := f.Verify(context.Background(),
		types.PaymentPayload{Payload: map[string]interface{}{
			"paymentType": "lightning", "preimage": "aabbccdd", "paymentHash": "0000000000000000000000000000000000000000000000000000000000000000",
		}},
		types.PaymentRequirements{Scheme: "exact", Network: "spark:mainnet", Amount: "1000"})
	if err == nil {
		t.Error("expected error for bad preimage")
	}
}

func TestVerifyUnsupportedType(t *testing.T) {
	f := NewSparkFacilitatorScheme(newMockSigner())
	_, err := f.Verify(context.Background(),
		types.PaymentPayload{Payload: map[string]interface{}{"paymentType": "l1"}},
		types.PaymentRequirements{Scheme: "exact", Network: "spark:mainnet", Amount: "1000"})
	if err == nil {
		t.Error("expected error for unsupported type")
	}
}

func TestSettleSuccess(t *testing.T) {
	signer := newMockSigner(&spark.TransferInfo{
		ID: "tx-001", Amount: 1000, Sender: "spark:sender", Receiver: "spark:server123", Status: spark.TransferCompleted,
	})
	f := NewSparkFacilitatorScheme(signer)

	resp, err := f.Settle(context.Background(),
		types.PaymentPayload{Payload: map[string]interface{}{"paymentType": "spark", "transferId": "tx-001"}},
		types.PaymentRequirements{Scheme: "exact", Network: "spark:mainnet", Amount: "1000"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !resp.Success {
		t.Error("expected success")
	}
	if resp.Transaction != "tx-001" {
		t.Errorf("expected tx-001, got %s", resp.Transaction)
	}
}

func TestSchemeAndFamily(t *testing.T) {
	f := NewSparkFacilitatorScheme(newMockSigner())
	if f.Scheme() != "exact" {
		t.Errorf("expected exact, got %s", f.Scheme())
	}
	if f.CaipFamily() != "spark:*" {
		t.Errorf("expected spark:*, got %s", f.CaipFamily())
	}
}
