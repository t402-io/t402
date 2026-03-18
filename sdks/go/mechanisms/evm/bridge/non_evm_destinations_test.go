package bridge

import (
	"testing"
)

func TestNonEvmDestinations(t *testing.T) {
	if len(NonEvmDestinations) != 3 {
		t.Errorf("expected 3 destinations, got %d", len(NonEvmDestinations))
	}

	sol := NonEvmDestinations["solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp"]
	if sol.EndpointID != 30168 {
		t.Errorf("wrong Solana endpoint: %d", sol.EndpointID)
	}
	if sol.AddressFormat != AddressBase58 {
		t.Error("Solana should use base58")
	}

	ton := NonEvmDestinations["ton:mainnet"]
	if ton.EndpointID != 30343 {
		t.Errorf("wrong TON endpoint: %d", ton.EndpointID)
	}

	tron := NonEvmDestinations["tron:mainnet"]
	if tron.EndpointID != 30420 {
		t.Errorf("wrong TRON endpoint: %d", tron.EndpointID)
	}
}

func TestEncodeRecipientBytes32_Hex(t *testing.T) {
	result, err := EncodeRecipientBytes32("0xabcdef", AddressHex)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Should be right-aligned in 32 bytes
	if result[31] != 0xef || result[30] != 0xcd || result[29] != 0xab {
		t.Errorf("wrong encoding: %x", result)
	}
}

func TestEncodeRecipientBytes32_Base58(t *testing.T) {
	// "1" in base58 = 0x00
	result, err := EncodeRecipientBytes32("11111111111111111111111111111111", AddressBase58)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// All zeros
	for _, b := range result {
		if b != 0 {
			t.Errorf("expected all zeros for base58 '1's, got %x", result)
			break
		}
	}
}

func TestHexDecode(t *testing.T) {
	b, _ := hexDecode("0xabcd")
	if len(b) != 2 || b[0] != 0xab || b[1] != 0xcd {
		t.Errorf("wrong decode: %x", b)
	}

	b, _ = hexDecode("1234")
	if len(b) != 2 || b[0] != 0x12 || b[1] != 0x34 {
		t.Errorf("wrong decode without 0x: %x", b)
	}
}
