package io.t402.schemes.btc.exact;

import io.t402.schemes.btc.BtcConstants;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

/**
 * Server scheme for Bitcoin on-chain payment processing.
 *
 * <p>Handles parsing prices (BTC to satoshis) and generating payment
 * requirements for the exact payment scheme.
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * ExactBtcServerScheme scheme = new ExactBtcServerScheme();
 *
 * // Parse BTC price to satoshis
 * Map<String, Object> priceInfo = scheme.parsePrice("0.001", BtcConstants.BTC_MAINNET);
 * // priceInfo = {amount: "100000", asset: "BTC", decimals: 8, symbol: "BTC"}
 *
 * // Generate payment requirements
 * Map<String, Object> requirements = scheme.getPaymentRequirements(
 *     "0.001", "bc1q...", "API Access"
 * );
 * }</pre>
 */
public class ExactBtcServerScheme {

    /** The scheme identifier. */
    public static final String SCHEME = BtcConstants.SCHEME_EXACT;

    /** CAIP family pattern for Bitcoin on-chain networks. */
    public static final String CAIP_FAMILY = BtcConstants.CAIP_FAMILY_BTC;

    private final String defaultNetwork;

    /**
     * Creates a new ExactBtcServerScheme with mainnet as default network.
     */
    public ExactBtcServerScheme() {
        this(BtcConstants.BTC_MAINNET);
    }

    /**
     * Creates a new ExactBtcServerScheme with specified default network.
     *
     * @param defaultNetwork Default network for payments (CAIP-2 format)
     */
    public ExactBtcServerScheme(String defaultNetwork) {
        this.defaultNetwork = defaultNetwork != null ? defaultNetwork : BtcConstants.BTC_MAINNET;
    }

    /**
     * Gets the default network for this server scheme.
     *
     * @return Default network identifier
     */
    public String getDefaultNetwork() {
        return defaultNetwork;
    }

    /**
     * Creates payment requirements with simplified parameters.
     *
     * @param price Price (decimal BTC like "0.001" or satoshis like "100000")
     * @param payTo Recipient Bitcoin address
     * @param description Resource description
     * @return Payment requirements map
     */
    public Map<String, Object> getPaymentRequirements(String price, String payTo, String description) {
        return getPaymentRequirements(price, defaultNetwork, payTo, description);
    }

    /**
     * Creates payment requirements with network override.
     *
     * @param price Price string
     * @param network Network identifier (CAIP-2 format)
     * @param payTo Recipient Bitcoin address
     * @param description Resource description
     * @return Payment requirements map
     */
    public Map<String, Object> getPaymentRequirements(
            String price,
            String network,
            String payTo,
            String description) {

        Map<String, Object> priceInfo = parsePrice(price, network);

        Map<String, Object> requirements = new HashMap<>();
        requirements.put("t402Version", 2);
        requirements.put("scheme", SCHEME);
        requirements.put("network", network);
        requirements.put("payTo", payTo);
        requirements.put("amount", priceInfo.get("amount"));
        requirements.put("asset", BtcConstants.DEFAULT_ASSET);
        requirements.put("maxTimeoutSeconds", BtcConstants.DEFAULT_VALIDITY_DURATION);
        requirements.put("resource", description);

        return requirements;
    }

    /**
     * Parses a price string into amount (satoshis) and asset info.
     *
     * <p>If the price contains a decimal point, it's treated as BTC and converted
     * to satoshis. Otherwise, it's treated as already in satoshis.
     *
     * @param price Price string (e.g., "0.001" for BTC or "100000" for satoshis)
     * @param network Network identifier (CAIP-2 format)
     * @return Map with amount, asset, decimals, and symbol
     */
    public Map<String, Object> parsePrice(String price, String network) {
        if (!BtcConstants.isSupportedBtcNetwork(network) && !BtcConstants.isSupportedLightningNetwork(network)) {
            throw new IllegalArgumentException("Unsupported BTC network: " + network);
        }

        String amount;
        if (price.contains(".")) {
            BigDecimal btcAmount = new BigDecimal(price);
            BigDecimal sats = btcAmount.multiply(BigDecimal.valueOf(BtcConstants.SATS_PER_BTC));
            amount = sats.toBigInteger().toString();
        } else {
            amount = price;
        }

        Map<String, Object> result = new HashMap<>();
        result.put("amount", amount);
        result.put("asset", BtcConstants.DEFAULT_ASSET);
        result.put("decimals", BtcConstants.BTC_DECIMALS);
        result.put("symbol", BtcConstants.DEFAULT_ASSET);

        return result;
    }

    /**
     * Creates payment requirements with full control.
     *
     * @param network Network identifier
     * @param payTo Recipient address
     * @param amount Amount in satoshis
     * @param maxTimeoutSeconds Maximum timeout
     * @return Payment requirements map
     */
    public Map<String, Object> createPaymentRequirements(
            String network,
            String payTo,
            String amount,
            int maxTimeoutSeconds) {

        Map<String, Object> requirements = new HashMap<>();
        requirements.put("scheme", SCHEME);
        requirements.put("network", network);
        requirements.put("payTo", payTo);
        requirements.put("amount", amount);
        requirements.put("asset", BtcConstants.DEFAULT_ASSET);
        requirements.put("maxTimeoutSeconds", maxTimeoutSeconds);

        return requirements;
    }

    /**
     * Validates that payment requirements are valid for Bitcoin.
     *
     * @param requirements Payment requirements to validate
     * @return true if valid
     */
    public boolean validateRequirements(Map<String, Object> requirements) {
        if (requirements == null) {
            return false;
        }

        if (!SCHEME.equals(requirements.get("scheme"))) {
            return false;
        }

        String network = (String) requirements.get("network");
        if (network == null || !BtcConstants.isSupportedBtcNetwork(network)) {
            return false;
        }

        String payTo = (String) requirements.get("payTo");
        if (payTo == null || !BtcConstants.validateBitcoinAddress(payTo)) {
            return false;
        }

        return true;
    }
}
