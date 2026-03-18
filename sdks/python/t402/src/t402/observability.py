"""Payment observability for AI agent payment flows.

Tracks payment events, computes metrics, and supports Prometheus export.

Example:
    ```python
    from t402.observability import PaymentEventCollector, PaymentTracer

    collector = PaymentEventCollector()
    tracer = PaymentTracer(collector)

    flow = tracer.start_flow("pay-001", network="eip155:8453")
    tracer.record_step("pay-001", "payment.verified")
    tracer.record_step("pay-001", "payment.settled", transaction="0xtx")
    tracer.end_flow("pay-001", success=True)

    metrics = collector.get_metrics()
    print(f"Success rate: {metrics.total_successful}/{metrics.total_attempted}")
    ```
"""

import threading
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Deque, Dict, List, Optional


# Event types
EVENT_REQUESTED = "payment.requested"
EVENT_REQUIREMENTS = "payment.requirements"
EVENT_SIGNED = "payment.signed"
EVENT_SUBMITTED = "payment.submitted"
EVENT_VERIFIED = "payment.verified"
EVENT_SETTLED = "payment.settled"
EVENT_COMPLETED = "payment.completed"
EVENT_FAILED = "payment.failed"


@dataclass
class PaymentEvent:
    type: str
    timestamp: float
    payment_id: str
    network: str = ""
    scheme: str = ""
    amount: str = ""
    payer: str = ""
    pay_to: str = ""
    transaction: str = ""
    duration_ms: float = 0.0
    error: str = ""
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class PaymentMetrics:
    total_attempted: int = 0
    total_successful: int = 0
    total_failed: int = 0
    avg_verify_latency_ms: float = 0.0
    avg_settle_latency_ms: float = 0.0
    amount_by_network: Dict[str, int] = field(default_factory=dict)
    count_by_network: Dict[str, int] = field(default_factory=dict)
    failure_reasons: Dict[str, int] = field(default_factory=dict)


class PaymentEventCollector:
    """Collects payment events with a ring buffer."""

    def __init__(self, max_events: int = 10000) -> None:
        self._lock = threading.Lock()
        self._events: Deque[PaymentEvent] = deque(maxlen=max_events)
        self._max_events = max_events

    def record(self, event: PaymentEvent) -> None:
        with self._lock:
            self._events.append(event)

    def get_events(
        self,
        payment_id: Optional[str] = None,
        event_type: Optional[str] = None,
        network: Optional[str] = None,
    ) -> List[PaymentEvent]:
        with self._lock:
            result = list(self._events)
        if payment_id:
            result = [e for e in result if e.payment_id == payment_id]
        if event_type:
            result = [e for e in result if e.type == event_type]
        if network:
            result = [e for e in result if e.network == network]
        return result

    def get_metrics(self) -> PaymentMetrics:
        with self._lock:
            events = list(self._events)

        metrics = PaymentMetrics()
        verify_latencies: List[float] = []
        settle_latencies: List[float] = []
        seen_flows: set = set()

        for e in events:
            if e.type == EVENT_REQUESTED:
                metrics.total_attempted += 1
                seen_flows.add(e.payment_id)
            elif e.type == EVENT_COMPLETED:
                metrics.total_successful += 1
                if e.network:
                    metrics.count_by_network[e.network] = metrics.count_by_network.get(e.network, 0) + 1
                if e.amount and e.network:
                    try:
                        amt = int(e.amount)
                        metrics.amount_by_network[e.network] = metrics.amount_by_network.get(e.network, 0) + amt
                    except ValueError:
                        pass
            elif e.type == EVENT_FAILED:
                metrics.total_failed += 1
                reason = e.error or "unknown"
                metrics.failure_reasons[reason] = metrics.failure_reasons.get(reason, 0) + 1
            elif e.type == EVENT_VERIFIED and e.duration_ms > 0:
                verify_latencies.append(e.duration_ms)
            elif e.type == EVENT_SETTLED and e.duration_ms > 0:
                settle_latencies.append(e.duration_ms)

        if verify_latencies:
            metrics.avg_verify_latency_ms = sum(verify_latencies) / len(verify_latencies)
        if settle_latencies:
            metrics.avg_settle_latency_ms = sum(settle_latencies) / len(settle_latencies)

        return metrics

    def clear(self) -> None:
        with self._lock:
            self._events.clear()

    @property
    def size(self) -> int:
        with self._lock:
            return len(self._events)


class PaymentTracer:
    """Tracks individual payment flows with automatic duration calculation."""

    def __init__(self, collector: PaymentEventCollector) -> None:
        self._collector = collector
        self._lock = threading.Lock()
        self._flows: Dict[str, float] = {}  # payment_id -> last_step_time

    def start_flow(self, payment_id: str, **kwargs: Any) -> None:
        now = time.time()
        with self._lock:
            self._flows[payment_id] = now
        self._collector.record(PaymentEvent(
            type=EVENT_REQUESTED,
            timestamp=now,
            payment_id=payment_id,
            network=kwargs.get("network", ""),
            scheme=kwargs.get("scheme", ""),
            amount=kwargs.get("amount", ""),
            payer=kwargs.get("payer", ""),
            pay_to=kwargs.get("pay_to", ""),
            metadata=kwargs.get("metadata"),
        ))

    def record_step(self, payment_id: str, event_type: str, **kwargs: Any) -> None:
        now = time.time()
        with self._lock:
            last = self._flows.get(payment_id, now)
            self._flows[payment_id] = now
        duration_ms = (now - last) * 1000

        self._collector.record(PaymentEvent(
            type=event_type,
            timestamp=now,
            payment_id=payment_id,
            duration_ms=duration_ms,
            network=kwargs.get("network", ""),
            scheme=kwargs.get("scheme", ""),
            amount=kwargs.get("amount", ""),
            payer=kwargs.get("payer", ""),
            pay_to=kwargs.get("pay_to", ""),
            transaction=kwargs.get("transaction", ""),
            error=kwargs.get("error", ""),
            metadata=kwargs.get("metadata"),
        ))

    def end_flow(self, payment_id: str, success: bool, **kwargs: Any) -> None:
        event_type = EVENT_COMPLETED if success else EVENT_FAILED
        self.record_step(payment_id, event_type, **kwargs)
        with self._lock:
            self._flows.pop(payment_id, None)

    def active_flows(self) -> int:
        with self._lock:
            return len(self._flows)


def to_prometheus_metrics(metrics: PaymentMetrics) -> str:
    """Format PaymentMetrics as Prometheus text exposition format."""
    lines: List[str] = []

    lines.append("# HELP t402_payments_total Total payment attempts by status")
    lines.append("# TYPE t402_payments_total counter")
    lines.append(f't402_payments_total{{status="attempted"}} {metrics.total_attempted}')
    lines.append(f't402_payments_total{{status="successful"}} {metrics.total_successful}')
    lines.append(f't402_payments_total{{status="failed"}} {metrics.total_failed}')

    lines.append("# HELP t402_payment_duration_seconds Average payment phase duration")
    lines.append("# TYPE t402_payment_duration_seconds gauge")
    lines.append(f't402_payment_duration_seconds{{phase="verify"}} {metrics.avg_verify_latency_ms / 1000:.6f}')
    lines.append(f't402_payment_duration_seconds{{phase="settle"}} {metrics.avg_settle_latency_ms / 1000:.6f}')

    if metrics.count_by_network:
        lines.append("# HELP t402_payments_by_network_total Payments by network")
        lines.append("# TYPE t402_payments_by_network_total counter")
        for net, count in sorted(metrics.count_by_network.items()):
            lines.append(f't402_payments_by_network_total{{network="{net}"}} {count}')

    if metrics.amount_by_network:
        lines.append("# HELP t402_payment_amount_total Total payment amount by network")
        lines.append("# TYPE t402_payment_amount_total counter")
        for net, amt in sorted(metrics.amount_by_network.items()):
            lines.append(f't402_payment_amount_total{{network="{net}"}} {amt}')

    if metrics.failure_reasons:
        lines.append("# HELP t402_payment_failures_total Payment failures by reason")
        lines.append("# TYPE t402_payment_failures_total counter")
        for reason, count in sorted(metrics.failure_reasons.items()):
            lines.append(f't402_payment_failures_total{{reason="{reason}"}} {count}')

    return "\n".join(lines) + "\n"
