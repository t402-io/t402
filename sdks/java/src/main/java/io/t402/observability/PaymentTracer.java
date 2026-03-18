package io.t402.observability;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Tracks individual payment flows with automatic duration calculation.
 */
public class PaymentTracer {

    private final PaymentEventCollector collector;
    private final ConcurrentHashMap<String, Long> flows = new ConcurrentHashMap<>();

    public PaymentTracer(PaymentEventCollector collector) {
        this.collector = collector;
    }

    public void startFlow(String paymentId, String network, String scheme, String amount) {
        long now = System.currentTimeMillis();
        flows.put(paymentId, now);
        collector.record(new PaymentEvent(
            PaymentEvent.REQUESTED, Instant.now(), paymentId,
            network, scheme, amount, "", "", "", 0, "", null
        ));
    }

    public void recordStep(String paymentId, String eventType, String transaction, String error) {
        long now = System.currentTimeMillis();
        Long last = flows.put(paymentId, now);
        double durationMs = last != null ? (now - last) : 0;
        collector.record(new PaymentEvent(
            eventType, Instant.now(), paymentId,
            "", "", "", "", "", transaction != null ? transaction : "",
            durationMs, error != null ? error : "", null
        ));
    }

    public void endFlow(String paymentId, boolean success, String network, String amount, String error) {
        String type = success ? PaymentEvent.COMPLETED : PaymentEvent.FAILED;
        long now = System.currentTimeMillis();
        Long last = flows.remove(paymentId);
        double durationMs = last != null ? (now - last) : 0;
        collector.record(new PaymentEvent(
            type, Instant.now(), paymentId,
            network != null ? network : "", "", amount != null ? amount : "",
            "", "", "", durationMs, error != null ? error : "", null
        ));
    }

    public List<PaymentEvent> getFlow(String paymentId) {
        return collector.getEvents(paymentId, null, null);
    }

    public int activeFlows() { return flows.size(); }
}
