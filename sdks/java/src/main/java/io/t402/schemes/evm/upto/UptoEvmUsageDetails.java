package io.t402.schemes.evm.upto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * EVM-specific usage details for settlement auditing.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UptoEvmUsageDetails {

    /** Number of units consumed. */
    @JsonProperty("unitsConsumed")
    public Integer unitsConsumed;

    /** Price per unit used. */
    @JsonProperty("unitPrice")
    public String unitPrice;

    /** Type of unit. */
    @JsonProperty("unitType")
    public String unitType;

    /** Start timestamp of the usage period (Unix seconds). */
    @JsonProperty("startTime")
    public Long startTime;

    /** End timestamp of the usage period (Unix seconds). */
    @JsonProperty("endTime")
    public Long endTime;

    /** Default constructor for Jackson. */
    public UptoEvmUsageDetails() {}

    /**
     * Creates a new UptoEvmUsageDetails with basic fields.
     *
     * @param unitsConsumed number of units consumed
     * @param unitPrice price per unit
     * @param unitType type of unit
     */
    public UptoEvmUsageDetails(int unitsConsumed, String unitPrice, String unitType) {
        this.unitsConsumed = unitsConsumed;
        this.unitPrice = unitPrice;
        this.unitType = unitType;
    }

    /**
     * Builder-style method to set time range.
     *
     * @param startTime start timestamp
     * @param endTime end timestamp
     * @return this instance for chaining
     */
    public UptoEvmUsageDetails withTimeRange(long startTime, long endTime) {
        this.startTime = startTime;
        this.endTime = endTime;
        return this;
    }

    /**
     * Creates a new UptoEvmUsageDetails with basic fields.
     *
     * @param unitsConsumed number of units consumed
     * @param unitPrice price per unit
     * @param unitType type of unit
     * @return a new UptoEvmUsageDetails instance
     */
    public static UptoEvmUsageDetails of(int unitsConsumed, String unitPrice, String unitType) {
        return new UptoEvmUsageDetails(unitsConsumed, unitPrice, unitType);
    }
}
