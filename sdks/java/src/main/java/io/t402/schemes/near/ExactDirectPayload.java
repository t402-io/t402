package io.t402.schemes.near;

import java.util.HashMap;
import java.util.Map;

/**
 * Payload for exact-direct NEAR payments.
 *
 * <p>Contains the transaction hash as proof of on-chain payment,
 * along with transfer details for verification. In the exact-direct scheme,
 * the client executes the ft_transfer directly and provides the transaction
 * hash as proof.
 */
public class ExactDirectPayload {

    private final String txHash;
    private final String from;
    private final String to;
    private final String amount;

    private ExactDirectPayload(Builder builder) {
        this.txHash = builder.txHash;
        this.from = builder.from;
        this.to = builder.to;
        this.amount = builder.amount;
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

    /**
     * Gets the transaction hash.
     *
     * @return On-chain transaction hash
     */
    public String getTxHash() {
        return txHash;
    }

    /**
     * Gets the sender's NEAR account ID.
     *
     * @return Sender account ID
     */
    public String getFrom() {
        return from;
    }

    /**
     * Gets the recipient's NEAR account ID.
     *
     * @return Recipient account ID
     */
    public String getTo() {
        return to;
    }

    /**
     * Gets the transfer amount in atomic units.
     *
     * @return Amount string in atomic units
     */
    public String getAmount() {
        return amount;
    }

    /**
     * Converts the payload to a map.
     *
     * @return Map representation of the payload
     */
    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>();
        map.put("txHash", txHash);
        map.put("from", from);
        map.put("to", to);
        map.put("amount", amount);
        return map;
    }

    /**
     * Creates an ExactDirectPayload from a map.
     *
     * @param map Map containing payload data
     * @return New ExactDirectPayload instance
     * @throws IllegalArgumentException if required fields are missing
     */
    public static ExactDirectPayload fromMap(Map<String, Object> map) {
        if (map == null) {
            throw new IllegalArgumentException("Payload map cannot be null");
        }

        return builder()
            .txHash((String) map.get("txHash"))
            .from((String) map.get("from"))
            .to((String) map.get("to"))
            .amount((String) map.get("amount"))
            .build();
    }

    /**
     * Builder for ExactDirectPayload.
     */
    public static class Builder {
        private String txHash;
        private String from;
        private String to;
        private String amount;

        /**
         * Sets the transaction hash.
         *
         * @param txHash On-chain transaction hash
         * @return this builder
         */
        public Builder txHash(String txHash) {
            this.txHash = txHash;
            return this;
        }

        /**
         * Sets the sender account ID.
         *
         * @param from Sender's NEAR account ID
         * @return this builder
         */
        public Builder from(String from) {
            this.from = from;
            return this;
        }

        /**
         * Sets the recipient account ID.
         *
         * @param to Recipient's NEAR account ID
         * @return this builder
         */
        public Builder to(String to) {
            this.to = to;
            return this;
        }

        /**
         * Sets the transfer amount.
         *
         * @param amount Amount in atomic units
         * @return this builder
         */
        public Builder amount(String amount) {
            this.amount = amount;
            return this;
        }

        /**
         * Builds the payload.
         *
         * @return New ExactDirectPayload instance
         * @throws IllegalArgumentException if required fields are missing
         */
        public ExactDirectPayload build() {
            if (txHash == null || txHash.isEmpty()) {
                throw new IllegalArgumentException("Transaction hash is required");
            }
            if (from == null || from.isEmpty()) {
                throw new IllegalArgumentException("From account ID is required");
            }
            if (to == null || to.isEmpty()) {
                throw new IllegalArgumentException("To account ID is required");
            }
            if (amount == null || amount.isEmpty()) {
                throw new IllegalArgumentException("Amount is required");
            }
            return new ExactDirectPayload(this);
        }
    }
}
