package io.t402.schemes.polkadot.exact_direct;

import io.t402.schemes.polkadot.PolkadotConstants;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Map;

/**
 * Server scheme for Polkadot exact-direct payment processing.
 *
 * <p>Handles parsing prices (converting user-friendly prices to atomic units)
 * and generating payment requirements with Polkadot Asset Hub metadata.
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * ExactDirectPolkadotServerScheme scheme = new ExactDirectPolkadotServerScheme();
 *
 * // Simple usage with defaults
 * Map<String, Object> requirements = scheme.getPaymentRequirements(
 *     "1.50",                     // price in USDT
 *     "5GrwvaEF...",              // recipient address
 *     "API Access"                // description
 * );
 *
 * // Parse a price
 * Map<String, Object> priceInfo = scheme.parsePrice("1.50",
 *     PolkadotConstants.POLKADOT_ASSET_HUB);
 * // priceInfo = {amount: "1500000", asset: "polkadot:.../asset:1984", ...}
 * }</pre>
 */
public class ExactDirectPolkadotServerScheme {

    /** The scheme identifier. */
    public static final String SCHEME = PolkadotConstants.SCHEME_EXACT_DIRECT;

    /** CAIP family pattern for Polkadot networks. */
    public static final String CAIP_FAMILY = PolkadotConstants.CAIP_FAMILY;

    private final String defaultNetwork;

    /**
     * Creates a new ExactDirectPolkadotServerScheme with Polkadot Asset Hub as default.
     */
    public ExactDirectPolkadotServerScheme() {
        this(PolkadotConstants.POLKADOT_ASSET_HUB);
    }

    /**
     * Creates a new ExactDirectPolkadotServerScheme with specified default network.
     *
     * @param defaultNetwork Default network for payments (CAIP-2 format)
     */
    public ExactDirectPolkadotServerScheme(String defaultNetwork) {
        this.defaultNetwork = PolkadotConstants.normalizeNetwork(
            defaultNetwork != null ? defaultNetwork : PolkadotConstants.POLKADOT_ASSET_HUB
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
     * @param price Price in decimal format (e.g., "1.50" for 1.50 USDT)
     * @param payTo Recipient SS58 address
     * @param description Resource description
     * @return Payment requirements map ready to send to client
     */
    public Map<String, Object> getPaymentRequirements(String price, String payTo, String description) {
        return getPaymentRequirements(price, defaultNetwork, payTo, description);
    }

    /**
     * Creates payment requirements with network override.
     *
     * @param price Price in decimal format (e.g., "1.50" for 1.50 USDT)
     * @param network Network identifier (CAIP-2 format)
     * @param payTo Recipient SS58 address
     * @param description Resource description
     * @return Payment requirements map ready to send to client
     */
    public Map<String, Object> getPaymentRequirements(
            String price,
            String network,
            String payTo,
            String description) {

        String normalized = PolkadotConstants.normalizeNetwork(network);
        Map<String, Object> priceInfo = parsePrice(price, normalized);

        Map<String, Object> requirements = new HashMap<>();
        requirements.put("t402Version", 2);
        requirements.put("scheme", SCHEME);
        requirements.put("network", normalized);
        requirements.put("payTo", payTo);
        requirements.put("maxAmountRequired", priceInfo.get("amount"));
        requirements.put("asset", priceInfo.get("asset"));
        requirements.put("maxTimeoutSeconds", PolkadotConstants.DEFAULT_VALIDITY_DURATION);
        requirements.put("resource", description);

        // Add extra metadata
        Map<String, Object> extra = new HashMap<>();
        extra.put("assetId", priceInfo.get("assetId"));
        extra.put("assetSymbol", priceInfo.get("symbol"));
        extra.put("assetDecimals", priceInfo.get("decimals"));
        requirements.put("extra", extra);

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
     * @return Map with amount, asset (CAIP-19), decimals, symbol, assetId
     * @throws IllegalArgumentException if network is not supported
     */
    public Map<String, Object> parsePrice(String price, String network) {
        String normalized = PolkadotConstants.normalizeNetwork(network);

        if (!PolkadotConstants.isValidNetwork(normalized)) {
            throw new IllegalArgumentException("Unsupported Polkadot network: " + network);
        }

        int assetId = PolkadotConstants.USDT_ASSET_ID;
        int decimals = PolkadotConstants.USDT_DECIMALS;

        // Clean price string
        String cleanPrice = price.trim();
        if (cleanPrice.startsWith("$")) {
            cleanPrice = cleanPrice.substring(1).trim();
        }
        // Remove suffixes like " USDT"
        for (String suffix : new String[]{" USDT", " USD"}) {
            if (cleanPrice.endsWith(suffix)) {
                cleanPrice = cleanPrice.substring(0, cleanPrice.length() - suffix.length()).trim();
                break;
            }
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

        String assetIdentifier = PolkadotConstants.createAssetIdentifier(normalized, assetId);

        Map<String, Object> result = new HashMap<>();
        result.put("amount", amount.toString());
        result.put("asset", assetIdentifier);
        result.put("decimals", decimals);
        result.put("symbol", PolkadotConstants.DEFAULT_TOKEN);
        result.put("assetId", assetId);

        return result;
    }

    /**
     * Creates payment requirements with raw parameters.
     *
     * @param network Network identifier
     * @param payTo Recipient address
     * @param amount Amount in atomic units
     * @param assetId On-chain asset ID (use -1 for default USDT)
     * @param maxTimeoutSeconds Maximum timeout in seconds
     * @return Payment requirements map
     */
    public Map<String, Object> createPaymentRequirements(
            String network,
            String payTo,
            String amount,
            int assetId,
            int maxTimeoutSeconds) {

        String normalized = PolkadotConstants.normalizeNetwork(network);
        int resolvedAssetId = assetId >= 0 ? assetId : PolkadotConstants.USDT_ASSET_ID;
        String assetIdentifier = PolkadotConstants.createAssetIdentifier(normalized, resolvedAssetId);

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
     * Validates that payment requirements are valid for Polkadot exact-direct.
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
        if (network == null || !PolkadotConstants.isValidNetwork(network)) {
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
