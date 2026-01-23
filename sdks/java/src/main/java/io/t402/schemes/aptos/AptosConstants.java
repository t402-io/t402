package io.t402.schemes.aptos;

/**
 * Constants for Aptos payment schemes.
 *
 * <p>Defines network identifiers, token metadata addresses, and default values
 * for Aptos-based payments using Fungible Assets.
 */
public final class AptosConstants {

    private AptosConstants() {
        // Utility class
    }

    // ============================================================
    // Network Identifiers (CAIP-2 format)
    // ============================================================

    /** Aptos Mainnet network identifier. */
    public static final String APTOS_MAINNET = "aptos:1";

    /** Aptos Testnet network identifier. */
    public static final String APTOS_TESTNET = "aptos:2";

    /** Aptos Devnet network identifier. */
    public static final String APTOS_DEVNET = "aptos:149";

    // ============================================================
    // USDT Fungible Asset Metadata Addresses
    // ============================================================

    /**
     * USDT on Aptos Mainnet.
     * Fungible Asset metadata object address.
     */
    public static final String USDT_MAINNET_METADATA =
        "0xf73e887a8754f540ee6e1a93bdc6dde2af69fc7ca5de32013e89dd44244473cb";

    /**
     * USDC on Aptos Mainnet.
     * Fungible Asset metadata object address.
     */
    public static final String USDC_MAINNET_METADATA =
        "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b";

    // ============================================================
    // Scheme Identifiers
    // ============================================================

    /** Exact-direct payment scheme identifier. */
    public static final String SCHEME_EXACT_DIRECT = "exact-direct";

    /** CAIP family pattern for Aptos networks. */
    public static final String CAIP_FAMILY = "aptos:*";

    // ============================================================
    // Fungible Asset Transfer Function
    // ============================================================

    /** The Move function for primary fungible store transfers. */
    public static final String FA_TRANSFER_FUNCTION = "0x1::primary_fungible_store::transfer";

    // ============================================================
    // Default Values
    // ============================================================

    /** Default transaction validity duration in seconds (5 minutes). */
    public static final int DEFAULT_VALIDITY_DURATION = 300;

    /** Maximum transaction age in seconds for verification (1 hour). */
    public static final int DEFAULT_MAX_TRANSACTION_AGE = 3600;

    /** Default token symbol. */
    public static final String DEFAULT_TOKEN = "USDT";

    /** USDT decimals on Aptos. */
    public static final int USDT_DECIMALS = 6;

    // ============================================================
    // RPC Endpoints
    // ============================================================

    /** Aptos Mainnet RPC endpoint. */
    public static final String APTOS_MAINNET_RPC = "https://fullnode.mainnet.aptoslabs.com/v1";

    /** Aptos Testnet RPC endpoint. */
    public static final String APTOS_TESTNET_RPC = "https://fullnode.testnet.aptoslabs.com/v1";

    /** Aptos Devnet RPC endpoint. */
    public static final String APTOS_DEVNET_RPC = "https://fullnode.devnet.aptoslabs.com/v1";

    // ============================================================
    // Utility Methods
    // ============================================================

    /**
     * Gets the USDT metadata address for a given network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return USDT Fungible Asset metadata address
     * @throws IllegalArgumentException if network is not supported
     */
    public static String getUsdtMetadataAddress(String network) {
        String normalized = normalizeNetwork(network);
        switch (normalized) {
            case APTOS_MAINNET:
            case APTOS_TESTNET:
                return USDT_MAINNET_METADATA;
            default:
                throw new IllegalArgumentException("Unsupported Aptos network: " + network);
        }
    }

    /**
     * Gets the RPC URL for a given network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return RPC endpoint URL
     * @throws IllegalArgumentException if network is not supported
     */
    public static String getRpcUrl(String network) {
        String normalized = normalizeNetwork(network);
        switch (normalized) {
            case APTOS_MAINNET:
                return APTOS_MAINNET_RPC;
            case APTOS_TESTNET:
                return APTOS_TESTNET_RPC;
            case APTOS_DEVNET:
                return APTOS_DEVNET_RPC;
            default:
                throw new IllegalArgumentException("Unsupported Aptos network: " + network);
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
            return APTOS_MAINNET;
        }
        String lower = network.toLowerCase().trim();
        if (lower.equals("mainnet") || lower.equals("aptos-mainnet")) {
            return APTOS_MAINNET;
        }
        if (lower.equals("testnet") || lower.equals("aptos-testnet")) {
            return APTOS_TESTNET;
        }
        if (lower.equals("devnet") || lower.equals("aptos-devnet")) {
            return APTOS_DEVNET;
        }
        return network;
    }

    /**
     * Checks if a network identifier is a valid Aptos network.
     *
     * @param network Network identifier
     * @return true if valid Aptos network
     */
    public static boolean isValidNetwork(String network) {
        String normalized = normalizeNetwork(network);
        return APTOS_MAINNET.equals(normalized) ||
               APTOS_TESTNET.equals(normalized) ||
               APTOS_DEVNET.equals(normalized);
    }

    /**
     * Validates an Aptos address format.
     *
     * <p>Aptos addresses are 0x-prefixed hex strings, up to 64 hex characters.
     *
     * @param address The address to validate
     * @return true if the address format is valid
     */
    public static boolean isValidAddress(String address) {
        if (address == null || address.isEmpty()) {
            return false;
        }
        if (!address.startsWith("0x")) {
            return false;
        }
        String hexPart = address.substring(2);
        if (hexPart.isEmpty() || hexPart.length() > 64) {
            return false;
        }
        return hexPart.chars().allMatch(c ->
            (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F'));
    }

    /**
     * Validates an Aptos transaction hash format.
     *
     * <p>Transaction hashes are 0x-prefixed hex strings of exactly 64 hex characters.
     *
     * @param txHash The transaction hash to validate
     * @return true if the hash format is valid
     */
    public static boolean isValidTxHash(String txHash) {
        if (txHash == null || txHash.isEmpty()) {
            return false;
        }
        if (!txHash.startsWith("0x")) {
            return false;
        }
        String hexPart = txHash.substring(2);
        if (hexPart.length() != 64) {
            return false;
        }
        return hexPart.chars().allMatch(c ->
            (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F'));
    }

    /**
     * Normalizes an Aptos address for comparison.
     *
     * <p>Converts to lowercase and ensures 0x prefix.
     *
     * @param address The address to normalize
     * @return Normalized address string
     */
    public static String normalizeAddress(String address) {
        if (address == null || address.isEmpty()) {
            return "";
        }
        if (address.startsWith("0x")) {
            return "0x" + address.substring(2).toLowerCase();
        }
        return "0x" + address.toLowerCase();
    }

    /**
     * Compares two Aptos addresses (case-insensitive).
     *
     * @param addr1 First address
     * @param addr2 Second address
     * @return true if addresses are equivalent
     */
    public static boolean compareAddresses(String addr1, String addr2) {
        if (addr1 == null || addr2 == null || addr1.isEmpty() || addr2.isEmpty()) {
            return false;
        }
        return normalizeAddress(addr1).equals(normalizeAddress(addr2));
    }
}
