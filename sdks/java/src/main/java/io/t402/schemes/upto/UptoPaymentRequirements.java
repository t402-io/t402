package io.t402.schemes.upto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Payment requirements for the Up-To scheme.
 * <p>
 * The upto scheme authorizes transfer of up to a maximum amount,
 * enabling usage-based billing where the final settlement amount
 * is determined by actual usage.
 * </p>
 *
 * <h3>Example</h3>
 * <pre>{@code
 * UptoPaymentRequirements requirements = new UptoPaymentRequirements.Builder()
 *     .network("eip155:8453")
 *     .maxAmount("1000000")  // $1.00 in USDC
 *     .minAmount("10000")    // $0.01 minimum
 *     .asset("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")
 *     .payTo("0x...")
 *     .maxTimeoutSeconds(300)
 *     .extra(new UptoExtra("token", "100"))
 *     .build();
 * }</pre>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UptoPaymentRequirements {

    /** Payment scheme identifier (always "upto"). */
    public String scheme = UptoConstants.SCHEME;

    /** Blockchain network in CAIP-2 format (e.g., "eip155:8453" for Base mainnet). */
    public String network;

    /** Maximum amount the client authorizes (in smallest denomination). */
    @JsonProperty("maxAmount")
    public String maxAmount;

    /** Minimum settlement amount (prevents dust payments). Optional. */
    @JsonProperty("minAmount")
    public String minAmount;

    /** Token contract address or asset identifier. */
    public String asset;

    /** Recipient wallet address. */
    @JsonProperty("payTo")
    public String payTo;

    /** Maximum time allowed for payment completion in seconds. */
    @JsonProperty("maxTimeoutSeconds")
    public int maxTimeoutSeconds;

    /** Scheme-specific additional information. */
    public UptoExtra extra;

    /** Default constructor for Jackson. */
    public UptoPaymentRequirements() {}

    /**
     * Creates a new UptoPaymentRequirements with the specified parameters.
     *
     * @param network blockchain network in CAIP-2 format
     * @param maxAmount maximum authorized amount
     * @param asset token contract address
     * @param payTo recipient address
     * @param maxTimeoutSeconds maximum timeout
     */
    public UptoPaymentRequirements(String network, String maxAmount, String asset,
                                    String payTo, int maxTimeoutSeconds) {
        this.scheme = UptoConstants.SCHEME;
        this.network = network;
        this.maxAmount = maxAmount;
        this.minAmount = UptoConstants.DEFAULT_MIN_AMOUNT;
        this.asset = asset;
        this.payTo = payTo;
        this.maxTimeoutSeconds = maxTimeoutSeconds;
    }

    /**
     * Builder-style method to set extra data.
     *
     * @param extra scheme-specific additional information
     * @return this instance for chaining
     */
    public UptoPaymentRequirements withExtra(UptoExtra extra) {
        this.extra = extra;
        return this;
    }

    /**
     * Builder-style method to set minimum amount.
     *
     * @param minAmount minimum settlement amount
     * @return this instance for chaining
     */
    public UptoPaymentRequirements withMinAmount(String minAmount) {
        this.minAmount = minAmount;
        return this;
    }

    /**
     * Creates a new builder for UptoPaymentRequirements.
     *
     * @return a new builder instance
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder for creating UptoPaymentRequirements instances.
     */
    public static class Builder {
        private String network;
        private String maxAmount;
        private String minAmount = UptoConstants.DEFAULT_MIN_AMOUNT;
        private String asset;
        private String payTo;
        private int maxTimeoutSeconds = UptoConstants.DEFAULT_MAX_TIMEOUT_SECONDS;
        private UptoExtra extra;

        public Builder network(String network) {
            this.network = network;
            return this;
        }

        public Builder maxAmount(String maxAmount) {
            this.maxAmount = maxAmount;
            return this;
        }

        public Builder minAmount(String minAmount) {
            this.minAmount = minAmount;
            return this;
        }

        public Builder asset(String asset) {
            this.asset = asset;
            return this;
        }

        public Builder payTo(String payTo) {
            this.payTo = payTo;
            return this;
        }

        public Builder maxTimeoutSeconds(int maxTimeoutSeconds) {
            this.maxTimeoutSeconds = maxTimeoutSeconds;
            return this;
        }

        public Builder extra(UptoExtra extra) {
            this.extra = extra;
            return this;
        }

        public UptoPaymentRequirements build() {
            UptoPaymentRequirements req = new UptoPaymentRequirements(
                network, maxAmount, asset, payTo, maxTimeoutSeconds
            );
            req.minAmount = minAmount;
            req.extra = extra;
            return req;
        }
    }
}
