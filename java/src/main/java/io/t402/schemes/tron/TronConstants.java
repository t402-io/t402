package io.t402.schemes.tron;

/**
 * Constants for TRON payment schemes.
 *
 * <p>Defines network identifiers, token addresses, and default values
 * for TRON-based payments.
 */
public final class TronConstants {

    private TronConstants() {
        // Utility class
    }

    // ============================================================
    // Network Identifiers (CAIP-2 format)
    // ============================================================

    /** TRON Mainnet network identifier. */
    public static final String TRON_MAINNET = "tron:mainnet";

    /** TRON Nile Testnet network identifier. */
    public static final String TRON_NILE = "tron:nile";

    /** TRON Shasta Testnet network identifier. */
    public static final String TRON_SHASTA = "tron:shasta";

    // ============================================================
    // USDT Contract Addresses
    // ============================================================

    /**
     * USDT on TRON Mainnet.
     * TRC-20 token contract address.
     */
    public static final String USDT_MAINNET = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

    /**
     * USDT on TRON Nile Testnet.
     * Test TRC-20 token for development.
     */
    public static final String USDT_NILE = "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf";

    /**
     * USDT on TRON Shasta Testnet.
     * Test TRC-20 token for development.
     */
    public static final String USDT_SHASTA = "TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs";

    // ============================================================
    // Scheme Identifiers
    // ============================================================

    /** Exact payment scheme identifier. */
    public static final String SCHEME_EXACT = "exact";

    /** CAIP family pattern for TRON networks. */
    public static final String CAIP_FAMILY = "tron:*";

    // ============================================================
    // Default Values
    // ============================================================

    /** Default transaction validity duration in seconds (5 minutes). */
    public static final int DEFAULT_VALIDITY_DURATION = 300;

    /** Default token symbol. */
    public static final String DEFAULT_TOKEN = "USDT";

    /** USDT decimals on TRON. */
    public static final int USDT_DECIMALS = 6;

    // ============================================================
    // Utility Methods
    // ============================================================

    /**
     * Gets the USDT address for a given network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return USDT TRC-20 contract address
     * @throws IllegalArgumentException if network is not supported
     */
    public static String getUsdtAddress(String network) {
        String normalized = normalizeNetwork(network);
        switch (normalized) {
            case TRON_MAINNET:
                return USDT_MAINNET;
            case TRON_NILE:
                return USDT_NILE;
            case TRON_SHASTA:
                return USDT_SHASTA;
            default:
                throw new IllegalArgumentException("Unsupported TRON network: " + network);
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
            return TRON_MAINNET;
        }
        String lower = network.toLowerCase().trim();
        if (lower.equals("mainnet") || lower.equals("tron-mainnet")) {
            return TRON_MAINNET;
        }
        if (lower.equals("nile") || lower.equals("tron-nile")) {
            return TRON_NILE;
        }
        if (lower.equals("shasta") || lower.equals("tron-shasta")) {
            return TRON_SHASTA;
        }
        return network;
    }

    /**
     * Checks if a network identifier is a valid TRON network.
     *
     * @param network Network identifier
     * @return true if valid TRON network
     */
    public static boolean isValidNetwork(String network) {
        String normalized = normalizeNetwork(network);
        return TRON_MAINNET.equals(normalized) ||
               TRON_NILE.equals(normalized) ||
               TRON_SHASTA.equals(normalized);
    }
}
