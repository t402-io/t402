package io.t402.schemes.aptos;

import java.util.HashMap;
import java.util.Map;

/**
 * Payload for exact-direct Aptos payments.
 *
 * <p>Contains the transaction hash and transfer details that serve as
 * proof of a completed Fungible Asset transfer on the Aptos blockchain.
 * In the exact-direct scheme, the client executes the transfer on-chain
 * and provides the transaction hash for the facilitator to verify.
 */
public class ExactDirectPayload {

    private final String txHash;
    private final String from;
    private final String to;
    private final String amount;
    private final String metadataAddress;

    private ExactDirectPayload(Builder builder) {
        this.txHash = builder.txHash;
        this.from = builder.from;
        this.to = builder.to;
        this.amount = builder.amount;
        this.metadataAddress = builder.metadataAddress;
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
     * @return Transaction hash (0x-prefixed, 64 hex chars)
     */
    public String getTxHash() {
        return txHash;
    }

    /**
     * Gets the sender address.
     *
     * @return Sender's Aptos address
     */
    public String getFrom() {
        return from;
    }

    /**
     * Gets the recipient address.
     *
     * @return Recipient's Aptos address
     */
    public String getTo() {
        return to;
    }

    /**
     * Gets the transfer amount in atomic units.
     *
     * @return Amount as string
     */
    public String getAmount() {
        return amount;
    }

    /**
     * Gets the Fungible Asset metadata object address.
     *
     * @return FA metadata address
     */
    public String getMetadataAddress() {
        return metadataAddress;
    }

    /**
     * Converts the payload to a map with camelCase keys.
     *
     * @return Map representation of the payload
     */
    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>();
        map.put("txHash", txHash);
        map.put("from", from);
        map.put("to", to);
        map.put("amount", amount);
        map.put("metadataAddress", metadataAddress);
        return map;
    }

    /**
     * Creates an ExactDirectPayload from a map.
     *
     * <p>Supports both camelCase and snake_case key formats.
     *
     * @param map Map containing payload data
     * @return New ExactDirectPayload instance
     * @throws IllegalArgumentException if required fields are missing
     */
    public static ExactDirectPayload fromMap(Map<String, Object> map) {
        String txHash = getStringField(map, "txHash", "tx_hash");
        String from = getStringField(map, "from", "from_address");
        String to = getStringField(map, "to", "to_address");
        String amount = (String) map.get("amount");
        String metadataAddress = getStringField(map, "metadataAddress", "metadata_address");

        return builder()
            .txHash(txHash)
            .from(from)
            .to(to)
            .amount(amount)
            .metadataAddress(metadataAddress)
            .build();
    }

    private static String getStringField(Map<String, Object> map, String camelCase, String snakeCase) {
        Object value = map.get(camelCase);
        if (value == null) {
            value = map.get(snakeCase);
        }
        return value != null ? value.toString() : "";
    }

    /**
     * Builder for ExactDirectPayload.
     */
    public static class Builder {
        private String txHash;
        private String from;
        private String to;
        private String amount;
        private String metadataAddress;

        /**
         * Sets the transaction hash.
         *
         * @param txHash Transaction hash (0x-prefixed hex)
         * @return this builder
         */
        public Builder txHash(String txHash) {
            this.txHash = txHash;
            return this;
        }

        /**
         * Sets the sender address.
         *
         * @param from Sender's Aptos address
         * @return this builder
         */
        public Builder from(String from) {
            this.from = from;
            return this;
        }

        /**
         * Sets the recipient address.
         *
         * @param to Recipient's Aptos address
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
         * Sets the Fungible Asset metadata address.
         *
         * @param metadataAddress FA metadata object address
         * @return this builder
         */
        public Builder metadataAddress(String metadataAddress) {
            this.metadataAddress = metadataAddress;
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
            if (metadataAddress == null || metadataAddress.isEmpty()) {
                throw new IllegalArgumentException("Metadata address is required");
            }
            return new ExactDirectPayload(this);
        }
    }
}
