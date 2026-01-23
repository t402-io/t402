package io.t402.schemes.tezos;

import io.t402.schemes.tezos.exact_direct.ExactDirectTezosClientScheme;
import io.t402.schemes.tezos.exact_direct.ExactDirectTezosFacilitatorScheme;
import io.t402.schemes.tezos.exact_direct.ExactDirectTezosServerScheme;

import java.util.List;
import java.util.Map;

/**
 * Factory class for creating Tezos payment schemes.
 * <p>
 * Provides convenient static methods for creating client, server, and facilitator
 * schemes for Tezos exact-direct payments using FA2 token transfers.
 * </p>
 *
 * <h2>Usage Examples</h2>
 *
 * <h3>Client (Payer) Side</h3>
 * <pre>{@code
 * ClientTezosSigner signer = new MyTezosSigner(privateKey, rpcUrl);
 * ExactDirectTezosClientScheme client = TezosSchemes.createClient(signer);
 *
 * Map<String, Object> payload = client.createPaymentPayloadSync(requirements);
 * }</pre>
 *
 * <h3>Server Side</h3>
 * <pre>{@code
 * ExactDirectTezosServerScheme server = TezosSchemes.createServer();
 *
 * Map<String, Object> requirements = server.getPaymentRequirements(
 *     "1.50",                       // price in USDt
 *     "tz1...",                      // recipient address
 *     "API Service Access"          // description
 * );
 * }</pre>
 *
 * <h3>Facilitator Side</h3>
 * <pre>{@code
 * FacilitatorTezosSigner signer = new MyTezosQuerier(indexerUrl);
 * ExactDirectTezosFacilitatorScheme facilitator = TezosSchemes.createFacilitator(signer);
 *
 * facilitator.verifySync(payload, requirements);
 * }</pre>
 *
 * @see ExactDirectTezosClientScheme
 * @see ExactDirectTezosServerScheme
 * @see ExactDirectTezosFacilitatorScheme
 */
public final class TezosSchemes {

    /** Supported networks. */
    public static final List<String> SUPPORTED_NETWORKS = List.of(
        TezosConstants.TEZOS_MAINNET,
        TezosConstants.TEZOS_GHOSTNET
    );

    /** Wildcard pattern for all Tezos networks. */
    public static final String NETWORK_PATTERN = "tezos:*";

    private TezosSchemes() {
        // Utility class
    }

    /**
     * Creates a client scheme for paying with Tezos.
     *
     * @param signer Client signer for FA2 transfers
     * @return Configured client scheme
     * @throws IllegalArgumentException if signer is null
     */
    public static ExactDirectTezosClientScheme createClient(ClientTezosSigner signer) {
        return new ExactDirectTezosClientScheme(signer);
    }

    /**
     * Creates a server scheme for accepting Tezos payments.
     *
     * @return Configured server scheme with mainnet as default
     */
    public static ExactDirectTezosServerScheme createServer() {
        return new ExactDirectTezosServerScheme();
    }

    /**
     * Creates a server scheme for accepting Tezos payments with a specific network.
     *
     * @param defaultNetwork Default network for payments (e.g., "tezos:NetXdQprcVkpaWU")
     * @return Configured server scheme
     */
    public static ExactDirectTezosServerScheme createServer(String defaultNetwork) {
        return new ExactDirectTezosServerScheme(defaultNetwork);
    }

    /**
     * Creates a facilitator scheme for verifying Tezos payments.
     *
     * @param signer Facilitator signer for querying operations
     * @return Configured facilitator scheme
     * @throws IllegalArgumentException if signer is null
     */
    public static ExactDirectTezosFacilitatorScheme createFacilitator(FacilitatorTezosSigner signer) {
        return new ExactDirectTezosFacilitatorScheme(signer);
    }

    /**
     * Creates a facilitator scheme with network-specific addresses.
     *
     * @param signer Facilitator signer for querying operations
     * @param addresses Mapping of network to facilitator Tezos address
     * @return Configured facilitator scheme
     */
    public static ExactDirectTezosFacilitatorScheme createFacilitator(
            FacilitatorTezosSigner signer, Map<String, String> addresses) {
        return new ExactDirectTezosFacilitatorScheme(signer, addresses);
    }

    /**
     * Returns the scheme identifier for exact-direct Tezos payments.
     *
     * @return Scheme identifier string
     */
    public static String getScheme() {
        return TezosConstants.SCHEME_EXACT_DIRECT;
    }

    /**
     * Checks if a network is a valid Tezos network identifier.
     *
     * @param network Network identifier to check
     * @return true if valid Tezos network
     */
    public static boolean isValidNetwork(String network) {
        return TezosConstants.isValidNetwork(network);
    }
}
