package io.t402.schemes.polkadot;

import io.t402.schemes.polkadot.exact_direct.ExactDirectPolkadotClientScheme;
import io.t402.schemes.polkadot.exact_direct.ExactDirectPolkadotFacilitatorScheme;
import io.t402.schemes.polkadot.exact_direct.ExactDirectPolkadotServerScheme;

import java.util.List;
import java.util.Map;

/**
 * Factory class for creating Polkadot payment schemes.
 * <p>
 * Provides convenient static methods for creating client, server, and facilitator
 * schemes for Polkadot Asset Hub exact-direct payments.
 * </p>
 *
 * <h2>Usage Examples</h2>
 *
 * <h3>Client (Payer) Side</h3>
 * <pre>{@code
 * ClientPolkadotSigner signer = new MyPolkadotSigner(keypair, rpcUrl);
 * ExactDirectPolkadotClientScheme client = PolkadotSchemes.createClient(signer);
 *
 * Map<String, Object> payload = client.createPaymentPayloadSync(requirements);
 * }</pre>
 *
 * <h3>Server Side</h3>
 * <pre>{@code
 * ExactDirectPolkadotServerScheme server = PolkadotSchemes.createServer();
 *
 * Map<String, Object> requirements = server.getPaymentRequirements(
 *     "1.50",                // price in USDT
 *     "5GrwvaEF...",         // recipient SS58 address
 *     "API Service Access"   // description
 * );
 * }</pre>
 *
 * <h3>Facilitator Side</h3>
 * <pre>{@code
 * FacilitatorPolkadotSigner signer = new MyPolkadotQuerier(indexerUrl);
 * ExactDirectPolkadotFacilitatorScheme facilitator = PolkadotSchemes.createFacilitator(signer);
 *
 * facilitator.verifySync(payload, requirements);
 * }</pre>
 *
 * @see ExactDirectPolkadotClientScheme
 * @see ExactDirectPolkadotServerScheme
 * @see ExactDirectPolkadotFacilitatorScheme
 */
public final class PolkadotSchemes {

    /** Supported networks. */
    public static final List<String> SUPPORTED_NETWORKS = List.of(
        PolkadotConstants.POLKADOT_ASSET_HUB,
        PolkadotConstants.WESTEND_ASSET_HUB
    );

    /** Wildcard pattern for all Polkadot networks. */
    public static final String NETWORK_PATTERN = "polkadot:*";

    private PolkadotSchemes() {
        // Utility class
    }

    /**
     * Creates a client scheme for paying with Polkadot.
     *
     * @param signer Client signer for asset transfers
     * @return Configured client scheme
     * @throws IllegalArgumentException if signer is null
     */
    public static ExactDirectPolkadotClientScheme createClient(ClientPolkadotSigner signer) {
        return new ExactDirectPolkadotClientScheme(signer);
    }

    /**
     * Creates a server scheme for accepting Polkadot payments.
     *
     * @return Configured server scheme with Polkadot Asset Hub as default
     */
    public static ExactDirectPolkadotServerScheme createServer() {
        return new ExactDirectPolkadotServerScheme();
    }

    /**
     * Creates a server scheme for accepting Polkadot payments with a specific network.
     *
     * @param defaultNetwork Default network for payments
     * @return Configured server scheme
     */
    public static ExactDirectPolkadotServerScheme createServer(String defaultNetwork) {
        return new ExactDirectPolkadotServerScheme(defaultNetwork);
    }

    /**
     * Creates a facilitator scheme for verifying Polkadot payments.
     *
     * @param signer Facilitator signer for querying extrinsics
     * @return Configured facilitator scheme
     * @throws IllegalArgumentException if signer is null
     */
    public static ExactDirectPolkadotFacilitatorScheme createFacilitator(FacilitatorPolkadotSigner signer) {
        return new ExactDirectPolkadotFacilitatorScheme(signer);
    }

    /**
     * Creates a facilitator scheme with network-specific addresses.
     *
     * @param signer Facilitator signer for querying extrinsics
     * @param addresses Mapping of network to list of facilitator addresses
     * @return Configured facilitator scheme
     */
    public static ExactDirectPolkadotFacilitatorScheme createFacilitator(
            FacilitatorPolkadotSigner signer, Map<String, List<String>> addresses) {
        return new ExactDirectPolkadotFacilitatorScheme(signer, addresses);
    }

    /**
     * Returns the scheme identifier for exact-direct Polkadot payments.
     *
     * @return Scheme identifier string
     */
    public static String getScheme() {
        return PolkadotConstants.SCHEME_EXACT_DIRECT;
    }

    /**
     * Checks if a network is a valid Polkadot network identifier.
     *
     * @param network Network identifier to check
     * @return true if valid Polkadot network
     */
    public static boolean isValidNetwork(String network) {
        return PolkadotConstants.isValidNetwork(network);
    }
}
