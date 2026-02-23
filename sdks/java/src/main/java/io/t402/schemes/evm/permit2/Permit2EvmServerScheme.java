package io.t402.schemes.evm.permit2;

import io.t402.schemes.evm.EvmConstants;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Map;

/**
 * Server scheme for Permit2 EVM payment processing.
 *
 * <p>Handles parsing prices and generating payment requirements
 * for the permit2 payment scheme on EVM-compatible chains.</p>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * Permit2EvmServerScheme scheme = new Permit2EvmServerScheme("eip155:8453");
 *
 * Map<String, Object> requirements = scheme.getPaymentRequirements(
 *     "1.50", "0xRecipientAddress...", "API Access"
 * );
 * }</pre>
 */
public class Permit2EvmServerScheme {

    public static final String SCHEME = Permit2Constants.SCHEME_PERMIT2;
    public static final String CAIP_FAMILY = Permit2Constants.CAIP_FAMILY;

    private final String defaultNetwork;

    public Permit2EvmServerScheme() {
        this(EvmConstants.ETHEREUM_MAINNET);
    }

    /**
     * Creates a new Permit2EvmServerScheme with specified default network.
     *
     * @param defaultNetwork Default network for payments (CAIP-2 format)
     * @throws IllegalArgumentException if network is not an EVM network
     */
    public Permit2EvmServerScheme(String defaultNetwork) {
        String network = defaultNetwork != null ? defaultNetwork : EvmConstants.ETHEREUM_MAINNET;
        if (!EvmConstants.isEvmNetwork(network)) {
            throw new IllegalArgumentException("Not an EVM network: " + network);
        }
        this.defaultNetwork = network;
    }

    public String getDefaultNetwork() {
        return defaultNetwork;
    }

    /**
     * Creates payment requirements with simplified parameters.
     *
     * @param price Price in decimal format (e.g., "1.50")
     * @param payTo Recipient Ethereum address
     * @param description Resource description
     * @return Payment requirements map
     */
    public Map<String, Object> getPaymentRequirements(String price, String payTo, String description) {
        return getPaymentRequirements(price, defaultNetwork, payTo, description);
    }

    /**
     * Creates payment requirements with network override.
     *
     * @param price Price in decimal format
     * @param network Network identifier (CAIP-2 format)
     * @param payTo Recipient Ethereum address
     * @param description Resource description
     * @return Payment requirements map
     */
    public Map<String, Object> getPaymentRequirements(
            String price, String network, String payTo, String description) {

        if (!EvmConstants.isEvmNetwork(network)) {
            throw new IllegalArgumentException("Not an EVM network: " + network);
        }

        Map<String, Object> priceInfo = parsePrice(price, network);

        Map<String, Object> requirements = new HashMap<>();
        requirements.put("t402Version", 2);
        requirements.put("scheme", SCHEME);
        requirements.put("network", network);
        requirements.put("payTo", payTo);
        requirements.put("maxAmountRequired", priceInfo.get("amount"));
        requirements.put("asset", priceInfo.get("asset"));
        requirements.put("maxTimeoutSeconds", EvmConstants.DEFAULT_VALIDITY_DURATION);
        requirements.put("resource", description);

        // Add Permit2-specific extra
        Map<String, Object> extra = new HashMap<>();
        extra.put("permit2Address", Permit2Constants.PERMIT2_ADDRESS);
        requirements.put("extra", extra);

        return requirements;
    }

    /**
     * Parses a price string into amount and asset info.
     *
     * @param price Price string (e.g., "1.50" or "1500000")
     * @param network Network identifier (CAIP-2 format)
     * @return Map with amount, asset, decimals, symbol
     */
    public Map<String, Object> parsePrice(String price, String network) {
        if (!EvmConstants.isEvmNetwork(network)) {
            throw new IllegalArgumentException("Not an EVM network: " + network);
        }

        String tokenAddress = EvmConstants.getDefaultTokenAddress(network);
        int decimals = EvmConstants.TOKEN_DECIMALS;
        String symbol = EvmConstants.USDT0_ADDRESSES.containsKey(network) ? "USDT0" : "USDC";

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
        result.put("asset", tokenAddress);
        result.put("decimals", decimals);
        result.put("symbol", symbol);

        return result;
    }

    /**
     * Validates that payment requirements are valid for Permit2.
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
        if (network == null || !EvmConstants.isEvmNetwork(network)) {
            return false;
        }
        String payTo = (String) requirements.get("payTo");
        if (payTo == null || payTo.isEmpty()) {
            return false;
        }
        return true;
    }
}
