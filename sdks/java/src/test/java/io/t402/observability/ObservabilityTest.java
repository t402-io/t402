package io.t402.observability;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigInteger;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class ObservabilityTest {

    @Nested @DisplayName("Collector")
    class CollectorTests {
        @Test void recordAndRetrieve() {
            var c = new PaymentEventCollector();
            c.record(new PaymentEvent(PaymentEvent.REQUESTED, "p1"));
            assertEquals(1, c.size());
            assertEquals(1, c.getEvents().size());
        }

        @Test void filterByPaymentId() {
            var c = new PaymentEventCollector();
            c.record(new PaymentEvent(PaymentEvent.REQUESTED, "p1"));
            c.record(new PaymentEvent(PaymentEvent.REQUESTED, "p2"));
            assertEquals(1, c.getEvents("p1", null, null).size());
        }

        @Test void filterByType() {
            var c = new PaymentEventCollector();
            c.record(new PaymentEvent(PaymentEvent.REQUESTED, "p1"));
            c.record(new PaymentEvent(PaymentEvent.COMPLETED, "p1"));
            assertEquals(1, c.getEvents(null, PaymentEvent.COMPLETED, null).size());
        }

        @Test void ringBufferOverflow() {
            var c = new PaymentEventCollector(5);
            for (int i = 0; i < 10; i++) c.record(new PaymentEvent(PaymentEvent.REQUESTED, "p" + i));
            assertEquals(5, c.size());
        }

        @Test void clear() {
            var c = new PaymentEventCollector();
            c.record(new PaymentEvent(PaymentEvent.REQUESTED, "p1"));
            c.clear();
            assertEquals(0, c.size());
        }

        @Test void metricsBasic() {
            var c = new PaymentEventCollector();
            c.record(new PaymentEvent(PaymentEvent.REQUESTED, "p1"));
            c.record(new PaymentEvent(PaymentEvent.COMPLETED, Instant.now(), "p1", "eip155:8453", "", "1000000", "", "", "", 0, "", null));
            c.record(new PaymentEvent(PaymentEvent.REQUESTED, "p2"));
            c.record(new PaymentEvent(PaymentEvent.FAILED, Instant.now(), "p2", "", "", "", "", "", "", 0, "timeout", null));

            var m = c.getMetrics();
            assertEquals(2, m.totalAttempted());
            assertEquals(1, m.totalSuccessful());
            assertEquals(1, m.totalFailed());
            assertEquals(1, m.countByNetwork().get("eip155:8453"));
            assertEquals(new BigInteger("1000000"), m.amountByNetwork().get("eip155:8453"));
            assertEquals(1, m.failureReasons().get("timeout"));
        }

        @Test void metricsLatency() {
            var c = new PaymentEventCollector();
            c.record(new PaymentEvent(PaymentEvent.VERIFIED, Instant.now(), "p1", "", "", "", "", "", "", 50, "", null));
            c.record(new PaymentEvent(PaymentEvent.VERIFIED, Instant.now(), "p2", "", "", "", "", "", "", 100, "", null));
            c.record(new PaymentEvent(PaymentEvent.SETTLED, Instant.now(), "p1", "", "", "", "", "", "", 200, "", null));

            var m = c.getMetrics();
            assertEquals(75.0, m.avgVerifyLatencyMs());
            assertEquals(200.0, m.avgSettleLatencyMs());
        }

        @Test void metricsEmpty() {
            var m = new PaymentEventCollector().getMetrics();
            assertEquals(0, m.totalAttempted());
            assertEquals(0.0, m.avgVerifyLatencyMs());
        }
    }

    @Nested @DisplayName("Tracer")
    class TracerTests {
        @Test void fullFlow() {
            var c = new PaymentEventCollector();
            var t = new PaymentTracer(c);
            t.startFlow("p1", "eip155:8453", "exact", "1000000");
            t.recordStep("p1", PaymentEvent.VERIFIED, null, null);
            t.recordStep("p1", PaymentEvent.SETTLED, "0xtx", null);
            t.endFlow("p1", true, "eip155:8453", "1000000", null);

            var events = t.getFlow("p1");
            assertEquals(4, events.size());
            assertEquals(PaymentEvent.REQUESTED, events.get(0).getType());
            assertEquals(PaymentEvent.COMPLETED, events.get(3).getType());
        }

        @Test void failedFlow() {
            var c = new PaymentEventCollector();
            var t = new PaymentTracer(c);
            t.startFlow("p1", "", "", "");
            t.endFlow("p1", false, "", "", "timeout");

            var events = t.getFlow("p1");
            assertEquals(2, events.size());
            assertEquals(PaymentEvent.FAILED, events.get(1).getType());
            assertEquals("timeout", events.get(1).getError());
        }

        @Test void activeFlows() {
            var c = new PaymentEventCollector();
            var t = new PaymentTracer(c);
            t.startFlow("p1", "", "", "");
            t.startFlow("p2", "", "", "");
            assertEquals(2, t.activeFlows());
            t.endFlow("p1", true, "", "", null);
            assertEquals(1, t.activeFlows());
        }
    }

    @Nested @DisplayName("Prometheus")
    class PrometheusTests {
        @Test void basicFormat() {
            var c = new PaymentEventCollector();
            c.record(new PaymentEvent(PaymentEvent.REQUESTED, "p1"));
            c.record(new PaymentEvent(PaymentEvent.COMPLETED, Instant.now(), "p1", "eip155:8453", "", "1000000", "", "", "", 0, "", null));

            var output = PrometheusExporter.toPrometheusMetrics(c.getMetrics());
            assertTrue(output.contains("t402_payments_total{status=\"attempted\"} 1"));
            assertTrue(output.contains("t402_payments_total{status=\"successful\"} 1"));
            assertTrue(output.contains("t402_payments_by_network_total{network=\"eip155:8453\"} 1"));
            assertTrue(output.contains("t402_payment_amount_total{network=\"eip155:8453\"} 1000000"));
        }

        @Test void emptyMetrics() {
            var output = PrometheusExporter.toPrometheusMetrics(new PaymentEventCollector().getMetrics());
            assertTrue(output.contains("t402_payments_total{status=\"attempted\"} 0"));
        }

        @Test void latencyFormat() {
            var c = new PaymentEventCollector();
            c.record(new PaymentEvent(PaymentEvent.VERIFIED, Instant.now(), "p1", "", "", "", "", "", "", 150, "", null));
            var output = PrometheusExporter.toPrometheusMetrics(c.getMetrics());
            assertTrue(output.contains("t402_payment_duration_seconds{phase=\"verify\"} 0.150000"));
        }
    }

    @Nested @DisplayName("EventTypes")
    class EventTypeTests {
        @Test void allTypesExist() {
            assertNotNull(PaymentEvent.REQUESTED);
            assertNotNull(PaymentEvent.REQUIREMENTS);
            assertNotNull(PaymentEvent.SIGNED);
            assertNotNull(PaymentEvent.SUBMITTED);
            assertNotNull(PaymentEvent.VERIFIED);
            assertNotNull(PaymentEvent.SETTLED);
            assertNotNull(PaymentEvent.COMPLETED);
            assertNotNull(PaymentEvent.FAILED);
        }
    }
}
