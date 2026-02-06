package io.t402.schemes.ton;

/**
 * Constants for TON payment schemes.
 *
 * <p>Defines network identifiers, token addresses, and default values
 * for TON-based payments.
 */
public final class TonConstants {

    private TonConstants() {
        // Utility class
    }

    // ============================================================
    // Network Identifiers (CAIP-2 format)
    // ============================================================

    /** TON Mainnet network identifier. */
    public static final String TON_MAINNET = "ton:mainnet";

    /** TON Testnet network identifier. */
    public static final String TON_TESTNET = "ton:testnet";

    // ============================================================
    // USDT Contract Addresses
    // ============================================================

    /**
     * USDT on TON Mainnet.
     * Jetton master address for Tether USD on TON.
     */
    public static final String USDT_MAINNET = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";

    /**
     * USDT on TON Testnet.
     * Test jetton for development.
     */
    public static final String USDT_TESTNET = "kQD0GKBM8ZbryVk2aESmzfU6b9b_8era_IkvBSELujFZPsyy";

    // ============================================================
    // Scheme Identifiers
    // ============================================================

    /** Exact payment scheme identifier. */
    public static final String SCHEME_EXACT = "exact";

    /** CAIP family pattern for TON networks. */
    public static final String CAIP_FAMILY = "ton:*";

    // ============================================================
    // Default Values
    // ============================================================

    /** Default transaction validity duration in seconds (5 minutes). */
    public static final int DEFAULT_VALIDITY_DURATION = 300;

    /** Default token symbol. */
    public static final String DEFAULT_TOKEN = "USDT";

    /** USDT decimals on TON. */
    public static final int USDT_DECIMALS = 6;

    // ============================================================
    // Utility Methods
    // ============================================================

    /**
     * Gets the USDT address for a given network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return USDT jetton master address
     * @throws IllegalArgumentException if network is not supported
     */
    public static String getUsdtAddress(String network) {
        String normalized = normalizeNetwork(network);
        switch (normalized) {
            case TON_MAINNET:
                return USDT_MAINNET;
            case TON_TESTNET:
                return USDT_TESTNET;
            default:
                throw new IllegalArgumentException("Unsupported TON network: " + network);
        }
    }

    /**
     * Normalizes a network identifier to CAIP-2 format.
     *
     * @param network Network identifier
     * @return Normalized network in CAIP-2 format
     */
    public static String normalizeNetwork(String network) {
        if (network == null) {
            return TON_MAINNET;
        }
        String lower = network.toLowerCase().trim();
        if (lower.equals("mainnet") || lower.equals("ton-mainnet")) {
            return TON_MAINNET;
        }
        if (lower.equals("testnet") || lower.equals("ton-testnet")) {
            return TON_TESTNET;
        }
        return network;
    }

    /**
     * Checks if a network identifier is a valid TON network.
     *
     * @param network Network identifier
     * @return true if valid TON network
     */
    public static boolean isValidNetwork(String network) {
        String normalized = normalizeNetwork(network);
        return TON_MAINNET.equals(normalized) || TON_TESTNET.equals(normalized);
    }
}
