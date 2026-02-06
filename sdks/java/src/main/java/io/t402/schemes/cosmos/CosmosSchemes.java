package io.t402.schemes.cosmos;

import io.t402.schemes.cosmos.exact.ExactDirectCosmosClientScheme;
import io.t402.schemes.cosmos.exact.ExactDirectCosmosFacilitatorScheme;
import io.t402.schemes.cosmos.exact.ExactDirectCosmosServerScheme;

import java.util.List;

/**
 * Factory class for creating Cosmos payment schemes.
 * <p>
 * Provides convenient static methods for creating client, server, and facilitator
 * schemes for Cosmos/Noble payments using the exact-direct scheme with native USDC.
 * </p>
 *
 * <h2>Usage Examples</h2>
 *
 * <h3>Client (Payer) Side</h3>
 * <pre>{@code
 * // Create a client signer from your wallet
 * ClientCosmosSigner signer = new MyCosmosWalletSigner(keyPair);
 *
 * // Create client scheme
 * ExactDirectCosmosClientScheme client = CosmosSchemes.createClient(signer);
 *
 * // Use with payment requirements
 * Map<String, Object> payload = client.createPaymentPayloadSync(requirements);
 * }</pre>
 *
 * <h3>Server Side</h3>
 * <pre>{@code
 * // Create server scheme for accepting payments
 * ExactDirectCosmosServerScheme server = CosmosSchemes.createServer();
 *
 * // Generate payment requirements
 * Map<String, Object> requirements = server.getPaymentRequirements(
 *     "1.50",                   // price in USDC
 *     "cosmos:noble-1",         // network
 *     "noble1merchant...",      // recipient address
 *     "API Service Access"      // description
 * );
 * }</pre>
 *
 * <h3>Facilitator Side</h3>
 * <pre>{@code
 * // Create facilitator signer
 * FacilitatorCosmosSigner signer = new MyCosmosRpcFacilitator(restClient);
 *
 * // Create facilitator scheme
 * ExactDirectCosmosFacilitatorScheme facilitator = CosmosSchemes.createFacilitator(signer);
 *
 * // Verify and settle payments
 * facilitator.verify(payload, requirements);
 * String txHash = facilitator.settleSync(payload, requirements).transaction;
 * }</pre>
 *
 * @see ExactDirectCosmosClientScheme
 * @see ExactDirectCosmosServerScheme
 * @see ExactDirectCosmosFacilitatorScheme
 */
public final class CosmosSchemes {

    /** Supported networks for wildcard matching. */
    public static final List<String> SUPPORTED_NETWORKS = List.of(
        CosmosConstants.NOBLE_MAINNET,
        CosmosConstants.NOBLE_TESTNET
    );

    /** Wildcard pattern for all Cosmos networks. */
    public static final String NETWORK_PATTERN = "cosmos:*";

    private CosmosSchemes() {
        // Utility class
    }

    /**
     * Creates a client scheme for paying with Cosmos/Noble USDC.
     *
     * @param signer Client signer for transaction signing and sending
     * @return Configured client scheme
     * @throws IllegalArgumentException if signer is null
     *
     * @see ExactDirectCosmosClientScheme
     */
    public static ExactDirectCosmosClientScheme createClient(ClientCosmosSigner signer) {
        return new ExactDirectCosmosClientScheme(signer);
    }

    /**
     * Creates a server scheme for accepting Cosmos/Noble USDC payments.
     *
     * @return Configured server scheme with mainnet default
     *
     * @see ExactDirectCosmosServerScheme
     */
    public static ExactDirectCosmosServerScheme createServer() {
        return new ExactDirectCosmosServerScheme();
    }

    /**
     * Creates a server scheme for accepting Cosmos/Noble USDC payments with a specific network.
     *
     * @param defaultNetwork Default network for payments (e.g., "cosmos:noble-1")
     * @return Configured server scheme
     *
     * @see ExactDirectCosmosServerScheme
     */
    public static ExactDirectCosmosServerScheme createServer(String defaultNetwork) {
        return new ExactDirectCosmosServerScheme(defaultNetwork);
    }

    /**
     * Creates a facilitator scheme for verifying and settling Cosmos payments.
     *
     * @param signer Facilitator signer with REST API query capabilities
     * @return Configured facilitator scheme
     * @throws IllegalArgumentException if signer is null
     *
     * @see ExactDirectCosmosFacilitatorScheme
     */
    public static ExactDirectCosmosFacilitatorScheme createFacilitator(
            FacilitatorCosmosSigner signer) {
        return new ExactDirectCosmosFacilitatorScheme(signer);
    }

    /**
     * Returns the scheme identifier for exact-direct Cosmos payments.
     *
     * @return Scheme identifier string
     */
    public static String getScheme() {
        return CosmosConstants.SCHEME_EXACT_DIRECT;
    }

    /**
     * Checks if a network is a valid Cosmos network identifier.
     *
     * @param network Network identifier to check
     * @return true if valid Cosmos network
     */
    public static boolean isValidNetwork(String network) {
        return CosmosConstants.isValidNetwork(network);
    }

    /**
     * Gets the USDC denomination for a network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return USDC denom string (always "uusdc" for Noble)
     */
    public static String getUsdcDenom(String network) {
        return CosmosConstants.USDC_DENOM;
    }
}
