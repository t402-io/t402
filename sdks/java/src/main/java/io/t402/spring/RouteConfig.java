package io.t402.spring;

/**
 * Configuration for a single payment-protected route.
 *
 * <p>Used in the {@code t402.routes} configuration to define per-route pricing.</p>
 *
 * <h3>Configuration Example</h3>
 * <pre>{@code
 * t402:
 *   routes:
 *     - path: /api/premium/**
 *       amount: "1000000"      # 1.00 USDC
 *       description: "Premium API access"
 *     - path: /api/report
 *       amount: "$0.50"        # Dollar notation
 *       network: eip155:8453
 *     - path: /api/basic/*
 *       amount: "10000"        # 0.01 USDC
 * }</pre>
 *
 * @see T402Properties
 */
public class RouteConfig {

    /**
     * URL path pattern to match. Supports Ant-style patterns.
     *
     * <p>Examples:</p>
     * <ul>
     *   <li>{@code /api/premium} - Exact match</li>
     *   <li>{@code /api/premium/*} - Single path segment wildcard</li>
     *   <li>{@code /api/premium/**} - Multi-segment wildcard</li>
     *   <li>{@code /api/*.json} - Extension matching</li>
     * </ul>
     */
    private String path;

    /**
     * Payment amount in atomic units or dollar notation.
     *
     * <p>Formats:</p>
     * <ul>
     *   <li>{@code "10000"} - Atomic units (0.01 USDC)</li>
     *   <li>{@code "$0.01"} - Dollar notation</li>
     *   <li>{@code "0.01"} - Decimal notation</li>
     * </ul>
     */
    private String amount;

    /**
     * Optional token asset address. If not specified, uses the global default.
     */
    private String asset;

    /**
     * Optional network identifier in CAIP-2 format. If not specified, uses the global default.
     */
    private String network;

    /**
     * Optional payment scheme. Defaults to "exact".
     */
    private String scheme = "exact";

    /**
     * Optional description of what the payment is for.
     */
    private String description;

    /**
     * Optional maximum timeout in seconds. If not specified, uses the global default.
     */
    private Integer maxTimeoutSeconds;

    /**
     * Whether this route is enabled. Defaults to true.
     */
    private boolean enabled = true;

    // Getters and setters

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }

    public String getAmount() {
        return amount;
    }

    public void setAmount(String amount) {
        this.amount = amount;
    }

    public String getAsset() {
        return asset;
    }

    public void setAsset(String asset) {
        this.asset = asset;
    }

    public String getNetwork() {
        return network;
    }

    public void setNetwork(String network) {
        this.network = network;
    }

    public String getScheme() {
        return scheme;
    }

    public void setScheme(String scheme) {
        this.scheme = scheme;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Integer getMaxTimeoutSeconds() {
        return maxTimeoutSeconds;
    }

    public void setMaxTimeoutSeconds(Integer maxTimeoutSeconds) {
        this.maxTimeoutSeconds = maxTimeoutSeconds;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }
}
