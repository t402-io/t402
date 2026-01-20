package io.t402.schemes.tron;

import java.util.HashMap;
import java.util.Map;

/**
 * Payload for exact TRON payments.
 *
 * <p>Contains the signature and authorization data needed
 * to execute a payment on the TRON blockchain.
 */
public class ExactTronPayload {

    private final String signature;
    private final TronAuthorization authorization;

    private ExactTronPayload(Builder builder) {
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

    public TronAuthorization getAuthorization() {
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
     * Creates an ExactTronPayload from a map.
     *
     * @param map Map containing payload data
     * @return New ExactTronPayload instance
     */
    @SuppressWarnings("unchecked")
    public static ExactTronPayload fromMap(Map<String, Object> map) {
        String signature = (String) map.get("signature");
        Map<String, Object> authMap = (Map<String, Object>) map.get("authorization");

        TronAuthorization auth = TronAuthorization.builder()
            .from((String) authMap.get("from"))
            .to((String) authMap.get("to"))
            .amount((String) authMap.get("amount"))
            .nonce((String) authMap.get("nonce"))
            .token((String) authMap.get("token"))
            .validAfter(((Number) authMap.get("validAfter")).longValue())
            .validBefore(((Number) authMap.get("validBefore")).longValue())
            .build();

        return builder()
            .signature(signature)
            .authorization(auth)
            .build();
    }

    /**
     * Builder for ExactTronPayload.
     */
    public static class Builder {
        private String signature;
        private TronAuthorization authorization;

        public Builder signature(String signature) {
            this.signature = signature;
            return this;
        }

        public Builder authorization(TronAuthorization authorization) {
            this.authorization = authorization;
            return this;
        }

        /**
         * Builds the payload.
         *
         * @return New ExactTronPayload instance
         * @throws IllegalArgumentException if required fields are missing
         */
        public ExactTronPayload build() {
            if (signature == null || signature.isEmpty()) {
                throw new IllegalArgumentException("Signature is required");
            }
            if (authorization == null) {
                throw new IllegalArgumentException("Authorization is required");
            }
            return new ExactTronPayload(this);
        }
    }
}
