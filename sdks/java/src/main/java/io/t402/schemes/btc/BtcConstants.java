package io.t402.schemes.btc;

import java.util.Set;

/**
 * Constants for Bitcoin and Lightning Network payment schemes.
 *
 * <p>Defines network identifiers, address validation helpers, and default values
 * for BTC on-chain (PSBT) and Lightning (BOLT11) payments.
 */
public final class BtcConstants {

    private BtcConstants() {
        // Utility class
    }

    // ============================================================
    // Scheme Identifiers
    // ============================================================

    /** Exact payment scheme identifier. */
    public static final String SCHEME_EXACT = "exact";

    /** CAIP family pattern for Bitcoin on-chain networks. */
    public static final String CAIP_FAMILY_BTC = "bip122:*";

    /** CAIP family pattern for Lightning networks. */
    public static final String CAIP_FAMILY_LIGHTNING = "lightning:*";

    // ============================================================
    // Network Identifiers (CAIP-2 format, BIP-122 genesis block hashes)
    // ============================================================

    /** Bitcoin mainnet CAIP-2 identifier. */
    public static final String BTC_MAINNET = "bip122:000000000019d6689c085ae165831e93";

    /** Bitcoin testnet3 CAIP-2 identifier. */
    public static final String BTC_TESTNET = "bip122:000000000933ea01ad0ee984209779ba";

    /** Lightning Network mainnet CAIP-2 identifier. */
    public static final String LIGHTNING_MAINNET = "lightning:mainnet";

    /** Lightning Network testnet CAIP-2 identifier. */
    public static final String LIGHTNING_TESTNET = "lightning:testnet";

    // ============================================================
    // Bitcoin Constants
    // ============================================================

    /** Dust limit in satoshis — minimum viable output value. */
    public static final long DUST_LIMIT = 546;

    /** Number of satoshis in one bitcoin. */
    public static final long SATS_PER_BTC = 100_000_000L;

    /** Default token symbol. */
    public static final String DEFAULT_ASSET = "BTC";

    /** BTC decimals. */
    public static final int BTC_DECIMALS = 8;

    /** Default transaction validity duration in seconds (1 hour). */
    public static final int DEFAULT_VALIDITY_DURATION = 3600;

    // ============================================================
    // Network Sets
    // ============================================================

    /** All supported Bitcoin on-chain networks. */
    public static final Set<String> BTC_NETWORKS = Set.of(BTC_MAINNET, BTC_TESTNET);

    /** All supported Lightning networks. */
    public static final Set<String> LIGHTNING_NETWORKS = Set.of(LIGHTNING_MAINNET, LIGHTNING_TESTNET);

    // ============================================================
    // Address Prefixes
    // ============================================================

    /** Bitcoin mainnet address prefixes. */
    private static final String[] MAINNET_PREFIXES = {"bc1", "1", "3"};

    /** Bitcoin testnet address prefixes. */
    private static final String[] TESTNET_PREFIXES = {"tb1", "m", "n", "2"};

    // ============================================================
    // Utility Methods
    // ============================================================

    /**
     * Checks if a network identifier is a Bitcoin on-chain network.
     *
     * @param network Network identifier
     * @return true if the network starts with "bip122:"
     */
    public static boolean isBtcNetwork(String network) {
        return network != null && network.startsWith("bip122:");
    }

    /**
     * Checks if a network identifier is a Lightning network.
     *
     * @param network Network identifier
     * @return true if the network starts with "lightning:"
     */
    public static boolean isLightningNetwork(String network) {
        return network != null && network.startsWith("lightning:");
    }

    /**
     * Checks if a network is a known supported Bitcoin on-chain network.
     *
     * @param network Network identifier
     * @return true if the network is in the supported set
     */
    public static boolean isSupportedBtcNetwork(String network) {
        return BTC_NETWORKS.contains(network);
    }

    /**
     * Checks if a network is a known supported Lightning network.
     *
     * @param network Network identifier
     * @return true if the network is in the supported set
     */
    public static boolean isSupportedLightningNetwork(String network) {
        return LIGHTNING_NETWORKS.contains(network);
    }

    /**
     * Checks if a network is any supported BTC-family network (on-chain or Lightning).
     *
     * @param network Network identifier
     * @return true if the network is supported
     */
    public static boolean isSupportedNetwork(String network) {
        return isSupportedBtcNetwork(network) || isSupportedLightningNetwork(network);
    }

    /**
     * Validates a Bitcoin address format (basic prefix + length check).
     *
     * @param address Bitcoin address to validate
     * @return true if the address has a valid format
     */
    public static boolean validateBitcoinAddress(String address) {
        if (address == null || address.length() < 14 || address.length() > 90) {
            return false;
        }
        for (String prefix : MAINNET_PREFIXES) {
            if (address.startsWith(prefix)) {
                return true;
            }
        }
        for (String prefix : TESTNET_PREFIXES) {
            if (address.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Checks if a Bitcoin address is for mainnet.
     *
     * @param address Bitcoin address
     * @return true if the address uses mainnet prefixes
     */
    public static boolean isMainnetAddress(String address) {
        if (address == null) {
            return false;
        }
        for (String prefix : MAINNET_PREFIXES) {
            if (address.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Checks if a Bitcoin address is for testnet.
     *
     * @param address Bitcoin address
     * @return true if the address uses testnet prefixes
     */
    public static boolean isTestnetAddress(String address) {
        if (address == null) {
            return false;
        }
        for (String prefix : TESTNET_PREFIXES) {
            if (address.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Validates a BOLT11 Lightning invoice format.
     *
     * @param invoice BOLT11 invoice string
     * @return true if the invoice has a valid format
     */
    public static boolean validateBolt11Invoice(String invoice) {
        if (invoice == null || invoice.length() < 20) {
            return false;
        }
        String lower = invoice.toLowerCase();
        return lower.startsWith("lnbc") || lower.startsWith("lntb") || lower.startsWith("lnbcrt");
    }

    /**
     * Validates a hex string of expected byte length.
     *
     * @param hex Hex string to validate
     * @param expectedByteLen Expected length in bytes (0 for any length)
     * @return true if the string is valid hex of the expected length
     */
    public static boolean isValidHex(String hex, int expectedByteLen) {
        if (hex == null || hex.isEmpty()) {
            return false;
        }
        for (char c : hex.toCharArray()) {
            if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F'))) {
                return false;
            }
        }
        if (expectedByteLen > 0 && hex.length() != expectedByteLen * 2) {
            return false;
        }
        return true;
    }
}
