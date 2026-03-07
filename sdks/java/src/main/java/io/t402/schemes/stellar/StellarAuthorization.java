package io.t402.schemes.stellar;

import java.util.HashMap;
import java.util.Map;

/**
 * Authorization data for Stellar payments.
 *
 * <p>Contains all parameters needed to authorize a Soroban token transfer
 * on the Stellar blockchain.
 */
public class StellarAuthorization {

    private final String sender;
    private final String recipient;
    private final String amount;
    private final String tokenContract;
    private final String nonce;
    private final int maxLedger;
    private final long validUntil;

    private StellarAuthorization(Builder builder) {
        this.sender = builder.sender;
        this.recipient = builder.recipient;
        this.amount = builder.amount;
        this.tokenContract = builder.tokenContract != null
            ? builder.tokenContract : StellarConstants.DEFAULT_TOKEN;
        this.nonce = builder.nonce;
        this.maxLedger = builder.maxLedger;
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

    public String getTokenContract() {
        return tokenContract;
    }

    public String getNonce() {
        return nonce;
    }

    public int getMaxLedger() {
        return maxLedger;
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
        payload.put("tokenContract", tokenContract);
        payload.put("nonce", nonce);
        payload.put("maxLedger", maxLedger);
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
        map.put("tokenContract", tokenContract);
        map.put("nonce", nonce);
        map.put("maxLedger", maxLedger);
        map.put("validUntil", validUntil);
        return map;
    }

    /**
     * Builder for StellarAuthorization.
     */
    public static class Builder {
        private String sender;
        private String recipient;
        private String amount;
        private String tokenContract;
        private String nonce;
        private int maxLedger;
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

        public Builder tokenContract(String tokenContract) {
            this.tokenContract = tokenContract;
            return this;
        }

        public Builder nonce(String nonce) {
            this.nonce = nonce;
            return this;
        }

        public Builder maxLedger(int maxLedger) {
            this.maxLedger = maxLedger;
            return this;
        }

        public Builder validUntil(long validUntil) {
            this.validUntil = validUntil;
            return this;
        }

        /**
         * Builds the authorization.
         *
         * @return New StellarAuthorization instance
         * @throws IllegalArgumentException if required fields are missing
         */
        public StellarAuthorization build() {
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
                validUntil = System.currentTimeMillis() / 1000
                    + StellarConstants.DEFAULT_TIMEOUT_SECONDS;
            }
            return new StellarAuthorization(this);
        }
    }
}
