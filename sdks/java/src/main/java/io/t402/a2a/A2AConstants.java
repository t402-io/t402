package io.t402.a2a;

import java.util.Map;

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

    /** x402 v0.2 A2A extension URI (compatibility layer). */
    public static final String X402_EXTENSION_URI = "https://github.com/google-agentic-commerce/a2a-x402/blob/main/spec/v0.2";

    // x402 payment metadata keys (compatibility layer)
    public static final String X402_META_PAYMENT_STATUS = "x402.payment.status";
    public static final String X402_META_PAYMENT_REQUIRED = "x402.payment.required";
    public static final String X402_META_PAYMENT_PAYLOAD = "x402.payment.payload";
    public static final String X402_META_PAYMENT_RECEIPTS = "x402.payment.receipts";
    public static final String X402_META_PAYMENT_ERROR = "x402.payment.error";

    /** CAIP-2 to flat name mapping for x402 V1 compat. */
    public static final Map<String, String> CAIP2_TO_FLAT_NAME = Map.ofEntries(
            Map.entry("eip155:1", "ethereum"),
            Map.entry("eip155:8453", "base"),
            Map.entry("eip155:84532", "base-sepolia"),
            Map.entry("eip155:42161", "arbitrum"),
            Map.entry("eip155:10", "optimism"),
            Map.entry("eip155:137", "polygon"),
            Map.entry("eip155:56", "bsc"),
            Map.entry("eip155:43114", "avalanche"),
            Map.entry("eip155:43113", "avalanche-fuji"),
            Map.entry("eip155:250", "fantom"),
            Map.entry("eip155:8217", "klaytn"),
            Map.entry("eip155:42220", "celo"),
            Map.entry("eip155:57073", "ink"),
            Map.entry("eip155:80094", "berachain"),
            Map.entry("eip155:130", "unichain"),
            Map.entry("eip155:5000", "mantle"),
            Map.entry("eip155:9745", "plasma"),
            Map.entry("eip155:1329", "sei"),
            Map.entry("eip155:1030", "conflux"),
            Map.entry("eip155:143", "monad"),
            Map.entry("eip155:14", "flare"),
            Map.entry("eip155:30", "rootstock"),
            Map.entry("eip155:196", "xlayer"),
            Map.entry("eip155:988", "stable"),
            Map.entry("eip155:999", "hyperevm"),
            Map.entry("eip155:4326", "megaeth"),
            Map.entry("eip155:21000000", "corn")
    );

    /** T402 to x402 v0.2 error code mapping. */
    public static final Map<String, String> T402_TO_X402_ERROR_MAP = Map.of(
            "T402-1001", "INVALID_AMOUNT",
            "T402-2001", "INVALID_SIGNATURE",
            "T402-3001", "SETTLEMENT_FAILED",
            "T402-5001", "SETTLEMENT_FAILED",
            "T402-5002", "SETTLEMENT_FAILED"
    );

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
