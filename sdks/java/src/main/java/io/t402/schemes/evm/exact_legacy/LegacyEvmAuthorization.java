package io.t402.schemes.evm.exact_legacy;

import io.t402.schemes.evm.EvmConstants;

import java.util.HashMap;
import java.util.Map;

/**
 * Authorization data for EVM exact-legacy LegacyTransferAuthorization payments.
 *
 * <p>Contains all parameters needed to authorize a token transfer
 * on EVM-compatible blockchains using the approve + transferFrom pattern.
 * Unlike {@link io.t402.schemes.evm.EvmAuthorization}, this includes a
 * {@code spender} field representing the facilitator address.</p>
 *
 * <h2>Usage Example</h2>
 * <pre>{@code
 * LegacyEvmAuthorization auth = LegacyEvmAuthorization.builder()
 *     .from("0xSenderAddress")
 *     .to("0xRecipientAddress")
 *     .value("1000000") // 1 USDT (6 decimals)
 *     .nonce("0x" + randomHex32Bytes)
 *     .validAfter(System.currentTimeMillis() / 1000 - 60)
 *     .validBefore(System.currentTimeMillis() / 1000 + 300)
 *     .spender("0xFacilitatorAddress")
 *     .build();
 * }</pre>
 */
public class LegacyEvmAuthorization {

    private final String from;
    private final String to;
    private final String value;
    private final String nonce;
    private final long validAfter;
    private final long validBefore;
    private final String spender;

    private LegacyEvmAuthorization(Builder builder) {
        this.from = builder.from;
        this.to = builder.to;
        this.value = builder.value;
        this.nonce = builder.nonce;
        this.validAfter = builder.validAfter;
        this.validBefore = builder.validBefore;
        this.spender = builder.spender;
    }

    /**
     * Creates a new builder instance.
     *
     * @return New builder
     */
    public static Builder builder() {
        return new Builder();
    }

    // ============================================================
    // Getters
    // ============================================================

    /**
     * Gets the sender address.
     *
     * @return 0x-prefixed Ethereum address
     */
    public String getFrom() {
        return from;
    }

    /**
     * Gets the recipient address.
     *
     * @return 0x-prefixed Ethereum address
     */
    public String getTo() {
        return to;
    }

    /**
     * Gets the transfer value in atomic units.
     *
     * @return Value as string (in smallest token denomination)
     */
    public String getValue() {
        return value;
    }

    /**
     * Gets the nonce (32-byte random value).
     *
     * @return 0x-prefixed hex-encoded 32-byte nonce
     */
    public String getNonce() {
        return nonce;
    }

    /**
     * Gets the earliest valid timestamp.
     *
     * @return Unix timestamp in seconds
     */
    public long getValidAfter() {
        return validAfter;
    }

    /**
     * Gets the latest valid timestamp (deadline).
     *
     * @return Unix timestamp in seconds
     */
    public long getValidBefore() {
        return validBefore;
    }

    /**
     * Gets the spender address (facilitator that will call transferFrom).
     *
     * @return 0x-prefixed Ethereum address of the facilitator
     */
    public String getSpender() {
        return spender;
    }

    // ============================================================
    // Serialization
    // ============================================================

    /**
     * Converts authorization to a map for EIP-712 signing.
     *
     * @return Map containing authorization fields for signing
     */
    public Map<String, Object> toSigningPayload() {
        Map<String, Object> payload = new HashMap<>();
        payload.put("from", from);
        payload.put("to", to);
        payload.put("value", value);
        payload.put("validAfter", String.valueOf(validAfter));
        payload.put("validBefore", String.valueOf(validBefore));
        payload.put("nonce", nonce);
        payload.put("spender", spender);
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
        map.put("value", value);
        map.put("nonce", nonce);
        map.put("validAfter", validAfter);
        map.put("validBefore", validBefore);
        map.put("spender", spender);
        return map;
    }

    /**
     * Creates a LegacyEvmAuthorization from a map.
     *
     * @param map Map containing authorization data
     * @return New LegacyEvmAuthorization instance
     * @throws IllegalArgumentException if required fields are missing
     */
    public static LegacyEvmAuthorization fromMap(Map<String, Object> map) {
        return builder()
            .from((String) map.get("from"))
            .to((String) map.get("to"))
            .value((String) map.get("value"))
            .nonce((String) map.get("nonce"))
            .validAfter(((Number) map.get("validAfter")).longValue())
            .validBefore(((Number) map.get("validBefore")).longValue())
            .spender((String) map.get("spender"))
            .build();
    }

    // ============================================================
    // Builder
    // ============================================================

    /**
     * Builder for LegacyEvmAuthorization.
     */
    public static class Builder {
        private String from;
        private String to;
        private String value;
        private String nonce;
        private long validAfter;
        private long validBefore;
        private String spender;

        /**
         * Sets the sender address.
         *
         * @param from 0x-prefixed Ethereum address
         * @return this builder
         */
        public Builder from(String from) {
            this.from = from;
            return this;
        }

        /**
         * Sets the recipient address.
         *
         * @param to 0x-prefixed Ethereum address
         * @return this builder
         */
        public Builder to(String to) {
            this.to = to;
            return this;
        }

        /**
         * Sets the transfer value in atomic units.
         *
         * @param value Amount in smallest denomination (e.g., "1000000" for 1 USDT)
         * @return this builder
         */
        public Builder value(String value) {
            this.value = value;
            return this;
        }

        /**
         * Sets the nonce.
         *
         * @param nonce 0x-prefixed 32-byte hex string
         * @return this builder
         */
        public Builder nonce(String nonce) {
            this.nonce = nonce;
            return this;
        }

        /**
         * Sets the earliest valid timestamp.
         *
         * @param validAfter Unix timestamp in seconds
         * @return this builder
         */
        public Builder validAfter(long validAfter) {
            this.validAfter = validAfter;
            return this;
        }

        /**
         * Sets the latest valid timestamp (deadline).
         *
         * @param validBefore Unix timestamp in seconds
         * @return this builder
         */
        public Builder validBefore(long validBefore) {
            this.validBefore = validBefore;
            return this;
        }

        /**
         * Sets the spender address (facilitator).
         *
         * @param spender 0x-prefixed Ethereum address of the facilitator
         * @return this builder
         */
        public Builder spender(String spender) {
            this.spender = spender;
            return this;
        }

        /**
         * Builds the authorization.
         *
         * @return New LegacyEvmAuthorization instance
         * @throws IllegalArgumentException if required fields are missing
         */
        public LegacyEvmAuthorization build() {
            if (from == null || from.isEmpty()) {
                throw new IllegalArgumentException("From address is required");
            }
            if (to == null || to.isEmpty()) {
                throw new IllegalArgumentException("To address is required");
            }
            if (value == null || value.isEmpty()) {
                throw new IllegalArgumentException("Value is required");
            }
            if (nonce == null || nonce.isEmpty()) {
                throw new IllegalArgumentException("Nonce is required");
            }
            if (spender == null || spender.isEmpty()) {
                throw new IllegalArgumentException("Spender address is required");
            }
            if (validBefore <= 0) {
                validBefore = System.currentTimeMillis() / 1000 + EvmConstants.DEFAULT_VALIDITY_DURATION;
            }
            return new LegacyEvmAuthorization(this);
        }
    }
}
