package io.t402.schemes.svm;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.HashMap;
import java.util.Map;

/**
 * Exact SVM payment payload containing a base64-encoded transaction.
 * <p>
 * Contains the signed transaction and optional authorization metadata
 * for SPL token transfers.
 * </p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ExactSvmPayload {

    /** Base64-encoded signed transaction. */
    @JsonProperty("transaction")
    public String transaction;

    /** Optional authorization metadata. */
    @JsonProperty("authorization")
    public SvmAuthorization authorization;

    /** Default constructor for Jackson. */
    public ExactSvmPayload() {}

    /**
     * Creates a new ExactSvmPayload.
     *
     * @param transaction base64-encoded signed transaction
     */
    public ExactSvmPayload(String transaction) {
        this.transaction = transaction;
    }

    /**
     * Creates a new ExactSvmPayload with authorization.
     *
     * @param transaction base64-encoded signed transaction
     * @param authorization transfer authorization metadata
     */
    public ExactSvmPayload(String transaction, SvmAuthorization authorization) {
        this.transaction = transaction;
        this.authorization = authorization;
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
        return result;
    }

    /**
     * Creates an ExactSvmPayload from a map.
     *
     * @param data map containing payload data
     * @return a new ExactSvmPayload
     */
    @SuppressWarnings("unchecked")
    public static ExactSvmPayload fromMap(Map<String, Object> data) {
        ExactSvmPayload payload = new ExactSvmPayload();

        if (data.get("transaction") instanceof String) {
            payload.transaction = (String) data.get("transaction");
        }

        if (data.get("authorization") instanceof Map) {
            payload.authorization = SvmAuthorization.fromMap(
                (Map<String, Object>) data.get("authorization")
            );
        }

        return payload;
    }

    /**
     * Checks if this payload has a valid structure.
     *
     * @return true if the payload has required fields
     */
    public boolean isValid() {
        return transaction != null && !transaction.isEmpty();
    }

    /**
     * Creates a new builder for ExactSvmPayload.
     *
     * @return a new builder instance
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder for creating ExactSvmPayload instances.
     */
    public static class Builder {
        private String transaction;
        private SvmAuthorization authorization;

        public Builder transaction(String transaction) {
            this.transaction = transaction;
            return this;
        }

        public Builder authorization(SvmAuthorization authorization) {
            this.authorization = authorization;
            return this;
        }

        public ExactSvmPayload build() {
            return new ExactSvmPayload(transaction, authorization);
        }
    }

    @Override
    public String toString() {
        return "ExactSvmPayload{" +
            "transaction='" + (transaction != null ? transaction.substring(0,
                Math.min(20, transaction.length())) + "..." : "null") + '\'' +
            ", authorization=" + authorization +
            '}';
    }
}
