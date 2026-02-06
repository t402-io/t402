package io.t402.errors;

/**
 * Standardized T402 error codes returned by the facilitator API.
 * Error codes follow the format T402-XYYY where X is the category (1-8)
 * and YYY is the specific error within that category.
 */
public enum ErrorCode {
    // Client Errors (T402-1xxx): Invalid input, malformed requests
    INVALID_REQUEST("T402-1001"),
    MISSING_PAYLOAD("T402-1002"),
    MISSING_REQUIREMENTS("T402-1003"),
    INVALID_PAYLOAD("T402-1004"),
    INVALID_REQUIREMENTS("T402-1005"),
    INVALID_SIGNATURE("T402-1006"),
    INVALID_NETWORK("T402-1007"),
    INVALID_SCHEME("T402-1008"),
    INVALID_AMOUNT("T402-1009"),
    INVALID_ADDRESS("T402-1010"),
    EXPIRED_PAYMENT("T402-1011"),
    INVALID_NONCE("T402-1012"),
    INSUFFICIENT_AMOUNT("T402-1013"),
    INVALID_IDEMPOTENCY_KEY("T402-1014"),
    SIGNATURE_EXPIRED("T402-1015"),

    // Server Errors (T402-2xxx): Internal failures, dependency issues
    INTERNAL("T402-2001"),
    DATABASE_UNAVAILABLE("T402-2002"),
    CACHE_UNAVAILABLE("T402-2003"),
    RPC_UNAVAILABLE("T402-2004"),
    RATE_LIMITED("T402-2005"),
    SERVICE_UNAVAILABLE("T402-2006"),

    // Facilitator Errors (T402-3xxx): Verification and settlement failures
    VERIFICATION_FAILED("T402-3001"),
    SETTLEMENT_FAILED("T402-3002"),
    INSUFFICIENT_BALANCE("T402-3003"),
    ALLOWANCE_INSUFFICIENT("T402-3004"),
    PAYMENT_MISMATCH("T402-3005"),
    DUPLICATE_PAYMENT("T402-3006"),
    SETTLEMENT_PENDING("T402-3007"),
    SETTLEMENT_TIMEOUT("T402-3008"),
    NONCE_REPLAY("T402-3009"),
    IDEMPOTENCY_CONFLICT("T402-3010"),
    IDEMPOTENCY_UNAVAILABLE("T402-3011"),
    PREVIOUS_REQUEST_FAILED("T402-3012"),
    REQUEST_IN_PROGRESS("T402-3013"),

    // Chain-Specific Errors (T402-4xxx): Network and transaction issues
    CHAIN_UNAVAILABLE("T402-4001"),
    TRANSACTION_FAILED("T402-4002"),
    TRANSACTION_REVERTED("T402-4003"),
    GAS_ESTIMATION_FAILED("T402-4004"),
    NONCE_CONFLICT("T402-4005"),
    CHAIN_CONGESTED("T402-4006"),
    CONTRACT_ERROR("T402-4007"),

    // Bridge Errors (T402-5xxx): Cross-chain operation failures
    BRIDGE_UNAVAILABLE("T402-5001"),
    BRIDGE_QUOTE_FAILED("T402-5002"),
    BRIDGE_TRANSFER_FAILED("T402-5003"),
    BRIDGE_TIMEOUT("T402-5004"),
    UNSUPPORTED_ROUTE("T402-5005"),

    // Streaming Errors (T402-6xxx): Payment stream issues
    STREAM_NOT_FOUND("T402-6001"),
    STREAM_ALREADY_CLOSED("T402-6002"),
    STREAM_ALREADY_PAUSED("T402-6003"),
    STREAM_NOT_PAUSED("T402-6004"),
    STREAM_AMOUNT_EXCEEDED("T402-6005"),
    STREAM_EXPIRED("T402-6006"),
    STREAM_INVALID_STATE("T402-6007"),
    STREAM_RATE_LIMITED("T402-6008"),

    // Intent Errors (T402-7xxx): Payment intent issues
    INTENT_NOT_FOUND("T402-7001"),
    INTENT_ALREADY_EXECUTED("T402-7002"),
    INTENT_CANCELLED("T402-7003"),
    INTENT_EXPIRED("T402-7004"),
    NO_ROUTES_AVAILABLE("T402-7005"),
    ROUTE_EXPIRED("T402-7006"),
    ROUTE_NOT_SELECTED("T402-7007"),
    INTENT_INVALID_STATE("T402-7008"),

    // Discovery Errors (T402-8xxx): Resource marketplace issues
    RESOURCE_NOT_FOUND("T402-8001"),
    RESOURCE_ALREADY_EXISTS("T402-8002"),
    INVALID_PARAMETERS("T402-8003"),
    NOT_AUTHORIZED("T402-8004");

    private final String code;

    ErrorCode(String code) {
        this.code = code;
    }

    /** Returns the string code (e.g., "T402-1001"). */
    public String getCode() {
        return code;
    }

    /** Returns the category digit (1-8). */
    public char getCategory() {
        return code.charAt(5);
    }

    /** Returns true for T402-1xxx errors. */
    public boolean isClientError() {
        return getCategory() == '1';
    }

    /** Returns true for T402-2xxx errors. */
    public boolean isServerError() {
        return getCategory() == '2';
    }

    /** Returns true for T402-3xxx errors. */
    public boolean isFacilitatorError() {
        return getCategory() == '3';
    }

    /** Returns true for T402-4xxx errors. */
    public boolean isChainError() {
        return getCategory() == '4';
    }

    /** Returns true for T402-5xxx errors. */
    public boolean isBridgeError() {
        return getCategory() == '5';
    }

    /** Returns the expected HTTP status code for this error. */
    public int httpStatus() {
        switch (getCategory()) {
            case '1': return 400;
            case '2': return this == RATE_LIMITED ? 429 : 500;
            case '3':
                if (this == VERIFICATION_FAILED || this == PAYMENT_MISMATCH) return 422;
                return 500;
            case '4': return 502;
            case '5': return 502;
            case '6': return this == STREAM_NOT_FOUND ? 404 : 400;
            case '7': return this == INTENT_NOT_FOUND ? 404 : 400;
            case '8':
                if (this == RESOURCE_NOT_FOUND) return 404;
                if (this == RESOURCE_ALREADY_EXISTS) return 409;
                if (this == NOT_AUTHORIZED) return 403;
                return 400;
            default: return 500;
        }
    }

    /** Looks up an ErrorCode by its string code. Returns null if not found. */
    public static ErrorCode fromCode(String code) {
        for (ErrorCode ec : values()) {
            if (ec.code.equals(code)) {
                return ec;
            }
        }
        return null;
    }

    @Override
    public String toString() {
        return code;
    }
}
