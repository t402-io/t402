"""Tests for the payment policy engine."""

import time
import threading
from t402.policy import (
    PaymentPolicy,
    PaymentPolicyEngine,
    PolicyRule,
    PolicyContext,
    PolicyDecision,
)


def make_engine(**kwargs):
    return PaymentPolicyEngine(PaymentPolicy(**kwargs))


class TestMaxAmountPerPayment:
    def test_allow_below_limit(self):
        e = make_engine(max_amount_per_payment=1_000_000)
        assert e.evaluate("exact", "eip155:8453", "0xUSDC", "500000", "0xR").allowed

    def test_allow_at_limit(self):
        e = make_engine(max_amount_per_payment=1_000_000)
        assert e.evaluate("exact", "eip155:8453", "0xUSDC", "1000000", "0xR").allowed

    def test_deny_above_limit(self):
        e = make_engine(max_amount_per_payment=1_000_000)
        d = e.evaluate("exact", "eip155:8453", "0xUSDC", "1000001", "0xR")
        assert not d.allowed
        assert "max per payment" in d.reason


class TestMaxAmountPerSession:
    def test_cumulative_tracking(self):
        e = make_engine(max_amount_per_session=2_000_000)
        assert e.evaluate("exact", "eip155:8453", "0xUSDC", "1000000", "0xR").allowed
        e.record_payment("1000000")
        assert e.evaluate("exact", "eip155:8453", "0xUSDC", "1000000", "0xR").allowed
        e.record_payment("1000000")
        d = e.evaluate("exact", "eip155:8453", "0xUSDC", "1", "0xR")
        assert not d.allowed
        assert "session limit" in d.reason

    def test_would_exceed(self):
        e = make_engine(max_amount_per_session=1_500_000)
        e.record_payment("1000000")
        d = e.evaluate("exact", "eip155:8453", "0xUSDC", "600000", "0xR")
        assert not d.allowed


class TestMaxAmountPerDay:
    def test_deny_daily_exceeded(self):
        e = make_engine(max_amount_per_day=5_000_000)
        e.record_payment("5000000")
        d = e.evaluate("exact", "eip155:8453", "0xUSDC", "1", "0xR")
        assert not d.allowed
        assert "daily" in d.reason


class TestMaxPaymentsPerHour:
    def test_deny_too_many(self):
        e = make_engine(max_payments_per_hour=3)
        for _ in range(3):
            assert e.evaluate("exact", "eip155:8453", "0xUSDC", "100", "0xR").allowed
            e.record_payment("100")
        d = e.evaluate("exact", "eip155:8453", "0xUSDC", "100", "0xR")
        assert not d.allowed
        assert "hourly" in d.reason


class TestAllowedRecipients:
    def test_allow_listed(self):
        e = make_engine(allowed_recipients=["0xAlice", "0xBob"])
        assert e.evaluate("exact", "eip155:8453", "0xUSDC", "100", "0xAlice").allowed

    def test_deny_unlisted(self):
        e = make_engine(allowed_recipients=["0xAlice"])
        d = e.evaluate("exact", "eip155:8453", "0xUSDC", "100", "0xEve")
        assert not d.allowed
        assert "not in allowed" in d.reason

    def test_case_insensitive(self):
        e = make_engine(allowed_recipients=["0xAlice"])
        assert e.evaluate("exact", "eip155:8453", "0xUSDC", "100", "0xalice").allowed


class TestBlockedRecipients:
    def test_deny_blocked(self):
        e = make_engine(blocked_recipients=["0xEvil"])
        d = e.evaluate("exact", "eip155:8453", "0xUSDC", "100", "0xEvil")
        assert not d.allowed
        assert "blocked" in d.reason

    def test_allow_non_blocked(self):
        e = make_engine(blocked_recipients=["0xEvil"])
        assert e.evaluate("exact", "eip155:8453", "0xUSDC", "100", "0xGood").allowed

    def test_case_insensitive(self):
        e = make_engine(blocked_recipients=["0xEvil"])
        d = e.evaluate("exact", "eip155:8453", "0xUSDC", "100", "0xevil")
        assert not d.allowed


class TestAllowedNetworks:
    def test_allow_listed(self):
        e = make_engine(allowed_networks=["eip155:8453", "eip155:1"])
        assert e.evaluate("exact", "eip155:8453", "0xUSDC", "100", "0xR").allowed

    def test_deny_unlisted(self):
        e = make_engine(allowed_networks=["eip155:8453"])
        d = e.evaluate("exact", "eip155:1", "0xUSDC", "100", "0xR")
        assert not d.allowed
        assert "network" in d.reason


class TestAllowedSchemes:
    def test_allow_listed(self):
        e = make_engine(allowed_schemes=["exact"])
        assert e.evaluate("exact", "eip155:8453", "0xUSDC", "100", "0xR").allowed

    def test_deny_unlisted(self):
        e = make_engine(allowed_schemes=["exact"])
        d = e.evaluate("upto", "eip155:8453", "0xUSDC", "100", "0xR")
        assert not d.allowed


class TestAllowedAssets:
    def test_allow_listed(self):
        e = make_engine(allowed_assets=["0xUSDC"])
        assert e.evaluate("exact", "eip155:8453", "0xUSDC", "100", "0xR").allowed

    def test_deny_unlisted(self):
        e = make_engine(allowed_assets=["0xUSDC"])
        d = e.evaluate("exact", "eip155:8453", "0xUSDT", "100", "0xR")
        assert not d.allowed

    def test_case_insensitive(self):
        e = make_engine(allowed_assets=["0xUSDC"])
        assert e.evaluate("exact", "eip155:8453", "0xusdc", "100", "0xR").allowed


class TestCustomRules:
    def test_custom_deny(self):
        rule = PolicyRule(
            name="no-large-odd",
            validate=lambda ctx: PolicyDecision(False, "odd amount") if ctx.amount % 2 != 0 else PolicyDecision(True),
        )
        e = make_engine(custom_rules=[rule])
        d = e.evaluate("exact", "eip155:8453", "0xUSDC", "101", "0xR")
        assert not d.allowed
        assert "no-large-odd" in d.reason

    def test_custom_allow(self):
        rule = PolicyRule(name="always-ok", validate=lambda ctx: PolicyDecision(True))
        e = make_engine(custom_rules=[rule])
        assert e.evaluate("exact", "eip155:8453", "0xUSDC", "100", "0xR").allowed


class TestCombinedRules:
    def test_multiple_rules(self):
        e = make_engine(
            max_amount_per_payment=1_000_000,
            allowed_networks=["eip155:8453"],
            blocked_recipients=["0xEvil"],
        )
        assert e.evaluate("exact", "eip155:8453", "0xUSDC", "500000", "0xGood").allowed
        d = e.evaluate("exact", "eip155:1", "0xUSDC", "500000", "0xGood")
        assert not d.allowed
        d = e.evaluate("exact", "eip155:8453", "0xUSDC", "2000000", "0xGood")
        assert not d.allowed
        d = e.evaluate("exact", "eip155:8453", "0xUSDC", "500000", "0xEvil")
        assert not d.allowed


class TestSessionStats:
    def test_stats_tracking(self):
        e = make_engine()
        e.record_payment("1000000")
        e.record_payment("500000")
        s = e.stats
        assert s.total_amount_paid == 1_500_000
        assert s.payment_count == 2
        assert s.payments_this_hour == 2

    def test_reset(self):
        e = make_engine()
        e.record_payment("1000000")
        e.reset()
        s = e.stats
        assert s.total_amount_paid == 0
        assert s.payment_count == 0


class TestEmptyPolicy:
    def test_everything_allowed(self):
        e = make_engine()
        assert e.evaluate("exact", "eip155:8453", "0xUSDC", "999999999", "0xAnyone").allowed

    def test_invalid_amount(self):
        e = make_engine()
        d = e.evaluate("exact", "eip155:8453", "0xUSDC", "not_a_number", "0xR")
        assert not d.allowed
        assert "invalid" in d.reason


class TestThreadSafety:
    def test_concurrent_evaluate_and_record(self):
        e = make_engine(max_amount_per_session=100_000_000)
        errors = []

        def worker():
            try:
                for _ in range(100):
                    d = e.evaluate("exact", "eip155:8453", "0xUSDC", "100", "0xR")
                    if d.allowed:
                        e.record_payment("100")
            except Exception as ex:
                errors.append(ex)

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors
        s = e.stats
        assert s.total_amount_paid > 0
        assert s.payment_count > 0
