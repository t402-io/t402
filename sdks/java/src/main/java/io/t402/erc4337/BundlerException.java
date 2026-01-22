package io.t402.erc4337;

/**
 * Exception thrown by bundler operations.
 */
public class BundlerException extends Exception {

    public BundlerException(String message) {
        super(message);
    }

    public BundlerException(String message, Throwable cause) {
        super(message, cause);
    }
}
