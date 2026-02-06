package io.t402.schemes.tron.upto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.HashMap;
import java.util.Map;

/**
 * TRC-20 approve authorization metadata for the Up-To scheme.
 * <p>
 * Contains all information needed to verify the approve transaction
 * without parsing the signed transaction.
 * </p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UptoTronAuthorization {

    /** Token owner address (T-prefix base58check). */
    public String owner;

    /** Approved spender address - facilitator (T-prefix base58check). */
    public String spender;

    /** TRC-20 contract address (T-prefix base58check). */
    @JsonProperty("contractAddress")
    public String contractAddress;

    /** Maximum approved amount in smallest units (as string). */
    @JsonProperty("maxAmount")
    public String maxAmount;

    /** Transaction expiration timestamp (milliseconds since epoch). */
    public long expiration;

    /** Reference block bytes (hex string). */
    @JsonProperty("refBlockBytes")
    public String refBlockBytes;

    /** Reference block hash (hex string). */
    @JsonProperty("refBlockHash")
    public String refBlockHash;

    /** Transaction timestamp (milliseconds since epoch). */
    public long timestamp;

    /** Default constructor for Jackson. */
    public UptoTronAuthorization() {}

    /**
     * Creates a new UptoTronAuthorization with all fields.
     *
     * @param owner token owner address
     * @param spender approved spender address
     * @param contractAddress TRC-20 contract address
     * @param maxAmount maximum approved amount
     * @param expiration transaction expiration timestamp
     * @param refBlockBytes reference block bytes
     * @param refBlockHash reference block hash
     * @param timestamp transaction timestamp
     */
    public UptoTronAuthorization(String owner, String spender, String contractAddress,
                                  String maxAmount, long expiration, String refBlockBytes,
                                  String refBlockHash, long timestamp) {
        this.owner = owner;
        this.spender = spender;
        this.contractAddress = contractAddress;
        this.maxAmount = maxAmount;
        this.expiration = expiration;
        this.refBlockBytes = refBlockBytes;
        this.refBlockHash = refBlockHash;
        this.timestamp = timestamp;
    }

    /**
     * Converts this authorization to a map for JSON serialization.
     *
     * @return map representation of this authorization
     */
    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>();
        map.put("owner", owner);
        map.put("spender", spender);
        map.put("contractAddress", contractAddress);
        map.put("maxAmount", maxAmount);
        map.put("expiration", expiration);
        map.put("refBlockBytes", refBlockBytes);
        map.put("refBlockHash", refBlockHash);
        map.put("timestamp", timestamp);
        return map;
    }

    /**
     * Creates a new builder for UptoTronAuthorization.
     *
     * @return a new builder instance
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder for creating UptoTronAuthorization instances.
     */
    public static class Builder {
        private String owner;
        private String spender;
        private String contractAddress;
        private String maxAmount;
        private long expiration;
        private String refBlockBytes;
        private String refBlockHash;
        private long timestamp;

        /**
         * Sets the token owner address.
         *
         * @param owner token owner address
         * @return this builder
         */
        public Builder owner(String owner) {
            this.owner = owner;
            return this;
        }

        /**
         * Sets the approved spender address.
         *
         * @param spender spender address
         * @return this builder
         */
        public Builder spender(String spender) {
            this.spender = spender;
            return this;
        }

        /**
         * Sets the TRC-20 contract address.
         *
         * @param contractAddress contract address
         * @return this builder
         */
        public Builder contractAddress(String contractAddress) {
            this.contractAddress = contractAddress;
            return this;
        }

        /**
         * Sets the maximum approved amount.
         *
         * @param maxAmount maximum amount
         * @return this builder
         */
        public Builder maxAmount(String maxAmount) {
            this.maxAmount = maxAmount;
            return this;
        }

        /**
         * Sets the transaction expiration timestamp.
         *
         * @param expiration expiration in milliseconds
         * @return this builder
         */
        public Builder expiration(long expiration) {
            this.expiration = expiration;
            return this;
        }

        /**
         * Sets the reference block bytes.
         *
         * @param refBlockBytes reference block bytes hex
         * @return this builder
         */
        public Builder refBlockBytes(String refBlockBytes) {
            this.refBlockBytes = refBlockBytes;
            return this;
        }

        /**
         * Sets the reference block hash.
         *
         * @param refBlockHash reference block hash hex
         * @return this builder
         */
        public Builder refBlockHash(String refBlockHash) {
            this.refBlockHash = refBlockHash;
            return this;
        }

        /**
         * Sets the transaction timestamp.
         *
         * @param timestamp timestamp in milliseconds
         * @return this builder
         */
        public Builder timestamp(long timestamp) {
            this.timestamp = timestamp;
            return this;
        }

        /**
         * Builds the authorization.
         *
         * @return new UptoTronAuthorization instance
         */
        public UptoTronAuthorization build() {
            return new UptoTronAuthorization(
                owner, spender, contractAddress, maxAmount,
                expiration, refBlockBytes, refBlockHash, timestamp
            );
        }
    }
}
