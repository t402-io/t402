package policy

import (
	"fmt"
	"math/big"
	"strings"
	"sync"
	"time"
)

// Engine evaluates payment requests against a policy and tracks session state.
type Engine struct {
	mu       sync.Mutex
	policy   *PaymentPolicy
	stats    SessionStats
	payments []paymentRecord
}

type paymentRecord struct {
	amount *big.Int
	time   time.Time
}

// NewEngine creates a new policy engine with the given policy.
func NewEngine(policy *PaymentPolicy) *Engine {
	return &Engine{
		policy: policy,
		stats: SessionStats{
			TotalAmountPaid: new(big.Int),
			AmountPaidToday: new(big.Int),
			StartTime:       time.Now(),
		},
	}
}

// Evaluate checks whether a payment is permitted by the policy.
func (e *Engine) Evaluate(scheme, network, asset, amount, payTo string) Decision {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.pruneHourlyPayments()

	ctx := &Context{
		Scheme:  scheme,
		Network: network,
		Asset:   asset,
		Amount:  amount,
		PayTo:   payTo,
		Session: e.currentStats(),
	}

	// Check per-payment amount limit.
	if e.policy.MaxAmountPerPayment != "" {
		if d := checkAmountLimit(amount, e.policy.MaxAmountPerPayment, "per-payment limit"); !d.Allowed {
			return d
		}
	}

	// Check per-session cumulative limit.
	if e.policy.MaxAmountPerSession != "" {
		projected := new(big.Int).Set(e.stats.TotalAmountPaid)
		paymentAmt, ok := new(big.Int).SetString(amount, 10)
		if !ok {
			return Deny(fmt.Sprintf("invalid amount: %s", amount))
		}
		projected.Add(projected, paymentAmt)
		limit, ok := new(big.Int).SetString(e.policy.MaxAmountPerSession, 10)
		if !ok {
			return Deny(fmt.Sprintf("invalid session limit: %s", e.policy.MaxAmountPerSession))
		}
		if projected.Cmp(limit) > 0 {
			return Deny(fmt.Sprintf("would exceed session limit: %s + %s > %s",
				e.stats.TotalAmountPaid.String(), amount, e.policy.MaxAmountPerSession))
		}
	}

	// Check per-day cumulative limit.
	if e.policy.MaxAmountPerDay != "" {
		projected := new(big.Int).Set(e.stats.AmountPaidToday)
		paymentAmt, ok := new(big.Int).SetString(amount, 10)
		if !ok {
			return Deny(fmt.Sprintf("invalid amount: %s", amount))
		}
		projected.Add(projected, paymentAmt)
		limit, ok := new(big.Int).SetString(e.policy.MaxAmountPerDay, 10)
		if !ok {
			return Deny(fmt.Sprintf("invalid daily limit: %s", e.policy.MaxAmountPerDay))
		}
		if projected.Cmp(limit) > 0 {
			return Deny(fmt.Sprintf("would exceed daily limit: %s + %s > %s",
				e.stats.AmountPaidToday.String(), amount, e.policy.MaxAmountPerDay))
		}
	}

	// Check hourly payment count.
	if e.policy.MaxPaymentsPerHour > 0 {
		if e.stats.PaymentsThisHour >= e.policy.MaxPaymentsPerHour {
			return Deny(fmt.Sprintf("would exceed hourly payment limit: %d >= %d",
				e.stats.PaymentsThisHour, e.policy.MaxPaymentsPerHour))
		}
	}

	// Check allowed recipients.
	if len(e.policy.AllowedRecipients) > 0 {
		if !containsCaseInsensitive(e.policy.AllowedRecipients, payTo) {
			return Deny(fmt.Sprintf("recipient not in allowlist: %s", payTo))
		}
	}

	// Check blocked recipients.
	if len(e.policy.BlockedRecipients) > 0 {
		if containsCaseInsensitive(e.policy.BlockedRecipients, payTo) {
			return Deny(fmt.Sprintf("recipient is blocked: %s", payTo))
		}
	}

	// Check allowed networks.
	if len(e.policy.AllowedNetworks) > 0 {
		if !containsCaseInsensitive(e.policy.AllowedNetworks, network) {
			return Deny(fmt.Sprintf("network not allowed: %s", network))
		}
	}

	// Check allowed schemes.
	if len(e.policy.AllowedSchemes) > 0 {
		if !containsCaseInsensitive(e.policy.AllowedSchemes, scheme) {
			return Deny(fmt.Sprintf("scheme not allowed: %s", scheme))
		}
	}

	// Check allowed assets.
	if len(e.policy.AllowedAssets) > 0 {
		if !containsCaseInsensitive(e.policy.AllowedAssets, asset) {
			return Deny(fmt.Sprintf("asset not allowed: %s", asset))
		}
	}

	// Check custom rules.
	for _, rule := range e.policy.CustomRules {
		if d := rule.Validate(ctx); !d.Allowed {
			return Deny(fmt.Sprintf("custom rule %q: %s", rule.Name, d.Reason))
		}
	}

	return Allow()
}

// RecordPayment records a successful payment to update session statistics.
// The amount must be in the smallest unit (e.g., wei, lamports).
func (e *Engine) RecordPayment(amount string) {
	e.mu.Lock()
	defer e.mu.Unlock()

	amt, ok := new(big.Int).SetString(amount, 10)
	if !ok {
		return
	}

	now := time.Now()
	e.stats.TotalAmountPaid.Add(e.stats.TotalAmountPaid, amt)
	e.stats.AmountPaidToday.Add(e.stats.AmountPaidToday, amt)
	e.stats.PaymentCount++
	e.payments = append(e.payments, paymentRecord{amount: amt, time: now})

	e.pruneHourlyPayments()
}

// Reset clears all session statistics.
func (e *Engine) Reset() {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.stats = SessionStats{
		TotalAmountPaid: new(big.Int),
		AmountPaidToday: new(big.Int),
		StartTime:       time.Now(),
	}
	e.payments = nil
}

// Stats returns a snapshot of current session statistics.
func (e *Engine) Stats() SessionStats {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.pruneHourlyPayments()
	return *e.currentStats()
}

// currentStats returns a copy of the current stats (must be called with lock held).
func (e *Engine) currentStats() *SessionStats {
	return &SessionStats{
		TotalAmountPaid:  new(big.Int).Set(e.stats.TotalAmountPaid),
		PaymentCount:     e.stats.PaymentCount,
		PaymentsThisHour: e.stats.PaymentsThisHour,
		AmountPaidToday:  new(big.Int).Set(e.stats.AmountPaidToday),
		StartTime:        e.stats.StartTime,
	}
}

// pruneHourlyPayments removes payments older than one hour and updates the count.
func (e *Engine) pruneHourlyPayments() {
	cutoff := time.Now().Add(-1 * time.Hour)
	count := 0
	for _, p := range e.payments {
		if p.time.After(cutoff) {
			count++
		}
	}
	e.stats.PaymentsThisHour = count
}

// checkAmountLimit compares amount against a limit, both as big.Int strings.
func checkAmountLimit(amount, limit, label string) Decision {
	amt, ok := new(big.Int).SetString(amount, 10)
	if !ok {
		return Deny(fmt.Sprintf("invalid amount: %s", amount))
	}
	lim, ok := new(big.Int).SetString(limit, 10)
	if !ok {
		return Deny(fmt.Sprintf("invalid %s: %s", label, limit))
	}
	if amt.Cmp(lim) > 0 {
		return Deny(fmt.Sprintf("amount %s exceeds %s of %s", amount, label, limit))
	}
	return Allow()
}

// containsCaseInsensitive checks if the slice contains the target (case-insensitive).
func containsCaseInsensitive(list []string, target string) bool {
	lower := strings.ToLower(target)
	for _, item := range list {
		if strings.ToLower(item) == lower {
			return true
		}
	}
	return false
}
