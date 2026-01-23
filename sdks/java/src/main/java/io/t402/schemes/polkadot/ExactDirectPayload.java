package io.t402.schemes.polkadot;

import java.util.HashMap;
import java.util.Map;

/**
 * Payload for Polkadot exact-direct payments.
 *
 * <p>Contains the on-chain proof of a completed asset transfer via the
 * Assets pallet on Polkadot Asset Hub.
 *
 * <p>In the exact-direct scheme, the client executes the assets.transfer
 * extrinsic on-chain and provides the extrinsic hash as proof of payment.
 */
public class ExactDirectPayload {

    private final String extrinsicHash;
    private final String blockHash;
    private final int extrinsicIndex;
    private final String from;
    private final String to;
    private final String amount;
    private final int assetId;

    private ExactDirectPayload(Builder builder) {
        this.extrinsicHash = builder.extrinsicHash;
        this.blockHash = builder.blockHash;
        this.extrinsicIndex = builder.extrinsicIndex;
        this.from = builder.from;
        this.to = builder.to;
        this.amount = builder.amount;
        this.assetId = builder.assetId;
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

    /** Gets the 0x-prefixed hex hash of the submitted extrinsic. */
    public String getExtrinsicHash() {
        return extrinsicHash;
    }

    /** Gets the 0x-prefixed hex hash of the block containing the extrinsic. */
    public String getBlockHash() {
        return blockHash;
    }

    /** Gets the index of the extrinsic within the block. */
    public int getExtrinsicIndex() {
        return extrinsicIndex;
    }

    /** Gets the SS58-encoded sender address. */
    public String getFrom() {
        return from;
    }

    /** Gets the SS58-encoded recipient address. */
    public String getTo() {
        return to;
    }

    /** Gets the atomic amount transferred (as string). */
    public String getAmount() {
        return amount;
    }

    /** Gets the on-chain asset ID (e.g., 1984 for USDT). */
    public int getAssetId() {
        return assetId;
    }

    /**
     * Converts the payload to a map suitable for JSON serialization.
     *
     * @return Map with camelCase keys matching the protocol format
     */
    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>();
        map.put("extrinsicHash", extrinsicHash);
        map.put("blockHash", blockHash);
        map.put("extrinsicIndex", extrinsicIndex);
        map.put("from", from);
        map.put("to", to);
        map.put("amount", amount);
        map.put("assetId", assetId);
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
        String extrinsicHash = (String) map.getOrDefault("extrinsicHash",
            map.get("extrinsic_hash"));
        String blockHash = (String) map.getOrDefault("blockHash",
            map.get("block_hash"));

        Object indexObj = map.getOrDefault("extrinsicIndex",
            map.get("extrinsic_index"));
        int extrinsicIndex = 0;
        if (indexObj instanceof Number) {
            extrinsicIndex = ((Number) indexObj).intValue();
        } else if (indexObj instanceof String) {
            extrinsicIndex = Integer.parseInt((String) indexObj);
        }

        String from = (String) map.getOrDefault("from",
            map.get("from_address"));
        String to = (String) map.getOrDefault("to",
            map.get("to_address"));
        String amount = String.valueOf(map.getOrDefault("amount", ""));

        Object assetIdObj = map.getOrDefault("assetId",
            map.get("asset_id"));
        int assetId = 0;
        if (assetIdObj instanceof Number) {
            assetId = ((Number) assetIdObj).intValue();
        } else if (assetIdObj instanceof String) {
            assetId = Integer.parseInt((String) assetIdObj);
        }

        return builder()
            .extrinsicHash(extrinsicHash != null ? extrinsicHash : "")
            .blockHash(blockHash != null ? blockHash : "")
            .extrinsicIndex(extrinsicIndex)
            .from(from != null ? from : "")
            .to(to != null ? to : "")
            .amount(amount)
            .assetId(assetId)
            .build();
    }

    /**
     * Builder for ExactDirectPayload.
     */
    public static class Builder {
        private String extrinsicHash;
        private String blockHash = "";
        private int extrinsicIndex;
        private String from;
        private String to;
        private String amount;
        private int assetId;

        public Builder extrinsicHash(String extrinsicHash) {
            this.extrinsicHash = extrinsicHash;
            return this;
        }

        public Builder blockHash(String blockHash) {
            this.blockHash = blockHash;
            return this;
        }

        public Builder extrinsicIndex(int extrinsicIndex) {
            this.extrinsicIndex = extrinsicIndex;
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

        public Builder assetId(int assetId) {
            this.assetId = assetId;
            return this;
        }

        /**
         * Builds the payload.
         *
         * @return New ExactDirectPayload instance
         * @throws IllegalArgumentException if required fields are missing
         */
        public ExactDirectPayload build() {
            if (extrinsicHash == null || extrinsicHash.isEmpty()) {
                throw new IllegalArgumentException("Extrinsic hash is required");
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
