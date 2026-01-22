package io.t402.schemes.tron;

import java.util.HashMap;
import java.util.Map;

/**
 * Authorization data for TRON payments.
 *
 * <p>Contains all parameters needed to authorize a payment transfer
 * on the TRON blockchain.
 */
public class TronAuthorization {

    private final String from;
    private final String to;
    private final String amount;
    private final String nonce;
    private final String token;
    private final long validAfter;
    private final long validBefore;

    private TronAuthorization(Builder builder) {
        this.from = builder.from;
        this.to = builder.to;
        this.amount = builder.amount;
        this.nonce = builder.nonce;
        this.token = builder.token != null ? builder.token : TronConstants.DEFAULT_TOKEN;
        this.validAfter = builder.validAfter;
        this.validBefore = builder.validBefore;
    }

    /**
     * Creates a new builder instance.
     *
     * @return New builder
     */
    public static Builder builder() {
        return new Builder();
    }

    // Getters

    public String getFrom() {
        return from;
    }

    public String getTo() {
        return to;
    }

    public String getAmount() {
        return amount;
    }

    public String getNonce() {
        return nonce;
    }

    public String getToken() {
        return token;
    }

    public long getValidAfter() {
        return validAfter;
    }

    public long getValidBefore() {
        return validBefore;
    }

    /**
     * Converts authorization to a map for signing.
     *
     * @return Map containing authorization fields
     */
    public Map<String, Object> toSigningPayload() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("from", from);
        payload.put("to", to);
        payload.put("amount", amount);
        payload.put("nonce", nonce);
        payload.put("token", token);
        payload.put("validAfter", String.valueOf(validAfter));
        payload.put("validBefore", String.valueOf(validBefore));
        return payload;
    }

    /**
     * Converts authorization to a map for the payment payload.
     *
     * @return Map containing authorization fields
     */
    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>();
        map.put("from", from);
        map.put("to", to);
        map.put("amount", amount);
        map.put("nonce", nonce);
        map.put("token", token);
        map.put("validAfter", validAfter);
        map.put("validBefore", validBefore);
        return map;
    }

    /**
     * Builder for TronAuthorization.
     */
    public static class Builder {
        private String from;
        private String to;
        private String amount;
        private String nonce;
        private String token;
        private long validAfter;
        private long validBefore;

        public Builder from(String from) {
            this.from = from;
            return this;
        }

        public Builder to(String to) {
            this.to = to;
            return this;
        }

        public Builder amount(String amount) {
            this.amount = amount;
            return this;
        }

        public Builder nonce(String nonce) {
            this.nonce = nonce;
            return this;
        }

        public Builder token(String token) {
            this.token = token;
            return this;
        }

        public Builder validAfter(long validAfter) {
            this.validAfter = validAfter;
            return this;
        }

        public Builder validBefore(long validBefore) {
            this.validBefore = validBefore;
            return this;
        }

        /**
         * Builds the authorization.
         *
         * @return New TronAuthorization instance
         * @throws IllegalArgumentException if required fields are missing
         */
        public TronAuthorization build() {
            if (from == null || from.isEmpty()) {
                throw new IllegalArgumentException("From address is required");
            }
            if (to == null || to.isEmpty()) {
                throw new IllegalArgumentException("To address is required");
            }
            if (amount == null || amount.isEmpty()) {
                throw new IllegalArgumentException("Amount is required");
            }
            if (nonce == null || nonce.isEmpty()) {
                throw new IllegalArgumentException("Nonce is required");
            }
            if (validBefore <= 0) {
                validBefore = System.currentTimeMillis() / 1000 + TronConstants.DEFAULT_VALIDITY_DURATION;
            }
            return new TronAuthorization(this);
        }
    }
}
