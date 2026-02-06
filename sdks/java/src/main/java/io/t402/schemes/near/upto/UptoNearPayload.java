package io.t402.schemes.near.upto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.HashMap;
import java.util.Map;

/**
 * NEAR upto payment payload.
 *
 * <p>Contains the transaction hash of the client's transfer to the facilitator,
 * along with authorization metadata and a unique payment nonce for replay protection.
 *
 * <p>In the upto scheme for NEAR, since NEP-141 tokens don't have native
 * approve/transferFrom, an escrow pattern is used:
 * <ol>
 *   <li>Client ft_transfers maxAmount to the facilitator's NEAR account</li>
 *   <li>Facilitator verifies the transfer</li>
 *   <li>Facilitator forwards settleAmount to payTo and refunds the rest</li>
 * </ol>
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UptoNearPayload {

    /** NEAR transaction hash of the transfer to facilitator. */
    @JsonProperty("txHash")
    private final String txHash;

    /** Authorization metadata for verification. */
    private final UptoNearAuthorization authorization;

    /** Unique nonce for replay protection (hex string). */
    @JsonProperty("paymentNonce")
    private final String paymentNonce;

    private UptoNearPayload(Builder builder) {
        this.txHash = builder.txHash;
        this.authorization = builder.authorization;
        this.paymentNonce = builder.paymentNonce;
    }

    /** Default constructor for Jackson. */
    UptoNearPayload() {
        this.txHash = null;
        this.authorization = null;
        this.paymentNonce = null;
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

    /**
     * Gets the transaction hash.
     *
     * @return NEAR transaction hash
     */
    public String getTxHash() {
        return txHash;
    }

    /**
     * Gets the authorization metadata.
     *
     * @return Authorization containing transfer details
     */
    public UptoNearAuthorization getAuthorization() {
        return authorization;
    }

    /**
     * Gets the payment nonce.
     *
     * @return Unique nonce for replay protection
     */
    public String getPaymentNonce() {
        return paymentNonce;
    }

    /**
     * Checks if this payload has all required fields populated.
     *
     * @return true if the payload is valid
     */
    public boolean isValid() {
        if (txHash == null || txHash.isEmpty()) return false;
        if (paymentNonce == null || paymentNonce.isEmpty()) return false;
        if (authorization == null) return false;
        return authorization.isValid();
    }

    /**
     * Converts this payload to a map for JSON serialization.
     *
     * @return Map representation of this payload
     */
    public Map<String, Object> toMap() {
        Map<String, Object> result = new HashMap<>();
        result.put("txHash", txHash);

        Map<String, Object> authMap = new HashMap<>();
        authMap.put("from", authorization.getFrom());
        authMap.put("facilitator", authorization.getFacilitator());
        authMap.put("tokenContract", authorization.getTokenContract());
        authMap.put("maxAmount", authorization.getMaxAmount());
        result.put("authorization", authMap);

        result.put("paymentNonce", paymentNonce);
        return result;
    }

    /**
     * Creates an UptoNearPayload from a map.
     *
     * @param data Map containing payload data
     * @return New UptoNearPayload instance
     * @throws IllegalArgumentException if data is null or required fields are missing
     */
    @SuppressWarnings("unchecked")
    public static UptoNearPayload fromMap(Map<String, Object> data) {
        if (data == null) {
            throw new IllegalArgumentException("Payload map cannot be null");
        }

        Builder builder = builder();

        if (data.get("txHash") instanceof String) {
            builder.txHash((String) data.get("txHash"));
        }
        if (data.get("paymentNonce") instanceof String) {
            builder.paymentNonce((String) data.get("paymentNonce"));
        }
        if (data.get("authorization") instanceof Map) {
            Map<String, Object> authMap = (Map<String, Object>) data.get("authorization");
            builder.authorization(UptoNearAuthorization.fromMap(authMap));
        }

        return builder.build();
    }

    /**
     * Checks if the given map represents a valid NEAR upto payload.
     *
     * <p>Distinguishes upto payloads from exact-direct payloads by checking
     * for the authorization structure with facilitator field.
     *
     * @param data Map to check
     * @return true if the data has the correct NEAR upto payload structure
     */
    @SuppressWarnings("unchecked")
    public static boolean isUptoNearPayload(Map<String, Object> data) {
        if (data == null) return false;

        Object txHash = data.get("txHash");
        if (!(txHash instanceof String) || ((String) txHash).isEmpty()) return false;

        Object paymentNonce = data.get("paymentNonce");
        if (!(paymentNonce instanceof String) || ((String) paymentNonce).isEmpty()) return false;

        Object authObj = data.get("authorization");
        if (!(authObj instanceof Map)) return false;

        Map<String, Object> auth = (Map<String, Object>) authObj;
        if (!auth.containsKey("from") || !auth.containsKey("facilitator")
                || !auth.containsKey("tokenContract") || !auth.containsKey("maxAmount")) {
            return false;
        }

        Object from = auth.get("from");
        if (!(from instanceof String) || ((String) from).isEmpty()) return false;

        Object facilitator = auth.get("facilitator");
        if (!(facilitator instanceof String) || ((String) facilitator).isEmpty()) return false;

        return true;
    }

    /**
     * Builder for creating UptoNearPayload instances.
     */
    public static class Builder {
        private String txHash;
        private UptoNearAuthorization authorization;
        private String paymentNonce;

        /**
         * Sets the transaction hash.
         *
         * @param txHash NEAR transaction hash
         * @return this builder
         */
        public Builder txHash(String txHash) {
            this.txHash = txHash;
            return this;
        }

        /**
         * Sets the authorization.
         *
         * @param authorization Authorization metadata
         * @return this builder
         */
        public Builder authorization(UptoNearAuthorization authorization) {
            this.authorization = authorization;
            return this;
        }

        /**
         * Sets the payment nonce.
         *
         * @param paymentNonce Unique nonce for replay protection
         * @return this builder
         */
        public Builder paymentNonce(String paymentNonce) {
            this.paymentNonce = paymentNonce;
            return this;
        }

        /**
         * Builds the payload.
         *
         * @return New UptoNearPayload instance
         * @throws IllegalArgumentException if required fields are missing
         */
        public UptoNearPayload build() {
            if (txHash == null || txHash.isEmpty()) {
                throw new IllegalArgumentException("Transaction hash is required");
            }
            if (paymentNonce == null || paymentNonce.isEmpty()) {
                throw new IllegalArgumentException("Payment nonce is required");
            }
            if (authorization == null) {
                throw new IllegalArgumentException("Authorization is required");
            }
            return new UptoNearPayload(this);
        }
    }

    /**
     * Authorization metadata for NEAR upto payments.
     * Contains the transfer details needed for verification.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class UptoNearAuthorization {

        /** Sender's NEAR account ID. */
        @JsonProperty("from")
        private final String from;

        /** Facilitator's NEAR account ID that receives the transfer. */
        private final String facilitator;

        /** NEP-141 token contract ID. */
        @JsonProperty("tokenContract")
        private final String tokenContract;

        /** Maximum authorized amount in smallest units (as string). */
        @JsonProperty("maxAmount")
        private final String maxAmount;

        private UptoNearAuthorization(AuthBuilder builder) {
            this.from = builder.from;
            this.facilitator = builder.facilitator;
            this.tokenContract = builder.tokenContract;
            this.maxAmount = builder.maxAmount;
        }

        /** Default constructor for Jackson. */
        UptoNearAuthorization() {
            this.from = null;
            this.facilitator = null;
            this.tokenContract = null;
            this.maxAmount = null;
        }

        /**
         * Creates a new authorization builder.
         *
         * @return New AuthBuilder
         */
        public static AuthBuilder builder() {
            return new AuthBuilder();
        }

        // Getters

        /**
         * Gets the sender's NEAR account ID.
         *
         * @return Sender account ID
         */
        public String getFrom() {
            return from;
        }

        /**
         * Gets the facilitator's NEAR account ID.
         *
         * @return Facilitator account ID
         */
        public String getFacilitator() {
            return facilitator;
        }

        /**
         * Gets the NEP-141 token contract ID.
         *
         * @return Token contract ID
         */
        public String getTokenContract() {
            return tokenContract;
        }

        /**
         * Gets the maximum authorized amount.
         *
         * @return Maximum amount in smallest units
         */
        public String getMaxAmount() {
            return maxAmount;
        }

        /**
         * Checks if this authorization has all required fields populated.
         *
         * @return true if the authorization is valid
         */
        public boolean isValid() {
            return from != null && !from.isEmpty()
                    && facilitator != null && !facilitator.isEmpty()
                    && tokenContract != null && !tokenContract.isEmpty()
                    && maxAmount != null && !maxAmount.isEmpty();
        }

        /**
         * Creates an UptoNearAuthorization from a map.
         *
         * @param data Map containing authorization data
         * @return New UptoNearAuthorization instance
         */
        public static UptoNearAuthorization fromMap(Map<String, Object> data) {
            AuthBuilder builder = builder();
            if (data.get("from") instanceof String) {
                builder.from((String) data.get("from"));
            }
            if (data.get("facilitator") instanceof String) {
                builder.facilitator((String) data.get("facilitator"));
            }
            if (data.get("tokenContract") instanceof String) {
                builder.tokenContract((String) data.get("tokenContract"));
            }
            if (data.get("maxAmount") instanceof String) {
                builder.maxAmount((String) data.get("maxAmount"));
            }
            return builder.buildUnchecked();
        }

        /**
         * Builder for UptoNearAuthorization.
         */
        public static class AuthBuilder {
            private String from;
            private String facilitator;
            private String tokenContract;
            private String maxAmount;

            /**
             * Sets the sender account ID.
             *
             * @param from Sender's NEAR account ID
             * @return this builder
             */
            public AuthBuilder from(String from) {
                this.from = from;
                return this;
            }

            /**
             * Sets the facilitator account ID.
             *
             * @param facilitator Facilitator's NEAR account ID
             * @return this builder
             */
            public AuthBuilder facilitator(String facilitator) {
                this.facilitator = facilitator;
                return this;
            }

            /**
             * Sets the token contract ID.
             *
             * @param tokenContract NEP-141 token contract ID
             * @return this builder
             */
            public AuthBuilder tokenContract(String tokenContract) {
                this.tokenContract = tokenContract;
                return this;
            }

            /**
             * Sets the maximum amount.
             *
             * @param maxAmount Maximum authorized amount
             * @return this builder
             */
            public AuthBuilder maxAmount(String maxAmount) {
                this.maxAmount = maxAmount;
                return this;
            }

            /**
             * Builds the authorization with validation.
             *
             * @return New UptoNearAuthorization instance
             * @throws IllegalArgumentException if required fields are missing
             */
            public UptoNearAuthorization build() {
                if (from == null || from.isEmpty()) {
                    throw new IllegalArgumentException("From account ID is required");
                }
                if (facilitator == null || facilitator.isEmpty()) {
                    throw new IllegalArgumentException("Facilitator account ID is required");
                }
                if (tokenContract == null || tokenContract.isEmpty()) {
                    throw new IllegalArgumentException("Token contract ID is required");
                }
                if (maxAmount == null || maxAmount.isEmpty()) {
                    throw new IllegalArgumentException("Max amount is required");
                }
                return new UptoNearAuthorization(this);
            }

            /**
             * Builds the authorization without validation (for fromMap).
             *
             * @return New UptoNearAuthorization instance
             */
            UptoNearAuthorization buildUnchecked() {
                return new UptoNearAuthorization(this);
            }
        }
    }
}
