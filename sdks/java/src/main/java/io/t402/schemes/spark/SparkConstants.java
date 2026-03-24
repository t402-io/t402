package io.t402.schemes.spark;

import java.util.Set;

/**
 * Constants for Spark (Bitcoin L2) payment schemes.
 *
 * <p>Defines network identifiers and payment types for Spark transfers
 * and Lightning Network payments routed through Spark.
 */
public final class SparkConstants {

    private SparkConstants() {
        // Utility class
    }

    // ============================================================
    // Scheme Identifiers
    // ============================================================

    /** Exact payment scheme identifier. */
    public static final String SCHEME_EXACT = "exact";

    /** CAIP family pattern for Spark networks. */
    public static final String CAIP_FAMILY = "spark:*";

    // ============================================================
    // Network Identifiers (CAIP-2 format)
    // ============================================================

    /** Spark mainnet CAIP-2 identifier. */
    public static final String SPARK_MAINNET = "spark:mainnet";

    /** Spark testnet CAIP-2 identifier. */
    public static final String SPARK_TESTNET = "spark:testnet";

    // ============================================================
    // Payment Types
    // ============================================================

    /** Direct Spark transfer payment type. */
    public static final String PAYMENT_TYPE_SPARK = "spark";

    /** Lightning Network payment routed through Spark. */
    public static final String PAYMENT_TYPE_LIGHTNING = "lightning";

    // ============================================================
    // Network Sets
    // ============================================================

    /** All supported Spark networks. */
    public static final Set<String> SPARK_NETWORKS = Set.of(SPARK_MAINNET, SPARK_TESTNET);

    // ============================================================
    // Utility Methods
    // ============================================================

    /**
     * Checks if a network identifier is a Spark network.
     *
     * @param network Network identifier
     * @return true if the network starts with "spark:"
     */
    public static boolean isSparkNetwork(String network) {
        return network != null && network.startsWith("spark:");
    }

    /**
     * Checks if a network is a known supported Spark network.
     *
     * @param network Network identifier
     * @return true if the network is in the supported set
     */
    public static boolean isSupportedNetwork(String network) {
        return SPARK_NETWORKS.contains(network);
    }
}
