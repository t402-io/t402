package io.t402.schemes.evm.exact_legacy;

import java.util.HashMap;
import java.util.Map;

/**
 * Payload for exact-legacy EVM payments using approve + transferFrom pattern.
 *
 * <p>Contains the EIP-712 signature and legacy authorization data needed to
 * verify and settle a payment on EVM-compatible blockchains.</p>
 */
public class ExactLegacyEvmPayload {

    private final String signature;
    private final LegacyEvmAuthorization authorization;

    private ExactLegacyEvmPayload(Builder builder) {
        this.signature = builder.signature;
        this.authorization = builder.authorization;
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
     * Gets the EIP-712 signature.
     *
     * @return 0x-prefixed hex-encoded signature (65 bytes: r || s || v)
     */
    public String getSignature() {
        return signature;
    }

    /**
     * Gets the legacy transfer authorization.
     *
     * @return Authorization parameters including spender
     */
    public LegacyEvmAuthorization getAuthorization() {
        return authorization;
    }

    // ============================================================
    // Serialization
    // ============================================================

    /**
     * Converts the payload to a map.
     *
     * @return Map representation of the payload
     */
    public Map<String, Object> toMap() {
        Map<String, Object> map = new HashMap<>();
        map.put("signature", signature);
        map.put("authorization", authorization.toMap());
        return map;
    }

    /**
     * Creates an ExactLegacyEvmPayload from a map.
     *
     * @param map Map containing payload data
     * @return New ExactLegacyEvmPayload instance
     * @throws IllegalArgumentException if required fields are missing
     */
    @SuppressWarnings("unchecked")
    public static ExactLegacyEvmPayload fromMap(Map<String, Object> map) {
        String signature = (String) map.get("signature");
        Map<String, Object> authMap = (Map<String, Object>) map.get("authorization");

        if (authMap == null) {
            throw new IllegalArgumentException("Missing authorization in payload");
        }

        LegacyEvmAuthorization auth = LegacyEvmAuthorization.fromMap(authMap);

        return builder()
            .signature(signature)
            .authorization(auth)
            .build();
    }

    // ============================================================
    // Builder
    // ============================================================

    /**
     * Builder for ExactLegacyEvmPayload.
     */
    public static class Builder {
        private String signature;
        private LegacyEvmAuthorization authorization;

        /**
         * Sets the EIP-712 signature.
         *
         * @param signature 0x-prefixed hex-encoded signature
         * @return this builder
         */
        public Builder signature(String signature) {
            this.signature = signature;
            return this;
        }

        /**
         * Sets the legacy transfer authorization.
         *
         * @param authorization Authorization parameters including spender
         * @return this builder
         */
        public Builder authorization(LegacyEvmAuthorization authorization) {
            this.authorization = authorization;
            return this;
        }

        /**
         * Builds the payload.
         *
         * @return New ExactLegacyEvmPayload instance
         * @throws IllegalArgumentException if required fields are missing
         */
        public ExactLegacyEvmPayload build() {
            if (signature == null || signature.isEmpty()) {
                throw new IllegalArgumentException("Signature is required");
            }
            if (authorization == null) {
                throw new IllegalArgumentException("Authorization is required");
            }
            return new ExactLegacyEvmPayload(this);
        }
    }
}
