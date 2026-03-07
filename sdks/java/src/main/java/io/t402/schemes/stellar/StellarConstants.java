package io.t402.schemes.stellar;

/**
 * Constants for Stellar payment schemes.
 *
 * <p>Defines network identifiers, token addresses, and default values
 * for Stellar-based payments using Soroban smart contract transfers (SEP-41).
 */
public final class StellarConstants {

    private StellarConstants() {
        // Utility class
    }

    // ============================================================
    // Network Identifiers (CAIP-2 format)
    // ============================================================

    /** Stellar Pubnet (mainnet) network identifier. */
    public static final String STELLAR_PUBNET = "stellar:pubnet";

    /** Stellar Testnet network identifier. */
    public static final String STELLAR_TESTNET = "stellar:testnet";

    // ============================================================
    // Network Passphrases (for transaction signing)
    // ============================================================

    /** Stellar Pubnet network passphrase. */
    public static final String PUBNET_PASSPHRASE =
        "Public Global Stellar Network ; September 2015";

    /** Stellar Testnet network passphrase. */
    public static final String TESTNET_PASSPHRASE =
        "Test SDF Network ; September 2015";

    // ============================================================
    // USDC Contract Addresses (C-accounts, Soroban contracts)
    // ============================================================

    /**
     * USDC on Stellar Pubnet.
     * Soroban token contract address for USD Coin.
     */
    public static final String USDC_PUBNET =
        "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI";

    /**
     * USDC on Stellar Testnet.
     * Test token contract for development.
     */
    public static final String USDC_TESTNET =
        "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";

    // ============================================================
    // Scheme Identifiers
    // ============================================================

    /** Exact payment scheme identifier. */
    public static final String SCHEME_EXACT = "exact";

    /** CAIP family pattern for Stellar networks. */
    public static final String CAIP_FAMILY = "stellar:*";

    // ============================================================
    // Default Values
    // ============================================================

    /** Default transaction timeout in seconds. */
    public static final int DEFAULT_TIMEOUT_SECONDS = 60;

    /** Approximate ledger close time in seconds. */
    public static final int LEDGER_TIME_SECONDS = 5;

    /** Default token symbol. */
    public static final String DEFAULT_TOKEN = "USDC";

    /** USDC decimals on Stellar (7 decimals). */
    public static final int USDC_DECIMALS = 7;

    // ============================================================
    // Utility Methods
    // ============================================================

    /**
     * Gets the USDC contract address for a given network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return USDC Soroban contract address
     * @throws IllegalArgumentException if network is not supported
     */
    public static String getUsdcAddress(String network) {
        String normalized = normalizeNetwork(network);
        switch (normalized) {
            case STELLAR_PUBNET:
                return USDC_PUBNET;
            case STELLAR_TESTNET:
                return USDC_TESTNET;
            default:
                throw new IllegalArgumentException("Unsupported Stellar network: " + network);
        }
    }

    /**
     * Gets the network passphrase for transaction signing.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return Network passphrase string
     * @throws IllegalArgumentException if network is not supported
     */
    public static String getNetworkPassphrase(String network) {
        String normalized = normalizeNetwork(network);
        switch (normalized) {
            case STELLAR_PUBNET:
                return PUBNET_PASSPHRASE;
            case STELLAR_TESTNET:
                return TESTNET_PASSPHRASE;
            default:
                throw new IllegalArgumentException("Unsupported Stellar network: " + network);
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
            return STELLAR_PUBNET;
        }
        String lower = network.toLowerCase().trim();
        if (lower.equals("pubnet") || lower.equals("mainnet") || lower.equals("stellar-pubnet")) {
            return STELLAR_PUBNET;
        }
        if (lower.equals("testnet") || lower.equals("stellar-testnet")) {
            return STELLAR_TESTNET;
        }
        return network;
    }

    /**
     * Checks if a network identifier is a valid Stellar network.
     *
     * @param network Network identifier
     * @return true if valid Stellar network
     */
    public static boolean isValidNetwork(String network) {
        String normalized = normalizeNetwork(network);
        return STELLAR_PUBNET.equals(normalized) || STELLAR_TESTNET.equals(normalized);
    }

    /**
     * Calculates the max ledger for transaction validity.
     *
     * @param currentLedger Current ledger sequence number
     * @param timeoutSeconds Desired timeout in seconds
     * @return Max ledger number for the transaction
     */
    public static int calculateMaxLedger(int currentLedger, int timeoutSeconds) {
        int ledgers = (int) Math.ceil((double) timeoutSeconds / LEDGER_TIME_SECONDS);
        return currentLedger + ledgers;
    }
}
