package io.t402.schemes.near.upto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * NEAR-specific extra fields for the Up-To scheme.
 *
 * <p>Contains the facilitator account and billing configuration parameters
 * included in the PaymentRequirements.extra field for NEAR upto payments.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UptoNearExtra {

    /** Facilitator account ID that will receive the initial transfer. */
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
    public UptoNearExtra() {}

    /**
     * Creates a new UptoNearExtra with facilitator account.
     *
     * @param facilitator Facilitator's NEAR account ID
     */
    public UptoNearExtra(String facilitator) {
        this.facilitator = facilitator;
    }

    /**
     * Creates a new UptoNearExtra with facilitator and amount bounds.
     *
     * @param facilitator Facilitator's NEAR account ID
     * @param maxAmount Maximum payment amount
     * @param minAmount Minimum settlement amount
     */
    public UptoNearExtra(String facilitator, String maxAmount, String minAmount) {
        this.facilitator = facilitator;
        this.maxAmount = maxAmount;
        this.minAmount = minAmount;
    }

    /**
     * Builder-style method to set billing unit.
     *
     * @param unit Billing unit type
     * @return this instance for chaining
     */
    public UptoNearExtra withUnit(String unit) {
        this.unit = unit;
        return this;
    }

    /**
     * Builder-style method to set unit price.
     *
     * @param unitPrice Price per unit
     * @return this instance for chaining
     */
    public UptoNearExtra withUnitPrice(String unitPrice) {
        this.unitPrice = unitPrice;
        return this;
    }

    /**
     * Builder-style method to set max amount.
     *
     * @param maxAmount Maximum payment amount
     * @return this instance for chaining
     */
    public UptoNearExtra withMaxAmount(String maxAmount) {
        this.maxAmount = maxAmount;
        return this;
    }

    /**
     * Builder-style method to set min amount.
     *
     * @param minAmount Minimum settlement amount
     * @return this instance for chaining
     */
    public UptoNearExtra withMinAmount(String minAmount) {
        this.minAmount = minAmount;
        return this;
    }
}
