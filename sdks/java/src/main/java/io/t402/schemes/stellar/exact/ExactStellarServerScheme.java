package io.t402.schemes.stellar.exact;

import io.t402.schemes.stellar.StellarConstants;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Map;

/**
 * Server scheme for Stellar payment processing.
 * <p>
 * Handles parsing prices and generating payment requirements
 * for the exact payment scheme on Stellar using Soroban token transfers.
 * </p>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * ExactStellarServerScheme scheme = new ExactStellarServerScheme();
 *
 * Map<String, Object> requirements = scheme.getPaymentRequirements(
 *     "1.50",        // price in USDC
 *     "GABC...",     // recipient address
 *     "API Access"   // description
 * );
 *
 * Map<String, Object> priceInfo = scheme.parsePrice("1.50", StellarConstants.STELLAR_PUBNET);
 * }</pre>
 */
public class ExactStellarServerScheme {

    /** The scheme identifier. */
    public static final String SCHEME = StellarConstants.SCHEME_EXACT;

    /** CAIP family pattern for Stellar networks. */
    public static final String CAIP_FAMILY = StellarConstants.CAIP_FAMILY;

    private final String defaultNetwork;

    /**
     * Creates a new ExactStellarServerScheme with pubnet as default network.
     */
    public ExactStellarServerScheme() {
        this(StellarConstants.STELLAR_PUBNET);
    }

    /**
     * Creates a new ExactStellarServerScheme with specified default network.
     *
     * @param defaultNetwork Default network for payments (CAIP-2 format)
     */
    public ExactStellarServerScheme(String defaultNetwork) {
        this.defaultNetwork = StellarConstants.normalizeNetwork(
            defaultNetwork != null ? defaultNetwork : StellarConstants.STELLAR_PUBNET
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
     *
     * @param price Price in decimal format (e.g., "1.50" for 1.50 USDC)
     * @param payTo Recipient Stellar address (G-account)
     * @param description Resource description
     * @return Payment requirements map ready to send to client
     */
    public Map<String, Object> getPaymentRequirements(String price, String payTo,
                                                       String description) {
        return getPaymentRequirements(price, defaultNetwork, payTo, description);
    }

    /**
     * Creates payment requirements with network override.
     *
     * @param price Price in decimal format (e.g., "1.50" for 1.50 USDC)
     * @param network Network identifier (CAIP-2 format)
     * @param payTo Recipient Stellar address (G-account)
     * @param description Resource description
     * @return Payment requirements map ready to send to client
     */
    public Map<String, Object> getPaymentRequirements(
            String price, String network, String payTo, String description) {

        String normalized = StellarConstants.normalizeNetwork(network);
        Map<String, Object> priceInfo = parsePrice(price, normalized);

        Map<String, Object> requirements = new HashMap<>();
        requirements.put("t402Version", 2);
        requirements.put("scheme", SCHEME);
        requirements.put("network", normalized);
        requirements.put("payTo", payTo);
        requirements.put("maxAmountRequired", priceInfo.get("amount"));
        requirements.put("asset", priceInfo.get("asset"));
        requirements.put("maxTimeoutSeconds", StellarConstants.DEFAULT_TIMEOUT_SECONDS);
        requirements.put("resource", description);

        return requirements;
    }

    /**
     * Parses a price string into amount and asset info.
     *
     * @param price Price string (e.g., "1.50" or "15000000")
     * @param network Network identifier (CAIP-2 format)
     * @return Map with amount (in atomic units), asset, decimals, and symbol
     * @throws IllegalArgumentException if network is not supported
     */
    public Map<String, Object> parsePrice(String price, String network) {
        String normalized = StellarConstants.normalizeNetwork(network);

        if (!StellarConstants.isValidNetwork(normalized)) {
            throw new IllegalArgumentException("Unsupported Stellar network: " + network);
        }

        String usdcAddress = StellarConstants.getUsdcAddress(normalized);
        int decimals = StellarConstants.USDC_DECIMALS;

        BigInteger amount;
        if (price.contains(".")) {
            BigDecimal decimal = new BigDecimal(price);
            BigDecimal multiplier = BigDecimal.TEN.pow(decimals);
            amount = decimal.multiply(multiplier).setScale(0, RoundingMode.DOWN).toBigInteger();
        } else {
            amount = new BigInteger(price);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("amount", amount.toString());
        result.put("asset", usdcAddress);
        result.put("decimals", decimals);
        result.put("symbol", StellarConstants.DEFAULT_TOKEN);

        return result;
    }

    /**
     * Creates payment requirements for a Stellar payment.
     *
     * @param network Network identifier
     * @param payTo Recipient address (G-account)
     * @param amount Amount in atomic units
     * @param asset Token contract address (null for default USDC)
     * @param maxTimeoutSeconds Maximum timeout in seconds
     * @return Payment requirements map
     */
    public Map<String, Object> createPaymentRequirements(
            String network,
            String payTo,
            String amount,
            String asset,
            int maxTimeoutSeconds) {

        String normalized = StellarConstants.normalizeNetwork(network);
        String tokenAddress = asset != null ? asset : StellarConstants.getUsdcAddress(normalized);

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
     * Validates that payment requirements are valid for Stellar.
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
        if (network == null || !StellarConstants.isValidNetwork(network)) {
            return false;
        }

        String payTo = (String) requirements.get("payTo");
        if (payTo == null || payTo.isEmpty()) {
            return false;
        }

        return true;
    }
}
