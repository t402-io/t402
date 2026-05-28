package io.t402.extensions.dispute;

/** Result of validating an incoming SignedResolution. */
public record ResolutionValidation(boolean valid, String error, String detail) {

    public static ResolutionValidation ok() {
        return new ResolutionValidation(true, "", "");
    }

    public static ResolutionValidation fail(String error, String detail) {
        return new ResolutionValidation(false, error, detail);
    }

    public static ResolutionValidation fail(String error) {
        return new ResolutionValidation(false, error, "");
    }
}
