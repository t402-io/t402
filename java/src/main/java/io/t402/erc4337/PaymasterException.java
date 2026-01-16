package io.t402.erc4337;

/**
 * Exception thrown by paymaster operations.
 */
public class PaymasterException extends Exception {

    public PaymasterException(String message) {
        super(message);
    }

    public PaymasterException(String message, Throwable cause) {
        super(message, cause);
    }
}
