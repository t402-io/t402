package io.t402.erc4337.safe;

/**
 * Safe operation type for transactions.
 */
public enum Operation {
    /** Standard external call. */
    CALL(0),

    /** Delegate call (executes in context of Safe). */
    DELEGATECALL(1);

    private final int value;

    Operation(int value) {
        this.value = value;
    }

    public int getValue() {
        return value;
    }

    public static Operation fromValue(int value) {
        for (Operation op : values()) {
            if (op.value == value) {
                return op;
            }
        }
        throw new IllegalArgumentException("Unknown operation: " + value);
    }
}
