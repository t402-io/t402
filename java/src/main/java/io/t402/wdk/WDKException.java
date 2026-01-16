package io.t402.wdk;

/**
 * Exception thrown by WDK operations.
 */
public class WDKException extends Exception {

    private final WDKErrorCode code;

    public WDKException(WDKErrorCode code, String message) {
        super(message);
        this.code = code;
    }

    public WDKException(WDKErrorCode code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public WDKErrorCode getCode() {
        return code;
    }

    /**
     * Error codes for WDK operations.
     */
    public enum WDKErrorCode {
        /** WDK not initialized. */
        WDK_NOT_INITIALIZED,
        /** Invalid seed phrase. */
        INVALID_SEED_PHRASE,
        /** Signer not initialized. */
        SIGNER_NOT_INITIALIZED,
        /** Chain not configured. */
        CHAIN_NOT_CONFIGURED,
        /** RPC error. */
        RPC_ERROR,
        /** Signing failed. */
        SIGNING_FAILED,
        /** Balance lookup failed. */
        BALANCE_ERROR,
        /** Transaction failed. */
        TRANSACTION_FAILED,
        /** Bridge error. */
        BRIDGE_ERROR,
        /** Timeout. */
        TIMEOUT,
        /** Unknown error. */
        UNKNOWN
    }
}
