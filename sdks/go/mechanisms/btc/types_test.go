package btc

import "testing"

func TestPSBTPayload_RoundTrip(t *testing.T) {
	original := &PSBTPayload{
		SignedPsbt: "cHNidDEyMw==",
		TxID:       "abc123",
	}

	m := original.ToMap()
	restored := PayloadFromMap(m)

	if restored.SignedPsbt != original.SignedPsbt {
		t.Errorf("SignedPsbt = %q, want %q", restored.SignedPsbt, original.SignedPsbt)
	}
	if restored.TxID != original.TxID {
		t.Errorf("TxID = %q, want %q", restored.TxID, original.TxID)
	}
}

func TestPSBTPayload_ToMap_OmitsTxID(t *testing.T) {
	payload := &PSBTPayload{
		SignedPsbt: "cHNidDEyMw==",
	}

	m := payload.ToMap()
	if _, ok := m["txId"]; ok {
		t.Error("ToMap should not include txId when empty")
	}
}

func TestPayloadFromMap_Empty(t *testing.T) {
	p := PayloadFromMap(map[string]interface{}{})
	if p.SignedPsbt != "" || p.TxID != "" {
		t.Error("PayloadFromMap with empty map should produce empty payload")
	}
}

func TestPayloadFromMap_Nil(t *testing.T) {
	p := PayloadFromMap(nil)
	if p.SignedPsbt != "" || p.TxID != "" {
		t.Error("PayloadFromMap with nil should produce empty payload")
	}
}

func TestLightningPayload_RoundTrip(t *testing.T) {
	original := &LightningPayload{
		PaymentHash:   "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
		Preimage:      "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
		Bolt11Invoice: "lnbc100n1psj9jhxdqud3jxktt5w46x7unfv9kz6mn0v3jsnp4q0d3p2sfluzdx45tqcs",
	}

	m := original.ToMap()
	restored := LightningPayloadFromMap(m)

	if restored.PaymentHash != original.PaymentHash {
		t.Errorf("PaymentHash = %q, want %q", restored.PaymentHash, original.PaymentHash)
	}
	if restored.Preimage != original.Preimage {
		t.Errorf("Preimage = %q, want %q", restored.Preimage, original.Preimage)
	}
	if restored.Bolt11Invoice != original.Bolt11Invoice {
		t.Errorf("Bolt11Invoice = %q, want %q", restored.Bolt11Invoice, original.Bolt11Invoice)
	}
}

func TestLightningPayloadFromMap_Empty(t *testing.T) {
	p := LightningPayloadFromMap(map[string]interface{}{})
	if p.PaymentHash != "" || p.Preimage != "" || p.Bolt11Invoice != "" {
		t.Error("LightningPayloadFromMap with empty map should produce empty payload")
	}
}
