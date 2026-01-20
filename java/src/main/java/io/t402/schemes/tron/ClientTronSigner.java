package io.t402.schemes.tron;

import java.util.concurrent.CompletableFuture;

/**
 * Interface for client-side TRON signing operations.
 *
 * <p>Implementations should provide methods to:
 * <ul>
 *   <li>Get the signer's TRON address</li>
 *   <li>Sign payment authorization messages</li>
 * </ul>
 *
 * <h2>Example Implementation</h2>
 * <pre>{@code
 * public class MyTronWalletSigner implements ClientTronSigner {
 *     private final TronSigner cryptoSigner;
 *
 *     @Override
 *     public String getAddress() {
 *         return walletAddress;
 *     }
 *
 *     @Override
 *     public CompletableFuture<String> signPayment(TronAuthorization auth, String network) {
 *         Map<String, Object> payload = auth.toSigningPayload();
 *         return CompletableFuture.completedFuture(cryptoSigner.sign(payload));
 *     }
 * }
 * }</pre>
 */
public interface ClientTronSigner {

    /**
     * Gets the signer's TRON address.
     *
     * @return TRON address (Base58Check format, starts with 'T')
     */
    String getAddress();

    /**
     * Signs a payment authorization.
     *
     * @param authorization Authorization parameters to sign
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing hex-encoded signature
     */
    CompletableFuture<String> signPayment(TronAuthorization authorization, String network);

    /**
     * Signs a payment authorization synchronously.
     *
     * @param authorization Authorization parameters to sign
     * @param network Network identifier (CAIP-2 format)
     * @return Hex-encoded signature
     */
    default String signPaymentSync(TronAuthorization authorization, String network) {
        return signPayment(authorization, network).join();
    }
}
