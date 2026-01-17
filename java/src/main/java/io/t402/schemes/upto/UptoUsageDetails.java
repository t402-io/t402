package io.t402.schemes.upto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

/**
 * Usage details for settlement auditing.
 * <p>
 * Tracks consumption metrics that justify the settlement amount.
 * </p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UptoUsageDetails {

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

    /** Additional usage metadata. */
    public Map<String, Object> metadata;

    /** Default constructor for Jackson. */
    public UptoUsageDetails() {}

    /**
     * Creates a new UptoUsageDetails with basic fields.
     *
     * @param unitsConsumed number of units consumed
     * @param unitPrice price per unit
     * @param unitType type of unit
     */
    public UptoUsageDetails(int unitsConsumed, String unitPrice, String unitType) {
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
    public UptoUsageDetails withTimeRange(long startTime, long endTime) {
        this.startTime = startTime;
        this.endTime = endTime;
        return this;
    }

    /**
     * Builder-style method to set metadata.
     *
     * @param metadata additional metadata
     * @return this instance for chaining
     */
    public UptoUsageDetails withMetadata(Map<String, Object> metadata) {
        this.metadata = metadata;
        return this;
    }

    /**
     * Creates a new UptoUsageDetails with basic fields.
     *
     * @param unitsConsumed number of units consumed
     * @param unitPrice price per unit
     * @param unitType type of unit
     * @return a new UptoUsageDetails instance
     */
    public static UptoUsageDetails of(int unitsConsumed, String unitPrice, String unitType) {
        return new UptoUsageDetails(unitsConsumed, unitPrice, unitType);
    }
}
