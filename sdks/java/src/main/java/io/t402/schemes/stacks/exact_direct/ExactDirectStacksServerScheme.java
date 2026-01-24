package io.t402.schemes.stacks.exact_direct;

import io.t402.schemes.stacks.StacksConstants;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Map;

/**
 * Server scheme for Stacks exact-direct payment processing.
 *
 * <p>Handles parsing prices (converting user-friendly prices to atomic units)
 * and generating payment requirements with Stacks SIP-010 token metadata.
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * ExactDirectStacksServerScheme scheme = new ExactDirectStacksServerScheme();
 *
 * // Simple usage with defaults
 * Map<String, Object> requirements = scheme.getPaymentRequirements(
 *     "1.50",                              // price in sUSDC
 *     "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",  // recipient address
 *     "API Access"                          // description
 * );
 *
 * // Parse a price
 * Map<String, Object> priceInfo = scheme.parsePrice("1.50", StacksConstants.MAINNET_CAIP2);
 * // priceInfo = {amount: "1500000", contractAddress: "SP3Y2...token-susdc", ...}
 * }</pre>
 */
public class ExactDirectStacksServerScheme {

    /** The scheme identifier. */
    public static final String SCHEME = StacksConstants.SCHEME_EXACT_DIRECT;

    /** CAIP family pattern for Stacks networks. */
    public static final String CAIP_FAMILY = StacksConstants.CAIP_FAMILY;

    private final String defaultNetwork;

    /**
     * Creates a new ExactDirectStacksServerScheme with Stacks Mainnet as default.
     */
    public ExactDirectStacksServerScheme() {
        this(StacksConstants.MAINNET_CAIP2);
    }

    /**
     * Creates a new ExactDirectStacksServerScheme with specified default network.
     *
     * @param defaultNetwork Default network for payments (CAIP-2 format)
     */
    public ExactDirectStacksServerScheme(String defaultNetwork) {
        this.defaultNetwork = StacksConstants.normalizeNetwork(
            defaultNetwork != null ? defaultNetwork : StacksConstants.MAINNET_CAIP2
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
     * @param price Price in decimal format (e.g., "1.50" for 1.50 sUSDC)
     * @param payTo Recipient Stacks principal address
     * @param description Resource description
     * @return Payment requirements map ready to send to client
     */
    public Map<String, Object> getPaymentRequirements(String price, String payTo, String description) {
        return getPaymentRequirements(price, defaultNetwork, payTo, description);
    }

    /**
     * Creates payment requirements with network override.
     *
     * @param price Price in decimal format (e.g., "1.50" for 1.50 sUSDC)
     * @param network Network identifier (CAIP-2 format)
     * @param payTo Recipient Stacks principal address
     * @param description Resource description
     * @return Payment requirements map ready to send to client
     */
    public Map<String, Object> getPaymentRequirements(
            String price,
            String network,
            String payTo,
            String description) {

        String normalized = StacksConstants.normalizeNetwork(network);
        Map<String, Object> priceInfo = parsePrice(price, normalized);

        Map<String, Object> requirements = new HashMap<>();
        requirements.put("t402Version", 2);
        requirements.put("scheme", SCHEME);
        requirements.put("network", normalized);
        requirements.put("payTo", payTo);
        requirements.put("maxAmountRequired", priceInfo.get("amount"));
        requirements.put("maxTimeoutSeconds", StacksConstants.DEFAULT_VALIDITY_DURATION);
        requirements.put("resource", description);

        // Add extra metadata
        Map<String, Object> extra = new HashMap<>();
        extra.put("contractAddress", priceInfo.get("contractAddress"));
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
     * @return Map with amount, contractAddress, decimals, symbol
     * @throws IllegalArgumentException if network is not supported
     */
    public Map<String, Object> parsePrice(String price, String network) {
        String normalized = StacksConstants.normalizeNetwork(network);

        if (!StacksConstants.isStacksNetwork(normalized)) {
            throw new IllegalArgumentException("Unsupported Stacks network: " + network);
        }

        int decimals = StacksConstants.SUSDC_DECIMALS;
        String contractAddress;
        if (StacksConstants.isSupportedNetwork(normalized)) {
            contractAddress = StacksConstants.getDefaultContract(normalized);
        } else {
            throw new IllegalArgumentException("No default contract for network: " + normalized);
        }

        // Clean price string
        String cleanPrice = price.trim();
        if (cleanPrice.startsWith("$")) {
            cleanPrice = cleanPrice.substring(1).trim();
        }
        // Remove suffixes like " sUSDC", " USDC"
        for (String suffix : new String[]{" sUSDC", " USDC", " USD"}) {
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

        Map<String, Object> result = new HashMap<>();
        result.put("amount", amount.toString());
        result.put("contractAddress", contractAddress);
        result.put("decimals", decimals);
        result.put("symbol", StacksConstants.SUSDC_SYMBOL);

        return result;
    }

    /**
     * Creates payment requirements with raw parameters.
     *
     * @param network Network identifier
     * @param payTo Recipient address
     * @param amount Amount in atomic units
     * @param contractAddress SIP-010 token contract address (null for default sUSDC)
     * @param maxTimeoutSeconds Maximum timeout in seconds
     * @return Payment requirements map
     */
    public Map<String, Object> createPaymentRequirements(
            String network,
            String payTo,
            String amount,
            String contractAddress,
            int maxTimeoutSeconds) {

        String normalized = StacksConstants.normalizeNetwork(network);
        String resolvedContract = contractAddress != null && !contractAddress.isEmpty()
            ? contractAddress
            : (StacksConstants.isSupportedNetwork(normalized)
                ? StacksConstants.getDefaultContract(normalized) : "");

        Map<String, Object> requirements = new HashMap<>();
        requirements.put("scheme", SCHEME);
        requirements.put("network", normalized);
        requirements.put("payTo", payTo);
        requirements.put("maxAmountRequired", amount);
        requirements.put("maxTimeoutSeconds", maxTimeoutSeconds);

        Map<String, Object> extra = new HashMap<>();
        extra.put("contractAddress", resolvedContract);
        extra.put("assetSymbol", StacksConstants.SUSDC_SYMBOL);
        extra.put("assetDecimals", StacksConstants.SUSDC_DECIMALS);
        requirements.put("extra", extra);

        return requirements;
    }

    /**
     * Validates that payment requirements are valid for Stacks exact-direct.
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
        if (network == null || !StacksConstants.isStacksNetwork(network)) {
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
