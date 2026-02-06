package io.t402.schemes.cosmos.exact;

import io.t402.schemes.cosmos.CosmosConstants;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Map;

/**
 * Server scheme for Cosmos exact-direct payment processing.
 * <p>
 * Handles parsing prices and generating payment requirements
 * for the exact-direct payment scheme on Cosmos/Noble using native USDC.
 * </p>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * ExactDirectCosmosServerScheme scheme = new ExactDirectCosmosServerScheme();
 *
 * // Simple usage with defaults
 * Map<String, Object> requirements = scheme.getPaymentRequirements(
 *     "1.50",                   // price in USDC
 *     "noble1merchant...",      // recipient address
 *     "API Access"              // description
 * );
 *
 * // Parse a price
 * Map<String, Object> priceInfo = scheme.parsePrice("1.50", CosmosConstants.NOBLE_MAINNET);
 * // priceInfo = {amount: "1500000", asset: "uusdc", decimals: 6, symbol: "USDC"}
 * }</pre>
 */
public class ExactDirectCosmosServerScheme {

    /** The scheme identifier. */
    public static final String SCHEME = CosmosConstants.SCHEME_EXACT_DIRECT;

    /** CAIP family pattern for Cosmos networks. */
    public static final String CAIP_FAMILY = CosmosConstants.CAIP_FAMILY;

    private final String defaultNetwork;

    /**
     * Creates a new ExactDirectCosmosServerScheme with mainnet as default network.
     */
    public ExactDirectCosmosServerScheme() {
        this(CosmosConstants.NOBLE_MAINNET);
    }

    /**
     * Creates a new ExactDirectCosmosServerScheme with specified default network.
     *
     * @param defaultNetwork Default network for payments (CAIP-2 format)
     */
    public ExactDirectCosmosServerScheme(String defaultNetwork) {
        this.defaultNetwork = CosmosConstants.normalizeNetwork(
            defaultNetwork != null ? defaultNetwork : CosmosConstants.NOBLE_MAINNET
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
     * @param price Price in decimal format (e.g., "1.50" for 1.50 USDC)
     * @param payTo Recipient Cosmos bech32 address
     * @param description Resource description
     * @return Payment requirements map ready to send to client
     *
     * @see #getPaymentRequirements(String, String, String, String)
     */
    public Map<String, Object> getPaymentRequirements(
            String price, String payTo, String description) {
        return getPaymentRequirements(price, defaultNetwork, payTo, description);
    }

    /**
     * Creates payment requirements with network override.
     *
     * @param price Price in decimal format (e.g., "1.50" for 1.50 USDC)
     * @param network Network identifier (CAIP-2 format)
     * @param payTo Recipient Cosmos bech32 address
     * @param description Resource description
     * @return Payment requirements map ready to send to client
     */
    public Map<String, Object> getPaymentRequirements(
            String price,
            String network,
            String payTo,
            String description) {

        String normalized = CosmosConstants.normalizeNetwork(network);
        Map<String, Object> priceInfo = parsePrice(price, normalized);

        Map<String, Object> requirements = new HashMap<>();
        requirements.put("t402Version", 2);
        requirements.put("scheme", SCHEME);
        requirements.put("network", normalized);
        requirements.put("payTo", payTo);
        requirements.put("maxAmountRequired", priceInfo.get("amount"));
        requirements.put("asset", priceInfo.get("asset"));
        requirements.put("maxTimeoutSeconds", CosmosConstants.DEFAULT_VALIDITY_DURATION);
        requirements.put("resource", description);

        return requirements;
    }

    /**
     * Parses a price value into amount and asset info.
     *
     * <p>Supports multiple input formats:
     * <ul>
     *   <li>String: "1.50" or "$1.50" (decimal USDC) or "1500000" (atomic units)</li>
     *   <li>Number: 1.50 (decimal USDC)</li>
     *   <li>Map: {"amount": "1500000", "asset": "uusdc"} (pre-parsed)</li>
     * </ul>
     *
     * @param price Price value (String, Number, or Map)
     * @param network Network identifier (CAIP-2 format)
     * @return Map with amount (in atomic units), asset, decimals, and symbol
     * @throws IllegalArgumentException if network is not supported or price is invalid
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> parsePrice(Object price, String network) {
        String normalized = CosmosConstants.normalizeNetwork(network);

        if (!CosmosConstants.isValidNetwork(normalized)) {
            throw new IllegalArgumentException("Unsupported Cosmos network: " + network);
        }

        int decimals = CosmosConstants.USDC_DECIMALS;

        // Handle pre-parsed Map
        if (price instanceof Map) {
            Map<String, Object> priceMap = (Map<String, Object>) price;
            Object amountVal = priceMap.get("amount");
            if (amountVal != null) {
                String asset = (String) priceMap.getOrDefault("asset",
                    CosmosConstants.USDC_DENOM);

                Map<String, Object> result = new HashMap<>();
                result.put("amount", amountVal.toString());
                result.put("asset", asset);
                result.put("decimals", decimals);
                result.put("symbol", CosmosConstants.USDC_SYMBOL);
                return result;
            }
        }

        // Convert to string for parsing
        String priceStr;
        if (price instanceof Number) {
            priceStr = price.toString();
        } else if (price instanceof String) {
            priceStr = ((String) price).trim();
            // Remove $ sign
            if (priceStr.startsWith("$")) {
                priceStr = priceStr.substring(1).trim();
            }
        } else {
            throw new IllegalArgumentException("Unsupported price type: " + price.getClass());
        }

        String amount = toAtomicUnits(priceStr, decimals);

        Map<String, Object> result = new HashMap<>();
        result.put("amount", amount);
        result.put("asset", CosmosConstants.USDC_DENOM);
        result.put("decimals", decimals);
        result.put("symbol", CosmosConstants.USDC_SYMBOL);

        return result;
    }

    /**
     * Enhances payment requirements with Cosmos-specific data.
     *
     * <p>Adds chainId, bech32Prefix, and denom to the requirements extra map.
     *
     * @param requirements Payment requirements to enhance
     * @param supportedKind Facilitator-provided supported kind data
     * @return Enhanced payment requirements
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> enhancePaymentRequirements(
            Map<String, Object> requirements,
            Map<String, Object> supportedKind) {

        String network = (String) requirements.getOrDefault("network",
            CosmosConstants.NOBLE_MAINNET);
        String normalized = CosmosConstants.normalizeNetwork(network);

        if (!CosmosConstants.isValidNetwork(normalized)) {
            throw new IllegalArgumentException("Unsupported Cosmos network: " + network);
        }

        // Get or create extra map
        Map<String, Object> extra;
        Object existingExtra = requirements.get("extra");
        if (existingExtra instanceof Map) {
            extra = new HashMap<>((Map<String, Object>) existingExtra);
        } else {
            extra = new HashMap<>();
        }

        // Add Cosmos-specific data
        extra.putIfAbsent("chainId", CosmosConstants.getChainId(normalized));
        extra.putIfAbsent("bech32Prefix", CosmosConstants.BECH32_PREFIX);

        String asset = (String) requirements.getOrDefault("asset", CosmosConstants.USDC_DENOM);
        extra.putIfAbsent("denom", asset);

        // Copy facilitator-provided extra fields
        if (supportedKind != null) {
            Map<String, Object> kindExtra = (Map<String, Object>) supportedKind.get("extra");
            if (kindExtra != null) {
                if (kindExtra.containsKey("assetSymbol")) {
                    extra.put("assetSymbol", kindExtra.get("assetSymbol"));
                }
                if (kindExtra.containsKey("assetDecimals")) {
                    extra.put("assetDecimals", kindExtra.get("assetDecimals"));
                }
            }
        }

        // Update requirements with enhanced extra
        Map<String, Object> enhanced = new HashMap<>(requirements);
        enhanced.put("extra", extra);
        enhanced.put("network", normalized);

        // Set default asset if not present
        if (!enhanced.containsKey("asset") || enhanced.get("asset") == null) {
            enhanced.put("asset", CosmosConstants.USDC_DENOM);
        }

        return enhanced;
    }

    /**
     * Creates payment requirements for a Cosmos payment.
     *
     * @param network Network identifier
     * @param payTo Recipient bech32 address
     * @param amount Amount in atomic units
     * @param asset Token denomination (null for default USDC)
     * @param maxTimeoutSeconds Maximum timeout in seconds
     * @return Payment requirements map
     */
    public Map<String, Object> createPaymentRequirements(
            String network,
            String payTo,
            String amount,
            String asset,
            int maxTimeoutSeconds) {

        String normalized = CosmosConstants.normalizeNetwork(network);
        String tokenDenom = asset != null ? asset : CosmosConstants.USDC_DENOM;

        Map<String, Object> requirements = new HashMap<>();
        requirements.put("scheme", SCHEME);
        requirements.put("network", normalized);
        requirements.put("payTo", payTo);
        requirements.put("maxAmountRequired", amount);
        requirements.put("asset", tokenDenom);
        requirements.put("maxTimeoutSeconds", maxTimeoutSeconds);

        return requirements;
    }

    /**
     * Validates that payment requirements are valid for Cosmos.
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
        if (network == null || !CosmosConstants.isValidNetwork(network)) {
            return false;
        }

        String payTo = (String) requirements.get("payTo");
        if (payTo == null || payTo.isEmpty()) {
            return false;
        }

        return true;
    }

    /**
     * Converts a decimal amount string to atomic units.
     *
     * <p>For example, with decimals=6: "1.50" becomes "1500000".
     *
     * @param amount Decimal amount string
     * @param decimals Number of decimal places
     * @return Atomic units string
     */
    public static String toAtomicUnits(String amount, int decimals) {
        if (amount.contains(".")) {
            BigDecimal decimal = new BigDecimal(amount);
            BigDecimal multiplier = BigDecimal.TEN.pow(decimals);
            return decimal.multiply(multiplier).setScale(0, RoundingMode.DOWN)
                .toBigInteger().toString();
        } else {
            // Already in atomic units
            return new BigInteger(amount).toString();
        }
    }
}
