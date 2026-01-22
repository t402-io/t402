package io.t402.schemes.evm.upto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * EIP-2612 permit authorization parameters.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PermitAuthorization {

    /** Token owner address. */
    public String owner;

    /** Address authorized to spend (router contract). */
    public String spender;

    /** Maximum authorized value (in smallest denomination). */
    public String value;

    /** Permit deadline (unix timestamp as string). */
    public String deadline;

    /** Permit nonce from the token contract. */
    public int nonce;

    /** Default constructor for Jackson. */
    public PermitAuthorization() {}

    /**
     * Creates a new PermitAuthorization.
     *
     * @param owner token owner address
     * @param spender authorized spender address
     * @param value maximum authorized value
     * @param deadline permit deadline
     * @param nonce permit nonce
     */
    public PermitAuthorization(String owner, String spender, String value,
                                String deadline, int nonce) {
        this.owner = owner;
        this.spender = spender;
        this.value = value;
        this.deadline = deadline;
        this.nonce = nonce;
    }

    /**
     * Creates a new PermitAuthorization builder.
     *
     * @return a new builder instance
     */
    public static Builder builder() {
        return new Builder();
    }

    /**
     * Builder for creating PermitAuthorization instances.
     */
    public static class Builder {
        private String owner;
        private String spender;
        private String value;
        private String deadline;
        private int nonce;

        public Builder owner(String owner) {
            this.owner = owner;
            return this;
        }

        public Builder spender(String spender) {
            this.spender = spender;
            return this;
        }

        public Builder value(String value) {
            this.value = value;
            return this;
        }

        public Builder deadline(String deadline) {
            this.deadline = deadline;
            return this;
        }

        public Builder nonce(int nonce) {
            this.nonce = nonce;
            return this;
        }

        public PermitAuthorization build() {
            return new PermitAuthorization(owner, spender, value, deadline, nonce);
        }
    }
}
