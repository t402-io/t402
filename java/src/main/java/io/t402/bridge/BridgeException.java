package io.t402.bridge;

/**
 * Exception thrown by bridge operations.
 */
public class BridgeException extends Exception {

    public BridgeException(String message) {
        super(message);
    }

    public BridgeException(String message, Throwable cause) {
        super(message, cause);
    }
}
