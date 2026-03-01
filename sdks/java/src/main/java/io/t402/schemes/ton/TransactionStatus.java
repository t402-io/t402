package io.t402.schemes.ton;

/**
 * Transaction lifecycle status for TON payments.
 *
 * <p>Adopts the transaction status tracking pattern from TON Connect v0.0.9 (TEP-46).
 *
 * <ul>
 *   <li>{@link #PENDING} — transaction broadcast but not yet confirmed</li>
 *   <li>{@link #CONFIRMED} — transaction confirmed on-chain (seqno incremented)</li>
 *   <li>{@link #FAILED} — transaction processed but Jetton transfer failed (e.g., insufficient gas for internal message)</li>
 * </ul>
 */
public enum TransactionStatus {

    /** Transaction has been broadcast but not yet confirmed. */
    PENDING("pending"),

    /** Transaction was confirmed on-chain. */
    CONFIRMED("confirmed"),

    /** Transaction was processed but the Jetton transfer failed. */
    FAILED("failed");

    private final String value;

    TransactionStatus(String value) {
        this.value = value;
    }

    /**
     * Returns the wire-format string value.
     *
     * @return status string (e.g., "pending", "confirmed", "failed")
     */
    public String getValue() {
        return value;
    }

    /**
     * Parses a string into a TransactionStatus.
     *
     * @param value the status string
     * @return the corresponding TransactionStatus
     * @throws IllegalArgumentException if the value is not recognized
     */
    public static TransactionStatus fromValue(String value) {
        for (TransactionStatus status : values()) {
            if (status.value.equals(value)) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown transaction status: " + value);
    }

    @Override
    public String toString() {
        return value;
    }
}
