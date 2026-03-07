package io.t402.schemes.stellar;

import java.util.HashMap;
import java.util.Map;

/**
 * Payload for exact Stellar payments.
 *
 * <p>Contains the signature and authorization data needed
 * to execute a payment on the Stellar blockchain.
 */
public class ExactStellarPayload {

    private final String signature;
    private final StellarAuthorization authorization;

    private ExactStellarPayload(Builder builder) {
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

    // Getters

    public String getSignature() {
        return signature;
    }

    public StellarAuthorization getAuthorization() {
        return authorization;
    }

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
     * Creates an ExactStellarPayload from a map.
     *
     * @param map Map containing payload data
     * @return New ExactStellarPayload instance
     */
    @SuppressWarnings("unchecked")
    public static ExactStellarPayload fromMap(Map<String, Object> map) {
        String signature = (String) map.get("signature");
        Map<String, Object> authMap = (Map<String, Object>) map.get("authorization");

        StellarAuthorization auth = StellarAuthorization.builder()
            .sender((String) authMap.get("sender"))
            .recipient((String) authMap.get("recipient"))
            .amount((String) authMap.get("amount"))
            .tokenContract((String) authMap.get("tokenContract"))
            .nonce((String) authMap.get("nonce"))
            .maxLedger(((Number) authMap.get("maxLedger")).intValue())
            .validUntil(((Number) authMap.get("validUntil")).longValue())
            .build();

        return builder()
            .signature(signature)
            .authorization(auth)
            .build();
    }

    /**
     * Builder for ExactStellarPayload.
     */
    public static class Builder {
        private String signature;
        private StellarAuthorization authorization;

        public Builder signature(String signature) {
            this.signature = signature;
            return this;
        }

        public Builder authorization(StellarAuthorization authorization) {
            this.authorization = authorization;
            return this;
        }

        /**
         * Builds the payload.
         *
         * @return New ExactStellarPayload instance
         * @throws IllegalArgumentException if required fields are missing
         */
        public ExactStellarPayload build() {
            if (signature == null || signature.isEmpty()) {
                throw new IllegalArgumentException("Signature is required");
            }
            if (authorization == null) {
                throw new IllegalArgumentException("Authorization is required");
            }
            return new ExactStellarPayload(this);
        }
    }
}
