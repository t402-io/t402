package io.t402.policy;

import java.math.BigInteger;
import java.util.List;

/**
 * Defines spending rules for AI agent payment guardrails.
 *
 * <p>All limits are optional — null means no limit. Addresses are compared case-insensitively.</p>
 *
 * <pre>{@code
 * PaymentPolicy policy = new PaymentPolicy.Builder()
 *     .maxAmountPerPayment(new BigInteger("1000000"))
 *     .maxAmountPerSession(new BigInteger("10000000"))
 *     .allowedNetworks(List.of("eip155:8453", "eip155:1"))
 *     .build();
 * }</pre>
 */
public class PaymentPolicy {
    private final BigInteger maxAmountPerPayment;
    private final BigInteger maxAmountPerSession;
    private final BigInteger maxAmountPerDay;
    private final Integer maxPaymentsPerHour;
    private final List<String> allowedRecipients;
    private final List<String> blockedRecipients;
    private final List<String> allowedNetworks;
    private final List<String> allowedSchemes;
    private final List<String> allowedAssets;
    private final List<PolicyRule> customRules;

    private PaymentPolicy(Builder builder) {
        this.maxAmountPerPayment = builder.maxAmountPerPayment;
        this.maxAmountPerSession = builder.maxAmountPerSession;
        this.maxAmountPerDay = builder.maxAmountPerDay;
        this.maxPaymentsPerHour = builder.maxPaymentsPerHour;
        this.allowedRecipients = builder.allowedRecipients;
        this.blockedRecipients = builder.blockedRecipients;
        this.allowedNetworks = builder.allowedNetworks;
        this.allowedSchemes = builder.allowedSchemes;
        this.allowedAssets = builder.allowedAssets;
        this.customRules = builder.customRules;
    }

    public BigInteger getMaxAmountPerPayment() { return maxAmountPerPayment; }
    public BigInteger getMaxAmountPerSession() { return maxAmountPerSession; }
    public BigInteger getMaxAmountPerDay() { return maxAmountPerDay; }
    public Integer getMaxPaymentsPerHour() { return maxPaymentsPerHour; }
    public List<String> getAllowedRecipients() { return allowedRecipients; }
    public List<String> getBlockedRecipients() { return blockedRecipients; }
    public List<String> getAllowedNetworks() { return allowedNetworks; }
    public List<String> getAllowedSchemes() { return allowedSchemes; }
    public List<String> getAllowedAssets() { return allowedAssets; }
    public List<PolicyRule> getCustomRules() { return customRules; }

    public static class Builder {
        private BigInteger maxAmountPerPayment;
        private BigInteger maxAmountPerSession;
        private BigInteger maxAmountPerDay;
        private Integer maxPaymentsPerHour;
        private List<String> allowedRecipients;
        private List<String> blockedRecipients;
        private List<String> allowedNetworks;
        private List<String> allowedSchemes;
        private List<String> allowedAssets;
        private List<PolicyRule> customRules;

        public Builder maxAmountPerPayment(BigInteger v) { this.maxAmountPerPayment = v; return this; }
        public Builder maxAmountPerSession(BigInteger v) { this.maxAmountPerSession = v; return this; }
        public Builder maxAmountPerDay(BigInteger v) { this.maxAmountPerDay = v; return this; }
        public Builder maxPaymentsPerHour(int v) { this.maxPaymentsPerHour = v; return this; }
        public Builder allowedRecipients(List<String> v) { this.allowedRecipients = v; return this; }
        public Builder blockedRecipients(List<String> v) { this.blockedRecipients = v; return this; }
        public Builder allowedNetworks(List<String> v) { this.allowedNetworks = v; return this; }
        public Builder allowedSchemes(List<String> v) { this.allowedSchemes = v; return this; }
        public Builder allowedAssets(List<String> v) { this.allowedAssets = v; return this; }
        public Builder customRules(List<PolicyRule> v) { this.customRules = v; return this; }
        public PaymentPolicy build() { return new PaymentPolicy(this); }
    }
}
