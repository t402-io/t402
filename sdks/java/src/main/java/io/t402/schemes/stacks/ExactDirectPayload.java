package io.t402.schemes.stacks;

import java.util.HashMap;
import java.util.Map;

/**
 * Payload for Stacks exact-direct payments.
 *
 * <p>Contains the on-chain proof of a completed SIP-010 token transfer
 * on the Stacks blockchain.
 *
 * <p>In the exact-direct scheme, the client executes the SIP-010 transfer
 * contract call on-chain and provides the transaction ID as proof of payment.
 */
public class ExactDirectPayload {

    private final String txId;
    private final String from;
    private final String to;
    private final String amount;
    private final String contractAddress;

    private ExactDirectPayload(Builder builder) {
        this.txId = builder.txId;
        this.from = builder.from;
        this.to = builder.to;
        this.amount = builder.amount;
        this.contractAddress = builder.contractAddress;
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

    /** Gets the 0x-prefixed transaction ID. */
    public String getTxId() {
        return txId;
    }

    /** Gets the sender's Stacks principal address. */
    public String getFrom() {
        return from;
    }

    /** Gets the recipient's Stacks principal address. */
    public String getTo() {
        return to;
    }

    /** Gets the atomic amount transferred (as string). */
    public String getAmount() {
        return amount;
    }

    /** Gets the SIP-010 token contract address. */
    public String getContractAddress() {
        return contractAddress;
    }

    /**
     * Converts the payload to a map suitable for JSON serialization.
     *
     * @return Map with camelCase keys matching the protocol format
     */
    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>();
        map.put("txId", txId);
        map.put("from", from);
        map.put("to", to);
        map.put("amount", amount);
        map.put("contractAddress", contractAddress);
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
        String txId = (String) map.getOrDefault("txId",
            map.get("tx_id"));
        String from = (String) map.getOrDefault("from",
            map.get("from_address"));
        String to = (String) map.getOrDefault("to",
            map.get("to_address"));
        String amount = String.valueOf(map.getOrDefault("amount", ""));
        String contractAddress = (String) map.getOrDefault("contractAddress",
            map.get("contract_address"));

        return builder()
            .txId(txId != null ? txId : "")
            .from(from != null ? from : "")
            .to(to != null ? to : "")
            .amount(amount)
            .contractAddress(contractAddress != null ? contractAddress : "")
            .build();
    }

    /**
     * Builder for ExactDirectPayload.
     */
    public static class Builder {
        private String txId;
        private String from;
        private String to;
        private String amount;
        private String contractAddress = "";

        public Builder txId(String txId) {
            this.txId = txId;
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

        /**
         * Builds the payload.
         *
         * @return New ExactDirectPayload instance
         * @throws IllegalArgumentException if required fields are missing
         */
        public ExactDirectPayload build() {
            if (txId == null || txId.isEmpty()) {
                throw new IllegalArgumentException("Transaction ID is required");
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
