package erc7715

import (
	"math/big"
	"testing"
	"time"
)

func TestSpendPermissionState_IsValid(t *testing.T) {
	now := time.Now()
	perm := &SpendPermission{
		Granter:           "0xGranter",
		Grantee:           "0xGrantee",
		Token:             "0xUSDC",
		MaxPerTransaction: big.NewInt(1_000_000),
		TotalBudget:       big.NewInt(10_000_000),
		ValidAfter:        now.Add(-1 * time.Hour).Unix(),
		ValidBefore:       now.Add(1 * time.Hour).Unix(),
	}
	state := NewSpendPermissionState(perm)

	// Valid payment
	ok, _ := state.IsValid(big.NewInt(500_000), "0xRecipient", now)
	if !ok {
		t.Error("expected valid")
	}

	// Exceeds per-tx limit
	ok, reason := state.IsValid(big.NewInt(2_000_000), "0xRecipient", now)
	if ok {
		t.Error("expected invalid: exceeds per-tx limit")
	}
	if reason != "exceeds per-transaction limit" {
		t.Errorf("wrong reason: %s", reason)
	}
}

func TestSpendPermissionState_Budget(t *testing.T) {
	now := time.Now()
	perm := &SpendPermission{
		TotalBudget: big.NewInt(2_000_000),
		ValidAfter:  now.Add(-1 * time.Hour).Unix(),
		ValidBefore: now.Add(1 * time.Hour).Unix(),
	}
	state := NewSpendPermissionState(perm)

	// First spend
	state.RecordSpend(big.NewInt(1_500_000))

	// Second spend would exceed budget
	ok, reason := state.IsValid(big.NewInt(1_000_000), "", now)
	if ok {
		t.Error("expected budget exceeded")
	}
	if reason != "exceeds total budget" {
		t.Errorf("wrong reason: %s", reason)
	}

	// Small spend still fits
	ok, _ = state.IsValid(big.NewInt(500_000), "", now)
	if !ok {
		t.Error("expected valid: within remaining budget")
	}
}

func TestSpendPermissionState_TimeWindow(t *testing.T) {
	now := time.Now()

	// Not yet active
	perm := &SpendPermission{
		ValidAfter:  now.Add(1 * time.Hour).Unix(),
		ValidBefore: now.Add(2 * time.Hour).Unix(),
	}
	state := NewSpendPermissionState(perm)
	ok, reason := state.IsValid(big.NewInt(100), "", now)
	if ok {
		t.Error("expected not yet active")
	}
	if reason != "permission not yet active" {
		t.Errorf("wrong reason: %s", reason)
	}

	// Expired
	perm2 := &SpendPermission{
		ValidAfter:  now.Add(-2 * time.Hour).Unix(),
		ValidBefore: now.Add(-1 * time.Hour).Unix(),
	}
	state2 := NewSpendPermissionState(perm2)
	ok, reason = state2.IsValid(big.NewInt(100), "", now)
	if ok {
		t.Error("expected expired")
	}
	if reason != "permission expired" {
		t.Errorf("wrong reason: %s", reason)
	}
}

func TestSpendPermissionState_AllowedRecipients(t *testing.T) {
	now := time.Now()
	perm := &SpendPermission{
		ValidAfter:        now.Add(-1 * time.Hour).Unix(),
		ValidBefore:       now.Add(1 * time.Hour).Unix(),
		AllowedRecipients: []string{"0xAlice", "0xBob"},
	}
	state := NewSpendPermissionState(perm)

	ok, _ := state.IsValid(big.NewInt(100), "0xAlice", now)
	if !ok {
		t.Error("expected valid for allowed recipient")
	}

	ok, reason := state.IsValid(big.NewInt(100), "0xEve", now)
	if ok {
		t.Error("expected invalid for disallowed recipient")
	}
	if reason != "recipient not allowed" {
		t.Errorf("wrong reason: %s", reason)
	}
}

func TestSpendPermissionState_RecordSpend(t *testing.T) {
	perm := &SpendPermission{
		ValidAfter:  time.Now().Add(-1 * time.Hour).Unix(),
		ValidBefore: time.Now().Add(1 * time.Hour).Unix(),
	}
	state := NewSpendPermissionState(perm)

	state.RecordSpend(big.NewInt(1_000_000))
	state.RecordSpend(big.NewInt(500_000))

	if state.TotalSpent.Cmp(big.NewInt(1_500_000)) != 0 {
		t.Errorf("expected 1500000, got %s", state.TotalSpent)
	}
	if state.TxCount != 2 {
		t.Errorf("expected 2 txs, got %d", state.TxCount)
	}
}

func TestSpendPermissionState_NilLimits(t *testing.T) {
	now := time.Now()
	perm := &SpendPermission{
		ValidAfter:  now.Add(-1 * time.Hour).Unix(),
		ValidBefore: now.Add(1 * time.Hour).Unix(),
		// No MaxPerTransaction or TotalBudget = unlimited
	}
	state := NewSpendPermissionState(perm)

	ok, _ := state.IsValid(big.NewInt(999_999_999), "", now)
	if !ok {
		t.Error("expected valid with nil limits")
	}
}
