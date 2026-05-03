"""Payment policy engine for AI agent guardrails.

Enforces spending rules before payments are authorized:
- Per-transaction amount limits
- Cumulative session/daily budgets
- Recipient allowlists/blocklists
- Network/scheme/asset restrictions
- Custom validation rules

Example:
    ```python
    from t402.policy import PaymentPolicy, PaymentPolicyEngine

    policy = PaymentPolicy(
        max_amount_per_payment=1_000_000,  # 1 USDC max per payment
        max_amount_per_session=10_000_000,  # 10 USDC per session
        allowed_networks=["eip155:8453", "eip155:1"],
    )
    engine = PaymentPolicyEngine(policy)

    decision = engine.evaluate("exact", "eip155:8453", "0xUSDC", "500000", "0xRecipient")
    if decision.allowed:
        # proceed with payment
        engine.record_payment("500000")
    ```
"""

import time
import threading
from dataclasses import dataclass
from typing import Callable, List, Optional


@dataclass
class PaymentPolicy:
    """Defines spending rules for AI agent payments."""

    max_amount_per_payment: Optional[int] = None
    max_amount_per_session: Optional[int] = None
    max_amount_per_day: Optional[int] = None
    max_payments_per_hour: Optional[int] = None
    allowed_recipients: Optional[List[str]] = None
    blocked_recipients: Optional[List[str]] = None
    allowed_networks: Optional[List[str]] = None
    allowed_schemes: Optional[List[str]] = None
    allowed_assets: Optional[List[str]] = None
    custom_rules: Optional[List["PolicyRule"]] = None


@dataclass
class PolicyRule:
    """Custom validation rule."""

    name: str
    validate: Callable[["PolicyContext"], "PolicyDecision"]


@dataclass
class PolicyContext:
    """Context passed to custom validation rules."""

    scheme: str
    network: str
    asset: str
    amount: int
    pay_to: str
    total_amount_paid: int
    payment_count: int
    payments_this_hour: int
    amount_paid_today: int


@dataclass
class PolicyDecision:
    """Result of a policy evaluation."""

    allowed: bool
    reason: str = ""


@dataclass
class SessionStats:
    """Current session statistics."""

    total_amount_paid: int = 0
    payment_count: int = 0
    payments_this_hour: int = 0
    amount_paid_today: int = 0


class PaymentPolicyEngine:
    """Evaluates payment requests against a policy.

    Thread-safe. Tracks cumulative session statistics for budget enforcement.
    """

    def __init__(self, policy: PaymentPolicy) -> None:
        self._policy = policy
        self._lock = threading.Lock()
        self._total_amount_paid = 0
        self._payment_count = 0
        self._amount_paid_today = 0
        self._hourly_timestamps: List[float] = []
        self._day_start = _start_of_day()
        self._start_time = time.time()

    def evaluate(
        self, scheme: str, network: str, asset: str, amount: str, pay_to: str
    ) -> PolicyDecision:
        """Check if a payment is allowed by the policy."""
        with self._lock:
            self._prune_hourly()
            self._check_day_rollover()

            try:
                amount_int = int(amount)
            except (ValueError, TypeError):
                return PolicyDecision(False, "invalid amount")

            p = self._policy

            # Max per payment
            if p.max_amount_per_payment is not None and amount_int > p.max_amount_per_payment:
                return PolicyDecision(
                    False,
                    f"amount {amount_int} exceeds max per payment {p.max_amount_per_payment}",
                )

            # Max per session
            if p.max_amount_per_session is not None:
                if self._total_amount_paid + amount_int > p.max_amount_per_session:
                    return PolicyDecision(
                        False,
                        f"cumulative {self._total_amount_paid + amount_int} exceeds session limit {p.max_amount_per_session}",
                    )

            # Max per day
            if p.max_amount_per_day is not None:
                if self._amount_paid_today + amount_int > p.max_amount_per_day:
                    return PolicyDecision(
                        False,
                        f"daily spending {self._amount_paid_today + amount_int} exceeds limit {p.max_amount_per_day}",
                    )

            # Max payments per hour
            if p.max_payments_per_hour is not None:
                if len(self._hourly_timestamps) >= p.max_payments_per_hour:
                    return PolicyDecision(
                        False,
                        f"hourly payment count {len(self._hourly_timestamps)} exceeds limit {p.max_payments_per_hour}",
                    )

            # Allowed recipients
            if p.allowed_recipients is not None:
                lower_allowed = [r.lower() for r in p.allowed_recipients]
                if pay_to.lower() not in lower_allowed:
                    return PolicyDecision(False, f"recipient {pay_to} not in allowed list")

            # Blocked recipients
            if p.blocked_recipients is not None:
                lower_blocked = [r.lower() for r in p.blocked_recipients]
                if pay_to.lower() in lower_blocked:
                    return PolicyDecision(False, f"recipient {pay_to} is blocked")

            # Allowed networks
            if p.allowed_networks is not None and network not in p.allowed_networks:
                return PolicyDecision(False, f"network {network} not allowed")

            # Allowed schemes
            if p.allowed_schemes is not None and scheme not in p.allowed_schemes:
                return PolicyDecision(False, f"scheme {scheme} not allowed")

            # Allowed assets
            if p.allowed_assets is not None:
                lower_assets = [a.lower() for a in p.allowed_assets]
                if asset.lower() not in lower_assets:
                    return PolicyDecision(False, f"asset {asset} not allowed")

            # Custom rules
            if p.custom_rules:
                ctx = PolicyContext(
                    scheme=scheme,
                    network=network,
                    asset=asset,
                    amount=amount_int,
                    pay_to=pay_to,
                    total_amount_paid=self._total_amount_paid,
                    payment_count=self._payment_count,
                    payments_this_hour=len(self._hourly_timestamps),
                    amount_paid_today=self._amount_paid_today,
                )
                for rule in p.custom_rules:
                    decision = rule.validate(ctx)
                    if not decision.allowed:
                        return PolicyDecision(False, f"rule '{rule.name}': {decision.reason}")

            return PolicyDecision(True)

    def record_payment(self, amount: str) -> None:
        """Record a successful payment to update session stats."""
        with self._lock:
            amount_int = int(amount)
            self._total_amount_paid += amount_int
            self._payment_count += 1
            self._amount_paid_today += amount_int
            self._hourly_timestamps.append(time.time())

    def reset(self) -> None:
        """Reset all session statistics."""
        with self._lock:
            self._total_amount_paid = 0
            self._payment_count = 0
            self._amount_paid_today = 0
            self._hourly_timestamps.clear()
            self._day_start = _start_of_day()
            self._start_time = time.time()

    @property
    def stats(self) -> SessionStats:
        """Get current session statistics."""
        with self._lock:
            self._prune_hourly()
            return SessionStats(
                total_amount_paid=self._total_amount_paid,
                payment_count=self._payment_count,
                payments_this_hour=len(self._hourly_timestamps),
                amount_paid_today=self._amount_paid_today,
            )

    def _prune_hourly(self) -> None:
        """Remove timestamps older than 1 hour. Must hold lock."""
        cutoff = time.time() - 3600
        self._hourly_timestamps = [t for t in self._hourly_timestamps if t > cutoff]

    def _check_day_rollover(self) -> None:
        """Reset daily amount if a new day has started. Must hold lock."""
        current_day_start = _start_of_day()
        if current_day_start > self._day_start:
            self._amount_paid_today = 0
            self._day_start = current_day_start


def _start_of_day() -> float:
    """Get the unix timestamp for the start of today (UTC)."""
    now = time.time()
    return now - (now % 86400)
