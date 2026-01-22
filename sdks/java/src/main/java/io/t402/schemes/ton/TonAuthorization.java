package io.t402.schemes.ton;

import java.util.HashMap;
import java.util.Map;

/**
 * Authorization data for TON payments.
 *
 * <p>Contains all parameters needed to authorize a payment transfer
 * on the TON blockchain.
 */
public class TonAuthorization {

    private final String sender;
    private final String recipient;
    private final String amount;
    private final String nonce;
    private final String token;
    private final long validUntil;

    private TonAuthorization(Builder builder) {
        this.sender = builder.sender;
        this.recipient = builder.recipient;
        this.amount = builder.amount;
        this.nonce = builder.nonce;
        this.token = builder.token != null ? builder.token : TonConstants.DEFAULT_TOKEN;
        this.validUntil = builder.validUntil;
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

    public String getSender() {
        return sender;
    }

    public String getRecipient() {
        return recipient;
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

    public long getValidUntil() {
        return validUntil;
    }

    /**
     * Converts authorization to a map for signing.
     *
     * @return Map containing authorization fields
     */
    public Map<String, Object> toSigningPayload() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("sender", sender);
        payload.put("recipient", recipient);
        payload.put("amount", amount);
        payload.put("nonce", nonce);
        payload.put("token", token);
        payload.put("validUntil", String.valueOf(validUntil));
        return payload;
    }

    /**
     * Converts authorization to a map for the payment payload.
     *
     * @return Map containing authorization fields
     */
    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>();
        map.put("sender", sender);
        map.put("recipient", recipient);
        map.put("amount", amount);
        map.put("nonce", nonce);
        map.put("token", token);
        map.put("validUntil", validUntil);
        return map;
    }

    /**
     * Builder for TonAuthorization.
     */
    public static class Builder {
        private String sender;
        private String recipient;
        private String amount;
        private String nonce;
        private String token;
        private long validUntil;

        public Builder sender(String sender) {
            this.sender = sender;
            return this;
        }

        public Builder recipient(String recipient) {
            this.recipient = recipient;
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

        public Builder validUntil(long validUntil) {
            this.validUntil = validUntil;
            return this;
        }

        /**
         * Builds the authorization.
         *
         * @return New TonAuthorization instance
         * @throws IllegalArgumentException if required fields are missing
         */
        public TonAuthorization build() {
            if (sender == null || sender.isEmpty()) {
                throw new IllegalArgumentException("Sender is required");
            }
            if (recipient == null || recipient.isEmpty()) {
                throw new IllegalArgumentException("Recipient is required");
            }
            if (amount == null || amount.isEmpty()) {
                throw new IllegalArgumentException("Amount is required");
            }
            if (nonce == null || nonce.isEmpty()) {
                throw new IllegalArgumentException("Nonce is required");
            }
            if (validUntil <= 0) {
                validUntil = System.currentTimeMillis() / 1000 + TonConstants.DEFAULT_VALIDITY_DURATION;
            }
            return new TonAuthorization(this);
        }
    }
}
