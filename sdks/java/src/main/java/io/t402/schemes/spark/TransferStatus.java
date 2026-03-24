package io.t402.schemes.spark;

/**
 * Represents the state of a Spark transfer.
 */
public enum TransferStatus {

    /** Transfer is pending confirmation. */
    PENDING(0),

    /** Transfer has been completed successfully. */
    COMPLETED(5),

    /** Transfer has failed. */
    FAILED(9);

    private final int value;

    TransferStatus(int value) {
        this.value = value;
    }

    /**
     * Gets the integer value of this status.
     *
     * @return Status value
     */
    public int getValue() {
        return value;
    }

    /**
     * Converts an integer value to a TransferStatus.
     *
     * @param value Integer value
     * @return Corresponding TransferStatus
     * @throws IllegalArgumentException if the value is not recognized
     */
    public static TransferStatus fromValue(int value) {
        for (TransferStatus status : values()) {
            if (status.value == value) {
                return status;
            }
        }
        throw new IllegalArgumentException("Unknown transfer status value: " + value);
    }
}
