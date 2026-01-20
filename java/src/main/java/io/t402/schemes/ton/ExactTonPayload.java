package io.t402.schemes.ton;

import java.util.HashMap;
import java.util.Map;

/**
 * Payload for exact TON payments.
 *
 * <p>Contains the signature and authorization data needed
 * to execute a payment on the TON blockchain.
 */
public class ExactTonPayload {

    private final String signature;
    private final TonAuthorization authorization;

    private ExactTonPayload(Builder builder) {
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

    public TonAuthorization getAuthorization() {
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
     * Creates an ExactTonPayload from a map.
     *
     * @param map Map containing payload data
     * @return New ExactTonPayload instance
     */
    @SuppressWarnings("unchecked")
    public static ExactTonPayload fromMap(Map<String, Object> map) {
        String signature = (String) map.get("signature");
        Map<String, Object> authMap = (Map<String, Object>) map.get("authorization");

        TonAuthorization auth = TonAuthorization.builder()
            .sender((String) authMap.get("sender"))
            .recipient((String) authMap.get("recipient"))
            .amount((String) authMap.get("amount"))
            .nonce((String) authMap.get("nonce"))
            .token((String) authMap.get("token"))
            .validUntil(((Number) authMap.get("validUntil")).longValue())
            .build();

        return builder()
            .signature(signature)
            .authorization(auth)
            .build();
    }

    /**
     * Builder for ExactTonPayload.
     */
    public static class Builder {
        private String signature;
        private TonAuthorization authorization;

        public Builder signature(String signature) {
            this.signature = signature;
            return this;
        }

        public Builder authorization(TonAuthorization authorization) {
            this.authorization = authorization;
            return this;
        }

        /**
         * Builds the payload.
         *
         * @return New ExactTonPayload instance
         * @throws IllegalArgumentException if required fields are missing
         */
        public ExactTonPayload build() {
            if (signature == null || signature.isEmpty()) {
                throw new IllegalArgumentException("Signature is required");
            }
            if (authorization == null) {
                throw new IllegalArgumentException("Authorization is required");
            }
            return new ExactTonPayload(this);
        }
    }
}
