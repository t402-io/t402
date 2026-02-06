package io.t402.schemes.cosmos;

import java.util.HashMap;
import java.util.Map;

/**
 * Payload for exact-direct Cosmos payments.
 *
 * <p>Contains the transaction hash as proof of on-chain payment,
 * along with transfer details for verification. In the exact-direct scheme,
 * the client executes the bank send directly and provides the transaction
 * hash as proof.
 */
public class ExactDirectPayload {

    private final String txHash;
    private final String from;
    private final String to;
    private final String amount;
    private final String denom;

    private ExactDirectPayload(Builder builder) {
        this.txHash = builder.txHash;
        this.from = builder.from;
        this.to = builder.to;
        this.amount = builder.amount;
        this.denom = builder.denom;
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
     * Gets the sender's Cosmos address.
     *
     * @return Sender bech32 address
     */
    public String getFrom() {
        return from;
    }

    /**
     * Gets the recipient's Cosmos address.
     *
     * @return Recipient bech32 address
     */
    public String getTo() {
        return to;
    }

    /**
     * Gets the transfer amount in atomic units.
     *
     * @return Amount string in atomic units (e.g., uusdc)
     */
    public String getAmount() {
        return amount;
    }

    /**
     * Gets the token denomination.
     *
     * @return Token denom (e.g., "uusdc"), may be null
     */
    public String getDenom() {
        return denom;
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
        if (denom != null && !denom.isEmpty()) {
            map.put("denom", denom);
        }
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
            .denom((String) map.get("denom"))
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
        private String denom;

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
         * Sets the sender address.
         *
         * @param from Sender's Cosmos bech32 address
         * @return this builder
         */
        public Builder from(String from) {
            this.from = from;
            return this;
        }

        /**
         * Sets the recipient address.
         *
         * @param to Recipient's Cosmos bech32 address
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
         * Sets the token denomination.
         *
         * @param denom Token denom (e.g., "uusdc")
         * @return this builder
         */
        public Builder denom(String denom) {
            this.denom = denom;
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
                throw new IllegalArgumentException("From address is required");
            }
            if (to == null || to.isEmpty()) {
                throw new IllegalArgumentException("To address is required");
            }
            if (amount == null || amount.isEmpty()) {
                throw new IllegalArgumentException("Amount is required");
            }
            return new ExactDirectPayload(this);
        }
    }
}
