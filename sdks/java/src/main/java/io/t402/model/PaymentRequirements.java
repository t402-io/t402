package io.t402.model;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Map;

/**
 * Defines one acceptable way to pay for a resource.
 * <p>
 * This class represents a single payment option in the t402 protocol v2.
 * Multiple PaymentRequirements can be included in a PaymentRequired response
 * to give clients a choice of payment methods.
 * </p>
 *
 * <h3>v2 Protocol Changes</h3>
 * <ul>
 *   <li>{@code amount} replaces v1's {@code maxAmountRequired}</li>
 *   <li>{@code network} uses CAIP-2 format (e.g., "eip155:8453")</li>
 *   <li>Resource info moved to {@link ResourceInfo} class</li>
 * </ul>
 *
 * @see PaymentRequiredResponse
 * @see PaymentPayload
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PaymentRequirements {

    /** Payment scheme identifier (e.g., "exact"). */
    public String scheme;

    /** Blockchain network in CAIP-2 format (e.g., "eip155:8453" for Base mainnet). */
    public String network;

    /** Token contract address or asset identifier. */
    public String asset;

    /**
     * Required payment amount in atomic token units.
     * <p>
     * For 6-decimal tokens like USDC: 1000000 = 1.00 USDC, 10000 = 0.01 USDC.
     * </p>
     */
    @JsonAlias("maxAmountRequired")  // Accept v1 field name for backward compatibility
    public String amount;

    /** Recipient wallet address. */
    public String payTo;

    /** Maximum time allowed for payment completion in seconds. */
    public int maxTimeoutSeconds;

    /** Scheme-specific additional information. */
    public Map<String, Object> extra;

    // ========== Deprecated v1 fields (for backward compatibility during deserialization) ==========

    /**
     * @deprecated Use {@link ResourceInfo#url} in PaymentRequiredResponse instead.
     */
    @Deprecated
    @JsonIgnore
    public String resource;

    /**
     * @deprecated Use {@link ResourceInfo#description} in PaymentRequiredResponse instead.
     */
    @Deprecated
    @JsonIgnore
    public String description;

    /**
     * @deprecated Use {@link ResourceInfo#mimeType} in PaymentRequiredResponse instead.
     */
    @Deprecated
    @JsonIgnore
    public String mimeType;

    /**
     * @deprecated No longer part of the v2 protocol.
     */
    @Deprecated
    @JsonIgnore
    public Map<String, Object> outputSchema;

    /** Default constructor for Jackson. */
    public PaymentRequirements() {}

    /**
     * Creates a PaymentRequirements with common fields.
     *
     * @param scheme payment scheme (e.g., "exact")
     * @param network blockchain network in CAIP-2 format
     * @param asset token contract address
     * @param amount payment amount in atomic units
     * @param payTo recipient wallet address
     * @param maxTimeoutSeconds maximum timeout in seconds
     */
    public PaymentRequirements(String scheme, String network, String asset,
                                String amount, String payTo, int maxTimeoutSeconds) {
        this.scheme = scheme;
        this.network = network;
        this.asset = asset;
        this.amount = amount;
        this.payTo = payTo;
        this.maxTimeoutSeconds = maxTimeoutSeconds;
    }

    /**
     * Builder-style method to set extra data.
     *
     * @param extra scheme-specific additional information
     * @return this instance for chaining
     */
    public PaymentRequirements withExtra(Map<String, Object> extra) {
        this.extra = extra;
        return this;
    }

    /**
     * Gets the amount, falling back to deprecated maxAmountRequired for v1 compatibility.
     * <p>
     * This method ensures backward compatibility when reading v1 payloads that use
     * maxAmountRequired instead of amount.
     * </p>
     *
     * @return the payment amount in atomic units
     */
    @JsonIgnore
    public String getEffectiveAmount() {
        return amount;
    }
}
