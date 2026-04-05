// Package policy implements a client-side payment policy engine for AI agent guardrails.
//
// The policy engine enables AI agents to enforce spending limits, allowlists,
// and custom validation rules before authorizing payments. It tracks session
// statistics and supports per-payment, per-session, per-day, and per-hour limits.
package policy

import (
	"math/big"
	"time"
)

// PaymentPolicy defines spending rules for AI agent guardrails.
type PaymentPolicy struct {
	MaxAmountPerPayment string   // Max per single payment (in smallest unit, "" = no limit)
	MaxAmountPerSession string   // Max cumulative per session
	MaxAmountPerDay     string   // Max cumulative per day
	MaxPaymentsPerHour  int      // Max payments per rolling hour (0 = no limit)
	AllowedRecipients   []string // Allowed payTo addresses (empty = all allowed)
	BlockedRecipients   []string // Blocked payTo addresses
	AllowedNetworks     []string // Allowed CAIP-2 network IDs (empty = all)
	AllowedSchemes      []string // Allowed scheme names (empty = all)
	AllowedAssets       []string // Allowed asset addresses (empty = all)
	CustomRules         []Rule   // Custom validation rules
}

// Rule is a named custom validation function.
type Rule struct {
	Name     string
	Validate func(ctx *Context) Decision
}

// Context provides payment details to validation rules.
type Context struct {
	Scheme  string
	Network string
	Asset   string
	Amount  string
	PayTo   string
	Session *SessionStats
}

// SessionStats tracks cumulative payment statistics for the current session.
type SessionStats struct {
	TotalAmountPaid  *big.Int
	PaymentCount     int
	PaymentsThisHour int
	AmountPaidToday  *big.Int
	StartTime        time.Time
}

// Store is an optional interface for persistent policy state.
// Implementations can back this with Redis, SQLite, etc.
// When provided to NewEngineWithStore, the engine persists counters
// and spending totals across restarts.
type Store interface {
	// IncrementCounter atomically increments a counter key with the given TTL window.
	// Returns the new count.
	IncrementCounter(key string, window time.Duration) (int64, error)
	// GetSpending returns the cumulative spending for the given key and period.
	GetSpending(key string, period time.Duration) (*big.Int, error)
	// AddSpending adds the given amount to the spending counter for the key and period.
	AddSpending(key string, amount *big.Int, period time.Duration) error
}

// Decision is the result of a policy evaluation.
type Decision struct {
	Allowed bool
	Reason  string
}

// Allow returns a Decision that permits the payment.
func Allow() Decision {
	return Decision{Allowed: true}
}

// Deny returns a Decision that rejects the payment with the given reason.
func Deny(reason string) Decision {
	return Decision{Allowed: false, Reason: reason}
}
