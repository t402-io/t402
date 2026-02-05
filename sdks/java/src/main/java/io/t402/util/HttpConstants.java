package io.t402.util;

/**
 * HTTP header constants for the t402 protocol.
 *
 * <p>V2 headers use standard HTTP header naming (no X- prefix).
 * V1 headers use the legacy X- prefix for backward compatibility.</p>
 */
public final class HttpConstants {

    private HttpConstants() {}

    // V2 Headers (current protocol)
    /** Client → Server: signed payment authorization (v2). */
    public static final String PAYMENT_SIGNATURE = "PAYMENT-SIGNATURE";

    /** Server → Client: payment requirements in 402 response (v2). */
    public static final String PAYMENT_REQUIRED = "PAYMENT-REQUIRED";

    /** Server → Client: settlement result after payment (v2). */
    public static final String PAYMENT_RESPONSE = "PAYMENT-RESPONSE";

    // V1 Headers (legacy)
    /** Client → Server: signed payment authorization (v1). */
    public static final String X_PAYMENT = "X-PAYMENT";

    /** Server → Client: settlement result after payment (v1). */
    public static final String X_PAYMENT_RESPONSE = "X-PAYMENT-RESPONSE";

    /**
     * Returns the client payment header name for the given protocol version.
     *
     * @param t402Version the protocol version (1 or 2)
     * @return header name
     */
    public static String getPaymentHeaderName(int t402Version) {
        return t402Version >= 2 ? PAYMENT_SIGNATURE : X_PAYMENT;
    }

    /**
     * Returns the settlement response header name for the given protocol version.
     *
     * @param t402Version the protocol version (1 or 2)
     * @return header name
     */
    public static String getResponseHeaderName(int t402Version) {
        return t402Version >= 2 ? PAYMENT_RESPONSE : X_PAYMENT_RESPONSE;
    }
}
