package io.t402.schemes.upto;

import java.util.List;

/**
 * Constants for the Up-To payment scheme.
 */
public final class UptoConstants {

    private UptoConstants() {}

    /** The scheme identifier for upto payments. */
    public static final String SCHEME = "upto";

    /** Default minimum settlement amount (prevents dust payments). */
    public static final String DEFAULT_MIN_AMOUNT = "1000";

    /** Default maximum timeout in seconds (5 minutes). */
    public static final int DEFAULT_MAX_TIMEOUT_SECONDS = 300;

    /** Supported billing unit types. */
    public static final List<String> SUPPORTED_UNITS = List.of(
        "token",
        "request",
        "second",
        "minute",
        "byte",
        "kb",
        "mb"
    );

    /**
     * Checks if the given unit is a supported billing unit.
     *
     * @param unit the unit to check
     * @return true if the unit is supported
     */
    public static boolean isValidUnit(String unit) {
        return SUPPORTED_UNITS.contains(unit);
    }
}
