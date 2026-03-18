package policy

import (
	"math/big"
	"testing"
	"time"
)

func TestMaxAmountPerPayment_BelowLimit(t *testing.T) {
	e := NewEngine(&PaymentPolicy{MaxAmountPerPayment: "1000000"})
	d := e.Evaluate("exact", "eip155:1", "0xdAC17F958D2ee523a2206206994597C13D831ec7", "500000", "0xRecipient")
	if !d.Allowed {
		t.Fatalf("expected allowed, got denied: %s", d.Reason)
	}
}

func TestMaxAmountPerPayment_AtLimit(t *testing.T) {
	e := NewEngine(&PaymentPolicy{MaxAmountPerPayment: "1000000"})
	d := e.Evaluate("exact", "eip155:1", "0xAsset", "1000000", "0xRecipient")
	if !d.Allowed {
		t.Fatalf("expected allowed at limit, got denied: %s", d.Reason)
	}
}

func TestMaxAmountPerPayment_AboveLimit(t *testing.T) {
	e := NewEngine(&PaymentPolicy{MaxAmountPerPayment: "1000000"})
	d := e.Evaluate("exact", "eip155:1", "0xAsset", "1000001", "0xRecipient")
	if d.Allowed {
		t.Fatal("expected denied for amount above limit")
	}
}

func TestMaxAmountPerSession_Cumulative(t *testing.T) {
	e := NewEngine(&PaymentPolicy{MaxAmountPerSession: "2000000"})

	d := e.Evaluate("exact", "eip155:1", "0xAsset", "1000000", "0xRecipient")
	if !d.Allowed {
		t.Fatalf("first payment should be allowed: %s", d.Reason)
	}
	e.RecordPayment("1000000")

	d = e.Evaluate("exact", "eip155:1", "0xAsset", "1000000", "0xRecipient")
	if !d.Allowed {
		t.Fatalf("second payment should be allowed (at limit): %s", d.Reason)
	}
	e.RecordPayment("1000000")

	d = e.Evaluate("exact", "eip155:1", "0xAsset", "1", "0xRecipient")
	if d.Allowed {
		t.Fatal("third payment should be denied (exceeds session limit)")
	}
}

func TestMaxAmountPerDay(t *testing.T) {
	e := NewEngine(&PaymentPolicy{MaxAmountPerDay: "5000000"})

	e.RecordPayment("3000000")
	d := e.Evaluate("exact", "eip155:1", "0xAsset", "2000000", "0xRecipient")
	if !d.Allowed {
		t.Fatalf("should be allowed at daily limit: %s", d.Reason)
	}

	e.RecordPayment("2000000")
	d = e.Evaluate("exact", "eip155:1", "0xAsset", "1", "0xRecipient")
	if d.Allowed {
		t.Fatal("should be denied exceeding daily limit")
	}
}

func TestMaxPaymentsPerHour(t *testing.T) {
	e := NewEngine(&PaymentPolicy{MaxPaymentsPerHour: 3})

	for i := 0; i < 3; i++ {
		d := e.Evaluate("exact", "eip155:1", "0xAsset", "100", "0xRecipient")
		if !d.Allowed {
			t.Fatalf("payment %d should be allowed: %s", i+1, d.Reason)
		}
		e.RecordPayment("100")
	}

	d := e.Evaluate("exact", "eip155:1", "0xAsset", "100", "0xRecipient")
	if d.Allowed {
		t.Fatal("4th payment should be denied (hourly limit)")
	}
}

func TestAllowedRecipients_Allowed(t *testing.T) {
	e := NewEngine(&PaymentPolicy{
		AllowedRecipients: []string{"0xAlice", "0xBob"},
	})
	d := e.Evaluate("exact", "eip155:1", "0xAsset", "100", "0xAlice")
	if !d.Allowed {
		t.Fatalf("expected allowed: %s", d.Reason)
	}
}

func TestAllowedRecipients_Denied(t *testing.T) {
	e := NewEngine(&PaymentPolicy{
		AllowedRecipients: []string{"0xAlice", "0xBob"},
	})
	d := e.Evaluate("exact", "eip155:1", "0xAsset", "100", "0xCharlie")
	if d.Allowed {
		t.Fatal("expected denied for non-allowlisted recipient")
	}
}

func TestBlockedRecipients_Blocked(t *testing.T) {
	e := NewEngine(&PaymentPolicy{
		BlockedRecipients: []string{"0xEvil"},
	})
	d := e.Evaluate("exact", "eip155:1", "0xAsset", "100", "0xEvil")
	if d.Allowed {
		t.Fatal("expected denied for blocked recipient")
	}
}

func TestBlockedRecipients_NotBlocked(t *testing.T) {
	e := NewEngine(&PaymentPolicy{
		BlockedRecipients: []string{"0xEvil"},
	})
	d := e.Evaluate("exact", "eip155:1", "0xAsset", "100", "0xGood")
	if !d.Allowed {
		t.Fatalf("expected allowed for non-blocked recipient: %s", d.Reason)
	}
}

func TestAllowedNetworks_Allowed(t *testing.T) {
	e := NewEngine(&PaymentPolicy{
		AllowedNetworks: []string{"eip155:1", "eip155:8453"},
	})
	d := e.Evaluate("exact", "eip155:8453", "0xAsset", "100", "0xRecipient")
	if !d.Allowed {
		t.Fatalf("expected allowed: %s", d.Reason)
	}
}

func TestAllowedNetworks_Denied(t *testing.T) {
	e := NewEngine(&PaymentPolicy{
		AllowedNetworks: []string{"eip155:1"},
	})
	d := e.Evaluate("exact", "eip155:137", "0xAsset", "100", "0xRecipient")
	if d.Allowed {
		t.Fatal("expected denied for disallowed network")
	}
}

func TestAllowedSchemes_Allowed(t *testing.T) {
	e := NewEngine(&PaymentPolicy{
		AllowedSchemes: []string{"exact", "exact-legacy"},
	})
	d := e.Evaluate("exact", "eip155:1", "0xAsset", "100", "0xRecipient")
	if !d.Allowed {
		t.Fatalf("expected allowed: %s", d.Reason)
	}
}

func TestAllowedSchemes_Denied(t *testing.T) {
	e := NewEngine(&PaymentPolicy{
		AllowedSchemes: []string{"exact"},
	})
	d := e.Evaluate("exact-legacy", "eip155:1", "0xAsset", "100", "0xRecipient")
	if d.Allowed {
		t.Fatal("expected denied for disallowed scheme")
	}
}

func TestAllowedAssets_Allowed(t *testing.T) {
	usdt := "0xdAC17F958D2ee523a2206206994597C13D831ec7"
	e := NewEngine(&PaymentPolicy{
		AllowedAssets: []string{usdt},
	})
	d := e.Evaluate("exact", "eip155:1", usdt, "100", "0xRecipient")
	if !d.Allowed {
		t.Fatalf("expected allowed: %s", d.Reason)
	}
}

func TestAllowedAssets_Denied(t *testing.T) {
	e := NewEngine(&PaymentPolicy{
		AllowedAssets: []string{"0xUSDT"},
	})
	d := e.Evaluate("exact", "eip155:1", "0xOtherToken", "100", "0xRecipient")
	if d.Allowed {
		t.Fatal("expected denied for disallowed asset")
	}
}

func TestCustomRule_Allow(t *testing.T) {
	e := NewEngine(&PaymentPolicy{
		CustomRules: []Rule{
			{
				Name: "always-allow",
				Validate: func(ctx *Context) Decision {
					return Allow()
				},
			},
		},
	})
	d := e.Evaluate("exact", "eip155:1", "0xAsset", "100", "0xRecipient")
	if !d.Allowed {
		t.Fatalf("expected allowed: %s", d.Reason)
	}
}

func TestCustomRule_Deny(t *testing.T) {
	e := NewEngine(&PaymentPolicy{
		CustomRules: []Rule{
			{
				Name: "no-large-payments",
				Validate: func(ctx *Context) Decision {
					amt, ok := new(big.Int).SetString(ctx.Amount, 10)
					if !ok {
						return Deny("invalid amount")
					}
					if amt.Cmp(big.NewInt(500)) > 0 {
						return Deny("amount too large for custom rule")
					}
					return Allow()
				},
			},
		},
	})
	d := e.Evaluate("exact", "eip155:1", "0xAsset", "1000", "0xRecipient")
	if d.Allowed {
		t.Fatal("expected denied by custom rule")
	}
	if d.Reason == "" {
		t.Fatal("expected reason in denial")
	}
}

func TestCombinedPolicies(t *testing.T) {
	e := NewEngine(&PaymentPolicy{
		MaxAmountPerPayment: "1000000",
		MaxAmountPerSession: "5000000",
		AllowedNetworks:     []string{"eip155:1", "eip155:8453"},
		AllowedSchemes:      []string{"exact"},
		BlockedRecipients:   []string{"0xEvil"},
	})

	// Valid payment.
	d := e.Evaluate("exact", "eip155:8453", "0xAsset", "500000", "0xGood")
	if !d.Allowed {
		t.Fatalf("expected allowed: %s", d.Reason)
	}

	// Wrong network.
	d = e.Evaluate("exact", "eip155:137", "0xAsset", "500000", "0xGood")
	if d.Allowed {
		t.Fatal("expected denied for wrong network")
	}

	// Wrong scheme.
	d = e.Evaluate("exact-legacy", "eip155:1", "0xAsset", "500000", "0xGood")
	if d.Allowed {
		t.Fatal("expected denied for wrong scheme")
	}

	// Blocked recipient.
	d = e.Evaluate("exact", "eip155:1", "0xAsset", "500000", "0xEvil")
	if d.Allowed {
		t.Fatal("expected denied for blocked recipient")
	}

	// Amount too high.
	d = e.Evaluate("exact", "eip155:1", "0xAsset", "2000000", "0xGood")
	if d.Allowed {
		t.Fatal("expected denied for amount over per-payment limit")
	}
}

func TestRecordPaymentAndStats(t *testing.T) {
	e := NewEngine(&PaymentPolicy{})

	e.RecordPayment("1000")
	e.RecordPayment("2000")

	stats := e.Stats()
	if stats.TotalAmountPaid.Cmp(big.NewInt(3000)) != 0 {
		t.Fatalf("expected total 3000, got %s", stats.TotalAmountPaid.String())
	}
	if stats.PaymentCount != 2 {
		t.Fatalf("expected 2 payments, got %d", stats.PaymentCount)
	}
	if stats.PaymentsThisHour != 2 {
		t.Fatalf("expected 2 payments this hour, got %d", stats.PaymentsThisHour)
	}
}

func TestReset(t *testing.T) {
	e := NewEngine(&PaymentPolicy{})

	e.RecordPayment("5000")
	e.RecordPayment("3000")
	e.Reset()

	stats := e.Stats()
	if stats.TotalAmountPaid.Cmp(big.NewInt(0)) != 0 {
		t.Fatalf("expected 0 after reset, got %s", stats.TotalAmountPaid.String())
	}
	if stats.PaymentCount != 0 {
		t.Fatalf("expected 0 payments after reset, got %d", stats.PaymentCount)
	}
}

func TestEmptyPolicy_AllAllowed(t *testing.T) {
	e := NewEngine(&PaymentPolicy{})
	d := e.Evaluate("any-scheme", "any:network", "any-asset", "999999999", "0xAnyone")
	if !d.Allowed {
		t.Fatalf("empty policy should allow everything: %s", d.Reason)
	}
}

func TestCaseInsensitiveAddressMatching(t *testing.T) {
	e := NewEngine(&PaymentPolicy{
		AllowedRecipients: []string{"0xAbCdEf1234567890AbCdEf1234567890AbCdEf12"},
	})
	d := e.Evaluate("exact", "eip155:1", "0xAsset", "100", "0xabcdef1234567890abcdef1234567890abcdef12")
	if !d.Allowed {
		t.Fatalf("expected case-insensitive match: %s", d.Reason)
	}
}

func TestCaseInsensitiveBlockedRecipient(t *testing.T) {
	e := NewEngine(&PaymentPolicy{
		BlockedRecipients: []string{"0xabcdef"},
	})
	d := e.Evaluate("exact", "eip155:1", "0xAsset", "100", "0xABCDEF")
	if d.Allowed {
		t.Fatal("expected case-insensitive block match")
	}
}

func TestCaseInsensitiveNetworkMatching(t *testing.T) {
	e := NewEngine(&PaymentPolicy{
		AllowedNetworks: []string{"EIP155:1"},
	})
	d := e.Evaluate("exact", "eip155:1", "0xAsset", "100", "0xRecipient")
	if !d.Allowed {
		t.Fatalf("expected case-insensitive network match: %s", d.Reason)
	}
}

func TestCaseInsensitiveAssetMatching(t *testing.T) {
	e := NewEngine(&PaymentPolicy{
		AllowedAssets: []string{"0xABCD"},
	})
	d := e.Evaluate("exact", "eip155:1", "0xabcd", "100", "0xRecipient")
	if !d.Allowed {
		t.Fatalf("expected case-insensitive asset match: %s", d.Reason)
	}
}

func TestInvalidAmount(t *testing.T) {
	e := NewEngine(&PaymentPolicy{MaxAmountPerPayment: "1000"})
	d := e.Evaluate("exact", "eip155:1", "0xAsset", "not-a-number", "0xRecipient")
	if d.Allowed {
		t.Fatal("expected denied for invalid amount")
	}
}

func TestSessionLimitWithInvalidAmount(t *testing.T) {
	e := NewEngine(&PaymentPolicy{MaxAmountPerSession: "1000"})
	d := e.Evaluate("exact", "eip155:1", "0xAsset", "abc", "0xRecipient")
	if d.Allowed {
		t.Fatal("expected denied for invalid amount in session check")
	}
}

func TestRecordPaymentInvalidAmount(t *testing.T) {
	e := NewEngine(&PaymentPolicy{})
	e.RecordPayment("not-a-number")
	stats := e.Stats()
	if stats.PaymentCount != 0 {
		t.Fatal("invalid amount should not be recorded")
	}
}

func TestMultipleCustomRules(t *testing.T) {
	e := NewEngine(&PaymentPolicy{
		CustomRules: []Rule{
			{
				Name:     "rule-a",
				Validate: func(ctx *Context) Decision { return Allow() },
			},
			{
				Name: "rule-b",
				Validate: func(ctx *Context) Decision {
					return Deny("blocked by rule-b")
				},
			},
		},
	})
	d := e.Evaluate("exact", "eip155:1", "0xAsset", "100", "0xRecipient")
	if d.Allowed {
		t.Fatal("expected denied by second custom rule")
	}
	if d.Reason == "" {
		t.Fatal("expected reason from custom rule")
	}
}

func TestSessionStatsStartTime(t *testing.T) {
	before := time.Now()
	e := NewEngine(&PaymentPolicy{})
	after := time.Now()

	stats := e.Stats()
	if stats.StartTime.Before(before) || stats.StartTime.After(after) {
		t.Fatal("start time should be between before and after engine creation")
	}
}

func TestResetUpdatesStartTime(t *testing.T) {
	e := NewEngine(&PaymentPolicy{})
	origStart := e.Stats().StartTime

	// Small sleep to ensure time difference.
	time.Sleep(5 * time.Millisecond)
	e.Reset()

	newStart := e.Stats().StartTime
	if !newStart.After(origStart) {
		t.Fatal("reset should update start time")
	}
}

func TestCustomRuleSeesSessionStats(t *testing.T) {
	var captured *SessionStats
	e := NewEngine(&PaymentPolicy{
		CustomRules: []Rule{
			{
				Name: "capture-stats",
				Validate: func(ctx *Context) Decision {
					captured = ctx.Session
					return Allow()
				},
			},
		},
	})

	e.RecordPayment("500")
	e.Evaluate("exact", "eip155:1", "0xAsset", "100", "0xRecipient")

	if captured == nil {
		t.Fatal("custom rule should receive session stats")
	}
	if captured.TotalAmountPaid.Cmp(big.NewInt(500)) != 0 {
		t.Fatalf("expected session total 500, got %s", captured.TotalAmountPaid.String())
	}
	if captured.PaymentCount != 1 {
		t.Fatalf("expected 1 payment in session, got %d", captured.PaymentCount)
	}
}

func TestDailyLimitWithInvalidAmount(t *testing.T) {
	e := NewEngine(&PaymentPolicy{MaxAmountPerDay: "1000"})
	d := e.Evaluate("exact", "eip155:1", "0xAsset", "xyz", "0xRecipient")
	if d.Allowed {
		t.Fatal("expected denied for invalid amount in daily check")
	}
}
