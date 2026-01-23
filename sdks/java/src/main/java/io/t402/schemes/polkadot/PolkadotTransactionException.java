package io.t402.schemes.polkadot;

/**
 * Exception thrown when a Polkadot transaction fails.
 */
public class PolkadotTransactionException extends RuntimeException {

    /**
     * Creates a new PolkadotTransactionException with a message.
     *
     * @param message Error message
     */
    public PolkadotTransactionException(String message) {
        super(message);
    }

    /**
     * Creates a new PolkadotTransactionException with a message and cause.
     *
     * @param message Error message
     * @param cause Underlying cause
     */
    public PolkadotTransactionException(String message, Throwable cause) {
        super(message, cause);
    }
}
