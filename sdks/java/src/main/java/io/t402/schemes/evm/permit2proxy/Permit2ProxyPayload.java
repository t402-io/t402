package io.t402.schemes.evm.permit2proxy;

import java.util.HashMap;
import java.util.Map;

/**
 * Payload for Permit2 Proxy EVM payments using witness-based settlement.
 *
 * <p>Contains the permit parameters, witness data (to, facilitator, validAfter),
 * EIP-712 signature, and owner address needed to execute settlement via the proxy contract.</p>
 */
public class Permit2ProxyPayload {

    // Permit fields
    private final String token;
    private final String amount;
    private final String nonce;
    private final String deadline;

    // Witness fields
    private final String witnessTo;
    private final String witnessFacilitator;
    private final String witnessValidAfter;

    private final String signature;
    private final String owner;

    private Permit2ProxyPayload(Builder builder) {
        this.token = builder.token;
        this.amount = builder.amount;
        this.nonce = builder.nonce;
        this.deadline = builder.deadline;
        this.witnessTo = builder.witnessTo;
        this.witnessFacilitator = builder.witnessFacilitator;
        this.witnessValidAfter = builder.witnessValidAfter;
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

    /** Gets the witness destination address (payTo). */
    public String getWitnessTo() { return witnessTo; }

    /** Gets the witness facilitator address. */
    public String getWitnessFacilitator() { return witnessFacilitator; }

    /** Gets the witness validAfter timestamp. */
    public String getWitnessValidAfter() { return witnessValidAfter; }

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

        Map<String, Object> witness = new HashMap<>();
        witness.put("to", witnessTo);
        witness.put("facilitator", witnessFacilitator);
        witness.put("validAfter", witnessValidAfter);

        Map<String, Object> map = new HashMap<>();
        map.put("permit", permit);
        map.put("witness", witness);
        map.put("signature", signature);
        map.put("owner", owner);

        return map;
    }

    /**
     * Creates a Permit2ProxyPayload from a map (deserialization).
     *
     * @param map Map representation of the payload
     * @return New Permit2ProxyPayload instance
     */
    @SuppressWarnings("unchecked")
    public static Permit2ProxyPayload fromMap(Map<String, Object> map) {
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

        Object witnessObj = map.get("witness");
        if (witnessObj instanceof Map) {
            Map<String, Object> witness = (Map<String, Object>) witnessObj;
            if (witness.get("to") instanceof String t) {
                builder.witnessTo(t);
            }
            if (witness.get("facilitator") instanceof String f) {
                builder.witnessFacilitator(f);
            }
            if (witness.get("validAfter") instanceof String va) {
                builder.witnessValidAfter(va);
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
        private String witnessTo;
        private String witnessFacilitator;
        private String witnessValidAfter;
        private String signature;
        private String owner;

        public Builder token(String token) { this.token = token; return this; }
        public Builder amount(String amount) { this.amount = amount; return this; }
        public Builder nonce(String nonce) { this.nonce = nonce; return this; }
        public Builder deadline(String deadline) { this.deadline = deadline; return this; }
        public Builder witnessTo(String witnessTo) { this.witnessTo = witnessTo; return this; }
        public Builder witnessFacilitator(String witnessFacilitator) { this.witnessFacilitator = witnessFacilitator; return this; }
        public Builder witnessValidAfter(String witnessValidAfter) { this.witnessValidAfter = witnessValidAfter; return this; }
        public Builder signature(String signature) { this.signature = signature; return this; }
        public Builder owner(String owner) { this.owner = owner; return this; }

        public Permit2ProxyPayload build() {
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
            if (witnessTo == null || witnessTo.isEmpty()) {
                throw new IllegalArgumentException("Witness to address is required");
            }
            if (witnessFacilitator == null || witnessFacilitator.isEmpty()) {
                throw new IllegalArgumentException("Witness facilitator address is required");
            }
            if (witnessValidAfter == null || witnessValidAfter.isEmpty()) {
                throw new IllegalArgumentException("Witness validAfter is required");
            }
            if (signature == null || signature.isEmpty()) {
                throw new IllegalArgumentException("Signature is required");
            }
            if (owner == null || owner.isEmpty()) {
                throw new IllegalArgumentException("Owner is required");
            }
            return new Permit2ProxyPayload(this);
        }

        /** Build without validation, for deserialization from maps. */
        Permit2ProxyPayload buildFromMap() {
            return new Permit2ProxyPayload(this);
        }
    }
}
