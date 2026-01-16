package io.t402.spring;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuration properties for T402 payment integration.
 *
 * <p>Example configuration in application.yml:</p>
 * <pre>{@code
 * t402:
 *   facilitator-url: https://facilitator.t402.io
 *   network: eip155:8453
 *   pay-to: "0x..."
 *   asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
 *   token-name: "USD Coin"
 *   token-version: "2"
 * }</pre>
 */
@ConfigurationProperties(prefix = "t402")
public class T402Properties {

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
    private String asset;

    /**
     * Token name for EIP-712 domain (e.g., "USD Coin").
     */
    private String tokenName = "USD Coin";

    /**
     * Token version for EIP-712 domain (e.g., "2").
     */
    private String tokenVersion = "2";

    /**
     * Default payment scheme.
     */
    private String scheme = "exact";

    /**
     * Maximum timeout for payments in seconds.
     */
    private int maxTimeoutSeconds = 3600;

    // Getters and setters

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
}
