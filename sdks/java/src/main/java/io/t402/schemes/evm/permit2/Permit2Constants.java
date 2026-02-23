package io.t402.schemes.evm.permit2;

/**
 * Constants for the Permit2 EVM payment scheme.
 *
 * <p>Defines the canonical Permit2 contract address, scheme identifier,
 * and EIP-712 type definitions for Uniswap Permit2 SignatureTransfer.</p>
 */
public final class Permit2Constants {

    private Permit2Constants() {
        // Utility class
    }

    /** Canonical Uniswap Permit2 contract address (same on all EVM chains). */
    public static final String PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3";

    /** Scheme identifier for Permit2 payments. */
    public static final String SCHEME_PERMIT2 = "permit2";

    /** CAIP family pattern for EVM networks. */
    public static final String CAIP_FAMILY = "eip155:*";

    /** EIP-712 domain name for the Permit2 contract. */
    public static final String PERMIT2_DOMAIN_NAME = "Permit2";
}
