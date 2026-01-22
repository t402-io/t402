package io.t402.schemes.svm;

/**
 * Exception thrown when an SVM transaction operation fails.
 */
public class SvmTransactionException extends RuntimeException {

    /**
     * Creates a new SvmTransactionException with a message.
     *
     * @param message the error message
     */
    public SvmTransactionException(String message) {
        super(message);
    }

    /**
     * Creates a new SvmTransactionException with a message and cause.
     *
     * @param message the error message
     * @param cause the underlying cause
     */
    public SvmTransactionException(String message, Throwable cause) {
        super(message, cause);
    }
}
