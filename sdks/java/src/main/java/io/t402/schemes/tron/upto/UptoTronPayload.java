package io.t402.schemes.tron.upto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.HashMap;
import java.util.Map;

/**
 * TRON upto payment payload using TRC-20 approve + transferFrom.
 * <p>
 * Contains a signed approve transaction that authorizes the facilitator
 * to transfer up to maxAmount of tokens on behalf of the payer.
 * </p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UptoTronPayload {

    /** Hex-encoded signed approve transaction. */
    @JsonProperty("signedTransaction")
    public String signedTransaction;

    /** Approve transaction authorization metadata. */
    public UptoTronAuthorization authorization;

    /** Unique nonce for replay protection (hex string). */
    @JsonProperty("paymentNonce")
    public String paymentNonce;

    /** Default constructor for Jackson. */
    public UptoTronPayload() {}

    /**
     * Creates a new UptoTronPayload.
     *
     * @param signedTransaction hex-encoded signed approve transaction
     * @param authorization approve transaction authorization metadata
     * @param paymentNonce unique payment nonce
     */
    public UptoTronPayload(String signedTransaction, UptoTronAuthorization authorization,
                            String paymentNonce) {
        this.signedTransaction = signedTransaction;
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
        result.put("signedTransaction", signedTransaction);
        if (authorization != null) {
            result.put("authorization", authorization.toMap());
        }
        result.put("paymentNonce", paymentNonce);
        return result;
    }

    /**
     * Creates an UptoTronPayload from a map.
     *
     * @param data map containing payload data
     * @return a new UptoTronPayload
     */
    @SuppressWarnings("unchecked")
    public static UptoTronPayload fromMap(Map<String, Object> data) {
        UptoTronPayload payload = new UptoTronPayload();

        if (data.get("signedTransaction") instanceof String) {
            payload.signedTransaction = (String) data.get("signedTransaction");
        }

        if (data.get("paymentNonce") instanceof String) {
            payload.paymentNonce = (String) data.get("paymentNonce");
        }

        if (data.get("authorization") instanceof Map) {
            Map<String, Object> authMap = (Map<String, Object>) data.get("authorization");
            UptoTronAuthorization auth = new UptoTronAuthorization();

            if (authMap.get("owner") instanceof String) {
                auth.owner = (String) authMap.get("owner");
            }
            if (authMap.get("spender") instanceof String) {
                auth.spender = (String) authMap.get("spender");
            }
            if (authMap.get("contractAddress") instanceof String) {
                auth.contractAddress = (String) authMap.get("contractAddress");
            }
            if (authMap.get("maxAmount") instanceof String) {
                auth.maxAmount = (String) authMap.get("maxAmount");
            }
            if (authMap.get("expiration") instanceof Number) {
                auth.expiration = ((Number) authMap.get("expiration")).longValue();
            }
            if (authMap.get("refBlockBytes") instanceof String) {
                auth.refBlockBytes = (String) authMap.get("refBlockBytes");
            }
            if (authMap.get("refBlockHash") instanceof String) {
                auth.refBlockHash = (String) authMap.get("refBlockHash");
            }
            if (authMap.get("timestamp") instanceof Number) {
                auth.timestamp = ((Number) authMap.get("timestamp")).longValue();
            }

            payload.authorization = auth;
        }

        return payload;
    }

    /**
     * Checks if the given data represents a valid upto TRON payload.
     *
     * @param data map containing payload data
     * @return true if the data is a valid upto TRON payload structure
     */
    @SuppressWarnings("unchecked")
    public static boolean isValid(Map<String, Object> data) {
        if (data == null) {
            return false;
        }

        // Check signedTransaction
        Object signedTx = data.get("signedTransaction");
        if (!(signedTx instanceof String) || ((String) signedTx).isEmpty()) {
            return false;
        }

        // Check paymentNonce
        Object nonce = data.get("paymentNonce");
        if (!(nonce instanceof String) || ((String) nonce).isEmpty()) {
            return false;
        }

        // Check authorization
        Object auth = data.get("authorization");
        if (!(auth instanceof Map)) {
            return false;
        }

        Map<String, Object> authMap = (Map<String, Object>) auth;

        // Check required string fields
        String[] requiredStringFields = {"owner", "spender", "contractAddress", "maxAmount"};
        for (String field : requiredStringFields) {
            Object val = authMap.get(field);
            if (!(val instanceof String) || ((String) val).isEmpty()) {
                return false;
            }
        }

        // Check numeric fields
        if (!(authMap.get("expiration") instanceof Number)) {
            return false;
        }
        if (!(authMap.get("timestamp") instanceof Number)) {
            return false;
        }

        // Check string fields (can be empty)
        if (!(authMap.get("refBlockBytes") instanceof String)) {
            return false;
        }
        if (!(authMap.get("refBlockHash") instanceof String)) {
            return false;
        }

        return true;
    }

    /**
     * Creates a new builder for UptoTronPayload.
     *
     * @return a new builder instance
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder for creating UptoTronPayload instances.
     */
    public static class Builder {
        private String signedTransaction;
        private UptoTronAuthorization authorization;
        private String paymentNonce;

        /**
         * Sets the signed transaction.
         *
         * @param signedTransaction hex-encoded signed transaction
         * @return this builder
         */
        public Builder signedTransaction(String signedTransaction) {
            this.signedTransaction = signedTransaction;
            return this;
        }

        /**
         * Sets the authorization metadata.
         *
         * @param authorization approve authorization
         * @return this builder
         */
        public Builder authorization(UptoTronAuthorization authorization) {
            this.authorization = authorization;
            return this;
        }

        /**
         * Sets the payment nonce.
         *
         * @param paymentNonce unique payment nonce
         * @return this builder
         */
        public Builder paymentNonce(String paymentNonce) {
            this.paymentNonce = paymentNonce;
            return this;
        }

        /**
         * Builds the payload.
         *
         * @return new UptoTronPayload instance
         */
        public UptoTronPayload build() {
            return new UptoTronPayload(signedTransaction, authorization, paymentNonce);
        }
    }
}
