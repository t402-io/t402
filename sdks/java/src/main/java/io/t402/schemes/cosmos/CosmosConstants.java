package io.t402.schemes.cosmos;

/**
 * Constants for Cosmos/Noble payment schemes.
 *
 * <p>Defines network identifiers, RPC/REST endpoints, token denominations,
 * and default values for Cosmos-based payments using native USDC on Noble.
 */
public final class CosmosConstants {

    private CosmosConstants() {
        // Utility class
    }

    // ============================================================
    // Network Identifiers (CAIP-2 format)
    // ============================================================

    /** Noble Mainnet network identifier. */
    public static final String NOBLE_MAINNET = "cosmos:noble-1";

    /** Noble Testnet (Grand) network identifier. */
    public static final String NOBLE_TESTNET = "cosmos:grand-1";

    // ============================================================
    // RPC Endpoints
    // ============================================================

    /** Noble Mainnet RPC URL. */
    public static final String NOBLE_MAINNET_RPC = "https://noble-rpc.polkachu.com";

    /** Noble Testnet RPC URL. */
    public static final String NOBLE_TESTNET_RPC = "https://rpc.testnet.noble.strange.love";

    // ============================================================
    // REST API Endpoints
    // ============================================================

    /** Noble Mainnet REST API URL. */
    public static final String NOBLE_MAINNET_REST = "https://noble-api.polkachu.com";

    /** Noble Testnet REST API URL. */
    public static final String NOBLE_TESTNET_REST = "https://api.testnet.noble.strange.love";

    // ============================================================
    // Token Constants
    // ============================================================

    /**
     * USDC denomination on Noble (micro USDC).
     * 1 USDC = 1,000,000 uusdc.
     */
    public static final String USDC_DENOM = "uusdc";

    /** USDC token symbol. */
    public static final String USDC_SYMBOL = "USDC";

    /** USDC decimal places (6 decimals). */
    public static final int USDC_DECIMALS = 6;

    /** Bech32 address prefix for Noble. */
    public static final String BECH32_PREFIX = "noble";

    // ============================================================
    // Scheme Identifiers
    // ============================================================

    /** Exact-direct payment scheme identifier. */
    public static final String SCHEME_EXACT_DIRECT = "exact-direct";

    /** CAIP family pattern for Cosmos networks. */
    public static final String CAIP_FAMILY = "cosmos:*";

    /** Cosmos bank MsgSend type URL. */
    public static final String MSG_TYPE_SEND = "/cosmos.bank.v1beta1.MsgSend";

    // ============================================================
    // Gas Constants
    // ============================================================

    /** Default gas limit for transactions. */
    public static final int DEFAULT_GAS_LIMIT = 200000;

    // ============================================================
    // Default Values
    // ============================================================

    /** Default transaction validity duration in seconds (5 minutes). */
    public static final int DEFAULT_VALIDITY_DURATION = 300;

    // ============================================================
    // Utility Methods
    // ============================================================

    /**
     * Gets the REST API URL for a given network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return REST API endpoint URL
     * @throws IllegalArgumentException if network is not supported
     */
    public static String getRestUrl(String network) {
        String normalized = normalizeNetwork(network);
        switch (normalized) {
            case NOBLE_MAINNET:
                return NOBLE_MAINNET_REST;
            case NOBLE_TESTNET:
                return NOBLE_TESTNET_REST;
            default:
                throw new IllegalArgumentException("Unsupported Cosmos network: " + network);
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
            case NOBLE_MAINNET:
                return NOBLE_MAINNET_RPC;
            case NOBLE_TESTNET:
                return NOBLE_TESTNET_RPC;
            default:
                throw new IllegalArgumentException("Unsupported Cosmos network: " + network);
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
            return NOBLE_MAINNET;
        }
        String lower = network.toLowerCase().trim();
        if (lower.equals("noble-1") || lower.equals("noble-mainnet") || lower.equals("noble")) {
            return NOBLE_MAINNET;
        }
        if (lower.equals("grand-1") || lower.equals("noble-testnet")) {
            return NOBLE_TESTNET;
        }
        return network;
    }

    /**
     * Checks if a network identifier is a valid Cosmos network.
     *
     * @param network Network identifier
     * @return true if valid Cosmos network
     */
    public static boolean isValidNetwork(String network) {
        String normalized = normalizeNetwork(network);
        return NOBLE_MAINNET.equals(normalized) || NOBLE_TESTNET.equals(normalized);
    }

    /**
     * Validates a Cosmos bech32 address format.
     *
     * <p>Checks that the address starts with the Noble bech32 prefix ("noble")
     * and has a reasonable length.
     *
     * @param address The address to validate
     * @return true if the address has a valid format
     */
    public static boolean isValidAddress(String address) {
        return isValidAddress(address, BECH32_PREFIX);
    }

    /**
     * Validates a Cosmos bech32 address format with a custom prefix.
     *
     * @param address The address to validate
     * @param prefix Expected bech32 prefix
     * @return true if the address has a valid format
     */
    public static boolean isValidAddress(String address, String prefix) {
        if (address == null || address.isEmpty()) {
            return false;
        }
        if (address.length() <= prefix.length()) {
            return false;
        }
        return address.startsWith(prefix);
    }

    /**
     * Gets the chain ID for a given network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return Chain ID string
     * @throws IllegalArgumentException if network is not supported
     */
    public static String getChainId(String network) {
        String normalized = normalizeNetwork(network);
        switch (normalized) {
            case NOBLE_MAINNET:
                return "noble-1";
            case NOBLE_TESTNET:
                return "grand-1";
            default:
                throw new IllegalArgumentException("Unsupported Cosmos network: " + network);
        }
    }
}
