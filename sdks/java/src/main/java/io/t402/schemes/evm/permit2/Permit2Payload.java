package io.t402.schemes.evm.permit2;

import java.util.HashMap;
import java.util.Map;

/**
 * Payload for Permit2 EVM payments using Uniswap Permit2 SignatureTransfer.
 *
 * <p>Contains the permit parameters, transfer details, EIP-712 signature,
 * and owner address needed to execute a permitTransferFrom on-chain.</p>
 */
public class Permit2Payload {

    private final String token;
    private final String amount;
    private final String nonce;
    private final String deadline;
    private final String to;
    private final String requestedAmount;
    private final String signature;
    private final String owner;

    private Permit2Payload(Builder builder) {
        this.token = builder.token;
        this.amount = builder.amount;
        this.nonce = builder.nonce;
        this.deadline = builder.deadline;
        this.to = builder.to;
        this.requestedAmount = builder.requestedAmount;
        this.signature = builder.signature;
        this.owner = builder.owner;
    }

    public static Builder builder() {
        return new Builder();
    }

    // Getters

    /** Gets the permitted token address. */
    public String getToken() { return token; }

    /** Gets the permitted amount in atomic units. */
    public String getAmount() { return amount; }

    /** Gets the nonce for replay protection. */
    public String getNonce() { return nonce; }

    /** Gets the permit deadline (unix timestamp). */
    public String getDeadline() { return deadline; }

    /** Gets the transfer destination address. */
    public String getTo() { return to; }

    /** Gets the requested transfer amount in atomic units. */
    public String getRequestedAmount() { return requestedAmount; }

    /** Gets the EIP-712 signature. */
    public String getSignature() { return signature; }

    /** Gets the token owner (payer) address. */
    public String getOwner() { return owner; }

    /**
     * Converts the payload to a map for JSON serialization.
     *
     * @return Map representation matching the protocol wire format
     */
    public Map<String, Object> toMap() {
        Map<String, Object> permitted = new HashMap<>();
        permitted.put("token", token);
        permitted.put("amount", amount);

        Map<String, Object> permit = new HashMap<>();
        permit.put("permitted", permitted);
        permit.put("nonce", nonce);
        permit.put("deadline", deadline);

        Map<String, Object> transferDetails = new HashMap<>();
        transferDetails.put("to", to);
        transferDetails.put("requestedAmount", requestedAmount);

        Map<String, Object> map = new HashMap<>();
        map.put("permit", permit);
        map.put("transferDetails", transferDetails);
        map.put("signature", signature);
        map.put("owner", owner);

        return map;
    }

    /**
     * Creates a Permit2Payload from a map (deserialization).
     *
     * @param map Map representation of the payload
     * @return New Permit2Payload instance
     */
    @SuppressWarnings("unchecked")
    public static Permit2Payload fromMap(Map<String, Object> map) {
        Builder builder = new Builder();

        if (map.get("signature") instanceof String sig) {
            builder.signature(sig);
        }
        if (map.get("owner") instanceof String own) {
            builder.owner(own);
        }

        Object permitObj = map.get("permit");
        if (permitObj instanceof Map) {
            Map<String, Object> permit = (Map<String, Object>) permitObj;
            Object permittedObj = permit.get("permitted");
            if (permittedObj instanceof Map) {
                Map<String, Object> permitted = (Map<String, Object>) permittedObj;
                if (permitted.get("token") instanceof String t) {
                    builder.token(t);
                }
                if (permitted.get("amount") instanceof String a) {
                    builder.amount(a);
                }
            }
            if (permit.get("nonce") instanceof String n) {
                builder.nonce(n);
            }
            if (permit.get("deadline") instanceof String d) {
                builder.deadline(d);
            }
        }

        Object tdObj = map.get("transferDetails");
        if (tdObj instanceof Map) {
            Map<String, Object> td = (Map<String, Object>) tdObj;
            if (td.get("to") instanceof String t) {
                builder.to(t);
            }
            if (td.get("requestedAmount") instanceof String ra) {
                builder.requestedAmount(ra);
            }
        }

        return builder.buildFromMap();
    }

    // Builder

    public static class Builder {
        private String token;
        private String amount;
        private String nonce;
        private String deadline;
        private String to;
        private String requestedAmount;
        private String signature;
        private String owner;

        public Builder token(String token) { this.token = token; return this; }
        public Builder amount(String amount) { this.amount = amount; return this; }
        public Builder nonce(String nonce) { this.nonce = nonce; return this; }
        public Builder deadline(String deadline) { this.deadline = deadline; return this; }
        public Builder to(String to) { this.to = to; return this; }
        public Builder requestedAmount(String requestedAmount) { this.requestedAmount = requestedAmount; return this; }
        public Builder signature(String signature) { this.signature = signature; return this; }
        public Builder owner(String owner) { this.owner = owner; return this; }

        public Permit2Payload build() {
            if (token == null || token.isEmpty()) {
                throw new IllegalArgumentException("Token is required");
            }
            if (amount == null || amount.isEmpty()) {
                throw new IllegalArgumentException("Amount is required");
            }
            if (nonce == null || nonce.isEmpty()) {
                throw new IllegalArgumentException("Nonce is required");
            }
            if (deadline == null || deadline.isEmpty()) {
                throw new IllegalArgumentException("Deadline is required");
            }
            if (to == null || to.isEmpty()) {
                throw new IllegalArgumentException("To address is required");
            }
            if (requestedAmount == null || requestedAmount.isEmpty()) {
                throw new IllegalArgumentException("Requested amount is required");
            }
            if (signature == null || signature.isEmpty()) {
                throw new IllegalArgumentException("Signature is required");
            }
            if (owner == null || owner.isEmpty()) {
                throw new IllegalArgumentException("Owner is required");
            }
            return new Permit2Payload(this);
        }

        /** Build without validation, for deserialization from maps. */
        Permit2Payload buildFromMap() {
            return new Permit2Payload(this);
        }
    }
}
