package io.t402.schemes.svm.upto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.HashMap;
import java.util.Map;

/**
 * SPL ApproveChecked authorization metadata for the Up-To SVM scheme.
 * <p>
 * Contains the details of the delegate approval including the owner,
 * delegate (facilitator), token mint, maximum amount, and source ATA.
 * </p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UptoSvmAuthorization {

    /** Token owner address (base58). */
    @JsonProperty("owner")
    public String owner;

    /** Approved delegate address - facilitator (base58). */
    @JsonProperty("delegate")
    public String delegate;

    /** SPL token mint address (base58). */
    @JsonProperty("mint")
    public String mint;

    /** Maximum approved amount in smallest units (as string). */
    @JsonProperty("maxAmount")
    public String maxAmount;

    /** Owner's associated token account (base58). */
    @JsonProperty("sourceATA")
    public String sourceATA;

    /** Default constructor for Jackson. */
    public UptoSvmAuthorization() {}

    /**
     * Creates a new UptoSvmAuthorization.
     *
     * @param owner token owner address
     * @param delegate approved delegate address
     * @param mint SPL token mint address
     * @param maxAmount maximum approved amount
     * @param sourceATA owner's associated token account
     */
    public UptoSvmAuthorization(String owner, String delegate, String mint,
                                 String maxAmount, String sourceATA) {
        this.owner = owner;
        this.delegate = delegate;
        this.mint = mint;
        this.maxAmount = maxAmount;
        this.sourceATA = sourceATA;
    }

    /**
     * Converts this authorization to a map for JSON serialization.
     *
     * @return map representation of this authorization
     */
    public Map<String, Object> toMap() {
        Map<String, Object> result = new HashMap<>();
        result.put("owner", owner);
        result.put("delegate", delegate);
        result.put("mint", mint);
        result.put("maxAmount", maxAmount);
        result.put("sourceATA", sourceATA);
        return result;
    }

    /**
     * Creates an UptoSvmAuthorization from a map.
     *
     * @param data map containing authorization data
     * @return a new UptoSvmAuthorization
     */
    public static UptoSvmAuthorization fromMap(Map<String, Object> data) {
        UptoSvmAuthorization auth = new UptoSvmAuthorization();

        if (data.get("owner") instanceof String) {
            auth.owner = (String) data.get("owner");
        }
        if (data.get("delegate") instanceof String) {
            auth.delegate = (String) data.get("delegate");
        }
        if (data.get("mint") instanceof String) {
            auth.mint = (String) data.get("mint");
        }
        if (data.get("maxAmount") instanceof String) {
            auth.maxAmount = (String) data.get("maxAmount");
        } else if (data.get("maxAmount") instanceof Number) {
            auth.maxAmount = data.get("maxAmount").toString();
        }
        if (data.get("sourceATA") instanceof String) {
            auth.sourceATA = (String) data.get("sourceATA");
        }

        return auth;
    }

    /**
     * Creates a new builder for UptoSvmAuthorization.
     *
     * @return a new builder instance
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder for creating UptoSvmAuthorization instances.
     */
    public static class Builder {
        private String owner;
        private String delegate;
        private String mint;
        private String maxAmount;
        private String sourceATA;

        /**
         * Sets the owner address.
         *
         * @param owner token owner address
         * @return this builder
         */
        public Builder owner(String owner) {
            this.owner = owner;
            return this;
        }

        /**
         * Sets the delegate address.
         *
         * @param delegate approved delegate address
         * @return this builder
         */
        public Builder delegate(String delegate) {
            this.delegate = delegate;
            return this;
        }

        /**
         * Sets the mint address.
         *
         * @param mint SPL token mint address
         * @return this builder
         */
        public Builder mint(String mint) {
            this.mint = mint;
            return this;
        }

        /**
         * Sets the max amount.
         *
         * @param maxAmount maximum approved amount
         * @return this builder
         */
        public Builder maxAmount(String maxAmount) {
            this.maxAmount = maxAmount;
            return this;
        }

        /**
         * Sets the max amount from a long.
         *
         * @param maxAmount maximum approved amount
         * @return this builder
         */
        public Builder maxAmount(long maxAmount) {
            this.maxAmount = String.valueOf(maxAmount);
            return this;
        }

        /**
         * Sets the source ATA.
         *
         * @param sourceATA owner's associated token account
         * @return this builder
         */
        public Builder sourceATA(String sourceATA) {
            this.sourceATA = sourceATA;
            return this;
        }

        /**
         * Builds the UptoSvmAuthorization.
         *
         * @return new UptoSvmAuthorization instance
         */
        public UptoSvmAuthorization build() {
            return new UptoSvmAuthorization(owner, delegate, mint, maxAmount, sourceATA);
        }
    }

    @Override
    public String toString() {
        return "UptoSvmAuthorization{" +
            "owner='" + owner + '\'' +
            ", delegate='" + delegate + '\'' +
            ", mint='" + mint + '\'' +
            ", maxAmount='" + maxAmount + '\'' +
            ", sourceATA='" + sourceATA + '\'' +
            '}';
    }
}
