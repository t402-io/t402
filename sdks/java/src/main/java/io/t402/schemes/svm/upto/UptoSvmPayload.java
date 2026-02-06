package io.t402.schemes.svm.upto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.HashMap;
import java.util.Map;

/**
 * Up-To SVM payment payload containing a signed approve transaction.
 * <p>
 * The upto scheme for Solana uses SPL ApproveChecked to authorize the
 * facilitator (delegate) to transfer up to maxAmount of tokens from
 * the client's associated token account.
 * </p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UptoSvmPayload {

    /** Base64-encoded signed approve transaction. */
    @JsonProperty("transaction")
    public String transaction;

    /** Approval authorization metadata for verification. */
    @JsonProperty("authorization")
    public UptoSvmAuthorization authorization;

    /** Unique nonce for replay protection (hex string). */
    @JsonProperty("paymentNonce")
    public String paymentNonce;

    /** Default constructor for Jackson. */
    public UptoSvmPayload() {}

    /**
     * Creates a new UptoSvmPayload.
     *
     * @param transaction base64-encoded signed approve transaction
     * @param authorization approval authorization metadata
     * @param paymentNonce unique nonce for replay protection
     */
    public UptoSvmPayload(String transaction, UptoSvmAuthorization authorization,
                           String paymentNonce) {
        this.transaction = transaction;
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
        result.put("transaction", transaction);
        if (authorization != null) {
            result.put("authorization", authorization.toMap());
        }
        result.put("paymentNonce", paymentNonce);
        return result;
    }

    /**
     * Creates an UptoSvmPayload from a map.
     *
     * @param data map containing payload data
     * @return a new UptoSvmPayload
     */
    @SuppressWarnings("unchecked")
    public static UptoSvmPayload fromMap(Map<String, Object> data) {
        UptoSvmPayload payload = new UptoSvmPayload();

        if (data.get("transaction") instanceof String) {
            payload.transaction = (String) data.get("transaction");
        }

        if (data.get("paymentNonce") instanceof String) {
            payload.paymentNonce = (String) data.get("paymentNonce");
        }

        if (data.get("authorization") instanceof Map) {
            payload.authorization = UptoSvmAuthorization.fromMap(
                (Map<String, Object>) data.get("authorization")
            );
        }

        return payload;
    }

    /**
     * Checks if this payload has a valid structure.
     *
     * @return true if the payload has all required fields
     */
    public boolean isValid() {
        return transaction != null && !transaction.isEmpty()
            && paymentNonce != null && !paymentNonce.isEmpty()
            && authorization != null
            && authorization.owner != null && !authorization.owner.isEmpty()
            && authorization.delegate != null && !authorization.delegate.isEmpty();
    }

    /**
     * Checks if the given data represents a valid SVM upto payload.
     *
     * @param data map containing payload data
     * @return true if the data has the correct SVM upto payload structure
     */
    @SuppressWarnings("unchecked")
    public static boolean isUptoSvmPayload(Map<String, Object> data) {
        if (data == null) {
            return false;
        }

        if (!(data.get("transaction") instanceof String)) {
            return false;
        }

        if (!(data.get("paymentNonce") instanceof String)) {
            return false;
        }

        Object auth = data.get("authorization");
        if (!(auth instanceof Map)) {
            return false;
        }

        Map<String, Object> authMap = (Map<String, Object>) auth;
        return authMap.get("owner") instanceof String
            && authMap.get("delegate") instanceof String
            && authMap.get("mint") instanceof String
            && authMap.get("maxAmount") instanceof String
            && authMap.get("sourceATA") instanceof String;
    }

    /**
     * Creates a new builder for UptoSvmPayload.
     *
     * @return a new builder instance
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder for creating UptoSvmPayload instances.
     */
    public static class Builder {
        private String transaction;
        private UptoSvmAuthorization authorization;
        private String paymentNonce;

        /**
         * Sets the transaction.
         *
         * @param transaction base64-encoded signed approve transaction
         * @return this builder
         */
        public Builder transaction(String transaction) {
            this.transaction = transaction;
            return this;
        }

        /**
         * Sets the authorization.
         *
         * @param authorization approval authorization metadata
         * @return this builder
         */
        public Builder authorization(UptoSvmAuthorization authorization) {
            this.authorization = authorization;
            return this;
        }

        /**
         * Sets the payment nonce.
         *
         * @param paymentNonce unique nonce for replay protection
         * @return this builder
         */
        public Builder paymentNonce(String paymentNonce) {
            this.paymentNonce = paymentNonce;
            return this;
        }

        /**
         * Builds the UptoSvmPayload.
         *
         * @return new UptoSvmPayload instance
         */
        public UptoSvmPayload build() {
            return new UptoSvmPayload(transaction, authorization, paymentNonce);
        }
    }

    @Override
    public String toString() {
        return "UptoSvmPayload{" +
            "transaction='" + (transaction != null ? transaction.substring(0,
                Math.min(20, transaction.length())) + "..." : "null") + '\'' +
            ", authorization=" + authorization +
            ", paymentNonce='" + paymentNonce + '\'' +
            '}';
    }
}
