package io.t402.schemes.tron;

import io.t402.schemes.tron.exact.ExactTronClientScheme;
import io.t402.schemes.tron.exact.ExactTronFacilitatorScheme;
import io.t402.schemes.tron.exact.ExactTronServerScheme;

import java.util.List;

/**
 * Factory class for creating TRON payment schemes.
 * <p>
 * Provides convenient static methods for creating client, server, and facilitator
 * schemes for TRON payments.
 * </p>
 *
 * <h2>Usage Examples</h2>
 *
 * <h3>Client (Payer) Side</h3>
 * <pre>{@code
 * // Create a client signer from your wallet
 * ClientTronSigner signer = new MyTronWalletSigner(privateKey);
 *
 * // Create client scheme
 * ExactTronClientScheme client = TronSchemes.createClient(signer);
 *
 * // Use with payment requirements
 * Map<String, Object> payload = client.createPaymentPayloadSync(requirements);
 * }</pre>
 *
 * <h3>Server Side</h3>
 * <pre>{@code
 * // Create server scheme for accepting payments
 * ExactTronServerScheme server = TronSchemes.createServer();
 *
 * // Generate payment requirements
 * Map<String, Object> requirements = server.getPaymentRequirements(
 *     "1.50",                 // price in USDT
 *     "tron:mainnet",         // network
 *     "TXyz...",              // recipient address
 *     "API Service Access"    // description
 * );
 * }</pre>
 *
 * <h3>Facilitator Side</h3>
 * <pre>{@code
 * // Create facilitator signer
 * FacilitatorTronSigner signer = new MyTronFacilitatorSigner(privateKey, rpcClient);
 *
 * // Create facilitator scheme
 * ExactTronFacilitatorScheme facilitator = TronSchemes.createFacilitator(signer);
 *
 * // Verify and settle payments
 * facilitator.verify(payload, requirements);
 * String txHash = facilitator.settleSync(payload, requirements).transaction;
 * }</pre>
 *
 * @see ExactTronClientScheme
 * @see ExactTronServerScheme
 * @see ExactTronFacilitatorScheme
 */
public final class TronSchemes {

    /** Supported networks for wildcard matching. */
    public static final List<String> SUPPORTED_NETWORKS = List.of(
        TronConstants.TRON_MAINNET,
        TronConstants.TRON_NILE,
        TronConstants.TRON_SHASTA
    );

    /** Wildcard pattern for all TRON networks. */
    public static final String NETWORK_PATTERN = "tron:*";

    private TronSchemes() {
        // Utility class
    }

    /**
     * Creates a client scheme for paying with TRON.
     *
     * @param signer Client signer for payment signing
     * @return Configured client scheme
     * @throws IllegalArgumentException if signer is null
     *
     * @see ExactTronClientScheme
     */
    public static ExactTronClientScheme createClient(ClientTronSigner signer) {
        return new ExactTronClientScheme(signer);
    }

    /**
     * Creates a server scheme for accepting TRON payments.
     *
     * @return Configured server scheme
     *
     * @see ExactTronServerScheme
     */
    public static ExactTronServerScheme createServer() {
        return new ExactTronServerScheme();
    }

    /**
     * Creates a server scheme for accepting TRON payments with a specific network.
     *
     * @param defaultNetwork Default network for payments (e.g., "tron:mainnet")
     * @return Configured server scheme
     *
     * @see ExactTronServerScheme
     */
    public static ExactTronServerScheme createServer(String defaultNetwork) {
        return new ExactTronServerScheme(defaultNetwork);
    }

    /**
     * Creates a facilitator scheme for verifying and settling TRON payments.
     *
     * @param signer Facilitator signer with RPC capabilities
     * @return Configured facilitator scheme
     * @throws IllegalArgumentException if signer is null
     *
     * @see ExactTronFacilitatorScheme
     */
    public static ExactTronFacilitatorScheme createFacilitator(FacilitatorTronSigner signer) {
        return new ExactTronFacilitatorScheme(signer);
    }

    /**
     * Returns the scheme identifier for exact TRON payments.
     *
     * @return Scheme identifier string
     */
    public static String getScheme() {
        return TronConstants.SCHEME_EXACT;
    }

    /**
     * Checks if a network is a valid TRON network identifier.
     *
     * @param network Network identifier to check
     * @return true if valid TRON network
     */
    public static boolean isValidNetwork(String network) {
        return TronConstants.isValidNetwork(network);
    }

    /**
     * Gets the USDT address for a network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return USDT TRC-20 contract address for the network
     * @throws IllegalArgumentException if network is not recognized
     */
    public static String getUsdtAddress(String network) {
        return TronConstants.getUsdtAddress(network);
    }
}
