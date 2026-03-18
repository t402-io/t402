// Package erc7715 implements ERC-7715 spend permissions for recurring/high-frequency payments.
//
// ERC-7715 enables "approve once, pay many times" flows:
// - Recurring subscription payments
// - High-frequency micro-payments (pay-per-API-call)
// - Background transactions without per-payment signing
//
// A spend permission specifies: max per tx, total budget, time window, allowed recipients.
package erc7715

import (
	"math/big"
	"time"
)

// SpendPermission defines what a grantee is authorized to spend.
type SpendPermission struct {
	// Granter address (the wallet owner)
	Granter string `json:"granter"`
	// Grantee address (the facilitator/agent)
	Grantee string `json:"grantee"`
	// Token contract address
	Token string `json:"token"`
	// Max amount per individual transaction
	MaxPerTransaction *big.Int `json:"maxPerTransaction"`
	// Total budget for all transactions
	TotalBudget *big.Int `json:"totalBudget"`
	// Time window start (unix seconds)
	ValidAfter int64 `json:"validAfter"`
	// Time window end (unix seconds)
	ValidBefore int64 `json:"validBefore"`
	// Allowed recipient addresses (empty = any)
	AllowedRecipients []string `json:"allowedRecipients,omitempty"`
	// EIP-712 signature from granter
	Signature string `json:"signature"`
}

// SpendPermissionState tracks cumulative usage of a permission.
type SpendPermissionState struct {
	Permission    *SpendPermission
	TotalSpent    *big.Int
	TxCount       int
	LastUsed      time.Time
}

// IsValid checks if a spend permission is still valid for a given amount.
func (s *SpendPermissionState) IsValid(amount *big.Int, recipient string, now time.Time) (bool, string) {
	p := s.Permission

	// Check time window
	if now.Unix() < p.ValidAfter {
		return false, "permission not yet active"
	}
	if now.Unix() > p.ValidBefore {
		return false, "permission expired"
	}

	// Check per-transaction limit
	if p.MaxPerTransaction != nil && amount.Cmp(p.MaxPerTransaction) > 0 {
		return false, "exceeds per-transaction limit"
	}

	// Check total budget
	if p.TotalBudget != nil {
		projected := new(big.Int).Add(s.TotalSpent, amount)
		if projected.Cmp(p.TotalBudget) > 0 {
			return false, "exceeds total budget"
		}
	}

	// Check allowed recipients
	if len(p.AllowedRecipients) > 0 {
		found := false
		for _, r := range p.AllowedRecipients {
			if r == recipient {
				found = true
				break
			}
		}
		if !found {
			return false, "recipient not allowed"
		}
	}

	return true, ""
}

// RecordSpend records a successful spend against the permission.
func (s *SpendPermissionState) RecordSpend(amount *big.Int) {
	s.TotalSpent = new(big.Int).Add(s.TotalSpent, amount)
	s.TxCount++
	s.LastUsed = time.Now()
}

// NewSpendPermissionState creates a new state tracker for a permission.
func NewSpendPermissionState(permission *SpendPermission) *SpendPermissionState {
	return &SpendPermissionState{
		Permission: permission,
		TotalSpent: big.NewInt(0),
	}
}

// PermissionPayload is the payment payload for ERC-7715 permission-based payments.
type PermissionPayload struct {
	// The spend permission with signature
	Permission SpendPermission `json:"permission"`
	// Specific payment details
	Recipient string `json:"recipient"`
	Amount    string `json:"amount"`
}
