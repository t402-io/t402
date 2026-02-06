package io.t402.schemes.ton.upto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * TON-specific extra fields for the Up-To scheme.
 *
 * <p>Included in PaymentRequirements.extra to provide upto-specific parameters
 * for the escrow-based billing pattern on TON.</p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UptoTonExtra {

    /** Facilitator address that will receive the initial transfer. */
    public String facilitator;

    /** Maximum payment amount authorized. */
    @JsonProperty("maxAmount")
    public String maxAmount;

    /** Minimum acceptable settlement amount. */
    @JsonProperty("minAmount")
    public String minAmount;

    /** Billing unit type (e.g., "token", "request", "second"). */
    public String unit;

    /** Price per unit in smallest denomination. */
    @JsonProperty("unitPrice")
    public String unitPrice;

    /** Default constructor for Jackson. */
    public UptoTonExtra() {}

    /**
     * Creates a new UptoTonExtra with facilitator address.
     *
     * @param facilitator facilitator holding address
     */
    public UptoTonExtra(String facilitator) {
        this.facilitator = facilitator;
    }

    /**
     * Builder-style method to set facilitator address.
     *
     * @param facilitator facilitator holding address
     * @return this instance for chaining
     */
    public UptoTonExtra withFacilitator(String facilitator) {
        this.facilitator = facilitator;
        return this;
    }

    /**
     * Builder-style method to set maximum amount.
     *
     * @param maxAmount maximum payment amount
     * @return this instance for chaining
     */
    public UptoTonExtra withMaxAmount(String maxAmount) {
        this.maxAmount = maxAmount;
        return this;
    }

    /**
     * Builder-style method to set minimum amount.
     *
     * @param minAmount minimum settlement amount
     * @return this instance for chaining
     */
    public UptoTonExtra withMinAmount(String minAmount) {
        this.minAmount = minAmount;
        return this;
    }

    /**
     * Builder-style method to set billing unit.
     *
     * @param unit billing unit type
     * @return this instance for chaining
     */
    public UptoTonExtra withUnit(String unit) {
        this.unit = unit;
        return this;
    }

    /**
     * Builder-style method to set unit price.
     *
     * @param unitPrice price per unit
     * @return this instance for chaining
     */
    public UptoTonExtra withUnitPrice(String unitPrice) {
        this.unitPrice = unitPrice;
        return this;
    }
}
