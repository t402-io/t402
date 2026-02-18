package permit2

import (
	"testing"
)

func TestPermit2PayloadToMap(t *testing.T) {
	payload := &Permit2Payload{
		Permit: PermitTransferFrom{
			Permitted: TokenPermissions{
				Token:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				Amount: "1000000",
			},
			Nonce:    "12345",
			Deadline: "1700000000",
		},
		TransferDetails: SignatureTransferDetails{
			To:              "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
			RequestedAmount: "1000000",
		},
		Signature: "0xabc123",
		Owner:     "0x1234567890123456789012345678901234567890",
	}

	m := payload.ToMap()

	// Validate top-level fields
	if m["signature"] != "0xabc123" {
		t.Errorf("signature = %v, want 0xabc123", m["signature"])
	}
	if m["owner"] != "0x1234567890123456789012345678901234567890" {
		t.Errorf("owner = %v, want 0x1234567890123456789012345678901234567890", m["owner"])
	}

	// Validate permit
	permit, ok := m["permit"].(map[string]interface{})
	if !ok {
		t.Fatal("permit field missing or wrong type")
	}
	if permit["nonce"] != "12345" {
		t.Errorf("nonce = %v, want 12345", permit["nonce"])
	}
	if permit["deadline"] != "1700000000" {
		t.Errorf("deadline = %v, want 1700000000", permit["deadline"])
	}

	// Validate permitted
	permitted, ok := permit["permitted"].(map[string]interface{})
	if !ok {
		t.Fatal("permitted field missing or wrong type")
	}
	if permitted["token"] != "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" {
		t.Errorf("token = %v, want 0x833589...", permitted["token"])
	}
	if permitted["amount"] != "1000000" {
		t.Errorf("amount = %v, want 1000000", permitted["amount"])
	}

	// Validate transferDetails
	td, ok := m["transferDetails"].(map[string]interface{})
	if !ok {
		t.Fatal("transferDetails field missing or wrong type")
	}
	if td["to"] != "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" {
		t.Errorf("to = %v, want 0x742d35...", td["to"])
	}
	if td["requestedAmount"] != "1000000" {
		t.Errorf("requestedAmount = %v, want 1000000", td["requestedAmount"])
	}
}

func TestPayloadFromMap(t *testing.T) {
	t.Run("valid payload", func(t *testing.T) {
		data := map[string]interface{}{
			"permit": map[string]interface{}{
				"permitted": map[string]interface{}{
					"token":  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
					"amount": "1000000",
				},
				"nonce":    "12345",
				"deadline": "1700000000",
			},
			"transferDetails": map[string]interface{}{
				"to":              "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
				"requestedAmount": "1000000",
			},
			"signature": "0xabc123",
			"owner":     "0x1234567890123456789012345678901234567890",
		}

		payload, err := PayloadFromMap(data)
		if err != nil {
			t.Fatalf("PayloadFromMap failed: %v", err)
		}

		if payload.Owner != "0x1234567890123456789012345678901234567890" {
			t.Errorf("Owner = %s, want 0x1234...", payload.Owner)
		}
		if payload.Signature != "0xabc123" {
			t.Errorf("Signature = %s, want 0xabc123", payload.Signature)
		}
		if payload.Permit.Permitted.Token != "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" {
			t.Errorf("Token = %s, want 0x833589...", payload.Permit.Permitted.Token)
		}
		if payload.Permit.Permitted.Amount != "1000000" {
			t.Errorf("Amount = %s, want 1000000", payload.Permit.Permitted.Amount)
		}
		if payload.Permit.Nonce != "12345" {
			t.Errorf("Nonce = %s, want 12345", payload.Permit.Nonce)
		}
		if payload.Permit.Deadline != "1700000000" {
			t.Errorf("Deadline = %s, want 1700000000", payload.Permit.Deadline)
		}
		if payload.TransferDetails.To != "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" {
			t.Errorf("To = %s, want 0x742d35...", payload.TransferDetails.To)
		}
		if payload.TransferDetails.RequestedAmount != "1000000" {
			t.Errorf("RequestedAmount = %s, want 1000000", payload.TransferDetails.RequestedAmount)
		}
	})

	t.Run("empty map returns empty payload", func(t *testing.T) {
		payload, err := PayloadFromMap(map[string]interface{}{})
		if err != nil {
			t.Fatalf("PayloadFromMap failed: %v", err)
		}

		if payload.Owner != "" {
			t.Errorf("Owner = %s, want empty", payload.Owner)
		}
		if payload.Signature != "" {
			t.Errorf("Signature = %s, want empty", payload.Signature)
		}
	})

	t.Run("roundtrip ToMap -> PayloadFromMap", func(t *testing.T) {
		original := &Permit2Payload{
			Permit: PermitTransferFrom{
				Permitted: TokenPermissions{
					Token:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
					Amount: "5000000",
				},
				Nonce:    "99999",
				Deadline: "1800000000",
			},
			TransferDetails: SignatureTransferDetails{
				To:              "0xabcdef0123456789012345678901234567890abc",
				RequestedAmount: "5000000",
			},
			Signature: "0xdeadbeef",
			Owner:     "0xfeedfacedeadbeef00000000000000000000face",
		}

		m := original.ToMap()
		restored, err := PayloadFromMap(m)
		if err != nil {
			t.Fatalf("PayloadFromMap failed: %v", err)
		}

		if restored.Owner != original.Owner {
			t.Errorf("Owner mismatch: %s != %s", restored.Owner, original.Owner)
		}
		if restored.Signature != original.Signature {
			t.Errorf("Signature mismatch: %s != %s", restored.Signature, original.Signature)
		}
		if restored.Permit.Permitted.Token != original.Permit.Permitted.Token {
			t.Errorf("Token mismatch")
		}
		if restored.Permit.Permitted.Amount != original.Permit.Permitted.Amount {
			t.Errorf("Amount mismatch")
		}
		if restored.Permit.Nonce != original.Permit.Nonce {
			t.Errorf("Nonce mismatch")
		}
		if restored.Permit.Deadline != original.Permit.Deadline {
			t.Errorf("Deadline mismatch")
		}
		if restored.TransferDetails.To != original.TransferDetails.To {
			t.Errorf("To mismatch")
		}
		if restored.TransferDetails.RequestedAmount != original.TransferDetails.RequestedAmount {
			t.Errorf("RequestedAmount mismatch")
		}
	})
}

func TestSchemePermit2Constant(t *testing.T) {
	if SchemePermit2 != "permit2" {
		t.Errorf("SchemePermit2 = %s, want permit2", SchemePermit2)
	}
}

func TestPermit2AddressConstant(t *testing.T) {
	if Permit2Address != "0x000000000022D473030F116dDEE9F6B43aC78BA3" {
		t.Errorf("Permit2Address = %s, want 0x000000000022D473030F116dDEE9F6B43aC78BA3", Permit2Address)
	}
}
