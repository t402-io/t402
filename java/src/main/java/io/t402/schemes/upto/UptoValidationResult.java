package io.t402.schemes.upto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Result of validating an Up-To payment.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UptoValidationResult {

    /** Whether the payment is valid. */
    @JsonProperty("isValid")
    public boolean isValid;

    /** Reason why the payment is invalid (if applicable). */
    @JsonProperty("invalidReason")
    public String invalidReason;

    /** Validated maximum amount. */
    @JsonProperty("validatedMaxAmount")
    public String validatedMaxAmount;

    /** Address of the payer. */
    public String payer;

    /** Expiration timestamp (Unix seconds). */
    @JsonProperty("expiresAt")
    public Long expiresAt;

    /** Default constructor for Jackson. */
    public UptoValidationResult() {}

    /**
     * Creates a valid payment result.
     *
     * @param validatedMaxAmount the validated maximum amount
     * @param payer the payer address
     * @param expiresAt expiration timestamp
     * @return a new valid result
     */
    public static UptoValidationResult valid(String validatedMaxAmount, String payer, long expiresAt) {
        UptoValidationResult result = new UptoValidationResult();
        result.isValid = true;
        result.validatedMaxAmount = validatedMaxAmount;
        result.payer = payer;
        result.expiresAt = expiresAt;
        return result;
    }

    /**
     * Creates an invalid payment result.
     *
     * @param reason the reason for invalidity
     * @return a new invalid result
     */
    public static UptoValidationResult invalid(String reason) {
        UptoValidationResult result = new UptoValidationResult();
        result.isValid = false;
        result.invalidReason = reason;
        return result;
    }
}
