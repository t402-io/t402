package io.t402.schemes.ton.upto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.HashMap;
import java.util.Map;

/**
 * TON upto payment payload.
 *
 * <p>Contains a signed transfer message to the facilitator's holding address.
 * The facilitator broadcasts the transfer, then forwards settleAmount to payTo
 * and refunds (maxAmount - settleAmount) back to the client.
 * </p>
 *
 * <p>This implements the escrow pattern for TON Jettons (TEP-74), which don't
 * have native approve/transferFrom like EVM.</p>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UptoTonPayload {

    /** Base64 encoded signed external message (BOC format). */
    @JsonProperty("signedBoc")
    public String signedBoc;

    /** Transfer authorization metadata for verification. */
    public UptoTonAuthorization authorization;

    /** Unique nonce for replay protection (hex string). */
    @JsonProperty("paymentNonce")
    public String paymentNonce;

    /** Default constructor for Jackson. */
    public UptoTonPayload() {}

    /**
     * Creates a new UptoTonPayload.
     *
     * @param signedBoc base64 encoded signed BOC
     * @param authorization transfer authorization metadata
     * @param paymentNonce unique payment nonce
     */
    public UptoTonPayload(String signedBoc, UptoTonAuthorization authorization, String paymentNonce) {
        this.signedBoc = signedBoc;
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
        result.put("signedBoc", signedBoc);
        if (authorization != null) {
            result.put("authorization", authorization.toMap());
        }
        result.put("paymentNonce", paymentNonce);
        return result;
    }

    /**
     * Creates an UptoTonPayload from a map.
     *
     * @param data map containing payload data
     * @return a new UptoTonPayload instance
     */
    @SuppressWarnings("unchecked")
    public static UptoTonPayload fromMap(Map<String, Object> data) {
        UptoTonPayload payload = new UptoTonPayload();

        if (data.get("signedBoc") instanceof String) {
            payload.signedBoc = (String) data.get("signedBoc");
        }

        if (data.get("paymentNonce") instanceof String) {
            payload.paymentNonce = (String) data.get("paymentNonce");
        }

        if (data.get("authorization") instanceof Map) {
            Map<String, Object> authMap = (Map<String, Object>) data.get("authorization");
            UptoTonAuthorization auth = new UptoTonAuthorization();

            if (authMap.get("from") instanceof String) {
                auth.from = (String) authMap.get("from");
            }
            if (authMap.get("facilitator") instanceof String) {
                auth.facilitator = (String) authMap.get("facilitator");
            }
            if (authMap.get("jettonMaster") instanceof String) {
                auth.jettonMaster = (String) authMap.get("jettonMaster");
            }
            if (authMap.get("maxAmount") instanceof String) {
                auth.maxAmount = (String) authMap.get("maxAmount");
            }
            if (authMap.get("tonAmount") instanceof String) {
                auth.tonAmount = (String) authMap.get("tonAmount");
            }
            if (authMap.get("validUntil") instanceof Number) {
                auth.validUntil = ((Number) authMap.get("validUntil")).longValue();
            }
            if (authMap.get("seqno") instanceof Number) {
                auth.seqno = ((Number) authMap.get("seqno")).longValue();
            }
            if (authMap.get("queryId") instanceof String) {
                auth.queryId = (String) authMap.get("queryId");
            }

            payload.authorization = auth;
        }

        return payload;
    }

    /**
     * Checks if this payload has valid required fields.
     *
     * @return true if the payload has all required fields
     */
    public boolean isValid() {
        if (signedBoc == null || signedBoc.isEmpty()) {
            return false;
        }
        if (paymentNonce == null || paymentNonce.isEmpty()) {
            return false;
        }
        if (authorization == null) {
            return false;
        }
        if (authorization.from == null || authorization.from.isEmpty()) {
            return false;
        }
        if (authorization.facilitator == null || authorization.facilitator.isEmpty()) {
            return false;
        }
        return true;
    }

    /**
     * Checks if the given map represents a valid TON upto payload.
     *
     * @param data map to check
     * @return true if the map has the correct TON upto payload structure
     */
    @SuppressWarnings("unchecked")
    public static boolean isUptoTonPayload(Map<String, Object> data) {
        if (data == null) {
            return false;
        }

        if (!(data.get("signedBoc") instanceof String) || ((String) data.get("signedBoc")).isEmpty()) {
            return false;
        }
        if (!(data.get("paymentNonce") instanceof String) || ((String) data.get("paymentNonce")).isEmpty()) {
            return false;
        }

        if (!(data.get("authorization") instanceof Map)) {
            return false;
        }

        Map<String, Object> auth = (Map<String, Object>) data.get("authorization");

        // Check required string fields
        String[] requiredStrFields = {"from", "facilitator", "jettonMaster", "maxAmount", "tonAmount", "queryId"};
        for (String field : requiredStrFields) {
            if (!(auth.get(field) instanceof String)) {
                return false;
            }
        }

        // from and facilitator must not be empty
        if (((String) auth.get("from")).isEmpty() || ((String) auth.get("facilitator")).isEmpty()) {
            return false;
        }

        // Check numeric fields
        if (!(auth.get("validUntil") instanceof Number)) {
            return false;
        }
        if (!(auth.get("seqno") instanceof Number)) {
            return false;
        }

        return true;
    }

    /**
     * Creates a new builder for UptoTonPayload.
     *
     * @return a new builder instance
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder for creating UptoTonPayload instances.
     */
    public static class Builder {
        private String signedBoc;
        private UptoTonAuthorization authorization;
        private String paymentNonce;

        /**
         * Sets the signed BOC.
         *
         * @param signedBoc base64 encoded signed BOC
         * @return this builder
         */
        public Builder signedBoc(String signedBoc) {
            this.signedBoc = signedBoc;
            return this;
        }

        /**
         * Sets the authorization.
         *
         * @param authorization transfer authorization metadata
         * @return this builder
         */
        public Builder authorization(UptoTonAuthorization authorization) {
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
         * @return a new UptoTonPayload instance
         */
        public UptoTonPayload build() {
            return new UptoTonPayload(signedBoc, authorization, paymentNonce);
        }
    }
}
