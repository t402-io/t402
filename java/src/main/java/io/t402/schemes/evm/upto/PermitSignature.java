package io.t402.schemes.evm.upto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * EIP-2612 permit signature components.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PermitSignature {

    /** Recovery id (27 or 28). */
    public int v;

    /** First 32 bytes of the signature (hex encoded with 0x prefix). */
    public String r;

    /** Second 32 bytes of the signature (hex encoded with 0x prefix). */
    public String s;

    /** Default constructor for Jackson. */
    public PermitSignature() {}

    /**
     * Creates a new PermitSignature.
     *
     * @param v recovery id
     * @param r first 32 bytes (hex)
     * @param s second 32 bytes (hex)
     */
    public PermitSignature(int v, String r, String s) {
        this.v = v;
        this.r = r;
        this.s = s;
    }

    /**
     * Creates a new PermitSignature.
     *
     * @param v recovery id
     * @param r first 32 bytes (hex)
     * @param s second 32 bytes (hex)
     * @return a new PermitSignature
     */
    public static PermitSignature of(int v, String r, String s) {
        return new PermitSignature(v, r, s);
    }
}
