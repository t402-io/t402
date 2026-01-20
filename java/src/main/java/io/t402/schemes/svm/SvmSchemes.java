package io.t402.schemes.svm;

import io.t402.schemes.svm.exact.ExactSvmClientScheme;
import io.t402.schemes.svm.exact.ExactSvmFacilitatorScheme;
import io.t402.schemes.svm.exact.ExactSvmServerScheme;

import java.util.List;

/**
 * Factory class for creating SVM payment schemes.
 * <p>
 * Provides convenient static methods for creating client, server, and facilitator
 * schemes for Solana payments.
 * </p>
 *
 * <h2>Usage Examples</h2>
 *
 * <h3>Client (Payer) Side</h3>
 * <pre>{@code
 * // Create a client signer from your wallet
 * ClientSvmSigner signer = new SolanajClientSigner(keypairBytes);
 *
 * // Create client scheme
 * ExactSvmClientScheme client = SvmSchemes.createClient(signer);
 *
 * // Use with payment requirements
 * Map<String, Object> payload = client.createPaymentPayloadSync(requirements, txBuilder);
 * }</pre>
 *
 * <h3>Server Side</h3>
 * <pre>{@code
 * // Create server scheme for accepting payments
 * ExactSvmServerScheme server = SvmSchemes.createServer();
 *
 * // Generate payment requirements
 * Map<String, Object> requirements = server.getPaymentRequirements(
 *     "0.50",                        // price in USDC
 *     "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp", // mainnet
 *     "My API Service"               // description
 * );
 * }</pre>
 *
 * <h3>Facilitator Side</h3>
 * <pre>{@code
 * // Create facilitator signer with fee payer keys
 * FacilitatorSvmSigner signer = new SolanajFacilitatorSigner.Builder()
 *     .addKeypair(keypairBytes, rpcUrl)
 *     .build();
 *
 * // Create facilitator scheme
 * ExactSvmFacilitatorScheme facilitator = SvmSchemes.createFacilitator(signer);
 *
 * // Verify and settle payments
 * facilitator.verify(payment);
 * String signature = facilitator.settle(payment);
 * }</pre>
 *
 * @see ExactSvmClientScheme
 * @see ExactSvmServerScheme
 * @see ExactSvmFacilitatorScheme
 */
public final class SvmSchemes {

    /** Supported networks for wildcard matching. */
    public static final List<String> SUPPORTED_NETWORKS = List.of(
        SvmConstants.SOLANA_MAINNET,
        SvmConstants.SOLANA_DEVNET,
        SvmConstants.SOLANA_TESTNET
    );

    /** Wildcard pattern for all Solana networks. */
    public static final String NETWORK_PATTERN = "solana:*";

    private SvmSchemes() {
        // Utility class
    }

    /**
     * Creates a client scheme for paying with SVM.
     *
     * @param signer Client signer for transaction signing
     * @return Configured client scheme
     * @throws IllegalArgumentException if signer is null
     *
     * @see ExactSvmClientScheme
     */
    public static ExactSvmClientScheme createClient(ClientSvmSigner signer) {
        return new ExactSvmClientScheme(signer);
    }

    /**
     * Creates a server scheme for accepting SVM payments.
     *
     * @return Configured server scheme
     *
     * @see ExactSvmServerScheme
     */
    public static ExactSvmServerScheme createServer() {
        return new ExactSvmServerScheme();
    }

    /**
     * Creates a server scheme for accepting SVM payments with a specific network.
     *
     * @param defaultNetwork Default network for payments (e.g., "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp")
     * @return Configured server scheme
     *
     * @see ExactSvmServerScheme
     */
    public static ExactSvmServerScheme createServer(String defaultNetwork) {
        return new ExactSvmServerScheme(defaultNetwork);
    }

    /**
     * Creates a facilitator scheme for verifying and settling SVM payments.
     *
     * @param signer Facilitator signer with RPC capabilities
     * @return Configured facilitator scheme
     * @throws IllegalArgumentException if signer is null
     *
     * @see ExactSvmFacilitatorScheme
     */
    public static ExactSvmFacilitatorScheme createFacilitator(FacilitatorSvmSigner signer) {
        return new ExactSvmFacilitatorScheme(signer);
    }

    /**
     * Returns the scheme identifier for exact SVM payments.
     *
     * @return Scheme identifier string
     */
    public static String getScheme() {
        return SvmConstants.SCHEME_EXACT;
    }

    /**
     * Checks if a network is a valid Solana network identifier.
     *
     * @param network Network identifier to check
     * @return true if valid Solana network
     */
    public static boolean isValidNetwork(String network) {
        if (network == null) {
            return false;
        }
        String normalized = SvmConstants.normalizeNetwork(network);
        return normalized.startsWith("solana:");
    }

    /**
     * Gets the USDC mint address for a network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return USDC mint address for the network
     * @throws IllegalArgumentException if network is not recognized
     */
    public static String getUsdcAddress(String network) {
        return SvmConstants.getUsdcAddress(network);
    }
}
