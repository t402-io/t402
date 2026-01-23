package io.t402.schemes.near;

import io.t402.schemes.near.exact.ExactDirectNearClientScheme;
import io.t402.schemes.near.exact.ExactDirectNearFacilitatorScheme;
import io.t402.schemes.near.exact.ExactDirectNearServerScheme;

import java.util.List;

/**
 * Factory class for creating NEAR payment schemes.
 * <p>
 * Provides convenient static methods for creating client, server, and facilitator
 * schemes for NEAR payments using the exact-direct scheme.
 * </p>
 *
 * <h2>Usage Examples</h2>
 *
 * <h3>Client (Payer) Side</h3>
 * <pre>{@code
 * // Create a client signer from your wallet
 * ClientNearSigner signer = new MyNearWalletSigner(keyPair);
 *
 * // Create client scheme
 * ExactDirectNearClientScheme client = NearSchemes.createClient(signer);
 *
 * // Use with payment requirements
 * Map<String, Object> payload = client.createPaymentPayloadSync(requirements);
 * }</pre>
 *
 * <h3>Server Side</h3>
 * <pre>{@code
 * // Create server scheme for accepting payments
 * ExactDirectNearServerScheme server = NearSchemes.createServer();
 *
 * // Generate payment requirements
 * Map<String, Object> requirements = server.getPaymentRequirements(
 *     "1.50",                   // price in USDT
 *     "near:mainnet",           // network
 *     "merchant.near",          // recipient address
 *     "API Service Access"      // description
 * );
 * }</pre>
 *
 * <h3>Facilitator Side</h3>
 * <pre>{@code
 * // Create facilitator signer
 * FacilitatorNearSigner signer = new MyNearFacilitatorSigner(rpcClient);
 *
 * // Create facilitator scheme
 * ExactDirectNearFacilitatorScheme facilitator = NearSchemes.createFacilitator(signer);
 *
 * // Verify and settle payments
 * facilitator.verify(payload, requirements);
 * String txHash = facilitator.settleSync(payload, requirements).transaction;
 * }</pre>
 *
 * @see ExactDirectNearClientScheme
 * @see ExactDirectNearServerScheme
 * @see ExactDirectNearFacilitatorScheme
 */
public final class NearSchemes {

    /** Supported networks for wildcard matching. */
    public static final List<String> SUPPORTED_NETWORKS = List.of(
        NearConstants.NEAR_MAINNET,
        NearConstants.NEAR_TESTNET
    );

    /** Wildcard pattern for all NEAR networks. */
    public static final String NETWORK_PATTERN = "near:*";

    private NearSchemes() {
        // Utility class
    }

    /**
     * Creates a client scheme for paying with NEAR.
     *
     * @param signer Client signer for transaction signing and sending
     * @return Configured client scheme
     * @throws IllegalArgumentException if signer is null
     *
     * @see ExactDirectNearClientScheme
     */
    public static ExactDirectNearClientScheme createClient(ClientNearSigner signer) {
        return new ExactDirectNearClientScheme(signer);
    }

    /**
     * Creates a server scheme for accepting NEAR payments.
     *
     * @return Configured server scheme with mainnet default
     *
     * @see ExactDirectNearServerScheme
     */
    public static ExactDirectNearServerScheme createServer() {
        return new ExactDirectNearServerScheme();
    }

    /**
     * Creates a server scheme for accepting NEAR payments with a specific network.
     *
     * @param defaultNetwork Default network for payments (e.g., "near:mainnet")
     * @return Configured server scheme
     *
     * @see ExactDirectNearServerScheme
     */
    public static ExactDirectNearServerScheme createServer(String defaultNetwork) {
        return new ExactDirectNearServerScheme(defaultNetwork);
    }

    /**
     * Creates a facilitator scheme for verifying and settling NEAR payments.
     *
     * @param signer Facilitator signer with RPC query capabilities
     * @return Configured facilitator scheme
     * @throws IllegalArgumentException if signer is null
     *
     * @see ExactDirectNearFacilitatorScheme
     */
    public static ExactDirectNearFacilitatorScheme createFacilitator(FacilitatorNearSigner signer) {
        return new ExactDirectNearFacilitatorScheme(signer);
    }

    /**
     * Returns the scheme identifier for exact-direct NEAR payments.
     *
     * @return Scheme identifier string
     */
    public static String getScheme() {
        return NearConstants.SCHEME_EXACT_DIRECT;
    }

    /**
     * Checks if a network is a valid NEAR network identifier.
     *
     * @param network Network identifier to check
     * @return true if valid NEAR network
     */
    public static boolean isValidNetwork(String network) {
        return NearConstants.isValidNetwork(network);
    }

    /**
     * Gets the USDT contract address for a network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return USDT NEP-141 contract address for the network
     * @throws IllegalArgumentException if network is not recognized
     */
    public static String getUsdtAddress(String network) {
        return NearConstants.getUsdtAddress(network);
    }
}
