package io.t402.schemes.cosmos;

import java.util.List;
import java.util.Map;

/**
 * Represents the result of a Cosmos transaction query.
 *
 * <p>Mirrors the structure returned by the Cosmos REST API for transaction queries.
 * The {@link #isSuccess()} method checks whether the transaction completed successfully
 * (code == 0).
 */
public class CosmosTransactionResult {

    private final String txHash;
    private final String height;
    private final int code;
    private final String rawLog;
    private final String gasWanted;
    private final String gasUsed;
    private final String timestamp;
    private final List<Map<String, Object>> messages;

    private CosmosTransactionResult(Builder builder) {
        this.txHash = builder.txHash;
        this.height = builder.height;
        this.code = builder.code;
        this.rawLog = builder.rawLog;
        this.gasWanted = builder.gasWanted;
        this.gasUsed = builder.gasUsed;
        this.timestamp = builder.timestamp;
        this.messages = builder.messages;
    }

    /**
     * Creates a new builder instance.
     *
     * @return New builder
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Checks if the transaction was successful.
     *
     * <p>In the Cosmos SDK, a code of 0 indicates success.
     *
     * @return true if the transaction succeeded (code == 0)
     */
    public boolean isSuccess() {
        return code == 0;
    }

    // Getters

    /**
     * Gets the transaction hash.
     *
     * @return Transaction hash
     */
    public String getTxHash() {
        return txHash;
    }

    /**
     * Gets the block height.
     *
     * @return Block height string
     */
    public String getHeight() {
        return height;
    }

    /**
     * Gets the result code.
     *
     * @return Result code (0 = success)
     */
    public int getCode() {
        return code;
    }

    /**
     * Gets the raw log.
     *
     * @return Raw log string
     */
    public String getRawLog() {
        return rawLog;
    }

    /**
     * Gets the gas wanted.
     *
     * @return Gas wanted string
     */
    public String getGasWanted() {
        return gasWanted;
    }

    /**
     * Gets the gas used.
     *
     * @return Gas used string
     */
    public String getGasUsed() {
        return gasUsed;
    }

    /**
     * Gets the timestamp.
     *
     * @return Timestamp string
     */
    public String getTimestamp() {
        return timestamp;
    }

    /**
     * Gets the transaction messages.
     *
     * <p>Each message is a map representation of a Cosmos SDK message.
     * For bank transfers, the map contains "@type", "from_address",
     * "to_address", and "amount" fields.
     *
     * @return List of message maps
     */
    public List<Map<String, Object>> getMessages() {
        return messages;
    }

    /**
     * Builder for CosmosTransactionResult.
     */
    public static class Builder {
        private String txHash;
        private String height;
        private int code;
        private String rawLog;
        private String gasWanted;
        private String gasUsed;
        private String timestamp;
        private List<Map<String, Object>> messages;

        /**
         * Sets the transaction hash.
         *
         * @param txHash Transaction hash
         * @return this builder
         */
        public Builder txHash(String txHash) {
            this.txHash = txHash;
            return this;
        }

        /**
         * Sets the block height.
         *
         * @param height Block height
         * @return this builder
         */
        public Builder height(String height) {
            this.height = height;
            return this;
        }

        /**
         * Sets the result code.
         *
         * @param code Result code (0 = success)
         * @return this builder
         */
        public Builder code(int code) {
            this.code = code;
            return this;
        }

        /**
         * Sets the raw log.
         *
         * @param rawLog Raw log string
         * @return this builder
         */
        public Builder rawLog(String rawLog) {
            this.rawLog = rawLog;
            return this;
        }

        /**
         * Sets the gas wanted.
         *
         * @param gasWanted Gas wanted
         * @return this builder
         */
        public Builder gasWanted(String gasWanted) {
            this.gasWanted = gasWanted;
            return this;
        }

        /**
         * Sets the gas used.
         *
         * @param gasUsed Gas used
         * @return this builder
         */
        public Builder gasUsed(String gasUsed) {
            this.gasUsed = gasUsed;
            return this;
        }

        /**
         * Sets the timestamp.
         *
         * @param timestamp Timestamp string
         * @return this builder
         */
        public Builder timestamp(String timestamp) {
            this.timestamp = timestamp;
            return this;
        }

        /**
         * Sets the transaction messages.
         *
         * @param messages List of message maps
         * @return this builder
         */
        public Builder messages(List<Map<String, Object>> messages) {
            this.messages = messages;
            return this;
        }

        /**
         * Builds the transaction result.
         *
         * @return New CosmosTransactionResult instance
         */
        public CosmosTransactionResult build() {
            return new CosmosTransactionResult(this);
        }
    }
}
