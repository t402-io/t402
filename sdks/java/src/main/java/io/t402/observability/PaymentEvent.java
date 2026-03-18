package io.t402.observability;

import java.time.Instant;
import java.util.Map;

/**
 * A single payment lifecycle event.
 */
public class PaymentEvent {
    private final String type;
    private final Instant timestamp;
    private final String paymentId;
    private final String network;
    private final String scheme;
    private final String amount;
    private final String payer;
    private final String payTo;
    private final String transaction;
    private final double durationMs;
    private final String error;
    private final Map<String, Object> metadata;

    public PaymentEvent(String type, String paymentId) {
        this(type, Instant.now(), paymentId, "", "", "", "", "", "", 0, "", null);
    }

    public PaymentEvent(String type, Instant timestamp, String paymentId,
                        String network, String scheme, String amount,
                        String payer, String payTo, String transaction,
                        double durationMs, String error, Map<String, Object> metadata) {
        this.type = type;
        this.timestamp = timestamp;
        this.paymentId = paymentId;
        this.network = network != null ? network : "";
        this.scheme = scheme != null ? scheme : "";
        this.amount = amount != null ? amount : "";
        this.payer = payer != null ? payer : "";
        this.payTo = payTo != null ? payTo : "";
        this.transaction = transaction != null ? transaction : "";
        this.durationMs = durationMs;
        this.error = error != null ? error : "";
        this.metadata = metadata;
    }

    public String getType() { return type; }
    public Instant getTimestamp() { return timestamp; }
    public String getPaymentId() { return paymentId; }
    public String getNetwork() { return network; }
    public String getScheme() { return scheme; }
    public String getAmount() { return amount; }
    public String getPayer() { return payer; }
    public String getPayTo() { return payTo; }
    public String getTransaction() { return transaction; }
    public double getDurationMs() { return durationMs; }
    public String getError() { return error; }
    public Map<String, Object> getMetadata() { return metadata; }

    /** Event type constants */
    public static final String REQUESTED = "payment.requested";
    public static final String REQUIREMENTS = "payment.requirements";
    public static final String SIGNED = "payment.signed";
    public static final String SUBMITTED = "payment.submitted";
    public static final String VERIFIED = "payment.verified";
    public static final String SETTLED = "payment.settled";
    public static final String COMPLETED = "payment.completed";
    public static final String FAILED = "payment.failed";
}
