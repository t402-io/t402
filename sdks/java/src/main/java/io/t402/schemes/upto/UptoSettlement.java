package io.t402.schemes.upto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Settlement request for the Up-To scheme.
 * <p>
 * Contains the actual amount to settle (which must be less than or equal
 * to the authorized maxAmount) and optional usage details for auditing.
 * </p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UptoSettlement {

    /** Actual amount to settle (must be <= maxAmount). */
    @JsonProperty("settleAmount")
    public String settleAmount;

    /** Optional usage details for auditing. */
    @JsonProperty("usageDetails")
    public UptoUsageDetails usageDetails;

    /** Default constructor for Jackson. */
    public UptoSettlement() {}

    /**
     * Creates a new settlement with the specified amount.
     *
     * @param settleAmount the amount to settle
     */
    public UptoSettlement(String settleAmount) {
        this.settleAmount = settleAmount;
    }

    /**
     * Builder-style method to add usage details.
     *
     * @param usageDetails usage tracking information
     * @return this instance for chaining
     */
    public UptoSettlement withUsageDetails(UptoUsageDetails usageDetails) {
        this.usageDetails = usageDetails;
        return this;
    }

    /**
     * Creates a new settlement with the specified amount.
     *
     * @param settleAmount the amount to settle
     * @return a new UptoSettlement instance
     */
    public static UptoSettlement of(String settleAmount) {
        return new UptoSettlement(settleAmount);
    }
}
