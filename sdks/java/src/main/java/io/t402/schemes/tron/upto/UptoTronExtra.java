package io.t402.schemes.tron.upto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * TRON-specific extra fields for the Up-To scheme.
 * <p>
 * Included in the PaymentRequirements.extra field to communicate
 * upto-specific parameters to the client.
 * </p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UptoTronExtra {

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

    /** Facilitator address that will be approved as spender. */
    @JsonProperty("spenderAddress")
    public String spenderAddress;

    /** Default constructor for Jackson. */
    public UptoTronExtra() {}

    /**
     * Creates a new UptoTronExtra with max and min amounts.
     *
     * @param maxAmount maximum payment amount
     * @param minAmount minimum settlement amount
     */
    public UptoTronExtra(String maxAmount, String minAmount) {
        this.maxAmount = maxAmount;
        this.minAmount = minAmount;
    }

    /**
     * Builder-style method to set billing unit.
     *
     * @param unit billing unit type
     * @return this instance for chaining
     */
    public UptoTronExtra withUnit(String unit) {
        this.unit = unit;
        return this;
    }

    /**
     * Builder-style method to set unit price.
     *
     * @param unitPrice price per unit
     * @return this instance for chaining
     */
    public UptoTronExtra withUnitPrice(String unitPrice) {
        this.unitPrice = unitPrice;
        return this;
    }

    /**
     * Builder-style method to set spender address.
     *
     * @param spenderAddress facilitator address
     * @return this instance for chaining
     */
    public UptoTronExtra withSpenderAddress(String spenderAddress) {
        this.spenderAddress = spenderAddress;
        return this;
    }

    /**
     * Creates a new UptoTronExtra with max and min amounts.
     *
     * @param maxAmount maximum payment amount
     * @param minAmount minimum settlement amount
     * @return a new UptoTronExtra instance
     */
    public static UptoTronExtra of(String maxAmount, String minAmount) {
        return new UptoTronExtra(maxAmount, minAmount);
    }
}
