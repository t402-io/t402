package io.t402.schemes.aptos.exact;

import io.t402.schemes.aptos.AptosConstants;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Map;

/**
 * Server scheme for Aptos exact-direct payment processing.
 * <p>
 * Handles parsing prices and generating payment requirements
 * for the exact-direct payment scheme on Aptos using Fungible Assets.
 * </p>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * ExactDirectAptosServerScheme scheme = new ExactDirectAptosServerScheme();
 *
 * // Simple usage with defaults
 * Map<String, Object> requirements = scheme.getPaymentRequirements(
 *     "1.50",                  // price in USDT
 *     "0x1234...abcd",         // recipient address
 *     "API Access"             // description
 * );
 *
 * // Parse a price
 * Map<String, Object> priceInfo = scheme.parsePrice("1.50", AptosConstants.APTOS_MAINNET);
 * // priceInfo = {amount: "1500000", asset: "0xf73e...", decimals: 6, symbol: "USDT"}
 * }</pre>
 */
public class ExactDirectAptosServerScheme {

    /** The scheme identifier. */
    public static final String SCHEME = AptosConstants.SCHEME_EXACT_DIRECT;

    /** CAIP family pattern for Aptos networks. */
    public static final String CAIP_FAMILY = AptosConstants.CAIP_FAMILY;

    private final String defaultNetwork;

    /**
     * Creates a new ExactDirectAptosServerScheme with mainnet as default network.
     */
    public ExactDirectAptosServerScheme() {
        this(AptosConstants.APTOS_MAINNET);
    }

    /**
     * Creates a new ExactDirectAptosServerScheme with specified default network.
     *
     * @param defaultNetwork Default network for payments (CAIP-2 format)
     */
    public ExactDirectAptosServerScheme(String defaultNetwork) {
        this.defaultNetwork = AptosConstants.normalizeNetwork(
            defaultNetwork != null ? defaultNetwork : AptosConstants.APTOS_MAINNET
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
     * @param payTo Recipient Aptos address
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
     * @param payTo Recipient Aptos address
     * @param description Resource description
     * @return Payment requirements map ready to send to client
     */
    public Map<String, Object> getPaymentRequirements(
            String price,
            String network,
            String payTo,
            String description) {

        String normalized = AptosConstants.normalizeNetwork(network);
        Map<String, Object> priceInfo = parsePrice(price, normalized);

        Map<String, Object> requirements = new HashMap<>();
        requirements.put("t402Version", 2);
        requirements.put("scheme", SCHEME);
        requirements.put("network", normalized);
        requirements.put("payTo", payTo);
        requirements.put("maxAmountRequired", priceInfo.get("amount"));
        requirements.put("asset", priceInfo.get("asset"));
        requirements.put("maxTimeoutSeconds", AptosConstants.DEFAULT_VALIDITY_DURATION);
        requirements.put("resource", description);

        return requirements;
    }

    /**
     * Parses a price string into amount and asset info.
     *
     * @param price Price string (e.g., "1.50", "$1.50", or "1500000")
     * @param network Network identifier (CAIP-2 format)
     * @return Map with amount (in atomic units), asset, decimals, and symbol
     * @throws IllegalArgumentException if network is not supported
     */
    public Map<String, Object> parsePrice(String price, String network) {
        String normalized = AptosConstants.normalizeNetwork(network);

        if (!AptosConstants.isValidNetwork(normalized)) {
            throw new IllegalArgumentException("Unsupported Aptos network: " + network);
        }

        String metadataAddress = AptosConstants.getUsdtMetadataAddress(normalized);
        int decimals = AptosConstants.USDT_DECIMALS;

        // Strip $ prefix if present
        String cleanPrice = price.trim();
        if (cleanPrice.startsWith("$")) {
            cleanPrice = cleanPrice.substring(1).trim();
        }

        BigInteger amount;
        if (cleanPrice.contains(".")) {
            // Parse as decimal
            BigDecimal decimal = new BigDecimal(cleanPrice);
            BigDecimal multiplier = BigDecimal.TEN.pow(decimals);
            amount = decimal.multiply(multiplier).setScale(0, RoundingMode.DOWN).toBigInteger();
        } else {
            // Already in atomic units
            amount = new BigInteger(cleanPrice);
        }

        Map<String, Object> result = new HashMap<>();
        result.put("amount", amount.toString());
        result.put("asset", metadataAddress);
        result.put("decimals", decimals);
        result.put("symbol", AptosConstants.DEFAULT_TOKEN);

        return result;
    }

    /**
     * Creates payment requirements for an Aptos payment.
     *
     * @param network Network identifier
     * @param payTo Recipient address
     * @param amount Amount in atomic units
     * @param asset FA metadata address (null for default USDT)
     * @param maxTimeoutSeconds Maximum timeout in seconds
     * @return Payment requirements map
     */
    public Map<String, Object> createPaymentRequirements(
            String network,
            String payTo,
            String amount,
            String asset,
            int maxTimeoutSeconds) {

        String normalized = AptosConstants.normalizeNetwork(network);
        String metadataAddress = asset != null ? asset : AptosConstants.getUsdtMetadataAddress(normalized);

        Map<String, Object> requirements = new HashMap<>();
        requirements.put("scheme", SCHEME);
        requirements.put("network", normalized);
        requirements.put("payTo", payTo);
        requirements.put("maxAmountRequired", amount);
        requirements.put("asset", metadataAddress);
        requirements.put("maxTimeoutSeconds", maxTimeoutSeconds);

        return requirements;
    }

    /**
     * Validates that payment requirements are valid for Aptos exact-direct.
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
        if (network == null || !AptosConstants.isValidNetwork(network)) {
            return false;
        }

        String payTo = (String) requirements.get("payTo");
        if (payTo == null || payTo.isEmpty() || !AptosConstants.isValidAddress(payTo)) {
            return false;
        }

        return true;
    }
}
