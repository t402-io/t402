package io.t402.schemes.stellar;

import io.t402.schemes.stellar.exact.ExactStellarClientScheme;
import io.t402.schemes.stellar.exact.ExactStellarFacilitatorScheme;
import io.t402.schemes.stellar.exact.ExactStellarServerScheme;

import java.util.List;

/**
 * Factory class for creating Stellar payment schemes.
 * <p>
 * Provides convenient static methods for creating client, server, and facilitator
 * schemes for Stellar payments using Soroban smart contract transfers (SEP-41).
 * </p>
 *
 * <h2>Usage Examples</h2>
 *
 * <h3>Client (Payer) Side</h3>
 * <pre>{@code
 * ClientStellarSigner signer = new MyStellarWalletSigner(keypair);
 * ExactStellarClientScheme client = StellarSchemes.createClient(signer);
 * Map<String, Object> payload = client.createPaymentPayloadSync(requirements);
 * }</pre>
 *
 * <h3>Server Side</h3>
 * <pre>{@code
 * ExactStellarServerScheme server = StellarSchemes.createServer();
 * Map<String, Object> requirements = server.getPaymentRequirements(
 *     "1.50",            // price in USDC
 *     "stellar:pubnet",  // network
 *     "GABC...",         // recipient address
 *     "API Access"       // description
 * );
 * }</pre>
 *
 * <h3>Facilitator Side</h3>
 * <pre>{@code
 * FacilitatorStellarSigner signer = new MyStellarFacilitatorSigner(server);
 * ExactStellarFacilitatorScheme facilitator = StellarSchemes.createFacilitator(signer);
 * facilitator.verify(payload, requirements);
 * }</pre>
 *
 * @see ExactStellarClientScheme
 * @see ExactStellarServerScheme
 * @see ExactStellarFacilitatorScheme
 */
public final class StellarSchemes {

    /** Supported networks for wildcard matching. */
    public static final List<String> SUPPORTED_NETWORKS = List.of(
        StellarConstants.STELLAR_PUBNET,
        StellarConstants.STELLAR_TESTNET
    );

    /** Wildcard pattern for all Stellar networks. */
    public static final String NETWORK_PATTERN = "stellar:*";

    private StellarSchemes() {
        // Utility class
    }

    /**
     * Creates a client scheme for paying with Stellar.
     *
     * @param signer Client signer for payment signing
     * @return Configured client scheme
     * @throws IllegalArgumentException if signer is null
     */
    public static ExactStellarClientScheme createClient(ClientStellarSigner signer) {
        return new ExactStellarClientScheme(signer);
    }

    /**
     * Creates a server scheme for accepting Stellar payments.
     *
     * @return Configured server scheme
     */
    public static ExactStellarServerScheme createServer() {
        return new ExactStellarServerScheme();
    }

    /**
     * Creates a server scheme for accepting Stellar payments with a specific network.
     *
     * @param defaultNetwork Default network for payments (e.g., "stellar:pubnet")
     * @return Configured server scheme
     */
    public static ExactStellarServerScheme createServer(String defaultNetwork) {
        return new ExactStellarServerScheme(defaultNetwork);
    }

    /**
     * Creates a facilitator scheme for verifying and settling Stellar payments.
     *
     * @param signer Facilitator signer with Horizon/Soroban capabilities
     * @return Configured facilitator scheme
     * @throws IllegalArgumentException if signer is null
     */
    public static ExactStellarFacilitatorScheme createFacilitator(FacilitatorStellarSigner signer) {
        return new ExactStellarFacilitatorScheme(signer);
    }

    /**
     * Returns the scheme identifier for exact Stellar payments.
     *
     * @return Scheme identifier string
     */
    public static String getScheme() {
        return StellarConstants.SCHEME_EXACT;
    }

    /**
     * Checks if a network is a valid Stellar network identifier.
     *
     * @param network Network identifier to check
     * @return true if valid Stellar network
     */
    public static boolean isValidNetwork(String network) {
        return StellarConstants.isValidNetwork(network);
    }

    /**
     * Gets the USDC address for a network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return USDC Soroban contract address for the network
     * @throws IllegalArgumentException if network is not recognized
     */
    public static String getUsdcAddress(String network) {
        return StellarConstants.getUsdcAddress(network);
    }
}
