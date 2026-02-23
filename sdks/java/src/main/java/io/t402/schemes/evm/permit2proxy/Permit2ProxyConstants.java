package io.t402.schemes.evm.permit2proxy;

import io.t402.schemes.evm.permit2.Permit2Constants;

/**
 * Constants for the Permit2 Proxy EVM payment scheme.
 *
 * <p>Defines proxy contract addresses, witness type definitions,
 * and scheme identifier for T402 Permit2 proxy-based settlement.</p>
 */
public final class Permit2ProxyConstants {

    private Permit2ProxyConstants() {
        // Utility class
    }

    /** Scheme identifier for Permit2 Proxy payments. */
    public static final String SCHEME_PERMIT2_PROXY = "permit2-proxy";

    /** Canonical Permit2 contract address (re-exported for convenience). */
    public static final String PERMIT2_ADDRESS = Permit2Constants.PERMIT2_ADDRESS;

    /** CAIP family pattern for EVM networks. */
    public static final String CAIP_FAMILY = "eip155:*";

    /** T402 Exact Permit2 Proxy contract address (TBD - not yet deployed). */
    public static final String EXACT_PROXY_ADDRESS = "0x0000000000000000000000000000000000000000";

    /** T402 Upto Permit2 Proxy contract address (TBD - not yet deployed). */
    public static final String UPTO_PROXY_ADDRESS = "0x0000000000000000000000000000000000000000";

    /**
     * EIP-712 typehash for the Witness struct.
     * keccak256("Witness(address to,address facilitator,uint256 validAfter)")
     */
    public static final String WITNESS_TYPEHASH =
        "0x5e3bbbe812684a9a24e1e1b7fe7c5b763bfb791ee8423aed3b4e1a5a9e25c255";

    /**
     * Witness type string for Permit2's permitWitnessTransferFrom.
     * Format: "Witness witness)TokenPermissions(...)Witness(...)" -- types listed alphabetically.
     */
    public static final String WITNESS_TYPE_STRING =
        "Witness witness)TokenPermissions(address token,uint256 amount)"
        + "Witness(address to,address facilitator,uint256 validAfter)";

    /** EIP-712 domain name for the Permit2 contract. */
    public static final String PERMIT2_DOMAIN_NAME = Permit2Constants.PERMIT2_DOMAIN_NAME;
}
