package io.t402.observability;

import java.math.BigInteger;
import java.util.*;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.stream.Collectors;

/**
 * Thread-safe collector for payment lifecycle events with ring buffer and metrics.
 */
public class PaymentEventCollector {

    private static final int DEFAULT_MAX_EVENTS = 10_000;
    private final int maxEvents;
    private final Deque<PaymentEvent> events = new ConcurrentLinkedDeque<>();

    public PaymentEventCollector() { this(DEFAULT_MAX_EVENTS); }
    public PaymentEventCollector(int maxEvents) { this.maxEvents = maxEvents; }

    public void record(PaymentEvent event) {
        events.addLast(event);
        while (events.size() > maxEvents) {
            events.pollFirst();
        }
    }

    public List<PaymentEvent> getEvents(String paymentId, String eventType, String network) {
        return events.stream()
            .filter(e -> paymentId == null || paymentId.equals(e.getPaymentId()))
            .filter(e -> eventType == null || eventType.equals(e.getType()))
            .filter(e -> network == null || network.equals(e.getNetwork()))
            .collect(Collectors.toList());
    }

    public List<PaymentEvent> getEvents() { return new ArrayList<>(events); }

    public PaymentMetrics getMetrics() {
        List<PaymentEvent> snapshot = new ArrayList<>(events);
        int attempted = 0, successful = 0, failed = 0;
        List<Double> verifyLats = new ArrayList<>(), settleLats = new ArrayList<>();
        Map<String, BigInteger> amountByNet = new HashMap<>();
        Map<String, Integer> countByNet = new HashMap<>();
        Map<String, Integer> failReasons = new HashMap<>();

        for (PaymentEvent e : snapshot) {
            switch (e.getType()) {
                case PaymentEvent.REQUESTED -> attempted++;
                case PaymentEvent.COMPLETED -> {
                    successful++;
                    if (!e.getNetwork().isEmpty()) {
                        countByNet.merge(e.getNetwork(), 1, Integer::sum);
                        if (!e.getAmount().isEmpty()) {
                            try {
                                amountByNet.merge(e.getNetwork(), new BigInteger(e.getAmount()), BigInteger::add);
                            } catch (NumberFormatException ignored) {}
                        }
                    }
                }
                case PaymentEvent.FAILED -> {
                    failed++;
                    String reason = e.getError().isEmpty() ? "unknown" : e.getError();
                    failReasons.merge(reason, 1, Integer::sum);
                }
                case PaymentEvent.VERIFIED -> { if (e.getDurationMs() > 0) verifyLats.add(e.getDurationMs()); }
                case PaymentEvent.SETTLED -> { if (e.getDurationMs() > 0) settleLats.add(e.getDurationMs()); }
                default -> {}
            }
        }

        double avgVerify = verifyLats.isEmpty() ? 0 : verifyLats.stream().mapToDouble(d -> d).average().orElse(0);
        double avgSettle = settleLats.isEmpty() ? 0 : settleLats.stream().mapToDouble(d -> d).average().orElse(0);

        return new PaymentMetrics(attempted, successful, failed, avgVerify, avgSettle, amountByNet, countByNet, failReasons);
    }

    public int size() { return events.size(); }
    public void clear() { events.clear(); }
}
