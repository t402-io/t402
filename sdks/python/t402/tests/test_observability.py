"""Tests for payment observability."""

import time
import threading
from t402.observability import (
    PaymentEventCollector,
    PaymentTracer,
    PaymentEvent,
    to_prometheus_metrics,
    EVENT_REQUESTED,
    EVENT_VERIFIED,
    EVENT_SETTLED,
    EVENT_COMPLETED,
    EVENT_FAILED,
)


class TestPaymentEventCollector:
    def test_record_and_retrieve(self):
        c = PaymentEventCollector()
        c.record(PaymentEvent(EVENT_REQUESTED, time.time(), "p1", network="eip155:8453"))
        assert c.size == 1
        events = c.get_events()
        assert len(events) == 1
        assert events[0].payment_id == "p1"

    def test_filter_by_payment_id(self):
        c = PaymentEventCollector()
        c.record(PaymentEvent(EVENT_REQUESTED, time.time(), "p1"))
        c.record(PaymentEvent(EVENT_REQUESTED, time.time(), "p2"))
        assert len(c.get_events(payment_id="p1")) == 1

    def test_filter_by_event_type(self):
        c = PaymentEventCollector()
        c.record(PaymentEvent(EVENT_REQUESTED, time.time(), "p1"))
        c.record(PaymentEvent(EVENT_COMPLETED, time.time(), "p1"))
        assert len(c.get_events(event_type=EVENT_COMPLETED)) == 1

    def test_filter_by_network(self):
        c = PaymentEventCollector()
        c.record(PaymentEvent(EVENT_REQUESTED, time.time(), "p1", network="eip155:8453"))
        c.record(PaymentEvent(EVENT_REQUESTED, time.time(), "p2", network="eip155:1"))
        assert len(c.get_events(network="eip155:8453")) == 1

    def test_ring_buffer_overflow(self):
        c = PaymentEventCollector(max_events=5)
        for i in range(10):
            c.record(PaymentEvent(EVENT_REQUESTED, time.time(), f"p{i}"))
        assert c.size == 5
        events = c.get_events()
        assert events[0].payment_id == "p5"

    def test_clear(self):
        c = PaymentEventCollector()
        c.record(PaymentEvent(EVENT_REQUESTED, time.time(), "p1"))
        c.clear()
        assert c.size == 0

    def test_metrics_basic(self):
        c = PaymentEventCollector()
        c.record(PaymentEvent(EVENT_REQUESTED, time.time(), "p1"))
        c.record(PaymentEvent(EVENT_COMPLETED, time.time(), "p1", network="eip155:8453", amount="1000000"))
        c.record(PaymentEvent(EVENT_REQUESTED, time.time(), "p2"))
        c.record(PaymentEvent(EVENT_FAILED, time.time(), "p2", error="insufficient_balance"))

        m = c.get_metrics()
        assert m.total_attempted == 2
        assert m.total_successful == 1
        assert m.total_failed == 1
        assert m.count_by_network.get("eip155:8453") == 1
        assert m.amount_by_network.get("eip155:8453") == 1000000
        assert m.failure_reasons.get("insufficient_balance") == 1

    def test_metrics_latency(self):
        c = PaymentEventCollector()
        c.record(PaymentEvent(EVENT_VERIFIED, time.time(), "p1", duration_ms=50.0))
        c.record(PaymentEvent(EVENT_VERIFIED, time.time(), "p2", duration_ms=100.0))
        c.record(PaymentEvent(EVENT_SETTLED, time.time(), "p1", duration_ms=200.0))

        m = c.get_metrics()
        assert m.avg_verify_latency_ms == 75.0
        assert m.avg_settle_latency_ms == 200.0

    def test_metrics_empty(self):
        c = PaymentEventCollector()
        m = c.get_metrics()
        assert m.total_attempted == 0
        assert m.avg_verify_latency_ms == 0.0

    def test_thread_safety(self):
        c = PaymentEventCollector()
        errors = []

        def worker(offset):
            try:
                for i in range(100):
                    c.record(PaymentEvent(EVENT_REQUESTED, time.time(), f"p{offset}_{i}"))
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker, args=(t,)) for t in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        assert not errors
        assert c.size == 500


class TestPaymentTracer:
    def test_full_flow(self):
        c = PaymentEventCollector()
        t = PaymentTracer(c)

        t.start_flow("p1", network="eip155:8453", amount="1000000")
        time.sleep(0.01)
        t.record_step("p1", EVENT_VERIFIED)
        time.sleep(0.01)
        t.record_step("p1", EVENT_SETTLED, transaction="0xtx")
        t.end_flow("p1", success=True, network="eip155:8453", amount="1000000")

        events = c.get_events(payment_id="p1")
        assert len(events) == 4
        assert events[0].type == EVENT_REQUESTED
        assert events[1].type == EVENT_VERIFIED
        assert events[1].duration_ms > 0
        assert events[2].type == EVENT_SETTLED
        assert events[2].transaction == "0xtx"
        assert events[3].type == EVENT_COMPLETED

    def test_failed_flow(self):
        c = PaymentEventCollector()
        t = PaymentTracer(c)

        t.start_flow("p1")
        t.end_flow("p1", success=False, error="timeout")

        events = c.get_events(payment_id="p1")
        assert len(events) == 2
        assert events[1].type == EVENT_FAILED
        assert events[1].error == "timeout"

    def test_active_flows(self):
        c = PaymentEventCollector()
        t = PaymentTracer(c)

        t.start_flow("p1")
        t.start_flow("p2")
        assert t.active_flows() == 2

        t.end_flow("p1", success=True)
        assert t.active_flows() == 1

    def test_duration_tracking(self):
        c = PaymentEventCollector()
        t = PaymentTracer(c)

        t.start_flow("p1")
        time.sleep(0.05)
        t.record_step("p1", EVENT_VERIFIED)

        events = c.get_events(payment_id="p1")
        assert events[1].duration_ms >= 40  # ~50ms with tolerance


class TestPrometheusExport:
    def test_basic_format(self):
        c = PaymentEventCollector()
        c.record(PaymentEvent(EVENT_REQUESTED, time.time(), "p1"))
        c.record(PaymentEvent(EVENT_COMPLETED, time.time(), "p1", network="eip155:8453", amount="1000000"))
        c.record(PaymentEvent(EVENT_FAILED, time.time(), "p2", error="timeout"))

        m = c.get_metrics()
        output = to_prometheus_metrics(m)

        assert 't402_payments_total{status="attempted"} 1' in output
        assert 't402_payments_total{status="successful"} 1' in output
        assert 't402_payments_total{status="failed"} 1' in output
        assert 't402_payments_by_network_total{network="eip155:8453"} 1' in output
        assert 't402_payment_amount_total{network="eip155:8453"} 1000000' in output
        assert 't402_payment_failures_total{reason="timeout"} 1' in output

    def test_empty_metrics(self):
        m = PaymentEventCollector().get_metrics()
        output = to_prometheus_metrics(m)
        assert 't402_payments_total{status="attempted"} 0' in output

    def test_latency_format(self):
        c = PaymentEventCollector()
        c.record(PaymentEvent(EVENT_VERIFIED, time.time(), "p1", duration_ms=150.0))
        m = c.get_metrics()
        output = to_prometheus_metrics(m)
        assert 't402_payment_duration_seconds{phase="verify"} 0.150000' in output
