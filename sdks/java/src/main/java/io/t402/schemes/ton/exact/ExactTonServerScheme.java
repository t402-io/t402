package io.t402.schemes.ton.exact;

import io.t402.schemes.ton.TonConstants;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Map;

/**
 * Server scheme for TON payment processing.
 * <p>
 * Handles parsing prices and generating payment requirements
 * for the exact payment scheme on TON.
 * </p>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * ExactTonServerScheme scheme = new ExactTonServerScheme();
 *
 * // Simple usage with defaults
 * Map<String, Object> requirements = scheme.getPaymentRequirements(
 *     "1.50",        // price in USDT
 *     "EQ...",       // recipient address
 *     "API Access"   // description
 * );
 *
 * // Parse a price
 * Map<String, Object> priceInfo = scheme.parsePrice("1.50", TonConstants.TON_MAINNET);
 * // priceInfo = {amount: "1500000", asset: "EQ...", decimals: 6, symbol: "USDT"}
 * }</pre>
 */
public class ExactTonServerScheme {

    /** The scheme identifier. */
    public static final String SCHEME = TonConstants.SCHEME_EXACT;

    /** CAIP family pattern for TON networks. */
    public static final String CAIP_FAMILY = TonConstants.CAIP_FAMILY;

    private final String defaultNetwork;

    /**
     * Creates a new ExactTonServerScheme with mainnet as default network.
     */
    public ExactTonServerScheme() {
        this(TonConstants.TON_MAINNET);
    }

    /**
     * Creates a new ExactTonServerScheme with specified default network.
     *
     * @param defaultNetwork Default network for payments (CAIP-2 format)
     */
    public ExactTonServerScheme(String defaultNetwork) {
        this.defaultNetwork = TonConstants.normalizeNetwork(
            defaultNetwork != null ? defaultNetwork : TonConstants.TON_MAINNET
        );
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
     * <p>
     * This is the recommended method for generating payment requirements.
     * </p>
     *
     * @param price Price in decimal format (e.g., "1.50" for 1.50 USDT)
     * @param payTo Recipient TON address
     * @param description Resource description
     * @return Payment requirements map ready to send to client
     *
     * @see #getPaymentRequirements(String, String, String, String)
     */
    public Map<String, Object> getPaymentRequirements(String price, String payTo, String description) {
        return getPaymentRequirements(price, defaultNetwork, payTo, description);
    }

    /**
     * Creates payment requirements with network override.
     *
     * @param price Price in decimal format (e.g., "1.50" for 1.50 USDT)
     * @param network Network identifier (CAIP-2 format)
     * @param payTo Recipient TON address
     * @param description Resource description
     * @return Payment requirements map ready to send to client
     */
    public Map<String, Object> getPaymentRequirements(
            String price,
            String network,
            String payTo,
            String description) {

        String normalized = TonConstants.normalizeNetwork(network);
        Map<String, Object> priceInfo = parsePrice(price, normalized);

        Map<String, Object> requirements = new HashMap<>();
        requirements.put("t402Version", 2);
        requirements.put("scheme", SCHEME);
        requirements.put("network", normalized);
        requirements.put("payTo", payTo);
        requirements.put("maxAmountRequired", priceInfo.get("amount"));
        requirements.put("asset", priceInfo.get("asset"));
        requirements.put("maxTimeoutSeconds", TonConstants.DEFAULT_VALIDITY_DURATION);
        requirements.put("resource", description);

        return requirements;
    }

    /**
     * Parses a price string into amount and asset info.
     *
     * @param price Price string (e.g., "1.50" or "1500000")
     * @param network Network identifier (CAIP-2 format)
     * @return Map with amount (in atomic units), asset, decimals, and symbol
     * @throws IllegalArgumentException if network is not supported
     */
    public Map<String, Object> parsePrice(String price, String network) {
        String normalized = TonConstants.normalizeNetwork(network);

        if (!TonConstants.isValidNetwork(normalized)) {
            throw new IllegalArgumentException("Unsupported TON network: " + network);
        }

        String usdtAddress = TonConstants.getUsdtAddress(normalized);
        int decimals = TonConstants.USDT_DECIMALS;

        BigInteger amount;
        if (price.contains(".")) {
            // Parse as decimal
            BigDecimal decimal = new BigDecimal(price);
            BigDecimal multiplier = BigDecimal.TEN.pow(decimals);
            amount = decimal.multiply(multiplier).setScale(0, RoundingMode.DOWN).toBigInteger();
        } else {
            // Already in atomic units
            amount = new BigInteger(price);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("amount", amount.toString());
        result.put("asset", usdtAddress);
        result.put("decimals", decimals);
        result.put("symbol", TonConstants.DEFAULT_TOKEN);

        return result;
    }

    /**
     * Creates payment requirements for a TON payment.
     *
     * @param network Network identifier
     * @param payTo Recipient address
     * @param amount Amount in atomic units
     * @param asset Token jetton address (null for default USDT)
     * @param maxTimeoutSeconds Maximum timeout in seconds
     * @return Payment requirements map
     */
    public Map<String, Object> createPaymentRequirements(
            String network,
            String payTo,
            String amount,
            String asset,
            int maxTimeoutSeconds) {

        String normalized = TonConstants.normalizeNetwork(network);
        String tokenAddress = asset != null ? asset : TonConstants.getUsdtAddress(normalized);

        Map<String, Object> requirements = new HashMap<>();
        requirements.put("scheme", SCHEME);
        requirements.put("network", normalized);
        requirements.put("payTo", payTo);
        requirements.put("maxAmountRequired", amount);
        requirements.put("asset", tokenAddress);
        requirements.put("maxTimeoutSeconds", maxTimeoutSeconds);

        return requirements;
    }

    /**
     * Validates that payment requirements are valid for TON.
     *
     * @param requirements Payment requirements to validate
     * @return true if valid
     */
    public boolean validateRequirements(Map<String, Object> requirements) {
        if (requirements == null) {
            return false;
        }

        // Check required fields
        if (!SCHEME.equals(requirements.get("scheme"))) {
            return false;
        }

        String network = (String) requirements.get("network");
        if (network == null || !TonConstants.isValidNetwork(network)) {
            return false;
        }

        String payTo = (String) requirements.get("payTo");
        if (payTo == null || payTo.isEmpty()) {
            return false;
        }

        return true;
    }
}
