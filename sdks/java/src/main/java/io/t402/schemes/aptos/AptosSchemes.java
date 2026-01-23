package io.t402.schemes.aptos;

import io.t402.schemes.aptos.exact.ExactDirectAptosClientScheme;
import io.t402.schemes.aptos.exact.ExactDirectAptosFacilitatorScheme;
import io.t402.schemes.aptos.exact.ExactDirectAptosServerScheme;

import java.util.List;

/**
 * Factory class for creating Aptos payment schemes.
 * <p>
 * Provides convenient static methods for creating client, server, and facilitator
 * schemes for Aptos exact-direct payments.
 * </p>
 *
 * <h2>Usage Examples</h2>
 *
 * <h3>Client (Payer) Side</h3>
 * <pre>{@code
 * // Create a client signer from your Aptos account
 * ClientAptosSigner signer = new MyAptosSigner(account, client);
 *
 * // Create client scheme
 * ExactDirectAptosClientScheme client = AptosSchemes.createClient(signer);
 *
 * // Use with payment requirements
 * Map<String, Object> payload = client.createPaymentPayloadSync(requirements);
 * }</pre>
 *
 * <h3>Server Side</h3>
 * <pre>{@code
 * // Create server scheme for accepting payments
 * ExactDirectAptosServerScheme server = AptosSchemes.createServer();
 *
 * // Generate payment requirements
 * Map<String, Object> requirements = server.getPaymentRequirements(
 *     "1.50",                 // price in USDT
 *     "aptos:1",              // network
 *     "0x1234...abcd",        // recipient address
 *     "API Service Access"    // description
 * );
 * }</pre>
 *
 * <h3>Facilitator Side</h3>
 * <pre>{@code
 * // Create facilitator signer (transaction querier)
 * FacilitatorAptosSigner signer = new MyAptosQuerier(rpcUrl);
 *
 * // Create facilitator scheme
 * ExactDirectAptosFacilitatorScheme facilitator = AptosSchemes.createFacilitator(signer);
 *
 * // Verify and settle payments
 * var result = facilitator.verifySync(payload, requirements);
 * if (result.valid) {
 *     var settlement = facilitator.settleSync(payload, requirements);
 *     System.out.println("Tx: " + settlement.transaction);
 * }
 * }</pre>
 *
 * @see ExactDirectAptosClientScheme
 * @see ExactDirectAptosServerScheme
 * @see ExactDirectAptosFacilitatorScheme
 */
public final class AptosSchemes {

    /** Supported networks for wildcard matching. */
    public static final List<String> SUPPORTED_NETWORKS = List.of(
        AptosConstants.APTOS_MAINNET,
        AptosConstants.APTOS_TESTNET,
        AptosConstants.APTOS_DEVNET
    );

    /** Wildcard pattern for all Aptos networks. */
    public static final String NETWORK_PATTERN = "aptos:*";

    private AptosSchemes() {
        // Utility class
    }

    /**
     * Creates a client scheme for paying with Aptos.
     *
     * @param signer Client signer for transaction signing and submission
     * @return Configured client scheme
     * @throws IllegalArgumentException if signer is null
     *
     * @see ExactDirectAptosClientScheme
     */
    public static ExactDirectAptosClientScheme createClient(ClientAptosSigner signer) {
        return new ExactDirectAptosClientScheme(signer);
    }

    /**
     * Creates a server scheme for accepting Aptos payments.
     *
     * @return Configured server scheme with mainnet default
     *
     * @see ExactDirectAptosServerScheme
     */
    public static ExactDirectAptosServerScheme createServer() {
        return new ExactDirectAptosServerScheme();
    }

    /**
     * Creates a server scheme for accepting Aptos payments with a specific network.
     *
     * @param defaultNetwork Default network for payments (e.g., "aptos:1")
     * @return Configured server scheme
     *
     * @see ExactDirectAptosServerScheme
     */
    public static ExactDirectAptosServerScheme createServer(String defaultNetwork) {
        return new ExactDirectAptosServerScheme(defaultNetwork);
    }

    /**
     * Creates a facilitator scheme for verifying and settling Aptos payments.
     *
     * @param signer Facilitator signer with transaction query capabilities
     * @return Configured facilitator scheme
     * @throws IllegalArgumentException if signer is null
     *
     * @see ExactDirectAptosFacilitatorScheme
     */
    public static ExactDirectAptosFacilitatorScheme createFacilitator(FacilitatorAptosSigner signer) {
        return new ExactDirectAptosFacilitatorScheme(signer);
    }

    /**
     * Creates a facilitator scheme with custom max transaction age.
     *
     * @param signer Facilitator signer
     * @param maxTransactionAge Maximum transaction age in seconds
     * @return Configured facilitator scheme
     * @throws IllegalArgumentException if signer is null
     */
    public static ExactDirectAptosFacilitatorScheme createFacilitator(
            FacilitatorAptosSigner signer, int maxTransactionAge) {
        return new ExactDirectAptosFacilitatorScheme(signer, maxTransactionAge);
    }

    /**
     * Returns the scheme identifier for exact-direct Aptos payments.
     *
     * @return Scheme identifier string
     */
    public static String getScheme() {
        return AptosConstants.SCHEME_EXACT_DIRECT;
    }

    /**
     * Checks if a network is a valid Aptos network identifier.
     *
     * @param network Network identifier to check
     * @return true if valid Aptos network
     */
    public static boolean isValidNetwork(String network) {
        return AptosConstants.isValidNetwork(network);
    }

    /**
     * Gets the USDT metadata address for a network.
     *
     * @param network Network identifier (CAIP-2 format)
     * @return USDT FA metadata address for the network
     * @throws IllegalArgumentException if network is not recognized
     */
    public static String getUsdtMetadataAddress(String network) {
        return AptosConstants.getUsdtMetadataAddress(network);
    }
}
