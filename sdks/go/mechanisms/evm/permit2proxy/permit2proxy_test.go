package permit2proxy

import (
	"testing"

	"github.com/t402-io/t402/sdks/go/mechanisms/evm/permit2"
)

func TestPermit2ProxyPayloadToMap(t *testing.T) {
	payload := &Permit2ProxyPayload{
		Permit: permit2.PermitTransferFrom{
			Permitted: permit2.TokenPermissions{
				Token:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
				Amount: "1000000",
			},
			Nonce:    "12345",
			Deadline: "1700000000",
		},
		Witness: T402Witness{
			To:          "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
			Facilitator: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
			ValidAfter:  "1699999000",
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
	permitMap, ok := m["permit"].(map[string]interface{})
	if !ok {
		t.Fatal("permit field missing or wrong type")
	}
	if permitMap["nonce"] != "12345" {
		t.Errorf("nonce = %v, want 12345", permitMap["nonce"])
	}
	if permitMap["deadline"] != "1700000000" {
		t.Errorf("deadline = %v, want 1700000000", permitMap["deadline"])
	}

	// Validate permitted
	permitted, ok := permitMap["permitted"].(map[string]interface{})
	if !ok {
		t.Fatal("permitted field missing or wrong type")
	}
	if permitted["token"] != "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" {
		t.Errorf("token = %v, want 0x833589...", permitted["token"])
	}
	if permitted["amount"] != "1000000" {
		t.Errorf("amount = %v, want 1000000", permitted["amount"])
	}

	// Validate witness
	witness, ok := m["witness"].(map[string]interface{})
	if !ok {
		t.Fatal("witness field missing or wrong type")
	}
	if witness["to"] != "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" {
		t.Errorf("to = %v, want 0x742d35...", witness["to"])
	}
	if witness["facilitator"] != "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" {
		t.Errorf("facilitator = %v, want 0xabcdef...", witness["facilitator"])
	}
	if witness["validAfter"] != "1699999000" {
		t.Errorf("validAfter = %v, want 1699999000", witness["validAfter"])
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
			"witness": map[string]interface{}{
				"to":          "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
				"facilitator": "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
				"validAfter":  "1699999000",
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
		if payload.Witness.To != "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0" {
			t.Errorf("Witness.To = %s, want 0x742d35...", payload.Witness.To)
		}
		if payload.Witness.Facilitator != "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" {
			t.Errorf("Witness.Facilitator = %s, want 0xabcdef...", payload.Witness.Facilitator)
		}
		if payload.Witness.ValidAfter != "1699999000" {
			t.Errorf("Witness.ValidAfter = %s, want 1699999000", payload.Witness.ValidAfter)
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
		if payload.Witness.To != "" {
			t.Errorf("Witness.To = %s, want empty", payload.Witness.To)
		}
		if payload.Witness.Facilitator != "" {
			t.Errorf("Witness.Facilitator = %s, want empty", payload.Witness.Facilitator)
		}
		if payload.Witness.ValidAfter != "" {
			t.Errorf("Witness.ValidAfter = %s, want empty", payload.Witness.ValidAfter)
		}
	})

	t.Run("roundtrip ToMap -> PayloadFromMap", func(t *testing.T) {
		original := &Permit2ProxyPayload{
			Permit: permit2.PermitTransferFrom{
				Permitted: permit2.TokenPermissions{
					Token:  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
					Amount: "5000000",
				},
				Nonce:    "99999",
				Deadline: "1800000000",
			},
			Witness: T402Witness{
				To:          "0xabcdef0123456789012345678901234567890abc",
				Facilitator: "0xfeedfacedeadbeef00000000000000000000face",
				ValidAfter:  "1799999000",
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
		if restored.Witness.To != original.Witness.To {
			t.Errorf("Witness.To mismatch")
		}
		if restored.Witness.Facilitator != original.Witness.Facilitator {
			t.Errorf("Witness.Facilitator mismatch")
		}
		if restored.Witness.ValidAfter != original.Witness.ValidAfter {
			t.Errorf("Witness.ValidAfter mismatch")
		}
	})
}

func TestSchemePermit2ProxyConstant(t *testing.T) {
	if SchemePermit2Proxy != "permit2-proxy" {
		t.Errorf("SchemePermit2Proxy = %s, want permit2-proxy", SchemePermit2Proxy)
	}
}

func TestProxyAddressConstants(t *testing.T) {
	// These are placeholder addresses (not yet deployed)
	if ExactProxyAddress != "0x0000000000000000000000000000000000000000" {
		t.Errorf("ExactProxyAddress = %s, want zero address", ExactProxyAddress)
	}
	if UptoProxyAddress != "0x0000000000000000000000000000000000000000" {
		t.Errorf("UptoProxyAddress = %s, want zero address", UptoProxyAddress)
	}
}

func TestWitnessTypeConstants(t *testing.T) {
	expectedTypeHash := "Witness(address to,address facilitator,uint256 validAfter)"
	if WitnessTypeHash != expectedTypeHash {
		t.Errorf("WitnessTypeHash = %s, want %s", WitnessTypeHash, expectedTypeHash)
	}

	expectedTypeString := "Witness witness)TokenPermissions(address token,uint256 amount)Witness(address to,address facilitator,uint256 validAfter)"
	if WitnessTypeString != expectedTypeString {
		t.Errorf("WitnessTypeString = %s, want %s", WitnessTypeString, expectedTypeString)
	}
}
