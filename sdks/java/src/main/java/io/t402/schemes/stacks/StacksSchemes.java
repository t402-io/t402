package io.t402.schemes.stacks;

import io.t402.schemes.stacks.exact_direct.ExactDirectStacksClientScheme;
import io.t402.schemes.stacks.exact_direct.ExactDirectStacksFacilitatorScheme;
import io.t402.schemes.stacks.exact_direct.ExactDirectStacksServerScheme;

import java.util.List;
import java.util.Map;

/**
 * Factory class for creating Stacks payment schemes.
 * <p>
 * Provides convenient static methods for creating client, server, and facilitator
 * schemes for Stacks exact-direct payments using SIP-010 tokens.
 * </p>
 *
 * <h2>Usage Examples</h2>
 *
 * <h3>Client (Payer) Side</h3>
 * <pre>{@code
 * ClientStacksSigner signer = new MyStacksSigner(privateKey);
 * ExactDirectStacksClientScheme client = StacksSchemes.createClient(signer);
 *
 * Map<String, Object> payload = client.createPaymentPayloadSync(requirements);
 * }</pre>
 *
 * <h3>Server Side</h3>
 * <pre>{@code
 * ExactDirectStacksServerScheme server = StacksSchemes.createServer();
 *
 * Map<String, Object> requirements = server.getPaymentRequirements(
 *     "1.50",                              // price in sUSDC
 *     "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K",  // recipient principal
 *     "API Service Access"                  // description
 * );
 * }</pre>
 *
 * <h3>Facilitator Side</h3>
 * <pre>{@code
 * FacilitatorStacksSigner signer = new MyStacksQuerier(apiUrl);
 * ExactDirectStacksFacilitatorScheme facilitator = StacksSchemes.createFacilitator(signer);
 *
 * facilitator.verifySync(payload, requirements);
 * }</pre>
 *
 * @see ExactDirectStacksClientScheme
 * @see ExactDirectStacksServerScheme
 * @see ExactDirectStacksFacilitatorScheme
 */
public final class StacksSchemes {

    /** Supported networks. */
    public static final List<String> SUPPORTED_NETWORKS = List.of(
        StacksConstants.MAINNET_CAIP2,
        StacksConstants.TESTNET_CAIP2
    );

    /** Wildcard pattern for all Stacks networks. */
    public static final String NETWORK_PATTERN = "stacks:*";

    private StacksSchemes() {
        // Utility class
    }

    /**
     * Creates a client scheme for paying with Stacks.
     *
     * @param signer Client signer for token transfers
     * @return Configured client scheme
     * @throws IllegalArgumentException if signer is null
     */
    public static ExactDirectStacksClientScheme createClient(ClientStacksSigner signer) {
        return new ExactDirectStacksClientScheme(signer);
    }

    /**
     * Creates a server scheme for accepting Stacks payments.
     *
     * @return Configured server scheme with Stacks Mainnet as default
     */
    public static ExactDirectStacksServerScheme createServer() {
        return new ExactDirectStacksServerScheme();
    }

    /**
     * Creates a server scheme for accepting Stacks payments with a specific network.
     *
     * @param defaultNetwork Default network for payments
     * @return Configured server scheme
     */
    public static ExactDirectStacksServerScheme createServer(String defaultNetwork) {
        return new ExactDirectStacksServerScheme(defaultNetwork);
    }

    /**
     * Creates a facilitator scheme for verifying Stacks payments.
     *
     * @param signer Facilitator signer for querying transactions
     * @return Configured facilitator scheme
     * @throws IllegalArgumentException if signer is null
     */
    public static ExactDirectStacksFacilitatorScheme createFacilitator(FacilitatorStacksSigner signer) {
        return new ExactDirectStacksFacilitatorScheme(signer);
    }

    /**
     * Creates a facilitator scheme with network-specific addresses.
     *
     * @param signer Facilitator signer for querying transactions
     * @param addresses Mapping of network to list of facilitator addresses
     * @return Configured facilitator scheme
     */
    public static ExactDirectStacksFacilitatorScheme createFacilitator(
            FacilitatorStacksSigner signer, Map<String, List<String>> addresses) {
        return new ExactDirectStacksFacilitatorScheme(signer, addresses);
    }

    /**
     * Creates a facilitator scheme with network-specific addresses and custom max age.
     *
     * @param signer Facilitator signer for querying transactions
     * @param addresses Mapping of network to list of facilitator addresses
     * @param maxTransactionAge Maximum transaction age in seconds for verification
     * @return Configured facilitator scheme
     */
    public static ExactDirectStacksFacilitatorScheme createFacilitator(
            FacilitatorStacksSigner signer,
            Map<String, List<String>> addresses,
            int maxTransactionAge) {
        return new ExactDirectStacksFacilitatorScheme(signer, addresses, maxTransactionAge);
    }

    /**
     * Returns the scheme identifier for exact-direct Stacks payments.
     *
     * @return Scheme identifier string
     */
    public static String getScheme() {
        return StacksConstants.SCHEME_EXACT_DIRECT;
    }

    /**
     * Checks if a network is a valid Stacks network identifier.
     *
     * @param network Network identifier to check
     * @return true if valid Stacks network
     */
    public static boolean isValidNetwork(String network) {
        return StacksConstants.isStacksNetwork(network);
    }
}
