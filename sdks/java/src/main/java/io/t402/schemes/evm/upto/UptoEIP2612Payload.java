package io.t402.schemes.evm.upto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.HashMap;
import java.util.Map;

/**
 * EIP-2612 Permit payload for the Up-To scheme.
 * <p>
 * Contains the permit signature, authorization parameters, and a unique
 * payment nonce to prevent replay attacks.
 * </p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UptoEIP2612Payload {

    /** Permit signature components (v, r, s). */
    public PermitSignature signature;

    /** Permit authorization parameters. */
    public PermitAuthorization authorization;

    /** Unique nonce to prevent replay attacks (hex encoded with 0x prefix). */
    @JsonProperty("paymentNonce")
    public String paymentNonce;

    /** Default constructor for Jackson. */
    public UptoEIP2612Payload() {}

    /**
     * Creates a new UptoEIP2612Payload.
     *
     * @param signature permit signature
     * @param authorization permit authorization
     * @param paymentNonce unique payment nonce
     */
    public UptoEIP2612Payload(PermitSignature signature, PermitAuthorization authorization,
                              String paymentNonce) {
        this.signature = signature;
        this.authorization = authorization;
        this.paymentNonce = paymentNonce;
    }

    /**
     * Converts this payload to a map for JSON serialization.
     *
     * @return map representation of this payload
     */
    public Map<String, Object> toMap() {
        Map<String, Object> result = new HashMap<>();

        Map<String, Object> sigMap = new HashMap<>();
        sigMap.put("v", signature.v);
        sigMap.put("r", signature.r);
        sigMap.put("s", signature.s);
        result.put("signature", sigMap);

        Map<String, Object> authMap = new HashMap<>();
        authMap.put("owner", authorization.owner);
        authMap.put("spender", authorization.spender);
        authMap.put("value", authorization.value);
        authMap.put("deadline", authorization.deadline);
        authMap.put("nonce", authorization.nonce);
        result.put("authorization", authMap);

        result.put("paymentNonce", paymentNonce);

        return result;
    }

    /**
     * Creates an UptoEIP2612Payload from a map.
     *
     * @param data map containing payload data
     * @return a new UptoEIP2612Payload
     */
    @SuppressWarnings("unchecked")
    public static UptoEIP2612Payload fromMap(Map<String, Object> data) {
        UptoEIP2612Payload payload = new UptoEIP2612Payload();

        if (data.get("paymentNonce") instanceof String) {
            payload.paymentNonce = (String) data.get("paymentNonce");
        }

        if (data.get("signature") instanceof Map) {
            Map<String, Object> sigMap = (Map<String, Object>) data.get("signature");
            payload.signature = new PermitSignature();
            if (sigMap.get("v") instanceof Number) {
                payload.signature.v = ((Number) sigMap.get("v")).intValue();
            }
            if (sigMap.get("r") instanceof String) {
                payload.signature.r = (String) sigMap.get("r");
            }
            if (sigMap.get("s") instanceof String) {
                payload.signature.s = (String) sigMap.get("s");
            }
        }

        if (data.get("authorization") instanceof Map) {
            Map<String, Object> authMap = (Map<String, Object>) data.get("authorization");
            payload.authorization = new PermitAuthorization();
            if (authMap.get("owner") instanceof String) {
                payload.authorization.owner = (String) authMap.get("owner");
            }
            if (authMap.get("spender") instanceof String) {
                payload.authorization.spender = (String) authMap.get("spender");
            }
            if (authMap.get("value") instanceof String) {
                payload.authorization.value = (String) authMap.get("value");
            }
            if (authMap.get("deadline") instanceof String) {
                payload.authorization.deadline = (String) authMap.get("deadline");
            }
            if (authMap.get("nonce") instanceof Number) {
                payload.authorization.nonce = ((Number) authMap.get("nonce")).intValue();
            }
        }

        return payload;
    }

    /**
     * Creates a new builder for UptoEIP2612Payload.
     *
     * @return a new builder instance
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder for creating UptoEIP2612Payload instances.
     */
    public static class Builder {
        private PermitSignature signature;
        private PermitAuthorization authorization;
        private String paymentNonce;

        public Builder signature(PermitSignature signature) {
            this.signature = signature;
            return this;
        }

        public Builder signature(int v, String r, String s) {
            this.signature = new PermitSignature(v, r, s);
            return this;
        }

        public Builder authorization(PermitAuthorization authorization) {
            this.authorization = authorization;
            return this;
        }

        public Builder paymentNonce(String paymentNonce) {
            this.paymentNonce = paymentNonce;
            return this;
        }

        public UptoEIP2612Payload build() {
            return new UptoEIP2612Payload(signature, authorization, paymentNonce);
        }
    }
}
