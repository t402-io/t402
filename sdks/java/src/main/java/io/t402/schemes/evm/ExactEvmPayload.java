package io.t402.schemes.evm;

import java.util.HashMap;
import java.util.Map;

/**
 * Payload for exact EVM payments using EIP-3009 TransferWithAuthorization.
 *
 * <p>Contains the signature and authorization data needed to execute
 * a payment on EVM-compatible blockchains.</p>
 */
public class ExactEvmPayload {

    private final String signature;
    private final EvmAuthorization authorization;

    private ExactEvmPayload(Builder builder) {
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
     * Gets the transfer authorization.
     *
     * @return Authorization parameters
     */
    public EvmAuthorization getAuthorization() {
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
     * Creates an ExactEvmPayload from a map.
     *
     * @param map Map containing payload data
     * @return New ExactEvmPayload instance
     * @throws IllegalArgumentException if required fields are missing
     */
    @SuppressWarnings("unchecked")
    public static ExactEvmPayload fromMap(Map<String, Object> map) {
        String signature = (String) map.get("signature");
        Map<String, Object> authMap = (Map<String, Object>) map.get("authorization");

        if (authMap == null) {
            throw new IllegalArgumentException("Missing authorization in payload");
        }

        EvmAuthorization auth = EvmAuthorization.fromMap(authMap);

        return builder()
            .signature(signature)
            .authorization(auth)
            .build();
    }

    // ============================================================
    // Builder
    // ============================================================

    /**
     * Builder for ExactEvmPayload.
     */
    public static class Builder {
        private String signature;
        private EvmAuthorization authorization;

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
         * Sets the transfer authorization.
         *
         * @param authorization Authorization parameters
         * @return this builder
         */
        public Builder authorization(EvmAuthorization authorization) {
            this.authorization = authorization;
            return this;
        }

        /**
         * Builds the payload.
         *
         * @return New ExactEvmPayload instance
         * @throws IllegalArgumentException if required fields are missing
         */
        public ExactEvmPayload build() {
            if (signature == null || signature.isEmpty()) {
                throw new IllegalArgumentException("Signature is required");
            }
            if (authorization == null) {
                throw new IllegalArgumentException("Authorization is required");
            }
            return new ExactEvmPayload(this);
        }
    }
}
