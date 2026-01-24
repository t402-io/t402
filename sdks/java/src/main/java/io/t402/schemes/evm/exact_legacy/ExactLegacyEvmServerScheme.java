package io.t402.schemes.evm.exact_legacy;

import io.t402.schemes.evm.EvmConstants;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Map;

/**
 * Server scheme for EVM payment processing using the approve + transferFrom pattern.
 *
 * <p>Handles parsing prices and generating payment requirements for the
 * exact-legacy payment scheme on EVM-compatible chains. This scheme adds
 * spender (facilitator address), tokenType ("legacy"), and EIP-712 domain
 * info to the payment requirements.</p>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * ExactLegacyEvmServerScheme scheme = new ExactLegacyEvmServerScheme(
 *     "eip155:1", "0xFacilitatorAddress..."
 * );
 *
 * // Simple usage with defaults
 * Map<String, Object> requirements = scheme.getPaymentRequirements(
 *     "1.50",                    // price in USDT
 *     "0xRecipientAddress...",   // recipient address
 *     "API Access"              // description
 * );
 *
 * // Parse a price
 * Map<String, Object> priceInfo = scheme.parsePrice("1.50", "eip155:1");
 * }</pre>
 */
public class ExactLegacyEvmServerScheme {

    /** The scheme identifier. */
    public static final String SCHEME = "exact-legacy";

    /** CAIP family pattern for EVM networks. */
    public static final String CAIP_FAMILY = EvmConstants.CAIP_FAMILY;

    /** Default EIP-712 domain name for legacy transfers. */
    public static final String DEFAULT_DOMAIN_NAME = "T402LegacyTransfer";

    /** Default EIP-712 domain version for legacy transfers. */
    public static final String DEFAULT_DOMAIN_VERSION = "1";

    private final String defaultNetwork;
    private final String facilitatorAddress;

    /**
     * Creates a new ExactLegacyEvmServerScheme with Ethereum mainnet as default.
     *
     * @param facilitatorAddress The facilitator (spender) address
     * @throws IllegalArgumentException if facilitatorAddress is null or empty
     */
    public ExactLegacyEvmServerScheme(String facilitatorAddress) {
        this(EvmConstants.ETHEREUM_MAINNET, facilitatorAddress);
    }

    /**
     * Creates a new ExactLegacyEvmServerScheme with specified default network.
     *
     * @param defaultNetwork Default network for payments (CAIP-2 format, e.g., "eip155:1")
     * @param facilitatorAddress The facilitator (spender) address
     * @throws IllegalArgumentException if network is not an EVM network or facilitatorAddress is null
     */
    public ExactLegacyEvmServerScheme(String defaultNetwork, String facilitatorAddress) {
        String network = defaultNetwork != null ? defaultNetwork : EvmConstants.ETHEREUM_MAINNET;
        if (!EvmConstants.isEvmNetwork(network)) {
            throw new IllegalArgumentException("Not an EVM network: " + network);
        }
        if (facilitatorAddress == null || facilitatorAddress.isEmpty()) {
            throw new IllegalArgumentException("Facilitator address is required");
        }
        this.defaultNetwork = network;
        this.facilitatorAddress = facilitatorAddress;
    }

    /**
     * Gets the default network for this server scheme.
     *
     * @return Default network identifier (CAIP-2 format)
     */
    public String getDefaultNetwork() {
        return defaultNetwork;
    }

    /**
     * Gets the facilitator (spender) address.
     *
     * @return 0x-prefixed Ethereum address
     */
    public String getFacilitatorAddress() {
        return facilitatorAddress;
    }

    /**
     * Creates payment requirements with simplified parameters.
     *
     * @param price Price in decimal format (e.g., "1.50" for 1.50 USDT)
     * @param payTo Recipient Ethereum address (0x-prefixed)
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
     * @param network Network identifier (CAIP-2 format, e.g., "eip155:1")
     * @param payTo Recipient Ethereum address (0x-prefixed)
     * @param description Resource description
     * @return Payment requirements map ready to send to client
     * @throws IllegalArgumentException if network is not supported
     */
    public Map<String, Object> getPaymentRequirements(
            String price,
            String network,
            String payTo,
            String description) {

        if (!EvmConstants.isEvmNetwork(network)) {
            throw new IllegalArgumentException("Not an EVM network: " + network);
        }

        Map<String, Object> priceInfo = parsePrice(price, network);

        String tokenAddress = (String) priceInfo.get("asset");
        long chainId = EvmConstants.getChainId(network);

        Map<String, Object> requirements = new HashMap<>();
        requirements.put("t402Version", 2);
        requirements.put("scheme", SCHEME);
        requirements.put("network", network);
        requirements.put("payTo", payTo);
        requirements.put("maxAmountRequired", priceInfo.get("amount"));
        requirements.put("asset", tokenAddress);
        requirements.put("maxTimeoutSeconds", EvmConstants.DEFAULT_VALIDITY_DURATION);
        requirements.put("resource", description);

        // Add legacy-specific extra fields
        Map<String, Object> extra = new HashMap<>();
        extra.put("spender", facilitatorAddress);
        extra.put("tokenType", "legacy");
        extra.put("name", DEFAULT_DOMAIN_NAME);
        extra.put("version", DEFAULT_DOMAIN_VERSION);
        extra.put("chainId", chainId);
        requirements.put("extra", extra);

        return requirements;
    }

    /**
     * Parses a price string into amount and asset info.
     *
     * <p>If the price contains a decimal point, it is treated as a human-readable
     * amount and converted to atomic units (multiplied by 10^decimals).
     * If it is a plain integer, it is treated as already in atomic units.</p>
     *
     * @param price Price string (e.g., "1.50" or "1500000")
     * @param network Network identifier (CAIP-2 format)
     * @return Map with amount (in atomic units), asset, decimals, and symbol
     * @throws IllegalArgumentException if network is not an EVM network
     */
    public Map<String, Object> parsePrice(String price, String network) {
        if (!EvmConstants.isEvmNetwork(network)) {
            throw new IllegalArgumentException("Not an EVM network: " + network);
        }

        String tokenAddress = EvmConstants.getDefaultTokenAddress(network);
        int decimals = EvmConstants.TOKEN_DECIMALS;

        // Determine symbol based on which address map contains the token
        String symbol = EvmConstants.USDT0_ADDRESSES.containsKey(network) ? "USDT0" : "USDC";

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
        result.put("asset", tokenAddress);
        result.put("decimals", decimals);
        result.put("symbol", symbol);

        return result;
    }

    /**
     * Creates payment requirements with full control over all parameters.
     *
     * @param network Network identifier (CAIP-2 format)
     * @param payTo Recipient Ethereum address (0x-prefixed)
     * @param amount Amount in atomic units
     * @param asset Token contract address (null for default)
     * @param maxTimeoutSeconds Maximum timeout in seconds
     * @return Payment requirements map
     */
    public Map<String, Object> createPaymentRequirements(
            String network,
            String payTo,
            String amount,
            String asset,
            int maxTimeoutSeconds) {

        if (!EvmConstants.isEvmNetwork(network)) {
            throw new IllegalArgumentException("Not an EVM network: " + network);
        }

        String tokenAddress = asset != null ? asset : EvmConstants.getDefaultTokenAddress(network);
        long chainId = EvmConstants.getChainId(network);

        Map<String, Object> requirements = new HashMap<>();
        requirements.put("scheme", SCHEME);
        requirements.put("network", network);
        requirements.put("payTo", payTo);
        requirements.put("maxAmountRequired", amount);
        requirements.put("asset", tokenAddress);
        requirements.put("maxTimeoutSeconds", maxTimeoutSeconds);

        // Add legacy-specific extra fields
        Map<String, Object> extra = new HashMap<>();
        extra.put("spender", facilitatorAddress);
        extra.put("tokenType", "legacy");
        extra.put("name", DEFAULT_DOMAIN_NAME);
        extra.put("version", DEFAULT_DOMAIN_VERSION);
        extra.put("chainId", chainId);
        requirements.put("extra", extra);

        return requirements;
    }

    /**
     * Validates that payment requirements are valid for EVM exact-legacy.
     *
     * @param requirements Payment requirements to validate
     * @return true if valid
     */
    @SuppressWarnings("unchecked")
    public boolean validateRequirements(Map<String, Object> requirements) {
        if (requirements == null) {
            return false;
        }

        // Check scheme
        if (!SCHEME.equals(requirements.get("scheme"))) {
            return false;
        }

        // Check network is EVM
        String network = (String) requirements.get("network");
        if (network == null || !EvmConstants.isEvmNetwork(network)) {
            return false;
        }

        // Check payTo
        String payTo = (String) requirements.get("payTo");
        if (payTo == null || payTo.isEmpty()) {
            return false;
        }

        // Check extra has spender
        Object extraObj = requirements.get("extra");
        if (extraObj instanceof Map) {
            Map<String, Object> extra = (Map<String, Object>) extraObj;
            String spender = (String) extra.get("spender");
            if (spender == null || spender.isEmpty()) {
                return false;
            }
        } else {
            return false;
        }

        return true;
    }
}
