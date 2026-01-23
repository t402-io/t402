package io.t402.schemes.tezos;

/**
 * Exception thrown when a Tezos transaction fails.
 */
public class TezosTransactionException extends RuntimeException {

    /**
     * Creates a new TezosTransactionException with a message.
     *
     * @param message Error message
     */
    public TezosTransactionException(String message) {
        super(message);
    }

    /**
     * Creates a new TezosTransactionException with a message and cause.
     *
     * @param message Error message
     * @param cause Underlying cause
     */
    public TezosTransactionException(String message, Throwable cause) {
        super(message, cause);
    }
}
