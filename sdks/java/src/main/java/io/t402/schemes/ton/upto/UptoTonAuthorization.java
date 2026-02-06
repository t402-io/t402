package io.t402.schemes.ton.upto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.HashMap;
import java.util.Map;

/**
 * TON upto authorization metadata.
 *
 * <p>Contains all parameters for verifying the signed transfer message
 * in the escrow-based upto payment scheme.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UptoTonAuthorization {

    /** Sender wallet address (friendly format, bounceable). */
    @JsonProperty("from")
    public String from;

    /** Facilitator holding address that receives the initial transfer. */
    public String facilitator;

    /** Jetton master contract address. */
    @JsonProperty("jettonMaster")
    public String jettonMaster;

    /** Maximum authorized amount in smallest units (as string). */
    @JsonProperty("maxAmount")
    public String maxAmount;

    /** Gas amount in nanoTON (as string). */
    @JsonProperty("tonAmount")
    public String tonAmount;

    /** Unix timestamp (seconds) until which the message is valid. */
    @JsonProperty("validUntil")
    public long validUntil;

    /** Wallet sequence number for replay protection. */
    public long seqno;

    /** Unique message ID (as string for large numbers). */
    @JsonProperty("queryId")
    public String queryId;

    /** Default constructor for Jackson. */
    public UptoTonAuthorization() {}

    /**
     * Creates a new UptoTonAuthorization with all fields.
     *
     * @param from sender wallet address
     * @param facilitator facilitator holding address
     * @param jettonMaster jetton master contract address
     * @param maxAmount maximum authorized amount
     * @param tonAmount gas amount in nanoTON
     * @param validUntil expiry timestamp
     * @param seqno wallet sequence number
     * @param queryId unique message ID
     */
    public UptoTonAuthorization(String from, String facilitator, String jettonMaster,
                                 String maxAmount, String tonAmount, long validUntil,
                                 long seqno, String queryId) {
        this.from = from;
        this.facilitator = facilitator;
        this.jettonMaster = jettonMaster;
        this.maxAmount = maxAmount;
        this.tonAmount = tonAmount;
        this.validUntil = validUntil;
        this.seqno = seqno;
        this.queryId = queryId;
    }

    /**
     * Converts this authorization to a map for JSON serialization.
     *
     * @return map representation of this authorization
     */
    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>();
        map.put("from", from);
        map.put("facilitator", facilitator);
        map.put("jettonMaster", jettonMaster);
        map.put("maxAmount", maxAmount);
        map.put("tonAmount", tonAmount);
        map.put("validUntil", validUntil);
        map.put("seqno", seqno);
        map.put("queryId", queryId);
        return map;
    }

    /**
     * Creates a new builder for UptoTonAuthorization.
     *
     * @return a new builder instance
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Factory method for convenient creation.
     *
     * @param from sender wallet address
     * @param facilitator facilitator holding address
     * @param jettonMaster jetton master contract address
     * @param maxAmount maximum authorized amount
     * @param tonAmount gas amount in nanoTON
     * @param validUntil expiry timestamp
     * @param seqno wallet sequence number
     * @param queryId unique message ID
     * @return a new UptoTonAuthorization instance
     */
    public static UptoTonAuthorization of(String from, String facilitator, String jettonMaster,
                                           String maxAmount, String tonAmount, long validUntil,
                                           long seqno, String queryId) {
        return new UptoTonAuthorization(from, facilitator, jettonMaster, maxAmount,
                                         tonAmount, validUntil, seqno, queryId);
    }

    /**
     * Builder for creating UptoTonAuthorization instances.
     */
    public static class Builder {
        private String from;
        private String facilitator;
        private String jettonMaster;
        private String maxAmount;
        private String tonAmount;
        private long validUntil;
        private long seqno;
        private String queryId;

        /**
         * Sets the sender wallet address.
         *
         * @param from sender address
         * @return this builder
         */
        public Builder from(String from) {
            this.from = from;
            return this;
        }

        /**
         * Sets the facilitator holding address.
         *
         * @param facilitator facilitator address
         * @return this builder
         */
        public Builder facilitator(String facilitator) {
            this.facilitator = facilitator;
            return this;
        }

        /**
         * Sets the jetton master contract address.
         *
         * @param jettonMaster jetton master address
         * @return this builder
         */
        public Builder jettonMaster(String jettonMaster) {
            this.jettonMaster = jettonMaster;
            return this;
        }

        /**
         * Sets the maximum authorized amount.
         *
         * @param maxAmount maximum amount in smallest units
         * @return this builder
         */
        public Builder maxAmount(String maxAmount) {
            this.maxAmount = maxAmount;
            return this;
        }

        /**
         * Sets the gas amount in nanoTON.
         *
         * @param tonAmount gas amount
         * @return this builder
         */
        public Builder tonAmount(String tonAmount) {
            this.tonAmount = tonAmount;
            return this;
        }

        /**
         * Sets the expiry timestamp.
         *
         * @param validUntil unix timestamp in seconds
         * @return this builder
         */
        public Builder validUntil(long validUntil) {
            this.validUntil = validUntil;
            return this;
        }

        /**
         * Sets the wallet sequence number.
         *
         * @param seqno sequence number
         * @return this builder
         */
        public Builder seqno(long seqno) {
            this.seqno = seqno;
            return this;
        }

        /**
         * Sets the query ID.
         *
         * @param queryId unique message ID
         * @return this builder
         */
        public Builder queryId(String queryId) {
            this.queryId = queryId;
            return this;
        }

        /**
         * Builds the authorization.
         *
         * @return a new UptoTonAuthorization instance
         * @throws IllegalArgumentException if required fields are missing
         */
        public UptoTonAuthorization build() {
            if (from == null || from.isEmpty()) {
                throw new IllegalArgumentException("from is required");
            }
            if (facilitator == null || facilitator.isEmpty()) {
                throw new IllegalArgumentException("facilitator is required");
            }
            return new UptoTonAuthorization(from, facilitator, jettonMaster,
                                             maxAmount, tonAmount, validUntil, seqno, queryId);
        }
    }
}
