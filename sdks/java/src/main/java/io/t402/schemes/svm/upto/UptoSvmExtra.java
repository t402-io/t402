package io.t402.schemes.svm.upto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * SVM-specific extra fields for the Up-To scheme.
 * <p>
 * Contains billing configuration for upto payments on Solana,
 * included in the PaymentRequirements.extra field.
 * </p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UptoSvmExtra {

    /** Facilitator address that will pay transaction fees (base58). */
    @JsonProperty("feePayer")
    public String feePayer;

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
    public UptoSvmExtra() {}

    /**
     * Creates a new UptoSvmExtra with fee payer.
     *
     * @param feePayer facilitator address for gas payment
     */
    public UptoSvmExtra(String feePayer) {
        this.feePayer = feePayer;
    }

    /**
     * Builder-style method to set max amount.
     *
     * @param maxAmount maximum authorized amount
     * @return this instance for chaining
     */
    public UptoSvmExtra withMaxAmount(String maxAmount) {
        this.maxAmount = maxAmount;
        return this;
    }

    /**
     * Builder-style method to set min amount.
     *
     * @param minAmount minimum settlement amount
     * @return this instance for chaining
     */
    public UptoSvmExtra withMinAmount(String minAmount) {
        this.minAmount = minAmount;
        return this;
    }

    /**
     * Builder-style method to set billing unit.
     *
     * @param unit billing unit type
     * @return this instance for chaining
     */
    public UptoSvmExtra withUnit(String unit) {
        this.unit = unit;
        return this;
    }

    /**
     * Builder-style method to set unit price.
     *
     * @param unitPrice price per unit
     * @return this instance for chaining
     */
    public UptoSvmExtra withUnitPrice(String unitPrice) {
        this.unitPrice = unitPrice;
        return this;
    }

    @Override
    public String toString() {
        return "UptoSvmExtra{" +
            "feePayer='" + feePayer + '\'' +
            ", maxAmount='" + maxAmount + '\'' +
            ", minAmount='" + minAmount + '\'' +
            ", unit='" + unit + '\'' +
            ", unitPrice='" + unitPrice + '\'' +
            '}';
    }
}
