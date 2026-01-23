package io.t402.schemes.polkadot;

import java.util.regex.Pattern;

/**
 * Constants for Polkadot payment schemes.
 *
 * <p>Defines network identifiers, asset configurations, and default values
 * for Polkadot Asset Hub based payments.
 */
public final class PolkadotConstants {

    private PolkadotConstants() {
        // Utility class
    }

    // ============================================================
    // Network Identifiers (CAIP-2 format)
    // ============================================================

    /** Polkadot Asset Hub network identifier. */
    public static final String POLKADOT_ASSET_HUB = "polkadot:68d56f15f85d3136970ec16946040bc1";

    /** Westend Asset Hub (testnet) network identifier. */
    public static final String WESTEND_ASSET_HUB = "polkadot:e143f23803ac50e8f6f8e62695d1ce9e";

    // ============================================================
    // USDT Asset Configuration
    // ============================================================

    /** USDT Asset ID on Asset Hub parachains. */
    public static final int USDT_ASSET_ID = 1984;

    /** USDT decimals on Polkadot Asset Hub. */
    public static final int USDT_DECIMALS = 6;

    /** Default token symbol. */
    public static final String DEFAULT_TOKEN = "USDT";

    // ============================================================
    // Scheme Identifiers
    // ============================================================

    /** Exact-direct payment scheme identifier. */
    public static final String SCHEME_EXACT_DIRECT = "exact-direct";

    /** CAIP family pattern for Polkadot networks. */
    public static final String CAIP_FAMILY = "polkadot:*";

    // ============================================================
    // Default Values
    // ============================================================

    /** Default transaction validity duration in seconds (5 minutes). */
    public static final int DEFAULT_VALIDITY_DURATION = 300;

    // ============================================================
    // Indexer Endpoints (Subscan)
    // ============================================================

    /** Subscan indexer URL for Polkadot Asset Hub. */
    public static final String POLKADOT_ASSET_HUB_INDEXER = "https://assethub-polkadot.api.subscan.io";

    /** Subscan indexer URL for Westend Asset Hub. */
    public static final String WESTEND_ASSET_HUB_INDEXER = "https://assethub-westend.api.subscan.io";

    // ============================================================
    // Validation Patterns
    // ============================================================

    /** SS58 address regex: base58 characters, typical length 45-50. */
    public static final Pattern SS58_PATTERN = Pattern.compile("^[1-9A-HJ-NP-Za-km-z]{45,50}$");

    /** Extrinsic/block hash regex: 0x-prefixed 64 hex characters (32 bytes). */
    public static final Pattern HASH_PATTERN = Pattern.compile("^0x[a-fA-F0-9]{64}$");

    // ============================================================
    // Utility Methods
    // ============================================================

    /**
     * Gets the USDT asset ID for a given network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return USDT asset ID
     */
    public static int getUsdtAssetId(String network) {
        return USDT_ASSET_ID;
    }

    /**
     * Normalizes a network identifier to CAIP-2 format.
     *
     * @param network Network identifier
     * @return Normalized network in CAIP-2 format
     */
    public static String normalizeNetwork(String network) {
        if (network == null) {
            return POLKADOT_ASSET_HUB;
        }
        String lower = network.toLowerCase().trim();
        if (lower.equals("polkadot") || lower.equals("polkadot-asset-hub") || lower.equals("asset-hub")) {
            return POLKADOT_ASSET_HUB;
        }
        if (lower.equals("westend") || lower.equals("westend-asset-hub")) {
            return WESTEND_ASSET_HUB;
        }
        return network;
    }

    /**
     * Checks if a network identifier belongs to the Polkadot namespace.
     *
     * @param network Network identifier
     * @return true if the network starts with "polkadot:"
     */
    public static boolean isValidNetwork(String network) {
        if (network == null) {
            return false;
        }
        return network.startsWith("polkadot:");
    }

    /**
     * Checks if a network is a known supported Polkadot Asset Hub network.
     *
     * @param network Network identifier
     * @return true if network is Polkadot Asset Hub or Westend Asset Hub
     */
    public static boolean isSupportedNetwork(String network) {
        String normalized = normalizeNetwork(network);
        return POLKADOT_ASSET_HUB.equals(normalized) || WESTEND_ASSET_HUB.equals(normalized);
    }

    /**
     * Validates an SS58-encoded Polkadot address.
     *
     * <p>Performs a basic format check using regex. Does not verify the checksum.
     *
     * @param address The address to validate
     * @return true if the address matches the SS58 format
     */
    public static boolean isValidSS58Address(String address) {
        if (address == null || address.isEmpty()) {
            return false;
        }
        return SS58_PATTERN.matcher(address).matches();
    }

    /**
     * Validates a 0x-prefixed 32-byte hex hash (extrinsic or block hash).
     *
     * @param hash The hash to validate
     * @return true if the hash matches the expected format
     */
    public static boolean isValidHash(String hash) {
        if (hash == null || hash.isEmpty()) {
            return false;
        }
        return HASH_PATTERN.matcher(hash).matches();
    }

    /**
     * Creates a CAIP-19 asset identifier for a Polkadot asset.
     *
     * <p>Format: {network}/asset:{assetId}
     *
     * @param network CAIP-2 network identifier
     * @param assetId On-chain asset ID
     * @return CAIP-19 asset identifier string
     */
    public static String createAssetIdentifier(String network, int assetId) {
        return network + "/asset:" + assetId;
    }

    /**
     * Parses a CAIP-19 asset identifier to extract the asset ID.
     *
     * <p>Format: {network}/asset:{id}
     *
     * @param asset CAIP-19 asset identifier string
     * @return The asset ID, or -1 if parsing fails
     */
    public static int parseAssetIdentifier(String asset) {
        if (asset == null || asset.isEmpty()) {
            return -1;
        }
        String prefix = "/asset:";
        int idx = asset.indexOf(prefix);
        if (idx == -1) {
            return -1;
        }
        try {
            return Integer.parseInt(asset.substring(idx + prefix.length()));
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    /**
     * Gets the indexer URL for a given network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return Indexer URL
     * @throws IllegalArgumentException if network is not supported
     */
    public static String getIndexerUrl(String network) {
        String normalized = normalizeNetwork(network);
        if (POLKADOT_ASSET_HUB.equals(normalized)) {
            return POLKADOT_ASSET_HUB_INDEXER;
        }
        if (WESTEND_ASSET_HUB.equals(normalized)) {
            return WESTEND_ASSET_HUB_INDEXER;
        }
        throw new IllegalArgumentException("Unsupported Polkadot network: " + network);
    }
}
