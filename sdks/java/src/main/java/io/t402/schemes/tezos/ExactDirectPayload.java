package io.t402.schemes.tezos;

import java.util.HashMap;
import java.util.Map;

/**
 * Payload for Tezos exact-direct payments.
 *
 * <p>Contains the operation hash proving on-chain execution and metadata
 * about the FA2 transfer for verification.
 *
 * <p>In the exact-direct scheme, the client executes the FA2 transfer on-chain
 * and provides the operation hash as proof of payment.
 */
public class ExactDirectPayload {

    private final String opHash;
    private final String from;
    private final String to;
    private final String amount;
    private final String contractAddress;
    private final int tokenId;

    private ExactDirectPayload(Builder builder) {
        this.opHash = builder.opHash;
        this.from = builder.from;
        this.to = builder.to;
        this.amount = builder.amount;
        this.contractAddress = builder.contractAddress;
        this.tokenId = builder.tokenId;
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

    /** Gets the Tezos operation hash (starts with 'o', 51 characters). */
    public String getOpHash() {
        return opHash;
    }

    /** Gets the sender's Tezos address. */
    public String getFrom() {
        return from;
    }

    /** Gets the recipient's Tezos address. */
    public String getTo() {
        return to;
    }

    /** Gets the amount transferred in atomic units. */
    public String getAmount() {
        return amount;
    }

    /** Gets the FA2 contract address. */
    public String getContractAddress() {
        return contractAddress;
    }

    /** Gets the token ID within the FA2 contract. */
    public int getTokenId() {
        return tokenId;
    }

    /**
     * Converts the payload to a map suitable for JSON serialization.
     *
     * @return Map with camelCase keys matching the protocol format
     */
    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>();
        map.put("opHash", opHash);
        map.put("from", from);
        map.put("to", to);
        map.put("amount", amount);
        map.put("contractAddress", contractAddress);
        map.put("tokenId", tokenId);
        return map;
    }

    /**
     * Creates an ExactDirectPayload from a map.
     *
     * @param map Map containing payload data (camelCase keys)
     * @return New ExactDirectPayload instance
     * @throws IllegalArgumentException if required fields are missing
     */
    public static ExactDirectPayload fromMap(Map<String, Object> map) {
        String opHash = (String) map.get("opHash");
        String from = (String) map.get("from");
        String to = (String) map.get("to");
        String amount = (String) map.get("amount");
        String contractAddress = (String) map.get("contractAddress");
        Object tokenIdObj = map.get("tokenId");
        int tokenId = 0;
        if (tokenIdObj instanceof Number) {
            tokenId = ((Number) tokenIdObj).intValue();
        } else if (tokenIdObj instanceof String) {
            tokenId = Integer.parseInt((String) tokenIdObj);
        }

        return builder()
            .opHash(opHash)
            .from(from)
            .to(to)
            .amount(amount)
            .contractAddress(contractAddress)
            .tokenId(tokenId)
            .build();
    }

    /**
     * Builder for ExactDirectPayload.
     */
    public static class Builder {
        private String opHash;
        private String from;
        private String to;
        private String amount;
        private String contractAddress;
        private int tokenId;

        public Builder opHash(String opHash) {
            this.opHash = opHash;
            return this;
        }

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

        public Builder contractAddress(String contractAddress) {
            this.contractAddress = contractAddress;
            return this;
        }

        public Builder tokenId(int tokenId) {
            this.tokenId = tokenId;
            return this;
        }

        /**
         * Builds the payload.
         *
         * @return New ExactDirectPayload instance
         * @throws IllegalArgumentException if required fields are missing
         */
        public ExactDirectPayload build() {
            if (opHash == null || opHash.isEmpty()) {
                throw new IllegalArgumentException("Operation hash is required");
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
            if (contractAddress == null || contractAddress.isEmpty()) {
                throw new IllegalArgumentException("Contract address is required");
            }
            return new ExactDirectPayload(this);
        }
    }
}
