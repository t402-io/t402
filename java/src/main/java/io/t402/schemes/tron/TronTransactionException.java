package io.t402.schemes.tron;

/**
 * Exception thrown when a TRON transaction fails.
 *
 * <p>This exception is used to indicate various failure modes during
 * TRON payment processing:
 * <ul>
 *   <li>Transaction broadcast failures</li>
 *   <li>Insufficient balance errors</li>
 *   <li>Signature verification failures</li>
 *   <li>Network errors</li>
 *   <li>Timeout errors</li>
 * </ul>
 */
public class TronTransactionException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final String txHash;
    private final String errorCode;

    /**
     * Creates a new TronTransactionException with a message.
     *
     * @param message Error message
     */
    public TronTransactionException(String message) {
        super(message);
        this.txHash = null;
        this.errorCode = null;
    }

    /**
     * Creates a new TronTransactionException with a message and cause.
     *
     * @param message Error message
     * @param cause Underlying cause
     */
    public TronTransactionException(String message, Throwable cause) {
        super(message, cause);
        this.txHash = null;
        this.errorCode = null;
    }

    /**
     * Creates a new TronTransactionException with transaction details.
     *
     * @param message Error message
     * @param txHash Transaction hash if available
     * @param errorCode TRON error code if available
     */
    public TronTransactionException(String message, String txHash, String errorCode) {
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
     * @return TRON error code or null
     */
    public String getErrorCode() {
        return errorCode;
    }
}
