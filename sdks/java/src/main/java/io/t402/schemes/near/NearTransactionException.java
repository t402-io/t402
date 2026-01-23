package io.t402.schemes.near;

/**
 * Exception thrown when a NEAR transaction fails.
 *
 * <p>This exception is used to indicate various failure modes during
 * NEAR payment processing:
 * <ul>
 *   <li>Transaction broadcast failures</li>
 *   <li>Transaction not found errors</li>
 *   <li>Insufficient balance errors</li>
 *   <li>Invalid account ID errors</li>
 *   <li>Network errors</li>
 *   <li>Timeout errors</li>
 * </ul>
 */
public class NearTransactionException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final String txHash;
    private final String errorCode;

    /**
     * Creates a new NearTransactionException with a message.
     *
     * @param message Error message
     */
    public NearTransactionException(String message) {
        super(message);
        this.txHash = null;
        this.errorCode = null;
    }

    /**
     * Creates a new NearTransactionException with a message and cause.
     *
     * @param message Error message
     * @param cause Underlying cause
     */
    public NearTransactionException(String message, Throwable cause) {
        super(message, cause);
        this.txHash = null;
        this.errorCode = null;
    }

    /**
     * Creates a new NearTransactionException with transaction details.
     *
     * @param message Error message
     * @param txHash Transaction hash if available
     * @param errorCode NEAR error code if available
     */
    public NearTransactionException(String message, String txHash, String errorCode) {
        super(message);
        this.txHash = txHash;
        this.errorCode = errorCode;
    }

    /**
     * Gets the transaction hash if available.
     *
     * @return Transaction hash or null
     */
    public String getTxHash() {
        return txHash;
    }

    /**
     * Gets the error code if available.
     *
     * @return NEAR error code or null
     */
    public String getErrorCode() {
        return errorCode;
    }
}
