package io.t402.spring;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.List;

/**
 * Configuration properties for T402 payment integration.
 *
 * <h3>Basic Configuration</h3>
 * <pre>{@code
 * t402:
 *   enabled: true
 *   facilitator-url: https://facilitator.t402.io
 *   network: eip155:8453
 *   pay-to: "0xYourWalletAddress"
 *   asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
 * }</pre>
 *
 * <h3>Route-Based Pricing</h3>
 * <pre>{@code
 * t402:
 *   enabled: true
 *   pay-to: "0xYourWalletAddress"
 *   routes:
 *     - path: /api/premium/**
 *       amount: "1000000"      # 1.00 USDC
 *       description: "Premium API access"
 *     - path: /api/report
 *       amount: "$0.50"        # Dollar notation
 *     - path: /api/basic/*
 *       amount: "10000"        # 0.01 USDC
 * }</pre>
 *
 * <h3>Amount Formats</h3>
 * <ul>
 *   <li>{@code "10000"} - Atomic units (10000 = 0.01 USDC with 6 decimals)</li>
 *   <li>{@code "$0.01"} - Dollar notation (automatically converted)</li>
 *   <li>{@code "0.01"} - Decimal notation (automatically converted)</li>
 * </ul>
 *
 * @see RouteConfig
 * @see T402AutoConfiguration
 */
@ConfigurationProperties(prefix = "t402")
public class T402Properties {

    /**
     * Whether T402 payment protection is enabled.
     */
    private boolean enabled = false;

    /**
     * URL of the T402 facilitator service for payment verification and settlement.
     */
    private String facilitatorUrl = "https://facilitator.t402.io";

    /**
     * Network identifier in CAIP-2 format (e.g., "eip155:8453" for Base).
     */
    private String network = "eip155:8453";

    /**
     * Address to receive payments.
     */
    private String payTo;

    /**
     * Token contract address for payments.
     */
    private String asset = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";  // USDC on Base

    /**
     * Token name for EIP-712 domain (e.g., "USD Coin").
     */
    private String tokenName = "USD Coin";

    /**
     * Token version for EIP-712 domain (e.g., "2").
     */
    private String tokenVersion = "2";

    /**
     * Number of decimal places for the token (default: 6 for USDC).
     */
    private int tokenDecimals = 6;

    /**
     * Default payment scheme.
     */
    private String scheme = "exact";

    /**
     * Maximum timeout for payments in seconds.
     */
    private int maxTimeoutSeconds = 3600;

    /**
     * Route-specific payment configurations.
     */
    private List<RouteConfig> routes = new ArrayList<>();

    /**
     * Default amount for endpoints using @RequirePayment without amount.
     * Specified in atomic units.
     */
    private String defaultAmount = "10000";  // 0.01 USDC

    // ========== Helper methods ==========

    /**
     * Parses an amount string to atomic units.
     *
     * <p>Supports formats:</p>
     * <ul>
     *   <li>{@code "10000"} - Already in atomic units</li>
     *   <li>{@code "$0.01"} - Dollar notation</li>
     *   <li>{@code "0.01"} - Decimal notation</li>
     * </ul>
     *
     * @param amount the amount string to parse
     * @return the amount in atomic units
     */
    public BigInteger parseAmount(String amount) {
        if (amount == null || amount.isEmpty()) {
            return parseAmount(defaultAmount);
        }

        String trimmed = amount.trim();

        // Dollar notation: $0.01, $1.50
        if (trimmed.startsWith("$")) {
            String value = trimmed.substring(1);
            return decimalToAtomicUnits(value);
        }

        // Check if it contains a decimal point
        if (trimmed.contains(".")) {
            return decimalToAtomicUnits(trimmed);
        }

        // Already in atomic units
        return new BigInteger(trimmed);
    }

    /**
     * Converts a decimal string to atomic units based on token decimals.
     */
    private BigInteger decimalToAtomicUnits(String decimal) {
        BigDecimal bd = new BigDecimal(decimal);
        BigDecimal multiplier = BigDecimal.TEN.pow(tokenDecimals);
        return bd.multiply(multiplier).toBigInteger();
    }

    // ========== Getters and setters ==========

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getFacilitatorUrl() {
        return facilitatorUrl;
    }

    public void setFacilitatorUrl(String facilitatorUrl) {
        this.facilitatorUrl = facilitatorUrl;
    }

    public String getNetwork() {
        return network;
    }

    public void setNetwork(String network) {
        this.network = network;
    }

    public String getPayTo() {
        return payTo;
    }

    public void setPayTo(String payTo) {
        this.payTo = payTo;
    }

    public String getAsset() {
        return asset;
    }

    public void setAsset(String asset) {
        this.asset = asset;
    }

    public String getTokenName() {
        return tokenName;
    }

    public void setTokenName(String tokenName) {
        this.tokenName = tokenName;
    }

    public String getTokenVersion() {
        return tokenVersion;
    }

    public void setTokenVersion(String tokenVersion) {
        this.tokenVersion = tokenVersion;
    }

    public int getTokenDecimals() {
        return tokenDecimals;
    }

    public void setTokenDecimals(int tokenDecimals) {
        this.tokenDecimals = tokenDecimals;
    }

    public String getScheme() {
        return scheme;
    }

    public void setScheme(String scheme) {
        this.scheme = scheme;
    }

    public int getMaxTimeoutSeconds() {
        return maxTimeoutSeconds;
    }

    public void setMaxTimeoutSeconds(int maxTimeoutSeconds) {
        this.maxTimeoutSeconds = maxTimeoutSeconds;
    }

    public List<RouteConfig> getRoutes() {
        return routes;
    }

    public void setRoutes(List<RouteConfig> routes) {
        this.routes = routes;
    }

    public String getDefaultAmount() {
        return defaultAmount;
    }

    public void setDefaultAmount(String defaultAmount) {
        this.defaultAmount = defaultAmount;
    }
}
