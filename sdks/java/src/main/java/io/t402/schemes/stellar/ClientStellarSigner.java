package io.t402.schemes.stellar;

import java.util.concurrent.CompletableFuture;

/**
 * Interface for client-side Stellar signing operations.
 *
 * <p>Implementations should provide methods to:
 * <ul>
 *   <li>Get the signer's Stellar address (G-account)</li>
 *   <li>Sign payment authorization messages</li>
 * </ul>
 *
 * <h2>Example Implementation</h2>
 * <pre>{@code
 * public class MyStellarWalletSigner implements ClientStellarSigner {
 *     private final KeyPair keypair;
 *
 *     @Override
 *     public String getAddress() {
 *         return keypair.getAccountId();
 *     }
 *
 *     @Override
 *     public CompletableFuture<String> signPayment(
 *             StellarAuthorization auth, String network) {
 *         Map<String, Object> payload = auth.toSigningPayload();
 *         return CompletableFuture.completedFuture(
 *             keypair.sign(payload));
 *     }
 * }
 * }</pre>
 */
public interface ClientStellarSigner {

    /**
     * Gets the signer's Stellar address (G-account).
     *
     * @return Stellar G-address
     */
    String getAddress();

    /**
     * Signs a payment authorization.
     *
     * @param authorization Authorization parameters to sign
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing Base64-encoded signature
     */
    CompletableFuture<String> signPayment(StellarAuthorization authorization, String network);

    /**
     * Signs a payment authorization synchronously.
     *
     * @param authorization Authorization parameters to sign
     * @param network Network identifier (CAIP-2 format)
     * @return Base64-encoded signature
     */
    default String signPaymentSync(StellarAuthorization authorization, String network) {
        return signPayment(authorization, network).join();
    }
}
