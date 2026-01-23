package io.t402.schemes.near;

/**
 * Constants for NEAR payment schemes.
 *
 * <p>Defines network identifiers, token contract addresses, and default values
 * for NEAR-based payments using NEP-141 fungible tokens.
 */
public final class NearConstants {

    private NearConstants() {
        // Utility class
    }

    // ============================================================
    // Network Identifiers (CAIP-2 format)
    // ============================================================

    /** NEAR Mainnet network identifier. */
    public static final String NEAR_MAINNET = "near:mainnet";

    /** NEAR Testnet network identifier. */
    public static final String NEAR_TESTNET = "near:testnet";

    // ============================================================
    // USDT Contract Addresses (NEP-141)
    // ============================================================

    /**
     * USDT on NEAR Mainnet.
     * NEP-141 fungible token contract.
     */
    public static final String USDT_MAINNET = "usdt.tether-token.near";

    /**
     * USDT on NEAR Testnet.
     * Test NEP-141 fungible token for development.
     */
    public static final String USDT_TESTNET = "usdt.fakes.testnet";

    // ============================================================
    // Scheme Identifiers
    // ============================================================

    /** Exact-direct payment scheme identifier. */
    public static final String SCHEME_EXACT_DIRECT = "exact-direct";

    /** CAIP family pattern for NEAR networks. */
    public static final String CAIP_FAMILY = "near:*";

    // ============================================================
    // NEP-141 Constants
    // ============================================================

    /** NEP-141 ft_transfer function name. */
    public static final String FUNCTION_FT_TRANSFER = "ft_transfer";

    /** NEP-141 ft_balance_of function name. */
    public static final String FUNCTION_FT_BALANCE_OF = "ft_balance_of";

    /** Default gas for ft_transfer (30 TGas). */
    public static final long DEFAULT_GAS = 30_000_000_000_000L;

    /** Storage deposit required (1 yoctoNEAR) for ft_transfer. */
    public static final String STORAGE_DEPOSIT = "1";

    // ============================================================
    // Default Values
    // ============================================================

    /** Default transaction validity duration in seconds (5 minutes). */
    public static final int DEFAULT_VALIDITY_DURATION = 300;

    /** Default token symbol. */
    public static final String DEFAULT_TOKEN = "USDT";

    /** USDT decimals on NEAR. */
    public static final int USDT_DECIMALS = 6;

    /** Minimum NEAR account ID length. */
    public static final int MIN_ACCOUNT_ID_LENGTH = 2;

    /** Maximum NEAR account ID length. */
    public static final int MAX_ACCOUNT_ID_LENGTH = 64;

    /** Pattern for implicit NEAR account IDs (64 hex chars). */
    public static final String IMPLICIT_ACCOUNT_PATTERN = "^[0-9a-f]{64}$";

    /** Pattern for named NEAR account IDs. */
    public static final String NAMED_ACCOUNT_PATTERN =
        "^(([a-z\\d]+[-_])*[a-z\\d]+\\.)+([a-z\\d]+[-_])*[a-z\\d]+$";

    // ============================================================
    // RPC Endpoints
    // ============================================================

    /** NEAR Mainnet RPC URL. */
    public static final String MAINNET_RPC_URL = "https://rpc.mainnet.near.org";

    /** NEAR Testnet RPC URL. */
    public static final String TESTNET_RPC_URL = "https://rpc.testnet.near.org";

    // ============================================================
    // Utility Methods
    // ============================================================

    /**
     * Gets the USDT contract address for a given network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return USDT NEP-141 contract address
     * @throws IllegalArgumentException if network is not supported
     */
    public static String getUsdtAddress(String network) {
        String normalized = normalizeNetwork(network);
        switch (normalized) {
            case NEAR_MAINNET:
                return USDT_MAINNET;
            case NEAR_TESTNET:
                return USDT_TESTNET;
            default:
                throw new IllegalArgumentException("Unsupported NEAR network: " + network);
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
            case NEAR_MAINNET:
                return MAINNET_RPC_URL;
            case NEAR_TESTNET:
                return TESTNET_RPC_URL;
            default:
                throw new IllegalArgumentException("Unsupported NEAR network: " + network);
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
            return NEAR_MAINNET;
        }
        String lower = network.toLowerCase().trim();
        if (lower.equals("mainnet") || lower.equals("near-mainnet")) {
            return NEAR_MAINNET;
        }
        if (lower.equals("testnet") || lower.equals("near-testnet")) {
            return NEAR_TESTNET;
        }
        return network;
    }

    /**
     * Checks if a network identifier is a valid NEAR network.
     *
     * @param network Network identifier
     * @return true if valid NEAR network
     */
    public static boolean isValidNetwork(String network) {
        String normalized = normalizeNetwork(network);
        return NEAR_MAINNET.equals(normalized) || NEAR_TESTNET.equals(normalized);
    }

    /**
     * Validates a NEAR account ID format.
     *
     * <p>NEAR account IDs follow these rules:
     * <ul>
     *   <li>Must be between 2 and 64 characters</li>
     *   <li>Can be implicit (64 hex chars) or named (dot-separated segments)</li>
     *   <li>Named segments are alphanumeric with optional hyphens/underscores</li>
     * </ul>
     *
     * @param accountId The NEAR account ID to validate
     * @return true if the account ID is valid
     */
    public static boolean isValidAccountId(String accountId) {
        if (accountId == null || accountId.isEmpty()) {
            return false;
        }
        if (accountId.length() < MIN_ACCOUNT_ID_LENGTH
                || accountId.length() > MAX_ACCOUNT_ID_LENGTH) {
            return false;
        }
        return accountId.matches(IMPLICIT_ACCOUNT_PATTERN)
                || accountId.matches(NAMED_ACCOUNT_PATTERN);
    }
}
