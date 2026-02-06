package io.t402.errors;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Structured error response from the facilitator API.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiError extends RuntimeException {

    @JsonProperty("code")
    private final ErrorCode errorCode;

    @JsonProperty("message")
    private final String errorMessage;

    @JsonProperty("details")
    private final String details;

    @JsonProperty("retry")
    private final boolean retry;

    public ApiError(ErrorCode errorCode, String errorMessage) {
        this(errorCode, errorMessage, null, false);
    }

    public ApiError(ErrorCode errorCode, String errorMessage, String details, boolean retry) {
        super(formatMessage(errorCode, errorMessage, details));
        this.errorCode = errorCode;
        this.errorMessage = errorMessage;
        this.details = details;
        this.retry = retry;
    }

    public ErrorCode getErrorCode() {
        return errorCode;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public String getDetails() {
        return details;
    }

    public boolean isRetry() {
        return retry;
    }

    /** Returns the expected HTTP status code for this error. */
    public int httpStatus() {
        return errorCode.httpStatus();
    }

    /** Returns true if the client should retry this request. */
    public boolean isRetryable() {
        return retry;
    }

    /** Returns true for T402-1xxx errors. */
    public boolean isClientError() {
        return errorCode.isClientError();
    }

    /** Returns true for T402-2xxx errors. */
    public boolean isServerError() {
        return errorCode.isServerError();
    }

    private static String formatMessage(ErrorCode code, String message, String details) {
        if (details != null && !details.isEmpty()) {
            return "[" + code.getCode() + "] " + message + ": " + details;
        }
        return "[" + code.getCode() + "] " + message;
    }
}
