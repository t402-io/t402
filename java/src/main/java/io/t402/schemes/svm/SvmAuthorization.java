package io.t402.schemes.svm;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.HashMap;
import java.util.Map;

/**
 * Solana transfer authorization metadata.
 * <p>
 * Contains the details of a token transfer including sender, recipient,
 * token mint, amount, and validity period.
 * </p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SvmAuthorization {

    /** Sender's Solana address. */
    @JsonProperty("from")
    public String from;

    /** Recipient's Solana address. */
    @JsonProperty("to")
    public String to;

    /** Token mint address. */
    @JsonProperty("mint")
    public String mint;

    /** Amount in smallest units (as string to avoid precision loss). */
    @JsonProperty("amount")
    public String amount;

    /** Unix timestamp until which this authorization is valid. */
    @JsonProperty("validUntil")
    public long validUntil;

    /** Optional fee payer address (provided by facilitator). */
    @JsonProperty("feePayer")
    public String feePayer;

    /** Default constructor for Jackson. */
    public SvmAuthorization() {}

    /**
     * Creates a new SvmAuthorization.
     *
     * @param from sender address
     * @param to recipient address
     * @param mint token mint address
     * @param amount amount in smallest units
     * @param validUntil validity timestamp
     */
    public SvmAuthorization(String from, String to, String mint, String amount, long validUntil) {
        this.from = from;
        this.to = to;
        this.mint = mint;
        this.amount = amount;
        this.validUntil = validUntil;
    }

    /**
     * Creates a new SvmAuthorization with fee payer.
     *
     * @param from sender address
     * @param to recipient address
     * @param mint token mint address
     * @param amount amount in smallest units
     * @param validUntil validity timestamp
     * @param feePayer fee payer address
     */
    public SvmAuthorization(String from, String to, String mint, String amount,
                            long validUntil, String feePayer) {
        this(from, to, mint, amount, validUntil);
        this.feePayer = feePayer;
    }

    /**
     * Converts this authorization to a map for JSON serialization.
     *
     * @return map representation of this authorization
     */
    public Map<String, Object> toMap() {
        Map<String, Object> result = new HashMap<>();
        result.put("from", from);
        result.put("to", to);
        result.put("mint", mint);
        result.put("amount", amount);
        result.put("validUntil", validUntil);
        if (feePayer != null) {
            result.put("feePayer", feePayer);
        }
        return result;
    }

    /**
     * Creates an SvmAuthorization from a map.
     *
     * @param data map containing authorization data
     * @return a new SvmAuthorization
     */
    public static SvmAuthorization fromMap(Map<String, Object> data) {
        SvmAuthorization auth = new SvmAuthorization();

        if (data.get("from") instanceof String) {
            auth.from = (String) data.get("from");
        }
        if (data.get("to") instanceof String) {
            auth.to = (String) data.get("to");
        }
        if (data.get("mint") instanceof String) {
            auth.mint = (String) data.get("mint");
        }
        if (data.get("amount") instanceof String) {
            auth.amount = (String) data.get("amount");
        } else if (data.get("amount") instanceof Number) {
            auth.amount = data.get("amount").toString();
        }
        if (data.get("validUntil") instanceof Number) {
            auth.validUntil = ((Number) data.get("validUntil")).longValue();
        }
        if (data.get("feePayer") instanceof String) {
            auth.feePayer = (String) data.get("feePayer");
        }

        return auth;
    }

    /**
     * Creates a new builder for SvmAuthorization.
     *
     * @return a new builder instance
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder for creating SvmAuthorization instances.
     */
    public static class Builder {
        private String from;
        private String to;
        private String mint;
        private String amount;
        private long validUntil;
        private String feePayer;

        public Builder from(String from) {
            this.from = from;
            return this;
        }

        public Builder to(String to) {
            this.to = to;
            return this;
        }

        public Builder mint(String mint) {
            this.mint = mint;
            return this;
        }

        public Builder amount(String amount) {
            this.amount = amount;
            return this;
        }

        public Builder amount(long amount) {
            this.amount = String.valueOf(amount);
            return this;
        }

        public Builder validUntil(long validUntil) {
            this.validUntil = validUntil;
            return this;
        }

        public Builder feePayer(String feePayer) {
            this.feePayer = feePayer;
            return this;
        }

        public SvmAuthorization build() {
            SvmAuthorization auth = new SvmAuthorization(from, to, mint, amount, validUntil);
            auth.feePayer = feePayer;
            return auth;
        }
    }

    @Override
    public String toString() {
        return "SvmAuthorization{" +
            "from='" + from + '\'' +
            ", to='" + to + '\'' +
            ", mint='" + mint + '\'' +
            ", amount='" + amount + '\'' +
            ", validUntil=" + validUntil +
            ", feePayer='" + feePayer + '\'' +
            '}';
    }
}
