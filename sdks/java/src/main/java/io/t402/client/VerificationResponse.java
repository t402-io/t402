package io.t402.client;

/** JSON returned by POST /verify on the facilitator. */
public class VerificationResponse {
    /** Whether the payment verification succeeded. */
    public boolean isValid;

    /** Reason for verification failure (if isValid is false). */
    public String  invalidReason;

    /** Wallet address of the payer (if verification succeeded). */
    public String  payer;
}

