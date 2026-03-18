package facilitator

import (
	"encoding/hex"
	"math/big"
	"testing"

	"github.com/t402-io/t402/sdks/go/mechanisms/evm"
)

func TestEncodeERC20Transfer(t *testing.T) {
	// Test basic encoding
	data, err := encodeERC20Transfer(
		"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
		"0x209693Bc6afc0C5328bA36FaF03C514EF312287C", // recipient
		"10000", // amount
	)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// ERC-7579 single execution: 20 bytes target + 32 bytes value + calldata
	// calldata = 4 bytes selector + 32 bytes address + 32 bytes amount = 68 bytes
	expectedLen := 20 + 32 + 68
	if len(data) != expectedLen {
		t.Fatalf("expected %d bytes, got %d", expectedLen, len(data))
	}

	// First 20 bytes should be the token address
	tokenAddr := hex.EncodeToString(data[0:20])
	if tokenAddr != "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" {
		t.Errorf("wrong token address: %s", tokenAddr)
	}

	// Next 32 bytes should be zero (no ETH value)
	for i := 20; i < 52; i++ {
		if data[i] != 0 {
			t.Errorf("value byte %d should be 0, got %d", i-20, data[i])
		}
	}

	// Calldata starts at offset 52
	// First 4 bytes: transfer selector
	selector := hex.EncodeToString(data[52:56])
	if selector != "a9059cbb" {
		t.Errorf("wrong selector: %s", selector)
	}

	// Recipient address padded to 32 bytes (at offset 56)
	recipientPadded := hex.EncodeToString(data[56:88])
	if recipientPadded != "000000000000000000000000209693bc6afc0c5328ba36faf03c514ef312287c" {
		t.Errorf("wrong recipient: %s", recipientPadded)
	}

	// Amount padded to 32 bytes (at offset 88)
	amountBig := new(big.Int).SetBytes(data[88:120])
	if amountBig.Int64() != 10000 {
		t.Errorf("wrong amount: %d", amountBig.Int64())
	}
}

func TestEncodeERC20Transfer_InvalidAmount(t *testing.T) {
	_, err := encodeERC20Transfer(
		"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
		"0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
		"not-a-number",
	)
	if err == nil {
		t.Error("expected error for invalid amount")
	}
}

func TestEncodeERC20Transfer_InvalidAddress(t *testing.T) {
	_, err := encodeERC20Transfer(
		"0xinvalid",
		"0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
		"10000",
	)
	if err == nil {
		t.Error("expected error for invalid token address")
	}
}

func TestHexToBytes(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"0xabcd", "abcd"},
		{"abcd", "abcd"},
		{"0x", ""},
	}

	for _, tt := range tests {
		b, err := hexToBytes(tt.input)
		if err != nil {
			t.Errorf("hexToBytes(%q) error: %v", tt.input, err)
			continue
		}
		got := hex.EncodeToString(b)
		if got != tt.expected {
			t.Errorf("hexToBytes(%q) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}

func TestHexToAddress(t *testing.T) {
	addr, err := hexToAddress("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"
	if hex.EncodeToString(addr[:]) != expected {
		t.Errorf("got %s, want %s", hex.EncodeToString(addr[:]), expected)
	}

	// Short address should fail
	_, err = hexToAddress("0xabcd")
	if err == nil {
		t.Error("expected error for short address")
	}
}

func TestNewERC7710Scheme(t *testing.T) {
	scheme := NewERC7710Scheme(nil)
	if scheme == nil {
		t.Fatal("expected non-nil scheme")
	}
	if scheme.Scheme() != evm.SchemeExact {
		t.Errorf("expected scheme %q, got %q", evm.SchemeExact, scheme.Scheme())
	}
	if scheme.CaipFamily() != "eip155:*" {
		t.Errorf("expected family eip155:*, got %q", scheme.CaipFamily())
	}
}

func TestSingleCallMode(t *testing.T) {
	// ERC-7579 single call mode should be all zeros
	for i, b := range SingleCallMode {
		if b != 0 {
			t.Errorf("SingleCallMode[%d] = %d, want 0", i, b)
		}
	}
}

func TestERC7710PayloadFromMap(t *testing.T) {
	data := map[string]interface{}{
		"delegationManager": "0xDelegationManagerAddress",
		"permissionContext": "0xabcdef",
		"delegator":         "0x857b06519E91e3A54538791bDbb0E22373e36b66",
	}

	payload, err := evm.ERC7710PayloadFromMap(data)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if payload.DelegationManager != "0xDelegationManagerAddress" {
		t.Errorf("wrong delegationManager: %s", payload.DelegationManager)
	}
	if payload.PermissionContext != "0xabcdef" {
		t.Errorf("wrong permissionContext: %s", payload.PermissionContext)
	}
	if payload.Delegator != "0x857b06519E91e3A54538791bDbb0E22373e36b66" {
		t.Errorf("wrong delegator: %s", payload.Delegator)
	}
}

func TestERC7710PayloadFromMap_MissingFields(t *testing.T) {
	data := map[string]interface{}{
		"delegationManager": "0xDelegationManagerAddress",
		// missing permissionContext and delegator
	}

	_, err := evm.ERC7710PayloadFromMap(data)
	if err == nil {
		t.Error("expected error for missing fields")
	}
}
