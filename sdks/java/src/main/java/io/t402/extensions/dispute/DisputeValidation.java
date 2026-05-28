package io.t402.extensions.dispute;

/** Result of validating an incoming SignedDispute. */
public record DisputeValidation(boolean valid, String error, String detail) {

    public static DisputeValidation ok() {
        return new DisputeValidation(true, "", "");
    }

    public static DisputeValidation fail(String error, String detail) {
        return new DisputeValidation(false, error, detail);
    }

    public static DisputeValidation fail(String error) {
        return new DisputeValidation(false, error, "");
    }
}
