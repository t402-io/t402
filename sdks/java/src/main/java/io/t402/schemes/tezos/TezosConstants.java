package io.t402.schemes.tezos;

/**
 * Constants for Tezos payment schemes.
 *
 * <p>Defines network identifiers, token addresses, and default values
 * for Tezos-based FA2 payments.
 */
public final class TezosConstants {

    private TezosConstants() {
        // Utility class
    }

    // ============================================================
    // Network Identifiers (CAIP-2 format)
    // ============================================================

    /** Tezos Mainnet network identifier (derived from genesis block hash prefix). */
    public static final String TEZOS_MAINNET = "tezos:NetXdQprcVkpaWU";

    /** Tezos Ghostnet (testnet) network identifier. */
    public static final String TEZOS_GHOSTNET = "tezos:NetXnHfVqm9iesp";

    // ============================================================
    // USDT Contract Addresses (FA2 Token Standard - TZIP-12)
    // ============================================================

    /**
     * USDt on Tezos Mainnet.
     * FA2 contract address for Tether USD.
     */
    public static final String USDT_MAINNET_CONTRACT = "KT1XnTn74bUtxHfDtBmm2bGZAQfhPbvKWR8o";

    /** Token ID for USDt within the FA2 contract. */
    public static final int USDT_MAINNET_TOKEN_ID = 0;

    // ============================================================
    // Scheme Identifiers
    // ============================================================

    /** Exact-direct payment scheme identifier. */
    public static final String SCHEME_EXACT_DIRECT = "exact-direct";

    /** CAIP family pattern for Tezos networks. */
    public static final String CAIP_FAMILY = "tezos:*";

    /** FA2 transfer entrypoint name. */
    public static final String FA2_TRANSFER_ENTRYPOINT = "transfer";

    // ============================================================
    // Default Values
    // ============================================================

    /** Default transaction validity duration in seconds (5 minutes). */
    public static final int DEFAULT_VALIDITY_DURATION = 300;

    /** Default token symbol. */
    public static final String DEFAULT_TOKEN = "USDt";

    /** USDT decimals on Tezos. */
    public static final int USDT_DECIMALS = 6;

    /** Tezos address length (tz1/tz2/tz3/KT1 addresses). */
    public static final int ADDRESS_LENGTH = 36;

    /** Tezos operation hash length (starts with 'o'). */
    public static final int OP_HASH_LENGTH = 51;

    // ============================================================
    // Indexer Endpoints (TzKT)
    // ============================================================

    /** TzKT indexer URL for Tezos Mainnet. */
    public static final String MAINNET_INDEXER = "https://api.tzkt.io";

    /** TzKT indexer URL for Tezos Ghostnet. */
    public static final String GHOSTNET_INDEXER = "https://api.ghostnet.tzkt.io";

    // ============================================================
    // Valid Address Prefixes
    // ============================================================

    /** Valid Tezos address prefixes. */
    public static final String[] VALID_ADDRESS_PREFIXES = {"tz1", "tz2", "tz3", "KT1"};

    /** Base58 character set (no 0, O, I, l). */
    public static final String BASE58_CHARS =
        "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

    // ============================================================
    // Utility Methods
    // ============================================================

    /**
     * Gets the USDT contract address for a given network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return USDT FA2 contract address
     * @throws IllegalArgumentException if network is not supported
     */
    public static String getUsdtContract(String network) {
        String normalized = normalizeNetwork(network);
        if (TEZOS_MAINNET.equals(normalized)) {
            return USDT_MAINNET_CONTRACT;
        }
        throw new IllegalArgumentException("Unsupported Tezos network for USDT: " + network);
    }

    /**
     * Gets the USDT token ID for a given network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return Token ID within the FA2 contract
     */
    public static int getUsdtTokenId(String network) {
        return USDT_MAINNET_TOKEN_ID;
    }

    /**
     * Normalizes a network identifier to CAIP-2 format.
     *
     * @param network Network identifier
     * @return Normalized network in CAIP-2 format
     */
    public static String normalizeNetwork(String network) {
        if (network == null) {
            return TEZOS_MAINNET;
        }
        String lower = network.toLowerCase().trim();
        if (lower.equals("mainnet") || lower.equals("tezos-mainnet")) {
            return TEZOS_MAINNET;
        }
        if (lower.equals("ghostnet") || lower.equals("tezos-ghostnet") || lower.equals("testnet")) {
            return TEZOS_GHOSTNET;
        }
        return network;
    }

    /**
     * Checks if a network identifier is a valid Tezos network.
     *
     * @param network Network identifier
     * @return true if valid Tezos network
     */
    public static boolean isValidNetwork(String network) {
        if (network == null) {
            return false;
        }
        return network.startsWith("tezos:");
    }

    /**
     * Checks if a network is a known supported Tezos network.
     *
     * @param network Network identifier
     * @return true if network is mainnet or ghostnet
     */
    public static boolean isSupportedNetwork(String network) {
        String normalized = normalizeNetwork(network);
        return TEZOS_MAINNET.equals(normalized) || TEZOS_GHOSTNET.equals(normalized);
    }

    /**
     * Validates a Tezos address format.
     *
     * <p>Valid addresses start with tz1, tz2, tz3, or KT1 and are 36 characters long.
     * All characters must be valid Base58 characters.
     *
     * @param address The address to validate
     * @return true if the address format is valid
     */
    public static boolean isValidAddress(String address) {
        if (address == null || address.isEmpty()) {
            return false;
        }
        boolean hasValidPrefix = false;
        for (String prefix : VALID_ADDRESS_PREFIXES) {
            if (address.startsWith(prefix)) {
                hasValidPrefix = true;
                break;
            }
        }
        if (!hasValidPrefix) {
            return false;
        }
        if (address.length() != ADDRESS_LENGTH) {
            return false;
        }
        for (char c : address.toCharArray()) {
            if (BASE58_CHARS.indexOf(c) < 0) {
                return false;
            }
        }
        return true;
    }

    /**
     * Validates a Tezos operation hash format.
     *
     * <p>Operation hashes start with 'o' and are 51 characters of Base58.
     *
     * @param opHash The operation hash to validate
     * @return true if the operation hash format is valid
     */
    public static boolean isValidOperationHash(String opHash) {
        if (opHash == null || opHash.isEmpty()) {
            return false;
        }
        if (!opHash.startsWith("o")) {
            return false;
        }
        if (opHash.length() != OP_HASH_LENGTH) {
            return false;
        }
        for (char c : opHash.toCharArray()) {
            if (BASE58_CHARS.indexOf(c) < 0) {
                return false;
            }
        }
        return true;
    }

    /**
     * Creates a CAIP-19 asset identifier for a Tezos FA2 token.
     *
     * <p>Format: tezos:{chainRef}/fa2:{contractAddress}/{tokenId}
     *
     * @param network CAIP-2 network identifier
     * @param contractAddress FA2 contract address
     * @param tokenId Token ID within the FA2 contract
     * @return CAIP-19 asset identifier string
     */
    public static String createAssetIdentifier(String network, String contractAddress, int tokenId) {
        return network + "/fa2:" + contractAddress + "/" + tokenId;
    }
}
