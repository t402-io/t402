package io.t402.schemes.ton;

import io.t402.schemes.ton.exact.ExactTonClientScheme;
import io.t402.schemes.ton.exact.ExactTonFacilitatorScheme;
import io.t402.schemes.ton.exact.ExactTonServerScheme;

import java.util.List;

/**
 * Factory class for creating TON payment schemes.
 * <p>
 * Provides convenient static methods for creating client, server, and facilitator
 * schemes for TON payments.
 * </p>
 *
 * <h2>Usage Examples</h2>
 *
 * <h3>Client (Payer) Side</h3>
 * <pre>{@code
 * // Create a client signer from your wallet
 * ClientTonSigner signer = new MyTonWalletSigner(privateKey);
 *
 * // Create client scheme
 * ExactTonClientScheme client = TonSchemes.createClient(signer);
 *
 * // Use with payment requirements
 * Map<String, Object> payload = client.createPaymentPayloadSync(requirements);
 * }</pre>
 *
 * <h3>Server Side</h3>
 * <pre>{@code
 * // Create server scheme for accepting payments
 * ExactTonServerScheme server = TonSchemes.createServer();
 *
 * // Generate payment requirements
 * Map<String, Object> requirements = server.getPaymentRequirements(
 *     "1.50",                // price in USDT
 *     "ton:mainnet",         // network
 *     "EQ...",               // recipient address
 *     "API Service Access"   // description
 * );
 * }</pre>
 *
 * <h3>Facilitator Side</h3>
 * <pre>{@code
 * // Create facilitator signer
 * FacilitatorTonSigner signer = new MyTonFacilitatorSigner(privateKey, rpcClient);
 *
 * // Create facilitator scheme
 * ExactTonFacilitatorScheme facilitator = TonSchemes.createFacilitator(signer);
 *
 * // Verify and settle payments
 * facilitator.verify(payload, requirements);
 * String txHash = facilitator.settleSync(payload, requirements).transaction;
 * }</pre>
 *
 * @see ExactTonClientScheme
 * @see ExactTonServerScheme
 * @see ExactTonFacilitatorScheme
 */
public final class TonSchemes {

    /** Supported networks for wildcard matching. */
    public static final List<String> SUPPORTED_NETWORKS = List.of(
        TonConstants.TON_MAINNET,
        TonConstants.TON_TESTNET
    );

    /** Wildcard pattern for all TON networks. */
    public static final String NETWORK_PATTERN = "ton:*";

    private TonSchemes() {
        // Utility class
    }

    /**
     * Creates a client scheme for paying with TON.
     *
     * @param signer Client signer for payment signing
     * @return Configured client scheme
     * @throws IllegalArgumentException if signer is null
     *
     * @see ExactTonClientScheme
     */
    public static ExactTonClientScheme createClient(ClientTonSigner signer) {
        return new ExactTonClientScheme(signer);
    }

    /**
     * Creates a server scheme for accepting TON payments.
     *
     * @return Configured server scheme
     *
     * @see ExactTonServerScheme
     */
    public static ExactTonServerScheme createServer() {
        return new ExactTonServerScheme();
    }

    /**
     * Creates a server scheme for accepting TON payments with a specific network.
     *
     * @param defaultNetwork Default network for payments (e.g., "ton:mainnet")
     * @return Configured server scheme
     *
     * @see ExactTonServerScheme
     */
    public static ExactTonServerScheme createServer(String defaultNetwork) {
        return new ExactTonServerScheme(defaultNetwork);
    }

    /**
     * Creates a facilitator scheme for verifying and settling TON payments.
     *
     * @param signer Facilitator signer with RPC capabilities
     * @return Configured facilitator scheme
     * @throws IllegalArgumentException if signer is null
     *
     * @see ExactTonFacilitatorScheme
     */
    public static ExactTonFacilitatorScheme createFacilitator(FacilitatorTonSigner signer) {
        return new ExactTonFacilitatorScheme(signer);
    }

    /**
     * Returns the scheme identifier for exact TON payments.
     *
     * @return Scheme identifier string
     */
    public static String getScheme() {
        return TonConstants.SCHEME_EXACT;
    }

    /**
     * Checks if a network is a valid TON network identifier.
     *
     * @param network Network identifier to check
     * @return true if valid TON network
     */
    public static boolean isValidNetwork(String network) {
        return TonConstants.isValidNetwork(network);
    }

    /**
     * Gets the USDT address for a network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return USDT jetton master address for the network
     * @throws IllegalArgumentException if network is not recognized
     */
    public static String getUsdtAddress(String network) {
        return TonConstants.getUsdtAddress(network);
    }
}
