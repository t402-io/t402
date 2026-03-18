package client

import (
	"testing"

	"github.com/t402-io/t402/sdks/go/mechanisms/evm"
	"github.com/t402-io/t402/sdks/go/types"
)

func TestNewERC7710ClientScheme(t *testing.T) {
	s, err := NewERC7710ClientScheme(Config{
		DelegationManager: "0xDM",
		PermissionContext:  "0xPC",
		Delegator:         "0xDelegator",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if s.Scheme() != evm.SchemeExact {
		t.Errorf("expected exact, got %s", s.Scheme())
	}
	if s.CaipFamily() != "eip155:*" {
		t.Errorf("expected eip155:*, got %s", s.CaipFamily())
	}
}

func TestNewERC7710ClientScheme_MissingFields(t *testing.T) {
	_, err := NewERC7710ClientScheme(Config{})
	if err == nil {
		t.Error("expected error for empty config")
	}

	_, err = NewERC7710ClientScheme(Config{DelegationManager: "0xDM"})
	if err == nil {
		t.Error("expected error for missing permissionContext")
	}

	_, err = NewERC7710ClientScheme(Config{DelegationManager: "0xDM", PermissionContext: "0xPC"})
	if err == nil {
		t.Error("expected error for missing delegator")
	}
}

func TestCreatePaymentPayload(t *testing.T) {
	s, _ := NewERC7710ClientScheme(Config{
		DelegationManager: "0xDelegationManager",
		PermissionContext:  "0xabcdef",
		Delegator:         "0xDelegator",
	})

	payload, err := s.CreatePaymentPayload(2, types.PaymentRequirements{
		Scheme:  "exact",
		Network: "eip155:8453",
		Asset:   "0xUSDC",
		Amount:  "1000000",
		PayTo:   "0xRecipient",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if payload.T402Version != 2 {
		t.Errorf("expected version 2, got %d", payload.T402Version)
	}
	dm, ok := payload.Payload["delegationManager"].(string)
	if !ok || dm != "0xDelegationManager" {
		t.Errorf("wrong delegationManager: %v", payload.Payload["delegationManager"])
	}
	pc, ok := payload.Payload["permissionContext"].(string)
	if !ok || pc != "0xabcdef" {
		t.Errorf("wrong permissionContext: %v", payload.Payload["permissionContext"])
	}
	d, ok := payload.Payload["delegator"].(string)
	if !ok || d != "0xDelegator" {
		t.Errorf("wrong delegator: %v", payload.Payload["delegator"])
	}
}
