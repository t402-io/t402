package io.t402.extensions.dispute;

/**
 * Thrown when callers attempt JWS-format operations; reserved for a
 * future spec revision.
 */
public class JWSReservedException extends RuntimeException {
    public JWSReservedException() {
        super("JWS format is reserved for future spec; only EIP-712 is supported");
    }
}
