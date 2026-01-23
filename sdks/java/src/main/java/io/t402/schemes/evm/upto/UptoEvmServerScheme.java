package io.t402.schemes.evm.upto;

import io.t402.schemes.evm.EvmConstants;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Map;

/**
 * Server scheme for EVM payment processing using EIP-2612 Permit (Up-To scheme).
 *
 * <p>Handles parsing prices and generating payment requirements for the
 * up-to payment scheme on EVM-compatible chains. The requirements include
 * EIP-712 Permit domain information needed for client-side signing.</p>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * UptoEvmServerScheme scheme = new UptoEvmServerScheme("eip155:8453");
 *
 * // Simple usage with defaults
 * Map<String, Object> requirements = scheme.getPaymentRequirements(
 *     "1.50",                    // price in USDT/USDC
 *     "0xRecipientAddress...",   // recipient address
 *     "API Access"              // description
 * );
 *
 * // With router address for multi-hop settlement
 * Map<String, Object> requirements = scheme.getPaymentRequirements(
 *     "5.00",
 *     "0xRecipientAddress...",
 *     "0xFacilitatorAddress...",  // router/facilitator spender address
 *     "Premium API"
 * );
 * }</pre>
 *
 * <h2>Key Differences from Exact Scheme</h2>
 * <ul>
 *   <li>Includes routerAddress in extra (the permit spender/facilitator)</li>
 *   <li>Includes billing unit info (unit, unitPrice) when configured</li>
 *   <li>Amount represents the maximum that can be charged (partial settlement possible)</li>
 * </ul>
 */
public class UptoEvmServerScheme {

    /** The scheme identifier. */
    public static final String SCHEME = EvmConstants.SCHEME_UPTO;

    /** CAIP family pattern for EVM networks. */
    public static final String CAIP_FAMILY = EvmConstants.CAIP_FAMILY;

    private final String defaultNetwork;
    private String routerAddress;
    private String unit;
    private String unitPrice;

    /**
     * Creates a new UptoEvmServerScheme with Ethereum mainnet as default network.
     */
    public UptoEvmServerScheme() {
        this(EvmConstants.ETHEREUM_MAINNET);
    }

    /**
     * Creates a new UptoEvmServerScheme with specified default network.
     *
     * @param defaultNetwork Default network for payments (CAIP-2 format, e.g., "eip155:8453")
     * @throws IllegalArgumentException if network is not an EVM network
     */
    public UptoEvmServerScheme(String defaultNetwork) {
        String network = defaultNetwork != null ? defaultNetwork : EvmConstants.ETHEREUM_MAINNET;
        if (!EvmConstants.isEvmNetwork(network)) {
            throw new IllegalArgumentException("Not an EVM network: " + network);
        }
        this.defaultNetwork = network;
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
     * Sets the router/facilitator address used as the permit spender.
     *
     * @param routerAddress 0x-prefixed Ethereum address of the facilitator/router
     * @return this instance for chaining
     */
    public UptoEvmServerScheme withRouterAddress(String routerAddress) {
        this.routerAddress = routerAddress;
        return this;
    }

    /**
     * Sets the billing unit type.
     *
     * @param unit Unit type (e.g., "token", "request", "second")
     * @return this instance for chaining
     */
    public UptoEvmServerScheme withUnit(String unit) {
        this.unit = unit;
        return this;
    }

    /**
     * Sets the price per billing unit.
     *
     * @param unitPrice Price per unit in atomic token units
     * @return this instance for chaining
     */
    public UptoEvmServerScheme withUnitPrice(String unitPrice) {
        this.unitPrice = unitPrice;
        return this;
    }

    /**
     * Creates payment requirements with simplified parameters using default network.
     *
     * <p>Uses the default network and determines the appropriate token
     * for that network automatically.</p>
     *
     * @param price Price in decimal format (e.g., "1.50" for 1.50 USDT/USDC)
     * @param payTo Recipient Ethereum address (0x-prefixed)
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
     * @param price Price in decimal format (e.g., "1.50" for 1.50 USDT/USDC)
     * @param network Network identifier (CAIP-2 format, e.g., "eip155:8453")
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
        String tokenName = EvmConstants.getTokenName(network, tokenAddress);
        String tokenVersion = EvmConstants.getTokenVersion(network, tokenAddress);
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

        // Add EIP-712 Permit domain info and upto-specific fields as extra
        Map<String, Object> extra = new HashMap<>();
        extra.put("name", tokenName);
        extra.put("version", tokenVersion);
        extra.put("chainId", chainId);

        if (routerAddress != null && !routerAddress.isEmpty()) {
            extra.put("routerAddress", routerAddress);
        }
        if (unit != null && !unit.isEmpty()) {
            extra.put("unit", unit);
        }
        if (unitPrice != null && !unitPrice.isEmpty()) {
            extra.put("unitPrice", unitPrice);
        }

        requirements.put("extra", extra);

        return requirements;
    }

    /**
     * Creates payment requirements with explicit router/spender address.
     *
     * <p>Use this method when the permit spender (facilitator/router) is different
     * from the final payment recipient (payTo).</p>
     *
     * @param price Price in decimal format (e.g., "1.50" for 1.50 USDT/USDC)
     * @param payTo Recipient Ethereum address (0x-prefixed)
     * @param spenderAddress Router/facilitator address (the permit spender)
     * @param description Resource description
     * @return Payment requirements map ready to send to client
     */
    public Map<String, Object> getPaymentRequirementsWithSpender(
            String price,
            String payTo,
            String spenderAddress,
            String description) {

        Map<String, Object> requirements = getPaymentRequirements(price, defaultNetwork, payTo, description);

        // Override or add router address in extra
        @SuppressWarnings("unchecked")
        Map<String, Object> extra = (Map<String, Object>) requirements.get("extra");
        if (spenderAddress != null && !spenderAddress.isEmpty()) {
            extra.put("routerAddress", spenderAddress);
        }

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
     * @throws IllegalArgumentException if network is not an EVM network or has no supported token
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
     * @param amount Maximum amount in atomic units
     * @param asset Token contract address (null for default)
     * @param spenderAddress Router/facilitator address (permit spender, null for payTo)
     * @param maxTimeoutSeconds Maximum timeout in seconds
     * @return Payment requirements map
     */
    public Map<String, Object> createPaymentRequirements(
            String network,
            String payTo,
            String amount,
            String asset,
            String spenderAddress,
            int maxTimeoutSeconds) {

        if (!EvmConstants.isEvmNetwork(network)) {
            throw new IllegalArgumentException("Not an EVM network: " + network);
        }

        String tokenAddress = asset != null ? asset : EvmConstants.getDefaultTokenAddress(network);
        String tokenName = EvmConstants.getTokenName(network, tokenAddress);
        String tokenVersion = EvmConstants.getTokenVersion(network, tokenAddress);
        long chainId = EvmConstants.getChainId(network);

        Map<String, Object> requirements = new HashMap<>();
        requirements.put("scheme", SCHEME);
        requirements.put("network", network);
        requirements.put("payTo", payTo);
        requirements.put("maxAmountRequired", amount);
        requirements.put("asset", tokenAddress);
        requirements.put("maxTimeoutSeconds", maxTimeoutSeconds);

        // Add EIP-712 Permit domain info as extra
        Map<String, Object> extra = new HashMap<>();
        extra.put("name", tokenName);
        extra.put("version", tokenVersion);
        extra.put("chainId", chainId);

        if (spenderAddress != null && !spenderAddress.isEmpty()) {
            extra.put("routerAddress", spenderAddress);
        }
        if (unit != null && !unit.isEmpty()) {
            extra.put("unit", unit);
        }
        if (unitPrice != null && !unitPrice.isEmpty()) {
            extra.put("unitPrice", unitPrice);
        }

        requirements.put("extra", extra);

        return requirements;
    }

    /**
     * Validates that payment requirements are valid for the Up-To EVM scheme.
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

        return true;
    }
}
