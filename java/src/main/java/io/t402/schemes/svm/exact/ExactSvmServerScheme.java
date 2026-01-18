package io.t402.schemes.svm.exact;

import io.t402.schemes.svm.SvmConstants;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Map;

/**
 * Server scheme for SVM payment processing.
 * <p>
 * Handles parsing prices and enhancing payment requirements
 * with SVM-specific details.
 * </p>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * ExactSvmServerScheme scheme = new ExactSvmServerScheme();
 *
 * // Parse a price
 * Map<String, Object> priceInfo = scheme.parsePrice("1.50", SvmConstants.SOLANA_MAINNET);
 * // priceInfo = {amount: "1500000", asset: "EPjFWdd5...", decimals: 6, symbol: "USDC"}
 *
 * // Enhance requirements with fee payer
 * Map<String, Object> enhanced = scheme.enhancePaymentRequirements(requirements, feePayer);
 * }</pre>
 */
public class ExactSvmServerScheme {

    /** The scheme identifier. */
    public static final String SCHEME = SvmConstants.SCHEME_EXACT;

    /** CAIP family pattern for Solana networks. */
    public static final String CAIP_FAMILY = "solana:*";

    /**
     * Parses a price string into amount and asset info.
     *
     * @param price Price string (e.g., "1.50" or "1500000")
     * @param network Network identifier (CAIP-2 format)
     * @return Map with amount (in atomic units), asset, decimals, and symbol
     * @throws IllegalArgumentException if network is not supported
     */
    public Map<String, Object> parsePrice(String price, String network) {
        String normalized = SvmConstants.normalizeNetwork(network);

        if (!SvmConstants.isValidNetwork(normalized)) {
            throw new IllegalArgumentException("Unsupported Solana network: " + network);
        }

        String usdcAddress = SvmConstants.getUsdcAddress(normalized);
        int decimals = SvmConstants.DEFAULT_DECIMALS;

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
        result.put("asset", usdcAddress);
        result.put("decimals", decimals);
        result.put("symbol", "USDC");

        return result;
    }

    /**
     * Enhances payment requirements with SVM-specific details.
     *
     * @param requirements Base payment requirements
     * @param feePayer Optional fee payer address from facilitator
     * @return Enhanced requirements map
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> enhancePaymentRequirements(Map<String, Object> requirements, String feePayer) {
        Map<String, Object> enhanced = new HashMap<>(requirements);

        // Normalize network to CAIP-2 format
        String network = (String) enhanced.getOrDefault("network", SvmConstants.SOLANA_MAINNET);
        enhanced.put("network", SvmConstants.normalizeNetwork(network));

        // Add fee payer if provided
        if (feePayer != null && !feePayer.isEmpty()) {
            Map<String, Object> extra = enhanced.containsKey("extra")
                ? new HashMap<>((Map<String, Object>) enhanced.get("extra"))
                : new HashMap<>();
            extra.put("feePayer", feePayer);
            enhanced.put("extra", extra);
        }

        return enhanced;
    }

    /**
     * Creates payment requirements for an SVM payment.
     *
     * @param network Network identifier
     * @param payTo Recipient address
     * @param amount Amount in atomic units
     * @param asset Token mint address (null for default USDC)
     * @param maxTimeoutSeconds Maximum timeout in seconds
     * @param feePayer Optional fee payer address
     * @return Payment requirements map
     */
    public Map<String, Object> createPaymentRequirements(
            String network,
            String payTo,
            String amount,
            String asset,
            int maxTimeoutSeconds,
            String feePayer) {

        String normalized = SvmConstants.normalizeNetwork(network);
        String tokenAddress = asset != null ? asset : SvmConstants.getUsdcAddress(normalized);

        Map<String, Object> requirements = new HashMap<>();
        requirements.put("scheme", SCHEME);
        requirements.put("network", normalized);
        requirements.put("payTo", payTo);
        requirements.put("maxAmountRequired", amount);
        requirements.put("asset", tokenAddress);
        requirements.put("maxTimeoutSeconds", maxTimeoutSeconds);

        if (feePayer != null && !feePayer.isEmpty()) {
            Map<String, Object> extra = new HashMap<>();
            extra.put("feePayer", feePayer);
            requirements.put("extra", extra);
        }

        return requirements;
    }

    /**
     * Validates that payment requirements are valid for SVM.
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
        if (network == null || !SvmConstants.isSvmNetwork(network)) {
            return false;
        }

        String payTo = (String) requirements.get("payTo");
        if (payTo == null || payTo.isEmpty()) {
            return false;
        }

        return true;
    }
}
