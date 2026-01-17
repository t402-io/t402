package io.t402.schemes.evm.upto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * EVM-specific settlement request for the Up-To scheme.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UptoEvmSettlement {

    /** Actual amount to settle (must be <= maxAmount). */
    @JsonProperty("settleAmount")
    public String settleAmount;

    /** Optional usage details for auditing. */
    @JsonProperty("usageDetails")
    public UptoEvmUsageDetails usageDetails;

    /** Default constructor for Jackson. */
    public UptoEvmSettlement() {}

    /**
     * Creates a new settlement with the specified amount.
     *
     * @param settleAmount the amount to settle
     */
    public UptoEvmSettlement(String settleAmount) {
        this.settleAmount = settleAmount;
    }

    /**
     * Builder-style method to add usage details.
     *
     * @param usageDetails usage tracking information
     * @return this instance for chaining
     */
    public UptoEvmSettlement withUsageDetails(UptoEvmUsageDetails usageDetails) {
        this.usageDetails = usageDetails;
        return this;
    }

    /**
     * Creates a new settlement with the specified amount.
     *
     * @param settleAmount the amount to settle
     * @return a new UptoEvmSettlement instance
     */
    public static UptoEvmSettlement of(String settleAmount) {
        return new UptoEvmSettlement(settleAmount);
    }
}
