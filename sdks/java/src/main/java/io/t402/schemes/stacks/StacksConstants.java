package io.t402.schemes.stacks;

import java.util.regex.Pattern;

/**
 * Constants for Stacks payment schemes.
 *
 * <p>Defines network identifiers, token configurations, and default values
 * for Stacks (Bitcoin L2) based payments using SIP-010 tokens.
 */
public final class StacksConstants {

    private StacksConstants() {
        // Utility class
    }

    // ============================================================
    // Network Identifiers (CAIP-2 format)
    // ============================================================

    /** CAIP-2 namespace for Stacks networks. */
    public static final String CAIP2_NAMESPACE = "stacks";

    /** CAIP family pattern for Stacks networks. */
    public static final String CAIP_FAMILY = "stacks:*";

    /** Stacks Mainnet network identifier (chain ID: 1). */
    public static final String MAINNET_CAIP2 = "stacks:1";

    /** Stacks Testnet network identifier (chain ID: 2147483648). */
    public static final String TESTNET_CAIP2 = "stacks:2147483648";

    // ============================================================
    // Scheme Identifiers
    // ============================================================

    /** Exact-direct payment scheme identifier. */
    public static final String SCHEME_EXACT_DIRECT = "exact-direct";

    // ============================================================
    // sUSDC Token Configuration (SIP-010)
    // ============================================================

    /** sUSDC contract address on Stacks Mainnet. */
    public static final String MAINNET_SUSDC_CONTRACT =
        "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-susdc";

    /** sUSDC contract address on Stacks Testnet. */
    public static final String TESTNET_SUSDC_CONTRACT =
        "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.token-susdc";

    /** sUSDC token decimals. */
    public static final int SUSDC_DECIMALS = 6;

    /** sUSDC token symbol. */
    public static final String SUSDC_SYMBOL = "sUSDC";

    // ============================================================
    // API Endpoints (Hiro API)
    // ============================================================

    /** Hiro API URL for Stacks Mainnet. */
    public static final String MAINNET_API_URL = "https://api.mainnet.hiro.so";

    /** Hiro API URL for Stacks Testnet. */
    public static final String TESTNET_API_URL = "https://api.testnet.hiro.so";

    // ============================================================
    // Default Values
    // ============================================================

    /** Default transaction validity duration in seconds (5 minutes). */
    public static final int DEFAULT_VALIDITY_DURATION = 300;

    /** Default maximum transaction age for verification in seconds (1 hour). */
    public static final int DEFAULT_MAX_TRANSACTION_AGE = 3600;

    // ============================================================
    // Validation Patterns
    // ============================================================

    /** Stacks principal address pattern: SP/ST prefix + base58 characters. */
    public static final Pattern PRINCIPAL_PATTERN =
        Pattern.compile("^(SP|ST)[0-9A-Z]{33,40}(\\.[a-zA-Z][a-zA-Z0-9_-]*)?$");

    /** Stacks transaction ID pattern: 0x-prefixed 64 hex characters. */
    public static final Pattern TX_ID_PATTERN =
        Pattern.compile("^0x[a-fA-F0-9]{64}$");

    // ============================================================
    // Utility Methods
    // ============================================================

    /**
     * Checks if a network identifier belongs to the Stacks namespace.
     *
     * @param network Network identifier
     * @return true if the network starts with "stacks:"
     */
    public static boolean isStacksNetwork(String network) {
        if (network == null) {
            return false;
        }
        return network.startsWith(CAIP2_NAMESPACE + ":");
    }

    /**
     * Checks if a network is a known supported Stacks network.
     *
     * @param network Network identifier
     * @return true if network is Stacks Mainnet or Testnet
     */
    public static boolean isSupportedNetwork(String network) {
        return MAINNET_CAIP2.equals(network) || TESTNET_CAIP2.equals(network);
    }

    /**
     * Validates a Stacks principal address (standard or contract principal).
     *
     * <p>Standard principal: SP/ST + base58 characters (33-40 chars)
     * <p>Contract principal: standard principal + "." + contract name
     *
     * @param address The address to validate
     * @return true if the address matches the Stacks principal format
     */
    public static boolean isValidPrincipal(String address) {
        if (address == null || address.isEmpty()) {
            return false;
        }
        return PRINCIPAL_PATTERN.matcher(address).matches();
    }

    /**
     * Validates a Stacks transaction ID (0x-prefixed 64 hex characters).
     *
     * @param txId The transaction ID to validate
     * @return true if the txId matches the expected format
     */
    public static boolean isValidTxId(String txId) {
        if (txId == null || txId.isEmpty()) {
            return false;
        }
        return TX_ID_PATTERN.matcher(txId).matches();
    }

    /**
     * Gets the default sUSDC contract address for a given network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return The sUSDC contract address for the network
     * @throws IllegalArgumentException if network is not supported
     */
    public static String getDefaultContract(String network) {
        if (MAINNET_CAIP2.equals(network)) {
            return MAINNET_SUSDC_CONTRACT;
        }
        if (TESTNET_CAIP2.equals(network)) {
            return TESTNET_SUSDC_CONTRACT;
        }
        throw new IllegalArgumentException("Unsupported Stacks network: " + network);
    }

    /**
     * Gets the Hiro API URL for a given network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return Hiro API URL
     * @throws IllegalArgumentException if network is not supported
     */
    public static String getApiUrl(String network) {
        if (MAINNET_CAIP2.equals(network)) {
            return MAINNET_API_URL;
        }
        if (TESTNET_CAIP2.equals(network)) {
            return TESTNET_API_URL;
        }
        throw new IllegalArgumentException("Unsupported Stacks network: " + network);
    }

    /**
     * Normalizes a network identifier to CAIP-2 format.
     *
     * @param network Network identifier
     * @return Normalized network in CAIP-2 format
     */
    public static String normalizeNetwork(String network) {
        if (network == null) {
            return MAINNET_CAIP2;
        }
        String lower = network.toLowerCase().trim();
        if (lower.equals("stacks") || lower.equals("mainnet") || lower.equals("stacks-mainnet")) {
            return MAINNET_CAIP2;
        }
        if (lower.equals("testnet") || lower.equals("stacks-testnet")) {
            return TESTNET_CAIP2;
        }
        return network;
    }

    /**
     * Compares two Stacks principal addresses case-insensitively.
     *
     * @param a First principal address
     * @param b Second principal address
     * @return true if the addresses are equivalent
     */
    public static boolean comparePrincipals(String a, String b) {
        if (a == null || b == null) {
            return false;
        }
        return a.equalsIgnoreCase(b);
    }

    /**
     * Checks if a network is testnet.
     *
     * @param network Network identifier
     * @return true if the network is Stacks Testnet
     */
    public static boolean isTestnet(String network) {
        return TESTNET_CAIP2.equals(network);
    }

    /**
     * Gets the address prefix for a given network.
     *
     * @param network Network identifier
     * @return "SP" for mainnet, "ST" for testnet
     */
    public static String getAddressPrefix(String network) {
        return isTestnet(network) ? "ST" : "SP";
    }
}
