package io.t402.schemes.stellar;

/**
 * Exception thrown when a Stellar transaction fails.
 */
public class StellarTransactionException extends RuntimeException {

    /**
     * Creates a new StellarTransactionException with a message.
     *
     * @param message Error message
     */
    public StellarTransactionException(String message) {
        super(message);
    }

    /**
     * Creates a new StellarTransactionException with a message and cause.
     *
     * @param message Error message
     * @param cause Underlying cause
     */
    public StellarTransactionException(String message, Throwable cause) {
        super(message, cause);
    }
}
