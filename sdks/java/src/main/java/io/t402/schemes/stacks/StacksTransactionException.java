package io.t402.schemes.stacks;

/**
 * Exception thrown when a Stacks transaction fails.
 */
public class StacksTransactionException extends RuntimeException {

    /**
     * Creates a new StacksTransactionException with a message.
     *
     * @param message Error message
     */
    public StacksTransactionException(String message) {
        super(message);
    }

    /**
     * Creates a new StacksTransactionException with a message and cause.
     *
     * @param message Error message
     * @param cause Underlying cause
     */
    public StacksTransactionException(String message, Throwable cause) {
        super(message, cause);
    }
}
