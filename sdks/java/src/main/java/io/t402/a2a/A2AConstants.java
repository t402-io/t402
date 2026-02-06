package io.t402.a2a;

/**
 * Constants for the A2A (Agent-to-Agent) transport protocol.
 */
public final class A2AConstants {

    private A2AConstants() {}

    /** T402 A2A extension URI. */
    public static final String T402_EXTENSION_URI = "https://github.com/google-a2a/a2a-t402/v0.1";

    /** HTTP header for A2A extension activation. */
    public static final String EXTENSIONS_HEADER = "X-A2A-Extensions";

    // Payment metadata keys
    public static final String META_PAYMENT_STATUS = "t402.payment.status";
    public static final String META_PAYMENT_REQUIRED = "t402.payment.required";
    public static final String META_PAYMENT_PAYLOAD = "t402.payment.payload";
    public static final String META_PAYMENT_RECEIPTS = "t402.payment.receipts";
    public static final String META_PAYMENT_ERROR = "t402.payment.error";

    // Payment status values
    public static final String STATUS_PAYMENT_REQUIRED = "payment-required";
    public static final String STATUS_PAYMENT_REJECTED = "payment-rejected";
    public static final String STATUS_PAYMENT_SUBMITTED = "payment-submitted";
    public static final String STATUS_PAYMENT_VERIFIED = "payment-verified";
    public static final String STATUS_PAYMENT_COMPLETED = "payment-completed";
    public static final String STATUS_PAYMENT_FAILED = "payment-failed";

    // Task state values
    public static final String STATE_SUBMITTED = "submitted";
    public static final String STATE_WORKING = "working";
    public static final String STATE_INPUT_REQUIRED = "input-required";
    public static final String STATE_COMPLETED = "completed";
    public static final String STATE_CANCELED = "canceled";
    public static final String STATE_FAILED = "failed";
    public static final String STATE_UNKNOWN = "unknown";
}
