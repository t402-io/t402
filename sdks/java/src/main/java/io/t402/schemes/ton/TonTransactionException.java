package io.t402.schemes.ton;

/**
 * Exception thrown when a TON transaction fails.
 */
public class TonTransactionException extends RuntimeException {

    /**
     * Creates a new TonTransactionException with a message.
     *
     * @param message Error message
     */
    public TonTransactionException(String message) {
        super(message);
    }

    /**
     * Creates a new TonTransactionException with a message and cause.
     *
     * @param message Error message
     * @param cause Underlying cause
     */
    public TonTransactionException(String message, Throwable cause) {
        super(message, cause);
    }
}
