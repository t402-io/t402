package io.t402.schemes.ton;

import java.util.concurrent.CompletableFuture;

/**
 * Interface for client-side TON signing operations.
 *
 * <p>Implementations should provide methods to:
 * <ul>
 *   <li>Get the signer's TON address</li>
 *   <li>Sign payment authorization messages</li>
 * </ul>
 *
 * <h2>Example Implementation</h2>
 * <pre>{@code
 * public class MyTonWalletSigner implements ClientTonSigner {
 *     private final TonSigner cryptoSigner;
 *
 *     @Override
 *     public String getAddress() {
 *         return walletAddress;
 *     }
 *
 *     @Override
 *     public CompletableFuture<String> signPayment(TonAuthorization auth, String network) {
 *         Map<String, Object> payload = auth.toSigningPayload();
 *         return CompletableFuture.completedFuture(cryptoSigner.sign(payload));
 *     }
 * }
 * }</pre>
 */
public interface ClientTonSigner {

    /**
     * Gets the signer's TON address.
     *
     * @return TON address (raw or user-friendly format)
     */
    String getAddress();

    /**
     * Signs a payment authorization.
     *
     * @param authorization Authorization parameters to sign
     * @param network Network identifier (CAIP-2 format)
     * @return CompletableFuture containing Base64-encoded signature
     */
    CompletableFuture<String> signPayment(TonAuthorization authorization, String network);

    /**
     * Signs a payment authorization synchronously.
     *
     * @param authorization Authorization parameters to sign
     * @param network Network identifier (CAIP-2 format)
     * @return Base64-encoded signature
     */
    default String signPaymentSync(TonAuthorization authorization, String network) {
        return signPayment(authorization, network).join();
    }
}
