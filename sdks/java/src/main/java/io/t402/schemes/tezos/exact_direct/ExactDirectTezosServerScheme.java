package io.t402.schemes.tezos.exact_direct;

import io.t402.schemes.tezos.TezosConstants;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Map;

/**
 * Server scheme for Tezos exact-direct payment processing.
 *
 * <p>Handles parsing prices (converting user-friendly prices to atomic units)
 * and generating payment requirements with Tezos-specific FA2 asset information.
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * ExactDirectTezosServerScheme scheme = new ExactDirectTezosServerScheme();
 *
 * // Simple usage with defaults
 * Map<String, Object> requirements = scheme.getPaymentRequirements(
 *     "1.50",        // price in USDt
 *     "tz1...",      // recipient address
 *     "API Access"   // description
 * );
 *
 * // Parse a price
 * Map<String, Object> priceInfo = scheme.parsePrice("1.50", TezosConstants.TEZOS_MAINNET);
 * // priceInfo = {amount: "1500000", asset: "tezos:.../fa2:KT1.../0", decimals: 6, symbol: "USDt"}
 * }</pre>
 */
public class ExactDirectTezosServerScheme {

    /** The scheme identifier. */
    public static final String SCHEME = TezosConstants.SCHEME_EXACT_DIRECT;

    /** CAIP family pattern for Tezos networks. */
    public static final String CAIP_FAMILY = TezosConstants.CAIP_FAMILY;

    private final String defaultNetwork;

    /**
     * Creates a new ExactDirectTezosServerScheme with mainnet as default network.
     */
    public ExactDirectTezosServerScheme() {
        this(TezosConstants.TEZOS_MAINNET);
    }

    /**
     * Creates a new ExactDirectTezosServerScheme with specified default network.
     *
     * @param defaultNetwork Default network for payments (CAIP-2 format)
     */
    public ExactDirectTezosServerScheme(String defaultNetwork) {
        this.defaultNetwork = TezosConstants.normalizeNetwork(
            defaultNetwork != null ? defaultNetwork : TezosConstants.TEZOS_MAINNET
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
     * Creates payment requirements with simplified parameters using the default network.
     *
     * @param price Price in decimal format (e.g., "1.50" for 1.50 USDt)
     * @param payTo Recipient Tezos address
     * @param description Resource description
     * @return Payment requirements map ready to send to client
     */
    public Map<String, Object> getPaymentRequirements(String price, String payTo, String description) {
        return getPaymentRequirements(price, defaultNetwork, payTo, description);
    }

    /**
     * Creates payment requirements with network override.
     *
     * @param price Price in decimal format (e.g., "1.50" for 1.50 USDt)
     * @param network Network identifier (CAIP-2 format)
     * @param payTo Recipient Tezos address
     * @param description Resource description
     * @return Payment requirements map ready to send to client
     */
    public Map<String, Object> getPaymentRequirements(
            String price,
            String network,
            String payTo,
            String description) {

        String normalized = TezosConstants.normalizeNetwork(network);
        Map<String, Object> priceInfo = parsePrice(price, normalized);

        Map<String, Object> requirements = new HashMap<>();
        requirements.put("t402Version", 2);
        requirements.put("scheme", SCHEME);
        requirements.put("network", normalized);
        requirements.put("payTo", payTo);
        requirements.put("maxAmountRequired", priceInfo.get("amount"));
        requirements.put("asset", priceInfo.get("asset"));
        requirements.put("maxTimeoutSeconds", TezosConstants.DEFAULT_VALIDITY_DURATION);
        requirements.put("resource", description);

        return requirements;
    }

    /**
     * Parses a price string into amount and asset info.
     *
     * <p>Supports:
     * <ul>
     *   <li>Decimal format: "1.50" -&gt; 1500000</li>
     *   <li>Already atomic: "1500000" -&gt; 1500000</li>
     *   <li>Dollar prefix: "$1.50" -&gt; 1500000</li>
     * </ul>
     *
     * @param price Price string
     * @param network Network identifier (CAIP-2 format)
     * @return Map with amount (in atomic units), asset (CAIP-19), decimals, and symbol
     * @throws IllegalArgumentException if network is not supported
     */
    public Map<String, Object> parsePrice(String price, String network) {
        String normalized = TezosConstants.normalizeNetwork(network);

        if (!TezosConstants.isValidNetwork(normalized)) {
            throw new IllegalArgumentException("Unsupported Tezos network: " + network);
        }

        String contractAddress = TezosConstants.USDT_MAINNET_CONTRACT;
        int tokenId = TezosConstants.USDT_MAINNET_TOKEN_ID;
        int decimals = TezosConstants.USDT_DECIMALS;

        // Clean price string
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

        String assetIdentifier = TezosConstants.createAssetIdentifier(normalized, contractAddress, tokenId);

        Map<String, Object> result = new HashMap<>();
        result.put("amount", amount.toString());
        result.put("asset", assetIdentifier);
        result.put("decimals", decimals);
        result.put("symbol", TezosConstants.DEFAULT_TOKEN);
        result.put("tokenId", tokenId);

        return result;
    }

    /**
     * Creates payment requirements with raw parameters.
     *
     * @param network Network identifier
     * @param payTo Recipient address
     * @param amount Amount in atomic units
     * @param contractAddress FA2 contract address (null for default USDT)
     * @param tokenId Token ID within the FA2 contract
     * @param maxTimeoutSeconds Maximum timeout in seconds
     * @return Payment requirements map
     */
    public Map<String, Object> createPaymentRequirements(
            String network,
            String payTo,
            String amount,
            String contractAddress,
            int tokenId,
            int maxTimeoutSeconds) {

        String normalized = TezosConstants.normalizeNetwork(network);
        String contract = contractAddress != null ? contractAddress : TezosConstants.USDT_MAINNET_CONTRACT;
        String assetIdentifier = TezosConstants.createAssetIdentifier(normalized, contract, tokenId);

        Map<String, Object> requirements = new HashMap<>();
        requirements.put("scheme", SCHEME);
        requirements.put("network", normalized);
        requirements.put("payTo", payTo);
        requirements.put("maxAmountRequired", amount);
        requirements.put("asset", assetIdentifier);
        requirements.put("maxTimeoutSeconds", maxTimeoutSeconds);

        return requirements;
    }

    /**
     * Validates that payment requirements are valid for Tezos exact-direct.
     *
     * @param requirements Payment requirements to validate
     * @return true if valid
     */
    public boolean validateRequirements(Map<String, Object> requirements) {
        if (requirements == null) {
            return false;
        }

        // Check scheme
        if (!SCHEME.equals(requirements.get("scheme"))) {
            return false;
        }

        // Check network
        String network = (String) requirements.get("network");
        if (network == null || !TezosConstants.isValidNetwork(network)) {
            return false;
        }

        // Check payTo
        String payTo = (String) requirements.get("payTo");
        if (payTo == null || payTo.isEmpty()) {
            return false;
        }

        return true;
    }
}
